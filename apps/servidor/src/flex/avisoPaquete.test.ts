import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { k, llamar, rutaEnCurso, subir, type M } from '../pruebas/flex';
import { usarTransporteAvisos } from '../notificaciones';
import { avisarDestinatarios, enviosDeRuta } from './avisosFlex';

/**
 * C-AVISO-PAQUETE · todos los países: el destinatario con la app de Divoox recibe avisos al celular
 * con sonido propio (gratis, en lugar de SMS: en Venezuela un SMS cuesta 0,2257 dólares).
 */
type Push = { to: string; title: string; sound: string; data: Record<string, string> };
let pushes: Push[] = [];
beforeEach(() => {
  pushes = [];
  usarTransporteAvisos(async (_u, init) => {
    const lista = JSON.parse(String(init?.body)) as Push[];
    pushes.push(...lista);
    return new Response(JSON.stringify({ data: lista.map(() => ({ status: 'ok' })) }));
  });
});
afterEach(() => usarTransporteAvisos(null));

async function conDestinatarios(m: M) {
  const r = await rutaEnCurso(m, 2);
  const ana = await m.cuenta('cliente', 'Ana');
  const luis = await m.cuenta('cliente', 'Luis');
  for (const [u, p] of [
    [ana.id, r.paradas[0]],
    [luis.id, r.paradas[1]],
  ] as const) {
    await m.DB.prepare('UPDATE envios SET destinatario_usuario_id = ? WHERE id = ?')
      .bind(u, p.envioId)
      .run();
    await m.DB.prepare('INSERT INTO dispositivos (token, usuario_id) VALUES (?, ?)')
      .bind(`ExponentPushToken[${u}]`, u)
      .run();
  }
  return { ...r, ana, luis };
}
const de = (id: string) => pushes.filter((p) => p.to === `ExponentPushToken[${id}]`);

describe('C-AVISO-PAQUETE: avisos al destinatario del paquete', () => {
  it('«va en camino» a todos, una sola vez, con el sonido de Divoox', async () => {
    const m = mundo();
    const r = await conDestinatarios(m);
    const envios = await enviosDeRuta(m.DB, r.rutaId);
    expect(await avisarDestinatarios({} as never, m.DB, envios, 'en_camino')).toBe(2);
    expect(await avisarDestinatarios({} as never, m.DB, envios, 'en_camino')).toBe(0);
    expect(de(r.ana.id)).toHaveLength(1);
    expect(de(r.ana.id)[0]).toMatchObject({
      sound: 'aviso.wav',
      data: { tipo: 'flex_paquete', evento: 'en_camino' },
    });
  });

  it('al entregar: «entregado» a ese destinatario y «eres la próxima parada» al siguiente', async () => {
    const m = mundo();
    const r = await conDestinatarios(m);
    const p = r.paradas[0];
    const foto = await subir(m, `${r.C}/paradas/${p.id}/prueba`, r.cond.token);
    const ok = await llamar(
      m,
      'POST',
      `${r.C}/paradas/${p.id}/entregar`,
      { fotoId: foto.datos.pruebaId, recibio: 'Ana' },
      r.cond.token,
      { 'idempotency-key': k() },
    );
    expect(ok.estado).toBe(200);
    expect(de(r.ana.id).map((x) => x.data.evento)).toEqual(['entregado']);
    expect(de(r.luis.id).map((x) => x.data.evento)).toEqual(['eres_el_siguiente']);
    expect(de(r.luis.id)[0]?.title).toMatch(/próxima parada|next stop/);
  });
});
