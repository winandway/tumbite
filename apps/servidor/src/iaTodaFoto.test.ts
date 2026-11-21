import { afterEach, describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { type LlamadaIa, usarModeloVerificacion } from './verificacionIa';

/**
 * C-IA-TODA-FOTO (21 nov 2026): el primer líder de El Vigía subió su documento y su cara por la
 * verificación vieja (`/kyc/foto`) y la IA no las miró. Con el «sí» del conductor, toda foto de
 * documento o de cara pasa por la comprobación automática, venga de la pantalla que venga.
 */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
afterEach(() => usarModeloVerificacion(null));

async function escenario(permiso: boolean | null) {
  const llamadas = { n: 0 };
  const f: LlamadaIa = async () => {
    llamadas.n++;
    return {
      texto: JSON.stringify({
        clase: 'licencia_frente',
        legible: true,
        vencido: 'no_se_ve',
        confianza: 95,
      }),
      entrada: 1300,
      salida: 150,
    };
  };
  usarModeloVerificacion(f);
  const m = mundo(
    { GEMINI_API_KEY: 'llave-de-mentira-para-pruebas-000000' },
    { host: 'staging.tumbite.com' },
  );
  const c = await m.cuenta('repartidor', 'Conductor Ejemplo');
  if (permiso !== null)
    await m.llamar(
      'POST',
      '/datos/conductor/verificacion/permiso-ia',
      { acepto: permiso },
      c.token,
    );
  const subir = (pieza: string) =>
    m.crudo(`/datos/kyc/foto/${pieza}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${c.token}`, 'content-type': 'image/jpeg' },
      body: JPEG,
    });
  const fotos = () =>
    m.DB.prepare(
      'SELECT paso, ia_color FROM verificacion_fotos WHERE conductor_id = ? ORDER BY paso',
    )
      .bind(c.id)
      .all<{ paso: string; ia_color: string }>()
      .then((r) => r.results);
  return { subir, fotos, llamadas };
}

describe('C-IA-TODA-FOTO', () => {
  it('con permiso, la foto que entra por la verificación vieja también la mira la IA y queda en la ficha', async () => {
    const e = await escenario(true);
    expect((await e.subir('doc_frente')).status).toBe(201);
    expect((await e.subir('selfie')).status).toBe(201);
    expect(e.llamadas.n).toBeGreaterThanOrEqual(1);
    const f = await e.fotos();
    expect(f.map((x) => x.paso).sort()).toEqual(['cara', 'doc_frente']);
    expect(f.some((x) => x.ia_color !== 'sin_ia')).toBe(true);
  });

  it('sin permiso (no contestó o dijo que no), la foto no sale hacia la IA', async () => {
    for (const p of [null, false] as const) {
      const e = await escenario(p);
      expect((await e.subir('doc_frente')).status).toBe(201);
      expect(e.llamadas.n).toBe(0);
      expect(await e.fotos()).toEqual([]);
    }
  });
});
