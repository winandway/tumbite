import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * C-HOJAS-AREA-SEGURA (3 nov 2026, lo vio Richard grabando para Apple): en la hoja de un plato el
 * botón de volver quedaba debajo de la barra de estado del iPhone (la hora y «◀ TestFlight») y no se
 * podía tocar; había que cerrar la app (Apple lo rechaza por 2.1). Toda ventana de pantalla completa
 * de las tres apps abre como hoja («pageSheet», como las de Apple): empieza debajo de la barra de
 * estado y se cierra deslizando hacia abajo. Las transparentes (avisos al centro, la oferta de abajo)
 * no tapan la barra. Todos los países.
 */
const raiz = fileURLToPath(new URL('../../../', import.meta.url).href);
const archivos = execFileSync(
  'git',
  [
    'grep',
    '-l',
    '<Modal',
    '--',
    'apps/cliente/src',
    'apps/repartidor/src',
    'apps/restaurante/src',
    'packages/movil/src',
  ],
  { cwd: raiz, encoding: 'utf8' },
)
  .split('\n')
  .filter((f) => f && !f.includes('.test.'));

describe('C-HOJAS-AREA-SEGURA', () => {
  it.each(archivos)('%s: cada ventana de pantalla completa abre como hoja', (archivo) => {
    const texto = readFileSync(`${raiz}${archivo}`, 'utf8');
    const ventanas = texto
      .split('<Modal')
      .slice(1)
      .map((v) => v.slice(0, v.search(/>\s*\n/)));
    for (const v of ventanas)
      if (!/\btransparent\b/.test(v)) expect(v, archivo).toMatch(/presentationStyle="pageSheet"/);
  });
});
