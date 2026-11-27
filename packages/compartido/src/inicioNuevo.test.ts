import { describe, expect, it } from 'vitest';
import {
  CABECERAS_MARCA,
  TOPES_BANNER,
  cabeceraAbierta,
  cabeceraDeMarca,
  SERVICIOS_INICIO,
  destinoDeBanner,
  leerBanner,
  ordenarPorUso,
  rutaBanners,
  accionDeServicio,
  rutaDeServicio,
  serviciosAbiertos,
  serviciosDelInicio,
} from './inicioNuevo';

/**
 * C-INICIO-NUEVO (17 nov 2026, borrador aprobado por Richard): la lógica sin pantalla del inicio del
 * cliente. Ocho servicios en cuatro columnas, sin pantallas intermedias, portada y promociones del
 * administrador de banners, con respaldo local.
 */
const s = (id: string, accion = 'abrir', orden = 0) => ({
  id,
  nombre: id,
  descripcion: '',
  icono: '',
  orden,
  estado: 'disponible' as const,
  accion: accion as 'abrir',
});

describe('servicios del inicio (C-INICIO-NUEVO)', () => {
  it('el orden del borrador: Comida, Mercado, Farmacia, Licores, Viajes, Moto, Envíos y Más', () => {
    expect(SERVICIOS_INICIO).toEqual([
      'comida',
      'mercado',
      'farmacia',
      'licores',
      'carro',
      'moto',
      'envios',
      'mas',
    ]);
  });

  // C-OCHO-ICONOS-SIEMPRE (18 nov 2026, orden de Richard): los ocho se pintan SIEMPRE, en cualquier
  // ciudad y país, con o sin cuenta. Lo cerrado no se esconde: al tocarlo abre la hoja «aún no hay».
  const OCHO = ['comida', 'mercado', 'farmacia', 'licores', 'carro', 'moto', 'envios', 'mas'];
  it('con un solo servicio abierto, el inicio entrega los ocho en el orden del borrador', () => {
    expect(serviciosDelInicio([s('comida'), s('mas')]).map((x) => x.id)).toEqual(OCHO);
    const lista = [
      s('moto'),
      s('comida'),
      s('farmacia', 'muy_pronto'),
      s('envios', 'no_disponible_zona'),
      s('carro'),
      s('mas'),
    ];
    expect(serviciosDelInicio(lista).map((x) => x.id)).toEqual(OCHO);
  });

  it('sin catálogo todavía (cargando o sin red) también salen los ocho, nunca una pantalla vacía', () => {
    expect(serviciosDelInicio(null).map((x) => x.id)).toEqual(OCHO);
  });

  it('abiertos: solo lo que el catálogo de la ciudad deja abrir', () => {
    const abiertos = serviciosAbiertos([s('comida'), s('moto', 'muy_pronto'), s('envios')]);
    expect([...abiertos].sort()).toEqual(['comida', 'envios']);
    expect(serviciosAbiertos(null).size).toBe(0);
  });

  it('tocar uno abierto navega como antes; uno cerrado abre la hoja «aún no hay» y no navega', () => {
    const cat = [s('comida'), s('moto', 'no_disponible_zona'), s('mas')];
    expect(accionDeServicio('comida', cat)).toEqual({
      tipo: 'navegar',
      ruta: { pathname: '/restaurants' },
    });
    expect(accionDeServicio('moto', cat)).toEqual({ tipo: 'aun_no_hay', servicio: 'moto' });
    expect(accionDeServicio('mercado', cat)).toEqual({ tipo: 'aun_no_hay', servicio: 'mercado' });
    expect(accionDeServicio('mas', cat)).toEqual({ tipo: 'mas' });
    // Comida cerrada en la zona también avisa (nunca una lista vacía sin explicación).
    expect(accionDeServicio('comida', [s('comida', 'no_disponible_zona')])).toEqual({
      tipo: 'aun_no_hay',
      servicio: 'comida',
    });
    // Sin catálogo (sin red) no se afirma que no hay: se navega y la pantalla vuelve a preguntar.
    expect(accionDeServicio('moto', null)).toEqual({
      tipo: 'navegar',
      ruta: { pathname: '/ride', params: { servicio: 'moto' } },
    });
  });

  it('cada servicio abre su pantalla directa: ni «Abrir» ni pantallas intermedias', () => {
    expect(rutaDeServicio('comida')).toEqual({ pathname: '/restaurants' });
    expect(rutaDeServicio('moto')).toEqual({ pathname: '/ride', params: { servicio: 'moto' } });
    expect(rutaDeServicio('carro')).toEqual({ pathname: '/ride', params: { servicio: 'carro' } });
    expect(rutaDeServicio('envios')).toEqual({ pathname: '/ride', params: { servicio: 'envios' } });
    expect(rutaDeServicio('mercado')).toEqual({
      pathname: '/stores',
      params: { servicio: 'mercado' },
    });
    expect(rutaDeServicio('mas')).toBeNull();
    for (const id of SERVICIOS_INICIO)
      expect(JSON.stringify(rutaDeServicio(id) ?? '')).not.toContain('/service/');
  });

  it('«Ordenado por lo que más usas»: con tres usos o más, lo más usado primero; Más sigue al final', () => {
    const lista = serviciosDelInicio([s('comida'), s('moto'), s('carro'), s('envios'), s('mas')]);
    expect(ordenarPorUso(lista, { moto: 1 }).ordenado).toBe(false);
    const r = ordenarPorUso(lista, { moto: 5, envios: 2 });
    expect(r.ordenado).toBe(true);
    expect(r.lista.map((x) => x.id)).toEqual([
      'moto',
      'envios',
      'comida',
      'mercado',
      'farmacia',
      'licores',
      'carro',
      'mas',
    ]);
  });
});

describe('banners del inicio (C-INICIO-BANNERS)', () => {
  it('la ruta pública del administrador de banners, con ciudad, idioma y el último visto', () => {
    expect(rutaBanners('cabecera', { ciudad: 'VE-MER-ELVIGIA', idioma: 'es', excluir: 'b1' })).toBe(
      '/datos/banners?lugar=cabecera&idioma=es&ciudad=VE-MER-ELVIGIA&excluir=b1',
    );
    expect(rutaBanners('promociones', { ciudad: null, idioma: 'en' })).toBe(
      '/datos/banners?lugar=promociones&idioma=en',
    );
  });

  it('lee el banner que manda el servidor y descarta lo que viene roto', () => {
    expect(
      leerBanner({
        id: 'b1',
        titulo: 'Tu carrera',
        texto: '',
        imagen: 'https://x/media/fotos/banners/a.webp',
        destino: { tipo: 'servicio', valor: 'moto' },
        codigo: 'MOTO50',
      }),
    ).toMatchObject({ id: 'b1', titulo: 'Tu carrera', codigo: 'MOTO50' });
    expect(leerBanner({ id: 'b2' })).toBeNull();
    expect(leerBanner(null)).toBeNull();
  });

  it('el destino de un banner: servicio, restaurante, tienda o cupón', () => {
    const b = (tipo: string, valor: string) =>
      leerBanner({ id: 'x', titulo: 't', destino: { tipo, valor } })!;
    expect(destinoDeBanner(b('servicio', 'moto'))).toEqual({
      pathname: '/ride',
      params: { servicio: 'moto' },
    });
    expect(destinoDeBanner(b('restaurante', 'r1'))).toEqual({ pathname: '/restaurant/r1' });
    expect(destinoDeBanner(b('tienda', 't1'))).toEqual({ pathname: '/store/t1' });
    expect(destinoDeBanner(b('cupon', 'MOTO50'))).toEqual({
      pathname: '/notifications',
      params: { tab: 'regalos' },
    });
  });

  it('las cabeceras de marca no prometen descuentos que no existen (solo la portada, sin código)', () => {
    for (const idioma of ['es', 'en'] as const) {
      const l = CABECERAS_MARCA[idioma];
      expect(l.length).toBe(10);
      for (const x of l) {
        expect(x.codigo).toBeNull();
        expect(x.titulo).not.toMatch(/\$|%|gratis|free|descuento|off|pronto|soon|beta/i);
        // C-BANNER-SIN-CORTES: cabe en un teléfono de 360.
        expect(x.titulo.length).toBeLessThanOrEqual(TOPES_BANNER.titulo);
      }
    }
  });
});

/**
 * C-CABECERAS-MARCA, C-CABECERA-SOLO-ABIERTOS y C-CABECERA-ROTA (27 nov 2026, orden de Richard vía
 * Gerencia): diez cabeceras con todo lo que hace Divoox; solo las de servicios abiertos en la
 * ciudad; y dos aperturas seguidas nunca repiten.
 */
describe('cabeceras de marca (C-CABECERAS-MARCA)', () => {
  const TODOS = new Set([
    'comida',
    'mercado',
    'farmacia',
    'licores',
    'carro',
    'moto',
    'envios',
    'mas',
  ]);

  it('son diez, cada una con su imagen propia y el mismo orden en los dos idiomas', () => {
    const es = CABECERAS_MARCA.es;
    const en = CABECERAS_MARCA.en;
    expect(es.map((c) => c.id)).toEqual(en.map((c) => c.id));
    expect(new Set(es.map((c) => c.local)).size).toBe(10);
    expect(es.map((c) => c.id).sort()).toEqual(
      [
        'marca-aliados',
        'marca-billetera',
        'marca-carro',
        'marca-comida',
        'marca-envios',
        'marca-farmacia',
        'marca-ferreteria',
        'marca-licores',
        'marca-mercado',
        'marca-moto',
      ].sort(),
    );
  });

  it('C-CABECERA-SOLO-ABIERTOS: una cabecera de un servicio cerrado nunca sale', () => {
    // El Vigía hoy: Moto, Carro y Envíos abiertos; Comida y las tiendas, no.
    const vigia = new Set(['moto', 'carro', 'envios']);
    const vistas = new Set<string>();
    let ultima: string | null = null;
    for (let i = 0; i < 40; i++) {
      const c = cabeceraDeMarca('es', ultima, vigia);
      expect(cabeceraAbierta(c, vigia)).toBe(true);
      vistas.add(c.id);
      ultima = c.id;
    }
    expect([...vistas].sort()).toEqual(
      ['marca-aliados', 'marca-billetera', 'marca-carro', 'marca-envios', 'marca-moto'].sort(),
    );
    // Sin Carro en la ciudad, la de Carro no sale nunca (ni la de Comida sin restaurantes).
    for (const c of CABECERAS_MARCA.es)
      if (c.id === 'marca-carro' || c.id === 'marca-comida')
        expect(cabeceraAbierta(c, new Set(['moto']))).toBe(false);
  });

  it('C-CABECERA-ROTA: dos aperturas seguidas no repiten, y todas tienen su turno', () => {
    let ultima: string | null = null;
    const vistas: string[] = [];
    for (let i = 0; i < 10; i++) {
      const c = cabeceraDeMarca('en', ultima, TODOS);
      expect(c.id).not.toBe(ultima);
      vistas.push(c.id);
      ultima = c.id;
    }
    expect(new Set(vistas).size).toBe(10);
  });

  it('en una ciudad sin nada abierto sale la que no promete ningún servicio', () => {
    const c = cabeceraDeMarca('es', null, new Set());
    expect(c.id).toBe('marca-aliados');
    expect(c.requiere).toEqual([]);
    expect(cabeceraDeMarca('es', 'marca-aliados', new Set()).id).toBe('marca-aliados');
  });

  it('cada una lleva a su pantalla (las de un servicio, a ese servicio)', () => {
    for (const c of CABECERAS_MARCA.es) {
      if (c.destino?.tipo === 'servicio') expect(c.requiere).toEqual([c.destino.valor]);
    }
    const por = (id: string) => CABECERAS_MARCA.es.find((c) => c.id === id)!;
    expect(destinoDeBanner(por('marca-billetera'))).toEqual({ pathname: '/gift-cards' });
    expect(destinoDeBanner(por('marca-ferreteria'))).toEqual({
      pathname: '/stores',
      params: { servicio: 'mas' },
    });
    expect(destinoDeBanner(por('marca-carro'))).toEqual({
      pathname: '/ride',
      params: { servicio: 'carro' },
    });
  });
});
