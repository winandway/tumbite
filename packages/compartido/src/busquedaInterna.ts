/**
 * C-BUSCADOR-SERIO y C-SUPERADMIN-ENLACES (15 nov 2026, pedido de Richard tras no encontrar el
 * pedido «407F» en el superadmin). Todos los países.
 *
 * Una sola pieza, sin inteligencia artificial: mira la FORMA de lo que se escribió y dice qué se
 * puede buscar con eso (código de pedido, identificador entero, teléfono, correo, placa, monto,
 * código de repartidor o nombre). No es excluyente: «AB123C» es a la vez un código hexadecimal y
 * una placa, y «4821» es un código y el final de un teléfono; el servidor consulta cada cosa por su
 * índice y junta los resultados por grupo. La usan el buscador de arriba del superadmin y la
 * pantalla «Pedidos en curso», así las dos encuentran lo mismo.
 */

/** Los identificadores que aceptan las fichas del superadmin (UUID o cualquier id de la base). */
export const PATRON_ID_FICHA = '[A-Za-z0-9_-]{1,100}';
const ID_FICHA = new RegExp(`^${PATRON_ID_FICHA}$`);
export const esIdFicha = (id: string): boolean => ID_FICHA.test(id);

/** Las apps muestran las primeras 4 letras del código del pedido; el superadmin, 6. */
export const LETRAS_CODIGO_APPS = 4;
export const LETRAS_CODIGO_PANEL = 6;
export const codigoCorto = (id: string): string => id.slice(0, LETRAS_CODIGO_PANEL).toUpperCase();

/**
 * Letras con acento → sin acento, en minúscula. La MISMA tabla arma la expresión SQL del índice
 * (servidor) y el texto que se busca (aquí): «José», «JOSÉ» y «jose» se encuentran igual. Cada
 * letra se cambia por UNA letra, así las posiciones no se mueven y el panel puede resaltar lo que
 * coincidió sobre el texto original.
 */
export const LETRAS_PLANAS: readonly (readonly [string, string])[] = [
  ...[...'áàâäã'].map((l) => [l, 'a'] as const),
  ...[...'ÁÀÂÄÃ'].map((l) => [l, 'a'] as const),
  ...[...'éèêë'].map((l) => [l, 'e'] as const),
  ...[...'ÉÈÊË'].map((l) => [l, 'e'] as const),
  ...[...'íìîï'].map((l) => [l, 'i'] as const),
  ...[...'ÍÌÎÏ'].map((l) => [l, 'i'] as const),
  ...[...'óòôöõ'].map((l) => [l, 'o'] as const),
  ...[...'ÓÒÔÖÕ'].map((l) => [l, 'o'] as const),
  ...[...'úùûü'].map((l) => [l, 'u'] as const),
  ...[...'ÚÙÛÜ'].map((l) => [l, 'u'] as const),
  ['ñ', 'n'],
  ['Ñ', 'n'],
  ['ç', 'c'],
  ['Ç', 'c'],
];
const MAPA_PLANO = new Map(LETRAS_PLANAS.map(([a, b]) => [a, b]));

/**
 * El texto «plano»: sin acentos (tabla de arriba) y con las letras A-Z en minúscula. Igual que
 * `lower(replace(…))` de SQLite, que solo pasa a minúscula las letras sin acento.
 */
export function textoPlano(s: string): string {
  let r = '';
  for (const c of s) {
    const p = MAPA_PLANO.get(c);
    r += p ?? (c >= 'A' && c <= 'Z' ? c.toLowerCase() : c);
  }
  return r;
}

/** [desde, hasta): todo lo que empieza por `p` en orden de la base (un rango sobre un índice). */
export function rangoPrefijo(p: string): [string, string] {
  const ultimo = p.charCodeAt(p.length - 1);
  return [p, `${p.slice(0, -1)}${String.fromCharCode(ultimo + 1)}`];
}

export type BusquedaInterna = {
  /** Lo escrito, limpio (sin espacios de más). */
  texto: string;
  vacia: boolean;
  /** Comienzo del identificador de un pedido, viaje o ticket (hexadecimal, en minúscula). */
  codigo?: string;
  /** Un identificador entero (UUID u otro id de la base): si existe, se salta directo a su ficha. */
  id?: string;
  /** Solo los dígitos de un teléfono (se busca por comienzo y por final). */
  telefono?: string;
  /** En minúscula. Completo (con dominio) se busca exacto; a medias, por comienzo. */
  correo?: string;
  /**
   * C-BUSCADOR-SECCIONES (19 nov 2026, Richard no encontraba a un conductor recién registrado por el
   * comienzo de su correo de Gmail): lo escrito sin «@» y sin espacios también puede ser el comienzo
   * de un correo («kpr» → «kprado07@gmail.com»). En minúscula; se busca por comienzo.
   */
  inicioCorreo?: string;
  /** En mayúscula, sin espacios ni guiones. */
  placa?: string;
  /** En centavos. Solo dentro de los últimos 30 días. */
  monto?: number;
  /** Comienzo del código de repartidor (US-MIA-000123), en mayúscula. */
  codigoRepartidor?: string;
  /** Nombre por comienzo, en texto plano (sin acentos ni mayúsculas). */
  nombre?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// C-BUSCADOR-INSTANTANEO (16 nov 2026): el código se reconoce DESDE LA PRIMERA LETRA («7», «b4»).
// Antes pedía 3 y Richard escribió «7», «73» y «b4» sin que saliera nada.
const CODIGO = /^[0-9a-f]{1,8}$/i;
const CODIGO_LARGO = /^[0-9a-f]{8}-[0-9a-f-]{0,27}$/i;
// eslint-disable-next-line security/detect-unsafe-regex -- cuantificadores acotados sobre un texto de 80 letras como mucho
const REPARTIDOR = /^[a-z]{2}-(?:[a-z]{1,4}(?:-\d{0,6})?)?$/i;
// eslint-disable-next-line security/detect-unsafe-regex -- cuantificadores acotados sobre un texto de 80 letras como mucho
const MONTO = /^(?:\$\s?\d{1,7}(?:[.,]\d{1,2})?|\d{1,7}[.,]\d{2})$/;
const TELEFONO = /^\+?[\d\s().-]+$/;
const LETRA = /^\p{L}/u;
/** El comienzo de un correo: empieza por una letra, sin espacios ni «@» (64 letras como mucho). */
const INICIO_CORREO = /^[a-z][a-z0-9._+-]{0,63}$/i;

function aCentavos(s: string): number {
  const [entero = '0', decimales = ''] = s.replace(/[$\s]/g, '').split(/[.,]/);
  return Number(entero) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2));
}

/** Qué se puede buscar con lo escrito. Admite pistas: «tel:», «placa:», «monto:», «correo:», «id:». */
export function interpretarBusqueda(entrada: string): BusquedaInterna {
  const texto = entrada.replace(/\s+/g, ' ').trim().slice(0, 80);
  const b: BusquedaInterna = { texto, vacia: texto === '' };
  if (b.vacia) return b;
  const pista = /^(tel|placa|monto|correo|id):\s*(.+)$/i.exec(texto);
  if (pista) {
    const tipo = (pista[1] ?? '').toLowerCase();
    const valor = (pista[2] ?? '').trim();
    const sub = interpretarBusqueda(valor);
    if (tipo === 'tel') {
      const d = valor.replace(/\D/g, '');
      return d.length >= 4 ? { texto, vacia: false, telefono: d } : { texto, vacia: false };
    }
    if (tipo === 'placa') {
      const p = valor.replace(/[\s-]/g, '').toUpperCase();
      return /^[A-Z0-9]{2,10}$/.test(p)
        ? { texto, vacia: false, placa: p }
        : { texto, vacia: false };
    }
    if (tipo === 'monto') {
      // eslint-disable-next-line security/detect-unsafe-regex -- cuantificadores acotados (80 letras como mucho)
      const m = /^\$?\s?\d{1,7}(?:[.,]\d{1,2})?$/.test(valor) ? aCentavos(valor) : undefined;
      return m === undefined ? { texto, vacia: false } : { texto, vacia: false, monto: m };
    }
    if (tipo === 'correo') return { texto, vacia: false, correo: valor.toLowerCase() };
    return sub.id ? { texto, vacia: false, id: sub.id } : { texto, vacia: false, id: valor };
  }
  if (texto.includes('@')) return { ...b, correo: texto.toLowerCase() };
  if (MONTO.test(texto)) return { ...b, monto: aCentavos(texto) };
  if (UUID.test(texto)) return { ...b, id: texto.toLowerCase() };
  const sinNumeral = texto.replace(/^#\s*/, '');
  if (CODIGO.test(sinNumeral) || CODIGO_LARGO.test(sinNumeral)) b.codigo = sinNumeral.toLowerCase();
  if (REPARTIDOR.test(texto)) b.codigoRepartidor = texto.toUpperCase();
  if (/^[a-z0-9_-]{9,100}$/i.test(texto) && /[-_]/.test(texto) && /\d/.test(texto)) b.id = texto;
  if (TELEFONO.test(texto)) {
    const d = texto.replace(/\D/g, '');
    if (d.length >= 4 && d.length <= 15) b.telefono = d;
  }
  const placa = texto.replace(/[\s-]/g, '');
  if (/^[a-z0-9]{4,8}$/i.test(placa) && /[a-z]/i.test(placa) && /\d/.test(placa))
    b.placa = placa.toUpperCase();
  if (LETRA.test(texto)) b.nombre = textoPlano(texto);
  // Desde la segunda letra (con una sola, el nombre ya sugiere); si además puede ser un código
  // («b4», «ab»), desde la tercera: el código manda con una o dos letras y no se lee de más.
  if (INICIO_CORREO.test(texto) && texto.length >= (b.codigo ? 3 : 2))
    b.inicioCorreo = texto.toLowerCase();
  return b;
}

/**
 * C-BUSCADOR-INSTANTANEO: «¿quisiste decir…?» para un código mal escrito. Las letras que la gente
 * confunde con números (O y o → 0; I, i, l y L → 1) y los espacios o guiones de más. Solo propone
 * algo si lo escrito NO es ya un código y la corrección sí lo es (hexadecimal, de 1 a 8 letras).
 * Devuelve el código sugerido en mayúsculas con «#», o null.
 */
export function quisoDecirCodigo(entrada: string): string | null {
  const limpio = entrada.trim().replace(/^#\s*/, '');
  if (!limpio || CODIGO.test(limpio)) return null;
  const corregido = limpio
    .replace(/[\s-]/g, '')
    .replace(/[oO]/g, '0')
    .replace(/[iIlL]/g, '1');
  return corregido !== limpio && CODIGO.test(corregido) ? `#${corregido.toUpperCase()}` : null;
}

/**
 * Teléfono enmascarado: «+1 ••• ••• 4821». Solo quedan el país (si se ve) y los últimos cuatro.
 */
export function enmascararTelefono(telefono: string | null | undefined): string {
  const d = String(telefono ?? '').replace(/\D/g, '');
  if (d.length < 4) return d ? '••••' : '';
  const pais = d.length > 10 ? d.slice(0, d.length - 10) : '';
  return `${pais ? `+${pais} ` : ''}••• ••• ${d.slice(-4)}`;
}

/** Correo enmascarado: «a•••@gmail.com». */
export function enmascararCorreo(correo: string | null | undefined): string {
  const c = String(correo ?? '');
  const arroba = c.lastIndexOf('@');
  if (arroba < 1) return c ? '•••' : '';
  return `${c[0]}•••${c.slice(arroba)}`;
}

/**
 * Dónde empieza y dónde termina, dentro de `texto`, lo que coincidió con `buscado` (sin mirar
 * acentos ni mayúsculas). Sirve para resaltar. null si no aparece.
 */
export function tramoCoincidente(texto: string, buscado: string): [number, number] | null {
  const q = textoPlano(buscado.replace(/^#/, '').trim());
  if (!q) return null;
  const i = textoPlano(texto).indexOf(q);
  return i < 0 ? null : [i, i + q.length];
}

/** Los estados del pedido para el selector Vivos · Cerrados · Todos. */
export const ESTADOS_PEDIDO_VIVOS = [
  'pago_pendiente',
  'pagado',
  'aceptado',
  'listo',
  'en_camino',
] as const;
export const ESTADOS_PEDIDO_CERRADOS = ['entregado', 'cancelado'] as const;
export const FILTROS_ESTADO_PEDIDO = ['vivos', 'cerrados', 'todos'] as const;
export type FiltroEstadoPedido = (typeof FILTROS_ESTADO_PEDIDO)[number];
export function estadosDelFiltro(f: FiltroEstadoPedido): string[] {
  if (f === 'vivos') return [...ESTADOS_PEDIDO_VIVOS];
  if (f === 'cerrados') return [...ESTADOS_PEDIDO_CERRADOS];
  return [...ESTADOS_PEDIDO_VIVOS, ...ESTADOS_PEDIDO_CERRADOS];
}

/**
 * C-FILTROS-GUARDADOS: las pantallas del superadmin que guardan sus filtros por empleado y las
 * claves que cada una puede guardar. Nunca el texto buscado ni datos personales: solo valores
 * cortos de una lista (ciudad, estado, orden…).
 */
export const PANTALLAS_PREFERENCIAS = [
  'pedidos',
  'viajes',
  'clientes',
  'repartidores',
  'tickets',
  // C-HORARIO-EMPLEADO: el reloj y la zona horaria de cada empleado (Configuración → Horario).
  'horario',
  // C-VIAJES-FIJOS: el monitoreo de viajes fijos (ciudad, estado y solo menores).
  'viajes-fijos',
] as const;
export type PantallaPreferencias = (typeof PANTALLAS_PREFERENCIAS)[number];
export const CLAVES_PREFERENCIAS = [
  'zona',
  'estado',
  'orden',
  'asignado',
  // C-MONITOREO-SERVICIOS: la pestaña de servicio (pedidos en curso y tickets).
  'servicio',
  // C-HORARIO-EMPLEADO: «auto» o «12»/«24», y «auto» o una zona como «America/New_York».
  'formato',
  'zonaHoraria',
  // C-VIAJES-FIJOS: «1» = solo los viajes fijos con un menor.
  'menores',
] as const;
export type ClavePreferencia = (typeof CLAVES_PREFERENCIAS)[number];
export type Preferencias = Partial<Record<ClavePreferencia, string>>;
/** Un valor guardable: corto y sin espacios (un id de ciudad, un estado, una zona horaria con «/»). Un nombre no cabe aquí. */
export const VALOR_PREFERENCIA = /^[A-Za-z0-9_.:/+-]{0,60}$/;

/** Solo las claves conocidas con valores guardables; lo demás se descarta. */
export function limpiarPreferencias(v: unknown): Preferencias {
  if (!v || typeof v !== 'object') return {};
  const dado = new Map(Object.entries(v as Record<string, unknown>));
  const limpio = CLAVES_PREFERENCIAS.flatMap((k) => {
    const x = dado.get(k);
    return typeof x === 'string' && VALOR_PREFERENCIA.test(x) ? [[k, x] as const] : [];
  });
  return Object.fromEntries(limpio) as Preferencias;
}
