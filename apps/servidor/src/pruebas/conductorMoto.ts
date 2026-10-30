import type { mundo } from './ayuda';

type Mundo = ReturnType<typeof mundo>;
let seq = 0;
const id = (p: string) => `${p}-${++seq}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Un conductor de Moto con todo en regla (vehículo aprobado, documentos vigentes, habilitado,
 * conectado y ubicado en `donde`), para las pruebas de viajes de punta a punta. Los requisitos de
 * Moto se quitan de ESA base de prueba: aquí se prueba el viaje, no el alta del conductor.
 */
export async function conductorDeMoto(
  m: Mundo,
  donde: { lat: number; lng: number },
  zona = 'US-FL-MIAMI',
  servicio: 'moto' | 'carro' = 'moto',
) {
  const q = (sql: string, ...v: unknown[]) =>
    m.DB.prepare(sql)
      .bind(...v)
      .run();
  const c = await m.cuenta('repartidor', 'Conductor Moto');
  const admin = await m.cuenta('admin', 'Soporte Revisión');
  const v = id('veh');
  await q('DELETE FROM servicio_requisitos WHERE servicio_id = ?', servicio);
  await q(
    "INSERT INTO repartidores (usuario_id, conectado, lat, lng, ubicacion_en, zona_id) VALUES (?, 1, ?, ?, datetime('now'), ?) ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, lat = excluded.lat, lng = excluded.lng, ubicacion_en = excluded.ubicacion_en",
    c.id,
    donde.lat,
    donde.lng,
    zona,
  );
  await q(
    "INSERT INTO vehiculos (id, conductor_id, tipo, marca, modelo, color, placa, placa_estado, anio, plazas, estado) VALUES (?, ?, ?, ?, ?, 'Negro', ?, 'FL', 2022, ?, 'aprobado')",
    v,
    c.id,
    servicio,
    servicio === 'carro' ? 'Toyota' : 'Yamaha',
    servicio === 'carro' ? 'Corolla' : 'NMAX',
    `M${seq}${Math.floor(Math.random() * 1e6)}`,
    servicio === 'carro' ? 4 : 1,
  );
  for (const t of ['registro', 'seguro', 'seguro_pasajeros'])
    await q(
      "INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave, estado, vence_en) VALUES (?, ?, ?, 'doc', 'aprobado', datetime('now', '+1 year'))",
      id('doc'),
      v,
      t,
    );
  await q('UPDATE repartidores SET vehiculo_activo_id = ? WHERE usuario_id = ?', v, c.id);
  await q(
    "INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por, aprobado_en) VALUES (?, ?, 'aprobada', ?, datetime('now'))",
    c.id,
    servicio,
    admin.id,
  );
  await q(
    'INSERT INTO preferencias_servicio (conductor_id, servicio_id, activa) VALUES (?, ?, 1)',
    c.id,
    servicio,
  );
  /** Un paso del conductor con su clave de idempotencia (la app manda una nueva por acción). */
  let n = 0;
  const paso = async (operacion: string, nombre: string, cuerpo: unknown = {}) => {
    n++;
    const r = await m.crudo(`/datos/conductor/operaciones/${operacion}/${nombre}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${c.token}`,
        'content-type': 'application/json',
        'idempotency-key': `clave-${nombre}-${n}-conductor`,
      },
      body: JSON.stringify(cuerpo),
    });
    return r.status;
  };
  return { ...c, vehiculo: v, paso };
}
