import { describe, expect, it } from 'vitest';
import { MAX_CODIGOS_FALLIDOS, saludAgentes } from '../agentes';
import { saldoLibro } from '../internacional/libro';
import { EL_VIGIA, abrirComida, escenarioVe } from '../pruebas/comidaVe';
import { saldoRetirable } from '../retiros';

/**
 * C-AGENTE-DIVOOX (18 nov 2026) — Venezuela primero. El circuito completo del Agente Divoox:
 * el conductor aparta ganancias y recibe un código; el agente lo paga contra su fondo; vende saldo;
 * el equipo anota el fondo y concilia. Y los permisos: la sesión del agente no abre nada más.
 */
type Mundo = Awaited<ReturnType<typeof mundo>>;

async function mundo() {
  const e = await escenarioVe();
  expect((await abrirComida(e)).estado).toBe(201);
  const DB = e.m.DB;
  let n = 0;
  const conductor = async (nombre: string, ganancias = 0, zona = EL_VIGIA.id) => {
    const c = await e.m.cuenta('repartidor', nombre);
    n++;
    await DB.prepare(
      'INSERT INTO repartidores (usuario_id, conectado, lat, lng, zona_id) VALUES (?, 0, ?, ?, ?)',
    )
      .bind(c.id, EL_VIGIA.lat, EL_VIGIA.lng, zona)
      .run();
    await DB.prepare('UPDATE usuarios SET telefono = ?, telefono_canonico = ? WHERE id = ?')
      .bind(`+5841477700${10 + n}`, `5841477700${10 + n}`, c.id)
      .run();
    if (ganancias)
      await DB.prepare(
        "INSERT INTO movimientos (id, usuario_id, monto, concepto, referencia) VALUES (?, ?, ?, 'ajuste', ?)",
      )
        .bind(`mov-prueba-${c.id}`, c.id, ganancias, `prueba:${c.id}`)
        .run();
    return { ...c, telefono: `0414-77700${10 + n}` };
  };
  const admin = (metodo: string, ruta: string, cuerpo?: unknown) =>
    e.m.llamar(metodo, `/datos/admin/${ruta}`, cuerpo, e.admin.token);
  const ciudad = (cuerpo: Record<string, unknown> = {}, zona = EL_VIGIA.id) =>
    admin('PUT', `agentes-ciudad/${zona}`, {
      activo: true,
      pagaEn: 'USD',
      minimo: 500,
      topeConductorDia: 20_000,
      ...cuerpo,
    });
  /** Crea un agente, le pone contraseña con su enlace y lo deja con la sesión abierta (dos pasos). */
  const agente = async (nombre = 'Casa de Cambio Ejemplo', zonaId = EL_VIGIA.id, entrar = true) => {
    const correo = `agente-${Math.random().toString(36).slice(2)}@ejemplo.com`;
    const r = await admin('POST', 'agentes', { nombre, correo, zonaId, direccion: 'Local 1' });
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const token = new URL(r.datos.enlace.enlacePrueba).searchParams.get('token');
    const clave = 'clave-de-agente-1';
    expect((await e.m.llamar('POST', '/datos/agent/password', { token, clave })).estado).toBe(200);
    const id = r.datos.agente.id as string;
    return { id, correo, clave, cookie: entrar ? await sesion(correo, clave) : '' };
  };
  const galleta = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
  const sesion = async (correo: string, clave: string) => {
    const r = await e.m.llamar('POST', '/datos/agent/login', { correo, clave });
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    const cookie = galleta(r.res);
    const v = await e.m.llamar(
      'POST',
      '/datos/agent/verify',
      { codigo: r.datos.codigoPrueba },
      undefined,
      { cookie },
    );
    expect(v.estado, JSON.stringify(v.datos)).toBe(200);
    return galleta(v.res);
  };
  const como = (cookie: string, metodo: string, ruta: string, cuerpo?: unknown) =>
    e.m.llamar(metodo, `/datos/agent/${ruta}`, cuerpo, undefined, { cookie });
  const fondo = (id: string, monto: number, comprobante = `TRF-${Math.random()}`) =>
    admin('POST', `agentes/${id}/libro`, { concepto: 'fondo', monto, comprobante });
  const pedir = (token: string, monto: number) =>
    e.m.llamar('POST', '/datos/repartidor/cobro-efectivo', { monto }, token);
  const mio = (token: string) =>
    e.m.llamar('GET', '/datos/repartidor/cobro-efectivo', undefined, token);
  return { e, DB, conductor, admin, ciudad, agente, sesion, como, fondo, pedir, mio, galleta };
}

async function listoParaPagar(m: Mundo, ganancias = 2_550, monto = 2_000) {
  expect((await m.ciudad()).estado).toBe(200);
  const a = await m.agente();
  const c = await m.conductor('Carlos Rojas', ganancias);
  const p = await m.pedir(c.token, monto);
  expect(p.estado, JSON.stringify(p.datos)).toBe(201);
  return { a, c, cobro: p.datos.cobro as { id: string; codigo: string; monto: number } };
}

describe('C-AGENTE-DIVOOX: cobrar en efectivo', () => {
  it('apagado de fábrica: sin ciudad encendida o sin agente no hay cobro', async () => {
    const m = await mundo();
    const c = await m.conductor('Carlos Rojas', 2_000);
    expect((await m.mio(c.token)).datos).toMatchObject({ disponible: false, vivo: null });
    expect((await m.pedir(c.token, 1_000)).estado).toBe(409);
    // Ciudad encendida pero sin agente con contraseña: sigue sin estar disponible.
    await m.ciudad();
    expect((await m.mio(c.token)).datos.disponible).toBe(false);
    await m.agente();
    expect((await m.mio(c.token)).datos).toMatchObject({
      disponible: true,
      pagaEn: 'USD',
      minimo: 500,
      ganancias: 2_000,
      maximo: 2_000,
    });
  });

  it('el código aparta el monto; en dólares solo enteros y el resto queda en la billetera', async () => {
    const m = await mundo();
    await m.ciudad();
    await m.agente();
    const c = await m.conductor('Carlos Rojas', 2_550);
    // Lo más que puede cobrar son 25 dólares enteros: los 50 centavos se quedan.
    expect((await m.mio(c.token)).datos.maximo).toBe(2_500);
    expect((await m.pedir(c.token, 2_550)).estado).toBe(422);
    expect((await m.pedir(c.token, 400)).estado).toBe(422);
    expect((await m.pedir(c.token, 3_000)).estado).toBe(409);
    const p = await m.pedir(c.token, 2_000);
    expect(p.estado).toBe(201);
    expect(p.datos.cobro).toMatchObject({ monto: 2_000, estado: 'activo', pagaEn: 'USD' });
    // Seis números y nunca empieza por cero (los códigos de ejemplo de las guías no existen).
    expect(p.datos.cobro.codigo).toMatch(/^[1-9]\d{5}$/);
    expect(await saldoRetirable(m.DB, c.id)).toBe(550);
    // Uno vivo a la vez.
    expect((await m.pedir(c.token, 500)).estado).toBe(409);
    expect(await saldoRetirable(m.DB, c.id)).toBe(550);
  });

  it('dos toques a la vez no apartan dos veces', async () => {
    const m = await mundo();
    await m.ciudad();
    await m.agente();
    const c = await m.conductor('Carlos Rojas', 2_000);
    const [a, b] = await Promise.all([m.pedir(c.token, 2_000), m.pedir(c.token, 2_000)]);
    expect([a.estado, b.estado].filter((x) => x === 201).length).toBeGreaterThanOrEqual(1);
    const n = await m.DB.prepare('SELECT COUNT(*) AS n FROM cobros_efectivo').first<{
      n: number;
    }>();
    expect(n?.n).toBe(1);
    expect(await saldoRetirable(m.DB, c.id)).toBe(0);
  });

  it('cancelado o vencido, el monto vuelve a las ganancias una sola vez', async () => {
    const m = await mundo();
    const { c } = await listoParaPagar(m);
    expect(await saldoRetirable(m.DB, c.id)).toBe(550);
    expect(
      (await m.e.m.llamar('DELETE', '/datos/repartidor/cobro-efectivo', undefined, c.token)).estado,
    ).toBe(200);
    expect(await saldoRetirable(m.DB, c.id)).toBe(2_550);
    expect(
      (await m.e.m.llamar('DELETE', '/datos/repartidor/cobro-efectivo', undefined, c.token)).estado,
    ).toBe(409);
    // Otro código, que se vence.
    const p = await m.pedir(c.token, 1_000);
    expect(p.estado).toBe(201);
    await m.DB.prepare(
      "UPDATE cobros_efectivo SET expira_en = datetime('now', '-1 minute') WHERE id = ?",
    )
      .bind(p.datos.cobro.id)
      .run();
    const despues = await m.mio(c.token);
    expect(despues.datos.vivo).toBeNull();
    expect(despues.datos.historial[0]).toMatchObject({ estado: 'vencido', monto: 1_000 });
    expect(despues.datos.historial[0].codigo).toBeUndefined();
    await m.mio(c.token);
    expect(await saldoRetirable(m.DB, c.id)).toBe(2_550);
    // Un cobro cerrado no cambia más (el disparador lo impide).
    await expect(
      m.DB.prepare("UPDATE cobros_efectivo SET estado = 'activo' WHERE id = ?")
        .bind(p.datos.cobro.id)
        .run(),
    ).rejects.toThrow(/cerrado/);
  });

  it('el tope diario por conductor cuenta lo pagado y lo vivo', async () => {
    const m = await mundo();
    await m.ciudad({ topeConductorDia: 3_000 });
    await m.agente();
    const c = await m.conductor('Carlos Rojas', 10_000);
    expect((await m.mio(c.token)).datos.maximo).toBe(3_000);
    expect((await m.pedir(c.token, 2_000)).estado).toBe(201);
    await m.e.m.llamar('DELETE', '/datos/repartidor/cobro-efectivo', undefined, c.token);
    // El cancelado no cuenta: puede volver a pedir hasta su tope.
    expect((await m.pedir(c.token, 4_000)).estado).toBe(409);
    expect((await m.pedir(c.token, 3_000)).estado).toBe(201);
  });

  it('ciudad que paga en bolívares: monto exacto con la tasa fijada al pedir', async () => {
    const m = await mundo();
    await m.DB.prepare(
      "INSERT OR REPLACE INTO tasas_modo (pais, modo, ajuste_pct, tasa_fija) VALUES ('VE', 'fija', NULL, 200)",
    ).run();
    expect((await m.ciudad({ pagaEn: 'VES' })).estado).toBe(200);
    const a = await m.agente();
    await m.fondo(a.id, 10_000);
    const c = await m.conductor('Carlos Rojas', 2_555);
    expect((await m.mio(c.token)).datos).toMatchObject({ pagaEn: 'VES', maximo: 2_555 });
    const p = await m.pedir(c.token, 2_555);
    expect(p.estado, JSON.stringify(p.datos)).toBe(201);
    // 25,55 dólares a 200 = 5.110,00 bolívares (en céntimos).
    expect(p.datos.cobro).toMatchObject({ refTasa: 200, refMonto: 511_000 });
    // La tasa cambia después: el código conserva la suya.
    await m.DB.prepare("UPDATE tasas_modo SET tasa_fija = 300 WHERE pais = 'VE'").run();
    const v = await m.como(a.cookie, 'POST', 'payouts/lookup', { codigo: p.datos.cobro.codigo });
    expect(v.datos.cobro).toMatchObject({ monto: 2_555, refMonto: 511_000, refTasa: 200 });
  });
});

describe('C-AGENTE-DIVOOX: el agente paga', () => {
  it('sin fondo el panel no deja pagar; con fondo paga una sola vez y todo queda en el libro', async () => {
    const m = await mundo();
    const { a, c, cobro } = await listoParaPagar(m);
    const visto = await m.como(a.cookie, 'POST', 'payouts/lookup', { codigo: cobro.codigo });
    expect(visto.estado, JSON.stringify(visto.datos)).toBe(200);
    expect(visto.datos.cobro).toMatchObject({
      id: cobro.id,
      monto: 2_000,
      alcanzaFondo: false,
      conductor: { nombre: 'Carlos Rojas', telefonoFinal: '0011' },
    });
    // El agente no recibe ni el teléfono completo ni el correo ni el id del conductor.
    expect(JSON.stringify(visto.datos)).not.toContain(c.id);
    expect(JSON.stringify(visto.datos)).not.toContain('ejemplo.com');
    const sinFondo = await m.como(a.cookie, 'POST', `payouts/${cobro.id}/pay`, {
      codigo: cobro.codigo,
    });
    expect(sinFondo.estado).toBe(409);
    expect(sinFondo.datos.campo ?? sinFondo.datos.error).toBeTruthy();
    expect(await saldoRetirable(m.DB, c.id)).toBe(550);
    expect((await m.fondo(a.id, 5_000, 'TRF-1')).estado).toBe(200);
    // El mismo comprobante no suma dos veces.
    expect((await m.fondo(a.id, 5_000, 'TRF-1')).estado).toBe(409);
    const pago = await m.como(a.cookie, 'POST', `payouts/${cobro.id}/pay`, {
      codigo: cobro.codigo,
    });
    expect(pago.estado, JSON.stringify(pago.datos)).toBe(200);
    expect(pago.datos.recibo).toMatchObject({ tipo: 'pago', monto: 2_000, fondo: 3_000 });
    // Doble uso: el segundo toque no paga otra vez ni baja el fondo.
    const otra = await m.como(a.cookie, 'POST', `payouts/${cobro.id}/pay`, {
      codigo: cobro.codigo,
    });
    expect(otra.estado).toBe(409);
    expect((await m.como(a.cookie, 'GET', 'me')).datos.agente).toMatchObject({
      fondo: 3_000,
      pagadoHoy: 2_000,
      deuda: 0,
    });
    // Las ganancias del conductor quedaron bajadas una vez y su código ya no existe para él.
    expect(await saldoRetirable(m.DB, c.id)).toBe(550);
    const mio = await m.mio(c.token);
    expect(mio.datos.vivo).toBeNull();
    expect(mio.datos.historial[0]).toMatchObject({
      estado: 'pagado',
      agente: 'Casa de Cambio Ejemplo',
    });
    expect(await saludAgentes(m.DB)).toBe('ok');
  });

  it('dos toques a la vez en «Pagado» pagan una sola vez', async () => {
    const m = await mundo();
    const { a, cobro } = await listoParaPagar(m);
    await m.fondo(a.id, 5_000);
    const pagar = () =>
      m.como(a.cookie, 'POST', `payouts/${cobro.id}/pay`, { codigo: cobro.codigo });
    const r = await Promise.all([pagar(), pagar()]);
    expect(r.map((x) => x.estado).sort()).toEqual([200, 409]);
    expect((await m.como(a.cookie, 'GET', 'me')).datos.agente.fondo).toBe(3_000);
  });

  it('un código vencido o cancelado no se paga', async () => {
    const m = await mundo();
    const { a, c, cobro } = await listoParaPagar(m);
    await m.fondo(a.id, 5_000);
    await m.como(a.cookie, 'POST', 'payouts/lookup', { codigo: cobro.codigo });
    await m.DB.prepare(
      "UPDATE cobros_efectivo SET expira_en = datetime('now', '-1 minute') WHERE id = ?",
    )
      .bind(cobro.id)
      .run();
    const r = await m.como(a.cookie, 'POST', `payouts/${cobro.id}/pay`, { codigo: cobro.codigo });
    expect([404, 410]).toContain(r.estado);
    expect((await m.como(a.cookie, 'GET', 'me')).datos.agente.fondo).toBe(5_000);
    await m.mio(c.token);
    expect(await saldoRetirable(m.DB, c.id)).toBe(2_550);
  });

  it('topes del agente: por pago y por día', async () => {
    const m = await mundo();
    const { a, c, cobro } = await listoParaPagar(m, 9_000, 2_000);
    await m.fondo(a.id, 50_000);
    expect((await m.admin('PATCH', `agentes/${a.id}`, { topePago: 1_000 })).estado).toBe(200);
    const cookie = await m.sesion(a.correo, a.clave);
    const r = await m.como(cookie, 'POST', `payouts/${cobro.id}/pay`, { codigo: cobro.codigo });
    expect(r.estado).toBe(409);
    await m.admin('PATCH', `agentes/${a.id}`, { topePago: 10_000, topeDia: 3_000 });
    expect(
      (await m.como(cookie, 'POST', `payouts/${cobro.id}/pay`, { codigo: cobro.codigo })).estado,
    ).toBe(200);
    const p2 = await m.pedir(c.token, 2_000);
    expect(p2.estado).toBe(201);
    const r2 = await m.como(cookie, 'POST', `payouts/${p2.datos.cobro.id}/pay`, {
      codigo: p2.datos.cobro.codigo,
    });
    expect(r2.estado).toBe(409);
    expect((await m.como(cookie, 'GET', 'me')).datos.agente.fondo).toBe(48_000);
  });

  it('códigos equivocados seguidos bloquean los pagos hasta que el equipo los reactive', async () => {
    const m = await mundo();
    const { a, cobro } = await listoParaPagar(m);
    await m.fondo(a.id, 5_000);
    for (let i = 1; i < MAX_CODIGOS_FALLIDOS; i++)
      expect((await m.como(a.cookie, 'POST', 'payouts/lookup', { codigo: '000000' })).estado).toBe(
        404,
      );
    expect((await m.como(a.cookie, 'POST', 'payouts/lookup', { codigo: '000001' })).estado).toBe(
      403,
    );
    // Bloqueado: ni con el código bueno.
    expect(
      (await m.como(a.cookie, 'POST', 'payouts/lookup', { codigo: cobro.codigo })).estado,
    ).toBe(403);
    expect(
      (await m.como(a.cookie, 'POST', `payouts/${cobro.id}/pay`, { codigo: cobro.codigo })).estado,
    ).toBe(403);
    expect((await m.como(a.cookie, 'GET', 'me')).datos.agente.pagosBloqueados).toBe(true);
    expect((await m.admin('PATCH', `agentes/${a.id}`, { desbloquearPagos: true })).estado).toBe(
      200,
    );
    expect(
      (await m.como(a.cookie, 'POST', 'payouts/lookup', { codigo: cobro.codigo })).estado,
    ).toBe(200);
  });

  it('un acierto pone la cuenta de fallos en cero', async () => {
    const m = await mundo();
    const { a, cobro } = await listoParaPagar(m);
    for (let i = 0; i < MAX_CODIGOS_FALLIDOS - 1; i++)
      await m.como(a.cookie, 'POST', 'payouts/lookup', { codigo: '000000' });
    expect(
      (await m.como(a.cookie, 'POST', 'payouts/lookup', { codigo: cobro.codigo })).estado,
    ).toBe(200);
    expect((await m.como(a.cookie, 'POST', 'payouts/lookup', { codigo: '000000' })).estado).toBe(
      404,
    );
  });
});

describe('C-AGENTE-DIVOOX: el agente vende saldo', () => {
  it('busca por teléfono completo, acredita al instante y sube lo que debe', async () => {
    const m = await mundo();
    await m.ciudad();
    const a = await m.agente();
    const c = await m.conductor('Ana Mora');
    // Medio teléfono no encuentra a nadie.
    expect((await m.como(a.cookie, 'POST', 'drivers/find', { telefono: '0414-777' })).estado).toBe(
      404,
    );
    const b = await m.como(a.cookie, 'POST', 'drivers/find', { telefono: c.telefono });
    expect(b.estado, JSON.stringify(b.datos)).toBe(200);
    expect(b.datos.conductor).toMatchObject({ id: c.id, nombre: 'Ana Mora' });
    const cuerpo = { conductorId: c.id, monto: 1_000, idem: 'venta-uno-0001' };
    const v = await m.como(a.cookie, 'POST', 'sales', cuerpo);
    expect(v.estado, JSON.stringify(v.datos)).toBe(201);
    expect(v.datos.recibo).toMatchObject({
      tipo: 'venta',
      monto: 1_000,
      saldoConductor: 1_000,
      deuda: 1_000,
    });
    expect(await saldoLibro(m.DB, c.id, 'prepago', 'VE', 'USD')).toBe(1_000);
    // El conductor ve la recarga en su saldo para comisiones (tipo «agente», con el nombre del agente).
    const mio = await m.e.m.llamar('GET', '/datos/repartidor/saldo-prepago', undefined, c.token);
    expect(mio.datos.cargas[0]).toMatchObject({
      tipo: 'agente',
      monto: 1_000,
      motivo: 'Agente Divoox · Casa de Cambio Ejemplo',
    });
    // El mismo toque repetido no vende dos veces.
    const otra = await m.como(a.cookie, 'POST', 'sales', cuerpo);
    expect(otra.datos.recibo.numero).toBe(v.datos.recibo.numero);
    expect(await saldoLibro(m.DB, c.id, 'prepago', 'VE', 'USD')).toBe(1_000);
    expect((await m.como(a.cookie, 'GET', 'me')).datos.agente).toMatchObject({
      deuda: 1_000,
      vendidoHoy: 1_000,
    });
    expect(await saludAgentes(m.DB)).toBe('ok');
  });

  it('no vende sin haber buscado al conductor, ni a uno de otra ciudad, ni por encima de sus topes', async () => {
    const m = await mundo();
    await m.ciudad();
    const a = await m.agente();
    const c = await m.conductor('Ana Mora');
    const venta = (monto: number, idem: string, id = c.id) =>
      m.como(a.cookie, 'POST', 'sales', { conductorId: id, monto, idem });
    expect((await venta(1_000, 'sin-buscar-0001')).estado).toBe(409);
    await m.como(a.cookie, 'POST', 'drivers/find', { telefono: c.telefono });
    expect((await venta(50, 'muy-poco-00001')).estado).toBe(409);
    expect((await venta(20_000, 'pasa-tope-0001')).estado).toBe(409);
    await m.admin('PATCH', `agentes/${a.id}`, { topeDeuda: 1_500 });
    const cookie = await m.sesion(a.correo, a.clave);
    await m.como(cookie, 'POST', 'drivers/find', { telefono: c.telefono });
    expect(
      (
        await m.como(cookie, 'POST', 'sales', {
          conductorId: c.id,
          monto: 1_000,
          idem: 'venta-dos-00001',
        })
      ).estado,
    ).toBe(201);
    expect(
      (
        await m.como(cookie, 'POST', 'sales', {
          conductorId: c.id,
          monto: 1_000,
          idem: 'venta-tres-0001',
        })
      ).estado,
    ).toBe(409);
    expect(await saldoLibro(m.DB, c.id, 'prepago', 'VE', 'USD')).toBe(1_000);
    // Un conductor de otra ciudad no aparece.
    await m.DB.prepare(
      "INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('VE-OTRA', 'Otra', 'VE', 'USD', 'America/Caracas', 9, -71, 10, 1)",
    ).run();
    const lejos = await m.conductor('Luis Otro', 0, 'VE-OTRA');
    expect(
      (await m.como(cookie, 'POST', 'drivers/find', { telefono: lejos.telefono })).estado,
    ).toBe(404);
  });
});

describe('C-AGENTE-DIVOOX: fondo y conciliación del equipo', () => {
  it('fondo, devolución, entrega y compensación; nunca más de lo que hay', async () => {
    const m = await mundo();
    await m.ciudad();
    const a = await m.agente();
    const c = await m.conductor('Ana Mora');
    const libro = (concepto: string, monto: number, comprobante: string) =>
      m.admin('POST', `agentes/${a.id}/libro`, { concepto, monto, comprobante });
    expect((await libro('fondo', 10_000, 'TRF-10')).datos.agente).toMatchObject({
      fondo: 10_000,
      deuda: 0,
    });
    expect((await libro('devolucion_fondo', 20_000, 'DEV-1')).estado).toBe(409);
    expect((await libro('devolucion_fondo', 4_000, 'DEV-2')).datos.agente.fondo).toBe(6_000);
    expect((await libro('entrega', 500, 'ENT-1')).estado).toBe(409);
    await m.como(a.cookie, 'POST', 'drivers/find', { telefono: c.telefono });
    await m.como(a.cookie, 'POST', 'sales', {
      conductorId: c.id,
      monto: 3_000,
      idem: 'venta-conc-0001',
    });
    expect((await libro('compensacion', 5_000, 'COMP-1')).estado).toBe(409);
    expect((await libro('compensacion', 1_000, 'COMP-2')).datos.agente).toMatchObject({
      fondo: 7_000,
      deuda: 2_000,
    });
    expect((await libro('entrega', 2_000, 'ENT-2')).datos.agente).toMatchObject({
      fondo: 7_000,
      deuda: 0,
    });
    const ficha = await m.admin('GET', `agentes/${a.id}`);
    expect(ficha.datos.agente).toMatchObject({
      vendido: 3_000,
      ventas: 1,
      pagado: 0,
      fondoRecibido: 11_000,
    });
    expect(ficha.datos.historial.length).toBeGreaterThanOrEqual(5);
    expect(ficha.datos.acciones.some((x: { accion: string }) => x.accion === 'venta')).toBe(true);
    // Todo quedó en la auditoría del equipo.
    const aud = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM auditoria_admin WHERE objeto = ? AND accion LIKE 'agente.%'",
    )
      .bind(`agente:${a.id}`)
      .first<{ n: number }>();
    expect(Number(aud?.n)).toBeGreaterThanOrEqual(5);
    expect(await saludAgentes(m.DB)).toBe('ok');
  });

  it('la salud se pone en rojo si un fondo queda negativo o lo pagado no cuadra', async () => {
    const m = await mundo();
    const { a, cobro } = await listoParaPagar(m);
    await m.fondo(a.id, 5_000);
    await m.como(a.cookie, 'POST', `payouts/${cobro.id}/pay`, { codigo: cobro.codigo });
    expect(await saludAgentes(m.DB)).toBe('ok');
    const otra = await mundo();
    const o = await listoParaPagar(otra);
    await otra.fondo(o.a.id, 5_000);
    await otra.como(o.a.cookie, 'POST', `payouts/${o.cobro.id}/pay`, { codigo: o.cobro.codigo });
    await otra.DB.prepare("DELETE FROM agente_libro WHERE concepto = 'pago_conductor'").run();
    expect(await saludAgentes(otra.DB)).toBe('error');
  });

  it('la salud se pone en rojo si falta un disparador del dinero', async () => {
    const m = await mundo();
    await m.ciudad();
    await m.agente();
    expect(await saludAgentes(m.DB)).toBe('ok');
    const otra = await mundo();
    await otra.ciudad();
    await otra.agente();
    await otra.DB.prepare('DROP TRIGGER cobros_efectivo_devuelve').run();
    expect(await saludAgentes(otra.DB)).toBe('error');
  });

  it('solo Venezuela paga en bolívares y en dólares el mínimo es entero', async () => {
    const m = await mundo();
    expect((await m.ciudad({ pagaEn: 'VES' }, 'US-FL-MIAMI')).estado).toBe(422);
    expect((await m.ciudad({ minimo: 550 })).estado).toBe(422);
    expect((await m.ciudad({ minimo: 99_999_999 })).estado).toBe(400);
  });
});

describe('C-AGENTE-DIVOOX: privilegio mínimo', () => {
  it('la sesión del agente no abre nada fuera de su panel', async () => {
    const m = await mundo();
    const { a, c } = await listoParaPagar(m);
    const token = a.cookie.split('=')[1] ?? '';
    const cabeceras = { cookie: `${a.cookie}; tumbite_sesion=${token}` };
    for (const [metodo, ruta] of [
      ['GET', '/datos/cuentas/yo'],
      ['GET', '/datos/admin/agentes'],
      ['GET', `/datos/admin/agentes/${a.id}`],
      ['GET', `/datos/admin/conductores-ciudad?zona=${EL_VIGIA.id}`],
      ['GET', '/datos/repartidor/cobro-efectivo'],
      ['GET', '/datos/repartidor/saldo-prepago'],
    ] as const) {
      const r = await m.e.m.llamar(metodo, ruta, undefined, undefined, cabeceras);
      expect(r.estado, ruta).toBe(401);
      // Y tampoco como llave de las apps.
      expect((await m.e.m.llamar(metodo, ruta, undefined, token)).estado, ruta).toBe(401);
    }
    // Lo suyo sí.
    expect((await m.como(a.cookie, 'GET', 'me')).estado).toBe(200);
    expect(JSON.stringify((await m.como(a.cookie, 'GET', 'me')).datos)).not.toContain(c.id);
  });

  it('nadie más entra al panel del agente: ni un conductor, ni el equipo, ni sin sesión', async () => {
    const m = await mundo();
    const { c } = await listoParaPagar(m);
    for (const ruta of ['me', 'history']) {
      expect((await m.e.m.llamar('GET', `/datos/agent/${ruta}`)).estado).toBe(401);
      expect((await m.e.m.llamar('GET', `/datos/agent/${ruta}`, undefined, c.token)).estado).toBe(
        401,
      );
      expect(
        (await m.e.m.llamar('GET', `/datos/agent/${ruta}`, undefined, m.e.admin.token)).estado,
      ).toBe(401);
      expect(
        (
          await m.e.m.llamar('GET', `/datos/agent/${ruta}`, undefined, undefined, {
            cookie: `divoox_agente=${c.token}`,
          })
        ).estado,
      ).toBe(401);
    }
    // Y un conductor o un cliente no llegan a Dinero → Agentes.
    expect((await m.e.m.llamar('GET', '/datos/admin/agentes', undefined, c.token)).estado).toBe(
      403,
    );
    expect(
      (await m.e.m.llamar('GET', '/datos/admin/agentes', undefined, m.e.cliente.token)).estado,
    ).toBe(403);
  });

  it('sin el segundo paso la sesión no sirve; el código vale una vez y pocos intentos', async () => {
    const m = await mundo();
    await m.ciudad();
    const a = await m.agente('Casa de Cambio Ejemplo', EL_VIGIA.id, false);
    const mala = await m.e.m.llamar('POST', '/datos/agent/login', {
      correo: a.correo,
      clave: 'otra-clave-mala',
    });
    expect(mala.estado).toBe(401);
    const noHay = await m.e.m.llamar('POST', '/datos/agent/login', {
      correo: 'nadie@ejemplo.com',
      clave: a.clave,
    });
    expect(noHay.datos.error).toBe(mala.datos.error);
    const r = await m.e.m.llamar('POST', '/datos/agent/login', {
      correo: a.correo,
      clave: a.clave,
    });
    const cookie = m.galleta(r.res);
    expect(r.res.headers.get('set-cookie')).toMatch(/HttpOnly; Secure; SameSite=Strict/);
    expect((await m.como(cookie, 'GET', 'me')).estado).toBe(401);
    const otra = await m.e.m.llamar('POST', '/datos/agent/login', {
      correo: a.correo,
      clave: a.clave,
    });
    const cookie2 = m.galleta(otra.res);
    for (let i = 0; i < 5; i++)
      expect((await m.como(cookie2, 'POST', 'verify', { codigo: '000000' })).estado).toBe(403);
    // Quemado: ni con el código bueno.
    expect(
      (await m.como(cookie2, 'POST', 'verify', { codigo: otra.datos.codigoPrueba })).estado,
    ).toBe(410);
    const buena = await m.sesion(a.correo, a.clave);
    expect((await m.como(buena, 'GET', 'me')).estado).toBe(200);
    // El código ya usado no abre otra sesión.
    expect((await m.como(buena, 'POST', 'verify', { codigo: '123456' })).estado).toBe(410);
  });

  it('en producción el código no vuelve en la respuesta', async () => {
    const e = await escenarioVe('divoox.com');
    await e.m.DB.prepare(
      "INSERT INTO agentes (id, nombre, correo, zona_id, clave_hash) VALUES ('ag-1', 'Agente Ejemplo', 'agente@ejemplo.com', 'US-FL-MIAMI', ?)",
    )
      .bind(await (await import('../cripto')).hashClave('clave-de-agente-1'))
      .run();
    const r = await e.m.llamar('POST', '/datos/agent/login', {
      correo: 'agente@ejemplo.com',
      clave: 'clave-de-agente-1',
    });
    expect(r.datos.codigoPrueba).toBeUndefined();
  });

  it('sesión corta: se cierra sola sin uso, al salir, al entrar en otro aparato y al suspender', async () => {
    const m = await mundo();
    await m.ciudad();
    const a = await m.agente();
    expect((await m.como(a.cookie, 'GET', 'me')).estado).toBe(200);
    await m.DB.prepare(
      "UPDATE agentes_sesiones SET vista_en = datetime('now', '-31 minutes')",
    ).run();
    expect((await m.como(a.cookie, 'GET', 'me')).estado).toBe(401);
    const s1 = await m.sesion(a.correo, a.clave);
    await m.DB.prepare(
      "UPDATE agentes_sesiones SET expira_en = datetime('now', '-1 minute')",
    ).run();
    expect((await m.como(s1, 'GET', 'me')).estado).toBe(401);
    const s2 = await m.sesion(a.correo, a.clave);
    const s3 = await m.sesion(a.correo, a.clave);
    expect((await m.como(s2, 'GET', 'me')).estado).toBe(401);
    expect((await m.como(s3, 'POST', 'logout')).estado).toBe(200);
    expect((await m.como(s3, 'GET', 'me')).estado).toBe(401);
    const s4 = await m.sesion(a.correo, a.clave);
    expect((await m.admin('PATCH', `agentes/${a.id}`, { estado: 'suspendido' })).estado).toBe(200);
    expect((await m.como(s4, 'GET', 'me')).estado).toBe(401);
    expect(
      (await m.e.m.llamar('POST', '/datos/agent/login', { correo: a.correo, clave: a.clave }))
        .estado,
    ).toBe(403);
  });

  it('un agente solo ve los códigos de su ciudad y solo su propio historial', async () => {
    const m = await mundo();
    const { a, cobro } = await listoParaPagar(m);
    await m.fondo(a.id, 5_000);
    await m.DB.prepare(
      "INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa) VALUES ('VE-OTRA', 'Otra', 'VE', 'USD', 'America/Caracas', 9, -71, 10, 1)",
    ).run();
    await m.ciudad({}, 'VE-OTRA');
    const b = await m.agente('Otro Agente Ejemplo', 'VE-OTRA');
    await m.fondo(b.id, 5_000);
    expect(
      (await m.como(b.cookie, 'POST', 'payouts/lookup', { codigo: cobro.codigo })).estado,
    ).toBe(404);
    expect(
      (await m.como(b.cookie, 'POST', `payouts/${cobro.id}/pay`, { codigo: cobro.codigo })).estado,
    ).toBe(404);
    expect(
      (await m.como(a.cookie, 'POST', `payouts/${cobro.id}/pay`, { codigo: cobro.codigo })).estado,
    ).toBe(200);
    expect(
      (await m.como(a.cookie, 'GET', 'history')).datos.historial.filter(
        (x: { tipo: string }) => x.tipo === 'pago',
      ),
    ).toHaveLength(1);
    const deB = (await m.como(b.cookie, 'GET', 'history')).datos.historial;
    expect(deB.filter((x: { tipo: string }) => x.tipo === 'pago')).toHaveLength(0);
    // En el historial el conductor sale con nombre corto.
    expect((await m.como(a.cookie, 'GET', 'history')).datos.historial[0].conductor).toBe(
      'Carlos R.',
    );
  });

  it('la foto del conductor solo se ve con su código delante', async () => {
    const m = await mundo();
    const { a, c, cobro } = await listoParaPagar(m);
    expect((await m.como(a.cookie, 'GET', `photo/${cobro.id}`)).estado).toBe(404);
    expect((await m.como(a.cookie, 'GET', `photo/${c.id}`)).estado).toBe(404);
    expect((await m.e.m.llamar('GET', `/datos/agent/photo/${cobro.id}`)).estado).toBe(401);
  });

  it('el enlace de la contraseña sirve una vez y la contraseña corta no pasa', async () => {
    const m = await mundo();
    await m.ciudad();
    const r = await m.admin('POST', 'agentes', {
      nombre: 'Agente Ejemplo',
      correo: 'agente.nuevo@ejemplo.com',
      zonaId: EL_VIGIA.id,
    });
    const token = new URL(r.datos.enlace.enlacePrueba).searchParams.get('token');
    expect(r.datos.enlace.enlacePrueba).toContain('/es/agent/password?token=');
    expect(
      (await m.e.m.llamar('POST', '/datos/agent/password', { token, clave: 'corta' })).estado,
    ).toBe(400);
    expect(
      (await m.e.m.llamar('POST', '/datos/agent/password', { token, clave: 'clave-de-agente-2' }))
        .estado,
    ).toBe(200);
    expect(
      (await m.e.m.llamar('POST', '/datos/agent/password', { token, clave: 'clave-de-agente-3' }))
        .estado,
    ).toBe(410);
    // El mismo correo no crea otro agente.
    expect(
      (
        await m.admin('POST', 'agentes', {
          nombre: 'Agente Ejemplo',
          correo: 'agente.nuevo@ejemplo.com',
          zonaId: EL_VIGIA.id,
        })
      ).estado,
    ).toBe(409);
    // «Olvidé mi contraseña» responde igual exista o no el correo.
    const si = await m.e.m.llamar('POST', '/datos/agent/password/forgot', {
      correo: 'agente.nuevo@ejemplo.com',
    });
    const no = await m.e.m.llamar('POST', '/datos/agent/password/forgot', {
      correo: 'nadie@ejemplo.com',
    });
    expect(si.estado).toBe(200);
    expect(no.estado).toBe(200);
    expect(no.datos.enlacePrueba).toBeUndefined();
  });
});
