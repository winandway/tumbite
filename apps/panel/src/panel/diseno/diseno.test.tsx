import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { HORAS_URGENTE, TONOS, horasDesde, tonoDeEstado } from './estados';
import { Insignia } from './Insignia';

/**
 * C-PANEL-DISENO (21 nov 2026, Gerencia): un solo sistema de diseño en todo el panel. Dos
 * tipografías con su escala, los colores de estado siempre iguales y la jerarquía de botones.
 */
const css = readFileSync(join(__dirname, 'diseno.css'), 'utf8');

describe('C-PANEL-DISENO · colores de estado', () => {
  it('cada estado cae siempre en el mismo tono', () => {
    for (const e of ['aprobado', 'activa', 'vigente', 'entregado', 'pagado', 'completada'])
      expect(tonoDeEstado(e), e).toBe('hecho');
    for (const e of ['pendiente', 'en_plazo', 'por_vencer', 'programado', 'abierto', 'enviado'])
      expect(tonoDeEstado(e), e).toBe('pendiente');
    for (const e of ['rechazado', 'vencido', 'fallida', 'cancelado', 'urgente', 'rebote'])
      expect(tonoDeEstado(e), e).toBe('problema');
    for (const e of ['apagada', 'pausado', 'sin_datos', 'sin_plazo', 'desconectado', 'sin_ia'])
      expect(tonoDeEstado(e), e).toBe('apagado');
  });

  it('acepta mayúsculas, acentos y espacios, y lo desconocido va en gris, nunca en rojo', () => {
    expect(tonoDeEstado('Aprobado')).toBe('hecho');
    expect(tonoDeEstado('por vencer')).toBe('pendiente');
    expect(tonoDeEstado('algo-nuevo')).toBe('apagado');
    expect(tonoDeEstado(null)).toBe('apagado');
  });

  it('la insignia pinta el tono del estado y lleva su punto', () => {
    render(<Insignia estado="vencido">Vencido</Insignia>);
    const i = screen.getByText('Vencido');
    expect(i).toHaveClass('insignia', 'insignia-problema');
    expect(i).toHaveAttribute('data-tono', 'problema');
    expect(i.querySelector('.insignia-punto')).not.toBeNull();
  });

  it('cada tono tiene su letra, su fondo y su punto, y las clases de antes pintan igual', () => {
    for (const t of TONOS) {
      expect(css).toContain(`--pd-${t}:`);
      expect(css).toContain(`--pd-${t}-fondo:`);
      expect(css).toContain(`.pd .insignia-${t}`);
    }
    expect(css).toMatch(/\.pd \.insignia-hecho,\s*\.pd \.insignia-aprobado/);
    expect(css).toMatch(/\.pd \.insignia-problema,\s*\.pd \.insignia-rechazado/);
    // Pausado o apagado ya no es rojo: es gris.
    expect(css).toMatch(/\.pd \.insignia-apagado,\s*\.pd \.insignia-pausado/);
  });

  it('ninguna pantalla inventa un color de estado: solo las clases del sistema', () => {
    const permitidas = new Set([
      ...TONOS,
      'aprobado',
      'rechazado',
      'pausado',
      'pendiente',
      'prueba',
      'programado',
      'punto',
    ]);
    const raiz = join(__dirname, '..', '..');
    const archivos = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        const r = join(d, n);
        if (statSync(r).isDirectory()) return archivos(r);
        return /\.tsx$/.test(n) && !n.includes('.test.') ? [r] : [];
      });
    const malas = archivos(raiz).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(/insignia-([a-z_]+)/g)]
        .map((m) => m[1]!)
        .filter((c) => !permitidas.has(c))
        .map((c) => `${f}: insignia-${c}`),
    );
    expect(malas).toEqual([]);
  });

  it('lo que espera más de un día pasa a rojo (igual que el menú)', () => {
    const ahora = Date.parse('2026-11-21T12:00:00Z');
    expect(horasDesde('2026-11-21 09:00:00', ahora)).toBe(3);
    expect(horasDesde('2026-11-20 10:00:00', ahora)).toBeGreaterThanOrEqual(HORAS_URGENTE);
    expect(horasDesde('no es fecha', ahora)).toBe(0);
  });
});

describe('C-PANEL-DISENO · tipografía y botones', () => {
  it('dos tipografías con su escala: Poppins para títulos y botones, Montserrat para el texto', () => {
    expect(css).toMatch(/--pd-fuente-titulo: 'Poppins'/);
    expect(css).toMatch(/--pd-fuente-texto: 'Montserrat'/);
    for (const v of ['--pd-t1', '--pd-t2', '--pd-t3', '--pd-texto', '--pd-texto-chico'])
      expect(css).toContain(`${v}:`);
  });

  it('jerarquía de botones: principal, de borde y de texto; la hoja se carga después y manda', () => {
    expect(css).toContain('.boton.terciario');
    expect(css).toContain('.boton.chico');
    const armazon = readFileSync(join(__dirname, '..', 'armazon', 'Armazon.tsx'), 'utf8');
    expect(armazon.indexOf("'../diseno/diseno.css'")).toBeGreaterThan(
      armazon.indexOf("'./armazon.css'"),
    );
  });

  it('en Zonas la acción de cada fila no es el botón principal (uno por pantalla)', () => {
    for (const f of ['CiudadesWeb.tsx', 'ResponsableZona.tsx', 'AdminZonas.tsx']) {
      const src = readFileSync(join(__dirname, '..', f), 'utf8');
      expect(src, f).not.toMatch(/'boton secundario' : 'boton'|: 'boton'\}/);
    }
    expect(readFileSync(join(__dirname, '..', 'ResponsableZona.tsx'), 'utf8')).toContain(
      'className="boton secundario chico"',
    );
  });
});
