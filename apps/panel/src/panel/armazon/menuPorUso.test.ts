import { describe, expect, it } from 'vitest';
import { TEXTOS_PANEL } from '../textos';
import { gruposAdmin } from './menus';

/**
 * C-MENU-POR-USO (25 nov 2026, Richard: «todo lo que se usa del día a día debe estar allí… todo lo que
 * sea configuración, metido en configuración… Verificaciones debería estar abajo de Resumen») — todos
 * los países. Candado del menú del superadmin: Verificaciones justo debajo de Resumen; abrir países,
 * «Para aprobar» y la configuración al final; ningún botón de configuración se llama como una tarea.
 */
const menu = (idioma: 'es' | 'en') =>
  gruposAdmin(TEXTOS_PANEL[idioma], idioma, '/panel/control-x', '/panel/control-x', true);

describe('C-MENU-POR-USO: el menú del panel va por uso', () => {
  it('Resumen primero y Verificaciones justo debajo', () => {
    const [operacion] = menu('es');
    expect(operacion?.titulo).toBe('Operación');
    expect(operacion?.items.slice(0, 2).map((i) => i.clave)).toEqual(['inicio', 'verifications']);
  });

  it('lo del día arriba; Personas después; Sistema y configuración al final', () => {
    const grupos = menu('es');
    expect(grupos.map((g) => g.titulo)).toEqual([
      'Operación',
      'Personas',
      'Dinero',
      'Servicios',
      'Ventas y marketing',
      'Sistema y configuración',
      'Ajustes',
    ]);
    const operacion = grupos[0]?.items.map((i) => i.clave) ?? [];
    for (const diario of ['orders', 'tickets', 'camila']) expect(operacion).toContain(diario);
    const config = grupos.find((g) => g.titulo === 'Sistema y configuración')?.items ?? [];
    // Abrir países, la segunda firma y la configuración (franquicias, ciudades, zonas) viven al final.
    for (const clave of ['moto', 'approvals', 'configuration', 'franchises', 'cities', 'zones'])
      expect(config.map((i) => i.clave)).toContain(clave);
    for (const clave of ['moto', 'approvals', 'configuration'])
      expect(operacion).not.toContain(clave);
  });

  it('«Países y servicios» se llama por lo que hace, nunca como si aprobara algo', () => {
    for (const idioma of ['es', 'en'] as const) {
      const config = menu(idioma).at(-2)?.items ?? [];
      const paises = config.find((i) => i.clave === 'moto');
      expect(paises?.texto).toBe(idioma === 'es' ? 'Países y servicios' : 'Countries and services');
      // Solo «Para aprobar» habla de aprobar en la configuración: es la bandeja de la segunda firma.
      for (const i of config.filter((x) => x.clave !== 'approvals'))
        expect(i.texto).not.toMatch(/aprob|approv/i);
    }
  });
});
