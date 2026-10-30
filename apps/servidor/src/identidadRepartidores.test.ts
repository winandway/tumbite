import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * Pedido de Richard (29 oct 2026): saber de verdad quién reparte. C-FOTO-VERIFICADA (la selfie aprobada
 * contra el documento es la foto de perfil y no se cambia desde la app) y C-IDENTIDAD-UNICA (correo y
 * teléfono únicos de verdad, y los de cuentas cerradas por mala conducta no vuelven).
 */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

describe('foto verificada del repartidor (C-FOTO-VERIFICADA)', () => {
  it('aprobada, no se cambia desde la app; la ven él, el cliente de su pedido y el equipo; soporte la libera con motivo', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const rep = await m.cuenta('repartidor', 'Rafa Repartidor');
    const cliente = await m.cuenta('cliente');
    const otro = await m.cuenta('cliente');
    const subir = (pieza: string) =>
      m.crudo(`/datos/kyc/foto/${pieza}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${rep.token}`, 'content-type': 'image/png' },
        body: PNG as BodyInit,
      });
    expect((await subir('doc_frente')).status).toBe(201);
    expect((await subir('selfie')).status).toBe(201);
    await m.llamar('POST', '/datos/kyc/enviar', { docTipo: 'pasaporte' }, rep.token);
    expect(
      (await m.llamar('PATCH', `/datos/admin/kyc/${rep.id}`, { estado: 'aprobado' }, admin.token))
        .estado,
    ).toBe(200);
    // Ya aprobada: el repartidor no la puede reemplazar.
    expect((await subir('selfie')).status).toBe(409);
    const ver = (ruta: string, token: string) =>
      m.crudo(ruta, { headers: { authorization: `Bearer ${token}` } });
    expect((await ver('/datos/kyc/mi-foto', rep.token)).status).toBe(200);
    // Un pedido en curso con este repartidor: su cliente la ve, otro cliente no.
    const dueno = await m.cuenta('restaurante');
    const rid = (await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token))
      .datos.restaurante.id as string;
    const pid = crypto.randomUUID();
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision,
         pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, notas, zona_id, moneda)
       SELECT ?, ?, ?, ?, 'en_camino', '[]', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'inicial', '', '', 'US-FL-MIAMI', 'USD'`,
    )
      .bind(pid, cliente.id, rid, rep.id)
      .run();
    expect((await ver(`/datos/pedidos/${pid}/repartidor/foto`, cliente.token)).status).toBe(200);
    expect((await ver(`/datos/pedidos/${pid}/repartidor/foto`, otro.token)).status).toBe(404);
    const seg = await m.llamar(
      'GET',
      `/datos/pedidos/${pid}/seguimiento`,
      undefined,
      cliente.token,
    );
    expect(seg.datos.pedido.repartidor.foto).toBe(`/datos/pedidos/${pid}/repartidor/foto`);
    // Soporte la libera con motivo: vuelve a verificación y queda en el registro.
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/kyc/${rep.id}/liberar-foto`,
          { motivo: 'La foto salió borrosa' },
          admin.token,
        )
      ).estado,
    ).toBe(200);
    expect((await ver('/datos/kyc/mi-foto', rep.token)).status).toBe(404);
    expect((await subir('selfie')).status).toBe(201);
    expect(
      await m.DB.prepare(
        "SELECT accion FROM auditoria_admin WHERE objeto = 'kyc:' || ? AND accion = 'liberar_foto'",
      )
        .bind(rep.id)
        .first(),
    ).toEqual({ accion: 'liberar_foto' });
  });
});

describe('correo y teléfono únicos de verdad (C-IDENTIDAD-UNICA)', () => {
  const registrar = (
    m: ReturnType<typeof mundo>,
    correo: string,
    telefono?: string,
    rol = 'repartidor',
  ) =>
    m.llamar('POST', '/datos/cuentas/registro', {
      nombre: 'Persona Prueba',
      correo,
      clave: 'clave-segura-1',
      rol,
      ...(telefono ? { telefono } : {}),
    });

  it('el mismo correo o teléfono escrito de otra forma no abre otra cuenta', async () => {
    const m = mundo();
    expect((await registrar(m, 'juan.perez@gmail.com', '(305) 555-0100')).estado).toBe(201);
    expect((await registrar(m, 'JuanPerez+2@googlemail.com')).estado).toBe(409);
    const tel = await registrar(m, 'otra.persona@ejemplo.com', '+1 305 555 0100');
    expect(tel.estado).toBe(409);
    expect(tel.datos.campo ?? tel.datos.field ?? 'telefono').toBe('telefono');
    // Como cliente, el mismo teléfono sí puede pedir comida.
    expect((await registrar(m, 'cliente.aparte@ejemplo.com', '3055550100', 'cliente')).estado).toBe(
      201,
    );
  });

  it('cerrada por mala conducta: su correo y su teléfono no vuelven a entrar, de ninguna forma', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const r = await registrar(m, 'fraude.uno@gmail.com', '305-555-0199');
    const id = r.datos.usuario.id as string;
    expect(
      (
        await m.llamar(
          'PATCH',
          `/datos/admin/usuarios/${id}`,
          { activo: false, malaConducta: true, motivo: 'Robo de pedidos comprobado' },
          admin.token,
        )
      ).estado,
    ).toBe(200);
    await m.DB.prepare(
      "UPDATE usuarios SET correo = 'borrado-' || id, correo_canonico = NULL WHERE id = ?",
    )
      .bind(id)
      .run();
    expect((await registrar(m, 'Fraude.Uno+nuevo@gmail.com')).estado).toBe(403);
    expect((await registrar(m, 'cuenta.nueva@ejemplo.com', '(305) 555 0199')).estado).toBe(403);
    expect((await registrar(m, 'cuenta.limpia@ejemplo.com', '305 555 0123')).estado).toBe(201);
  });
});
