import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { rutaAlAbrir } from './volverAlViaje';

/**
 * C-VOLVER-AL-VIAJE (17 nov 2026, borrador aprobado): si la app se cierra con un viaje en curso, al
 * abrirla vuelve al viaje y no al inicio (como Uber y DiDi).
 */
const v = (estado: string, servicio = 'moto') => ({ id: 'v1', estado, servicio });

describe('al abrir la app con un viaje en curso', () => {
  it('buscando, asignado, llegó o en curso: vuelve a la pantalla del viaje de su servicio', () => {
    for (const e of ['buscando', 'asignado', 'conductor_llego', 'en_curso'])
      expect(rutaAlAbrir([v(e)])).toEqual({ pathname: '/ride', params: { servicio: 'moto' } });
    expect(rutaAlAbrir([null, v('asignado', 'envios')])).toEqual({
      pathname: '/ride',
      params: { servicio: 'envios' },
    });
    expect(rutaAlAbrir([v('en_curso', 'carro')])?.params?.servicio).toBe('carro');
  });

  it('terminado, cancelado, sin conductor o sin viaje: se queda en el inicio', () => {
    for (const e of ['terminado', 'cancelado', 'sin_conductor', 'no_show', 'pago_pendiente'])
      expect(rutaAlAbrir([v(e)])).toBeNull();
    expect(rutaAlAbrir([null, null])).toBeNull();
  });

  it('el inicio pregunta por el viaje en curso al abrir y cambia de pantalla', () => {
    const inicio = readFileSync(join(__dirname, '..', 'Inicio.tsx'), 'utf8');
    expect(inicio).toContain('useVolverAlViaje(');
    const hook = readFileSync(join(__dirname, 'useVolverAlViaje.ts'), 'utf8');
    expect(hook).toContain("'/datos/viajes/actual'");
    expect(hook).toContain('/datos/viajes/actual?servicio=envios');
    expect(hook).toContain('router.push(ruta)');
  });
});
