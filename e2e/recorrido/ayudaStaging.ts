import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VERSION_TERMINOS } from '../../packages/compartido/src/terminos';
import type { APIRequestContext } from '@playwright/test';
import { expect } from './fixtures';
import { registrarPausado } from './registroPausado';

/**
 * Piezas comunes de las pruebas de dinero en el SITIO DE PRUEBAS (Stripe en modo prueba de verdad):
 * cuentas de la corrida, un comercio en Miami, el repartidor de la corrida, pagar con la tarjeta de
 * prueba, repartir hasta la puerta y cerrar contra Stripe. Las usan `domicilioStaging.spec.ts` y
 * `circuitoPagosStaging.spec.ts`. EE. UU.
 */
export const REST = { lat: 25.7751, lng: -80.1902 };
// La casa, a unos 500 m: el GPS llega sin saltos imposibles.
export const CASA = { lat: 25.7795, lng: -80.1902 };

export type Ctx = Awaited<ReturnType<typeof preparar>>;

export async function preparar(request: APIRequestContext) {
  const secreto = { 'x-reloj-secreto': process.env.RECORRIDO_SECRETO ?? '' };
  const sql = async (comando: string) => {
    const r = await request.post('/datos/interno/diagnostico/sql', {
      headers: secreto,
      data: { sql: comando },
    });
    expect(r.ok(), await r.text()).toBe(true);
    return ((await r.json()) as { results: Record<string, unknown>[] }).results;
  };
  const id = Date.now().toString(36);
  const clave = `Casa-${id}-Puerta9`;
  let n = 0;
  const cuenta = async (
    q: string,
    rol: 'cliente' | 'restaurante' | 'repartidor',
    nombre = `Prueba ${q}`,
  ) => {
    const correo = `${q}.${id}@recorrido.test`;
    const r = await registrarPausado(request, {
      nombre,
      correo,
      clave,
      rol,
      telefono: `3${String(Date.now()).slice(-8)}${n++ % 10}`,
    });
    expect(r.ok(), await r.text()).toBe(true);
    await sql(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE correo = '${correo}'`,
    );
    return (await r.json()) as { token: string; usuario: { id: string } };
  };
  const con = (t: string) => ({ authorization: `Bearer ${t}`, 'x-idioma': 'es' });
  return { request, secreto, sql, id, cuenta, con };
}

/** Un comercio de la corrida en Miami, aprobado y abierto toda la semana. */
export async function comercio(x: Ctx, q: string, categoria: string) {
  const dueno = await x.cuenta(q, 'restaurante');
  const ficha = await x.request.put('/datos/mi-restaurante', {
    headers: x.con(dueno.token),
    data: {
      nombre: `${categoria} Casa ${x.id.slice(-5)}`,
      direccion: '320 Calle de Ejemplo, Miami, FL',
      ...REST,
      categoria,
      telefono: '3055550197',
    },
  });
  expect(ficha.ok(), await ficha.text()).toBe(true);
  const rid = ((await ficha.json()) as { restaurante: { id: string } }).restaurante.id;
  await x.sql(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${rid}'`);
  return { dueno, rid };
}

export async function abrir(x: Ctx, token: string) {
  await x.request.put('/datos/mi-restaurante/horarios', {
    headers: x.con(token),
    data: { turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })) },
  });
  const r = await x.request.patch('/datos/mi-restaurante/abierto', {
    headers: x.con(token),
    data: { abierto: true },
  });
  expect(r.status(), await r.text()).toBe(200);
}

/** El repartidor de la corrida, conectado junto al comercio (solo él recibe la oferta en Miami). */
export async function repartidor(x: Ctx) {
  const rep = await x.cuenta('repartidor.casa', 'repartidor', 'Repartidor Prueba');
  await x.sql(
    `INSERT OR IGNORE INTO terminos_aceptados (usuario_id, version) VALUES ('${rep.usuario.id}', '${VERSION_TERMINOS}')`,
  );
  // La foto de control de la semana ya tomada (la corrida no tiene cámara).
  await x.sql(
    `INSERT INTO selfies_control (id, usuario_id, tomada_en, resultado) VALUES ('nxt3-${x.id}', '${rep.usuario.id}', datetime('now'), 'ok')`,
  );
  // C-RECORRIDO-NO-PISA: ningún otro repartidor conectado en Miami se lleva la oferta.
  await x.sql(
    `UPDATE repartidores SET conectado = 0 WHERE zona_id = 'US-FL-MIAMI' AND usuario_id <> '${rep.usuario.id}'`,
  );
  const r = await x.request.post('/datos/repartidor/conectar', {
    headers: x.con(rep.token),
    data: { conectado: true, ...REST },
  });
  expect(r.status(), await r.text()).toBe(200);
  const estado = (await (
    await x.request.get('/datos/repartidor/estado', { headers: x.con(rep.token) })
  ).json()) as { ocupadoEn?: string | null };
  expect(estado.ocupadoEn ?? null, 'C-OCUPADO-VISIBLE: libre para Comida y Mercado').toBeNull();
  return rep;
}

/** Paga con la tarjeta de prueba de Stripe y espera el aviso real que lo deja pagado. */
export async function pagar(x: Ctx, pedidoId: string) {
  const pago = await x.request.post('/datos/interno/diagnostico/confirmar-pago', {
    headers: x.secreto,
    data: { pedidoId },
  });
  expect(pago.status(), await pago.text()).toBe(200);
  const p = (await pago.json()) as { estado: string; autorizado: number };
  expect(p.estado).toBe('requires_capture');
  await expect
    .poll(
      async () => (await x.sql(`SELECT estado FROM pedidos WHERE id = '${pedidoId}'`))[0]?.estado,
      { timeout: 90_000, message: 'el aviso real de Stripe deja el pedido pagado' },
    )
    .toBe('pagado');
  return p.autorizado;
}

/** Oferta, aceptar, código del comercio, foto de la bolsa, GPS en la puerta y foto de la entrega. */
export async function repartir(
  x: Ctx,
  pedidoId: string,
  rep: { token: string },
  destino: { lat: number; lng: number } = CASA,
) {
  const bolsa = readFileSync(join(__dirname, 'fotos', 'bolsa-entrega.jpg'));
  const subir = (ruta: string, donde: { lat: number; lng: number }) =>
    x.request.post(`${ruta}?lat=${donde.lat}&lng=${donde.lng}`, {
      headers: { ...x.con(rep.token), 'content-type': 'image/jpeg' },
      data: bolsa,
    });
  await expect
    .poll(
      async () => {
        const o = (await (
          await x.request.get('/datos/repartidor/ofertas', { headers: x.con(rep.token) })
        ).json()) as { ofertas: { id: string }[] };
        return o.ofertas.some((f) => f.id === pedidoId);
      },
      { timeout: 60_000, intervals: [2_000], message: 'la oferta le llega al repartidor' },
    )
    .toBe(true);
  const acepta = await x.request.post(`/datos/repartidor/ofertas/${pedidoId}/aceptar`, {
    headers: x.con(rep.token),
    data: {},
  });
  expect(acepta.ok(), await acepta.text()).toBe(true);
  const verificar = await x.request.post(`/datos/repartidor/pedidos/${pedidoId}/verificar`, {
    headers: x.con(rep.token),
    data: { codigo: pedidoId },
  });
  expect(verificar.ok(), await verificar.text()).toBe(true);
  const recogida = await subir(`/datos/repartidor/pedidos/${pedidoId}/foto-recogida`, REST);
  expect(recogida.ok(), await recogida.text()).toBe(true);
  await expect
    .poll(
      async () => (await x.sql(`SELECT estado FROM pedidos WHERE id = '${pedidoId}'`))[0]?.estado,
      { timeout: 30_000, message: 'con el código y la foto de la bolsa sale en camino' },
    )
    .toBe('en_camino');
  await expect
    .poll(
      async () => {
        for (let i = 0; i < 2; i++)
          await x.request.post('/datos/repartidor/ubicacion', {
            headers: x.con(rep.token),
            data: { ...destino, precision: 10 },
          });
        const e = (await (
          await x.request.get('/datos/repartidor/estado', { headers: x.con(rep.token) })
        ).json()) as { activo?: { llegoCliente?: boolean } };
        return Boolean(e.activo?.llegoCliente);
      },
      { timeout: 90_000, intervals: [3_000], message: 'el GPS lo deja en la puerta' },
    )
    .toBe(true);
  const entrega = await subir(`/datos/repartidor/pedidos/${pedidoId}/entregado`, destino);
  expect(entrega.status(), await entrega.text()).toBe(200);
}

/** Lo capturado coincide con el total del recibo, y la conciliación de ese pedido con Stripe. */
export async function cerrar(x: Ctx, pedidoId: string) {
  await expect
    .poll(
      async () =>
        (
          await x.sql(
            `SELECT p.estado || ':' || p.total || ':' || COALESCE(c.capturado, '') AS e FROM pedidos p LEFT JOIN cobros c ON c.pedido_id = p.id WHERE p.id = '${pedidoId}'`,
          )
        )[0]?.e,
      { timeout: 60_000, message: 'entregado y capturado el total del recibo' },
    )
    .toMatch(/^entregado:(\d+):\1$/);
  const total = Number(
    (await x.sql(`SELECT total FROM pedidos WHERE id = '${pedidoId}'`))[0]?.total ?? -1,
  );
  const conc = await x.request.post('/datos/interno/diagnostico/conciliacion', {
    headers: x.secreto,
    data: { pedidos: [pedidoId] },
  });
  expect(conc.ok(), await conc.text()).toBe(true);
  const c = (await conc.json()) as {
    ok: boolean;
    casos: { nombre: string; ok: boolean; detalle?: string }[];
  };
  return {
    total,
    c,
    resumen: `conciliación ${c.ok ? 'cuadra' : 'NO cuadra'} (${c.casos.map((y) => `${y.ok ? 'ok' : 'NO'} ${y.nombre}${y.ok ? '' : ` — ${y.detalle ?? ''}`}`).join('; ')})`,
  };
}
