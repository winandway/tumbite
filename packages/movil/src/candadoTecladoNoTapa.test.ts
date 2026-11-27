import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-TECLADO-NO-TAPA (27 nov 2026, Richard en su Android creando su cuenta de conductor: «el teclado
 * tapa lo que escribo»). La casilla activa SIEMPRE queda visible arriba del teclado; lo demás puede
 * quedar detrás.
 *
 * Causa real: desde Expo 57 Android dibuja la app de borde a borde y «resize» (el modo de siempre) ya
 * no achica la ventana al salir el teclado; y `automaticallyAdjustKeyboardInsets` solo actúa en iOS.
 * Arreglo de raíz: Android con `softwareKeyboardLayoutMode: "pan"` (el sistema sube la ventana hasta
 * la casilla con foco) en las tres apps, y en iOS cada desplazamiento con casillas lleva
 * `automaticallyAdjustKeyboardInsets`. Rojo comprobado el 27 nov 2026 sin «pan» y con un
 * desplazamiento de formulario sin el ajuste.
 */
const raiz = join(import.meta.dirname, '..', '..', '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8');

function archivos(dir: string): string[] {
  return readdirSync(join(raiz, dir)).flatMap((n) => {
    const r = join(dir, n);
    if (n === 'node_modules') return [];
    if (statSync(join(raiz, r)).isDirectory()) return archivos(r);
    return /\.tsx$/.test(n) && !/\.test\./.test(n) ? [r] : [];
  });
}

/** Las etiquetas `<ScrollView …>` de un archivo (hasta su `>`, saltando lo que va entre llaves). */
function etiquetasScroll(texto: string): string[] {
  const salida: string[] = [];
  for (const m of texto.matchAll(/<ScrollView\b/g)) {
    let j = (m.index ?? 0) + m[0].length;
    // `useRef<ScrollView>(null)` es un tipo, no una pantalla.
    if (texto.startsWith('>(', j)) continue;
    let llaves = 0;
    for (; j < texto.length; j++) {
      const c = texto.charAt(j);
      if (c === '{') llaves++;
      else if (c === '}') llaves--;
      else if (c === '>' && llaves === 0) break;
    }
    salida.push(texto.slice(m.index ?? 0, j));
  }
  return salida;
}

describe('C-TECLADO-NO-TAPA', () => {
  it('Android: las tres apps suben la ventana hasta la casilla con foco («pan»)', () => {
    for (const app of ['cliente', 'repartidor', 'restaurante']) {
      const config = JSON.parse(leer(`apps/${app}/app.json`)) as {
        expo: { android: { softwareKeyboardLayoutMode?: string } };
      };
      expect(config.expo.android.softwareKeyboardLayoutMode, app).toBe('pan');
    }
  });

  it('iOS: todo desplazamiento de una pantalla con casillas se corre con el teclado', () => {
    const malos: string[] = [];
    for (const dir of [
      'apps/cliente/src',
      'apps/repartidor/src',
      'apps/restaurante/src',
      'packages/movil/src',
    ]) {
      for (const f of archivos(dir)) {
        const texto = leer(f);
        if (!/TextInput|<Campo|CampoClave|CampoDireccion|CampoFecha/.test(texto)) continue;
        for (const tag of etiquetasScroll(texto))
          if (!tag.includes('horizontal') && !tag.includes('automaticallyAdjustKeyboardInsets'))
            malos.push(f);
      }
    }
    expect(malos).toEqual([]);
  });
});
