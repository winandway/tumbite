import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { conciliar } from './conciliacion';
import { embudo } from './rutas/informes';

/**
 * C-PEDIDO-PRUEBA (BRE-4, 2 nov 2026), como «Create test order» de DoorDash Merchant: el restaurante
 * se manda un pedido ficticio para practicar aceptar, marcar listo y ver el ticket. Sin cobro, sin
 * repartidor y FUERA de la conciliación, los informes y el embudo: vive en su propia tabla, nunca
 * en `pedidos`. Todos los países.
 */
describe('pedido de prueba del restaurante', () => {
  async function escena(conPlatos = true) {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    await m.abrir(dueno.token);
    if (conPlatos)
      for (const nombreEs of ['Pizza', 'Ensalada', 'Limonada'])
        await m.llamar(
          'POST',
          '/datos/mi-restaurante/platos',
          { nombreEs, precioCentavos: 1000 },
          dueno.token,
        );
    return { m, dueno, admin, rid };
  }
  const hoy = () => new Date().toISOString().slice(0, 10);

  it('suena como un pedido nuevo, se acepta, se marca listo y se termina sin tocar el dinero', async () => {
    const { m, dueno } = await escena();
    const antesEmbudo = await embudo(m.DB, hoy(), hoy());
    const nuevo = await m.llamar('POST', '/datos/restaurante/pedido-prueba', {}, dueno.token);
    expect(nuevo.estado).toBe(200);
    const id = nuevo.datos.pedido.id as string;
    expect(nuevo.datos.pedido.prueba).toBe(true);
    expect(nuevo.datos.pedido.lineas.length).toBeGreaterThan(0);
    expect(nuevo.datos.pedido.lineas.length).toBeLessThanOrEqual(2);

    const lista = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    const enLista = lista.datos.pedidos.find((p: { id: string }) => p.id === id);
    expect(enLista).toMatchObject({ estado: 'pagado', prueba: true, repartidor: null });

    for (const [ruta, cuerpo, estado] of [
      ['aceptar', { minutos: 15 }, 'aceptado'],
      ['listo', {}, 'listo'],
      ['terminar-prueba', {}, 'entregado'],
    ] as const) {
      const r = await m.llamar(
        'POST',
        `/datos/restaurante/pedidos/${id}/${ruta}`,
        cuerpo,
        dueno.token,
      );
      expect(r.estado, ruta).toBe(200);
      const l = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
      expect(l.datos.pedidos.find((p: { id: string }) => p.id === id)?.estado, ruta).toBe(estado);
    }

    // Nada de esto existe para el dinero, el despacho ni los informes.
    const cuenta = async (sql: string) =>
      Number((await m.DB.prepare(sql).first<{ n: number }>())?.n ?? 0);
    expect(await cuenta('SELECT COUNT(*) AS n FROM pedidos')).toBe(0);
    expect(await cuenta('SELECT COUNT(*) AS n FROM ofertas')).toBe(0);
    expect(await cuenta('SELECT COUNT(*) AS n FROM movimientos')).toBe(0);
    expect(await cuenta('SELECT COUNT(*) AS n FROM liquidaciones')).toBe(0);
    expect((await conciliar(m.DB, hoy())).cuadra).toBe(true);
    expect(await embudo(m.DB, hoy(), hoy())).toEqual(antesEmbudo);
    const resumen = await m.llamar('GET', '/datos/restaurante/resumen', undefined, dueno.token);
    expect(resumen.datos.pedidos ?? 0).toBe(0);
  });

  it('se puede rechazar sin pasar por Stripe', async () => {
    const { m, dueno } = await escena();
    const id = (await m.llamar('POST', '/datos/restaurante/pedido-prueba', {}, dueno.token)).datos
      .pedido.id as string;
    const r = await m.llamar('POST', `/datos/restaurante/pedidos/${id}/rechazar`, {}, dueno.token);
    expect(r.estado).toBe(200);
    const l = await m.llamar('GET', '/datos/restaurante/pedidos', undefined, dueno.token);
    expect(l.datos.pedidos.find((p: { id: string }) => p.id === id)?.estado).toBe('cancelado');
  });

  it('sin platos en el menú lo dice claro, y otro restaurante no puede tocarlo', async () => {
    const vacio = await escena(false);
    const r = await vacio.m.llamar(
      'POST',
      '/datos/restaurante/pedido-prueba',
      {},
      vacio.dueno.token,
    );
    expect(r.estado).toBe(409);
    expect(String(r.datos.error)).toMatch(/plato|item/i);

    const { m, dueno } = await escena();
    const id = (await m.llamar('POST', '/datos/restaurante/pedido-prueba', {}, dueno.token)).datos
      .pedido.id as string;
    const otro = await m.cuenta('restaurante');
    await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre: 'Otro local' },
      otro.token,
    );
    const ajeno = await m.llamar(
      'POST',
      `/datos/restaurante/pedidos/${id}/aceptar`,
      { minutos: 10 },
      otro.token,
    );
    expect(ajeno.estado).toBeGreaterThanOrEqual(400);
  });

  it('no deja acumular: como mucho uno abierto a la vez', async () => {
    const { m, dueno } = await escena();
    expect(
      (await m.llamar('POST', '/datos/restaurante/pedido-prueba', {}, dueno.token)).estado,
    ).toBe(200);
    const segundo = await m.llamar('POST', '/datos/restaurante/pedido-prueba', {}, dueno.token);
    expect(segundo.estado).toBe(409);
  });
});

describe('C-PEDIDO-PRUEBA en el panel y la app del restaurante', () => {
  const leer = (...p: string[]) => readFileSync(join(__dirname, '..', '..', '..', ...p), 'utf8');
  it('los dos tienen el botón, la marca y «Terminar la prueba»', () => {
    for (const f of [
      leer('apps', 'panel', 'src', 'panel', 'Pedidos.tsx'),
      leer('apps', 'restaurante', 'src', 'Inicio.tsx'),
    ]) {
      expect(f).toContain("'/datos/restaurante/pedido-prueba'");
      expect(f).toContain('/terminar-prueba`)');
      expect(f).toContain('p.prueba');
    }
  });
});
