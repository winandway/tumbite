import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas } from './pruebas/motoVe';
import { mundo } from './pruebas/ayuda';

/**
 * C-FOTO-DICE-LA-VERDAD (25 nov 2026, Richard: «Licencia: Aprobado» con las fotos «Todavía no la
 * tomó» y el registro «Foto de la licencia: hecho») — todos los países. La ficha enseña la foto real
 * que llegó por otro camino (la verificación de identidad o «Tus papeles»), y un papel aprobado sin
 * ninguna foto se nombra como tal: nunca «Aprobado» con «Todavía no la tomó».
 */
async function conductorConMoto() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  expect((await abrirCaracas({ m, admin, cliente })).estado).toBe(201);
  const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    m.llamar(metodo, ruta, cuerpo, rep.token);
  expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
  await m.DB.prepare(
    "INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, selfie, enviado_en, revisado_en) VALUES (?, 'aprobado', 'identificacion', 'kyc/doc', 'kyc/cara', datetime('now', '-2 hours'), datetime('now'))",
  )
    .bind(rep.id)
    .run();
  await yo('POST', '/datos/conductor/vehiculos', {
    tipo: 'moto',
    marca: 'Motos Divoox',
    modelo: 'M150',
    anio: 2023,
    color: 'Negro',
    placa: `EF${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`,
    placaEstado: 'FL',
  });
  const equipo = (ruta: string) => m.llamar('GET', ruta, undefined, admin.token);
  return { m, rep, equipo };
}
type Foto = {
  paso: string;
  foto: unknown;
  otraFoto?: { url: string; origen: string };
  enUnaFoto?: boolean;
  aprobadoSinFoto?: boolean;
};

describe('C-FOTO-DICE-LA-VERDAD: la ficha enseña la foto real o dice la verdad', () => {
  it('la licencia aprobada por «Tus papeles» se ve en la ficha (no «Todavía no la tomó»)', async () => {
    const { m, rep, equipo } = await conductorConMoto();
    await m.DB.prepare(
      "INSERT INTO conductor_documentos (id, conductor_id, tipo, clave, estado) VALUES ('lic-1', ?, 'licencia_moto', 'papeles/lic-1', 'aprobado')",
    )
      .bind(rep.id)
      .run();
    const r = await equipo(`/datos/admin/verificacion/${rep.id}`);
    expect(r.estado).toBe(200);
    const fotos = r.datos.fotos as Foto[];
    const papeles = r.datos.papeles as { papel: string; estado: string }[];
    expect(papeles.find((p) => p.papel === 'licencia')?.estado).toBe('aprobado');
    const frente = fotos.find((f) => f.paso === 'licencia_frente');
    expect(frente?.foto).toBeNull();
    expect(frente?.otraFoto?.url).toBe('/datos/admin/papeles-conductor/lic-1/archivo');
    expect(frente?.otraFoto?.origen).toBe('papeles');
    expect(frente?.aprobadoSinFoto).toBe(false);
    // El documento de identidad llegó por la verificación de identidad: también se ve.
    const doc = fotos.find((f) => f.paso === 'doc_frente');
    expect(doc?.otraFoto?.origen).toBe('identidad');
    // Ningún paso queda «Aprobado» en silencio sin foto.
    expect(fotos.filter((f) => f.aprobadoSinFoto)).toEqual([]);
  });

  it('un papel aprobado sin ninguna foto se dice «aprobado sin foto»', async () => {
    const { m, rep, equipo } = await conductorConMoto();
    // El documento de identidad aprobado, pero su foto ya no está (ni del asistente ni de la verificación).
    await m.DB.prepare('UPDATE kyc SET doc_frente = NULL WHERE usuario_id = ?').bind(rep.id).run();
    const r = await equipo(`/datos/admin/verificacion/${rep.id}`);
    const doc = (r.datos.fotos as Foto[]).find((f) => f.paso === 'doc_frente');
    expect(doc?.foto).toBeNull();
    expect(doc?.otraFoto).toBeUndefined();
    expect(doc?.aprobadoSinFoto).toBe(true);
  });
});
