import { describe, expect, it } from 'vitest';
import {
  BANNERS_RESPALDO,
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

  it('los banners de respaldo no prometen descuentos que no existen (solo la portada, sin código)', () => {
    for (const idioma of ['es', 'en'] as const) {
      const l = BANNERS_RESPALDO[idioma];
      expect(l.length).toBe(3);
      for (const x of l) {
        expect(x.codigo).toBeNull();
        expect(x.titulo).not.toMatch(/\$|%|gratis|free|descuento|off/i);
      }
    }
  });
});
