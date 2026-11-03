import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PORTADA-CLIENTE (POR-1, 2 nov 2026): la portada de la app del cliente como DoorDash y Uber Eats.
 * Antes: ocho cuadros grandes de servicios con «Pronto» tapando media pantalla, un botón de idioma
 * rojo enorme, Comida con hamburguesa, restaurantes solo en un carrusel de tres y la portada
 * terminando en «Cerrar sesión». Este candado fija las piezas que lo arreglaron.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (...p: string[]) => readFileSync(join(raiz, ...p), 'utf8');
const CLIENTE = ['apps', 'cliente', 'src'];

describe('portada del cliente como los grandes', () => {
  const inicio = leer(...CLIENTE, 'Inicio.tsx');

  it('un solo scroll con el buscador y los filtros pegados arriba', () => {
    expect(inicio).toContain('stickyHeaderIndices={[0]}');
    expect(inicio).toMatch(/<Buscador[\s\S]*<Filtros/);
    expect(inicio).toContain('<ListaRestaurantes');
    expect(inicio).toContain('ti.masRapidos');
    expect(inicio).toContain('<Categorias');
  });

  it('«Entregar en» abre la casilla de dirección de siempre', () => {
    expect(leer(...CLIENTE, 'inicio', 'Cabecera.tsx')).toContain('t.entregarEn');
    expect(inicio).toContain('<ElegirDireccion');
    expect(leer(...CLIENTE, 'inicio', 'ElegirDireccion.tsx')).toContain('<CampoDireccion');
  });

  it('el idioma va chico, sobre fondo claro, sin la pastilla roja', () => {
    const cabecera = leer(...CLIENTE, 'inicio', 'Cabecera.tsx');
    expect(cabecera).toContain(
      '<SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} sobreClaro />',
    );
    expect(cabecera).not.toContain('backgroundColor: C.primario, borderRadius: 999');
  });

  it('en la portada solo salen los servicios disponibles y «Más»; nada de «Pronto»', () => {
    const servicios = leer(...CLIENTE, 'inicio', 'Servicios.tsx');
    // POR-3 (C-SOLO-LO-TERMINADO): el filtro «solo lo que abre» vive en `serviciosTerminados`
    // (compartido, con su prueba en servicios.test.ts); la portada tiene que usarlo.
    expect(servicios).toContain('serviciosTerminados(');
    expect(servicios).not.toContain('etiquetaServicio');
    expect(servicios).toContain('horizontal');
  });

  it('Comida va con pizza, nunca con hamburguesa', () => {
    expect(leer(...CLIENTE, 'inicio', 'recursos.ts')).toContain(
      "import servicioComida from '../../assets/inicio/servicio-comida-pizza.png'",
    );
    expect(leer(...CLIENTE, 'inicio', 'Ofertas.tsx')).not.toMatch(/hamburguesa/i);
  });

  it('«Cerrar sesión» vive en Mi cuenta, no en la portada', () => {
    expect(inicio).not.toContain('tm.salir');
    expect(inicio).not.toContain('<MenuCuenta');
    const cuenta = leer(...CLIENTE, 'app', 'account.tsx');
    expect(cuenta).toContain('<Boton texto={tm.salir} alTocar={() => void salir()} secundario />');
    expect(cuenta).toContain('<MenuCuenta />');
  });
});
