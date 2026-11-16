import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { crearAlmacenPruebas } from './pruebas/r2';

/**
 * C-BORRADO-CHAT (16 nov 2026) — todos los países. Al borrar la cuenta se borra lo que la persona
 * escribió y mandó en los chats (texto y fotos, de pedidos y de viajes) y el texto copiado en los
 * reportes que la nombran. Antes `borrarCuenta` no tocaba `mensajes_pedido` ni `mensajes_viaje`: el
 * texto y las fotos seguían guardados después de «borrar mi cuenta». Google Play (Account deletion:
 * «delete the user data associated with that app account») lo dio como NO APTO el 16 nov.
 */
describe('borrar la cuenta borra sus mensajes y fotos del chat', () => {
  it('no queda texto ni foto suya; lo de la otra persona no se toca', async () => {
    const almacen = crearAlmacenPruebas();
    const m = mundo({ BUCKET: almacen.bucket });
    const cli = await m.cuenta('cliente');
    const rep = await m.cuenta('repartidor');
    const sql = (s: string, ...v: unknown[]) =>
      m.DB.prepare(s)
        .bind(...v)
        .run();
    // Filas sueltas de chat (sin armar el pedido entero): solo importa de quién es cada mensaje.
    await sql('PRAGMA foreign_keys = OFF');
    await almacen.bucket.put('chat/ped-1/foto-cli', new Uint8Array([1, 2, 3]));
    await almacen.bucket.put('chat/ped-1/foto-rep', new Uint8Array([4, 5, 6]));
    await sql(
      "INSERT INTO mensajes_pedido (pedido_id, de_usuario_id, texto) VALUES ('ped-1', ?, 'Soy Ana, timbre 3B')",
      cli.id,
    );
    await sql(
      "INSERT INTO mensajes_pedido (pedido_id, de_usuario_id, texto, foto_clave) VALUES ('ped-1', ?, '', 'chat/ped-1/foto-cli')",
      cli.id,
    );
    await sql(
      "INSERT INTO mensajes_pedido (pedido_id, de_usuario_id, texto, foto_clave) VALUES ('ped-1', ?, 'Ya llegué', 'chat/ped-1/foto-rep')",
      rep.id,
    );
    await sql(
      "INSERT INTO mensajes_viaje (operacion_id, de_usuario_id, texto) VALUES ('op-1', ?, 'Estoy en la esquina')",
      cli.id,
    );
    await sql(
      "INSERT INTO reportes_contenido (id, tipo, ref, objeto, objeto_id, autor_id, reporta_id, motivo, nota, texto) VALUES ('r1', 'mensaje_pedido', '1', 'pedido', 'ped-1', ?, ?, 'ofensivo', 'nota', 'Soy Ana, timbre 3B')",
      cli.id,
      rep.id,
    );

    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, cli.token)).estado).toBe(200);

    const filas = async (s: string, ...v: unknown[]) =>
      (
        await m.DB.prepare(s)
          .bind(...v)
          .all<Record<string, unknown>>()
      ).results;
    const suyos = await filas(
      'SELECT texto, foto_clave FROM mensajes_pedido WHERE de_usuario_id = ?',
      cli.id,
    );
    expect(suyos.length).toBeGreaterThan(0);
    expect(suyos.every((f) => f.texto === '' && f.foto_clave === null)).toBe(true);
    const viaje = await filas('SELECT texto FROM mensajes_viaje WHERE de_usuario_id = ?', cli.id);
    expect(viaje.every((f) => f.texto === '')).toBe(true);
    expect(almacen.datos.has('chat/ped-1/foto-cli')).toBe(false);
    const reporte = await filas("SELECT texto FROM reportes_contenido WHERE id = 'r1'");
    expect(reporte[0]?.texto).toBe('');
    // Lo del repartidor sigue igual.
    const ajenos = await filas(
      'SELECT texto, foto_clave FROM mensajes_pedido WHERE de_usuario_id = ?',
      rep.id,
    );
    expect(ajenos[0]).toEqual({ texto: 'Ya llegué', foto_clave: 'chat/ped-1/foto-rep' });
    expect(almacen.datos.has('chat/ped-1/foto-rep')).toBe(true);
  });
});
