import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardado = new Map<string, string>();
vi.mock('./llavero', () => ({
  llavero: {
    leer: async (k: string) => guardado.get(k) ?? null,
    guardar: async (k: string, v: string) => void guardado.set(k, v),
  },
}));

import { avisarPaso, olvidarPasosAvisados } from './rastroRegistro';

/**
 * C-RASTRO en las apps (22 nov 2026): los pasos de antes de crear la cuenta se avisan una sola vez por
 * aparato y por app; si el aviso falla, se reintenta la próxima vez; nunca viaja nada de la persona.
 */
describe('C-RASTRO · los pasos del registro que avisa la app', () => {
  beforeEach(() => {
    guardado.clear();
    olvidarPasosAvisados();
  });

  it('cada paso se avisa una sola vez, aunque la pantalla se abra muchas veces o la app se reinicie', async () => {
    const pasoRegistro = vi.fn(async () => ({ ok: true }));
    await avisarPaso({ pasoRegistro }, 'repartidor', 'abrio');
    await avisarPaso({ pasoRegistro }, 'repartidor', 'abrio');
    olvidarPasosAvisados(); // la app se cerró y se abrió: queda lo anotado en el teléfono
    await avisarPaso({ pasoRegistro }, 'repartidor', 'abrio');
    expect(pasoRegistro).toHaveBeenCalledTimes(1);
    expect(pasoRegistro).toHaveBeenCalledWith('repartidor', 'abrio');
    // Otro paso y la otra app cuentan aparte.
    await avisarPaso({ pasoRegistro }, 'repartidor', 'formulario');
    await avisarPaso({ pasoRegistro }, 'cliente', 'abrio');
    expect(pasoRegistro).toHaveBeenCalledTimes(3);
  });

  it('si el aviso falla (sin internet) no queda anotado: se intenta otra vez y no rompe la pantalla', async () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const pasoRegistro = vi
      .fn<(a: string, p: string) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('sin red'))
      .mockResolvedValue({ ok: true });
    await expect(avisarPaso({ pasoRegistro }, 'cliente', 'revisar')).resolves.toBeUndefined();
    expect(guardado.size).toBe(0);
    await avisarPaso({ pasoRegistro }, 'cliente', 'revisar');
    expect(pasoRegistro).toHaveBeenCalledTimes(2);
    expect(guardado.size).toBe(1);
    aviso.mockRestore();
  });
});
