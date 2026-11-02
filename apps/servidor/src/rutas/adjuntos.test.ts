import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';
import { crearAlmacenPruebas } from '../pruebas/r2';
import { crearTicket } from './tickets';

/**
 * C-CASOS-CAPTURAS (1 nov 2026, pedido de Richard por la sesión de su correo): en «Mis casos de
 * ayuda» la persona manda hasta 3 capturas por mensaje (JPG, PNG, WebP o HEIC, 10 MB cada una),
 * guardadas en nuestro almacén. Se ven solo con un enlace firmado que vale 8 días.
 */
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const SECRETO = 'g'.repeat(48);

async function escenario() {
  const m = mundo({
    BUCKET: crearAlmacenPruebas().bucket,
    GERENTE_SECRETO: SECRETO,
    ARCHIVOS_FIRMA: 'f'.repeat(48),
    SITIO_URL: 'https://divoox.test',
  });
  const cli = await m.cuenta('cliente', 'Ana Captura');
  const t = await crearTicket({ DB: m.DB, ...m.extra } as never, m.DB, {
    tipo: 'soporte',
    nombre: 'Ana Captura',
    correo: 'ana@ejemplo.com',
    idioma: 'es',
    asunto: 'La app se cierra',
    mensaje: 'Se cierra al pagar.',
    usuarioId: cli.id,
  });
  const subir = (bytes: Uint8Array, tipo = 'image/png') =>
    m.crudo(`/datos/tickets/${t.codigo}/adjuntos?nombre=pantalla.png`, {
      method: 'POST',
      headers: { 'content-type': tipo },
      body: bytes,
    });
  return { m, t, subir };
}

describe('capturas en los casos de ayuda', () => {
  it('sube, adjunta al mensaje y el gerente la ve con un enlace firmado', async () => {
    const { m, t, subir } = await escenario();
    const s = await subir(PNG);
    expect(s.status).toBe(201);
    const { adjunto } = (await s.json()) as { adjunto: { id: string } };
    const msg = await m.llamar('POST', `/datos/tickets/${t.codigo}/mensajes`, {
      texto: 'Aquí la captura',
      adjuntos: [adjunto.id],
    });
    expect(msg.estado).toBe(201);
    const ultimo = msg.datos.mensajes.at(-1);
    expect(ultimo.adjuntos).toHaveLength(1);
    const lista = (await (
      await m.crudo('/datos/gerente/tickets?estado=abiertos', {
        headers: { authorization: `Bearer ${SECRETO}` },
      })
    ).json()) as {
      tickets: { mensajes: { adjuntos?: { nombre: string; tipo: string; url: string }[] }[] }[];
    };
    const adj = lista.tickets[0]!.mensajes.flatMap((x) => x.adjuntos ?? [])[0]!;
    expect(adj).toMatchObject({ nombre: 'pantalla.png', tipo: 'image/png' });
    expect(adj.url).toMatch(/^https:\/\/divoox\.test\/datos\/adjuntos\/[^?]+\?exp=\d+&firma=/);
    // Con la firma se ve; sin ella o alterada, no.
    const ruta = adj.url.replace('https://divoox.test', '');
    const ok = await m.crudo(ruta, {});
    expect(ok.status).toBe(200);
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(PNG);
    expect((await m.crudo(ruta.split('?')[0]!, {})).status).toBe(403);
    // La firma alterada SIEMPRE cambia (antes se ponía una «Z» fija y, si ya empezaba por «Z», no
    // cambiaba nada: la prueba fallaba una de cada 64 veces).
    const alterada = ruta.replace(/firma=(.)/, (_, c: string) => `firma=${c === 'A' ? 'B' : 'A'}`);
    expect(alterada).not.toBe(ruta);
    expect((await m.crudo(alterada, {})).status).toBe(403);
  });

  it('rechaza lo que no es imagen, más de 10 MB y más de 3 por mensaje', async () => {
    const { m, t, subir } = await escenario();
    expect(
      (await subir(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), 'image/png')).status,
    ).toBe(415);
    expect((await subir(new Uint8Array(10 * 1024 * 1024 + 1).fill(0x89))).status).toBe(413);
    const ids: string[] = [];
    for (let i = 0; i < 4; i++)
      ids.push(((await (await subir(PNG)).json()) as { adjunto: { id: string } }).adjunto.id);
    const r = await m.llamar('POST', `/datos/tickets/${t.codigo}/mensajes`, {
      texto: 'Muchas',
      adjuntos: ids,
    });
    expect(r.estado).toBe(400);
  });

  it('acepta HEIC del iPhone', async () => {
    const { subir } = await escenario();
    const heic = new Uint8Array([
      0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0,
    ]);
    expect((await subir(heic, 'image/heic')).status).toBe(201);
  });
});
