/**
 * C-FECHA-MODERNA (19 nov 2026, orden de Richard) — todos los países. La lógica de la ÚNICA casilla
 * de fecha de las tres apps, la web y el panel. Antes cada fecha se pedía a mano como «AAAA-MM-DD»
 * y un guion mal puesto no dejaba crear la cuenta.
 *
 * - El ORDEN lo decide el PAÍS de la persona (no el idioma): Estados Unidos mes/día/año; Venezuela,
 *   Perú, Colombia, México y el resto de América Latina día/mes/año. Sale de los formatos
 *   regionales del sistema (Intl/CLDR), no de una lista escrita a mano.
 * - Se escriben solo números: los separadores aparecen solos, un primer dígito imposible se
 *   completa solo («4» en el día pasa a «04/») y borrar hacia atrás se come el separador.
 * - Al servidor se le sigue mandando «AAAA-MM-DD»: la conversión vive aquí.
 * Sin React: se prueba sola.
 */
export type ParteFecha = 'dia' | 'mes' | 'anio';
export type OrdenFecha = readonly [ParteFecha, ParteFecha, ParteFecha];

export const DIA_MES_ANIO: OrdenFecha = ['dia', 'mes', 'anio'];
const SEPARADOR = '/';
const largo = (parte: ParteFecha) => (parte === 'anio' ? 4 : 2);

/** «es-VE», «en_US», «es-419» → «VE», «US», null. */
export function regionDe(etiqueta: string | null | undefined): string | null {
  const m = /[-_]([A-Za-z]{2})(?:[-_.@]|$)/.exec(etiqueta ?? '');
  return m?.[1] ? m[1].toUpperCase() : null;
}

/**
 * Respaldo SOLO para motores sin `Intl.Locale` (no pueden deducir el idioma de una región): los
 * territorios que escriben el mes primero. El camino normal es Intl.
 */
const MES_PRIMERO_SIN_INTL = new Set(['US', 'PR', 'GU', 'VI', 'AS', 'MP', 'UM']);

/** El orden de la fecha corta de un país, según los formatos regionales del sistema (Intl/CLDR). */
export function ordenDePais(pais: string | null | undefined): OrdenFecha {
  const region = /^[A-Za-z]{2}$/.test(pais ?? '') ? (pais as string).toUpperCase() : null;
  if (!region) return DIA_MES_ANIO;
  try {
    const Localidad = (
      Intl as unknown as {
        Locale?: new (t: string) => { maximize(): { toString(): string } };
      }
    ).Locale;
    if (!Localidad) throw new Error('sin Intl.Locale');
    // «und-PE» → «es-Latn-PE»: el idioma propio del país, y con él su formato de fecha.
    const local = new Localidad(`und-${region}`).maximize().toString();
    const partes = new Intl.DateTimeFormat(local, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      calendar: 'gregory',
      numberingSystem: 'latn',
    })
      .formatToParts(new Date(Date.UTC(2001, 1, 3, 12)))
      .map((p) => p.type)
      .filter((t) => t === 'day' || t === 'month' || t === 'year');
    const [primera] = partes;
    if (partes.length !== 3) throw new Error('formato raro');
    // Una casilla de teclado numérico solo tiene dos formas: mes primero o día primero. Los países
    // que escriben el año primero también entienden día/mes/año.
    return primera === 'month' ? ['mes', 'dia', 'anio'] : DIA_MES_ANIO;
  } catch {
    return MES_PRIMERO_SIN_INTL.has(region) ? ['mes', 'dia', 'anio'] : DIA_MES_ANIO;
  }
}

/** La región configurada en el teléfono o en el navegador, o null si no se puede leer. */
export function regionDelSistema(): string | null {
  try {
    const nav = (
      globalThis as unknown as { navigator?: { language?: string; languages?: string[] } }
    ).navigator;
    const candidatas = [
      ...(nav?.languages ?? []),
      nav?.language,
      Intl.DateTimeFormat().resolvedOptions().locale,
    ];
    for (const c of candidatas) {
      const r = regionDe(c);
      if (r) return r;
    }
  } catch {
    // Sin Intl o sin navegador: decide el país de la ciudad.
  }
  return null;
}

/**
 * De dónde sale el orden, en este orden: la región del teléfono (o del navegador); si no se puede
 * leer, el país de la ciudad donde está la persona; si tampoco, día/mes/año.
 */
export function ordenFecha(opciones?: {
  regionSistema?: string | null;
  paisCiudad?: string | null;
}): OrdenFecha {
  const region =
    opciones && 'regionSistema' in opciones ? opciones.regionSistema : regionDelSistema();
  return ordenDePais(region ?? opciones?.paisCiudad ?? null);
}

/** El marcador de la casilla: «DD/MM/AAAA» o «MM/DD/AAAA» (en inglés, «YYYY»). */
export function marcadorFecha(orden: OrdenFecha, idioma: 'es' | 'en'): string {
  const letras: Record<ParteFecha, string> = {
    dia: 'DD',
    mes: 'MM',
    anio: idioma === 'en' ? 'YYYY' : 'AAAA',
  };
  return orden
    .map((p) => (p === 'dia' ? letras.dia : p === 'mes' ? letras.mes : letras.anio))
    .join(SEPARADOR);
}

/**
 * Lo que queda en la casilla después de cada tecla. `previo` es lo que había: si la persona borró
 * un separador, se borra también el dígito de antes (borrar nunca se traba).
 */
export function escribirFecha(previo: string, nuevo: string, orden: OrdenFecha): string {
  let cifras = nuevo.replace(/\D/g, '');
  const borro = nuevo.length < previo.length;
  if (borro && previo.endsWith(SEPARADOR) && previo.startsWith(nuevo)) cifras = cifras.slice(0, -1);
  const partes: string[] = [];
  let resto = cifras;
  for (const parte of orden) {
    if (!resto) break;
    let trozo = resto.slice(0, largo(parte));
    resto = resto.slice(trozo.length);
    // Un primer dígito imposible se completa solo: «4» en el día es «04»; «2» en el mes, «02».
    if (!borro && trozo.length === 1 && parte !== 'anio') {
      const tope = parte === 'dia' ? 3 : 1;
      if (Number(trozo) > tope) trozo = `0${trozo}`;
    }
    partes.push(trozo);
  }
  let texto = partes.join(SEPARADOR);
  const ultima = orden[partes.length - 1];
  const completa = ultima !== undefined && partes.at(-1)?.length === largo(ultima);
  // El separador aparece solo al completar el día y el mes (no al borrar: se quedaría pegado).
  if (!borro && completa && partes.length < orden.length) texto += SEPARADOR;
  return texto;
}

export type FalloFecha = 'incompleta' | 'imposible' | 'futura' | 'antigua';

/**
 * Lo escrito → «AAAA-MM-DD». Vacío no es un fallo (iso null, sin fallo): una fecha opcional vacía
 * nunca bloquea. `hoy` (AAAA-MM-DD) permite rechazar fechas futuras cuando no tienen sentido.
 */
export function leerFecha(
  texto: string,
  orden: OrdenFecha,
  reglas?: { hoy?: string; sinFuturo?: boolean; anioMinimo?: number },
): { iso: string | null; fallo: FalloFecha | null } {
  const limpio = texto.trim();
  if (!limpio) return { iso: null, fallo: null };
  const trozos = limpio.split(SEPARADOR);
  const valor = (parte: ParteFecha) => trozos[orden.indexOf(parte)] ?? '';
  const [d, m, a] = [valor('dia'), valor('mes'), valor('anio')];
  if (d.length !== 2 || m.length !== 2 || a.length !== 4 || trozos.length !== 3)
    return { iso: null, fallo: 'incompleta' };
  const [dia, mes, anio] = [Number(d), Number(m), Number(a)];
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    mes < 1 ||
    mes > 12 ||
    dia < 1 ||
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mes - 1 ||
    fecha.getUTCDate() !== dia
  )
    return { iso: null, fallo: 'imposible' };
  const iso = `${a}-${m}-${d}`;
  if (anio < (reglas?.anioMinimo ?? 1900)) return { iso: null, fallo: 'antigua' };
  if (reglas?.sinFuturo && reglas.hoy && iso > reglas.hoy) return { iso: null, fallo: 'futura' };
  return { iso, fallo: null };
}

/** «AAAA-MM-DD» → lo que se ve en la casilla, en el orden del país. Otra cosa: vacío. */
export function mostrarFecha(iso: string | null | undefined, orden: OrdenFecha): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '';
  const valores: Record<ParteFecha, string> = {
    anio: m[1] ?? '',
    mes: m[2] ?? '',
    dia: m[3] ?? '',
  };
  return orden
    .map((p) => (p === 'dia' ? valores.dia : p === 'mes' ? valores.mes : valores.anio))
    .join(SEPARADOR);
}

/** ¿Lo escrito ya es una fecha entera (para pasar el foco a la casilla siguiente)? */
export const fechaCompleta = (texto: string) => texto.length === 10;

/** Los mensajes al lado de la casilla: en palabras, sin culpar a nadie. */
export const TEXTOS_FECHA: Record<'es' | 'en', Record<FalloFecha, string>> = {
  es: {
    incompleta: 'A la fecha le falta una parte. Puedes completarla o dejarla vacía.',
    imposible: 'Ese día no existe en ese mes. Revisa el día y el mes.',
    futura: 'Esa fecha todavía no llega. Revisa el año.',
    antigua: 'Revisa el año de la fecha.',
  },
  en: {
    incompleta: 'The date is missing a part. You can finish it or leave it empty.',
    imposible: 'That day doesn’t exist in that month. Check the day and the month.',
    futura: 'That date hasn’t arrived yet. Check the year.',
    antigua: 'Check the year of the date.',
  },
};
