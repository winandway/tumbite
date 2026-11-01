import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Lo que Richard encontró en TestFlight el 31 oct 2026 (app del cliente, Envíos):
 * C-ENVIO-SIN-SILENCIO, C-TECLADO-NO-TAPA, C-BLOQUE-EN-LA-APP, C-MOSAICO-UNA-LINEA y C-LETRA-NO-BLACK.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8');
function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? archivos(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

describe('Envíos y la app del cliente, como los vio Richard en TestFlight', () => {
  const pedir = leer('apps', 'cliente', 'src', 'viajes', 'PedirMoto.tsx');
  it('«Enviar» avisa junto al botón qué falta (casilla de prohibidos, datos de quien recibe)', () => {
    expect(pedir).toContain('if (!v.sinProhibidos) return setError(t.faltaProhibidos);');
    expect(pedir).toMatch(
      /\{error \? \([\s\S]{0,200}\{error\}[\s\S]{0,120}<Boton\s+texto=\{servicio === 'envios'/,
    );
    expect(pedir).toContain('accessibilityRole="checkbox"');
  });
  it('el teclado no tapa el formulario y se puede esconder', () => {
    const ride = leer('apps', 'cliente', 'src', 'app', 'ride.tsx');
    expect(ride).toContain('keyboardDismissMode="interactive"');
    expect(ride).toContain('automaticallyAdjustKeyboardInsets');
  });
  it('«Bloque de logística» abre una pantalla de la app, no la web', () => {
    const servicio = leer('apps', 'cliente', 'src', 'app', 'service', '[id].tsx');
    expect(servicio).toContain("router.push('/business')");
    expect(servicio).not.toContain('Linking.openURL');
    expect(leer('apps', 'cliente', 'src', 'app', 'business.tsx')).toContain('<WebView');
  });
  it('el nombre del servicio cabe en una línea aunque la letra del teléfono sea grande', () => {
    const s = leer('apps', 'cliente', 'src', 'inicio', 'Servicios.tsx');
    expect(s).toMatch(/numberOfLines=\{1\}\s+adjustsFontSizeToFit/);
  });
  it('la app del cliente no usa la letra «Black» (peso 900) ni «Heavy» (800)', () => {
    for (const dir of [
      join(RAIZ, 'apps', 'cliente', 'src'),
      join(RAIZ, 'packages', 'movil', 'src'),
    ])
      for (const f of archivos(dir))
        expect(readFileSync(f, 'utf8'), f).not.toMatch(/fontWeight: '(900|800)'/);
  });
});

describe('registro legal de la empresa en la app (C-EMPRESA-LEGAL, LG1)', () => {
  const b = leer('apps', 'cliente', 'src', 'app', 'business.tsx');
  it('pide los datos legales, valida el número fiscal y el centro con su punto', () => {
    expect(b).toContain('numeroFiscalValido(v.pais, v.numeroFiscal)');
    expect(b).toContain("formulario: 'app-empresa-flex'");
    expect(b).toContain('<CampoDireccion');
    expect(b).toContain("'/datos/v1/flex/empresas'");
  });
  it('abre el panel dentro de la app con un pase de un solo uso, no con la web afuera', () => {
    expect(b).toContain("'/datos/cuentas/pase-web'");
    expect(b).not.toContain('Linking');
  });
});
