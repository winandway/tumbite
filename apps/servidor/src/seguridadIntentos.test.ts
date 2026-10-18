import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { limiteIntentosPersistente } from './seguridad';
import { verificarPinEntrega } from './pin';

/**
 * F19 de la auditoría final: el PIN de entrega no tenía tope de intentos y el límite de entrada
 * vivía solo en la memoria de un aislado. Primero en ROJO; después candado (C-INTENTOS).
 */
/** Un pedido mínimo con cliente y restaurante reales (las llaves foráneas lo exigen). */
async function pedidoMinimo(m: ReturnType<typeof mundo>, id: string) {
  const dueno = await m.cuenta('restaurante');
  const cliente = await m.cuenta('cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  await m.DB.prepare(
    `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion)
     VALUES (?, ?, ?, 'listo', '[]', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'inicial', 'x')`,
  )
    .bind(id, cliente.id, r.datos.restaurante.id)
    .run();
}

describe('el PIN de entrega tiene tope de intentos (C-INTENTOS)', () => {
  it('a la quinta equivocación se bloquea, aunque después llegue el PIN correcto', async () => {
    const m = mundo();
    await pedidoMinimo(m, 'p1');
    await m.DB.prepare("INSERT INTO pines_entrega (pedido_id, pin) VALUES ('p1', '4321')").run();
    for (let i = 0; i < 5; i++)
      await expect(verificarPinEntrega(m.DB, 'p1', '0000', 'mal')).rejects.toMatchObject({
        estado: 409,
      });
    await expect(verificarPinEntrega(m.DB, 'p1', '4321', 'mal')).rejects.toMatchObject({
      estado: 409,
      message: expect.stringContaining('Demasiados intentos'),
    });
    const fila = await m.DB.prepare(
      "SELECT intentos, usado_en FROM pines_entrega WHERE pedido_id = 'p1'",
    ).first<{ intentos: number; usado_en: string | null }>();
    expect(fila?.intentos).toBe(5);
    expect(fila?.usado_en).toBeNull();
  });

  it('con el PIN correcto se marca usado y un pedido sin PIN pasa', async () => {
    const m = mundo();
    await pedidoMinimo(m, 'p2');
    await m.DB.prepare("INSERT INTO pines_entrega (pedido_id, pin) VALUES ('p2', '1111')").run();
    await verificarPinEntrega(m.DB, 'p2', '1111', 'mal');
    const fila = await m.DB.prepare(
      "SELECT usado_en FROM pines_entrega WHERE pedido_id = 'p2'",
    ).first<{ usado_en: string | null }>();
    expect(fila?.usado_en).not.toBeNull();
    await expect(verificarPinEntrega(m.DB, 'sin-pin', null, 'mal')).resolves.toBeUndefined();
  });

  it('las dos entregas con PIN (en mano y recogida) pasan por el mismo verificador', () => {
    const s = readFileSync(join(__dirname, 'rutas/operacion.ts'), 'utf8');
    expect(s).not.toMatch(/!== pinFila\.pin/);
    expect(s.match(/verificarPinEntrega\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe('el límite de intentos de entrada sobrevive al aislado (C-INTENTOS)', () => {
  function servidor(DB: D1Database) {
    const app = new Hono<{ Bindings: { DB: D1Database } }>();
    app.use('/entrar', limiteIntentosPersistente(3, 60_000));
    app.post('/entrar', (c) => c.json({ ok: true }));
    return (ip: string) =>
      app.request('/entrar', { method: 'POST', headers: { 'cf-connecting-ip': ip } }, { DB });
  }
  it('tres intentos en un aislado y el cuarto, en OTRO aislado con la misma base, responde 429', async () => {
    const { DB } = mundo();
    const a = servidor(DB);
    const b = servidor(DB);
    for (let i = 0; i < 3; i++) expect((await a('1.1.1.1')).status).toBe(200);
    expect((await b('1.1.1.1')).status).toBe(429);
    expect((await b('2.2.2.2')).status).toBe(200);
  });
  it('la entrada, el registro y la recuperación usan el límite persistente', () => {
    const s = readFileSync(join(__dirname, 'app.ts'), 'utf8');
    for (const ruta of [
      '/datos/cuentas/entrar',
      '/datos/cuentas/registro',
      '/datos/cuentas/recuperar',
      '/datos/cuentas/restablecer',
    ])
      expect(s).toContain(`app.use('${ruta}', limiteIntentosPersistente(`);
  });
});
