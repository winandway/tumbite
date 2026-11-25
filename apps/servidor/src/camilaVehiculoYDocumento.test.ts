import { afterEach, describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas } from './pruebas/motoVe';
import { mundo } from './pruebas/ayuda';
import { usarTransporteCorreo } from './correo';
import type { Env } from './env';
import {
  AJUSTES_REZAGADOS_DE_FABRICA,
  PLANTILLAS_DE_FABRICA,
  candidatos,
  correrRezagados,
  guardarAjustesRezagados,
  lecturaDeBarra,
  pasoPendiente,
  vencidoDeVerdad,
} from './rezagados';

/**
 * C-VEHICULO-SIN-ENVIAR y C-DOCUMENTO-VENCIDO-CLARO (25 nov 2026, Richard en Verificaciones) — todos
 * los países. Camila le recuerda enviar a revisión el vehículo que registró y dejó sin enviar, y le pide
 * el documento vigente cuando el equipo confirma que el suyo venció. Lo que parece vencido en un papel
 * aprobado va primero a la campana del equipo: una persona decide (la lectura puede fallar).
 */
type Correo = { para: string; asunto: string };
function correos() {
  const lista: Correo[] = [];
  usarTransporteCorreo(async (_e, init) => {
    const c = JSON.parse(String(init.body)) as { to: { address: string }[]; subject: string };
    lista.push({ para: c.to[0]!.address, asunto: c.subject });
    return new Response('{"success":true,"message_id":"m-ejemplo"}', { status: 200 });
  });
  return lista;
}
afterEach(() => usarTransporteCorreo(null));
const dentroDe = (horas: number) => new Date(Date.now() + horas * 3_600_000);

async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  expect((await abrirCaracas({ m, admin, cliente })).estado).toBe(201);
  const rep = await m.cuenta('repartidor', 'Marina Ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  await m.DB.prepare(
    "INSERT INTO kyc (usuario_id, estado, doc_frente, selfie, enviado_en, revisado_en) VALUES (?, 'aprobado', 'kyc/doc', 'kyc/cara', datetime('now', '-2 hours'), datetime('now'))",
  )
    .bind(rep.id)
    .run();
  for (const p of ['foto_cara', 'foto_documento', 'foto_licencia', 'enviado', 'vehiculo'])
    await m.DB.prepare('INSERT OR IGNORE INTO embudo_cuenta (usuario_id, paso) VALUES (?, ?)')
      .bind(rep.id, p)
      .run();
  await m.DB.prepare(
    "UPDATE usuarios SET idioma = 'es', correo_confirmado_en = '2026-11-01 10:00:00' WHERE id = ?",
  )
    .bind(rep.id)
    .run();
  await guardarAjustesRezagados(m.DB, {
    ...AJUSTES_REZAGADOS_DE_FABRICA,
    horaDesde: 0,
    horaHasta: 24,
    zonas: { [CCS.id]: 'encendido' },
  });
  const env = { DB: m.DB, ...m.extra, YAD_TOKEN: 'token-de-prueba' } as unknown as Env;
  return { m, rep, yo, env };
}

describe('C-VEHICULO-SIN-ENVIAR: Camila le recuerda enviar su vehículo', () => {
  it('la barra con el vehículo sin enviar pide «vehiculo_enviar», aunque ya trabaje con él', () => {
    const pasos = [
      {
        clave: 'vehiculo_aprobado',
        quien: 'conductor',
        estado: 'pendiente',
        falta: 'vehiculo_sin_enviar',
      },
    ] as Parameters<typeof lecturaDeBarra>[0]['pasos'];
    expect(lecturaDeBarra({ listo: true, siguiente: null, pasos }).paso).toBe('vehiculo_enviar');
    expect(lecturaDeBarra({ listo: false, siguiente: null, pasos }).paso).toBe('vehiculo_enviar');
  });

  it('un conductor con su moto registrada y sin enviar recibe el recordatorio de enviarla', async () => {
    const s = await escenario();
    const enviados = correos();
    await s.yo('POST', '/datos/conductor/vehiculos', {
      tipo: 'moto',
      marca: 'Motos Divoox',
      modelo: 'M150',
      anio: 2023,
      color: 'Negro',
      placa: `AB${Math.floor(Math.random() * 1e6)}`,
      placaEstado: 'FL',
    });
    const lista = await candidatos(
      s.env,
      s.m.DB,
      { ...AJUSTES_REZAGADOS_DE_FABRICA, horaDesde: 0, horaHasta: 24 },
      [CCS.id],
      dentroDe(4),
    );
    expect(lista.find((c) => c.id === s.rep.id)?.paso).toBe('vehiculo_enviar');
    await correrRezagados(s.env, s.m.DB, dentroDe(4));
    expect(enviados.map((c) => c.asunto)).toEqual([
      PLANTILLAS_DE_FABRICA.vehiculo_enviar.es.asunto,
    ]);
  });
});

describe('C-DOCUMENTO-VENCIDO-CLARO: el documento vencido se ve y se pide', () => {
  it('la fecha leída cuenta como vencida solo si de verdad ya pasó', () => {
    const hoy = new Date('2026-11-25T12:00:00Z');
    expect(vencidoDeVerdad('2025-03-14', hoy)).toBe(true);
    expect(vencidoDeVerdad('2027-03-14', hoy)).toBe(false);
    expect(vencidoDeVerdad('25/12/2025', hoy)).toBe(true);
    // Día y mes que se confunden: vencido solo si las dos lecturas ya pasaron.
    expect(vencidoDeVerdad('03/04/2026', hoy)).toBe(true);
    expect(vencidoDeVerdad('03/12/2026', hoy)).toBe(false);
    expect(vencidoDeVerdad('no se lee', hoy)).toBe(false);
    expect(vencidoDeVerdad(null, hoy)).toBe(false);
  });

  it('pedido el documento vigente, Camila le escribe con su texto propio', () => {
    const base = {
      rol: 'repartidor',
      pasos: new Set(['foto_cara', 'foto_documento', 'foto_licencia', 'enviado', 'aprobado']),
      correoConfirmado: true,
      zonaConLineas: false,
      enLinea: false,
      repetir: true,
    };
    expect(pasoPendiente({ ...base, documentoVencido: true })).toBe('documento_vigente');
    expect(pasoPendiente(base)).toBe('repetir');
    const p = PLANTILLAS_DE_FABRICA.documento_vigente;
    expect(p.es.texto).toContain('vigente');
    expect(p.en.texto).toContain('current');
    for (const t of [p.es, p.en]) expect(t.sms.length).toBeLessThanOrEqual(160);
  });

  it('aprobado y con la fecha vencida: va a la campana del equipo, nunca directo al conductor', async () => {
    const s = await escenario();
    await s.m.DB.prepare(
      `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, estado, ia_color, ia_json)
       VALUES ('vf-doc', ?, 'doc_frente', 'kyc/doc', 'vigente', 'amarillo', ?)`,
    )
      .bind(s.rep.id, JSON.stringify({ vencido: 'si', vence: '2024-01-31' }))
      .run();
    const lista = await candidatos(
      s.env,
      s.m.DB,
      { ...AJUSTES_REZAGADOS_DE_FABRICA, horaDesde: 0, horaHasta: 24 },
      [CCS.id],
      dentroDe(4),
    );
    const c = lista.find((x) => x.id === s.rep.id);
    expect(c?.equipo).toBe('documento_vencido');
    expect(c?.paso).not.toBe('documento_vigente');
    // El equipo lo confirma con «Pedir el documento vigente»: ahora sí le escribe Camila.
    await s.m.DB.prepare(
      "UPDATE verificacion_fotos SET estado = 'repetir', motivo = 'Tu documento está vencido.' WHERE id = 'vf-doc'",
    ).run();
    const despues = await candidatos(
      s.env,
      s.m.DB,
      { ...AJUSTES_REZAGADOS_DE_FABRICA, horaDesde: 0, horaHasta: 24 },
      [CCS.id],
      dentroDe(4),
    );
    const d = despues.find((x) => x.id === s.rep.id);
    expect(d?.paso).toBe('documento_vigente');
    expect(d?.equipo).not.toBe('documento_vencido');
  });
});
