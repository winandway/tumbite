import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { conductorDeMoto } from './pruebas/conductorMoto';
import type { Env } from './env';
import { enviarSms } from './sms';

/**
 * C-PANICO-ZONA (16 nov 2026, piloto de El Vigía y Tucaní) — todos los países. El botón de pánico
 * del pasajero, del conductor y del repartidor le manda un SMS a la persona responsable de ESA zona
 * (configurable en el superadmin) con quién es, su teléfono, el enlace del mapa y el viaje o
 * pedido. Sale a +58 aunque los demás SMS a Venezuela sigan apagados (SMS_PREFIJOS = +1).
 */
const TWILIO = {
  TWILIO_ACCOUNT_SID: 'ACprueba0000000000000000000000000',
  TWILIO_AUTH_TOKEN: 'token-de-prueba-largo-123',
  TWILIO_FROM: '+13055550000',
  ADMIN_CORREOS: 'dueno@ejemplo.com',
};
const ZONA = 'US-FL-MIAMI';
const RESPONSABLE = '+58 412 000 0000';
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };

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
  const r = await m.llamar(
    'PATCH',
    `/datos/admin/zonas/${ZONA}`,
    { responsableNombre: 'Responsable Zona', responsableTelefono: RESPONSABLE },
    admin.token,
  );
  expect(r.estado).toBe(200);
  return { m, admin, sms };
}

describe('C-PANICO-ZONA · el pánico avisa al responsable de la zona', () => {
  it('el superadmin guarda el responsable; la lista pública de zonas no muestra su teléfono', async () => {
    const { m, admin } = await escenario();
    const lista = await m.llamar('GET', '/datos/admin/zonas', undefined, admin.token);
    const z = lista.datos.zonas.find((x: { id: string }) => x.id === ZONA);
    // El panel lo muestra enmascarado, como todo teléfono; en la base queda completo.
    expect(z.responsableNombre).toBe('Responsable Zona');
    expect(z.responsableTelefono).toMatch(/0000$/);
    const guardado = await m.DB.prepare('SELECT responsable_telefono AS t FROM zonas WHERE id = ?')
      .bind(ZONA)
      .first<{ t: string }>();
    expect(guardado?.t).toBe('+584120000000');
    const publica = await m.llamar('GET', '/datos/zonas');
    expect(JSON.stringify(publica.datos)).not.toContain('584120000000');
    const mal = await m.llamar(
      'PATCH',
      `/datos/admin/zonas/${ZONA}`,
      { responsableTelefono: '0412 000 0000' },
      admin.token,
    );
    expect(mal.estado).toBe(400);
  });

  it('el pánico del repartidor llega por SMS a +58 con nombre, mapa y pedido', async () => {
    const { m, sms } = await escenario();
    const rep = await m.cuenta('repartidor', 'Rita Riesgo');
    // Sin ficha de repartidor con zona: se toma la zona del lugar donde tocó el botón.
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/emergencia',
      { lat: 25.77, lng: -80.19, pedidoId: 'P-123' },
      rep.token,
    );
    expect(r.estado).toBe(201);
    const alResponsable = sms.filter((s) => s.para === '+584120000000');
    expect(alResponsable).toHaveLength(1);
    expect(alResponsable[0]!.texto).toContain('PÁNICO');
    expect(alResponsable[0]!.texto).toContain('Rita Riesgo');
    expect(alResponsable[0]!.texto).toContain('google.com/maps/search/?api=1&query=25.77,-80.19');
    expect(alResponsable[0]!.texto).toContain('Pedido P-123');
  });

  it('el pánico del pasajero y del conductor en un viaje llega al responsable con el viaje', async () => {
    const { m, admin, sms } = await escenario();
    for (const ruta of ['/datos/admin/servicios/moto', `/datos/admin/servicios/moto/zonas/${ZONA}`])
      await m.llamar('PUT', ruta, { estado: 'disponible' }, admin.token);
    await m.llamar(
      'POST',
      '/datos/admin/viajes/tarifas',
      {
        servicio: 'moto',
        zona: ZONA,
        tarifa: { base: 150, porKm: 60, porMinuto: 12, minimo: 400 },
        motivo: 'Tarifa de prueba',
      },
      admin.token,
    );
    const cliente = await m.cuenta('cliente', 'Pasajero Uno');
    const cond = await conductorDeMoto(m, ORIGEN);
    const cot = await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
      cliente.token,
    );
    const id = (
      await m.llamar(
        'POST',
        '/datos/viajes',
        { cotizacionId: cot.datos.cotizacion.id, metodoPago: 'efectivo' },
        cliente.token,
      )
    ).datos.viaje.id as string;
    await m.llamar(
      'POST',
      `/datos/viajes/${id}/emergencia`,
      { lat: 25.76, lng: -80.19 },
      cliente.token,
    );
    expect(await cond.paso(id, 'aceptar')).toBe(200);
    await m.llamar('POST', `/datos/conductor/operaciones/${id}/emergencia`, {}, cond.token);
    const alResponsable = sms.filter((s) => s.para === '+584120000000');
    expect(alResponsable).toHaveLength(2);
    expect(alResponsable[0]!.texto).toContain('el pasajero Pasajero Uno');
    expect(alResponsable[0]!.texto).toContain(`Viaje ${id}`);
    expect(alResponsable[0]!.texto).toContain('query=25.76,-80.19');
    expect(alResponsable[1]!.texto).toContain('el conductor');
    expect(alResponsable[1]!.texto).toContain('sin ubicación');
  });

  it('fuera de +1 sale del número internacional si existe (el 866 solo llega a EE. UU. y Canadá)', async () => {
    const { remitente } = await import('./sms');
    const e = { ...TWILIO, TWILIO_FROM_INTERNACIONAL: '+15074160000' } as unknown as Env;
    expect(remitente(e, '+584120000000')).toBe('+15074160000');
    expect(remitente(e, '+12485550100')).toBe('+13055550000');
    expect(remitente(TWILIO as unknown as Env, '+584120000000')).toBe('+13055550000');
  });

  it('tope diario: pasado el tope no sale más pánico, y cada envío queda registrado', async () => {
    const sms = capturarSms();
    const m = mundo(TWILIO);
    const quien = await m.cuenta('repartidor', 'Rita Riesgo');
    const { TOPE_PANICO_DIA } = await import('./sms');
    const mandar = () =>
      enviarSms(TWILIO as unknown as Env, m.DB, {
        usuarioId: quien.id,
        pedidoId: null,
        tipo: 'equipo_panico',
        telefono: '+584120000000',
        texto: 'pánico',
      });
    expect(await mandar()).toBe(true);
    await m.DB.prepare(
      "INSERT INTO sms_enviados (id, usuario_id, pedido_id, tipo, estado) SELECT 'x' || value, ?, NULL, 'equipo_panico', 'enviado' FROM json_each(?)",
    )
      .bind(quien.id, JSON.stringify(Array.from({ length: TOPE_PANICO_DIA }, (_, i) => i)))
      .run();
    expect(await mandar()).toBe(false);
    expect(sms).toHaveLength(1);
    const n = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM sms_enviados WHERE tipo = 'equipo_panico'",
    ).first<{ n: number }>();
    expect(n?.n).toBe(TOPE_PANICO_DIA + 1);
  });

  it('los demás SMS a Venezuela siguen apagados (solo el pánico sale a +58)', async () => {
    const sms = capturarSms();
    const m = mundo(TWILIO);
    const ok = await enviarSms(TWILIO as unknown as Env, m.DB, {
      usuarioId: 'x',
      pedidoId: null,
      tipo: 'equipo_sistema',
      telefono: '+584120000000',
      texto: 'hola',
    });
    expect(ok).toBe(false);
    expect(sms).toHaveLength(0);
  });
});

/**
 * C-PANICO-INSISTE, C-PANICO-CENTRAL y C-PANICO-PANEL (24 nov 2026) — todos los países. El pánico
 * suena con su canal propio, insiste hasta que alguien lo abre o lo atiende, el de un VIAJE también
 * va por SMS al equipo, y si la zona no tiene responsable cae en el equipo central (y el canario lo
 * marca en rojo).
 */
function capturarTodo() {
  const sms: { para: string; texto: string }[] = [];
  const expo: { to: string; channelId: string; sound: string; title: string }[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('api.twilio.com')) {
      const b = new URLSearchParams(String(init?.body));
      sms.push({ para: b.get('To') ?? '', texto: b.get('Body') ?? '' });
      return new Response(JSON.stringify({ sid: `SM${sms.length}` }), { status: 200 });
    }
    if (String(url).includes('exp.host')) {
      const lote = JSON.parse(String(init?.body)) as typeof expo;
      expo.push(...lote);
      return new Response(JSON.stringify({ data: lote.map(() => ({ status: 'ok' })) }), {
        status: 200,
      });
    }
    return new Response('{}', { status: 200 });
  });
  return { sms, expo };
}

async function equipoConTelefono(m: ReturnType<typeof mundo>) {
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  await m.DB.prepare(
    "UPDATE usuarios SET correo = 'dueno@ejemplo.com', telefono = '+13055550111' WHERE id = ?",
  )
    .bind(admin.id)
    .run();
  return admin;
}

async function telefonoConCanales(m: ReturnType<typeof mundo>, usuarioId: string, token: string) {
  await m.DB.prepare(
    "INSERT INTO dispositivos (token, usuario_id, plataforma, capacidades) VALUES (?, ?, 'android', ?)",
  )
    .bind(token, usuarioId, 'ofertas-bucle,canal-panico,canal-dinero')
    .run();
}

async function viajeConEmergencia(m: ReturnType<typeof mundo>, admin: { token: string }) {
  for (const ruta of ['/datos/admin/servicios/moto', `/datos/admin/servicios/moto/zonas/${ZONA}`])
    await m.llamar('PUT', ruta, { estado: 'disponible' }, admin.token);
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    {
      servicio: 'moto',
      zona: ZONA,
      tarifa: { base: 150, porKm: 60, porMinuto: 12, minimo: 400 },
      motivo: 'Tarifa de prueba',
    },
    admin.token,
  );
  const cliente = await m.cuenta('cliente', 'Pasajero Uno');
  await conductorDeMoto(m, ORIGEN);
  const cot = await m.llamar(
    'POST',
    '/datos/viajes/cotizar',
    { servicio: 'moto', origen: ORIGEN, destino: DESTINO },
    cliente.token,
  );
  const id = (
    await m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.datos.cotizacion.id, metodoPago: 'efectivo' },
      cliente.token,
    )
  ).datos.viaje.id as string;
  const r = await m.llamar(
    'POST',
    `/datos/viajes/${id}/emergencia`,
    { lat: 25.76, lng: -80.19 },
    cliente.token,
  );
  expect(r.estado).toBeLessThan(300);
  return { id, cliente };
}

describe('C-PANICO-CENTRAL · el pánico de un viaje también va por SMS al equipo', () => {
  it('con responsable: SMS al responsable Y al equipo, sin montos', async () => {
    const { sms } = capturarTodo();
    const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
    const admin = await equipoConTelefono(m);
    await m.llamar(
      'PATCH',
      `/datos/admin/zonas/${ZONA}`,
      { responsableNombre: 'Responsable Zona', responsableTelefono: RESPONSABLE },
      admin.token,
    );
    await viajeConEmergencia(m, admin);
    expect(sms.filter((s) => s.para === '+584120000000')).toHaveLength(1);
    const alEquipo = sms.filter((s) => s.para === '+13055550111');
    expect(alEquipo).toHaveLength(1);
    expect(alEquipo[0]!.texto).toContain('PÁNICO en un viaje');
    expect(alEquipo[0]!.texto).toContain('el pasajero Pasajero Uno');
    expect(alEquipo[0]!.texto).not.toMatch(/\$\d/);
  });

  it('sin responsable: cae en el equipo central (SMS una vez y aviso al celular con el canal de pánico)', async () => {
    const { sms, expo } = capturarTodo();
    const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
    const admin = await equipoConTelefono(m);
    await telefonoConCanales(m, admin.id, 'ExponentPushToken[equipo-central-1]');
    const rep = await m.cuenta('repartidor', 'Rita Riesgo');
    const r = await m.llamar(
      'POST',
      '/datos/repartidor/emergencia',
      { lat: 25.77, lng: -80.19 },
      rep.token,
    );
    expect(r.estado).toBe(201);
    // El SMS de la emergencia del repartidor ya iba al equipo: no se repite por la caída.
    expect(sms.filter((s) => s.para === '+13055550111')).toHaveLength(1);
    const alEquipo = expo.filter((x) => x.to === 'ExponentPushToken[equipo-central-1]');
    expect(alEquipo).toHaveLength(1);
    expect(alEquipo[0]!.channelId).toBe('panico');
    expect(alEquipo[0]!.sound).toBe('panico.wav');
    expect(alEquipo[0]!.title).toMatch(/^(PÁNICO|PANIC)/);
  });

  it('el canario marca en rojo una zona activa sin responsable, sin tumbar la salud', async () => {
    capturarTodo();
    const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
    const admin = await equipoConTelefono(m);
    await conductorDeMoto(m, ORIGEN);
    const { saludPanicoZonas } = await import('./panicoZona');
    expect(await saludPanicoZonas(m.DB)).toBe('error');
    const { PIEZAS_DE_OPERACION } = await import('./aprobadosNoElegibles');
    expect(PIEZAS_DE_OPERACION.has('panicoZonas')).toBe(true);
    await m.llamar(
      'PATCH',
      `/datos/admin/zonas/${ZONA}`,
      { responsableNombre: 'Responsable Zona', responsableTelefono: RESPONSABLE },
      admin.token,
    );
    expect(await saludPanicoZonas(m.DB)).toBe('ok');
  });
});

describe('C-PANICO-INSISTE · el pánico insiste hasta que alguien lo abre o lo atiende', () => {
  it('se repite a los 2, 4 y 6 minutos, nunca más, y para al abrirlo', async () => {
    const { expo } = capturarTodo();
    const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
    const admin = await equipoConTelefono(m);
    await m.llamar(
      'PATCH',
      `/datos/admin/zonas/${ZONA}`,
      { responsableNombre: 'Responsable Zona', responsableTelefono: RESPONSABLE },
      admin.token,
    );
    const responsable = await m.cuenta('repartidor', 'Responsable Zona');
    await m.DB.prepare("UPDATE usuarios SET telefono = '+584120000000' WHERE id = ?")
      .bind(responsable.id)
      .run();
    await telefonoConCanales(m, responsable.id, 'ExponentPushToken[responsable-1]');
    await viajeConEmergencia(m, admin);
    const al = () => expo.filter((x) => x.to === 'ExponentPushToken[responsable-1]');
    expect(al()).toHaveLength(1);
    expect(al()[0]!.channelId).toBe('panico');
    const { insistirPanicos } = await import('./panicoZona');
    const env = { ...TWILIO, DB: m.DB } as unknown as Env;
    const atrasar = (min: number) =>
      m.DB.prepare(
        `UPDATE emergencias_viaje SET creado_en = datetime('now', '-${min} minutes')`,
      ).run();
    expect(await insistirPanicos(env, m.DB)).toBe(0); // recién tocado: nada
    await atrasar(2);
    expect(await insistirPanicos(env, m.DB)).toBe(1);
    expect(await insistirPanicos(env, m.DB)).toBe(0); // misma vuelta: no repite
    expect(al()).toHaveLength(2);
    expect(al()[1]!.title).toContain('still unanswered');
    // Lo abre en el teléfono: deja de insistir.
    const id = (await m.DB.prepare('SELECT id FROM emergencias_viaje').first<{ id: string }>())!.id;
    expect(
      (await m.llamar('POST', `/datos/panico/${id}/visto`, {}, responsable.token)).estado,
    ).toBe(200);
    await atrasar(5);
    expect(await insistirPanicos(env, m.DB)).toBe(0);
    expect(al()).toHaveLength(2);
  });

  it('marcado atendido en el panel tampoco insiste; con 7 minutos van las tres y ninguna más', async () => {
    const { expo } = capturarTodo();
    const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
    const admin = await equipoConTelefono(m);
    await telefonoConCanales(m, admin.id, 'ExponentPushToken[equipo-central-2]');
    await viajeConEmergencia(m, admin);
    const { insistirPanicos } = await import('./panicoZona');
    const env = { ...TWILIO, DB: m.DB } as unknown as Env;
    for (const min of [2, 4, 7, 9]) {
      await m.DB.prepare(
        `UPDATE emergencias_viaje SET creado_en = datetime('now', '-${min} minutes')`,
      ).run();
      await insistirPanicos(env, m.DB);
    }
    const al = expo.filter((x) => x.to === 'ExponentPushToken[equipo-central-2]');
    expect(al).toHaveLength(4); // el primero y tres repeticiones
    // Uno nuevo, atendido en el panel antes de los 2 minutos: no se repite.
    await viajeConEmergencia(m, admin);
    const nuevo = await m.DB.prepare(
      'SELECT id FROM emergencias_viaje ORDER BY creado_en DESC LIMIT 1',
    ).first<{ id: string }>();
    const sinAtender = await m.llamar(
      'GET',
      '/datos/admin/panico/sin-atender',
      undefined,
      admin.token,
    );
    expect(sinAtender.datos.cantidad).toBeGreaterThanOrEqual(1);
    await m.llamar(
      'POST',
      `/datos/admin/viajes/emergencias/${nuevo!.id}/atender`,
      { nota: 'Llamamos al pasajero' },
      admin.token,
    );
    await m.DB.prepare(
      "UPDATE emergencias_viaje SET creado_en = datetime('now', '-3 minutes') WHERE id = ?",
    )
      .bind(nuevo!.id)
      .run();
    const antes = expo.length;
    await insistirPanicos(env, m.DB);
    expect(expo.length).toBe(antes);
  });

  it('el panel del equipo: cuántos pánicos hay sin atender y qué zonas no tienen responsable', async () => {
    capturarTodo();
    const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
    const admin = await equipoConTelefono(m);
    await conductorDeMoto(m, ORIGEN);
    const vacio = await m.llamar('GET', '/datos/admin/panico/sin-atender', undefined, admin.token);
    expect(vacio.estado, JSON.stringify(vacio.datos)).toBe(200);
    expect(vacio.datos.cantidad).toBe(0);
    expect(vacio.datos.zonasSinResponsable.map((z: { id: string }) => z.id)).toContain(ZONA);
    const rep = await m.cuenta('repartidor', 'Rita Riesgo');
    await m.llamar('POST', '/datos/repartidor/emergencia', { lat: 25.77, lng: -80.19 }, rep.token);
    const uno = await m.llamar('GET', '/datos/admin/panico/sin-atender', undefined, admin.token);
    expect(uno.datos.cantidad).toBe(1);
    expect(uno.datos.ultimo).toBeTruthy();
    expect(
      (await m.llamar('GET', '/datos/admin/panico/sin-atender', undefined, rep.token)).estado,
    ).toBe(403);
  });
});

describe('Revisión del 24 nov: el pánico sin fallos silenciosos, sin silenciadores ajenos y sin gastar SMS', () => {
  it('si no se puede leer a quién avisar, queda en el registro de errores (nunca en silencio)', async () => {
    const { destinosPanico } = await import('./panicoZona');
    const errores = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const falla = (fila: unknown) =>
      ({
        prepare: () => ({
          bind: () => ({
            first: async () => fila,
            all: async () => {
              throw new Error('D1 caída');
            },
          }),
        }),
      }) as unknown as D1Database;
    const env = { ADMIN_CORREOS: 'dueno@ejemplo.com' } as unknown as Env;
    const conResponsable = await destinosPanico(
      env,
      falla({ nombre: 'Zona', responsable_telefono: '+584120000000' }),
      ZONA,
    );
    expect(conResponsable.usuarios).toEqual([]);
    const central = await destinosPanico(env, falla(null), null);
    expect(central.central).toBe(true);
    const textos = errores.mock.calls.map((c) => String(c[0]));
    expect(textos).toContain('pánico: no se pudo buscar la cuenta del responsable');
    expect(textos).toContain('pánico: no se pudo buscar al equipo central');
    errores.mockRestore();
  });

  it('solo un destinatario del pánico (o el equipo) lo marca visto; cualquier otra cuenta, 403', async () => {
    capturarTodo();
    const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
    const admin = await equipoConTelefono(m);
    await m.llamar(
      'PATCH',
      `/datos/admin/zonas/${ZONA}`,
      { responsableNombre: 'Responsable Zona', responsableTelefono: RESPONSABLE },
      admin.token,
    );
    const responsable = await m.cuenta('repartidor', 'Responsable Zona');
    await m.DB.prepare("UPDATE usuarios SET telefono = '+584120000000' WHERE id = ?")
      .bind(responsable.id)
      .run();
    const { cliente } = await viajeConEmergencia(m, admin);
    const id = (await m.DB.prepare('SELECT id FROM emergencias_viaje').first<{ id: string }>())!.id;
    const ajeno = await m.cuenta('cliente', 'Otra Persona');
    expect((await m.llamar('POST', `/datos/panico/${id}/visto`, {}, ajeno.token)).estado).toBe(403);
    expect((await m.llamar('POST', `/datos/panico/${id}/visto`, {}, cliente.token)).estado).toBe(
      403,
    );
    const visto = () =>
      m.DB.prepare('SELECT 1 FROM flex_avisos WHERE clave = ?').bind(`panico:${id}:visto`).first();
    expect(await visto()).toBeNull();
    expect(
      (await m.llamar('POST', `/datos/panico/${id}/visto`, {}, responsable.token)).estado,
    ).toBe(200);
    expect(await visto()).not.toBeNull();
    expect((await m.llamar('POST', `/datos/panico/${id}/visto`, {}, admin.token)).estado).toBe(200);
    expect(
      (await m.llamar('POST', '/datos/panico/no-existe-123/visto', {}, admin.token)).estado,
    ).toBe(404);
  });

  it('una persona que toca el botón una y otra vez no gasta los SMS de todos; el aviso al celular sale siempre', async () => {
    const { sms, expo } = capturarTodo();
    const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
    const admin = await equipoConTelefono(m);
    await m.llamar(
      'PATCH',
      `/datos/admin/zonas/${ZONA}`,
      { responsableNombre: 'Responsable Zona', responsableTelefono: RESPONSABLE },
      admin.token,
    );
    const responsable = await m.cuenta('repartidor', 'Responsable Zona');
    await m.DB.prepare("UPDATE usuarios SET telefono = '+584120000000' WHERE id = ?")
      .bind(responsable.id)
      .run();
    await telefonoConCanales(m, responsable.id, 'ExponentPushToken[responsable-tope]');
    const rep = await m.cuenta('repartidor', 'Rita Riesgo');
    const { PANICO_SMS_POR_PERSONA_HORA } = await import('./panicoZona');
    for (let i = 0; i < PANICO_SMS_POR_PERSONA_HORA + 2; i++)
      await m.llamar(
        'POST',
        '/datos/repartidor/emergencia',
        { lat: 25.77, lng: -80.19 },
        rep.token,
      );
    expect(sms.filter((s) => s.para === '+584120000000')).toHaveLength(PANICO_SMS_POR_PERSONA_HORA);
    expect(sms.filter((s) => s.para === '+13055550111')).toHaveLength(PANICO_SMS_POR_PERSONA_HORA);
    expect(expo.filter((x) => x.to === 'ExponentPushToken[responsable-tope]')).toHaveLength(
      PANICO_SMS_POR_PERSONA_HORA + 2,
    );
    // Otra persona sigue teniendo su SMS.
    const otra = await m.cuenta('repartidor', 'Otra Conductora');
    await m.llamar('POST', '/datos/repartidor/emergencia', { lat: 25.77, lng: -80.19 }, otra.token);
    expect(sms.filter((s) => s.para === '+584120000000')).toHaveLength(
      PANICO_SMS_POR_PERSONA_HORA + 1,
    );
  });
});

describe('C-PANICO-SOLO-REALES · la alarma de pánico cuenta solo zonas con conductores reales', () => {
  const q = (m: ReturnType<typeof mundo>, sql: string, ...v: unknown[]) =>
    m.DB.prepare(sql)
      .bind(...v)
      .run();
  const mirar = async (m: ReturnType<typeof mundo>) => {
    const { saludPanicoZonas, zonasSinResponsable, olvidarSaludPanico } =
      await import('./panicoZona');
    olvidarSaludPanico();
    return {
      salud: await saludPanicoZonas(m.DB),
      zonas: (await zonasSinResponsable(m.DB)).map((z) => z.id),
    };
  };

  it('zona sin conductores, con solo cuentas de prueba o solo nuestras: no pone la alarma en rojo', async () => {
    capturarTodo();
    const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
    await equipoConTelefono(m);
    expect(await mirar(m)).toEqual({ salud: 'ok', zonas: [] });
    const prueba = await conductorDeMoto(m, ORIGEN);
    await q(m, 'UPDATE usuarios SET es_prueba = 1 WHERE id = ?', prueba.id);
    expect(await mirar(m)).toEqual({ salud: 'ok', zonas: [] });
    const nuestra = await conductorDeMoto(m, ORIGEN);
    await q(
      m,
      "UPDATE usuarios SET correo = 'soporte.driver@windoce.com' WHERE id = ?",
      nuestra.id,
    );
    expect(await mirar(m)).toEqual({ salud: 'ok', zonas: [] });
    const revisor = await conductorDeMoto(m, ORIGEN);
    await q(m, "UPDATE usuarios SET nombre = 'Soporte Revisión Driver' WHERE id = ?", revisor.id);
    expect(await mirar(m)).toEqual({ salud: 'ok', zonas: [] });
  });

  it('un conductor real sin vehículo aprobado ni plazo vigente tampoco cuenta; con plazo vigente, sí', async () => {
    capturarTodo();
    const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
    const c = await conductorDeMoto(m, ORIGEN);
    await q(m, "UPDATE vehiculos SET estado = 'suspendido' WHERE conductor_id = ?", c.id);
    expect(await mirar(m)).toEqual({ salud: 'ok', zonas: [] });
    await q(
      m,
      "INSERT INTO plazo_papeles (conductor_id, pais, estado, vence_en) VALUES (?, 'US', 'en_plazo', datetime('now', '+5 days'))",
      c.id,
    );
    expect(await mirar(m)).toEqual({ salud: 'error', zonas: [ZONA] });
  });

  it('la zona de revisión de las tiendas nunca cuenta, aunque tenga un conductor real', async () => {
    capturarTodo();
    const m = mundo(TWILIO, { host: 'staging.tumbite.com' });
    await q(
      m,
      "INSERT OR IGNORE INTO zonas (id, nombre, pais, lat, lng, activa) VALUES ('VE-ZZ-REVIEW', 'Revisión', 'VE', 8.6, -71.6, 1)",
    );
    await conductorDeMoto(m, ORIGEN, 'VE-ZZ-REVIEW');
    expect(await mirar(m)).toEqual({ salud: 'ok', zonas: [] });
  });
});
