import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validarRegistro } from '@tumbite/compartido';

/**
 * C-CASILLA-CON-SU-TIPO (27 nov 2026, Richard en su Android: escribió su correo en «Nombre y apellido»
 * del alta de conductor, tocó «Siguiente» y avanzó). Cada casilla de las apps dice su tipo de dato; de
 * ahí salen su teclado, su ícono, lo que no entra al escribir y el aviso debajo, con la MISMA regla que
 * el servidor (packages/compartido/src/casillas.ts).
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

describe('C-CASILLA-CON-SU-TIPO en las apps', () => {
  const ui = leer('packages/movil/src/ui.tsx');
  const acceso = leer('packages/movil/src/Acceso.tsx');
  const moto = leer('apps/repartidor/src/viajes/AltaPasajeros.tsx');
  const editar = leer('apps/repartidor/src/viajes/EditarVehiculo.tsx');

  it('la casilla única pone teclado, ícono, filtro y aviso desde la pieza de casillas', () => {
    expect(ui).toContain('tecladoDe(tipo)');
    expect(ui).toContain('alEscribir(tipo, x)');
    expect(ui).toMatch(/errorCasilla\(tipo, props\.value/);
    expect(ui).toContain('ICONO_CASILLA');
    expect(ui).toMatch(/celular: 'call-outline'/);
    expect(ui).toMatch(/correo: 'mail-outline'/);
  });

  it('el registro (cliente y Driver): nombre y apellido, correo y celular con su tipo', () => {
    expect(acceso).toMatch(/etiqueta=\{t\.nombre\}[\s\S]{0,200}tipo="nombreCompleto"/);
    expect(acceso).toMatch(/etiqueta=\{t\.correo\}\s*tipo="correo"/);
    expect(acceso).toMatch(/etiqueta=\{t\.telefono\}\s*tipo="celular"/);
    // «Siguiente» valida el paso con la regla compartida: con un error no avanza.
    expect(acceso).toMatch(/function validarPaso[\s\S]{0,600}validarRegistro\(/);
  });

  it('«Siguiente» con un correo en el nombre no avanza (la regla que usa la app)', () => {
    const fallos = validarRegistro(
      { nombre: 'richard@gmail.com', correo: '', telefono: '', clave: '' },
      'es',
      ['nombre'],
    );
    expect(fallos[0]?.mensaje).toBe('Escribe tu nombre como en tu cédula, sin números ni @.');
  });

  it('«Tu moto» y corregir el vehículo: casillas con nombre, placa y año con su tipo y su regla', () => {
    for (const pantalla of [moto, editar]) {
      expect(pantalla).toMatch(/tipo=\{campo === 'anio' \? 'anioVehiculo' : campo === 'placa'/);
      expect(pantalla).toContain('errorCasilla(');
      // Nunca un TextInput suelto sin nombre (Tucaní, 27 nov: «sin nombres en las casillas»).
      expect(pantalla).not.toMatch(/<TextInput\b/);
    }
  });
});
