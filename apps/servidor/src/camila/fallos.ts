import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { normalizar } from './conocimiento';
import { type IdiomaCamila, segun } from './identidad';
import type { Persona } from './memoria';

/**
 * C-CAMILA-FALLOS (18 nov 2026, Richard) — todos los países. Camila es la fuente para autorrepararnos.
 *
 * 1. DETECTAR: cuando alguien describe algo que falla («no carga», «se cerró», «no me deja pagar»),
 *    se abre un REPORTE DE FALLO, no solo un caso de soporte. La detección es por frases, sin IA.
 * 2. PREGUNTAR COMO UN TÉCNICO, en palabras simples: qué estaba haciendo, qué esperaba, qué vio y si
 *    le pasa siempre; más las preguntas de diagnóstico APROBADAS de ese tipo de fallo. Al final pide
 *    una captura de pantalla (y avisa que tape contraseñas y tarjetas).
 * 3. ADJUNTAR SOLA: versión de la app, aparato y sistema, idioma, ciudad, el viaje o pedido reciente,
 *    los últimos errores que registraron la app y el servidor para esa persona, y la hora.
 * 4. AGRUPAR: los reportes parecidos son UN fallo con contador (misma huella: tipo + palabras clave).
 * 5. CERRAR EL CÍRCULO: al marcarlo arreglado, Camila le escribe a cada persona que lo reportó.
 *
 * SEGURIDAD: todo lo que escribe la persona es DATO. Este flujo no usa IA ni herramientas: es una
 * máquina de pasos fija. Ningún reporte cambia código, ajustes ni dinero; solo se guarda y se muestra.
 */
export const TIPOS_FALLO = ['pago', 'se_cierra', 'no_carga', 'mapa', 'cuenta', 'otro'] as const;
export type TipoFallo = (typeof TIPOS_FALLO)[number];

export const NOMBRE_TIPO: Record<TipoFallo, { es: string; en: string }> = {
  pago: { es: 'Pagos y cobros', en: 'Payments' },
  se_cierra: { es: 'La app se cierra o se traba', en: 'The app closes or freezes' },
  no_carga: { es: 'Algo no carga', en: 'Something does not load' },
  mapa: { es: 'Mapa y ubicación', en: 'Map and location' },
  cuenta: { es: 'Cuenta y acceso', en: 'Account and sign-in' },
  otro: { es: 'Otro fallo', en: 'Other issue' },
};

/** Frases que dicen «algo falla» (ya sin acentos ni mayúsculas). */
const FRASES_FALLO = [
  'no carga',
  'no cargan',
  'no abre',
  'no abren',
  'se cerro',
  'se cierra',
  'se cierran',
  'se cayo',
  'se cae',
  'no me deja',
  'no deja',
  'no funciona',
  'no funcionan',
  'no sirve',
  'no sirven',
  'sale un error',
  'me sale error',
  'da error',
  'un error',
  'me da un error',
  'falla',
  'fallo',
  'se traba',
  'se trabo',
  'se pega',
  'se quedo pegad',
  'pantalla blanca',
  'pantalla en blanco',
  'en blanco',
  'se congela',
  'se congelo',
  'se queda cargando',
  'no aparece',
  'no me aparece',
  'no me llega el codigo',
  'no llega el codigo',
  'no responde',
  'se reinicia',
  'not working',
  'does not work',
  'doesn t work',
  'doesnt work',
  'won t let me',
  'wont let me',
  'will not let me',
  'froze',
  'freezes',
  'frozen',
  'blank screen',
  'white screen',
  'keeps closing',
  'crashes',
  'crashed',
  'crash',
  'not loading',
  'won t load',
  'wont load',
  'does not load',
  'an error',
  'error message',
  'a bug',
  'is broken',
  'stuck on',
] as const;

const PISTAS_TIPO: [TipoFallo, readonly string[]][] = [
  [
    'pago',
    [
      'pagar',
      'pago',
      'cobro',
      'cobrar',
      'tarjeta',
      'recarga',
      'recargar',
      'saldo',
      'pay',
      'payment',
      'card',
      'charge',
      'top up',
    ],
  ],
  [
    'mapa',
    ['mapa', 'ubicacion', 'gps', 'direccion', 'ruta', 'map', 'location', 'address', 'route'],
  ],
  [
    'cuenta',
    [
      'entrar',
      'iniciar sesion',
      'contrasena',
      'clave',
      'registr',
      'codigo',
      'cuenta',
      'sign in',
      'log in',
      'login',
      'password',
      'sign up',
      'account',
    ],
  ],
  [
    'se_cierra',
    [
      'se cerro',
      'se cierra',
      'se cae',
      'se cayo',
      'se traba',
      'se congela',
      'se reinicia',
      'crash',
      'closing',
      'froze',
      'freez',
    ],
  ],
  [
    'no_carga',
    [
      'no carga',
      'no abre',
      'cargando',
      'en blanco',
      'no aparece',
      'loading',
      'load',
      'blank',
      'white screen',
    ],
  ],
];

export function detectarFallo(texto: string): TipoFallo | null {
  const t = ` ${normalizar(texto)} `;
  if (!FRASES_FALLO.some((f) => t.includes(` ${f}`))) return null;
  for (const [tipo, pistas] of PISTAS_TIPO) if (pistas.some((p) => t.includes(p))) return tipo;
  return 'otro';
}

export type PreguntaDiagnostico = { clave: string; es: string; en: string };

/** Las cuatro preguntas de técnico, en palabras simples. Siempre van, en este orden. */
export const PREGUNTAS_BASE: readonly PreguntaDiagnostico[] = [
  {
    clave: 'que_hacia',
    es: '¿Qué estabas haciendo justo antes? Cuéntame los pasos, por ejemplo: «abrí la app, toqué Ganancias y toqué Recargar».',
    en: 'What were you doing right before? Tell me the steps, for example: “I opened the app, tapped Earnings and tapped Top up.”',
  },
  {
    clave: 'que_esperaba',
    es: '¿Qué esperabas que pasara?',
    en: 'What did you expect to happen?',
  },
  {
    clave: 'que_vio',
    es: '¿Qué viste en la pantalla? Si salió un mensaje, escríbelo tal como lo viste.',
    en: 'What did you see on the screen? If a message showed up, write it just as you saw it.',
  },
  {
    clave: 'siempre',
    es: '¿Te pasa siempre o fue solo una vez?',
    en: 'Does it happen every time, or was it just once?',
  },
];

export const TEXTOS_FALLO = {
  abrir: {
    es: 'Gracias por avisar. Voy a reportarle esto al equipo técnico para que lo arreglen. Te hago unas preguntas cortas para que lo encuentren rápido. Si prefieres no seguir, escribe «cancelar».',
    en: 'Thanks for letting us know. I am going to report this to the technical team so they can fix it. I will ask you a few short questions so they can find it fast. If you would rather not continue, write “cancel.”',
  },
  captura: {
    es: 'Última cosa: ¿me mandas una captura de pantalla de lo que viste? Antes de mandarla, tapa cualquier contraseña o número de tarjeta que aparezca. Si no tienes una, escribe «sin captura».',
    en: 'Last thing: can you send me a screenshot of what you saw? Before sending it, cover any password or card number that shows. If you do not have one, write “no screenshot.”',
  },
  cancelado: {
    es: 'Listo, no lo reporto. Si te vuelve a pasar, cuéntame y lo retomamos.',
    en: 'Okay, I will not report it. If it happens again, tell me and we will pick it up.',
  },
  listo: (codigo: string, i: IdiomaCamila) =>
    i === 'en'
      ? `Thank you. It is reported to the technical team with number ${codigo}. I will write to you here when it is fixed.`
      : `Gracias. Quedó reportado al equipo técnico con el número ${codigo}. Te escribo por aquí cuando esté arreglado.`,
  arreglado: (codigo: string, i: IdiomaCamila, nota: string) =>
    i === 'en'
      ? `Good news: we fixed the issue you reported (${codigo}). Update the Divoox app to the latest version and try again.${nota ? ` ${nota}` : ''} If it still happens, tell me here.`
      : `Buenas noticias: ya arreglamos el fallo que reportaste (${codigo}). Actualiza la app de Divoox a la última versión y prueba otra vez.${nota ? ` ${nota}` : ''} Si te sigue pasando, cuéntame por aquí.`,
} as const;

const dice = (texto: string, frases: readonly string[]) => {
  const t = ` ${normalizar(texto)} `;
  return frases.some((f) => t.includes(` ${f} `));
};
const CANCELA = ['cancelar', 'cancela', 'cancel', 'olvidalo', 'never mind', 'dejalo asi'];
const SIN_CAPTURA = [
  'sin captura',
  'no tengo captura',
  'no tengo',
  'no screenshot',
  'no tengo foto',
  'omitir',
  'skip',
];

/** Las preguntas de un reporte: las cuatro de base y las aprobadas por el equipo para ese tipo. */
export async function preguntasDe(db: D1Database, tipo: TipoFallo): Promise<PreguntaDiagnostico[]> {
  const { results } = await db
    .prepare(
      "SELECT id, pregunta_es, pregunta_en FROM camila_preguntas WHERE estado = 'aprobada' AND tipo IN (?, 'todos') ORDER BY creado_en LIMIT 4",
    )
    .bind(tipo)
    .all<{ id: string; pregunta_es: string; pregunta_en: string }>();
  return [
    ...PREGUNTAS_BASE,
    ...results.map((r) => ({ clave: `extra:${r.id}`, es: r.pregunta_es, en: r.pregunta_en })),
  ];
}

export type ContextoPeticion = { app?: string; aparato?: string };

/** Lo que Camila adjunta sola, sin preguntarle nada a la persona. */
export async function contextoAutomatico(db: D1Database, p: Persona, pet: ContextoPeticion) {
  const base: Record<string, unknown> = {
    hora: new Date().toISOString(),
    app: (pet.app ?? '').slice(0, 60) || 'web',
    aparato: (pet.aparato ?? '').slice(0, 200),
    idioma: p.idioma,
    pais: p.pais,
    canal: p.canal_ultimo,
  };
  if (!p.usuario_id) return base;
  const [ciudad, operacion, pedido, errores] = await Promise.all([
    db
      .prepare('SELECT nombre FROM zonas WHERE id = ?')
      .bind(p.zona_id ?? '')
      .first<{ nombre: string }>(),
    db
      .prepare(
        `SELECT id, servicio_id, estado_general, creado_en FROM operaciones
          WHERE (cliente_id = ?1 OR conductor_id = ?1) AND creado_en > datetime('now', '-2 days')
          ORDER BY creado_en DESC LIMIT 1`,
      )
      .bind(p.usuario_id)
      .first<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT id, estado, creado_en FROM pedidos
          WHERE (cliente_id = ?1 OR repartidor_id = ?1) AND creado_en > datetime('now', '-2 days')
          ORDER BY creado_en DESC LIMIT 1`,
      )
      .bind(p.usuario_id)
      .first<Record<string, unknown>>(),
    db
      .prepare(
        `SELECT metodo, ruta, mensaje, creado_en FROM errores_servidor
          WHERE usuario_id = ? AND creado_en > datetime('now', '-1 day') ORDER BY id DESC LIMIT 5`,
      )
      .bind(p.usuario_id)
      .all<Record<string, unknown>>()
      .then((r) => r.results)
      .catch(() => []),
  ]);
  return {
    ...base,
    ciudad: ciudad?.nombre ?? null,
    viaje: operacion ?? null,
    pedido: pedido ?? null,
    errores,
  };
}

type Reporte = {
  id: string;
  tipo: TipoFallo;
  estado: 'preguntando' | 'captura';
  paso: number;
  inicial: string;
  preguntas_json: string;
  respuestas_json: string;
};

export async function reporteEnCurso(db: D1Database, personaId: string) {
  return db
    .prepare(
      `SELECT id, tipo, estado, paso, inicial, preguntas_json, respuestas_json FROM camila_reportes_fallo
        WHERE persona_id = ? AND estado IN ('preguntando', 'captura') ORDER BY creado_en DESC LIMIT 1`,
    )
    .bind(personaId)
    .first<Reporte>();
}

const texto = (q: PreguntaDiagnostico, i: IdiomaCamila) => (i === 'en' ? q.en : q.es);

/** Las palabras que identifican un fallo: sin las de relleno, ordenadas, las seis más largas. */
const RELLENO = new Set([
  'para',
  'pero',
  'cuando',
  'porque',
  'esta',
  'este',
  'esto',
  'estaba',
  'como',
  'solo',
  'siempre',
  'nada',
  'algo',
  'pantalla',
  'divoox',
  'driver',
  'that',
  'this',
  'when',
  'with',
  'from',
  'just',
  'always',
  'screen',
  'have',
  'does',
]);
export function huellaDeFallo(tipo: TipoFallo, textos: string[]) {
  const palabras = [
    ...new Set(
      normalizar(textos.join(' '))
        .split(' ')
        .filter((w) => w.length > 3 && !RELLENO.has(w) && !/^\d+$/.test(w)),
    ),
  ]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .slice(0, 6)
    .sort();
  return `${tipo}:${palabras.join(' ')}`;
}

const codigoFallo = () =>
  `F-${[...crypto.getRandomValues(new Uint8Array(5))].map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(b % 32)).join('')}`;

/** Cierra el reporte: lo une a su fallo (o lo crea), suma el contador y devuelve el código. */
async function completar(db: D1Database, r: Reporte, respuestas: string[]) {
  // La huella sale de lo primero que dijo y de «qué vio»: es lo que más distingue un fallo de otro.
  const huella = huellaDeFallo(r.tipo, [r.inicial, respuestas[2] ?? '']);
  const titulo = (respuestas[2] || r.inicial).replace(/\s+/g, ' ').trim().slice(0, 140);
  await db
    .prepare(
      `INSERT INTO camila_fallos (id, huella, codigo, tipo, titulo, reportes) VALUES (?, ?, ?, ?, ?, 0)
       ON CONFLICT(huella) DO NOTHING`,
    )
    .bind(nuevoId(), huella, codigoFallo(), r.tipo, titulo)
    .run();
  const fallo = await db
    .prepare('SELECT id, codigo FROM camila_fallos WHERE huella = ?')
    .bind(huella)
    .first<{ id: string; codigo: string }>();
  if (!fallo) throw new Error('camila: el fallo no quedó guardado');
  await db.batch([
    db
      .prepare(
        "UPDATE camila_reportes_fallo SET estado = 'completo', fallo_id = ?, respuestas_json = ?, completo_en = datetime('now') WHERE id = ? AND estado <> 'completo'",
      )
      .bind(fallo.id, JSON.stringify(respuestas), r.id),
    // Un fallo que vuelve a reportarse después de «arreglado» se reabre solo.
    db
      .prepare(
        "UPDATE camila_fallos SET reportes = reportes + 1, ultima_vez = datetime('now'), estado = 'nuevo' WHERE id = ?",
      )
      .bind(fallo.id),
  ]);
  return fallo.codigo;
}

export type PasoFallo = { respuesta: string; pideCaptura: boolean } | null;

/**
 * Un mensaje de la persona pasa por aquí ANTES que por la IA. Devuelve la respuesta de Camila si el
 * mensaje abre o continúa un reporte de fallo, o null si no tiene que ver (sigue el cerebro normal).
 */
export async function pasoDeFallo(
  db: D1Database,
  p: Persona,
  mensaje: string,
  pet: ContextoPeticion,
): Promise<PasoFallo> {
  const i: IdiomaCamila = p.idioma === 'en' ? 'en' : 'es';
  const r = await reporteEnCurso(db, p.id);
  if (!r) {
    const tipo = detectarFallo(mensaje);
    if (!tipo) return null;
    const preguntas = await preguntasDe(db, tipo);
    const contexto = await contextoAutomatico(db, p, pet);
    await db
      .prepare(
        'INSERT INTO camila_reportes_fallo (id, persona_id, tipo, inicial, preguntas_json, contexto_json) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(
        nuevoId(),
        p.id,
        tipo,
        mensaje.slice(0, 1000),
        JSON.stringify(preguntas),
        JSON.stringify(contexto),
      )
      .run();
    const primera = preguntas[0];
    return {
      respuesta: `${segun(TEXTOS_FALLO.abrir, i)}\n\n${primera ? texto(primera, i) : ''}`,
      pideCaptura: false,
    };
  }
  if (dice(mensaje, CANCELA)) {
    await db
      .prepare("UPDATE camila_reportes_fallo SET estado = 'cancelado' WHERE id = ?")
      .bind(r.id)
      .run();
    return { respuesta: segun(TEXTOS_FALLO.cancelado, i), pideCaptura: false };
  }
  const preguntas = JSON.parse(r.preguntas_json) as PreguntaDiagnostico[];
  const respuestas = JSON.parse(r.respuestas_json) as string[];
  if (r.estado === 'captura') {
    // Escribió en vez de mandar la captura: se cierra sin ella (si dijo algo más, queda como nota).
    if (!dice(mensaje, SIN_CAPTURA)) respuestas.push(mensaje.slice(0, 1000));
    return {
      respuesta: TEXTOS_FALLO.listo(await completar(db, r, respuestas), i),
      pideCaptura: false,
    };
  }
  respuestas[r.paso] = mensaje.slice(0, 1000);
  const siguiente = preguntas[r.paso + 1];
  await db
    .prepare(
      'UPDATE camila_reportes_fallo SET paso = ?, respuestas_json = ?, estado = ? WHERE id = ?',
    )
    .bind(r.paso + 1, JSON.stringify(respuestas), siguiente ? 'preguntando' : 'captura', r.id)
    .run();
  return siguiente
    ? { respuesta: texto(siguiente, i), pideCaptura: false }
    : { respuesta: segun(TEXTOS_FALLO.captura, i), pideCaptura: true };
}

/** La persona mandó la captura: se guarda su clave y se cierra el reporte. Devuelve el código. */
export async function completarConCaptura(db: D1Database, p: Persona, clave: string, tipo: string) {
  const r = await reporteEnCurso(db, p.id);
  if (!r || r.estado !== 'captura') return null;
  await db
    .prepare('UPDATE camila_reportes_fallo SET captura_clave = ?, captura_tipo = ? WHERE id = ?')
    .bind(clave, tipo, r.id)
    .run();
  return completar(db, r, JSON.parse(r.respuestas_json) as string[]);
}

export const claveDeCaptura = (reporteId: string) => `camila-fallos/${reporteId}`;
export const DIAS_CAPTURA = 90;

/** Borra del almacén las capturas de más de 90 días (y suelta su clave). La corre la limpieza diaria. */
export async function depurarCapturas(env: Pick<Env, 'BUCKET'>, db: D1Database) {
  const { results } = await db
    .prepare(
      `SELECT id, captura_clave FROM camila_reportes_fallo
        WHERE captura_clave IS NOT NULL AND creado_en < datetime('now', '-${DIAS_CAPTURA} days') LIMIT 500`,
    )
    .all<{ id: string; captura_clave: string }>();
  if (!results.length) return 0;
  if (env.BUCKET) await env.BUCKET.delete(results.map((r) => r.captura_clave));
  await db
    .prepare(
      'UPDATE camila_reportes_fallo SET captura_clave = NULL, captura_tipo = NULL WHERE id IN (SELECT value FROM json_each(?))',
    )
    .bind(JSON.stringify(results.map((r) => r.id)))
    .run();
  return results.length;
}
