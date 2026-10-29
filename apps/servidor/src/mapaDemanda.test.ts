import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-MAPA-DEMANDA (29 oct 2026, como el «Dash Now» de DoorDash y las zonas de Uber Driver): el
 * repartidor ve en su mapa las zonas de su ciudad con más pedidos en la última hora. Se agrupa por
 * celdas (unos 1,2 km) y se cuenta desde el LOCAL, nunca desde la casa del cliente; una celda con un
 * solo pedido no sale. Ni direcciones, ni clientes, ni dinero. Todos los países.
 */
const raiz = join(__dirname, '..', '..', '..');
const leer = (...r: string[]) => readFileSync(join(raiz, ...r), 'utf8');

async function escenario() {
  const m = mundo();
  const admin = await m.cuenta('admin');
  const cliente = await m.cuenta('cliente');
  const repartidor = await m.cuenta('repartidor');
  async function local(lat: number, lng: number, nombre: string) {
    const dueno = await m.cuenta('restaurante');
    const r = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { ...RESTAURANTE_BASE, nombre, lat, lng },
      dueno.token,
    );
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    return rid;
  }
  let n = 0;
  async function pedido(rid: string, estado = 'pagado', hace = '-5 minutes') {
    n++;
    await m.DB.prepare(
      `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, creado_en)
       VALUES (?, ?, ?, ?, '[]', 1000, 300, 100, 0, 0, 1400, 150, 850, 400, 0, 150, 'inicial', '300 Calle Prueba', datetime('now', ?))`,
    )
      .bind(`ped-demanda-${n}`, cliente.id, rid, estado, hace)
      .run();
  }
  return { m, repartidor, cliente, local, pedido };
}

describe('mapa de demanda del repartidor', () => {
  it('cuenta los pedidos de la última hora por zona, desde el local, sin datos de clientes', async () => {
    const { m, repartidor, local, pedido } = await escenario();
    const centro = await local(25.77, -80.19, 'Local Centro');
    const otro = await local(25.79, -80.13, 'Local Playa');
    for (let i = 0; i < 3; i++) await pedido(centro);
    await pedido(centro, 'cancelado');
    await pedido(centro, 'entregado', '-3 hours');
    await pedido(otro);
    const r = await m.llamar(
      'GET',
      '/datos/repartidor/demanda?lat=25.775&lng=-80.195',
      undefined,
      repartidor.token,
    );
    expect(r.estado).toBe(200);
    // Solo la celda del centro: la de la playa tiene un pedido y no sale; cancelados y viejos no cuentan.
    expect(r.datos.zonas.length).toBe(1);
    const z = r.datos.zonas[0];
    expect(z.pedidos).toBe(3);
    expect(Math.abs(z.lat - 25.77)).toBeLessThan(0.02);
    expect(Math.abs(z.lng + 80.19)).toBeLessThan(0.02);
    expect(z.nivel).toBe('media');
    expect(Object.keys(z).sort()).toEqual(['lat', 'lng', 'nivel', 'pedidos']);
    const texto = JSON.stringify(r.datos);
    expect(texto).not.toContain('Local Centro');
    expect(texto).not.toContain('ped-demanda');
  });

  it('cinco pedidos o más es demanda alta, y solo entra el repartidor', async () => {
    const { m, repartidor, cliente, local, pedido } = await escenario();
    const centro = await local(25.77, -80.19, 'Local Centro');
    for (let i = 0; i < 5; i++) await pedido(centro);
    const r = await m.llamar(
      'GET',
      '/datos/repartidor/demanda?lat=25.775&lng=-80.195',
      undefined,
      repartidor.token,
    );
    expect(r.datos.zonas[0].nivel).toBe('alta');
    const ajeno = await m.llamar(
      'GET',
      '/datos/repartidor/demanda?lat=25.775&lng=-80.195',
      undefined,
      cliente.token,
    );
    expect(ajeno.estado).toBe(403);
    const fuera = await m.llamar(
      'GET',
      '/datos/repartidor/demanda?lat=0&lng=0',
      undefined,
      repartidor.token,
    );
    expect(fuera.datos.zonas).toEqual([]);
  });

  it('la app Driver pinta las zonas en el mapa y la guía existe en los dos idiomas', () => {
    const inicio = leer('apps', 'repartidor', 'src', 'Inicio.tsx');
    expect(inicio).toContain('/datos/repartidor/demanda');
    expect(leer('apps', 'repartidor', 'src', 'piezas', 'Mapa.tsx')).toContain('zonasDemanda');
    expect(leer('apps', 'repartidor', 'src', 'piezas', 'Mapa.web.tsx')).toContain('zonasDemanda');
    const guias = leer('apps', 'panel', 'src', 'sitio', 'docs', 'guias.ts');
    expect(guias.split(`id: 'busy-areas'`).length - 1).toBe(2);
  });
});
