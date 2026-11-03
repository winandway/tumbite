import { describe, expect, it } from 'vitest';
import { mundo } from '../pruebas/ayuda';

/**
 * BRF-1 (2 nov 2026, C-OCUPADO-VISIBLE): en el sitio de pruebas un pedido a domicilio en Novi no le
 * llegó como oferta al repartidor demo porque tenía una ruta de paquetes de Divoox Flex «en curso»
 * desde el 31 oct. Eso es correcto (C-FLEX-OCUPACION: una ruta ocupa al conductor como una sola
 * operación), pero nadie lo veía: la app decía «Buscando pedidos cerca de ti…» si la ruta estaba
 * aceptada o cargando, y el servidor no decía que el conductor estaba ocupado. Ahora el estado del
 * repartidor dice en qué está ocupado, para que la app lo muestre en vez de «Buscando pedidos».
 */
describe('BRF-1 · el repartidor ocupado en otra operación lo sabe (C-OCUPADO-VISIBLE)', () => {
  it('con una ruta Flex activa, el estado dice «ruta_flex» y al terminarla vuelve a null', async () => {
    const m = mundo();
    const rep = await m.cuenta('repartidor', 'Rubén Ruta');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.77, lng: -80.19 },
      rep.token,
    );
    const libre = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(libre.estado).toBe(200);
    expect(libre.datos.ocupadoEn).toBeNull();

    await m.DB.prepare(
      "INSERT INTO empresas (id, nombre, pais, moneda, dueno_id) VALUES ('emp-brf1', 'Logística', 'US', 'USD', ?)",
    )
      .bind(rep.id)
      .run();
    await m.DB.prepare(
      "INSERT INTO rutas_flex (id, empresa_id, nombre, estado) VALUES ('ruta-brf1', 'emp-brf1', 'Ruta de prueba', 'borrador')",
    ).run();
    // El disparador de la base ocupa al conductor al pasar la ruta a «aceptada».
    await m.DB.prepare(
      "UPDATE rutas_flex SET estado = 'ofrecida', conductor_id = ? WHERE id = 'ruta-brf1'",
    )
      .bind(rep.id)
      .run();
    await m.DB.prepare("UPDATE rutas_flex SET estado = 'aceptada' WHERE id = 'ruta-brf1'").run();

    const ocupado = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(ocupado.datos.ocupadoEn).toBe('ruta_flex');

    // Y al terminar la ruta vuelve a estar libre.
    await m.DB.prepare("UPDATE rutas_flex SET estado = 'cancelada' WHERE id = 'ruta-brf1'").run();
    const otraVez = await m.llamar('GET', '/datos/repartidor/estado', undefined, rep.token);
    expect(otraVez.datos.ocupadoEn).toBeNull();
  });
});
