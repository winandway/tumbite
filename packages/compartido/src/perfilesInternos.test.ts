import { describe, expect, it } from 'vitest';
import { permiteAccionInterna } from './perfilesInternos';

// C-ROLES-INTERNOS: cada perfil solo cambia lo suyo; todos pueden mirar.
describe('C-ROLES-INTERNOS', () => {
  it('total puede todo; lectura solo mira', () => {
    expect(permiteAccionInterna('total', 'POST', '/datos/admin/finanzas/politicas')).toBe(true);
    expect(permiteAccionInterna('lectura', 'GET', '/datos/admin/finanzas/politicas')).toBe(true);
    expect(permiteAccionInterna('lectura', 'POST', '/datos/admin/pedidos/x/cancelar')).toBe(false);
  });
  it('soporte cancela pedidos pero no toca dinero; finanzas al revés', () => {
    expect(permiteAccionInterna('soporte', 'POST', '/datos/admin/pedidos/x/cancelar')).toBe(true);
    expect(permiteAccionInterna('soporte', 'POST', '/datos/admin/finanzas/politicas')).toBe(false);
    expect(permiteAccionInterna('soporte', 'PUT', '/datos/admin/paises/US')).toBe(false);
    expect(permiteAccionInterna('finanzas', 'POST', '/datos/admin/finanzas/politicas')).toBe(true);
    expect(permiteAccionInterna('finanzas', 'PUT', '/datos/admin/paises/US')).toBe(true);
    expect(permiteAccionInterna('finanzas', 'POST', '/datos/admin/pedidos/x/cancelar')).toBe(false);
  });
  it('nadie salvo total cambia el equipo ni lo que no está en su lista', () => {
    expect(permiteAccionInterna('soporte', 'PUT', '/datos/admin/equipo/u1')).toBe(false);
    expect(permiteAccionInterna('finanzas', 'PUT', '/datos/admin/equipo/u1')).toBe(false);
    expect(permiteAccionInterna('soporte', 'PUT', '/datos/admin/zonas')).toBe(false);
  });
});
