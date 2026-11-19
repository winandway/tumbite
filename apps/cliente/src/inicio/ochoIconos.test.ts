import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { textosInicioNuevo } from './textosNuevo';

/**
 * C-OCHO-ICONOS-SIEMPRE (18 nov 2026, orden de Richard sobre el borrador aprobado) — todos los
 * países. El inicio pinta SIEMPRE los ocho servicios; el que no abre en la zona abre la hoja «aún no
 * hay» (no navega) y «Avísame cuando llegue» escribe solo al tocarlo. La lógica pura está probada en
 * packages/compartido/src/inicioNuevo.test.ts y la ruta en apps/servidor/src/avisameServicio.test.ts;
 * las pantallas de React Native no se pintan en node: aquí se revisa su código. Comprobado en ROJO
 * con el Inicio.tsx y el PiezasInicio.tsx anteriores.
 */
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

describe('C-OCHO-ICONOS-SIEMPRE · el inicio del cliente', () => {
  it('la cuadrícula recibe los ocho y tocar decide con accionDeServicio', () => {
    const f = leer('Inicio.tsx');
    expect(f).toContain('serviciosDelInicio(');
    expect(f).toMatch(/accionDeServicio\(s\.id, servicios\?\.servicios \?\? null\)/);
  });

  it('uno cerrado abre la hoja y NO navega; uno abierto navega como antes', () => {
    const f = leer('Inicio.tsx');
    const i = f.indexOf('const abrirServicio');
    const cuerpo = f.slice(i, f.indexOf('const avisarCuandoLlegue', i));
    const hoja = cuerpo.indexOf("accion.tipo === 'aun_no_hay'");
    expect(hoja).toBeGreaterThan(0);
    expect(cuerpo.slice(hoja, cuerpo.indexOf('\n', hoja))).toContain('return setAunNoHay(');
    expect(cuerpo.indexOf('router.push(accion.ruta')).toBeGreaterThan(hoja);
    expect(f).toMatch(/<HojaAunNoHay[\s\S]{0,200}avisar=\{avisarCuandoLlegue\}/);
  });

  it('«Avísame» escribe solo desde el botón de la hoja (mirar no llama a la ruta)', () => {
    const f = leer('Inicio.tsx');
    expect(f.match(/\/datos\/servicios\/avisame/g)).toHaveLength(1);
    expect(f).toMatch(/const avisarCuandoLlegue = \(servicio: string\) =>\s+api\.pedir\('POST'/);
    const p = leer('inicio', 'PiezasInicio.tsx');
    const i = p.indexOf('export function HojaAunNoHay');
    const hoja = p.slice(i, p.indexOf('export type ItemMas', i));
    // `avisar` se llama una sola vez, dentro de `tocar`, que es el onPress del botón.
    expect(hoja.match(/avisar\(/g)).toHaveLength(1);
    expect(hoja).toMatch(/const tocar = \(\) => \{[\s\S]*avisar\(servicio\)/);
    expect(hoja).toMatch(/onPress=\{tocar\}[\s\S]{0,200}testID="aun-no-hay-avisame"/);
    // Confirma en verde.
    expect(hoja).toMatch(/testID="aun-no-hay-listo"[\s\S]{0,300}COLOR\.exitoSuave/);
  });

  it('los ocho nombres en un renglón (el teléfono achica la letra; sin puntos suspensivos)', () => {
    const p = leer('inicio', 'PiezasInicio.tsx');
    const i = p.indexOf('style={p.servNombre}');
    const nombre = p.slice(i - 260, i);
    expect(nombre).toContain("numberOfLines={Platform.OS === 'web' ? 2 : 1}");
    expect(nombre).toContain('adjustsFontSizeToFit');
  });

  it('textos en español e inglés, sin «Pronto» sobre los íconos', () => {
    for (const idioma of ['es', 'en'] as const) {
      const t = textosInicioNuevo(idioma);
      for (const id of ['comida', 'mercado', 'farmacia', 'licores', 'carro', 'moto', 'envios'])
        expect(t.aunNoHay.nombres[id]).toBeTruthy();
      expect(t.aunNoHay.frase('X')).toContain('X');
      for (const v of [t.aunNoHay.avisame, t.aunNoHay.listo, t.aunNoHay.volver])
        expect(v).not.toMatch(/pronto|soon/i);
    }
    expect(textosInicioNuevo('es').aunNoHay.frase('Moto')).toBe(
      'En esta zona aún no hay Moto. Estamos llegando.',
    );
    expect(textosInicioNuevo('es').aunNoHay.avisame).toBe('Avísame cuando llegue');
    expect(textosInicioNuevo('es').aunNoHay.listo).toBe('Listo, te avisamos cuando llegue');
    const p = leer('inicio', 'PiezasInicio.tsx');
    const c = p.slice(
      p.indexOf('export function CuadriculaServicios'),
      p.indexOf('export function CarruselPromos'),
    );
    expect(c).not.toMatch(/[Pp]ronto|[Ss]oon/);
  });

  // Decisión de Gerencia (18 nov 2026): la 47 no puede depender del servidor ni guardar nada de
  // quien no tiene cuenta.
  it('«Avísame» solo con cuenta; sin cuenta ofrece crearla; con 404 el botón se retira sin error', () => {
    const p = leer('inicio', 'PiezasInicio.tsx');
    const i = p.indexOf('export function HojaAunNoHay');
    const hoja = p.slice(i, p.indexOf('export type ItemMas', i));
    expect(hoja).toMatch(/!conCuenta \? \([\s\S]{0,200}onPress=\{crearCuenta\}/);
    expect(hoja).toContain('testID="aun-no-hay-crear-cuenta"');
    expect(hoja).toMatch(/e\.estado === 404 \? 'sin_boton' : 'error'/);
    expect(hoja).toMatch(/paso === 'sin_boton' \? null/);
    expect(leer('Inicio.tsx')).toMatch(/conCuenta=\{Boolean\(usuario\)\}/);
    for (const idioma of ['es', 'en'] as const)
      expect(textosInicioNuevo(idioma).aunNoHay.crearCuenta.length).toBeGreaterThan(10);
    const ruta = readFileSync(
      join(__dirname, '..', '..', '..', 'servidor', 'src', 'rutas', 'avisameServicio.ts'),
      'utf8',
    );
    expect(ruta).not.toContain('huellaAparato');
  });
});
