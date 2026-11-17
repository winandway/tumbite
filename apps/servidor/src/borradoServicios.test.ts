import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { crearAlmacenPruebas } from './pruebas/r2';

/**
 * C-BORRADO-SERVICIOS (16 nov 2026) — todos los países (encendido hoy en Venezuela). Al borrar la
 * cuenta se borra lo que dejan los viajes, los envíos, las fotos de entrega, el cobro del conductor,
 * la selfie con casco y la respuesta pública del restaurante. Antes `borrarCuenta` solo miraba los
 * pedidos de comida: el origen y destino de los viajes, los contactos de confianza, los datos de
 * quien recibe un envío, las fotos de entrega con su GPS, el pago móvil del conductor y la selfie
 * seguían guardados. Google Play (Account deletion: «delete the user data associated with that app
 * account») lo dio NO APTO el 16 nov. Tampoco se puede borrar con un viaje en curso.
 */

type Fila = Record<string, unknown>;

async function preparar() {
  const almacen = crearAlmacenPruebas();
  const m = mundo({ BUCKET: almacen.bucket });
  const sql = (s: string, ...v: unknown[]) =>
    m.DB.prepare(s)
      .bind(...v)
      .run();
  const filas = async (s: string, ...v: unknown[]) =>
    (
      await m.DB.prepare(s)
        .bind(...v)
        .all<Fila>()
    ).results;
  await sql('PRAGMA foreign_keys = OFF');
  const pedido = (id: string, cliente: string, restaurante: string, repartidor: string | null) =>
    sql(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal,
         envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor,
         complemento, ganancia, plan, direccion)
       VALUES (?, ?, ?, ?, 'entregado', '[]', 1000, 100, 0, 0, 0, 1100, 0, 0, 0, 0, 0, 'basico', 'Calle 5')`,
      id,
      cliente,
      restaurante,
      repartidor,
    );
  return { almacen, m, sql, filas, pedido };
}

describe('borrar la cuenta borra los datos de viajes, envíos y fotos de entrega', () => {
  it('pasajero: origen, destino, paradas, contactos, destinatario, fotos y su GPS', async () => {
    const { almacen, m, sql, filas, pedido } = await preparar();
    const cli = await m.cuenta('cliente');
    const otro = await m.cuenta('cliente');
    for (const [op, cliente, tipo] of [
      ['op-v', cli.id, 'viaje_pasajero'],
      ['op-e', cli.id, 'envio_paquete'],
      ['op-otro', otro.id, 'viaje_pasajero'],
    ] as const)
      await sql(
        `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general)
         VALUES (?, 'moto', ?, ?, 'z', 'terminada')`,
        op,
        tipo,
        cliente,
      );
    for (const op of ['op-v', 'op-otro'])
      await sql(
        `INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng,
           origen_direccion, destino_lat, destino_lng, destino_direccion, pin_recogida)
         VALUES (?, 'terminado', 'sistema', 'k', 8.6, -71.6, 'Calle 5 casa 12', 8.7, -71.7, 'Liceo Central', '1234')`,
        op,
      );
    await sql(
      "INSERT INTO paradas_viaje (operacion_id, orden, lat, lng, direccion) VALUES ('op-v', 1, 8.65, -71.65, 'Casa de la abuela')",
    );
    await sql(
      "INSERT INTO viajes_compartidos (huella, operacion_id, creado_por) VALUES ('h1', 'op-v', ?)",
      cli.id,
    );
    await sql(
      "INSERT INTO contactos_confianza (id, cliente_id, nombre, telefono) VALUES ('cc1', ?, 'Mamá', '+584140000000')",
      cli.id,
    );
    await almacen.bucket.put('envios/op-e/recogida-1', new Uint8Array([1]));
    await almacen.bucket.put('envios/op-e/entrega-1', new Uint8Array([2]));
    await sql(
      `INSERT INTO envios_persona (operacion_id, descripcion, valor_declarado, destinatario_nombre,
         destinatario_telefono, pin_entrega, foto_recogida, foto_entrega)
       VALUES ('op-e', 'Llaves', 0, 'Luis Pérez', '+584141111111', '5678', 'envios/op-e/recogida-1', 'envios/op-e/entrega-1')`,
    );
    await sql(
      "INSERT INTO fotos_gps (clave, lat, lng) VALUES ('envios/op-e/entrega-1', 8.61, -71.61)",
    );
    // Un pedido de comida suyo ya entregado, con sus fotos de recogida y entrega.
    await pedido('ped-1', cli.id, 'r1', null);
    await almacen.bucket.put('evidencias/ped-1/entrega-1', new Uint8Array([3]));
    await sql(
      "INSERT INTO evidencias (pedido_id, tipo, clave, lat, lng, nota) VALUES ('ped-1', 'entrega', 'evidencias/ped-1/entrega-1', 8.6, -71.6, 'Detrás de la reja')",
    );
    await sql(
      "INSERT INTO fotos_gps (clave, lat, lng) VALUES ('evidencias/ped-1/entrega-1', 8.6, -71.6)",
    );
    await sql("INSERT INTO fotos_entrega_publicas (token, pedido_id) VALUES ('t1', 'ped-1')");

    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, cli.token)).estado).toBe(200);

    const [v] = await filas(
      "SELECT origen_direccion, destino_direccion, origen_lat, destino_lng FROM viajes WHERE operacion_id = 'op-v'",
    );
    expect(v).toEqual({
      origen_direccion: 'Dirección borrada',
      destino_direccion: 'Dirección borrada',
      origen_lat: 0,
      destino_lng: 0,
    });
    const [p] = await filas("SELECT direccion, lat FROM paradas_viaje WHERE operacion_id = 'op-v'");
    expect(p).toEqual({ direccion: 'Dirección borrada', lat: 0 });
    expect(await filas('SELECT 1 FROM viajes_compartidos WHERE creado_por = ?', cli.id)).toEqual(
      [],
    );
    expect(await filas('SELECT 1 FROM contactos_confianza WHERE cliente_id = ?', cli.id)).toEqual(
      [],
    );
    const [e] = await filas(
      "SELECT descripcion, destinatario_nombre, destinatario_telefono, foto_recogida, foto_entrega FROM envios_persona WHERE operacion_id = 'op-e'",
    );
    expect(e).toEqual({
      descripcion: '',
      destinatario_nombre: '',
      destinatario_telefono: '',
      foto_recogida: null,
      foto_entrega: null,
    });
    const [ev] = await filas(
      "SELECT clave, lat, lng, nota FROM evidencias WHERE pedido_id = 'ped-1'",
    );
    expect(ev).toEqual({ clave: '', lat: null, lng: null, nota: '' });
    expect(await filas('SELECT clave FROM fotos_gps')).toEqual([]);
    expect(await filas("SELECT 1 FROM fotos_entrega_publicas WHERE pedido_id = 'ped-1'")).toEqual(
      [],
    );
    for (const k of [
      'envios/op-e/recogida-1',
      'envios/op-e/entrega-1',
      'evidencias/ped-1/entrega-1',
    ])
      expect(almacen.datos.has(k)).toBe(false);
    // El viaje de la otra persona no se toca.
    const [ajeno] = await filas(
      "SELECT origen_direccion FROM viajes WHERE operacion_id = 'op-otro'",
    );
    expect(ajeno?.origen_direccion).toBe('Calle 5 casa 12');
  });

  it('conductor: cuenta de pago móvil, selfie con casco y las fotos que tomó', async () => {
    const { almacen, m, sql, filas, pedido } = await preparar();
    const rep = await m.cuenta('repartidor');
    await sql(
      `INSERT INTO cuentas_cobro (id, usuario_id, pais, moneda, tipo, banco, titular, identificador)
       VALUES ('cc-1', ?, 'VE', 'VES', 'pago_movil', 'Banco de Venezuela', 'José Ruiz', '04140000000')`,
      rep.id,
    );
    await almacen.bucket.put(`casco/${rep.id}/s1`, new Uint8Array([1]));
    await sql(
      "INSERT INTO selfies_casco (id, usuario_id, clave) VALUES ('s1', ?, ?)",
      rep.id,
      `casco/${rep.id}/s1`,
    );
    await pedido('ped-2', 'c-x', 'r1', rep.id);
    await almacen.bucket.put('evidencias/ped-2/recogida-1', new Uint8Array([2]));
    await sql(
      "INSERT INTO evidencias (pedido_id, tipo, clave, lat, lng) VALUES ('ped-2', 'recogida', 'evidencias/ped-2/recogida-1', 8.6, -71.6)",
    );

    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, rep.token)).estado).toBe(200);

    const [c] = await filas(
      "SELECT banco, titular, identificador, activa FROM cuentas_cobro WHERE id = 'cc-1'",
    );
    expect(c).toEqual({ banco: '', titular: 'Cuenta borrada', identificador: '', activa: 0 });
    expect(await filas('SELECT 1 FROM selfies_casco WHERE usuario_id = ?', rep.id)).toEqual([]);
    expect(almacen.datos.has(`casco/${rep.id}/s1`)).toBe(false);
    const [ev] = await filas("SELECT clave, lat FROM evidencias WHERE pedido_id = 'ped-2'");
    expect(ev).toEqual({ clave: '', lat: null });
    expect(almacen.datos.has('evidencias/ped-2/recogida-1')).toBe(false);
  });

  it('restaurante: se vacían sus respuestas públicas a las reseñas', async () => {
    const { m, sql, filas, pedido } = await preparar();
    const res = await m.cuenta('restaurante');
    await sql(
      "INSERT OR IGNORE INTO restaurantes (id, dueno_id, nombre) VALUES ('r-borrar', ?, 'Local')",
      res.id,
    );
    const [r] = await filas('SELECT id FROM restaurantes WHERE dueno_id = ?', res.id);
    await pedido('ped-3', 'c-x', String(r?.id), null);
    await sql(
      "INSERT INTO calificaciones (pedido_id, comentario, respuesta) VALUES ('ped-3', 'Rico', 'Gracias, Ana, te esperamos')",
    );

    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, res.token)).estado).toBe(200);

    const [cal] = await filas(
      "SELECT comentario, respuesta FROM calificaciones WHERE pedido_id = 'ped-3'",
    );
    expect(cal).toEqual({ comentario: 'Rico', respuesta: null });
  });

  it('con un viaje en curso no deja borrar la cuenta (409)', async () => {
    for (const [rol, col] of [
      ['cliente', 'cliente_id'],
      ['repartidor', 'conductor_id'],
    ] as const) {
      const { m, sql } = await preparar();
      const u = await m.cuenta(rol);
      await sql(
        `INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, conductor_id, vehiculo_id, zona_id, estado_general)
         VALUES ('op-vivo', 'moto', 'viaje_pasajero', ?, ?, 'veh', 'z', 'en_curso')`,
        col === 'cliente_id' ? u.id : 'c-x',
        col === 'conductor_id' ? u.id : 'd-x',
      );
      const r = await m.llamar('DELETE', '/datos/cuentas/yo', undefined, u.token);
      expect(r.estado).toBe(409);
    }
  });
});
