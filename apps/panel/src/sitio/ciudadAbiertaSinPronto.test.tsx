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
import {
  TARIFAS_PUBLICADAS,
  type TarifasPublicas,
  lugaresDe,
  olvidarTarifas,
} from './tarifasCiudades';
// @ts-expect-error: guion de compilación en JavaScript, sin tipos.
import { tarifasDe, validar, validarTarifas } from '../../scripts/estado-paises.mjs';

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
/** Unos precios como los que da el servidor (la forma real de `GET /datos/web/tarifas/:ciudad`). */
const EL_VIGIA: TarifasPublicas = {
  ciudad: 'el-vigia',
  servicio: 'moto',
  moneda: 'USD',
  centro: 'El Vigía (casco urbano)',
  grupos: [
    {
      grupo: 'Vía Mérida',
      lugares: [
        {
          lugar: 'La Vega I',
          ida: { dia: 200, noche: 260 },
          regreso: { dia: 200, noche: 260 },
          idaVuelta: null,
        },
        { lugar: 'Mérida', ida: { dia: 3000, noche: 3900 }, regreso: null, idaVuelta: null },
      ],
    },
  ],
  otros: [],
  minimo: { dia: 100, noche: 130 },
  noche: { recargoPb: 3000, desdeH: 21, hastaH: 6, zonaHoraria: 'America/Caracas' },
  actualizado: '2026-11-25',
};
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

  it('cada ciudad sin servicio tiene su descripción única (empieza por su nombre), su texto propio y dice con honestidad que aún no hay conductores', () => {
    for (const idioma of ['es', 'en'] as const) {
      const entradas = new Set<string>();
      for (const c of VENEZUELA) {
        const html = renderToString(<PaginaLugar ruta={`/city/${c.slug}`} idioma={idioma} />);
        // De este párrafo sale la meta descripción del HTML prearmado.
        const entrada = (/<p class="ld-entrada"[^>]*>([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '')
          .replace(/<[^>]+>/g, '')
          .replace(/&#x27;|&quot;|&amp;/g, '');
        if (CIUDADES_ABIERTAS_PUBLICADAS.VE?.[c.clave!]?.length) continue;
        expect(entrada.startsWith(c.nombre[idioma]), `${idioma} ${c.slug}: ${entrada}`).toBe(true);
        expect(entrada).toMatch(
          idioma === 'es'
            ? /aún no hay conductores de Divoox/
            : /no Divoox drivers in the city yet/,
        );
        expect(entrada).toMatch(idioma === 'es' ? /Sé de los primeros/ : /Be one of the first/);
        entradas.add(entrada.slice(0, 155));
        // «Cómo se pide» no suena a que ya existe aquí: lleva la frase puente honesta.
        const pasos = /<section class="lugar-pasos"[^>]*><h2>([\s\S]*?)<\/h2>/.exec(html)?.[1];
        expect(pasos, `${idioma} ${c.slug}`).toBe(
          idioma === 'es'
            ? 'Así funciona Divoox donde ya está activo'
            : 'How Divoox works where it is already live',
        );
        expect(c.sobre?.[idioma]).toBeTruthy();
        expect(visible(html)).toContain(c.sobre![idioma].slice(0, 40));
      }
      const cerradas = VENEZUELA.filter(
        (c) => !CIUDADES_ABIERTAS_PUBLICADAS.VE?.[c.clave!]?.length,
      );
      expect(entradas.size).toBe(cerradas.length);
    }
  });

  it('los datos de cada ciudad son precisos (revisión del 25 nov): Maracay cerca del lago, sin Guri en Ciudad Guayana, Caja Seca en el sureste del Zulia', () => {
    const sobre = (slug: string, i: 'es' | 'en') =>
      VENEZUELA.find((c) => c.slug === slug)?.sobre?.[i] ?? '';
    expect(sobre('maracay', 'es')).toContain('cerca del Lago de Valencia');
    expect(sobre('maracay', 'en')).toContain('near Lake Valencia');
    for (const i of ['es', 'en'] as const) expect(sobre('ciudad-guayana', i)).not.toMatch(/Guri/);
    expect(sobre('tucani', 'es')).toContain('Caja Seca, ya en el sureste del Zulia');
    expect(sobre('tucani', 'en')).toContain('Caja Seca, in southeastern Zulia');
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
    // Solo entran las ciudades con precios confirmados por producción al publicar.
    expect(RUTAS_TARIFAS()).toEqual(
      Object.keys(TARIFAS_PUBLICADAS).map(
        (k) => `/city/${CIUDADES.find((c) => c.clave === k)?.slug ?? k}/prices`,
      ),
    );
  });
});

describe('C-TARIFAS-PUBLICAS: la página de tarifas lee los datos del sistema', () => {
  beforeEach(() => {
    localStorage.clear();
    olvidarPaisesAbiertos();
    olvidarTarifas();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sin precios confirmados por producción al publicar, el HTML fijo no trae ninguno ni la página entra al mapa', () => {
    // Lo guardado en el repositorio solo puede venir de producción (estado-paises.mjs): vacío, nada.
    if (!Object.keys(TARIFAS_PUBLICADAS).length) {
      expect(RUTAS_TARIFAS()).toEqual([]);
      const html = renderToString(<PaginaLugar ruta="/city/el-vigia/prices" idioma="en" />);
      expect(html).not.toMatch(/\$\d/);
      expect(html).toMatch(/no fixed prices posted/);
    }
  });

  it('sin respuesta del servidor y sin nada guardado, no muestra precios', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('sin red')));
    window.history.pushState(null, '', '/city/el-vigia/prices');
    render(<App />);
    await new Promise((x) => setTimeout(x, 50));
    if (!TARIFAS_PUBLICADAS['el-vigia'])
      expect(document.querySelector('.tarifas-tabla')).toBeNull();
  });

  it('si cambia un precio en el servidor, cambia la página; sin precios, no inventa ninguno', async () => {
    const t = structuredClone(EL_VIGIA);
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
    const t = EL_VIGIA;
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

  it('al compilar: una ciudad que dejó de estar abierta pierde sus precios; un fallo pasajero de una abierta conserva lo guardado', async () => {
    const moto = [{ id: 'moto', es: 'Moto', en: 'Moto' }];
    const guardadas = { 'el-vigia': EL_VIGIA, tucani: { ...EL_VIGIA, ciudad: 'tucani' } };
    // Tucaní ya no está abierta: se quita aunque la petición de El Vigía falle.
    const r1 = await tarifasDe({ VE: { 'el-vigia': moto } }, guardadas, async () => {
      throw new Error('sin red');
    });
    expect(Object.keys(r1.tarifas)).toEqual(['el-vigia']);
    expect(r1.tarifas['el-vigia']).toEqual(EL_VIGIA);
    expect(r1.avisos.join(' ')).toMatch(/el-vigia.*queda lo guardado/);
    // Una respuesta 500 también conserva lo guardado de la ciudad abierta.
    const r2 = await tarifasDe({ VE: { 'el-vigia': moto } }, guardadas, async () => ({
      estado: 500,
    }));
    expect(r2.tarifas['el-vigia']).toEqual(EL_VIGIA);
    // 404 = sin precios publicados hoy: se quita.
    const r3 = await tarifasDe({ VE: { 'el-vigia': moto } }, guardadas, async () => ({
      estado: 404,
    }));
    expect(r3.tarifas).toEqual({});
    // Respuesta buena: manda la de producción.
    const nueva = { ...EL_VIGIA, actualizado: '2026-11-26' };
    const r4 = await tarifasDe({ VE: { 'el-vigia': moto } }, guardadas, async () => ({
      estado: 200,
      datos: nueva,
    }));
    expect(r4.tarifas).toEqual({ 'el-vigia': nueva });
    // Una ciudad abierta sin Moto no pide precios.
    const r5 = await tarifasDe(
      { VE: { tucani: [{ id: 'envios', es: 'Envíos', en: 'Delivery' }] } },
      guardadas,
      async () => ({ estado: 200, datos: nueva }),
    );
    expect(r5.tarifas).toEqual({});
  });
});
