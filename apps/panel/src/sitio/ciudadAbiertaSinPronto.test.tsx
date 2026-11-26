import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../App';
import { CIUDADES } from './cobertura';
import { olvidarCiudadesEnVivo } from './ciudadesEnVivo';
import { RUTAS_TARIFAS } from './CiudadPublica';
import { PaginaLugar } from './Lugar';
import { CIUDADES_ABIERTAS_PUBLICADAS, olvidarPaisesAbiertos } from './paisesAbiertos';
import { TARIFAS_PUBLICADAS, lugaresDe, olvidarTarifas } from './tarifasCiudades';
// @ts-expect-error: guion de compilación en JavaScript, sin tipos.
import { validar, validarTarifas } from '../../scripts/estado-paises.mjs';

/**
 * C-CIUDAD-ABIERTA-SIN-PRONTO y C-TARIFAS-PUBLICAS (25 nov 2026, encargo de Richard: que Google y los
 * buscadores de IA digan que Divoox YA está en Venezuela) — Venezuela.
 *
 * - Ninguna página de ciudad de Venezuela ni su página de precios dice «muy pronto», «coming soon» ni
 *   «próximamente».
 * - Una ciudad sin servicio abierto NO afirma que ya funcione; una abierta lo dice claro.
 * - Todas están en el mapa del sitio, con su versión en español y su hreflang.
 * - La página de tarifas lee los datos del sistema: si cambia un precio, cambia la página.
 */
const PRONTO = /pronto|pr[oó]ximamente|coming soon|\bsoon\b|is coming|llega muy/i;
const AFIRMA = /ya funciona|now live|ya disponible|now available|ya estamos en|now in /i;
const VENEZUELA = Object.values(CIUDADES).filter((c) => c.pais === 'venezuela');

const visible = (html: string) =>
  `${html.replace(/<[^>]+>/g, ' ')} ${[...html.matchAll(/(?:aria-label|alt|title)="([^"]*)"/g)]
    .map((m) => m[1])
    .join(' ')}`;

const servidor = (r: { paises?: unknown; ciudades?: unknown; tarifas?: Record<string, unknown> }) =>
  vi.stubGlobal('fetch', async (url: string) => {
    const u = String(url);
    if (u.includes('/datos/web/paises') && r.paises)
      return new Response(JSON.stringify({ paises: r.paises, ciudades: r.ciudades }), {
        status: 200,
      });
    const t = /\/datos\/web\/tarifas\/([a-z-]+)/.exec(u);
    if (t && r.tarifas?.[t[1]!])
      return new Response(JSON.stringify(r.tarifas[t[1]!]), { status: 200 });
    if (t) return new Response('{}', { status: 404 });
    return new Response('{}', { status: 404 });
  });

describe('C-CIUDAD-ABIERTA-SIN-PRONTO: las ciudades de Venezuela', () => {
  beforeEach(() => {
    localStorage.clear();
    olvidarCiudadesEnVivo();
    olvidarPaisesAbiertos();
    olvidarTarifas();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('están las ciudades del encargo, cada una con su clave', () => {
    const slugs = VENEZUELA.map((c) => c.slug);
    for (const s of [
      'el-vigia',
      'tucani',
      'caracas',
      'maracaibo',
      'valencia-venezuela',
      'barquisimeto',
      'merida-venezuela',
      'san-cristobal-venezuela',
      'maracay',
      'puerto-la-cruz',
      'ciudad-guayana',
    ])
      expect(slugs).toContain(s);
    expect(VENEZUELA.every((c) => c.clave)).toBe(true);
  });

  it('ninguna página de ciudad ni de precios dice «muy pronto»; la que no está abierta no afirma que funcione', () => {
    for (const c of VENEZUELA)
      for (const idioma of ['es', 'en'] as const) {
        const abierta = Boolean(CIUDADES_ABIERTAS_PUBLICADAS.VE?.[c.clave!]?.length);
        const html = renderToString(<PaginaLugar ruta={`/city/${c.slug}`} idioma={idioma} />);
        const texto = visible(html);
        expect(texto, `${idioma} ${c.slug}`).not.toMatch(PRONTO);
        // El aviso de «dónde funciona hoy» nombra OTRAS ciudades: se mira el resto de la página.
        const sinDondeHoy = visible(html.replace(/<p class="lugar-donde-hoy"[\s\S]*?<\/p>/, ''));
        if (abierta) expect(texto, `${idioma} ${c.slug}`).toMatch(/ya funciona|now live/i);
        else expect(sinDondeHoy, `${idioma} ${c.slug}`).not.toMatch(AFIRMA);
      }
    for (const r of RUTAS_TARIFAS())
      for (const idioma of ['es', 'en'] as const)
        expect(visible(renderToString(<PaginaLugar ruta={r} idioma={idioma} />))).not.toMatch(
          PRONTO,
        );
  });

  it('manda el servidor: si El Vigía se cierra, su página ya no dice que funciona (ni «pronto»)', async () => {
    servidor({ paises: { VE: [{ id: 'moto', es: 'Moto', en: 'Moto' }] }, ciudades: {} });
    window.history.pushState(null, '', '/city/el-vigia');
    const { container } = render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/^Divoox in El Vigía$/),
    );
    const main = container.querySelector('main')!;
    expect(main.textContent).not.toMatch(AFIRMA);
    expect(main.textContent).not.toMatch(PRONTO);
  });

  it('una ciudad que abre lo dice claro, con lo que tiene abierto', async () => {
    servidor({
      paises: { VE: [{ id: 'moto', es: 'Moto', en: 'Moto' }] },
      ciudades: { VE: { caracas: [{ id: 'carro', es: 'Carro', en: 'Car' }] } },
    });
    window.history.pushState(null, '', '/es/city/caracas');
    render(<App />);
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Divoox en Caracas: ya funciona',
      ),
    );
    expect(document.querySelector('main .ld-entrada')?.textContent).toMatch(/viajes en carro/);
  });

  it('todas van al mapa del sitio y llevan su hreflang (el prearmado arma ambas desde la misma lista)', () => {
    const fuente = readFileSync(join(__dirname, '..', '..', 'scripts', 'prerender.mjs'), 'utf8');
    expect(fuente).toMatch(/\.\.\.CIUDADES\.map\(\(c\) => `\/city\/\$\{c\.slug\}`\)/);
    expect(fuente).toMatch(/\.\.\.RUTAS_TARIFAS\(\)/);
    // El mapa del sitio sale de la misma lista de páginas, en los dos idiomas.
    expect(fuente).toMatch(/paginas\.map\(\(p\) => `\s*<url><loc>/);
    expect(fuente).toMatch(/for \(const lengua of \['en', 'es'\]\)/);
    // El hreflang en, es y x-default va en toda página (la única excepción es la de videos).
    expect(fuente).toMatch(/hreflang="x-default"/);
    expect(fuente).toMatch(/ruta === '\/docs\/videos' && !videosEnIdioma/);
    expect(RUTAS_TARIFAS()).toContain('/city/el-vigia/prices');
  });
});

describe('C-TARIFAS-PUBLICAS: la página de tarifas lee los datos del sistema', () => {
  beforeEach(() => {
    localStorage.clear();
    olvidarPaisesAbiertos();
    olvidarTarifas();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('el HTML prearmado sale de los precios guardados (no de un texto fijo)', () => {
    const t = TARIFAS_PUBLICADAS['el-vigia']!;
    const l = lugaresDe(t).find((x) => x.ida && x.ida.dia >= 1000)!;
    const html = renderToString(<PaginaLugar ruta="/city/el-vigia/prices" idioma="en" />);
    expect(html).toContain(l.lugar);
    expect(html).toContain(`$${(l.ida!.dia / 100).toFixed(2)}`);
  });

  it('si cambia un precio en el servidor, cambia la página; sin precios, no inventa ninguno', async () => {
    const t = structuredClone(TARIFAS_PUBLICADAS['el-vigia']!);
    const l = lugaresDe(t)[0]!;
    l.ida = { dia: 777, noche: 1010 };
    servidor({ tarifas: { 'el-vigia': t } });
    window.history.pushState(null, '', '/city/el-vigia/prices');
    const { unmount } = render(<App />);
    const fila = await screen.findByRole('rowheader', { name: (n) => n.includes(l.lugar) });
    await waitFor(() => expect(fila.parentElement?.textContent).toContain('$7.77'));
    expect(fila.parentElement?.textContent).toContain('$10.10');
    unmount();

    olvidarTarifas();
    servidor({ tarifas: {} });
    window.history.pushState(null, '', '/city/el-vigia/prices');
    render(<App />);
    await waitFor(() =>
      expect(document.querySelector('main')?.textContent).toMatch(/no fixed prices posted/),
    );
    expect(document.querySelector('.tarifas-tabla')).toBeNull();
  });

  it('el guion de compilación no guarda precios con datos internos ni rotos', () => {
    const t = TARIFAS_PUBLICADAS['el-vigia'];
    expect(validarTarifas(t)).toEqual(t);
    expect(
      validarTarifas({
        ...t,
        grupos: [
          {
            grupo: 'x',
            lugares: [{ lugar: 'a', ida: { dia: 0, noche: null }, regreso: null, idaVuelta: null }],
          },
        ],
      }),
    ).toBeNull();
    expect(validarTarifas({ ...t, id: 'VE-MER-ELVIGIA' })).toBeNull();
    // Un servidor de antes (sin ciudades) no borra las ciudades guardadas: devuelve solo países.
    expect(validar({ paises: { VE: [{ id: 'moto', es: 'Moto', en: 'Moto' }] } })).toEqual({
      paises: { VE: [{ id: 'moto', es: 'Moto', en: 'Moto' }] },
    });
    expect(
      validar({
        paises: {},
        ciudades: { VE: { 'el-vigia': [{ id: 'moto', es: 'Moto', en: 'Moto' }] } },
      })?.ciudades,
    ).toEqual({ VE: { 'el-vigia': [{ id: 'moto', es: 'Moto', en: 'Moto' }] } });
  });
});
