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
  portadaRespaldo,
  serviciosAbiertos,
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

describe('C-PORTADA-SOLO-ABIERTOS: la portada de fábrica anuncia solo servicios abiertos en la ciudad', () => {
  const vueltas = (abiertos: Set<string>) =>
    new Set([0, 1, 2, 3, 4, 5].map((v) => portadaRespaldo('es', v, (id) => abiertos.has(id)).id));

  it('ciudad solo con comida: solo la portada de comida, nunca moto ni mercado', () => {
    const abiertos = serviciosAbiertos([
      s('comida'),
      s('moto', 'muy_pronto'),
      s('mercado', 'no_disponible_zona'),
    ]);
    expect([...abiertos]).toEqual(['comida']);
    expect(vueltas(abiertos)).toEqual(new Set(['respaldo-comida']));
  });

  it('comida NO cuenta como abierta si la ciudad no la tiene (aunque la grilla la muestre)', () => {
    expect(serviciosAbiertos([s('comida', 'no_disponible_zona'), s('moto')]).has('comida')).toBe(
      false,
    );
  });

  it('sin ningún servicio abierto (o con el catálogo todavía cargando): la portada neutra de marca', () => {
    expect(vueltas(serviciosAbiertos([s('comida', 'muy_pronto')]))).toEqual(
      new Set(['respaldo-marca']),
    );
    expect(vueltas(serviciosAbiertos(null))).toEqual(new Set(['respaldo-marca']));
    const marca = portadaRespaldo('en', 0, () => false);
    expect(marca.destino).toBeNull();
    expect(marca.titulo).toBe('Welcome to Divoox');
    expect(portadaRespaldo('es', 0, () => false).titulo).toBe('Bienvenido a Divoox');
  });

  it('el inicio del cliente arma la portada de fábrica con los servicios abiertos (no con la grilla)', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const i = readFileSync(
      join(__dirname, '..', '..', '..', 'apps/cliente/src/Inicio.tsx'),
      'utf8',
    );
    expect(i).toMatch(/serviciosAbiertos\(servicios\?\.servicios \?\? null\)/);
    expect(i).toMatch(/portadaRespaldo\(idioma, vez, \(id\) => abiertos\.has\(id\)\)/);
  });
});
