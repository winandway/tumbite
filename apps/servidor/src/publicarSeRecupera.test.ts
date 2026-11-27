import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * C-PUBLICAR-SE-RECUPERA (3 nov 2026): «pruebas-rama» comparte la fila «publicar» y GitHub deja una
 * sola corrida esperando por fila; la que entra cancela a la que esperaba. Así producción se quedó
 * en be18d4f más de una hora (dos publicaciones de 7bc0bb9 canceladas sin correr). Candado: cada
 * «pruebas-rama» vuelve a llamar a «publicar» al terminar, y «publicar» acepta esa llamada a mano y
 * publica la última versión verificada de main. Todos los países.
 */
const leer = (f: string) =>
  readFileSync(
    fileURLToPath(new URL(`../../../.github/workflows/${f}`, import.meta.url).href),
    'utf8',
  );

describe('C-PUBLICAR-SE-RECUPERA', () => {
  it('«publicar» se puede llamar a mano y entonces toma la última versión verificada de main', () => {
    const y = leer('publicar.yml');
    expect(y).toMatch(/^\s+workflow_dispatch:/m);
    expect(y).toContain("github.event_name == 'workflow_dispatch'");
    expect(y).toContain('actions/workflows/verify.yml/runs?branch=main&status=success');
    expect(y).toContain('ref: ${{ needs.revisar.outputs.version }}');
  });
  it('«pruebas-rama» vuelve a llamar a «publicar» al terminar, pase o falle', () => {
    const y = leer('pruebas-rama.yml');
    // C-VISTA-PREVIA-RAMA: con la vista previa por rama encendida, este flujo (y su republicar) se apaga.
    expect(y).toMatch(
      /republicar:\n\s+needs: pruebas\n\s+if: \$\{\{ always\(\) && vars\.VISTA_PREVIA_POR_RAMA != 'si' \}\}/,
    );
    expect(y).toContain('gh workflow run publicar.yml');
    expect(y).toMatch(/permissions:\n\s+contents: write\n\s+actions: write/);
  });
});

/**
 * C-PUBLICAR-SIN-ESPERAR (27 nov 2026, emergencia de Tucaní): con cambios seguidos en main, «publicar»
 * se saltaba cada versión verificada porque ya había otra más nueva verificándose, y producción quedó
 * horas en la misma versión (el arreglo del registro de conductores esperó por eso). Ahora publica la
 * verificada más nueva que producción, nunca una en rojo y nunca una más vieja que la que ya sirve.
 */
describe('C-PUBLICAR-SIN-ESPERAR', () => {
  const y = leer('publicar.yml');
  it('publica la versión verificada si trae todo lo de producción y más, aunque main vaya adelante', () => {
    expect(y).toContain('https://divoox.com/datos/version');
    expect(y).toContain('compare/${PROD}...${VERSION}');
    expect(y).toMatch(/if \[ "\$ESTADO" = "ahead" \]; then echo "ultima=true"/);
  });
  it('nunca una en rojo: solo corre con la verificación en verde o a mano con la última verde', () => {
    expect(y).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(y).toContain('verify.yml/runs?branch=main&status=success');
  });
  it('sin poder leer producción, solo la punta de main (la regla de antes)', () => {
    expect(y).toMatch(/"\$ESTADO" = "desconocido" \] && \{ \[ "\$PUNTA" = "\$VERSION" \]/);
  });
});
