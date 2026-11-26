import { describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS, politicaPlazoDeFabrica } from '@tumbite/compartido';
import { abrirCaracas } from './pruebas/motoVe';
import { mundo } from './pruebas/ayuda';
import { REQUISITO_EDAD, rellenarDatosDocumento } from './edadYDocumento';

/**
 * Ajustes del revisor (25 nov 2026) al relleno y a la edad (C-FECHA-GUARDADA, C-EDAD-POR-PAIS) — todos
 * los países: el relleno recorre una sola vez con su cursor y se apaga (con 50 que no cumplen avanza y
 * termina; al día no lee ni escribe de más), una lectura ilegible queda vista con UNA línea de error, y
 * «Habilitar» respeta la edad exenta del país.
 */
async function escenario() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero de ejemplo');
  expect((await abrirCaracas({ m, admin, cliente })).estado).toBe(201);
  const conductor = async (nombre: string, fecha: string | null) => {
    const rep = await m.cuenta('repartidor', nombre);
    await m.llamar('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id }, rep.token);
    await m.DB.prepare('UPDATE usuarios SET fecha_nacimiento = ? WHERE id = ?')
      .bind(fecha, rep.id)
      .run();
    return rep;
  };
  return { m, admin, conductor };
}

/** La base envuelta: cuenta las sentencias que lee y las que escriben. */
function contar(db: D1Database) {
  const sentencias: string[] = [];
  const envuelta = new Proxy(db, {
    get(obj, clave) {
      if (clave === 'prepare')
        return (sql: string) => {
          sentencias.push(sql.trim());
          return obj.prepare(sql);
        };
      const v = Reflect.get(obj, clave) as unknown;
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(obj) : v;
    },
  });
  const escrituras = () => sentencias.filter((s) => /^(INSERT|UPDATE|DELETE)/i.test(s)).length;
  return { envuelta, sentencias, escrituras };
}

const nada = async () => false;

describe('relleno con cursor: avanza, termina y al día no hace nada', () => {
  it('con 50 que no cumplen ninguna edad avanza, pone al día al que viene detrás y se apaga', async () => {
    const s = await escenario();
    const anio = new Date().getUTCFullYear();
    for (let i = 0; i < 50; i++) await s.conductor(`Conductor Menor ${i}`, `${anio - 15}-01-01`);
    const cumple = await s.conductor('Conductor Que Cumple', '1974-03-10');
    let vueltas = 0;
    let r = { fin: false };
    while (!r.fin && vueltas < 10) {
      r = await rellenarDatosDocumento(s.m.DB, nada);
      vueltas++;
    }
    expect(r.fin).toBe(true);
    expect(vueltas).toBeLessThanOrEqual(4);
    const edad = await s.m.DB.prepare(
      "SELECT estado FROM cumplimientos WHERE conductor_id = ? AND vehiculo_id = '' AND requisito = ?",
    )
      .bind(cumple.id, REQUISITO_EDAD)
      .first<{ estado: string }>();
    expect(edad?.estado).toBe('aprobado');
    // Al día: dos lecturas (los cursores de las dos pasadas) y ninguna escritura.
    const c = contar(s.m.DB);
    expect(await rellenarDatosDocumento(c.envuelta, nada)).toEqual({
      sinIa: 0,
      releidas: 0,
      fin: true,
    });
    expect(c.sentencias).toHaveLength(2);
    expect(c.escrituras()).toBe(0);
  });

  it('una lectura ilegible queda vista y deja UNA línea en el registro de errores', async () => {
    const s = await escenario();
    const c = await s.conductor('Conductor Lectura Rota', null);
    await s.m.DB.prepare(
      `INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, estado, ia_color, ia_json)
       VALUES ('vf-rota', ?, 'doc_frente', 'verif/doc', 'vigente', 'verde', '{roto')`,
    )
      .bind(c.id)
      .run();
    for (let i = 0; i < 3; i++) await rellenarDatosDocumento(s.m.DB, nada);
    const fila = await s.m.DB.prepare('SELECT 1 AS si FROM datos_documento WHERE usuario_id = ?')
      .bind(c.id)
      .first();
    expect(fila).toEqual({ si: 1 });
    const errores = await s.m.DB.prepare(
      "SELECT count(*) AS n FROM errores_servidor WHERE mensaje LIKE 'relleno: la lectura guardada%'",
    ).first<{ n: number }>();
    expect(Number(errores?.n)).toBe(1);
  });
});

describe('«Habilitar» respeta la edad exenta del país', () => {
  it('con la edad exenta en su país, sin fecha no la pide', async () => {
    const s = await escenario();
    const fabrica = politicaPlazoDeFabrica('VE');
    await s.m.DB.prepare(
      "INSERT INTO config (clave, valor) VALUES ('pais:VE', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
    )
      .bind(
        JSON.stringify({
          plazoPapeles: { ...fabrica, exentos: [...fabrica.exentos, REQUISITO_EDAD] },
        }),
      )
      .run();
    const c = await s.conductor('Conductor Edad Exenta', null);
    const r = await s.m.llamar(
      'PUT',
      `/datos/admin/habilitaciones/${c.id}/moto`,
      { estado: 'aprobada' },
      s.admin.token,
    );
    expect(r.datos.requisitosFaltantes ?? []).not.toContain(REQUISITO_EDAD);
    expect(r.datos.edad).toBeUndefined();
  });
});
