import { describe, expect, it } from 'vitest';
import {
  BANNERS_RESPALDO,
  SERVICIOS_INICIO,
  destinoDeBanner,
  leerBanner,
  ordenarPorUso,
  rutaBanners,
  rutaDeServicio,
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

  it('solo sale lo que funciona en la ciudad (C-SOLO-LO-TERMINADO); Más va siempre al final', () => {
    const lista = [
      s('moto'),
      s('comida'),
      s('farmacia', 'muy_pronto'),
      s('envios', 'no_disponible_zona'),
      s('carro'),
      s('mas'),
    ];
    expect(serviciosDelInicio(lista).map((x) => x.id)).toEqual(['comida', 'carro', 'moto', 'mas']);
  });

  it('sin catálogo todavía (cargando o sin red) se ven Comida y Más, nunca una pantalla vacía', () => {
    expect(serviciosDelInicio(null).map((x) => x.id)).toEqual(['comida', 'mas']);
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
    expect(r.lista.map((x) => x.id)).toEqual(['moto', 'envios', 'comida', 'carro', 'mas']);
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
