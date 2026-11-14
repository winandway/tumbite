import { describe, expect, it, vi } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { B, llamar, rutaEnCurso, subir, type M } from '../pruebas/flex';

/**
 * C-FLEX-SEGUIMIENTO-PLUS (Flex Fase 7, 13 nov 2026). Todos los países. El rastreo público al
 * estándar del mercado, sin datos privados.
 */
async function codigoDe(m: M, envioId: string) {
  return (await m.DB.prepare('SELECT codigo_seguimiento AS c FROM paquetes WHERE envio_id = ?')
    .bind(envioId)
    .first<{ c: string }>())!.c;
}
const rastrear = (m: M, codigo: string) => llamar(m, 'GET', `${B}/seguimiento/${codigo}`);

describe('C-FLEX-SEGUIMIENTO-PLUS · rastreo público del destinatario', () => {
  it('en camino: cuántas paradas faltan, hora estimada y el conductor cerca solo si eres la próxima', async () => {
    const m = mundo();
    const r = await rutaEnCurso(m, 3);
    await llamar(
      m,
      'POST',
      `${B}/empresas/${r.e.id}/rutas/${r.rutaId}/calles`,
      {},
      r.e.dueno.token,
    );
    const [p1, p2] = r.paradas;
    const c1 = await codigoDe(m, p1.envioId);
    const c2 = await codigoDe(m, p2.envioId);
    await m.DB.prepare(
      "UPDATE rutas_flex SET conductor_lat = 25.771234, conductor_lng = -80.191234, conductor_ubicacion_en = datetime('now') WHERE id = ?",
    )
      .bind(r.rutaId)
      .run();
    const s1 = (await rastrear(m, c1)).datos.seguimiento;
    expect(s1.paradasAntes).toBe(0);
    expect(s1.cerca).toMatchObject({ lat: 25.771, lng: -80.191 });
    expect(Date.parse(s1.llegadaEstimada)).toBeGreaterThan(0);
    const s2 = (await rastrear(m, c2)).datos.seguimiento;
    expect(s2.paradasAntes).toBe(1);
    expect(s2.cerca).toBeNull();
    // Nada privado en la respuesta: ni nombre ni dirección ni teléfono del destinatario.
    const texto = JSON.stringify(s1);
    expect(texto).not.toMatch(/Cliente 1|Main St|3050000000/);
    // Ubicación vieja: ya no se muestra.
    await m.DB.prepare(
      "UPDATE rutas_flex SET conductor_ubicacion_en = datetime('now', '-30 minutes') WHERE id = ?",
    )
      .bind(r.rutaId)
      .run();
    expect((await rastrear(m, c1)).datos.seguimiento.cerca).toBeNull();
  });

  it('entregado: dónde quedó y la foto de la entrega durante 14 días', async () => {
    const m = mundo();
    const r = await rutaEnCurso(m, 2);
    const p = r.paradas[0];
    const foto = await subir(m, `${r.C}/paradas/${p.id}/prueba`, r.cond.token);
    expect(
      (
        await llamar(
          m,
          'POST',
          `${r.C}/paradas/${p.id}/entregar`,
          { fotoId: foto.datos.pruebaId, lugar: 'puerta' },
          r.cond.token,
        )
      ).estado,
    ).toBe(200);
    const codigo = await codigoDe(m, p.envioId);
    const s = (await rastrear(m, codigo)).datos.seguimiento;
    expect(s.entrega).toMatchObject({ lugar: 'puerta', foto: true });
    const img = await m.crudo(`${B}/seguimiento/${codigo}/foto`, {});
    expect(img.status).toBe(200);
    expect(img.headers.get('cache-control')).toBe('private, no-store');
    // Veinte días después (los eventos de custodia no se pueden cambiar: se adelanta el reloj).
    const ahora = Date.now();
    const reloj = vi.spyOn(Date, 'now').mockReturnValue(ahora + 20 * 86_400_000);
    expect((await rastrear(m, codigo)).datos.seguimiento.entrega.foto).toBe(false);
    expect((await m.crudo(`${B}/seguimiento/${codigo}/foto`, {})).status).toBe(404);
    reloj.mockRestore();
    // Un paquete que no se entregó no tiene foto pública.
    const otro = await codigoDe(m, r.paradas[1].envioId);
    expect((await m.crudo(`${B}/seguimiento/${otro}/foto`, {})).status).toBe(404);
  });
});
