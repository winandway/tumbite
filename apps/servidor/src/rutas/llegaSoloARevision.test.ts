import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas, subirA } from '../pruebas/motoVe';
import { mundo } from '../pruebas/ayuda';
import { CLAVE_REPARACION_LLEGA_SOLO, repararLlegaSoloARevision } from '../reparacionLlegaSolo';

/**
 * C-LLEGA-SOLO-A-REVISION (23 nov 2026, Richard: «si él ya le dio enviar… de nuestro lado, aceptar lo
 * que él ya envió… si ya todo está en el servidor, no es necesario»). Reemplaza «nada se manda a
 * revisión solo». Un papel o un vehículo completo llega solo a revisión, con el mismo efecto que el
 * botón; nada se aprueba solo.
 */
async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  const e = { m, admin, cliente };
  expect((await abrirCaracas(e)).estado).toBe(201);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  const conductor = async (pais: 'VE' | 'US', nombre = 'Conductor de ejemplo') => {
    const rep = await m.cuenta('repartidor', nombre);
    const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
      m.llamar(metodo, ruta, cuerpo, rep.token);
    if (pais === 'VE')
      expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
    await yo('GET', '/datos/conductor/verificacion');
    const foto = (paso: string) =>
      subirA(e, `/datos/conductor/verificacion/foto/${paso}?origen=camara`, rep.token);
    const kycFoto = (pieza: string) => subirA(e, `/datos/kyc/foto/${pieza}`, rep.token);
    const kyc = async () =>
      (
        await m.DB.prepare('SELECT estado FROM kyc WHERE usuario_id = ?')
          .bind(rep.id)
          .first<{ estado: string }>()
      )?.estado;
    const moto = async () => {
      const v = await yo('POST', '/datos/conductor/vehiculos', {
        tipo: 'moto',
        marca: 'Motos Divoox',
        modelo: 'M150',
        anio: 2023,
        color: 'Negro',
        placa: `AB${Math.floor(Math.random() * 1e6)}`,
        placaEstado: 'FL',
      });
      expect(v.estado).toBe(201);
      return v.datos.id as string;
    };
    const doc = (vehiculo: string, tipo: string) =>
      subirA(e, `/datos/conductor/vehiculos/${vehiculo}/documentos?tipo=${tipo}`, rep.token);
    const vehiculo = async (id: string) =>
      (
        await m.DB.prepare('SELECT estado FROM vehiculos WHERE id = ?')
          .bind(id)
          .first<{ estado: string }>()
      )?.estado;
    return { rep, yo, foto, kycFoto, kyc, moto, doc, vehiculo };
  };
  const bandeja = async (estado: string) =>
    (await equipo('GET', `/datos/admin/kyc?estado=${estado}`)).datos.solicitudes as {
      id: string;
      miniatura: string | null;
      falta?: string[];
    }[];
  return { m, equipo, conductor, bandeja };
}

describe('C-LLEGA-SOLO-A-REVISION: lo completo llega solo a revisión', () => {
  it('Venezuela: con la cédula por delante y la cara, la identidad queda enviada y sale en Pendientes sin tocar «Enviar»', async () => {
    const s = await escenario();
    const c = await s.conductor('VE');
    await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true });
    expect((await c.foto('doc_frente')).estado).toBe(201);
    expect(await c.kyc()).toBe('sin_enviar');
    expect((await c.foto('cara')).estado).toBe(201);
    expect(await c.kyc()).toBe('pendiente');
    expect((await s.bandeja('pendiente')).map((x) => x.id)).toContain(c.rep.id);
    expect((await s.bandeja('sin_enviar')).map((x) => x.id)).not.toContain(c.rep.id);
    // El botón de la app vieja responde bien y no manda nada dos veces.
    const boton = await c.yo('POST', '/datos/conductor/verificacion/enviar');
    expect(boton.estado).toBe(200);
    expect(boton.datos.enviados).toBe(0);
    // Nada se aprueba solo.
    expect(await c.kyc()).toBe('pendiente');
  });

  it('Estados Unidos, flujo de siempre: documento por los dos lados, cara y consentimiento → enviada; sin consentimiento no', async () => {
    const s = await escenario();
    const c = await s.conductor('US');
    for (const p of ['doc_frente', 'doc_reverso', 'selfie'])
      expect((await c.kycFoto(p)).estado).toBe(201);
    // Sin consentimiento no se envía, y «Sin enviar» dice qué falta.
    expect(await c.kyc()).toBe('sin_enviar');
    const fila = (await s.bandeja('sin_enviar')).find((x) => x.id === c.rep.id);
    expect(fila?.falta).toEqual(['consentimiento']);
    // La cara ya subida se ve aunque no haya enviado (C-MINIATURA-SIEMPRE).
    expect(fila?.miniatura).toBe('selfie');
    expect((await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true })).estado).toBe(200);
    expect(await c.kyc()).toBe('pendiente');
  });

  it('Estados Unidos sin el reverso: no se envía y «Sin enviar» dice que falta el documento por detrás', async () => {
    const s = await escenario();
    const c = await s.conductor('US');
    await c.yo('POST', '/datos/kyc/consentimiento', { acepto: true });
    for (const p of ['doc_frente', 'selfie']) await c.kycFoto(p);
    expect(await c.kyc()).toBe('sin_enviar');
    const fila = (await s.bandeja('sin_enviar')).find((x) => x.id === c.rep.id);
    expect(fila?.falta).toEqual(['doc_reverso']);
  });

  it('el vehículo: Venezuela en plazo con el registro, Estados Unidos con registro y seguro; el botón sigue bien', async () => {
    const s = await escenario();
    const ve = await s.conductor('VE');
    const motoVe = await ve.moto();
    expect(await ve.vehiculo(motoVe)).toBe('registrado');
    expect((await ve.doc(motoVe, 'foto_frente')).estado).toBe(201);
    expect(await ve.vehiculo(motoVe)).toBe('registrado');
    expect((await ve.doc(motoVe, 'registro')).estado).toBe(201);
    expect(await ve.vehiculo(motoVe)).toBe('en_revision');
    expect((await ve.yo('POST', `/datos/conductor/vehiculos/${motoVe}/enviar`)).estado).toBe(200);
    const us = await s.conductor('US', 'Conductor de Miami');
    const motoUs = await us.moto();
    await us.doc(motoUs, 'registro');
    expect(await us.vehiculo(motoUs)).toBe('registrado');
    await us.doc(motoUs, 'seguro');
    expect(await us.vehiculo(motoUs)).toBe('en_revision');
  });

  it('la reparación manda una sola vez a los que ya estaban completos y no toca a los demás', async () => {
    const s = await escenario();
    // Tres conductores que dejaron todo subido antes del cambio (escrito directo, como quedó en la base).
    const real = await s.conductor('US', 'Conductor real');
    const prueba = await s.conductor('US', 'Conductor de prueba');
    const rechazado = await s.conductor('US', 'Conductor rechazado');
    const incompleto = await s.conductor('US', 'Conductor a medias');
    const completar = (id: string, estado = 'sin_enviar') =>
      s.m.DB.prepare(
        `INSERT INTO kyc (usuario_id, estado, doc_frente, doc_reverso, selfie, consentimiento_en)
         VALUES (?, ?, 'kyc/a', 'kyc/b', 'kyc/c', datetime('now'))
         ON CONFLICT(usuario_id) DO UPDATE SET estado = excluded.estado, doc_frente = 'kyc/a',
           doc_reverso = 'kyc/b', selfie = 'kyc/c', consentimiento_en = datetime('now')`,
      )
        .bind(id, estado)
        .run();
    await completar(real.rep.id);
    await completar(prueba.rep.id);
    await completar(rechazado.rep.id, 'rechazado');
    await s.m.DB.prepare(
      `INSERT INTO kyc (usuario_id, estado, doc_frente) VALUES (?, 'sin_enviar', 'kyc/a')
       ON CONFLICT(usuario_id) DO UPDATE SET doc_frente = 'kyc/a'`,
    )
      .bind(incompleto.rep.id)
      .run();
    await s.m.DB.prepare('UPDATE usuarios SET es_prueba = 1 WHERE id = ?')
      .bind(prueba.rep.id)
      .run();
    // Su moto con registro y seguro, sin enviar.
    const moto = await real.moto();
    await s.m.DB.prepare(
      `INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave) VALUES
         ('doc-registro-real', ?1, 'registro', 'vehiculos/r'), ('doc-seguro-real', ?1, 'seguro', 'vehiculos/s')`,
    )
      .bind(moto)
      .run();
    await s.m.DB.prepare('DELETE FROM config WHERE clave = ?')
      .bind(CLAVE_REPARACION_LLEGA_SOLO)
      .run();
    const enviados = await repararLlegaSoloARevision(s.m.DB);
    expect(enviados).toEqual([real.rep.id]);
    expect(await real.kyc()).toBe('pendiente');
    expect(await real.vehiculo(moto)).toBe('en_revision');
    expect(await prueba.kyc()).toBe('sin_enviar');
    expect(await rechazado.kyc()).toBe('rechazado');
    expect(await incompleto.kyc()).toBe('sin_enviar');
    // Una sola vez: la segunda corrida (o la de otro servidor a la vez) no hace nada.
    expect(await repararLlegaSoloARevision(s.m.DB)).toBeNull();
  });
});
