import { Hono } from 'hono';
import { z } from 'zod';
import {
  RESTRICCIONES,
  RESTRICCIONES_BLOQUEADAS,
  TIPOS_COMERCIO,
  UNIDADES_TAMANO,
  codigoBarrasValido,
  leerPlanillaProductos,
} from '@tumbite/compartido';
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
        ORDER BY p.categoria1, p.nombre_es, p.nombre_en LIMIT ? OFFSET ?`,
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
  const r = leerPlanillaProductos(d.csv, idioma);
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
        idioma === 'en'
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
