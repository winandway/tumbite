import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-CORREO-SIN-AUTOCORRECTOR (31 oct 2026): en el iPhone la casilla de correo corregía y subrayaba lo
 * escrito. La pieza `Campo` apaga el corrector en toda casilla de correo de las tres apps.
 */
const ui = readFileSync(join(__dirname, '..', '..', 'movil', 'src', 'ui.tsx'), 'utf8');

describe('casilla de correo en las apps', () => {
  it('sin corrector ni subrayado, con tipo de contenido de correo', () => {
    const campo = ui.slice(ui.indexOf('export function Campo('), ui.indexOf('function Ojo('));
    expect(campo).toContain("props.keyboardType === 'email-address'");
    expect(campo).toContain('autoCorrect: false');
    expect(campo).toContain('spellCheck: false');
    expect(campo).toContain("textContentType: 'emailAddress'");
  });
});
