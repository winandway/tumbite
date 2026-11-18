import { ETIQUETA_GUIA } from '@tumbite/compartido';
import { DOCS_PUBLICOS, type GuiaPublica } from './docsPublicos';
import type { IdiomaCamila } from './identidad';

/**
 * C-CAMILA-CONOCIMIENTO (18 nov 2026, Richard) — todos los países. Camila TIENE que saber lo básico de
 * Divoox: pedir moto, carro, comida y envíos, pagar en mano, cupones, lugares guardados, el saldo del
 * conductor, conectarse. Para eso busca, sin IA, en TODAS las guías públicas de Docs del cliente y
 * del conductor (docsPublicos.ts, generado desde el sitio), en el idioma de la persona.
 *
 * Cómo busca: cada palabra de la pregunta se lleva a su raíz (pido, pedir, pides → «pedir»), se
 * quitan las de relleno y se puntúa cada guía según dónde aparece la palabra (título y preguntas de
 * la guía valen más que el resumen, y el resumen más que el cuerpo) y qué tan rara es (una palabra
 * que está en pocas guías vale más). Si la pregunta se parece mucho a una de las «preguntas» que la
 * guía dice responder, esa guía gana.
 */
const RELLENO = new Set([
  ...['como', 'que', 'cual', 'cuando', 'donde', 'para', 'por', 'con', 'sin', 'una', 'uno', 'unos'],
  ...[
    'unas',
    'los',
    'las',
    'del',
    'mis',
    'tus',
    'sus',
    'esta',
    'este',
    'esto',
    'eso',
    'hay',
    'hola',
  ],
  ...[
    'camila',
    'puedo',
    'puede',
    'quiero',
    'necesito',
    'hago',
    'hacer',
    'favor',
    'gracias',
    'buenas',
  ],
  ...[
    'buenos',
    'dias',
    'tardes',
    'noches',
    'the',
    'and',
    'for',
    'how',
    'what',
    'when',
    'where',
    'can',
  ],
  ...['does', 'with', 'from', 'this', 'that', 'want', 'need', 'please', 'thanks', 'hello', 'you'],
  ...[
    'your',
    'are',
    'divoox',
    'app',
    'aplicacion',
    'tengo',
    'tiene',
    'soy',
    'estoy',
    'ser',
    'have',
  ],
  ...['has', 'get', 'veo', 'ver', 'see', 'uso', 'usar', 'use', 'pongo', 'poner', 'put'],
]);

/** Formas distintas de decir lo mismo → una sola raíz. */
const RAICES: [string, string[]][] = [
  [
    'pedir',
    [
      'pido',
      'pides',
      'pide',
      'pedimos',
      'piden',
      'pedi',
      'pedido',
      'pedidos',
      'solicito',
      'solicitar',
      'ordenar',
      'ordeno',
      'orden',
      'order',
      'ordering',
      'request',
      'book',
      'booking',
      'reservar',
      'reservo',
    ],
  ],
  ['moto', ['motos', 'mototaxi', 'mototaxis', 'motocicleta', 'motorcycle', 'motorbike', 'bike']],
  ['carro', ['carros', 'taxi', 'taxis', 'auto', 'autos', 'coche', 'car', 'cars', 'cab']],
  [
    'viaje',
    [
      'viajes',
      'viajar',
      'viajo',
      'carrera',
      'carreras',
      'ride',
      'rides',
      'trip',
      'trips',
      'traslado',
    ],
  ],
  [
    'comida',
    [
      'restaurante',
      'restaurantes',
      'comer',
      'almuerzo',
      'cena',
      'food',
      'meal',
      'restaurant',
      'restaurants',
    ],
  ],
  [
    'envio',
    [
      'envios',
      'enviar',
      'mando',
      'mandas',
      'paquete',
      'paquetes',
      'encomienda',
      'mandar',
      'package',
      'packages',
      'send',
      'sending',
      'parcel',
    ],
  ],
  [
    'pagar',
    [
      'pago',
      'pagas',
      'pagos',
      'paga',
      'cobro',
      'cobrar',
      'cobran',
      'pay',
      'paying',
      'payment',
      'payments',
      'charge',
    ],
  ],
  ['efectivo', ['mano', 'cash', 'movil', 'transferencia', 'hand']],
  [
    'cupon',
    [
      'cupones',
      'promocion',
      'promo',
      'descuento',
      'descuentos',
      'coupon',
      'coupons',
      'discount',
      'promotion',
    ],
  ],
  ['regalo', ['regalos', 'gift', 'gifts', 'obsequio']],
  [
    'lugar',
    [
      'lugares',
      'direccion',
      'direcciones',
      'casa',
      'trabajo',
      'place',
      'places',
      'address',
      'addresses',
      'home',
      'work',
    ],
  ],
  ['guardar', ['guardado', 'guardados', 'guardada', 'guardadas', 'guardo', 'save', 'saved']],
  ['saldo', ['balance', 'recarga', 'recargar', 'recargo', 'topup']],
  ['comision', ['comisiones', 'descuentan', 'commission', 'fee', 'fees']],
  ['conectar', ['conectarme', 'conecto', 'conectarse', 'conectado', 'online', 'connect']],
  ['cancelar', ['cancelo', 'cancela', 'cancelacion', 'cancel', 'canceling', 'cancellation']],
  ['cuenta', ['perfil', 'account', 'profile']],
  ['borrar', ['eliminar', 'elimino', 'borro', 'delete', 'remove']],
  ['propina', ['propinas', 'tip', 'tips']],
  ['seguir', ['seguimiento', 'rastrear', 'rastreo', 'track', 'tracking']],
  ['calificar', ['calificacion', 'calificaciones', 'estrellas', 'rate', 'rating', 'ratings']],
  ['seguridad', ['seguro', 'segura', 'emergencia', 'panico', 'safety', 'safe', 'emergency']],
  ['programar', ['programado', 'programo', 'programa', 'agendar', 'schedule', 'scheduled']],
  [
    'registrar',
    [
      'registro',
      'registrarme',
      'registrarse',
      'empezar',
      'empiezo',
      'comenzar',
      'unirme',
      'signup',
      'register',
      'start',
      'join',
      'begin',
    ],
  ],
  [
    'conductor',
    [
      'conductores',
      'repartidor',
      'repartidores',
      'chofer',
      'driver',
      'drivers',
      'courier',
      'manejar',
      'conducir',
      'drive',
      'driving',
      'repartir',
    ],
  ],
  [
    'documento',
    [
      'documentos',
      'cedula',
      'licencia',
      'papeles',
      'verificar',
      'verificacion',
      'identidad',
      'document',
      'documents',
      'license',
      'verify',
      'identity',
    ],
  ],
  ['parada', ['paradas', 'stop', 'stops']],
  [
    'chat',
    [
      'chateo',
      'chatear',
      'chatea',
      'mensaje',
      'mensajes',
      'escribo',
      'escribir',
      'escribirle',
      'message',
      'messages',
      'text',
      'texting',
    ],
  ],
  ['compartir', ['comparto', 'share', 'sharing']],
  [
    'precio',
    [
      'precios',
      'tarifa',
      'tarifas',
      'cuesta',
      'costo',
      'cuanto',
      'price',
      'prices',
      'fare',
      'cost',
    ],
  ],
  ['ganancia', ['ganancias', 'gano', 'ganar', 'earnings', 'earn', 'income']],
];
const RAIZ_DE = new Map<string, string>();
for (const [raiz, formas] of RAICES) {
  RAIZ_DE.set(raiz, raiz);
  for (const f of formas) RAIZ_DE.set(f, raiz);
}

const DEL_OFICIO = new Set(RAICES.map(([raiz]) => raiz));

const plano = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ');

/**
 * El tronco de una palabra sin raíz propia: sin plural ni terminación de verbo, para que «agrego»,
 * «agregar» y «agrega» sean lo mismo, igual que «parada» y «paradas». Es burdo a propósito: se aplica
 * igual a la pregunta y a las guías, así que solo importa que coincidan.
 */
const TERMINACIONES = [
  'amos',
  'emos',
  'imos',
  'ando',
  'iendo',
  'ing',
  'ar',
  'er',
  'ir',
  'as',
  'es',
  'os',
  'an',
  'en',
  'ed',
];
function tronco(w: string): string {
  for (const t of TERMINACIONES)
    if (w.endsWith(t) && w.length - t.length >= 4)
      return RAIZ_DE.get(w.slice(0, -t.length)) ?? w.slice(0, -t.length);
  const ultima = w.at(-1) ?? '';
  if ('aeos'.includes(ultima) && w.length >= 5)
    return RAIZ_DE.get(w.slice(0, -1)) ?? w.slice(0, -1);
  return w;
}

/** Las raíces con significado de un texto. */
export function raices(texto: string): string[] {
  const salida: string[] = [];
  for (const w of plano(texto).split(/\s+/)) {
    if (w.length < 3 || RELLENO.has(w)) continue;
    const directa = RAIZ_DE.get(w);
    if (directa) {
      salida.push(directa);
      continue;
    }
    salida.push(tronco(w));
  }
  return salida;
}

type Ficha = {
  guia: GuiaPublica;
  alto: Set<string>;
  medio: Set<string>;
  bajo: Set<string>;
  preguntas: Set<string>[];
};
type Indice = { fichas: Ficha[]; rareza: Map<string, number> };
const INDICES = new Map<IdiomaCamila, Indice>();

function indiceDe(idioma: IdiomaCamila): Indice {
  const ya = INDICES.get(idioma);
  if (ya) return ya;
  const fichas = DOCS_PUBLICOS.filter((g) => g.idioma === idioma).map((guia) => ({
    guia,
    alto: new Set(raices(`${guia.titulo} ${guia.preguntas.join(' ')}`)),
    medio: new Set(raices(guia.resumen)),
    bajo: new Set(raices(`${guia.pasos.join(' ')} ${guia.cuerpo}`)),
    preguntas: guia.preguntas.map((p) => new Set(raices(p))),
  }));
  const cuenta = new Map<string, number>();
  for (const f of fichas)
    for (const r of new Set([...f.alto, ...f.medio, ...f.bajo]))
      cuenta.set(r, (cuenta.get(r) ?? 0) + 1);
  const rareza = new Map<string, number>();
  for (const [r, n] of cuenta) rareza.set(r, Math.log(1 + fichas.length / n));
  const indice = { fichas, rareza };
  INDICES.set(idioma, indice);
  return indice;
}

export type GuiaEncontrada = { guia: GuiaPublica; puntos: number };

/** Las guías públicas que mejor responden la pregunta, de mayor a menor. Vacío = ninguna clara. */
export function buscarGuias(
  texto: string,
  idioma: IdiomaCamila,
  max = 2,
  /** La sección que le toca a quien pregunta: un conductor («drivers») o un cliente («ordering»). */
  prefiere: 'drivers' | 'ordering' = 'ordering',
): GuiaEncontrada[] {
  const consulta = [...new Set(raices(texto))];
  if (!consulta.length) return [];
  const { fichas, rareza } = indiceDe(idioma);
  // Con una sola palabra solo se contesta si es de las del oficio (moto, cupón, saldo…): «oficina»
  // sola no alcanza para elegir una guía.
  if (consulta.length === 1 && !DEL_OFICIO.has(consulta[0] ?? '')) return [];
  const encontradas: GuiaEncontrada[] = [];
  // Cuántas palabras de la pregunta tienen que estar en el título, las preguntas o el resumen de la
  // guía: todas si son una o dos, y seis de cada diez si son más.
  const minimo = consulta.length <= 2 ? consulta.length : Math.ceil(consulta.length * 0.6);
  for (const f of fichas) {
    let puntos = 0;
    let fuertes = 0;
    for (const r of consulta) {
      const peso = f.alto.has(r) ? 4 : f.medio.has(r) ? 2 : f.bajo.has(r) ? 1 : 0;
      if (!peso) continue;
      puntos += peso * (rareza.get(r) ?? 1);
      if (peso >= 2) fuertes++;
    }
    // La pregunta se parece mucho a una de las que la guía dice responder.
    for (const p of f.preguntas) {
      if (!p.size) continue;
      const comunes = consulta.filter((r) => p.has(r)).length;
      const parecido = comunes / (p.size + consulta.length - comunes);
      if (parecido >= 0.5) puntos += 12 * parecido;
    }
    // Hace falta que al menos una palabra con significado esté en el título, las preguntas o el
    // resumen: una coincidencia perdida en el cuerpo no basta para contestar.
    // «¿Dónde queda la oficina?» no se contesta con una guía que solo menciona «oficina».
    if (fuertes >= minimo && puntos > 0)
      encontradas.push({
        guia: f.guia,
        puntos: f.guia.ruta.startsWith(`${prefiere}/`) ? puntos * 1.25 : puntos,
      });
  }
  encontradas.sort((a, b) => b.puntos - a.puntos);
  // Con muy poco en común no se contesta: mejor preguntar.
  if ((encontradas[0]?.puntos ?? 0) < 5) return [];
  return encontradas.slice(0, max);
}

/** La guía por su ruta (sección/guía), en el idioma. */
export const guiaPorRuta = (ruta: string, idioma: IdiomaCamila) =>
  DOCS_PUBLICOS.find((g) => g.idioma === idioma && g.ruta === ruta) ?? null;

/**
 * C-CAMILA-ENLACE-GUIA: la línea con el enlace de una guía, en el idioma de la persona. Es la ÚNICA
 * forma en que Camila escribe un enlace de Docs (el chat la pinta tocable y el correo como botón).
 */
export const enlaceDeGuia = (ruta: string, idioma: IdiomaCamila) =>
  `${ETIQUETA_GUIA[idioma === 'en' ? 'en' : 'es']} https://divoox.com${idioma === 'es' ? '/es' : ''}/docs/${ruta}`;

const URL_DOCS = /divoox\.com(?:\/es)?\/docs\/([a-z0-9/-]+)/gi;
/**
 * Deja los enlaces de Docs de una respuesta como manda la regla: fuera las direcciones sueltas (las
 * que escribió el modelo o las de una guía), y al final, una línea por guía (dos como mucho) con el
 * enlace en el idioma de la persona. Un enlace a una guía que no existe en Docs se quita y no vuelve:
 * Camila nunca inventa un enlace. `usadas` son las guías de las que salió la respuesta cuando el
 * texto no trae ninguna.
 */
export function conEnlacesDeGuia(texto: string, idioma: IdiomaCamila, usadas: string[] = []) {
  const rutas: string[] = [];
  const anotar = (ruta: string) => {
    const r = ruta.toLowerCase().replace(/\/$/, '');
    if (guiaPorRuta(r, idioma) && !rutas.includes(r)) rutas.push(r);
  };
  for (const m of texto.matchAll(URL_DOCS)) if (m[1]) anotar(m[1]);
  if (!rutas.length) for (const r of usadas.slice(0, 1)) anotar(r);
  const conEnlace = /divoox\.com(\/es)?\/docs\//i;
  const cuerpo = texto
    .split('\n')
    .map((linea) =>
      conEnlace.test(linea)
        ? // Fuera la frase que traía la dirección («Guía completa: …», «Mira … y también …»).
          linea
            .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡[]|https?:|divoox\.com)/)
            .filter((frase) => !conEnlace.test(frase))
            .join(' ')
            .trim()
        : linea,
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!rutas.length) return cuerpo;
  return `${cuerpo}\n\n${rutas
    .slice(0, 2)
    .map((r) => enlaceDeGuia(r, idioma))
    .join('\n')}`;
}

/** La respuesta corta de una guía: de qué se trata y los primeros pasos, con su enlace al final. */
export function respuestaDeGuia(g: GuiaPublica, idioma: IdiomaCamila, pasos = 4) {
  const lista = g.pasos.slice(0, pasos).map((p, i) => `${i + 1}. ${p}`);
  return [
    g.resumen,
    ...(lista.length ? ['', ...lista] : []),
    '',
    enlaceDeGuia(g.ruta, idioma),
  ].join('\n');
}
