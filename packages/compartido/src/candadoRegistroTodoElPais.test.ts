import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { crearApi } from './api';
import { textosSelectorLugar } from './selectorLugar';
import type { LugarCuenta } from './lugarCuenta';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte A (25 nov 2026) — Venezuela y Estados Unidos. Candado de las
 * pantallas de las apps (no se pintan en estas pruebas: se lee su código) y del contrato con el
 * servidor (parte B), simulado con msw.
 *
 * Comprobado en ROJO (anotado en CANDADOS.md): devolviendo a AltaPasajeros.tsx el
 * `PUT /datos/conductor/ciudad` con la lista de zonas, falla «Driver cambia su ciudad con el
 * selector»; quitando el paso `lugar` de PASOS_REGISTRO, falla «Crear cuenta pide dónde vive».
 */
const RAIZ = join(__dirname, '..', '..', '..');
const leer = (ruta: string) =>
  readFileSync(join(RAIZ, ruta), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const SELECTORES = [
  'packages/compartido/src/catalogoLugares.ts',
  'packages/compartido/src/selectorLugar.ts',
  'packages/movil/src/SelectorLugar.tsx',
  'packages/movil/src/LugarCuenta.tsx',
  'apps/panel/src/SelectorLugar.tsx',
];

describe('C-REGISTRO-TODO-EL-PAIS: el selector es de dónde VIVE, nunca de las zonas', () => {
  it('ninguna pieza del selector lee zonas, disponibilidad ni la lista de ciudades de Driver', () => {
    for (const ruta of SELECTORES)
      expect(leer(ruta), ruta).not.toMatch(
        /\/datos\/zonas|disponibilidad|conductor\/ciudad|conductor\/papeles|ciudadesActivas|zonas WHERE/i,
      );
  });

  it('sus textos no dicen «no disponible» ni «próximamente»', () => {
    for (const idioma of ['es', 'en'] as const) {
      const todo = JSON.stringify(
        Object.values(textosSelectorLugar(idioma)).map((v) =>
          typeof v === 'function' ? v('X') : v,
        ),
      );
      expect(todo).not.toMatch(/no disponible|not available|próximamente|coming soon|pronto/i);
    }
  });

  it('el aviso de espera dice exactamente lo que pidió Richard (es y en)', () => {
    expect(textosSelectorLugar('es').enEsperaConductor).toBe(
      'Tu cuenta quedó creada. En tu ciudad todavía no hay viajes; te avisamos apenas abramos.',
    );
    expect(textosSelectorLugar('en').enEsperaConductor).toBe(
      'Your account is ready. There are no trips in your city yet; we’ll let you know as soon as we open.',
    );
  });
});

describe('C-REGISTRO-TODO-EL-PAIS: las pantallas de las apps', () => {
  it('Crear cuenta (clientes y Driver) pide dónde vive y lo manda en el registro', () => {
    const acceso = leer('packages/movil/src/Acceso.tsx');
    expect(acceso).toMatch(/\{ clave: 'lugar', casillas: \['lugar'\] \}/);
    expect(acceso).toMatch(/<SelectorLugar/);
    expect(acceso).toMatch(/lugar: lugarDeBorrador\(v\.lugar\)/);
    // El registro no espera ninguna zona: no se consulta nada antes de crear la cuenta.
    expect(acceso).not.toMatch(/zonas|disponibilidad/i);
  });

  it('el registro web también', () => {
    const web = leer('apps/panel/src/panel/Acceso.tsx');
    expect(web).toMatch(/<SelectorLugar/);
    expect(web).toMatch(/lugar: lugarDeBorrador\(v\.lugar\)/);
  });

  it('Driver cambia su ciudad con el selector, no con la lista de zonas abiertas', () => {
    const alta = leer('apps/repartidor/src/viajes/AltaPasajeros.tsx');
    expect(alta).toMatch(/<TarjetaMiLugar/);
    expect(alta).not.toMatch(/conductor\/ciudad/);
    expect(alta).not.toMatch(/papeles\.ciudades\.map/);
  });

  it('las cuentas sin ciudad la eligen al volver (Driver y clientes) y el inicio dice si esperan', () => {
    expect(leer('apps/repartidor/src/app/index.tsx')).toMatch(/<PreguntaLugar rol="repartidor"/);
    expect(leer('apps/cliente/src/app/_layout.tsx')).toMatch(/<PreguntaLugar rol="cliente"/);
    expect(leer('apps/repartidor/src/Inicio.tsx')).toMatch(/<AvisoLugarCuenta rol="repartidor"/);
    expect(leer('apps/cliente/src/Inicio.tsx')).toMatch(/<AvisoLugarCuenta rol="cliente"/);
  });
});

describe('C-REGISTRO-TODO-EL-PAIS: el contrato con el servidor (simulado con msw)', () => {
  const BASE = 'https://divoox.test';
  const maracaibo: LugarCuenta = {
    pais: 'VE',
    estado: 'V',
    municipio: 'Maracaibo',
    ciudad: 'Maracaibo',
    lugarId: 'gn:3633009',
    lat: 10.6423,
    lng: -71.6109,
  };
  let guardado: unknown = null;
  let registro: Record<string, unknown> | null = null;
  const servidor = setupServer(
    http.post(`${BASE}/datos/cuentas/registro`, async ({ request }) => {
      registro = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json(
        {
          token: 't',
          usuario: { id: 'u1', nombre: 'A', correo: 'a@b.co', rol: 'repartidor', idioma: 'es' },
        },
        { status: 201 },
      );
    }),
    http.get(`${BASE}/datos/cuentas/lugar`, () =>
      HttpResponse.json({ lugar: guardado, zona: null, enEspera: Boolean(guardado) }),
    ),
    http.put(`${BASE}/datos/cuentas/lugar`, async ({ request }) => {
      guardado = ((await request.json()) as { lugar: unknown }).lugar;
      return HttpResponse.json({ lugar: guardado, zona: null, enEspera: true });
    }),
  );
  beforeAll(() => servidor.listen());
  afterEach(() => {
    servidor.resetHandlers();
    guardado = null;
    registro = null;
  });
  afterAll(() => servidor.close());

  it('el registro manda el lugar y la cuenta se crea aunque su ciudad no tenga zona', async () => {
    const api = crearApi({ base: BASE });
    const s = await api.registro({
      nombre: 'Persona Nueva',
      correo: 'nueva@ejemplo.com',
      clave: '12345678',
      rol: 'repartidor',
      lugar: maracaibo,
    });
    expect(s.token).toBe('t');
    expect(registro?.lugar).toEqual(maracaibo);
  });

  it('una cuenta vieja sin lugar lo lee como null, lo cambia y queda en espera', async () => {
    const api = crearApi({ base: BASE, token: () => 'llave' });
    expect(await api.lugarCuenta()).toEqual({ lugar: null, zona: null, enEspera: false });
    const r = await api.cambiarLugarCuenta(maracaibo);
    expect(r).toMatchObject({ lugar: maracaibo, enEspera: true });
    expect((await api.lugarCuenta()).lugar).toEqual(maracaibo);
  });
});
