import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candado C-SEMAFORO-PACIENCIA (13 oct 2026): el sitio de pruebas a veces tarda más de 12 minutos
 * en tomar una versión, y la publicación se frenaba sola. Ahora espera 25 minutos y a los 8 le da
 * un empujón a la rama de pruebas, en una carpeta aparte para no tocar lo que va a producción.
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...r), 'utf8');

describe('semáforo de la publicación', () => {
  const script = leer('scripts', 'semaforo.sh');
  const flujo = leer('.github', 'workflows', 'publicar.yml');
  it('espera hasta 25 minutos y da el empujón a los 8', () => {
    expect(script).toMatch(/SEMAFORO_INTENTOS:-100/);
    expect(script).toMatch(/SEMAFORO_EMPUJON:-32/);
    expect(script).toMatch(/commit -q --allow-empty/);
  });
  it('el empujón va en una carpeta aparte, nunca cambia la rama de trabajo', () => {
    expect(script).toMatch(/git worktree add/);
    expect(script).not.toMatch(/git checkout/);
  });
  it('dos publicaciones nunca corren a la vez', () => {
    expect(flujo).toMatch(/concurrency:\n\s+group: publicar\n\s+cancel-in-progress: false/);
  });
  it('la publicación le pasa la rama de pruebas y le da tiempo de sobra', () => {
    expect(flujo).toMatch(
      /semaforo\.sh "\$\{\{ vars\.URL_PRUEBAS \}\}" "\$\{VERSION:0:7\}" yapanel-pruebas/,
    );
    expect(flujo).toMatch(/yapanel-pruebas\n\s+timeout-minutes: 30/);
  });
});
