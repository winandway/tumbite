import { describe, expect, it } from 'vitest';
import { leerAamva } from './aamva';
import { digitoControl, leerMrz } from './mrz';
import { cruzarConFrente, datosDelFrente, edadEn, revisarDocumento } from './documento';

/** C-KYC-DOCUMENTO (29 oct 2026): lectura y reglas del documento del motor propio de verificación. */
// Muestra con el formato público de AAMVA (datos inventados, no de una persona real).
const LICENCIA = [
  '@',
  '\u001e',
  'ANSI 636014090102DL00410288ZC03290034DLDAQD1234562',
  'DCSMUESTRA',
  'DACANA',
  'DADMARIA',
  'DBD08292021',
  'DBB01151990',
  'DBA01152030',
  'DBC2',
  'DAJFL',
  'DCGUSA',
].join('\n');

// Ejemplo oficial del documento 9303 de la OACI (persona ficticia «Anna Maria Eriksson»).
const MRZ: [string, string] = [
  'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<',
  'L898902C36UTO7408122F1204159ZE184226B<<<<<10',
];

describe('lectura del documento (C-KYC-DOCUMENTO)', () => {
  it('lee el código de barras de una licencia de EE. UU. (AAMVA)', () => {
    expect(leerAamva(LICENCIA)).toEqual({
      tipo: 'licencia_eeuu',
      numero: 'D1234562',
      apellidos: 'MUESTRA',
      nombres: 'ANA MARIA',
      nacimiento: '1990-01-15',
      vencimiento: '2030-01-15',
      emisor: 'FL',
      sexo: 'F',
    });
    expect(leerAamva('cualquier otra cosa')).toBeNull();
  });

  it('lee el pasaporte y comprueba sus dígitos de control', () => {
    expect(digitoControl('L898902C3')).toBe(6);
    const r = leerMrz(MRZ, new Date('2010-01-01T00:00:00Z'));
    expect(r?.controlesOk).toBe(true);
    expect(r?.datos).toMatchObject({
      numero: 'L898902C3',
      apellidos: 'ERIKSSON',
      nombres: 'ANNA MARIA',
      nacimiento: '1974-08-12',
      vencimiento: '2012-04-15',
      emisor: 'UTO',
      sexo: 'F',
    });
    // Un número alterado ya no cuadra con su dígito de control.
    const alterado: [string, string] = [MRZ[0], MRZ[1].replace('L898902C3', 'L898902C4')];
    expect(leerMrz(alterado, new Date('2010-01-01T00:00:00Z'))?.controlesOk).toBe(false);
  });
});

describe('reglas del documento (C-KYC-DOCUMENTO)', () => {
  const lic = leerAamva(LICENCIA)!;

  it('vencido o menor de edad no pasa', () => {
    expect(revisarDocumento(lic, new Date('2026-10-29T00:00:00Z')).problemas).toEqual([]);
    expect(revisarDocumento(lic, new Date('2031-01-01T00:00:00Z')).problemas).toEqual(['vencido']);
    expect(edadEn('2010-10-30', new Date('2026-10-29T00:00:00Z'))).toBe(15);
    expect(
      revisarDocumento({ ...lic, nacimiento: '2010-10-30' }, new Date('2026-10-29T00:00:00Z'))
        .problemas,
    ).toEqual(['menor_de_edad']);
    // Licores: 21 años.
    expect(
      revisarDocumento({ ...lic, nacimiento: '2006-01-01' }, new Date('2026-10-29T00:00:00Z'), 21)
        .mayorDeEdad,
    ).toBe(false);
  });

  it('cruza el código con el frente: mismo nombre, fecha y número', () => {
    expect(
      cruzarConFrente(lic, {
        nombre: 'Ana María Muestra',
        nacimiento: '1990-01-15',
        numero: 'D123 4562',
      }),
    ).toEqual({ coincide: true, puntaje: 1, diferencias: [] });
    const otro = cruzarConFrente(lic, { nombre: 'Pedro Gómez', nacimiento: '1990-01-15' });
    expect(otro.coincide).toBe(false);
    expect(otro.diferencias).toEqual(['nombre']);
    expect(cruzarConFrente(lic, {}).coincide).toBe(false);
  });

  it('cruza con el texto del frente leído por OCR, aunque confunda letras (C-KYC-OCR)', () => {
    // Lo que el OCR suele devolver del frente: etiquetas, saltos y una O donde va un 0.
    const frente =
      'FLORIDA\nDRIVER LICENSE\nDL D123 456Z\nMUESTRA\nANA MARIA\nDOB 01/15/1990\nEXP 08/29/2029';
    const leidos = datosDelFrente(lic, frente);
    expect(leidos.numero).toBe(lic.numero);
    expect(leidos.nacimiento).toBe('1990-01-15');
    expect(cruzarConFrente(lic, leidos).coincide).toBe(true);
    // El frente de OTRA persona: otro nombre, otra fecha y otro número no pasan.
    const ajeno = datosDelFrente(lic, 'DRIVER LICENSE\nDL X998877\nGOMEZ\nPEDRO\nDOB 03/02/1985');
    expect(ajeno.numero).toBe('X998877');
    expect(ajeno.nacimiento).toBe('1985-03-02');
    const cruce = cruzarConFrente(lic, ajeno);
    expect(cruce.coincide).toBe(false);
    expect(cruce.diferencias).toEqual(['nombre', 'nacimiento', 'numero']);
  });
});
