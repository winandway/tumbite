import { describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { DIAS_VIGILADOS, saludDinero } from './conciliacion';

/**
 * C-DINERO-30-DIAS (NXT-1, 3 nov 2026): la pieza «dinero» del canario mira los últimos 30 días, no
 * solo la última conciliación. Un día que no cuadró sigue en rojo hasta que una cuenta Total o
 * Finanzas lo excusa con motivo y contraseña (tabla `conciliacion_excepciones`); la fila de
 * `conciliaciones` nunca se toca. SQLite en memoria: nada real.
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

    const ok = await excusar(jefa.token, { dia: d, motivo, clave: CLAVE });
    expect(ok.estado).toBe(200);
    expect(await saludDinero(m.DB)).toBe('ok');
    expect(await pieza(m)).toBe('ok');
    // Dos veces no.
    expect((await excusar(jefa.token, { dia: d, motivo, clave: CLAVE })).estado).toBe(409);

    const fila = await m.DB.prepare('SELECT * FROM conciliacion_excepciones WHERE dia = ?')
      .bind(d)
      .first<Record<string, unknown>>();
    expect(fila).toMatchObject({ dia: d, motivo, creado_por: jefa.id });
    expect(fila?.creado_en).toBeTruthy();
    const conc = await m.DB.prepare('SELECT cuadra, detalle FROM conciliaciones WHERE dia = ?')
      .bind(d)
      .first<{ cuadra: number; detalle: string }>();
    expect(conc).toEqual({ cuadra: 0, detalle: '{"cuadraStripe":"NO"}' });
    const acciones = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM acciones_equipo WHERE ruta = '/datos/admin/conciliacion/excepciones' AND estado = 200",
    ).first<{ n: number }>();
    expect(Number(acciones?.n)).toBe(1);

    const b1 = await m.llamar(
      'GET',
      '/datos/admin/conciliacion/excepciones',
      undefined,
      jefa.token,
    );
    expect(b1.datos.sinCuadrar[0]).toMatchObject({ dia: d, excusado: true, motivo });
    expect(b1.datos.sinCuadrar[0].excusadoPorNombre).toBe('Soporte Finanzas');
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
    const r = await m.llamar(
      'POST',
      '/datos/admin/conciliacion/excepciones',
      { dia: d, motivo: 'Compra de prueba documentada', clave: CLAVE },
      jefa.token,
    );
    expect(r.estado).toBe(200);
    expect(await saludDinero(m.DB)).toBe('ok');
    // Aparece una diferencia distinta ese mismo día: vuelve el rojo.
    await dia(m, d, false, '{"cuadraRestaurantes":"NO"}');
    expect(await saludDinero(m.DB)).toBe('error');
    // Y se puede excusar la nueva, con su propio motivo.
    const r2 = await m.llamar(
      'POST',
      '/datos/admin/conciliacion/excepciones',
      { dia: d, motivo: 'Ajuste manual documentado', clave: CLAVE },
      jefa.token,
    );
    expect(r2.estado).toBe(200);
    expect(await saludDinero(m.DB)).toBe('ok');
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
