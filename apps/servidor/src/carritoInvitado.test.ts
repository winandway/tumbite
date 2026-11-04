import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  LLAVE_CARRITO_INVITADO,
  carritoAlEntrar,
  llaveCarrito,
} from '../../cliente/src/carritoGuardado';

/**
 * C-CARRITO-INVITADO (4 nov 2026, Richard grabando el video para Apple): sin cuenta, el carrito vive
 * solo mientras la app está abierta; al cerrarla y abrirla, arranca vacío (no se guarda en el
 * teléfono y se borra lo que haya quedado). Al entrar o crear la cuenta, lo que eligió sin cuenta pasa
 * a su cuenta (antes se perdía: se leía el carrito vacío de la cuenta). Con cuenta, se guarda como
 * siempre. Todos los países.
 */
const vacio = { restauranteId: null as string | null, lineas: [] as { id: string }[] };
const conPlatos = { restauranteId: 'r1', lineas: [{ id: 'p1' }, { id: 'p2' }] };

describe('carrito sin cuenta', () => {
  it('sin cuenta no hay llave donde guardarlo; con cuenta, una por cuenta', () => {
    expect(llaveCarrito(null)).toBeNull();
    expect(llaveCarrito(undefined)).toBeNull();
    expect(llaveCarrito('u1')).toBe('tumbite.carrito.u1');
    expect(LLAVE_CARRITO_INVITADO).toBe('tumbite.carrito.anonimo');
  });

  it('al entrar, lo elegido sin cuenta pasa a la cuenta; si no eligió nada, queda el de su cuenta', () => {
    expect(carritoAlEntrar(conPlatos, null, vacio)).toBe(conPlatos);
    const guardado = { restauranteId: 'r9', lineas: [{ id: 'x' }] };
    expect(carritoAlEntrar(conPlatos, guardado, vacio)).toBe(conPlatos);
    expect(carritoAlEntrar(vacio, guardado, vacio)).toBe(guardado);
    expect(carritoAlEntrar(null, null, vacio)).toBe(vacio);
  });

  it('el carrito de la app usa estas reglas y borra el del invitado al abrir', () => {
    const c = readFileSync(join(__dirname, '..', '..', 'cliente', 'src', 'carrito.tsx'), 'utf8');
    expect(c).toMatch(/llaveCarrito\(usuario\?\.id\)/);
    expect(c).toMatch(/almacenTelefono\.borrar\(LLAVE_CARRITO_INVITADO\)/);
    expect(c).toMatch(/carritoAlEntrar\(/);
  });
});
