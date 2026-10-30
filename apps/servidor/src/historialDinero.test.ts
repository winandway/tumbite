import { describe, expect, it } from 'vitest';
import { CONFIG_DINERO_INICIAL } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';

/** C-HISTORIAL-DINERO (29 oct 2026): quién cambió la configuración de dinero, cuándo y qué. */
describe('historial de la configuración de dinero (C-HISTORIAL-DINERO)', () => {
  it('cada cambio de EE. UU. y de un país queda con su autor, el antes y el después; solo lo ve el equipo', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Finanzas');
    const cliente = await m.cuenta('cliente');
    const nueva = { ...CONFIG_DINERO_INICIAL, envioBase: CONFIG_DINERO_INICIAL.envioBase + 100 };
    expect((await m.llamar('PUT', '/datos/admin/config-dinero', nueva, admin.token)).estado).toBe(
      200,
    );
    expect(
      (await m.llamar('PUT', '/datos/admin/paises/CO', { efectivoActivo: false }, admin.token))
        .estado,
    ).toBe(200);
    const h = await m.llamar('GET', '/datos/admin/config-dinero/historial', undefined, admin.token);
    expect(h.estado).toBe(200);
    expect(h.datos.cambios).toHaveLength(2);
    const [pais, eeuu] = h.datos.cambios;
    expect(pais).toMatchObject({ donde: 'CO', quien: 'Soporte Finanzas' });
    expect(eeuu).toMatchObject({ donde: 'US', quien: 'Soporte Finanzas', campos: ['envioBase'] });
    expect(eeuu.antes.envioBase).toBe(CONFIG_DINERO_INICIAL.envioBase);
    expect(eeuu.despues.envioBase).toBe(CONFIG_DINERO_INICIAL.envioBase + 100);
    expect(
      (await m.llamar('GET', '/datos/admin/config-dinero/historial', undefined, cliente.token))
        .estado,
    ).toBe(403);
  });
});
