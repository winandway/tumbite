import { afterEach, describe, expect, it } from 'vitest';
import { mundo } from './pruebas/ayuda';
import { conductorDeMoto } from './pruebas/conductorMoto';
import { contarFilas } from './presupuestoFilas';
import { metrosEntre, ordenarLinea } from './fichaOperacion';
import { TOPE_ANONIMO_DIA, plataformaDe, reiniciarTopeAnonimo } from './rastro';

/**
 * C-RASTRO (22 nov 2026, Richard) — todos los países. El rastro de actividad: de dónde vino el alta,
 * cada paso del registro y dónde lo dejó, la línea de tiempo del viaje con lugar, tiempo y distancia,
 * el embudo (solo cuentas reales) y el presupuesto de escrituras de un alta y de un viaje típico.
 */
afterEach(() => reiniciarTopeAnonimo());

const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
const DESTINO = { lat: 25.79, lng: -80.13, direccion: 'Destino del viaje' };
const APP_ANDROID = {
  'x-tumbite-app': 'repartidor/0.9.4 android',
  'cf-ipcountry': 'VE',
  'user-agent': 'okhttp/4.12.0',
};

async function registrar(
  m: ReturnType<typeof mundo>,
  rol: 'cliente' | 'repartidor',
  cabeceras: Record<string, string> = {},
) {
  const r = await m.llamar(
    'POST',
    '/datos/cuentas/registro',
    {
      nombre: 'Persona de Ejemplo',
      correo: `persona-${Math.random().toString(36).slice(2)}@ejemplo.com`,
      clave: 'clave-segura-1',
      rol,
    },
    undefined,
    cabeceras,
  );
  expect(r.estado).toBe(201);
  return { id: r.datos.usuario.id as string, token: r.datos.token as string };
}

type Actores = {
  cliente: { id: string; token: string };
  cond: Awaited<ReturnType<typeof conductorDeMoto>>;
};

async function escenarioViaje(m: ReturnType<typeof mundo>) {
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajera de Ejemplo');
  for (const r of [
    '/datos/admin/servicios/carro',
    '/datos/admin/servicios/carro/zonas/US-FL-MIAMI',
  ])
    await m.llamar('PUT', r, { estado: 'disponible' }, admin.token);
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    {
      servicio: 'carro',
      zona: 'US-FL-MIAMI',
      tarifa: { base: 300, porKm: 120, porMinuto: 25, minimo: 800 },
      motivo: 'Tarifa de prueba',
    },
    admin.token,
  );
  const cond = await conductorDeMoto(m, ORIGEN, 'US-FL-MIAMI', 'carro');
  return { admin, cliente, cond };
}

const mover = (m: ReturnType<typeof mundo>, id: string, a: { lat: number; lng: number }) =>
  m.DB.prepare(
    "UPDATE repartidores SET lat = ?, lng = ?, ubicacion_en = datetime('now') WHERE usuario_id = ?",
  )
    .bind(a.lat, a.lng, id)
    .run();

async function hacerViaje(m: ReturnType<typeof mundo>, { cliente, cond }: Actores) {
  await mover(m, cond.id, ORIGEN);
  const cot = (
    await m.llamar(
      'POST',
      '/datos/viajes/cotizar',
      { servicio: 'carro', origen: ORIGEN, destino: DESTINO },
      cliente.token,
    )
  ).datos.cotizacion as { id: string };
  const id = (
    await m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: cot.id, metodoPago: 'efectivo' },
      cliente.token,
    )
  ).datos.viaje.id as string;
  await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token);
  expect(await cond.paso(id, 'aceptar')).toBe(200);
  expect(await cond.paso(id, 'llegue')).toBe(200);
  const pin = (await m.llamar('GET', '/datos/viajes/actual', undefined, cliente.token)).datos.viaje
    .pin;
  // El conductor se movió hasta el destino antes de terminar.
  await mover(m, cond.id, DESTINO);
  expect(await cond.paso(id, 'iniciar', { pin })).toBe(200);
  expect(await cond.paso(id, 'terminar')).toBe(200);
  return id;
}

/** Cuántas filas hay en cada tabla del rastro y en el registro de estados del viaje. */
async function filas(m: ReturnType<typeof mundo>) {
  const r: Record<string, number> = {};
  for (const t of ['rastro_cuenta', 'embudo_cuenta', 'embudo_anonimo', 'eventos_operacion'])
    r[t] = (await m.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first<{ n: number }>())?.n ?? 0;
  return r;
}

describe('C-RASTRO · de dónde vino el alta y dónde lo dejó', () => {
  it('la plataforma se lee de lo que manda la app o, si no, del aparato', () => {
    expect(plataformaDe('repartidor/0.9.4 android', undefined)).toBe('android');
    expect(plataformaDe('cliente/1.0.0', 'okhttp/4.12.0')).toBe('android');
    expect(plataformaDe('cliente/1.0.0', 'Divoox/59 CFNetwork/1490 Darwin/23.2.0')).toBe('ios');
    expect(plataformaDe(undefined, 'Mozilla/5.0 (Linux; Android 14) Chrome/120')).toBe(
      'web (android)',
    );
    expect(plataformaDe(undefined, 'Mozilla/5.0 (Macintosh) Safari/605')).toBe('web');
    expect(plataformaDe(undefined, undefined)).toBeNull();
  });

  it('el alta guarda app, versión, plataforma y país de la red, sin la dirección IP; la entrada también', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const u = await registrar(m, 'repartidor', APP_ANDROID);
    const filas = await m.DB.prepare('SELECT * FROM rastro_cuenta WHERE usuario_id = ?')
      .bind(u.id)
      .all();
    expect(filas.results).toHaveLength(1);
    expect(filas.results[0]).toMatchObject({
      tipo: 'alta',
      app: 'repartidor',
      version: '0.9.4',
      plataforma: 'android',
      pais_red: 'VE',
    });
    // Ninguna columna guarda una dirección IP.
    expect(JSON.stringify(filas.results[0])).not.toMatch(/\b10\.\d+\.\d+\.\d+\b/);
    const r = await m.llamar(
      'GET',
      `/datos/admin/repartidores/${u.id}/actividad`,
      undefined,
      admin.token,
    );
    expect(r.estado).toBe(200);
    expect(r.datos.actividad.alta).toMatchObject({
      app: 'repartidor',
      version: '0.9.4',
      plataforma: 'android',
      pais: 'VE',
      conOrigen: true,
    });
    // C-CORREO-NO-FRENA: el correo por confirmar no es «lo que le falta»: va aparte, al final.
    expect(r.datos.actividad.dondeQuedo).toMatchObject({
      ultimo: 'cuenta',
      sigue: 'aviso_ia',
      correoPorConfirmar: true,
    });
    expect(r.datos.actividad.dondeQuedo.falta).not.toContain('correo');
    const correo = (r.datos.actividad.dondeQuedo.pasos as { paso: string; nota: string }[]).at(-1);
    expect(correo).toMatchObject({ paso: 'correo', estado: 'pendiente', nota: 'no_frena' });
  });

  it('cada paso queda una sola vez, lo provoque quien lo provoque, y la ficha dice cuál sigue', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const u = await registrar(m, 'repartidor', APP_ANDROID);
    await m.confirmarCorreo(u.id);
    await m.confirmarCorreo(u.id);
    await m.DB.prepare(
      "INSERT INTO kyc (usuario_id, estado, doc_tipo, enviado_en) VALUES (?, 'pendiente', 'licencia', datetime('now'))",
    )
      .bind(u.id)
      .run();
    await m.DB.prepare(
      "UPDATE kyc SET estado = 'aprobado', revisado_en = datetime('now'), revisado_por = ? WHERE usuario_id = ?",
    )
      .bind(admin.id, u.id)
      .run();
    const pasos = await m.DB.prepare(
      'SELECT paso, pais FROM embudo_cuenta WHERE usuario_id = ? ORDER BY paso',
    )
      .bind(u.id)
      .all<{ paso: string; pais: string | null }>();
    // C-RASTRO-FUENTES: lo que el equipo aprobó deja hechas también la cara y el documento.
    expect(pasos.results.map((p) => p.paso)).toEqual([
      'aprobado',
      'correo',
      'cuenta',
      'enviado',
      'foto_cara',
      'foto_documento',
    ]);
    // Los pasos que anota la base heredan el país del alta.
    expect(new Set(pasos.results.map((p) => p.pais))).toEqual(new Set(['VE']));
    const a = (
      await m.llamar('GET', `/datos/admin/repartidores/${u.id}/actividad`, undefined, admin.token)
    ).datos.actividad;
    // C-CORREO-NO-FRENA: el correo va al final de los pasos.
    expect(a.dondeQuedo.hechos).toEqual([
      'cuenta',
      'foto_cara',
      'foto_documento',
      'enviado',
      'aprobado',
      'correo',
    ]);
    expect(a.dondeQuedo.correoPorConfirmar).toBe(false);
    // El teléfono y el aviso no le tocan a quien ya pasó la verificación: no salen como pendientes.
    expect(a.dondeQuedo.sigue).toBe('foto_licencia');
    expect(a.linea.map((p: { evento: string }) => p.evento)).toEqual(
      expect.arrayContaining(['alta', 'correo', 'enviado', 'verificacion_aprobado']),
    );
  });

  it('la actividad es solo del equipo y mirarla no escribe nada', async () => {
    let conteo!: ReturnType<typeof contarFilas>;
    const m = mundo({}, { envolver: (db) => (conteo = contarFilas(db)).db });
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const u = await registrar(m, 'cliente');
    expect((await m.llamar('GET', `/datos/admin/clientes/${u.id}/actividad`)).estado).toBe(401);
    expect(
      (await m.llamar('GET', `/datos/admin/clientes/${u.id}/actividad`, undefined, u.token)).estado,
    ).toBe(403);
    expect((await m.llamar('GET', '/datos/admin/embudo', undefined, u.token)).estado).toBe(403);
    await m.sesionLista(admin.token);
    const antes = conteo.cuenta.escritas;
    expect(
      (await m.llamar('GET', `/datos/admin/clientes/${u.id}/actividad`, undefined, admin.token))
        .estado,
    ).toBe(200);
    expect((await m.llamar('GET', '/datos/admin/embudo', undefined, admin.token)).estado).toBe(200);
    expect(conteo.cuenta.escritas - antes, 'mirar no escribe').toBe(0);
  });

  it('al borrar la cuenta se va su rastro', async () => {
    const m = mundo();
    const u = await registrar(m, 'cliente', { 'cf-ipcountry': 'VE' });
    const r = await m.llamar('DELETE', '/datos/cuentas/yo', { clave: 'clave-segura-1' }, u.token);
    expect(r.estado).toBe(200);
    for (const t of ['rastro_cuenta', 'embudo_cuenta'])
      expect(
        (
          await m.DB.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE usuario_id = ?`)
            .bind(u.id)
            .first<{ n: number }>()
        )?.n,
      ).toBe(0);
  });
});

describe('C-RASTRO · el viaje y su presupuesto', () => {
  it('la línea de tiempo del viaje trae lugar, minutos, metros y motivo', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    const e = await escenarioViaje(m);
    const id = await hacerViaje(m, e);
    const ficha = (await m.llamar('GET', `/datos/admin/viajes/${id}`, undefined, e.admin.token))
      .datos.viaje;
    const linea = ficha.linea as {
      evento: string;
      lugar: { lat: number; lng: number } | null;
      desdeAnteriorS: number | null;
      desdeAnteriorM: number | null;
    }[];
    const de = (ev: string) => linea.find((p) => p.evento === ev)!;
    expect(de('asignado').lugar).toEqual({ lat: ORIGEN.lat, lng: ORIGEN.lng });
    expect(de('terminado').lugar).toEqual({ lat: DESTINO.lat, lng: DESTINO.lng });
    expect(de('terminado').desdeAnteriorS).not.toBeNull();
    // Del punto de recogida al destino hay unos 6,9 km en línea recta.
    const total = linea.reduce((n, p) => n + (p.desdeAnteriorM ?? 0), 0);
    expect(total).toBe(metrosEntre(ORIGEN, DESTINO));
    expect(total).toBeGreaterThan(6000);
  });

  it('presupuesto: un viaje típico no escribe NADA de más por el rastro; el primero, dos filas', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    const e = await escenarioViaje(m);
    const antes = await filas(m);
    const id1 = await hacerViaje(m, e);
    const tras1 = await filas(m);
    // El primer viaje de cada persona deja su paso «primer_viaje» (pasajero y conductor): dos filas.
    expect(tras1.embudo_cuenta! - antes.embudo_cuenta!).toBe(2);
    expect(tras1.rastro_cuenta! - antes.rastro_cuenta!).toBe(0);
    // La posición del conductor viaja en el mismo renglón de cada cambio de estado: ni uno más.
    const cambios = (
      await m.DB.prepare(
        "SELECT COUNT(*) AS n FROM eventos_operacion WHERE operacion_id = ? AND tipo = 'transicion'",
      )
        .bind(id1)
        .first<{ n: number }>()
    )?.n;
    expect(tras1.eventos_operacion! - antes.eventos_operacion!).toBe(cambios);
    // El viaje típico (quien ya viajó): CERO filas nuevas del rastro.
    await hacerViaje(m, e);
    const tras2 = await filas(m);
    expect(tras2.embudo_cuenta! - tras1.embudo_cuenta!).toBe(0);
    expect(tras2.rastro_cuenta! - tras1.rastro_cuenta!).toBe(0);
    expect(tras2.embudo_anonimo! - tras1.embudo_anonimo!).toBe(0);
    expect(tras2.eventos_operacion! - tras1.eventos_operacion!).toBe(cambios);
  });

  it('las distancias se suman solo entre pasos que tienen lugar', () => {
    const l = ordenarLinea([
      {
        tipo: 'estado',
        evento: 'a',
        fecha: '2026-11-22 10:00:00',
        quien: null,
        rol: null,
        detalle: null,
        capa: 'principal',
        lugar: { lat: 0, lng: 0.01 },
      },
      {
        tipo: 'estado',
        evento: 'b',
        fecha: '2026-11-22 10:05:00',
        quien: null,
        rol: null,
        detalle: null,
        capa: 'principal',
      },
      {
        tipo: 'estado',
        evento: 'c',
        fecha: '2026-11-22 10:09:00',
        quien: null,
        rol: null,
        detalle: 'motivo',
        capa: 'principal',
        lugar: { lat: 0, lng: 0.02 },
      },
    ]);
    expect(l.map((p) => p.desdeAnteriorS)).toEqual([null, 300, 240]);
    expect(l.map((p) => p.desdeAnteriorM)).toEqual([null, null, 1112]);
  });
});

describe('C-RASTRO · el embudo', () => {
  it('cuenta los pasos de antes de la cuenta sin guardar persona, con tope diario', async () => {
    const m = mundo();
    const paso = (p: string, cab: Record<string, string> = { 'cf-ipcountry': 'VE' }) =>
      m.llamar('POST', '/datos/rastro/paso', { app: 'repartidor', paso: p }, undefined, {
        'x-aparato': 'aparato-de-ejemplo',
        ...cab,
      });
    expect((await paso('abrio')).datos.ok).toBe(true);
    expect((await paso('abrio')).datos.ok).toBe(true);
    expect((await paso('formulario')).datos.ok).toBe(true);
    // Un paso que no es de antes de la cuenta no se acepta desde fuera (nadie puede inventar «aprobado»).
    expect((await paso('aprobado')).estado).toBe(400);
    const filas = await m.DB.prepare('SELECT * FROM embudo_anonimo ORDER BY paso').all<
      Record<string, unknown>
    >();
    expect(filas.results.map((f) => [f.paso, f.personas, f.pais, f.app])).toEqual([
      ['abrio', 2, 'VE', 'repartidor'],
      ['formulario', 1, 'VE', 'repartidor'],
    ]);
    expect(JSON.stringify(filas.results)).not.toContain('aparato-de-ejemplo');
    expect(TOPE_ANONIMO_DIA).toBe(3000);
  });

  it('solo cuentas reales, por país y por zona', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const real = await registrar(m, 'repartidor', APP_ANDROID);
    const otra = await registrar(m, 'repartidor', { ...APP_ANDROID, 'cf-ipcountry': 'CO' });
    const prueba = await registrar(m, 'repartidor', APP_ANDROID);
    await m.DB.prepare('UPDATE usuarios SET es_prueba = 1 WHERE id = ?').bind(prueba.id).run();
    await m.DB.prepare("UPDATE usuarios SET zona_id = 'VE-ZONA-EJEMPLO' WHERE id = ?")
      .bind(real.id)
      .run();
    for (const id of [real.id, prueba.id]) await m.confirmarCorreo(id);
    await m.llamar('POST', '/datos/rastro/paso', { app: 'repartidor', paso: 'abrio' }, undefined, {
      'cf-ipcountry': 'VE',
    });
    const ver = async (q = '') =>
      (await m.llamar('GET', `/datos/admin/embudo?app=repartidor${q}`, undefined, admin.token))
        .datos;
    const de = (d: { pasos: { paso: string; personas: number }[] }, p: string) =>
      d.pasos.find((x) => x.paso === p)?.personas;
    const todo = await ver();
    expect(de(todo, 'abrio')).toBe(1);
    expect(de(todo, 'cuenta')).toBe(2); // la de prueba no cuenta
    expect(de(todo, 'correo')).toBe(1);
    // «Se quedaron aquí»: las dos cuentas reales se quedaron en «cuenta» (C-CORREO-NO-FRENA: confirmar
    // el correo no hace avanzar a nadie en el embudo ni lo frena).
    const quedan = (p: string) =>
      (todo.pasos as { paso: string; seQuedan: number | null }[]).find((x) => x.paso === p)
        ?.seQuedan;
    expect(quedan('cuenta')).toBe(2);
    expect(quedan('correo')).toBeNull();
    expect(todo.pasos.at(-1).paso).toBe('correo');
    expect(quedan('telefono')).toBe(0);
    expect(quedan('primer_viaje')).toBeNull();
    expect(todo.porPais).toEqual(
      expect.arrayContaining([
        { pais: 'VE', cuentas: 1 },
        { pais: 'CO', cuentas: 1 },
      ]),
    );
    expect(de(await ver('&pais=CO'), 'cuenta')).toBe(1);
    const zona = await ver('&zona=VE-ZONA-EJEMPLO');
    expect(de(zona, 'cuenta')).toBe(1);
    expect(de(zona, 'abrio')).toBeUndefined();
    expect(otra.id).toBeTruthy();
  });
});

/**
 * C-RASTRO-FUENTES (22 nov 2026, Gerencia) — todos los países. La ficha no se contradice: cada paso del
 * registro se lee de TODAS sus fuentes reales (las dos rutas de fotos, los papeles, lo aprobado por el
 * equipo, la conexión) y las cuentas de antes del rastro se rellenan hacia atrás con su fecha real.
 */
describe('C-RASTRO-FUENTES · un paso aprobado nunca sale pendiente', () => {
  /** Un conductor que entró por la verificación anterior, aprobado por el equipo, de ANTES del rastro. */
  async function conductorDeAntes(m: ReturnType<typeof mundo>) {
    const u = await registrar(m, 'repartidor');
    await m.DB.batch([
      m.DB.prepare(
        `INSERT INTO kyc (usuario_id, estado, doc_tipo, doc_frente, doc_reverso, selfie, enviado_en, revisado_en)
         VALUES (?, 'aprobado', 'licencia', 'kyc/doc-frente', 'kyc/doc-reverso', 'kyc/cara', '2026-11-01 10:00:00', '2026-11-01 12:00:00')
         ON CONFLICT(usuario_id) DO UPDATE SET estado = excluded.estado, doc_tipo = excluded.doc_tipo, doc_frente = excluded.doc_frente,
           selfie = excluded.selfie, enviado_en = excluded.enviado_en, revisado_en = excluded.revisado_en`,
      ).bind(u.id),
      m.DB.prepare(
        `INSERT INTO repartidores (usuario_id, conectado, ubicacion_en) VALUES (?, 1, '2026-11-02 08:00:00')
         ON CONFLICT(usuario_id) DO UPDATE SET conectado = 1, ubicacion_en = excluded.ubicacion_en`,
      ).bind(u.id),
      // Como si todo hubiera pasado antes de que existieran los disparadores: sin un solo paso anotado.
      m.DB.prepare('DELETE FROM embudo_cuenta WHERE usuario_id = ?').bind(u.id),
    ]);
    return u;
  }
  const pasosDeFicha = async (m: ReturnType<typeof mundo>, id: string, token: string) =>
    (await m.llamar('GET', `/datos/admin/repartidores/${id}/actividad`, undefined, token)).datos
      .actividad.dondeQuedo as {
      sigue: string | null;
      hechos: string[];
      falta: string[];
      pasos: {
        paso: string;
        estado: string;
        fuente: string | null;
        nota: string | null;
        fecha: string | null;
        comprobacion: string | null;
      }[];
    };

  it('fotos aprobadas por la verificación anterior → cara, documento, licencia, envío, aprobación y conexión salen «Hecho»', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const u = await conductorDeAntes(m);
    const d = await pasosDeFicha(m, u.id, admin.token);
    const estado = Object.fromEntries(d.pasos.map((p) => [p.paso, p.estado]));
    expect(estado).toMatchObject({
      cuenta: 'hecho',
      foto_cara: 'hecho',
      foto_documento: 'hecho',
      foto_licencia: 'hecho',
      enviado: 'hecho',
      aprobado: 'hecho',
      conectado: 'hecho',
      // Lo que de verdad no hizo sigue pendiente; lo que no le toca no cuenta como pendiente.
      correo: 'pendiente',
      vehiculo: 'pendiente',
      telefono: 'no_aplica',
      aviso_ia: 'no_aplica',
    });
    // C-CORREO-NO-FRENA: el correo sigue pendiente pero no es lo que le falta.
    expect(d.falta).toEqual(['vehiculo', 'primer_viaje']);
    expect(d.sigue).toBe('vehiculo');
    // Dice cómo se sabe: por la verificación anterior, con su fecha real.
    const cara = d.pasos.find((p) => p.paso === 'foto_cara');
    expect(cara).toMatchObject({
      fuente: 'verificacion',
      nota: 'verificacion_anterior',
      fecha: '2026-11-01 10:00:00',
    });
    // Y los pasos van en el orden en que los hace la persona, no los hechos primero. El correo, al
    // final: se confirma en segundo plano (C-CORREO-NO-FRENA).
    expect(d.pasos.map((p) => p.paso)).toEqual([
      'cuenta',
      'telefono',
      'aviso_ia',
      'foto_cara',
      'foto_documento',
      'foto_licencia',
      'vehiculo',
      'enviado',
      'aprobado',
      'conectado',
      'primer_viaje',
      'correo',
    ]);
  });

  it('aprobado por el equipo sin fotos guardadas: la cara, el documento y el envío no salen pendientes', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const u = await registrar(m, 'repartidor');
    await m.DB.prepare(
      `INSERT INTO kyc (usuario_id, estado, revisado_en) VALUES (?, 'aprobado', '2026-11-03 09:00:00')
       ON CONFLICT(usuario_id) DO UPDATE SET estado = 'aprobado', revisado_en = excluded.revisado_en`,
    )
      .bind(u.id)
      .run();
    await m.DB.prepare("DELETE FROM embudo_cuenta WHERE usuario_id = ? AND paso <> 'cuenta'")
      .bind(u.id)
      .run();
    const d = await pasosDeFicha(m, u.id, admin.token);
    for (const p of ['foto_cara', 'foto_documento', 'enviado'])
      expect(d.pasos.find((x) => x.paso === p)).toMatchObject({
        estado: 'hecho',
        fuente: 'equipo',
        nota: 'aprobado_equipo',
      });
    expect(d.pasos.find((x) => x.paso === 'aprobado')?.estado).toBe('hecho');
  });

  it('la foto del asistente dice lo que vio la comprobación automática', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const u = await registrar(m, 'repartidor');
    await m.DB.prepare(
      "INSERT INTO verificacion_fotos (id, conductor_id, paso, clave, ia_color) VALUES ('f-1', ?, 'cara', 'verif/cara', 'amarillo')",
    )
      .bind(u.id)
      .run();
    const cara = (await pasosDeFicha(m, u.id, admin.token)).pasos.find(
      (p) => p.paso === 'foto_cara',
    );
    expect(cara).toMatchObject({ estado: 'hecho', fuente: 'foto', comprobacion: 'amarillo' });
  });

  it('el relleno hacia atrás anota cada paso con su fecha real, una sola vez, y el embudo los cuenta', async () => {
    const m = mundo();
    const u = await conductorDeAntes(m);
    const { rellenarRastro } = await import('./esquemaRastro');
    const escritas = await rellenarRastro(m.DB);
    expect(escritas).toBeGreaterThanOrEqual(7);
    const { results } = await m.DB.prepare(
      'SELECT paso, creado_en FROM embudo_cuenta WHERE usuario_id = ? ORDER BY paso',
    )
      .bind(u.id)
      .all<{ paso: string; creado_en: string }>();
    const fechas = Object.fromEntries(results.map((r) => [r.paso, r.creado_en]));
    expect(Object.keys(fechas).sort()).toEqual(
      [
        'aprobado',
        'conectado',
        'cuenta',
        'enviado',
        'foto_cara',
        'foto_documento',
        'foto_licencia',
      ].sort(),
    );
    expect(fechas).toMatchObject({
      foto_cara: '2026-11-01 10:00:00',
      enviado: '2026-11-01 10:00:00',
      aprobado: '2026-11-01 12:00:00',
      conectado: '2026-11-02 08:00:00',
    });
    // La segunda vez no escribe nada (regla de la nube: solo lo que cambió).
    expect(await rellenarRastro(m.DB)).toBe(0);
  });

  it('quien acepta el aviso DESPUÉS (cambio sobre una fila que ya existía) queda anotado', async () => {
    const m = mundo();
    const u = await registrar(m, 'repartidor');
    await m.DB.prepare('DROP TRIGGER rastro_aviso_ia').run();
    await m.DB.prepare('INSERT INTO verificacion_permiso_ia (conductor_id, acepto) VALUES (?, 0)')
      .bind(u.id)
      .run();
    const anotado = () =>
      m.DB.prepare("SELECT 1 AS si FROM embudo_cuenta WHERE usuario_id = ? AND paso = 'aviso_ia'")
        .bind(u.id)
        .first();
    expect(await anotado()).toBeNull();
    await m.DB.prepare(
      `INSERT INTO verificacion_permiso_ia (conductor_id, acepto) VALUES (?, 1)
       ON CONFLICT(conductor_id) DO UPDATE SET acepto = excluded.acepto`,
    )
      .bind(u.id)
      .run();
    expect(await anotado()).not.toBeNull();
  });

  it('la verificación anterior y los papeles también dejan su paso cuando ocurren', async () => {
    const m = mundo();
    const u = await registrar(m, 'repartidor');
    await m.DB.prepare(
      `INSERT INTO kyc (usuario_id, selfie, doc_frente, doc_tipo) VALUES (?, 'kyc/cara', 'kyc/doc', 'identificacion')
       ON CONFLICT(usuario_id) DO UPDATE SET selfie = excluded.selfie, doc_frente = excluded.doc_frente, doc_tipo = excluded.doc_tipo`,
    )
      .bind(u.id)
      .run();
    await m.DB.prepare(
      "INSERT INTO conductor_documentos (id, conductor_id, tipo, clave) VALUES ('d-1', ?, 'licencia_moto', 'papeles/licencia')",
    )
      .bind(u.id)
      .run();
    const { results } = await m.DB.prepare('SELECT paso FROM embudo_cuenta WHERE usuario_id = ?')
      .bind(u.id)
      .all<{ paso: string }>();
    expect(results.map((r) => r.paso)).toEqual(
      expect.arrayContaining(['foto_cara', 'foto_documento', 'foto_licencia']),
    );
  });

  it('ninguna consulta de las fuentes va unida con UNION (la base de la nube admite muy pocos términos)', async () => {
    const { sqlFuentesDeCuenta, FUENTES_PASO } = await import('./esquemaRastro');
    const consultas = sqlFuentesDeCuenta();
    expect(consultas).toHaveLength(FUENTES_PASO.length);
    for (const q of consultas) expect(q).not.toMatch(/\bUNION\b/i);
    expect(String((await import('./esquemaRastro')).rellenarRastro)).not.toMatch(/UNION/i);
  });
});
