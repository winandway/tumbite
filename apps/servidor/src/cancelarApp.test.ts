import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Candado C-MANAGER-1: la app del cliente ofrece cancelar mientras el restaurante no acepta. */
describe('cancelar desde la app del cliente', () => {
  const pantalla = readFileSync(
    join(__dirname, '..', '..', 'cliente', 'src', 'app', 'pedido', '[id].tsx'),
    'utf8',
  );
  it('llama a la ruta de cancelar y solo se ofrece antes de que acepten, con confirmación', () => {
    expect(pantalla).toContain('/cancelar`');
    expect(pantalla).toMatch(/p\.estado === 'pagado' \|\| p\.estado === 'pago_pendiente'/);
    expect(pantalla).toContain('siCancelar');
  });
});
