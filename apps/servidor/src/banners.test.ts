import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type Banner,
  TOPE_IMAGENES_DIA,
  aplicaA,
  elegirPorPeso,
  olvidarCacheBanners,
  ordenarPromociones,
  reservarImagenes,
  saludBanners,
  urlDeFal,
  vigente,
  visiblesPara,
} from './banners';
import type { Env } from './env';
import { MODELO_BANNERS, ModeloNoAprobado, asegurarModeloBarato } from './modeloGuard';
import { contarFilas } from './presupuestoFilas';
import { mundo } from './pruebas/ayuda';

/**
 * C-BANNERS (17 nov 2026, Richard) — todos los países. El administrador de banners del inicio de la
 * app. Comprobado en ROJO, metiendo cada fallo a propósito: sin el filtro de estado (en el SQL de
 * `publicadosDe` y en `visiblesPara`) el borrador sale en la ruta pública; sin la fecha, sale el de
 * fecha futura; sin la condición del tope en `reservarImagenes`, el tope deja pasar más de 30; con
 * `asegurarModeloBarato` vacío, un modelo caro corre; sin `excluir`, la cabecera repite; y sin el
 * filtro de ciudad, El Vigía sale en Miami.
 */
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  olvidarCacheBanners();
});

const AHORA = Date.parse('2026-11-17T15:00:00Z');

describe('C-BANNERS · reglas puras', () => {
  it('vigente por fecha: no antes del inicio ni desde el fin', () => {
    expect(vigente({ inicio: null, fin: null }, AHORA)).toBe(true);
    expect(vigente({ inicio: '2026-11-18T00:00:00Z', fin: null }, AHORA)).toBe(false);
    expect(vigente({ inicio: null, fin: '2026-11-17T15:00:00Z' }, AHORA)).toBe(false);
    expect(vigente({ inicio: '2026-11-01T00:00:00Z', fin: '2026-12-01T00:00:00Z' }, AHORA)).toBe(
      true,
    );
  });

  it('ciudad y país: sin nada sale en todas partes; con ciudades o países, solo ahí', () => {
    const vigia = { zona: 'VE-MER-ELVIGIA', pais: 'VE' };
    const novi = { zona: 'US-MI-NOVI', pais: 'US' };
    expect(aplicaA({ zonas: [], paises: [] }, vigia)).toBe(true);
    expect(aplicaA({ zonas: ['VE-MER-ELVIGIA'], paises: [] }, vigia)).toBe(true);
    expect(aplicaA({ zonas: ['VE-MER-ELVIGIA'], paises: [] }, novi)).toBe(false);
    expect(aplicaA({ zonas: [], paises: ['US'] }, novi)).toBe(true);
    expect(aplicaA({ zonas: [], paises: ['US'] }, vigia)).toBe(false);
    expect(aplicaA({ zonas: ['VE-MER-ELVIGIA'], paises: [] }, { zona: null, pais: null })).toBe(
      false,
    );
  });

  it('rotación por peso: el de peso 3 sale tres veces más, y nunca repite el anterior', () => {
    const l = [
      { id: 'a', peso: 1 },
      { id: 'b', peso: 3 },
    ];
    const cuenta = { a: 0, b: 0 };
    for (let i = 0; i < 400; i++) {
      const e = elegirPorPeso(l, i / 400);
      if (e) cuenta[e.id as 'a' | 'b']++;
    }
    expect(cuenta).toEqual({ a: 100, b: 300 });
    for (let i = 0; i < 20; i++) expect(elegirPorPeso(l, i / 20, 'b')?.id).toBe('a');
    expect(elegirPorPeso([{ id: 'solo', peso: 1 }], 0.5, 'solo')?.id).toBe('solo');
    expect(elegirPorPeso([], 0.5)).toBeNull();
  });

  it('un borrador o un pausado nunca es visible, aunque esté vigente y en su ciudad', () => {
    const base = { zonas: [], paises: [], inicio: null, fin: null };
    const l = [
      { ...base, id: 'b', estado: 'borrador' as const },
      { ...base, id: 'p', estado: 'pausado' as const },
      { ...base, id: 'ok', estado: 'publicado' as const },
    ] as unknown as Banner[];
    expect(visiblesPara(l, { zona: 'X', pais: 'US' }, AHORA).map((b) => b.id)).toEqual(['ok']);
  });

  it('el carrusel va por orden y, a igual orden, por peso', () => {
    const l = ordenarPromociones([
      { id: 'x', orden: 2, peso: 1 },
      { id: 'y', orden: 1, peso: 1 },
      { id: 'z', orden: 1, peso: 9 },
    ]);
    expect(l.map((b) => b.id)).toEqual(['z', 'y', 'x']);
  });

  it('solo se descargan imágenes del almacén de fal', () => {
    expect(urlDeFal('https://v3.fal.media/files/a.png')).toBe(true);
    expect(urlDeFal('http://v3.fal.media/files/a.png')).toBe(false);
    expect(urlDeFal('https://fal.media.ataque.com/a.png')).toBe(false);
    expect(urlDeFal('https://169.254.169.254/latest')).toBe(false);
  });
});

describe('C-MODELO-GUARD · un modelo caro no corre nunca', () => {
  it('acepta solo Seedream 4 y rechaza los caros y los desconocidos', () => {
    expect(asegurarModeloBarato(MODELO_BANNERS)).toBeLessThanOrEqual(0.05);
    for (const caro of [
      'fal-ai/flux-pro/v1.1-ultra',
      'fal-ai/imagen4/preview/ultra',
      'openai/gpt-image-1',
      'fal-ai/recraft-v3',
      'fal-ai/ideogram/v3',
      'fal-ai/modelo-nuevo',
    ])
      expect(() => asegurarModeloBarato(caro), caro).toThrow(ModeloNoAprobado);
  });
});

describe('C-BANNERS · tope diario de imágenes con IA', () => {
  it('reserva hasta 30 al día y ni una más; al día siguiente vuelve a haber', async () => {
    const m = mundo();
    for (let i = 0; i < 10; i++) expect(await reservarImagenes(m.DB, 3, 30, AHORA)).toBe(true);
    expect(await reservarImagenes(m.DB, 1, 30, AHORA)).toBe(false);
    expect(await reservarImagenes(m.DB, 31, 30, AHORA + 86_400_000)).toBe(false);
    expect(await reservarImagenes(m.DB, 2, 30, AHORA + 86_400_000)).toBe(true);
    expect(TOPE_IMAGENES_DIA).toBe(30);
  });

  it('el canario dice pendiente sin llave, ok con llave y «tope» al llenarse', async () => {
    const m = mundo();
    const env = { FAL_KEY: 'key-de-prueba-0000000000' } as unknown as Env;
    expect(await saludBanners({} as Env, m.DB, AHORA)).toBe('pendiente');
    expect(await saludBanners(env, m.DB, AHORA)).toBe('ok');
    await reservarImagenes(m.DB, 30, 30, AHORA);
    expect(await saludBanners(env, m.DB, AHORA)).toBe('tope');
  });

  // Revisión de calidad del 18 nov: una generación con IA fallida no es una caída del sitio. Como
  // saludConnect, el canario dice «atrasado» y /datos/salud no responde 503 ni frena publicaciones.
  it('una generación fallida deja el canario «atrasado», nunca «error»', async () => {
    const m = mundo();
    const env = { FAL_KEY: 'key-de-prueba-0000000000' } as unknown as Env;
    const dia = new Date(AHORA).toISOString().slice(0, 10);
    await m.DB.prepare('INSERT INTO config (clave, valor) VALUES (?, ?)')
      .bind(`ia_banners_error:${dia}`, 'fal no respondió')
      .run();
    expect(await saludBanners(env, m.DB, AHORA)).toBe('atrasado');
  });
});

/** fal de mentira: devuelve `n` imágenes y entrega bytes PNG al descargarlas. */
function falDeMentira() {
  // Un PNG real de 1 × 1 (la limpieza de metadatos revisa su estructura).
  const PNG = Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    ),
    (ch) => ch.charCodeAt(0),
  );
  const llamadas: string[] = [];
  const f = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    llamadas.push(u);
    if (u.startsWith('https://fal.run/')) {
      const n = (JSON.parse(String(init?.body)) as { num_images: number }).num_images;
      return Response.json({
        images: Array.from({ length: n }, (_, i) => ({
          url: `https://v3.fal.media/files/${i}.png`,
        })),
      });
    }
    if (u.startsWith('https://v3.fal.media/')) return new Response(PNG);
    return new Response('{}');
  });
  return { f, llamadas };
}

async function preparar(extra: Record<string, unknown> = {}) {
  let conteo!: ReturnType<typeof contarFilas>;
  const m = mundo(extra, {
    envolver: (db) => {
      conteo = contarFilas(db);
      return conteo.db;
    },
  });
  await m.DB.prepare(
    "INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('VE-MER-ELVIGIA', 'El Vigía', 'VE', 'VES', 'America/Caracas', 8.6, -71.65, 20, 1)",
  ).run();
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente');
  const subida = await m.foto('/datos/admin/banners/imagen', admin.token);
  expect(subida.estado).toBe(201);
  const imagen = subida.datos.url as string;
  const nuevo = (cambios: Record<string, unknown> = {}) => ({
    lugar: 'cabecera',
    imagen,
    tituloEs: 'Tu carrera, te llevamos a donde quieras',
    tituloEn: 'Your ride, anywhere you want to go',
    textoEs: 'Pide tu moto en segundos.',
    textoEn: 'Get a moto ride in seconds.',
    destinoTipo: 'servicio',
    destinoValor: 'moto',
    codigo: '',
    zonas: ['VE-MER-ELVIGIA'],
    paises: [],
    inicio: null,
    fin: null,
    peso: 1,
    orden: 0,
    ...cambios,
  });
  const crear = async (cambios: Record<string, unknown> = {}) => {
    const r = await m.llamar('POST', '/datos/admin/banners', nuevo(cambios), admin.token);
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    return r.datos.banner.id as string;
  };
  const publicar = (id: string) =>
    m.llamar('POST', `/datos/admin/banners/${id}/publicar`, {}, admin.token);
  const ver = (q: string) => m.llamar('GET', `/datos/banners?${q}`);
  return { m, admin, cliente, imagen, nuevo, crear, publicar, ver, conteo: () => conteo };
}

describe('C-BANNERS · la ruta pública', () => {
  it('un borrador nunca sale; al aprobar y publicar, sale solo en su ciudad', async () => {
    const { crear, publicar, ver } = await preparar();
    const id = await crear();
    expect((await ver('lugar=cabecera&ciudad=VE-MER-ELVIGIA')).datos.banner).toBeNull();
    expect((await publicar(id)).estado).toBe(200);
    const r = await ver('lugar=cabecera&ciudad=VE-MER-ELVIGIA&idioma=es');
    expect(r.datos.banner.id).toBe(id);
    expect(r.datos.banner.titulo).toBe('Tu carrera, te llevamos a donde quieras');
    expect(r.datos.banner.destino).toEqual({ tipo: 'servicio', valor: 'moto' });
    expect(r.datos.banner.imagen).toMatch(/^https?:\/\/.+\/media\/fotos\/banners\//);
    expect(r.res.headers.get('cache-control')).toBe('no-store');
    // En inglés, el titular en inglés; en otra ciudad, nada.
    expect((await ver('lugar=cabecera&ciudad=VE-MER-ELVIGIA')).datos.banner.titulo).toBe(
      'Your ride, anywhere you want to go',
    );
    expect((await ver('lugar=cabecera&ciudad=US-FL-MIAMI')).datos.banner).toBeNull();
    expect((await ver('lugar=cabecera')).datos.banner).toBeNull();
  });

  it('por país: sale en cualquier ciudad de ese país (el país sale de la ciudad)', async () => {
    const { crear, publicar, ver } = await preparar();
    await publicar(
      await crear({ zonas: [], paises: ['US'], lugar: 'promociones', codigo: 'hola10' }),
    );
    const r = await ver('lugar=promociones&ciudad=US-FL-MIAMI');
    expect(r.datos.banners).toHaveLength(1);
    expect(r.datos.banners[0].codigo).toBe('HOLA10');
    expect(r.res.headers.get('cache-control')).toContain('max-age=60');
    expect((await ver('lugar=promociones&ciudad=VE-MER-ELVIGIA')).datos.banners).toHaveLength(0);
  });

  it('fuera de fecha, pausado o editado después de publicar: no sale', async () => {
    const { m, admin, crear, publicar, ver, nuevo } = await preparar();
    const futuro = await crear({ inicio: '2099-01-01T00:00:00Z' });
    expect((await publicar(futuro)).estado).toBe(200);
    expect((await ver('lugar=cabecera&ciudad=VE-MER-ELVIGIA')).datos.banner).toBeNull();

    const id = await crear();
    await publicar(id);
    expect((await ver('lugar=cabecera&ciudad=VE-MER-ELVIGIA')).datos.banner.id).toBe(id);
    expect(
      (await m.llamar('POST', `/datos/admin/banners/${id}/pausar`, {}, admin.token)).estado,
    ).toBe(200);
    expect((await ver('lugar=cabecera&ciudad=VE-MER-ELVIGIA')).datos.banner).toBeNull();

    await publicar(id);
    const editado = await m.llamar(
      'PUT',
      `/datos/admin/banners/${id}`,
      nuevo({ tituloEs: 'Otro titular' }),
      admin.token,
    );
    expect(editado.datos.banner.estado).toBe('borrador');
    expect((await ver('lugar=cabecera&ciudad=VE-MER-ELVIGIA')).datos.banner).toBeNull();
  });

  it('la cabecera rota por peso y no repite el anterior; el carrusel trae la lista', async () => {
    const { crear, publicar, ver } = await preparar();
    const a = await crear({ peso: 1 });
    const b = await crear({ peso: 5 });
    await publicar(a);
    await publicar(b);
    const vistos = new Set<string>();
    for (let i = 0; i < 30; i++)
      vistos.add((await ver('lugar=cabecera&ciudad=VE-MER-ELVIGIA')).datos.banner.id as string);
    expect(vistos).toEqual(new Set([a, b]));
    for (let i = 0; i < 5; i++)
      expect((await ver(`lugar=cabecera&ciudad=VE-MER-ELVIGIA&excluir=${b}`)).datos.banner.id).toBe(
        a,
      );
  });

  it('mirar no escribe y lee una sola vez por minuto', async () => {
    const { crear, publicar, ver, conteo } = await preparar();
    await publicar(await crear());
    await ver('lugar=cabecera&ciudad=VE-MER-ELVIGIA');
    const antes = { ...conteo().cuenta };
    for (let i = 0; i < 20; i++) await ver('lugar=cabecera&ciudad=VE-MER-ELVIGIA');
    expect(conteo().cuenta.escritas - antes.escritas).toBe(0);
    expect(conteo().cuenta.leidas - antes.leidas).toBeLessThanOrEqual(1);
  });

  it('no publica a medias: sin imagen, sin titular en inglés o con un destino que no existe', async () => {
    const { crear, publicar } = await preparar();
    expect((await publicar(await crear({ imagen: '' }))).estado).toBe(422);
    expect((await publicar(await crear({ tituloEn: '' }))).estado).toBe(422);
    expect((await publicar(await crear({ destinoValor: 'cohetes' }))).estado).toBe(422);
    expect(
      (await publicar(await crear({ destinoTipo: 'cupon', destinoValor: 'NOEXISTE' }))).estado,
    ).toBe(422);
  });

  it('solo el equipo maneja los banners', async () => {
    const { m, cliente, nuevo } = await preparar();
    expect((await m.llamar('GET', '/datos/admin/banners', undefined, cliente.token)).estado).toBe(
      403,
    );
    expect((await m.llamar('POST', '/datos/admin/banners', nuevo(), cliente.token)).estado).toBe(
      403,
    );
  });
});

describe('C-BANNERS · generar con IA', () => {
  it('sin la llave de fal, se apaga con un mensaje claro y no llama a nadie', async () => {
    const { f } = falDeMentira();
    vi.stubGlobal('fetch', f);
    const { m, admin } = await preparar();
    const r = await m.llamar(
      'POST',
      '/datos/admin/banners/generar',
      { idea: 'Una moto roja en la calle', lugar: 'cabecera' },
      admin.token,
    );
    expect(r.estado).toBe(409);
    expect(f).not.toHaveBeenCalled();
  });

  it('con la llave: tres opciones del modelo aprobado y, al llegar al tope, 429 sin llamar', async () => {
    const { f, llamadas } = falDeMentira();
    vi.stubGlobal('fetch', f);
    const { m, admin } = await preparar({
      FAL_KEY: 'key-de-prueba-0000000000',
      TOPE_BANNERS_IA_DIA: '6',
    });
    const pedir = () =>
      m.llamar(
        'POST',
        '/datos/admin/banners/generar',
        { idea: 'Una pizza recién salida del horno', lugar: 'promociones', cantidad: 3 },
        admin.token,
      );
    const r = await pedir();
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    expect(r.datos.opciones).toHaveLength(3);
    for (const o of r.datos.opciones) expect(o).toMatch(/^\/media\/fotos\/banners\/ia-.+\.png$/);
    const modelos = llamadas.filter((u) => u.startsWith('https://fal.run/'));
    expect(modelos).toEqual([`https://fal.run/${MODELO_BANNERS}`]);
    expect((await pedir()).estado).toBe(200);
    const antes = f.mock.calls.length;
    const tope = await pedir();
    expect(tope.estado).toBe(429);
    expect(f.mock.calls.length).toBe(antes);
  });

  it('si el modelo falla, se cae con error y no prueba otro modelo', async () => {
    const f = vi.fn(async () => new Response('caído', { status: 500 }));
    vi.stubGlobal('fetch', f);
    const { m, admin } = await preparar({ FAL_KEY: 'key-de-prueba-0000000000' });
    const r = await m.llamar(
      'POST',
      '/datos/admin/banners/generar',
      { idea: 'Un carrito lleno de mercado', lugar: 'cabecera', cantidad: 2 },
      admin.token,
    );
    expect(r.estado).toBe(503);
    expect(f).toHaveBeenCalledTimes(1);
    expect(String((f.mock.calls[0] as unknown[])[0])).toBe(`https://fal.run/${MODELO_BANNERS}`);
    // Se ve en la salud, pero como «atrasado»: no tumba el sitio (revisión del 18 nov).
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.banners).toBe('atrasado');
  });
});

describe('C-BANNER-SIN-CORTES · título demasiado largo', () => {
  it('el servidor lo rechaza con un 400 en palabras claras (lo muestra el superadmin)', async () => {
    const { m, admin, nuevo } = await preparar();
    const r = await m.llamar(
      'POST',
      '/datos/admin/banners',
      nuevo({ tituloEs: 'x'.repeat(60) }),
      admin.token,
    );
    expect(r.estado).toBe(400);
    expect(r.datos.error).toMatch(/45 caracteres/);
  });
});
