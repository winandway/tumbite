import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  entornoDeServidor,
  esAppDePruebas,
  pareceCorreoDePrueba,
  pistaDeEntrada,
  SERVIDOR_PRODUCCION,
} from './entornos';

/**
 * C-APP-DE-PRUEBAS-VISIBLE (15 nov 2026) — todos los países. Richard perdió una hora de pruebas en
 * Novi: su Android tenía Divoox Merchant de la tienda (habla con el sitio real) y él entraba
 * con la cuenta de prueba. La pantalla decía «no coinciden» y nada indicaba a qué sitio estaba
 * conectada la app. Las apps no corren en vitest: se prueba la lógica y se mira el código.
 */
const leer = (...r: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...r), 'utf8');
const PRUEBAS = 'https://staging.tumbite.com';
const APPS = ['cliente', 'repartidor', 'restaurante'] as const;

describe('qué entorno es cada servidor', () => {
  it('el sitio real es producción y nunca cuenta como app de pruebas', () => {
    expect(entornoDeServidor(SERVIDOR_PRODUCCION)).toBe('produccion');
    expect(esAppDePruebas(SERVIDOR_PRODUCCION)).toBe(false);
    expect(esAppDePruebas('https://www.divoox.com')).toBe(false);
  });
  it('el sitio de pruebas, el local y lo desconocido cuentan como app de pruebas', () => {
    expect(entornoDeServidor(PRUEBAS)).toBe('pruebas');
    for (const url of [PRUEBAS, 'http://localhost:8787', 'https://otro.example', 'no es url'])
      expect(esAppDePruebas(url)).toBe(true);
  });
});

describe('la pista cuando una cuenta no entra', () => {
  it('reconoce los correos que solo pueden ser de prueba', () => {
    expect(pareceCorreoDePrueba('demo.restaurante@ejemplo.com')).toBe(true);
    expect(pareceCorreoDePrueba(' Demo.Cliente@EXAMPLE.com ')).toBe(true);
    expect(pareceCorreoDePrueba('ana@gmail.com')).toBe(false);
    expect(pareceCorreoDePrueba('ana@miejemplo.com')).toBe(false);
  });
  it('en la app de pruebas orienta siempre; en la real, solo con un correo de prueba', () => {
    expect(pistaDeEntrada(PRUEBAS, 'ana@gmail.com')).toBe('appDePruebas');
    expect(pistaDeEntrada(PRUEBAS, 'demo.cliente@ejemplo.com')).toBe('appDePruebas');
    expect(pistaDeEntrada(SERVIDOR_PRODUCCION, 'demo.cliente@ejemplo.com')).toBe('appReal');
    // Una cuenta real que falla en la app real no recibe ninguna pista: nada que revelar.
    expect(pistaDeEntrada(SERVIDOR_PRODUCCION, 'ana@gmail.com')).toBeNull();
  });
  it('la pista sale de la app y de lo escrito, nunca de lo que respondió el servidor', () => {
    const acceso = leer('packages', 'movil', 'src', 'Acceso.tsx');
    expect(acceso).toMatch(/setPista\(pistaDeEntrada\(URL_SERVIDOR, v\.correo\)\)/);
    expect(acceso).toMatch(/x\.estado === 401/);
    expect(acceso).toContain('testID="pista-entrada"');
    // C-MENSAJES-ACCESO (24 nov 2026, Richard): el servidor ahora dice cuál de las dos falló, cada una
    // con su código (los dos siguen en 401: la pista de la app equivocada sigue saliendo igual).
    const cuentas = leer('apps', 'servidor', 'src', 'rutas', 'cuentas.ts');
    expect(cuentas).toContain("MENSAJE_CORREO_SIN_CUENTA, 'correo', 401");
    expect(cuentas).toContain("MENSAJE_CLAVE_INCORRECTA, 'clave', 401");
  });
});

describe('la franja «PRUEBAS» en las tres apps', () => {
  it('la pantalla de entrar la lleva, y el menú de cada app también (va con la versión)', () => {
    expect(leer('packages', 'movil', 'src', 'Acceso.tsx')).toContain('<FranjaPruebas');
    expect(leer('packages', 'movil', 'src', 'version.tsx')).toContain('<FranjaPruebas />');
    const menus = {
      cliente: ['apps', 'cliente', 'src', 'app', 'account.tsx'],
      repartidor: ['apps', 'repartidor', 'src', 'Inicio.tsx'],
      restaurante: ['apps', 'restaurante', 'src', 'Mas.tsx'],
    };
    for (const app of APPS) expect(leer(...menus[app])).toContain('<VersionInstalada />');
  });
  it('se decide por el servidor de la app, no por el nombre del perfil, y solo en el teléfono', () => {
    const franja = leer('packages', 'movil', 'src', 'FranjaPruebas.tsx');
    expect(franja).toMatch(/Platform\.OS !== 'web' && esAppDePruebas\(URL_SERVIDOR\)/);
    expect(franja).toContain('testID="franja-pruebas"');
    expect(franja).not.toContain('EAS_BUILD_PROFILE');
  });
  it('los perfiles de pruebas hablan con el sitio de pruebas y producción con el real', () => {
    for (const app of APPS) {
      const eas = JSON.parse(leer('apps', app, 'eas.json')) as {
        build: Record<string, { env?: { EXPO_PUBLIC_API_URL?: string } }>;
      };
      for (const perfil of ['pruebas', 'pruebas-tienda', 'simulador'])
        expect(esAppDePruebas(eas.build[perfil]?.env?.EXPO_PUBLIC_API_URL ?? '')).toBe(true);
      for (const perfil of ['production', 'preview'])
        expect(esAppDePruebas(eas.build[perfil]?.env?.EXPO_PUBLIC_API_URL ?? 'x')).toBe(false);
    }
  });
  it('tiene texto en español y en inglés', () => {
    const textos = leer('packages', 'movil', 'src', 'textos.ts');
    for (const llave of [
      'franjaPruebas:',
      'franjaPruebasDetalle:',
      'pistaAppDePruebas:',
      'pistaAppReal:',
    ])
      expect(textos.split(llave).length).toBe(3);
  });
});

describe('la página de descargas del equipo', () => {
  it('dice junto a cada descarga que la de pruebas y la de la tienda no conviven', () => {
    const pagina = leer('progreso', 'apps.html');
    expect(pagina).toContain(
      'Si ya tienes la app de la tienda, desinstálala primero; las dos no pueden estar juntas.',
    );
    expect(pagina).toContain('TestFlight reemplaza la app de la tienda');
    expect(pagina).toMatch(/lado\('Android', a\.android, 'Descargar', AVISO_ANDROID\)/);
    expect(pagina).toMatch(/lado\('iPhone', a\.iphone, 'Abrir TestFlight', AVISO_IPHONE\)/);
  });

  // C-PRUEBAS-SOLO-EQUIPO (18 nov 2026): Richard bajó «de la tienda» y le abrió la de pruebas.
  it('manda a Play Store para la versión real y no pinta las de prueba sin la clave del equipo', () => {
    const pagina = leer('progreso', 'apps.html');
    expect(pagina).toContain('https://play.google.com/store/apps/details?id=com.windoce.tumbite');
    expect(pagina).toContain(
      'https://play.google.com/store/apps/details?id=com.windoce.tumbite.driver',
    );
    expect(pagina).toContain(
      'Solo para el equipo de Divoox. El público baja la app de Play Store.',
    );
    // Los códigos de prueba solo se pintan desde pintarPruebas, que mira la clave aceptada.
    expect(pagina).not.toMatch(/el\('apps'\)\.innerHTML = d\.apps/);
    expect(pagina).toMatch(/equipoDentro\s*\?\s*appsDePrueba/);
  });
});
