import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-ZONA-CONDUCTOR-NUEVO (robot, 18 nov 2026): un conductor nuevo en El Vigía quedaba en Miami hasta
 * conectarse. Al abrir Driver, la ubicación del mapa fija su ciudad (el servidor decide si toca).
 */
describe('Driver manda su primera ubicación para fijar la ciudad', () => {
  it('una vez por sesión, y si cambió, vuelve a leer el panel', () => {
    const s = readFileSync(join(import.meta.dirname, 'Inicio.tsx'), 'utf8');
    expect(s).toMatch(/'\/datos\/conductor\/zona-por-ubicacion', aqui\)/);
    expect(s).toMatch(/zonaPedida\.current = true/);
    expect(s).toMatch(/if \(r\.cambio\) \{\s+void recargarPanel\(\);/);
  });

  // C-PAPELES-TRAS-CIUDAD (22 nov 2026): la cuenta nueva de Venezuela nacía «sin ciudad» y la app ya
  // había leído sus papeles como de Estados Unidos (formulario viejo, sin asistente ni plazo). Al
  // fijarse la ciudad por su ubicación tiene que volver a leerlos, sin esperar a que cierre la app.
  it('si la ciudad cambió, vuelve a leer también los papeles (asistente y plazo de su país)', () => {
    const s = readFileSync(join(import.meta.dirname, 'Inicio.tsx'), 'utf8');
    const bloque = s.slice(s.indexOf("'/datos/conductor/zona-por-ubicacion', aqui)"));
    expect(bloque.slice(0, 400)).toMatch(/if \(r\.cambio\) \{[^}]*void recargarPapeles\(\);/);
  });

  // C-ZONA-TRAS-PERMISO (ensayo general, 24 nov 2026): conductor nuevo en El Vigía quedó en «Miami»
  // tras registrarse: la lectura de la ubicación corrió antes del sí del teléfono y no se repitió.
  it('la primera ubicación se vuelve a leer al cerrar «Otorga permisos» y al volver la app al frente', () => {
    const s = readFileSync(join(import.meta.dirname, 'Inicio.tsx'), 'utf8');
    expect(s).toMatch(/\[estado\?\.conectado, aqui, permisosPorExplicar, vueltaUbicacion\]/);
    expect(s).toMatch(/if \(e === 'active'\) setVueltaUbicacion\(/);
  });
});
