import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Revisión de calidad del 18 nov (C-INICIO-NUEVO). Las pantallas de React Native no se pintan en
 * node: se revisa su código.
 */
const leer = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

describe('revisión del inicio nuevo', () => {
  it('borrar un lugar que falla dice «no se pudo borrar» y no deja la hoja muda', () => {
    const f = leer('viajes', 'LugaresFila.tsx');
    expect(f).not.toMatch(/void borrar\(\)\.then\(salir\)/);
    expect(f).toContain('t.noSeBorro');
    expect(leer('viajes', 'textosLugares.ts')).toMatch(/noSeBorro:/);
  });

  it('la portada se pide una sola vez, con la ciudad ya conocida', () => {
    const f = leer('Inicio.tsx');
    expect(f).toMatch(/if \(!servicios\) return;[\s\S]{0,400}rutaBanners\('cabecera'/);
  });

  it('la hoja se cierra con su botón propio y con el gesto de escape de VoiceOver', () => {
    const f = leer('inicio', 'HojaAbajo.tsx');
    expect(f).not.toContain('accessibilityLabel="Cerrar"');
    expect(f).toContain('onAccessibilityEscape={alCerrar}');
    expect(f).toMatch(/testID="hoja-cerrar"/);
    // El comportamiento (tocar «Cerrar Más servicios» cierra la hoja) lo prueba el recorrido en
    // e2e/recorrido/mas.spec.ts, en español y en inglés.
    expect(
      readFileSync(
        join(__dirname, '..', '..', '..', '..', 'e2e', 'recorrido', 'mas.spec.ts'),
        'utf8',
      ),
    ).toContain("en ? 'Close More services' : 'Cerrar Más servicios'");
  });

  it('volver al viaje se reintenta si no hubo red al abrir', () => {
    const f = leer('viajes', 'useVolverAlViaje.ts');
    expect(f).toMatch(/yaRevisado = false/);
    expect(f).toContain('setTimeout');
    // Segunda revisión: si el inicio se desmonta antes de la primera respuesta, se vuelve a revisar.
    expect(f).toMatch(/if \(!terminado\) yaRevisado = false/);
  });

  // C-PORTADA-FUNDIDA (18 nov 2026): la imagen del banner no es un cuadro pegado a la derecha: ocupa
  // la mitad derecha a sangre, de arriba abajo, y se desvanece hacia la izquierda en el degradado.
  it('la imagen de la portada va a sangre en la mitad derecha y se funde con el degradado', () => {
    const f = leer('inicio', 'PiezasInicio.tsx');
    expect(f).toContain('testID="portada-imagen"');
    expect(f).toMatch(/imagenPortada: \{ position: 'absolute', top: 0, right: 0, bottom: 0/);
    expect(f).toMatch(/LinearGradient id="fundido" x1="0" y1="0" x2="1" y2="0"/);
    expect(f).not.toMatch(/heroeFoto/);
  });
});
