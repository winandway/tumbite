import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CORREOS_SOPORTE } from '@tumbite/compartido';

/**
 * C-FICHA-CONTACTO (13 nov 2026, punto 9 del reporte; FILA D7) — todos los países. El correo de
 * contacto de cada ficha de Google Play es el buzón de soporte de ESA app (C-SOPORTE-UN-BUZON), no
 * el viejo go@windoce.com. El guion de fichas lo carga junto con los textos.
 */
const leer = (ruta: string) =>
  readFileSync(fileURLToPath(new URL(`../../../${ruta}`, import.meta.url).href), 'utf8');

const fichas = JSON.parse(leer('scripts/tiendas/fichas-google-play.json')) as Record<
  string,
  Record<string, unknown> & { contacto?: { contactEmail?: string } }
>;

describe('C-FICHA-CONTACTO', () => {
  const esperado: [string, string][] = [
    ['com.windoce.tumbite', CORREOS_SOPORTE.divoox],
    ['com.windoce.tumbite.driver', CORREOS_SOPORTE.driver],
    ['com.windoce.tumbite.restaurants', CORREOS_SOPORTE.restaurantes],
  ];
  for (const [paquete, correo] of esperado)
    it(`${paquete}: el contacto es ${correo}`, () => {
      expect(new Map(Object.entries(fichas)).get(paquete)?.contacto?.contactEmail).toBe(correo);
    });

  it('ninguna ficha usa el buzón viejo ni una dirección de divoox.com', () => {
    const texto = JSON.stringify(fichas);
    expect(texto).not.toContain('go@windoce.com');
    expect(texto).not.toMatch(/[a-z+.]+@divoox\.com/);
  });

  it('el guion carga el contacto en los datos de la app y no lo manda como un idioma', () => {
    const guion = leer('scripts/tiendas/fichas-google-play.mjs');
    expect(guion).toContain('/details');
    expect(guion).toContain("metodo: 'PATCH'");
    expect(guion).toContain("idioma !== 'contacto'");
  });
});
