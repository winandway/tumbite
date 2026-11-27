import { describe, expect, it } from 'vitest';
import {
  alEscribir,
  errorAnioVehiculo,
  errorCasilla,
  errorDireccion,
  errorDocumento,
  errorMonto,
  errorNombre,
  errorPlaca,
  montoACentavos,
  tecladoDe,
  zNombreCompleto,
  zPlaca,
} from './casillas';
import { esquemaRegistro } from './esquemas';
import { validarRegistro } from './revisarRegistro';

/**
 * C-CASILLA-CON-SU-TIPO (27 nov 2026, Richard en su Android: su correo en «Nombre y apellido» pasó).
 * Si alguna de estas falla, una casilla de Divoox vuelve a aceptar lo que no le corresponde.
 */
describe('C-CASILLA-CON-SU-TIPO: nombre y apellido', () => {
  it('un correo en el nombre se rechaza (el caso de Richard)', () => {
    expect(errorNombre('richard@gmail.com', 'es', true)).toBe(
      'Escribe tu nombre como en tu cédula, sin números ni @.',
    );
    expect(errorNombre('richard@gmail.com', 'en', true)).toMatch(/without numbers or @/);
    expect(errorNombre('Ana＠Pérez', 'es', true)).not.toBeNull();
  });
  it('números y símbolos se rechazan', () => {
    expect(errorNombre('Juan Pérez 2', 'es', true)).not.toBeNull();
    expect(errorNombre('Juan_Pérez', 'es', true)).not.toBeNull();
    expect(errorNombre('Juan Pérez!', 'es', true)).not.toBeNull();
    expect(errorNombre('-- --', 'es', true)).not.toBeNull();
  });
  it('acentos, ñ, apóstrofo y guion de cualquier idioma pasan', () => {
    for (const n of [
      'José Muñoz',
      'María-José Peña',
      "Sinéad O'Connor",
      'Ana O’Neil',
      'Zoë Brontë',
      'Nguyễn Văn',
      '  Heriberto   Rondón  ',
    ])
      expect(errorNombre(n, 'es', true), n).toBeNull();
  });
  it('pide el apellido cuando dice «Nombre y apellido»', () => {
    expect(errorNombre('Heriberto', 'es', true)).toBe(
      'Escribe tu nombre y tu apellido, separados por un espacio.',
    );
    expect(errorNombre('Heriberto', 'es', false)).toBeNull();
  });
  it('de 2 a 60 letras', () => {
    expect(errorNombre('A', 'es')).not.toBeNull();
    expect(errorNombre(`${'a'.repeat(40)} ${'b'.repeat(30)}`, 'es', true)).not.toBeNull();
  });
  it('el registro (apps y web) usa la misma regla', () => {
    const datos = {
      nombre: 'richard@gmail.com',
      correo: 'a@b.com',
      telefono: '',
      clave: '12345678',
    };
    expect(validarRegistro(datos, 'es', ['nombre'])).toEqual([
      { campo: 'nombre', mensaje: 'Escribe tu nombre como en tu cédula, sin números ni @.' },
    ]);
  });
  it('el servidor (esquemaRegistro) rechaza el correo en el nombre y letras en el celular', () => {
    const base = {
      nombre: 'Richard Pérez',
      correo: 'richard@ejemplo.com',
      clave: '12345678',
      rol: 'repartidor' as const,
    };
    expect(esquemaRegistro.safeParse(base).success).toBe(true);
    const r = esquemaRegistro.safeParse({ ...base, nombre: 'richard@ejemplo.com' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(['nombre']);
    const t = esquemaRegistro.safeParse({ ...base, telefono: '0414abc1234' });
    expect(t.success).toBe(false);
    expect(t.error?.issues[0]?.path).toEqual(['telefono']);
    expect(zNombreCompleto().parse('  ana   maría  ')).toBe('ana maría');
  });
});

describe('C-CASILLA-CON-SU-TIPO: celular', () => {
  it('letras se rechazan y, al escribir, no entran', () => {
    expect(errorCasilla('celular', '0414abc1234', { pais: 'VE' })).not.toBeNull();
    expect(alEscribir('celular', '0414-abc 123')).toBe('0414123');
  });
  it('Venezuela: 0412, 0414, 0416, 0424 y 0426 más 7 dígitos', () => {
    for (const p of ['0412', '0414', '0416', '0424', '0426'])
      expect(errorCasilla('celular', `${p}1234567`, { pais: 'VE' }), p).toBeNull();
    expect(errorCasilla('celular', '041412345', { pais: 'VE' })).not.toBeNull();
    expect(errorCasilla('celular', '04141234567890', { pais: 'VE' })).not.toBeNull();
  });
  it('EE. UU.: 10 dígitos', () => {
    expect(errorCasilla('celular', '2485550123', { pais: 'US' })).toBeNull();
    expect(errorCasilla('celular', '248555012', { pais: 'US' })).not.toBeNull();
  });
});

describe('C-CASILLA-CON-SU-TIPO: correo, documento, placa, año, monto y dirección', () => {
  it('correo con formato real', () => {
    expect(errorCasilla('correo', 'richard')).not.toBeNull();
    expect(errorCasilla('correo', 'richard@gmail')).not.toBeNull();
    expect(errorCasilla('correo', 'richard@gmail.com')).toBeNull();
  });
  it('cédula de Venezuela: V o E y su número', () => {
    expect(errorDocumento('V-12.345.678', 'es', 'VE')).toBeNull();
    expect(errorDocumento('e12345678', 'es', 'VE')).toBeNull();
    expect(errorDocumento('12345678', 'es', 'VE')).not.toBeNull();
    expect(errorDocumento('X-12345678', 'es', 'VE')).not.toBeNull();
    expect(errorDocumento('V-1234#678', 'es', 'VE')).not.toBeNull();
  });
  it('placa: letras y números, mayúsculas, sin símbolos', () => {
    expect(errorPlaca('AB1C23D', 'es', 'VE')).toBeNull();
    expect(errorPlaca('ab-123-cd', 'es', 'VE')).toBeNull();
    expect(errorPlaca('AB#12$', 'es', 'VE')).toBe(
      'La placa lleva solo letras y números, sin símbolos.',
    );
    expect(errorPlaca('ABCDEF', 'es', 'VE')).not.toBeNull();
    expect(errorPlaca('LOVEIT', 'en', 'US')).toBeNull();
    expect(zPlaca('VE').parse('ab 1c2-3d')).toBe('AB1C23D');
    expect(zPlaca('VE').safeParse('AB@123').success).toBe(false);
    expect(alEscribir('placa', 'ab1c')).toBe('AB1C');
  });
  it('año: 4 dígitos de 1990 al año que viene', () => {
    const hoy = new Date('2026-11-27T00:00:00Z');
    expect(errorAnioVehiculo('2018', 'es', true, hoy)).toBeNull();
    expect(errorAnioVehiculo('2027', 'es', true, hoy)).toBeNull();
    expect(errorAnioVehiculo('2028', 'es', true, hoy)).not.toBeNull();
    expect(errorAnioVehiculo('1989', 'es', true, hoy)).not.toBeNull();
    expect(errorAnioVehiculo('18', 'es', true, hoy)).not.toBeNull();
    expect(alEscribir('anioVehiculo', '20a18x9')).toBe('2018');
  });
  it('montos con decimales', () => {
    expect(errorMonto('12.50')).toBeNull();
    expect(errorMonto('12,5')).toBeNull();
    expect(errorMonto('12.505')).not.toBeNull();
    expect(errorMonto('doce')).not.toBeNull();
    expect(montoACentavos('12,5')).toBe(1250);
  });
  it('dirección: libre, pero no vacía ni basura', () => {
    expect(errorDireccion('Av. Bolívar, casa 12')).toBeNull();
    expect(errorDireccion('')).not.toBeNull();
    expect(errorDireccion('12345')).not.toBeNull();
    expect(errorDireccion('aaaaaa')).not.toBeNull();
    expect(errorDireccion('ana@gmail.com')).not.toBeNull();
  });
  it('cada casilla trae su teclado', () => {
    expect(tecladoDe('celular').keyboardType).toBe('phone-pad');
    expect(tecladoDe('anioVehiculo').keyboardType).toBe('number-pad');
    expect(tecladoDe('correo').keyboardType).toBe('email-address');
    expect(tecladoDe('placa').autoCapitalize).toBe('characters');
    expect(tecladoDe('monto').keyboardType).toBe('decimal-pad');
  });
});
