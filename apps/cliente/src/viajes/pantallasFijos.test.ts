import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candados C-VIAJES-FIJOS y C-CONDUCTOR-CONFIANZA de las pantallas del cliente (16 nov 2026). Las
 * pantallas de React Native no se pintan en node: se revisa su código, como el candado de diseño.
 */
const leer = (n: string) => readFileSync(join(__dirname, n), 'utf8');
const app = (n: string) => readFileSync(join(__dirname, '..', 'app', n), 'utf8');

/** El cuerpo de una función del archivo, desde su declaración hasta la siguiente de primer nivel. */
function funcion(codigo: string, nombre: string): string {
  const desde = codigo.indexOf(`function ${nombre}(`);
  expect(desde, `falta la función ${nombre}`).toBeGreaterThan(-1);
  const resto = codigo.slice(desde + 1);
  const hasta = resto.search(/\n(\/\*\*|(export )?function )/);
  return hasta === -1 ? resto : resto.slice(0, hasta);
}

describe('formulario del viaje fijo', () => {
  const f = leer('FormularioViajeFijo.tsx');
  it('guarda lo escrito con la pieza de borrador y avisa al recuperarlo', () => {
    expect(f).toContain('useBorrador');
    expect(f).toContain('<AvisoBorrador');
    expect(f).toContain('b.limpiar()');
  });
  it('el PIN del menor nunca va al borrador', () => {
    expect(f).toMatch(/sensibles:\s*SENSIBLES_RUTINA/);
  });
  it('las direcciones van siempre con sugerencias reales (C-DIRECCION-SUGERENCIAS)', () => {
    expect(f.match(/<CampoDireccion/g)?.length).toBe(2);
    expect(f).not.toMatch(/etiqueta=\{t\.(origen|destino)\}[^>]*\n?\s*<TextInput/);
  });
  it('lo escrito solo se borra después de que el servidor confirmó', () => {
    const g = f.slice(f.indexOf('async function guardar'));
    expect(g.indexOf("api.pedir(id ? 'PUT'")).toBeLessThan(g.indexOf('b.limpiar()'));
  });
});

describe('borrar y quitar van dentro de los tres puntos, con confirmación', () => {
  it('viajes fijos: la tarjeta no tiene borrar; el menú sí, y pide confirmar', () => {
    const v = leer('ViajesFijos.tsx');
    expect(funcion(v, 'TarjetaFijo')).not.toContain('accBorrar');
    expect(v).toContain("setHoja('borrar')");
    expect(v).toContain('t.siBorrar');
  });
  it('conductores de confianza: quitar solo en el menú, y pide confirmar', () => {
    const c = leer('ConductoresConfianza.tsx');
    expect(funcion(c, 'TarjetaConductor')).not.toContain('t.quitar');
    expect(c).toContain('t.siQuitar');
  });
});

describe('Mis viajes no cambia su tarjeta', () => {
  it('la acción de confianza va en los tres puntos, no en la tarjeta', () => {
    const m = leer('MisViajes.tsx');
    expect(funcion(m, 'TarjetaViaje')).not.toMatch(/confianza/i);
    expect(funcion(m, 'OpcionesViaje')).toContain('marcarConfianza');
  });
});

describe('se encuentran', () => {
  it('desde la cuenta y desde «Más servicios» del inicio (C-INICIO-NUEVO)', () => {
    for (const codigo of [
      app('account.tsx'),
      readFileSync(join(__dirname, '..', 'Inicio.tsx'), 'utf8'),
    ]) {
      expect(codigo).toContain("'/fixed-rides'");
      expect(codigo).toContain("'/trusted-drivers'");
    }
  });
  it('al pedir se puede elegir a quién primero', () => {
    const p = leer('PedirMoto.tsx');
    expect(p).toContain('<PedirPrimeroA');
    expect(p).toContain('confianza: v.confianza');
  });
});
