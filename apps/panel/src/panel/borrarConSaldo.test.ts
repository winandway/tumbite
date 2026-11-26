import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BORRAR_CUENTA } from '../sitio/legales';

/**
 * C-SALDO-CLIENTE (25 nov 2026): borrar la cuenta desde la web (divoox.com/delete-account →
 * Configuración) con Saldo Divoox: el aviso con el monto y la casilla, como en las apps. Nunca un
 * callejón sin salida.
 */
describe('C-SALDO-CLIENTE: borrar la cuenta en la web con Saldo Divoox', () => {
  it('Configuración avisa el monto y pide la casilla antes de borrar', () => {
    const s = readFileSync(join(__dirname, 'Configuracion.tsx'), 'utf8');
    expect(s).toContain('/datos/cuentas/yo/saldo-divoox');
    expect(s).toContain('data-testid="borrar-saldo-aviso"');
    expect(s).toContain('data-testid="borrar-saldo-acepto"');
    expect(s).toContain("'/datos/cuentas/yo?saldo=acepto'");
    expect(s).toMatch(/disabled=\{!aceptaSaldo\}/);
    // Si no se pudo leer el saldo, no se borra como si fuera 0 (C-VIGIA-SALDO-CIRCUITO, revisión).
    expect(s).not.toMatch(/saldo-divoox'\)\.catch\(\s*\(\) => \(\{ disponible: 0 \}\)/);
  });

  it('la página de borrar la cuenta lo dice en los dos idiomas', () => {
    expect(JSON.stringify(BORRAR_CUENTA.es)).toContain('Entiendo que pierdo mi Saldo Divoox');
    expect(JSON.stringify(BORRAR_CUENTA.en)).toContain('I understand I lose my Divoox Balance');
  });
});
