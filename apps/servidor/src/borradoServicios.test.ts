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

  it('segunda vuelta: cotizaciones, regalo, calificaciones, papeles, modo destino, cobro, empresa y soporte', async () => {
    const { almacen, m, sql, filas, pedido } = await preparar();
    const cli = await m.cuenta('cliente');
    const rep = await m.cuenta('repartidor');
    const res = await m.cuenta('restaurante');
    // Cliente: cotización de viaje, pedido como regalo, calificación de viaje y un ticket de soporte.
    await sql(
      `INSERT INTO cotizaciones_viaje (id, cliente_id, servicio_id, zona_id, tarifa_id, origen_lat, origen_lng,
         origen_direccion, destino_lat, destino_lng, destino_direccion, distancia_m, duracion_s, desglose_json,
         total, moneda, vence_en, paradas_json)
       VALUES ('cot-1', ?, 'moto', 'z', 't', 8.6, -71.6, 'Calle 5 casa 12', 8.7, -71.7, 'Liceo', 100, 60, '{}',
         500, 'USD', datetime('now'), '[{"direccion":"Casa de la abuela"}]')`,
      cli.id,
    );
    await pedido('ped-r', cli.id, 'r1', null);
    await sql(
      "UPDATE pedidos SET para_nombre = 'Ana', para_telefono = '+13135550000', para_mensaje = 'Feliz día' WHERE id = 'ped-r'",
    );
    await sql(
      "INSERT INTO calificaciones_viaje (operacion_id, de, autor_id, estrellas, comentario) VALUES ('op-c', 'pasajero', ?, 5, 'Muy amable')",
      cli.id,
    );
    await sql(
      `INSERT INTO tickets (id, codigo, tipo, nombre, correo, telefono, asunto, datos_json, usuario_id)
       VALUES ('tk-1', 'TK1', 'soporte', 'Ana Ruiz', 'ana@ejemplo.com', '+13135550000', 'Mi pedido', '{"x":1}', ?)`,
      cli.id,
    );
    // Conductor: licencia, modo destino, calificaciones que escribió y el historial de su cuenta de cobro.
    await almacen.bucket.put(`conductores/${rep.id}/doc.jpg`, new Uint8Array([1]));
    await sql(
      "INSERT INTO conductor_documentos (id, conductor_id, tipo, clave) VALUES ('cd-1', ?, 'antecedentes_penales', ?)",
      rep.id,
      `conductores/${rep.id}/doc.jpg`,
    );
    await sql(
      "INSERT INTO modo_destino (repartidor_id, direccion, lat, lng) VALUES (?, 'Mi casa, calle 9', 8.6, -71.6)",
      rep.id,
    );
    await sql(
      "INSERT INTO usos_modo_destino (repartidor_id, dia, usos) VALUES (?, '2026-11-16', 1)",
      rep.id,
    );
    await sql(
      "INSERT INTO calificaciones_viaje (operacion_id, de, autor_id, estrellas, comentario) VALUES ('op-c', 'conductor', ?, 4, 'Llegó tarde')",
      rep.id,
    );
    await sql(
      "INSERT INTO calificaciones_cliente (pedido_id, repartidor_id, cliente_id, estrellas, comentario) VALUES ('ped-r', ?, 'c-x', 3, 'No salió')",
      rep.id,
    );
    await sql(
      "INSERT INTO cuentas_cobro_historial (id, cuenta_id, usuario_id, cambio) VALUES ('h1', 'cc-x', ?, 'titular José Ruiz')",
      rep.id,
    );
    // Restaurante: datos del dueño y del manager.
    await sql(
      "INSERT OR IGNORE INTO restaurantes (id, dueno_id, nombre) VALUES ('r-emp', ?, 'Local')",
      res.id,
    );
    const [r] = await filas('SELECT id FROM restaurantes WHERE dueno_id = ?', res.id);
    await sql(
      `INSERT INTO restaurante_empresa (restaurante_id, dueno_nombre, dueno_telefono, dueno_correo, manager_nombre,
         manager_telefono, manager_correo) VALUES (?, 'Luis', '+1313', 'l@ejemplo.com', 'Eva', '+1314', 'e@ejemplo.com')`,
      r?.id,
    );

    for (const u of [cli, rep, res])
      expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, u.token)).estado).toBe(200);

    const [cot] = await filas(
      "SELECT origen_direccion, destino_direccion, origen_lat, paradas_json FROM cotizaciones_viaje WHERE id = 'cot-1'",
    );
    expect(cot).toEqual({
      origen_direccion: 'Dirección borrada',
      destino_direccion: 'Dirección borrada',
      origen_lat: 0,
      paradas_json: '[]',
    });
    const [reg] = await filas(
      "SELECT para_nombre, para_telefono, para_mensaje FROM pedidos WHERE id = 'ped-r'",
    );
    expect(reg).toEqual({ para_nombre: '', para_telefono: '', para_mensaje: '' });
    expect(
      await filas("SELECT comentario FROM calificaciones_viaje WHERE comentario != ''"),
    ).toEqual([]);
    const [cc] = await filas(
      "SELECT comentario FROM calificaciones_cliente WHERE pedido_id = 'ped-r'",
    );
    expect(cc?.comentario).toBe('');
    const [tk] = await filas(
      "SELECT nombre, correo, telefono, datos_json FROM tickets WHERE id = 'tk-1'",
    );
    expect(tk).toEqual({
      nombre: 'Cuenta borrada',
      correo: `borrada-${cli.id}@tumbite.invalid`,
      telefono: '',
      datos_json: '{}',
    });
    const [doc] = await filas("SELECT clave FROM conductor_documentos WHERE id = 'cd-1'");
    expect(doc?.clave).toBe('');
    expect(almacen.datos.has(`conductores/${rep.id}/doc.jpg`)).toBe(false);
    expect(await filas('SELECT 1 FROM modo_destino WHERE repartidor_id = ?', rep.id)).toEqual([]);
    expect(await filas('SELECT 1 FROM usos_modo_destino WHERE repartidor_id = ?', rep.id)).toEqual(
      [],
    );
    const [h] = await filas("SELECT cambio FROM cuentas_cobro_historial WHERE id = 'h1'");
    expect(h?.cambio).toBe('');
    const [emp] = await filas(
      'SELECT dueno_nombre, dueno_telefono, dueno_correo, manager_nombre, manager_telefono, manager_correo FROM restaurante_empresa WHERE restaurante_id = ?',
      r?.id,
    );
    expect(Object.values(emp ?? {}).every((v) => v === '')).toBe(true);
  });

  it('tercera vuelta: apto, referencia y alergias, grupo, fotos de queja, invitaciones, Flex, accesibilidad y código', async () => {
    const { almacen, m, sql, filas, pedido } = await preparar();
    const cli = await m.cuenta('cliente');
    const rep = await m.cuenta('repartidor');
    await pedido('ped-t', cli.id, 'r1', null);
    await sql(
      "UPDATE pedidos SET apto = '3B', referencia = 'Frente al parque', alergias = 'Maní' WHERE id = 'ped-t'",
    );
    await sql(
      "INSERT INTO pedidos_grupo_items (id, grupo_id, participante_id, nombre, plato_id, cantidad) VALUES ('gi-1', 'g1', ?, 'Ana', 'p1', 1)",
      cli.id,
    );
    await sql(
      "INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto, usuario_id) VALUES ('tk-q', 'TKQ', 'queja', 'Ana', 'a@ejemplo.com', 'Queja', ?)",
      cli.id,
    );
    await almacen.bucket.put('quejas/tk-q/f1', new Uint8Array([1]));
    await sql(
      "INSERT INTO ticket_adjuntos (id, ticket_id, clave, nombre, tipo, bytes) VALUES ('ad-1', 'tk-q', 'quejas/tk-q/f1', 'foto.jpg', 'image/jpeg', 1)",
    );
    // Conductor: invitaciones (una aceptada y otra pendiente por su correo), Flex, accesibilidad y código.
    const [yo] = await filas('SELECT correo_canonico FROM usuarios WHERE id = ?', rep.id);
    await sql(
      `INSERT INTO invitaciones_conductor (id, empresa_id, nombre, telefono_canonico, correo_canonico, vinculo, token_hash, estado, usuario_id)
       VALUES ('ic-1', 'e1', 'José Ruiz', '+584140000000', 'jose@ejemplo.com', 'propio', 'h1', 'aceptada', ?)`,
      rep.id,
    );
    await sql(
      `INSERT INTO invitaciones_flota (id, restaurante_id, nombre, correo_canonico, telefono_canonico, token_hash)
       VALUES ('if-1', 'r1', 'José Ruiz', ?, '+584140000000', 'h2')`,
      yo?.correo_canonico,
    );
    await sql(
      "INSERT INTO rutas_flex (id, empresa_id, conductor_id, estado, conductor_lat, conductor_lng) VALUES ('rf-1', 'e1', ?, 'cancelada', 8.6, -71.6)",
      rep.id,
    );
    await sql('INSERT INTO accesibilidad_repartidor (usuario_id, auditiva) VALUES (?, 1)', rep.id);
    await sql(
      "INSERT INTO codigos_telefono (usuario_id, telefono, codigo_hash) VALUES (?, '+584140000000', 'x')",
      rep.id,
    );

    for (const u of [cli, rep])
      expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, u.token)).estado).toBe(200);

    const [p] = await filas("SELECT apto, referencia, alergias FROM pedidos WHERE id = 'ped-t'");
    expect(p).toEqual({ apto: '', referencia: '', alergias: '' });
    const [g] = await filas("SELECT nombre FROM pedidos_grupo_items WHERE id = 'gi-1'");
    expect(g?.nombre).toBe('—');
    expect(await filas("SELECT 1 FROM ticket_adjuntos WHERE ticket_id = 'tk-q'")).toEqual([]);
    expect(almacen.datos.has('quejas/tk-q/f1')).toBe(false);
    const inv = await filas(
      "SELECT nombre, telefono_canonico, correo_canonico FROM invitaciones_conductor WHERE id = 'ic-1' UNION ALL SELECT nombre, telefono_canonico, correo_canonico FROM invitaciones_flota WHERE id = 'if-1'",
    );
    expect(inv).toEqual([
      { nombre: '', telefono_canonico: null, correo_canonico: null },
      { nombre: '', telefono_canonico: null, correo_canonico: null },
    ]);
    const rf = await filas("SELECT conductor_lat, conductor_lng FROM rutas_flex WHERE id = 'rf-1'");
    expect(rf).toEqual([{ conductor_lat: null, conductor_lng: null }]);
    expect(
      await filas('SELECT 1 FROM accesibilidad_repartidor WHERE usuario_id = ?', rep.id),
    ).toEqual([]);
    expect(await filas('SELECT 1 FROM codigos_telefono WHERE usuario_id = ?', rep.id)).toEqual([]);
  });

  it('cuarta vuelta: la foto de una queja (datos_json.foto) y los adjuntos de un caso hallado por correo', async () => {
    const { almacen, m, sql, filas } = await preparar();
    const cli = await m.cuenta('cliente');
    const [yo] = await filas('SELECT correo FROM usuarios WHERE id = ?', cli.id);
    // Queja con foto, como la guarda la app (POST /datos/quejas/<ticket>/foto).
    await almacen.bucket.put('quejas/tk-f/f1', new Uint8Array([1]));
    await sql(
      `INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto, datos_json, usuario_id)
       VALUES ('tk-f', 'TKF', 'queja', 'Ana', 'otro@ejemplo.com', 'Queja', '{"foto":"quejas/tk-f/f1"}', ?)`,
      cli.id,
    );
    // Caso de soporte sin usuario, hallado solo por su correo, con un adjunto.
    await almacen.bucket.put('soporte/tk-c/a1', new Uint8Array([2]));
    await sql(
      "INSERT INTO tickets (id, codigo, tipo, nombre, correo, asunto) VALUES ('tk-c', 'TKC', 'soporte', 'Ana', ?, 'Ayuda')",
      yo?.correo,
    );
    await sql(
      "INSERT INTO ticket_adjuntos (id, ticket_id, clave, nombre, tipo, bytes) VALUES ('ad-c', 'tk-c', 'soporte/tk-c/a1', 'a.jpg', 'image/jpeg', 1)",
    );

    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, cli.token)).estado).toBe(200);

    expect(almacen.datos.has('quejas/tk-f/f1')).toBe(false);
    expect(await filas("SELECT 1 FROM ticket_adjuntos WHERE ticket_id = 'tk-c'")).toEqual([]);
    expect(almacen.datos.has('soporte/tk-c/a1')).toBe(false);
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

  // C-LEGALES-COHERENTES (18 nov 2026): el código de invitación lleva parte del nombre («EQUIPOLV2»)
  // y la página de borrar la cuenta dice que se borra.
  it('el código de invitación de la cuenta se borra con ella', async () => {
    const { m, sql, filas } = await preparar();
    const u = await m.cuenta('repartidor');
    await sql("INSERT INTO codigos_referido (usuario_id, codigo) VALUES (?, 'ANARUIZ7')", u.id);
    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, u.token)).estado).toBe(200);
    expect(await filas('SELECT codigo FROM codigos_referido WHERE usuario_id = ?', u.id)).toEqual(
      [],
    );
  });
});
