import { afterEach, describe, expect, it, vi } from 'vitest';
import { momentoEn } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import { usarTransporteCorreo } from './correo';
import type { Env } from './env';
import { lineaDeCuenta } from './rastro';
import {
  AJUSTES_REZAGADOS_DE_FABRICA,
  type AjustesRezagados,
  PASOS_REZAGADO,
  PLANTILLAS_DE_FABRICA,
  candidatos,
  correrRezagados,
  envioDePlantilla,
  guardarAjustesRezagados,
  leerAjustesRezagados,
  pasoPendiente,
} from './rezagados';
import { TAREAS_RELOJ } from './rutas/operacion';

/**
 * C-REZAGADOS (22 nov 2026, orden de Richard) — todos los países, encendido por zona. Camila le
 * recuerda su paso exacto a quien se quedó a medio registro: correo y aviso, después SMS, y un último
 * correo; con topes, horario local, baja y vista previa que no envía ni escribe.
 */
const ZONA = 'US-FL-MIAMI';
type M = ReturnType<typeof mundo>;
type Correo = { para: string; asunto: string; texto: string; html: string };

function correos() {
  const lista: Correo[] = [];
  usarTransporteCorreo(async (_e, init) => {
    const c = JSON.parse(String(init.body)) as {
      to: { address: string }[];
      subject: string;
      text: string;
      html: string;
    };
    lista.push({ para: c.to[0]!.address, asunto: c.subject, texto: c.text, html: c.html });
    return new Response('{"success":true,"message_id":"m-ejemplo"}', { status: 200 });
  });
  return lista;
}
afterEach(() => {
  usarTransporteCorreo(null);
  vi.unstubAllGlobals();
});

const env = (m: M, mas: Record<string, unknown> = {}) =>
  ({ DB: m.DB, ...m.extra, YAD_TOKEN: 'token-de-prueba', ...mas }) as unknown as Env;
const hace = (horas: number) =>
  new Date(Date.now() - horas * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
const dentroDe = (horas: number) => new Date(Date.now() + horas * 3_600_000);

/** Una cuenta que se registró hace `horas` y no avanzó desde entonces, con los pasos dados. */
async function rezagado(
  m: M,
  rol: 'repartidor' | 'cliente',
  horas: number,
  pasos: string[] = [],
  nombre = 'Marina Ejemplo',
) {
  const c = await m.cuenta(rol, nombre);
  await m.DB.prepare("UPDATE usuarios SET zona_id = ?, creado_en = ?, idioma = 'es' WHERE id = ?")
    .bind(ZONA, hace(horas), c.id)
    .run();
  await m.DB.prepare('UPDATE embudo_cuenta SET creado_en = ? WHERE usuario_id = ?')
    .bind(hace(horas), c.id)
    .run();
  for (const p of pasos)
    await m.DB.prepare(
      'INSERT OR IGNORE INTO embudo_cuenta (usuario_id, paso, creado_en) VALUES (?, ?, ?)',
    )
      .bind(c.id, p, hace(horas))
      .run();
  return c;
}

const ajustar = (m: M, cambios: Partial<AjustesRezagados> = {}) =>
  guardarAjustesRezagados(m.DB, {
    ...AJUSTES_REZAGADOS_DE_FABRICA,
    horaDesde: 0,
    horaHasta: 24,
    zonas: { [ZONA]: 'encendido' },
    ...cambios,
  });
const mensajes = async (m: M, id?: string) =>
  (
    await m.DB.prepare(
      `SELECT id, usuario_id, paso, canal, origen, numero, estado, detalle FROM rezagados_mensajes ${id ? 'WHERE usuario_id = ?' : ''} ORDER BY creado_en, rowid`,
    )
      .bind(...(id ? [id] : []))
      .all<{
        id: string;
        usuario_id: string;
        paso: string;
        canal: string;
        origen: string;
        numero: number;
        estado: string;
        detalle: string;
      }>()
  ).results;

describe('C-REZAGADOS: en qué paso se quedó', () => {
  const base = { correoConfirmado: true, zonaConLineas: false, enLinea: false };
  const paso = (rol: string, pasos: string[], mas = {}) =>
    pasoPendiente({ rol, pasos: new Set(pasos), ...base, ...mas });

  it('al conductor se le recuerda, en orden: fotos, vehículo, conectarse, su línea y el correo', () => {
    expect(paso('repartidor', ['cuenta'])).toBe('fotos');
    expect(paso('repartidor', ['cuenta', 'foto_cara', 'foto_documento'])).toBe('fotos');
    const fotos = ['cuenta', 'foto_cara', 'foto_documento', 'foto_licencia', 'enviado'];
    expect(paso('repartidor', fotos)).toBe('vehiculo');
    // Envió todo y espera la aprobación del equipo: eso no depende de él, no se le recuerda.
    expect(paso('repartidor', [...fotos, 'vehiculo'])).toBeNull();
    expect(paso('repartidor', [...fotos, 'vehiculo', 'aprobado'])).toBe('servicio');
    const listo = [...fotos, 'vehiculo', 'aprobado', 'conectado'];
    expect(paso('repartidor', listo, { zonaConLineas: true })).toBe('linea');
    expect(paso('repartidor', listo, { zonaConLineas: true, enLinea: true })).toBeNull();
    expect(paso('repartidor', listo, { correoConfirmado: false })).toBe('correo');
    // Lo que el equipo aprobó cuenta como hecho aunque las fotos entraran por otra ruta.
    expect(paso('repartidor', ['cuenta', 'aprobado'])).toBe('vehiculo');
  });

  it('al pasajero solo se le recuerda confirmar el correo', () => {
    expect(paso('cliente', ['cuenta'], { correoConfirmado: false })).toBe('correo');
    expect(paso('cliente', ['cuenta'])).toBeNull();
    expect(paso('cliente', ['cuenta', 'correo'], { correoConfirmado: false })).toBeNull();
  });

  it('cada paso tiene su plantilla en español y en inglés, firmada por Camila y sin «asistente virtual»', () => {
    for (const p of PASOS_REZAGADO)
      for (const i of ['es', 'en'] as const) {
        const t = PLANTILLAS_DE_FABRICA[p][i];
        expect(t.texto, `${p} ${i}`).toMatch(/Camila/);
        expect(t.sms.length, `${p} ${i} sms`).toBeLessThanOrEqual(160);
        expect(`${t.asunto} ${t.texto} ${t.sms}`).not.toMatch(
          /asistente virtual|virtual assistant|\bIA\b|\bAI\b/i,
        );
      }
  });
});

describe('C-REZAGADOS: la vuelta del reloj', () => {
  it('de fábrica todo está apagado: no envía ni escribe', async () => {
    const m = mundo();
    const enviados = correos();
    await rezagado(m, 'repartidor', 5);
    expect((await leerAjustesRezagados(m.DB)).zonas).toEqual({});
    const r = await correrRezagados(env(m), m.DB);
    expect(r.zonas).toBe(0);
    expect(enviados).toHaveLength(0);
    expect(await mensajes(m)).toHaveLength(0);
  });

  it('en vista previa calcula a quién le escribiría, pero no envía ni escribe', async () => {
    const m = mundo();
    const enviados = correos();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const c = await rezagado(m, 'repartidor', 5);
    await ajustar(m, { zonas: { [ZONA]: 'previa' } });
    await correrRezagados(env(m), m.DB);
    expect(enviados).toHaveLength(0);
    expect(await mensajes(m)).toHaveLength(0);
    const r = await m.llamar('GET', '/datos/admin/camila/recordatorios', undefined, admin.token);
    expect(r.estado).toBe(200);
    const fila = (r.datos.lista as { id: string; paso: string; toca: number; modo: string }[]).find(
      (x) => x.id === c.id,
    );
    expect(fila).toMatchObject({ paso: 'fotos', toca: 1, modo: 'previa' });
    expect(await mensajes(m)).toHaveLength(0);
  });

  it('encendido: manda la plantilla del paso exacto por correo y aviso, queda en su línea de tiempo y no repite', async () => {
    const m = mundo();
    const enviados = correos();
    const c = await rezagado(m, 'repartidor', 5);
    await ajustar(m);
    const r = await correrRezagados(env(m), m.DB);
    expect(r.enviados).toBe(1);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.asunto).toBe(PLANTILLAS_DE_FABRICA.fotos.es.asunto);
    expect(enviados[0]!.texto).toContain('Hola, Marina.');
    expect(enviados[0]!.texto).toContain('/driver');
    // El enlace de baja va al pie, discreto: nunca como botón rojo.
    expect(enviados[0]!.texto).toMatch(/\/datos\/reminders\/off\?m=/);
    expect(enviados[0]!.html).toContain('dejar de recibirlos');
    expect(enviados[0]!.html.match(/background:#F20D20/g)).toHaveLength(1);
    const filas = await mensajes(m, c.id);
    expect(filas.map((f) => [f.canal, f.paso, f.origen, f.numero, f.estado])).toEqual([
      ['correo', 'fotos', 'auto', 1, 'enviado'],
      // Sin aparato registrado el aviso no sale, y queda dicho.
      ['aviso', 'fotos', 'auto', 1, 'sin_destino'],
    ]);
    const linea = await lineaDeCuenta(m.DB, c.id);
    expect(
      linea?.linea.some(
        (l) => l.evento === 'mensaje:correo' && l.detalle?.startsWith('fotos|auto|enviado'),
      ),
    ).toBe(true);
    // La respuesta de la persona le vuelve a Camila: el mensaje quedó en su hilo de soporte.
    const hilo = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM camila_mensajes cm JOIN camila_personas p ON p.id = cm.persona_id WHERE p.usuario_id = ? AND cm.autor = 'camila' AND cm.herramienta = 'registro:fotos'",
    )
      .bind(c.id)
      .first<{ n: number }>();
    expect(hilo?.n).toBe(1);
    // La misma hora y la siguiente: nada más.
    await correrRezagados(env(m), m.DB);
    await correrRezagados(env(m), m.DB, dentroDe(2));
    expect(enviados).toHaveLength(1);
    expect(await mensajes(m, c.id)).toHaveLength(2);
  });

  it('todavía no le toca a quien lleva menos del plazo, y se detiene en cuanto avanza', async () => {
    const m = mundo();
    const enviados = correos();
    const nuevo = await rezagado(m, 'repartidor', 1);
    await m.confirmarCorreo(nuevo.id);
    await ajustar(m);
    await correrRezagados(env(m), m.DB);
    expect(enviados).toHaveLength(0);
    // A las 4 horas le llega el primero…
    await correrRezagados(env(m), m.DB, dentroDe(3));
    expect(enviados).toHaveLength(1);
    // …sube sus fotos enseguida. Aunque pasen las horas del plazo en el paso nuevo, ese mismo día no
    // se le escribe otra vez (uno por persona por día); al día siguiente, la plantilla del paso nuevo.
    for (const p of ['foto_cara', 'foto_documento', 'foto_licencia', 'enviado'])
      await m.DB.prepare('INSERT INTO embudo_cuenta (usuario_id, paso) VALUES (?, ?)')
        .bind(nuevo.id, p)
        .run();
    await correrRezagados(env(m), m.DB, dentroDe(7));
    expect(enviados).toHaveLength(1);
    await correrRezagados(env(m), m.DB, dentroDe(30));
    expect(enviados).toHaveLength(2);
    expect(enviados[1]!.asunto).toBe(PLANTILLAS_DE_FABRICA.vehiculo.es.asunto);
    // Registra su vehículo: ya no le falta nada que dependa de él, y no se le escribe más.
    await m.DB.prepare("INSERT INTO embudo_cuenta (usuario_id, paso) VALUES (?, 'vehiculo')")
      .bind(nuevo.id)
      .run();
    await correrRezagados(env(m), m.DB, dentroDe(60));
    expect(enviados).toHaveLength(2);
  });

  it('el ritmo: segundo al día siguiente, tercero a los tres días, y después se detiene', async () => {
    const m = mundo();
    const enviados = correos();
    const c = await rezagado(m, 'repartidor', 5);
    await ajustar(m);
    for (const h of [0, 10, 25, 40, 73, 100, 200]) await correrRezagados(env(m), m.DB, dentroDe(h));
    expect(enviados).toHaveLength(3);
    expect(
      (await mensajes(m, c.id)).filter((f) => f.canal === 'correo').map((f) => f.numero),
    ).toEqual([1, 2, 3]);
  });

  it('tope del día entre todos, y primero quien lleva más tiempo esperando', async () => {
    const m = mundo();
    const enviados = correos();
    await rezagado(m, 'repartidor', 5, [], 'Reciente Ejemplo');
    const viejo = await rezagado(m, 'repartidor', 50, [], 'Antigua Ejemplo');
    await ajustar(m, { topeDiario: 1 });
    const r = await correrRezagados(env(m), m.DB);
    expect(r.tope).toBe(true);
    expect(enviados).toHaveLength(1);
    expect((await mensajes(m, viejo.id)).length).toBe(2);
  });

  it('no escribe fuera del horario local de la zona de la persona', async () => {
    const m = mundo();
    const enviados = correos();
    await rezagado(m, 'repartidor', 5);
    const hora = Math.floor(momentoEn('America/New_York').minutos / 60);
    // Una ventana de una hora que NO es la de ahora en esa ciudad.
    const desde = (hora + 2) % 23;
    await ajustar(m, { horaDesde: desde, horaHasta: desde + 1 });
    await correrRezagados(env(m), m.DB);
    expect(enviados).toHaveLength(0);
    await ajustar(m, { horaDesde: hora, horaHasta: hora + 1 });
    await correrRezagados(env(m), m.DB);
    expect(enviados).toHaveLength(1);
  });

  it('las cuentas de prueba y las de otra zona no reciben nada', async () => {
    const m = mundo();
    const enviados = correos();
    const prueba = await rezagado(m, 'repartidor', 5);
    await m.DB.prepare('UPDATE usuarios SET es_prueba = 1 WHERE id = ?').bind(prueba.id).run();
    const otra = await rezagado(m, 'repartidor', 5);
    await m.DB.prepare("UPDATE usuarios SET zona_id = 'US-MI-NOVI' WHERE id = ?")
      .bind(otra.id)
      .run();
    await ajustar(m);
    await correrRezagados(env(m), m.DB);
    expect(enviados).toHaveLength(0);
    expect(await mensajes(m)).toHaveLength(0);
  });

  it('la baja se respeta: abrir el enlace no da de baja, tocar el botón sí', async () => {
    const m = mundo();
    const enviados = correos();
    const c = await rezagado(m, 'repartidor', 5);
    await ajustar(m);
    await correrRezagados(env(m), m.DB);
    const enlace = /\/datos\/reminders\/off\?m=[A-Za-z0-9_-]+/.exec(enviados[0]!.texto)![0];
    expect((await m.crudo(enlace, { method: 'GET' })).status).toBe(200);
    expect(
      (await m.DB.prepare('SELECT COUNT(*) AS n FROM rezagados_bajas').first<{ n: number }>())?.n,
    ).toBe(0);
    expect((await m.crudo(enlace, { method: 'POST' })).status).toBe(200);
    expect((await m.crudo('/datos/reminders/off?m=no-existe-123', { method: 'POST' })).status).toBe(
      404,
    );
    await correrRezagados(env(m), m.DB, dentroDe(30));
    expect(enviados).toHaveLength(1);
    const [fila] = await candidatos(
      env(m),
      m.DB,
      await leerAjustesRezagados(m.DB),
      [ZONA],
      dentroDe(30),
    );
    expect(fila).toMatchObject({ id: c.id, toca: null, motivo: 'baja' });
  });

  it('un freno temporal viejo no se trata como correo malo; un buzón que no existe sí', async () => {
    const m = mundo();
    const enviados = correos();
    const temporal = await rezagado(m, 'repartidor', 5, [], 'Temporal Ejemplo');
    const malo = await rezagado(m, 'repartidor', 6, [], 'Inexistente Ejemplo');
    for (const [id, motivo] of [
      [temporal.id, 'recipient_suppressed'],
      [malo.id, '550 5.1.1 The email account does not exist'],
    ] as const)
      await m.DB.prepare(
        "INSERT INTO correos_rebotados (correo, motivo, creado_en) SELECT lower(correo), ?, datetime('now', '-2 days') FROM usuarios WHERE id = ?",
      )
        .bind(motivo, id)
        .run();
    await ajustar(m);
    await correrRezagados(env(m), m.DB);
    expect(enviados).toHaveLength(1);
    expect((await mensajes(m, temporal.id))[0]).toMatchObject({
      canal: 'correo',
      estado: 'enviado',
    });
    expect((await mensajes(m, malo.id))[0]).toMatchObject({ canal: 'correo', estado: 'rebotado' });
  });

  it('el segundo recordatorio va por SMS solo si hay proveedor y casilla marcada; si no, por correo y sin errores escritos', async () => {
    const m = mundo();
    const enviados = correos();
    const sinSms = await rezagado(m, 'repartidor', 5, [], 'Correo Ejemplo');
    const conSms = await rezagado(m, 'repartidor', 5, [], 'Celular Ejemplo');
    for (const id of [sinSms.id, conSms.id])
      await m.DB.prepare(
        "UPDATE usuarios SET telefono = '+13055550100', sms_consentido_en = datetime('now') WHERE id = ?",
      )
        .bind(id)
        .run();
    await ajustar(m);
    // Sin proveedor de SMS: los dos recordatorios salen por correo y no queda ningún SMS anotado.
    await correrRezagados(env(m), m.DB);
    await correrRezagados(env(m), m.DB, dentroDe(25));
    expect(enviados).toHaveLength(4);
    expect(
      (await m.DB.prepare('SELECT COUNT(*) AS n FROM sms_enviados').first<{ n: number }>())?.n,
    ).toBe(0);
    expect((await mensajes(m)).some((f) => f.canal === 'sms')).toBe(false);
    // Con proveedor encendido, el segundo de una cuenta nueva sale por SMS (uno solo, corto).
    const otro = await rezagado(m, 'repartidor', 30, [], 'Nueva Ejemplo');
    await m.DB.prepare(
      "UPDATE usuarios SET telefono = '+13055550111', sms_consentido_en = datetime('now') WHERE id = ?",
    )
      .bind(otro.id)
      .run();
    await m.DB.prepare(
      "INSERT INTO rezagados_mensajes (id, usuario_id, paso, canal, numero, creado_en) VALUES ('m-previo', ?, 'fotos', 'correo', 1, datetime('now', '-26 hours'))",
    )
      .bind(otro.id)
      .run();
    const sms: string[] = [];
    vi.stubGlobal('fetch', async (_u: string, init: RequestInit) => {
      sms.push(new URLSearchParams(String(init.body)).get('Body') ?? '');
      return new Response(JSON.stringify({ sid: 'SM-ejemplo' }), { status: 201 });
    });
    const twilio = {
      TWILIO_ACCOUNT_SID: 'AC00000000000000000000000000000000',
      TWILIO_AUTH_TOKEN: 'token-de-prueba-0000000000000000',
      TWILIO_FROM: '+18005550100',
    };
    // Con el proveedor listo pero sin la llave propia de estos recordatorios, tampoco sale un SMS.
    expect(
      (await candidatos(env(m, twilio), m.DB, await leerAjustesRezagados(m.DB), [ZONA])).find(
        (c) => c.id === otro.id,
      )?.canales,
    ).toEqual(['correo', 'aviso']);
    const conTwilio = env(m, { ...twilio, REZAGADOS_SMS: 'si' });
    await correrRezagados(conTwilio, m.DB);
    expect(sms).toHaveLength(1);
    expect(sms[0]).toContain('Camila');
    expect((await mensajes(m, otro.id)).at(-1)).toMatchObject({
      canal: 'sms',
      numero: 2,
      estado: 'enviado',
    });
  });

  it('donde hay líneas se le recuerda unirse a la suya; al líder y a quien ya está en una, no', async () => {
    const m = mundo();
    const enviados = correos();
    const listo = [
      'foto_cara',
      'foto_documento',
      'foto_licencia',
      'enviado',
      'vehiculo',
      'aprobado',
      'conectado',
    ];
    const lider = await rezagado(m, 'repartidor', 5, listo, 'Lidera Ejemplo');
    const miembro = await rezagado(m, 'repartidor', 5, listo, 'Miembro Ejemplo');
    const suelto = await rezagado(m, 'repartidor', 5, listo, 'Suelta Ejemplo');
    for (const c of [lider, miembro, suelto]) await m.confirmarCorreo(c.id);
    // Confirmar el correo es un avance: para la prueba, que haya pasado hace cinco horas.
    await m.DB.prepare('UPDATE embudo_cuenta SET creado_en = ?').bind(hace(5)).run();
    await m.DB.prepare(
      "INSERT INTO equipos (id, nombre, zona_id, lider_id, codigo) VALUES ('eq-1', 'Línea de ejemplo', ?, ?, 'EJEMPLO01')",
    )
      .bind(ZONA, lider.id)
      .run();
    await m.DB.prepare("INSERT INTO lineas (equipo_id) VALUES ('eq-1')").run();
    await m.DB.prepare("INSERT INTO miembros_equipo (usuario_id, equipo_id) VALUES (?, 'eq-1')")
      .bind(miembro.id)
      .run();
    await ajustar(m);
    await correrRezagados(env(m), m.DB);
    expect(enviados.map((e) => e.asunto)).toEqual([PLANTILLAS_DE_FABRICA.linea.es.asunto]);
    expect((await mensajes(m)).every((f) => f.usuario_id === suelto.id)).toBe(true);
  });

  it('una cuenta autorizada recibe aunque su zona siga en vista previa; las demás de esa zona, no', async () => {
    const m = mundo();
    const enviados = correos();
    const si = await rezagado(m, 'repartidor', 5, [], 'Autorizada Ejemplo');
    await rezagado(m, 'repartidor', 6, [], 'Pendiente Ejemplo');
    await ajustar(m, { zonas: { [ZONA]: 'previa' }, autorizados: [si.id] });
    await correrRezagados(env(m), m.DB);
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.texto).toContain('Hola, Autorizada.');
    expect((await mensajes(m)).every((f) => f.usuario_id === si.id)).toBe(true);
    // En una zona apagada no recibe ni la autorizada.
    await ajustar(m, { zonas: { [ZONA]: 'apagado' }, autorizados: [si.id] });
    await correrRezagados(env(m), m.DB, dentroDe(30));
    expect(enviados).toHaveLength(1);
  });

  it('cada SMS de fábrica cabe en uno solo, sin acentos, empieza por «Divoox:» y no lleva dinero', () => {
    for (const p of PASOS_REZAGADO)
      for (const i of ['es', 'en'] as const) {
        const e = envioDePlantilla(
          env(mundo()),
          AJUSTES_REZAGADOS_DE_FABRICA,
          {
            id: 'x',
            rol: 'repartidor',
            nombre: 'Maximiliano Alejandro Ejemplo',
            telefono: null,
            idioma: i,
            zona: ZONA,
          },
          p,
        );
        expect(e.sms.length, `${p} ${i}: ${e.sms}`).toBeLessThanOrEqual(160);
        expect(e.sms, `${p} ${i}`).toMatch(/^Divoox: [\x20-\x7E]+$/);
        expect(e.sms).not.toMatch(/\$|USD|Bs\.?\b|\d+[.,]\d{2}/);
        expect(e.sms).not.toContain('{');
      }
  });

  it('la tarea está en el reloj, una vez por hora, con sus escrituras declaradas', () => {
    const t = TAREAS_RELOJ.find((x) => x.nombre === 'rezagados');
    expect(t).toMatchObject({ cada: 'hora', critica: false });
    expect(t?.escriturasEsperadas).toBeGreaterThan(0);
  });
});

describe('C-REZAGADOS: «Enviar mensaje» desde la ficha', () => {
  it('la vista previa no envía ni escribe; el envío queda a nombre de quien lo mandó', async () => {
    const m = mundo({ YAD_TOKEN: 'token-de-prueba' });
    const enviados = correos();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const c = await rezagado(m, 'repartidor', 1);
    const ruta = `/datos/admin/camila/recordatorios/${c.id}/mensaje`;
    // Los correos del alta (confirmar el correo) no son de esta prueba.
    enviados.length = 0;
    const vista = await m.llamar(
      'POST',
      ruta,
      { canales: ['correo'], plantilla: 'vehiculo', soloVista: true },
      admin.token,
    );
    expect(vista.estado).toBe(200);
    expect(vista.datos.vista.asunto).toBe(PLANTILLAS_DE_FABRICA.vehiculo.es.asunto);
    expect(enviados).toHaveLength(0);
    expect(await mensajes(m)).toHaveLength(0);
    const libre = await m.llamar(
      'POST',
      ruta,
      {
        canales: ['correo'],
        asunto: 'Sobre tu registro',
        texto: 'Hola. Te escribo por tu registro en Divoox.',
      },
      admin.token,
    );
    expect(libre.estado).toBe(200);
    expect(enviados[0]).toMatchObject({ asunto: 'Sobre tu registro' });
    expect((await mensajes(m, c.id))[0]).toMatchObject({
      canal: 'correo',
      origen: 'manual',
      paso: 'libre',
      estado: 'enviado',
    });
    const sinTexto = await m.llamar('POST', ruta, { canales: ['correo'] }, admin.token);
    expect(sinTexto.estado).toBe(400);
    const ajeno = await m.llamar(
      'POST',
      ruta,
      { canales: ['correo'], plantilla: 'fotos' },
      c.token,
    );
    expect(ajeno.estado).toBe(403);
  });

  it('los ajustes se guardan con sus límites y solo los cambia el equipo', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const cliente = await m.cuenta('cliente');
    const nuevos = { ...AJUSTES_REZAGADOS_DE_FABRICA, zonas: { [ZONA]: 'previa' as const } };
    expect(
      (await m.llamar('PUT', '/datos/admin/camila/recordatorios', nuevos, cliente.token)).estado,
    ).toBe(403);
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/camila/recordatorios',
          { ...nuevos, plazosHoras: [24, 3, 72] },
          admin.token,
        )
      ).estado,
    ).toBe(400);
    expect(
      (
        await m.llamar(
          'PUT',
          '/datos/admin/camila/recordatorios',
          { ...nuevos, topeDiario: 5000 },
          admin.token,
        )
      ).estado,
    ).toBe(400);
    expect(
      (await m.llamar('PUT', '/datos/admin/camila/recordatorios', nuevos, admin.token)).estado,
    ).toBe(200);
    expect((await leerAjustesRezagados(m.DB)).zonas).toEqual({ [ZONA]: 'previa' });
  });
});
