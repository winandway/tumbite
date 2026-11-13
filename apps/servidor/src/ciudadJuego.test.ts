import { describe, expect, it } from 'vitest';
import { app } from './app';
import {
  JUEGO,
  avanzar,
  cifrar,
  claveRobot,
  descifrar,
  desplazar,
  metros,
  tramoPermitido,
} from './ciudadJuego';
import { contarFilas } from './presupuestoFilas';
import { mundo } from './pruebas/ayuda';

/**
 * C-CIUDAD-JUEGO (SIM-7): la ciudad de pruebas en modo juego. Un jugador pide desde la API real
 * del cliente, en efectivo (sin tarjeta), a un restaurante robot; los latidos de la pantalla hacen
 * que el restaurante robot acepte y prepare y que un repartidor robot lo recoja, maneje y lo
 * entregue. Solo en pruebas y en local. Todos los países.
 */
const SECRETO = 'secreto-del-reloj-de-pruebas-largo';

/**
 * Cuántas consultas hace una petición: un Worker tiene un límite de consultas por petición, y
 * encender o latir con varios robots no puede acercarse (tope de esta prueba: 400).
 */
const TOPE_CONSULTAS = 400;
const consultas = { n: 0 };
function contarConsultas(db: D1Database): D1Database {
  return new Proxy(db, {
    get(t, prop) {
      if (prop === 'prepare')
        return (sql: string) => {
          consultas.n++;
          return t.prepare(sql);
        };
      const v = Reflect.get(t, prop) as unknown;
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
    },
  });
}

async function ciudad(host?: string) {
  const m = mundo(
    { RELOJ_SECRETO: SECRETO },
    { ...(host ? { host } : {}), envolver: contarConsultas },
  );
  const admin = await m.cuenta('admin');
  let maxConsultas = 0;
  const post = async (ruta: string, cuerpo: unknown = {}) => {
    consultas.n = 0;
    const r = await m.llamar('POST', `/datos/admin/ciudad-pruebas/${ruta}`, cuerpo, admin.token);
    maxConsultas = Math.max(maxConsultas, consultas.n);
    return r;
  };
  const consultasMax = () => maxConsultas;
  /** Como si pasaran unos segundos: pedidos y lecturas de GPS envejecen (todo pasa en el mismo segundo). */
  const envejecer = async (s = 30) => {
    for (const col of ['pagado_en', 'aceptado_en', 'listo_en'])
      await m.DB.prepare(
        `UPDATE pedidos SET ${col} = datetime(${col}, '-${s} seconds') WHERE ${col} IS NOT NULL`,
      ).run();
    await m.DB.prepare(
      `UPDATE ubicaciones_recientes SET creado_en = datetime(creado_en, '-${s} seconds')`,
    ).run();
    await m.DB.prepare(
      `UPDATE restaurantes SET senal_en = datetime('now') WHERE senal_en IS NOT NULL`,
    ).run();
  };
  /** «Encender» arma un robot por llamada: la pantalla llama hasta que estén todos. */
  const encenderTodo = async () => {
    let r = await post('encender');
    for (let i = 0; i < 10 && r.estado === 200 && r.datos.listos < r.datos.total; i++)
      r = await post('encender');
    return r;
  };
  return { m, admin, post, envejecer, encenderTodo, consultasMax };
}

describe('C-CIUDAD-JUEGO: piezas', () => {
  it('el robot avanza por tramos sin pasar de la velocidad tope y llega exacto', () => {
    const a = { lat: 25.77, lng: -80.19 };
    const b = desplazar(a, 1_000, 0);
    expect(Math.round(metros(a, b))).toBeGreaterThan(990);
    const p = avanzar(a, b, 180);
    expect(Math.round(metros(a, p))).toBeLessThanOrEqual(181);
    expect(avanzar(desplazar(b, -50, 0), b, 180)).toEqual(b);
    expect(tramoPermitido(null)).toBe(JUEGO.pasoMaxM);
    expect(tramoPermitido(1)).toBe(JUEGO.velocidadMs);
    // Nunca más rápido que lo que el servidor acepta (50 m/s).
    expect(tramoPermitido(4) / 4).toBeLessThan(50);
  });

  it('las sesiones de los robots se guardan cifradas y la clave sale del secreto', async () => {
    const t = await cifrar(SECRETO, 'token-de-robot');
    expect(t).not.toContain('token-de-robot');
    expect(await descifrar(SECRETO, t)).toBe('token-de-robot');
    await expect(descifrar('otro-secreto', t)).rejects.toThrow();
    expect(await claveRobot(SECRETO, 'a@b.c')).toBe(await claveRobot(SECRETO, 'a@b.c'));
    expect(await claveRobot(SECRETO, 'a@b.c')).not.toBe(await claveRobot(SECRETO, 'x@b.c'));
  });
});

describe('C-CIUDAD-JUEGO', () => {
  it('en producción encender, latido y apagar no existen, y el efectivo de juego tampoco', async () => {
    const { post, m } = await ciudad('divoox.com');
    expect((await post('encender')).estado).toBe(404);
    expect((await post('latido', { sesion: 'juego-x' })).estado).toBe(404);
    expect((await post('apagar', { sesion: 'juego-x' })).estado).toBe(404);
    // Aunque exista un restaurante con correo de robot, en producción no acepta efectivo.
    const dueno = await m.cuenta('restaurante');
    await m.confirmarCorreo(dueno.id);
    await m.DB.prepare(
      "UPDATE usuarios SET correo = 'juego.restaurante9@simulador.test' WHERE id = ?",
    )
      .bind(dueno.id)
      .run();
    const r = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      {
        nombre: 'Robot de prueba',
        direccion: '1 Calle',
        lat: 25.77,
        lng: -80.19,
        telefono: '3055550100',
      },
      dueno.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const pais = await m.llamar('GET', `/datos/pais?restauranteId=${r.datos.restaurante.id}`);
    expect(pais.datos.efectivoActivo).toBe(false);
  });

  it('sin ser superadmin no se enciende ni se late', async () => {
    const { m } = await ciudad('staging.tumbite.com');
    const cli = await m.cuenta('cliente');
    expect(
      (await m.llamar('POST', '/datos/admin/ciudad-pruebas/encender', {}, cli.token)).estado,
    ).toBe(403);
    expect(
      (await m.llamar('POST', '/datos/admin/ciudad-pruebas/latido', { sesion: 'x' }, cli.token))
        .estado,
    ).toBe(403);
  });

  it('un jugador pide en efectivo a un robot y los latidos lo llevan hasta «entregado»', async () => {
    const { m, admin, post, envejecer, encenderTodo, consultasMax } =
      await ciudad('staging.tumbite.com');
    const primero = await post('encender');
    expect(primero.datos).toMatchObject({ listos: 1, total: 7, reutilizada: false });
    const enc = await encenderTodo();
    expect(enc.estado, JSON.stringify(enc.datos)).toBe(200);
    const sesion = enc.datos.sesion as string;

    // Encender otra vez reutiliza la misma sesión (no duplica robots).
    expect((await post('encender')).datos).toMatchObject({ sesion, reutilizada: true });

    // La población: 3 restaurantes abiertos y aprobados con menú, 4 repartidores conectados.
    const vivo0 = await m.llamar('GET', '/datos/admin/ciudad-pruebas', undefined, admin.token);
    expect(vivo0.datos.sesion).toMatchObject({ id: sesion, estado: 'corriendo' });
    expect(vivo0.datos.juego).toMatchObject({ encendida: true, robots: { listos: 7, total: 7 } });
    // La meta con las sesiones cifradas de los robots nunca sale a la pantalla.
    expect(JSON.stringify(vivo0.datos)).not.toMatch(/"t":"/);
    expect(vivo0.datos.restaurantes).toHaveLength(3);
    expect(vivo0.datos.repartidores).toHaveLength(4);
    expect(vivo0.datos.repartidores.every((r: { conectado: boolean }) => r.conectado)).toBe(true);
    const rid = vivo0.datos.restaurantes[0].id as string;
    const { results: menu } = await m.DB.prepare(
      'SELECT id FROM platos WHERE restaurante_id = ? ORDER BY precio_centavos',
    )
      .bind(rid)
      .all<{ id: string }>();
    expect(menu.length).toBe(3);
    const est = await m.DB.prepare('SELECT estado, abierto FROM restaurantes WHERE id = ?')
      .bind(rid)
      .first<{ estado: string; abierto: number }>();
    expect(est).toEqual({ estado: 'aprobado', abierto: 1 });

    // El jugador: un cliente cualquiera del sitio de pruebas. En la app ve «efectivo».
    const jugador = await m.cuenta('cliente', 'Mateo Jugador');
    await m.confirmarCorreo(jugador.id);
    const pais = await m.llamar(
      'GET',
      `/datos/pais?restauranteId=${rid}`,
      undefined,
      jugador.token,
    );
    expect(pais.datos.efectivoActivo).toBe(true);
    const local = vivo0.datos.restaurantes[0] as { lat: number; lng: number };
    const casa = desplazar(local, 900, 300);
    const pedido = await m.llamar(
      'POST',
      '/datos/pedidos',
      {
        restauranteId: rid,
        lineas: [{ platoId: menu[2]!.id, cantidad: 2 }],
        propinaCentavos: 200,
        entrega: 'puerta',
        metodoPago: 'efectivo',
        direccion: '500 Calle del Jugador',
        ...casa,
      },
      jugador.token,
    );
    expect(pedido.estado, JSON.stringify(pedido.datos)).toBe(201);
    const pid = pedido.datos.pedidoId as string;

    const estado = async () =>
      (await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?').bind(pid).first<{
        estado: string;
      }>())!.estado;
    const vistos: string[] = [await estado()];
    let maxFilasLatido = 0;
    for (let i = 0; i < 60 && (await estado()) !== 'entregado'; i++) {
      await envejecer();
      const l = await post('latido', { sesion });
      expect(l.estado, JSON.stringify(l.datos)).toBe(200);
      maxFilasLatido = Math.max(maxFilasLatido, Number(l.datos.filas ?? 0));
      const e = await estado();
      if (vistos.at(-1) !== e) vistos.push(e);
    }
    const vivo = await m.llamar('GET', '/datos/admin/ciudad-pruebas', undefined, admin.token);
    expect(vistos, JSON.stringify(vivo.datos.sesion.fallos)).toEqual([
      'pagado',
      'aceptado',
      'listo',
      'en_camino',
      'entregado',
    ]);
    // Cada latido respeta su tope (con margen: una acción en curso termina).
    expect(maxFilasLatido).toBeLessThanOrEqual(JUEGO.topeFilasLatido + 40);
    // Ninguna petición de encender o de latir se acerca al límite de consultas de un Worker.
    expect(consultasMax()).toBeLessThan(TOPE_CONSULTAS);
    // Lo llevó un repartidor robot, con la foto, y cobró el efectivo.
    const fin = await m.DB.prepare(
      `SELECT p.repartidor_id, p.cobro_estado, u.correo,
         (SELECT COUNT(*) FROM evidencias e WHERE e.pedido_id = p.id) AS fotos
        FROM pedidos p JOIN usuarios u ON u.id = p.repartidor_id WHERE p.id = ?`,
    )
      .bind(pid)
      .first<{ correo: string; cobro_estado: string; fotos: number }>();
    expect(fin?.correo).toMatch(/^juego\.repartidor\d@simulador\.test$/);
    expect(fin?.cobro_estado).toBe('confirmado');
    expect(fin?.fotos).toBe(2);

    // La pantalla: el jugador con lo que compró, y la sesión dentro de su tope de filas.
    const jug = (vivo.datos.jugadores as { nombre: string; pedidos: { estado: string }[] }[]).find(
      (j) => j.nombre === 'Mateo Jugador',
    );
    expect(jug?.pedidos.map((p) => p.estado)).toEqual(['entregado']);
    expect(vivo.datos.juego.filas.sesion).toBeGreaterThan(0);
    expect(vivo.datos.juego.filas.sesion).toBeLessThan(JUEGO.topeFilasSesion);

    // Mirar no escribe nada.
    const contada = contarFilas(m.DB);
    const res = await app.request(
      'https://staging.tumbite.com/datos/admin/ciudad-pruebas',
      { headers: { authorization: `Bearer ${admin.token}`, 'cf-connecting-ip': '10.9.9.8' } },
      { DB: contada.db, RELOJ_SECRETO: SECRETO },
    );
    expect(res.status).toBe(200);
    expect(contada.cuenta.escritas).toBe(0);

    // Apagar: repartidores desconectados y restaurantes cerrados.
    const ap = await post('apagar', { sesion });
    expect(ap.datos.estado).toBe('terminada');
    const abiertos = await m.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM restaurantes r JOIN usuarios u ON u.id = r.dueno_id WHERE u.correo LIKE 'juego.%' AND r.abierto = 1) AS r,
              (SELECT COUNT(*) FROM repartidores d JOIN usuarios u ON u.id = d.usuario_id WHERE u.correo LIKE 'juego.%' AND d.conectado = 1) AS d`,
    ).first<{ r: number; d: number }>();
    expect(abiertos).toEqual({ r: 0, d: 0 });
    // Después de apagar, el latido no hace nada.
    expect((await post('latido', { sesion })).datos.estado).toBe('terminada');
  }, 60_000);

  it('en mano con PIN y para recoger también terminan; al apagar, lo que no salió de la cocina se rechaza', async () => {
    const { m, admin, post, envejecer, encenderTodo } = await ciudad();
    const sesion = (await encenderTodo()).datos.sesion as string;
    const vivo0 = await m.llamar('GET', '/datos/admin/ciudad-pruebas', undefined, admin.token);
    const [r1, r2] = vivo0.datos.restaurantes as { id: string; lat: number; lng: number }[];
    const plato = async (rid: string) =>
      (await m.DB.prepare('SELECT id FROM platos WHERE restaurante_id = ? LIMIT 1')
        .bind(rid)
        .first<{ id: string }>())!.id;
    const pedir = async (nombre: string, rid: string, extra: Record<string, unknown>) => {
      const j = await m.cuenta('cliente', nombre);
      await m.confirmarCorreo(j.id);
      const local = vivo0.datos.restaurantes.find((r: { id: string }) => r.id === rid);
      const r = await m.llamar(
        'POST',
        '/datos/pedidos',
        {
          restauranteId: rid,
          lineas: [{ platoId: await plato(rid), cantidad: 1 }],
          propinaCentavos: 0,
          metodoPago: 'efectivo',
          direccion: '700 Calle del Jugador',
          ...desplazar(local, -600, 200),
          ...extra,
        },
        j.token,
      );
      expect(r.estado, JSON.stringify(r.datos)).toBe(201);
      return r.datos.pedidoId as string;
    };
    const enMano = await pedir('Ana Jugadora', r1!.id, { entrega: 'mano', pin: true });
    const recoger = await pedir('Leo Jugador', r2!.id, { entrega: 'recoger' });
    const estado = async (id: string) =>
      (await m.DB.prepare('SELECT estado FROM pedidos WHERE id = ?').bind(id).first<{
        estado: string;
      }>())!.estado;
    for (let i = 0; i < 60; i++) {
      if ((await estado(enMano)) === 'entregado' && (await estado(recoger)) === 'entregado') break;
      await envejecer();
      await post('latido', { sesion });
    }
    const vivo = await m.llamar('GET', '/datos/admin/ciudad-pruebas', undefined, admin.token);
    expect(await estado(enMano), JSON.stringify(vivo.datos.sesion.fallos)).toBe('entregado');
    expect(await estado(recoger), JSON.stringify(vivo.datos.sesion.fallos)).toBe('entregado');
    expect((vivo.datos.jugadores as { nombre: string }[]).map((j) => j.nombre).sort()).toEqual([
      'Ana Jugadora',
      'Leo Jugador',
    ]);

    // Un pedido que todavía no sale de la cocina: al apagar, el restaurante robot lo rechaza.
    const colgado = await pedir('Sol Jugadora', r1!.id, { entrega: 'puerta' });
    await post('apagar', { sesion });
    expect(await estado(colgado)).toBe('cancelado');
  }, 60_000);

  it('se apaga sola al llegar al tope de filas de la sesión o a los 60 minutos', async () => {
    const { m, post, encenderTodo } = await ciudad('staging.tumbite.com');
    const s1 = (await encenderTodo()).datos.sesion as string;
    await m.DB.prepare('UPDATE vueltas_pruebas SET escritas = ? WHERE id = ?')
      .bind(JUEGO.topeFilasSesion, s1)
      .run();
    const l1 = await post('latido', { sesion: s1 });
    expect(l1.datos.estado).toBe('terminada');
    expect(l1.datos.motivo).toMatch(/tope de 3000 filas/);
    const ses = await m.DB.prepare('SELECT estado, meta FROM simulador_sesiones WHERE id = ?')
      .bind(s1)
      .first<{ estado: string; meta: string }>();
    expect(JSON.parse(ses!.meta).motivoFin).toMatch(/filas/);

    const e2 = await encenderTodo();
    expect(e2.estado, JSON.stringify(e2.datos)).toBe(200);
    const s2 = e2.datos.sesion as string;
    expect(s2).not.toBe(s1);
    await m.DB.prepare(
      "UPDATE simulador_sesiones SET inicio = datetime('now', '-61 minutes') WHERE id = ?",
    )
      .bind(s2)
      .run();
    const l2 = await post('latido', { sesion: s2 });
    expect(l2.datos).toMatchObject({ estado: 'terminada' });
    expect(l2.datos.motivo).toMatch(/60 minutos/);
  }, 30_000);

  it('el efectivo de juego es solo de los restaurantes robot: los demás siguen sin efectivo', async () => {
    const { m } = await ciudad('staging.tumbite.com');
    const dueno = await m.cuenta('restaurante');
    const r = await m.llamar(
      'PUT',
      '/datos/mi-restaurante',
      { nombre: 'Normal', direccion: '1 Calle', lat: 25.77, lng: -80.19, telefono: '3055550100' },
      dueno.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(201);
    const pais = await m.llamar('GET', `/datos/pais?restauranteId=${r.datos.restaurante.id}`);
    expect(pais.datos.efectivoActivo).toBe(false);
  });
});
