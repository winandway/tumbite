import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  aLugarCuenta,
  buscarLugares,
  buscarMunicipios,
  crearCatalogoLugares,
  leerArchivoCatalogo,
  municipiosDelEstado,
  resaltar,
  type LugarCatalogo,
} from './catalogoLugares';
import { ESTADOS_US, ESTADOS_VE, leerLugarCuenta, type PaisConCatalogo } from './lugarCuenta';
import { esquemaRegistro } from './esquemas';
import { buscarEstados, paisesParaElegir } from './selectorLugar';
import { filasParaRevisar, validarRegistro } from './revisarRegistro';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte A (25 nov 2026) — Venezuela y Estados Unidos.
 * El catálogo de dónde VIVE la gente y su buscador. Se prueba sobre los archivos de verdad que
 * publica el sitio (apps/panel/public/lugares), no sobre una copia.
 *
 * Comprobado en ROJO (anotado en CANDADOS.md):
 * - quitando `sinAcentos` del puntaje (comparando el nombre tal cual), «merida» y «tucani» no
 *   encuentran nada y fallan las pruebas del buscador;
 * - borrando el archivo de un estado (VE/V.json, Zulia), falla «cada estado del contrato tiene su
 *   archivo» y Maracaibo deja de poder elegirse;
 * - sacando `lugar` de esquemaRegistro, falla «el registro guarda el lugar elegido».
 */
const CARPETA = join(__dirname, '..', '..', '..', 'apps', 'panel', 'public', 'lugares');
const leer = (pais: PaisConCatalogo, archivo: string): unknown =>
  JSON.parse(readFileSync(join(CARPETA, pais, `${archivo}.json`), 'utf8'));
const delEstado = (pais: PaisConCatalogo, estado: string): LugarCatalogo[] =>
  leerArchivoCatalogo(leer(pais, estado), pais, estado);
const principales = (pais: PaisConCatalogo): LugarCatalogo[] =>
  leerArchivoCatalogo(leer(pais, 'principales'), pais);

describe('C-REGISTRO-TODO-EL-PAIS: el catálogo completo', () => {
  it('cada estado del contrato tiene su archivo, y nada más', () => {
    for (const [pais, estados] of [
      ['VE', ESTADOS_VE],
      ['US', ESTADOS_US],
    ] as const) {
      const archivos = readdirSync(join(CARPETA, pais))
        .map((n) => n.replace(/\.json$/, ''))
        .filter((n) => n !== 'principales')
        .sort();
      expect(archivos, pais).toEqual(estados.map((e) => e.codigo).sort());
    }
  });

  it('cualquier ciudad o pueblo del catálogo se puede elegir y viaja como un lugar válido', () => {
    let total = 0;
    for (const [pais, estados] of [
      ['VE', ESTADOS_VE],
      ['US', ESTADOS_US],
    ] as const)
      for (const e of estados) {
        const lugares = delEstado(pais, e.codigo);
        expect(lugares.length, `${pais}-${e.codigo}`).toBeGreaterThan(0);
        for (const l of lugares) {
          const enviado = leerLugarCuenta(JSON.parse(JSON.stringify(aLugarCuenta(l))));
          if (!enviado)
            throw new Error(`${pais}-${e.codigo}: ${l.lugarId} ${l.ciudad} no es válido`);
          expect(enviado.estado).toBe(e.codigo);
          total++;
        }
      }
    // Venezuela con sus pueblos y Estados Unidos con sus «places» del censo.
    expect(total).toBeGreaterThan(50_000);
  });

  it('están las ciudades de la gente que no podía registrarse', () => {
    const ve = principales('VE');
    for (const c of ['Maracaibo', 'Caracas', 'El Vigía', 'Mérida', 'Tucaní'])
      expect(
        ve.some((l) => l.ciudad === c),
        c,
      ).toBe(true);
    expect(delEstado('VE', 'V').some((l) => l.ciudad === 'Maracaibo')).toBe(true);
    expect(delEstado('VE', 'L').some((l) => l.ciudad === 'Tucaní')).toBe(true);
    const ca = delEstado('US', 'CA');
    for (const c of ['Gilroy', 'San Jose', 'San Francisco', 'Los Angeles'])
      expect(
        ca.some((l) => l.ciudad === c),
        c,
      ).toBe(true);
    expect(delEstado('US', 'NY').some((l) => l.ciudad === 'New York City')).toBe(true);
    expect(delEstado('US', 'MI').some((l) => l.ciudad === 'Novi')).toBe(true);
    expect(delEstado('US', 'FL').some((l) => l.ciudad === 'Miami')).toBe(true);
  });

  it('sin repetidos: un lugarId una sola vez por archivo', () => {
    for (const [pais, est] of [
      ['VE', 'V'],
      ['US', 'CA'],
      ['US', 'principales'],
    ] as const) {
      const ids = (est === 'principales' ? principales(pais) : delEstado(pais, est)).map(
        (l) => l.lugarId,
      );
      expect(new Set(ids).size, `${pais}-${est}`).toBe(ids.length);
    }
  });
});

describe('C-REGISTRO-TODO-EL-PAIS: el buscador', () => {
  it('sugiere desde la primera letra, sin acentos ni mayúsculas', () => {
    const ve = principales('VE');
    expect(buscarLugares(ve, 'm').length).toBeGreaterThan(5);
    expect(buscarLugares(ve, 'MARA')[0]?.lugar.ciudad).toBe('Maracaibo');
    expect(buscarLugares(ve, 'merida')[0]?.lugar.ciudad).toBe('Mérida');
    expect(buscarLugares(ve, 'el vigia')[0]?.lugar.ciudad).toBe('El Vigía');
    expect(buscarLugares(delEstado('VE', 'L'), 'tucani')[0]?.lugar.ciudad).toBe('Tucaní');
    expect(buscarLugares(ve, 'cara')[0]?.lugar.ciudad).toBe('Caracas');
  });

  it('en Estados Unidos, lo más poblado primero y por estado', () => {
    const us = principales('US');
    const sj = buscarLugares(us, 'san jose');
    expect(sj[0]?.lugar).toMatchObject({ ciudad: 'San Jose', estado: 'CA' });
    expect(buscarLugares(delEstado('US', 'CA'), 'gil')[0]?.lugar.ciudad).toBe('Gilroy');
    expect(buscarLugares(delEstado('US', 'MI'), 'nov')[0]?.lugar.ciudad).toBe('Novi');
    expect(buscarLugares(us, 'new y')[0]?.lugar.ciudad).toBe('New York City');
  });

  it('busca también por municipio (o condado) y por estado', () => {
    const ve = principales('VE');
    // «Zulia» es un estado: salen sus ciudades.
    const zulia = buscarLugares(ve, 'zulia');
    expect(zulia.length).toBeGreaterThan(0);
    expect(zulia.every((r) => r.lugar.estado === 'V')).toBe(true);
    expect(zulia.some((r) => r.lugar.ciudad === 'Maracaibo' && r.coincideEn === 'estado')).toBe(
      true,
    );
    // Un municipio: «Alberto Adriani» es el de El Vigía.
    const adriani = buscarLugares(delEstado('VE', 'L'), 'alberto adr');
    expect(adriani.some((r) => r.lugar.ciudad === 'El Vigía')).toBe(true);
    const condado = buscarLugares(delEstado('US', 'CA'), 'santa clara');
    expect(condado.some((r) => r.lugar.ciudad === 'Gilroy')).toBe(true);
  });

  it('resalta lo que coincidió, aunque se escriba sin acento', () => {
    expect(resaltar('Mérida', 'meri')).toEqual(['', 'Méri', 'da']);
    expect(resaltar('El Vigía', 'vigia')).toEqual(['El ', 'Vigía', '']);
    expect(resaltar('San Jose', 'jo')).toEqual(['San ', 'Jo', 'se']);
    expect(resaltar('Novi', 'x')).toEqual(['Novi', '', '']);
  });

  it('«no encuentro mi pueblo»: los municipios del estado, cada uno con su ciudad principal', () => {
    const m = municipiosDelEstado(delEstado('VE', 'V'));
    const maracaibo = m.find((l) => l.municipio === 'Maracaibo');
    expect(maracaibo?.ciudad).toBe('Maracaibo');
    expect(m.length).toBeGreaterThan(15);
    expect(buscarMunicipios(m, 'mara').some((l) => l.municipio === 'Maracaibo')).toBe(true);
  });

  it('estados por nombre o código, y el país sugerido va primero', () => {
    expect(buscarEstados('US', 'mi').map((e) => e.codigo)).toEqual(
      expect.arrayContaining(['MI', 'MN', 'MS', 'MO']),
    );
    expect(buscarEstados('US', 'ca')[0]?.codigo).toBe('CA');
    expect(buscarEstados('VE', 'tachira').map((e) => e.codigo)).toEqual(['S']);
    expect(paisesParaElegir('US')).toEqual(['US', 'VE']);
    expect(paisesParaElegir('VE')).toEqual(['VE', 'US']);
  });
});

describe('C-REGISTRO-TODO-EL-PAIS: el formato 2 (compacto) del catálogo', () => {
  it('pesa poco: todo el catálogo cabe en 2,4 MB y ningún archivo pasa de 200 KB', () => {
    let total = 0;
    for (const pais of ['VE', 'US'] as const)
      for (const n of readdirSync(join(CARPETA, pais))) {
        const kb = readFileSync(join(CARPETA, pais, n)).length / 1024;
        expect(kb, `${pais}/${n}`).toBeLessThan(200);
        total += kb;
      }
    expect(total / 1024).toBeLessThan(2.4);
  });

  it('la más poblada va primero, y un archivo de otro formato o una fila rota no rompen nada', () => {
    expect(delEstado('VE', 'V')[0]?.ciudad).toBe('Maracaibo');
    expect(principales('US')[0]?.ciudad).toBe('New York City');
    expect(leerArchivoCatalogo([['gn:1', 'Vieja', '', 1, 1, 1]], 'VE', 'V')).toEqual([]);
    expect(
      leerArchivoCatalogo(
        { v: 2, m: [], f: [null, ['x'], [7, 'Buena', -1, 1000, 2000]] },
        'VE',
        'V',
      ),
    ).toEqual([
      expect.objectContaining({ lugarId: 'gn:7', ciudad: 'Buena', municipio: '', lat: 1, lng: 2 }),
    ]);
  });
});

describe('C-REGISTRO-TODO-EL-PAIS: lector con caché', () => {
  it('lee una vez por archivo y no guarda un fallo', async () => {
    let falla = true;
    const traer = vi.fn((url: string) => {
      expect(url).toBe('https://ejemplo.com/lugares/VE/V.json');
      if (falla) return Promise.resolve({ ok: false, json: () => Promise.resolve(null) });
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ v: 2, m: ['Municipio Uno'], f: [[1, 'Ciudad Uno', 0, 10000, -71000]] }),
      });
    });
    const cat = crearCatalogoLugares({ base: 'https://ejemplo.com', fetch: traer });
    await expect(cat.estado('VE', 'v')).rejects.toThrow();
    falla = false;
    const a = await cat.estado('VE', 'V');
    const b = await cat.estado('VE', 'V');
    expect(a).toBe(b);
    expect(a[0]).toMatchObject({
      pais: 'VE',
      estado: 'V',
      ciudad: 'Ciudad Uno',
      municipio: 'Municipio Uno',
      lugarId: 'gn:1',
      lat: 10,
      lng: -71,
    });
    expect(traer).toHaveBeenCalledTimes(2);
  });
});

describe('C-REGISTRO-TODO-EL-PAIS: el registro', () => {
  const base = {
    nombre: 'Persona Nueva',
    correo: 'correo@ejemplo.com',
    clave: '12345678',
    rol: 'repartidor' as const,
  };
  const maracaibo = aLugarCuenta(delEstado('VE', 'V').find((l) => l.ciudad === 'Maracaibo')!);

  it('el registro guarda el lugar elegido', () => {
    const r = esquemaRegistro.parse({ ...base, lugar: maracaibo });
    expect(r.lugar).toEqual(maracaibo);
  });

  it('un lugar mal formado no impide crear la cuenta (el servidor lo lee como null y sigue)', () => {
    const r = esquemaRegistro.safeParse({ ...base, lugar: { pais: 'XX', ciudad: '' } });
    expect(r.success).toBe(true);
    expect(leerLugarCuenta(r.success ? r.data.lugar : undefined)).toBeNull();
    const viejo = esquemaRegistro.parse(base);
    expect(viejo.lugar).toBeUndefined();
  });

  it('en «Revisa tus datos» sale dónde vive, y sin elegirlo no se sigue', () => {
    const datos = { nombre: 'A B', correo: 'a@ejemplo.com', telefono: '', clave: '12345678' };
    expect(validarRegistro(datos, 'es', ['lugar'])).toEqual([
      { campo: 'lugar', mensaje: 'Elige dónde vives.' },
    ]);
    const conLugar = { ...datos, lugar: JSON.stringify(maracaibo) };
    expect(validarRegistro(conLugar, 'en', ['lugar'])).toEqual([]);
    expect(filasParaRevisar(conLugar, 'es', ['lugar'])).toEqual([
      { campo: 'lugar', etiqueta: 'Ciudad', valor: 'Maracaibo, Zulia' },
    ]);
    const novi = aLugarCuenta(delEstado('US', 'MI').find((l) => l.ciudad === 'Novi')!);
    expect(
      filasParaRevisar({ ...datos, lugar: JSON.stringify(novi) }, 'en', ['lugar'])[0]?.valor,
    ).toBe('Novi, Michigan (MI)');
  });
});
