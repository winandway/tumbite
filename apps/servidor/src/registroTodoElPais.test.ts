import { describe, expect, it } from 'vitest';
import type { LugarCuenta } from '@tumbite/compartido';
import { contarFilas, type CuentaFilas } from './presupuestoFilas';
import { mundo } from './pruebas/ayuda';
import { EL_VIGIA, abrirComida, escenarioVe } from './pruebas/comidaVe';
import { barraActivacion } from './activacion';
import { AJUSTES_REZAGADOS_DE_FABRICA, candidatos } from './rezagados';
import { faltaDeBarra } from './whatsappFalta';
import {
  LOTE_ESPERA,
  PRESUPUESTO_PASO_AL_ABRIR,
  PRESUPUESTO_PASO_ESPERA,
  PRESUPUESTO_REGISTRO_CON_LUGAR,
  pasarEspera,
  pasarEsperaAlAbrir,
  saludEspera,
} from './lugarEspera';

/**
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026, encargo de Richard; Venezuela y Estados Unidos) — parte B,
 * servidor. Gente real de Maracaibo, Caracas, Gilroy y Nueva York creaba su cuenta de Driver y quedaba
 * «en Miami» (el valor por defecto de la ficha), sin ID, con los papeles de otro país y «Sin zona».
 * Comprobado en ROJO: (a) y (b) sin `lugar` en el registro y con el país de la zona por defecto;
 * (b) también dejando conectarse a quien espera; (c) sin el paso al abrir la zona, y quitando la
 * condición «todavía en espera» (de la lista y de la escritura) el segundo paso volvía a pasarlos y a
 * avisarles; (d) con cada tope por debajo de lo medido; (e) sin el filtro de cuentas internas.
 */
const MARACAIBO: LugarCuenta = {
  pais: 'VE',
  estado: 'V',
  municipio: 'Maracaibo',
  ciudad: 'Maracaibo',
  lugarId: 'gn:3633009',
  lat: 10.6427,
  lng: -71.6125,
};
const CARACAS: LugarCuenta = {
  pais: 'VE',
  estado: 'A',
  municipio: 'Libertador',
  ciudad: 'Caracas',
  lugarId: 'gn:3646738',
  lat: 10.4806,
  lng: -66.9036,
};
const GILROY: LugarCuenta = {
  pais: 'US',
  estado: 'CA',
  municipio: 'Santa Clara County',
  ciudad: 'Gilroy',
  lugarId: 'gn:5352214',
  lat: 37.0058,
  lng: -121.5683,
};
const NUEVA_YORK: LugarCuenta = {
  pais: 'US',
  estado: 'NY',
  municipio: null,
  ciudad: 'New York City',
  lugarId: 'gn:5128581',
  lat: 40.7128,
  lng: -74.006,
};
/** Dentro de la zona de pruebas de El Vigía (15 km a la redonda). */
const EL_VIGIA_LUGAR: LugarCuenta = {
  pais: 'VE',
  estado: 'L',
  municipio: 'Alberto Adriani',
  ciudad: 'El Vigía',
  lugarId: 'gn:3830307',
  lat: 8.6219,
  lng: -71.6506,
};

type M = ReturnType<typeof mundo>;

async function registrar(
  m: M,
  rol: 'repartidor' | 'cliente',
  lugar: unknown,
  extra: Record<string, unknown> = {},
) {
  const r = await m.llamar('POST', '/datos/cuentas/registro', {
    nombre: 'Persona Real',
    correo: `${rol}-${Math.random().toString(36).slice(2)}@ejemplo.com`,
    clave: 'clave-segura-1',
    rol,
    idioma: 'es',
    ...(lugar === undefined ? {} : { lugar }),
    ...extra,
  });
  return { r, id: r.datos.usuario?.id as string, token: r.datos.token as string };
}

const fila = (m: M, id: string) =>
  m.DB.prepare(
    `SELECT u.zona_id, u.lugar_pais, u.lugar_ciudad, u.lugar_id, u.lugar_espera, r.codigo, r.zona_id AS rz
       FROM usuarios u LEFT JOIN repartidores r ON r.usuario_id = u.id WHERE u.id = ?`,
  )
    .bind(id)
    .first<Record<string, unknown>>();

describe('C-REGISTRO-TODO-EL-PAIS · (a) cualquier ciudad del país deja crear la cuenta', () => {
  it('Maracaibo, Caracas, Gilroy y Nueva York: 201, conductor y cliente, con su lugar guardado', async () => {
    const m = mundo();
    for (const lugar of [MARACAIBO, CARACAS, GILROY, NUEVA_YORK])
      for (const rol of ['repartidor', 'cliente'] as const) {
        const { r, id } = await registrar(m, rol, lugar);
        expect(r.estado, `${rol} en ${lugar.ciudad}`).toBe(201);
        const f = await fila(m, id);
        expect(f).toMatchObject({
          lugar_pais: lugar.pais,
          lugar_ciudad: lugar.ciudad,
          lugar_id: lugar.lugarId,
          lugar_espera: 1,
          zona_id: null,
        });
      }
  });

  it('una app vieja (sin lugar) y un lugar mal formado siguen creando la cuenta, como siempre', async () => {
    const m = mundo();
    expect((await registrar(m, 'repartidor', undefined)).r.estado).toBe(201);
    const mal = await registrar(m, 'repartidor', { pais: 'XX', ciudad: '' });
    expect(mal.r.estado).toBe(201);
    expect(await fila(m, mal.id)).toMatchObject({ lugar_id: null, lugar_espera: null });
  });
});

describe('C-REGISTRO-TODO-EL-PAIS · (b) ciudad sin zona: en espera, nunca error, con los papeles de SU país', () => {
  it('Maracaibo: espera su ciudad, ve «Maracaibo, Zulia», papeles de Venezuela, sin ID ni conexión', async () => {
    const m = mundo();
    const c = await registrar(m, 'repartidor', MARACAIBO);
    const lugar = await m.llamar('GET', '/datos/cuentas/lugar', undefined, c.token);
    expect(lugar.datos).toMatchObject({
      lugar: MARACAIBO,
      zona: null,
      enEspera: true,
      lugarEscrito: 'Maracaibo, Zulia',
    });
    const papeles = await m.llamar('GET', '/datos/conductor/papeles', undefined, c.token);
    expect(papeles.estado).toBe(200);
    expect(papeles.datos.ciudad.nombre).toBe('Maracaibo, Zulia');
    expect(papeles.datos.enEspera).toBe(true);
    // Los papeles y el perfil de pasajeros de Venezuela (antes: los de Estados Unidos, por Miami).
    expect(papeles.datos.perfil.pais).toBe('VE');
    // Sin ciudad abierta no hay ID (nunca uno de Miami) ni se conecta: el mensaje es el de espera.
    const con = await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: MARACAIBO.lat, lng: MARACAIBO.lng },
      c.token,
    );
    expect(con.estado).toBe(409);
    expect(con.datos.codigo).toBe('en_espera_ciudad');
    expect(con.datos.error).toMatch(/no trips in your city yet/);
    expect((await fila(m, c.id))?.codigo ?? null).toBeNull();
  });

  it('Gilroy (EE. UU.): su celular se lee con su país y sigue en espera', async () => {
    const m = mundo();
    const c = await registrar(m, 'repartidor', GILROY, { telefono: '4085550123' });
    expect(c.r.estado).toBe(201);
    const t = await m.DB.prepare('SELECT telefono FROM usuarios WHERE id = ?')
      .bind(c.id)
      .first<{ telefono: string }>();
    expect(t?.telefono).toBe('+14085550123');
  });

  it('su ciudad dentro de una zona abierta: la zona se asigna sola, como ciudad elegida, con su ID', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const c = await registrar(e.m, 'repartidor', EL_VIGIA_LUGAR);
    const f = await fila(e.m, c.id);
    expect(f).toMatchObject({ zona_id: EL_VIGIA.id, rz: EL_VIGIA.id, lugar_espera: null });
    expect(String(f?.codigo)).toMatch(/^VE-[A-Z]{3}-\d{6}$/);
    const l = await e.m.llamar('GET', '/datos/cuentas/lugar', undefined, c.token);
    expect(l.datos).toMatchObject({ zona: { id: EL_VIGIA.id }, enEspera: false });
  });

  it('el panel cuenta por ciudad y dice «en espera», no «sin zona»; el buscador la encuentra por ciudad y estado', async () => {
    const e = await escenarioVe();
    const a = await registrar(e.m, 'repartidor', MARACAIBO);
    await registrar(e.m, 'repartidor', MARACAIBO);
    await registrar(e.m, 'cliente', MARACAIBO);
    await registrar(e.m, 'repartidor', CARACAS);
    // Una cuenta vieja sin lugar sigue siendo «sin zona» (tarea del equipo).
    await registrar(e.m, 'repartidor', undefined);
    const lista = await e.m.llamar('GET', '/datos/admin/espera-ciudades', undefined, e.admin.token);
    expect(lista.estado).toBe(200);
    expect(lista.datos.ciudades[0]).toMatchObject({
      lugarId: MARACAIBO.lugarId,
      lugarEscrito: 'Maracaibo, Zulia',
      conductores: 2,
      clientes: 1,
    });
    expect(lista.datos.total).toBe(4);
    const soloVe = await e.m.llamar(
      'GET',
      '/datos/admin/espera-ciudades?pais=VE&estado=A&rol=repartidor',
      undefined,
      e.admin.token,
    );
    expect(soloVe.datos.ciudades).toHaveLength(1);
    const personas = await e.m.llamar(
      'GET',
      `/datos/admin/espera-ciudades/personas?lugarId=${encodeURIComponent(MARACAIBO.lugarId)}`,
      undefined,
      e.admin.token,
    );
    expect(personas.datos.personas).toHaveLength(3);
    const reps = await e.m.llamar(
      'GET',
      '/datos/admin/repartidores?zona=en_espera&cuentas=todas',
      undefined,
      e.admin.token,
    );
    const uno = reps.datos.repartidores.find((x: { id: string }) => x.id === a.id);
    expect(uno).toMatchObject({ enEspera: true, sinZona: false, lugarEscrito: 'Maracaibo, Zulia' });
    const porEstado = await e.m.llamar(
      'GET',
      '/datos/admin/repartidores?estado=V&cuentas=todas',
      undefined,
      e.admin.token,
    );
    expect(porEstado.datos.repartidores).toHaveLength(2);
    const sinZona = await e.m.llamar(
      'GET',
      '/datos/admin/repartidores?zona=sin_zona&cuentas=todas',
      undefined,
      e.admin.token,
    );
    expect(sinZona.datos.repartidores).toHaveLength(1);
    // El embudo: dónde viven las cuentas del período, cuántas esperan su ciudad y cuántas no lo dijeron.
    const hoy = new Date().toISOString().slice(0, 10);
    const embudo = await e.m.llamar(
      'GET',
      `/datos/admin/embudo?app=repartidor&desde=${hoy}&hasta=${hoy}&pais=VE&estado=V`,
      undefined,
      e.admin.token,
    );
    expect(embudo.estado).toBe(200);
    expect(embudo.datos.porLugar).toEqual([
      expect.objectContaining({ lugarEscrito: 'Maracaibo, Zulia', personas: 2, enEspera: 2 }),
    ]);
    const todo = await e.m.llamar(
      'GET',
      `/datos/admin/embudo?app=repartidor&desde=${hoy}&hasta=${hoy}`,
      undefined,
      e.admin.token,
    );
    expect(todo.datos.sinLugar).toBeGreaterThanOrEqual(1);
    expect(todo.datos.porLugar.every((l: { lugarId: string }) => l.lugarId !== 'null')).toBe(true);
    for (const q of ['marac', 'zulia']) {
      const b = await e.m.llamar('GET', `/datos/admin/buscar?q=${q}`, undefined, e.admin.token);
      const grupo = b.datos.grupos.find((g: { tipo: string }) => g.tipo === 'repartidores');
      expect(
        grupo?.resultados.map((x: { id: string }) => x.id),
        q,
      ).toContain(a.id);
      expect(grupo?.resultados.find((x: { id: string }) => x.id === a.id)?.ciudad).toBe(
        'Maracaibo, Zulia',
      );
    }
  });
});

describe('C-REGISTRO-TODO-EL-PAIS · (c) al abrir una zona, los que esperan pasan solos y se les avisa una vez', () => {
  it('PUT /admin/zonas activa Maracaibo: pasan conductor y cliente; repetir no avisa otra vez', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const cond = await registrar(e.m, 'repartidor', MARACAIBO);
    const cli = await registrar(e.m, 'cliente', MARACAIBO);
    const lejos = await registrar(e.m, 'repartidor', CARACAS);
    const abrir = await e.m.llamar(
      'PUT',
      '/datos/admin/zonas',
      {
        id: 'VE-ZUL-MARACAIBO',
        nombre: 'Maracaibo',
        pais: 'VE',
        lat: 10.6427,
        lng: -71.6125,
        radioKm: 20,
        activa: true,
      },
      e.admin.token,
    );
    expect(abrir.estado).toBe(200);
    expect(abrir.datos.espera).toMatchObject({
      pasaron: 2,
      conductores: 1,
      clientes: 1,
      quedan: 0,
    });
    const f = await fila(e.m, cond.id);
    expect(f).toMatchObject({
      zona_id: 'VE-ZUL-MARACAIBO',
      rz: 'VE-ZUL-MARACAIBO',
      lugar_espera: null,
    });
    expect(String(f?.codigo)).toMatch(/^VE-[A-Z]{3}-\d{6}$/);
    expect(await fila(e.m, cli.id)).toMatchObject({ lugar_espera: null, zona_id: null });
    expect(await fila(e.m, lejos.id)).toMatchObject({ lugar_espera: 1, zona_id: null });
    const avisos = async (id: string) =>
      Number(
        (
          await e.m.DB.prepare(
            `SELECT COUNT(*) AS n FROM camila_mensajes m JOIN camila_personas p ON p.id = m.persona_id
              WHERE p.usuario_id = ? AND m.autor = 'camila' AND m.texto LIKE '%abrimos Divoox en Maracaibo%'`,
          )
            .bind(id)
            .first<{ n: number }>()
        )?.n ?? 0,
      );
    expect(await avisos(cond.id)).toBe(1);
    const otra = await e.m.llamar(
      'POST',
      '/datos/admin/zonas/VE-ZUL-MARACAIBO/pasar-espera',
      {},
      e.admin.token,
    );
    expect(otra.datos).toMatchObject({ pasaron: 0 });
    expect(await avisos(cond.id)).toBe(1);
    // Ya con su zona, se conecta como cualquiera (no recibe el mensaje de espera).
    const l = await e.m.llamar('GET', '/datos/cuentas/lugar', undefined, cond.token);
    expect(l.datos).toMatchObject({ enEspera: false, zona: { id: 'VE-ZUL-MARACAIBO' } });
  });

  it('quien pasa entra al circuito de «lo que te falta» aunque su cuenta tenga meses; esperando, no', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const c = await registrar(e.m, 'repartidor', MARACAIBO);
    // Se registró hace 90 días (fuera de la ventana de 30 días de los recordatorios).
    await e.m.DB.prepare("UPDATE usuarios SET creado_en = datetime('now', '-90 days') WHERE id = ?")
      .bind(c.id)
      .run();
    const ajustes = { ...AJUSTES_REZAGADOS_DE_FABRICA, horaDesde: 0, horaHasta: 24 };
    const env = e.m.extra as never;
    const zona = 'VE-ZUL-MARACAIBO';
    expect((await candidatos(env, e.m.DB, ajustes, [zona])).map((x) => x.id)).not.toContain(c.id);
    const abrir = await e.m.llamar(
      'PUT',
      '/datos/admin/zonas',
      {
        id: zona,
        nombre: 'Maracaibo',
        pais: 'VE',
        lat: 10.6427,
        lng: -71.6125,
        radioKm: 20,
        activa: true,
      },
      e.admin.token,
    );
    expect(abrir.datos.espera).toMatchObject({ pasaron: 1 });
    const dentroDeUnDia = new Date(Date.now() + 26 * 3_600_000);
    expect(
      (await candidatos(env, e.m.DB, ajustes, [zona], dentroDeUnDia)).map((x) => x.id),
    ).toContain(c.id);
  });

  it('una cuenta vieja «Sin zona» (sin lugar) se recupera: la app pone su lugar, o lo pone el equipo', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const vieja = await registrar(e.m, 'repartidor', undefined);
    expect(
      (await e.m.llamar('GET', '/datos/cuentas/lugar', undefined, vieja.token)).datos,
    ).toMatchObject({
      lugar: null,
      enEspera: false,
    });
    const puesta = await e.m.llamar(
      'PUT',
      '/datos/cuentas/lugar',
      { lugar: MARACAIBO },
      vieja.token,
    );
    expect(puesta.estado).toBe(200);
    expect(puesta.datos).toMatchObject({ enEspera: true, zona: null });
    const otra = await registrar(e.m, 'repartidor', undefined);
    const equipo = await e.m.llamar(
      'PUT',
      `/datos/admin/usuarios/${otra.id}/lugar`,
      { lugar: EL_VIGIA_LUGAR, motivo: 'Vive en El Vigía (lo dijo por correo)' },
      e.admin.token,
    );
    expect(equipo.estado).toBe(200);
    expect(equipo.datos).toMatchObject({ enEspera: false, zona: { id: EL_VIGIA.id } });
    expect(
      await e.m.DB.prepare(
        "SELECT 1 FROM auditoria_admin WHERE accion = 'usuario.lugar' AND objeto = ?",
      )
        .bind(`usuario:${otra.id}`)
        .first(),
    ).toBeTruthy();
    // Un lugar fuera del catálogo se rechaza con su motivo (nunca «ciudad no disponible»).
    const mala = await e.m.llamar(
      'PUT',
      '/datos/cuentas/lugar',
      { lugar: { pais: 'VE' } },
      vieja.token,
    );
    expect(mala.estado).toBe(422);
  });

  it('el conductor ya aprobado no se muda de país con su lugar; conectado no cambia de ciudad', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const c = await registrar(e.m, 'repartidor', EL_VIGIA_LUGAR);
    await e.m.DB.prepare(
      "INSERT INTO kyc (usuario_id, estado) VALUES (?, 'aprobado') ON CONFLICT(usuario_id) DO UPDATE SET estado = 'aprobado'",
    )
      .bind(c.id)
      .run();
    const r = await e.m.llamar('PUT', '/datos/cuentas/lugar', { lugar: GILROY }, c.token);
    expect(r.estado).toBe(409);
    await e.m.DB.prepare('UPDATE repartidores SET conectado = 1 WHERE usuario_id = ?')
      .bind(c.id)
      .run();
    const r2 = await e.m.llamar('PUT', '/datos/cuentas/lugar', { lugar: MARACAIBO }, c.token);
    expect(r2.estado).toBe(409);
    expect(r2.datos.error).toMatch(/Go offline/);
  });
});

function conConteo(host = 'staging.tumbite.com') {
  let cuenta: CuentaFilas = { leidas: 0, escritas: 0 };
  const m = mundo(
    { STRIPE_SECRET_KEY: 'sk_test_x' },
    {
      host,
      envolver: (db) => {
        const r = contarFilas(db);
        cuenta = r.cuenta;
        return r.db;
      },
    },
  );
  return {
    m,
    medir: () => {
      const antes = { ...cuenta };
      return () => cuenta.escritas - antes.escritas;
    },
  };
}

describe('C-REGISTRO-TODO-EL-PAIS · (d) presupuesto de escrituras', () => {
  it('un registro con lugar escribe dentro de su tope (y casi lo mismo que sin lugar)', async () => {
    const { m, medir } = conConteo();
    await registrar(m, 'repartidor', undefined); // la primera llamada migra el esquema
    const sin = medir();
    await registrar(m, 'repartidor', undefined);
    const filasSin = sin();
    const con = medir();
    await registrar(m, 'repartidor', MARACAIBO);
    const filasCon = con();
    expect(filasCon).toBeLessThanOrEqual(PRESUPUESTO_REGISTRO_CON_LUGAR);
    // El lugar va en la MISMA fila de la cuenta: solo suman sus índices parciales (tres como mucho).
    expect(filasCon - filasSin).toBeLessThanOrEqual(4);
  });

  it('el paso de los que esperan escribe dentro de su tope y revisa de a un lote', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const { m } = { m: e.m };
    for (let i = 0; i < LOTE_ESPERA + 3; i++)
      await registrar(m, i % 2 ? 'cliente' : 'repartidor', MARACAIBO);
    await m.DB.prepare(
      `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
       VALUES ('VE-ZUL-MARACAIBO', 'Maracaibo', 'VE', 'USD', 'America/Caracas', 10.6427, -71.6125, 20, 1)`,
    ).run();
    const medida = contarFilas(m.DB);
    const env = { ...m.extra } as never;
    const r = await pasarEspera(env, medida.db, 'VE-ZUL-MARACAIBO', { produccion: false });
    expect(r).toMatchObject({ pasaron: LOTE_ESPERA, quedan: 3 });
    expect(r.siguiente).toBeTruthy();
    expect(medida.cuenta.escritas).toBeLessThanOrEqual(PRESUPUESTO_PASO_ESPERA);
    const resto = await pasarEspera(env, m.DB, 'VE-ZUL-MARACAIBO', {
      produccion: false,
      desde: r.siguiente,
    });
    expect(resto).toMatchObject({ pasaron: 3, quedan: 0, siguiente: null });
  });
});

describe('C-REGISTRO-TODO-EL-PAIS · (e) las cuentas de prueba y de revisión no se tocan', () => {
  it('una cuenta de prueba, una nuestra y la zona de revisión: nadie pasa', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const prueba = await registrar(e.m, 'repartidor', MARACAIBO);
    await e.m.DB.prepare('UPDATE usuarios SET es_prueba = 1 WHERE id = ?').bind(prueba.id).run();
    const nuestra = await registrar(e.m, 'repartidor', MARACAIBO, { nombre: 'Soporte Divoox' });
    const abrir = await e.m.llamar(
      'PUT',
      '/datos/admin/zonas',
      {
        id: 'VE-ZUL-MARACAIBO',
        nombre: 'Maracaibo',
        pais: 'VE',
        lat: 10.6427,
        lng: -71.6125,
        radioKm: 20,
        activa: true,
      },
      e.admin.token,
    );
    expect(abrir.datos.espera).toMatchObject({ pasaron: 0 });
    // Tampoco se cuentan en la lista de espera (a propósito: quedan en espera para siempre).
    const lista = await e.m.llamar('GET', '/datos/admin/espera-ciudades', undefined, e.admin.token);
    expect(lista.datos.total).toBe(0);
    expect(await fila(e.m, prueba.id)).toMatchObject({ lugar_espera: 1, zona_id: null });
    expect(await fila(e.m, nuestra.id)).toMatchObject({ lugar_espera: 1, zona_id: null });
    const rev = await pasarEspera({} as never, e.m.DB, 'VE-ZZ-REVIEW', { produccion: false });
    expect(rev.pasaron).toBe(0);
  });
});

// ───────────── Arreglos del revisor de calidad (25-26 nov 2026), vistos en ROJO antes de arreglar ─────────────

const ZONA_MARACAIBO = `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
  VALUES ('VE-ZUL-MARACAIBO', 'Maracaibo', 'VE', 'USD', 'America/Caracas', 10.6427, -71.6125, 20, 1)`;

const avisosDe = async (m: M, id: string) =>
  Number(
    (
      await m.DB.prepare(
        `SELECT COUNT(*) AS n FROM camila_mensajes x JOIN camila_personas p ON p.id = x.persona_id
          WHERE p.usuario_id = ? AND x.autor = 'camila' AND x.texto LIKE '%Maracaibo%'`,
      )
        .bind(id)
        .first<{ n: number }>()
    )?.n ?? 0,
  );

/** Dentro de la caja de la zona de Maracaibo (20 km) pero fuera de su círculo: la esquina. */
const ESQUINA: LugarCuenta = {
  ...MARACAIBO,
  ciudad: 'Esquina de prueba',
  lugarId: 'gn:9000001',
  lat: 10.7927,
  lng: -71.4625,
};

describe('C-REGISTRO-TODO-EL-PAIS · (f) un fallo con un conductor no frena el lote ni lo deja a medias', () => {
  it('falla la asignación del segundo: el primero y el tercero pasan y se les avisa una vez; el segundo sigue en espera y pasa al reintentar', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const tres = [];
    for (let i = 0; i < 3; i++) tres.push((await registrar(e.m, 'repartidor', MARACAIBO)).id);
    const orden = (
      await e.m.DB.prepare(`SELECT id FROM usuarios WHERE id IN (?, ?, ?) ORDER BY id`)
        .bind(...tres)
        .all<{ id: string }>()
    ).results.map((x) => x.id);
    const [uno, dos, tresId] = orden as [string, string, string];
    await e.m.DB.prepare(ZONA_MARACAIBO).run();
    // La ficha del segundo no se puede escribir (como un fallo de la base a mitad del paso).
    for (const ev of ['INSERT', 'UPDATE'])
      await e.m.DB.prepare(
        `CREATE TRIGGER falla_${ev.toLowerCase()} BEFORE ${ev} ON repartidores WHEN NEW.usuario_id = '${dos}'
           BEGIN SELECT RAISE(ABORT, 'falla de prueba'); END`,
      ).run();
    const env = e.m.extra as never;
    const r = await pasarEsperaAlAbrir(env, e.m.DB, 'VE-ZUL-MARACAIBO', false);
    expect(r).toMatchObject({ pasaron: 2, conductores: 2, fallaron: 1 });
    expect(await fila(e.m, uno)).toMatchObject({ zona_id: 'VE-ZUL-MARACAIBO', lugar_espera: null });
    expect(await fila(e.m, tresId)).toMatchObject({
      zona_id: 'VE-ZUL-MARACAIBO',
      lugar_espera: null,
    });
    // El que falló NO queda a medias: sin zona en la cuenta y todavía en espera (se reintenta).
    expect(await fila(e.m, dos)).toMatchObject({ zona_id: null, lugar_espera: 1 });
    expect(await avisosDe(e.m, uno)).toBe(1);
    expect(await avisosDe(e.m, tresId)).toBe(1);
    expect(await avisosDe(e.m, dos)).toBe(0);
    // El fallo queda a la vista: registro de errores y canario en rojo.
    expect(
      await e.m.DB.prepare("SELECT 1 FROM errores_servidor WHERE metodo = 'ESPERA'").first(),
    ).toBeTruthy();
    expect((await saludEspera(e.m.DB)).estado).toBe('error');
    for (const ev of ['insert', 'update']) await e.m.DB.prepare(`DROP TRIGGER falla_${ev}`).run();
    const otra = await pasarEsperaAlAbrir(env, e.m.DB, 'VE-ZUL-MARACAIBO', false);
    expect(otra).toMatchObject({ pasaron: 1, fallaron: 0 });
    const f = await fila(e.m, dos);
    expect(f).toMatchObject({
      zona_id: 'VE-ZUL-MARACAIBO',
      rz: 'VE-ZUL-MARACAIBO',
      lugar_espera: null,
    });
    expect(String(f?.codigo)).toMatch(/^VE-[A-Z]{3}-\d{6}$/);
    expect(await avisosDe(e.m, uno)).toBe(1);
    expect(await avisosDe(e.m, dos)).toBe(1);
    expect((await saludEspera(e.m.DB)).estado).toBe('ok');
  });
});

describe('C-REGISTRO-TODO-EL-PAIS · (g) al abrir, varios lotes con su cursor y un tope fijo', () => {
  it('con 110 en la caja (30 fuera del círculo): al abrir revisa 100, el resto queda para «Seguir», y todos los de dentro pasan', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const dentro: string[] = [];
    const fuera: string[] = [];
    for (let i = 0; i < 30; i++) fuera.push((await registrar(e.m, 'cliente', ESQUINA)).id);
    for (let i = 0; i < 80; i++)
      dentro.push((await registrar(e.m, i % 2 ? 'cliente' : 'repartidor', MARACAIBO)).id);
    await e.m.DB.prepare(ZONA_MARACAIBO).run();
    const medida = contarFilas(e.m.DB);
    const env = e.m.extra as never;
    const r = await pasarEsperaAlAbrir(env, medida.db, 'VE-ZUL-MARACAIBO', false);
    expect(r).toMatchObject({ revisados: 100, quedan: 10 });
    expect(r?.siguiente).toBeTruthy();
    expect(r?.pasaron).toBeGreaterThanOrEqual(70);
    // Medido el 26 nov: 413 filas con 76 que pasaron de 100 revisadas (ver CANDADOS.md).
    expect(medida.cuenta.escritas).toBeLessThanOrEqual(PRESUPUESTO_PASO_AL_ABRIR);
    expect((await saludEspera(e.m.DB)).ultimoPaso).toMatchObject({ quedan: 10 });
    // «Seguir» desde el panel: sigue donde quedó y termina.
    const seguir = await e.m.llamar(
      'POST',
      '/datos/admin/zonas/VE-ZUL-MARACAIBO/pasar-espera',
      { desde: r?.siguiente },
      e.admin.token,
    );
    expect(seguir.estado).toBe(200);
    expect(seguir.datos).toMatchObject({ quedan: 0, siguiente: null });
    expect((r?.pasaron ?? 0) + Number(seguir.datos.pasaron)).toBe(80);
    for (const id of dentro) expect((await fila(e.m, id))?.lugar_espera).toBeNull();
    for (const id of fuera) expect((await fila(e.m, id))?.lugar_espera).toBe(1);
  }, 120_000);
});

describe('C-REGISTRO-TODO-EL-PAIS · (h) la ubicación no le da una zona de otro país a quien dijo dónde vive', () => {
  it('vive en Maracaibo y su GPS cae en una zona de EE. UU.: sigue en espera, sin zona ajena', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    await e.m.DB.prepare(
      `INSERT INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
       VALUES ('US-CA-GILROY', 'Gilroy', 'US', 'USD', 'America/Los_Angeles', 37.0058, -121.5683, 20, 1)`,
    ).run();
    const c = await registrar(e.m, 'repartidor', MARACAIBO);
    const por = await e.m.llamar(
      'POST',
      '/datos/conductor/zona-por-ubicacion',
      { lat: GILROY.lat, lng: GILROY.lng },
      c.token,
    );
    expect(por.datos.cambio).toBe(false);
    const con = await e.m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: GILROY.lat, lng: GILROY.lng },
      c.token,
    );
    expect(con.estado).toBe(409);
    expect(con.datos.codigo).toBe('en_espera_ciudad');
    expect(await fila(e.m, c.id)).toMatchObject({ zona_id: null, lugar_espera: 1 });
    // De su país sí: su GPS en El Vigía (zona abierta de Venezuela) le da esa zona, como siempre.
    const ve = await registrar(e.m, 'repartidor', MARACAIBO);
    const aqui = await e.m.llamar(
      'POST',
      '/datos/conductor/zona-por-ubicacion',
      { lat: EL_VIGIA_LUGAR.lat, lng: EL_VIGIA_LUGAR.lng },
      ve.token,
    );
    expect(aqui.datos).toMatchObject({ cambio: true });
    expect(await fila(e.m, ve.id)).toMatchObject({ zona_id: EL_VIGIA.id, lugar_espera: null });
  });
});

describe('C-REGISTRO-TODO-EL-PAIS · (i) «Pasar a los que esperan» lee su cuerpo de verdad', () => {
  it('sin cuerpo se acepta; un «desde» mal formado responde 422', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    await e.m.DB.prepare(ZONA_MARACAIBO).run();
    const url = '/datos/admin/zonas/VE-ZUL-MARACAIBO/pasar-espera';
    expect((await e.m.llamar('POST', url, undefined, e.admin.token)).estado).toBe(200);
    expect((await e.m.llamar('POST', url, {}, e.admin.token)).estado).toBe(200);
    expect((await e.m.llamar('POST', url, { desde: null }, e.admin.token)).estado).toBe(200);
    expect((await e.m.llamar('POST', url, { desde: 25 }, e.admin.token)).estado).toBe(422);
    expect((await e.m.llamar('POST', url, { desde: "x' OR 1=1 --" }, e.admin.token)).estado).toBe(
      422,
    );
    expect((await e.m.llamar('POST', url, ['raro'], e.admin.token)).estado).toBe(422);
  });
});

describe('C-REGISTRO-TODO-EL-PAIS · (j) un lugar con coordenadas falsas no entra', () => {
  it('Maracaibo con el punto de Miami: el registro lo ignora y el cambio de lugar responde 422', async () => {
    const m = mundo();
    const falso = { ...MARACAIBO, lat: 25.7617, lng: -80.1918 };
    const c = await registrar(m, 'repartidor', falso);
    expect(c.r.estado).toBe(201);
    expect(await fila(m, c.id)).toMatchObject({ lugar_id: null, lugar_espera: null });
    const r = await m.llamar('PUT', '/datos/cuentas/lugar', { lugar: falso }, c.token);
    expect(r.estado).toBe(422);
    // El de verdad sí.
    const bien = await m.llamar('PUT', '/datos/cuentas/lugar', { lugar: MARACAIBO }, c.token);
    expect(bien.estado).toBe(200);
  });
});

describe('C-REGISTRO-TODO-EL-PAIS · (k) borrar la cuenta borra dónde vivía', () => {
  it('las columnas del lugar quedan vacías', async () => {
    const m = mundo();
    const c = await registrar(m, 'repartidor', MARACAIBO);
    expect((await m.llamar('DELETE', '/datos/cuentas/yo', undefined, c.token)).estado).toBe(200);
    const f = await m.DB.prepare(
      `SELECT lugar_pais, lugar_estado, lugar_municipio, lugar_ciudad, lugar_id, lugar_lat, lugar_lng,
              lugar_en, lugar_espera, lugar_paso_en FROM usuarios WHERE id = ?`,
    )
      .bind(c.id)
      .first<Record<string, unknown>>();
    expect(Object.values(f ?? { x: 1 }).every((v) => v === null)).toBe(true);
  });
});

describe('C-REGISTRO-TODO-EL-PAIS · (l) a quien espera no se le promete trabajar hoy', () => {
  /**
   * Comprobado en ROJO (26 nov): sin el filtro de `FALTAS_EN_ESPERA` le salían lo de recibir carreras
   * hoy (aprobación, servicio de la ciudad por defecto…) y sin el `enEspera` de la barra el WhatsApp
   * de «para que tu cuenta empiece a recibir carreras te falta…» se armaba igual.
   */
  it('que-te-falta dice `enEspera` y solo lo de su registro; la barra y el WhatsApp no le prometen viajes', async () => {
    const m = mundo();
    const c = await registrar(m, 'repartidor', MARACAIBO);
    // Con su ficha de conductor ya creada (la de la ciudad por defecto de la tabla, que no es su zona).
    await m.DB.prepare('INSERT INTO repartidores (usuario_id) VALUES (?)').bind(c.id).run();
    const sin = await m.llamar('GET', '/datos/conductor/que-te-falta', undefined, c.token);
    expect(sin.estado).toBe(200);
    const q = sin;
    expect(q.estado).toBe(200);
    expect(q.datos.enEspera).toBe(true);
    expect(q.datos.recibeViajes).toBe(false);
    const claves = (q.datos.faltas as { clave: string }[]).map((x) => x.clave);
    expect(claves).toContain('sin_vehiculo');
    for (const operativa of [
      'servicio_no_disponible',
      'sin_habilitacion',
      'sin_servicio_encendido',
      'sin_saldo',
      'sin_pago_movil',
      'sin_restaurantes',
      'ubicacion_vieja',
      'desconectado',
    ])
      expect(claves, operativa).not.toContain(operativa);
    const barra = await barraActivacion(m.DB, c.id);
    expect(barra.enEspera).toBe(true);
    expect(faltaDeBarra(barra, { pais: 'VE', appVieja: false })).toBeNull();
  });

  it('quien ya tiene su ciudad abierta sigue igual: `enEspera` en falso y su WhatsApp se arma', async () => {
    const e = await escenarioVe();
    expect((await abrirComida(e)).estado).toBe(201);
    const c = await registrar(e.m, 'repartidor', EL_VIGIA_LUGAR);
    const q = await e.m.llamar('GET', '/datos/conductor/que-te-falta', undefined, c.token);
    expect(q.datos.enEspera).toBe(false);
    const barra = await barraActivacion(e.m.DB, c.id);
    expect(barra.enEspera).toBe(false);
    expect(faltaDeBarra(barra, { pais: 'VE', appVieja: false })).not.toBeNull();
  });
});
