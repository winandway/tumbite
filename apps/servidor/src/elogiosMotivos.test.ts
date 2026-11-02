import { describe, expect, it } from 'vitest';
import { RESTAURANTE_BASE, mundo } from './pruebas/ayuda';

/**
 * C-ELOGIOS-MOTIVOS (BRE-3, 2 nov 2026), como Uber Eats y DoorDash: con 5 estrellas el cliente elige
 * elogios ya escritos para el repartidor y el restaurante; con 3 o menos, «¿Qué salió mal?» con
 * motivos. El repartidor ve el conteo de SUS elogios (los motivos sobre él quedan para el equipo,
 * como en Uber Eats); el restaurante ve sus elogios y sus motivos en Reseñas. Todos los países.
 */
describe('elogios y motivos al calificar', () => {
  async function escena() {
    const m = mundo();
    const dueno = await m.cuenta('restaurante');
    const admin = await m.cuenta('admin');
    const rep = await m.cuenta('repartidor');
    const r = await m.llamar('PUT', '/datos/mi-restaurante', RESTAURANTE_BASE, dueno.token);
    const rid = r.datos.restaurante.id as string;
    await m.llamar(
      'PATCH',
      `/datos/admin/restaurantes/${rid}`,
      { estado: 'aprobado' },
      admin.token,
    );
    const entregado = async (id: string, clienteId: string, conRepartidor = true) =>
      m.DB.prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, lat, lng, aceptado_en, pagado_en, entregado_en)
         VALUES (?, ?, ?, ?, 'entregado', '[]', 1000, 200, 100, 0, 100, 1400, 150, 850, 400, 0, 0, 'basico', '200 Calle Prueba', 25.78, -80.2, datetime('now'), datetime('now'), datetime('now'))`,
      )
        .bind(id, clienteId, rid, conRepartidor ? rep.id : null)
        .run();
    return { m, dueno, rep, rid, entregado };
  }

  it('guarda elogios con 5 estrellas y el repartidor ve su conteo', async () => {
    const { m, rep, entregado } = await escena();
    for (let i = 0; i < 3; i++) {
      const cli = await m.cuenta('cliente');
      await entregado(`e${i}`, cli.id);
      const r = await m.llamar(
        'POST',
        `/datos/pedidos/e${i}/calificar`,
        {
          estrellasRestaurante: 5,
          estrellasRepartidor: 5,
          etiquetasRepartidor: i === 0 ? ['amable', 'rapido'] : ['amable', 'tarde'],
          etiquetasRestaurante: ['bien_empacado'],
        },
        cli.token,
      );
      expect(r.estado).toBe(200);
    }
    const cal = await m.llamar('GET', '/datos/repartidor/calificaciones', undefined, rep.token);
    expect(cal.datos.elogios).toEqual([
      { etiqueta: 'amable', n: 3, es: 'Amable', en: 'Friendly' },
      { etiqueta: 'rapido', n: 1, es: 'Rápido', en: 'Fast' },
    ]);
  });

  it('con 3 estrellas o menos guarda motivos; el restaurante los ve en Reseñas, el repartidor no', async () => {
    const { m, dueno, rep, entregado } = await escena();
    const cli = await m.cuenta('cliente');
    await entregado('m1', cli.id);
    await m.llamar(
      'POST',
      '/datos/pedidos/m1/calificar',
      {
        estrellasRestaurante: 2,
        estrellasRepartidor: 1,
        etiquetasRestaurante: ['fria', 'faltante', 'bien_empacado'],
        etiquetasRepartidor: ['tarde', 'amable'],
      },
      cli.token,
    );
    const res = await m.llamar('GET', '/datos/mi-restaurante/resenas', undefined, dueno.token);
    expect(res.datos.motivos.map((x: { etiqueta: string }) => x.etiqueta).sort()).toEqual([
      'faltante',
      'fria',
    ]);
    expect(res.datos.elogios).toEqual([]);
    expect(res.datos.resenas[0].etiquetas.sort()).toEqual(['faltante', 'fria']);
    const cal = await m.llamar('GET', '/datos/repartidor/calificaciones', undefined, rep.token);
    expect(cal.datos.elogios).toEqual([]);
    expect(JSON.stringify(cal.datos)).not.toContain('tarde');
    const fila = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM calificaciones_etiquetas WHERE pedido_id = 'm1' AND para = 'repartidor' AND tipo = 'motivo'",
    ).first<{ n: number }>();
    expect(fila?.n).toBe(1);
  });

  it('calificar otra vez reemplaza las etiquetas; sin repartidor no se guardan las suyas', async () => {
    const { m, entregado } = await escena();
    const cli = await m.cuenta('cliente');
    await entregado('r1', cli.id, false);
    for (const etiquetas of [['bien_empacado', 'porciones'], ['porciones']])
      await m.llamar(
        'POST',
        '/datos/pedidos/r1/calificar',
        {
          estrellasRestaurante: 5,
          etiquetasRestaurante: etiquetas,
          etiquetasRepartidor: ['amable'],
        },
        cli.token,
      );
    const { results } = await m.DB.prepare(
      "SELECT para, etiqueta FROM calificaciones_etiquetas WHERE pedido_id = 'r1'",
    ).all<{ para: string; etiqueta: string }>();
    expect(results).toEqual([{ para: 'restaurante', etiqueta: 'porciones' }]);
  });
});
