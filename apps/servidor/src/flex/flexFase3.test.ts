import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import {
  B,
  type M,
  empresa,
  envios,
  etiquetasDe,
  k,
  llamar,
  ocupaciones,
  ruta,
  rutaEnCurso,
  subir,
  vincular,
} from '../pruebas/flex';
import { usarTransporteAvisos } from '../notificaciones';
import { TAREAS_RELOJ } from '../rutas/operacion';
import { reiniciarLimiteClaves } from './autorizacion';
import { avisarOfertasPorVencer, limpiarFlex, vencerOfertasFlex } from './automatizacion';
import {
  CABECERA_FIRMA,
  FALLOS_PARA_DESACTIVAR,
  MAX_INTENTOS,
  despacharIntegraciones,
  ipPrivada,
  revisarFormaDestino,
  usarResolverDns,
  usarTransporteWebhooks,
  verificarFirma,
} from './integraciones';

/**
 * Divoox Flex · Fase 3 (C-FLEX-EVENTOS, C-FLEX-VENCIMIENTO, C-FLEX-AVISOS, C-FLEX-INTEGRACIONES,
 * C-FLEX-SSRF, C-FLEX-CAPACIDAD, C-FLEX-OPTIMIZAR, C-FLEX-RETENCION, C-FLEX-KPI). SQLite en memoria,
 * avisos y sistemas de las empresas simulados. Nada sale a internet, nada mueve dinero.
 */

const LLAVE = { FLEX_LLAVE_WEBHOOKS: 'llave-de-pruebas-para-cifrar-secretos-0123456789' };
const mundoF = () => mundo(LLAVE);

type Push = { to: string; title: string; body: string; data: Record<string, string> };
let pushes: Push[] = [];
type Llamada = { url: string; headers: Record<string, string>; body: string; redirect?: string };
let recibidas: Llamada[] = [];
let respuesta: (l: Llamada) => Response = () => new Response('ok', { status: 200 });

beforeEach(() => {
  reiniciarLimiteClaves();
  pushes = [];
  recibidas = [];
  respuesta = () => new Response('ok', { status: 200 });
  usarTransporteAvisos(async (_u, init) => {
    const lista = JSON.parse(String(init?.body)) as Push[];
    pushes.push(...lista);
    return new Response(JSON.stringify({ data: lista.map(() => ({ status: 'ok' })) }), {
      status: 200,
    });
  });
  usarTransporteWebhooks(async (url, init) => {
    const l = {
      url,
      headers: Object.fromEntries(Object.entries(init.headers as Record<string, string>)),
      body: String(init.body),
      redirect: init.redirect,
    };
    recibidas.push(l);
    return respuesta(l);
  });
  // DNS simulado: los nombres «interno» apuntan a redes privadas; el resto, a una IP pública.
  usarResolverDns(async (nombre) =>
    nombre.includes('interno')
      ? ['10.0.0.7']
      : nombre.includes('metadatos')
        ? ['169.254.169.254']
        : nombre.includes('seis')
          ? ['::1']
          : ['93.184.216.34'],
  );
});
afterEach(() => {
  usarTransporteAvisos(null);
  usarTransporteWebhooks(null);
  usarResolverDns(null);
});

const celular = (m: M, usuarioId: string) =>
  m.DB.prepare('INSERT INTO dispositivos (token, usuario_id) VALUES (?, ?)')
    .bind(`ExponentPushToken[${usuarioId}]`, usuarioId)
    .run();
const pushesDe = (usuarioId: string) =>
  pushes.filter((p) => p.to === `ExponentPushToken[${usuarioId}]`);
const eventos = async (m: M, empresaId: string) =>
  (
    await m.DB.prepare(
      'SELECT tipo, objeto_id, datos_json FROM flex_eventos WHERE empresa_id = ? ORDER BY id',
    )
      .bind(empresaId)
      .all<{ tipo: string; objeto_id: string; datos_json: string }>()
  ).results;
const vencer = (m: M, rutaId: string) =>
  m.DB.prepare("UPDATE rutas_flex SET oferta_vence_en = datetime('now', '-1 minutes') WHERE id = ?")
    .bind(rutaId)
    .run();

async function conIntegracion(
  m: M,
  e: { id: string; dueno: { token: string } },
  eventosPedidos = ['*'],
) {
  const r = await llamar(
    m,
    'POST',
    `${B}/empresas/${e.id}/integraciones`,
    { url: 'https://erp.cliente-ejemplo.com/divoox', eventos: eventosPedidos },
    e.dueno.token,
  );
  expect(r.estado).toBe(201);
  return { id: r.datos.integracion.id as string, secreto: r.datos.secreto as string };
}

describe('Flex · bandeja de eventos (C-FLEX-EVENTOS)', () => {
  it('la base deja un evento por cada cambio de custodia, de ruta y por cada incidencia, sin duplicar', async () => {
    const m = mundoF();
    const { e, C, paradas, rutaId, cond } = await rutaEnCurso(m, 2, 1);
    const tipos = (await eventos(m, e.id)).map((x) => x.tipo);
    expect(tipos.filter((t) => t === 'package.created')).toHaveLength(2);
    expect(tipos.filter((t) => t === 'package.assigned')).toHaveLength(2);
    expect(tipos.filter((t) => t === 'package.loaded')).toHaveLength(2);
    expect(tipos.filter((t) => t === 'package.in_transit')).toHaveLength(2);
    expect(tipos).toEqual(
      expect.arrayContaining(['route.assigned', 'route.accepted', 'route.started']),
    );
    // Repetir la misma petición (misma clave) no repite custodia ni eventos.
    const p = paradas[0];
    const foto = (await subir(m, `${C}/paradas/${p.id}/prueba`, cond.token)).datos.pruebaId;
    const clave = k();
    for (let i = 0; i < 2; i++)
      expect(
        (
          await llamar(m, 'POST', `${C}/paradas/${p.id}/entregar`, { fotoId: foto }, cond.token, {
            'idempotency-key': clave,
          })
        ).estado,
      ).toBe(200);
    const inc = await llamar(
      m,
      'POST',
      `${C}/paradas/${paradas[1].id}/incidencia`,
      { motivo: 'ausente', proximaAccion: 'devolver' },
      cond.token,
    );
    expect(inc.estado).toBe(200);
    const despues = await eventos(m, e.id);
    expect(despues.filter((x) => x.tipo === 'package.delivered')).toHaveLength(1);
    expect(despues.filter((x) => x.tipo === 'package.failed')).toHaveLength(1);
    const exc = despues.find((x) => x.tipo === 'delivery.exception')!;
    expect(JSON.parse(exc.datos_json)).toMatchObject({
      reason: 'ausente',
      next_action: 'devolver',
      route_id: rutaId,
    });
    // Sin datos personales del destinatario en ningún evento.
    for (const x of despues) expect(x.datos_json).not.toMatch(/Cliente \d|3050000000|Main St/);
  });

  it('volver al centro deja «package.returned» hacia el centro; el alta en el centro no cuenta como devolución', async () => {
    const m = mundoF();
    const { e, C, paradas, cond } = await rutaEnCurso(m, 1, 1);
    await llamar(
      m,
      'POST',
      `${C}/paradas/${paradas[0].id}/incidencia`,
      { motivo: 'ausente', proximaAccion: 'devolver' },
      cond.token,
    );
    const dev = await llamar(m, 'POST', `${C}/devolucion`, {}, cond.token);
    const codigo = dev.datos.devoluciones[0].codigoEtiqueta;
    await llamar(m, 'POST', `${C}/devolucion/entregar`, { codigo }, cond.token);
    expect(
      (
        await llamar(
          m,
          'POST',
          `${B}/empresas/${e.id}/devoluciones/recibir`,
          { codigo, destino: 'centro' },
          e.dueno.token,
        )
      ).estado,
    ).toBe(200);
    const devueltos = (await eventos(m, e.id)).filter((x) => x.tipo === 'package.returned');
    expect(devueltos).toHaveLength(1);
    expect(JSON.parse(devueltos[0]!.datos_json).returned_to).toBe('hub');
  });
});

describe('Flex · ofertas vencidas con el reloj (C-FLEX-VENCIMIENTO)', () => {
  it('la oferta vencida vuelve a borrador, suelta los paquetes, avisa una sola vez y es idempotente', async () => {
    const m = mundoF();
    const e = await empresa(m);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'red');
    await celular(m, cond.id);
    await celular(m, e.dueno.id);
    const rutaId = await ruta(m, e, await envios(m, e, 3));
    const of = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/ofrecer`,
      { conductorId: cond.id, minutos: 5 },
      e.dueno.token,
    );
    expect(of.estado).toBe(200);
    expect(pushesDe(cond.id).map((p) => p.data.evento)).toEqual(['oferta']);
    // Antes de vencer, faltan menos de 10 min: aviso «por vencer», una sola vez aunque el reloj pase dos.
    await avisarOfertasPorVencer(m.extra as never, m.DB);
    await avisarOfertasPorVencer(m.extra as never, m.DB);
    expect(pushesDe(cond.id).map((p) => p.data.evento)).toEqual(['oferta', 'oferta_por_vencer']);
    await vencer(m, rutaId);
    const env = { DB: m.DB, ...m.extra } as never;
    expect(await vencerOfertasFlex(env, m.DB)).toMatchObject({ vencidas: 1 });
    const r = await m.DB.prepare('SELECT estado, conductor_id FROM rutas_flex WHERE id = ?')
      .bind(rutaId)
      .first<{ estado: string; conductor_id: string | null }>();
    expect(r).toEqual({ estado: 'borrador', conductor_id: null });
    expect(
      (await m.DB.prepare('SELECT COUNT(*) AS n FROM ruta_paquetes WHERE ruta_id = ?')
        .bind(rutaId)
        .first<{ n: number }>())!.n,
    ).toBe(0);
    expect(await ocupaciones(m, cond.id)).toEqual([]);
    const audit = await m.DB.prepare(
      "SELECT actor_tipo FROM empresa_auditoria WHERE objeto = ? AND accion = 'ruta.oferta_vencida'",
    )
      .bind(rutaId)
      .all();
    expect(audit.results).toEqual([{ actor_tipo: 'sistema' }]);
    expect(pushesDe(e.dueno.id).map((p) => p.data.evento)).toEqual(['oferta_vencida']);
    expect(pushesDe(cond.id).map((p) => p.data.evento)).toContain('oferta_retirada');
    // Segunda vuelta del reloj: no hay nada más que vencer, nada se repite.
    const antes = pushes.length;
    expect(await vencerOfertasFlex(env, m.DB)).toMatchObject({ vencidas: 0 });
    expect(pushes.length).toBe(antes);
    // El conductor ya no la puede aceptar.
    expect(
      (await llamar(m, 'POST', `${B}/conductor/rutas/${rutaId}/aceptar`, {}, cond.token)).estado,
    ).toBe(404);
  });

  it('si el conductor acepta en el mismo instante en que vence, gana uno solo y nada queda a medias', async () => {
    const m = mundoF();
    const e = await empresa(m);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'red');
    const rutaId = await ruta(m, e, await envios(m, e, 2));
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/ofrecer`,
      { conductorId: cond.id, minutos: 5 },
      e.dueno.token,
    );
    const env = { DB: m.DB, ...m.extra } as never;
    const [acepto, reloj] = await Promise.all([
      llamar(m, 'POST', `${B}/conductor/rutas/${rutaId}/aceptar`, {}, cond.token),
      vencerOfertasFlex(env, m.DB),
    ]);
    const r = await m.DB.prepare('SELECT estado FROM rutas_flex WHERE id = ?')
      .bind(rutaId)
      .first<{ estado: string }>();
    if (acepto.estado === 200) {
      expect(r!.estado).toBe('aceptada');
      expect(await ocupaciones(m, cond.id)).toHaveLength(1);
    } else {
      expect(r!.estado).toBe('borrador');
      expect(await ocupaciones(m, cond.id)).toEqual([]);
    }
    expect(reloj.vencidas + (acepto.estado === 200 ? 1 : 0)).toBeLessThanOrEqual(1);
  });

  it('las tareas de Flex van en el reloj existente (no hay un segundo reloj)', () => {
    const nombres = TAREAS_RELOJ.map((t) => t.nombre);
    expect(nombres).toEqual(
      expect.arrayContaining([
        'flex_ofertas',
        'flex_ofertas_por_vencer',
        'flex_integraciones',
        'flex_limpieza',
      ]),
    );
    expect(new Set(nombres).size).toBe(nombres.length);
  });
});

describe('Flex · avisos al celular (C-FLEX-AVISOS)', () => {
  it('conductor y empresa reciben cada aviso una vez, en su idioma y sin datos personales', async () => {
    const m = mundoF();
    const e = await empresa(m);
    const cond = await m.cuenta('repartidor');
    await m.DB.prepare("UPDATE usuarios SET idioma = 'en' WHERE id = ?").bind(cond.id).run();
    await m.DB.prepare("UPDATE usuarios SET idioma = 'es' WHERE id = ?").bind(e.dueno.id).run();
    await vincular(m, e, cond.id, 'propio');
    await celular(m, cond.id);
    await celular(m, e.dueno.id);
    const rutaId = await ruta(m, e, await envios(m, e, 2));
    const clave = k();
    for (let i = 0; i < 2; i++)
      await llamar(
        m,
        'POST',
        `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
        { conductorId: cond.id },
        e.dueno.token,
        { 'idempotency-key': clave },
      );
    const alConductor = pushesDe(cond.id);
    expect(alConductor).toHaveLength(1);
    expect(alConductor[0]).toMatchObject({
      title: 'You have a new route',
      data: { tipo: 'flex', rutaId },
    });
    const C = `${B}/conductor/rutas/${rutaId}`;
    await llamar(m, 'POST', `${C}/aceptar`, {}, cond.token);
    await llamar(m, 'POST', `${C}/llegada-centro`, { lat: 25.77, lng: -80.19 }, cond.token);
    for (const c of await etiquetasDe(m, rutaId))
      await llamar(m, 'POST', `${C}/escanear`, { codigo: `dvx:${c}` }, cond.token);
    await llamar(m, 'POST', `${C}/iniciar`, { lat: 25.77, lng: -80.19 }, cond.token);
    const det = await llamar(m, 'GET', C, undefined, cond.token);
    const [p1, p2] = det.datos.ruta.paradas;
    const foto = (await subir(m, `${C}/paradas/${p1.id}/prueba`, cond.token)).datos.pruebaId;
    await llamar(m, 'POST', `${C}/paradas/${p1.id}/entregar`, { fotoId: foto }, cond.token);
    const inc = await llamar(
      m,
      'POST',
      `${C}/paradas/${p2.id}/incidencia`,
      { motivo: 'ausente', proximaAccion: 'reintentar' },
      cond.token,
    );
    const incId = (await m.DB.prepare('SELECT id FROM flex_incidencias WHERE ruta_id = ?')
      .bind(rutaId)
      .first<{ id: string }>())!.id;
    expect(inc.estado).toBe(200);
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/incidencias/${incId}/autorizar-reintento`,
      {},
      e.dueno.token,
    );
    const empresaVio = pushesDe(e.dueno.id).map((p) => p.data.evento);
    expect(empresaVio).toEqual([
      'ruta_aceptada',
      'ruta_iniciada',
      'incidencia',
      'entregas_terminadas',
    ]);
    expect(pushesDe(cond.id).map((p) => p.data.evento)).toEqual([
      'asignacion',
      'reintento_autorizado',
    ]);
    // Ningún aviso lleva el nombre, el teléfono ni la dirección del destinatario.
    for (const p of pushes)
      expect(`${p.title} ${p.body}`).not.toMatch(/Cliente|3050000000|Main St/);
    // Español para la empresa.
    expect(pushesDe(e.dueno.id)[0]!.title).toBe('Ruta aceptada');
  });

  it('retirar una oferta y cancelar una ruta avisan al conductor', async () => {
    const m = mundoF();
    const e = await empresa(m);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'hibrido');
    await celular(m, cond.id);
    const rutaId = await ruta(m, e, await envios(m, e, 1));
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/ofrecer`,
      { conductorId: cond.id },
      e.dueno.token,
    );
    await llamar(m, 'POST', `${B}/empresas/${e.id}/rutas/${rutaId}/retirar`, {}, e.dueno.token);
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
      { conductorId: cond.id },
      e.dueno.token,
    );
    await llamar(m, 'POST', `${B}/empresas/${e.id}/rutas/${rutaId}/cancelar`, {}, e.dueno.token);
    expect(pushesDe(cond.id).map((p) => p.data.evento)).toEqual([
      'oferta',
      'oferta_retirada',
      'asignacion',
      'ruta_cancelada',
    ]);
  });
});

describe('Flex · anti-SSRF (C-FLEX-SSRF)', () => {
  it.each([
    ['http://erp.ejemplo-real.com/x', /https/],
    ['https://10.0.0.1/x', /IP/],
    ['https://[::1]/x', /IP/],
    ['https://localhost/x', /interna/],
    ['https://servidor.internal/x', /interna/],
    ['https://erp.ejemplo-real.com:8443/x', /443/],
    ['https://usuario:clave@erp.ejemplo-real.com/x', /usuario/],
    ['https://api.divoox.com/x', /interna|no permitida/],
  ])('rechaza %s', (url, motivo) => {
    expect(() => revisarFormaDestino(url)).toThrow(motivo);
  });

  it('las IP privadas, locales y reservadas (v4 y v6) se reconocen', () => {
    for (const ip of [
      '10.1.2.3',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '192.168.1.1',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:10.0.0.1',
      '2001:db8::1',
    ])
      expect(ipPrivada(ip), ip).toBe(true);
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700::1111', '::ffff:8.8.8.8'])
      expect(ipPrivada(ip), ip).toBe(false);
  });

  it('un nombre público que resuelve a una IP interna se rechaza al registrar', async () => {
    const m = mundoF();
    const e = await empresa(m);
    for (const url of [
      'https://erp.interno-empresa.com/x',
      'https://metadatos.nube-ejemplo.com/x',
      'https://seis.ejemplo-real.com/x',
    ]) {
      const r = await llamar(
        m,
        'POST',
        `${B}/empresas/${e.id}/integraciones`,
        { url, eventos: ['*'] },
        e.dueno.token,
      );
      expect(r.estado, url).toBe(400);
      expect(r.datos.error).toMatch(/interna|internal/);
    }
  });

  it('una redirección cuenta como fallo y no se sigue', async () => {
    const m = mundoF();
    const e = await empresa(m);
    const w = await conIntegracion(m, e);
    respuesta = () =>
      new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/' } });
    const r = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/integraciones/${w.id}/probar`,
      {},
      e.dueno.token,
    );
    expect(r.datos).toMatchObject({ ok: false, http: 302, error: 'redirección no permitida' });
    expect(recibidas).toHaveLength(1);
    expect(recibidas[0]!.url).toBe('https://erp.cliente-ejemplo.com/divoox');
    // Nunca se sigue una redirección: el transporte recibe «manual».
    expect(recibidas[0]!.redirect).toBe('manual');
  });
});

describe('Flex · integraciones salientes (C-FLEX-INTEGRACIONES)', () => {
  it('el secreto sale una vez y se guarda cifrado; sin la llave del servidor no se activan', async () => {
    const m = mundoF();
    const e = await empresa(m);
    const w = await conIntegracion(m, e);
    expect(w.secreto).toMatch(/^whsec_dvx_/);
    const lista = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/integraciones`,
      undefined,
      e.dueno.token,
    );
    expect(JSON.stringify(lista.datos)).not.toContain(w.secreto);
    expect(lista.datos.integraciones[0].secretoPrefijo).toBe(w.secreto.slice(0, 14));
    const fila = await m.DB.prepare('SELECT secreto_cifrado FROM flex_webhooks WHERE id = ?')
      .bind(w.id)
      .first<{ secreto_cifrado: string }>();
    expect(fila!.secreto_cifrado).toMatch(/^v1:d:/);
    expect(fila!.secreto_cifrado).not.toContain(w.secreto.slice(10));
    // Un servidor sin llave (ni secreto del reloj) no deja crear integraciones.
    const sinLlave = mundo();
    const e2 = await empresa(sinLlave);
    const r = await llamar(
      sinLlave,
      'POST',
      `${B}/empresas/${e2.id}/integraciones`,
      { url: 'https://erp.cliente-ejemplo.com/x', eventos: ['*'] },
      e2.dueno.token,
    );
    expect(r.estado).toBe(503);
  });

  it('cada evento llega firmado, con id único y marca de tiempo; la firma vieja o alterada no vale', async () => {
    const m = mundoF();
    const { e, rutaId } = await (async () => {
      const e = await empresa(m);
      return { e, rutaId: '' };
    })();
    void rutaId;
    const w = await conIntegracion(m, e, ['package.created', 'route.assigned']);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'propio');
    const r = await ruta(m, e, await envios(m, e, 2));
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${r}/asignar`,
      { conductorId: cond.id },
      e.dueno.token,
    );
    // El despacho tras cada escritura ya mandó lo de esta empresa; el reloj termina lo que falte.
    await despacharIntegraciones({ DB: m.DB, ...LLAVE } as never, m.DB);
    const tipos = recibidas.map((x) => JSON.parse(x.body).type);
    expect(tipos.filter((t) => t === 'package.created')).toHaveLength(2);
    expect(tipos.filter((t) => t === 'route.assigned')).toHaveLength(1);
    // Solo lo pedido: package.assigned no estaba en la lista.
    expect(tipos).not.toContain('package.assigned');
    const ids = recibidas.map((x) => x.headers['Divoox-Event-Id']);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of recibidas) {
      expect(await verificarFirma(l.body, l.headers[CABECERA_FIRMA]!, w.secreto)).toBe(true);
      expect(JSON.parse(l.body).id).toBe(l.headers['Divoox-Event-Id']);
    }
    const l = recibidas[0]!;
    expect(await verificarFirma(`${l.body} `, l.headers[CABECERA_FIRMA]!, w.secreto)).toBe(false);
    expect(await verificarFirma(l.body, l.headers[CABECERA_FIRMA]!, 'whsec_dvx_otro')).toBe(false);
    // Repetición fuera de tiempo (10 minutos después): se rechaza.
    expect(
      await verificarFirma(
        l.body,
        l.headers[CABECERA_FIRMA]!,
        w.secreto,
        Math.floor(Date.now() / 1000) + 600,
      ),
    ).toBe(false);
    // Despachar otra vez no manda nada repetido.
    const antes = recibidas.length;
    await despacharIntegraciones({ DB: m.DB, ...LLAVE } as never, m.DB);
    expect(recibidas.length).toBe(antes);
  });

  it('reintenta con espera creciente, guarda cada intento y se rinde al máximo de intentos', async () => {
    const m = mundoF();
    const e = await empresa(m);
    const w = await conIntegracion(m, e, ['package.created']);
    respuesta = () => new Response('caído', { status: 503 });
    await envios(m, e, 1);
    const env = { DB: m.DB, ...LLAVE } as never;
    await despacharIntegraciones(env, m.DB);
    let en = await m.DB.prepare(
      "SELECT estado, intentos, ultimo_http, proximo_en > datetime('now') AS futuro FROM flex_webhook_entregas WHERE webhook_id = ?",
    )
      .bind(w.id)
      .first<{ estado: string; intentos: number; ultimo_http: number; futuro: number }>();
    expect(en).toMatchObject({ estado: 'pendiente', intentos: 1, ultimo_http: 503, futuro: 1 });
    // Antes de la espera no se reintenta.
    const n = recibidas.length;
    await despacharIntegraciones(env, m.DB);
    expect(recibidas.length).toBe(n);
    for (let i = 1; i < MAX_INTENTOS; i++) {
      await m.DB.prepare(
        "UPDATE flex_webhook_entregas SET proximo_en = datetime('now', '-1 seconds')",
      ).run();
      await despacharIntegraciones(env, m.DB);
    }
    en = await m.DB.prepare(
      'SELECT estado, intentos FROM flex_webhook_entregas WHERE webhook_id = ?',
    )
      .bind(w.id)
      .first<never>();
    expect(en).toMatchObject({ estado: 'fallido', intentos: MAX_INTENTOS });
    const intentos = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/integraciones/${w.id}/intentos`,
      undefined,
      e.dueno.token,
    );
    expect(intentos.datos.intentos).toHaveLength(MAX_INTENTOS);
    expect(intentos.datos.intentos[0]).toMatchObject({ http: 503, tipo: 'package.created' });
    // El registro nunca guarda el cuerpo ni el secreto.
    expect(JSON.stringify(intentos.datos)).not.toContain(w.secreto);
  });

  it('se desactiva sola tras muchos fallos seguidos y la empresa la reactiva', async () => {
    const m = mundoF();
    const e = await empresa(m);
    const w = await conIntegracion(m, e, ['package.created']);
    respuesta = () => new Response('', { status: 500 });
    await envios(m, e, FALLOS_PARA_DESACTIVAR + 2);
    await despacharIntegraciones({ DB: m.DB, ...LLAVE } as never, m.DB, { limite: 50 });
    const f = await m.DB.prepare('SELECT estado, motivo FROM flex_webhooks WHERE id = ?')
      .bind(w.id)
      .first<{ estado: string; motivo: string }>();
    expect(f!.estado).toBe('desactivado');
    expect(f!.motivo).toMatch(/fallos seguidos/);
    const audit = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM empresa_auditoria WHERE objeto = ? AND accion = 'integracion.desactivada'",
    )
      .bind(w.id)
      .first<{ n: number }>();
    expect(audit!.n).toBe(1);
    // Desactivada: no se le manda nada más.
    const n = recibidas.length;
    await m.DB.prepare(
      "UPDATE flex_webhook_entregas SET proximo_en = datetime('now', '-1 seconds')",
    ).run();
    await despacharIntegraciones({ DB: m.DB, ...LLAVE } as never, m.DB, { limite: 50 });
    expect(recibidas.length).toBe(n);
    respuesta = () => new Response('ok', { status: 200 });
    const re = await llamar(
      m,
      'PATCH',
      `${B}/empresas/${e.id}/integraciones/${w.id}`,
      { estado: 'activo' },
      e.dueno.token,
    );
    expect(re.datos.integracion).toMatchObject({ estado: 'activo', fallosSeguidos: 0 });
  });

  it('dos vueltas de despacho a la vez no mandan el mismo evento dos veces', async () => {
    const m = mundoF();
    const e = await empresa(m);
    await conIntegracion(m, e, ['package.created']);
    // Se crean sin despacho inmediato (directo en la base) para que la cola quede llena.
    await envios(m, e, 6);
    await m.DB.prepare('DELETE FROM flex_webhook_intentos').run();
    await m.DB.prepare(
      "UPDATE flex_webhook_entregas SET estado = 'pendiente', intentos = 0, entregado_en = NULL",
    ).run();
    recibidas = [];
    const env = { DB: m.DB, ...LLAVE } as never;
    await Promise.all([despacharIntegraciones(env, m.DB), despacharIntegraciones(env, m.DB)]);
    expect(recibidas).toHaveLength(6);
  });

  it('rotar el secreto: durante la gracia firman los dos; la prueba manda un «ping»', async () => {
    const m = mundoF();
    const e = await empresa(m);
    const w = await conIntegracion(m, e);
    const rot = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/integraciones/${w.id}/rotar`,
      { graciaHoras: 24 },
      e.dueno.token,
    );
    expect(rot.estado).toBe(200);
    const nuevo = rot.datos.secreto as string;
    expect(nuevo).not.toBe(w.secreto);
    const p = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/integraciones/${w.id}/probar`,
      {},
      e.dueno.token,
    );
    expect(p.datos).toMatchObject({ ok: true, http: 200 });
    const l = recibidas.at(-1)!;
    expect(JSON.parse(l.body).type).toBe('ping');
    expect(l.headers[CABECERA_FIRMA]!.match(/v1=/g)).toHaveLength(2);
    expect(await verificarFirma(l.body, l.headers[CABECERA_FIRMA]!, nuevo)).toBe(true);
    expect(await verificarFirma(l.body, l.headers[CABECERA_FIRMA]!, w.secreto)).toBe(true);
    // Sin gracia: solo el nuevo.
    const rot2 = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/integraciones/${w.id}/rotar`,
      { graciaHoras: 0 },
      e.dueno.token,
    );
    await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/integraciones/${w.id}/probar`,
      {},
      e.dueno.token,
    );
    const l2 = recibidas.at(-1)!;
    expect(l2.headers[CABECERA_FIRMA]!.match(/v1=/g)).toHaveLength(1);
    expect(await verificarFirma(l2.body, l2.headers[CABECERA_FIRMA]!, rot2.datos.secreto)).toBe(
      true,
    );
    expect(await verificarFirma(l2.body, l2.headers[CABECERA_FIRMA]!, nuevo)).toBe(false);
  });

  it('aislamiento: una empresa no ve, no toca ni recibe lo de otra; las claves de API no gestionan integraciones', async () => {
    const m = mundoF();
    const a = await empresa(m, 'A');
    const b = await empresa(m, 'B');
    const wa = await conIntegracion(m, a, ['package.created']);
    for (const [metodo, ruta2] of [
      ['PATCH', `/integraciones/${wa.id}`],
      ['POST', `/integraciones/${wa.id}/rotar`],
      ['POST', `/integraciones/${wa.id}/probar`],
      ['GET', `/integraciones/${wa.id}/intentos`],
    ] as const)
      expect(
        (
          await llamar(
            m,
            metodo,
            `${B}/empresas/${b.id}${ruta2}`,
            metodo === 'GET' ? undefined : {},
            b.dueno.token,
          )
        ).estado,
      ).toBe(404);
    // La empresa B tampoco puede usar la ruta de A con su sesión.
    expect(
      (await llamar(m, 'GET', `${B}/empresas/${a.id}/integraciones`, undefined, b.dueno.token))
        .estado,
    ).toBe(404);
    await envios(m, b, 2, 1, 'B');
    await despacharIntegraciones({ DB: m.DB, ...LLAVE } as never, m.DB);
    expect(recibidas.filter((x) => JSON.parse(x.body).company_id === b.id)).toHaveLength(0);
    const clave = await llamar(
      m,
      'POST',
      `${B}/empresas/${a.id}/claves`,
      { nombre: 'ERP', permisos: ['envios.ver'] },
      a.dueno.token,
    );
    expect(
      (
        await llamar(m, 'GET', `${B}/empresas/${a.id}/integraciones`, undefined, undefined, {
          'x-api-key': clave.datos.clave.secreto,
        })
      ).estado,
    ).toBe(403);
  });
});

describe('Flex · optimización y capacidad (C-FLEX-OPTIMIZAR, C-FLEX-CAPACIDAD)', () => {
  it('sugiere un orden más corto, no escribe nada y solo se aplica antes de salir', async () => {
    const m = mundoF();
    const e = await empresa(m);
    // Paradas al norte del centro, puestas en desorden.
    const lote = [3, 1, 4, 2].map((x) => ({
      centroId: e.centroId,
      referenciaExterna: `OPT-${x}`,
      destinatarioNombre: `Cliente ${x}`,
      direccion: `${x} Calle`,
      lat: 25.77 + x * 0.01,
      lng: -80.19,
      paquetes: [{ descripcion: 'Caja' }],
    }));
    const env = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/envios/lote`,
      { envios: lote },
      e.dueno.token,
    );
    const rutaId = await ruta(
      m,
      e,
      env.datos.envios.map((x: any) => x.id),
    );
    const orden = async () =>
      (
        await m.DB.prepare('SELECT id FROM ruta_paradas WHERE ruta_id = ? ORDER BY orden')
          .bind(rutaId)
          .all<{ id: string }>()
      ).results.map((x) => x.id);
    const antes = await orden();
    const s = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/optimizar`,
      {},
      e.dueno.token,
    );
    expect(s.estado).toBe(200);
    expect(s.datos.aplicable).toBe(true);
    expect(s.datos.sugerencia).toMatchObject({ cambia: true, distanciaEstimada: true });
    expect(s.datos.sugerencia.distanciaSugeridaM).toBeLessThan(s.datos.sugerencia.distanciaActualM);
    expect(await orden()).toEqual(antes); // sugerir no escribe
    expect(
      (
        await llamar(
          m,
          'PUT',
          `${B}/empresas/${e.id}/rutas/${rutaId}/orden`,
          { paradaIds: s.datos.sugerencia.orden },
          e.dueno.token,
        )
      ).estado,
    ).toBe(200);
    expect(await orden()).toEqual(s.datos.sugerencia.orden);
  });

  it('en la calle la sugerencia no es aplicable y el reordenamiento se rechaza', async () => {
    const m = mundoF();
    const { e, rutaId, paradas } = await rutaEnCurso(m, 2, 1);
    const s = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/optimizar`,
      {},
      e.dueno.token,
    );
    expect(s.datos.aplicable).toBe(false);
    expect(
      (
        await llamar(
          m,
          'PUT',
          `${B}/empresas/${e.id}/rutas/${rutaId}/orden`,
          { paradaIds: paradas.map((p: any) => p.id).reverse() },
          e.dueno.token,
        )
      ).estado,
    ).toBe(409);
  });

  it('avisa antes de asignar si no cabe, deja confirmar, y lo desconocido no se inventa', async () => {
    const m = mundoF();
    const e = await empresa(m);
    const cond = await m.cuenta('repartidor');
    await vincular(m, e, cond.id, 'propio');
    const vehiculoId = crypto.randomUUID();
    await m.DB.prepare(
      "INSERT INTO vehiculos (id, conductor_id, tipo, placa, placa_estado, estado) VALUES (?, ?, 'carro', 'FLX123', 'FL', 'aprobado')",
    )
      .bind(vehiculoId, cond.id)
      .run();
    const rutaId = await ruta(m, e, await envios(m, e, 3));
    // Sin capacidad declarada: «sin dato», no frena.
    let cap = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/rutas/${rutaId}/capacidad?vehiculoId=${vehiculoId}`,
      undefined,
      e.dueno.token,
    );
    expect(cap.datos.capacidad).toMatchObject({ estado: 'desconocida', paquetes: 3 });
    expect(cap.datos.capacidad.desconocidos).toContain('capacidad');
    expect(
      (
        await llamar(
          m,
          'PUT',
          `${B}/empresas/${e.id}/vehiculos/${vehiculoId}/capacidad`,
          { maxPaquetes: 2 },
          e.dueno.token,
        )
      ).estado,
    ).toBe(200);
    cap = await llamar(
      m,
      'GET',
      `${B}/empresas/${e.id}/rutas/${rutaId}/capacidad?vehiculoId=${vehiculoId}`,
      undefined,
      e.dueno.token,
    );
    expect(cap.datos.capacidad.excesos).toEqual([{ campo: 'paquetes', limite: 2, valor: 3 }]);
    const sinConfirmar = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
      { conductorId: cond.id, vehiculoId },
      e.dueno.token,
    );
    expect(sinConfirmar.estado).toBe(409);
    expect(sinConfirmar.datos.campo).toBe('capacidad');
    expect(await ocupaciones(m, cond.id)).toEqual([]);
    const confirmada = await llamar(
      m,
      'POST',
      `${B}/empresas/${e.id}/rutas/${rutaId}/asignar`,
      { conductorId: cond.id, vehiculoId, confirmarCapacidad: true },
      e.dueno.token,
    );
    expect(confirmada.estado).toBe(200);
    // Otra empresa no puede tocar la capacidad de ese vehículo. La tabla de vehículos de Comida no cambia.
    const otra = await empresa(m, 'Otra');
    expect(
      (
        await llamar(
          m,
          'PUT',
          `${B}/empresas/${otra.id}/vehiculos/${vehiculoId}/capacidad`,
          { maxPaquetes: 99 },
          otra.dueno.token,
        )
      ).estado,
    ).toBe(404);
    const cols = (
      await m.DB.prepare("SELECT name FROM pragma_table_info('vehiculos')").all<{ name: string }>()
    ).results.map((x) => x.name);
    expect(cols.join()).not.toMatch(/max_|capacidad/);
  });
});

describe('Flex · retención (C-FLEX-RETENCION)', () => {
  it('simular no borra; ejecutar borra lo técnico y NUNCA las pruebas sin política aprobada', async () => {
    const m = mundoF();
    const admin = await m.cuenta('admin');
    const { C, paradas, cond, rutaId } = await rutaEnCurso(m, 1, 1);
    const foto = (await subir(m, `${C}/paradas/${paradas[0].id}/prueba`, cond.token)).datos
      .pruebaId;
    await llamar(m, 'POST', `${C}/paradas/${paradas[0].id}/entregar`, { fotoId: foto }, cond.token);
    expect((await llamar(m, 'POST', `${C}/cerrar`, {}, cond.token)).estado).toBe(200);
    // Todo «viejo»: dos años atrás.
    await m.DB.prepare("UPDATE flex_pruebas SET creado_en = datetime('now', '-800 days')").run();
    await m.DB.prepare(
      "UPDATE idempotencia_flex SET creado_en = datetime('now', '-800 days')",
    ).run();
    await m.DB.prepare(
      "UPDATE rutas_flex SET cerrada_en = datetime('now', '-800 days') WHERE id = ?",
    )
      .bind(rutaId)
      .run();
    const claveFoto = (await m.DB.prepare('SELECT clave FROM flex_pruebas WHERE id = ?')
      .bind(foto)
      .first<{ clave: string }>())!.clave;
    const bucket = (m.extra as any).BUCKET as R2Bucket;
    expect(await bucket.get(claveFoto)).not.toBeNull();
    // Solo un administrador.
    expect((await llamar(m, 'POST', `${B}/admin/retencion/simular`, {}, cond.token)).estado).toBe(
      403,
    );
    // Ejecutar sin simular antes: no.
    expect((await llamar(m, 'POST', `${B}/admin/retencion/ejecutar`, {}, admin.token)).estado).toBe(
      409,
    );
    const sim = await llamar(m, 'POST', `${B}/admin/retencion/simular`, {}, admin.token);
    const de = (r: any, cat: string) => r.categorias.find((x: any) => x.categoria === cat);
    expect(de(sim.datos, 'pruebas')).toMatchObject({ candidatas: 1, aprobada: false, borradas: 0 });
    expect(de(sim.datos, 'idempotencia').candidatas).toBeGreaterThan(0);
    const idemAntes = (await m.DB.prepare('SELECT COUNT(*) AS n FROM idempotencia_flex').first<{
      n: number;
    }>())!.n;
    expect(idemAntes).toBeGreaterThan(0);
    const ej = await llamar(m, 'POST', `${B}/admin/retencion/ejecutar`, {}, admin.token);
    const borradasIdem = ej.datos.categorias
      .filter((x: any) => x.categoria === 'idempotencia')
      .reduce((t: number, x: any) => t + x.borradas, 0);
    expect(borradasIdem).toBe(idemAntes);
    expect(de(ej.datos, 'pruebas').borradas).toBe(0);
    expect(await bucket.get(claveFoto)).not.toBeNull();
    // Con la política aprobada por una persona para EE. UU.: se borra el archivo, la fila queda.
    expect(
      (
        await llamar(
          m,
          'PUT',
          `${B}/admin/retencion`,
          { pais: 'US', categoria: 'pruebas', dias: 365, aprobada: true },
          admin.token,
        )
      ).estado,
    ).toBe(200);
    const r = await limpiarFlex({ DB: m.DB, ...m.extra } as never, m.DB, 'ejecucion', 'prueba');
    expect(r.categorias.find((x) => x.categoria === 'pruebas' && x.pais === 'US')!.borradas).toBe(
      1,
    );
    expect(await bucket.get(claveFoto)).toBeNull();
    const fila = await m.DB.prepare('SELECT purgada_en FROM flex_pruebas WHERE id = ?')
      .bind(foto)
      .first<{ purgada_en: string | null }>();
    expect(fila!.purgada_en).not.toBeNull();
    // La custodia sigue completa (los eventos son inmutables).
    expect(
      (await m.DB.prepare(
        "SELECT COUNT(*) AS n FROM paquete_eventos WHERE tipo = 'entregado'",
      ).first<{ n: number }>())!.n,
    ).toBe(1);
  });

  it('una prueba ligada a una incidencia abierta no se borra aunque la política lo permita', async () => {
    const m = mundoF();
    const { C, paradas, cond, rutaId } = await rutaEnCurso(m, 1, 1);
    const foto = (await subir(m, `${C}/paradas/${paradas[0].id}/prueba`, cond.token, 'incidencia'))
      .datos.pruebaId;
    await llamar(
      m,
      'POST',
      `${C}/paradas/${paradas[0].id}/incidencia`,
      { motivo: 'danado', proximaAccion: 'devolver', pruebaId: foto },
      cond.token,
    );
    await m.DB.prepare(
      "UPDATE rutas_flex SET estado = 'con_incidencias', cerrada_en = datetime('now', '-800 days') WHERE id = ?",
    )
      .bind(rutaId)
      .run()
      .catch(() => undefined);
    await m.DB.prepare("UPDATE flex_pruebas SET creado_en = datetime('now', '-800 days')").run();
    await m.DB.prepare(
      "INSERT INTO flex_retencion (pais, servicio, categoria, dias, aprobada) VALUES ('*', '*', 'pruebas', 30, 1)",
    ).run();
    const r = await limpiarFlex({ DB: m.DB, ...m.extra } as never, m.DB, 'ejecucion', 'prueba');
    expect(
      r.categorias.filter((x) => x.categoria === 'pruebas').reduce((s, x) => s + x.borradas, 0),
    ).toBe(0);
  });
});

describe('Flex · indicadores de operación (C-FLEX-KPI)', () => {
  it('cuenta lo real del periodo, sin un solo dato de dinero; sin ventanas, «a tiempo» no tiene dato', async () => {
    const m = mundoF();
    const { e, C, paradas, cond } = await rutaEnCurso(m, 2, 1);
    const foto = (await subir(m, `${C}/paradas/${paradas[0].id}/prueba`, cond.token)).datos
      .pruebaId;
    await llamar(m, 'POST', `${C}/paradas/${paradas[0].id}/entregar`, { fotoId: foto }, cond.token);
    await llamar(
      m,
      'POST',
      `${C}/paradas/${paradas[1].id}/incidencia`,
      { motivo: 'ausente', proximaAccion: 'devolver' },
      cond.token,
    );
    const r = await llamar(m, 'GET', `${B}/empresas/${e.id}/operaciones`, undefined, e.dueno.token);
    expect(r.estado).toBe(200);
    expect(r.datos.paquetes).toMatchObject({ total: 2, entregados: 1, fallidos: 1 });
    expect(r.datos.tasas).toMatchObject({
      entregaPct: 50,
      primerIntentoPct: 100,
      aTiempoPct: null,
    });
    expect(r.datos.incidenciasPorMotivo).toEqual([{ motivo: 'ausente', cantidad: 1 }]);
    expect(r.datos.ahora.enCurso).toBe(1);
    expect(JSON.stringify(r.datos)).not.toMatch(/monto|precio|centavos|usd|tarifa|comision|pago/i);
    // Un operador también lo ve; otra empresa no.
    const otra = await empresa(m, 'Otra');
    expect(
      (await llamar(m, 'GET', `${B}/empresas/${e.id}/operaciones`, undefined, otra.dueno.token))
        .estado,
    ).toBe(404);
  });
});
