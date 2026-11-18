import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-ICONOS-SERVICIO (Richard, 18 nov 2026): «Moto con pasajero» llevaba el ícono de una bicicleta.
 * Cada servicio de Driver usa el mismo dibujo que la app del cliente, byte a byte, y las pantallas
 * del panel de servicios lo dibujan con IconoServicio (no con un glifo suelto).
 */
const raiz = join(import.meta.dirname, '..', '..', '..', '..');
const huella = (r: string) =>
  createHash('sha256')
    .update(readFileSync(join(raiz, r)))
    .digest('hex');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('los dibujos de los servicios son los del cliente', () => {
  for (const id of ['comida', 'moto', 'carro', 'envios', 'flex'])
    it(id, () => {
      expect(huella(`apps/repartidor/assets/servicios/${id}.webp`)).toBe(
        huella(`apps/cliente/assets/inicio-nuevo/${id}.webp`),
      );
    });
  it('el panel de servicios y «Agregar servicio» no dibujan un glifo (ni la bicicleta)', () => {
    for (const r of [
      'apps/repartidor/src/servicios/PanelServicios.tsx',
      'apps/repartidor/src/servicios/AgregarServicio.tsx',
    ]) {
      const s = leer(r);
      expect(s, r).not.toMatch(/<Icono nombre=\{iconoServicio/);
      expect(s, r).toMatch(/IconoServicio/);
    }
    expect(leer('apps/repartidor/src/servicios/logica.ts')).not.toMatch(/bicycle/);
  });
});

describe('C-TEXTO-ENTERO: la invitación de abajo no se corta', () => {
  it('«¿Una empresa o un restaurante te invitó? Pega su enlace» ocupa lo que haga falta', () => {
    const s = leer('apps/repartidor/src/flex/InvitacionesEmpresa.tsx');
    const i = s.indexOf('{t.tengoEnlace}');
    const antes = s.slice(i - 900, i);
    expect(antes).toContain('textBreakStrategy="simple"');
    expect(antes).not.toContain('numberOfLines');
    expect(antes).toContain('paddingBottom: 12');
  });
});
