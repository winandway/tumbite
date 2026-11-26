import { describe, expect, it } from 'vitest';
import type { LugarCuenta } from '@tumbite/compartido';
import { contarFilas, type CuentaFilas } from './presupuestoFilas';
import { mundo } from './pruebas/ayuda';
import { EL_VIGIA, abrirComida, escenarioVe } from './pruebas/comidaVe';
import { AJUSTES_REZAGADOS_DE_FABRICA, candidatos } from './rezagados';
import {
  LOTE_ESPERA,
  PRESUPUESTO_PASO_ESPERA,
  PRESUPUESTO_REGISTRO_CON_LUGAR,
  pasarEspera,
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
    expect(await fila(e.m, prueba.id)).toMatchObject({ lugar_espera: 1, zona_id: null });
    expect(await fila(e.m, nuestra.id)).toMatchObject({ lugar_espera: 1, zona_id: null });
    const rev = await pasarEspera({} as never, e.m.DB, 'VE-ZZ-REVIEW', { produccion: false });
    expect(rev.pasaron).toBe(0);
  });
});
