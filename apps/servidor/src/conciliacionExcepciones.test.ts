import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { DIAS_VIGILADOS, saludDinero } from './conciliacion';

/**
 * C-DINERO-30-DIAS (NXT-1, 3 nov 2026): la pieza «dinero» del canario mira los últimos 30 días, no
 * solo la última conciliación. Un día que no cuadró sigue en rojo hasta que una cuenta Total o
 * Finanzas pide la excusa con motivo y contraseña y OTRA la aprueba (ETP-3, control dual; tabla
 * `conciliacion_excepciones`); la fila de `conciliaciones` nunca se toca. SQLite en memoria.
 */
const CLAVE = 'clave-segura-1';

const hace = (dias: number) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);

async function dia(m: ReturnType<typeof mundo>, d: string, cuadra: boolean, detalle = '{}') {
  await m.DB.prepare(
    `INSERT OR REPLACE INTO conciliaciones (dia, pedidos, vendido, capturado, devuelto, abonado, retirado, cuadra, detalle)
     VALUES (?, 2, 1500, 1500, 0, 1200, 0, ?, ?)`,
  )
    .bind(d, cuadra ? 1 : 0, detalle)
    .run();
}

/** La segunda firma: otra cuenta aprueba en «Para aprobar» la excusa pendiente de ese día. */
async function aprobarExcusa(m: ReturnType<typeof mundo>, token: string, d: string) {
  const id = (
    await m.DB.prepare(
      "SELECT id FROM aprobaciones_dinero WHERE tipo = 'excusa_conciliacion' AND objeto = ? AND estado = 'pendiente'",
    )
      .bind(`conciliacion:${d}`)
      .first<{ id: string }>()
  )?.id;
  return m.llamar(
    'POST',
    `/datos/admin/aprobaciones-dinero/${id}/aprobar`,
    { clave: CLAVE },
    token,
  );
}

const pieza = async (m: ReturnType<typeof mundo>) =>
  (
    (await (await m.crudo('/datos/salud', { method: 'GET' })).json()) as {
      piezas: { dinero: string };
    }
  ).piezas.dinero;

describe('C-DINERO-30-DIAS · el canario de dinero no esconde días viejos', () => {
  it('un día que no cuadró hace tres días sigue en rojo aunque ayer cuadre', async () => {
    const m = mundo();
    expect(await saludDinero(m.DB)).toBe('pendiente');
    await dia(m, hace(3), false, '{"cuadraStripe":"NO"}');
    await dia(m, hace(1), true);
    expect(await saludDinero(m.DB)).toBe('error');
    expect(await pieza(m)).toBe('error');
  });

  it('fuera de la ventana de 30 días ya no cuenta', async () => {
    const m = mundo();
    await dia(m, hace(DIAS_VIGILADOS + 2), false);
    await dia(m, hace(1), true);
    expect(await saludDinero(m.DB)).toBe('ok');
  });

  it('solo Total o Finanzas lo excusa, con motivo y contraseña; queda quién y cuándo y la conciliación no se toca', async () => {
    const m = mundo({ ADMIN_CORREOS: 'equipo@ejemplo.com' });
    const d = hace(3);
    await dia(m, d, false, '{"cuadraStripe":"NO"}');
    await dia(m, hace(1), true);
    const jefa = await m.cuenta('admin', 'Soporte Finanzas');
    const ayuda = await m.cuenta('admin', 'Soporte Ayuda');
    expect(
      (await m.llamar('PUT', `/datos/admin/equipo/${ayuda.id}`, { perfil: 'soporte' }, jefa.token))
        .estado,
    ).toBe(200);
    const excusar = (token: string, cuerpo: Record<string, unknown>) =>
      m.llamar('POST', '/datos/admin/conciliacion/excepciones', cuerpo, token);
    const motivo = 'Pedidos de prueba del equipo, sin cobro real';

    // La bandeja muestra el día sin cuadrar, todavía sin excusar.
    const b0 = await m.llamar(
      'GET',
      '/datos/admin/conciliacion/excepciones',
      undefined,
      jefa.token,
    );
    expect(b0.estado).toBe(200);
    expect(b0.datos.sinCuadrar).toHaveLength(1);
    expect(b0.datos.sinCuadrar[0]).toMatchObject({ dia: d, excusado: false });
    expect(b0.datos.puedoExcusar).toBe(true);

    // Soporte no excusa dinero.
    expect((await excusar(ayuda.token, { dia: d, motivo, clave: CLAVE })).estado).toBe(403);
    // Sin la contraseña correcta, nada.
    const mala = await excusar(jefa.token, { dia: d, motivo, clave: 'otra-clave-9' });
    expect(mala.estado).toBe(403);
    // Sin motivo de verdad, nada.
    expect((await excusar(jefa.token, { dia: d, motivo: 'x', clave: CLAVE })).estado).toBe(400);
    // Un día que cuadra no se excusa.
    expect((await excusar(jefa.token, { dia: hace(1), motivo, clave: CLAVE })).estado).toBe(409);
    expect(await saludDinero(m.DB)).toBe('error');

    // ETP-3: pedirla no la excusa; queda esperando la segunda firma y el canario sigue en rojo.
    const pedida = await excusar(jefa.token, { dia: d, motivo, clave: CLAVE });
    expect(pedida.estado).toBe(202);
    expect(pedida.datos).toMatchObject({
      pendiente: true,
      aprobacion: { tipo: 'excusa_conciliacion' },
    });
    expect(await saludDinero(m.DB)).toBe('error');
    expect(await pieza(m)).toBe('error');
    const esperando = await m.llamar(
      'GET',
      '/datos/admin/conciliacion/excepciones',
      undefined,
      jefa.token,
    );
    expect(esperando.datos.sinCuadrar[0]).toMatchObject({
      dia: d,
      excusado: false,
      esperandoFirma: true,
      pedidoPorMi: true,
    });
    // Pedirla otra vez no la duplica.
    expect((await excusar(jefa.token, { dia: d, motivo, clave: CLAVE })).estado).toBe(202);
    const pendientes = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM aprobaciones_dinero WHERE tipo = 'excusa_conciliacion' AND estado = 'pendiente'",
    ).first<{ n: number }>();
    expect(Number(pendientes?.n)).toBe(1);
    // La misma cuenta no aprueba lo suyo.
    expect((await aprobarExcusa(m, jefa.token, d)).estado).toBe(409);
    expect(await saludDinero(m.DB)).toBe('error');
    // Soporte no aprueba dinero.
    expect((await aprobarExcusa(m, ayuda.token, d)).estado).toBe(403);
    // OTRA cuenta Total o Finanzas la aprueba: ahora sí.
    const otra = await m.cuenta('admin', 'Soporte Total Dos');
    const ok = await aprobarExcusa(m, otra.token, d);
    expect(ok.estado).toBe(200);
    expect(await saludDinero(m.DB)).toBe('ok');
    expect(await pieza(m)).toBe('ok');
    // Dos veces no.
    expect((await excusar(jefa.token, { dia: d, motivo, clave: CLAVE })).estado).toBe(409);

    const fila = await m.DB.prepare('SELECT * FROM conciliacion_excepciones WHERE dia = ?')
      .bind(d)
      .first<Record<string, unknown>>();
    expect(fila).toMatchObject({
      dia: d,
      motivo,
      creado_por: jefa.id,
    });
    const firma = await m.DB.prepare(
      "SELECT pedido_por, revisado_por, estado FROM aprobaciones_dinero WHERE tipo = 'excusa_conciliacion'",
    ).first();
    expect(firma).toEqual({ pedido_por: jefa.id, revisado_por: otra.id, estado: 'aprobada' });
    expect(fila?.creado_en).toBeTruthy();
    const conc = await m.DB.prepare('SELECT cuadra, detalle FROM conciliaciones WHERE dia = ?')
      .bind(d)
      .first<{ cuadra: number; detalle: string }>();
    expect(conc).toEqual({ cuadra: 0, detalle: '{"cuadraStripe":"NO"}' });
    const acciones = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM acciones_equipo WHERE ruta = '/datos/admin/conciliacion/excepciones' AND estado = 202",
    ).first<{ n: number }>();
    expect(Number(acciones?.n)).toBe(2);

    const b1 = await m.llamar(
      'GET',
      '/datos/admin/conciliacion/excepciones',
      undefined,
      jefa.token,
    );
    expect(b1.datos.sinCuadrar[0]).toMatchObject({ dia: d, excusado: true, motivo });
    expect(b1.datos.sinCuadrar[0].excusadoPorNombre).toBe('Soporte Finanzas');
    expect(b1.datos.sinCuadrar[0].aprobadoPorNombre).toBe('Soporte Total Dos');
    const lista = await m.llamar('GET', '/datos/admin/conciliacion', undefined, jefa.token);
    expect(
      (lista.datos.conciliaciones as { dia: string; excusado: boolean }[]).find((c) => c.dia === d)
        ?.excusado,
    ).toBe(true);
    const deAyuda = await m.llamar(
      'GET',
      '/datos/admin/conciliacion/excepciones',
      undefined,
      ayuda.token,
    );
    expect(deAyuda.datos.puedoExcusar).toBe(false);
  });

  it('si el día se vuelve a calcular con otras cifras, la excusa vieja ya no lo tapa', async () => {
    const m = mundo();
    const d = hace(4);
    await dia(m, d, false, '{"cuadraStripe":"NO"}');
    const jefa = await m.cuenta('admin', 'Soporte Total');
    const otra = await m.cuenta('admin', 'Soporte Finanzas Dos');
    const r = await m.llamar(
      'POST',
      '/datos/admin/conciliacion/excepciones',
      { dia: d, motivo: 'Compra de prueba documentada', clave: CLAVE },
      jefa.token,
    );
    expect(r.estado).toBe(202);
    expect((await aprobarExcusa(m, otra.token, d)).estado).toBe(200);
    expect(await saludDinero(m.DB)).toBe('ok');
    // Aparece una diferencia distinta ese mismo día: vuelve el rojo.
    await dia(m, d, false, '{"cuadraRestaurantes":"NO"}');
    expect(await saludDinero(m.DB)).toBe('error');
    // Y se puede excusar la nueva, con su propio motivo (y su segunda firma).
    const r2 = await m.llamar(
      'POST',
      '/datos/admin/conciliacion/excepciones',
      { dia: d, motivo: 'Ajuste manual documentado', clave: CLAVE },
      jefa.token,
    );
    expect(r2.estado).toBe(202);
    expect((await aprobarExcusa(m, otra.token, d)).estado).toBe(200);
    expect(await saludDinero(m.DB)).toBe('ok');
  });

  it('ETP-3: si las cifras cambian mientras espera la firma, aprobar no excusa las nuevas', async () => {
    const m = mundo();
    const d = hace(5);
    await dia(m, d, false, '{"cuadraStripe":"NO"}');
    const jefa = await m.cuenta('admin', 'Soporte Total');
    const otra = await m.cuenta('admin', 'Soporte Total Dos');
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/admin/conciliacion/excepciones',
          { dia: d, motivo: 'Compra de prueba documentada', clave: CLAVE },
          jefa.token,
        )
      ).estado,
    ).toBe(202);
    await dia(m, d, false, '{"cuadraRestaurantes":"NO"}');
    const r = await aprobarExcusa(m, otra.token, d);
    expect(r.estado).toBe(409);
    expect(r.datos.error).toMatch(/cifras de ese día cambiaron|figures changed/);
    expect(await saludDinero(m.DB)).toBe('error');
    const n = await m.DB.prepare('SELECT COUNT(*) AS n FROM conciliacion_excepciones').first<{
      n: number;
    }>();
    expect(Number(n?.n)).toBe(0);
  });

  it('ETP-3: la excusa sembrada del 15 oct solo vale con el detalle guardado exacto', async () => {
    const siembra = /INSERT OR IGNORE INTO conciliacion_excepciones[\s\S]*?;\n/.exec(
      readFileSync(join(__dirname, '..', '..', '..', 'schema.sql'), 'utf8'),
    )?.[0];
    expect(siembra).toBeTruthy();
    const correr = async (m: ReturnType<typeof mundo>) => {
      await m.DB.prepare('DELETE FROM conciliacion_excepciones').run();
      await m.DB.prepare(siembra!.replace(/--[^\n]*\n/g, '\n')).run();
      return Number(
        (
          await m.DB.prepare(
            "SELECT COUNT(*) AS n FROM conciliacion_excepciones WHERE dia = '2026-10-15'",
          ).first<{ n: number }>()
        )?.n,
      );
    };
    const del15 = async (m: ReturnType<typeof mundo>, detalle: string) =>
      m.DB.prepare(
        `INSERT OR REPLACE INTO conciliaciones (dia, pedidos, vendido, capturado, devuelto, abonado, retirado, cuadra, detalle)
         VALUES ('2026-10-15', 1, 718, 0, 0, 0, 0, 0, ?)`,
      )
        .bind(detalle)
        .run();
    const m = mundo();
    // Mismo pedido y mismo monto, pero otro detalle: no se excusa.
    await del15(m, '{"restaurantesEsperado":87,"cuadraStripe":"NO"}');
    expect(await correr(m)).toBe(0);
    // El detalle exacto de producción: sí.
    await del15(
      m,
      '{"restaurantesEsperado":87,"restaurantesAbonado":0,"repartidoresEsperado":520,"repartidoresAbonado":0,"stripeEsperado":0,"stripeCapturado":0,"cuadraRestaurantes":"NO","cuadraRepartidores":"NO","cuadraStripe":"sí"}',
    );
    expect(await correr(m)).toBe(1);
  });

  it('una cuenta que no es del equipo no ve ni excusa nada', async () => {
    const m = mundo();
    const cli = await m.cuenta('cliente');
    expect(
      (await m.llamar('GET', '/datos/admin/conciliacion/excepciones', undefined, cli.token)).estado,
    ).toBe(403);
    expect(
      (
        await m.llamar(
          'POST',
          '/datos/admin/conciliacion/excepciones',
          { dia: hace(2), motivo: 'Compra de prueba documentada', clave: CLAVE },
          cli.token,
        )
      ).estado,
    ).toBe(403);
  });
});
