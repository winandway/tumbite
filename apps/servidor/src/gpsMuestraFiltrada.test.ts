import { describe, expect, it } from 'vitest';
import type { Muestra } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';
import { MUESTRA_MIN_S, hayQueGuardarMuestra } from './rutas/operacion';

/**
 * C-GPS-MUESTRA-FILTRADA (regla «cada escritura tiene presupuesto», parte del 24 nov 2026: la
 * consulta que más escribía en producción era el INSERT de ubicaciones_recientes). Todos los países.
 */
const base: Muestra = { lat: 8.6, lng: -71.65, precisionM: 10, en: 1_000_000 };
const mover = (
  m: Muestra,
  metrosNorte: number,
  ms: number,
  precisionM = m.precisionM,
): Muestra => ({
  lat: m.lat + metrosNorte / 111_320,
  lng: m.lng,
  precisionM,
  en: m.en + ms,
});

describe('C-GPS-MUESTRA-FILTRADA · hayQueGuardarMuestra', () => {
  it('sin muestra anterior, se guarda', () => {
    expect(hayQueGuardarMuestra(null, base)).toBe(true);
  });
  it('casi en el mismo sitio y pocos segundos después, no se guarda', () => {
    expect(hayQueGuardarMuestra(base, mover(base, 5, 3_000))).toBe(false);
  });
  it('pasados los segundos mínimos, se guarda aunque esté quieto', () => {
    expect(hayQueGuardarMuestra(base, mover(base, 0, MUESTRA_MIN_S * 1000))).toBe(true);
  });
  it('si se movió 25 m o más, se guarda enseguida', () => {
    expect(hayQueGuardarMuestra(base, mover(base, 30, 2_000))).toBe(true);
  });
  it('si la precisión cambia de lado (precisa ↔ imprecisa), se guarda: cambia la llegada', () => {
    const mala = { ...base, precisionM: 150 };
    expect(hayQueGuardarMuestra(mala, mover(mala, 0, 2_000, 8))).toBe(true);
    expect(hayQueGuardarMuestra(base, mover(base, 0, 2_000, 150))).toBe(true);
    expect(hayQueGuardarMuestra(mala, mover(mala, 0, 2_000, 120))).toBe(false);
  });
});

/** Cuenta las escrituras de ubicaciones_recientes que hace el servidor. */
function contador() {
  const cuenta = { insert: 0, delete: 0 };
  const envolver = (db: D1Database): D1Database =>
    new Proxy(db, {
      get(blanco, prop, recibidor) {
        if (prop === 'prepare')
          return (sql: string) => {
            if (/INSERT INTO ubicaciones_recientes/i.test(sql)) cuenta.insert++;
            if (/DELETE FROM ubicaciones_recientes/i.test(sql)) cuenta.delete++;
            return blanco.prepare(sql);
          };
        const v = Reflect.get(blanco, prop, recibidor) as unknown;
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(blanco) : v;
      },
    });
  return { cuenta, envolver };
}

describe('C-GPS-MUESTRA-FILTRADA · un recorrido típico', () => {
  it('veinte lecturas casi quietas (temblor del GPS) escriben una sola fila', async () => {
    const { cuenta, envolver } = contador();
    const m = mundo({}, { envolver });
    const rep = await m.cuenta('repartidor', 'Repartidor Prueba');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: base.lat, lng: base.lng },
      rep.token,
    );
    const antes = { ...cuenta };
    for (let i = 0; i < 20; i++) {
      const p = mover(base, (i % 3) * 2, 0); // ±4 m de temblor, todo en el mismo instante
      const r = await m.llamar(
        'POST',
        '/datos/repartidor/ubicacion',
        { lat: p.lat, lng: p.lng, precision: 10 },
        rep.token,
      );
      expect(r.estado).toBe(200);
    }
    expect(cuenta.insert - antes.insert).toBe(1);
    expect(cuenta.delete - antes.delete).toBe(1); // el DELETE solo cuando se insertó
    const filas = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM ubicaciones_recientes WHERE usuario_id = ?',
    )
      .bind(rep.id)
      .first<{ n: number }>();
    expect(filas?.n).toBe(1);

    // Pasados los segundos mínimos, la siguiente lectura sí se guarda.
    await m.DB.prepare(
      `UPDATE ubicaciones_recientes SET creado_en = datetime(creado_en, '-${MUESTRA_MIN_S + 2} seconds') WHERE usuario_id = ?`,
    )
      .bind(rep.id)
      .run();
    await m.llamar(
      'POST',
      '/datos/repartidor/ubicacion',
      { lat: base.lat, lng: base.lng, precision: 10 },
      rep.token,
    );
    expect(cuenta.insert - antes.insert).toBe(2);

    // Y el salto imposible se sigue detectando después de las lecturas filtradas.
    const lejos = await m.llamar(
      'POST',
      '/datos/repartidor/ubicacion',
      { lat: base.lat + 0.2, lng: base.lng, precision: 10 },
      rep.token,
    );
    expect(lejos.datos.salto).toBe(true);
    expect(cuenta.insert - antes.insert).toBe(2);
  });
});
