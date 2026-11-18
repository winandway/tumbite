import { describe, expect, it } from 'vitest';
import {
  ICONOS_LUGAR,
  filaLugares,
  iconoDeLugar,
  lugaresQueCoinciden,
  ordenarRecientes,
  ordenarResultados,
  puedeGuardarLugar,
  textoDistanciaLugar,
} from './lugaresGuardados';

/**
 * C-LUGARES-GUARDADOS y C-DESTINO-RECIENTES (17 nov 2026, reglas escritas de Richard en
 * docs/disenos/borrador-inicio/LUGARES-GUARDADOS.md y BUSQUEDA-DESTINO.md). Todo con código, sin IA.
 */
const lugar = (
  etiqueta: string,
  direccion = '',
  icono = '',
  lat: number | null = 8.6,
  id = etiqueta,
) => ({
  id,
  etiqueta,
  direccion,
  lat: direccion ? lat : null,
  lng: direccion ? -71.6 : null,
  referencia: '',
  apto: '',
  icono,
});

describe('lugares guardados (C-LUGARES-GUARDADOS)', () => {
  it('ocho íconos para elegir', () => {
    expect(ICONOS_LUGAR).toEqual([
      'casa',
      'trabajo',
      'escuela',
      'gimnasio',
      'corazon',
      'estrella',
      'tienda',
      'hospital',
    ]);
  });

  it('la fila: Casa y Trabajo siempre primero (aunque no tengan dirección), luego los propios', () => {
    const f = filaLugares(
      [lugar('Gimnasio', 'Av. Los Próceres', 'gimnasio'), lugar('Casa', 'Calle 5')],
      'es',
    );
    expect(f.map((x) => [x.nombre, x.conDireccion])).toEqual([
      ['Casa', true],
      ['Trabajo', false],
      ['Gimnasio', true],
    ]);
    expect(filaLugares([], 'en').map((x) => x.nombre)).toEqual(['Home', 'Work']);
  });

  it('las direcciones sin nombre (las de las entregas de Comida) no llenan la fila', () => {
    expect(filaLugares([lugar('', 'Calle 9')], 'es').map((x) => x.nombre)).toEqual([
      'Casa',
      'Trabajo',
    ]);
  });

  it('el ícono: el elegido, o el de Casa y Trabajo por su nombre; si no, una estrella', () => {
    expect(iconoDeLugar(lugar('Home', 'x'))).toBe('casa');
    expect(iconoDeLugar(lugar('Oficina', 'x'))).toBe('trabajo');
    expect(iconoDeLugar(lugar('Mamá', 'x', 'corazon'))).toBe('corazon');
    expect(iconoDeLugar(lugar('Mamá', 'x', 'raro'))).toBe('estrella');
  });

  it('«Guardar» se activa solo con nombre y dirección con su punto', () => {
    expect(puedeGuardarLugar({ nombre: '', direccion: 'Calle 5', lat: 1 })).toBe(false);
    expect(puedeGuardarLugar({ nombre: 'Escuela', direccion: '', lat: null })).toBe(false);
    expect(puedeGuardarLugar({ nombre: 'Escuela', direccion: 'Calle 5', lat: null })).toBe(false);
    expect(puedeGuardarLugar({ nombre: 'Escuela', direccion: 'Calle 5', lat: 8.6 })).toBe(true);
  });

  it('Casa y Trabajo salen en «Resultados» solo si coinciden con lo escrito (nombre o dirección)', () => {
    const l = [lugar('Casa', 'Calle 5, Las Flores'), lugar('Trabajo', 'Torre Norte')];
    expect(lugaresQueCoinciden('trab', l).map((x) => x.etiqueta)).toEqual(['Trabajo']);
    expect(lugaresQueCoinciden('flores', l).map((x) => x.etiqueta)).toEqual(['Casa']);
    expect(lugaresQueCoinciden('termi', l)).toEqual([]);
    expect(lugaresQueCoinciden('t', l)).toEqual([]);
  });
});

describe('Recientes por hora y día (C-DESTINO-RECIENTES)', () => {
  // Fechas locales (sin zona horaria fija): lunes 16 nov 2026.
  const v = (direccion: string, d: Date, lat = 8.6) => ({
    direccion,
    lat,
    lng: -71.6,
    en: d.toISOString(),
  });
  const lunes7 = (semanas: number) => new Date(2026, 10, 16 - 7 * semanas, 7, 10);
  const sabado = (semanas: number) => new Date(2026, 10, 14 - 7 * semanas, 15, 0);
  const viajes = [
    v('Mercado municipal, Av. Libertad', sabado(0), 8.61),
    v('Mercado municipal, Av. Libertad', sabado(1), 8.61),
    v('Edificio Torre Norte, Calle 3', lunes7(1), 8.62),
    v('Edificio Torre Norte, Calle 3', lunes7(2), 8.62),
    v('Colegio del centro, Calle 3', new Date(2026, 10, 12, 7, 30), 8.63),
    v('Plaza Bolívar, Centro', new Date(2026, 10, 15, 20, 0), 8.64),
  ];

  it('un lunes a las 7 de la mañana, el destino de los lunes a esa hora va primero', () => {
    const r = ordenarRecientes(viajes, new Date(2026, 10, 16, 7, 0), { idioma: 'es' });
    expect(r[0]).toMatchObject({ titulo: 'Edificio Torre Norte', detalle: 'Calle 3' });
    expect(r[0]?.motivo).toBe('Lunes a esta hora');
    // Luego el mismo tipo de día (entre semana) y por último lo más reciente.
    expect(r[1]?.titulo).toBe('Colegio del centro');
    expect(r.map((x) => x.titulo).slice(2)).toEqual(['Plaza Bolívar', 'Mercado municipal']);
  });

  it('un sábado por la tarde, el mercado de los sábados va primero', () => {
    const r = ordenarRecientes(viajes, new Date(2026, 10, 21, 14, 30), { idioma: 'en' });
    expect(r[0]?.titulo).toBe('Mercado municipal');
    expect(r[0]?.motivo).toBe('Saturdays at this time');
  });

  it('C-SIN-PLUS-CODE: un reciente guardado con plus code se muestra sin él', () => {
    const r = ordenarRecientes(
      [v('J85P+QQ2 Terminal de Pasajeros, El Vigía 5145', new Date(2026, 10, 15, 9), 8.65)],
      new Date(2026, 10, 16, 7),
    );
    expect(r[0]).toMatchObject({
      titulo: 'Terminal de Pasajeros',
      direccion: 'Terminal de Pasajeros, El Vigía 5145',
    });
  });

  it('el mismo lugar no se repite y salen cinco como mucho', () => {
    const muchos = Array.from({ length: 9 }, (_, i) =>
      v(`Lugar ${i}`, new Date(2026, 10, 10, i), 8 + i / 100),
    );
    const r = ordenarRecientes([...muchos, ...muchos], new Date(2026, 10, 16, 7));
    expect(r.length).toBe(5);
    expect(new Set(r.map((x) => x.titulo)).size).toBe(5);
  });

  it('un destino que es un lugar guardado lleva su nombre (Casa, Trabajo…)', () => {
    const r = ordenarRecientes(viajes, new Date(2026, 10, 16, 7), {
      lugares: [lugar('Trabajo', 'Torre Norte', 'trabajo', 8.6201)],
    });
    expect(r[0]?.titulo).toBe('Trabajo');
  });
});

describe('Resultados por cercanía', () => {
  it('lo más cercano primero; lo que no trae distancia, al final en su orden', () => {
    const r = ordenarResultados([
      { id: 'a', texto: 'A', distanciaM: 3800 },
      { id: 'b', texto: 'B' },
      { id: 'c', texto: 'C', distanciaM: 600 },
    ]);
    expect(r.map((x) => x.id)).toEqual(['c', 'a', 'b']);
  });

  it('la distancia en km en español y en millas en inglés', () => {
    expect(textoDistanciaLugar(600, 'es')).toBe('0,6 km');
    expect(textoDistanciaLugar(1609, 'en')).toBe('1.0 mi');
    expect(textoDistanciaLugar(22_000, 'en')).toBe('14 mi');
  });
});
