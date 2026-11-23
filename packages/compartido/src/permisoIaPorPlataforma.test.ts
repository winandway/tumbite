import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  esMarcaLineaIa,
  marcaLineaIa,
  modoPermisoIa,
  plataformaIa,
  textosLineaIa,
} from './permisoIaPorPlataforma';

/** C-CHAT-WEB-SIN-MURO (23 nov 2026, orden de Richard, decisión de Gerencia) — todos los países. */
describe('C-CHAT-WEB-SIN-MURO: una sola pieza decide por plataforma', () => {
  it('solo la web va sin muro; iPhone y Android siguen con el permiso explícito', () => {
    expect(modoPermisoIa('web')).toBe('linea');
    expect(modoPermisoIa('ios')).toBe('explicito');
    expect(modoPermisoIa('android')).toBe('explicito');
    expect(plataformaIa('android')).toBe('android');
    expect(plataformaIa('windows')).toBe('web');
  });

  it('la marca de la línea solo existe para la web', () => {
    expect(esMarcaLineaIa(marcaLineaIa('web'))).toBe(true);
    expect(esMarcaLineaIa('linea-2026-11-23/android')).toBe(false);
    expect(esMarcaLineaIa('linea-2026-11-23/ios')).toBe(false);
    expect(esMarcaLineaIa(undefined)).toBe(false);
  });

  it('la línea habla de privacidad y del proveedor, nunca de «soy una IA» ni de asistente virtual', () => {
    for (const idioma of ['es', 'en'] as const) {
      const t = textosLineaIa(idioma);
      expect(t.linea).toMatch(/Google \(Gemini\)/);
      expect(t.linea).not.toMatch(/soy una|I am an|I'm an|asistente virtual|virtual assistant/i);
      expect(t.linea.length).toBeLessThan(180);
    }
  });

  it('candado: las apps nativas y los papeles no usan la línea (siguen con su permiso)', () => {
    const raiz = join(__dirname, '..', '..', '..');
    for (const f of [
      'apps/repartidor/src/soporte/ChatSoporteApp.tsx',
      'apps/repartidor/src/papeles/AsistentePapeles.tsx',
      'apps/repartidor/src/papeles/AvisoIa.tsx',
      'apps/repartidor/src/Inicio.tsx',
    ])
      expect(readFileSync(join(raiz, f), 'utf8')).not.toMatch(/marcaLineaIa|textosLineaIa/);
  });
});
