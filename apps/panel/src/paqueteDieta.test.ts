import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-PAQUETE-DIETA (21 nov 2026, orden de Gerencia) — todos los países. El paquete del sitio tiene un
 * tope en la plataforma (a 133 MB falló con «Memory limit exceeded»; ver C-PAQUETE-TOPE). El 21 nov
 * llegó a 120,2 MB y una publicación se quedó sin salir. Este candado falla ANTES de publicar, en la
 * máquina de quien trabaja: lo público que viaja en el paquete no puede crecer sin que alguien lo vea.
 * Lo pesado que no es código (PDF, videos, capturas nítidas) vive en el almacén del sitio.
 */
const PUBLICO = join(process.cwd(), 'apps', 'panel', 'public');
/**
 * Hoy pesa unos 44 MB (25 nov: con el catálogo de lugares en formato compacto y 351 capturas de Docs
 * recomprimidas). Al pasar de aquí hay que adelgazar o mandar cosas al almacén.
 */
const TOPE_PUBLICO_MB = 46;
const TOPE_ARCHIVO_KB = 400;
const PROHIBIDAS = /\.(pdf|mp4|mov|webm|zip|psd|ai|wav\.bak)$/i;

function recorrer(dir: string): { ruta: string; bytes: number }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    return e.isDirectory() ? recorrer(ruta) : [{ ruta, bytes: statSync(ruta).size }];
  });
}

describe('C-PAQUETE-DIETA: lo público del sitio no engorda el paquete', () => {
  const archivos = recorrer(PUBLICO);

  it(`todo lo público pesa menos de ${TOPE_PUBLICO_MB} MB`, () => {
    const mb = archivos.reduce((s, a) => s + a.bytes, 0) / 1048576;
    expect(
      mb,
      `apps/panel/public pesa ${mb.toFixed(1)} MB: recomprime imágenes o manda lo pesado al almacén`,
    ).toBeLessThan(TOPE_PUBLICO_MB);
  });

  it('ni PDF ni videos ni comprimidos viajan en el paquete: van al almacén', () => {
    expect(archivos.filter((a) => PROHIBIDAS.test(a.ruta)).map((a) => a.ruta)).toEqual([]);
  });

  it(`ningún archivo público pasa de ${TOPE_ARCHIVO_KB} KB`, () => {
    const pesados = archivos
      .filter((a) => a.bytes > TOPE_ARCHIVO_KB * 1024)
      .map((a) => `${a.ruta.replace(PUBLICO, '')} (${Math.round(a.bytes / 1024)} KB)`);
    expect(pesados).toEqual([]);
  });
});
