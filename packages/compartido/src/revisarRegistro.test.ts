import { describe, expect, it } from 'vitest';
import {
  resumenFallos,
  trozosDeCorreo,
  errorCorreo,
  errorTelefono,
  fechaParaLeer,
  filasParaRevisar,
  soloNumerosTelefono,
  textosRevisar,
  validarRegistro,
  lugarDeBorrador,
  lugarRespondido,
  LUGAR_OTRO_PAIS,
  type CasillaRegistro,
} from './revisarRegistro';

/** C-REVISA-TUS-DATOS (19 nov 2026) — todos los países: la lógica que comparten web y apps. */
const DATOS = {
  nombre: 'Ana García',
  correo: 'ana@ejemplo.com',
  telefono: '3055550100',
  clave: 'clave-segura-1',
  fechaNacimiento: '1990-03-15',
  invitacion: 'equipo-01',
};
const TODAS: CasillaRegistro[] = [
  'nombre',
  'correo',
  'telefono',
  'invitacion',
  'fechaNacimiento',
  'clave',
];

describe('el correo: arroba, dominio y terminación, dicho en palabras', () => {
  it('acepta correos bien formados, también dominios de pruebas y con subdominios', () => {
    for (const bueno of [
      'ana@ejemplo.com',
      ' Ana.Perez+tienda@Correo.Empresa.com.ve ',
      'x@recorrido.test',
    ])
      expect(errorCorreo(bueno, 'es'), bueno).toBeNull();
  });
  it('dice qué falta en cada caso, en los dos idiomas', () => {
    expect(errorCorreo('', 'es')).toBe('Escribe tu correo.');
    expect(errorCorreo('ana gmail.com', 'es')).toBe('El correo no lleva espacios.');
    expect(errorCorreo('anagmail.com', 'es')).toMatch(/arroba/);
    expect(errorCorreo('ana@@gmail.com', 'es')).toMatch(/una sola arroba/);
    expect(errorCorreo('@gmail.com', 'es')).toMatch(/antes de la arroba/);
    expect(errorCorreo('ana@', 'es')).toMatch(/dominio/);
    expect(errorCorreo('ana@gmail', 'es')).toMatch(/dominio/);
    expect(errorCorreo('ana@gmail.c', 'es')).toMatch(/final del correo/);
    expect(errorCorreo('ana@gmail..com', 'es')).toMatch(/final del correo/);
    expect(errorCorreo('anagmail.com', 'en')).toBe('Your email is missing the @.');
  });
});

describe('trozosDeCorreo: un correo largo se parte en puntos, no a media palabra', () => {
  it('unidos dan el mismo correo y el dominio va entero', () => {
    const correo = 'nombre.apellido.muy-largo_de.prueba@ejemplo.com';
    const trozos = trozosDeCorreo(correo);
    expect(trozos.join('')).toBe(correo);
    expect(trozos.at(-1)).toBe('@ejemplo.com');
    expect(trozos.slice(0, 3)).toEqual(['nombre.', 'apellido.', 'muy-']);
  });
  it('sin arroba o sin puntos no se rompe', () => {
    expect(trozosDeCorreo('ana').join('')).toBe('ana');
    expect(trozosDeCorreo('a@b.co')).toEqual(['a', '@b.co']);
  });
});

describe('el celular: solo números', () => {
  it('lo que se escribe queda en números (y el + del código del país)', () => {
    expect(soloNumerosTelefono('(305) 555-0100')).toBe('3055550100');
    expect(soloNumerosTelefono('+58 414 abc 1234567')).toBe('+584141234567');
    expect(soloNumerosTelefono('12+34')).toBe('1234');
  });
  it('vacío está bien (es opcional); escrito, de 7 a 15 cifras', () => {
    expect(errorTelefono('', 'es')).toBeNull();
    expect(errorTelefono('3055550100', 'es')).toBeNull();
    expect(errorTelefono('+584141234567', 'es')).toBeNull();
    expect(errorTelefono('305-555', 'es')).toMatch(/solo números/);
    expect(errorTelefono('12345', 'es')).toMatch(/faltan/);
    expect(errorTelefono('1234567890123456', 'en')).toMatch(/too many/);
  });
});

describe('validarRegistro: cada fallo con su casilla, solo las casillas de esa pantalla', () => {
  it('todo bien escrito: ningún fallo', () => {
    expect(validarRegistro(DATOS, 'es', TODAS)).toEqual([]);
  });
  it('devuelve un fallo por casilla, en el orden de la pantalla', () => {
    const fallos = validarRegistro(
      { ...DATOS, nombre: ' ', correo: 'ana@', telefono: '12', clave: 'corta', invitacion: 'a b' },
      'es',
      TODAS,
    );
    expect(fallos.map((f) => f.campo)).toEqual([
      'nombre',
      'correo',
      'telefono',
      'invitacion',
      'clave',
    ]);
  });
  it('no valida lo que la pantalla no pide (la web no lleva invitación)', () => {
    expect(
      validarRegistro({ ...DATOS, invitacion: 'a b' }, 'es', ['nombre', 'correo', 'clave']),
    ).toEqual([]);
  });
});

describe('filasParaRevisar: lo que se ve debajo del correo', () => {
  it('nunca el correo ni la contraseña; los opcionales vacíos no salen', () => {
    const filas = filasParaRevisar({ ...DATOS, telefono: '', invitacion: '' }, 'es', TODAS);
    expect(filas.map((f) => f.campo)).toEqual(['nombre', 'fechaNacimiento']);
    const texto = JSON.stringify(filas);
    expect(texto).not.toContain(DATOS.clave);
    expect(texto).not.toContain(DATOS.correo);
  });
  it('con todo escrito, en el orden de la pantalla y con el código en mayúsculas', () => {
    expect(filasParaRevisar(DATOS, 'en', TODAS)).toEqual([
      { campo: 'nombre', etiqueta: 'Name', valor: 'Ana García' },
      { campo: 'telefono', etiqueta: 'Mobile phone', valor: '3055550100' },
      { campo: 'invitacion', etiqueta: 'Invitation code', valor: 'EQUIPO-01' },
      { campo: 'fechaNacimiento', etiqueta: 'Birthday', valor: 'March 15, 1990' },
    ]);
  });
  it('la fecha se lee en palabras en cada idioma', () => {
    expect(fechaParaLeer('1990-03-15', 'es')).toBe('15 de marzo de 1990');
    expect(fechaParaLeer('2001-12-01', 'en')).toBe('December 1, 2001');
    expect(fechaParaLeer('roto', 'es')).toBe('roto');
  });
});

describe('C-SIN-EXITO-FALSO: «Revisa tus datos» nunca suena a cuenta ya creada (24 nov 2026)', () => {
  it('dice que la cuenta todavía no existe y no promete un enlace ya mandado', () => {
    for (const idioma of ['es', 'en'] as const) {
      const t = textosRevisar(idioma);
      expect(`${t.intro} ${t.correoPregunta}`).not.toMatch(
        /te mandamos|We’ll send|ya te|was sent/i,
      );
    }
    expect(textosRevisar('es').intro).toContain('todavía no está creada');
    expect(textosRevisar('en').intro).toContain('isn’t created yet');
  });
  it('junto al botón «Continuar» se dicen las casillas que faltan', () => {
    expect(
      resumenFallos(
        [
          { campo: 'telefono', mensaje: 'x' },
          { campo: 'clave', mensaje: 'y' },
        ],
        'es',
      ),
    ).toBe('Revisa lo marcado en rojo: Celular, Contraseña.');
    expect(resumenFallos([{ campo: 'correo', mensaje: 'x' }], 'en')).toBe(
      'Check what’s marked in red: Email.',
    );
    expect(resumenFallos([], 'es')).toBe('');
  });
});

describe('los textos de la pantalla, completos en los dos idiomas', () => {
  it('el correo se explica y los botones dicen lo que hacen', () => {
    expect(textosRevisar('es').correoPregunta).toBe(
      '¿Está bien escrito? Cuando crees tu cuenta, aquí te llegará el enlace para activarla.',
    );
    expect(textosRevisar('es').crearMiCuenta).toBe('Crear mi cuenta');
    expect(textosRevisar('en').crearMiCuenta).toBe('Create my account');
    expect(Object.keys(textosRevisar('en').errores)).toEqual(
      Object.keys(textosRevisar('es').errores),
    );
  });
});

describe('C-REGISTRO-OTRO-PAIS: quien vive fuera del catálogo se registra igual (26 nov 2026)', () => {
  it('«Otro país» cuenta como respondido; vacío no', () => {
    expect(lugarRespondido(LUGAR_OTRO_PAIS)).toBe(true);
    expect(lugarRespondido('')).toBe(false);
    expect(validarRegistro({ ...DATOS, lugar: LUGAR_OTRO_PAIS }, 'es', ['lugar'])).toEqual([]);
    expect(validarRegistro({ ...DATOS, lugar: '' }, 'es', ['lugar'])).toHaveLength(1);
  });
  it('en «Revisa tus datos» se lee «Otro país», y nunca viaja como lugar', () => {
    const filas = filasParaRevisar({ ...DATOS, lugar: LUGAR_OTRO_PAIS }, 'es', ['lugar']);
    expect(filas).toEqual([{ campo: 'lugar', etiqueta: 'Ciudad', valor: 'Otro país' }]);
    expect(filasParaRevisar({ ...DATOS, lugar: LUGAR_OTRO_PAIS }, 'en', ['lugar'])[0]!.valor).toBe(
      'Another country',
    );
    expect(lugarDeBorrador(LUGAR_OTRO_PAIS)).toBeNull();
  });
});
