import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas } from './pruebas/motoVe';
import { mundo } from './pruebas/ayuda';
import { usarTransporteCorreo } from './correo';
import type { Env } from './env';
import {
  AJUSTES_REZAGADOS_DE_FABRICA,
  type AjustesRezagados,
  correrRezagados,
  guardarAjustesRezagados,
} from './rezagados';
import {
  AJUSTES_WHATSAPP_FALTA_DE_FABRICA,
  type AjustesWhatsappFalta,
  faltaDeBarra,
  guardarAjustesWhatsappFalta,
  guardarEstadoPlantilla,
  olvidarErrorWhatsappFalta,
  saludWhatsappFalta,
} from './whatsappFalta';
import {
  PLANTILLAS_FALTA,
  PLANTILLA_FALTA_NOMBRE,
  creacionEnMeta,
  textoDePlantilla,
} from './whatsappPlantillaFalta';

/**
 * C-WHATSAPP-FALTA (25 nov 2026, encargo urgente de Richard) — todos los países, con interruptor por
 * país. El vigilante le manda al conductor trabado, SOLO por WhatsApp, la plantilla de utilidad «te
 * falta: …» con el paso exacto de su barra. Meta va SIMULADO: ninguna prueba le habla a Meta de verdad.
 */
const META = {
  META_WHATSAPP_TOKEN: 'token-meta-de-prueba',
  META_WHATSAPP_PHONE_ID: '1000000000000001',
};
const SECRETO = 'secreto-de-la-app-de-prueba';

type Enviado = { para: string; nombre: string; falta: string; plantilla: string; idioma: string };
function simularMeta(o: { falla?: boolean } = {}) {
  const enviados: Enviado[] = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes('graph.facebook.com') && init?.method === 'POST') {
      const b = JSON.parse(String(init.body)) as {
        to: string;
        template: {
          name: string;
          language: { code: string };
          components: { parameters: { text: string }[] }[];
        };
      };
      enviados.push({
        para: b.to,
        plantilla: b.template.name,
        idioma: b.template.language.code,
        nombre: b.template.components[0]!.parameters[0]!.text,
        falta: b.template.components[0]!.parameters[1]!.text,
      });
      if (o.falla)
        return new Response(JSON.stringify({ error: { code: 132001, message: 'no existe' } }), {
          status: 400,
        });
      return new Response(JSON.stringify({ messages: [{ id: `wamid.falta${enviados.length}` }] }), {
        status: 200,
      });
    }
    return new Response('{}', { status: 200 });
  });
  return enviados;
}

afterEach(() => {
  vi.unstubAllGlobals();
  usarTransporteCorreo(null);
  olvidarErrorWhatsappFalta();
});

const dentroDe = (horas: number) => new Date(Date.now() + horas * 3_600_000);
const sql = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ');

/** Un conductor real de Caracas que confirmó su celular por WhatsApp y no ha empezado sus fotos. */
async function escenario(
  o: { extra?: Record<string, unknown>; canalCodigo?: 'whatsapp' | 'sms'; aprobada?: boolean } = {},
) {
  const m = mundo(
    { ...META, META_APP_SECRET: SECRETO, ...o.extra },
    { host: 'staging.tumbite.com' },
  );
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  expect((await abrirCaracas({ m, admin, cliente })).estado).toBe(201);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  usarTransporteCorreo(
    async () => new Response('{"success":true,"message_id":"m-ejemplo"}', { status: 200 }),
  );
  const conductor = async (
    nombre: string,
    telefono: string,
    canal = o.canalCodigo ?? 'whatsapp',
  ) => {
    const rep = await m.cuenta('repartidor', nombre);
    expect(
      (await m.llamar('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id }, rep.token)).estado,
    ).toBe(200);
    await m.DB.prepare(
      "UPDATE usuarios SET idioma = 'es', telefono = ?, telefono_verificado_en = datetime('now', '-1 hour'), correo_confirmado_en = '2026-11-01 10:00:00' WHERE id = ?",
    )
      .bind(telefono, rep.id)
      .run();
    await m.DB.prepare(
      `INSERT INTO codigos_telefono (usuario_id, telefono, codigo_hash, intentos, enviados_hoy, canal, referencia)
       VALUES (?, ?, '-', 5, 1, ?, ?)
       ON CONFLICT(usuario_id) DO UPDATE SET telefono = excluded.telefono, canal = excluded.canal`,
    )
      .bind(rep.id, telefono, canal, `wamid.codigo-${rep.id}`)
      .run();
    return rep;
  };
  const rep = await conductor('Marina Ejemplo', '+584121234567');
  const ajustarRezagados = (cambios: Partial<AjustesRezagados> = {}) =>
    guardarAjustesRezagados(m.DB, {
      ...AJUSTES_REZAGADOS_DE_FABRICA,
      horaDesde: 0,
      horaHasta: 24,
      zonas: { [CCS.id]: 'encendido' },
      ...cambios,
    });
  const ajustarWhatsapp = (cambios: Partial<AjustesWhatsappFalta> = {}) =>
    guardarAjustesWhatsappFalta(m.DB, { ...AJUSTES_WHATSAPP_FALTA_DE_FABRICA, ...cambios });
  const aprobar = (
    estado: 'APPROVED' | 'PENDING' | 'REJECTED' = 'APPROVED',
    categoria = 'UTILITY',
  ) =>
    guardarEstadoPlantilla(m.DB, PLANTILLA_FALTA_NOMBRE, 'es', {
      estado,
      categoria,
      motivo: null,
      fuente: 'meta',
    });
  if (o.aprobada !== false) await aprobar();
  await ajustarRezagados();
  const filas = async (id = rep.id) =>
    (
      await m.DB.prepare(
        'SELECT paso, canal, origen, numero, estado, texto, referencia, actor_id FROM rezagados_mensajes WHERE usuario_id = ? ORDER BY creado_en, rowid',
      )
        .bind(id)
        .all<{
          paso: string;
          canal: string;
          origen: string;
          numero: number;
          estado: string;
          texto: string;
          referencia: string | null;
          actor_id: string | null;
        }>()
    ).results;
  const deWhatsapp = async (id = rep.id) => (await filas(id)).filter((f) => f.canal === 'whatsapp');
  /** Lo que salió en esta vuelta queda con la hora simulada (como en las pruebas del vigilante). */
  const moverA = (h: number) =>
    m.DB.prepare("UPDATE rezagados_mensajes SET creado_en = ? WHERE creado_en <= datetime('now')")
      .bind(sql(dentroDe(h)))
      .run();
  const env = { DB: m.DB, ...m.extra } as unknown as Env;
  return {
    m,
    rep,
    admin,
    equipo,
    conductor,
    ajustarRezagados,
    ajustarWhatsapp,
    aprobar,
    filas,
    deWhatsapp,
    moverA,
    env,
  };
}

describe('C-WHATSAPP-FALTA: la plantilla', () => {
  it('es de UTILIDAD, en español, con sus dos variables en medio del texto y un ejemplo de cada una', () => {
    const def = PLANTILLAS_FALTA.es!;
    expect(def.nombre).toBe('divoox_driver_te_falta');
    expect(def.categoria).toBe('UTILITY');
    const c = creacionEnMeta(def);
    expect(c.components[0]!.example.body_text[0]).toHaveLength(2);
    // Ninguna variable al principio ni al final del cuerpo (regla de Meta).
    expect(def.cuerpo.startsWith('{{')).toBe(false);
    expect(def.cuerpo.trimEnd().endsWith('}}')).toBe(false);
    expect(def.cuerpo).not.toMatch(/\}\}\s*\{\{/);
    // Sin tono promocional.
    expect(def.cuerpo).not.toMatch(/gana|oferta|descuento|promo|gratis|\$|USD/i);
    expect(textoDePlantilla(def, 'Ana', 'enviar tu moto a revisión')).toBe(
      'Hola Ana 👋 Para que tu cuenta de Divoox Driver empiece a recibir carreras te falta: enviar tu moto a revisión. Entra a la app y complétalo. Si tienes dudas, responde a este mensaje.',
    );
    // C-WHATSAPP-FALTA-IDIOMAS: la traducción al inglés de EE. UU., con las mismas reglas de Meta.
    const en = PLANTILLAS_FALTA.en!;
    expect(en.nombre).toBe(def.nombre);
    expect(en.idioma).toBe('en_US');
    expect(en.categoria).toBe('UTILITY');
    expect(en.cuerpo.startsWith('{{')).toBe(false);
    expect(en.cuerpo.trimEnd().endsWith('}}')).toBe(false);
    expect(en.cuerpo).not.toMatch(/\}\}\s*\{\{/);
    expect(en.cuerpo).not.toMatch(/earn|offer|discount|promo|free|\$|USD/i);
    expect(creacionEnMeta(en).components[0]!.example.body_text[0]).toHaveLength(2);
  });

  it('el paso exacto de su barra, en palabras y sin códigos', () => {
    const paso = (clave: string, extra: Record<string, unknown> = {}) =>
      ({ clave, quien: 'conductor', estado: 'pendiente', opcional: false, ...extra }) as never;
    const barra = (s: unknown, o: Record<string, unknown> = {}) => ({
      listo: false,
      recibiendo: false,
      siguiente: s as never,
      pasos: [s as never],
      vehiculo: { id: 'v', tipo: 'moto', estado: 'registrado' },
      ...o,
    });
    const ve = { pais: 'VE', appVieja: false };
    expect(faltaDeBarra(barra(paso('cara')), ve)?.texto).toBe('tomarte la foto de la cara');
    expect(faltaDeBarra(barra(paso('documento')), ve)?.texto).toBe('subir la foto de tu cédula');
    expect(faltaDeBarra(barra(paso('vehiculo', { falta: 'sin_vehiculo' })), ve)?.texto).toBe(
      'registrar tu moto con su placa',
    );
    expect(
      faltaDeBarra(barra(paso('vehiculo_aprobado', { falta: 'vehiculo_sin_enviar' })), ve)?.texto,
    ).toBe('enviar tu moto a revisión');
    expect(faltaDeBarra(barra(paso('saldo')), ve)?.texto).toBe('recargar saldo en tu billetera');
    expect(faltaDeBarra(barra(paso('conectado', { falta: 'desconectado' })), ve)?.texto).toBe(
      'conectarte en la app',
    );
    expect(faltaDeBarra(barra(paso('cara')), { pais: 'VE', appVieja: true })?.texto).toBe(
      'actualizar la app Divoox Driver',
    );
    // Lo que le toca al equipo nunca se le manda al conductor.
    expect(faltaDeBarra(barra(paso('identidad', { quien: 'equipo' })), ve)).toBeNull();
    expect(faltaDeBarra(barra(null, { recibiendo: true }), ve)).toBeNull();
  });
});

describe('C-WHATSAPP-FALTA: la vuelta del vigilante', () => {
  it('al trabado le llega UNO por WhatsApp con su paso exacto, y el correo sigue igual', async () => {
    const s = await escenario();
    const meta = simularMeta();
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(meta).toHaveLength(1);
    expect(meta[0]).toMatchObject({
      para: '584121234567',
      plantilla: 'divoox_driver_te_falta',
      idioma: 'es',
      nombre: 'Marina',
      falta: 'tomarte la foto de la cara',
    });
    const wa = await s.deWhatsapp();
    expect(wa).toHaveLength(1);
    expect(wa[0]).toMatchObject({ paso: 'cara', origen: 'auto', numero: 1, estado: 'enviado' });
    expect(wa[0]!.texto).toContain('te falta: tomarte la foto de la cara.');
    expect(wa[0]!.referencia).toBe('wamid.falta1');
    // El correo del vigilante no cambió por WhatsApp (sus topes van aparte).
    expect((await s.filas()).filter((f) => f.canal === 'correo')).toHaveLength(1);
  });

  it('TOPES: uno cada 24 horas y tres por paso; después se detiene', async () => {
    const s = await escenario();
    const meta = simularMeta();
    await s.ajustarRezagados({ plazosHoras: [1, 2, 3] });
    const cuenta: number[] = [];
    for (const h of [4, 10, 20, 30, 40, 60, 70, 100, 200]) {
      await correrRezagados(s.env, s.m.DB, dentroDe(h));
      await s.moverA(h);
      cuenta.push(meta.length);
    }
    expect(cuenta).toEqual([1, 1, 1, 2, 2, 3, 3, 3, 3]);
    expect((await s.deWhatsapp()).map((f) => f.numero)).toEqual([1, 2, 3]);
  });

  it('CONSENTIMIENTO: quien confirmó su celular por SMS, o lo cambió después, no recibe WhatsApp', async () => {
    const s = await escenario({ canalCodigo: 'sms' });
    const meta = simularMeta();
    const cambio = await s.conductor('Rosa Ejemplo', '+584141112233', 'whatsapp');
    await s.m.DB.prepare("UPDATE usuarios SET telefono = '+584149998877' WHERE id = ?")
      .bind(cambio.id)
      .run();
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(meta).toHaveLength(0);
    expect(await s.deWhatsapp()).toHaveLength(0);
    expect(await s.deWhatsapp(cambio.id)).toHaveLength(0);
    // Ni a mano, ni saltando la espera.
    const r = await s.equipo('POST', `/datos/admin/camila/whatsapp/${s.rep.id}`, {
      confirmar: true,
      saltarEspera: true,
    });
    expect(r.datos.enviado).toBe(false);
    expect(r.datos.motivo).toBe('no_confirmo_por_whatsapp');
    expect(meta).toHaveLength(0);
  });

  it('CONSENTIMIENTO: quien pidió la baja de los recordatorios no recibe WhatsApp', async () => {
    const s = await escenario();
    const meta = simularMeta();
    await s.m.DB.prepare("INSERT INTO rezagados_bajas (usuario_id, canal) VALUES (?, 'correo')")
      .bind(s.rep.id)
      .run();
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(meta).toHaveLength(0);
  });

  it('PLANTILLA: pendiente, rechazada o pasada a marketing = no envía, no falla y no escribe', async () => {
    for (const [estado, categoria] of [
      ['PENDING', 'UTILITY'],
      ['REJECTED', 'UTILITY'],
      ['APPROVED', 'MARKETING'],
    ] as const) {
      const s = await escenario();
      const meta = simularMeta();
      await s.aprobar(estado, categoria);
      await correrRezagados(s.env, s.m.DB, dentroDe(4));
      expect(meta, `${estado} ${categoria}`).toHaveLength(0);
      expect(await s.deWhatsapp()).toHaveLength(0);
      const g = await s.equipo('GET', '/datos/admin/camila/whatsapp');
      expect(g.datos.listo).toBe(false);
      expect(g.datos.motivo).toBe(
        categoria === 'MARKETING' ? 'plantilla_no_es_utilidad' : 'plantilla_no_aprobada',
      );
    }
  });

  it('PLANTILLA: sin crear todavía, el envío a mano tampoco sale y el panel lo dice', async () => {
    const s = await escenario({ aprobada: false });
    const meta = simularMeta();
    const r = await s.equipo('POST', `/datos/admin/camila/whatsapp/${s.rep.id}`, {
      confirmar: true,
    });
    expect(r.estado).toBe(200);
    expect(r.datos.enviado).toBe(false);
    expect(r.datos.motivo).toBe('plantilla_no_aprobada');
    expect(meta).toHaveLength(0);
  });

  it('el aviso de Meta «APPROVED» SIN categoría no enciende; con la categoría UTILITY sí, y «delivered» marca el mensaje entregado', async () => {
    const s = await escenario({ aprobada: false });
    const meta = simularMeta();
    const aviso = (cambio: unknown) => {
      const cuerpo = JSON.stringify({
        object: 'whatsapp_business_account',
        entry: [{ changes: [cambio] }],
      });
      return s.m.crudo('/datos/whatsapp/aviso', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': `sha256=${createHmac('sha256', SECRETO).update(cuerpo).digest('hex')}`,
        },
        body: cuerpo,
      });
    };
    expect(
      (
        await aviso({
          field: 'message_template_status_update',
          value: {
            event: 'APPROVED',
            message_template_name: PLANTILLA_FALTA_NOMBRE,
            message_template_language: 'es',
            reason: 'NONE',
          },
        })
      ).status,
    ).toBe(200);
    // Aprobada pero sin saber su categoría: no se supone utilidad, no sale nada.
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(meta).toHaveLength(0);
    expect((await s.equipo('GET', '/datos/admin/camila/whatsapp')).datos.motivo).toBe(
      'plantilla_sin_categoria',
    );
    await aviso({
      field: 'template_category_update',
      value: {
        message_template_name: PLANTILLA_FALTA_NOMBRE,
        message_template_language: 'es',
        new_category: 'UTILITY',
      },
    });
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(meta).toHaveLength(1);
    await aviso({
      field: 'messages',
      value: { statuses: [{ id: 'wamid.falta1', status: 'delivered' }] },
    });
    expect((await s.deWhatsapp())[0]!.estado).toBe('entregado');
    // Meta la pasa a marketing: deja de salir.
    await aviso({
      field: 'template_category_update',
      value: {
        message_template_name: PLANTILLA_FALTA_NOMBRE,
        message_template_language: 'es',
        previous_category: 'UTILITY',
        new_category: 'MARKETING',
      },
    });
    expect((await s.equipo('GET', '/datos/admin/camila/whatsapp')).datos.motivo).toBe(
      'plantilla_no_es_utilidad',
    );
  });

  it('PRESUPUESTO: el tope diario de mensajes y de dólares no se pasa', async () => {
    const s = await escenario();
    const meta = simularMeta();
    await s.conductor('Rosa Ejemplo', '+584141112233');
    await s.ajustarWhatsapp({ topeDiario: 1 });
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(meta).toHaveLength(1);
    const s2 = await escenario();
    const meta2 = simularMeta();
    await s2.conductor('Rosa Ejemplo', '+584141112233');
    // 0,01 por mensaje y 0,015 al día: cabe uno solo.
    await s2.ajustarWhatsapp({ presupuestoDiaUsd: 0.015 });
    await correrRezagados(s2.env, s2.m.DB, dentroDe(4));
    expect(meta2).toHaveLength(1);
    expect(await saludWhatsappFalta(s2.env, s2.m.DB)).toBe('tope');
  });

  it('PAÍS: con Venezuela apagado no sale nada; Estados Unidos nace encendido (C-WHATSAPP-PAIS)', async () => {
    expect(AJUSTES_WHATSAPP_FALTA_DE_FABRICA.paises.US).toBe(true);
    const s = await escenario();
    const meta = simularMeta();
    await s.ajustarWhatsapp({ paises: { VE: false } });
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(meta).toHaveLength(0);
  });

  it('sin credenciales de Meta: no envía, no falla, no escribe y el canario dice «pendiente»', async () => {
    const s = await escenario({ extra: { META_WHATSAPP_TOKEN: undefined } });
    const meta = simularMeta();
    const r = await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(r.whatsapp).toBe(0);
    expect(meta).toHaveLength(0);
    expect(await s.deWhatsapp()).toHaveLength(0);
    expect(await saludWhatsappFalta(s.env, s.m.DB)).toBe('pendiente');
    expect((await s.equipo('GET', '/datos/admin/camila/whatsapp')).datos.motivo).toBe(
      'sin_credenciales',
    );
  });

  it('si Meta lo rechaza queda «fallido» con su motivo y el canario en rojo', async () => {
    const s = await escenario();
    simularMeta({ falla: true });
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect((await s.deWhatsapp())[0]).toMatchObject({ estado: 'fallido' });
    expect(await saludWhatsappFalta(s.env, s.m.DB)).toBe('error');
  });
});

describe('C-WHATSAPP-FALTA: el botón del panel', () => {
  it('la vista previa arma el texto exacto y no escribe nada', async () => {
    const s = await escenario();
    const meta = simularMeta();
    const r = await s.equipo('POST', `/datos/admin/camila/whatsapp/${s.rep.id}`, {
      soloVista: true,
    });
    expect(r.estado).toBe(200);
    expect(r.datos.vista.texto).toBe(
      'Hola Marina 👋 Para que tu cuenta de Divoox Driver empiece a recibir carreras te falta: tomarte la foto de la cara. Entra a la app y complétalo. Si tienes dudas, responde a este mensaje.',
    );
    expect(r.datos.vista.puede).toBe(true);
    expect(meta).toHaveLength(0);
    expect(await s.deWhatsapp()).toHaveLength(0);
    const audit = await s.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM auditoria_admin WHERE accion = 'whatsapp_falta_enviar'",
    ).first<{ n: number }>();
    expect(Number(audit?.n)).toBe(0);
  });

  it('AUDITORÍA: enviar deja su fila en la auditoría y en su línea de tiempo; a mano tampoco se saltan las 24 h', async () => {
    const s = await escenario();
    const meta = simularMeta();
    const r = await s.equipo('POST', `/datos/admin/camila/whatsapp/${s.rep.id}`, {
      confirmar: true,
    });
    expect(r.datos.enviado).toBe(true);
    const wa = await s.deWhatsapp();
    expect(wa).toHaveLength(1);
    expect(wa[0]).toMatchObject({ origen: 'manual', actor_id: s.admin.id, estado: 'enviado' });
    const audit = await s.m.DB.prepare(
      "SELECT actor_id, objeto, despues_json FROM auditoria_admin WHERE accion = 'whatsapp_falta_enviar'",
    ).all<{ actor_id: string; objeto: string; despues_json: string }>();
    expect(audit.results).toHaveLength(1);
    expect(audit.results[0]!.objeto).toBe(`usuario:${s.rep.id}`);
    expect(JSON.parse(audit.results[0]!.despues_json)).toMatchObject({ estado: 'enviado' });
    // Otra vez en menos de 24 horas: no sale, ni pidiendo saltar la espera.
    const otra = await s.equipo('POST', `/datos/admin/camila/whatsapp/${s.rep.id}`, {
      confirmar: true,
      saltarEspera: true,
    });
    expect(otra.estado).toBe(200);
    expect(otra.datos).toMatchObject({ enviado: false, motivo: 'ya_hoy' });
    expect(meta).toHaveLength(1);
    // La línea de tiempo de la ficha muestra el canal.
    const act = await s.equipo('GET', `/datos/admin/repartidores/${s.rep.id}/actividad`);
    expect(JSON.stringify(act.datos)).toContain('mensaje:whatsapp');
  });

  it('AUDITORÍA: si no se puede reservar la auditoría, no se manda nada a Meta', async () => {
    const s = await escenario();
    const meta = simularMeta();
    await s.m.DB.prepare(
      "CREATE TRIGGER sin_auditoria BEFORE INSERT ON auditoria_admin BEGIN SELECT RAISE(ABORT, 'auditoría caída'); END",
    ).run();
    const r = await s.equipo('POST', `/datos/admin/camila/whatsapp/${s.rep.id}`, {
      confirmar: true,
    });
    expect(r.estado).toBe(500);
    expect(meta).toHaveLength(0);
    expect(await s.deWhatsapp()).toHaveLength(0);
  });

  it('a todos los trabados de la zona: vista previa sin escribir y, confirmando, solo a los de esa zona', async () => {
    const s = await escenario();
    const meta = simularMeta();
    const otra = await s.conductor('Rosa Ejemplo', '+584141112233');
    const vista = await s.equipo('GET', `/datos/admin/camila/whatsapp/zona/${CCS.id}`);
    expect(vista.estado).toBe(200);
    const ids = (vista.datos.filas as { id: string; puede: boolean }[])
      .filter((f) => f.puede)
      .map((f) => f.id);
    expect(ids.sort()).toEqual([s.rep.id, otra.id].sort());
    expect(meta).toHaveLength(0);
    expect(await s.deWhatsapp()).toHaveLength(0);
    // Sin confirmar no manda.
    expect(
      (await s.equipo('POST', `/datos/admin/camila/whatsapp/zona/${CCS.id}`, { ids })).estado,
    ).toBe(400);
    const r = await s.equipo('POST', `/datos/admin/camila/whatsapp/zona/${CCS.id}`, {
      ids: [...ids, s.admin.id],
      confirmar: true,
    });
    expect(r.datos.enviados).toBe(2);
    expect(meta.map((x) => x.para).sort()).toEqual(['584121234567', '584141112233']);
  });
});

describe('C-WHATSAPP-FALTA: revisión del 25 nov', () => {
  it('NUNCA a cuentas nuestras ni a la zona de revisión de las tiendas: reloj, zona y botón', async () => {
    const s = await escenario();
    const meta = simularMeta();
    const soporte = await s.conductor('Soporte Pruebas', '+584141110001');
    const windoce = await s.conductor('Luis Ejemplo', '+584141110002');
    await s.m.DB.prepare("UPDATE usuarios SET correo = 'luis.ejemplo@windoce.com' WHERE id = ?")
      .bind(windoce.id)
      .run();
    const prueba = await s.conductor('Ana Ejemplo', '+584141110003');
    await s.m.DB.prepare('UPDATE usuarios SET es_prueba = 1 WHERE id = ?').bind(prueba.id).run();
    const revisor = await s.conductor('Pedro Ejemplo', '+584141110004');
    await s.m.DB.prepare(
      "INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('VE-ZZ-REVIEW', 'Revisión', 'VE', 'USD', 'America/Caracas', 10.5, -66.9, 10, 1)",
    ).run();
    await s.m.DB.prepare(
      "UPDATE repartidores SET zona_id = 'VE-ZZ-REVIEW', ciudad_elegida_en = datetime('now') WHERE usuario_id = ?",
    )
      .bind(revisor.id)
      .run();
    await s.ajustarRezagados({ zonas: { [CCS.id]: 'encendido', 'VE-ZZ-REVIEW': 'encendido' } });
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    // Solo Marina (la real) recibe.
    expect(meta.map((x) => x.para)).toEqual(['584121234567']);
    for (const [u, motivo] of [
      [soporte, 'cuenta_interna'],
      [windoce, 'cuenta_interna'],
      [prueba, 'cuenta_interna'],
      [revisor, 'zona_revision'],
    ] as const) {
      const r = await s.equipo('POST', `/datos/admin/camila/whatsapp/${u.id}`, { confirmar: true });
      expect(r.datos, u.id).toMatchObject({ enviado: false, motivo });
    }
    // La zona de revisión no se puede ni mirar ni mandar.
    expect((await s.equipo('GET', '/datos/admin/camila/whatsapp/zona/VE-ZZ-REVIEW')).estado).toBe(
      403,
    );
    expect(
      (
        await s.equipo('POST', '/datos/admin/camila/whatsapp/zona/VE-ZZ-REVIEW', {
          ids: [revisor.id],
          confirmar: true,
        })
      ).estado,
    ).toBe(403);
    // La lista de la zona real no las trae, y mandarlas a mano por la zona no sale.
    const vista = await s.equipo('GET', `/datos/admin/camila/whatsapp/zona/${CCS.id}`);
    const ids = (vista.datos.filas as { id: string }[]).map((f) => f.id);
    for (const u of [soporte, windoce, prueba]) expect(ids).not.toContain(u.id);
    await s.equipo('POST', `/datos/admin/camila/whatsapp/zona/${CCS.id}`, {
      ids: [soporte.id, windoce.id, prueba.id],
      confirmar: true,
    });
    expect(meta).toHaveLength(1);
  });

  it('RELOJ: los que no pueden recibirlo no tapan a los demás, y el cursor avanza', async () => {
    const s = await escenario();
    const meta = simularMeta();
    // 26 sin consentimiento (confirmaron por SMS) y MÁS viejos que el que sí puede.
    for (let i = 0; i < 26; i++)
      await s.conductor(
        `Sin Permiso ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i]}x`,
        `+5841400000${String(i).padStart(2, '0')}`,
        'sms',
      );
    await s.m.DB.prepare(
      "UPDATE usuarios SET creado_en = datetime('now', '-3 days') WHERE nombre LIKE 'Sin Permiso%'",
    ).run();
    // Lo que cuenta es cuánto llevan quietos: su último paso del registro también es viejo.
    await s.m.DB.prepare(
      "UPDATE embudo_cuenta SET creado_en = datetime('now', '-3 days') WHERE usuario_id IN (SELECT id FROM usuarios WHERE nombre LIKE 'Sin Permiso%')",
    ).run();
    await s.m.DB.prepare("UPDATE usuarios SET creado_en = datetime('now', '-1 day') WHERE id = ?")
      .bind(s.rep.id)
      .run();
    await s.m.DB.prepare(
      "UPDATE embudo_cuenta SET creado_en = datetime('now', '-1 day') WHERE usuario_id = ?",
    )
      .bind(s.rep.id)
      .run();
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(meta.map((x) => x.para)).toEqual(['584121234567']);
  });

  it('RELOJ: con más de un lote, la siguiente vuelta sigue donde quedó (cursor)', async () => {
    const s = await escenario();
    const meta = simularMeta();
    // 26 con permiso que ya agotaron sus 3 de «la foto de la cara» (hace días) y son más viejos.
    const agotados: string[] = [];
    for (let i = 0; i < 26; i++) {
      const u = await s.conductor(
        `Agotado ${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[i]}x`,
        `+5841410000${String(i).padStart(2, '0')}`,
      );
      agotados.push(u.id);
    }
    await s.m.DB.prepare(
      "UPDATE usuarios SET creado_en = datetime('now', '-3 days') WHERE nombre LIKE 'Agotado%'",
    ).run();
    // Lo que cuenta es cuánto llevan quietos: su último paso del registro también es viejo.
    await s.m.DB.prepare(
      "UPDATE embudo_cuenta SET creado_en = datetime('now', '-3 days') WHERE usuario_id IN (SELECT id FROM usuarios WHERE nombre LIKE 'Agotado%')",
    ).run();
    for (const id of agotados)
      for (let n = 1; n <= 3; n++)
        await s.m.DB.prepare(
          `INSERT INTO rezagados_mensajes (id, usuario_id, paso, canal, origen, numero, estado, creado_en)
           VALUES (?, ?, 'cara', 'whatsapp', 'auto', ?, 'enviado', datetime('now', '-${n + 3} days'))`,
        )
          .bind(`${id}-${n}`, id, n)
          .run();
    await s.m.DB.prepare("UPDATE usuarios SET creado_en = datetime('now', '-1 day') WHERE id = ?")
      .bind(s.rep.id)
      .run();
    await s.m.DB.prepare(
      "UPDATE embudo_cuenta SET creado_en = datetime('now', '-1 day') WHERE usuario_id = ?",
    )
      .bind(s.rep.id)
      .run();
    const vueltas: number[] = [];
    for (let v = 0; v < 3; v++) {
      await correrRezagados(s.env, s.m.DB, dentroDe(4));
      vueltas.push(meta.length);
    }
    // Sin cursor los mismos 25 agotados ocupaban cada vuelta y Marina nunca llegaba.
    expect(vueltas.at(-1)).toBe(1);
    expect(meta[0]!.para).toBe('584121234567');
  });

  it('RECHAZOS: lo que Meta rechaza cuenta para los tres por paso y queda en errores', async () => {
    const s = await escenario();
    const meta = simularMeta({ falla: true });
    await s.ajustarRezagados({ plazosHoras: [1, 2, 3] });
    for (const h of [4, 30, 60, 100, 200]) {
      await correrRezagados(s.env, s.m.DB, dentroDe(h));
      await s.moverA(h);
      olvidarErrorWhatsappFalta();
    }
    expect(meta).toHaveLength(3);
    const e = await s.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM errores_servidor WHERE ruta = 'whatsapp/te-falta'",
    ).first<{ n: number }>();
    expect(Number(e?.n)).toBe(3);
  });

  it('C-WHATSAPP-FALTA-IDIOMAS: cuenta en inglés sin la plantilla en inglés aprobada nunca queda sin salida', async () => {
    const s = await escenario();
    const meta = simularMeta();
    await s.m.DB.prepare("UPDATE usuarios SET idioma = 'en' WHERE id = ?").bind(s.rep.id).run();
    // Por defecto, su idioma: no sale, pero dice que en español sí se puede.
    const vista = await s.equipo('POST', `/datos/admin/camila/whatsapp/${s.rep.id}`, {
      soloVista: true,
    });
    expect(vista.datos.vista.idioma).toBe('en');
    expect(vista.datos.vista.idiomaCuenta).toBe('en');
    expect(vista.datos.vista.motivo).toBe('idioma_sin_plantilla');
    expect(vista.datos.vista.idiomas).toEqual({ es: true, en: false });
    // El equipo elige español: sale, entero en español, con la plantilla española.
    const es = await s.equipo('POST', `/datos/admin/camila/whatsapp/${s.rep.id}`, {
      confirmar: true,
      idioma: 'es',
    });
    expect(es.datos.enviado).toBe(true);
    expect(meta).toHaveLength(1);
    expect(meta[0]!.idioma).toBe('es');
    expect(meta[0]!.falta).toBe('tomarte la foto de la cara');
  });

  it('C-WHATSAPP-FALTA-IDIOMAS: con la de inglés aprobada sale en inglés, entero en inglés', async () => {
    const s = await escenario();
    const meta = simularMeta();
    await s.m.DB.prepare("UPDATE usuarios SET idioma = 'en' WHERE id = ?").bind(s.rep.id).run();
    await guardarEstadoPlantilla(s.m.DB, PLANTILLA_FALTA_NOMBRE, 'en_US', {
      estado: 'APPROVED',
      categoria: 'UTILITY',
      motivo: null,
      fuente: 'meta',
    });
    const vista = await s.equipo('POST', `/datos/admin/camila/whatsapp/${s.rep.id}`, {
      soloVista: true,
    });
    expect(vista.datos.vista.idiomas).toEqual({ es: true, en: true });
    expect(vista.datos.vista.texto).toBe(
      'Hi Marina 👋 To start receiving trips with your Divoox Driver account, you still need to: take your face photo. Open the app to finish it. If you have any questions, reply to this message.',
    );
    const r = await s.equipo('POST', `/datos/admin/camila/whatsapp/${s.rep.id}`, {
      confirmar: true,
    });
    expect(r.datos.enviado).toBe(true);
    expect(meta[0]!.idioma).toBe('en_US');
    expect(meta[0]!.falta).toBe('take your face photo');
  });

  it('C-WHATSAPP-PAIS: el interruptor por país se respeta (EE. UU. apagado no sale, encendido sí)', async () => {
    const s = await escenario();
    const meta = simularMeta();
    await s.ajustarWhatsapp({ paises: { VE: false, US: true } });
    const no = await s.equipo('POST', `/datos/admin/camila/whatsapp/${s.rep.id}`, {
      confirmar: true,
    });
    expect(no.datos.enviado).toBe(false);
    expect(no.datos.motivo).toBe('pais_apagado');
    expect(meta).toHaveLength(0);
  });

  it('C-WHATSAPP-PAIS: una cuenta de EE. UU. sin zona real (Miami de fábrica) no sale «apagado»: su celular dice su país', async () => {
    const s = await escenario();
    simularMeta();
    const rep = await s.conductor('Mario Ejemplo', '+13055550123');
    // Como las cuentas reales de Miami: la fila con la ciudad de fábrica y ninguna zona elegida.
    await s.m.DB.batch([
      s.m.DB.prepare(
        "UPDATE repartidores SET zona_id = 'US-FL-MIAMI', ubicacion_en = NULL, ciudad_elegida_en = NULL WHERE usuario_id = ?",
      ).bind(rep.id),
      s.m.DB.prepare('UPDATE usuarios SET zona_id = NULL, lugar_pais = NULL WHERE id = ?').bind(
        rep.id,
      ),
    ]);
    await s.ajustarWhatsapp({ paises: { VE: true, US: true } });
    const v = await s.equipo('POST', `/datos/admin/camila/whatsapp/${rep.id}`, { soloVista: true });
    expect(v.datos.vista.motivo).not.toBe('pais_apagado');
    // Y con EE. UU. apagado, sí lo dice (el interruptor se respeta).
    await s.ajustarWhatsapp({ paises: { VE: true, US: false } });
    const no = await s.equipo('POST', `/datos/admin/camila/whatsapp/${rep.id}`, {
      soloVista: true,
    });
    expect(no.datos.vista.motivo).toBe('pais_apagado');
  });
});
