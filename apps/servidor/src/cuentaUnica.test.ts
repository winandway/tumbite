import { afterEach, describe, expect, it } from 'vitest';
import { notificar, usarTransporteAvisos } from './notificaciones';
import { mundo } from './pruebas/ayuda';

/**
 * C-CUENTA-UNICA (24 nov 2026, Richard; todos los países). Un conductor de Tucaní quiso pedir con su
 * correo y la app le dijo que creara otra cuenta con otro correo. Ahora UNA persona tiene UNA cuenta
 * con varios papeles (cliente, conductor y dueño de restaurantes), como Uber, DoorDash, DiDi e inDrive.
 * Ficha: docs/investigaciones-rea/2026-11-24-cuenta-unica.md.
 */
const CLAVE = 'clave-segura-1';
const app = (a: string, nueva = true) => ({
  'x-tumbite-app': `${a}/0.1.70 ios`,
  'x-idioma': 'es',
  ...(nueva ? { 'x-cuenta-unica': '1' } : {}),
});

async function preparar() {
  const m = mundo({});
  const nueva = async (rol: 'cliente' | 'repartidor' | 'restaurante', telefono?: string) => {
    const correo = `${rol}-${Math.random().toString(36).slice(2)}@ejemplo.com`;
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      { nombre: `Persona ${rol}`, correo, clave: CLAVE, rol, ...(telefono ? { telefono } : {}) },
      undefined,
      app(rol, false),
    );
    expect(r.estado).toBe(201);
    return { correo, id: r.datos.usuario.id as string, token: r.datos.token as string };
  };
  const entrar = (correo: string, cabeceras: Record<string, string>, extra = {}) =>
    m.llamar(
      'POST',
      '/datos/cuentas/entrar',
      { correo, clave: CLAVE, ...extra },
      undefined,
      cabeceras,
    );
  const yo = (token: string) => m.llamar('GET', '/datos/cuentas/yo', undefined, token);
  const cuantas = async () =>
    Number(
      (await m.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first<{ n: number }>())?.n ?? 0,
    );
  return { m, nueva, entrar, yo, cuantas };
}

describe('C-CUENTA-UNICA: la misma cuenta en la app de clientes y en Driver', () => {
  it('el conductor entra a la app de clientes: se le ofrece activar el papel, sin cuenta nueva, y Driver sigue', async () => {
    const p = await preparar();
    const conductor = await p.nueva('repartidor');
    const antes = await p.cuantas();
    const r = await p.entrar(conductor.correo, app('cliente'));
    expect(r.estado).toBe(409);
    expect(r.datos.codigo).toBe('papel_por_activar');
    // Sin la casilla de los términos de cliente no se activa nada.
    const sin = await p.entrar(conductor.correo, app('cliente'), { activarPapel: true });
    expect(sin.estado).toBe(422);
    const ok = await p.entrar(conductor.correo, app('cliente'), {
      activarPapel: true,
      aceptaTerminosPapel: true,
    });
    expect(ok.estado).toBe(200);
    expect(ok.datos.usuario.rol).toBe('cliente');
    expect(ok.datos.usuario.id).toBe(conductor.id);
    expect(await p.cuantas()).toBe(antes);
    // Su sesión de Driver sigue viva y sigue siendo de conductor; la nueva es de cliente.
    expect((await p.yo(conductor.token)).datos.usuario.rol).toBe('repartidor');
    expect((await p.yo(ok.datos.token)).datos.usuario.rol).toBe('cliente');
    // La segunda vez entra directo, sin volver a preguntar.
    const otra = await p.entrar(conductor.correo, app('cliente'));
    expect(otra.estado).toBe(200);
    expect(otra.datos.usuario.rol).toBe('cliente');
    // Y los términos de cada papel quedan aparte.
    const t = await p.m.DB.prepare(
      'SELECT group_concat(papel) AS p FROM (SELECT papel FROM terminos_papel WHERE usuario_id = ? ORDER BY papel)',
    )
      .bind(conductor.id)
      .first<{ p: string }>();
    expect(t?.p).toBe('cliente,repartidor');
  });

  it('el cliente abre Driver: empieza su registro de conductor con la misma cuenta y la app de clientes no se cierra', async () => {
    const p = await preparar();
    const cliente = await p.nueva('cliente');
    const r = await p.entrar(cliente.correo, app('repartidor'), {
      activarPapel: true,
      aceptaTerminosPapel: true,
    });
    expect(r.estado).toBe(200);
    expect(r.datos.usuario.rol).toBe('repartidor');
    const fila = await p.m.DB.prepare('SELECT rol FROM usuarios WHERE id = ?')
      .bind(cliente.id)
      .first<{ rol: string }>();
    expect(fila?.rol).toBe('repartidor');
    // La sesión de la app de clientes sigue siendo de cliente.
    expect((await p.yo(cliente.token)).datos.usuario.rol).toBe('cliente');
    // Volver a entrar a Driver cierra solo las sesiones de conductor (un conductor, un teléfono).
    const otra = await p.entrar(cliente.correo, app('repartidor'));
    expect(otra.estado).toBe(200);
    expect((await p.yo(r.datos.token)).estado).toBe(401);
    expect((await p.yo(cliente.token)).datos.usuario.rol).toBe('cliente');
  });

  it('las apps publicadas antes ven el aviso de siempre (C-ENTRAR-APP-EQUIVOCADA)', async () => {
    const p = await preparar();
    const conductor = await p.nueva('repartidor');
    const r = await p.entrar(conductor.correo, app('cliente', false), {
      activarPapel: true,
      aceptaTerminosPapel: true,
    });
    expect(r.estado).toBe(409);
    expect(r.datos.codigo).toBe('cuenta_de_otra_app');
  });

  it('registrarse en la app nueva con el correo que ya existe lleva a «Entrar»', async () => {
    const p = await preparar();
    const conductor = await p.nueva('repartidor');
    const r = await p.m.llamar(
      'POST',
      '/datos/cuentas/registro',
      { nombre: 'Persona', correo: conductor.correo, clave: CLAVE, rol: 'cliente' },
      undefined,
      app('cliente'),
    );
    expect(r.estado).toBe(409);
    expect(r.datos.codigo).toBe('correo_con_cuenta');
    expect(r.datos.error).toContain('usa tu misma contraseña');
  });

  it('Divoox Restaurants no cambia: una cuenta de cliente sigue sin entrar ahí, y la del restaurante entra como hoy', async () => {
    const p = await preparar();
    const cliente = await p.nueva('cliente');
    const r = await p.entrar(cliente.correo, app('restaurante'), {
      activarPapel: true,
      aceptaTerminosPapel: true,
      cuentaUnica: true,
    });
    expect(r.estado).toBe(409);
    expect(r.datos.codigo).toBe('cuenta_de_otra_app');
    const cocina = await p.nueva('restaurante');
    const propia = await p.entrar(cocina.correo, app('restaurante'));
    expect(propia.estado).toBe(200);
    expect(propia.datos.usuario.rol).toBe('restaurante');
  });
});

describe('C-CUENTA-UNICA-AUTOVIAJE: nadie se ofrece, lleva ni califica lo suyo', () => {
  it('la base frena la oferta, la asignación, la calificación y la confianza de uno mismo', async () => {
    const p = await preparar();
    const yo = await p.nueva('repartidor');
    const otro = await p.nueva('repartidor');
    const db = p.m.DB;
    await db.prepare('PRAGMA foreign_keys = OFF').run();
    await db
      .prepare(
        "INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, zona_id, estado_general) VALUES ('op-1', 'moto', 'viaje_pasajero', ?, 'Z', 'buscando')",
      )
      .bind(yo.id)
      .run();
    const oferta = (conductor: string) =>
      db
        .prepare(
          "INSERT INTO ofertas_operacion (operacion_id, conductor_id, vehiculo_id, estado, expira_en) VALUES ('op-1', ?, 'v', 'ofrecida', datetime('now', '+1 minute'))",
        )
        .bind(conductor)
        .run();
    expect((await oferta(yo.id)).meta.changes).toBe(0);
    expect((await oferta(otro.id)).meta.changes).toBe(1);
    await expect(
      db.prepare("UPDATE operaciones SET conductor_id = ? WHERE id = 'op-1'").bind(yo.id).run(),
    ).rejects.toThrow(/cuenta_unica/);
    await db
      .prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio,
           cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion)
         VALUES ('pe-1', ?, 'r', 'listo', '[]', 100, 0, 0, 0, 0, 100, 0, 0, 0, 0, 0, 'inicial', 'Calle 1')`,
      )
      .bind(yo.id)
      .run();
    expect(
      (
        await db
          .prepare(
            "INSERT INTO ofertas (pedido_id, repartidor_id, estado) VALUES ('pe-1', ?, 'ofrecida')",
          )
          .bind(yo.id)
          .run()
      ).meta.changes,
    ).toBe(0);
    await expect(
      db.prepare("UPDATE pedidos SET repartidor_id = ? WHERE id = 'pe-1'").bind(yo.id).run(),
    ).rejects.toThrow(/cuenta_unica/);
    await expect(
      db
        .prepare(
          "INSERT INTO calificaciones_cliente (pedido_id, repartidor_id, cliente_id, estrellas) VALUES ('pe-1', ?1, ?1, 5)",
        )
        .bind(yo.id)
        .run(),
    ).rejects.toThrow(/cuenta_unica/);
    await expect(
      db
        .prepare('INSERT INTO conductores_confianza (cliente_id, conductor_id) VALUES (?1, ?1)')
        .bind(yo.id)
        .run(),
    ).rejects.toThrow(/cuenta_unica/);
  });
});

describe('C-CUENTA-UNICA-SUSPENSION: papeles vencidos suspenden el papel; el fraude, la persona', () => {
  async function conDosPapeles() {
    const p = await preparar();
    const admin = await p.m.cuenta('admin');
    const conductor = await p.nueva('repartidor');
    const cliente = await p.entrar(conductor.correo, app('cliente'), {
      activarPapel: true,
      aceptaTerminosPapel: true,
    });
    expect(cliente.estado).toBe(200);
    const suspender = (motivoTipo: string) =>
      p.m.llamar(
        'PATCH',
        `/datos/admin/usuarios/${conductor.id}`,
        { activo: false, motivo: 'Licencia vencida', motivoTipo },
        admin.token,
      );
    return { p, conductor, clienteToken: cliente.datos.token as string, suspender };
  }

  it('por papeles: Driver se cierra y no vuelve a entrar; sigue pidiendo en la app de clientes', async () => {
    const { p, conductor, clienteToken, suspender } = await conDosPapeles();
    expect((await suspender('papeles')).estado).toBe(200);
    expect((await p.yo(conductor.token)).estado).toBe(401);
    expect((await p.yo(clienteToken)).datos.usuario.rol).toBe('cliente');
    const driver = await p.entrar(conductor.correo, app('repartidor'));
    expect(driver.estado).toBe(403);
    expect(driver.datos.codigo).toBe('papel_suspendido');
    expect((await p.entrar(conductor.correo, app('cliente'))).estado).toBe(200);
    // Y la base no lo deja conectarse.
    await p.m.DB.prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)')
      .bind(conductor.id)
      .run();
    await expect(
      p.m.DB.prepare('UPDATE repartidores SET conectado = 1 WHERE usuario_id = ?')
        .bind(conductor.id)
        .run(),
    ).rejects.toThrow(/cuenta_unica/);
  });

  it('por fraude: la persona entera queda fuera (también como cliente)', async () => {
    const { p, conductor, clienteToken, suspender } = await conDosPapeles();
    expect((await suspender('fraude')).estado).toBe(200);
    expect((await p.yo(clienteToken)).estado).toBe(401);
    expect((await p.entrar(conductor.correo, app('cliente'))).estado).toBe(403);
  });
});

describe('C-CUENTA-UNICA-AVISOS: cada aviso a la app de su papel', () => {
  afterEach(() => usarTransporteAvisos(null));
  it('el aviso de conductor llega a Driver y el de cliente a la app de clientes, misma cuenta y mismo teléfono', async () => {
    const mandados: string[] = [];
    usarTransporteAvisos(async (_u, init) => {
      const lote = JSON.parse(String(init.body)) as { to: string }[];
      mandados.push(...lote.map((l) => l.to));
      return new Response(JSON.stringify({ data: lote.map(() => ({ status: 'ok' })) }));
    });
    const p = await preparar();
    const conductor = await p.nueva('repartidor');
    const cliente = await p.entrar(conductor.correo, app('cliente'), {
      activarPapel: true,
      aceptaTerminosPapel: true,
    });
    for (const [token, sesion, a] of [
      ['ExponentPushToken[driver]', conductor.token, 'repartidor'],
      ['ExponentPushToken[cliente]', cliente.datos.token as string, 'cliente'],
    ] as const)
      expect(
        (
          await p.m.llamar(
            'POST',
            '/datos/cuentas/dispositivo',
            { token, plataforma: 'ios' },
            sesion,
            app(a),
          )
        ).estado,
      ).toBe(200);
    const aviso = (i: 'es' | 'en') => ({ titulo: i, cuerpo: i });
    await notificar({} as never, p.m.DB, { id: conductor.id, app: 'repartidor' }, aviso);
    expect(mandados).toEqual(['ExponentPushToken[driver]']);
    mandados.length = 0;
    await notificar({} as never, p.m.DB, { id: conductor.id, app: 'cliente' }, aviso);
    expect(mandados).toEqual(['ExponentPushToken[cliente]']);
    mandados.length = 0;
    // Una oferta va siempre a Driver, aunque quien la manda no diga la app.
    await notificar({} as never, p.m.DB, conductor.id, (i) => ({ ...aviso(i), oferta: true }));
    expect(mandados).toEqual(['ExponentPushToken[driver]']);
  });
});

describe('C-CUENTA-UNICA-UNIR y C-CUENTA-UNICA-REGALO: unir dos cuentas de la misma persona', () => {
  async function dosCuentas(mismoCelular = true) {
    const p = await preparar();
    const admin = await p.m.cuenta('admin');
    const conductor = await p.nueva('repartidor', '+584241234567');
    const cliente = await p.nueva('cliente', mismoCelular ? '+584241234567' : '+584241234999');
    await p.m.DB.prepare(
      "UPDATE usuarios SET telefono_verificado_en = datetime('now') WHERE id = ?",
    )
      .bind(conductor.id)
      .run();
    return { p, admin, conductor, cliente };
  }

  it('con el mismo celular confirmado: una sola cuenta, el historial pasa y lo pendiente del regalo se anula', async () => {
    const { p, admin, conductor, cliente } = await dosCuentas();
    const db = p.m.DB;
    await db.prepare('PRAGMA foreign_keys = OFF').run();
    for (const [id, estado] of [
      ['uso-1', 'cobrado'],
      ['uso-2', 'apartado'],
    ] as const)
      await db
        .prepare(
          `INSERT INTO usos_cupon_divoox (id, codigo, cliente_id, telefono, aparato, servicio, zona_id, pais, operacion_id, monto, moneda, estado)
           VALUES (?, ?, ?, 't', 'a', 'moto', 'Z', 'VE', ?, 100, 'USD', ?)`,
        )
        .bind(id, id === 'uso-1' ? 'BIENVENIDA' : 'OTRO', cliente.id, `op-${id}`, estado)
        .run();
    await db
      .prepare(
        "INSERT INTO referidos (id, invitado_id, invitador_id, estado) VALUES ('ref-1', ?, 'alguien', 'pendiente')",
      )
      .bind(cliente.id)
      .run();
    const revision = await p.m.llamar(
      'POST',
      '/datos/admin/cuentas/unir/revisar',
      { conductorId: conductor.id, clienteId: cliente.id },
      admin.token,
    );
    expect(revision.estado).toBe(200);
    expect(revision.datos.frenos).toEqual([]);
    const r = await p.m.llamar(
      'POST',
      '/datos/admin/cuentas/unir',
      {
        conductorId: conductor.id,
        clienteId: cliente.id,
        motivo: 'Misma persona, dos correos',
        confirmo: true,
      },
      admin.token,
    );
    expect(r.estado).toBe(200);
    const usos = await db
      .prepare('SELECT id, cliente_id, estado FROM usos_cupon_divoox ORDER BY id')
      .all<{ id: string; cliente_id: string; estado: string }>();
    expect(usos.results).toEqual([
      { id: 'uso-1', cliente_id: conductor.id, estado: 'cobrado' },
      { id: 'uso-2', cliente_id: cliente.id, estado: 'liberado' },
    ]);
    const ref = await db
      .prepare("SELECT cierre FROM referidos WHERE id = 'ref-1'")
      .first<{ cierre: string }>();
    expect(ref?.cierre).toBe('cuenta_unida');
    // La de cliente quedó cerrada; la persona entra a la app de clientes con la de conductor.
    expect((await p.yo(cliente.token)).estado).toBe(401);
    const entra = await p.entrar(conductor.correo, app('cliente', false));
    expect(entra.estado).toBe(200);
    expect(entra.datos.usuario.rol).toBe('cliente');
    // No se puede unir dos veces.
    const otra = await p.m.llamar(
      'POST',
      '/datos/admin/cuentas/unir',
      { conductorId: conductor.id, clienteId: cliente.id, motivo: 'Otra vez', confirmo: true },
      admin.token,
    );
    expect(otra.estado).toBe(409);
  });

  it('con celulares distintos no se unen', async () => {
    const { p, admin, conductor, cliente } = await dosCuentas(false);
    const r = await p.m.llamar(
      'POST',
      '/datos/admin/cuentas/unir',
      { conductorId: conductor.id, clienteId: cliente.id, motivo: 'Misma persona', confirmo: true },
      admin.token,
    );
    expect(r.estado).toBe(409);
    expect(r.datos.error).toContain('celular');
  });
});

describe('C-CUENTA-UNICA-RESTAURANTE: la misma persona es dueña de uno o varios restaurantes', () => {
  it('registra dos restaurantes con su misma cuenta; cada uno es un negocio aparte que pasa por aprobación', async () => {
    const p = await preparar();
    const cliente = await p.nueva('cliente');
    // En el panel web (sin cabecera de app).
    const web = await p.entrar(cliente.correo, { 'x-idioma': 'es' });
    const t = web.datos.token as string;
    const papeles = await p.m.llamar('GET', '/datos/cuentas/papeles', undefined, t);
    expect(papeles.datos.puedeRegistrarRestaurante).toBe(true);
    expect(papeles.datos.negocios).toEqual([]);
    const uno = await p.m.llamar(
      'POST',
      '/datos/cuentas/mis-restaurantes',
      { nombre: 'Pizzería Uno', aceptaTerminos: true },
      t,
    );
    expect(uno.estado).toBe(201);
    // La sesión del panel ahora actúa como el restaurante (rol de restaurante, id del negocio).
    const como = await p.yo(t);
    expect(como.datos.usuario.rol).toBe('restaurante');
    expect(como.datos.usuario.id).toBe(uno.datos.negocioId);
    const ficha = await p.m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      {
        nombre: 'Pizzería Uno',
        telefono: '+13055550100',
        direccion: 'Calle 1',
        categoria: 'pizza',
      },
      t,
    );
    expect([200, 201]).toContain(ficha.estado);
    const r1 = await p.m.DB.prepare('SELECT estado FROM restaurantes WHERE dueno_id = ?')
      .bind(uno.datos.negocioId)
      .first<{ estado: string }>();
    expect(r1?.estado).toBe('pendiente');
    const dos = await p.m.llamar(
      'POST',
      '/datos/cuentas/mis-restaurantes',
      { nombre: 'Pizzería Dos', aceptaTerminos: true },
      t,
    );
    expect(dos.estado).toBe(201);
    const lista = await p.m.llamar('GET', '/datos/cuentas/papeles', undefined, t);
    expect(lista.datos.negocios).toHaveLength(2);
    // Vuelve a su cuenta personal: sigue siendo cliente; su dinero y su ficha no se mezclan.
    expect(
      (await p.m.llamar('POST', '/datos/cuentas/actuar-como', { negocioId: null }, t)).estado,
    ).toBe(200);
    expect((await p.yo(t)).datos.usuario).toMatchObject({ id: cliente.id, rol: 'cliente' });
    // Otra persona no puede actuar como su restaurante.
    const otra = await p.nueva('cliente');
    const ajena = await p.m.llamar(
      'POST',
      '/datos/cuentas/actuar-como',
      { negocioId: uno.datos.negocioId },
      otra.token,
    );
    expect(ajena.estado).toBe(403);
  });

  it('una cuenta de restaurante (dueño de siempre o empleado) no se vuelve dueña sola', async () => {
    const p = await preparar();
    const cocina = await p.nueva('restaurante');
    const papeles = await p.m.llamar('GET', '/datos/cuentas/papeles', undefined, cocina.token);
    expect(papeles.datos.puedeRegistrarRestaurante).toBe(false);
    const r = await p.m.llamar(
      'POST',
      '/datos/cuentas/mis-restaurantes',
      { nombre: 'Otro local', aceptaTerminos: true },
      cocina.token,
    );
    expect(r.estado).toBe(403);
  });

  it('suspender el restaurante no suspende a su dueño; el fraude del restaurante, sí', async () => {
    const p = await preparar();
    const admin = await p.m.cuenta('admin');
    const cliente = await p.nueva('cliente');
    const uno = await p.m.llamar(
      'POST',
      '/datos/cuentas/mis-restaurantes',
      { nombre: 'Local', aceptaTerminos: true },
      cliente.token,
    );
    await p.m.llamar('POST', '/datos/cuentas/actuar-como', { negocioId: null }, cliente.token);
    const negocio = uno.datos.negocioId as string;
    // C-PERMISOS-FINOS: el PATCH busca cuentas de cliente, conductor o restaurante.
    const pausa = await p.m.llamar(
      'PATCH',
      `/datos/admin/usuarios/${negocio}`,
      { activo: false, motivo: 'Cerrado por reformas', motivoTipo: 'otro' },
      admin.token,
    );
    expect(pausa.estado).toBe(200);
    expect((await p.yo(cliente.token)).estado).toBe(200);
    const fraude = await p.m.llamar(
      'PATCH',
      `/datos/admin/usuarios/${negocio}`,
      { activo: false, motivo: 'Cobros falsos', motivoTipo: 'fraude' },
      admin.token,
    );
    expect(fraude.estado).toBe(200);
    expect((await p.yo(cliente.token)).estado).toBe(401);
  });
});

describe('C-CUENTA-UNICA-SUSPENSION: lo que pidió el revisor de calidad', () => {
  it('sin motivoTipo, a un conductor se le suspende solo el papel de conductor (lo más seguro)', async () => {
    const p = await preparar();
    const admin = await p.m.cuenta('admin');
    const conductor = await p.nueva('repartidor');
    const cliente = await p.entrar(conductor.correo, app('cliente'), {
      activarPapel: true,
      aceptaTerminosPapel: true,
    });
    const r = await p.m.llamar(
      'PATCH',
      `/datos/admin/usuarios/${conductor.id}`,
      { activo: false, motivo: 'Panel viejo sin tipo' },
      admin.token,
    );
    expect(r.datos.papelConductor).toBe('suspendido');
    expect((await p.yo(cliente.datos.token)).datos.usuario.rol).toBe('cliente');
    expect((await p.yo(conductor.token)).estado).toBe(401);
    // La ficha lo muestra suspendido y «Reactivar» le devuelve el papel.
    await p.m.DB.prepare('INSERT OR IGNORE INTO repartidores (usuario_id) VALUES (?)')
      .bind(conductor.id)
      .run();
    const ficha = await p.m.llamar(
      'GET',
      `/datos/admin/repartidores/${conductor.id}`,
      undefined,
      admin.token,
    );
    expect(ficha.estado).toBe(200);
    expect(ficha.datos.repartidor).toMatchObject({ activo: false, papelSuspendido: true });
    await p.m.llamar(
      'PATCH',
      `/datos/admin/usuarios/${conductor.id}`,
      { activo: true },
      admin.token,
    );
    expect((await p.entrar(conductor.correo, app('repartidor'))).estado).toBe(200);
  });

  it('al reactivar tras un fraude vuelven los restaurantes que cayeron con la persona, no los apagados antes', async () => {
    const p = await preparar();
    const admin = await p.m.cuenta('admin');
    const cliente = await p.nueva('cliente');
    const crear = async (nombre: string) =>
      (
        await p.m.llamar(
          'POST',
          '/datos/cuentas/mis-restaurantes',
          { nombre, aceptaTerminos: true },
          cliente.token,
        )
      ).datos.negocioId as string;
    const uno = await crear('Local uno');
    const dos = await crear('Local dos');
    await p.m.llamar('POST', '/datos/cuentas/actuar-como', { negocioId: null }, cliente.token);
    const patch = (id: string, cuerpo: Record<string, unknown>) =>
      p.m.llamar('PATCH', `/datos/admin/usuarios/${id}`, cuerpo, admin.token);
    // El «dos» ya estaba apagado por otra causa.
    await patch(dos, { activo: false, motivo: 'Cerrado por reformas', motivoTipo: 'otro' });
    await patch(cliente.id, { activo: false, motivo: 'Cobros falsos', motivoTipo: 'fraude' });
    const activo = async (id: string) =>
      Number(
        (
          await p.m.DB.prepare('SELECT activo FROM usuarios WHERE id = ?')
            .bind(id)
            .first<{ activo: number }>()
        )?.activo,
      );
    expect(await activo(uno)).toBe(0);
    await patch(cliente.id, { activo: true });
    expect(await activo(cliente.id)).toBe(1);
    expect(await activo(uno)).toBe(1);
    expect(await activo(dos)).toBe(0);
  });
});

describe('C-CUENTA-UNICA-UNIR: el resumen cuenta lo que de verdad se movió', () => {
  it('una fila que no se puede mover por clave única queda escrita en el resumen y en el registro de errores', async () => {
    const p = await preparar();
    const admin = await p.m.cuenta('admin');
    const conductor = await p.nueva('repartidor', '+584241234567');
    const cliente = await p.nueva('cliente', '+584241234567');
    const db = p.m.DB;
    await db
      .prepare("UPDATE usuarios SET telefono_verificado_en = datetime('now') WHERE id = ?")
      .bind(conductor.id)
      .run();
    await db.prepare('PRAGMA foreign_keys = OFF').run();
    // El mismo contacto de confianza en las dos cuentas (único por cliente y teléfono) y otro distinto.
    for (const [id, cid, tel] of [
      ['k1', conductor.id, '+15550001'],
      ['k2', cliente.id, '+15550001'],
      ['k3', cliente.id, '+15550002'],
    ] as const)
      await db
        .prepare(
          "INSERT INTO contactos_confianza (id, cliente_id, nombre, telefono) VALUES (?, ?, 'Contacto', ?)",
        )
        .bind(id, cid, tel)
        .run();
    const errores: unknown[] = [];
    const original = console.error;
    console.error = (...a: unknown[]) => void errores.push(a);
    try {
      const r = await p.m.llamar(
        'POST',
        '/datos/admin/cuentas/unir',
        {
          conductorId: conductor.id,
          clienteId: cliente.id,
          motivo: 'Misma persona',
          confirmo: true,
        },
        admin.token,
      );
      expect(r.estado).toBe(200);
      expect(r.datos.movidas.contactos_confianza).toBe(1);
      expect(r.datos.quedaron).toEqual({ contactos_confianza: 1 });
    } finally {
      console.error = original;
    }
    const u = await db
      .prepare('SELECT resumen_json FROM uniones_cuenta WHERE secundaria_id = ?')
      .bind(cliente.id)
      .first<{ resumen_json: string }>();
    expect(JSON.parse(u?.resumen_json ?? '{}')).toMatchObject({
      movidas: { contactos_confianza: 1 },
      quedaron: { contactos_confianza: 1 },
    });
    expect(JSON.stringify(errores)).toContain('no se pudieron mover');
  });
});

/**
 * C-CUENTA-UNICA-CELULAR y C-CUENTA-UNICA-COMERCIO (27 nov 2026, emergencia de Gerencia). Un mototaxista
 * real de Tucaní se registró en la app de clientes y al abrir Driver solo veía «ya existe». Con el mismo
 * celular y otro correo, Driver le abría una SEGUNDA cuenta. Una persona, una cuenta: con el mismo
 * correo o el mismo celular, la otra app lleva a entrar con la cuenta que ya tiene.
 */
describe('C-CUENTA-UNICA-CELULAR: mismo correo y mismo celular, nunca una cuenta duplicada', () => {
  const registrar = (
    p: Awaited<ReturnType<typeof preparar>>,
    rol: 'cliente' | 'repartidor',
    correo: string,
    telefono: string,
  ) =>
    p.m.llamar(
      'POST',
      '/datos/cuentas/registro',
      { nombre: 'Persona Dos', correo, clave: CLAVE, rol, telefono },
      undefined,
      app(rol),
    );

  for (const [desde, hacia] of [
    ['cliente', 'repartidor'],
    ['repartidor', 'cliente'],
  ] as const) {
    it(`un ${desde} se hace ${hacia} con su misma cuenta (mismo correo y mismo celular)`, async () => {
      const p = await preparar();
      const tel = '+584241234567';
      const yo = await p.nueva(desde, tel);
      const antes = await p.cuantas();
      // Mismo correo: «Ya tienes una cuenta de Divoox», con la salida por el código del celular.
      const conCorreo = await registrar(p, hacia, yo.correo, tel);
      expect(conCorreo.estado).toBe(409);
      expect(conCorreo.datos.codigo).toBe('correo_con_cuenta');
      expect(conCorreo.datos.error).toContain('Ya tienes una cuenta de Divoox con este correo');
      expect(conCorreo.datos.error).toContain('¿Olvidaste tu contraseña?');
      // Mismo celular con OTRO correo: tampoco abre una segunda cuenta.
      const conCelular = await registrar(p, hacia, `otro-${Date.now()}@ejemplo.com`, tel);
      expect(conCelular.estado).toBe(409);
      expect(conCelular.datos.codigo).toBe('telefono_con_cuenta');
      expect(conCelular.datos.campo).toBe('telefono');
      expect(conCelular.datos.error).toContain('Ya tienes una cuenta de Divoox con este celular');
      expect(await p.cuantas()).toBe(antes);
      // Entra con ella: se le agrega el papel y es la misma cuenta.
      const ok = await p.entrar(yo.correo, app(hacia), {
        activarPapel: true,
        aceptaTerminosPapel: true,
      });
      expect(ok.estado).toBe(200);
      expect(ok.datos.usuario.rol).toBe(hacia);
      expect(ok.datos.usuario.id).toBe(yo.id);
      expect(await p.cuantas()).toBe(antes);
    });
  }

  it('un comercio tiene cuenta de cliente con el mismo correo y el mismo celular', async () => {
    const p = await preparar();
    const tel = '+584241234568';
    const cliente = await p.nueva('cliente', tel);
    // En Divoox Restaurants, el correo de cliente no abre otra cuenta: lo manda a «Mis restaurantes».
    const enRestaurants = await p.m.llamar(
      'POST',
      '/datos/cuentas/registro',
      { nombre: 'Cocina Uno', correo: cliente.correo, clave: CLAVE, rol: 'restaurante' },
      undefined,
      app('restaurante', false),
    );
    expect(enRestaurants.estado).toBe(409);
    expect(enRestaurants.datos.codigo).toBe('cuenta_de_otra_app');
    expect(enRestaurants.datos.error).toContain('Mis restaurantes');
    expect(enRestaurants.datos.error).not.toContain('otro correo');
    // Con esa misma cuenta (mismo correo, misma contraseña) registra su restaurante.
    const web = await p.entrar(cliente.correo, { 'x-idioma': 'es' });
    const negocio = await p.m.llamar(
      'POST',
      '/datos/cuentas/mis-restaurantes',
      { nombre: 'Cocina Uno', aceptaTerminos: true },
      web.datos.token as string,
    );
    expect(negocio.estado).toBe(201);
    // Y sigue siendo cliente en la app de clientes.
    const comoCliente = await p.entrar(cliente.correo, app('cliente'));
    expect(comoCliente.estado).toBe(200);
    expect(comoCliente.datos.usuario.id).toBe(cliente.id);
    // Un restaurante de los de siempre (su propio correo) puede tener cuenta de cliente con su celular.
    const telCocina = '+584241234569';
    const cocina = await p.nueva('restaurante', telCocina);
    expect(cocina.id).toBeTruthy();
    const suCliente = await registrar(p, 'cliente', `dueno-${Date.now()}@ejemplo.com`, telCocina);
    expect(suCliente.estado).toBe(201);
  });
});
