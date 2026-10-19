import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

/**
 * Carreras contra el motor real de la base (D1 en el servidor local de Cloudflare), no contra la
 * base de pruebas en memoria. Solo en esta computadora.
 *
 * C-MIEMBRO-UNICO: dos dueños agregan a la MISMA persona a la vez, 25 veces: en cada ronda gana uno
 * y el otro recibe 409; nadie queda en dos equipos.
 */
const RAIZ = join(__dirname, '..', '..');
const STAGING = Boolean(process.env.RECORRIDO_URL);
const DATOS = STAGING
  ? null
  : (JSON.parse(readFileSync(join(RAIZ, '.recorrido', 'datos.json'), 'utf8')) as { clave: string });

test.skip(STAGING, 'solo en esta computadora');

test('alta simultánea del mismo miembro desde dos restaurantes: siempre gana uno solo', async ({
  request,
}) => {
  test.setTimeout(240_000);
  const id = Date.now().toString(36);
  const clave = DATOS!.clave;
  let ip = 0;
  // Cada cuenta desde otra dirección: el límite de intentos del registro es por dirección.
  const desde = () => ({ 'cf-connecting-ip': `10.77.${Math.floor(++ip / 250)}.${ip % 250}` });
  const cuenta = async (quien: string) => {
    const correo = `${quien}.${id}@carreras.test`;
    const r = await request.post('/datos/cuentas/registro', {
      headers: desde(),
      data: { nombre: `Carrera ${quien}`, correo, clave, rol: 'restaurante' },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return { correo, token: ((await r.json()) as { token: string }).token };
  };
  const dueno = async (quien: string) => {
    const c = await cuenta(quien);
    const r = await request.put('/datos/mi-restaurante', {
      headers: { authorization: `Bearer ${c.token}` },
      data: {
        nombre: `Local ${quien} ${id}`,
        categoria: 'Pizza',
        telefono: '3055550100',
        direccion: '100 Biscayne Blvd, Miami, FL',
        lat: 25.7743,
        lng: -80.1937,
      },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return c;
  };
  const a = await dueno('a');
  const b = await dueno('b');
  let ganadas = 0;
  for (let i = 0; i < 25; i++) {
    const staff = await cuenta(`staff${i}`);
    const alta = (d: { token: string }) =>
      request.post('/datos/mi-restaurante/equipo', {
        headers: { authorization: `Bearer ${d.token}` },
        data: { correo: staff.correo, rol: 'staff' },
      });
    const [ra, rb] = await Promise.all([alta(a), alta(b)]);
    const estados = [ra.status(), rb.status()].sort();
    expect(estados, `ronda ${i}`).toEqual([201, 409]);
    ganadas++;
    // El miembro entra a UN solo restaurante.
    const mio = await request.get('/datos/mi-restaurante', {
      headers: { authorization: `Bearer ${staff.token}` },
    });
    expect(((await mio.json()) as { restaurante: { nombre: string } }).restaurante.nombre).toMatch(
      /^Local (a|b) /,
    );
  }
  expect(ganadas).toBe(25);
});
