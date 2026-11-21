import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { TOPE_EMERGENCIAS_LINEA_DIA, textoEmergenciaLinea } from './lineas';

/**
 * C-LINEAS-TAXI (19 nov 2026) — todos los países. Líneas de taxi y mototaxi con su líder: se crean con
 * aprobación del equipo, el conductor pide entrar y el líder acepta, un conductor una sola línea, el código
 * solo vale en su ciudad, va aparte de los referidos y la emergencia le llega al líder y al segundo contacto.
 */
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
  TWILIO_FROM: '+13055550000',
  ADMIN_CORREOS: 'dueno@ejemplo.com',
};
const MIAMI = 'US-FL-MIAMI';
const ORLANDO = 'US-FL-ORLANDO';
afterEach(() => vi.unstubAllGlobals());

function capturarSms() {
  const sms: { para: string; texto: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('api.twilio.com')) {
      const b = new URLSearchParams(String(init?.body));
      sms.push({ para: b.get('To') ?? '', texto: b.get('Body') ?? '' });
      return new Response(JSON.stringify({ sid: `SM${sms.length}` }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  });
  return sms;
}

async function escenario() {
  const sms = capturarSms();
  const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  async function conductor(nombre: string, telefono: string, zona: string | null = MIAMI) {
    const c = await m.cuenta('repartidor', nombre);
    await m.DB.prepare(
      'UPDATE usuarios SET telefono = ?, telefono_canonico = ?, zona_id = ? WHERE id = ?',
    )
      .bind(telefono, telefono.replace(/\D/g, ''), zona, c.id)
      .run();
    if (zona)
      await m.DB.prepare(
        `INSERT INTO repartidores (usuario_id, zona_id) VALUES (?, ?) ON CONFLICT(usuario_id) DO UPDATE SET zona_id = excluded.zona_id`,
      )
        .bind(c.id, zona)
        .run();
    return c;
  }
  const crear = (lider: string, extra: Record<string, unknown> = {}) =>
    m.llamar(
      'POST',
      '/datos/admin/lineas',
      {
        nombre: 'Línea Ejemplo',
        zonaId: MIAMI,
        tipo: 'mototaxi',
        lider,
        contacto2Nombre: 'Contacto Dos',
        contacto2Telefono: '+13055550202',
        ...extra,
      },
      admin.token,
    );
  return { m, admin, sms, conductor, crear };
}

describe('C-LINEAS-TAXI · crear la línea con su líder', () => {
  it('el equipo la crea con líder y segundo contacto; el código sale de la línea', async () => {
    const { crear, conductor } = await escenario();
    const lider = await conductor('Lidia Líder', '+13055550101');
    const r = await crear('+13055550101');
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    expect(r.datos.linea).toMatchObject({
      nombre: 'Línea Ejemplo',
      tipo: 'mototaxi',
      zonaId: MIAMI,
      liderId: lider.id,
    });
    expect(r.datos.linea.codigo).toMatch(/^LINEAE[A-Z2-9]{3}$/);
  });

  it('sin segundo contacto con celular completo no se crea', async () => {
    const { crear, conductor, m } = await escenario();
    await conductor('Lidia Líder', '+13055550101');
    const r = await crear('+13055550101', { contacto2Telefono: '12' });
    expect(r.estado).toBeGreaterThanOrEqual(400);
    const n = await m.DB.prepare('SELECT COUNT(*) AS n FROM lineas').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it('sin cuenta del líder no se crea la línea: queda invitado (C-INVITAR-LIDER-UN-PASO)', async () => {
    const { crear, m } = await escenario();
    const r = await crear('+13055559999');
    expect(r.estado).toBe(201);
    expect(r.datos.linea).toBeNull();
    const n = await m.DB.prepare('SELECT COUNT(*) AS n FROM lineas').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });
});

describe('C-LIDER-INVITADO · la línea de un líder que todavía no tiene cuenta', () => {
  const invitaciones = (m: Awaited<ReturnType<typeof escenario>>['m'], token: string) =>
    m.llamar('GET', '/datos/admin/lineas-invitaciones', undefined, token);

  it('sin cuenta, el panel puede invitarlo: no hay línea todavía y queda la invitación con su enlace', async () => {
    const { m, admin, crear } = await escenario();
    // C-INVITAR-LIDER-UN-PASO: en UN paso, sin segundo botón; el enlace es personal.
    const r = await crear('+13055559999');
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    expect(r.datos.linea).toBeNull();
    expect(r.datos.invitacion.enlace).toMatch(
      /^https:\/\/staging\.tumbite\.com\/driver\/lead\/[\w-]{32}$/,
    );
    // Por celular no hay correo que mandar: el panel ofrece WhatsApp.
    expect(r.datos.invitacion.correoEnviado).toBe(false);
    const n = await m.DB.prepare('SELECT COUNT(*) AS n FROM lineas').first<{ n: number }>();
    expect(n?.n).toBe(0);
    const lista = await invitaciones(m, admin.token);
    expect(lista.datos.invitaciones).toHaveLength(1);
    expect(lista.datos.invitaciones[0].nombre).toBe('Línea Ejemplo');
    // La misma persona no queda invitada dos veces.
    expect((await crear('+13055559999')).estado).toBe(409);
  });

  it('el líder se registra con ese celular, abre «Mi línea» y ya es el líder; la invitación se usa una sola vez', async () => {
    const { m, admin, crear, conductor } = await escenario();
    await crear('+13055559999', { invitar: true });
    const otro = await conductor('Otro Conductor', '+13055550333');
    const ajena = await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, otro.token);
    expect(ajena.datos.linea).toBeNull();
    const lider = await conductor('Lidia Líder', '+13055559999');
    const mia = await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, lider.token);
    expect(mia.estado, JSON.stringify(mia.datos)).toBe(200);
    expect(mia.datos.linea.rol).toBe('lider');
    expect(mia.datos.linea.nombre).toBe('Línea Ejemplo');
    expect(mia.datos.linea.codigo).toBeTruthy();
    await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, lider.token);
    const n = await m.DB.prepare('SELECT COUNT(*) AS n FROM lineas').first<{ n: number }>();
    expect(n?.n).toBe(1);
    expect((await invitaciones(m, admin.token)).datos.invitaciones).toHaveLength(0);
  });

  it('también vale invitarlo por correo', async () => {
    const { m, crear } = await escenario();
    const lider = await m.cuenta('repartidor', 'Lidia Líder');
    const correo = (
      await m.DB.prepare('SELECT correo FROM usuarios WHERE id = ?').bind(lider.id).first<{
        correo: string;
      }>()
    )?.correo;
    await m.DB.prepare("UPDATE usuarios SET rol = 'cliente' WHERE id = ?").bind(lider.id).run();
    expect((await crear(String(correo), { invitar: true })).estado).toBe(201);
    await m.DB.prepare("UPDATE usuarios SET rol = 'repartidor' WHERE id = ?").bind(lider.id).run();
    const mia = await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, lider.token);
    expect(mia.datos.linea?.rol).toBe('lider');
  });

  it('una invitación anulada ya no crea nada, y sin correo ni celular completo no se invita', async () => {
    const { m, admin, crear, conductor } = await escenario();
    expect((await crear('solo un nombre', { invitar: true })).estado).toBe(422);
    const r = await crear('+13055559999', { invitar: true });
    const fuera = await m.llamar(
      'POST',
      `/datos/admin/lineas-invitaciones/${r.datos.invitacion.id}/anular`,
      {},
      admin.token,
    );
    expect(fuera.estado).toBe(200);
    const lider = await conductor('Lidia Líder', '+13055559999');
    const mia = await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, lider.token);
    expect(mia.datos.linea).toBeNull();
    const ajeno = await m.llamar('GET', '/datos/admin/lineas-invitaciones', undefined, lider.token);
    expect(ajeno.estado).toBe(403);
  });

  it('aprobar una solicitud de «Registra tu línea» sin cuenta del líder: se invita y la línea nace cuando se registra', async () => {
    const { m, admin, conductor } = await escenario();
    await m.llamar('POST', '/datos/publico/lineas/solicitud', {
      nombre: 'Línea Del Norte',
      zonaId: MIAMI,
      tipo: 'taxi',
      conductores: 12,
      liderNombre: 'Lidia Líder',
      liderTelefono: '+13055550101',
      contacto2Nombre: 'Contacto Dos',
      contacto2Telefono: '+13055550202',
    });
    const lista = await m.llamar('GET', '/datos/admin/lineas-solicitudes', undefined, admin.token);
    const id = lista.datos.solicitudes[0].id;
    const ruta = `/datos/admin/lineas-solicitudes/${id}/aprobar`;
    const ok = await m.llamar('POST', ruta, {}, admin.token);
    expect(ok.estado, JSON.stringify(ok.datos)).toBe(201);
    expect(ok.datos.invitacion.enlace).toContain('/driver/lead/');
    const lider = await conductor('Lidia Líder', '+13055550101');
    const mia = await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, lider.token);
    expect(mia.datos.linea.nombre).toBe('Línea Del Norte');
    const s = await m.DB.prepare('SELECT estado, equipo_id FROM solicitudes_linea WHERE id = ?')
      .bind(id)
      .first<{ estado: string; equipo_id: string | null }>();
    expect(s?.estado).toBe('aprobada');
    expect(s?.equipo_id).toBeTruthy();
  });
});

describe('C-LINEAS-TAXI · el conductor pide entrar y el líder acepta', () => {
  async function conLinea() {
    const e = await escenario();
    const lider = await e.conductor('Lidia Líder', '+13055550101');
    const l = (await e.crear('+13055550101')).datos.linea;
    return { ...e, lider, l };
  }

  it('pide con el código, el líder acepta con un toque y queda en «Mi equipo»; no hay referido ni premio', async () => {
    const { m, conductor, lider, l } = await conLinea();
    const c = await conductor('Carlos Conductor', '+13055550303');
    const p = await m.llamar(
      'POST',
      '/datos/repartidor/linea/pedir',
      { codigo: l.codigo },
      c.token,
    );
    expect(p.estado, JSON.stringify(p.datos)).toBe(201);
    expect(p.datos.pendiente).toBe(true);
    // Todavía no es miembro.
    expect(
      (await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, c.token)).datos.linea.rol,
    ).toBe('pendiente');
    const vista = await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, lider.token);
    expect(vista.datos.linea.rol).toBe('lider');
    expect(vista.datos.linea.solicitudes).toHaveLength(1);
    const ok = await m.llamar(
      'POST',
      `/datos/repartidor/linea/solicitudes/${c.id}`,
      { aceptar: true },
      lider.token,
    );
    expect(ok.estado).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, c.token)).datos.linea,
    ).toMatchObject({ rol: 'miembro', nombre: 'Línea Ejemplo' });
    const equipo = await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, lider.token);
    expect(equipo.datos.linea.miembros.map((x: { nombre: string }) => x.nombre)).toEqual([
      'Carlos Conductor',
    ]);
    const ref = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM referidos_conductor WHERE invitado_id = ?',
    )
      .bind(c.id)
      .first<{ n: number }>();
    expect(ref?.n).toBe(0);
  });

  it('el líder también puede rechazar y el conductor puede pedir otra línea', async () => {
    const { m, conductor, lider, l } = await conLinea();
    const c = await conductor('Carlos Conductor', '+13055550303');
    await m.llamar('POST', '/datos/repartidor/linea/pedir', { lineaId: l.id }, c.token);
    await m.llamar(
      'POST',
      `/datos/repartidor/linea/solicitudes/${c.id}`,
      { aceptar: false },
      lider.token,
    );
    expect(
      (await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, c.token)).datos.linea,
    ).toBeNull();
  });

  it('un conductor, una sola línea', async () => {
    const { m, conductor, lider, l, crear } = await conLinea();
    const otroLider = await conductor('Otto Otro', '+13055550404');
    const l2 = (await crear('+13055550404', { nombre: 'Otra Línea' })).datos.linea;
    const c = await conductor('Carlos Conductor', '+13055550303');
    await m.llamar('POST', '/datos/repartidor/linea/pedir', { codigo: l.codigo }, c.token);
    await m.llamar(
      'POST',
      `/datos/repartidor/linea/solicitudes/${c.id}`,
      { aceptar: true },
      lider.token,
    );
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/linea/pedir',
      { codigo: l2.codigo },
      c.token,
    );
    expect(r.estado).toBe(409);
    expect(otroLider.id).toBeTruthy();
  });

  it('el código solo vale en la ciudad de la línea', async () => {
    const { m, conductor, l } = await conLinea();
    const deOrlando = await conductor('Olga Orlando', '+13055550505', ORLANDO);
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/linea/pedir',
      { codigo: l.codigo },
      deOrlando.token,
    );
    expect(r.estado).toBe(409);
    expect(JSON.stringify(r.datos)).toContain('solo vale');
  });

  it('al registrarse con el código de la línea queda como solicitud, no como miembro', async () => {
    const { m, l } = await conLinea();
    const r = await m.llamar('POST', '/datos/cuentas/registro', {
      nombre: 'Nuevo Nico',
      correo: `nico-${Math.random().toString(36).slice(2)}@ejemplo.com`,
      clave: 'clave-segura-1',
      rol: 'repartidor',
      invitacion: l.codigo,
    });
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const v = await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, r.datos.token);
    expect(v.datos.linea).toMatchObject({ rol: 'pendiente' });
  });

  it('el líder saca a un conductor y los demás no pueden', async () => {
    const { m, conductor, lider, l } = await conLinea();
    const c = await conductor('Carlos Conductor', '+13055550303');
    const d = await conductor('Dora Conductora', '+13055550606');
    await m.llamar('POST', '/datos/repartidor/linea/pedir', { codigo: l.codigo }, c.token);
    await m.llamar(
      'POST',
      `/datos/repartidor/linea/solicitudes/${c.id}`,
      { aceptar: true },
      lider.token,
    );
    expect(
      (await m.llamar('POST', `/datos/repartidor/linea/miembros/${c.id}/sacar`, {}, d.token))
        .estado,
    ).toBe(403);
    expect(
      (await m.llamar('POST', `/datos/repartidor/linea/miembros/${c.id}/sacar`, {}, lider.token))
        .estado,
    ).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, c.token)).datos.linea,
    ).toBeNull();
  });

  it('las líneas de la ciudad se eligen de una lista con buscador', async () => {
    const { m, conductor } = await conLinea();
    const c = await conductor('Carlos Conductor', '+13055550303');
    const todas = await m.llamar('GET', '/datos/repartidor/lineas', undefined, c.token);
    expect(todas.datos.lineas).toHaveLength(1);
    expect(JSON.stringify(todas.datos)).not.toContain('13055550101');
    expect(
      (await m.llamar('GET', '/datos/repartidor/lineas?q=lineá%20ejem', undefined, c.token)).datos
        .lineas,
    ).toHaveLength(1);
    expect(
      (await m.llamar('GET', '/datos/repartidor/lineas?q=zzz', undefined, c.token)).datos.lineas,
    ).toHaveLength(0);
  });

  it('el equipo busca por nombre, código, líder o teléfono y mueve a un conductor entre líneas', async () => {
    const { m, admin, conductor, lider, l, crear } = await conLinea();
    await conductor('Otto Otro', '+13055550404');
    const l2 = (await crear('+13055550404', { nombre: 'Otra Línea' })).datos.linea;
    const c = await conductor('Carlos Conductor', '+13055550303');
    await m.llamar('POST', '/datos/repartidor/linea/pedir', { codigo: l.codigo }, c.token);
    await m.llamar(
      'POST',
      `/datos/repartidor/linea/solicitudes/${c.id}`,
      { aceptar: true },
      lider.token,
    );
    for (const q of ['otra', 'lidia', l.codigo.toLowerCase(), '0101', 'mototaxi']) {
      const r = await m.llamar(
        'GET',
        `/datos/admin/lineas?q=${encodeURIComponent(q)}`,
        undefined,
        admin.token,
      );
      expect(r.datos.lineas.length, q).toBeGreaterThan(0);
    }
    const mv = await m.llamar(
      'POST',
      '/datos/admin/lineas/mover',
      { conductorId: c.id, lineaId: l2.id },
      admin.token,
    );
    expect(mv.estado).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, c.token)).datos.linea.nombre,
    ).toBe('Otra Línea');
    const sin = await m.llamar(
      'POST',
      '/datos/admin/lineas/mover',
      { conductorId: c.id, lineaId: null },
      admin.token,
    );
    expect(sin.estado).toBe(200);
    expect(
      (await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, c.token)).datos.linea,
    ).toBeNull();
  });
});

describe('C-LINEAS-TAXI · «Registra tu línea» pide aprobación', () => {
  const formulario = (extra: Record<string, unknown> = {}) => ({
    nombre: 'Línea Del Norte',
    zonaId: MIAMI,
    tipo: 'taxi',
    conductores: 12,
    liderNombre: 'Lidia Líder',
    liderTelefono: '+13055550101',
    contacto2Nombre: 'Contacto Dos',
    contacto2Telefono: '+13055550202',
    ...extra,
  });

  it('la solicitud llega al equipo y no crea ninguna línea hasta que la aprueba', async () => {
    const { m, admin, conductor } = await escenario();
    await conductor('Lidia Líder', '+13055550101');
    const r = await m.llamar('POST', '/datos/publico/lineas/solicitud', formulario());
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const antes = await m.DB.prepare('SELECT COUNT(*) AS n FROM lineas').first<{ n: number }>();
    expect(antes?.n).toBe(0);
    const lista = await m.llamar('GET', '/datos/admin/lineas-solicitudes', undefined, admin.token);
    expect(lista.datos.solicitudes).toHaveLength(1);
    const ok = await m.llamar(
      'POST',
      `/datos/admin/lineas-solicitudes/${lista.datos.solicitudes[0].id}/aprobar`,
      {},
      admin.token,
    );
    expect(ok.estado, JSON.stringify(ok.datos)).toBe(201);
    expect(ok.datos.linea.nombre).toBe('Línea Del Norte');
    const hecha = await m.llamar(
      'GET',
      '/datos/admin/lineas-solicitudes?estado=aprobada',
      undefined,
      admin.token,
    );
    expect(hecha.datos.solicitudes).toHaveLength(1);
  });

  it('rechazar la deja anotada con su motivo y sin línea', async () => {
    const { m, admin } = await escenario();
    await m.llamar('POST', '/datos/publico/lineas/solicitud', formulario());
    const id = (await m.llamar('GET', '/datos/admin/lineas-solicitudes', undefined, admin.token))
      .datos.solicitudes[0].id;
    const r = await m.llamar(
      'POST',
      `/datos/admin/lineas-solicitudes/${id}/rechazar`,
      { motivo: 'Teléfono no verificado' },
      admin.token,
    );
    expect(r.estado).toBe(200);
    const n = await m.DB.prepare('SELECT COUNT(*) AS n FROM lineas').first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it('el formulario pide los seis datos y rechaza teléfonos incompletos; la misma solicitud no se duplica', async () => {
    const { m } = await escenario();
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/publico/lineas/solicitud',
          formulario({ liderTelefono: '305' }),
        )
      ).estado,
    ).toBeGreaterThanOrEqual(400);
    expect(
      (await m.llamar('POST', '/datos/publico/lineas/solicitud', formulario({ nombre: '' })))
        .estado,
    ).toBe(400);
    expect(
      (await m.llamar('POST', '/datos/publico/lineas/solicitud', formulario({ tipo: 'bus' })))
        .estado,
    ).toBe(400);
    await m.llamar('POST', '/datos/publico/lineas/solicitud', formulario());
    const otra = await m.llamar('POST', '/datos/publico/lineas/solicitud', formulario());
    expect(otra.datos.repetida).toBe(true);
    const n = await m.DB.prepare('SELECT COUNT(*) AS n FROM solicitudes_linea').first<{
      n: number;
    }>();
    expect(n?.n).toBe(1);
  });

  it('solo el equipo ve las solicitudes y las ciudades públicas no traen las de pruebas', async () => {
    const { m } = await escenario();
    expect(
      (await m.llamar('GET', '/datos/admin/lineas-solicitudes')).estado,
    ).toBeGreaterThanOrEqual(401);
    const c = await m.llamar('GET', '/datos/publico/lineas/ciudades');
    expect(c.estado).toBe(200);
    expect(JSON.stringify(c.datos)).not.toMatch(/pruebas/i);
  });
});

describe('C-LINEAS-TAXI · quien ya entró con el código personal del líder pasa a la línea', () => {
  it('al crear la línea, los invitados por el líder quedan aceptados', async () => {
    const { m, conductor, crear } = await escenario();
    const lider = await conductor('Lidia Líder', '+13055550101');
    const invitado = await conductor('Ivo Invitado', '+13055550707');
    await m.DB.prepare(
      'INSERT INTO referidos_conductor (invitado_id, invitador_id, zona_id, estado) VALUES (?, ?, ?, ?)',
    )
      .bind(invitado.id, lider.id, MIAMI, 'pendiente')
      .run();
    const r = await crear('+13055550101');
    expect(r.datos.adoptados).toBe(1);
    expect(
      (await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, invitado.token)).datos.linea
        .rol,
    ).toBe('miembro');
  });
});

describe('C-LINEAS-TAXI · la emergencia llega al líder y al segundo contacto', () => {
  async function conLineaYMiembro() {
    const e = await escenario();
    const lider = await e.conductor('Lidia Líder', '+13055550101');
    const l = (await e.crear('+13055550101')).datos.linea;
    const c = await e.conductor('Carlos Conductor', '+13055550303');
    await e.m.llamar('POST', '/datos/repartidor/linea/pedir', { codigo: l.codigo }, c.token);
    await e.m.llamar(
      'POST',
      `/datos/repartidor/linea/solicitudes/${c.id}`,
      { aceptar: true },
      lider.token,
    );
    return { ...e, lider, l, c };
  }

  it('SMS con nombre, teléfono y mapa al líder y al segundo contacto', async () => {
    const { m, c, sms } = await conLineaYMiembro();
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/emergencia',
      { lat: 25.77, lng: -80.19 },
      c.token,
    );
    expect(r.estado).toBe(201);
    const aLinea = sms.filter((s) => s.texto.includes('tu línea'));
    expect(aLinea.map((s) => s.para).sort()).toEqual(['+13055550101', '+13055550202']);
    expect(aLinea[0]!.texto).toContain('Carlos Conductor');
    expect(aLinea[0]!.texto).toContain('query=25.77,-80.19');
  });

  it('el conductor sin línea no avisa a ninguna línea (le llega al equipo de su ciudad)', async () => {
    const { m, conductor, sms } = await escenario();
    const solo = await conductor('Sol Sola', '+13055550808');
    await m.llamar('POST', '/datos/repartidor/emergencia', { lat: 25.77, lng: -80.19 }, solo.token);
    expect(sms.filter((s) => s.texto.includes('tu línea'))).toHaveLength(0);
  });

  it('tope por conductor y por día: pasado el tope no salen más SMS a la línea', async () => {
    const { m, c, sms } = await conLineaYMiembro();
    for (let i = 0; i < TOPE_EMERGENCIAS_LINEA_DIA + 2; i++)
      await m.llamar('POST', '/datos/repartidor/emergencia', { lat: 25.77, lng: -80.19 }, c.token);
    expect(sms.filter((s) => s.texto.includes('tu línea'))).toHaveLength(
      TOPE_EMERGENCIAS_LINEA_DIA * 2,
    );
  });

  it('el texto nunca pasa del largo de un SMS y dice si no hay ubicación', () => {
    const t = textoEmergenciaLinea(
      { usuarioId: 'x', nombre: 'A'.repeat(600), telefono: null, referencia: '' },
      'Línea',
    );
    expect(t.length).toBeLessThanOrEqual(480);
    expect(
      textoEmergenciaLinea({ usuarioId: 'x', nombre: 'Ana', telefono: null, referencia: '' }, 'L'),
    ).toContain('sin ubicación');
  });
});

describe('C-CONTACTO2-EDITABLE · el segundo contacto de emergencia se corrige después', () => {
  it('en una línea creada: el equipo lo cambia y queda en la auditoría con el antes y el después', async () => {
    const { m, admin, crear, conductor } = await escenario();
    await conductor('Lidia Líder', '+13055550101');
    const r = await crear('+13055550101');
    const id = r.datos.linea.id as string;
    const e = await m.llamar(
      'PATCH',
      `/datos/admin/lineas/${id}/contacto2`,
      { contacto2Nombre: 'Marta Definitiva', contacto2Telefono: '+13055550404' },
      admin.token,
    );
    expect(e.estado, JSON.stringify(e.datos)).toBe(200);
    const l = await m.DB.prepare(
      'SELECT contacto2_nombre AS n, contacto2_telefono AS t FROM lineas WHERE equipo_id = ?',
    )
      .bind(id)
      .first<{ n: string; t: string }>();
    expect(l).toEqual({ n: 'Marta Definitiva', t: '+13055550404' });
    const a = await m.DB.prepare(
      "SELECT actor_id, antes_json, despues_json FROM auditoria_admin WHERE accion = 'linea_contacto2' AND objeto = ?",
    )
      .bind(id)
      .first<{ actor_id: string; antes_json: string; despues_json: string }>();
    expect(a?.actor_id).toBe(admin.id);
    expect(a?.antes_json).toContain('Contacto Dos');
    expect(a?.despues_json).toContain('Marta Definitiva');
  });

  it('en un líder invitado (pendiente): también se cambia, y la línea nace con el contacto nuevo', async () => {
    const { m, admin, crear, conductor } = await escenario();
    const r = await crear('+13055559999', { invitar: true });
    const inv = r.datos.invitacion.id as string;
    const e = await m.llamar(
      'PATCH',
      `/datos/admin/lineas-invitaciones/${inv}/contacto2`,
      { contacto2Nombre: 'Marta Definitiva', contacto2Telefono: '+13055550404' },
      admin.token,
    );
    expect(e.estado, JSON.stringify(e.datos)).toBe(200);
    const lider = await conductor('Lidia Líder', '+13055559999');
    await m.llamar('GET', '/datos/repartidor/mi-linea', undefined, lider.token);
    const l = await m.DB.prepare('SELECT contacto2_nombre AS n FROM lineas').first<{ n: string }>();
    expect(l?.n).toBe('Marta Definitiva');
  });

  it('el nombre no puede ser un teléfono, ni al crear ni al corregir; y solo el equipo lo cambia', async () => {
    const { m, admin, crear, conductor } = await escenario();
    const lider = await conductor('Lidia Líder', '+13055550101');
    const mal = await crear('+13055550101', { contacto2Nombre: '+1 305 555 0202' });
    expect(mal.estado).toBe(422);
    expect(mal.datos.campo).toBe('contacto2Nombre');
    expect(mal.datos.error).toMatch(/nombre de la persona|person’s name/);
    const malLinea = await crear('+13055550101', { nombre: '3055550202' });
    expect(malLinea.estado).toBe(422);
    expect(malLinea.datos.campo).toBe('nombre');
    const r = await crear('+13055550101');
    const id = r.datos.linea.id as string;
    const e = await m.llamar(
      'PATCH',
      `/datos/admin/lineas/${id}/contacto2`,
      { contacto2Nombre: '305 555 0404', contacto2Telefono: '+13055550404' },
      admin.token,
    );
    expect(e.estado).toBe(422);
    const ajeno = await m.llamar(
      'PATCH',
      `/datos/admin/lineas/${id}/contacto2`,
      { contacto2Nombre: 'Marta', contacto2Telefono: '+13055550404' },
      lider.token,
    );
    expect(ajeno.estado).toBe(403);
  });
});
