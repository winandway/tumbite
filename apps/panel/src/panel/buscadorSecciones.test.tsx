import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Idioma, textoPlano } from '@tumbite/compartido';
import { BuscadorSuper } from './BuscadorSuper';
import { gruposAdmin } from './armazon/menus';
import { TEXTOS_PANEL } from './textos';
import { filtrarMenu } from './permisosPanel';
import {
  ACCIONES_SECCIONES,
  SINONIMOS_SECCIONES,
  buscarSecciones,
  seccionesParecidas,
} from './indiceSecciones';

/**
 * C-BUSCADOR-INSTANTANEO, ampliado con C-BUSCADOR-SECCIONES (19 nov 2026, Richard escribió «kyc»
 * en el buscador de arriba y le salió «No encontramos "kyc"»). Todos los países.
 *
 * Cada sección del menú del superadmin se encuentra por su nombre y por sus sinónimos, en español
 * e inglés, sin mirar acentos ni mayúsculas, desde un índice local; solo las que el permiso deja
 * ver; y sin resultados el buscador sugiere secciones parecidas.
 */
const BASE = '/panel/control-x';
const menu = (idioma: Idioma) => gruposAdmin(TEXTOS_PANEL[idioma], idioma, BASE, `${BASE}`, true);
const items = (idioma: Idioma) => menu(idioma).flatMap((g) => g.items);

describe('C-BUSCADOR-SECCIONES · el índice local de secciones', () => {
  it('cada sección del menú tiene sus sinónimos en los dos idiomas (y no sobra ninguno)', () => {
    const claves = items('es').map((i) => i.clave);
    for (const k of claves) {
      const s = new Map(Object.entries(SINONIMOS_SECCIONES)).get(k);
      expect(s?.es.length, `sinónimos en español de «${k}»`).toBeGreaterThan(0);
      expect(s?.en.length, `sinónimos en inglés de «${k}»`).toBeGreaterThan(0);
    }
    expect(Object.keys(SINONIMOS_SECCIONES).sort()).toEqual([...claves].sort());
    for (const a of ACCIONES_SECCIONES) expect(claves, a.id).toContain(a.seccion);
  });

  for (const idioma of ['es', 'en'] as const)
    it(`cada sección se encuentra por su nombre y por cada sinónimo (pantalla en ${idioma})`, () => {
      const grupos = menu(idioma);
      for (const i of items(idioma)) {
        // Por su nombre: sale, y lo primero es una sección con ese nombre (en español «Configuración»
        // nombra dos: la del superadmin y la de la cuenta; salen las dos).
        for (const q of [i.texto, textoPlano(i.texto).toUpperCase()]) {
          const r = buscarSecciones(grupos, q, idioma, BASE);
          expect(
            r.map((x) => x.clave),
            q,
          ).toContain(i.clave);
          expect(r[0]?.texto, q).toBe(i.texto);
        }
        // Por cada sinónimo, en español y en inglés, con la pantalla en cualquier idioma.
        const s = new Map(Object.entries(SINONIMOS_SECCIONES)).get(i.clave);
        for (const p of [...(s?.es ?? []), ...(s?.en ?? [])])
          expect(
            buscarSecciones(grupos, p, idioma, BASE).map((x) => x.clave),
            `«${p}» → ${i.clave}`,
          ).toContain(i.clave);
      }
    });

  it('«kyc», verificación, papeles, identidad, cédula y licencia llevan a Verificaciones y a Para aprobar', () => {
    const grupos = menu('es');
    for (const q of [
      'kyc',
      'KYC',
      'verificación',
      'verificacion',
      'VERIFICAR',
      'documentos',
      'papeles',
      'identidad',
      'cédula',
      'Cedula',
      'licencia',
      'ky',
    ]) {
      const claves = buscarSecciones(grupos, q, 'es', BASE).map((x) => x.clave);
      expect(claves, q).toContain('verifications');
      expect(claves, q).toContain('approvals');
    }
    // Y dice por qué salió: la palabra que coincidió.
    expect(buscarSecciones(grupos, 'kyc', 'es', BASE)[0]?.porque).toBe('kyc');
    // Lo mismo con la pantalla en inglés y una palabra en inglés.
    expect(buscarSecciones(menu('en'), 'documents', 'en', BASE).map((x) => x.clave)).toEqual(
      expect.arrayContaining(['verifications', 'approvals']),
    );
  });

  it('sugiere desde la primera letra y encuentra el resto del menú por sus palabras', () => {
    const grupos = menu('es');
    expect(buscarSecciones(grupos, 'k', 'es', BASE).map((x) => x.clave)).toContain('verifications');
    const casos: [string, string][] = [
      ['saldo', 'driver-balance'],
      ['recargas', 'driver-balance'],
      ['tarifas', 'rides'],
      ['cupones', 'gift-codes'],
      ['líneas', 'lines'],
      ['tasa', 'moto'],
      ['zonas', 'zones'],
      ['equipo', 'team'],
      ['tickets', 'tickets'],
      ['reportes', 'moderation'],
      ['top-ups', 'driver-balance'],
      ['fares', 'rides'],
    ];
    for (const [q, clave] of casos)
      expect(
        buscarSecciones(grupos, q, 'es', BASE).map((x) => x.clave),
        q,
      ).toContain(clave);
    // Acciones: lo que se quiere hacer lleva a donde se hace.
    expect(buscarSecciones(grupos, 'cargar saldo', 'es', BASE)[0]).toMatchObject({
      clave: 'accion-recargar-saldo',
      a: `${BASE}/driver-balance`,
    });
    // La ayuda del equipo también.
    expect(buscarSecciones(grupos, 'ayuda', 'es', BASE)[0]?.a).toBe(`${BASE}/help`);
  });

  it('solo muestra lo que el permiso de la cuenta deja ver', () => {
    const soloSoporte = filtrarMenu(menu('es'), (p) => p === 'tickets.ver');
    const claves = buscarSecciones(soloSoporte, 'kyc', 'es', BASE).map((x) => x.clave);
    expect(claves).not.toContain('verifications');
    expect(claves).not.toContain('approvals');
    // Las acciones de una sección que no ve, tampoco.
    expect(buscarSecciones(soloSoporte, 'cargar saldo', 'es', BASE).map((x) => x.clave)).toEqual(
      [],
    );
    expect(buscarSecciones(soloSoporte, 'quejas', 'es', BASE)[0]?.clave).toBe('tickets');
  });

  it('sin resultados sugiere secciones parecidas, y si no hay, las de cada día', () => {
    const grupos = menu('es');
    expect(seccionesParecidas(grupos, 'verifcacion', 'es', BASE).map((x) => x.clave)).toContain(
      'verifications',
    );
    expect(seccionesParecidas(grupos, 'recarags', 'es', BASE).map((x) => x.clave)).toContain(
      'driver-balance',
    );
    expect(seccionesParecidas(grupos, 'qwzx', 'es', BASE).map((x) => x.clave)).toEqual([
      'orders',
      'verifications',
      'drivers',
      'customers',
    ]);
  });
});

type Llamada = { url: string };
function servidor(responder: (q: string) => unknown) {
  const llamadas: Llamada[] = [];
  vi.stubGlobal('fetch', (url: string) => {
    llamadas.push({ url: String(url) });
    const q = new URL(String(url), 'http://x').searchParams.get('q') ?? '';
    return Promise.resolve(new Response(JSON.stringify(responder(q))));
  });
  return llamadas;
}
const vacia = (q: string) => ({ q, grupos: [], salto: null, avisoMonto: false });

describe('C-BUSCADOR-SECCIONES · en el buscador de arriba', () => {
  beforeEach(() => window.history.pushState(null, '', BASE));
  afterEach(() => vi.unstubAllGlobals());

  it('«kyc» muestra «Ir a…» arriba con Verificaciones (y por qué) y Enter la abre', async () => {
    servidor(vacia);
    render(<BuscadorSuper base={BASE} idioma="es" grupos={menu('es')} />);
    await userEvent.type(screen.getByRole('combobox'), 'kyc');
    expect(await screen.findByText('Ir a…')).toBeTruthy();
    const lista = screen.getByRole('listbox');
    const opciones = within(lista).getAllByRole('option');
    expect(opciones[0]?.textContent).toContain('Verificaciones');
    expect(opciones[0]?.textContent).toContain('kyc');
    expect(lista.textContent).toContain('Para aprobar');
    expect(screen.queryByText(/No encontramos/)).toBeNull();
    await userEvent.keyboard('{Enter}');
    expect(window.location.pathname).toBe(`${BASE}/verifications`);
  });

  it('una cuenta nueva sale con su estado en palabras y «Ver sus papeles» abre su verificación', async () => {
    servidor((q) => ({
      q,
      salto: null,
      avisoMonto: false,
      grupos: [
        {
          tipo: 'repartidores',
          resultados: [
            {
              id: 'r-nuevo',
              titulo: 'Kelly Prado',
              detalle: 'k•••@gmail.com',
              estado: 'sin_verificar',
              ciudad: null,
              enlace: '/drivers/r-nuevo',
              coincide: '',
              atajo: { clave: 'papeles', enlace: '/verifications/r-nuevo' },
            },
          ],
        },
      ],
    }));
    render(<BuscadorSuper base={BASE} idioma="es" grupos={menu('es')} />);
    await userEvent.type(screen.getByRole('combobox'), 'kprado');
    expect(await screen.findByText('Sin verificar')).toBeTruthy();
    const papeles = screen.getByRole('option', { name: /Ver sus papeles/ });
    await userEvent.click(papeles);
    expect(window.location.pathname).toBe(`${BASE}/verifications/r-nuevo`);
  });

  it('en inglés: «Documents pending» y «See their documents»', async () => {
    servidor((q) => ({
      q,
      salto: null,
      avisoMonto: false,
      grupos: [
        {
          tipo: 'repartidores',
          resultados: [
            {
              id: 'r-nuevo',
              titulo: 'Kelly Prado',
              detalle: '',
              estado: 'papeles_pendientes',
              ciudad: 'Novi',
              enlace: '/drivers/r-nuevo',
              coincide: '',
              atajo: { clave: 'papeles', enlace: '/verifications/r-nuevo' },
            },
          ],
        },
      ],
    }));
    render(<BuscadorSuper base={BASE} idioma="en" grupos={menu('en')} />);
    await userEvent.type(screen.getByRole('combobox'), 'kprado');
    expect(await screen.findByText('Documents pending')).toBeTruthy();
    expect(screen.getByRole('option', { name: /See their documents/ })).toBeTruthy();
  });

  it('sin resultados no es un callejón sin salida: «Quizás buscabas:» con secciones parecidas', async () => {
    servidor(vacia);
    render(<BuscadorSuper base={BASE} idioma="es" grupos={menu('es')} />);
    await userEvent.type(screen.getByRole('combobox'), 'verifcacion');
    expect(await screen.findByText(/No encontramos/)).toBeTruthy();
    expect(screen.getByText('Quizás buscabas:')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Verificaciones/ }));
    expect(window.location.pathname).toBe(`${BASE}/verifications`);
  });
});
