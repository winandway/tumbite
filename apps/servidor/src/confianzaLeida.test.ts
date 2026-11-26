import { afterEach, describe, expect, it } from 'vitest';
import { confianzaDe, nacimientoDeLecturas } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import {
  CLAVE_CURSOR_CONFIANZA,
  CLAVE_CURSOR_RELLENO,
  datosDeLecturas,
  rellenarDatosDocumento,
} from './edadYDocumento';
import { type LlamadaIa, comprobarFoto, usarModeloVerificacion } from './verificacionIa';

/**
 * C-CONFIANZA-LEIDA (25 nov 2026, producción): la relectura guardó la fecha de nacimiento de los
 * conductores de Venezuela sin su confianza, así que nunca pasó sola a la cuenta y nadie quedó
 * habilitable. La confianza ahora es obligatoria en el JSON, se acepta en texto y en escala de 0 a 1, y
 * quien quedó con la fecha sin confianza se vuelve a leer UNA vez. El umbral sigue en 80.
 */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
afterEach(() => usarModeloVerificacion(null));

describe('C-CONFIANZA-LEIDA: la confianza llega como la mande el modelo', () => {
  it('número, texto, «95 %» y escala de 0 a 1 son lo mismo; lo que no es número, null', () => {
    expect(confianzaDe(95)).toBe(95);
    expect(confianzaDe('95')).toBe(95);
    expect(confianzaDe('95 %')).toBe(95);
    expect(confianzaDe(0.95)).toBe(95);
    expect(confianzaDe('0.95')).toBe(95);
    expect(confianzaDe('0,95')).toBe(95);
    expect(confianzaDe('alta')).toBeNull();
    expect(confianzaDe(undefined)).toBeNull();
  });

  it('una fecha con su confianza en texto o de 0 a 1 se propone con 95; sin confianza, con 0', () => {
    for (const c of ['95', '0.95', 0.95])
      expect(
        nacimientoDeLecturas([
          { paso: 'doc_frente', lectura: { nacimiento: '1974-03-10', confianzaNacimiento: c } },
        ])?.confianza,
      ).toBe(95);
    const sinConfianza = datosDeLecturas([
      { paso: 'doc_frente', lectura: { nombre: 'Conductor Uno', nacimiento: '1974-03-10' } },
    ]);
    expect(sinConfianza?.confianzaNacimiento).toBe(0);
    expect(
      datosDeLecturas([{ paso: 'doc_frente', lectura: { confianza: '0.98', nacimiento: '' } }])
        ?.confianza,
    ).toBe(98);
  });

  it('la lectura del modelo acepta la confianza en texto y la pide obligatoria en el JSON', async () => {
    const pedidos: unknown[] = [];
    const f: LlamadaIa = async (_env, p) => {
      pedidos.push(p.json);
      return {
        texto: JSON.stringify({
          clase: 'identidad_frente',
          legible: true,
          vencido: 'no',
          nacimiento: '1974-03-10',
          confianzaNacimiento: '0.95',
          confianza: '98',
        }),
        entrada: 1300,
        salida: 150,
      };
    };
    usarModeloVerificacion(f);
    const m = mundo();
    const env = { DB: m.DB, GEMINI_API_KEY: 'llave-de-mentira-para-pruebas-000000' };
    const r = await comprobarFoto(env as never, m.DB, {
      paso: 'doc_frente',
      pais: 'VE',
      ingles: false,
      imagen: { bytes: PNG, mime: 'image/png' },
      intentos: 0,
    });
    expect(r.lectura?.confianzaNacimiento).toBe(95);
    expect(r.lectura?.confianza).toBe(98);
    expect((pedidos[0] as { required: string[] }).required).toEqual(
      expect.arrayContaining(['confianza', 'nacimiento', 'confianzaNacimiento']),
    );
  });
});

describe('C-CONFIANZA-LEIDA: quien quedó con la fecha sin confianza se relee una sola vez', () => {
  it('el caso de producción: fecha leída sin confianza, se relee, la fecha pasa a la cuenta y no se repite', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    const c = await m.cuenta('repartidor', 'Conductor De Produccion');
    await m.DB.prepare('UPDATE usuarios SET fecha_nacimiento = NULL WHERE id = ?').bind(c.id).run();
    await m.DB.prepare('INSERT OR IGNORE INTO kyc (usuario_id) VALUES (?)').bind(c.id).run();
    await m.DB.prepare(
      `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, estado, ia_color, ia_json)
       VALUES ('vf-prod', ?, 'doc_frente', 'verif/doc', 'vigente', 'verde', ?)`,
    )
      .bind(c.id, JSON.stringify({ nombre: 'Conductor De Produccion', nacimiento: '1974-03-10' }))
      .run();
    // Lo que quedó en producción: la fila con la fecha y sin confianza, ya releída una vez.
    await m.DB.prepare(
      `INSERT INTO datos_documento (usuario_id, nombre, nacimiento, confianza_nacimiento, confianza, releida_en)
       VALUES (?, 'Conductor De Produccion', '1974-03-10', NULL, NULL, datetime('now'))`,
    )
      .bind(c.id)
      .run();
    await m.DB.prepare("INSERT INTO config (clave, valor) VALUES (?, 'fin')")
      .bind(CLAVE_CURSOR_RELLENO)
      .run();
    const releidas: string[] = [];
    const releer = async (x: { conductorId: string; fotoId: string | null }) => {
      releidas.push(x.conductorId);
      await m.DB.prepare('UPDATE verificacion_fotos SET ia_json = ? WHERE id = ?')
        .bind(
          JSON.stringify({
            nombre: 'Conductor De Produccion',
            nacimiento: '1974-03-10',
            confianzaNacimiento: '0.95',
            confianza: '98',
          }),
          x.fotoId,
        )
        .run();
      return true;
    };
    const r = await rellenarDatosDocumento(m.DB, releer);
    expect(r.releidas).toBe(1);
    const u = await m.DB.prepare('SELECT fecha_nacimiento FROM usuarios WHERE id = ?')
      .bind(c.id)
      .first<{ fecha_nacimiento: string }>();
    expect(u?.fecha_nacimiento).toBe('1974-03-10');
    const dd = await m.DB.prepare(
      'SELECT confianza_nacimiento AS n, confianza AS c FROM datos_documento WHERE usuario_id = ?',
    )
      .bind(c.id)
      .first();
    expect(dd).toEqual({ n: 95, c: 98 });
    // Una sola vez: la segunda pasada terminó y no se relee a nadie más.
    expect(await rellenarDatosDocumento(m.DB, releer)).toEqual({
      sinIa: 0,
      releidas: 0,
      fin: true,
    });
    expect(releidas).toEqual([c.id]);
    const cursor = await m.DB.prepare('SELECT valor FROM config WHERE clave = ?')
      .bind(CLAVE_CURSOR_CONFIANZA)
      .first<{ valor: string }>();
    expect(cursor?.valor).toBe('fin');
  });
});
