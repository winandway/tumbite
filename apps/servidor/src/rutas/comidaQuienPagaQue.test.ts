import { describe, expect, it } from 'vitest';
import {
  COMISION_ENVIO_COMIDA_VE_PB,
  COMISION_RESTAURANTE_VE_ARRANQUE_PB,
  COMISION_RESTAURANTE_VE_PREPARADA_PB,
  TARIFAS_COMIDA_VENEZUELA,
  porcentajeDe,
} from '@tumbite/compartido';
import { saldoLibro } from '../internacional/libro';
import { reciboDePedido } from '../avisos';
import { usarTransporteCorreo } from '../correo';
import { abrirComida, escenarioVe } from '../pruebas/comidaVe';
import { mundoPago } from '../pruebas/pagoComidaVe';

/**
 * C-COMIDA-VE-QUIEN-PAGA (23 nov 2026, aprobado por Richard) — Venezuela (países con la bandera
 * `comidaPagoRestaurante`). Quién paga qué en la comida con pago directo:
 * - el CLIENTE paga la comida al precio de la carta (directo al restaurante) y el envío (directo al
 *   conductor). Sin tarifa de servicio ni cargo por pedido pequeño; la propina sigue voluntaria;
 * - el RESTAURANTE recibe el 100 % de la comida y paga la comisión de Divoox de su SALDO recargado,
 *   al confirmar «Me llegó». Arranca en 0 %; el valor preparado es 10 %;
 * - el CONDUCTOR cobra el envío entero: Divoox no le descuenta comisión (0, configurable);
 * - Divoox nunca custodia el dinero de la comida ni del envío.
 * Todo se cambia desde el panel sin publicar: GET/PUT /datos/admin/finanzas/comida-quien-paga.
 * Estados Unidos no cambia nada.
 */
type Mundo = Awaited<ReturnType<typeof mundoPago>>;

const RUTA = '/datos/admin/finanzas/comida-quien-paga';
const NOTA_LEGAL = 'Revisión legal de prueba del saldo prepago del restaurante';

const palanca = (w: Mundo, cuerpo: Record<string, unknown>, token = w.e.admin.token) =>
  w.e.m.llamar('PUT', RUTA, { pais: 'VE', motivo: 'Cambio de prueba', ...cuerpo }, token);
const leer = (w: Mundo, pais = 'VE', token = w.e.admin.token) =>
  w.e.m.llamar('GET', `${RUTA}?pais=${pais}`, undefined, token);
const saldoRest = (w: Mundo) =>
  saldoLibro(w.e.m.DB, `restaurante:${w.r.rid}`, 'prepago', 'VE', 'USD');
const cargarRest = (w: Mundo, monto: number) =>
  w.e.m.llamar(
    'POST',
    `/datos/admin/finanzas/restaurantes/${w.r.rid}/saldo`,
    { monto, motivo: 'Saldo de regalo de arranque', comprobante: '' },
    w.e.admin.token,
  );
const filaPedido = (w: Mundo, id: string) =>
  w.e.m.DB.prepare(
    'SELECT subtotal, envio, servicio, cargo_pequeno, propina, total, ganancia FROM pedidos WHERE id = ?',
  )
    .bind(id)
    .first<Record<string, number>>();
const libroDe = (w: Mundo, id: string, concepto: string) =>
  w.e.m.DB.prepare(
    "SELECT COUNT(*) AS n, COALESCE(SUM(monto), 0) AS s FROM libro WHERE pedido_id = ? AND concepto = ? AND bolsillo = 'comisiones'",
  )
    .bind(id, concepto)
    .first<{ n: number; s: number }>();

/** Pedido de punta a punta: ofrecido, tomado, pagado al restaurante, listo, recogido y entregado. */
async function deCabo(w: Mundo, rep: { id: string; token: string }, aceptado?: string) {
  let id = aceptado ?? '';
  if (!aceptado) {
    const p = await w.pedir();
    expect(p.estado).toBe(201);
    id = p.datos.pedidoId as string;
    expect((await w.aceptarRest(id)).estado).toBe(200);
  }
  expect((await w.ofertas(rep)).map((o) => o.id)).toContain(id);
  expect((await w.tomar(id, rep)).estado).toBe(200);
  const ref = `${Math.floor(100000 + Math.random() * 899999)}`;
  expect((await w.reportar(id, ref)).estado).toBe(200);
  expect((await w.responder(id, true)).estado).toBe(200);
  expect((await w.listo(id)).estado).toBe(200);
  expect((await w.e.m.recoger(id, rep.token, w.r.dueno.token)).estado).toBe(200);
  expect((await w.e.m.entregar(id, rep.token)).estado).toBe(200);
  const f = await filaPedido(w, id);
  const cobre = await w.e.m.llamar(
    'POST',
    `/datos/repartidor/pedidos/${id}/cobre`,
    { montoRecibido: Number(f?.envio) },
    rep.token,
  );
  expect(cobre.estado).toBe(200);
  expect(cobre.datos.cobroEstado).toBe('confirmado');
  return { id, envio: Number(f?.envio) };
}

describe('C-COMIDA-VE-QUIEN-PAGA: el cliente paga la comida y el envío, nada más', () => {
  it('con las tarifas de fábrica el total es comida + envío + propina; servicio y cargo pequeño en 0 también en un pedido chico', async () => {
    expect(TARIFAS_COMIDA_VENEZUELA).toMatchObject({
      comisionPb: { inicial: 1000, crece: 1000, elite: 1000 },
      servicioPb: 0,
      servicioMinimo: 0,
      servicioMaximo: 0,
      pedidoMinimo: 0,
      cargoPedidoPequeno: 0,
    });
    expect(COMISION_RESTAURANTE_VE_PREPARADA_PB).toBe(1000);
    expect(COMISION_RESTAURANTE_VE_ARRANQUE_PB).toBe(0);
    expect(COMISION_ENVIO_COMIDA_VE_PB).toBe(0);
    const w = await mundoPago();
    const cfg = await w.e.m.llamar('GET', '/datos/admin/paises/VE', undefined, w.e.admin.token);
    expect(cfg.datos.config.tarifas).toEqual(TARIFAS_COMIDA_VENEZUELA);
    expect(cfg.datos.config.comidaComisionEnvioPb ?? 0).toBe(0);
    for (const cantidad of [2, 1]) {
      const p = await w.pedir('efectivo', cantidad);
      expect(p.estado).toBe(201);
      const f = await filaPedido(w, p.datos.pedidoId as string);
      expect(f).toMatchObject({ subtotal: 450 * cantidad, servicio: 0, cargo_pequeno: 0 });
      expect(Number(f?.envio)).toBeGreaterThan(0);
      expect(f?.total).toBe(450 * cantidad + Number(f?.envio) + 50);
    }
  });
});

describe('C-COMIDA-VE-QUIEN-PAGA: el conductor cobra el envío entero', () => {
  it('conductor SIN saldo recibe y toma la oferta, no se le aparta nada, cobra el envío entero; sin comisión del conductor en el libro; restaurante al 0 % sin tocar su saldo', async () => {
    const w = await mundoPago();
    expect((await cargarRest(w, 500)).estado).toBe(200);
    // Aunque el país tenga una política de comisión de comida para conductores (la del cobro en mano
    // de siempre), en el pago directo no rige: al conductor solo se le aparta lo del envío (0).
    const pol = await w.e.m.llamar(
      'POST',
      '/datos/admin/finanzas/politicas',
      {
        nombre: 'Comida · conductores · VE',
        servicio: 'food',
        tipoCuenta: 'conductor',
        pais: 'VE',
        modalidad: 'prepago',
        moneda: 'USD',
        regla: { tipo: 'porcentaje', pb: 1000 },
        motivo: 'Comisión de conductores del cobro en mano de prueba',
        revisionLegalAprobada: true,
        revisionLegalNota: 'Revisión legal de prueba aprobada',
      },
      w.e.admin.token,
    );
    expect(pol.estado).toBe(201);
    const rep = await w.conductor('Conductor sin saldo', 0);
    expect(await saldoLibro(w.e.m.DB, rep.id, 'prepago', 'VE', 'USD')).toBe(0);
    const saldo = await w.e.m.llamar(
      'GET',
      '/datos/repartidor/saldo-prepago',
      undefined,
      rep.token,
    );
    expect(saldo.datos).toMatchObject({ comisionTipicaComida: 0, sinSaldoComida: false });
    const { id } = await deCabo(w, rep);
    const fin = await w.e.m.DB.prepare(
      'SELECT estado, cobro_estado, conciliacion_estado FROM pedidos WHERE id = ?',
    )
      .bind(id)
      .first();
    expect(fin).toMatchObject({
      estado: 'entregado',
      cobro_estado: 'confirmado',
      conciliacion_estado: 'conciliado',
    });
    expect(await libroDe(w, id, 'comision_cobrada')).toEqual({ n: 0, s: 0 });
    expect(await w.comisionesDe(id)).toEqual({ n: 0, s: 0 });
    const reservas = await w.e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM libro WHERE pedido_id = ? AND cuenta_id = ? AND bolsillo IN ('reservado','prepago')",
    )
      .bind(id, rep.id)
      .first<{ n: number }>();
    expect(reservas?.n).toBe(0);
    expect(await saldoLibro(w.e.m.DB, rep.id, 'prepago', 'VE', 'USD')).toBe(0);
    expect(await saldoRest(w)).toBe(500);
  });

  it('con comidaComisionEnvioPb en 10 % se aparta el 10 % del ENVÍO, y un conductor sin saldo no recibe la oferta', async () => {
    const w = await mundoPago();
    expect((await palanca(w, { conductor: { comisionEnvioPb: 1000 } })).estado).toBe(200);
    const pobre = await w.conductor('Conductor sin saldo', 0);
    const p = await w.pedir();
    const id0 = p.datos.pedidoId as string;
    expect((await w.aceptarRest(id0)).estado).toBe(200);
    expect((await w.ofertas(pobre)).map((o) => o.id)).not.toContain(id0);
    expect((await w.tomar(id0, pobre)).estado).toBe(409);
    // Con saldo: la típica dice lo mismo y la comisión sale una vez, sobre el envío.
    const rep = await w.conductor('Conductor con saldo', 1000);
    const saldo = await w.e.m.llamar(
      'GET',
      '/datos/repartidor/saldo-prepago',
      undefined,
      rep.token,
    );
    expect(saldo.datos.comisionTipicaComida).toBe(
      porcentajeDe(TARIFAS_COMIDA_VENEZUELA.envioBase, 1000),
    );
    // El mismo pedido que el conductor sin saldo no pudo tomar le llega a quien sí tiene.
    const { id, envio } = await deCabo(w, rep, id0);
    const esperado = porcentajeDe(envio, 1000);
    expect(esperado).toBeGreaterThan(0);
    expect(await libroDe(w, id, 'comision_cobrada')).toEqual({ n: 1, s: esperado });
    expect(await saldoLibro(w.e.m.DB, rep.id, 'prepago', 'VE', 'USD')).toBe(1000 - esperado);
  });
});

describe('C-COMIDA-VE-QUIEN-PAGA: la comisión del restaurante sale de su saldo', () => {
  it('por la palanca, 10 % con nota legal: sale UNA vez al «Me llegó»; sin saldo no recibe pedidos y se avisa; de vuelta a 0 deja de cobrar; sin nota legal 422 y nada cambia', async () => {
    const w = await mundoPago();
    const rep = await w.conductor('Conductor de ejemplo', 0);
    // Sin la nota legal: 422 y nada cambia.
    const sinNota = await palanca(w, { restaurante: { comisionPb: 1000 } });
    expect(sinNota.estado).toBe(422);
    expect(JSON.stringify(sinNota.datos)).toMatch(/revisión legal|legal review/i);
    const corta = await palanca(w, {
      restaurante: { comisionPb: 1000, revisionLegalNota: 'corta' },
    });
    expect(corta.estado).toBe(422);
    const pols = await w.e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM politicas_financieras WHERE tipo_cuenta = 'restaurante'",
    ).first<{ n: number }>();
    expect(pols?.n).toBe(0);
    expect((await leer(w)).datos.restaurante.comisionPb).toBe(0);

    const ok = await palanca(w, {
      restaurante: { comisionPb: 1000, revisionLegalNota: NOTA_LEGAL },
    });
    expect(ok.estado).toBe(200);
    const g = await leer(w);
    expect(g.datos.restaurante).toMatchObject({
      comisionPb: 1000,
      preparadaPb: 1000,
      revisionLegalAprobada: true,
    });
    expect(g.datos.restaurante.politicaId).toBeTruthy();

    // Sin saldo: el restaurante no recibe pedidos y se le avisa (una vez por hora).
    expect((await w.pedir()).estado).toBe(409);
    const aviso = await w.e.m.DB.prepare(
      "SELECT n FROM contadores WHERE clave LIKE 'sin-saldo-restaurante:%'",
    ).first<{ n: number }>();
    expect(aviso?.n).toBe(1);

    expect((await cargarRest(w, 500)).estado).toBe(200);
    const { id } = await deCabo(w, rep);
    // 10 % de 9,00 = 0,90 una sola vez; nada al conductor.
    expect(await libroDe(w, id, 'comision_restaurante')).toEqual({ n: 1, s: 90 });
    expect(await libroDe(w, id, 'comision_cobrada')).toEqual({ n: 0, s: 0 });
    expect(await saldoRest(w)).toBe(410);
    expect((await w.responder(id, true)).estado).toBe(200);
    expect(await saldoRest(w)).toBe(410);

    // De vuelta a 0: se cierra la política y no se cobra más (sin pedir nota).
    expect((await palanca(w, { restaurante: { comisionPb: 0 } })).estado).toBe(200);
    expect((await leer(w)).datos.restaurante).toMatchObject({ comisionPb: 0, politicaId: null });
    const { id: id2 } = await deCabo(w, rep);
    expect(await libroDe(w, id2, 'comision_restaurante')).toEqual({ n: 0, s: 0 });
    expect(await saldoRest(w)).toBe(410);
    // La política vieja no se borra: queda cerrada, con su historia.
    const cerradas = await w.e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM politicas_financieras WHERE tipo_cuenta = 'restaurante' AND (vigente_hasta IS NOT NULL OR activa = 0)",
    ).first<{ n: number }>();
    expect(cerradas?.n).toBe(1);
  });
});

describe('C-COMIDA-VE-QUIEN-PAGA: la palanca del panel', () => {
  it('GET dice quién paga qué, los valores de fábrica y los países con pago directo; no escribe nada', async () => {
    const w = await mundoPago();
    await w.e.m.sesionLista(w.e.admin.token);
    const antes = await w.e.m.DB.prepare('SELECT total_changes() AS n').first<{ n: number }>();
    const g = await leer(w);
    const despues = await w.e.m.DB.prepare('SELECT total_changes() AS n').first<{ n: number }>();
    expect(g.estado).toBe(200);
    expect(despues?.n).toBe(antes?.n);
    expect(g.datos).toMatchObject({
      pais: 'VE',
      moneda: 'USD',
      pagoDirecto: true,
      tarifasEscritas: true,
      cliente: {
        servicioPb: 0,
        servicioMinimo: 0,
        servicioMaximo: 0,
        pedidoMinimo: 0,
        cargoPedidoPequeno: 0,
      },
      restaurante: {
        comisionPb: 0,
        preparadaPb: 1000,
        revisionLegalAprobada: false,
        politicaId: null,
      },
      conductor: { comisionEnvioPb: 0 },
      deFabrica: {
        cliente: { servicioPb: 0, cargoPedidoPequeno: 0 },
        restaurante: { comisionPb: 0, preparadaPb: 1000 },
        conductor: { comisionEnvioPb: 0 },
      },
    });
    expect((g.datos.paises as { pais: string }[]).map((p) => p.pais)).toContain('VE');
    expect((g.datos.paises as { pais: string }[]).map((p) => p.pais)).not.toContain('US');
  });

  it('el PUT cambia lo del cliente y lo del conductor en la configuración del país, con su auditoría', async () => {
    const w = await mundoPago();
    const r = await palanca(w, {
      cliente: { servicioPb: 300, servicioMinimo: 10, servicioMaximo: 100 },
      conductor: { comisionEnvioPb: 500 },
    });
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({
      cliente: { servicioPb: 300, servicioMinimo: 10, servicioMaximo: 100, pedidoMinimo: 0 },
      conductor: { comisionEnvioPb: 500 },
    });
    const cfg = await w.e.m.llamar('GET', '/datos/admin/paises/VE', undefined, w.e.admin.token);
    expect(cfg.datos.config.tarifas).toMatchObject({ servicioPb: 300, servicioMinimo: 10 });
    expect(cfg.datos.config.comidaComisionEnvioPb).toBe(500);
    // El resto de las tarifas no se toca.
    expect(cfg.datos.config.tarifas.envioBase).toBe(TARIFAS_COMIDA_VENEZUELA.envioBase);
    const fin = await w.e.m.DB.prepare(
      "SELECT actor_id, objeto, detalle_json FROM finanzas_auditoria WHERE accion = 'comida_quien_paga.cambiar'",
    ).all<{ actor_id: string; objeto: string; detalle_json: string }>();
    expect(fin.results).toHaveLength(1);
    expect(fin.results[0]).toMatchObject({ actor_id: w.e.admin.id, objeto: 'VE' });
    expect(JSON.parse(fin.results[0]!.detalle_json)).toMatchObject({
      motivo: 'Cambio de prueba',
      antes: { conductor: { comisionEnvioPb: 0 } },
      despues: { conductor: { comisionEnvioPb: 500 } },
    });
    const adm = await w.e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM auditoria_admin WHERE objeto = 'config-pais:VE'",
    ).first<{ n: number }>();
    expect(Number(adm?.n)).toBeGreaterThanOrEqual(2);
    // Mínimo mayor que máximo: no se guarda nada.
    const mal = await palanca(w, { cliente: { servicioMinimo: 500 } });
    expect(mal.estado).toBe(422);
    const sigue = await leer(w);
    expect(sigue.datos.cliente.servicioMinimo).toBe(10);
    // Sin nada que cambiar: 422; sin motivo: 400 (los datos no cuadran).
    expect((await palanca(w, {})).estado).toBe(422);
    expect(
      (
        await w.e.m.llamar(
          'PUT',
          RUTA,
          { pais: 'VE', conductor: { comisionEnvioPb: 0 } },
          w.e.admin.token,
        )
      ).estado,
    ).toBe(400);
  });

  it('Estados Unidos y los países sin la bandera: 422; sin tarifas escritas: 409; solo el equipo', async () => {
    const e = await escenarioVe();
    // Venezuela sin Comida abierta: no tiene tarifas todavía.
    const sinTarifas = await e.m.llamar(
      'PUT',
      RUTA,
      { pais: 'VE', motivo: 'Cambio de prueba', conductor: { comisionEnvioPb: 0 } },
      e.admin.token,
    );
    expect(sinTarifas.estado).toBe(409);
    const g0 = await e.m.llamar('GET', `${RUTA}?pais=VE`, undefined, e.admin.token);
    expect(g0.estado).toBe(200);
    expect(g0.datos).toMatchObject({ tarifasEscritas: false, cliente: null });
    for (const pais of ['US', 'CO']) {
      expect(
        (await e.m.llamar('GET', `${RUTA}?pais=${pais}`, undefined, e.admin.token)).estado,
      ).toBe(422);
      expect(
        (
          await e.m.llamar(
            'PUT',
            RUTA,
            { pais, motivo: 'Cambio de prueba', conductor: { comisionEnvioPb: 0 } },
            e.admin.token,
          )
        ).estado,
      ).toBe(422);
    }
    expect((await abrirComida(e, {}, { pagoRestaurante: true })).estado).toBe(201);
    // Ni el cliente ni el restaurante: solo el equipo.
    const dueno = await e.m.cuenta('restaurante', 'Dueño de ejemplo');
    for (const token of [e.cliente.token, dueno.token]) {
      expect((await e.m.llamar('GET', `${RUTA}?pais=VE`, undefined, token)).estado).toBe(403);
      expect(
        (
          await e.m.llamar(
            'PUT',
            RUTA,
            { pais: 'VE', motivo: 'Cambio de prueba', restaurante: { comisionPb: 0 } },
            token,
          )
        ).estado,
      ).toBe(403);
    }
  });
});

describe('C-COMIDA-VE-QUIEN-PAGA: la comisión del restaurante se congela al pedir', () => {
  /** Pedido creado, aceptado, tomado y pagado por el cliente: falta solo el «Me llegó». */
  async function hastaReportado(w: Mundo, rep: { id: string; token: string }) {
    const p = await w.pedir();
    expect(p.estado).toBe(201);
    const id = p.datos.pedidoId as string;
    expect((await w.aceptarRest(id)).estado).toBe(200);
    expect((await w.ofertas(rep)).map((o) => o.id)).toContain(id);
    expect((await w.tomar(id, rep)).estado).toBe(200);
    const ref = `${Math.floor(100000 + Math.random() * 899999)}`;
    expect((await w.reportar(id, ref)).estado).toBe(200);
    return id;
  }

  it('pedido creado al 0 %, la palanca sube al 10 % antes del «Me llegó»: no cobra nada', async () => {
    const w = await mundoPago();
    expect((await cargarRest(w, 500)).estado).toBe(200);
    const rep = await w.conductor('Conductor de ejemplo', 0);
    const id = await hastaReportado(w, rep);
    expect(
      (await palanca(w, { restaurante: { comisionPb: 1000, revisionLegalNota: NOTA_LEGAL } }))
        .estado,
    ).toBe(200);
    expect((await w.responder(id, true)).estado).toBe(200);
    expect(await libroDe(w, id, 'comision_restaurante')).toEqual({ n: 0, s: 0 });
    expect(await saldoRest(w)).toBe(500);
  });

  it('pedido creado al 10 %, la palanca baja a 0 antes del «Me llegó»: cobra el 10 % con que nació', async () => {
    const w = await mundoPago();
    expect((await cargarRest(w, 500)).estado).toBe(200);
    expect(
      (await palanca(w, { restaurante: { comisionPb: 1000, revisionLegalNota: NOTA_LEGAL } }))
        .estado,
    ).toBe(200);
    const rep = await w.conductor('Conductor de ejemplo', 0);
    const id = await hastaReportado(w, rep);
    expect((await palanca(w, { restaurante: { comisionPb: 0 } })).estado).toBe(200);
    expect((await w.responder(id, true)).estado).toBe(200);
    expect(await libroDe(w, id, 'comision_restaurante')).toEqual({ n: 1, s: 90 });
    expect(await saldoRest(w)).toBe(410);
  });

  it('si la comida cambia antes de pagar, la comisión sigue el porcentaje con que nació, no el vigente', async () => {
    const w = await mundoPago();
    expect((await cargarRest(w, 500)).estado).toBe(200);
    expect(
      (await palanca(w, { restaurante: { comisionPb: 1000, revisionLegalNota: NOTA_LEGAL } }))
        .estado,
    ).toBe(200);
    const rep = await w.conductor('Conductor de ejemplo', 0);
    const p = await w.pedir();
    const id = p.datos.pedidoId as string;
    // La comida baja a 4,50 antes de que el cliente pague (como al quitar un plato agotado).
    await w.e.m.DB.prepare('UPDATE pagos_comida SET monto = 450 WHERE pedido_id = ?')
      .bind(id)
      .run();
    expect(
      (await palanca(w, { restaurante: { comisionPb: 2000, revisionLegalNota: NOTA_LEGAL } }))
        .estado,
    ).toBe(200);
    expect((await w.aceptarRest(id)).estado).toBe(200);
    expect((await w.ofertas(rep)).map((o) => o.id)).toContain(id);
    expect((await w.tomar(id, rep)).estado).toBe(200);
    expect((await w.reportar(id, '445566')).estado).toBe(200);
    expect((await w.responder(id, true)).estado).toBe(200);
    // 10 % de 4,50 (el porcentaje con que nació), no 20 %.
    expect(await libroDe(w, id, 'comision_restaurante')).toEqual({ n: 1, s: 45 });
  });

  it('una fila vieja sin la comisión congelada se cobra como antes (la vigente al «Me llegó»)', async () => {
    const w = await mundoPago();
    expect((await cargarRest(w, 500)).estado).toBe(200);
    const rep = await w.conductor('Conductor de ejemplo', 0);
    const id = await hastaReportado(w, rep);
    await w.e.m.DB.prepare('UPDATE pagos_comida SET comision_regla_json = NULL WHERE pedido_id = ?')
      .bind(id)
      .run();
    expect(
      (await palanca(w, { restaurante: { comisionPb: 1000, revisionLegalNota: NOTA_LEGAL } }))
        .estado,
    ).toBe(200);
    expect((await w.responder(id, true)).estado).toBe(200);
    expect(await libroDe(w, id, 'comision_restaurante')).toEqual({ n: 1, s: 90 });
  });
});

describe('C-COMIDA-VE-QUIEN-PAGA: una política de todos los países no se esconde', () => {
  it('con una política global food/restaurante, la palanca no dice 0 %: el GET la muestra y el PUT a 0 responde 409 sin tocar nada', async () => {
    const w = await mundoPago();
    const global = await w.e.m.llamar(
      'POST',
      '/datos/admin/finanzas/politicas',
      {
        nombre: 'Comida · restaurantes · todos los países',
        servicio: 'food',
        tipoCuenta: 'restaurante',
        pais: '*',
        modalidad: 'prepago',
        moneda: 'USD',
        regla: { tipo: 'porcentaje', pb: 500 },
        motivo: 'Política global de prueba',
        revisionLegalAprobada: true,
        revisionLegalNota: 'Revisión legal de prueba aprobada',
      },
      w.e.admin.token,
    );
    expect(global.estado).toBe(201);
    const g = await leer(w);
    expect(g.datos.restaurante).toMatchObject({ comisionPb: 500, global: true });
    const antes = await w.e.m.DB.prepare('SELECT COUNT(*) AS n FROM finanzas_auditoria').first<{
      n: number;
    }>();
    const r = await palanca(w, {
      restaurante: { comisionPb: 0 },
      conductor: { comisionEnvioPb: 700 },
    });
    expect(r.estado).toBe(409);
    expect(JSON.stringify(r.datos)).toMatch(/todos los países|all countries/i);
    // Nada a medias: ni el conductor ni la auditoría cambiaron.
    expect((await leer(w)).datos.conductor.comisionEnvioPb).toBe(0);
    const despues = await w.e.m.DB.prepare('SELECT COUNT(*) AS n FROM finanzas_auditoria').first<{
      n: number;
    }>();
    expect(despues?.n).toBe(antes?.n);
    // Un 10 % del país sí rige (el país manda sobre la global).
    expect(
      (await palanca(w, { restaurante: { comisionPb: 1000, revisionLegalNota: NOTA_LEGAL } }))
        .estado,
    ).toBe(200);
    expect((await leer(w)).datos.restaurante).toMatchObject({ comisionPb: 1000, global: false });
  });
});

describe('C-COMIDA-VE-QUIEN-PAGA: el correo de recibo no escribe cargos en cero', () => {
  it('sin servicio ni envío, esas líneas no salen; con montos, salen como siempre', async () => {
    const enviados: { text: string }[] = [];
    usarTransporteCorreo(async (_url, init) => {
      enviados.push(JSON.parse(String(init.body)) as { text: string });
      return new Response(JSON.stringify({ success: true, message_id: 'm', rebotados: [] }), {
        status: 200,
      });
    });
    const env = { YAD_TOKEN: 'token-de-prueba-'.padEnd(40, 'x') } as never;
    const base = {
      correo: 'cliente@ejemplo.com',
      nombre: 'Ana',
      pedidoId: 'abcdef123456',
      restaurante: 'Arepera',
      lineas: [{ nombreEs: 'Arepa', nombreEn: 'Arepa', precioCentavos: 450, cantidad: 2 }],
      subtotal: 900,
      propina: 50,
      regalo: 0,
      direccion: 'Calle 1',
    };
    for (const idioma of ['es', 'en'] as const) {
      await reciboDePedido(env, { ...base, idioma, envio: 150, servicio: 0, total: 1100 });
      const t1 = enviados.at(-1)?.text ?? '';
      expect(t1).not.toMatch(/Servicio|Service/);
      expect(t1).toMatch(/Envío|Delivery/);
      await reciboDePedido(env, { ...base, idioma, envio: 0, servicio: 0, total: 950 });
      expect(enviados.at(-1)?.text ?? '').not.toMatch(/Envío|Delivery|Servicio|Service/);
      await reciboDePedido(env, { ...base, idioma, envio: 150, servicio: 45, total: 1145 });
      const t3 = enviados.at(-1)?.text ?? '';
      expect(t3).toMatch(/Servicio: \$0[.,]45|Service: \$0\.45/);
    }
    usarTransporteCorreo(null);
  });
});
