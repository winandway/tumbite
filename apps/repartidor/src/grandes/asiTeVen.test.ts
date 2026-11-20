import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PERFIL-CONDUCTOR (20 nov 2026, todos los países): «Así te ven los pasajeros» en Driver y la
 * tarjeta del conductor en el viaje del pasajero. Las dos pantallas dibujan la MISMA pieza
 * (PerfilConductor), que solo dibuja lo que decide vistaPerfilConductor; el formulario no pierde lo
 * escrito; el pasajero nunca ve las invitaciones del conductor.
 */
const RAIZ = join(import.meta.dirname, '..', '..', '..', '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

describe('C-PERFIL-CONDUCTOR · pantallas', () => {
  const driver = leer('apps/repartidor/src/grandes/AsiTeVen.tsx');
  const inicio = leer('apps/repartidor/src/Inicio.tsx');
  const pasajero = leer('apps/cliente/src/viajes/ViajeEnCurso.tsx');
  const pieza = leer('packages/movil/src/PerfilConductor.tsx');

  it('la pieza solo dibuja lo que decide la lógica compartida', () => {
    expect(pieza).toMatch(/vistaPerfilConductor\(perfil, \{ idioma, propio \}\)/);
    // Nada de cifras armadas a mano ni «0 viajes».
    expect(pieza).not.toMatch(/trayectoria\.viajes|toLocaleString/);
  });

  it('Driver: se entra desde el perfil, se ve como lo ve el pasajero y el formulario guarda lo escrito', () => {
    expect(inicio).toMatch(/setVista\('asiTeVen'\)/);
    expect(inicio).toMatch(/<AsiTeVen api=\{api\} idioma=\{idioma\} \/>/);
    expect(driver).toMatch(/<PerfilConductor[\s\S]*?propio\n/);
    expect(driver).toMatch(/useBorrador\(\{[\s\S]*?almacen: almacenTelefono/);
    expect(driver).toMatch(/'GET', '\/datos\/repartidor\/perfil'/);
    expect(driver).toMatch(/'PUT',\s*'\/datos\/repartidor\/perfil'/);
    expect(driver).toMatch(/testID="perfil-completar"/);
  });

  it('pasajero: la tarjeta del conductor se amplía (no se duplica) y nunca en modo propio', () => {
    expect(pasajero).toMatch(/\/datos\/viajes\/\$\{viajeId\}\/conductor\/perfil/);
    expect(pasajero).toMatch(/<PerfilConductor[\s\S]*?propio=\{false\}/);
    expect(pasajero.match(/<PerfilConductor\b/g)).toHaveLength(1);
    // Un solo bloque con testID="viaje-conductor" visible a la vez (perfil o lo básico mientras llega).
    expect(pasajero).toMatch(
      /viaje\.conductor && perfilConductor \? \([\s\S]*?\) : viaje\.conductor \?/,
    );
  });
});
