import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';

/**
 * C-BORRADO-VEHICULO (20 oct 2026): al borrar la cuenta, los documentos del vehículo (registro,
 * seguro, fotos de la placa) salen del almacén igual que las fotos de identidad. Antes solo se
 * borraba la carpeta de identidad y los documentos del vehículo quedaban guardados para siempre.
 */
describe('borrar la cuenta borra los documentos del vehículo (C-BORRADO-VEHICULO)', () => {
  it('quita los archivos del almacén y deja la fila sin archivo', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor', 'Luis Prueba');
    const almacen = (m.extra as { BUCKET: R2Bucket }).BUCKET;
    await m.DB.prepare(
      "INSERT INTO vehiculos (id, conductor_id, tipo) VALUES ('v1', ?, 'bicicleta')",
    )
      .bind(rep.id)
      .run();
    const clave = `vehiculos/${rep.id}/v1/doc1.pdf`;
    await almacen.put(clave, new Uint8Array([1, 2, 3]));
    await m.DB.prepare(
      "INSERT INTO vehiculo_documentos (id, vehiculo_id, tipo, clave) VALUES ('d1', 'v1', 'seguro', ?)",
    )
      .bind(clave)
      .run();
    // Un archivo de otra persona no se toca.
    await almacen.put('vehiculos/otra-persona/v9/doc.pdf', new Uint8Array([4]));

    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, rep.token)).estado).toBe(200);

    expect(await almacen.get(clave)).toBeNull();
    expect(await almacen.get('vehiculos/otra-persona/v9/doc.pdf')).not.toBeNull();
    const fila = await m.DB.prepare("SELECT clave FROM vehiculo_documentos WHERE id = 'd1'").first<{
      clave: string;
    }>();
    expect(fila?.clave).toBe('');
  });
});
