import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Env } from './env';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';
import { vigilarPedidos } from './manager';
import { AVISOS_COMIDA, PASOS_COMIDA } from './avisosComida';

/**
 * C-AVISOS-COMIDA (24 nov 2026) — todos los países. Los huecos de los avisos de Comida: el cliente
 * sabe que el restaurante no pudo (o que soporte canceló) y qué pasa con su dinero; el restaurante,
 * que el cliente canceló y que el conductor está a 5 minutos o llegó; el conductor, que se le quitó
 * el pedido por falta de señal. Uno por paso, y queda en la campana.
 */
afterEach(() => vi.unstubAllGlobals());

async function escenario() {
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (String(url).includes('exp.host')) {
      const n = (JSON.parse(String(init?.body)) as unknown[]).length;
      return new Response(
        JSON.stringify({ data: Array.from({ length: n }, () => ({ status: 'ok' })) }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({ id: 'pi_1', client_secret: 'pi_1_secret', status: 'canceled' }),
      { status: 200 },
    );
  });
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const dueno = await m.cuenta('restaurante');
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Ana Cliente');
  const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
  const rid = r.datos.restaurante.id as string;
  await m.llamar('PATCH', `/datos/admin/restaurantes/${rid}`, { estado: 'aprobado' }, admin.token);
  const plato = await m.llamar(
    'POST',
    '/datos/mi-restaurante/platos',
    { nombreEs: 'Cubano', precioCentavos: 1500 },
    dueno.token,
  );
  await m.abrir(dueno.token);
  async function pedidoPagado() {
    const p = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: plato.datos.plato.id, cantidad: 1 }],
        propinaCentavos: 0,
        direccion: '300 Calle Prueba',
        lat: 25.78,
        lng: -80.2,
      },
      cliente.token,
    );
    const id = p.datos.pedidoId as string;
    await m.DB.prepare(
      "UPDATE pedidos SET estado = 'pagado', pagado_en = datetime('now'), stripe_pago = 'pi_1' WHERE id = ?",
    )
      .bind(id)
      .run();
    return id;
  }
  async function conConductor(lat = 25.755, lng = -80.19) {
    const id = await pedidoPagado();
    const rep = await m.cuenta('repartidor', 'Rita Conductora');
    await m.llamar('POST', '/datos/repartidor/conectar', { conectado: true, lat, lng }, rep.token);
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/aceptar`, { minutos: 5 }, dueno.token);
    await m.llamar('GET', '/datos/repartidor/ofertas', undefined, rep.token);
    expect(
      (await m.llamar('POST', `/datos/repartidor/ofertas/${id}/aceptar`, {}, rep.token)).estado,
    ).toBe(200);
    return { id, rep };
  }
  const avisos = async (usuario: string, paso: string) =>
    (
      await m.DB.prepare(
        `SELECT titulo_es, cuerpo_es, titulo_en, cuerpo_en FROM avisos_enviados
          WHERE usuario_id = ? AND json_extract(datos_json, '$.paso') = ?`,
      )
        .bind(usuario, paso)
        .all<{ titulo_es: string; cuerpo_es: string; titulo_en: string; cuerpo_en: string }>()
    ).results;
  return { m, dueno, admin, cliente, pedidoPagado, conConductor, avisos };
}

describe('C-AVISOS-COMIDA · el cliente sabe que su pedido se canceló y qué pasa con su dinero', () => {
  it('el restaurante rechaza: «Sabor Prueba no pudo tomar tu pedido» con la devolución a la tarjeta', async () => {
    const { m, dueno, cliente, pedidoPagado, avisos } = await escenario();
    const id = await pedidoPagado();
    expect(
      (await m.llamar('POST', `/datos/restaurante/pedidos/${id}/rechazar`, {}, dueno.token)).estado,
    ).toBe(200);
    const a = await avisos(cliente.id, 'cancelado_restaurante');
    expect(a).toHaveLength(1);
    expect(a[0]!.titulo_es).toBe('Sabor Prueba no pudo tomar tu pedido');
    expect(a[0]!.cuerpo_es).toContain('Te devolvemos todo lo que pagaste a tu tarjeta');
    expect(a[0]!.titulo_en).toBe('Sabor Prueba couldn’t take your order');
    // Rechazar otra vez no repite el aviso.
    await m.llamar('POST', `/datos/restaurante/pedidos/${id}/rechazar`, {}, dueno.token);
    expect(await avisos(cliente.id, 'cancelado_restaurante')).toHaveLength(1);
  });

  it('soporte cancela: el cliente, el restaurante y el conductor se enteran', async () => {
    const { m, admin, dueno, cliente, conConductor, avisos } = await escenario();
    const { id, rep } = await conConductor();
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/pedidos/${id}/cancelar`,
          { motivo: 'El cliente llamó' },
          admin.token,
        )
      ).estado,
    ).toBe(200);
    expect((await avisos(cliente.id, 'cancelado_soporte'))[0]?.titulo_es).toBe(
      'Cancelamos tu pedido',
    );
    expect((await avisos(dueno.id, 'cancelado_soporte'))[0]?.titulo_es).toMatch(
      /^Soporte canceló el pedido #/,
    );
    expect((await avisos(rep.id, 'cancelado_soporte'))[0]?.titulo_es).toBe(
      'Soporte canceló tu pedido',
    );
  });
});

describe('C-AVISOS-COMIDA · el restaurante', () => {
  it('el cliente cancela antes de que lo acepte: «El cliente canceló el pedido #X»', async () => {
    const { m, dueno, cliente, pedidoPagado, avisos } = await escenario();
    const id = await pedidoPagado();
    expect(
      (await m.llamar('POST', `/datos/pedidos/${id}/cancelar`, {}, cliente.token)).estado,
    ).toBe(200);
    const a = await avisos(dueno.id, 'cancelado_cliente');
    expect(a).toHaveLength(1);
    expect(a[0]!.titulo_es).toBe(`El cliente canceló el pedido #${id.slice(0, 8).toUpperCase()}`);
    expect(a[0]!.titulo_en).toBe(`The customer canceled order #${id.slice(0, 8).toUpperCase()}`);
  });

  it('el conductor está a 5 minutos y luego llega: un aviso de cada uno, sin repetir', async () => {
    const { m, dueno, conConductor, avisos } = await escenario();
    // El restaurante está en 25.77,-80.19. A ~1,7 km (unos 4 minutos de viaje): llega en 5.
    const { id, rep } = await conConductor(25.755, -80.19);
    await m.ubicar(rep.token, { lat: 25.755, lng: -80.19 });
    await m.ubicar(rep.token, { lat: 25.7552, lng: -80.19 });
    expect(await avisos(dueno.id, 'rest_llega_5')).toHaveLength(1);
    expect((await avisos(dueno.id, 'rest_llega_5'))[0]?.titulo_es).toBe(
      'El conductor llega en unos 5 minutos',
    );
    expect(await avisos(dueno.id, 'rest_llego')).toHaveLength(0);
    const r = await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/llegue`,
      { lat: 25.7701, lng: -80.1901 },
      rep.token,
    );
    expect(r.datos.llegue).toBe(true);
    await m.llamar(
      'POST',
      `/datos/repartidor/pedidos/${id}/llegue`,
      { lat: 25.7701, lng: -80.1901 },
      rep.token,
    );
    const llego = await avisos(dueno.id, 'rest_llego');
    expect(llego).toHaveLength(1);
    expect(llego[0]!.titulo_es).toMatch(/^El conductor llegó por el pedido #/);
  });
});

describe('C-AVISOS-COMIDA · el conductor', () => {
  it('sin señal 10 minutos: el sistema le quita el pedido y se lo dice (antes solo el equipo)', async () => {
    const { m, conConductor, avisos } = await escenario();
    const { id, rep } = await conConductor();
    await m.DB.prepare(
      "UPDATE repartidores SET ubicacion_en = datetime('now', '-11 minutes') WHERE usuario_id = ?",
    )
      .bind(rep.id)
      .run();
    await vigilarPedidos({ DB: m.DB, STRIPE_SECRET_KEY: 'sk_test_x' } as unknown as Env, m.DB, id);
    await vigilarPedidos({ DB: m.DB, STRIPE_SECRET_KEY: 'sk_test_x' } as unknown as Env, m.DB, id);
    const a = await avisos(rep.id, 'soltado_sin_senal');
    expect(a).toHaveLength(1);
    expect(a[0]!.titulo_es).toBe('Te quitamos el pedido de Sabor Prueba');
    expect(a[0]!.cuerpo_es).toContain('otro conductor');
  });

  it('soporte le quita el pedido: se lo dice', async () => {
    const { m, admin, conConductor, avisos } = await escenario();
    const { id, rep } = await conConductor();
    await m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/soltar-repartidor`,
      { motivo: 'no contesta' },
      admin.token,
    );
    expect((await avisos(rep.id, 'soltado_soporte'))[0]?.titulo_es).toBe(
      'Soporte te quitó el pedido de Sabor Prueba',
    );
  });
});

describe('C-AVISOS-COMIDA · los textos', () => {
  it('dicen «conductor», sin montos, en los dos idiomas', () => {
    const todos = [
      ...(['es', 'en'] as const).flatMap((i) => [
        AVISOS_COMIDA.restauranteNoPudo(i, 'Local', 'tarjeta'),
        AVISOS_COMIDA.restauranteNoPudo(i, 'Local', 'directo'),
        AVISOS_COMIDA.restauranteNoPudo(i, 'Local', 'sin_cobro'),
        AVISOS_COMIDA.soporteCanceloCliente(i, 'Local', 'tarjeta'),
        AVISOS_COMIDA.clienteCancelo(i, 'AB12'),
        AVISOS_COMIDA.soporteCanceloRestaurante(i, 'AB12'),
        AVISOS_COMIDA.conductorSinSenal(i, 'Local'),
        AVISOS_COMIDA.conductorQuitadoSoporte(i, 'Local'),
        AVISOS_COMIDA.conductorCanceladoSoporte(i, 'Local'),
        AVISOS_COMIDA.restauranteLlega5(i, 'AB12'),
        AVISOS_COMIDA.restauranteLlego(i, 'AB12'),
      ]),
    ];
    for (const a of todos) {
      expect(`${a.titulo} ${a.cuerpo}`).not.toMatch(/\$|\d+[.,]\d{2}|repartidor/);
      expect(a.titulo.length).toBeGreaterThan(5);
    }
    expect(AVISOS_COMIDA.conductorSinSenal('es', 'Local').cuerpo).toContain('conductor');
  });
});

/**
 * El candado: toda cancelación de un pedido (`cancelarConReembolso`) y todo pedido soltado
 * (`soltarPedido`) del servidor avisa en las líneas que la siguen, o dice por escrito por qué no
 * (`C-AVISOS-COMIDA: sin aviso — motivo` o `C-AVISOS-COMIDA: avisa abajo …`). Un camino nuevo sin
 * aviso pone esta prueba en rojo.
 */
describe('C-AVISOS-COMIDA · candado: ninguna cancelación ni pedido soltado queda sin aviso', () => {
  const raiz = import.meta.dirname;
  const archivos: string[] = [];
  const recorrer = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) {
        if (n !== 'pruebas' && n !== 'node_modules') recorrer(p);
      } else if (/\.ts$/.test(n) && !/\.test\.ts$/.test(n)) archivos.push(p);
    }
  };
  recorrer(raiz);
  const llamadas: { archivo: string; linea: number; ventana: string }[] = [];
  for (const a of archivos) {
    const lineas = readFileSync(a, 'utf8').split('\n');
    lineas.forEach((l, n) => {
      if (/\b(cancelarConReembolso|soltarPedido)\(/.test(l) && !/function /.test(l))
        llamadas.push({
          archivo: a.slice(raiz.length + 1),
          linea: n + 1,
          ventana: lineas.slice(Math.max(0, n - 3), n + 25).join('\n'),
        });
    });
  }

  it('hay caminos que revisar (la búsqueda no quedó vacía)', () => {
    expect(llamadas.length).toBeGreaterThanOrEqual(15);
  });

  it('cada cancelación y cada pedido soltado avisa o dice por qué no', () => {
    const sinAviso = llamadas
      .filter(
        (x) =>
          !/avisarPasoComida\(|C-AVISOS-COMIDA: sin aviso —|C-AVISOS-COMIDA: avisa abajo/.test(
            x.ventana,
          ),
      )
      .map((x) => `${x.archivo}:${x.linea}`);
    expect(sinAviso).toEqual([]);
  });

  it('cada paso de la lista se usa en el servidor', () => {
    const todo = archivos.map((a) => readFileSync(a, 'utf8')).join('\n');
    for (const paso of PASOS_COMIDA)
      expect(todo.includes(`'${paso}')`) || todo.includes(`'${paso}',`)).toBe(true);
  });
});

describe('C-AVISOS-COMIDA · revisión: al soltar el pedido, el «llega en 5» vuelve a salir', () => {
  it('soltar borra la marca rest_llega_5 y el siguiente conductor la genera otra vez', async () => {
    const { m, admin, dueno, conConductor, avisos } = await escenario();
    const { id, rep } = await conConductor(25.755, -80.19);
    await m.ubicar(rep.token, { lat: 25.755, lng: -80.19 });
    expect(await avisos(dueno.id, 'rest_llega_5')).toHaveLength(1);
    await m.llamar(
      'POST',
      `/datos/admin/pedidos/${id}/soltar-repartidor`,
      { motivo: 'no contesta' },
      admin.token,
    );
    const marca = await m.DB.prepare(
      "SELECT 1 FROM avisos_pedido WHERE pedido_id = ? AND aviso = 'rest_llega_5'",
    )
      .bind(id)
      .first();
    expect(marca).toBeNull();
    const otro = await m.cuenta('repartidor', 'Otro Conductor');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.755, lng: -80.19 },
      otro.token,
    );
    await m.DB.prepare('UPDATE pedidos SET repartidor_id = ? WHERE id = ?').bind(otro.id, id).run();
    await m.ubicar(otro.token, { lat: 25.755, lng: -80.19 });
    expect(await avisos(dueno.id, 'rest_llega_5')).toHaveLength(2);
  });
});
