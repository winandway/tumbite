import { afterEach, describe, expect, it } from 'vitest';
import { personaPorId } from './camila/memoria';
import { mundo } from './pruebas/ayuda';
import { type LlamadaIa, usarModeloVerificacion } from './verificacionIa';

/**
 * C-AVISO-IA-UNICO (21 nov 2026, dictamen duodécimo): un solo aviso de IA para el conductor (fotos y
 * chat), en su pantalla antes de la primera foto. Android y web: obligatorio. iPhone: con la salida
 * «Prefiero revisión solo por una persona». Al aceptar, lo ya subido pasa por la IA.
 */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
afterEach(() => usarModeloVerificacion(null));

async function escenario() {
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
  const pendiente = async () =>
    (await m.llamar('GET', '/datos/conductor/verificacion', undefined, c.token)).datos
      .avisoIaPendiente as boolean;
  const aviso = (cuerpo: object) => m.llamar('POST', '/datos/conductor/aviso-ia', cuerpo, c.token);
  return { m, c, llamadas, pendiente, aviso };
}

describe('C-AVISO-IA-UNICO', () => {
  it('la cuenta nueva tiene el aviso pendiente', async () => {
    const e = await escenario();
    expect(await e.pendiente()).toBe(true);
  });

  it('en Android y en la web no se puede seguir sin aceptar', async () => {
    for (const plataforma of ['android', 'web']) {
      const e = await escenario();
      expect((await e.aviso({ acepto: false, plataforma })).estado).toBe(422);
      expect(await e.pendiente()).toBe(true);
    }
  });

  it('en iPhone «Prefiero revisión solo por una persona» contesta el aviso sin la IA', async () => {
    const e = await escenario();
    expect((await e.aviso({ acepto: false, plataforma: 'ios' })).estado).toBe(200);
    expect(await e.pendiente()).toBe(false);
    const fila = await e.m.DB.prepare(
      'SELECT acepto, texto_version FROM verificacion_permiso_ia WHERE conductor_id = ?',
    )
      .bind(e.c.id)
      .first<{ acepto: number; texto_version: string }>();
    expect(fila).toEqual({ acepto: 0, texto_version: 'aviso-2026-11-21/ios/aviso' });
  });

  it('retirarlo desde el perfil sí se puede en cualquier plataforma', async () => {
    const e = await escenario();
    await e.aviso({ acepto: true, plataforma: 'android' });
    expect((await e.aviso({ acepto: false, plataforma: 'android', desde: 'perfil' })).estado).toBe(
      200,
    );
    expect(await e.pendiente()).toBe(false);
  });

  it('quien dijo «Sí» con el aviso viejo no lo vuelve a ver; quien dijo «No», sí (una vez)', async () => {
    for (const [acepto, ve] of [
      [true, false],
      [false, true],
    ] as const) {
      const e = await escenario();
      await e.m.llamar('POST', '/datos/conductor/verificacion/permiso-ia', { acepto }, e.c.token);
      expect(await e.pendiente()).toBe(ve);
    }
  });

  it('al aceptar, las fotos ya subidas sin permiso pasan por la IA y quedan en la ficha', async () => {
    const e = await escenario();
    const r = await e.m.crudo('/datos/kyc/foto/doc_frente', {
      method: 'POST',
      headers: { authorization: `Bearer ${e.c.token}`, 'content-type': 'image/jpeg' },
      body: JPEG,
    });
    expect(r.status).toBe(201);
    expect(e.llamadas.n).toBe(0);
    expect((await e.aviso({ acepto: true, plataforma: 'android' })).estado).toBe(200);
    expect(e.llamadas.n).toBeGreaterThanOrEqual(1);
    const f = await e.m.DB.prepare(
      'SELECT paso, ia_color FROM verificacion_fotos WHERE conductor_id = ?',
    )
      .bind(e.c.id)
      .all<{ paso: string; ia_color: string }>();
    expect(f.results.map((x) => x.paso)).toEqual(['doc_frente']);
    expect(f.results[0]!.ia_color).not.toBe('sin_ia');
  });

  it('el mismo permiso vale para su chat de ayuda', async () => {
    const e = await escenario();
    await e.m.DB.prepare('DELETE FROM camila_personas WHERE usuario_id = ?').bind(e.c.id).run();
    await e.m.DB.prepare("INSERT INTO camila_personas (id, usuario_id) VALUES ('p-chat', ?)")
      .bind(e.c.id)
      .run();
    expect((await personaPorId(e.m.DB, 'p-chat'))?.permiso_ia ?? null).toBeNull();
    await e.aviso({ acepto: true, plataforma: 'web' });
    expect(Number((await personaPorId(e.m.DB, 'p-chat'))?.permiso_ia)).toBe(1);
    // Una persona del chat creada después también lo hereda.
    await e.m.DB.prepare("DELETE FROM camila_personas WHERE id = 'p-chat'").run();
    await e.m.DB.prepare("INSERT INTO camila_personas (id, usuario_id) VALUES ('p-nueva', ?)")
      .bind(e.c.id)
      .run();
    expect(Number((await personaPorId(e.m.DB, 'p-nueva'))?.permiso_ia)).toBe(1);
  });
});
