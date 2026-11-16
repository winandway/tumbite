import { describe, expect, it } from 'vitest';
import { equivalenteLocal } from '@tumbite/compartido';
import { crearBasePruebas } from '../pruebas/d1';
import { abrirCaracas, escenarioVe, pedirMotoVe } from '../pruebas/motoVe';
import { AJUSTE_MAXIMO_PCT, tasaVigente } from './tasasReferencia';

/**
 * C-TASA-MODOS (14 nov 2026) — Venezuela. El equipo elige por país cómo sale la tasa de referencia:
 * «oficial» (la del Banco Central, automática; por defecto), «flotante» (la oficial más un ajuste en
 * porcentaje, con tope) o «fija» (una tasa que no vence hasta que la cambien). Una sola pieza
 * (`tasaVigente`) la resuelve para viajes y comida; los montos en dólares no cambian.
 */
const AHORA = Date.UTC(2026, 10, 14, 14, 0);
const hoyCaracas = () => new Date(Date.now() - 4 * 3600_000).toISOString().slice(0, 10);

async function oficial(db: D1Database, fecha: string, tasa: number) {
  await db
    .prepare("INSERT INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', ?, 'bcv', ?)")
    .bind(fecha, tasa)
    .run();
}

async function modo(db: D1Database, m: string, ajuste: number | null, fija: number | null) {
  await db
    .prepare(
      'INSERT OR REPLACE INTO tasas_modo (pais, modo, ajuste_pct, tasa_fija) VALUES (?, ?, ?, ?)',
    )
    .bind('VE', m, ajuste, fija)
    .run();
}

describe('C-TASA-MODOS: la tasa por país en una sola pieza', () => {
  it('sin configuración, el modo es «oficial»: la del Banco Central', async () => {
    const db = crearBasePruebas();
    await oficial(db, '2026-11-13', 911.6243);
    expect(await tasaVigente(db, 'VE', AHORA)).toMatchObject({
      tasa: 911.6243,
      fecha: '2026-11-13',
      fuente: 'bcv',
    });
  });

  it('flotante: la oficial más el ajuste, redondeada a 4 decimales; sin oficial no hay tasa', async () => {
    const db = crearBasePruebas();
    await modo(db, 'flotante', 5, null);
    expect(await tasaVigente(db, 'VE', AHORA)).toBeNull();
    await oficial(db, '2026-11-13', 911.6243);
    const t = await tasaVigente(db, 'VE', AHORA);
    expect(t).toMatchObject({ tasa: 957.2055, fecha: '2026-11-13', fuente: 'flotante' });
    expect(t?.base).toMatchObject({ tasa: 911.6243, fuente: 'bcv' });
    await modo(db, 'flotante', -10, null);
    expect((await tasaVigente(db, 'VE', AHORA))?.tasa).toBe(820.4619);
  });

  it('fija: la del equipo, que no vence; la oficial no la pisa', async () => {
    const db = crearBasePruebas();
    await oficial(db, '2026-11-13', 911.6243);
    await modo(db, 'fija', null, 950);
    await db.prepare("UPDATE tasas_modo SET cambiado_en = '2026-10-01 12:00:00'").run();
    expect(await tasaVigente(db, 'VE', AHORA)).toMatchObject({
      tasa: 950,
      fecha: '2026-10-01',
      fuente: 'fija',
    });
  });

  it('el panel cambia el modo con validación, auditoría y quién lo hizo; los viajes lo respetan', async () => {
    const e = await escenarioVe();
    await abrirCaracas(e);
    await oficial(e.m.DB, hoyCaracas(), 900);
    const cambiar = (cuerpo: unknown, token = e.admin.token) =>
      e.m.llamar('PUT', '/datos/admin/tasas-referencia/VE/modo', cuerpo, token);

    // Fuera del tope o sin el dato que hace falta: no se guarda.
    expect((await cambiar({ modo: 'flotante', ajustePct: AJUSTE_MAXIMO_PCT + 1 })).estado).toBe(
      400,
    );
    expect((await cambiar({ modo: 'fija' })).estado).toBe(400);
    expect((await cambiar({ modo: 'paralelo' })).estado).toBe(400);
    // Solo el equipo.
    expect((await cambiar({ modo: 'fija', tasaFija: 1 }, e.cliente.token)).estado).toBe(403);

    const r = await cambiar({ modo: 'flotante', ajustePct: 10 });
    expect(r.estado).toBe(200);
    const lista = await e.m.llamar(
      'GET',
      '/datos/admin/tasas-referencia',
      undefined,
      e.admin.token,
    );
    expect(lista.datos.tasas[0]).toMatchObject({
      pais: 'VE',
      modo: { modo: 'flotante', ajustePct: 10, cambiadoPor: 'Soporte Divoox' },
      oficial: { tasa: 900, fuente: 'bcv' },
      enUso: { tasa: 990, fuente: 'flotante' },
    });
    const v = await pedirMotoVe(e, 'efectivo');
    expect(v.cotizacion.referencia).toMatchObject({
      tasa: 990,
      monto: equivalenteLocal(v.total, 990),
    });

    await cambiar({ modo: 'fija', tasaFija: 1000 });
    await cambiar({ modo: 'oficial' });
    const auditoria = await e.m.DB.prepare(
      "SELECT accion, despues_json FROM auditoria_admin WHERE accion = 'tasa.modo' ORDER BY rowid",
    ).all<{ accion: string; despues_json: string }>();
    expect(auditoria.results.map((a) => JSON.parse(a.despues_json).modo)).toEqual([
      'flotante',
      'fija',
      'oficial',
    ]);
    const fin = await e.m.llamar('GET', '/datos/admin/tasas-referencia', undefined, e.admin.token);
    expect(fin.datos.tasas[0].enUso).toMatchObject({ tasa: 900, fuente: 'bcv' });
  });

  it('mirar la tasa no escribe nada en la base', async () => {
    const e = await escenarioVe();
    await oficial(e.m.DB, hoyCaracas(), 900);
    await e.m.sesionLista(e.admin.token);
    const cambios = async () =>
      Number((await e.m.DB.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0);
    const antes = await cambios();
    await e.m.llamar('GET', '/datos/admin/tasas-referencia', undefined, e.admin.token);
    await tasaVigente(e.m.DB, 'VE');
    expect((await cambios()) - antes).toBe(0);
  });
});
