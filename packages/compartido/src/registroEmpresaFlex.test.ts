import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGISTRO_EMPRESA_VACIO, cuerposRegistro, faltaEnRegistro } from './registroEmpresaFlex';

// C-FLEX-REGISTRO-UNICO: la web y la app piden lo mismo para registrar una empresa de logística.
const completo = {
  ...REGISTRO_EMPRESA_VACIO,
  nombre: 'Envíos Ejemplo',
  razonSocial: 'Envíos Ejemplo LLC',
  numeroFiscal: '12-3456789',
  direccionFiscal: '100 Main St, Miami, FL',
  representante: 'Ana Ejemplo',
  telefono: '+13055550100',
  centroNombre: 'Centro Miami',
  centroDireccion: '200 Main St, Miami, FL',
  centroLat: '25.77',
  centroLng: '-80.19',
  ciudad: 'Miami',
};

describe('registro único de empresa Flex', () => {
  it('pide todo, valida el número fiscal del país y el punto del centro', () => {
    expect(faltaEnRegistro(completo, true)).toBeNull();
    expect(faltaEnRegistro(completo, false)).toEqual({ motivo: 'falta' });
    expect(faltaEnRegistro({ ...completo, representante: ' ' }, true)).toEqual({ motivo: 'falta' });
    expect(faltaEnRegistro({ ...completo, numeroFiscal: '123' }, true)?.motivo).toBe('fiscal');
    expect(faltaEnRegistro({ ...completo, centroLat: '' }, true)).toEqual({ motivo: 'centro' });
    expect(cuerposRegistro(completo).centro).toMatchObject({
      lat: 25.77,
      zonaHoraria: 'America/New_York',
    });
  });
  it('la web y la app usan la misma pieza', () => {
    const raiz = join(__dirname, '..', '..', '..');
    const web = readFileSync(join(raiz, 'apps/panel/src/panel/flex/PanelEmpresa.tsx'), 'utf8');
    const app = readFileSync(join(raiz, 'apps/cliente/src/app/business.tsx'), 'utf8');
    for (const f of [web, app]) {
      expect(f).toContain('faltaEnRegistro(');
      expect(f).toContain('cuerposRegistro(');
    }
  });
});
