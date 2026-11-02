import { aPedido } from './rutas/pedidos';
import { nuevoId } from './cripto';
import { ErrorDatos } from './validar';

/**
 * C-PEDIDO-PRUEBA (BRE-4, 2 nov 2026), como «Create test order» de DoorDash Merchant: un pedido
 * ficticio para que el restaurante practique aceptar, marcar listo y ver el ticket. Vive en su
 * PROPIA tabla (`pedidos_prueba`), nunca en `pedidos`: así queda fuera por construcción de la
 * conciliación, los informes, el embudo, el despacho de repartidores, el Manager, los cobros y
 * cualquier consulta futura sobre pedidos. Sin cobro, sin repartidor, sin cliente. Todos los países.
 * Ficha: docs/investigaciones-rea/2026-11-02-elogios-y-pedido-prueba.md.
 */
export const PREFIJO_PRUEBA = 'prueba-';

/** Pedidos de prueba que un restaurante puede enviarse en un día. */
export const PRUEBAS_POR_DIA = 10;
export const esPedidoPrueba = (id: string) => id.startsWith(PREFIJO_PRUEBA);

type FilaPrueba = {
  id: string;
  estado: string;
  restaurante_id: string;
  lineas_json: string;
  subtotal: number;
  moneda: string;
  tiempo_prep_min: number | null;
  creado_en: string;
  aceptado_en: string | null;
  listo_en: string | null;
  terminado_en: string | null;
};

/** El pedido de prueba con la misma forma que uno real (para que el panel y la app lo pinten). */
function aPedidoPrueba(f: FilaPrueba) {
  return {
    ...aPedido({
      ...f,
      // «terminado» se muestra como el final normal del recorrido.
      estado: f.estado === 'terminado' ? 'entregado' : f.estado,
      envio: 0,
      servicio: 0,
      cargo_pequeno: 0,
      propina: 0,
      regalo: 0,
      total: f.subtotal,
      direccion: '',
      notas: '',
      pagado_en: f.creado_en,
      entregado_en: f.terminado_en,
      metodo_pago: 'tarjeta',
    }),
    prueba: true as const,
    repartidor: null,
  };
}

/** Los de prueba para la lista del restaurante: los abiertos y los cerrados del último día. */
export async function pedidosPrueba(db: D1Database, rid: string) {
  const { results } = await db
    .prepare(
      `SELECT * FROM pedidos_prueba WHERE restaurante_id = ?
        AND (estado IN ('pagado','aceptado','listo') OR creado_en > datetime('now','-1 day'))
        ORDER BY creado_en DESC LIMIT 10`,
    )
    .bind(rid)
    .all<FilaPrueba>();
  return results.map(aPedidoPrueba);
}

/** Arma uno con hasta dos platos del menú elegidos al azar (como DoorDash). Uno abierto a la vez. */
export async function crearPedidoPrueba(db: D1Database, rid: string, usuarioId: string) {
  const abierto = await db
    .prepare(
      "SELECT 1 FROM pedidos_prueba WHERE restaurante_id = ? AND estado IN ('pagado','aceptado','listo')",
    )
    .bind(rid)
    .first();
  if (abierto)
    throw new ErrorDatos(
      'Ya tienes un pedido de prueba abierto. Termínalo o recházalo antes de pedir otro.',
      undefined,
      409,
    );
  // BRE-R: tope diario, para que un botón de práctica no llene la lista ni la base.
  const hoy = await db
    .prepare(
      "SELECT COUNT(*) AS n FROM pedidos_prueba WHERE restaurante_id = ? AND creado_en > datetime('now','-1 day')",
    )
    .bind(rid)
    .first<{ n: number }>();
  if (Number(hoy?.n ?? 0) >= PRUEBAS_POR_DIA)
    throw new ErrorDatos(
      'Ya hiciste 10 pedidos de prueba hoy. Puedes enviarte otro mañana.',
      undefined,
      429,
    );
  const { results: platos } = await db
    .prepare(
      `SELECT id, nombre_es, nombre_en, precio_centavos FROM platos
        WHERE restaurante_id = ? AND eliminado = 0 AND disponible = 1 ORDER BY RANDOM() LIMIT 2`,
    )
    .bind(rid)
    .all<{ id: string; nombre_es: string; nombre_en: string; precio_centavos: number }>();
  if (!platos.length)
    throw new ErrorDatos(
      'Agrega al menos un plato disponible a tu menú para enviarte un pedido de prueba.',
      undefined,
      409,
    );
  const lineas = platos.map((p) => ({
    platoId: p.id,
    nombreEs: p.nombre_es,
    nombreEn: p.nombre_en || p.nombre_es,
    precioCentavos: Number(p.precio_centavos),
    cantidad: 1,
  }));
  const subtotal = lineas.reduce((s, l) => s + l.precioCentavos, 0);
  const z = await db
    .prepare(
      "SELECT COALESCE(z.moneda, 'USD') AS moneda FROM restaurantes r LEFT JOIN zonas z ON z.id = r.zona_id WHERE r.id = ?",
    )
    .bind(rid)
    .first<{ moneda: string }>();
  const id = `${PREFIJO_PRUEBA}${nuevoId()}`;
  await db
    .prepare(
      `INSERT INTO pedidos_prueba (id, restaurante_id, creado_por, estado, lineas_json, subtotal, moneda)
       VALUES (?, ?, ?, 'pagado', ?, ?, ?)`,
    )
    .bind(id, rid, usuarioId, JSON.stringify(lineas), subtotal, z?.moneda ?? 'USD')
    .run();
  const f = await db
    .prepare('SELECT * FROM pedidos_prueba WHERE id = ?')
    .bind(id)
    .first<FilaPrueba>();
  return aPedidoPrueba(f!);
}

const PASOS = new Map(
  Object.entries({
    aceptar: {
      desde: ['pagado'],
      hacia: 'aceptado',
      extra: ", aceptado_en = datetime('now'), tiempo_prep_min = ?",
    },
    listo: { desde: ['aceptado'], hacia: 'listo', extra: ", listo_en = datetime('now')" },
    terminar: { desde: ['listo'], hacia: 'terminado', extra: ", terminado_en = datetime('now')" },
    rechazar: {
      desde: ['pagado', 'aceptado'],
      hacia: 'cancelado',
      extra: ", terminado_en = datetime('now')",
    },
  }),
);
type Paso = 'aceptar' | 'listo' | 'terminar' | 'rechazar';

/** Avanza un pedido de prueba de ESTE restaurante. Nada de avisos, dinero ni repartidores. */
export async function avanzarPrueba(
  db: D1Database,
  rid: string,
  id: string,
  paso: Paso,
  minutos?: number,
) {
  const p = PASOS.get(paso)!;
  const r = await db
    .prepare(
      `UPDATE pedidos_prueba SET estado = ?${p.extra} WHERE id = ? AND restaurante_id = ? AND estado IN (${p.desde.map(() => '?').join(',')})`,
    )
    .bind(p.hacia, ...(paso === 'aceptar' ? [minutos ?? 15] : []), id, rid, ...p.desde)
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos('Este pedido ya cambió de estado. Actualiza la pantalla.', undefined, 409);
}
