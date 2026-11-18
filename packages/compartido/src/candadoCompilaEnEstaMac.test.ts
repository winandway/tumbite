import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// C-COMPILA-EN-ESTA-MAC (18 nov 2026) — todos los países. Expo marcó 317 dólares en compilaciones
// en un período contra 45 incluidos. Toda compilación se hace en esta Mac; la nube de Expo solo con
// la bandera explícita `--nube`. La puerta única es `scripts/tiendas/guardia-nube.mjs`.
const RAIZ = join(__dirname, '..', '..', '..');
const GUIONES = join(RAIZ, 'scripts', 'tiendas');

interface Guardia {
  autorizarCompilacion(p: {
    donde: string;
    app: string;
    plataforma: string;
    perfil: string;
    argumentos?: string[];
    ahora?: Date;
  }): { local: number; nube: number; total: number };
  contarDelDia(ahora?: Date): { local: number; nube: number; total: number };
}
const cargar = async (): Promise<Guardia> => {
  const ruta = join(GUIONES, 'guardia-nube.mjs');
  return (await import(/* @vite-ignore */ ruta)) as Guardia;
};
const pedido = { app: 'cliente', plataforma: 'android', perfil: 'production' };
const dia = new Date(2026, 10, 18, 9, 0, 0);

describe('C-COMPILA-EN-ESTA-MAC', () => {
  const antes = process.env.DIVOOX_COMPILACIONES_DIR;
  beforeEach(() => {
    process.env.DIVOOX_COMPILACIONES_DIR = mkdtempSync(join(tmpdir(), 'divoox-compila-'));
  });
  afterEach(() => {
    if (antes === undefined) delete process.env.DIVOOX_COMPILACIONES_DIR;
    else process.env.DIVOOX_COMPILACIONES_DIR = antes;
  });

  it('la nube de Expo se niega sin la bandera, y no cuenta nada', async () => {
    const g = await cargar();
    expect(() =>
      g.autorizarCompilacion({ ...pedido, donde: 'nube', argumentos: [], ahora: dia }),
    ).toThrow(/NEGADA/);
    expect(() =>
      g.autorizarCompilacion({ ...pedido, donde: 'nube', argumentos: ['--local'], ahora: dia }),
    ).toThrow(/NEGADA/);
    expect(g.contarDelDia(dia).total).toBe(0);
  });

  it('en esta Mac pasa siempre, y con la bandera pasa la nube: las dos se cuentan por día', async () => {
    const g = await cargar();
    g.autorizarCompilacion({ ...pedido, donde: 'local', argumentos: [], ahora: dia });
    g.autorizarCompilacion({ ...pedido, donde: 'local', argumentos: [], ahora: dia });
    const cuenta = g.autorizarCompilacion({
      ...pedido,
      donde: 'nube',
      argumentos: ['--nube'],
      ahora: dia,
    });
    expect(cuenta).toEqual({ local: 2, nube: 1, total: 3 });
    // Otro día empieza en cero.
    expect(g.contarDelDia(new Date(2026, 10, 19, 9, 0, 0)).total).toBe(0);
  });

  it('ningún guion de tiendas lanza una compilación sin pasar por la puerta', () => {
    const lanzan = readdirSync(GUIONES)
      .filter((f) => /\.(mjs|sh)$/.test(f) && f !== 'guardia-nube.mjs')
      .filter((f) => {
        const texto = readFileSync(join(GUIONES, f), 'utf8');
        // Lanza una compilación si llama a eas con la orden «build» (no «build:view» ni «submit»).
        return /eas-cli[\s\S]{0,80}?['"\s]build['"\s,]/.test(texto);
      });
    expect(lanzan.length).toBeGreaterThan(0);
    for (const f of lanzan)
      expect(readFileSync(join(GUIONES, f), 'utf8'), f).toContain('autorizarCompilacion');
  });
});
