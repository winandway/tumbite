import { afterEach, describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { usarTransporteCorreo } from '../correo';
import { crearTicket } from './tickets';

/**
 * C-GERENTE-TICKETS (1 nov 2026, pedido de Richard por la sesión de su correo): una puerta con
 * secreto para que el gerente de correo lea los tickets de ayuda abiertos de las tres apps y los
 * conteste. Responder deja el mensaje como «Soporte», avisa al celular y manda el correo; si el
 * aviso o el correo fallan, se dice en la respuesta y queda en el registro de errores (canario).
 */
const SECRETO = 'g'.repeat(48);

describe('puerta del gerente para los tickets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    usarTransporteCorreo(null);
  });

  it('C-CONTACTO: el formulario público abre un caso, manda el enlace por correo y el gerente lo ve con su origen', async () => {
    const cuerpos: string[] = [];
    usarTransporteCorreo(async (_e, init) => {
      cuerpos.push(String(init.body));
      return new Response('{"success":true,"message_id":"m1"}', { status: 200 });
    });
    const m = mundo({ GERENTE_SECRETO: SECRETO, YAD_TOKEN: 'x'.repeat(40) });
    const r = await m.llamar('POST', '/datos/contacto', {
      nombre: 'Lucía Contacto',
      correo: 'lucia@ejemplo.com',
      soy: 'restaurante',
      numeroUsuario: 'R-1234',
      ciudad: 'Novi',
      mensaje: 'Quiero sumar mi restaurante a Divoox.',
      idioma: 'es',
    });
    expect(r.estado).toBe(201);
    expect(r.datos).toEqual({ ok: true });
    // El enlace privado solo viaja por correo.
    expect(cuerpos.some((b) => b.includes('lucia@ejemplo.com') && b.includes('/t/'))).toBe(true);
    // Datos mal escritos: no abre nada.
    expect(
      (
        await m.llamar('POST', '/datos/contacto', {
          nombre: 'X',
          correo: 'no-es-correo',
          soy: 'cliente',
          mensaje: 'hola',
        })
      ).estado,
    ).toBe(400);
    const lista = (await (
      await m.crudo('/datos/gerente/tickets?estado=abiertos', {
        headers: { authorization: `Bearer ${SECRETO}` },
      })
    ).json()) as { tickets: Record<string, unknown>[] };
    expect(lista.tickets.find((t) => t.cliente_nombre === 'Lucía Contacto')).toMatchObject({
      origen: 'contacto',
      soy: 'restaurante',
      numero_usuario: 'R-1234',
      ciudad: 'Novi',
      asunto: 'Contacto · Restaurante',
    });
  });

  it('sin el secreto o con uno malo da 401', async () => {
    const m = mundo({ GERENTE_SECRETO: SECRETO });
    expect((await m.llamar('GET', '/datos/gerente/tickets?estado=abiertos')).estado).toBe(401);
    const malo = await m.crudo('/datos/gerente/tickets?estado=abiertos', {
      headers: { authorization: `Bearer ${'h'.repeat(48)}` },
    });
    expect(malo.status).toBe(401);
    // Sin la variable configurada, la puerta no existe para nadie.
    const sin = mundo();
    const r = await sin.crudo('/datos/gerente/tickets', {
      headers: { authorization: `Bearer ${SECRETO}` },
    });
    expect(r.status).toBe(401);
  });

  it('lista los abiertos de cada app y responder deja el mensaje, avisa y manda el correo', async () => {
    const correos: string[] = [];
    usarTransporteCorreo(async (_e, init) => {
      correos.push((JSON.parse(String(init.body)) as { subject: string }).subject);
      return new Response('{"success":true,"message_id":"m1"}', { status: 200 });
    });
    const avisos: unknown[] = [];
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      if (String(url).includes('exp.host')) {
        avisos.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({ data: [{ status: 'ok' }] }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });
    const m = mundo({ GERENTE_SECRETO: SECRETO, YAD_TOKEN: 'x'.repeat(40) });
    const rep = await m.cuenta('repartidor', 'Rita Ayuda');
    await m.DB.prepare(
      "INSERT INTO dispositivos (token, usuario_id) VALUES ('ExponentPushToken[t1]', ?)",
    )
      .bind(rep.id)
      .run();
    const t = await crearTicket({ DB: m.DB, ...m.extra } as never, m.DB, {
      tipo: 'soporte',
      nombre: 'Rita Ayuda',
      correo: 'rita@ejemplo.com',
      idioma: 'es',
      asunto: 'No me llega la oferta',
      mensaje: 'Desde ayer no me llegan ofertas.',
      usuarioId: rep.id,
    });
    const gerente = (metodo: string, ruta: string, cuerpo?: unknown) =>
      m.crudo(ruta, {
        method: metodo,
        headers: { authorization: `Bearer ${SECRETO}`, 'content-type': 'application/json' },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      });
    const lista = (await (
      await gerente('GET', '/datos/gerente/tickets?estado=abiertos')
    ).json()) as {
      tickets: {
        id: string;
        numero: string;
        app: string;
        idioma: string;
        mensajes: { de: string; texto: string }[];
      }[];
    };
    const mio = lista.tickets.find((x) => x.id === t.id)!;
    expect(mio).toMatchObject({
      app: 'divoox.driver',
      idioma: 'es',
      asunto: 'No me llega la oferta',
    });
    expect(mio.mensajes[0]).toMatchObject({
      de: 'cliente',
      texto: 'Desde ayer no me llegan ofertas.',
    });
    expect(JSON.stringify(mio)).not.toContain('rita@ejemplo.com');
    const r = await gerente('POST', `/datos/gerente/tickets/${t.id}/responder`, {
      texto: 'Ya revisamos tu zona: vuelve a conectarte.',
      plantilla: 'P3',
      cerrar: true,
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, aviso: 'ok', correo: 'ok' });
    expect(correos.some((s) => s.includes(mio.numero))).toBe(true);
    expect(avisos).toHaveLength(1);
    const f = await m.DB.prepare(
      "SELECT t.estado, (SELECT texto FROM ticket_mensajes WHERE ticket_id = t.id AND autor = 'equipo') AS respuesta FROM tickets t WHERE id = ?",
    )
      .bind(t.id)
      .first<{ estado: string; respuesta: string }>();
    expect(f).toMatchObject({
      estado: 'cerrado',
      respuesta: 'Ya revisamos tu zona: vuelve a conectarte.',
    });
  });

  it('acepta plantillas de una y dos cifras (P10 en adelante) y rechaza las de tres', async () => {
    const m = mundo({ GERENTE_SECRETO: SECRETO, YAD_TOKEN: 'x'.repeat(40) });
    const t = await crearTicket({ DB: m.DB, ...m.extra } as never, m.DB, {
      tipo: 'soporte',
      nombre: 'Sin Cuenta',
      correo: 'plantilla@ejemplo.com',
      idioma: 'es',
      asunto: '¿Cuándo sale la app?',
      mensaje: 'Quiero saber cuándo sale.',
    });
    const responder = (plantilla: string) =>
      m.crudo(`/datos/gerente/tickets/${t.id}/responder`, {
        method: 'POST',
        headers: { authorization: `Bearer ${SECRETO}`, 'content-type': 'application/json' },
        body: JSON.stringify({ texto: 'Muy pronto.', plantilla }),
      });
    expect((await responder('P100')).status).toBe(400);
    const r = await responder('P10');
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, plantilla: 'P10' });
  });

  it('si el correo falla, lo dice y queda en el registro de errores', async () => {
    usarTransporteCorreo(async () => new Response('fallo', { status: 500 }));
    const m = mundo({ GERENTE_SECRETO: SECRETO, YAD_TOKEN: 'x'.repeat(40) });
    const t = await crearTicket({ DB: m.DB, ...m.extra } as never, m.DB, {
      tipo: 'soporte',
      nombre: 'Sin Cuenta',
      correo: 'sin@ejemplo.com',
      idioma: 'en',
      asunto: 'Help',
      mensaje: 'Help me',
    });
    const r = await m.crudo(`/datos/gerente/tickets/${t.id}/responder`, {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRETO}`, 'content-type': 'application/json' },
      body: JSON.stringify({ texto: 'We are on it.' }),
    });
    expect(await r.json()).toMatchObject({ ok: true, correo: 'error' });
    const e = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM errores_servidor WHERE ruta LIKE '/datos/gerente%'",
    ).first<{ n: number }>();
    expect(e?.n).toBeGreaterThan(0);
  });
});

describe('mis casos de ayuda (C-AYUDA-EN-LA-APP)', () => {
  it('cada persona ve solo sus casos, con el mismo número que el gerente', async () => {
    const m = mundo();
    const rest = await m.cuenta('restaurante', 'Dueño Ayuda');
    const otro = await m.cuenta('cliente', 'Otro');
    const t = await crearTicket({ DB: m.DB, ...m.extra } as never, m.DB, {
      tipo: 'soporte',
      nombre: 'Dueño Ayuda',
      correo: 'd@ejemplo.com',
      idioma: 'es',
      asunto: 'No veo mis pedidos',
      mensaje: 'Ayuda',
      usuarioId: rest.id,
    });
    const mios = await m.llamar('GET', '/datos/mis-tickets', undefined, rest.token);
    expect(mios.estado).toBe(200);
    expect(mios.datos.tickets).toMatchObject([
      { codigo: t.codigo, asunto: 'No veo mis pedidos', estado: 'abierto' },
    ]);
    expect(mios.datos.tickets[0].numero).toMatch(/^[0-9A-F]{8}$/);
    expect(
      (await m.llamar('GET', '/datos/mis-tickets', undefined, otro.token)).datos.tickets,
    ).toHaveLength(0);
    expect((await m.llamar('GET', '/datos/mis-tickets')).estado).toBe(401);
  });
});
