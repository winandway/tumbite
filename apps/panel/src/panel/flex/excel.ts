import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/**
 * C-FLEX-EXCEL (Flex Fase 7, 13 nov 2026). Todos los países.
 *
 * Importar envíos desde un Excel (.xlsx) SIN subir el archivo al servidor: el navegador lo abre
 * (un .xlsx es un ZIP con XML; se descomprime con `fflate`, pequeña y mantenida) y lo convierte al
 * mismo CSV de siempre. Después sigue el camino del CSV: la misma validación del servidor, la
 * vista previa y los errores por fila. Solo se lee la PRIMERA hoja; fórmulas, colores y fechas con
 * formato no se interpretan (se toma el valor guardado).
 */
export const MAX_XLSX_BYTES = 5 * 1024 * 1024;
const MAX_DESCOMPRIMIDO = 40 * 1024 * 1024;

/** Topes en el navegador antes de convertir: un Excel enorme no traba la pestaña. */
export const MAX_FILAS_XLSX = 5_000;
export const MAX_CELDAS_XLSX = 100_000;

export type MotivoExcel = 'invalido' | 'grande' | 'filas' | 'celdas' | 'vacio';
export class ExcelIlegible extends Error {
  constructor(
    mensaje: string,
    readonly motivo: MotivoExcel = 'invalido',
  ) {
    super(mensaje);
  }
}

/** «AB12» → índice de columna 27 (base 0). */
function columna(ref: string): number {
  const letras = /^[A-Z]+/.exec(ref)?.[0] ?? '';
  let n = 0;
  for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64);
  return n - 1;
}

const textoDe = (el: Element | null | undefined) =>
  el ? Array.from(el.getElementsByTagName('t'), (t) => t.textContent ?? '').join('') : '';

function celdaCsv(v: string): string {
  return /[",\r\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Ruta de la primera hoja según el libro (o la primera que exista). */
function primeraHoja(archivos: Record<string, Uint8Array>, xml: (r: string) => Document | null) {
  const libro = xml('xl/workbook.xml');
  const rels = xml('xl/_rels/workbook.xml.rels');
  const hoja = libro?.getElementsByTagName('sheet')[0];
  const rid =
    hoja?.getAttribute('r:id') ??
    hoja?.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'id',
    );
  if (rid && rels) {
    const rel = Array.from(rels.getElementsByTagName('Relationship')).find(
      (r) => r.getAttribute('Id') === rid,
    );
    const destino = rel?.getAttribute('Target') ?? '';
    const ruta = destino.startsWith('/') ? destino.slice(1) : `xl/${destino.replace(/^\.\//, '')}`;
    if (Object.prototype.hasOwnProperty.call(archivos, ruta)) return ruta;
  }
  return Object.keys(archivos)
    .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
    .sort((a, b) => Number(/\d+/.exec(a)?.[0]) - Number(/\d+/.exec(b)?.[0]))[0];
}

/** Convierte la primera hoja de un .xlsx al CSV que entiende la importación. */
export function xlsxACsv(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_XLSX_BYTES)
    throw new ExcelIlegible('El archivo pesa demasiado (máximo 5 MB).', 'grande');
  let archivos: Record<string, Uint8Array>;
  try {
    let total = 0;
    archivos = unzipSync(bytes, {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_DESCOMPRIMIDO)
          throw new ExcelIlegible('El archivo es demasiado grande.', 'grande');
        return (f.name.startsWith('xl/') && f.name.endsWith('.xml')) || f.name.endsWith('.rels');
      },
    });
  } catch (e) {
    if (e instanceof ExcelIlegible) throw e;
    throw new ExcelIlegible('Ese archivo no es un Excel (.xlsx) válido.');
  }
  const xml = (ruta: string) => {
    // eslint-disable-next-line security/detect-object-injection -- rutas fijas del formato xlsx
    const a = archivos[ruta];
    return a ? new DOMParser().parseFromString(strFromU8(a), 'application/xml') : null;
  };
  const ruta = primeraHoja(archivos, xml);
  const hoja = ruta ? xml(ruta) : null;
  if (!hoja) throw new ExcelIlegible('Ese archivo no es un Excel (.xlsx) válido.');
  const compartidos = Array.from(
    xml('xl/sharedStrings.xml')?.getElementsByTagName('si') ?? [],
    (si) => textoDe(si),
  );
  const todasLasFilas = hoja.getElementsByTagName('row');
  if (todasLasFilas.length > MAX_FILAS_XLSX)
    throw new ExcelIlegible(`El Excel tiene más de ${MAX_FILAS_XLSX} filas.`, 'filas');
  if (hoja.getElementsByTagName('c').length > MAX_CELDAS_XLSX)
    throw new ExcelIlegible(`El Excel tiene más de ${MAX_CELDAS_XLSX} celdas.`, 'celdas');
  const filas: string[][] = [];
  for (const fila of Array.from(todasLasFilas)) {
    const celdas: string[] = [];
    let siguiente = 0;
    for (const c of Array.from(fila.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r');
      const i = ref ? columna(ref) : siguiente;
      siguiente = i + 1;
      if (i < 0 || i > 200) continue;
      const tipo = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const valor =
        tipo === 's'
          ? (compartidos.at(Number(v)) ?? '')
          : tipo === 'inlineStr'
            ? textoDe(c.getElementsByTagName('is')[0])
            : tipo === 'b'
              ? v === '1'
                ? 'TRUE'
                : 'FALSE'
              : v;
      while (celdas.length < i) celdas.push('');
      celdas.splice(i, 1, valor.trim());
    }
    if (celdas.some((x) => x !== '')) filas.push(celdas);
  }
  if (!filas.length) throw new ExcelIlegible('La primera hoja del Excel está vacía.', 'vacio');
  return `${filas.map((f) => f.map(celdaCsv).join(',')).join('\r\n')}\r\n`;
}

/** Las columnas de la plantilla (en inglés, como la versión principal; también se aceptan en español). */
export const COLUMNAS_PLANTILLA = [
  'reference',
  'recipient',
  'phone',
  'email',
  'address',
  'lat',
  'lng',
  'packages',
  'description',
  'instructions',
  'window_from',
  'window_to',
] as const;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Plantilla .xlsx descargable: una hoja con la fila de títulos, nada más (ningún dato de mentira). */
export function plantillaXlsx(columnas: readonly string[] = COLUMNAS_PLANTILLA): Uint8Array {
  const letra = (i: number) => {
    let s = '';
    for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26))
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  const celdas = columnas
    .map((c, i) => `<c r="${letra(i)}1" t="inlineStr"><is><t>${esc(c)}</t></is></c>`)
    .join('');
  const ns = 'http://schemas.openxmlformats.org';
  return zipSync({
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets><sheet name="Shipments" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${ns}/spreadsheetml/2006/main"><sheetData><row r="1">${celdas}</row></sheetData></worksheet>`,
    ),
  });
}
