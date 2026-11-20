import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-REVISA-TUS-DATOS (19 nov 2026, orden de Richard) — todos los países. «Uno le da a crear cuenta y
 * ya se van todos los datos… no le sale una pantalla de verificación de datos». Candado de las tres
 * apps (la pieza única `packages/movil/src/Acceso.tsx`) y de la web (`apps/panel/src/panel/Acceso.tsx`):
 * la creación de la cuenta (`api.registro`) vive en UNA función, `crearCuenta`, y la llama SOLO el
 * botón «Crear mi cuenta» de «Revisa tus datos». Ni «Continuar», ni la tecla del teclado, ni un
 * efecto. La prueba de comportamiento de la web está en `apps/panel/src/panel/Acceso.test.tsx`.
 * Comprobado en ROJO llamando a `crearCuenta()` desde `continuar()` en las dos pantallas.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');
const sinComentarios = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** El cuerpo de la función que empieza con `cabeza` (hasta su llave de cierre). */
function cuerpo(texto: string, cabeza: string): string {
  const inicio = texto.indexOf(cabeza);
  expect(inicio, cabeza).toBeGreaterThanOrEqual(0);
  const abre = texto.indexOf('{', inicio);
  let nivel = 0;
  for (let i = abre; i < texto.length; i++) {
    const c = texto.charAt(i);
    if (c === '{') nivel++;
    if (c === '}' && --nivel === 0) return texto.slice(abre, i + 1);
  }
  throw new Error(`sin cierre: ${cabeza}`);
}
const veces = (texto: string, trozo: string) => texto.split(trozo).length - 1;

const PANTALLAS = [
  {
    nombre: 'apps (cliente, Driver y Restaurants)',
    acceso: 'packages/movil/src/Acceso.tsx',
    revisa: 'packages/movil/src/RevisaTusDatos.tsx',
    botonCrear: /<Boton\s+testID="crear-mi-cuenta"[^>]*alTocar=\{alCrear\}/,
  },
  {
    nombre: 'web (panel de restaurantes y de empresas)',
    acceso: 'apps/panel/src/panel/Acceso.tsx',
    revisa: 'apps/panel/src/panel/RevisaTusDatos.tsx',
    botonCrear: /data-testid="crear-mi-cuenta"[^>]*onClick=\{alCrear\}/,
  },
];

describe('C-REVISA-TUS-DATOS: la cuenta se crea solo con el toque en «Crear mi cuenta»', () => {
  for (const p of PANTALLAS) {
    describe(p.nombre, () => {
      const acceso = sinComentarios(leer(p.acceso));
      const revisa = sinComentarios(leer(p.revisa));

      it('la creación de la cuenta vive en una sola función, crearCuenta', () => {
        expect(veces(acceso, 'api.registro(')).toBe(1);
        expect(cuerpo(acceso, 'async function crearCuenta(')).toContain('api.registro(');
      });

      it('crearCuenta se llama en un solo lugar: el «Crear mi cuenta» de «Revisa tus datos»', () => {
        const llamadas = veces(acceso, 'crearCuenta(') - 1; // menos la definición
        expect(llamadas).toBe(1);
        const desde = acceso.indexOf('<RevisaTusDatos');
        const hasta = acceso.indexOf('</RevisaTusDatos>');
        const llamada = acceso.indexOf('alCrear={() => void crearCuenta()}');
        expect(desde).toBeGreaterThan(0);
        expect(llamada).toBeGreaterThan(desde);
        expect(llamada).toBeLessThan(hasta);
      });

      it('«Continuar» valida y abre la revisión, nunca crea la cuenta', () => {
        const continuar = cuerpo(acceso, 'function continuar(');
        expect(continuar).toContain('validarRegistro(');
        expect(continuar).toContain("setPaso('revisar')");
        expect(continuar).not.toMatch(/crearCuenta|api\.|enviar\(/);
      });

      it('ningún efecto crea la cuenta solo', () => {
        const efectos = acceso.split('useEffect(').slice(1);
        for (const efecto of efectos) expect(efecto.slice(0, 400)).not.toContain('crearCuenta');
      });

      it('en «Revisa tus datos», alCrear solo lo dispara el botón «Crear mi cuenta»', () => {
        expect(revisa).toMatch(p.botonCrear);
        // Una vez en la lista de props, una en el tipo y una en el botón.
        expect(veces(revisa, 'alCrear')).toBe(3);
        expect(revisa).not.toContain('useEffect');
      });

      it('la contraseña nunca se muestra en la revisión', () => {
        expect(revisa).not.toMatch(/clave/i);
      });
    });
  }

  it('en las apps, la tecla del teclado en la contraseña no manda nada al crear la cuenta', () => {
    const acceso = leer('packages/movil/src/Acceso.tsx');
    expect(acceso).toContain(
      'alEnviar={registro ? () => Keyboard.dismiss() : () => void entrarConCuenta()}',
    );
  });

  it('en la web, el formulario de registro solo lleva a revisar', () => {
    const enviar = cuerpo(
      sinComentarios(leer('apps/panel/src/panel/Acceso.tsx')),
      'function enviar(',
    );
    expect(enviar).toMatch(/if \(modo === 'registro'\) \{\s*continuar\(\);\s*return;/);
    expect(enviar).not.toContain('api.registro');
  });
});
