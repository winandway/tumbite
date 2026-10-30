/**
 * Licencias e identificaciones de EE. UU.: el código de barras PDF417 del reverso guarda los datos en el
 * estándar AAMVA (cada dato con su código de 3 letras: DCS apellido, DAC nombre, DBB nacimiento…). Es lo
 * mismo que lee Idswyft con `parse-usdl`; aquí, propio y sin dependencias. Recibe el texto ya decodificado.
 */
export type DatosDocumento = {
  tipo: 'licencia_eeuu' | 'pasaporte';
  numero: string;
  apellidos: string;
  nombres: string;
  /** AAAA-MM-DD */
  nacimiento: string;
  /** AAAA-MM-DD */
  vencimiento: string;
  /** Estado (EE. UU.) o país emisor (pasaporte). */
  emisor: string;
  sexo: 'M' | 'F' | 'X' | '';
};

/** MMDDAAAA (EE. UU.) o AAAAMMDD (Canadá) → AAAA-MM-DD; vacío si no es una fecha. */
function fecha(v: string | undefined, pais: string): string {
  const d = (v ?? '').trim();
  if (!/^\d{8}$/.test(d)) return '';
  const [a, m, dia] =
    pais === 'CAN'
      ? [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)]
      : [d.slice(4, 8), d.slice(0, 2), d.slice(2, 4)];
  const iso = `${a}-${m}-${dia}`;
  return Number.isNaN(Date.parse(`${iso}T00:00:00Z`)) ? '' : iso;
}

export function leerAamva(texto: string): DatosDocumento | null {
  if (!/ANSI |AAMVA/.test(texto.slice(0, 40))) return null;
  const campos = new Map<string, string>();
  // El separador de registros (carácter 30) también corta líneas en algunos estados.
  for (const linea of texto
    .split(String.fromCharCode(30))
    .join('\n')
    .split(/[\r\n]+/)) {
    // Cada línea empieza con el código del dato; la primera del bloque puede traer «DL» antes.
    const m = /(?:^|DL|ID)(D[A-Z]{2})(.*)$/.exec(linea.trim());
    if (m?.[1] && !campos.has(m[1])) campos.set(m[1], (m[2] ?? '').trim());
  }
  const numero = campos.get('DAQ') ?? '';
  if (!numero) return null;
  const pais = campos.get('DCG') ?? 'USA';
  // Nombre completo viejo (DAA «APELLIDO,NOMBRE,…») o separado (DCS apellido, DAC/DCT nombre).
  const completo = (campos.get('DAA') ?? '').split(',');
  const apellidos = campos.get('DCS') ?? completo[0] ?? '';
  const nombres = [
    campos.get('DAC') ?? campos.get('DCT') ?? completo[1] ?? '',
    campos.get('DAD') ?? '',
  ]
    .filter((x) => x && x !== 'NONE')
    .join(' ');
  const sexo = campos.get('DBC');
  return {
    tipo: 'licencia_eeuu',
    numero,
    apellidos: apellidos.trim(),
    nombres: nombres.trim(),
    nacimiento: fecha(campos.get('DBB'), pais),
    vencimiento: fecha(campos.get('DBA'), pais),
    emisor: campos.get('DAJ') ?? '',
    sexo: sexo === '1' ? 'M' : sexo === '2' ? 'F' : sexo === '9' ? 'X' : '',
  };
}
