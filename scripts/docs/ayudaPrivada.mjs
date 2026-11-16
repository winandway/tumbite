// C-AYUDA-INTERNA (16 nov 2026, Richard): las capturas del panel de operaciones (el superadmin) NO van
// al repositorio (es público) ni a apps/panel/public. Se guardan en esta carpeta privada de la
// computadora y se suben al almacén del sitio con `node scripts/docs/subir-ayuda-interna.mjs`.
import { homedir } from 'node:os';
import { join } from 'node:path';

export const AYUDA_PRIVADA = join(homedir(), 'Divoox-privado', 'ayuda-interna');
/** Las originales (PNG) de cada guion de capturas del superadmin. */
export const ORIGINALES_PRIVADAS = join(AYUDA_PRIVADA, 'originales');
/** Las WebP que se suben al almacén (`ayuda-interna/<archivo>`). */
export const CAPTURAS_PRIVADAS = join(AYUDA_PRIVADA, 'capturas');
