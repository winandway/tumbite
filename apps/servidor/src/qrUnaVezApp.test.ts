import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const raiz = join(__dirname, '..', '..', '..');

// C-QR-UNA-VEZ (11 nov 2026): la cámara dispara `onBarcodeScanned` varias veces seguidas; la app
// del repartidor verifica el código una sola vez por apertura del escáner.
describe('app del repartidor: el QR del restaurante se lee una sola vez (C-QR-UNA-VEZ)', () => {
  it('onBarcodeScanned tiene una guarda de un solo disparo que se rearma al abrir el escáner', () => {
    const src = readFileSync(join(raiz, 'apps/repartidor/src/Inicio.tsx'), 'utf8');
    const i = src.indexOf('onBarcodeScanned=');
    expect(i).toBeGreaterThan(0);
    const manejador = src.slice(i, i + 400);
    expect(manejador).toMatch(/if \(qrLeido\.current\) return;\s*qrLeido\.current = true;/);
    expect(src).toMatch(/qrLeido\.current = false;\s*setEscaneando\(true\)/);
  });
});
