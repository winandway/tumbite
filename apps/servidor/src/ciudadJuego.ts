import { VERSION_TERMINOS, distanciaKm } from '@tumbite/compartido';
import type { ExecutionContext } from 'hono';
import { FOTO_JUEGO_BASE64 } from './ciudadJuegoFoto';
import { entornoDe } from './entorno';
import type { Env } from './env';
import { anotarLibro, saldoLibro } from './internacional/libro';
import { anotarEvento, cancelarConReembolso } from './manager';
import { paisDeZona } from './internacional/paises';
import { contarFilas, type CuentaFilas } from './presupuestoFilas';
import { zonaPara } from './rutas/zonas';
import { ErrorDatos } from './validar';
import { TOPE_DIA_PRUEBAS } from './vueltaPruebas';

/**
 * C-CIUDAD-JUEGO (SIM-7, 13 nov 2026, pedido de Richard): la ciudad de pruebas en MODO JUEGO. Una
 * persona (su hijo, el equipo) pide comida desde la app REAL del cliente en el sitio de pruebas y
 * los restaurantes y repartidores son ROBOTS que aceptan, preparan, recogen y entregan. Todos los
 * países (la ciudad se arma en la zona de Novi, Michigan, si existe; si no, en Miami).
 *
 * - Sin procesos de fondo: YaDominios Cloud no tiene reloj ni Durable Objects. La pantalla «Ciudad
 *   de pruebas» del superadmin, abierta y con la ciudad encendida, manda un LATIDO cada pocos
 *   segundos; cada latido avanza un paso a cada pedido de los robots y mueve un tramo a cada
 *   repartidor con pedido. Pantalla cerrada = ciudad quieta.
 * - Los robots usan la API REAL por dentro: cada acción es una petición en proceso a la misma app
 *   de Hono con la sesión del robot (aceptar, listo, ofertas, ubicación, código, foto, cobro,
 *   entrega). Lo único que va directo a la base es lo que una persona no hace con la app y ya hace
 *   así el simulador: confirmar el correo de la cuenta robot, aprobar el restaurante, la foto de
 *   control de la semana y el saldo prepago «de juego» del repartidor (para la comisión de los
 *   pedidos en efectivo). Nunca Stripe, nunca dinero real.
 * - Pago sin tarjeta: en EE. UU. no hay forma de pago sin tarjeta encendida, así que SOLO los
 *   restaurantes robot del juego aceptan «efectivo al recibir», SOLO en pruebas y en local.
 * - Presupuesto de filas («la nube no se come el dinero»): tope por latido, tope por sesión (cuenta
 *   como una vuelta de pruebas y suma al tope diario), y la ciudad se apaga sola a los 60 minutos.
 *   Un repartidor libre solo manda su ubicación cada 5 minutos (las ofertas piden una de los
 *   últimos 10); el restaurante, su señal cada 2 minutos. Mirar la pantalla no escribe nada.
 */
export const JUEGO = {
  /** Filas escritas que puede gastar una sesión de juego entera (población incluida). */
  topeFilasSesion: 3_000,
  /** Un latido deja de mover pedidos al pasar de aquí (el resto sigue en el siguiente). */
  topeFilasLatido: 120,
  /** La ciudad se apaga sola pasado este tiempo. */
  minutosMax: 60,
  /** Sin latido por más de esto, la pantalla dice que la ciudad está quieta. */
  segundosQuieta: 120,
  restaurantes: 3,
  repartidores: 4,
  /** Tramo máximo por latido; nunca más rápido que 40 m/s (el servidor descarta los saltos de más de 50). */
  pasoMaxM: 180,
  velocidadMs: 40,
  /** Distancia a la que el robot ya «está» en el restaurante o en la puerta. */
  llegadaM: 25,
  ubicacionLibreS: 300,
  senalRestauranteS: 120,
  esperaAceptarS: 3,
  esperaListoS: 15,
  esperaRecogerS: 20,
  saldoMinimo: 2_000,
  saldoRecarga: 10_000,
  /**
   * C-CIUDAD-CIERRE: al apagar con pedidos listos o en camino, los robots tienen como mucho estos
   * latidos (unos 2 minutos con la pantalla abierta) para terminar de entregarlos; lo que quede se
   * cancela con su devolución. Ningún pedido de juego queda colgado.
   */
  pasosCierre: 30,
};

export type Punto = { lat: number; lng: number };
/** Novi, Michigan: donde vive Richard y están las cuentas demo del sitio de pruebas. */
export const NOVI: Punto = { lat: 42.4806, lng: -83.4755 };
/** Si el sitio no tiene la zona de Michigan (la base local nueva), la ciudad va a Miami. */
export const MIAMI: Punto = { lat: 25.7751, lng: -80.1902 };

export function soloPruebas(url: string) {
  const e = entornoDe(url);
  if (e !== 'pruebas' && e !== 'local') throw new ErrorDatos('No encontrado.', undefined, 404);
}

// ------------------------------------------------------------------ geometría

export const metros = (a: Punto, b: Punto) => distanciaKm(a, b) * 1000;

/** Un punto a tantos metros al norte y al este. */
export function desplazar(p: Punto, norteM: number, esteM: number): Punto {
  const lat = p.lat + norteM / 111_320;
  const lng = p.lng + esteM / (111_320 * Math.cos((p.lat * Math.PI) / 180));
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

/** Avanza desde `desde` hacia `hacia` como mucho `maxM` metros (si alcanza, llega exacto). */
export function avanzar(desde: Punto, hacia: Punto, maxM: number): Punto {
  const d = metros(desde, hacia);
  if (d <= maxM || d === 0) return { ...hacia };
  const f = maxM / d;
  return {
    lat: Number((desde.lat + (hacia.lat - desde.lat) * f).toFixed(6)),
    lng: Number((desde.lng + (hacia.lng - desde.lng) * f).toFixed(6)),
  };
}

/** Cuánto puede avanzar un robot: nunca más rápido que la velocidad tope desde su última lectura. */
export function tramoPermitido(segundosDesdeLectura: number | null): number {
  if (segundosDesdeLectura == null) return JUEGO.pasoMaxM;
  return Math.min(JUEGO.pasoMaxM, Math.max(0, segundosDesdeLectura) * JUEGO.velocidadMs);
}

// ------------------------------------------------------------------ robots

type Rol = 'restaurante' | 'repartidor';
export type Robot = { rol: Rol; id: string; nombre: string; token: string; rid?: string };
type RobotGuardado = Omit<Robot, 'token'> & { t: string };

const RESTAURANTES = [
  {
    nombre: 'Pizzería del Robot',
    categoria: 'Pizza',
    platos: [
      ['Pizza de queso', 'Cheese pizza', 1100],
      ['Pizza pepperoni', 'Pepperoni pizza', 1300],
      ['Limonada', 'Lemonade', 350],
    ],
  },
  {
    nombre: 'Tacos del Robot',
    categoria: 'Mexicana',
    platos: [
      ['Tacos de pollo', 'Chicken tacos', 900],
      ['Quesadilla', 'Quesadilla', 800],
      ['Agua de horchata', 'Horchata', 300],
    ],
  },
  {
    nombre: 'Hamburguesas del Robot',
    categoria: 'Hamburguesas',
    platos: [
      ['Hamburguesa clásica', 'Classic burger', 1000],
      ['Papas fritas', 'French fries', 400],
      ['Batido de vainilla', 'Vanilla shake', 500],
    ],
  },
] as const;

/** Dónde queda cada restaurante y dónde arranca cada repartidor (alrededor del centro). */
export const puntoRestaurante = (centro: Punto, i: number) =>
  desplazar(centro, 700 * Math.cos(i * 2.1 + 0.6), 900 * Math.sin(i * 2.1 + 0.6));

export const correoRobot = (rol: Rol, n: number) => `juego.${rol}${n}@simulador.test`;
const PATRON_RESTAURANTE_JUEGO = 'juego.restaurante%@simulador.test';

async function hmac(secreto: string, texto: string): Promise<string> {
  const k = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secreto),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto)));
  return [...s].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** La clave de cada cuenta robot sale del secreto del sitio: no se guarda en ningún lado. */
export async function claveRobot(secreto: string, correo: string) {
  return `Juego-${(await hmac(secreto, correo)).slice(0, 20)}-Z9`;
}

async function llaveCifrado(secreto: string) {
  const crudo = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`ciudad-juego:${secreto}`),
  );
  return crypto.subtle.importKey('raw', crudo, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
const aBase64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const deBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Las sesiones de los robots se guardan cifradas con el secreto del sitio (nunca en claro). */
export async function cifrar(secreto: string, texto: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await llaveCifrado(secreto),
    new TextEncoder().encode(texto),
  );
  return `${aBase64(iv)}.${aBase64(new Uint8Array(c))}`;
}
export async function descifrar(secreto: string, guardado: string): Promise<string> {
  const [iv, c] = guardado.split('.');
  const t = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: deBase64(iv ?? '') },
    await llaveCifrado(secreto),
    deBase64(c ?? ''),
  );
  return new TextDecoder().decode(t);
}

// ------------------------------------------------------------------ peticiones en proceso

type AppInterna = {
  request: (
    input: string,
    init: RequestInit,
    env: Env,
    ec?: ExecutionContext,
  ) => Response | Promise<Response>;
};
let appInterna: AppInterna | null = null;
/** app.ts entrega aquí la misma app de Hono: los robots le hablan por dentro, como las apps. */
export function fijarAppCiudad(a: AppInterna) {
  appInterna = a;
}

export type Fallo = { cuando: string; pedido?: string; comportamiento: string; mensaje: string };
type Respuesta = { ok: boolean; estado: number; datos: Record<string, unknown> };

/** El contexto de un encendido o de un latido: la base contada y lo que va saliendo mal. */
export type Ctx = {
  env: Env;
  db: D1Database;
  cuenta: CuentaFilas;
  origen: string;
  ec?: ExecutionContext;
  fallos: Fallo[];
};

export function crearCtx(env: Env, url: string, ec?: ExecutionContext): Ctx {
  if (!env.DB) throw new ErrorDatos('La base no está disponible.', undefined, 503);
  const contada = contarFilas(env.DB);
  return {
    env: { ...env, DB: contada.db },
    db: contada.db,
    cuenta: contada.cuenta,
    origen: new URL(url).origin,
    ec,
    fallos: [],
  };
}

async function llamar(
  ctx: Ctx,
  quien: Robot | null,
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
  foto?: Uint8Array,
): Promise<Respuesta> {
  if (!appInterna) throw new Error('ciudad: la app no está conectada (fijarAppCiudad)');
  const headers: Record<string, string> = {
    'content-type': foto ? 'image/jpeg' : 'application/json',
    'x-idioma': 'es',
    // Cada robot es su propio «celular»: el límite de intentos por dirección no los mezcla.
    'cf-connecting-ip': `ciudad-${(quien?.id ?? 'sistema').slice(0, 16)}`,
  };
  if (quien?.token) headers.authorization = `Bearer ${quien.token}`;
  const body = foto
    ? (foto as BodyInit)
    : cuerpo === undefined
      ? undefined
      : JSON.stringify(cuerpo);
  const res = await appInterna.request(
    `${ctx.origen}${ruta}`,
    { method: metodo, headers, body },
    ctx.env,
    ctx.ec,
  );
  const datos = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, estado: res.status, datos };
}

/** Una acción de un robot: si el servidor dice que no, queda como fallo de la sesión. */
async function accion(
  ctx: Ctx,
  quien: Robot,
  que: string,
  pedido: string | undefined,
  metodo: string,
  ruta: string,
  cuerpo?: unknown,
  foto?: Uint8Array,
): Promise<Respuesta> {
  let r: Respuesta;
  try {
    r = await llamar(ctx, quien, metodo, ruta, cuerpo, foto);
  } catch (e) {
    r = { ok: false, estado: 0, datos: { error: e instanceof Error ? e.message : String(e) } };
  }
  if (!r.ok)
    ctx.fallos.push({
      cuando: new Date().toISOString(),
      ...(pedido ? { pedido } : {}),
      comportamiento:
        `${quien.rol === 'restaurante' ? 'restaurante robot' : 'repartidor robot'} · ${que}`.slice(
          0,
          60,
        ),
      mensaje:
        `${quien.nombre}: el servidor respondió ${r.estado} ${String(r.datos.error ?? '')}`.slice(
          0,
          500,
        ),
    });
  return r;
}

// ------------------------------------------------------------------ población

function exigirOk(r: Respuesta, que: string) {
  if (!r.ok)
    throw new ErrorDatos(
      `No se pudo encender la ciudad (${que}): ${String(r.datos.error ?? r.estado)}`,
      undefined,
      409,
    );
  return r;
}

async function cuentaRobot(
  ctx: Ctx,
  secreto: string,
  rol: Rol,
  n: number,
  nombre: string,
): Promise<{ id: string; token: string }> {
  const correo = correoRobot(rol, n);
  const clave = await claveRobot(secreto, correo);
  const sistema: Robot = { rol, id: `${rol}${n}`, nombre, token: '' };
  const entrar = await llamar(ctx, sistema, 'POST', '/datos/cuentas/entrar', { correo, clave });
  let datos = entrar.datos as { token?: string; usuario?: { id: string } };
  if (!entrar.ok) {
    const reg = exigirOk(
      await llamar(ctx, sistema, 'POST', '/datos/cuentas/registro', {
        nombre,
        correo,
        clave,
        rol,
        telefono: `2485550${rol === 'restaurante' ? 1 : 2}${String(n).padStart(2, '0')}`,
      }),
      `crear la cuenta de ${nombre}`,
    );
    datos = reg.datos as { token?: string; usuario?: { id: string } };
    // Lo que una persona hace tocando el enlace del correo (el simulador lo hace igual).
    await ctx.db
      .prepare("UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = ?")
      .bind(datos.usuario?.id ?? '')
      .run();
  }
  if (!datos.token || !datos.usuario?.id)
    throw new ErrorDatos(`No se pudo entrar con la cuenta de ${nombre}.`, undefined, 409);
  return { id: datos.usuario.id, token: datos.token };
}

async function armarRestaurante(ctx: Ctx, secreto: string, i: number, centro: Punto) {
  const def = RESTAURANTES[i % RESTAURANTES.length]!;
  const cuenta = await cuentaRobot(ctx, secreto, 'restaurante', i + 1, def.nombre);
  const r: Robot = { rol: 'restaurante', nombre: def.nombre, ...cuenta };
  const punto = puntoRestaurante(centro, i);
  const ficha = exigirOk(
    await llamar(ctx, r, 'PUT', '/datos/mi-restaurante', {
      nombre: def.nombre,
      direccion: `${100 + i * 10} Robot Ave (juego)`,
      ...punto,
      categoria: def.categoria,
      telefono: `+1248555010${i + 1}`,
    }),
    `la ficha de ${def.nombre}`,
  );
  const rid = String((ficha.datos.restaurante as { id?: string } | undefined)?.id ?? '');
  r.rid = rid;
  // La aprobación la hace nuestro equipo; en pruebas el simulador la marca igual.
  await ctx.db
    .prepare("UPDATE restaurantes SET estado = 'aprobado' WHERE id = ? AND estado <> 'aprobado'")
    .bind(rid)
    .run();
  const { results: ya } = await ctx.db
    .prepare('SELECT nombre_es FROM platos WHERE restaurante_id = ?')
    .bind(rid)
    .all<{ nombre_es: string }>();
  const tiene = new Set(ya.map((p) => p.nombre_es));
  for (const [nombreEs, nombreEn, precioCentavos] of def.platos)
    if (!tiene.has(nombreEs))
      exigirOk(
        await llamar(ctx, r, 'POST', '/datos/mi-restaurante/platos', {
          nombreEs,
          nombreEn,
          precioCentavos,
          categoria: def.categoria,
          categoriaEn: def.categoria,
          disponible: true,
        }),
        `el plato ${nombreEs}`,
      );
  const horario = await ctx.db
    .prepare('SELECT 1 FROM horarios_restaurante WHERE restaurante_id = ? LIMIT 1')
    .bind(rid)
    .first();
  if (!horario)
    exigirOk(
      await llamar(ctx, r, 'PUT', '/datos/mi-restaurante/horarios', {
        turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
      }),
      `el horario de ${def.nombre}`,
    );
  exigirOk(
    await llamar(ctx, r, 'PATCH', '/datos/mi-restaurante/abierto', { abierto: true }),
    `abrir ${def.nombre}`,
  );
  // La señal: «el panel está escuchando» (sin ella no le llegan pedidos).
  await llamar(ctx, r, 'GET', '/datos/restaurante/pedidos');
  return r;
}

async function armarRepartidor(ctx: Ctx, secreto: string, k: number, centro: Punto) {
  const nombre = `Moto Robot ${k + 1}`;
  const cuenta = await cuentaRobot(ctx, secreto, 'repartidor', k + 1, nombre);
  const r: Robot = { rol: 'repartidor', nombre, ...cuenta };
  // La foto de control de la semana: sin cámara no tiene sentido (el simulador hace lo mismo).
  await ctx.db
    .prepare(
      "INSERT OR REPLACE INTO selfies_control (id, usuario_id, tomada_en, resultado) VALUES (?, ?, datetime('now'), 'ok')",
    )
    .bind(`juego-${r.id}`, r.id)
    .run();
  exigirOk(
    await llamar(ctx, r, 'POST', '/datos/repartidor/terminos', { version: VERSION_TERMINOS }),
    `los términos de ${nombre}`,
  );
  const punto = desplazar(puntoRestaurante(centro, k % JUEGO.restaurantes), 120, 80 * k);
  exigirOk(
    await llamar(ctx, r, 'POST', '/datos/repartidor/conectar', { conectado: true, ...punto }),
    `conectar a ${nombre}`,
  );
  await llamar(ctx, r, 'POST', '/datos/repartidor/ubicacion', { ...punto, precision: 10 });
  await saldoDeJuego(ctx, r.id);
  return r;
}

/**
 * El saldo prepago «de juego»: los pedidos en efectivo apartan la comisión de Divoox del saldo del
 * repartidor (C-COBRO-DIRECTO). Un robot no puede recargar con tarjeta ni en un punto de venta, así
 * que en pruebas se le deja saldo de juego cuando baja del mínimo. Solo cuentas robot del juego.
 */
async function saldoDeJuego(ctx: Ctx, usuarioId: string) {
  const z = await ctx.db
    .prepare('SELECT zona_id FROM repartidores WHERE usuario_id = ?')
    .bind(usuarioId)
    .first<{ zona_id: string | null }>();
  const { pais, moneda } = await paisDeZona(ctx.db, z?.zona_id ?? 'US-FL-MIAMI');
  const saldo = await saldoLibro(ctx.db, usuarioId, 'prepago', pais, moneda);
  if (saldo >= JUEGO.saldoMinimo) return;
  await anotarLibro(ctx.db, {
    cuentaId: usuarioId,
    bolsillo: 'prepago',
    pais,
    moneda,
    monto: JUEGO.saldoRecarga - saldo,
    concepto: 'saldo_juego_ciudad',
    referencia: `juego-saldo:${usuarioId}:${Date.now()}`,
  });
}

// ------------------------------------------------------------------ sesión

type FilaSesion = {
  id: string;
  estado: string;
  inicio: string;
  destino: string;
  restaurantes: string;
  repartidores: string;
  meta: string;
  fallos: string;
  actualizada_en: string;
};
export type MetaJuego = {
  modo: 'juego';
  centro: Punto;
  robots: RobotGuardado[];
  motivoFin?: string;
  /** C-CIUDAD-CIERRE: se pidió apagar y los robots terminan lo que ya salió de la cocina. */
  cierre?: { motivo: string; pasos: number };
};

const leerMeta = (s: FilaSesion) => JSON.parse(s.meta) as MetaJuego;

export async function sesionDeJuego(db: D1Database, id?: string) {
  return (
    id
      ? db.prepare("SELECT * FROM simulador_sesiones WHERE id = ? AND destino = 'juego'").bind(id)
      : db.prepare(
          "SELECT * FROM simulador_sesiones WHERE destino = 'juego' AND estado = 'corriendo' ORDER BY inicio DESC LIMIT 1",
        )
  ).first<FilaSesion>();
}

function secretoDe(env: Env) {
  const s = env.RELOJ_SECRETO;
  if (!s)
    throw new ErrorDatos(
      'Este sitio no tiene el secreto del reloj (RELOJ_SECRETO): sin él no se pueden armar las cuentas robot.',
      undefined,
      409,
    );
  return s;
}

/** Las filas que lleva la sesión (cuenta como una vuelta de pruebas) y las de todo el día. */
export async function filasDeSesion(db: D1Database, id: string) {
  const v = await db
    .prepare('SELECT escritas FROM vueltas_pruebas WHERE id = ?')
    .bind(id)
    .first<{ escritas: number }>();
  const d = await db
    .prepare('SELECT COALESCE(SUM(escritas), 0) AS n FROM vueltas_pruebas WHERE dia = ?')
    .bind(new Date().toISOString().slice(0, 10))
    .first<{ n: number }>();
  return { sesion: Number(v?.escritas ?? 0), dia: Number(d?.n ?? 0) };
}

/** Lo que escribió este encendido o latido, sumado a la vuelta de la sesión (1 fila). */
async function anotarFilas(real: D1Database, id: string, cuenta: CuentaFilas) {
  if (!cuenta.escritas) return;
  await real
    .prepare(
      `INSERT INTO vueltas_pruebas (id, dia, leidas, escritas, peticiones, creada_en)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT(id) DO UPDATE SET leidas = leidas + excluded.leidas,
         escritas = escritas + excluded.escritas, peticiones = peticiones + 1`,
    )
    .bind(
      id,
      new Date().toISOString().slice(0, 10),
      cuenta.leidas,
      cuenta.escritas + 1,
      new Date().toISOString(),
    )
    .run();
}

export const ROBOTS_TOTAL = JUEGO.restaurantes + JUEGO.repartidores;

/**
 * «Encender la ciudad», UN robot por llamada: la primera abre la sesión y arma el primer
 * restaurante; la pantalla vuelve a llamar hasta que estén todos («Armando la ciudad… 3 de 7»).
 * Así ninguna petición pasa del límite de consultas de un Worker. Si ya está entera, la reutiliza.
 */
export async function encender(env: Env, url: string, ec?: ExecutionContext) {
  soloPruebas(url);
  const secreto = secretoDe(env);
  const real = env.DB!;
  const ctx = crearCtx(env, url, ec);
  let s = await sesionDeJuego(real);
  if (!s) {
    const dia = await filasDeSesion(real, '-');
    if (dia.dia > TOPE_DIA_PRUEBAS.escritas)
      throw new ErrorDatos(
        `Hoy las pruebas ya escribieron ${dia.dia} filas (tope diario ${TOPE_DIA_PRUEBAS.escritas}). La ciudad se puede encender mañana.`,
        undefined,
        409,
      );
    const centro = (await zonaPara(real, NOVI.lat, NOVI.lng)) ? NOVI : MIAMI;
    const id = `juego-${Date.now().toString(36)}`;
    const meta: MetaJuego = { modo: 'juego', centro, robots: [] };
    await ctx.db
      .prepare(
        `INSERT INTO simulador_sesiones (id, estado, destino, restaurantes, repartidores, clientes, meta)
         VALUES (?, 'corriendo', 'juego', '[]', '[]', '[]', ?)`,
      )
      .bind(id, JSON.stringify(meta))
      .run();
    s = (await sesionDeJuego(real, id))!;
  }
  const meta = leerMeta(s);
  const hechos = meta.robots.length;
  if (hechos >= ROBOTS_TOTAL)
    return { sesion: s.id, listos: ROBOTS_TOTAL, total: ROBOTS_TOTAL, reutilizada: true };
  let robot: Robot;
  try {
    robot =
      hechos < JUEGO.restaurantes
        ? await armarRestaurante(ctx, secreto, hechos, meta.centro)
        : await armarRepartidor(ctx, secreto, hechos - JUEGO.restaurantes, meta.centro);
  } catch (e) {
    await anotarFilas(real, s.id, ctx.cuenta);
    throw e;
  }
  const { token, ...visible } = robot;
  meta.robots.push({ ...visible, t: await cifrar(secreto, token) });
  await ctx.db
    .prepare(
      "UPDATE simulador_sesiones SET meta = ?, restaurantes = ?, repartidores = ?, actualizada_en = datetime('now') WHERE id = ?",
    )
    .bind(
      JSON.stringify(meta),
      JSON.stringify(meta.robots.filter((r) => r.rid).map((r) => r.rid)),
      JSON.stringify(meta.robots.filter((r) => r.rol === 'repartidor').map((r) => r.id)),
      s.id,
    )
    .run();
  await anotarFilas(real, s.id, ctx.cuenta);
  return { sesion: s.id, listos: hechos + 1, total: ROBOTS_TOTAL, reutilizada: false };
}

async function robotsDe(env: Env, s: FilaSesion): Promise<Robot[]> {
  const secreto = secretoDe(env);
  return Promise.all(
    leerMeta(s).robots.map(async ({ t, ...r }) => ({ ...r, token: await descifrar(secreto, t) })),
  );
}

/** Rechaza lo que no salió de la cocina y cierra los restaurantes robot. */
async function cerrarRestaurantes(ctx: Ctx, robots: Robot[]) {
  for (const r of robots.filter((x) => x.rol === 'restaurante' && x.rid)) {
    const { results } = await ctx.db
      .prepare(
        "SELECT id FROM pedidos WHERE restaurante_id = ? AND estado IN ('pagado','aceptado') AND repartidor_id IS NULL LIMIT 20",
      )
      .bind(r.rid)
      .all<{ id: string }>();
    // Lo que todavía no salió de la cocina no se queda colgado: el restaurante lo rechaza.
    for (const p of results)
      await accion(
        ctx,
        r,
        'rechazar al apagar',
        p.id,
        'POST',
        `/datos/restaurante/pedidos/${p.id}/rechazar`,
        {},
      );
    await llamar(ctx, r, 'PATCH', '/datos/mi-restaurante/abierto', { abierto: false }).catch(
      () => null,
    );
  }
}

/** Los pedidos de juego que siguen vivos (de los restaurantes robot). */
async function pedidosVivosDeJuego(ctx: Ctx, robots: Robot[]) {
  const rids = robots.filter((r) => r.rid).map((r) => r.rid!);
  if (!rids.length) return [];
  const { results } = await ctx.db
    .prepare(
      `SELECT id, estado FROM pedidos WHERE restaurante_id IN (${marcas(rids.length)})
        AND estado IN ('pagado','aceptado','listo','en_camino') LIMIT 40`,
    )
    .bind(...rids)
    .all<{ id: string; estado: string }>();
  return results;
}

/**
 * C-CIUDAD-CIERRE: lo que quedó sin entregar al final del cierre se cancela por el camino de
 * siempre (devuelve la tarjeta si la hubo y cierra lo apartado del saldo del repartidor).
 */
async function cancelarColgados(ctx: Ctx, robots: Robot[]) {
  for (const p of await pedidosVivosDeJuego(ctx, robots)) {
    try {
      const ok = await cancelarConReembolso(ctx.env, ctx.db, p.id, {
        desde: ['pagado', 'aceptado', 'listo', 'en_camino'],
        actorId: null,
      });
      if (ok) await anotarEvento(ctx.db, p.id, 'cancelado_cierre_juego', 'la ciudad se apagó');
    } catch (e) {
      ctx.fallos.push({
        cuando: new Date().toISOString(),
        pedido: p.id,
        comportamiento: 'cierre · cancelar al apagar',
        mensaje: (e instanceof Error ? e.message : String(e)).slice(0, 500),
      });
    }
  }
}

async function desconectarRepartidores(ctx: Ctx, robots: Robot[]) {
  for (const r of robots.filter((x) => x.rol === 'repartidor'))
    await llamar(ctx, r, 'POST', '/datos/repartidor/conectar', { conectado: false }).catch(
      () => null,
    );
}

/**
 * «Apagar la ciudad» (a mano, por tiempo o por filas). Con pedidos listos o en camino, la ciudad
 * entra en cierre: los latidos siguen solo para terminarlos (como mucho `JUEGO.pasosCierre`). Con
 * `inmediato` (tope de filas, o el cierre ya agotado) lo que quede se cancela con su devolución.
 */
export async function apagar(
  env: Env,
  url: string,
  sesionId: string,
  motivo: string,
  ec?: ExecutionContext,
  opciones: { inmediato?: boolean } = {},
): Promise<{ estado: string; motivo?: string; pendientes?: number }> {
  soloPruebas(url);
  const real = env.DB!;
  const s = await sesionDeJuego(real, sesionId);
  if (!s) throw new ErrorDatos('No encontrado.', undefined, 404);
  if (s.estado !== 'corriendo') return { estado: s.estado };
  const ctx = crearCtx(env, url, ec);
  const robots = await robotsDe(env, s);
  const meta = leerMeta(s);
  if (!meta.cierre) await cerrarRestaurantes(ctx, robots);
  const vivos = await pedidosVivosDeJuego(ctx, robots);
  if (vivos.length && !opciones.inmediato && !meta.cierre) {
    await ctx.db
      .prepare(
        "UPDATE simulador_sesiones SET meta = json_set(meta, '$.cierre', json(?)), actualizada_en = datetime('now') WHERE id = ? AND estado = 'corriendo'",
      )
      .bind(JSON.stringify({ motivo: motivo.slice(0, 200), pasos: 0 }), s.id)
      .run();
    await guardarFallos(ctx, s, true);
    await anotarFilas(real, s.id, ctx.cuenta);
    return { estado: 'cerrando', motivo, pendientes: vivos.length };
  }
  if (vivos.length) await cancelarColgados(ctx, robots);
  await desconectarRepartidores(ctx, robots);
  await guardarFallos(ctx, s, true);
  const motivoFin = meta.cierre?.motivo ?? motivo;
  await ctx.db
    .prepare(
      `UPDATE simulador_sesiones SET estado = 'terminada', fin = datetime('now'), actualizada_en = datetime('now'),
         meta = json_remove(json_set(meta, '$.motivoFin', ?), '$.cierre') WHERE id = ? AND estado = 'corriendo'`,
    )
    .bind(motivoFin.slice(0, 200), s.id)
    .run();
  await anotarFilas(real, s.id, ctx.cuenta);
  return { estado: 'terminada', motivo: motivoFin };
}

const MAX_FALLOS = 50;
/** Suma los fallos nuevos a la sesión (sin repetir el mismo paso del mismo pedido). */
async function guardarFallos(ctx: Ctx, s: FilaSesion, forzar = false) {
  const viejos = JSON.parse(s.fallos) as Fallo[];
  const vistos = new Set(viejos.map((f) => `${f.pedido ?? ''}|${f.comportamiento}|${f.mensaje}`));
  const nuevos = ctx.fallos.filter((f) => {
    const k = `${f.pedido ?? ''}|${f.comportamiento}|${f.mensaje}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
  // El latido no escribe la sesión en cada vuelta: solo con fallos nuevos o cada 20 segundos.
  const vieja = Date.now() - Date.parse(`${s.actualizada_en.replace(' ', 'T')}Z`) > 20_000;
  if (!nuevos.length && !vieja && !forzar) return;
  await ctx.db
    .prepare(
      "UPDATE simulador_sesiones SET fallos = ?, actualizada_en = datetime('now') WHERE id = ?",
    )
    .bind(JSON.stringify([...viejos, ...nuevos].slice(-MAX_FALLOS)), s.id)
    .run();
}

// ------------------------------------------------------------------ latido

type PedidoVivo = {
  id: string;
  estado: string;
  restaurante_id: string;
  repartidor_id: string | null;
  lat: number | null;
  lng: number | null;
  metodo_pago: string;
  cobro_estado: string | null;
  total: number;
  propina: number;
  pago_restaurante: number;
  seg_pagado: number | null;
  seg_aceptado: number | null;
  seg_listo: number | null;
  recogida: number;
  pin: string | null;
  entrega: string | null;
  pago_local: number;
  verificado: number;
  llego: number;
  ajuste: number;
};

const marcas = (n: number) => Array.from({ length: n }, () => '?').join(',');
const esDirecto = (m: string) => m === 'efectivo' || m === 'transferencia_repartidor';

/**
 * Un latido de la pantalla abierta: cada pedido de los robots avanza un paso y cada repartidor con
 * pedido maneja un tramo. Devuelve si la ciudad sigue encendida y, si se apagó sola, por qué.
 */
export async function latido(
  env: Env,
  url: string,
  sesionId: string,
  ec?: ExecutionContext,
): Promise<{ estado: string; motivo?: string; filas?: number }> {
  soloPruebas(url);
  const real = env.DB!;
  const s = await sesionDeJuego(real, sesionId);
  if (!s) throw new ErrorDatos('No encontrado.', undefined, 404);
  if (s.estado !== 'corriendo') return { estado: s.estado };
  // Se apaga sola: por tiempo, por las filas de la sesión o por el tope del día.
  const minutos = (Date.now() - Date.parse(`${s.inicio.replace(' ', 'T')}Z`)) / 60_000;
  const filas = await filasDeSesion(real, s.id);
  const porFilas =
    filas.sesion >= JUEGO.topeFilasSesion
      ? `llegó al tope de ${JUEGO.topeFilasSesion} filas escritas de la sesión`
      : filas.dia > TOPE_DIA_PRUEBAS.escritas
        ? `las pruebas de hoy pasaron el tope diario de ${TOPE_DIA_PRUEBAS.escritas} filas`
        : null;
  // Por filas no se gasta más: lo que quede se cancela ya. Por tiempo, entra en cierre.
  if (porFilas) return apagar(env, url, s.id, porFilas, ec, { inmediato: true });
  const metaS = leerMeta(s);
  if (minutos >= JUEGO.minutosMax && !metaS.cierre)
    return apagar(env, url, s.id, `se cumplieron ${JUEGO.minutosMax} minutos`, ec);
  // C-CIUDAD-CIERRE: agotados los pasos finales, se cancela lo que quede y se apaga.
  const cierre = metaS.cierre;
  if (cierre && cierre.pasos >= JUEGO.pasosCierre)
    return apagar(env, url, s.id, cierre.motivo, ec, { inmediato: true });

  const ctx = crearCtx(env, url, ec);
  const robots = await robotsDe(env, s);
  const restaurantes = new Map(
    robots.filter((r) => r.rol === 'restaurante' && r.rid).map((r) => [r.rid!, r]),
  );
  const repartidores = new Map(robots.filter((r) => r.rol === 'repartidor').map((r) => [r.id, r]));
  const rids = [...restaurantes.keys()];
  const uids = [...repartidores.keys()];
  if (!rids.length || !uids.length) return { estado: 'corriendo' };
  const seg = (col: string) => `CAST((julianday('now') - julianday(${col})) * 86400 AS INTEGER)`;
  const { results: pedidos } = await ctx.db
    .prepare(
      `SELECT p.id, p.estado, p.restaurante_id, p.repartidor_id, p.lat, p.lng, COALESCE(p.metodo_pago, 'tarjeta') AS metodo_pago,
         p.cobro_estado, p.total, p.propina, p.pago_restaurante,
         ${seg('p.pagado_en')} AS seg_pagado, ${seg('p.aceptado_en')} AS seg_aceptado, ${seg('p.listo_en')} AS seg_listo,
         EXISTS (SELECT 1 FROM recogidas rc WHERE rc.pedido_id = p.id) AS recogida,
         (SELECT pin FROM pines_entrega pe WHERE pe.pedido_id = p.id) AS pin,
         (SELECT modo FROM preferencias_entrega pr WHERE pr.pedido_id = p.id) AS entrega,
         EXISTS (SELECT 1 FROM pagos_local pl WHERE pl.pedido_id = p.id) AS pago_local,
         EXISTS (SELECT 1 FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'verificado') AS verificado,
         EXISTS (SELECT 1 FROM hitos_pedido h WHERE h.pedido_id = p.id AND h.hito = 'llego_cliente') AS llego,
         EXISTS (SELECT 1 FROM ajustes_pedido a WHERE a.pedido_id = p.id AND a.estado = 'pendiente') AS ajuste
        FROM pedidos p
       WHERE p.estado IN ('pagado','aceptado','listo','en_camino')
         AND (p.restaurante_id IN (${marcas(rids.length)}) OR p.repartidor_id IN (${marcas(uids.length)}))
       ORDER BY p.creado_en LIMIT 40`,
    )
    .bind(...rids, ...uids)
    .all<PedidoVivo>();
  const { results: fichas } = await ctx.db
    .prepare(
      `SELECT d.usuario_id AS id, d.lat, d.lng, d.conectado, ${seg('d.ubicacion_en')} AS seg_ubicacion,
         (SELECT ${seg('MAX(u.creado_en)')} FROM ubicaciones_recientes u WHERE u.usuario_id = d.usuario_id) AS seg_lectura
        FROM repartidores d WHERE d.usuario_id IN (${marcas(uids.length)})`,
    )
    .bind(...uids)
    .all<{
      id: string;
      lat: number | null;
      lng: number | null;
      conectado: number;
      seg_ubicacion: number | null;
      seg_lectura: number | null;
    }>();
  const { results: locales } = await ctx.db
    .prepare(
      `SELECT id, lat, lng, ${seg('senal_en')} AS seg_senal FROM restaurantes WHERE id IN (${marcas(rids.length)})`,
    )
    .bind(...rids)
    .all<{ id: string; lat: number; lng: number; seg_senal: number | null }>();
  const local = new Map(locales.map((l) => [l.id, { lat: Number(l.lat), lng: Number(l.lng) }]));
  const ficha = new Map(fichas.map((f) => [f.id, f]));
  const sobrePresupuesto = () => ctx.cuenta.escritas >= JUEGO.topeFilasLatido;
  const movidos = new Set<string>();

  /** El repartidor robot maneja un tramo hacia `hacia`. Devuelve true si ya está ahí. */
  const manejar = async (rep: Robot, hacia: Punto, pid: string) => {
    const f = ficha.get(rep.id);
    const aqui =
      f?.lat != null && f.lng != null ? { lat: Number(f.lat), lng: Number(f.lng) } : null;
    if (aqui && metros(aqui, hacia) <= JUEGO.llegadaM) return true;
    if (movidos.has(rep.id)) return false;
    const paso = tramoPermitido(f?.seg_lectura ?? null);
    if (paso < 20) return false;
    const siguiente = aqui ? avanzar(aqui, hacia, paso) : hacia;
    movidos.add(rep.id);
    await accion(ctx, rep, 'manejar', pid, 'POST', '/datos/repartidor/ubicacion', {
      ...siguiente,
      precision: 8,
    });
    if (f) {
      f.lat = siguiente.lat;
      f.lng = siguiente.lng;
    }
    return false;
  };

  for (const p of pedidos) {
    if (sobrePresupuesto()) break;
    const rest = restaurantes.get(p.restaurante_id);
    // 1. El restaurante robot: acepta, prepara y marca listo (y entrega lo que se recoge).
    if (rest) {
      const ruta = (q: string) => `/datos/restaurante/pedidos/${p.id}/${q}`;
      if (!cierre && p.estado === 'pagado' && (p.seg_pagado ?? 0) >= JUEGO.esperaAceptarS) {
        await accion(ctx, rest, 'aceptar', p.id, 'POST', ruta('aceptar'), { minutos: 10 });
        continue;
      }
      if (p.estado === 'aceptado' && !p.ajuste && (p.seg_aceptado ?? 0) >= JUEGO.esperaListoS) {
        await accion(ctx, rest, 'marcar listo', p.id, 'POST', ruta('listo'), {});
        continue;
      }
      if (
        p.estado === 'listo' &&
        p.recogida &&
        p.pin &&
        (p.seg_listo ?? 0) >= JUEGO.esperaRecogerS
      ) {
        await accion(ctx, rest, 'entregar en el local', p.id, 'POST', ruta('entregado-local'), {
          pin: p.pin,
        });
        continue;
      }
    }
    // 2. El repartidor robot que lo lleva.
    const rep = p.repartidor_id ? repartidores.get(p.repartidor_id) : undefined;
    if (!rep) continue;
    const enLocal = local.get(p.restaurante_id);
    const rutaRep = (q: string) => `/datos/repartidor/pedidos/${p.id}/${q}`;
    if ((p.estado === 'aceptado' || p.estado === 'listo') && enLocal) {
      if (!(await manejar(rep, enLocal, p.id))) continue;
      if (esDirecto(p.metodo_pago) && !p.pago_local) {
        // En efectivo el repartidor paga la comida en el mostrador y anota el ticket.
        await accion(ctx, rep, 'pagar en el local', p.id, 'POST', rutaRep('pago-local'), {
          montoPagado: Number(p.pago_restaurante),
          importeTicket: Number(p.pago_restaurante),
          metodo: 'efectivo',
        });
        continue;
      }
      if (p.estado !== 'listo') continue;
      if (!p.verificado) {
        await accion(ctx, rep, 'escanear el código', p.id, 'POST', rutaRep('verificar'), {
          codigo: p.id,
        });
        continue;
      }
      await accion(
        ctx,
        rep,
        'foto de la bolsa',
        p.id,
        'POST',
        `${rutaRep('foto-recogida')}?lat=${enLocal.lat}&lng=${enLocal.lng}`,
        undefined,
        FOTO_JUEGO,
      );
      continue;
    }
    if (p.estado === 'en_camino' && p.lat != null && p.lng != null) {
      const casa = { lat: Number(p.lat), lng: Number(p.lng) };
      if (!(await manejar(rep, casa, p.id))) continue;
      if (!p.llego) {
        // En la puerta: la llegada la confirman dos lecturas precisas (llegada confiable).
        if (!movidos.has(rep.id))
          await accion(
            ctx,
            rep,
            'llegar a la puerta',
            p.id,
            'POST',
            '/datos/repartidor/ubicacion',
            {
              ...casa,
              precision: 8,
            },
          );
        movidos.add(rep.id);
        continue;
      }
      if (esDirecto(p.metodo_pago) && p.cobro_estado === 'pendiente') {
        await accion(ctx, rep, 'cobrar en efectivo', p.id, 'POST', rutaRep('cobre'), {
          montoRecibido: Number(p.total) - Number(p.propina),
          nota: 'Cobro del juego (robot)',
        });
        continue;
      }
      if (p.pin || p.entrega === 'mano')
        await accion(ctx, rep, 'entregar en mano', p.id, 'POST', rutaRep('entregado'), {
          ...casa,
          modo: 'mano',
          ...(p.pin ? { pin: p.pin } : {}),
        });
      else
        await accion(
          ctx,
          rep,
          'entregar con foto',
          p.id,
          'POST',
          `${rutaRep('entregado')}?lat=${casa.lat}&lng=${casa.lng}`,
          undefined,
          FOTO_JUEGO,
        );
    }
  }

  // 3. Los repartidores libres miran sus ofertas solo si hay pedidos de la ciudad esperando.
  const ocupados = new Set(pedidos.map((p) => p.repartidor_id).filter(Boolean) as string[]);
  const esperando = new Set(
    pedidos
      .filter(
        (p) =>
          restaurantes.has(p.restaurante_id) &&
          !p.repartidor_id &&
          !p.recogida &&
          (p.estado === 'aceptado' || p.estado === 'listo'),
      )
      .map((p) => p.id),
  );
  for (const rep of repartidores.values()) {
    if (sobrePresupuesto()) break;
    const f = ficha.get(rep.id);
    if (!f?.conectado || ocupados.has(rep.id)) continue;
    if (esperando.size && !cierre) {
      const r = await llamar(ctx, rep, 'GET', '/datos/repartidor/ofertas');
      const ids = ((r.datos.ofertas as { id: string }[] | undefined) ?? []).map((o) => o.id);
      const mio = ids.find((x) => esperando.has(x));
      if (mio) {
        const a = await accion(
          ctx,
          rep,
          'aceptar la oferta',
          mio,
          'POST',
          `/datos/repartidor/ofertas/${mio}/aceptar`,
          {},
        );
        if (a.ok) {
          esperando.delete(mio);
          ocupados.add(rep.id);
          continue;
        }
      }
      // Lo que no es de la ciudad (un pedido de un humano) lo deja pasar a otro repartidor.
      for (const otro of ids.filter((x) => x !== mio && !esperando.has(x)))
        await llamar(ctx, rep, 'POST', `/datos/repartidor/ofertas/${otro}/rechazar`, {});
    }
    // Conectado y quieto: su ubicación cada 5 minutos (las ofertas piden una de los últimos 10).
    if (
      f.lat != null &&
      f.lng != null &&
      (f.seg_ubicacion == null || f.seg_ubicacion >= JUEGO.ubicacionLibreS)
    )
      await llamar(ctx, rep, 'POST', '/datos/repartidor/ubicacion', {
        lat: Number(f.lat),
        lng: Number(f.lng),
        precision: 10,
      });
  }
  // 4. La señal de cada restaurante (sin ella, a los 5 minutos deja de recibir pedidos).
  for (const l of locales) {
    if (l.seg_senal != null && l.seg_senal < JUEGO.senalRestauranteS) continue;
    const r = restaurantes.get(l.id);
    if (r) await llamar(ctx, r, 'GET', '/datos/restaurante/pedidos');
  }
  if (cierre) {
    // Cuenta el paso final; si ya no queda nada vivo, se apaga de una vez.
    await ctx.db
      .prepare(
        "UPDATE simulador_sesiones SET meta = json_set(meta, '$.cierre.pasos', ?), actualizada_en = datetime('now') WHERE id = ?",
      )
      .bind(cierre.pasos + 1, s.id)
      .run();
    await guardarFallos(ctx, s, true);
    await anotarFilas(real, s.id, ctx.cuenta);
    const vivos = await pedidosVivosDeJuego(ctx, robots);
    if (!vivos.length) return apagar(env, url, s.id, cierre.motivo, ec, { inmediato: true });
    return { estado: 'corriendo', filas: ctx.cuenta.escritas };
  }
  await guardarFallos(ctx, s);
  await anotarFilas(real, s.id, ctx.cuenta);
  return { estado: 'corriendo', filas: ctx.cuenta.escritas };
}

// ------------------------------------------------------------------ pago sin tarjeta

/**
 * ¿Este restaurante es un robot del juego y estamos en pruebas o en local? Solo entonces acepta
 * «efectivo al recibir» aunque el país no lo tenga encendido. En producción, nunca.
 */
export async function efectivoDeJuego(
  url: string,
  db: D1Database,
  restauranteId: string | null | undefined,
): Promise<boolean> {
  const e = entornoDe(url);
  if ((e !== 'pruebas' && e !== 'local') || !restauranteId) return false;
  const f = await db
    .prepare(
      'SELECT 1 FROM restaurantes r JOIN usuarios u ON u.id = r.dueno_id WHERE r.id = ? AND u.correo LIKE ?',
    )
    .bind(restauranteId, PATRON_RESTAURANTE_JUEGO)
    .first();
  return Boolean(f);
}

// La foto de la bolsa y de la entrega de los robots: un JPEG pequeño de verdad, sin metadatos.
const FOTO_JUEGO = Uint8Array.from(atob(FOTO_JUEGO_BASE64), (c) => c.charCodeAt(0));
