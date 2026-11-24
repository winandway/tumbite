import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas, subirA } from './pruebas/motoVe';
import { mundo } from './pruebas/ayuda';
import { aptosDeVarios, avisarSiQuedoActivo, barraActivacion } from './activacion';
import type { Env } from './env';

/**
 * C-BARRA-ACTIVACION y C-VERIFICACION-UNICA (23 nov 2026, Richard: «al llegar al final, yo de mi lado
 * estaría seguro que su moto ya puede recibir carreras»). La barra dice lo MISMO que el reparto, en
 * los dos sentidos, y Verificaciones es un pendiente por conductor cuyo número baja al decidir.
 */
async function escenario({ conSaldo = true }: { conSaldo?: boolean } = {}) {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  const e = { m, admin, cliente };
  expect((await abrirCaracas(e)).estado).toBe(201);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  await yo('GET', '/datos/conductor/verificacion');
  // Su identidad ya aprobada: lo único por decidir es la moto (el caso real de Tucaní).
  await m.DB.prepare(
    "INSERT INTO kyc (usuario_id, estado, doc_frente, selfie, enviado_en, revisado_en) VALUES (?, 'aprobado', 'kyc/doc', 'kyc/cara', datetime('now', '-2 hours'), datetime('now'))",
  )
    .bind(rep.id)
    .run();
  const v = await yo('POST', '/datos/conductor/vehiculos', {
    tipo: 'moto',
    marca: 'Motos Divoox',
    modelo: 'M150',
    anio: 2023,
    color: 'Negro',
    placa: `AB${Math.floor(Math.random() * 1e6)}`,
    placaEstado: 'FL',
  });
  const id = v.datos.id as string;
  // Un conductor listo de verdad tiene saldo para la comisión (C-SALDO-OFERTAS, C-BARRA-SALDO).
  if (conSaldo)
    await m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES (?, ?, 'prepago', 'VE', 'USD', 10000, 'recarga', ?)",
    )
      .bind(`rec-${rep.id}`, rep.id, `rec-${rep.id}`)
      .run();
  await subirA(e, `/datos/conductor/vehiculos/${id}/documentos?tipo=registro`, rep.token);
  const aprobarMoto = async () => {
    const cola = await equipo('GET', '/datos/admin/vehiculos?estado=en_revision');
    const fila = cola.datos.vehiculos.find((x: { id: string }) => x.id === id);
    for (const d of fila.documentos)
      await equipo('PUT', `/datos/admin/vehiculos/${id}/documentos/${d.id}`, {
        estado: 'aprobado',
        venceEn: '2030-01-01',
      });
    expect(
      (await equipo('PUT', `/datos/admin/vehiculos/${id}`, { estado: 'aprobado' })).estado,
    ).toBe(200);
  };
  /** Lo que haría el reparto si se conectara ahora mismo (la vista real, conectado). */
  const elegibleConectado = async () => {
    await m.DB.prepare(
      "UPDATE repartidores SET conectado = 1, lat = 10.5, lng = -66.9, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
      .bind(rep.id)
      .run();
    const f = await m.DB.prepare('SELECT 1 AS si FROM conductores_elegibles WHERE conductor_id = ?')
      .bind(rep.id)
      .first<{ si: number }>();
    await m.DB.prepare('UPDATE repartidores SET conectado = 0 WHERE usuario_id = ?')
      .bind(rep.id)
      .run();
    return Boolean(f);
  };
  const menu = async () => {
    const r = await equipo('GET', '/datos/panel/avisos');
    return (
      (r.datos.menu as { clave: string; cantidad: number }[]).find(
        (x) => x.clave === 'verifications',
      )?.cantidad ?? 0
    );
  };
  return { m, rep, id, equipo, aprobarMoto, elegibleConectado, menu };
}

describe('C-BARRA-ACTIVACION: la barra dice lo mismo que el reparto', () => {
  it('moto en revisión: «todavía no», falta que el equipo apruebe la moto, y el reparto no lo toma', async () => {
    const s = await escenario();
    const b = await barraActivacion(s.m.DB, s.rep.id);
    expect(b.listo).toBe(false);
    expect(b.recibiendo).toBe(false);
    expect(b.siguiente?.clave).toBe('vehiculo_aprobado');
    expect(b.siguiente?.quien).toBe('equipo');
    expect(b.pasos.find((p) => p.clave === 'identidad')?.estado).toBe('hecho');
    expect(await s.elegibleConectado()).toBe(false);
  });

  it('al aprobar la moto: «ya puede», el reparto lo toma al conectarse, y la lista lo marca listo', async () => {
    const s = await escenario();
    await s.aprobarMoto();
    const b = await barraActivacion(s.m.DB, s.rep.id);
    expect(b.listo).toBe(true);
    expect(b.servicios).toContain('moto');
    expect(b.siguiente?.clave).toBe('conectado');
    expect(b.pasos.filter((p) => p.estado !== 'hecho' && !p.opcional).map((p) => p.clave)).toEqual([
      'conectado',
    ]);
    expect(await s.elegibleConectado()).toBe(true);
    expect((await aptosDeVarios(s.m.DB, [s.rep.id])).has(s.rep.id)).toBe(true);
    const lista = await s.equipo('GET', '/datos/admin/repartidores?cuentas=todas');
    expect(lista.datos.repartidores.find((x: { id: string }) => x.id === s.rep.id)?.listo).toBe(
      true,
    );
    // Conectado de verdad: «recibiendo», nada pendiente.
    await s.m.DB.prepare(
      "UPDATE repartidores SET conectado = 1, lat = 10.5, lng = -66.9, ubicacion_en = datetime('now') WHERE usuario_id = ?",
    )
      .bind(s.rep.id)
      .run();
    const ya = await barraActivacion(s.m.DB, s.rep.id);
    expect(ya.recibiendo).toBe(true);
    expect(ya.siguiente).toBeNull();
  });

  // C-BARRA-SALDO (ensayo general, 24 nov 2026): conductor nuevo de El Vigía con todo aprobado y saldo
  // cero. El panel decía «10 de 11 · Ya puede recibir carreras de Envíos, Moto» y «Saldo para la
  // comisión · No lo frena»; Driver decía «así no te llegan»; el pasajero pidió y nadie recibió la
  // oferta (C-SALDO-OFERTAS la salta). La barra dice lo mismo que el reparto: el saldo SÍ frena.
  it('donde rige el prepago y no le alcanza el saldo, no está listo y el saldo es lo que falta', async () => {
    const s = await escenario({ conSaldo: false });
    await s.m.DB.prepare(
      `INSERT OR IGNORE INTO politicas_financieras (id, servicio, tipo_cuenta, pais, modalidad, moneda, regla_json, vigente_desde, revision_legal_aprobada)
       VALUES ('pol-ride-ve', 'ride', 'conductor', 'VE', 'prepago', 'USD', '{"tipo":"porcentaje","pb":1000}', datetime('now', '-1 day'), 1)`,
    ).run();
    await s.aprobarMoto();
    const b = await barraActivacion(s.m.DB, s.rep.id);
    const saldo = b.pasos.find((p) => p.clave === 'saldo');
    expect(saldo?.estado).toBe('pendiente');
    expect(saldo?.opcional).toBe(false);
    expect(b.listo).toBe(false);
    expect(b.servicios).not.toContain('moto');
    expect(b.siguiente?.clave).toBe('saldo');
    // Con saldo para la comisión, vuelve a estar listo.
    await s.m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto, referencia) VALUES ('rec-ve', ?, 'prepago', 'VE', 'USD', 10000, 'recarga', 'rec-ve')",
    )
      .bind(s.rep.id)
      .run();
    const con = await barraActivacion(s.m.DB, s.rep.id);
    expect(con.listo).toBe(true);
    expect(con.pasos.find((p) => p.clave === 'saldo')?.estado).toBe('hecho');
  });

  it('en cada estado, «listo» es exactamente lo que el reparto haría (y al revés)', async () => {
    const s = await escenario();
    await s.aprobarMoto();
    const estados = [
      'UPDATE repartidores SET vehiculo_activo_id = NULL WHERE usuario_id = ?',
      'UPDATE preferencias_servicio SET activa = 0 WHERE conductor_id = ?',
      "UPDATE vehiculos SET estado = 'suspendido', motivo = 'Revisión' WHERE conductor_id = ?",
    ];
    for (const sql of estados) {
      const t = await escenario();
      await t.aprobarMoto();
      await t.m.DB.prepare(sql).bind(t.rep.id).run();
      const b = await barraActivacion(t.m.DB, t.rep.id);
      expect(b.listo, sql).toBe(await t.elegibleConectado());
      expect(b.listo, sql).toBe(false);
      // Nunca «todo en verde» y «todavía no»: algo que no es conectarse está pendiente.
      expect(
        b.pasos.some((p) => p.estado !== 'hecho' && !p.opcional && p.clave !== 'conectado'),
        sql,
      ).toBe(true);
    }
  });

  it('el aviso «Ya puedes recibir carreras» sale una sola vez, al quedar listo; mirar no escribe', async () => {
    const s = await escenario();
    const marca = () =>
      s.m.DB.prepare('SELECT activacion_avisada_en AS en FROM repartidores WHERE usuario_id = ?')
        .bind(s.rep.id)
        .first<{ en: string | null }>();
    await barraActivacion(s.m.DB, s.rep.id);
    expect((await marca())?.en).toBeNull();
    await s.aprobarMoto();
    expect((await marca())?.en).toBeTruthy();
    expect(await avisarSiQuedoActivo({} as Env, s.m.DB, s.rep.id)).toBe(false);
  });

  it('el panel lee la barra; un conductor no', async () => {
    const s = await escenario();
    const r = await s.equipo('GET', `/datos/admin/conductores/${s.rep.id}/activacion`);
    expect(r.estado).toBe(200);
    const moto = r.datos.pasos.find((p: { clave: string }) => p.clave === 'vehiculo_aprobado');
    expect(moto).toMatchObject({ estado: 'pendiente', quien: 'equipo' });
    expect(r.datos.listo).toBe(false);
    const ajeno = await s.m.llamar(
      'GET',
      `/datos/admin/conductores/${s.rep.id}/activacion`,
      undefined,
      s.rep.token,
    );
    expect(ajeno.estado).toBe(403);
  });
});

describe('C-VERIFICACION-UNICA: un pendiente por conductor en Verificaciones', () => {
  it('la moto por aprobar lo pone en Pendientes y en el número del menú; al aprobarla, baja', async () => {
    const s = await escenario();
    const pend = await s.equipo('GET', '/datos/admin/kyc?estado=pendiente&cuentas=todas');
    const fila = pend.datos.solicitudes.find((x: { id: string }) => x.id === s.rep.id);
    expect(fila?.porDecidir).toEqual(['vehiculo']);
    expect(fila?.enVerde).toBe(false);
    expect(pend.datos.totales.pendiente).toBe(1);
    // El número del menú cuenta solo cuentas reales: este conductor lo es.
    expect(await s.menu()).toBe(1);
    await s.aprobarMoto();
    const despues = await s.equipo('GET', '/datos/admin/kyc?estado=pendiente&cuentas=todas');
    expect(despues.datos.solicitudes.some((x: { id: string }) => x.id === s.rep.id)).toBe(false);
    expect(await s.menu()).toBe(0);
  });

  it('«más cerca de activarse» pone primero a quien le falta menos', async () => {
    const s = await escenario();
    const otro = await s.m.cuenta('repartidor', 'Conductor sin moto');
    await s.m.DB.prepare(
      "INSERT INTO kyc (usuario_id, estado, enviado_en) VALUES (?, 'pendiente', datetime('now', '-5 hours'))",
    )
      .bind(otro.id)
      .run();
    const r = await s.equipo('GET', '/datos/admin/kyc?estado=pendiente&cuentas=todas&orden=cerca');
    expect(r.datos.solicitudes.map((x: { id: string }) => x.id)).toEqual([s.rep.id, otro.id]);
    const llegada = await s.equipo('GET', '/datos/admin/kyc?estado=pendiente&cuentas=todas');
    expect(llegada.datos.solicitudes.map((x: { id: string }) => x.id)).toEqual([otro.id, s.rep.id]);
  });
});
