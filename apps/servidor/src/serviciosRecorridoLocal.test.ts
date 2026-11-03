import { describe, expect, it } from 'vitest';
import { app } from './app';
import { reiniciarEsquema } from './esquema';
import { crearBasePruebas } from './pruebas/d1';

/**
 * C-SERVICIOS-RECORRIDO-LOCAL (SIG-8, 3 nov 2026): «Carro: código sin casco» falló una vez en el
 * recorrido con «servicio no disponible en tu ciudad». Causa: en la computadora (localhost) el
 * servidor solo declaraba Comida; cada vez que el servidor local arrancaba de nuevo (wrangler dev
 * recarga el worker, o la migración se reintenta) la sincronización suspendía Carro y lo borraba de
 * los implementados, aunque la prueba lo acabara de encender. Con SERVICIOS_PRUEBA_LOCAL=1 (solo el
 * recorrido local) el servidor declara lo mismo que el sitio de pruebas; en un sitio publicado la
 * variable no cambia nada.
 */
async function carroEncendido(url: string, env: Record<string, string>) {
  const DB = crearBasePruebas();
  await DB.batch([
    DB.prepare(
      "INSERT OR IGNORE INTO servicios_implementados (servicio_id, contrato) VALUES ('carro', 1)",
    ),
    DB.prepare("UPDATE servicios SET estado = 'disponible' WHERE id = 'carro'"),
    DB.prepare(
      "INSERT INTO servicios_zona (servicio_id, zona_id, estado) VALUES ('carro', 'US-FL-MIAMI', 'disponible') ON CONFLICT DO UPDATE SET estado = 'disponible'",
    ),
  ]);
  // El servidor arranca otra vez (otro aislado): la migración y la sincronización corren de nuevo.
  reiniciarEsquema();
  const r = await app.request(url, {}, { DB, ...env });
  expect(r.status, await r.text()).toBe(200);
  const s = await DB.prepare(
    `SELECT s.estado AS servicio, sz.estado AS zona,
       EXISTS (SELECT 1 FROM servicios_implementados WHERE servicio_id = 'carro') AS implementado
       FROM servicios s JOIN servicios_zona sz ON sz.servicio_id = s.id AND sz.zona_id = 'US-FL-MIAMI'
      WHERE s.id = 'carro'`,
  ).first<{ servicio: string; zona: string; implementado: number }>();
  return s;
}

describe('servicios en prueba en el recorrido local (C-SERVICIOS-RECORRIDO-LOCAL)', () => {
  it('un arranque nuevo del servidor local del recorrido no apaga Carro encendido por la prueba', async () => {
    expect(
      await carroEncendido('http://localhost:8790/datos/servicios', {
        SERVICIOS_PRUEBA_LOCAL: '1',
      }),
    ).toEqual({ servicio: 'disponible', zona: 'disponible', implementado: 1 });
  });

  it('sin la variable, en la computadora sigue siendo solo Comida (como antes)', async () => {
    expect(await carroEncendido('http://localhost:8790/datos/servicios', {})).toMatchObject({
      servicio: 'suspendido',
      implementado: 0,
    });
  });

  it('en producción la variable no enciende nada', async () => {
    expect(
      await carroEncendido('https://divoox.com/datos/servicios', { SERVICIOS_PRUEBA_LOCAL: '1' }),
    ).toMatchObject({ servicio: 'suspendido', implementado: 0 });
  });
});
