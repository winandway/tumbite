import { describe, expect, it } from 'vitest';
import {
  MIN_CALIFICACIONES_PERFIL,
  type PerfilConductorPublico,
  calificacionPerfil,
  leerIdiomasGuardados,
  limpiarDato,
  listaIdiomas,
  numeroPerfil,
  tiempoEnDivoox,
  trayectoriaPublica,
  vistaPerfilConductor,
} from './perfilConductor';

// C-PERFIL-CONDUCTOR: la única pieza que decide qué ve el pasajero del conductor.
const AHORA = new Date('2026-11-20T12:00:00Z');

const NUEVO: PerfilConductorPublico = {
  nombre: 'Conductor',
  vehiculo: { marca: 'Marca', modelo: 'Modelo', color: 'Negro' },
  placa: 'ABC1234',
  trayectoria: null,
  identidadVerificada: false,
  vehiculoVerificado: false,
  foto: false,
  linea: null,
  idiomas: [],
  dato: null,
};

const CON_TRAYECTORIA: PerfilConductorPublico = {
  ...NUEVO,
  trayectoria: { viajes: 1240, calificacion: 4.9, desde: '2024-10-01 10:00:00' },
  identidadVerificada: true,
  vehiculoVerificado: true,
  linea: 'Línea de ejemplo',
  idiomas: ['es', 'en'],
  dato: 'Me gusta la música.',
};

const textoDe = (v: ReturnType<typeof vistaPerfilConductor>) => JSON.stringify(v);

describe('C-PERFIL-CONDUCTOR · nuevo sin ceros', () => {
  it('sin viajes, sin calificaciones o con pocas: «Nuevo en Divoox», nunca la trayectoria', () => {
    expect(trayectoriaPublica(0, null, 0, '2026-11-01')).toBeNull();
    expect(trayectoriaPublica(0, 5, 3, '2026-11-01')).toBeNull();
    expect(trayectoriaPublica(12, 5, MIN_CALIFICACIONES_PERFIL - 1, '2026-11-01')).toBeNull();
    expect(trayectoriaPublica(12, null, 9, '2026-11-01')).toBeNull();
    expect(trayectoriaPublica(12, 4.87, MIN_CALIFICACIONES_PERFIL, '2026-11-01')).toEqual({
      viajes: 12,
      calificacion: 4.9,
      desde: '2026-11-01',
    });
  });

  for (const idioma of ['es', 'en'] as const)
    it(`en ${idioma}, el conductor nuevo no muestra ningún cero ni calificación vacía`, () => {
      for (const propio of [true, false]) {
        const v = vistaPerfilConductor(NUEVO, { idioma, propio, ahora: AHORA });
        expect(v.cifras).toBeNull();
        expect(v.nuevo).toBe(idioma === 'es' ? 'Nuevo en Divoox' : 'New to Divoox');
        const todo = textoDe(v);
        expect(todo).not.toMatch(/\b0\b|0,0|0\.0|★/);
      }
    });

  it('una trayectoria con ceros que llegue por error tampoco se dibuja como cifras', () => {
    const v = vistaPerfilConductor(
      { ...NUEVO, trayectoria: { viajes: 0, calificacion: 0, desde: '2026-01-01' } },
      { idioma: 'es', propio: false, ahora: AHORA },
    );
    expect(v.cifras).toBeNull();
    expect(v.nuevo).toBe('Nuevo en Divoox');
  });
});

describe('C-PERFIL-CONDUCTOR · lo que ve el pasajero', () => {
  it('lo opcional que falta no se le muestra al pasajero; al conductor sí, como invitación', () => {
    const pasajero = vistaPerfilConductor(NUEVO, { idioma: 'es', propio: false, ahora: AHORA });
    expect(pasajero.filas).toEqual([]);
    expect(pasajero.nuevoAyuda).toBeNull();
    const propio = vistaPerfilConductor(NUEVO, { idioma: 'es', propio: true, ahora: AHORA });
    expect(propio.filas.map((f) => [f.clave, f.valor])).toEqual([
      ['linea', null],
      ['idiomas', null],
      ['dato', null],
    ]);
    expect(propio.nuevoAyuda).toMatch(/cuando empieces/);
  });

  it('los sellos solo salen al pasajero si de verdad está verificado', () => {
    const sinNada = vistaPerfilConductor(NUEVO, { idioma: 'es', propio: false, ahora: AHORA });
    expect(sinNada.sellos).toEqual([]);
    const soloIdentidad = vistaPerfilConductor(
      { ...NUEVO, identidadVerificada: true },
      { idioma: 'es', propio: false, ahora: AHORA },
    );
    expect(soloIdentidad.sellos.map((s) => s.texto)).toEqual(['Identidad verificada']);
    // Al propio conductor le salen los dos, apagados si todavía no.
    const propio = vistaPerfilConductor(NUEVO, { idioma: 'en', propio: true, ahora: AHORA });
    expect(propio.sellos.map((s) => [s.texto, s.verificado])).toEqual([
      ['Identity verified', false],
      ['Vehicle verified', false],
    ]);
  });

  it('con trayectoria: las tres cifras con el formato de cada idioma', () => {
    const es = vistaPerfilConductor(CON_TRAYECTORIA, { idioma: 'es', propio: false, ahora: AHORA });
    expect(es.cifras?.map((c) => c.valor)).toEqual(['1.240', '4,9 ★', '2 años']);
    expect(es.nuevo).toBeNull();
    expect(es.filas.map((f) => f.valor)).toEqual([
      'Línea de ejemplo',
      'Español e inglés',
      'Me gusta la música.',
    ]);
    const en = vistaPerfilConductor(CON_TRAYECTORIA, { idioma: 'en', propio: false, ahora: AHORA });
    expect(en.cifras?.map((c) => c.valor)).toEqual(['1,240', '4.9 ★', '2 years']);
    expect(en.filas.find((f) => f.clave === 'idiomas')?.valor).toBe('Spanish and English');
  });

  it('solo el nombre de pila, aunque llegue el nombre completo', () => {
    const v = vistaPerfilConductor(
      { ...NUEVO, nombre: 'Nombre Apellido Otro' },
      { idioma: 'es', propio: false, ahora: AHORA },
    );
    expect(v.nombre).toBe('Nombre');
    expect(textoDe(v)).not.toContain('Apellido');
  });
});

describe('C-PERFIL-CONDUCTOR · formatos', () => {
  it('números y calificación por idioma', () => {
    expect(numeroPerfil(1240, 'es')).toBe('1.240');
    expect(numeroPerfil(1240, 'en')).toBe('1,240');
    expect(numeroPerfil(1234567, 'es')).toBe('1.234.567');
    expect(numeroPerfil(87, 'en')).toBe('87');
    expect(calificacionPerfil(4.9, 'es')).toBe('4,9');
    expect(calificacionPerfil(5, 'en')).toBe('5.0');
  });

  it('lista de idiomas con «y», «e» y «and»', () => {
    expect(listaIdiomas(['es'], 'es')).toBe('Español');
    expect(listaIdiomas(['en', 'es'], 'es')).toBe('Español e inglés');
    expect(listaIdiomas(['es', 'pt'], 'es')).toBe('Español y portugués');
    expect(listaIdiomas(['en', 'pt'], 'es')).toBe('Inglés y portugués');
    expect(listaIdiomas(['es', 'en', 'pt'], 'es')).toBe('Español, inglés y portugués');
    expect(listaIdiomas(['es', 'en', 'pt'], 'en')).toBe('Spanish, English and Portuguese');
    expect(listaIdiomas([], 'en')).toBe('');
  });

  it('tiempo en Divoox', () => {
    expect(tiempoEnDivoox('2024-10-01', 'es', AHORA)).toBe('2 años');
    expect(tiempoEnDivoox('2025-10-01', 'en', AHORA)).toBe('1 year');
    expect(tiempoEnDivoox('2026-06-01', 'es', AHORA)).toBe('5 meses');
    expect(tiempoEnDivoox('2026-10-01', 'es', AHORA)).toBe('1 mes');
    expect(tiempoEnDivoox('2026-11-10', 'en', AHORA)).toBe('Under a month');
  });

  it('idiomas guardados y dato limpio', () => {
    expect(leerIdiomasGuardados('pt,es,xx,es')).toEqual(['es', 'pt']);
    expect(leerIdiomasGuardados(null)).toEqual([]);
    expect(limpiarDato('  hola\n\n  mundo  ')).toBe('hola mundo');
    expect(limpiarDato('a'.repeat(300))).toHaveLength(120);
  });
});
