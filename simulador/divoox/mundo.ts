import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type Actor,
  type Ejecucion,
  type Punto,
  type Respuesta,
  crearEmisor,
  desplazar,
  ruta,
} from '../nucleo/index.ts';
import type { Destino } from './destino.ts';

/**
 * El mundo de Divoox para el simulador: cuentas falsas, un restaurante con su menú, repartidores
 * conectados y el cliente, todos sobre la API REAL del servidor (las mismas rutas que usan las apps).
 * Lo único que va por la puerta de diagnóstico (solo existe en pruebas y en local, con secreto) es
 * lo que una persona no hace con la app: aprobar un restaurante, confirmar el correo, leer la base
 * para comprobar el dinero y adelantar el reloj del sistema. Todos los países (prueba).
 *
 * Geografía: Miami (la zona que trae la base nueva y donde corren los recorridos; C-RECORRIDO-NO-PISA).
 */
export const LOCAL_PUNTO: Punto = { lat: 25.7751, lng: -80.1902 };
const FOTOS = join(import.meta.dirname, '..', '..', 'e2e', 'recorrido', 'fotos');
const FOTO_BOLSA = readFileSync(join(FOTOS, 'bolsa-entrega.jpg'));
// La versión vigente de los términos sale de la misma pieza que usa el servidor (sin importarla:
// ese paquete no es un módulo de Node).
const VERSION_TERMINOS =
  /VERSION_TERMINOS = '([^']+)'/.exec(
    readFileSync(
      join(import.meta.dirname, '..', '..', 'packages', 'compartido', 'src', 'terminos.ts'),
      'utf8',
    ),
  )?.[1] ?? '';
const CLAVE = `Simula-${Date.now().toString(36)}-Puerta9`;

export type Ctx = {
  d: Destino;
  e: Ejecucion;
  /** Etiqueta de esta vuelta de pruebas (cabecera x-vuelta-pruebas). */
  vuelta: string;
  /** Texto corto y único de este escenario (correos, nombres). */
  id: string;
  sistema: Actor;
  sql(consulta: string): Promise<Record<string, unknown>[]>;
  uno(consulta: string): Promise<Record<string, unknown> | undefined>;
  estado(pedidoId: string): Promise<string | undefined>;
  restaurante(op?: { punto?: Punto }): Promise<Restaurante>;
  repartidor(op?: { punto?: Punto; nombre?: string }): Promise<Repartidor>;
  cliente(nombre?: string): Promise<Cliente>;
  pagar(p: PedidoCreado): Promise<void>;
  /** Pedidos de este escenario: al terminar se cierran por la API (no se dejan colgados). */
  pedidos: Set<string>;
  repartidores: Repartidor[];
  restaurantes: Restaurante[];
  clientes: Cliente[];
};

export type PedidoCreado = {
  pedidoId: string;
  clientSecret: string;
  autorizado: number;
  desglose: Record<string, number>;
};

const cabecerasBase = (ctx: { vuelta: string }) => ({
  'x-vuelta-pruebas': ctx.vuelta,
  'x-idioma': 'es',
});

export function crearCtx(d: Destino, e: Ejecucion, vuelta: string, id: string): Ctx {
  const sistema = e.actor({
    nombre: 'sistema (diagnóstico)',
    base: d.base,
    cabeceras: { ...cabecerasBase({ vuelta }), 'x-reloj-secreto': d.secreto },
  });
  const sql = async (consulta: string) => {
    const r = await sistema.post('/datos/interno/diagnostico/sql', { sql: consulta });
    if (!r.ok)
      throw new Error(`La consulta de diagnóstico falló (${r.estado}): ${r.texto.slice(0, 300)}`);
    return (r.datos as { results: Record<string, unknown>[] }).results;
  };
  const ctx: Ctx = {
    d,
    e,
    vuelta,
    id,
    sistema,
    sql,
    uno: async (c) => (await sql(c))[0],
    estado: async (pid) =>
      (await sql(`SELECT estado FROM pedidos WHERE id = '${limpio(pid)}'`))[0]?.estado as
        string | undefined,
    restaurante: (op) => crearRestaurante(ctx, op),
    repartidor: (op) => crearRepartidor(ctx, op),
    cliente: (nombre) => crearCliente(ctx, nombre),
    pagar: (p) => pagar(ctx, p),
    pedidos: new Set(),
    repartidores: [],
    restaurantes: [],
    clientes: [],
  };
  return ctx;
}

/** Los ids del servidor son letras, números y guiones: nada más entra en una consulta. */
export function limpio(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error(`id raro: ${id}`);
  return id;
}

// C-REGISTRO-PAUSADO: el sitio de pruebas admite 10 registros por minuto desde una dirección.
const registros: number[] = [];
async function pausaDeRegistro(ctx: Ctx) {
  const tope = ctx.d.modo === 'staging' ? 5 : 9;
  for (;;) {
    const ahora = Date.now();
    while (registros.length && ahora - registros[0]! > 60_000) registros.shift();
    if (registros.length < tope) break;
    await ctx.e.reloj.dormir(60_000 - (ahora - registros[0]!) + 250);
  }
  registros.push(Date.now());
}

/** Lo que hace falta para volver a ser esa persona en otra petición o en otra sesión. */
export type DatosCuenta = { quien: string; usuarioId: string; correo: string; token: string };
type Cuenta = DatosCuenta & { actor: Actor };

const sinActor = (c: Cuenta): DatosCuenta => ({
  quien: c.quien,
  usuarioId: c.usuarioId,
  correo: c.correo,
  token: c.token,
});

/** Un actor ya con la sesión de esa cuenta, anotando en la línea de tiempo de ESTE escenario. */
function actorDe(ctx: Ctx, d: DatosCuenta): Actor {
  const a = ctx.e.actor({ nombre: d.quien, base: ctx.d.base, cabeceras: cabecerasBase(ctx) });
  a.entrar(d.token);
  return a;
}

export async function cuenta(
  ctx: Ctx,
  rol: 'cliente' | 'restaurante' | 'repartidor',
  quien: string,
  nombre: string,
  /** Modo ciudad: una cuenta fija que se reutiliza entre sesiones (si ya existe, entra). */
  fija?: { correo: string; clave: string },
): Promise<Cuenta> {
  const actor = ctx.e.actor({ nombre: quien, base: ctx.d.base, cabeceras: cabecerasBase(ctx) });
  const correo = fija?.correo ?? `${rol}.${ctx.id}.${ctx.e.azar.id(4)}@simulador.test`;
  const clave = fija?.clave ?? CLAVE;
  if (fija) {
    const r = await actor.post('/datos/cuentas/entrar', { correo, clave });
    if (r.ok) {
      const datos = r.datos as { token: string; usuario: { id: string } };
      actor.entrar(datos.token);
      return { quien, actor, usuarioId: datos.usuario.id, correo, token: datos.token };
    }
  }
  const telefono = `305${String(ctx.e.azar.entero(0, 9_999_999)).padStart(7, '0')}`;
  for (let intento = 1; ; intento++) {
    await pausaDeRegistro(ctx);
    const r = await actor.post('/datos/cuentas/registro', {
      nombre,
      correo,
      clave,
      rol,
      telefono,
    });
    if (r.estado === 429 && intento < 4) {
      await ctx.e.reloj.dormir(20_000);
      continue;
    }
    if (!r.ok) throw new Error(`No se pudo crear la cuenta de ${quien} (${r.estado}): ${r.texto}`);
    const datos = r.datos as { token: string; usuario: { id: string } };
    actor.entrar(datos.token);
    await ctx.sql(
      `UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = '${limpio(datos.usuario.id)}'`,
    );
    return { quien, actor, usuarioId: datos.usuario.id, correo, token: datos.token };
  }
}

const exigirOk = (r: Respuesta, que: string) => {
  if (!r.ok) throw new Error(`${que}: el servidor respondió ${r.estado} ${r.texto.slice(0, 300)}`);
  return r;
};

// ------------------------------------------------------------------ restaurante

export type Restaurante = Cuenta & {
  rid: string;
  punto: Punto;
  platos: { principal: string; bebida: string };
  aceptar(pid: string, minutos?: number): Promise<Respuesta>;
  listo(pid: string): Promise<Respuesta>;
  rechazar(pid: string): Promise<Respuesta>;
  falta(pid: string, platoId: string): Promise<Respuesta>;
  entregarEnLocal(pid: string, pin: string): Promise<Respuesta>;
  cerrar(): Promise<void>;
};

export type DatosRestaurante = DatosCuenta & {
  rid: string;
  punto: Punto;
  platos: { principal: string; bebida: string };
};

export async function crearRestaurante(
  ctx: Ctx,
  op: { punto?: Punto; fija?: { correo: string; clave: string }; nombre?: string } = {},
): Promise<Restaurante> {
  const punto = op.punto ?? LOCAL_PUNTO;
  const c = await cuenta(
    ctx,
    'restaurante',
    op.nombre ?? 'restaurante',
    `Cocina ${ctx.id}`,
    op.fija,
  );
  const ficha = exigirOk(
    await c.actor.put('/datos/mi-restaurante', {
      nombre: op.nombre ? `${op.nombre} (simulado)` : `Cocina Simulada ${ctx.id}`,
      direccion: '320 Calle de Ejemplo, Miami, FL',
      ...punto,
      categoria: 'Cubana',
      telefono: '3055550197',
    }),
    'la ficha del restaurante',
  );
  const rid = (ficha.datos as { restaurante: { id: string } }).restaurante.id;
  await ctx.sql(`UPDATE restaurantes SET estado = 'aprobado' WHERE id = '${limpio(rid)}'`);
  // Una cuenta reutilizada ya tiene su menú: no se duplican los platos (menos filas).
  const ya = (await ctx.sql(
    `SELECT id, nombre_es FROM platos WHERE restaurante_id = '${limpio(rid)}' AND nombre_es IN ('Arroz con pollo', 'Jugo natural')`,
  )) as { id: string; nombre_es: string }[];
  const plato = async (nombreEs: string, nombreEn: string, precioCentavos: number) =>
    ya.find((x) => x.nombre_es === nombreEs)?.id ??
    (
      exigirOk(
        await c.actor.post('/datos/mi-restaurante/platos', { nombreEs, nombreEn, precioCentavos }),
        `el plato ${nombreEs}`,
      ).datos as { plato: { id: string } }
    ).plato.id;
  const principal = await plato('Arroz con pollo', 'Chicken and rice', 1500);
  const bebida = await plato('Jugo natural', 'Fresh juice', 500);
  exigirOk(
    await c.actor.put('/datos/mi-restaurante/horarios', {
      turnos: [0, 1, 2, 3, 4, 5, 6].map((dia) => ({ dia, abre: '00:00', cierra: '23:59' })),
    }),
    'el horario',
  );
  exigirOk(
    await c.actor.patch('/datos/mi-restaurante/abierto', { abierto: true }),
    'abrir el restaurante',
  );
  const datos = sinActor(c);
  return vistaRestaurante(ctx, { ...datos, rid, punto, platos: { principal, bebida } });
}

/** El restaurante como actor de ESTE escenario (la ciudad lo rearma en cada pedido). */
export function vistaRestaurante(ctx: Ctx, d: DatosRestaurante): Restaurante {
  const c = { ...d, actor: actorDe(ctx, d) };
  const r: Restaurante = {
    ...c,
    aceptar: (pid, minutos = 5) =>
      c.actor.post(`/datos/restaurante/pedidos/${pid}/aceptar`, { minutos }),
    listo: (pid) => c.actor.post(`/datos/restaurante/pedidos/${pid}/listo`, {}),
    rechazar: (pid) => c.actor.post(`/datos/restaurante/pedidos/${pid}/rechazar`, {}),
    falta: (pid, platoId) => c.actor.post(`/datos/restaurante/pedidos/${pid}/falta`, { platoId }),
    entregarEnLocal: (pid, pin) =>
      c.actor.post(`/datos/restaurante/pedidos/${pid}/entregado-local`, { pin }),
    cerrar: async () => {
      await c.actor.patch('/datos/mi-restaurante/abierto', { abierto: false });
    },
  };
  ctx.restaurantes.push(r);
  return r;
}

// ------------------------------------------------------------------ repartidor

export type Repartidor = Cuenta & {
  punto: Punto;
  conectar(): Promise<void>;
  desconectar(): Promise<void>;
  /** Una lectura de GPS (la app real la manda como mucho cada pocos segundos). */
  ubicacion(p: Punto): Promise<Respuesta>;
  ofertas(): Promise<string[]>;
  esperarOferta(pid: string, que?: string): Promise<void>;
  aceptar(pid: string): Promise<Respuesta>;
  rechazar(pid: string): Promise<Respuesta>;
  verificar(pid: string, codigo?: string): Promise<Respuesta>;
  fotoRecogida(pid: string): Promise<Respuesta>;
  /** Maneja hasta el punto por una ruta creíble, sin pasar de la frecuencia del GPS de la app. */
  ir(destino: Punto): Promise<number>;
  /** Hasta que el servidor confirme «llegó a la puerta» (dos lecturas precisas). */
  esperarLlegada(destino: Punto): Promise<void>;
  entregarConFoto(pid: string, donde: Punto): Promise<Respuesta>;
  entregarEnMano(pid: string, donde: Punto, pin?: string): Promise<Respuesta>;
  estadoActual(): Promise<{ activo?: { id?: string; llegoCliente?: boolean } | null }>;
};

/** `punto` es dónde está ahora: la ciudad lo conserva de un pedido al siguiente. */
export type DatosRepartidor = DatosCuenta & { punto: Punto };

export async function crearRepartidor(
  ctx: Ctx,
  op: { punto?: Punto; nombre?: string; fija?: { correo: string; clave: string } } = {},
): Promise<Repartidor> {
  const quien = op.nombre ?? `repartidor ${ctx.repartidores.length + 1}`;
  const c = await cuenta(ctx, 'repartidor', quien, 'Repartidor Simulado', op.fija);
  const uid = limpio(c.usuarioId);
  // Lo que la app pide la primera vez y no tiene sentido sin cámara: la foto de control de la semana.
  await ctx.sql(
    `INSERT OR REPLACE INTO selfies_control (id, usuario_id, tomada_en, resultado) VALUES ('sim-${uid}', '${uid}', datetime('now'), 'ok')`,
  );
  const datos = sinActor(c);
  return vistaRepartidor(ctx, { ...datos, punto: op.punto ?? LOCAL_PUNTO });
}

/** El repartidor como actor de ESTE escenario. Mueve `d.punto` al manejar. */
export function vistaRepartidor(ctx: Ctx, d: DatosRepartidor): Repartidor {
  const c = { ...d, actor: actorDe(ctx, d) };
  const quien = d.quien;
  const uid = limpio(d.usuarioId);
  const emisor = crearEmisor(
    ctx.e.reloj,
    async (p) => {
      d.punto = p;
      await c.actor.post('/datos/repartidor/ubicacion', { ...p, precision: 10 });
    },
    { minimoMs: 4_000 },
  );
  const rep: Repartidor = {
    ...c,
    get punto() {
      return d.punto;
    },
    conectar: async () => {
      // Términos vigentes: la misma ruta que usa la app la primera vez.
      exigirOk(
        await c.actor.post('/datos/repartidor/terminos', { version: VERSION_TERMINOS }),
        `${quien} acepta los términos`,
      );
      // C-RECORRIDO-NO-PISA: en Miami, ningún otro repartidor de pruebas conectado se lleva la oferta.
      const mios = ctx.repartidores.map((r) => `'${limpio(r.usuarioId)}'`).concat(`'${uid}'`);
      await ctx.sql(
        `UPDATE repartidores SET conectado = 0 WHERE conectado = 1 AND zona_id = 'US-FL-MIAMI' AND usuario_id NOT IN (${mios.join(',')})`,
      );
      exigirOk(
        await c.actor.post('/datos/repartidor/conectar', { conectado: true, ...d.punto }),
        `${quien} se conecta`,
      );
    },
    desconectar: async () => {
      await c.actor.post('/datos/repartidor/conectar', { conectado: false });
    },
    ubicacion: (p) => {
      d.punto = p;
      return c.actor.post('/datos/repartidor/ubicacion', { ...p, precision: 10 });
    },
    ofertas: async () => {
      const r = exigirOk(await c.actor.get('/datos/repartidor/ofertas'), 'las ofertas');
      return ((r.datos as { ofertas: { id: string }[] }).ofertas ?? []).map((o) => o.id);
    },
    esperarOferta: async (pid, que = `la oferta le llegue a ${quien}`) => {
      await ctx.e.esperar(
        que,
        async () => {
          const ids = await rep.ofertas();
          return ids.includes(pid) || { listo: false, visto: ids };
        },
        { topeMs: 60_000, cadaMs: 2_000 },
      );
    },
    aceptar: (pid) => c.actor.post(`/datos/repartidor/ofertas/${pid}/aceptar`, {}),
    rechazar: (pid) => c.actor.post(`/datos/repartidor/ofertas/${pid}/rechazar`, {}),
    verificar: (pid, codigo = pid) =>
      c.actor.post(`/datos/repartidor/pedidos/${pid}/verificar`, { codigo }),
    fotoRecogida: (pid) =>
      c.actor.pedir(
        'POST',
        `/datos/repartidor/pedidos/${pid}/foto-recogida?lat=${d.punto.lat}&lng=${d.punto.lng}`,
        { bytes: new Uint8Array(FOTO_BOLSA), tipo: 'image/jpeg' },
      ),
    ir: async (destino) =>
      emisor.recorrer(ruta(d.punto, destino, { azar: ctx.e.azar, tramoM: 80, temblorM: 6 })),
    esperarLlegada: async (destino) => {
      await ctx.e.esperar(
        `${quien} quede confirmado en la puerta`,
        async () => {
          await emisor.quizas(destino);
          const e = await rep.estadoActual();
          return Boolean(e.activo?.llegoCliente) || { listo: false, visto: e.activo ?? e };
        },
        { topeMs: 60_000, cadaMs: 2_000 },
      );
    },
    entregarConFoto: (pid, donde) =>
      c.actor.pedir(
        'POST',
        `/datos/repartidor/pedidos/${pid}/entregado?lat=${donde.lat}&lng=${donde.lng}`,
        { bytes: new Uint8Array(FOTO_BOLSA), tipo: 'image/jpeg' },
      ),
    entregarEnMano: (pid, donde, pin) =>
      c.actor.post(`/datos/repartidor/pedidos/${pid}/entregado`, {
        ...donde,
        modo: 'mano',
        ...(pin ? { pin } : {}),
      }),
    estadoActual: async () =>
      (exigirOk(await c.actor.get('/datos/repartidor/estado'), 'el estado del repartidor').datos ??
        {}) as { activo?: { id?: string; llegoCliente?: boolean } | null },
  };
  ctx.repartidores.push(rep);
  return rep;
}

// ------------------------------------------------------------------ cliente

export const CASA: Punto = desplazar(LOCAL_PUNTO, 480, 0);
/** A unos 3,6 km al norte: pasa de los 3 km incluidos y el envío sube (tarifa por distancia). */
export const LEJOS: Punto = desplazar(LOCAL_PUNTO, 3_600, 0);

export type Cliente = Cuenta & {
  pedir(
    r: Restaurante,
    op?: {
      lineas?: { platoId: string; cantidad: number }[];
      entrega?: 'puerta' | 'mano' | 'recoger';
      pin?: boolean;
      propina?: number;
      donde?: Punto;
      totalEsperado?: number;
    },
  ): Promise<Respuesta>;
  pedirYPagar(r: Restaurante, op?: Parameters<Cliente['pedir']>[1]): Promise<PedidoCreado>;
  seguimiento(pid: string): Promise<Record<string, unknown>>;
  pin(pid: string): Promise<string>;
  cancelar(pid: string): Promise<Respuesta>;
  ajuste(pid: string, decision: 'quitar' | 'cancelar'): Promise<Respuesta>;
  propina(pid: string, centavos: number): Promise<Respuesta>;
  cambiarDireccion(pid: string, donde: Punto, aceptarTotal?: boolean): Promise<Respuesta>;
};

export async function crearCliente(
  ctx: Ctx,
  nombre = 'cliente',
  fija?: { correo: string; clave: string },
): Promise<Cliente> {
  const c = await cuenta(ctx, 'cliente', nombre, 'Cliente Simulado', fija);
  const datos = sinActor(c);
  return vistaCliente(ctx, datos);
}

/** El cliente como actor de ESTE escenario. */
export function vistaCliente(ctx: Ctx, d: DatosCuenta): Cliente {
  const c = { ...d, actor: actorDe(ctx, d) };
  const cli: Cliente = {
    ...c,
    pedir: async (r, op = {}) => {
      const donde = op.donde ?? CASA;
      const res = await c.actor.post('/datos/pedidos', {
        restauranteId: r.rid,
        lineas: op.lineas ?? [{ platoId: r.platos.principal, cantidad: 1 }],
        propinaCentavos: op.propina ?? 200,
        entrega: op.entrega ?? 'puerta',
        ...(op.pin === undefined ? {} : { pin: op.pin }),
        ...(op.totalEsperado === undefined ? {} : { totalEsperado: op.totalEsperado }),
        direccion: op.entrega === 'recoger' ? '' : '400 Calle de Ejemplo, Miami, FL',
        ...(op.entrega === 'recoger' ? {} : donde),
      });
      if (res.ok) ctx.pedidos.add((res.datos as { pedidoId: string }).pedidoId);
      return res;
    },
    pedirYPagar: async (r, op) => {
      const res = exigirOk(await cli.pedir(r, op), 'crear el pedido');
      const p = res.datos as PedidoCreado;
      await ctx.pagar(p);
      return p;
    },
    seguimiento: async (pid) =>
      (
        exigirOk(await c.actor.get(`/datos/pedidos/${pid}/seguimiento`), 'el seguimiento')
          .datos as { pedido: Record<string, unknown> }
      ).pedido,
    pin: async (pid) => {
      const pin = (await cli.seguimiento(pid)).pin;
      if (typeof pin !== 'string') throw new Error('el cliente no ve su PIN en el seguimiento');
      return pin;
    },
    cancelar: (pid) => c.actor.post(`/datos/pedidos/${pid}/cancelar`, {}),
    ajuste: (pid, decision) => c.actor.post(`/datos/pedidos/${pid}/ajuste`, { decision }),
    propina: (pid, centavos) => c.actor.post(`/datos/pedidos/${pid}/propina`, { centavos }),
    cambiarDireccion: (pid, donde, aceptarTotal) =>
      c.actor.patch(`/datos/pedidos/${pid}/direccion`, {
        direccion: '900 Calle de Ejemplo, Miami, FL',
        ...donde,
        ...(aceptarTotal ? { aceptarTotal: true } : {}),
      }),
  };
  ctx.clientes.push(cli);
  return cli;
}

// ------------------------------------------------------------------ pago

/**
 * El pago del cliente. En el sitio de pruebas: la tarjeta de prueba de Stripe (pm_card_visa) y el
 * aviso REAL de Stripe. En local: el aviso de Stripe firmado como el de verdad (el Stripe simulado no
 * manda avisos). En los dos se espera a que el servidor deje el pedido «pagado».
 */
async function pagar(ctx: Ctx, p: PedidoCreado) {
  if (ctx.d.modo === 'staging') {
    exigirOk(
      await ctx.sistema.post('/datos/interno/diagnostico/confirmar-pago', { pedidoId: p.pedidoId }),
      'pagar con la tarjeta de prueba de Stripe',
    );
  } else {
    const cuerpo = JSON.stringify({
      id: `evt_sim_${p.pedidoId}`,
      type: 'payment_intent.amount_capturable_updated',
      data: {
        object: {
          id: p.clientSecret.split('_secret')[0],
          amount_capturable: p.autorizado ?? p.desglose.totalCliente,
          metadata: { pedido_id: p.pedidoId },
        },
      },
    });
    const t = Math.floor(Date.now() / 1000);
    const firma = createHmac('sha256', ctx.d.secretoAviso ?? '')
      .update(`${t}.${cuerpo}`)
      .digest('hex');
    exigirOk(
      await ctx.sistema.pedir('POST', '/datos/stripe/aviso', cuerpo, {
        cabeceras: { 'stripe-signature': `t=${t},v1=${firma}` },
      }),
      'el aviso de pago de Stripe',
    );
  }
  await ctx.e.esperar(
    'el pedido quede pagado',
    async () => {
      const e = await ctx.estado(p.pedidoId);
      return e === 'pagado' || { listo: false, visto: e };
    },
    { topeMs: 90_000, cadaMs: ctx.d.modo === 'staging' ? 3_000 : 500 },
  );
}

/** Cierra lo que el escenario dejó abierto, siempre por la API (nada de dinero tocado a mano). */
export async function cerrarEscenario(ctx: Ctx): Promise<void> {
  for (const pid of ctx.pedidos) {
    const e = await ctx.estado(pid);
    if (e === 'pago_pendiente' || e === 'pagado') {
      const cli = ctx.clientes[0];
      if (e === 'pago_pendiente' && cli) await cli.cancelar(pid);
      else for (const r of ctx.restaurantes) await r.rechazar(pid);
    } else if (e === 'aceptado') {
      for (const r of ctx.restaurantes) await r.rechazar(pid);
    }
    // Un pedido «listo» sin repartidor no se puede rechazar: se aparta de la fila de ofertas para
    // que no le caiga al repartidor del escenario siguiente (no cambia su estado ni su dinero).
    if ((await ctx.estado(pid)) === 'listo')
      await ctx.sql(
        `UPDATE pedidos SET programado_para = '2099-01-01T00:00:00.000Z' WHERE id = '${limpio(pid)}' AND repartidor_id IS NULL`,
      );
  }
  for (const r of ctx.repartidores) await r.desconectar();
  for (const r of ctx.restaurantes) await r.cerrar();
}
