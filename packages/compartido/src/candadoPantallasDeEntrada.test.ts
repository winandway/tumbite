import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Candados de las pantallas de antes de iniciar sesión (19 nov 2026, órdenes de Richard) — todos los
 * países. Comprobados en ROJO quitando cada pieza.
 *
 * - C-SIN-CALLEJON: en Driver, desde «Crear cuenta» no se podía volver a «Entrar». Ninguna pantalla
 *   de antes de entrar es un callejón: flecha arriba, enlace arriba y al final, y el gesto del sistema.
 * - C-RESTAURANTE-DESDE-EL-TELEFONO: Restaurants decía «Las cuentas se crean en divoox.com/panel.
 *   Aquí solo entras», sin enlace ni soporte. La cuenta se crea en la app y hay ayuda a la vista.
 * - C-FECHA-MODERNA: ninguna fecha se pide a mano como «AAAA-MM-DD»; todas usan la casilla única.
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');
function archivos(carpeta: string): string[] {
  return readdirSync(join(RAIZ, carpeta)).flatMap((n) => {
    const ruta = join(carpeta, n);
    if (n === 'node_modules' || n.startsWith('.') || n.startsWith('dist')) return [];
    if (statSync(join(RAIZ, ruta)).isDirectory()) return archivos(ruta);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [ruta] : [];
  });
}
const sinComentarios = (texto: string) =>
  texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('C-SIN-CALLEJON: de «Crear cuenta» siempre se vuelve a «Entrar»', () => {
  const acceso = leer('packages/movil/src/Acceso.tsx');
  it('la pantalla de acceso (la única de las tres apps) trae la flecha, los dos enlaces y el gesto', () => {
    expect(acceso).toMatch(
      /registro \? <EncabezadoVolver texto=\{textoVolver\} alVolver=\{aEntrar\}/,
    );
    // C-REVISA-TUS-DATOS: desde «Revisa tus datos» la flecha vuelve al formulario y lo dice.
    expect(acceso).toContain(
      "const textoVolver = paso === 'revisar' ? r.editarDatos : t.volverAEntrar;",
    );
    expect(acceso).toContain('volver={registro ? aEntrar : seguirMirando}');
    expect(acceso).toContain('testID="ya-tengo-cuenta-arriba"');
    expect(acceso).toContain(
      "testID={modo === 'entrar' ? 'ir-a-crear-cuenta' : 'ya-tengo-cuenta'}",
    );
    expect(acceso).toContain("useVolverDelSistema(modo === 'registro', aEntrar)");
    const pieza = leer('packages/movil/src/VolverAEntrar.tsx');
    expect(pieza).toContain("BackHandler.addEventListener('hardwareBackPress'");
    expect(pieza).toContain('PanResponder.create');
  });
  it('cada modo guarda su propio borrador: ir y volver no pierde lo escrito', () => {
    expect(acceso).toContain('formulario: `app-${modo}`');
  });
  it('ninguna app arma su propia pantalla de entrar o de crear cuenta fuera de la pieza', () => {
    const propias = ['apps/cliente/src', 'apps/repartidor/src', 'apps/restaurante/src']
      .flatMap(archivos)
      .filter((ruta) => /api\.(entrar|registro)\(/.test(sinComentarios(leer(ruta))));
    expect(propias).toEqual([]);
  });
});

describe('C-RESTAURANTE-DESDE-EL-TELEFONO y C-AYUDA-A-LA-VISTA', () => {
  it('las tres apps dejan crear la cuenta desde la pantalla de entrar', () => {
    expect(leer('apps/restaurante/src/app/index.tsx')).toContain(
      '<Acceso rolRegistro="restaurante"',
    );
    expect(leer('apps/repartidor/src/app/index.tsx')).toContain('<Acceso rolRegistro="repartidor"');
    expect(leer('apps/cliente/src/app/sign-in.tsx')).toContain('rolRegistro="cliente"');
  });
  it('nadie vuelve a decir «aquí solo entras» ni manda a una computadora', () => {
    const textos = sinComentarios(leer('packages/movil/src/textos.ts'));
    expect(textos).not.toMatch(
      /solo entras|accounts are created at|se crean en divoox\.com\/panel/i,
    );
    expect(textos).toContain("crearCuentaRestaurante: 'Crear cuenta de comercio'");
    const inicio = leer('apps/restaurante/src/Inicio.tsx');
    expect(sinComentarios(inicio)).not.toMatch(/en divoox\.com\/panel para empezar/);
    expect(inicio).toContain("abrirPanel(api, URL_SERVIDOR, '/panel')");
  });
  it('hay ayuda a la vista sin iniciar sesión, en las apps y en el panel web', () => {
    const acceso = leer('packages/movil/src/Acceso.tsx');
    expect(acceso).toContain('testID="acceso-ayuda"');
    expect(acceso).toContain("abrir('/support')");
    expect(leer('apps/panel/src/panel/Acceso.tsx')).toContain('data-testid="acceso-ayuda"');
  });
  it('quien crea su cuenta en la app la puede borrar desde la app (lo exige Apple)', () => {
    expect(leer('apps/restaurante/src/Mas.tsx')).toContain('OpcionesCuenta');
    // También ANTES de completar el restaurante: la pantalla «sin restaurante» no tiene «Más»
    // (hallazgo del auditor de tiendas, 20 nov 2026; visto en rojo con el botón «Salir» suelto).
    const inicio = leer('apps/restaurante/src/Inicio.tsx');
    const sinRest = inicio.slice(inicio.indexOf('if (rest === null) {'));
    expect(sinRest.slice(0, sinRest.indexOf('</Pantalla>'))).toContain('<OpcionesCuenta />');
    expect(leer('packages/movil/src/OpcionesCuenta.tsx')).toContain('testID="borrar-cuenta"');
  });
});

describe('C-FECHA-MODERNA: ninguna fecha se pide como texto libre', () => {
  const pantallas = [
    'packages/movil/src',
    'apps/cliente/src',
    'apps/repartidor/src',
    'apps/restaurante/src',
    'apps/panel/src/panel',
    'apps/panel/src/sitio',
    'apps/panel/src/agente',
  ]
    .flatMap(archivos)
    .filter((ruta) => !ruta.includes('/docs/'));
  it('ninguna etiqueta ni marcador enseña «AAAA-MM-DD» y nadie pone una fecha de ejemplo a mano', () => {
    const malos = pantallas.flatMap((ruta) => {
      const texto = sinComentarios(leer(ruta));
      return [
        /['"`][^'"`\n]*(AAAA-MM-DD|YYYY-MM-DD)[^'"`\n]*['"`]/,
        /placeholder="(19|20)\d\d-\d\d-\d\d"/,
      ]
        .filter((r) => r.test(texto))
        .map((r) => `${ruta}: ${r}`);
    });
    expect(malos).toEqual([]);
  });
  it('el cumpleaños del registro usa la casilla única y es opcional de verdad', () => {
    const acceso = leer('packages/movil/src/Acceso.tsx');
    expect(acceso).toMatch(/<CampoFecha[\s\S]{0,200}cambiar\('fechaNacimiento', x\)/);
    expect(acceso).toContain('fechaNacimiento: v.fechaNacimiento || undefined');
    for (const ruta of [
      'packages/movil/src/CampoFecha.tsx',
      'apps/panel/src/panel/CampoFecha.tsx',
    ]) {
      const pieza = leer(ruta);
      expect(pieza, ruta).toContain('escribirFecha(texto,');
      expect(pieza, ruta).toContain('ordenFecha({ paisCiudad: pais })');
      expect(pieza, ruta).toContain('marcadorFecha(orden, idioma)');
    }
  });
});
