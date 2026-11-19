import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contarFilas, type CuentaFilas } from './presupuestoFilas';
import { mundo } from './pruebas/ayuda';
import { TOPE_AVISAME_DIA } from './rutas/avisameServicio';

/**
 * C-OCHO-ICONOS-SIEMPRE (18 nov 2026, orden de Richard) — todos los países. «Avísame cuando llegue»
 * guarda el interés por un servicio cerrado en la zona SOLO al tocar el botón: una fila por persona
 * (o aparato, sin cuenta), servicio y zona; tocar dos veces no escribe dos; mirar el inicio no
 * escribe nada. Comprobado en ROJO antes de existir la ruta (404) y quitando el ON CONFLICT (el segundo toque falla en vez de no hacer nada).
 */
const APARATO = { 'x-aparato': 'and-0123456789abcdef' };
const MIAMI = { lat: 25.7617, lng: -80.1918 };

function conConteo() {
  let cuenta: CuentaFilas = { leidas: 0, escritas: 0 };
  const m = mundo(
    {},
    {
      envolver: (db) => {
        const r = contarFilas(db);
        cuenta = r.cuenta;
        return r.db;
      },
    },
  );
  return { m, escritas: () => cuenta.escritas };
}

const filas = async (m: ReturnType<typeof mundo>) =>
  (
    await m.DB.prepare(
      'SELECT usuario_id, aparato, servicio, zona_id, zona_clave, lat, lng FROM avisos_servicio',
    ).all<Record<string, unknown>>()
  ).results;

describe('C-OCHO-ICONOS-SIEMPRE · «Avísame cuando llegue»', () => {
  it('sin cuenta se guarda con la huella del aparato y la zona; dos toques escriben una sola fila', async () => {
    const m = mundo();
    const a = await m.llamar(
      'POST',
      '/datos/servicios/avisame',
      { servicio: 'moto', ...MIAMI },
      undefined,
      APARATO,
    );
    expect(a.estado).toBe(200);
    expect(a.datos).toEqual({ ok: true });
    const b = await m.llamar(
      'POST',
      '/datos/servicios/avisame',
      { servicio: 'moto', ...MIAMI },
      undefined,
      APARATO,
    );
    expect(b.estado).toBe(200);
    const l = await filas(m);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ usuario_id: null, servicio: 'moto', zona_id: 'US-FL-MIAMI' });
    // Nunca el identificador en claro: solo su huella.
    expect(String(l[0]!.aparato)).toMatch(/^a:[0-9a-f]{64}$/);
  });

  it('con cuenta se guarda a nombre de la persona (una fila por servicio y zona)', async () => {
    const m = mundo();
    const c = await m.cuenta('cliente');
    for (const servicio of ['mercado', 'mercado', 'farmacia'])
      expect(
        (await m.llamar('POST', '/datos/servicios/avisame', { servicio, ...MIAMI }, c.token))
          .estado,
      ).toBe(200);
    const l = await filas(m);
    expect(l.map((x) => x.servicio).sort()).toEqual(['farmacia', 'mercado']);
    expect(l.every((x) => x.usuario_id === c.id)).toBe(true);
  });

  it('el segundo toque no escribe nada (idempotente) y el primero escribe una sola fila', async () => {
    const { m, escritas } = conConteo();
    await m.llamar('GET', '/datos/servicios'); // la primera petición prepara la base
    const antes = escritas();
    await m.llamar(
      'POST',
      '/datos/servicios/avisame',
      { servicio: 'licores', ...MIAMI },
      undefined,
      APARATO,
    );
    const primero = escritas() - antes;
    expect(primero).toBe(1);
    await m.llamar(
      'POST',
      '/datos/servicios/avisame',
      { servicio: 'licores', ...MIAMI },
      undefined,
      APARATO,
    );
    expect(escritas() - antes - primero).toBe(0);
  });

  it('zona desconocida: no falla, se guarda sin zona y con las coordenadas redondeadas', async () => {
    const m = mundo();
    const r = await m.llamar(
      'POST',
      '/datos/servicios/avisame',
      { servicio: 'carro', lat: -33.456789, lng: -70.654321 },
      undefined,
      APARATO,
    );
    expect(r.estado).toBe(200);
    const l = await filas(m);
    expect(l[0]).toMatchObject({
      zona_id: null,
      lat: -33.46,
      lng: -70.65,
      zona_clave: '~-33.46,-70.65',
    });
    // Sin ubicación tampoco falla.
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/servicios/avisame',
          { servicio: 'envios' },
          undefined,
          APARATO,
        )
      ).estado,
    ).toBe(200);
  });

  it('valida lo que entra: servicio desconocido o «Más» no se guardan; sin cuenta ni aparato, 400', async () => {
    const m = mundo();
    for (const servicio of ['mas', 'pizza', ''])
      expect(
        (await m.llamar('POST', '/datos/servicios/avisame', { servicio }, undefined, APARATO))
          .estado,
      ).toBe(400);
    expect((await m.llamar('POST', '/datos/servicios/avisame', { servicio: 'moto' })).estado).toBe(
      400,
    );
    expect(await filas(m)).toHaveLength(0);
  });

  it('mirar el inicio no escribe nada (catálogo de servicios, con y sin ubicación)', async () => {
    const { m, escritas } = conConteo();
    await m.llamar('GET', '/datos/servicios'); // la primera petición prepara la base
    const antes = escritas();
    await m.llamar(
      'GET',
      `/datos/servicios?lat=${MIAMI.lat}&lng=${MIAMI.lng}`,
      undefined,
      undefined,
      APARATO,
    );
    await m.llamar('GET', '/datos/servicios', undefined, undefined, APARATO);
    expect(escritas() - antes).toBe(0);
  });

  // Reserva del revisor (18 nov 2026): sin cuenta, el aparato es una cabecera que se puede inventar.
  it('tope diario: pasado el tope del día no se escribe más y se dice en palabras', async () => {
    const m = mundo();
    const sql = m.DB.prepare(
      "INSERT INTO avisos_servicio (dueno, servicio, zona_clave) VALUES (?, 'moto', '')",
    );
    const lote = Array.from({ length: TOPE_AVISAME_DIA }, (_, i) => sql.bind(`a:relleno-${i}`));
    for (let i = 0; i < lote.length; i += 100) await m.DB.batch(lote.slice(i, i + 100));
    const r = await m.llamar(
      'POST',
      '/datos/servicios/avisame',
      { servicio: 'moto', ...MIAMI },
      undefined,
      APARATO,
    );
    expect(r.estado).toBe(429);
    expect(await filas(m)).toHaveLength(TOPE_AVISAME_DIA);
    const esquema = readFileSync(join(__dirname, '..', '..', '..', 'schema.sql'), 'utf8');
    expect(esquema).toMatch(
      /CREATE INDEX IF NOT EXISTS avisos_servicio_dia ON avisos_servicio\(creado_en\)/,
    );
  });

  it('tiene límite de intentos y la tabla nace con CREATE TABLE IF NOT EXISTS (nunca ALTER)', () => {
    const app = readFileSync(join(__dirname, 'app.ts'), 'utf8');
    expect(app).toMatch(/app\.use\('\/datos\/servicios\/avisame', limiteIntentos\(/);
    const esquema = readFileSync(join(__dirname, '..', '..', '..', 'schema.sql'), 'utf8');
    expect(esquema).toMatch(/CREATE TABLE IF NOT EXISTS avisos_servicio \(/);
    expect(esquema).not.toMatch(/ALTER TABLE avisos_servicio/);
    // Se va con la cuenta al borrarla.
    expect(readFileSync(join(__dirname, 'borrarCuenta.ts'), 'utf8')).toContain(
      'DELETE FROM avisos_servicio WHERE usuario_id = ?',
    );
  });
});
