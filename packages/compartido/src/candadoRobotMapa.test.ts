import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// C-ROBOT-MAPA-CON-MOSAICOS (18 nov 2026) — todos los países. El candado de los robots de capturas:
// una pantalla con mapa no se da por buena si el mapa salió liso o gris. Muestras reales recortadas
// (sin nombres de ciudad): una del punto exacto sin mosaicos y otra con el mapa cargado.
const RAIZ = join(__dirname, '..', '..', '..');
const GUION = join(RAIZ, 'scripts', 'robot', 'mapa-con-mosaicos.mjs');
const MUESTRAS = join(RAIZ, 'scripts', 'robot', 'muestras');

const correr = (archivo: string, zona: string) =>
  spawnSync(process.execPath, [GUION, join(MUESTRAS, archivo), zona], { encoding: 'utf8' });

describe('C-ROBOT-MAPA-CON-MOSAICOS: el robot falla si el mapa está liso', () => {
  it('un mapa liso (gris, sin calles) sale con error y lo dice en palabras', () => {
    const r = correr('mapa-liso.png', '0,0,540,520');
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/El mapa está liso o gris/);
  });

  it('un mapa con mosaicos pasa', () => {
    const r = correr('mapa-con-mosaicos.png', '0,0,540,760');
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Mapa con mosaicos/);
  });

  it('sin zona o con una zona mal escrita no da un «bien» a ciegas', () => {
    expect(correr('mapa-con-mosaicos.png', '').status).toBe(2);
    expect(correr('mapa-con-mosaicos.png', '0,0,ancho,alto').status).toBe(2);
  });
});
