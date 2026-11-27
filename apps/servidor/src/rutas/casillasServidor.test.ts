import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS } from '@tumbite/compartido';
import { abrirCaracas } from '../pruebas/motoVe';
import { mundo } from '../pruebas/ayuda';

/**
 * C-CASILLA-CON-SU-TIPO (27 nov 2026, Richard en su Android: su correo en «Nombre y apellido» pasó).
 * El servidor es la fuente de verdad: aunque una app vieja no avise, lo que no le corresponde a una
 * casilla se rechaza con el error en ESA casilla (las apps lo muestran debajo de ella).
 */
describe('C-CASILLA-CON-SU-TIPO en el servidor', () => {
  const cuerpo = (extra: Record<string, unknown>) => ({
    nombre: 'Heriberto Rondón',
    correo: `conductor-${Math.random().toString(36).slice(2)}@ejemplo.com`,
    clave: 'clave-segura-1',
    rol: 'repartidor',
    ...extra,
  });

  it('un correo en el nombre se rechaza en «nombre» (en español y en inglés)', async () => {
    const m = mundo();
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      cuerpo({ nombre: 'rich@gmail.com' }),
    );
    expect(r.estado).toBe(400);
    expect(r.datos).toEqual({
      error: 'Escribe tu nombre como en tu cédula, sin números ni @.',
      campo: 'nombre',
    });
    const en = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      cuerpo({ nombre: 'rich@gmail.com' }),
      undefined,
      { 'x-idioma': 'en' },
    );
    expect(en.datos.error).toBe('Write your name as it appears on your ID, without numbers or @.');
  });

  it('números en el nombre, o sin apellido, se rechazan; con acentos y ñ pasa', async () => {
    const m = mundo();
    expect(
      (await m.llamar('POST', '/datos/cuentas/registro', cuerpo({ nombre: 'Juan 23' }))).datos
        .campo,
    ).toBe('nombre');
    expect(
      (await m.llamar('POST', '/datos/cuentas/registro', cuerpo({ nombre: 'Heriberto' }))).datos
        .campo,
    ).toBe('nombre');
    expect(
      (await m.llamar('POST', '/datos/cuentas/registro', cuerpo({ nombre: 'José Muñoz-Peña' })))
        .estado,
    ).toBe(201);
  });

  it('letras en el celular se rechazan en «telefono»', async () => {
    const m = mundo();
    const r = await m.llamar(
      'POST',
      '/datos/cuentas/registro',
      cuerpo({ telefono: '0414abc1234' }),
    );
    expect(r.estado).toBe(400);
    expect(r.datos.campo).toBe('telefono');
  });

  it('símbolos en la placa y un año fuera de rango se rechazan; la placa se guarda limpia', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
    expect((await abrirCaracas({ m, admin, cliente })).estado).toBe(201);
    const rep = await m.cuenta('repartidor', 'Conductor de ejemplo');
    const yo = (metodo: string, ruta: string, c?: unknown) => m.llamar(metodo, ruta, c, rep.token);
    expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
    const moto = (extra: Record<string, unknown>) =>
      yo('POST', '/datos/conductor/vehiculos', {
        tipo: 'moto',
        marca: 'Motos Divoox',
        modelo: 'M150',
        anio: 2023,
        color: 'Negro',
        placa: 'AB1C23D',
        ...extra,
      });
    const simbolos = await moto({ placa: 'AB#12$' });
    expect(simbolos.estado).toBe(400);
    expect(simbolos.datos).toEqual({
      error: 'La placa lleva solo letras y números, sin símbolos.',
      campo: 'placa',
    });
    const corta = await moto({ placa: 'ABCD' });
    expect(corta.datos.campo).toBe('placa');
    const vieja = await moto({ anio: 1985 });
    expect(vieja.datos.campo).toBe('anio');
    const ok = await moto({ placa: 'ab-1c2 3d' });
    expect(ok.estado).toBe(201);
    const fila = await m.DB.prepare('SELECT placa FROM vehiculos WHERE id = ?')
      .bind(ok.datos.id)
      .first<{ placa: string }>();
    expect(fila?.placa).toBe('AB1C23D');
  });
});
