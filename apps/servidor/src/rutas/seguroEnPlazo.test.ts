import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas, subirA } from '../pruebas/motoVe';
import { mundo } from '../pruebas/ayuda';
import { rehacerAprobarVehiculo } from '../esquemaPlazo';

/**
 * C-SEGURO-EN-PLAZO (23 nov 2026, Richard: «el seguro vamos a dejarlo dentro de los 30 días… no le
 * podemos exigir a la gente dame póliza»). En un país con plazo de papeles (Venezuela), mientras el
 * plazo de la cuenta está vigente, la moto se envía a revisión y el equipo la aprueba con el registro;
 * la póliza queda pendiente dentro del plazo. Con el plazo vencido, o en Estados Unidos, como siempre.
 */
async function conductor(pais: 'VE' | 'US') {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  const e = { m, admin, cliente };
  if (pais === 'VE') expect((await abrirCaracas(e)).estado).toBe(201);
  const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  const equipo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, admin.token);
  if (pais === 'VE')
    expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  // La cuenta nueva de un país con plazo nace con él al abrir sus papeles.
  await yo('GET', '/datos/conductor/verificacion');
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
    const id = v.datos.id as string;
    for (const t of ['registro', 'foto_frente'])
      expect(
        (await subirA(e, `/datos/conductor/vehiculos/${id}/documentos?tipo=${t}`, rep.token))
          .estado,
      ).toBe(201);
    return id;
  };
  const enCola = async (id: string) =>
    (await equipo('GET', '/datos/admin/vehiculos?estado=en_revision')).datos.vehiculos.find(
      (x: { id: string }) => x.id === id,
    ) as
      | {
          documentos: { id: string; tipo: string }[];
          seguroEnPlazo: { venceEn: string | null } | null;
        }
      | undefined;
  const aprobarRegistro = async (id: string) => {
    const fila = await enCola(id);
    for (const d of fila?.documentos ?? [])
      if (d.tipo === 'registro')
        expect(
          (
            await equipo('PUT', `/datos/admin/vehiculos/${id}/documentos/${d.id}`, {
              estado: 'aprobado',
              venceEn: '2030-01-01',
            })
          ).estado,
        ).toBe(200);
  };
  const vencerPlazo = () =>
    m.DB.prepare("UPDATE plazo_papeles SET vence_en = '2000-01-01 00:00:00' WHERE conductor_id = ?")
      .bind(rep.id)
      .run();
  return { m, rep, yo, equipo, moto, enCola, aprobarRegistro, vencerPlazo };
}

describe('C-SEGURO-EN-PLAZO: la póliza entra en el plazo de papeles', () => {
  it('Venezuela, plazo vigente: se envía sin póliza, el equipo la aprueba y la póliza sigue pendiente con su fecha', async () => {
    const c = await conductor('VE');
    const id = await c.moto();
    const envio = await c.yo('POST', `/datos/conductor/vehiculos/${id}/enviar`);
    expect(envio.estado).toBe(200);
    // El equipo ve que la póliza está dentro del plazo, con la fecha en que vence.
    const fila = await c.enCola(id);
    expect(fila?.seguroEnPlazo?.venceEn).toBeTruthy();
    await c.aprobarRegistro(id);
    expect(
      (await c.equipo('PUT', `/datos/admin/vehiculos/${id}`, { estado: 'aprobado' })).estado,
    ).toBe(200);
    // El seguro sigue saliendo como papel pendiente, con el vencimiento del plazo.
    const v = (await c.yo('GET', '/datos/conductor/verificacion')).datos;
    expect(v.plazo.estado).toBe('en_plazo');
    expect(v.plazo.venceEn).toBeTruthy();
    expect(v.papeles.find((p: { papel: string }) => p.papel === 'seguro')?.estado).toBe(
      'pendiente',
    );
    // Al vencer el plazo sin la póliza, no queda habilitado para siempre: el seguro vuelve a faltar.
    await c.vencerPlazo();
    const servicios = (await c.yo('GET', '/datos/conductor/servicios')).datos.servicios as {
      servicioId: string;
      puedeActivar: boolean;
      requisitosFaltantes: string[];
    }[];
    const conSeguro = servicios.filter((s) =>
      s.requisitosFaltantes.some((r) => r.startsWith('seguro')),
    );
    expect(conSeguro.length).toBeGreaterThan(0);
    expect(conSeguro.every((s) => !s.puedeActivar)).toBe(true);
  });

  it('Venezuela, plazo vencido: se exige la póliza para enviar y para aprobar', async () => {
    const c = await conductor('VE');
    // Vencido ANTES de subir: con el plazo vigente la moto llegaría sola a revisión (C-LLEGA-SOLO-A-REVISION).
    await c.vencerPlazo();
    const id = await c.moto();
    const envio = await c.yo('POST', `/datos/conductor/vehiculos/${id}/enviar`);
    expect(envio.estado).toBe(422);
    expect(envio.datos.error).toBe(
      'Upload the vehicle’s registration and insurance before submitting it.',
    );
    // Aunque llegara a la cola (una app vieja, un cambio a mano), la base no la deja aprobar.
    await c.m.DB.prepare("UPDATE vehiculos SET estado = 'en_revision' WHERE id = ?").bind(id).run();
    expect((await c.enCola(id))?.seguroEnPlazo).toBeNull();
    await c.aprobarRegistro(id);
    expect(
      (await c.equipo('PUT', `/datos/admin/vehiculos/${id}`, { estado: 'aprobado' })).estado,
    ).toBe(409);
  });

  it('Estados Unidos: se exige la póliza como siempre', async () => {
    const c = await conductor('US');
    const id = await c.moto();
    const envio = await c.yo('POST', `/datos/conductor/vehiculos/${id}/enviar`);
    expect(envio.estado).toBe(422);
    expect(envio.datos.error).toBe(
      'Upload the vehicle’s registration and insurance before submitting it.',
    );
  });
});

describe('C-SEGURO-EN-PLAZO en la base: el disparador viejo se cambia una sola vez', () => {
  it('una base con el disparador de antes lo cambia al arrancar, y la segunda vez no toca nada', async () => {
    const m = mundo({});
    await m.cuenta('admin', 'Soporte Divoox');
    await m.DB.prepare('DROP TRIGGER IF EXISTS vehiculos_aprobar_exige_documentos').run();
    await m.DB.prepare(
      `CREATE TRIGGER vehiculos_aprobar_exige_documentos BEFORE UPDATE OF estado ON vehiculos
       WHEN NEW.estado = 'aprobado' AND OLD.estado = 'en_revision' AND NEW.tipo IN ('carro', 'moto', 'scooter')
         AND (SELECT COUNT(DISTINCT tipo) FROM vehiculo_documentos WHERE vehiculo_id = NEW.id
               AND estado = 'aprobado' AND tipo IN ('registro', 'seguro')) < 2
       BEGIN SELECT RAISE(ABORT, 'vehiculo_sin_documentos_aprobados'); END`,
    ).run();
    expect(await rehacerAprobarVehiculo(m.DB)).toBe(true);
    const f = await m.DB.prepare(
      "SELECT sql FROM sqlite_master WHERE name = 'vehiculos_aprobar_exige_documentos'",
    ).first<{ sql: string }>();
    expect(f?.sql).toContain('plazo_papeles');
    expect(await rehacerAprobarVehiculo(m.DB)).toBe(false);
  });
});
