import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TEXTOS_VIAJE } from './textos';

/**
 * C-REGALO-VIAJE-REAL en el cierre de Driver (19 nov 2026) — todos los países. Cuando el servidor
 * deja el regalo de un viaje en revisión, el cierre «Viaje terminado» seguía diciendo en verde
 * «Divoox te paga X · va a tus ganancias al terminar», que en ese momento no es cierto. Ahora dice,
 * en color de aviso, que Divoox está revisando el regalo. En ROJO antes del cambio: no existían el
 * dato en la respuesta del cierre, la rama ni los textos.
 */
describe('C-REGALO-VIAJE-REAL · el cierre no promete en verde un regalo que está en revisión', () => {
  const v = readFileSync(join(import.meta.dirname, 'ViajeActivo.tsx'), 'utf8');
  it('la respuesta del cierre lleva «regaloEnRevision» y el cierre la mira', () => {
    expect(v).toMatch(/regaloEnRevision\?: boolean/);
    expect(v).toMatch(/const enRevision = respuesta\?\.regaloEnRevision === true/);
    expect(v).toMatch(/testID="viaje-regalo-en-revision"/);
  });
  it('en revisión no se usa el verde de éxito ni «Divoox te paga»', () => {
    const rama = v.slice(
      v.indexOf('testID="viaje-regalo-en-revision"'),
      v.indexOf('testID="viaje-divoox-paga"'),
    );
    expect(rama).toMatch(/t\.regaloEnRevision/);
    expect(rama).toMatch(/COLOR\.avisoSuave/);
    expect(rama).not.toMatch(/C\.exito|divooxPagaCorto/);
  });
  it('los textos existen en español y en inglés, sin prometer el pago', () => {
    expect(TEXTOS_VIAJE.es.activo.regaloEnRevision).toMatch(/revisando este regalo/);
    expect(TEXTOS_VIAJE.en.activo.regaloEnRevision).toMatch(/reviewing this gift/);
    for (const idioma of ['es', 'en'] as const)
      expect(TEXTOS_VIAJE[idioma].activo.regaloEnRevisionAyuda).not.toMatch(/ganancias|earnings/);
  });
});
