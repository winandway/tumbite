import { Hono } from 'hono';
import { z } from 'zod';
import {
  RESTRICCIONES,
  RESTRICCIONES_BLOQUEADAS,
  TIPOS_COMERCIO,
  UNIDADES_TAMANO,
  codigoBarrasValido,
  distanciaKm,
  leerPlanillaProductos,
  precioEstimado,
  tiposDeServicio,
  type Sustitucion,
} from '@tumbite/compartido';
import { entornoDe } from '../entorno';
import { serviciosImplementados } from '../esquema';
import { zonaPara } from './zonas';
import { aRestaurante, conHorarios } from './catalogo';
import { minutosPausa } from '../pausa';
import { nuevoId } from '../cripto';
import type { Env } from '../env';
import { paisDeZona } from '../internacional/paises';
import { type Variables, base } from '../sesion';
import { ErrorDatos, leerCuerpo } from '../validar';
import { exigirMiRestaurante } from './catalogo';

/**
 * Tiendas · Fase 1: el catálogo (C-TIENDAS-CATALOGO). Todos los países. El comercio elige su tipo
 * (mercado, farmacia, licores, ferretería…) y sube sus productos uno por uno o con la planilla
 * estándar (DoorDash e Instacart): ficha + oferta de la tienda, actualizando por SKU. Un producto
 * nunca se borra: se agota. El público todavía no ve las tiendas (servicios «muy pronto»).
 */
export const tiendas = new Hono<{ Bindings: Env; Variables: Variables }>();

const PAGINA = 50;
const MAX_FILAS = 5000;

type FilaProducto = Record<string, unknown>;
const aProducto = (f: FilaProducto) => ({
  id: f.id,
  sku: f.sku,
  codigoBarras: f.codigo_barras,
  nombreEs: f.nombre_es,
  nombreEn: f.nombre_en,
  marca: f.marca,
  tamano: f.tamano,
  unidadTamano: f.unidad_tamano,
  unidades: f.unidades,
  categoria1: f.categoria1,
  categoria2: f.categoria2,
  imagen: f.imagen,
  descripcion: f.descripcion,
  vendidoPor: f.vendido_por,
  pesoPromedio: f.peso_promedio,
  unidadPeso: f.unidad_peso,
  restriccion: f.restriccion,
  abv: f.abv,
  precio: f.precio ?? null,
  precioOferta: f.precio_oferta ?? null,
  disponible: f.disponible == null ? false : f.disponible === 1,
  existencias: f.existencias ?? null,
  pasillo: f.pasillo ?? '',
  actualizadoEn: f.actualizado_en,
});

async function miComercio(c: Parameters<typeof base>[0], minimo: 'staff' | 'manager' = 'manager') {
  const id = await exigirMiRestaurante(c, minimo);
  const db = base(c);
  const f = await db
    .prepare('SELECT id, zona_id, tipo_comercio FROM restaurantes WHERE id = ?')
    .bind(id)
    .first<{ id: string; zona_id: string; tipo_comercio: string }>();
  const { pais, moneda } = await paisDeZona(db, f?.zona_id ?? '');
  return { id, db, tipo: f?.tipo_comercio ?? 'restaurante', pais, moneda };
}

/** El tipo de comercio (lo cambia solo el dueño). Decide en qué servicio sale. */
tiendas.put('/mi-restaurante/tipo', async (c) => {
  const id = await exigirMiRestaurante(c, 'dueno');
  const d = await leerCuerpo(c, z.object({ tipo: z.enum(TIPOS_COMERCIO) }));
  await base(c)
    .prepare('UPDATE restaurantes SET tipo_comercio = ? WHERE id = ?')
    .bind(d.tipo, id)
    .run();
  return c.json({ tipo: d.tipo });
});

const esquemaBusqueda = z.object({
  q: z.string().trim().max(80).default(''),
  categoria: z.string().trim().max(60).default(''),
  pagina: z.coerce.number().int().min(1).max(1000).default(1),
});

/** Los productos de la tienda, con su oferta, buscando por nombre, marca, SKU o código de barras. */
tiendas.get('/mi-restaurante/productos', async (c) => {
  const t = await miComercio(c, 'staff');
  const q = esquemaBusqueda.parse(c.req.query());
  const donde = ['p.comercio_id = ?'];
  const valores: unknown[] = [t.id];
  if (q.q) {
    donde.push(
      "(p.nombre_es LIKE ? ESCAPE '\\' OR p.nombre_en LIKE ? ESCAPE '\\' OR p.marca LIKE ? ESCAPE '\\' OR p.sku = ? OR p.codigo_barras = ?)",
    );
    const patron = `%${q.q.replace(/[\\%_]/g, (x) => `\\${x}`)}%`;
    valores.push(patron, patron, patron, q.q, q.q);
  }
  if (q.categoria) {
    donde.push('p.categoria1 = ?');
    valores.push(q.categoria);
  }
  const { results } = await t.db
    .prepare(
      `SELECT p.*, o.precio, o.precio_oferta, o.disponible, o.existencias, o.pasillo
         FROM catalogo_productos p
         LEFT JOIN catalogo_ofertas o ON o.producto_id = p.id AND o.comercio_id = p.comercio_id
        WHERE ${donde.join(' AND ')}
        ORDER BY p.categoria1, COALESCE(NULLIF(p.nombre_es, ''), p.nombre_en) LIMIT ? OFFSET ?`,
    )
    .bind(...valores, PAGINA + 1, (q.pagina - 1) * PAGINA)
    .all<FilaProducto>();
  const totales = await t.db
    .prepare(
      `SELECT COUNT(*) AS total,
         SUM(CASE WHEN o.disponible = 1 THEN 1 ELSE 0 END) AS disponibles,
         SUM(CASE WHEN p.imagen = '' THEN 1 ELSE 0 END) AS sin_foto
         FROM catalogo_productos p
         LEFT JOIN catalogo_ofertas o ON o.producto_id = p.id AND o.comercio_id = p.comercio_id
        WHERE p.comercio_id = ?`,
    )
    .bind(t.id)
    .first<{ total: number; disponibles: number | null; sin_foto: number | null }>();
  const categorias = await t.db
    .prepare(
      'SELECT categoria1 AS nombre, COUNT(*) AS n FROM catalogo_productos WHERE comercio_id = ? GROUP BY categoria1 ORDER BY categoria1',
    )
    .bind(t.id)
    .all<{ nombre: string; n: number }>();
  return c.json({
    tipo: t.tipo,
    pais: t.pais,
    moneda: t.moneda,
    productos: results.slice(0, PAGINA).map(aProducto),
    hayMas: results.length > PAGINA,
    pagina: q.pagina,
    totales: {
      productos: Number(totales?.total ?? 0),
      disponibles: Number(totales?.disponibles ?? 0),
      sinFoto: Number(totales?.sin_foto ?? 0),
    },
    categorias: categorias.results,
  });
});

const esquemaProducto = z.object({
  sku: z.string().trim().min(1).max(64),
  codigoBarras: z
    .string()
    .trim()
    .max(14)
    .default('')
    .refine(
      (x) => !x || codigoBarrasValido(x),
      'El código de barras no es válido (revisa el último dígito).',
    ),
  nombreEs: z.string().trim().max(100).default(''),
  nombreEn: z.string().trim().max(100).default(''),
  marca: z.string().trim().max(100).default(''),
  tamano: z.number().positive().nullable().optional(),
  unidadTamano: z.enum(UNIDADES_TAMANO).default('each'),
  unidades: z.number().int().min(1).max(1000).default(1),
  categoria1: z.string().trim().min(1).max(60),
  categoria2: z.string().trim().max(60).default(''),
  imagen: z
    .string()
    .trim()
    .max(500)
    .default('')
    .refine((x) => !x || /^https:\/\/\S+$/.test(x), 'La foto debe ser una dirección https://.'),
  descripcion: z.string().trim().max(1000).default(''),
  vendidoPor: z.enum(['each', 'weight']).default('each'),
  pesoPromedio: z.number().positive().nullable().optional(),
  unidadPeso: z.string().trim().max(8).default(''),
  restriccion: z.enum(RESTRICCIONES).default(''),
  abv: z.number().min(0).max(100).nullable().optional(),
  precio: z.number().int().min(0).max(100_000_000),
  precioOferta: z.number().int().min(0).max(100_000_000).nullable().optional(),
  disponible: z.boolean().default(true),
  existencias: z.number().int().min(0).max(10_000_000).nullable().optional(),
  pasillo: z.string().trim().max(60).default(''),
});
type EntradaProducto = z.infer<typeof esquemaProducto>;

function revisar(d: EntradaProducto) {
  if (!d.nombreEs && !d.nombreEn) throw new ErrorDatos('Falta el nombre del producto.', 'nombreEs');
  if (RESTRICCIONES_BLOQUEADAS.includes(d.restriccion))
    throw new ErrorDatos(
      'Los medicamentos con receta todavía no se pueden vender en Divoox.',
      'restriccion',
      422,
    );
  if (d.vendidoPor === 'weight' && !d.pesoPromedio)
    throw new ErrorDatos('Si se vende por peso, escribe el peso promedio.', 'pesoPromedio');
}

/** Ficha + oferta de un producto (crea o actualiza por SKU), en sentencias para un solo lote. */
function sentenciasProducto(db: D1Database, comercioId: string, d: EntradaProducto, id: string) {
  return [
    db
      .prepare(
        `INSERT INTO catalogo_productos (id, comercio_id, sku, codigo_barras, nombre_es, nombre_en, marca, tamano,
           unidad_tamano, unidades, categoria1, categoria2, imagen, descripcion, vendido_por, peso_promedio,
           unidad_peso, restriccion, abv)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (comercio_id, sku) DO UPDATE SET codigo_barras = excluded.codigo_barras,
           nombre_es = excluded.nombre_es, nombre_en = excluded.nombre_en, marca = excluded.marca,
           tamano = excluded.tamano, unidad_tamano = excluded.unidad_tamano, unidades = excluded.unidades,
           categoria1 = excluded.categoria1, categoria2 = excluded.categoria2,
           imagen = CASE WHEN excluded.imagen <> '' THEN excluded.imagen ELSE catalogo_productos.imagen END,
           descripcion = excluded.descripcion, vendido_por = excluded.vendido_por,
           peso_promedio = excluded.peso_promedio, unidad_peso = excluded.unidad_peso,
           restriccion = excluded.restriccion, abv = excluded.abv, actualizado_en = datetime('now')`,
      )
      .bind(
        id,
        comercioId,
        d.sku,
        d.codigoBarras,
        d.nombreEs,
        d.nombreEn,
        d.marca,
        d.tamano ?? null,
        d.unidadTamano,
        d.unidades,
        d.categoria1,
        d.categoria2,
        d.imagen,
        d.descripcion,
        d.vendidoPor,
        d.pesoPromedio ?? null,
        d.unidadPeso,
        d.restriccion,
        d.abv ?? null,
      ),
    db
      .prepare(
        `INSERT INTO catalogo_ofertas (comercio_id, producto_id, precio, precio_oferta, disponible, existencias, pasillo)
         SELECT ?, id, ?, ?, ?, ?, ? FROM catalogo_productos WHERE comercio_id = ? AND sku = ?
         ON CONFLICT (comercio_id, producto_id) DO UPDATE SET precio = excluded.precio,
           precio_oferta = excluded.precio_oferta, disponible = excluded.disponible,
           existencias = excluded.existencias, pasillo = excluded.pasillo, agotado_hasta = NULL,
           actualizado_en = datetime('now')`,
      )
      .bind(
        comercioId,
        d.precio,
        d.precioOferta ?? null,
        d.disponible ? 1 : 0,
        d.existencias ?? null,
        d.pasillo,
        comercioId,
        d.sku,
      ),
  ];
}

async function productoPorSku(db: D1Database, comercioId: string, sku: string) {
  return db
    .prepare(
      `SELECT p.*, o.precio, o.precio_oferta, o.disponible, o.existencias, o.pasillo
         FROM catalogo_productos p
         LEFT JOIN catalogo_ofertas o ON o.producto_id = p.id AND o.comercio_id = p.comercio_id
        WHERE p.comercio_id = ? AND p.sku = ?`,
    )
    .bind(comercioId, sku)
    .first<FilaProducto>();
}

/** Crear o actualizar un producto (por SKU). */
tiendas.put('/mi-restaurante/productos', async (c) => {
  const t = await miComercio(c);
  const d = await leerCuerpo(c, esquemaProducto);
  revisar(d);
  await t.db.batch(sentenciasProducto(t.db, t.id, d, nuevoId()));
  return c.json({ producto: aProducto((await productoPorSku(t.db, t.id, d.sku)) ?? {}) });
});

/** Agotar o reactivar (nunca se borra). `hasta: 'hoy'` vuelve solo mañana. */
tiendas.patch('/mi-restaurante/productos/:id/disponible', async (c) => {
  const t = await miComercio(c, 'staff');
  const d = await leerCuerpo(
    c,
    z.object({ disponible: z.boolean(), hasta: z.enum(['hoy', 'reactivar']).default('reactivar') }),
  );
  const r = await t.db
    .prepare(
      `UPDATE catalogo_ofertas SET disponible = ?, agotado_hasta = ?, actualizado_en = datetime('now')
        WHERE comercio_id = ? AND producto_id = ?`,
    )
    .bind(
      d.disponible ? 1 : 0,
      !d.disponible && d.hasta === 'hoy'
        ? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
        : null,
      t.id,
      c.req.param('id'),
    )
    .run();
  if (!r.meta.changes) throw new ErrorDatos('Ese producto no existe en tu tienda.', undefined, 404);
  return c.json({ disponible: d.disponible });
});

/**
 * La planilla: con `confirmar: false` devuelve la vista previa (cuántas filas se crean, cuántas se
 * actualizan y los errores por fila, sin tocar nada); con `confirmar: true` guarda las válidas.
 * Lo que tiene error no se guarda y se dice en qué fila está.
 */
tiendas.post('/mi-restaurante/productos/importar', async (c) => {
  const t = await miComercio(c);
  const d = await leerCuerpo(
    c,
    z.object({ csv: z.string().min(1).max(5_000_000), confirmar: z.boolean().default(false) }),
  );
  const idioma = t.pais === 'US' ? 'en' : 'es';
  // Los nombres van en el idioma del país de la tienda; los avisos, en el de quien sube la planilla.
  const mensajes = (c.req.header('x-idioma') ?? idioma).startsWith('en') ? 'en' : 'es';
  const r = leerPlanillaProductos(d.csv, idioma, mensajes);
  if (r.faltanColumnas.length)
    throw new ErrorDatos(
      `Faltan las columnas: ${r.faltanColumnas.join(', ')}. Descarga la plantilla para ver el formato.`,
      'csv',
    );
  if (r.validas.length + r.errores.length > MAX_FILAS)
    throw new ErrorDatos(`La planilla pasa de ${MAX_FILAS} filas. Divídela.`, 'csv', 413);
  const existentes = new Set<string>();
  const skus = r.validas.map((x) => x.ficha.sku);
  for (let i = 0; i < skus.length; i += 90) {
    const trozo = skus.slice(i, i + 90);
    const { results } = await t.db
      .prepare(
        `SELECT sku FROM catalogo_productos WHERE comercio_id = ? AND sku IN (${trozo.map(() => '?').join(',')})`,
      )
      .bind(t.id, ...trozo)
      .all<{ sku: string }>();
    for (const x of results) existentes.add(x.sku);
  }
  const sinPrecio = r.validas.filter((x) => !x.oferta && !existentes.has(x.ficha.sku));
  const errores = [
    ...r.errores,
    ...sinPrecio.map((x) => ({
      fila: x.fila,
      error:
        mensajes === 'en'
          ? 'The price is missing (it’s a new product).'
          : 'Falta el precio (el producto es nuevo).',
    })),
  ].sort((a, b) => a.fila - b.fila);
  const aGuardar = r.validas.filter((x) => x.oferta || existentes.has(x.ficha.sku));
  const resumen = {
    nuevos: aGuardar.filter((x) => !existentes.has(x.ficha.sku)).length,
    actualizados: aGuardar.filter((x) => existentes.has(x.ficha.sku)).length,
    errores: errores.slice(0, 200),
    totalErrores: errores.length,
    moneda: t.moneda,
  };
  if (!d.confirmar) return c.json({ ...resumen, guardado: false });
  const sentencias: D1PreparedStatement[] = [];
  for (const x of aGuardar) {
    const entrada = {
      ...x.ficha,
      ...(x.oferta ?? {
        precio: 0,
        disponible: true,
        existencias: null,
        precioOferta: null,
        pasillo: '',
      }),
    } as EntradaProducto;
    // Sin precio en la hoja, la oferta que ya tenía la tienda no se toca.
    const s = sentenciasProducto(t.db, t.id, entrada, nuevoId());
    sentencias.push(s[0]!, ...(x.oferta ? [s[1]!] : []));
  }
  for (let i = 0; i < sentencias.length; i += 80) await t.db.batch(sentencias.slice(i, i + 80));
  return c.json({ ...resumen, guardado: true });
});

// ───────────────────────── C-TIENDAS-VITRINA: lo que ve el cliente ─────────────────────────

/** Disponible hoy: activo, o agotado «por hoy» con su fecha ya pasada (vuelve solo). */
const DISPONIBLE_HOY =
  "(o.disponible = 1 OR (o.agotado_hasta IS NOT NULL AND o.agotado_hasta <= date('now')))";

const coordenada = z.coerce.number().min(-180).max(180).optional();

/** Solo donde el servicio está encendido (pruebas hoy; en producción cuando Richard abra el país). */
function exigirServicio(c: Parameters<typeof base>[0], servicio: string) {
  if (
    !tiposDeServicio(servicio).length ||
    !serviciosImplementados(entornoDe(c.req.url)).has(servicio)
  )
    throw new ErrorDatos('Este servicio llega muy pronto.', undefined, 404);
}

const aProductoPublico = (f: FilaProducto, idioma: 'es' | 'en') => {
  const precio = Number(f.precio_oferta ?? f.precio);
  return {
    id: f.id,
    nombre: idioma === 'en' ? f.nombre_en || f.nombre_es : f.nombre_es || f.nombre_en,
    nombreEs: f.nombre_es || f.nombre_en,
    nombreEn: f.nombre_en || f.nombre_es,
    marca: f.marca,
    tamano: f.tamano,
    unidadTamano: f.unidad_tamano,
    categoria: f.categoria1,
    imagen: f.imagen,
    vendidoPor: f.vendido_por,
    pesoPromedio: f.peso_promedio,
    unidadPeso: f.unidad_peso,
    restriccion: f.restriccion,
    precio,
    precioAntes: f.precio_oferta != null ? Number(f.precio) : null,
    precioEstimado: precioEstimado(precio, String(f.vendido_por), f.peso_promedio as number | null),
  };
};
const idiomaDe = (c: Parameters<typeof base>[0]) =>
  (c.req.header('x-idioma') ?? '').startsWith('es') ? 'es' : 'en';

/** Las tiendas de un servicio cerca de la persona, las abiertas y más cercanas primero. */
tiendas.get('/tiendas', async (c) => {
  const q = z
    .object({ servicio: z.string().max(20), lat: coordenada, lng: coordenada })
    .parse(c.req.query());
  exigirServicio(c, q.servicio);
  const db = base(c);
  const zona = await zonaPara(db, q.lat, q.lng);
  if (!zona) return c.json({ tiendas: [], fueraDeZona: true });
  const tipos = tiposDeServicio(q.servicio);
  const { results } = await db
    .prepare(
      `SELECT r.*, (SELECT COUNT(*) FROM catalogo_ofertas o WHERE o.comercio_id = r.id AND ${DISPONIBLE_HOY}) AS productos
         FROM restaurantes r
        WHERE r.zona_id = ?1 AND r.estado = 'aprobado'
          AND r.tipo_comercio IN (SELECT value FROM json_each(?2))
          AND (NOT EXISTS (SELECT 1 FROM areas WHERE zona_id = ?1 AND estado <> 'borrador')
               OR r.area_id IN (SELECT id FROM areas WHERE zona_id = ?1 AND estado = 'activa'))`,
    )
    .bind(zona.id, JSON.stringify(tipos))
    .all<Record<string, unknown>>();
  const minutos = await minutosPausa(db);
  const lista = (
    await conHorarios(
      db,
      results.filter((r) => Number(r.productos) > 0),
    )
  )
    .map((f) => {
      const r = aRestaurante(f, minutos);
      return {
        id: r.id,
        nombre: r.nombre,
        direccion: r.direccion,
        imagen: r.imagen,
        tipo: String(f.tipo_comercio),
        abierto: r.abiertoAhora,
        productos: Number(f.productos),
        minutos: r.tiempoPrepMin + 15,
        distanciaKm:
          q.lat != null && q.lng != null && r.lat != null && r.lng != null
            ? Math.round(distanciaKm({ lat: q.lat, lng: q.lng }, { lat: r.lat, lng: r.lng }) * 10) /
              10
            : null,
      };
    })
    .sort(
      (a, b) =>
        Number(b.abierto) - Number(a.abierto) || (a.distanciaKm ?? 999) - (b.distanciaKm ?? 999),
    );
  return c.json({ tiendas: lista, fueraDeZona: false });
});

async function tiendaPublica(c: Parameters<typeof base>[0], id: string) {
  const db = base(c);
  const t = await db
    .prepare(
      `SELECT id, nombre, direccion, lat, lng, imagen, abierto, tipo_comercio, plan, zona_id
         FROM restaurantes WHERE id = ? AND estado = 'aprobado' AND tipo_comercio <> 'restaurante'`,
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!t) throw new ErrorDatos('Esa tienda no existe.', undefined, 404);
  exigirServicio(c, servicioDe(String(t.tipo_comercio)));
  return { db, t };
}
const servicioDe = (tipo: string) =>
  (['mercado', 'farmacia', 'licores', 'mas'] as const).find((s) =>
    tiposDeServicio(s).includes(tipo as never),
  ) ?? 'mas';

/** La tienda con sus pasillos (categorías con productos disponibles). */
tiendas.get('/tiendas/:id', async (c) => {
  const { db, t } = await tiendaPublica(c, c.req.param('id'));
  const { moneda } = await paisDeZona(db, String(t.zona_id ?? ''));
  const pasillos = await db
    .prepare(
      `SELECT p.categoria1 AS nombre, COUNT(*) AS n FROM catalogo_productos p
         JOIN catalogo_ofertas o ON o.producto_id = p.id AND o.comercio_id = p.comercio_id
        WHERE p.comercio_id = ? AND ${DISPONIBLE_HOY} AND p.restriccion <> 'prescription'
        GROUP BY p.categoria1 ORDER BY p.categoria1`,
    )
    .bind(t.id)
    .all<{ nombre: string; n: number }>();
  return c.json({
    tienda: {
      id: t.id,
      nombre: t.nombre,
      direccion: t.direccion,
      lat: t.lat,
      lng: t.lng,
      imagen: t.imagen,
      tipo: t.tipo_comercio,
      abierto: Number(t.abierto) === 1,
      plan: t.plan,
      moneda,
    },
    pasillos: pasillos.results,
  });
});

/** Los productos disponibles de la tienda, por pasillo o buscando, de 50 en 50. */
tiendas.get('/tiendas/:id/productos', async (c) => {
  const { db, t } = await tiendaPublica(c, c.req.param('id'));
  const q = esquemaBusqueda.parse(c.req.query());
  const donde = ['p.comercio_id = ?', DISPONIBLE_HOY, "p.restriccion <> 'prescription'"];
  const valores: unknown[] = [t.id];
  if (q.q) {
    const patron = `%${q.q.replace(/[\\%_]/g, (x) => `\\${x}`)}%`;
    donde.push(
      "(p.nombre_es LIKE ? ESCAPE '\\' OR p.nombre_en LIKE ? ESCAPE '\\' OR p.marca LIKE ? ESCAPE '\\' OR p.codigo_barras = ?)",
    );
    valores.push(patron, patron, patron, q.q);
  }
  if (q.categoria) {
    donde.push('p.categoria1 = ?');
    valores.push(q.categoria);
  }
  const { results } = await db
    .prepare(
      `SELECT p.*, o.precio, o.precio_oferta FROM catalogo_productos p
         JOIN catalogo_ofertas o ON o.producto_id = p.id AND o.comercio_id = p.comercio_id
        WHERE ${donde.join(' AND ')}
        ORDER BY p.categoria1, COALESCE(NULLIF(p.nombre_es, ''), p.nombre_en) LIMIT ? OFFSET ?`,
    )
    .bind(...valores, PAGINA + 1, (q.pagina - 1) * PAGINA)
    .all<FilaProducto>();
  const idioma = idiomaDe(c);
  return c.json({
    productos: results.slice(0, PAGINA).map((f) => aProductoPublico(f, idioma)),
    hayMas: results.length > PAGINA,
    pagina: q.pagina,
  });
});

/** Búsqueda entre tiendas cercanas del servicio: dónde está el producto, la tienda más cerca primero. */
tiendas.get('/tiendas-buscar', async (c) => {
  const q = z
    .object({
      servicio: z.string().max(20),
      q: z.string().trim().min(2).max(80),
      lat: coordenada,
      lng: coordenada,
    })
    .parse(c.req.query());
  exigirServicio(c, q.servicio);
  const db = base(c);
  const zona = await zonaPara(db, q.lat, q.lng);
  if (!zona) return c.json({ resultados: [] });
  const patron = `%${q.q.replace(/[\\%_]/g, (x) => `\\${x}`)}%`;
  const { results } = await db
    .prepare(
      `SELECT p.*, o.precio, o.precio_oferta, r.nombre AS tienda, r.lat AS tlat, r.lng AS tlng, r.abierto
         FROM catalogo_productos p
         JOIN catalogo_ofertas o ON o.producto_id = p.id AND o.comercio_id = p.comercio_id
         JOIN restaurantes r ON r.id = p.comercio_id
        WHERE r.zona_id = ? AND r.estado = 'aprobado'
          AND r.tipo_comercio IN (SELECT value FROM json_each(?))
          AND ${DISPONIBLE_HOY} AND p.restriccion <> 'prescription'
          AND (p.nombre_es LIKE ? ESCAPE '\\' OR p.nombre_en LIKE ? ESCAPE '\\' OR p.marca LIKE ? ESCAPE '\\' OR p.codigo_barras = ?)
        LIMIT 200`,
    )
    .bind(zona.id, JSON.stringify(tiposDeServicio(q.servicio)), patron, patron, patron, q.q)
    .all<FilaProducto>();
  const idioma = idiomaDe(c);
  const resultados = results
    .map((f) => ({
      ...aProductoPublico(f, idioma),
      tiendaId: f.comercio_id,
      tienda: f.tienda,
      abierto: Number(f.abierto) === 1,
      distanciaKm:
        q.lat != null && q.lng != null && f.tlat != null && f.tlng != null
          ? Math.round(
              distanciaKm(
                { lat: q.lat, lng: q.lng },
                { lat: Number(f.tlat), lng: Number(f.tlng) },
              ) * 10,
            ) / 10
          : null,
    }))
    .sort(
      (a, b) =>
        Number(b.abierto) - Number(a.abierto) ||
        (a.distanciaKm ?? 999) - (b.distanciaKm ?? 999) ||
        a.precio - b.precio,
    )
    .slice(0, 40);
  const { moneda } = await paisDeZona(db, zona.id);
  return c.json({ resultados, moneda });
});

/**
 * C-TIENDAS-COMPRA: las líneas de un pedido a una tienda, sacadas de SU catálogo y nunca de la app.
 * Precio de la oferta (o el rebajado), agotados fuera, pesables al peso estimado (el ajuste final es
 * el de «quitar o cambiar un producto» de siempre), alcohol y tabaco exigen edad al entregar, y cada
 * línea lleva lo que el cliente quiere si falta (por defecto, reembolsar).
 */
export async function lineasDeTienda(
  c: Parameters<typeof base>[0],
  rest: Record<string, unknown>,
  pedidas: { platoId: string; cantidad: number; sustitucion?: Sustitucion }[],
) {
  exigirServicio(c, servicioDe(String(rest.tipo_comercio)));
  const ids = [...new Set(pedidas.map((l) => l.platoId))];
  const { results } = await base(c)
    .prepare(
      `SELECT p.*, o.precio, o.precio_oferta FROM catalogo_productos p
         JOIN catalogo_ofertas o ON o.producto_id = p.id AND o.comercio_id = p.comercio_id
        WHERE p.comercio_id = ? AND ${DISPONIBLE_HOY} AND p.restriccion <> 'prescription'
          AND p.id IN (SELECT value FROM json_each(?))`,
    )
    .bind(rest.id, JSON.stringify(ids))
    .all<FilaProducto>();
  const porId = new Map(results.map((f) => [String(f.id), f]));
  return pedidas.map((l) => {
    const f = porId.get(l.platoId);
    if (!f)
      throw new ErrorDatos(
        'Uno de los productos ya no está disponible. Revisa tu carrito.',
        'lineas',
        409,
      );
    const precio = Number(f.precio_oferta ?? f.precio);
    return {
      platoId: l.platoId,
      nombreEs: String(f.nombre_es || f.nombre_en),
      nombreEn: String(f.nombre_en || f.nombre_es),
      precioCentavos: precioEstimado(
        precio,
        String(f.vendido_por),
        f.peso_promedio as number | null,
      ),
      cantidad: l.cantidad,
      opciones: [],
      requiereEdad: f.restriccion === 'alcohol' || f.restriccion === 'tobacco',
      sustitucion: l.sustitucion ?? 'reembolsar',
      ...(f.vendido_por === 'weight' ? { pesable: true, unidadPeso: f.unidad_peso } : {}),
      imagen: f.imagen ?? null,
    };
  });
}

// ───────────────────── C-TIENDAS-CODIGO: rellenar la ficha con el código de barras ─────────────────────

/**
 * Busca el producto en Open Food Facts (base abierta, licencia ODbL; las fotos, CC BY-SA) por el
 * servidor, para que la tienda no escriba lo que ya existe. Solo rellena: la tienda revisa y guarda.
 * Si Open Food Facts no responde o no lo conoce, se dice y se sigue escribiendo a mano.
 */
tiendas.get('/mi-restaurante/productos/codigo/:codigo', async (c) => {
  await miComercio(c, 'staff');
  const codigo = c.req.param('codigo').replace(/\D/g, '');
  if (!codigoBarrasValido(codigo))
    throw new ErrorDatos('Ese código de barras no es válido.', 'codigoBarras', 422);
  let r: Response;
  try {
    r = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${codigo}.json?fields=product_name,product_name_es,product_name_en,brands,quantity,image_front_url`,
      { headers: { 'user-agent': 'Divoox/1.0 (soporte@divoox.com)' } },
    );
  } catch (e) {
    console.error('codigo de barras: Open Food Facts no responde', e);
    throw new ErrorDatos('No pudimos buscar ese código ahora. Escríbelo a mano.', undefined, 503);
  }
  const d = (await r.json().catch(() => ({}))) as {
    status?: number;
    product?: Record<string, string | undefined>;
  };
  if (!r.ok || d.status !== 1 || !d.product)
    return c.json({ encontrado: false, fuente: 'Open Food Facts' });
  const p = d.product;
  // «500 ml», «1 L», «12 oz»: número y unidad, si se entienden.
  const cantidad = /^([\d.,]+)\s*([a-zA-Z ]+)$/.exec(String(p.quantity ?? '').trim());
  const imagen = String(p.image_front_url ?? '');
  return c.json({
    encontrado: true,
    fuente: 'Open Food Facts',
    nombreEs: p.product_name_es || '',
    nombreEn: p.product_name_en || p.product_name || '',
    marca:
      String(p.brands ?? '')
        .split(',')[0]
        ?.trim() ?? '',
    tamano: cantidad ? cantidad[1]!.replace(',', '.') : '',
    unidad:
      (cantidad &&
        UNIDADES_TAMANO.find((u) => u.toLowerCase() === cantidad[2]!.trim().toLowerCase())) ||
      '',
    imagen: imagen.startsWith('https://') ? imagen : '',
  });
});
