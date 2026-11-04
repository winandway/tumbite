import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { BannerCarretera } from './BannerCarretera';

/**
 * C-AVENIDA-DIVOOX (4 nov 2026, Richard): la flota real cruza la avenida en los dos sentidos, cada
 * vehículo con su foto (las de la derecha con el logo al derecho) y el texto fuera de la vía.
 */
describe('la avenida del banner', () => {
  it('seis vehículos de la flota, tres para cada lado, con su foto', () => {
    const { container } = render(<BannerCarretera lema="Coming soon to Miami" servicios="Food" />);
    const autos = [...container.querySelectorAll('.ld-carretera-via .ld-auto')];
    expect(autos).toHaveLength(6);
    expect(autos.filter((a) => a.classList.contains('ld-auto-izq'))).toHaveLength(3);
    expect(autos.filter((a) => a.classList.contains('ld-auto-der'))).toHaveLength(3);
    for (const a of autos) {
      const src = a.querySelector('img')?.getAttribute('src') ?? '';
      expect(existsSync(join(__dirname, '..', '..', 'public', src)), src).toBe(true);
    }
    // El texto no está dentro de la vía: ningún vehículo lo tapa.
    expect(container.querySelector('.ld-carretera-via .ld-carretera-lema')).toBeNull();
  });
});
