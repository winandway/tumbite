import { describe, expect, it } from 'vitest';
import { elegirServidor, entornoDeHost } from './entornos';

describe('C-ENTORNOS-SEPARADOS: cada app habla con su propio entorno', () => {
  it('en la web manda el sitio que sirvió la app, aunque se haya construido con otra dirección', () => {
    expect(elegirServidor('https://staging.tumbite.com', 'https://tumbite.com')).toBe(
      'https://staging.tumbite.com',
    );
    expect(elegirServidor('https://tumbite-pruebas.sitios.dev', 'https://tumbite.com')).toBe(
      'https://tumbite-pruebas.sitios.dev',
    );
    expect(elegirServidor('https://tumbite.com', 'https://staging.tumbite.com')).toBe(
      'https://tumbite.com',
    );
    expect(elegirServidor('http://localhost:8790', 'https://tumbite.com')).toBe(
      'http://localhost:8790',
    );
  });
  it('fuera de un sitio de Divoox (desarrollo con Expo) o en el celular, manda la variable', () => {
    expect(elegirServidor('http://192.168.0.9:8081', 'https://staging.tumbite.com')).toBe(
      'https://staging.tumbite.com',
    );
    expect(elegirServidor(null, 'https://staging.tumbite.com')).toBe('https://staging.tumbite.com');
    expect(elegirServidor(null, undefined)).toBe('https://tumbite.com');
  });
  it('reconoce los entornos por dominio', () => {
    expect(entornoDeHost('tumbite.com')).toBe('produccion');
    expect(entornoDeHost('staging.tumbite.com')).toBe('pruebas');
    expect(entornoDeHost('evil.tumbite.com.example')).toBeNull();
    expect(entornoDeHost('localhost:8790')).toBe('local');
  });
});
