import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { llamar, rutaEnCurso } from '../pruebas/flex';
import { textoYaLlega } from './avisosFlex';

/**
 * C-FLEX-YA-LLEGA (31 oct 2026, LG4): cerca de la próxima parada, quien recibe recibe UNA vez el
 * aviso «ya llega» con el conductor y su vehículo.
 */
describe('aviso «ya llega»', () => {
  it('lejos no avisa; a menos de 800 m avisa una sola vez', async () => {
    const m = mundo();
    const r = await rutaEnCurso(m, 2);
    const cli = await m.cuenta('cliente', 'Rosa Espera');
    await m.DB.prepare('UPDATE envios SET destinatario_usuario_id = ? WHERE id = ?')
      .bind(cli.id, r.paradas[0].envioId)
      .run();
    const cuenta = async () =>
      (
        await m.DB.prepare(
          "SELECT COUNT(*) AS n FROM flex_avisos WHERE tipo = 'paquete_ya_llega' AND usuario_id = ?",
        )
          .bind(cli.id)
          .first<{ n: number }>()
      )?.n;
    await llamar(m, 'POST', `${r.C}/ubicacion`, { lat: 25.77, lng: -80.19 }, r.cond.token);
    expect(await cuenta()).toBe(0);
    await llamar(m, 'POST', `${r.C}/ubicacion`, { lat: 25.701, lng: -80.2 }, r.cond.token);
    await llamar(m, 'POST', `${r.C}/ubicacion`, { lat: 25.7005, lng: -80.2 }, r.cond.token);
    expect(await cuenta()).toBe(1);
  });
  it('el texto dice quién viene, el vehículo y el punto de encuentro', () => {
    const a = textoYaLlega('es', {
      conductor: 'Luis',
      vehiculo: 'Toyota Hilux blanca · ABC123',
      punto: 'Estación Doña María',
    });
    expect(a.cuerpo).toContain('Luis');
    expect(a.cuerpo).toContain('ABC123');
    expect(a.cuerpo).toContain('Estación Doña María');
  });
});
