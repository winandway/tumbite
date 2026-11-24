import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { hastaDeAvisos, marcarCampanaVista } from './campanaVista';

/**
 * C-CAMPANA-SE-VACIA (23 nov 2026, Richard): abrir la campana de las apps la deja en cero y lo guarda
 * en el servidor por cuenta, con UNA escritura como mucho (ninguna si no había nada nuevo).
 */
describe('C-CAMPANA-SE-VACIA · la campana de las apps', () => {
  const avisos = [
    { en: '2026-11-23 09:00:00', leido: true },
    { en: '2026-11-23 10:30:00', leido: false },
    { en: '2026-11-23 10:00:00', leido: false },
  ];

  it('al abrirla guarda «visto hasta» el más nuevo, una sola llamada', async () => {
    const pedir = vi.fn(async () => ({ ok: true }));
    expect(await marcarCampanaVista({ pedir } as never, 'cliente', avisos)).toBe(true);
    expect(pedir).toHaveBeenCalledTimes(1);
    expect(pedir).toHaveBeenCalledWith('POST', '/datos/campana/visto', {
      campana: 'cliente',
      hasta: '2026-11-23 10:30:00',
    });
  });

  it('sin nada nuevo (o con un servidor viejo sin «leido») no escribe nada', async () => {
    const pedir = vi.fn(async () => ({ ok: true }));
    await marcarCampanaVista(
      { pedir } as never,
      'repartidor',
      avisos.map((a) => ({ ...a, leido: true })),
    );
    await marcarCampanaVista({ pedir } as never, 'repartidor', [{ en: '2026-11-23 10:00:00' }]);
    await marcarCampanaVista({ pedir } as never, 'repartidor', []);
    expect(pedir).not.toHaveBeenCalled();
    expect(hastaDeAvisos([])).toBe('');
  });

  it('un fallo de red no rompe la pantalla', async () => {
    const pedir = vi.fn(async () => {
      throw new Error('sin red');
    });
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await marcarCampanaVista({ pedir } as never, 'cliente', avisos)).toBe(false);
    aviso.mockRestore();
  });

  it('candado: las dos apps usan la pieza al abrir la campana y su punto es lo NO leído', () => {
    const raiz = join(__dirname, '..', '..', '..', 'apps');
    const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');
    const cliente = leer('cliente/src/app/notifications.tsx');
    expect(cliente).toContain("marcarCampanaVista(api, 'cliente'");
    expect(leer('cliente/src/Inicio.tsx')).toMatch(/pendientes=\{avisos\?\.sinLeer \?\? 0\}/);
    expect(leer('repartidor/src/grandes/Avisos.tsx')).toContain(
      "marcarCampanaVista(api, 'repartidor'",
    );
    // El punto de la campana del conductor sale de lo no leído (no de tareas pendientes).
    expect(leer('repartidor/src/Inicio.tsx')).toMatch(/punto=\{campanaSinLeer > 0\}/);
  });
});
