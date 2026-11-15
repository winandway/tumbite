import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { crearAlmacenPruebas } from './pruebas/r2';

/**
 * C-BORRADO-DIRECCIONES (15 nov 2026) — todos los países. Al borrar la cuenta se van las
 * direcciones guardadas y las fotos de la puerta (filas y archivos). Antes `borrarCuenta` no
 * tocaba `direcciones_cliente`: la casa de la persona seguía en la base después de «borrar mi
 * cuenta», contra lo que prometen la política de privacidad y Apple 5.1.1(v).
 */
describe('borrar la cuenta borra las direcciones guardadas y las fotos de la puerta', () => {
  it('no queda ninguna dirección, ninguna fila de foto ni ningún archivo', async () => {
    const almacen = crearAlmacenPruebas();
    const m = mundo({ BUCKET: almacen.bucket });
    const cli = await m.cuenta('cliente');
    const otro = await m.cuenta('cliente');
    const guardar = (token: string, direccion: string) =>
      m.llamar(
        'POST',
        '/datos/mis-direcciones',
        { etiqueta: 'Casa', direccion, lat: 42.48, lng: -83.47, instrucciones: 'Portón gris' },
        token,
      );
    const mia = await guardar(cli.token, '100 Calle de Ejemplo, Novi, MI');
    const ajena = await guardar(otro.token, '200 Calle de Ejemplo, Novi, MI');
    expect(mia.estado).toBe(201);
    const subir = (token: string, id: string) =>
      m.foto(`/datos/mis-direcciones/${id}/fotos/1`, token);
    expect((await subir(cli.token, mia.datos.direccion.id)).estado).toBe(201);
    expect((await subir(otro.token, ajena.datos.direccion.id)).estado).toBe(201);
    expect(
      [...almacen.datos.keys()].filter((k) => k.startsWith(`puertas/${cli.id}/`)),
    ).toHaveLength(1);

    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, cli.token)).estado).toBe(200);

    const cuenta = async (sql: string) =>
      Number((await m.DB.prepare(sql).bind(cli.id).first<{ n: number }>())?.n);
    expect(await cuenta('SELECT COUNT(*) AS n FROM direcciones_cliente WHERE usuario_id = ?')).toBe(
      0,
    );
    const huerfanas = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM direcciones_fotos WHERE direccion_id = ?',
    )
      .bind(mia.datos.direccion.id)
      .first<{ n: number }>();
    expect(Number(huerfanas?.n)).toBe(0);
    expect(
      [...almacen.datos.keys()].filter((k) => k.startsWith(`puertas/${cli.id}/`)),
    ).toHaveLength(0);
    // Lo de otra persona no se toca.
    expect(
      [...almacen.datos.keys()].filter((k) => k.startsWith(`puertas/${otro.id}/`)),
    ).toHaveLength(1);
    const queda = await m.DB.prepare(
      'SELECT COUNT(*) AS n FROM direcciones_cliente WHERE usuario_id = ?',
    )
      .bind(otro.id)
      .first<{ n: number }>();
    expect(Number(queda?.n)).toBe(1);
  });
});
