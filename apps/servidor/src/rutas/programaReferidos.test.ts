import { describe, expect, it } from 'vitest';
import { saldoLibro } from '../internacional/libro';
import { EL_VIGIA, abrirComida, escenarioVe } from '../pruebas/comidaVe';
import { PROGRAMAS_POR_DEFECTO, TOPES_REFERIDOS, revisarReferidos } from '../programaReferidos';
import { saldoRegalo } from '../tarjetasRegalo';

/**
 * C-REFERIDOS-EQUIPOS (17 nov 2026): equipos con su líder y su código, referidos de conductores
 * (saldo tras N carreras en X días) y de clientes (regalo al invitado y premio al que invita), con
 * antifraude y presupuesto. Candado: ningún programa da más que su presupuesto.
 */
let n = 0;
async function mundo() {
  const e = await escenarioVe();
  expect((await abrirComida(e)).estado).toBe(201);
  const registrar = async (
    rol: 'repartidor' | 'cliente',
    nombre: string,
    extra: { invitacion?: string; telefono?: string; aparato?: string } = {},
  ) => {
    n++;
    const r = await e.m.llamar(
      'POST',
      '/datos/cuentas/registro',
      {
        nombre,
        correo: `${rol}${n}-${Math.random().toString(36).slice(2, 7)}@ejemplo.com`,
        clave: 'clave-segura-1',
        rol,
        telefono: extra.telefono ?? `+58414555${String(1000 + n).slice(-4)}`,
        ...(extra.invitacion ? { invitacion: extra.invitacion } : {}),
      },
      undefined,
      {
        'x-aparato':
          extra.aparato ?? `aparato-referidos-${n}-${Math.random().toString(36).slice(2, 8)}`,
      },
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const id = r.datos.usuario.id as string;
    if (rol === 'repartidor')
      await e.m.DB.prepare(
        'INSERT INTO repartidores (usuario_id, conectado, lat, lng, zona_id) VALUES (?, 0, ?, ?, ?)',
      )
        .bind(id, EL_VIGIA.lat, EL_VIGIA.lng, EL_VIGIA.id)
        .run();
    else
      await e.m.DB.prepare('UPDATE usuarios SET zona_id = ? WHERE id = ?')
        .bind(EL_VIGIA.id, id)
        .run();
    return { id, token: r.datos.token as string };
  };
  const carrera = async (conductorId: string, clienteId: string, total = 150) => {
    const op = crypto.randomUUID();
    await e.m.DB.prepare('PRAGMA foreign_keys = OFF').run();
    await e.m.DB.prepare(
      "INSERT INTO operaciones (id, servicio_id, tipo_operacion, cliente_id, conductor_id, zona_id, estado_general) VALUES (?, 'moto', 'viaje_pasajero', ?, ?, ?, 'terminada')",
    )
      .bind(op, clienteId, conductorId, EL_VIGIA.id)
      .run();
    await e.m.DB.prepare(
      "INSERT INTO viajes (operacion_id, estado, ultimo_actor, ultima_clave, origen_lat, origen_lng, origen_direccion, destino_lat, destino_lng, destino_direccion, pasajeros, pin_recogida, metodo_pago, total_final_centavos) VALUES (?, 'terminado', 'sistema', 'prueba:' || ?, 0, 0, 'a', 0, 0, 'b', 1, '0000', 'efectivo', ?)",
    )
      .bind(op, op, total)
      .run();
    await e.m.DB.prepare('PRAGMA foreign_keys = ON').run();
  };
  const programa = (tipo: string, ambito: string, cuerpo: Record<string, unknown>) =>
    e.m.llamar('PUT', `/datos/admin/referidos-programas/${tipo}/${ambito}`, cuerpo, e.admin.token);
  return { e, registrar, carrera, programa };
}

describe('C-REFERIDOS-EQUIPOS: programas, nacen apagados con los montos por defecto', () => {
  it('los programas por defecto: conductor y cliente de Venezuela y cliente de EE. UU., apagados', async () => {
    const { e, programa } = await mundo();
    const r = await e.m.llamar('GET', '/datos/admin/referidos-programas', undefined, e.admin.token);
    expect(r.estado).toBe(200);
    const vistos = Object.fromEntries(
      r.datos.programas.map(
        (p: { tipo: string; ambito: string; activo: boolean; reglas: unknown }) => [
          `${p.tipo}:${p.ambito}`,
          p,
        ],
      ),
    );
    expect(vistos['conductor:VE']).toMatchObject({
      activo: false,
      reglas: { premio: 100, carreras: 10, dias: 30 },
    });
    expect(vistos['cliente:VE']).toMatchObject({
      activo: false,
      reglas: { regaloInvitado: 150, premioInvitador: 150, operaciones: 3 },
    });
    expect(vistos['cliente:US'].reglas).toMatchObject({ premioInvitador: 500, gastoMinimo: 4_000 });
    expect(r.datos.topes).toEqual(TOPES_REFERIDOS);
    // El premio siempre es menor que lo que gasta el invitado; y los topes del código mandan.
    const malo = await programa('cliente', 'VE', {
      activo: true,
      presupuesto: 10_000,
      reglas: {
        regaloInvitado: 150,
        premioInvitador: 500,
        operaciones: 3,
        gastoMinimo: 450,
        topeMes: 10,
      },
    });
    expect(malo.estado).toBe(422);
    expect(
      (
        await programa('conductor', 'VE', {
          activo: true,
          presupuesto: TOPES_REFERIDOS.presupuestoMaximo + 1,
          reglas: PROGRAMAS_POR_DEFECTO['conductor:VE']!.reglas,
        })
      ).estado,
    ).toBe(400);
  });
});

describe('C-REFERIDOS-EQUIPOS: equipos con su líder', () => {
  it('el equipo «Jehová Jireh»: quien se registra con su código queda en el equipo, con fecha', async () => {
    const { e, registrar, carrera } = await mundo();
    const lider = await registrar('repartidor', 'Presidente Jireh');
    const correo = (await e.m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?')
      .bind(lider.id)
      .first<{ correo: string }>())!.correo;
    const r = await e.m.llamar(
      'POST',
      '/datos/admin/equipos',
      { nombre: 'Jehová Jireh', zonaId: EL_VIGIA.id, lider: correo },
      e.admin.token,
    );
    expect(r.estado).toBe(201);
    const codigo = r.datos.equipo.codigo as string;
    expect(codigo).toMatch(/^JEHOVA[A-Z2-9]{3}$/);
    // La página pública dice quién invita y a qué equipo.
    const pub = await e.m.llamar('GET', `/datos/publico/invitacion/${codigo.toLowerCase()}`);
    expect(pub.datos.invitacion).toMatchObject({
      nombre: 'Presidente',
      equipo: 'Jehová Jireh',
      ciudad: 'El Vigía',
    });
    const a = await registrar('repartidor', 'Mototaxista Uno', { invitacion: codigo });
    const b = await registrar('repartidor', 'Mototaxista Dos', { invitacion: codigo });
    await registrar('repartidor', 'Sin Equipo');
    await e.m.DB.prepare("DELETE FROM servicio_requisitos WHERE servicio_id = 'moto'").run();
    await e.m.DB.prepare(
      "INSERT INTO habilitaciones (conductor_id, servicio_id, estado, aprobado_por) VALUES (?, 'moto', 'aprobada', ?)",
    )
      .bind(a.id, e.admin.id)
      .run();
    const cli = await registrar('cliente', 'Pasajera');
    await carrera(a.id, cli.id);
    const lista = await e.m.llamar(
      'GET',
      `/datos/admin/equipos?zona=${EL_VIGIA.id}`,
      undefined,
      e.admin.token,
    );
    expect(lista.datos.equipos[0]).toMatchObject({
      nombre: 'Jehová Jireh',
      registrados: 2,
      aprobados: 1,
      activos: 1,
      carreras: 1,
    });
    const ficha = await e.m.llamar(
      'GET',
      `/datos/admin/equipos/${r.datos.equipo.id}`,
      undefined,
      e.admin.token,
    );
    expect(ficha.datos.miembros.map((m: { id: string }) => m.id).sort()).toEqual(
      [a.id, b.id].sort(),
    );
    expect(ficha.datos.equipo.enlace).toContain(`/join/${codigo}`);
    // El líder ve «Mi equipo» con el mismo conteo.
    const mio = await e.m.llamar('GET', '/datos/repartidor/invitaciones', undefined, lider.token);
    expect(mio.datos.equipo).toMatchObject({ nombre: 'Jehová Jireh', registrados: 2, carreras: 1 });
    expect(mio.datos.invitados).toHaveLength(2);
  });
});

describe('C-REFERIDOS-EQUIPOS: referido de conductor', () => {
  it('quien invita gana saldo cuando su invitado completa 10 carreras; las suyas con él no cuentan', async () => {
    const { e, registrar, carrera, programa } = await mundo();
    expect(
      (
        await programa('conductor', 'VE', {
          activo: true,
          presupuesto: 5_000,
          reglas: { premio: 100, carreras: 10, dias: 30, topeMes: 10 },
        })
      ).estado,
    ).toBe(200);
    const invita = await registrar('repartidor', 'Ana Invita');
    const codigo = (
      await e.m.llamar('GET', '/datos/repartidor/invitaciones', undefined, invita.token)
    ).datos.codigo as string;
    const nuevo = await registrar('repartidor', 'Beto Nuevo', { invitacion: codigo });
    const cli = await registrar('cliente', 'Pasajero');
    // Ana se pide carreras a sí misma con Beto: no cuentan.
    await e.m.DB.prepare("UPDATE usuarios SET rol = 'repartidor' WHERE id = ?")
      .bind(invita.id)
      .run();
    for (let i = 0; i < 5; i++) await carrera(nuevo.id, invita.id);
    for (let i = 0; i < 9; i++) await carrera(nuevo.id, cli.id);
    expect(await revisarReferidos(e.m.DB)).toBe(0);
    await carrera(nuevo.id, cli.id);
    expect(await revisarReferidos(e.m.DB)).toBe(1);
    expect(await revisarReferidos(e.m.DB)).toBe(0);
    expect(await saldoLibro(e.m.DB, invita.id, 'prepago', 'VE', 'USD')).toBe(100);
    const alertas = await e.m.llamar(
      'GET',
      '/datos/admin/referidos-programas',
      undefined,
      e.admin.token,
    );
    expect(alertas.datos.alertas.map((a: { tipo: string }) => a.tipo)).toContain(
      'referido_entre_ellos',
    );
  });

  it('no se puede invitar a sí mismo (mismo teléfono o aparato): queda rechazado y con alerta', async () => {
    const { e, registrar } = await mundo();
    const invita = await registrar('repartidor', 'Ana', { aparato: 'aparato-compartido-123' });
    const codigo = (
      await e.m.llamar('GET', '/datos/repartidor/invitaciones', undefined, invita.token)
    ).datos.codigo as string;
    const otro = await registrar('repartidor', 'Ana Otra Cuenta', {
      invitacion: codigo,
      aparato: 'aparato-compartido-123',
    });
    const f = await e.m.DB.prepare(
      'SELECT estado, motivo FROM referidos_conductor WHERE invitado_id = ?',
    )
      .bind(otro.id)
      .first();
    expect(f).toEqual({ estado: 'rechazado', motivo: 'misma_persona' });
  });

  it('candado: el presupuesto del programa y el tope del mes nunca se pasan', async () => {
    const { e, registrar, carrera, programa } = await mundo();
    await programa('conductor', 'VE', {
      activo: true,
      presupuesto: 250,
      reglas: { premio: 100, carreras: 1, dias: 30, topeMes: 10 },
    });
    const invita = await registrar('repartidor', 'Ana');
    const codigo = (
      await e.m.llamar('GET', '/datos/repartidor/invitaciones', undefined, invita.token)
    ).datos.codigo as string;
    const cli = await registrar('cliente', 'Pasajero');
    for (let i = 0; i < 4; i++) {
      const c = await registrar('repartidor', `Invitado ${i}`, { invitacion: codigo });
      await carrera(c.id, cli.id);
    }
    await revisarReferidos(e.m.DB);
    // 250 de presupuesto y 100 por premio: dos premios y ni un centavo más.
    expect(await saldoLibro(e.m.DB, invita.id, 'prepago', 'VE', 'USD')).toBe(200);
    const total = await e.m.DB.prepare(
      "SELECT SUM(monto) AS s FROM premios_referido WHERE tipo = 'conductor'",
    ).first<{ s: number }>();
    expect(total?.s).toBe(200);
    // Tope del mes: con 1 premio al mes, el segundo no se da.
    await programa('conductor', 'VE', {
      activo: true,
      presupuesto: 5_000,
      reglas: { premio: 100, carreras: 1, dias: 30, topeMes: 2 },
    });
    await revisarReferidos(e.m.DB);
    expect(await saldoLibro(e.m.DB, invita.id, 'prepago', 'VE', 'USD')).toBe(200);
  });
});

describe('C-REFERIDOS-EQUIPOS: referido de cliente', () => {
  it('Venezuela: el invitado tiene su primer viaje gratis hasta 1,50 y quien invitó gana 1,50 tras 3 viajes pagados', async () => {
    const { e, registrar, carrera, programa } = await mundo();
    expect(
      (
        await programa('cliente', 'VE', {
          activo: true,
          presupuesto: 10_000,
          reglas: PROGRAMAS_POR_DEFECTO['cliente:VE']!.reglas,
        })
      ).estado,
    ).toBe(200);
    const ana = await registrar('cliente', 'Ana Invita');
    const ref = await e.m.llamar('GET', '/datos/referidos', undefined, ana.token);
    expect(ref.datos).toMatchObject({
      activos: true,
      paraAmigo: 150,
      paraQuienInvita: 150,
      operaciones: 3,
    });
    const bea = await registrar('cliente', 'Bea Nueva', { invitacion: ref.datos.codigo });
    // Bea tiene su regalo guardado (un cupón personal de un solo uso).
    const guardado = await e.m.DB.prepare(
      'SELECT c.valor, c.tipo FROM cupones_divoox_guardados g JOIN cupones_divoox c ON c.codigo = g.codigo WHERE g.cliente_id = ?',
    )
      .bind(bea.id)
      .first();
    expect(guardado).toEqual({ valor: 150, tipo: 'gratis' });
    const cond = await registrar('repartidor', 'Conductor');
    for (let i = 0; i < 2; i++) await carrera(cond.id, bea.id, 200);
    expect(await revisarReferidos(e.m.DB)).toBe(0);
    await carrera(cond.id, bea.id, 200);
    expect(await revisarReferidos(e.m.DB)).toBe(1);
    const premio = await e.m.DB.prepare(
      'SELECT c.valor FROM cupones_divoox_guardados g JOIN cupones_divoox c ON c.codigo = g.codigo WHERE g.cliente_id = ?',
    )
      .bind(ana.id)
      .first<{ valor: number }>();
    expect(premio?.valor).toBe(150);
    // Los cupones de los premios no ensucian la lista de cupones del equipo.
    const cupones = await e.m.llamar(
      'GET',
      '/datos/admin/regalos-divoox',
      undefined,
      e.admin.token,
    );
    expect(cupones.datos.cupones).toHaveLength(0);
  });

  it('Estados Unidos: 5 dólares de saldo de regalo cuando el invitado gasta 40', async () => {
    const { e, programa } = await mundo();
    await programa('cliente', 'US', {
      activo: true,
      presupuesto: 50_000,
      reglas: PROGRAMAS_POR_DEFECTO['cliente:US']!.reglas,
    });
    const ana = await e.m.cuenta('cliente', 'Ana US');
    const bea = await e.m.cuenta('cliente', 'Bea US');
    await e.m.DB.prepare("UPDATE usuarios SET zona_id = 'US-FL-MIAMI' WHERE id IN (?, ?)")
      .bind(ana.id, bea.id)
      .run();
    const codigo = (await e.m.llamar('GET', '/datos/referidos', undefined, ana.token)).datos.codigo;
    expect(
      (await e.m.llamar('POST', '/datos/referidos/canjear', { codigo }, bea.token)).estado,
    ).toBe(201);
    await e.m.DB.prepare('PRAGMA foreign_keys = OFF').run();
    await e.m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, zona_id)
       VALUES (?, ?, 'r', 'entregado', '[]', 4000, 0, 0, 0, 0, 4200, 0, 0, 0, 0, 0, 'basico', 'Calle', 'US-FL-MIAMI')`,
    )
      .bind(crypto.randomUUID(), bea.id)
      .run();
    await e.m.DB.prepare('PRAGMA foreign_keys = ON').run();
    expect(await revisarReferidos(e.m.DB)).toBe(1);
    expect(await saldoRegalo(e.m.DB, ana.id)).toBe(500);
  });
});

/**
 * C-REFERIDOS-SIN-TRAMPA (18 nov 2026, dictamen del revisor): quien se invita a sí mismo no cobra nunca,
 * el premio y su acreditación van juntos o no van, un programa sin presupuesto cierra el referido en
 * vez de avisar cada hora, y un código que no sirve se le dice a la persona al registrarse.
 */
describe('C-REFERIDOS-SIN-TRAMPA', () => {
  const cuponesDe = async (db: D1Database, clienteId: string) =>
    Number(
      (
        await db
          .prepare('SELECT COUNT(*) AS n FROM cupones_divoox_guardados WHERE cliente_id = ?')
          .bind(clienteId)
          .first<{ n: number }>()
      )?.n ?? 0,
    );

  it('el cliente que se invita a sí mismo no le da premio a quien invita, ni al vincular ni después', async () => {
    const { e, registrar, carrera, programa } = await mundo();
    await programa('cliente', 'VE', {
      activo: true,
      presupuesto: 10_000,
      reglas: PROGRAMAS_POR_DEFECTO['cliente:VE']!.reglas,
    });
    const ana = await registrar('cliente', 'Ana', { aparato: 'aparato-de-ana-0001' });
    const codigo = (await e.m.llamar('GET', '/datos/referidos', undefined, ana.token)).datos
      .codigo as string;
    // La segunda cuenta de Ana: mismo aparato desde el registro.
    const ana2 = await registrar('cliente', 'Ana Dos', {
      invitacion: codigo,
      aparato: 'aparato-de-ana-0001',
    });
    // La tercera: se registra con otro aparato y después entra con el de Ana.
    const ana3 = await registrar('cliente', 'Ana Tres', { invitacion: codigo });
    await e.m.DB.prepare(
      'INSERT INTO aparatos_usuario (usuario_id, huella) SELECT ?, huella FROM aparatos_usuario WHERE usuario_id = ?',
    )
      .bind(ana3.id, ana.id)
      .run();
    const cond = await registrar('repartidor', 'Conductor');
    for (const c of [ana2, ana3]) for (let i = 0; i < 3; i++) await carrera(cond.id, c.id, 200);
    expect(await revisarReferidos(e.m.DB)).toBe(0);
    expect(await revisarReferidos(e.m.DB)).toBe(0);
    expect(await cuponesDe(e.m.DB, ana.id)).toBe(0);
    expect(await cuponesDe(e.m.DB, ana2.id)).toBe(0);
    const { results } = await e.m.DB.prepare(
      'SELECT estado, cierre FROM referidos WHERE invitador_id = ? ORDER BY creado_en, id',
    )
      .bind(ana.id)
      .all<{ estado: string; cierre: string | null }>();
    expect(results.map((r) => r.cierre)).toEqual(['misma_persona', 'misma_persona']);
    // Una sola alerta por intento, no una por hora.
    const alertas = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM alertas_regalo WHERE tipo = 'referido_propio'",
    ).first<{ n: number }>();
    expect(alertas?.n).toBe(2);
  });

  it('el conductor que resulta ser la misma persona después de vincularse tampoco cobra', async () => {
    const { e, registrar, carrera, programa } = await mundo();
    await programa('conductor', 'VE', {
      activo: true,
      presupuesto: 5_000,
      reglas: { premio: 100, carreras: 1, dias: 30, topeMes: 10 },
    });
    const invita = await registrar('repartidor', 'Ana');
    const codigo = (
      await e.m.llamar('GET', '/datos/repartidor/invitaciones', undefined, invita.token)
    ).datos.codigo as string;
    const otro = await registrar('repartidor', 'Ana Otra', { invitacion: codigo });
    await e.m.DB.prepare(
      'INSERT INTO aparatos_usuario (usuario_id, huella) SELECT ?, huella FROM aparatos_usuario WHERE usuario_id = ?',
    )
      .bind(otro.id, invita.id)
      .run();
    const cli = await registrar('cliente', 'Pasajero');
    await carrera(otro.id, cli.id);
    expect(await revisarReferidos(e.m.DB)).toBe(0);
    expect(await saldoLibro(e.m.DB, invita.id, 'prepago', 'VE', 'USD')).toBe(0);
    expect(
      await e.m.DB.prepare('SELECT estado, motivo FROM referidos_conductor WHERE invitado_id = ?')
        .bind(otro.id)
        .first(),
    ).toEqual({ estado: 'rechazado', motivo: 'misma_persona' });
  });

  it('si la acreditación falla, el premio no queda gastado: se reintenta y la persona cobra', async () => {
    const { e, registrar, carrera, programa } = await mundo();
    await programa('conductor', 'VE', {
      activo: true,
      presupuesto: 5_000,
      reglas: { premio: 100, carreras: 1, dias: 30, topeMes: 10 },
    });
    const invita = await registrar('repartidor', 'Ana');
    const codigo = (
      await e.m.llamar('GET', '/datos/repartidor/invitaciones', undefined, invita.token)
    ).datos.codigo as string;
    const nuevo = await registrar('repartidor', 'Beto', { invitacion: codigo });
    const cli = await registrar('cliente', 'Pasajero');
    await carrera(nuevo.id, cli.id);
    // La base falla justo al acreditar el saldo.
    await e.m.DB.exec(
      "CREATE TRIGGER falla_premio BEFORE INSERT ON libro WHEN NEW.concepto = 'premio_referido' BEGIN SELECT RAISE(ABORT, 'fallo de prueba'); END",
    );
    await expect(revisarReferidos(e.m.DB)).rejects.toThrow();
    const premios = () =>
      e.m.DB.prepare('SELECT COUNT(*) AS n FROM premios_referido').first<{ n: number }>();
    expect((await premios())?.n).toBe(0);
    await e.m.DB.exec('DROP TRIGGER falla_premio');
    expect(await revisarReferidos(e.m.DB)).toBe(1);
    expect((await premios())?.n).toBe(1);
    expect(await saldoLibro(e.m.DB, invita.id, 'prepago', 'VE', 'USD')).toBe(100);
  });

  it('sin presupuesto: el referido se cierra, la alerta sale una sola vez y al subir el presupuesto vuelve a contar', async () => {
    const { e, registrar, carrera, programa } = await mundo();
    const reglas = { premio: 100, carreras: 1, dias: 30, topeMes: 10 };
    await programa('conductor', 'VE', { activo: true, presupuesto: 100, reglas });
    const invita = await registrar('repartidor', 'Ana');
    const codigo = (
      await e.m.llamar('GET', '/datos/repartidor/invitaciones', undefined, invita.token)
    ).datos.codigo as string;
    const cli = await registrar('cliente', 'Pasajero');
    for (let i = 0; i < 3; i++) {
      const c = await registrar('repartidor', `Invitado ${i}`, { invitacion: codigo });
      await carrera(c.id, cli.id);
    }
    expect(await revisarReferidos(e.m.DB)).toBe(1);
    for (let i = 0; i < 3; i++) expect(await revisarReferidos(e.m.DB)).toBe(0);
    const estados = async () =>
      (
        await e.m.DB.prepare(
          "SELECT estado || ':' || COALESCE(motivo, '') AS x FROM referidos_conductor ORDER BY x",
        ).all<{ x: string }>()
      ).results.map((r) => r.x);
    expect(await estados()).toEqual([
      'premiado:',
      'rechazado:sin_presupuesto',
      'rechazado:sin_presupuesto',
    ]);
    const alertas = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM alertas_regalo WHERE tipo = 'referido_sin_premio'",
    ).first<{ n: number }>();
    expect(alertas?.n).toBe(1);
    // El equipo sube el presupuesto: los que se quedaron sin premio vuelven a la fila.
    expect(
      (await programa('conductor', 'VE', { activo: true, presupuesto: 500, reglas })).estado,
    ).toBe(200);
    expect(await revisarReferidos(e.m.DB)).toBe(2);
    expect(await saldoLibro(e.m.DB, invita.id, 'prepago', 'VE', 'USD')).toBe(300);
  });

  it('un código que no sirve se le dice a la persona al registrarse, y no se crea la cuenta', async () => {
    const { e, registrar } = await mundo();
    const cliente = await registrar('cliente', 'Ana Cliente');
    const codigoCliente = (await e.m.llamar('GET', '/datos/referidos', undefined, cliente.token))
      .datos.codigo as string | null;
    const conductor = await registrar('repartidor', 'Beto Conductor');
    const codigoConductor = (
      await e.m.llamar('GET', '/datos/repartidor/invitaciones', undefined, conductor.token)
    ).datos.codigo as string;
    const intento = (rol: string, invitacion: string, correo: string) =>
      e.m.llamar('POST', '/datos/cuentas/registro', {
        nombre: 'Persona Nueva',
        correo,
        clave: 'clave-segura-1',
        rol,
        telefono: `+58414666${String(Math.floor(Math.random() * 9000) + 1000)}`,
        invitacion,
      });
    const noExiste = await intento('repartidor', 'NOEXISTE99', 'nuevo-a@ejemplo.com');
    expect(noExiste.estado).toBe(404);
    expect(noExiste.datos.campo).toBe('invitacion');
    // El código personal de un conductor no sirve para un cliente, ni al revés.
    expect((await intento('cliente', codigoConductor, 'nuevo-b@ejemplo.com')).estado).toBe(409);
    if (codigoCliente)
      expect((await intento('repartidor', codigoCliente, 'nuevo-c@ejemplo.com')).estado).toBe(409);
    const creadas = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM usuarios WHERE correo LIKE 'nuevo-%@ejemplo.com'",
    ).first<{ n: number }>();
    expect(creadas?.n).toBe(0);
  });
});
