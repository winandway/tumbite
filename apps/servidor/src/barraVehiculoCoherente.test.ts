import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas } from './pruebas/motoVe';
import { mundo } from './pruebas/ayuda';
import { barraActivacion } from './activacion';

/**
 * C-BARRA-VEHICULO-COHERENTE (25 nov 2026, Richard en la ficha de un conductor de Tucaní: la barra
 * decía «Vehículo registrado con su placa: le toca al conductor» en gris y, a la vez, «Vehículo
 * aprobado» y «Vehículo en uso» en verde) — todos los países. «Aprobado» y «en uso» salen en verde
 * solo si su vehículo lo está de verdad, y lo que falta se nombra donde corresponde.
 */
async function conductor() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  expect((await abrirCaracas({ m, admin, cliente })).estado).toBe(201);
  const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  await m.DB.prepare(
    "INSERT INTO kyc (usuario_id, estado, doc_frente, selfie, enviado_en, revisado_en) VALUES (?, 'aprobado', 'kyc/doc', 'kyc/cara', datetime('now', '-2 hours'), datetime('now'))",
  )
    .bind(rep.id)
    .run();
  const moto = async (placa: string) => {
    const v = await yo('POST', '/datos/conductor/vehiculos', {
      tipo: 'moto',
      marca: 'Motos Divoox',
      modelo: 'M150',
      anio: 2023,
      color: 'Negro',
      placa: `${placa}${Math.floor(Math.random() * 1e6)}`,
      placaEstado: 'FL',
    });
    return v.datos.id as string;
  };
  return { m, rep, moto };
}
const pasoDe = (b: Awaited<ReturnType<typeof barraActivacion>>, clave: string) =>
  b.pasos.find((p) => p.clave === clave);

describe('C-BARRA-VEHICULO-COHERENTE: la barra y el vehículo dicen lo mismo', () => {
  it('sin vehículo: ni «aprobado» ni «en uso» salen en verde', async () => {
    const { m, rep } = await conductor();
    const b = await barraActivacion(m.DB, rep.id);
    expect(pasoDe(b, 'vehiculo')?.estado).toBe('pendiente');
    expect(pasoDe(b, 'vehiculo_aprobado')?.estado).not.toBe('hecho');
    expect(pasoDe(b, 'vehiculo_activo')?.estado).not.toBe('hecho');
  });

  it('registrado con su placa, en uso y sin enviar: «registrado» y «en uso» en verde; falta enviarlo y le toca a él', async () => {
    const { m, rep, moto } = await conductor();
    const id = await moto('AB');
    // Lo que deja el plazo de papeles: trabaja con su moto registrada mientras la envía.
    await m.DB.prepare('UPDATE repartidores SET vehiculo_activo_id = ? WHERE usuario_id = ?')
      .bind(id, rep.id)
      .run();
    const fila = await m.DB.prepare('SELECT estado FROM vehiculos WHERE id = ?')
      .bind(id)
      .first<{ estado: string }>();
    expect(fila?.estado).toBe('registrado');
    const b = await barraActivacion(m.DB, rep.id);
    expect(pasoDe(b, 'vehiculo')?.estado).toBe('hecho');
    const aprobado = pasoDe(b, 'vehiculo_aprobado');
    expect(aprobado?.estado).toBe('pendiente');
    expect(aprobado?.quien).toBe('conductor');
    expect(aprobado?.falta).toBe('vehiculo_sin_enviar');
    expect(pasoDe(b, 'vehiculo_activo')?.estado).toBe('hecho');
  });
});
