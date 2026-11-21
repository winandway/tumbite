import { metrosEntre } from '@tumbite/compartido';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../env';
import { nuevoId } from '../cripto';
import { guardarFoto } from '../fotoLimpia';
import { type Variables, base, exigir } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { MAX_FOTO_BYTES, tipoReal } from './fotos';

/**
 * C-FOTO-PUERTA (15 nov 2026, pedido de Richard) — todos los países. El cliente sube hasta tres
 * fotos del frente y de la puerta de una dirección guardada, de afuera hacia adentro, y el
 * repartidor asignado las ve mientras lleva el pedido. Precedente: Uber Eats [DOC]; ficha en
 * docs/investigaciones-rea/2026-11-15-foto-de-la-puerta.md.
 *
 * Reglas que no se tocan:
 * - PRIVADAS: viven en `puertas/<usuario>/<direccion>/…` del almacén privado; jamás bajo
 *   `/media/fotos/` (eso es público). Se sirven solo por estas rutas, con sesión y `no-store`.
 * - Las ve el dueño de la dirección y el repartidor ASIGNADO, y este solo mientras el pedido está
 *   «en_camino». Ni antes de recoger, ni después de entregar, ni soporte, ni el restaurante.
 * - No se usan para mercadeo ni para entrenar nada (Apple 5.1.2(vi)): aquí no hay ninguna otra
 *   lectura de estos archivos.
 * - Presupuesto de escrituras: una fila por foto (subirla o cambiarla); la miniatura es la misma
 *   clave con «-s» y no escribe; mirar no escribe nunca.
 */
export const fotoPuerta = new Hono<{ Bindings: Env; Variables: Variables }>();

export type TipoLugar = 'casa' | 'edificio';
export type RolFotoPuerta = 'frente' | 'puerta' | 'entrada' | 'paso' | 'apto';

/** De afuera hacia adentro. Casa: frente y puerta. Edificio: entrada, paso intermedio y puerta. */
export const ROLES_PUERTA: Record<TipoLugar, RolFotoPuerta[]> = {
  casa: ['frente', 'puerta'],
  edificio: ['entrada', 'paso', 'apto'],
};

/**
 * C-CASA-POR-DEFECTO (Richard, 21 nov 2026): lo que eligió el cliente y, si no eligió, casa (hay más
 * casas que edificios). El apartamento escrito ya no decide: una casa también lleva número.
 */
export const tipoLugarDe = (tipoLugar: unknown): TipoLugar =>
  tipoLugar === 'edificio' ? 'edificio' : 'casa';

const MAX_MINI_BYTES = 80 * 1024;
const PRIVADA = 'private, no-store';

function almacen(env: Env): R2Bucket {
  if (!env.BUCKET)
    throw new ErrorDatos(
      'El almacén de fotos no está disponible en este momento. Intenta más tarde.',
      undefined,
      503,
    );
  return env.BUCKET;
}

/** Quita del almacén los archivos de unas fotos (la grande y su miniatura). */
async function borrarArchivos(env: Pick<Env, 'BUCKET'>, claves: string[]) {
  if (!env.BUCKET || !claves.length) return;
  await env.BUCKET.delete(claves.flatMap((k) => [k, `${k}-s`]));
}

/** Borra las fotos de una dirección (todas, o desde un orden): filas y archivos. */
export async function borrarFotosDeDireccion(
  env: Pick<Env, 'BUCKET'>,
  db: D1Database,
  direccionId: string,
  desdeOrden = 1,
) {
  const { results } = await db
    .prepare('SELECT clave FROM direcciones_fotos WHERE direccion_id = ? AND orden >= ?')
    .bind(direccionId, desdeOrden)
    .all<{ clave: string }>();
  if (!results.length) return;
  await db
    .prepare('DELETE FROM direcciones_fotos WHERE direccion_id = ? AND orden >= ?')
    .bind(direccionId, desdeOrden)
    .run();
  await borrarArchivos(
    env,
    results.map((r) => r.clave),
  );
}

/** Al borrar la cuenta: todo el prefijo privado de la persona, quede o no fila que lo nombre. */
export async function borrarPuertasDeUsuario(env: Pick<Env, 'BUCKET'>, usuarioId: string) {
  if (!env.BUCKET) return;
  let cursor: string | undefined;
  do {
    const lista = await env.BUCKET.list({ prefix: `puertas/${usuarioId}/`, cursor });
    if (lista.objects.length) await env.BUCKET.delete(lista.objects.map((o) => o.key));
    cursor = lista.truncated ? lista.cursor : undefined;
  } while (cursor);
}

/** Los órdenes que ya tienen foto, por dirección (para la lista de direcciones del cliente). */
export async function fotosPorDireccion(db: D1Database, usuarioId: string) {
  const { results } = await db
    .prepare(
      'SELECT f.direccion_id AS d, f.orden FROM direcciones_fotos f JOIN direcciones_cliente dc ON dc.id = f.direccion_id WHERE dc.usuario_id = ? ORDER BY f.orden',
    )
    .bind(usuarioId)
    .all<{ d: string; orden: number }>();
  const mapa = new Map<string, number[]>();
  for (const r of results) mapa.set(r.d, [...(mapa.get(r.d) ?? []), Number(r.orden)]);
  return mapa;
}

const ordenDe = (texto: string) => {
  const n = Number(texto);
  if (!Number.isInteger(n) || n < 1 || n > 3) throw new ErrorDatos('No encontrado', undefined, 404);
  return n;
};

async function miDireccion(db: D1Database, id: string, usuarioId: string) {
  const d = await db
    .prepare('SELECT id, tipo_lugar, apto FROM direcciones_cliente WHERE id = ? AND usuario_id = ?')
    .bind(id, usuarioId)
    .first<{ id: string; tipo_lugar: string; apto: string }>();
  if (!d) throw new ErrorDatos('Esa dirección ya no está guardada.', undefined, 404);
  return d;
}

function entregar(obj: R2ObjectBody) {
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('cache-control', PRIVADA);
  headers.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers });
}

// ───────────────────────── El cliente: sus direcciones ─────────────────────────

fotoPuerta.patch('/mis-direcciones/:id', async (c) => {
  const u = exigir(c, 'cliente');
  const { tipoLugar } = await leerCuerpo(c, z.object({ tipoLugar: z.enum(['casa', 'edificio']) }));
  const db = base(c);
  const d = await miDireccion(db, c.req.param('id'), u.id);
  if (d.tipo_lugar !== tipoLugar) {
    // Al cambiar de casa a edificio (o al revés) la primera foto sigue valiendo (el frente o la
    // entrada); las de adentro cambian de sentido y se quitan para que no queden mal rotuladas.
    if (tipoLugarDe(d.tipo_lugar) !== tipoLugar) await borrarFotosDeDireccion(c.env, db, d.id, 2);
    await db
      .prepare('UPDATE direcciones_cliente SET tipo_lugar = ? WHERE id = ?')
      .bind(tipoLugar, d.id)
      .run();
  }
  const { results } = await db
    .prepare('SELECT orden FROM direcciones_fotos WHERE direccion_id = ? ORDER BY orden')
    .bind(d.id)
    .all<{ orden: number }>();
  return c.json({ ok: true, tipoLugar, fotos: results.map((r) => Number(r.orden)) });
});

fotoPuerta.post('/mis-direcciones/:id/fotos/:orden', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const orden = ordenDe(c.req.param('orden'));
  const mini = c.req.query('tam') === 'mini';
  const d = await miDireccion(db, c.req.param('id'), u.id);
  if (orden > ROLES_PUERTA[tipoLugarDe(d.tipo_lugar)].length)
    throw new ErrorDatos('Una casa lleva dos fotos: el frente y la puerta.', 'foto', 422);
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.byteLength === 0) throw new ErrorDatos('No llegó ninguna foto.', 'foto', 400);
  if (bytes.byteLength > (mini ? MAX_MINI_BYTES : MAX_FOTO_BYTES))
    throw new ErrorDatos('La foto pesa demasiado. El máximo es 3 MB.', 'foto', 413);
  const tipo = tipoReal(bytes);
  if (!tipo) throw new ErrorDatos('Sube una foto en JPG, PNG o WebP.', 'foto', 415);
  // La app exige una dirección en la respuesta: es la ruta privada de esta misma foto (con sesión).
  const bucket = almacen(c.env);
  const anterior = await db
    .prepare('SELECT clave FROM direcciones_fotos WHERE direccion_id = ? AND orden = ?')
    .bind(d.id, orden)
    .first<{ clave: string }>();
  if (mini) {
    // La miniatura acompaña a la foto ya subida: misma clave con «-s», sin escribir en la base.
    if (!anterior) throw new ErrorDatos('Primero sube la foto.', 'foto', 409);
    await guardarFoto(bucket, `${anterior.clave}-s`, bytes, tipo, { cacheControl: PRIVADA });
    return c.json({ ok: true, url: `/datos/mis-direcciones/${d.id}/fotos/${orden}` }, 201);
  }
  const clave = `puertas/${u.id}/${d.id}/${orden}-${nuevoId()}`;
  // Sin datos ocultos: la limpieza quita la ubicación y el modelo del teléfono (C-FOTOS-SIN-METADATOS).
  await guardarFoto(bucket, clave, bytes, tipo, { cacheControl: PRIVADA });
  await db
    .prepare(
      "INSERT INTO direcciones_fotos (id, direccion_id, orden, clave) VALUES (?, ?, ?, ?) ON CONFLICT (direccion_id, orden) DO UPDATE SET clave = excluded.clave, creado_en = datetime('now')",
    )
    .bind(nuevoId(), d.id, orden, clave)
    .run();
  // Al cambiar la foto, la anterior se elimina de verdad.
  if (anterior) await borrarArchivos(c.env, [anterior.clave]);
  return c.json({ ok: true, url: `/datos/mis-direcciones/${d.id}/fotos/${orden}` }, 201);
});

fotoPuerta.get('/mis-direcciones/:id/fotos/:orden', async (c) => {
  const u = exigir(c, 'cliente');
  const f = await base(c)
    .prepare(
      'SELECT f.clave FROM direcciones_fotos f JOIN direcciones_cliente d ON d.id = f.direccion_id WHERE f.direccion_id = ? AND f.orden = ? AND d.usuario_id = ?',
    )
    .bind(c.req.param('id'), ordenDe(c.req.param('orden')), u.id)
    .first<{ clave: string }>();
  if (!f || !c.env.BUCKET) return c.text('No encontrado', 404);
  const mini = c.req.query('tam') === 'mini';
  const obj =
    (mini ? await c.env.BUCKET.get(`${f.clave}-s`) : null) ?? (await c.env.BUCKET.get(f.clave));
  return obj ? entregar(obj) : c.text('No encontrado', 404);
});

fotoPuerta.delete('/mis-direcciones/:id/fotos/:orden', async (c) => {
  const u = exigir(c, 'cliente');
  const db = base(c);
  const orden = ordenDe(c.req.param('orden'));
  const d = await miDireccion(db, c.req.param('id'), u.id);
  const f = await db
    .prepare('SELECT clave FROM direcciones_fotos WHERE direccion_id = ? AND orden = ?')
    .bind(d.id, orden)
    .first<{ clave: string }>();
  if (f) {
    await db
      .prepare('DELETE FROM direcciones_fotos WHERE direccion_id = ? AND orden = ?')
      .bind(d.id, orden)
      .run();
    await borrarArchivos(c.env, [f.clave]);
  }
  return c.json({ ok: true });
});

// ───────────────────────── El repartidor: solo el asignado, solo en camino ─────────────────────────

type PedidoPuerta = {
  estado: string;
  repartidor_id: string | null;
  direccion_id: string | null;
  tipo_lugar: string | null;
  apto: string | null;
};

/** El pedido, si es de este repartidor. Las fotos solo existen para él mientras va «en camino». */
async function pedidoDelRepartidor(db: D1Database, pedidoId: string, repartidorId: string) {
  const p = await db
    .prepare(
      'SELECT p.estado, p.repartidor_id, d.id AS direccion_id, d.tipo_lugar, d.apto FROM pedidos p LEFT JOIN direcciones_cliente d ON d.id = p.direccion_id AND d.usuario_id = p.cliente_id WHERE p.id = ?',
    )
    .bind(pedidoId)
    .first<PedidoPuerta>();
  if (!p || p.repartidor_id !== repartidorId) return null;
  return { ...p, visible: p.estado === 'en_camino' && !!p.direccion_id };
}

fotoPuerta.get('/repartidor/pedidos/:id/puerta', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const p = await pedidoDelRepartidor(db, c.req.param('id'), u.id);
  if (!p) throw new ErrorDatos('Ese pedido no es tuyo.', undefined, 404);
  c.header('cache-control', PRIVADA);
  if (!p.visible) return c.json({ fotos: [] });
  const roles = ROLES_PUERTA[tipoLugarDe(p.tipo_lugar)];
  const { results } = await db
    .prepare('SELECT orden FROM direcciones_fotos WHERE direccion_id = ? ORDER BY orden')
    .bind(p.direccion_id)
    .all<{ orden: number }>();
  return c.json({
    fotos: results
      .map((r) => ({ orden: Number(r.orden), rol: roles[Number(r.orden) - 1] }))
      .filter((f) => f.rol),
  });
});

fotoPuerta.get('/repartidor/pedidos/:id/puerta/:orden', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const p = await pedidoDelRepartidor(db, c.req.param('id'), u.id);
  if (!p?.visible || !c.env.BUCKET) return c.text('No encontrado', 404);
  const f = await db
    .prepare('SELECT clave FROM direcciones_fotos WHERE direccion_id = ? AND orden = ?')
    .bind(p.direccion_id, ordenDe(c.req.param('orden')))
    .first<{ clave: string }>();
  if (!f) return c.text('No encontrado', 404);
  const mini = c.req.query('tam') === 'mini';
  const obj =
    (mini ? await c.env.BUCKET.get(`${f.clave}-s`) : null) ?? (await c.env.BUCKET.get(f.clave));
  return obj ? entregar(obj) : c.text('No encontrado', 404);
});

// ───────────────────────── El conductor de un viaje: solo el asignado, solo yendo a recoger ─────

/**
 * C-FOTO-RECOGIDA (21 nov 2026, orden de Richard) — todos los países. Dentro de un barrio las casas
 * no salen en el mapa: el conductor llega y no sabe dónde lo pidieron. Si el punto de recogida de un
 * viaje cae en una dirección guardada del pasajero, el conductor ASIGNADO ve las fotos de esa entrada
 * mientras va a recoger («asignado» y «conductor_llego»). Al recoger al pasajero, al cancelarse o al
 * terminar, deja de verlas. Nunca la foto del destino. Mirar no escribe.
 *
 * «Cae en una dirección guardada»: a no más de RADIO_RECOGIDA_M metros de su punto (el GPS del
 * pasajero parado en su puerta nunca da el punto exacto). Más lejos es un punto suelto: sin foto.
 */
export const RADIO_RECOGIDA_M = 40;
/** Estados del viaje en que el conductor todavía busca la entrada. */
const BUSCANDO_LA_ENTRADA = ['asignado', 'conductor_llego'];

/** Al cotizar: si la recogida cae en una dirección guardada del pasajero, cuál y si tiene fotos. Una lectura. */
export async function direccionDeRecogida(
  db: D1Database,
  clienteId: string,
  origen: { lat: number; lng: number },
): Promise<{ direccionId: string | null; conFotos: boolean }> {
  const { results } = await db
    .prepare(
      `SELECT d.id, d.lat, d.lng,
              EXISTS (SELECT 1 FROM direcciones_fotos f WHERE f.direccion_id = d.id) AS fotos
         FROM direcciones_cliente d
        WHERE d.usuario_id = ? AND d.lat IS NOT NULL AND d.lng IS NOT NULL`,
    )
    .bind(clienteId)
    .all<{ id: string; lat: number; lng: number; fotos: number }>();
  let cerca: { id: string; fotos: number; metros: number } | null = null;
  for (const d of results) {
    const metros = metrosEntre(origen, { lat: Number(d.lat), lng: Number(d.lng) });
    if (metros <= RADIO_RECOGIDA_M && (!cerca || metros < cerca.metros))
      cerca = { id: d.id, fotos: Number(d.fotos), metros };
  }
  return { direccionId: cerca?.id ?? null, conFotos: cerca?.fotos === 1 };
}

type RecogidaViaje = {
  estado: string;
  direccion_id: string | null;
  tipo_lugar: string | null;
  etiqueta: string | null;
  instrucciones: string | null;
};

/**
 * El viaje, si este conductor es el ASIGNADO. La dirección solo viene si sigue guardada y sigue
 * siendo del pasajero de ese viaje (si la borró, ya no hay nada que mostrar).
 */
async function recogidaDelConductor(db: D1Database, operacionId: string, conductorId: string) {
  const v = await db
    .prepare(
      `SELECT v.estado, d.id AS direccion_id, d.tipo_lugar, d.etiqueta, d.instrucciones
         FROM operaciones o JOIN viajes v ON v.operacion_id = o.id
         LEFT JOIN direcciones_cliente d ON d.id = v.origen_direccion_id AND d.usuario_id = o.cliente_id
        WHERE o.id = ? AND o.conductor_id = ? AND o.tipo_operacion = 'viaje_pasajero'`,
    )
    .bind(operacionId, conductorId)
    .first<RecogidaViaje>();
  if (!v) return null;
  return { ...v, visible: BUSCANDO_LA_ENTRADA.includes(v.estado) && !!v.direccion_id };
}

fotoPuerta.get('/conductor/operaciones/:id/recogida', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const v = await recogidaDelConductor(db, c.req.param('id'), u.id);
  if (!v) throw new ErrorDatos('Ese viaje no es tuyo.', undefined, 404);
  c.header('cache-control', PRIVADA);
  const nada = { fotos: [], nombre: '', indicaciones: '' };
  if (!v.visible) return c.json(nada);
  const roles = ROLES_PUERTA[tipoLugarDe(v.tipo_lugar)];
  const { results } = await db
    .prepare('SELECT orden FROM direcciones_fotos WHERE direccion_id = ? ORDER BY orden')
    .bind(v.direccion_id)
    .all<{ orden: number }>();
  const fotos = results
    .map((r) => ({ orden: Number(r.orden), rol: roles[Number(r.orden) - 1] }))
    .filter((f) => f.rol);
  // Sin fotos no se manda nada de la dirección guardada: el nombre y las indicaciones acompañan a la foto.
  if (!fotos.length) return c.json(nada);
  return c.json({
    fotos,
    nombre: String(v.etiqueta ?? ''),
    indicaciones: String(v.instrucciones ?? ''),
  });
});

fotoPuerta.get('/conductor/operaciones/:id/recogida/:orden', async (c) => {
  const u = exigir(c, 'repartidor');
  const db = base(c);
  const v = await recogidaDelConductor(db, c.req.param('id'), u.id);
  if (!v?.visible || !c.env.BUCKET) return c.text('No encontrado', 404);
  const f = await db
    .prepare('SELECT clave FROM direcciones_fotos WHERE direccion_id = ? AND orden = ?')
    .bind(v.direccion_id, ordenDe(c.req.param('orden')))
    .first<{ clave: string }>();
  if (!f) return c.text('No encontrado', 404);
  const mini = c.req.query('tam') === 'mini';
  const obj =
    (mini ? await c.env.BUCKET.get(`${f.clave}-s`) : null) ?? (await c.env.BUCKET.get(f.clave));
  return obj ? entregar(obj) : c.text('No encontrado', 404);
});

/**
 * Al crear el pedido: de qué dirección guardada sale (por el texto que escribió el cliente, sin el
 * apartamento) y si la zona exige la primera foto. Una sola lectura.
 */
export async function direccionDelPedido(
  db: D1Database,
  usuarioId: string,
  direccionEscrita: string,
  zonaId: string,
): Promise<{ direccionId: string | null; obligatoria: boolean; tieneFoto: boolean }> {
  const r = await db
    .prepare(
      `SELECT (SELECT foto_puerta_obligatoria FROM zonas WHERE id = ?1) AS obligatoria, d.id,
        (SELECT 1 FROM direcciones_fotos f WHERE f.direccion_id = d.id AND f.orden = 1) AS foto
       FROM (SELECT 1) LEFT JOIN direcciones_cliente d ON d.usuario_id = ?2 AND lower(d.direccion) = lower(?3)
       LIMIT 1`,
    )
    .bind(zonaId, usuarioId, direccionEscrita.trim())
    .first<{ obligatoria: number | null; id: string | null; foto: number | null }>();
  return {
    direccionId: r?.id ?? null,
    obligatoria: Number(r?.obligatoria ?? 0) === 1,
    tieneFoto: Number(r?.foto ?? 0) === 1,
  };
}
