import { describe, expect, it } from 'vitest';
import type { LugarCuenta } from '@tumbite/compartido';
import { mundo } from './pruebas/ayuda';

/**
 * C-LUGAR-CLIENTE-CON-SERVICIO (27 nov 2026, Gerencia) — todos los países.
 *
 * Lo que pasaba: la cuenta del revisor de Google entró a Divoox (clientes 0.1.67), eligió Novi en
 * «¿Dónde vives?» y vio «En tu ciudad todavía no hay servicio» justo encima de la lista con Divoox
 * Review Kitchen. El inicio decide el servicio con la cobertura de siempre (la zona activa que cubre el
 * punto); el aviso usaba otra regla, la del conductor, que en producción deja fuera las zonas internas
 * de pruebas («Novi (pruebas)») y la de revisión. Para el cliente, el aviso tiene que decir lo mismo que
 * su inicio: si la zona que le muestra restaurantes cubre su ciudad, no está en espera.
 *
 * Comprobado en ROJO: con `respuestaLugar` y `aplicarLugar` del cliente usando `zonaDeLugar` (la regla
 * del conductor), el registro y el cambio de lugar en Novi dejaban `enEspera: true` y
 * `lugar_espera = 1` en producción.
 */
const NOVI: LugarCuenta = {
  pais: 'US',
  estado: 'MI',
  municipio: 'Oakland County',
  ciudad: 'Novi',
  lugarId: 'gn:5004005',
  lat: 42.4806,
  lng: -83.4755,
};
const GILROY: LugarCuenta = {
  pais: 'US',
  estado: 'CA',
  municipio: 'Santa Clara County',
  ciudad: 'Gilroy',
  lugarId: 'gn:5352214',
  lat: 37.0058,
  lng: -121.5683,
};

async function produccionConNovi() {
  const m = mundo({}, { host: 'divoox.com' });
  await m.DB.prepare(
    `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES ('US-MI-NOVI', 'Novi (pruebas)', 'US', 'USD', 'America/Detroit', 42.48, -83.47, 40, 1)`,
  ).run();
  return m;
}

async function registrar(
  m: ReturnType<typeof mundo>,
  rol: 'cliente' | 'repartidor',
  lugar: LugarCuenta,
) {
  const r = await m.llamar('POST', '/datos/cuentas/registro', {
    nombre: 'Persona Real',
    correo: `${rol}-${Math.random().toString(36).slice(2)}@ejemplo.com`,
    clave: 'clave-segura-1',
    rol,
    idioma: 'es',
    lugar,
  });
  expect(r.estado).toBe(201);
  return { id: r.datos.usuario.id as string, token: r.datos.token as string };
}

const espera = async (m: ReturnType<typeof mundo>, id: string) =>
  (
    await m.DB.prepare('SELECT lugar_espera FROM usuarios WHERE id = ?')
      .bind(id)
      .first<{ lugar_espera: number | null }>()
  )?.lugar_espera ?? null;

describe('C-LUGAR-CLIENTE-CON-SERVICIO · el aviso del cliente dice lo mismo que su inicio', () => {
  it('cliente que vive en Novi: su inicio tiene la zona, así que no está en espera (registro y GET)', async () => {
    const m = await produccionConNovi();
    const inicio = await m.llamar('GET', `/datos/cobertura?lat=${NOVI.lat}&lng=${NOVI.lng}`);
    expect(inicio.datos.estado).toBe('dentro');
    const c = await registrar(m, 'cliente', NOVI);
    expect(await espera(m, c.id)).toBeNull();
    const r = await m.llamar('GET', '/datos/cuentas/lugar', undefined, c.token);
    expect(r.datos).toMatchObject({ enEspera: false, zona: { id: 'US-MI-NOVI' } });
  });

  it('cliente que cambia su lugar a Novi (como el revisor): sale de la espera', async () => {
    const m = await produccionConNovi();
    const c = await registrar(m, 'cliente', GILROY);
    expect(await espera(m, c.id)).toBe(1);
    const r = await m.llamar('PUT', '/datos/cuentas/lugar', { lugar: NOVI }, c.token);
    expect(r.estado).toBe(200);
    expect(r.datos).toMatchObject({ enEspera: false, zona: { id: 'US-MI-NOVI' } });
    expect(await espera(m, c.id)).toBeNull();
  });

  it('donde el inicio no tiene servicio, el aviso sigue: Gilroy queda en espera', async () => {
    const m = await produccionConNovi();
    const c = await registrar(m, 'cliente', GILROY);
    const r = await m.llamar('GET', '/datos/cuentas/lugar', undefined, c.token);
    expect(r.datos).toMatchObject({ enEspera: true, zona: null });
  });

  it('el conductor no cambia: en producción una zona interna de pruebas no le da ciudad ni ID', async () => {
    const m = await produccionConNovi();
    const d = await registrar(m, 'repartidor', NOVI);
    const f = await m.DB.prepare(
      'SELECT u.zona_id, u.lugar_espera, r.codigo FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?',
    )
      .bind(d.id)
      .first<Record<string, unknown>>();
    expect(f).toMatchObject({ zona_id: null, lugar_espera: 1 });
    expect(f?.codigo ?? null).toBeNull();
  });
});
