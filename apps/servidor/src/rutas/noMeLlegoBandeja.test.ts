import { describe, expect, it } from 'vitest';
import {
  abrirCaracas,
  cargarPagoMovilVe,
  conductorListoVe,
  escenarioVe,
  pedirMotoVe,
} from '../pruebas/motoVe';
import {
  abrirIca,
  aprobarComisionPe,
  cargarCuentaCelularPe,
  conductorListoPe,
  escenarioPe,
  pedirEnIca,
} from '../pruebas/motoPe';

/**
 * C-NO-ME-LLEGO-BANDEJA (26 nov 2026) — Venezuela (Pago Móvil) y Perú (Yape y Plin). «No me llegó»
 * abre un caso en la bandeja de dinero y el equipo lo encuentra aunque haya muchos casos más viejos
 * abiertos. La vuelta del sitio de pruebas cayó porque pedía `?tipo=pago_movil_viaje` (un tipo que la
 * bandeja no tiene): el servidor lo ignoraba en silencio, devolvía la primera página (50 casos, los
 * más viejos) y, con más de 50 casos de «no me llegó» acumulados por las vueltas, el nuevo no salía.
 * Ahora un tipo desconocido es un 422 en palabras y el caso se encuentra paginando `tipo=incidencia`.
 */
type Llamar = (
  m: string,
  r: string,
  c?: unknown,
  t?: string,
) => Promise<{ estado: number; datos: any }>;

/** 55 casos viejos de «no me llegó» abiertos (como en el sitio de pruebas tras muchas vueltas). */
async function casosViejos(db: D1Database) {
  await db
    .prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 55)
       INSERT INTO incidencias_dinero (id, tipo, referencia, cuenta_id, pais, moneda, monto_esperado, monto_recibido, detalle, creado_en)
       SELECT 'viejo-' || i, 'pago_movil_viaje', 'pago-movil-viaje:viejo-' || i, 'x', 'VE', 'USD', 500, 0,
              'Caso viejo', datetime('now', '-' || i || ' days') FROM n`,
    )
    .run();
}

/** Busca el caso del viaje en la bandeja, página por página, como lo hace el guion. */
async function encontrar(llamar: Llamar, token: string, viajeId: string) {
  for (let pagina = 0; pagina < 20; pagina++) {
    const r = await llamar(
      'GET',
      `/datos/admin/bandeja-dinero?tipo=incidencia&pagina=${pagina}`,
      undefined,
      token,
    );
    expect(r.estado).toBe(200);
    const caso = (r.datos.casos as { clave: string; detalle: string }[]).find((x) =>
      x.detalle.includes(viajeId),
    );
    if (caso) return caso;
    if (!r.datos.hayMas.incidencia) return null;
  }
  return null;
}

describe('C-NO-ME-LLEGO-BANDEJA: «no me llegó» se encuentra en la bandeja', () => {
  it('un tipo de caso que la bandeja no tiene es un 422 en palabras, nunca la primera página en silencio', async () => {
    const e = await escenarioVe();
    const r = await e.m.llamar(
      'GET',
      '/datos/admin/bandeja-dinero?tipo=pago_movil_viaje',
      undefined,
      e.admin.token,
    );
    expect(r.estado).toBe(422);
    expect(String(r.datos.error)).toMatch(/tipo de caso/);
  });

  it('Venezuela, Pago Móvil: con 55 casos más viejos abiertos, el nuevo está en la bandeja', async () => {
    const e = await escenarioVe();
    expect((await abrirCaracas(e)).estado).toBe(201);
    await casosViejos(e.m.DB);
    const c = await conductorListoVe(e, 2000);
    await cargarPagoMovilVe(c);
    const v = await pedirMotoVe(e, 'pago_movil');
    expect((await c.paso(v.id, 'aceptar')).estado).toBe(200);
    expect((await c.paso(v.id, 'llegue')).estado).toBe(200);
    const pin = (await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token)).datos
      .viaje.pin;
    expect((await c.paso(v.id, 'iniciar', { pin })).estado).toBe(200);
    expect((await c.paso(v.id, 'pago-movil', { recibido: false })).estado).toBe(200);
    // La primera página (los 50 más viejos) no lo trae: hay que pasar de página.
    const primera = await e.m.llamar(
      'GET',
      '/datos/admin/bandeja-dinero?tipo=incidencia',
      undefined,
      e.admin.token,
    );
    expect(JSON.stringify(primera.datos)).not.toContain(v.id);
    expect(primera.datos.hayMas.incidencia).toBe(true);
    const caso = await encontrar(e.m.llamar, e.admin.token, v.id);
    expect(caso?.clave).toMatch(/^incidencia:/);
  });

  it('Perú, Plin a un conductor con Yape: con 55 casos más viejos abiertos, el nuevo está en la bandeja', async () => {
    const e = await escenarioPe();
    await aprobarComisionPe(e);
    expect((await abrirIca(e)).estado).toBe(201);
    await casosViejos(e.m.DB);
    const c = await conductorListoPe(e, 5000, 'Conductor con Yape');
    await cargarCuentaCelularPe(c, 'yape');
    const v = await pedirEnIca(e, 'plin');
    expect((await c.paso(v.id, 'aceptar')).estado).toBe(200);
    expect((await c.paso(v.id, 'llegue')).estado).toBe(200);
    const pin = (await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token)).datos
      .viaje.pin;
    expect((await c.paso(v.id, 'iniciar', { pin })).estado).toBe(200);
    expect((await c.paso(v.id, 'pago-movil', { recibido: false })).estado).toBe(200);
    const caso = await encontrar(e.m.llamar, e.admin.token, v.id);
    expect(caso?.clave).toMatch(/^incidencia:/);
  });
});
