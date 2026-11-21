import { describe, expect, it } from 'vitest';
import { PAISES, datosPais, paisDePrefijo } from './paises';
import { aE164, leerTelefono, operadoraDe, telefonoParaMostrar } from './telefono';
import { lugarDePunto, municipioPorCodigo, territorio } from './territorio';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// C-DATOS-PAIS / C-TELEFONO-E164 / C-TERRITORIO-OFICIAL (21 nov 2026).
describe('teléfonos con libphonenumber', () => {
  it('el celular venezolano escrito como lo dice la gente sale en E.164 con su operadora', () => {
    const r = leerTelefono('0424-7568871', 'VE');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.telefono.e164).toBe('+584247568871');
    expect(r.telefono.digitos).toBe('584247568871');
    expect(r.telefono.pais).toBe('VE');
    expect(r.telefono.tipo).toBe('celular');
    expect(r.telefono.operadora).toBe('movistar');
    expect(r.telefono.internacional.startsWith('+58 ')).toBe(true);
  });

  it('el caso de El Vigía: «04247568871» nunca sale «+0…»', () => {
    expect(aE164('04247568871', 'VE')).toBe('+584247568871');
    expect(telefonoParaMostrar('04247568871', 'VE')).not.toMatch(/^\+0/);
  });

  it('con «+» manda el código escrito, aunque la zona sea de otro país', () => {
    expect(aE164('+57 300 1234567', 'VE')).toBe('+573001234567');
    expect(aE164('0058 412 1234567', 'US')).toBe('+584121234567');
  });

  it('sin «+» ni país no se adivina', () => {
    expect(leerTelefono('04121234567', null)).toEqual({ ok: false, motivo: 'sin_pais' });
  });

  it('rechaza un número que no existe en su país y un fijo cuando se pide celular', () => {
    expect(leerTelefono('0424-75688', 'VE')).toEqual({ ok: false, motivo: 'invalido' });
    // 0274: fijo de Mérida.
    expect(leerTelefono('0274-2511111', 'VE', { soloCelular: true })).toEqual({
      ok: false,
      motivo: 'no_es_celular',
    });
  });

  it('las operadoras de Venezuela salen del plan oficial', () => {
    expect(operadoraDe('584121234567')).toBe('Digitel GSM');
    expect(operadoraDe('584161234567')).toBe('Movilnet');
  });

  it('Estados Unidos y Perú también se leen sin el código', () => {
    expect(aE164('(248) 555-0134', 'US')).toBe('+12485550134');
    expect(aE164('987 654 321', 'PE')).toBe('+51987654321');
  });
});

describe('datos de cada país', () => {
  it('cada país tiene moneda ISO, prefijo, zona horaria e idioma', () => {
    for (const p of Object.values(PAISES)) {
      expect(p.moneda).toMatch(/^[A-Z]{3}$/);
      expect(p.monedaCobro).toMatch(/^[A-Z]{3}$/);
      expect(p.prefijo).toMatch(/^\d{1,3}$/);
      expect(p.zonaHoraria).toMatch(/^[A-Za-z]+\/[A-Za-z_]+$/);
      expect(p.direccion.length).toBeGreaterThan(2);
      expect(p.ejemploCelular.length).toBeGreaterThan(6);
    }
  });

  it('un país desconocido no se cambia por otro', () => {
    expect(datosPais('ZZ')).toBeNull();
    expect(paisDePrefijo('58')).toBe('VE');
  });
});

describe('territorio oficial de Venezuela', () => {
  it('trae los totales del INE: 25 entidades, 336 municipios, 1135 parroquias', () => {
    const t = territorio('VE');
    expect(t?.entidades).toHaveLength(25);
    expect(t?.municipios).toHaveLength(336);
    expect(t?.parroquias).toHaveLength(1135);
    expect(t?.licencia).toBe('CC BY-IGO');
  });

  it('El Vigía cae en el municipio Alberto Adriani, Mérida, con los contornos del sitio', () => {
    const contornos = JSON.parse(
      readFileSync(
        join(__dirname, '../../../../apps/panel/public/territorio/VE/municipios.json'),
        'utf8',
      ),
    );
    const pcode = lugarDePunto(contornos, 8.6159, -71.6442);
    expect(pcode).toBe('VE1401');
    expect(municipioPorCodigo(pcode)).toEqual({
      pcode: 'VE1401',
      nombre: 'Alberto Adriani',
      entidad: { pcode: 'VE14', nombre: 'Mérida' },
    });
    // En el mar no hay municipio.
    expect(lugarDePunto(contornos, 13.5, -66)).toBeNull();
  });
});

describe('el registro valida y repasa el celular con su país', async () => {
  const { errorTelefono, filasParaRevisar } = await import('../revisarRegistro');
  it('con el país elegido, un número imposible se dice antes de enviar y uno bueno pasa', () => {
    expect(errorTelefono('042400001', 'es', 'VE')).toMatch(/no existe/);
    expect(errorTelefono('04240000001', 'es', 'VE')).toBeNull();
    expect(errorTelefono('02742511111', 'es', 'VE')).toMatch(/fijo/);
  });
  it('«Revisa tus datos» lo muestra como quedará guardado: con +58', () => {
    const filas = filasParaRevisar(
      {
        nombre: 'Ana',
        correo: 'a@ejemplo.com',
        telefono: '04240000001',
        clave: 'x',
        paisTelefono: 'VE',
      },
      'es',
      ['telefono'],
    );
    expect(filas[0]?.valor).toMatch(/^\+58 424/);
  });
});

describe('C-TERRITORIO-OFICIAL · la lista liviana del panel coincide con los datos', () => {
  it('cada país con territorio tiene sus contornos de municipios en el sitio', async () => {
    const { PAISES_CON_TERRITORIO_OFICIAL } = await import('./paises');
    const { PAISES_CON_TERRITORIO } = await import('./territorio');
    expect([...PAISES_CON_TERRITORIO_OFICIAL].sort()).toEqual([...PAISES_CON_TERRITORIO].sort());
    const { existsSync } = await import('node:fs');
    for (const iso of PAISES_CON_TERRITORIO)
      expect(
        existsSync(
          join(__dirname, `../../../../apps/panel/public/territorio/${iso}/municipios.json`),
        ),
      ).toBe(true);
  });
});

describe('C-SIN-ZONA-VISIBLE · el país de un celular sin otra pista', async () => {
  const { paisUnicoDelCelular } = await import('./telefono');
  it('«0414…» solo existe en Venezuela; un número que vale en varios países no se adivina', () => {
    expect(paisUnicoDelCelular('04141234567')).toBe('VE');
    expect(paisUnicoDelCelular('+573001234567')).toBe('CO');
    expect(paisUnicoDelCelular('12')).toBeNull();
  });
});
