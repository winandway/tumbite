import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { asegurarEsquema, reiniciarEsquema } from '../esquema';
import { APROBACIONES_DINERO_DDL } from '../esquemaDinero';
import { sentenciaLibro } from '../internacional/libro';
import { crearBasePruebas } from '../pruebas/d1';
import { mundo } from '../pruebas/ayuda';
import { empresa } from '../pruebas/flex';

/**
 * C-CONTROL-DUAL, arreglos de la revisión (SIG-4x, 3 nov 2026), cada uno comprobado en rojo:
 * (1) fraccionar no salta el control: cuenta lo que la misma persona movió a mano en 24 h en esa
 *     moneda, y lo que se movió sobre el mismo objeto; (2) subir un límite lo aprueba OTRA cuenta
 *     Total (bajarlo es inmediato); (3) «excedente devuelto» de la bandeja pasa por el control.
 * SQLite en memoria y Stripe SIMULADO: ningún cobro real.
 */
const CLAVE = 'clave-segura-1';
beforeEach(() =>
  vi.stubGlobal('fetch', async () => Response.json({ id: 'x', status: 'succeeded' })),
);
afterEach(() => vi.unstubAllGlobals());

async function escenario() {
  const m = mundo({ STRIPE_SECRET_KEY: 'sk_test_x' });
  const pide = await m.cuenta('admin', 'Soporte Pide');
  const e = await empresa(m);
  const saldo = async () =>
    (
      await m.llamar(
        'GET',
        `/datos/admin/finanzas/empresas/${e.id}/movimientos`,
        undefined,
        pide.token,
      )
    ).datos.saldo.disponible as number;
  const ajuste = (monto: number, token = pide.token) =>
    m.llamar(
      'POST',
      `/datos/admin/finanzas/empresas/${e.id}/ajuste`,
      { monto, motivo: 'compensación acordada', clave: CLAVE },
      token,
    );
  const umbrales = (u: Record<string, number>, token = pide.token) =>
    m.llamar('PUT', '/datos/admin/aprobaciones-dinero/umbrales', { umbrales: u }, token);
  const bandeja = (token = pide.token) =>
    m.llamar('GET', '/datos/admin/aprobaciones-dinero', undefined, token);
  return { m, pide, e, saldo, ajuste, umbrales, bandeja };
}

describe('C-CONTROL-DUAL · arreglos de la revisión (SIG-4x)', () => {
  it('fraccionar: veinte ajustes de 99,99 de la misma persona no pasan del límite sin segunda firma', async () => {
    const { saldo, ajuste } = await escenario();
    const estados: number[] = [];
    for (let i = 0; i < 20; i++) estados.push((await ajuste(9_999)).estado);
    expect(estados[0]).toBe(200);
    expect(estados.slice(1).every((s) => s === 202)).toBe(true);
    expect(await saldo()).toBe(9_999);
  });

  it('SIG-4y: veinte ajustes A LA VEZ tampoco pasan del límite (el apartado es atómico)', async () => {
    const { m, saldo, ajuste } = await escenario();
    // La base de pruebas contesta en orden: para que las peticiones se crucen como en D1, cada
    // lectura espera un momento antes de responder (las demás peticiones avanzan mientras tanto).
    const preparar = m.DB.prepare.bind(m.DB);
    m.DB.prepare = ((sql: string) => {
      const st = preparar(sql);
      const bind = st.bind.bind(st);
      const conPausa = (x: D1PreparedStatement) => {
        const first = x.first.bind(x) as D1PreparedStatement['first'];
        x.first = (async (...a: Parameters<D1PreparedStatement['first']>) => {
          const r = await (first as (...b: unknown[]) => Promise<unknown>)(...a);
          await new Promise((ok) => setTimeout(ok, 5));
          return r;
        }) as D1PreparedStatement['first'];
        return x;
      };
      st.bind = (...v: unknown[]) => conPausa(bind(...v));
      return conPausa(st);
    }) as typeof m.DB.prepare;
    const rs = await Promise.all(Array.from({ length: 20 }, () => ajuste(9_999)));
    expect(rs.filter((r) => r.estado === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.estado === 202)).toHaveLength(19);
    expect(await saldo()).toBe(9_999);
  });

  it('SIG-4y: si el movimiento falla, lo apartado se devuelve y no cuenta', async () => {
    const { m, e, ajuste } = await escenario();
    // Un ajuste negativo mayor que el saldo no se puede hacer: falla y no deja nada apartado.
    const falla = await ajuste(-5_000);
    expect(falla.estado).toBeGreaterThanOrEqual(400);
    const apartado = await m.DB.prepare('SELECT COUNT(*) AS n FROM dinero_manual WHERE objeto = ?')
      .bind(e.id)
      .first<{ n: number }>();
    expect(Number(apartado?.n)).toBe(0);
    expect((await ajuste(9_999)).estado).toBe(200);
  });

  it('el mismo objeto movido por dos personas también suma', async () => {
    const { m, ajuste } = await escenario();
    const otra = await m.cuenta('admin', 'Soporte Otra');
    expect((await ajuste(6_000)).estado).toBe(200);
    expect((await ajuste(6_000, otra.token)).estado).toBe(202);
  });

  it('lo de otra moneda u otro día no suma', async () => {
    const { m, ajuste } = await escenario();
    expect((await ajuste(9_000)).estado).toBe(200);
    await m.DB.prepare("UPDATE dinero_manual SET creado_en = datetime('now', '-25 hours')").run();
    expect((await ajuste(9_000)).estado).toBe(200);
  });

  it('subir un límite queda pendiente hasta que OTRA cuenta Total lo apruebe; bajarlo es inmediato', async () => {
    const { m, pide, saldo, ajuste, umbrales, bandeja } = await escenario();
    const sube = await umbrales({ USD: 100_000_000 });
    expect(sube.estado).toBe(202);
    expect((await bandeja()).datos.umbrales.USD).toBe(10_000);
    // Con el límite sin aprobar, mover 50.000 dólares sigue pidiendo segunda firma.
    expect((await ajuste(5_000_000)).estado).toBe(202);
    expect(await saldo()).toBe(0);
    const id = sube.datos.aprobacion.id as string;
    // Nadie se aprueba a sí mismo, tampoco el límite.
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/aprobaciones-dinero/${id}/aprobar`,
          { clave: CLAVE },
          pide.token,
        )
      ).estado,
    ).toBe(409);
    const otra = await m.cuenta('admin', 'Soporte Total');
    const ok = await m.llamar(
      'POST',
      `/datos/admin/aprobaciones-dinero/${id}/aprobar`,
      { clave: CLAVE },
      otra.token,
    );
    expect(ok.estado, JSON.stringify(ok.datos)).toBe(200);
    expect((await bandeja()).datos.umbrales.USD).toBe(100_000_000);
    // Bajar el límite (más control) no necesita a nadie.
    const baja = await umbrales({ USD: 10_000 });
    expect(baja.estado).toBe(200);
    expect((await bandeja()).datos.umbrales.USD).toBe(10_000);
  });

  it('un límite pendiente lo aprueba solo una cuenta Total, no Finanzas', async () => {
    const { m, umbrales } = await escenario();
    const id = (await umbrales({ USD: 50_000 })).datos.aprobacion.id as string;
    const jefa = await m.cuenta('admin', 'Soporte Jefa');
    const finanzas = await m.cuenta('admin', 'Soporte Finanzas');
    await m.llamar('PUT', `/datos/admin/equipo/${finanzas.id}`, { perfil: 'finanzas' }, jefa.token);
    expect(
      (
        await m.llamar(
          'POST',
          `/datos/admin/aprobaciones-dinero/${id}/aprobar`,
          { clave: CLAVE },
          finanzas.token,
        )
      ).estado,
    ).toBe(403);
  });

  it('«excedente devuelto» en la bandeja de casos pasa por el control dual', async () => {
    const { m, pide } = await escenario();
    const rep = await m.cuenta('repartidor', 'Repartidor');
    const cli = await m.cuenta('cliente', 'Cliente');
    const duenoId = (await m.cuenta('restaurante', 'Dueño')).id;
    await m.DB.batch([
      m.DB.prepare(
        "INSERT INTO restaurantes (id, dueno_id, nombre) VALUES ('rx', ?, 'Sabor')",
      ).bind(duenoId),
      m.DB.prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, repartidor_id, estado, lineas_json, subtotal, envio, servicio, cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion, metodo_pago, zona_id)
         VALUES ('px', ?, 'rx', ?, 'entregado', '[]', 1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 0, 'inicial', 'Calle 1', 'efectivo', 'US-FL-MIAMI')`,
      ).bind(cli.id, rep.id),
      sentenciaLibro(m.DB, {
        cuentaId: rep.id,
        bolsillo: 'directo',
        pais: 'US',
        moneda: 'USD',
        monto: -50_000,
        concepto: 'excedente_cliente_por_devolver',
        pedidoId: 'px',
        referencia: 'excedente:px',
        autorId: pide.id,
      }),
    ]);
    const r = await m.llamar(
      'POST',
      `/datos/admin/bandeja-dinero/${encodeURIComponent('excedente:px')}/acciones`,
      {
        accion: 'excedente_devuelto',
        nota: 'devolvió por transferencia',
        idempotencia: 'exc-px-0001',
      },
      pide.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(202);
    const libro = await m.DB.prepare(
      "SELECT COUNT(*) AS n FROM libro WHERE concepto = 'excedente_devuelto_al_cliente'",
    ).first<{ n: number }>();
    expect(Number(libro?.n)).toBe(0);
    // La aprueba otra persona y recién ahí se escribe en el libro del repartidor.
    const otra = await m.cuenta('admin', 'Soporte Total');
    const ok = await m.llamar(
      'POST',
      `/datos/admin/aprobaciones-dinero/${r.datos.aprobacion.id}/aprobar`,
      { clave: CLAVE },
      otra.token,
    );
    expect(ok.estado, JSON.stringify(ok.datos)).toBe(200);
    const despues = await m.DB.prepare(
      "SELECT SUM(monto) AS s FROM libro WHERE pedido_id = 'px' AND bolsillo = 'directo'",
    ).first<{ s: number }>();
    expect(Number(despues?.s)).toBe(0);
  });

  it('la tabla vieja de producción se rehace con los tipos nuevos sin perder filas', async () => {
    const DB = crearBasePruebas();
    await DB.prepare(
      "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES ('u1', 'a@ejemplo.com', 'Soporte', 'admin', 'x')",
    ).run();
    await DB.exec('DROP TABLE aprobaciones_dinero');
    await DB.exec(
      // Las tablas viejas de producción tampoco tenían «recarga_local» (Flex Fase 7).
      APROBACIONES_DINERO_DDL.replace(", 'recarga_local'", '')
        .replace(", 'excedente_devuelto', 'umbral', 'excusa_conciliacion'", '')
        .replace(/\n/g, ' '),
    );
    await DB.prepare(
      "INSERT INTO aprobaciones_dinero (id, tipo, objeto, monto, moneda, datos, pedido_por) VALUES ('a1', 'fondo_punto', 'p1', 5, 'USD', '{}', 'u1')",
    ).run();
    reiniciarEsquema();
    await asegurarEsquema(DB);
    await DB.prepare(
      "INSERT INTO aprobaciones_dinero (id, tipo, objeto, monto, moneda, datos, pedido_por) VALUES ('a2', 'umbral', 'umbrales:USD', 5, 'USD', '{}', 'u1')",
    ).run();
    const n = await DB.prepare('SELECT COUNT(*) AS n FROM aprobaciones_dinero').first<{
      n: number;
    }>();
    expect(Number(n?.n)).toBe(2);
  });

  it('ETP-3: la tabla de SIG-4x (sin «excusa_conciliacion») también se rehace sin perder filas', async () => {
    const DB = crearBasePruebas();
    await DB.prepare(
      "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES ('u1', 'a@ejemplo.com', 'Soporte', 'admin', 'x')",
    ).run();
    await DB.exec('DROP TABLE aprobaciones_dinero');
    await DB.exec(
      APROBACIONES_DINERO_DDL.replace(", 'recarga_local'", '')
        .replace(", 'excusa_conciliacion'", '')
        .replace(/\n/g, ' '),
    );
    await DB.prepare(
      "INSERT INTO aprobaciones_dinero (id, tipo, objeto, monto, moneda, datos, pedido_por) VALUES ('a1', 'umbral', 'umbrales:USD', 5, 'USD', '{}', 'u1')",
    ).run();
    reiniciarEsquema();
    await asegurarEsquema(DB);
    await DB.prepare(
      "INSERT INTO aprobaciones_dinero (id, tipo, objeto, monto, moneda, datos, pedido_por) VALUES ('a2', 'excusa_conciliacion', 'conciliacion:2026-10-15', 718, 'USD', '{}', 'u1')",
    ).run();
    const n = await DB.prepare('SELECT COUNT(*) AS n FROM aprobaciones_dinero').first<{
      n: number;
    }>();
    expect(Number(n?.n)).toBe(2);
  });

  it('schema.sql y la migración tienen la misma tabla', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const esquema = readFileSync(join(__dirname, '..', '..', '..', '..', 'schema.sql'), 'utf8');
    const tipos = (sql: string) =>
      /tipo TEXT NOT NULL CHECK \(tipo IN \(([^)]*)\)\)/.exec(sql)?.[1];
    const tabla = esquema.slice(esquema.indexOf('CREATE TABLE IF NOT EXISTS aprobaciones_dinero'));
    expect(tipos(tabla)).toBe(tipos(APROBACIONES_DINERO_DDL));
  });
});
