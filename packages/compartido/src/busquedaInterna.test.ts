import { describe, expect, it } from 'vitest';
import {
  quisoDecirCodigo,
  enmascararCorreo,
  enmascararTelefono,
  esIdFicha,
  estadosDelFiltro,
  interpretarBusqueda,
  limpiarPreferencias,
  rangoPrefijo,
  textoPlano,
  tramoCoincidente,
} from './busquedaInterna';

/** C-BUSCADOR-SERIO: el enrutador mira la forma de lo escrito. Todos los países. */
describe('C-BUSCADOR-SERIO · enrutador del buscador interno', () => {
  it('un código corto con o sin numeral, en mayúsculas o minúsculas', () => {
    expect(interpretarBusqueda('407F').codigo).toBe('407f');
    expect(interpretarBusqueda('#407f2f').codigo).toBe('407f2f');
    expect(interpretarBusqueda('# 407F').codigo).toBe('407f');
    // Comienzo de un UUID con su guion.
    expect(interpretarBusqueda('407f2f1c-12').codigo).toBe('407f2f1c-12');
    // C-BUSCADOR-INSTANTANEO: desde la PRIMERA letra («7», «73», «b4», «B»), con o sin «#».
    expect(interpretarBusqueda('7').codigo).toBe('7');
    expect(interpretarBusqueda('73').codigo).toBe('73');
    expect(interpretarBusqueda('b4')).toMatchObject({ codigo: 'b4', nombre: 'b4' });
    expect(interpretarBusqueda('B').codigo).toBe('b');
    expect(interpretarBusqueda('#7').codigo).toBe('7');
    // Una letra que no es hexadecimal no es código (sí puede ser un nombre).
    expect(interpretarBusqueda('g').codigo).toBeUndefined();
    // «4821» es a la vez un código y el final de un teléfono.
    expect(interpretarBusqueda('4821')).toMatchObject({ codigo: '4821', telefono: '4821' });
  });

  it('un UUID o un identificador entero va a la ficha', () => {
    const u = '407F2F1C-1234-4ABC-9DEF-000000000001';
    expect(interpretarBusqueda(u)).toEqual({ texto: u, vacia: false, id: u.toLowerCase() });
    expect(interpretarBusqueda('zz-vivo-r-2ff1f76da2c5').id).toBe('zz-vivo-r-2ff1f76da2c5');
    expect(interpretarBusqueda('id: abc').id).toBe('abc');
  });

  it('teléfono, correo, placa, monto y código de repartidor', () => {
    expect(interpretarBusqueda('+1 (305) 555-4821').telefono).toBe('13055554821');
    expect(interpretarBusqueda('ANA@Ejemplo.com')).toEqual({
      texto: 'ANA@Ejemplo.com',
      vacia: false,
      correo: 'ana@ejemplo.com',
    });
    expect(interpretarBusqueda('ab-123c').placa).toBe('AB123C');
    expect(interpretarBusqueda('placa: xyz 12').placa).toBe('XYZ12');
    expect(interpretarBusqueda('$12.5').monto).toBe(1250);
    expect(interpretarBusqueda('12,50').monto).toBe(1250);
    expect(interpretarBusqueda('$7').monto).toBe(700);
    expect(interpretarBusqueda('monto: 3.99').monto).toBe(399);
    expect(interpretarBusqueda('us-mia-0001').codigoRepartidor).toBe('US-MIA-0001');
    expect(interpretarBusqueda('tel: 4821').telefono).toBe('4821');
    expect(interpretarBusqueda('tel: 12')).toEqual({ texto: 'tel: 12', vacia: false });
  });

  it('un nombre se busca sin acentos ni mayúsculas; vacío no busca nada', () => {
    expect(interpretarBusqueda('  José  Pérez ').nombre).toBe('jose perez');
    expect(interpretarBusqueda('Ñandú').nombre).toBe('nandu');
    expect(interpretarBusqueda('a').nombre).toBe('a');
    expect(interpretarBusqueda('   ')).toEqual({ texto: '', vacia: true });
    // Un número no es un nombre.
    expect(interpretarBusqueda('407F').nombre).toBeUndefined();
  });

  it('texto plano, rango de prefijo y tramo para resaltar', () => {
    expect(textoPlano('ÁNGELA Muñoz Çelik')).toBe('angela munoz celik');
    expect(textoPlano('José').length).toBe('José'.length);
    expect(rangoPrefijo('407f')).toEqual(['407f', '407g']);
    expect(tramoCoincidente('Ángela Ruiz', 'ange')).toEqual([0, 4]);
    expect(tramoCoincidente('#407F2F', '#407f')).toEqual([1, 5]);
    expect(tramoCoincidente('Ana', 'zz')).toBeNull();
  });

  it('enmascara teléfonos y correos', () => {
    expect(enmascararTelefono('+13055554821')).toBe('+1 ••• ••• 4821');
    expect(enmascararTelefono('3055554821')).toBe('••• ••• 4821');
    expect(enmascararTelefono('')).toBe('');
    expect(enmascararTelefono('12')).toBe('••••');
    expect(enmascararCorreo('ana.perez@gmail.com')).toBe('a•••@gmail.com');
    expect(enmascararCorreo('')).toBe('');
  });

  it('identificadores de ficha y estados del selector', () => {
    expect(esIdFicha('zz-vivo-r-2ff1f76da2c5')).toBe(true);
    expect(esIdFicha('407f2f1c-1234-4abc-9def-000000000001')).toBe(true);
    expect(esIdFicha('vol_p_1')).toBe(true);
    expect(esIdFicha('../x')).toBe(false);
    expect(esIdFicha('')).toBe(false);
    expect(estadosDelFiltro('vivos')).toContain('pago_pendiente');
    expect(estadosDelFiltro('cerrados')).toEqual(['entregado', 'cancelado']);
    expect(estadosDelFiltro('todos')).toHaveLength(7);
  });

  it('las preferencias guardan solo claves conocidas con valores cortos (nunca un nombre)', () => {
    expect(
      limpiarPreferencias({
        zona: 'US-FL-MIAMI',
        estado: 'cerrados',
        q: '407f',
        nombre: 'Ana',
        orden: 'Ana Pérez',
      }),
    ).toEqual({ zona: 'US-FL-MIAMI', estado: 'cerrados' });
    expect(limpiarPreferencias(null)).toEqual({});
  });
});

describe('C-BUSCADOR-INSTANTANEO · ¿quisiste decir…?', () => {
  it('corrige las letras que se confunden con números y los espacios', () => {
    expect(quisoDecirCodigo('B429OC')).toBe('#B4290C');
    expect(quisoDecirCodigo('#73C2E8')).toBeNull();
    expect(quisoDecirCodigo('73 c2')).toBe('#73C2');
    expect(quisoDecirCodigo('4O7F')).toBe('#407F');
    expect(quisoDecirCodigo('l07f')).toBe('#107F');
    // Un nombre de verdad no se «corrige» a código.
    expect(quisoDecirCodigo('Olivia')).toBeNull();
    expect(quisoDecirCodigo('')).toBeNull();
  });
});

describe('C-BUSCADOR-SECCIONES · el comienzo de un correo sin «@»', () => {
  it('desde la segunda letra (desde la tercera si también puede ser un código)', () => {
    expect(interpretarBusqueda('kp').inicioCorreo).toBe('kp');
    expect(interpretarBusqueda('KPrado07').inicioCorreo).toBe('kprado07');
    expect(interpretarBusqueda('lmarin.c').inicioCorreo).toBe('lmarin.c');
    expect(interpretarBusqueda('k').inicioCorreo).toBeUndefined();
    // «b4» y «ab» son códigos: el código manda con dos letras; con tres ya también es un correo.
    expect(interpretarBusqueda('b4').inicioCorreo).toBeUndefined();
    expect(interpretarBusqueda('abe').inicioCorreo).toBe('abe');
    // Con espacios, con «@» o empezando por un número no es el comienzo de un correo.
    expect(interpretarBusqueda('kelly p').inicioCorreo).toBeUndefined();
    expect(interpretarBusqueda('kp@').inicioCorreo).toBeUndefined();
    expect(interpretarBusqueda('4821').inicioCorreo).toBeUndefined();
  });
});
