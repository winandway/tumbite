import { createHmac } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  type Escenario,
  type Punto,
  type ResultadoCorrida,
  type ResultadoEscenario,
  contar,
  correrLibreto,
  correrSesion,
  crearActor,
  crearAzar,
  desplazar,
  escribirReporte,
  relojReal,
  resumenMarkdown,
  semillaDe,
  veredicto,
} from '../nucleo/index.ts';
import { libroCuadra, comprobarDinero } from './dinero.ts';
import { destinoDesdeEntorno, levantarServidorLocal } from './destino.ts';
import {
  adelantarOferta,
  entregarConFoto,
  esperarOk,
  estadoEs,
  llevar,
  pedidoPagado,
  recoger,
} from './escenarios.ts';
import {
  type Ctx,
  type DatosCuenta,
  type DatosRepartidor,
  type DatosRestaurante,
  LOCAL_PUNTO,
  type Repartidor,
  cerrarEscenario,
  crearCliente,
  crearCtx,
  crearRepartidor,
  crearRestaurante,
  limpio,
  vistaCliente,
  vistaRepartidor,
  vistaRestaurante,
} from './mundo.ts';

/**
 * MODO CIUDAD (13 nov 2026, pedido de Richard): «una ciudad donde una IA se convierte en el humano
 * para comprar y vender». Una población falsa (restaurantes, repartidores y clientes, con semilla)
 * pide, acepta, prepara, reparte y entrega a ritmo creíble durante una sesión ACOTADA (por pedidos o
 * por minutos), mezclando al azar los comportamientos de los escenarios. El «humano» es el actor con
 * manías y azar con semilla: ningún modelo de IA de pago. Todos los países.
 *
 *   npm run simulador:ciudad                                   local, con los valores por defecto
 *   npm run simulador:ciudad -- --pedidos 40 --minutos 20 --repartidores 5 --semilla 7
 *
 * Contra el sitio de pruebas (flujo de GitHub «simulador», modo ciudad) respeta el presupuesto de la
 * vuelta: deja de empezar pedidos al llegar a 4.500 filas escritas (el tope es 6.000) y cierra.
 * Reutiliza las MISMAS cuentas entre sesiones (correos fijos; si existen, entra con ellas).
 * Se ve en vivo en el superadmin («Ciudad de pruebas»), que además puede pedirle que pare.
 */
const { values: op } = parseArgs({
  options: {
    pedidos: { type: 'string', default: '20' },
    minutos: { type: 'string', default: '15' },
    restaurantes: { type: 'string', default: '3' },
    repartidores: { type: 'string', default: '4' },
    clientes: { type: 'string', default: '8' },
    concurrencia: { type: 'string', default: '2' },
    semilla: { type: 'string' },
    corrida: { type: 'string' },
    reporte: { type: 'string' },
  },
});
const numero = (x: string | undefined, def: number, max: number) =>
  Math.max(1, Math.min(max, Number.parseInt(x ?? '', 10) || def));
const META_PEDIDOS = numero(op.pedidos, 20, 500);
const META_MINUTOS = numero(op.minutos, 15, 120);
const N_REST = numero(op.restaurantes, 3, 10);
const N_REP = numero(op.repartidores, 4, 20);
const N_CLI = numero(op.clientes, 8, 40);
const CONCURRENCIA = numero(op.concurrencia, 2, 6);
/** En el sitio de pruebas la vuelta se frena a las 6.000 filas: se deja de empezar antes. */
const FRENO_FILAS = 4_500;

/** Qué hace cada historia y con qué probabilidad (pesos). */
const COMPORTAMIENTOS = [
  ['a la puerta', 40],
  ['en mano con PIN', 10],
  ['para recoger', 8],
  ['plato agotado', 8],
  ['doble toque', 8],
  ['el repartidor rechaza primero', 8],
  ['propina después', 6],
  ['el cliente cancela', 6],
  ['el restaurante rechaza', 6],
] as const;
type Comportamiento = (typeof COMPORTAMIENTOS)[number][0];

const remoto = Boolean(process.env.SIMULADOR_URL ?? process.env.RECORRIDO_URL);
const apagar = remoto ? () => {} : await levantarServidorLocal();
let codigo = 1;
try {
  codigo = await sesionDeCiudad();
} catch (e) {
  console.error('ciudad:', e instanceof Error ? e.message : e);
} finally {
  apagar();
}
process.exit(codigo);

async function sesionDeCiudad(): Promise<number> {
  const d = destinoDesdeEntorno();
  const semilla = semillaDe(op.semilla);
  const azar = crearAzar(semilla);
  const corrida =
    op.corrida ?? process.env.SIMULADOR_CORRIDA ?? `ciudad-${Date.now().toString(36)}-${semilla}`;
  const sesionId = limpio(
    (corrida.startsWith('ciudad-') ? corrida : `ciudad-${corrida}`).slice(0, 64),
  );
  // Sitio de pruebas: toda la sesión es UNA vuelta (tope 6.000). Local: una por pedido, para medir.
  const vueltaDe = (sufijo: string) =>
    d.modo === 'staging' ? `simulador-${corrida}` : `simulador-${corrida}-${sufijo}`;
  const inicio = relojReal.ahora();
  const destino =
    d.modo === 'local' ? `el servidor local (${d.base})` : `el sitio de pruebas (${d.base})`;
  console.warn(
    `ciudad: ${N_REST} restaurantes, ${N_REP} repartidores, ${N_CLI} clientes; hasta ${META_PEDIDOS} pedidos o ${META_MINUTOS} minutos, ${CONCURRENCIA} a la vez, contra ${d.base} (semilla ${semilla})`,
  );

  // Cuentas fijas: el mismo correo en cada sesión y una clave que solo se deriva del secreto.
  const fija = (quien: string) => {
    const correo = `ciudad.${quien}@simulador.test`;
    const h = createHmac('sha256', d.secreto).update(correo).digest('hex').slice(0, 20);
    return { correo, clave: `Ciudad-${h}-Z9` };
  };
  const puntoRest = (i: number): Punto =>
    i === 0
      ? LOCAL_PUNTO
      : desplazar(LOCAL_PUNTO, 1_100 * Math.sin(i * 2.1), 1_100 * Math.cos(i * 2.1));
  // Las casas de los clientes no cambian de una sesión a otra (azar fijo por cliente).
  const casaDe = (j: number): Punto => {
    const a = crearAzar(1_000 + j);
    return desplazar(LOCAL_PUNTO, a.entero(-900, 900), a.entero(-900, 900));
  };

  const restaurantes: DatosRestaurante[] = [];
  const pool: { datos: DatosRepartidor; ocupado: boolean }[] = [];
  const clientes: DatosCuenta[] = [];
  const sinDatosSesion = (x: { actor: unknown } & DatosCuenta): DatosCuenta => ({
    quien: x.quien,
    usuarioId: x.usuarioId,
    correo: x.correo,
    token: x.token,
  });

  // 1. La población (como un escenario más: queda en el reporte con su línea de tiempo).
  const armar: Escenario<Ctx> = {
    nombre: 'La ciudad abre (población)',
    descripcion: `Entran (o se crean la primera vez) ${N_REST} restaurantes, ${N_REP} repartidores y ${N_CLI} clientes; los restaurantes abren y los repartidores se conectan.`,
    topeMs: 15 * 60_000,
    async correr(e, ctx) {
      for (let i = 0; i < N_REST; i++) {
        const r = await e.paso(`restaurante ${i + 1} abre`, () =>
          crearRestaurante(ctx, {
            punto: puntoRest(i),
            fija: fija(`restaurante${i + 1}`),
            nombre: `Cocina de la ciudad ${i + 1}`,
          }),
        );
        restaurantes.push({ ...sinDatosSesion(r), rid: r.rid, punto: r.punto, platos: r.platos });
      }
      for (let k = 0; k < N_REP; k++) {
        const x = await e.paso(`repartidor ${k + 1} entra`, () =>
          crearRepartidor(ctx, {
            punto: puntoRest(k % N_REST),
            nombre: `repartidor ${k + 1}`,
            fija: fija(`repartidor${k + 1}`),
          }),
        );
        pool.push({ datos: { ...sinDatosSesion(x), punto: x.punto }, ocupado: false });
      }
      // Se conectan cuando ya están todos (cada uno deja fuera solo a los de otras pruebas).
      await e.paso('los repartidores se conectan', async () => {
        for (const r of ctx.repartidores) await r.conectar();
      });
      for (let j = 0; j < N_CLI; j++) {
        const c = await e.paso(`cliente ${j + 1} entra`, () =>
          crearCliente(ctx, `cliente ${j + 1}`, fija(`cliente${j + 1}`)),
        );
        clientes.push(sinDatosSesion(c));
      }
    },
  };
  const sistema = crearActor({
    nombre: 'sistema',
    base: d.base,
    reloj: relojReal,
    cabeceras: { 'x-vuelta-pruebas': vueltaDe('base'), 'x-reloj-secreto': d.secreto },
  });
  const r0 = await correrLibreto<Ctx>({
    corrida,
    semilla,
    destino,
    reloj: relojReal,
    escenarios: [armar],
    contexto: (e) => crearCtx(d, e, vueltaDe('base'), `${corrida.slice(-6)}c`),
  });
  const resultados: ResultadoEscenario[] = [...r0.escenarios];
  if (!r0.ok) {
    console.error(`ciudad: la población no se pudo armar: ${r0.escenarios[0]?.error}`);
    return terminar(resultados);
  }
  const avisar = async (cuerpo: Record<string, unknown>) => {
    const r = await sistema.post('/datos/interno/ciudad/sesion', { id: sesionId, ...cuerpo });
    return (r.datos as { estado?: string } | null)?.estado ?? 'desconocido';
  };
  await avisar({
    accion: 'empezar',
    semilla,
    destino: d.modo,
    restaurantes: restaurantes.map((r) => r.rid),
    repartidores: pool.map((p) => p.datos.usuarioId),
    clientes: clientes.map((c) => c.usuarioId),
    meta: { pedidos: META_PEDIDOS, minutos: META_MINUTOS },
  });

  // 2. El despachador del lado de los repartidores: UNA sola consulta de ofertas a la vez por todo
  // el grupo (como las apps de cada uno, pero sin pasar del límite de peticiones por dirección), y
  // el latido de ubicación de los que esperan (C-LATIDO-UBICACION).
  const esperando = new Set<string>();
  const asignado = new Map<string, number>();
  const ultimoLatido = new Map<number, number>();
  let abierta = true;
  const actorDeRep = (i: number) => {
    const a = crearActor({
      nombre: pool.at(i)!.datos.quien,
      base: d.base,
      reloj: relojReal,
      cabeceras: { 'x-vuelta-pruebas': vueltaDe('base'), 'x-idioma': 'es' },
    });
    a.entrar(pool.at(i)!.datos.token);
    return a;
  };
  const despachador = (async () => {
    while (abierta) {
      const vuelta = relojReal.ahora();
      for (let i = 0; i < pool.length; i++) {
        const p = pool.at(i)!;
        if (p.ocupado) continue;
        const a = actorDeRep(i);
        if (relojReal.ahora() - (ultimoLatido.get(i) ?? 0) > 120_000) {
          ultimoLatido.set(i, relojReal.ahora());
          await a
            .post('/datos/repartidor/ubicacion', { ...p.datos.punto, precision: 10 })
            .catch(() => null);
        }
        if (!esperando.size) continue;
        const r = await a.get('/datos/repartidor/ofertas').catch(() => null);
        const ids = ((r?.datos as { ofertas?: { id: string }[] } | null)?.ofertas ?? []).map(
          (o) => o.id,
        );
        const pid = ids.find((x) => esperando.has(x));
        if (pid && !p.ocupado) {
          p.ocupado = true;
          esperando.delete(pid);
          asignado.set(pid, i);
        }
      }
      await relojReal.dormir(Math.max(500, 4_000 - (relojReal.ahora() - vuelta)));
    }
  })();
  const pedirRepartidor = async (ctx: Ctx, pid: string): Promise<[number, Repartidor]> => {
    esperando.add(pid);
    try {
      const i = await ctx.e.esperar(
        'un repartidor libre reciba la oferta',
        async () => asignado.get(pid) ?? null,
        { topeMs: 4 * 60_000, cadaMs: 1_000 },
      );
      asignado.delete(pid);
      return [i, vistaRepartidor(ctx, pool.at(i)!.datos)];
    } finally {
      esperando.delete(pid);
    }
  };
  const soltar = (i: number) => {
    const p = pool.at(i);
    if (p) p.ocupado = false;
  };

  // 3. Las historias.
  const pesoTotal = COMPORTAMIENTOS.reduce((s, [, w]) => s + w, 0);
  const elegir = (): Comportamiento => {
    let x = azar.numero() * pesoTotal;
    for (const [nombre, w] of COMPORTAMIENTOS) if ((x -= w) < 0) return nombre;
    return 'a la puerta';
  };
  let parar = false;
  let motivoFin = `llegó a ${META_PEDIDOS} pedidos`;
  const pausa = async (ctx: Ctx, min: number, max: number) =>
    ctx.e.reloj.dormir(ctx.e.azar.entero(min, max));

  const historia = (n: number): Escenario<Ctx> | null => {
    if (parar || n >= META_PEDIDOS) return null;
    if (relojReal.ahora() - inicio > META_MINUTOS * 60_000) {
      motivoFin = `se cumplieron ${META_MINUTOS} minutos`;
      return null;
    }
    const como = elegir();
    const ri = azar.entero(0, restaurantes.length - 1);
    const cj = azar.entero(0, clientes.length - 1);
    return {
      nombre: `Pedido ${n + 1} · ${como}`,
      descripcion: `El cliente ${cj + 1} le pide al restaurante ${ri + 1} (${como}).`,
      etiquetas: [como],
      topeMs: 8 * 60_000,
      async correr(e, ctx) {
        const r = vistaRestaurante(ctx, restaurantes.at(ri)!);
        const cli = vistaCliente(ctx, clientes.at(cj)!);
        const casa = casaDe(cj);
        if (como === 'para recoger') {
          const p = await pedidoPagado(ctx, cli, r, { entrega: 'recoger', propina: 0 });
          await cocinar(ctx, r, p.pedidoId);
          await e.paso('el cliente llega y lo recoge con su PIN', async () => {
            await pausa(ctx, 2_000, 6_000);
            const pin = await cli.pin(p.pedidoId);
            esperarOk(ctx, await r.entregarEnLocal(p.pedidoId, pin), 'entregado en el local');
          });
          await comprobarDinero(ctx, p.pedidoId, 'recogido', { libro: false });
          return;
        }
        const p = await pedidoPagado(ctx, cli, r, {
          donde: casa,
          ...(como === 'en mano con PIN' ? { entrega: 'mano' as const, pin: true } : {}),
          ...(como === 'plato agotado'
            ? {
                lineas: [
                  { platoId: r.platos.principal, cantidad: 1 },
                  { platoId: r.platos.bebida, cantidad: 1 },
                ],
              }
            : {}),
        });
        const pid = p.pedidoId;
        if (como === 'el cliente cancela') {
          await e.paso('el cliente se arrepiente y cancela', async () => {
            await pausa(ctx, 1_000, 4_000);
            esperarOk(ctx, await cli.cancelar(pid), 'cancela');
            await estadoEs(ctx, pid, 'cancelado');
          });
          await comprobarDinero(ctx, pid, 'cancelado', { libro: false });
          return;
        }
        if (como === 'el restaurante rechaza') {
          await e.paso('el restaurante está lleno y lo rechaza', async () => {
            await pausa(ctx, 2_000, 6_000);
            esperarOk(ctx, await r.rechazar(pid), 'rechaza');
            await estadoEs(ctx, pid, 'cancelado');
          });
          await comprobarDinero(ctx, pid, 'cancelado', { libro: false });
          return;
        }
        if (como === 'plato agotado') {
          await e.paso('falta la bebida: el cliente la quita', async () => {
            await pausa(ctx, 2_000, 5_000);
            esperarOk(ctx, await r.aceptar(pid), 'acepta');
            esperarOk(ctx, await r.falta(pid, r.platos.bebida), 'falta un plato');
            await pausa(ctx, 1_000, 4_000);
            esperarOk(ctx, await cli.ajuste(pid, 'quitar'), 'el cliente lo quita');
          });
          await e.paso('lo prepara y lo marca listo', async () => {
            await pausa(ctx, 4_000, 10_000);
            esperarOk(ctx, await r.listo(pid), 'listo');
          });
        } else if (como === 'doble toque') {
          await e.paso('la tableta lenta: doble toque en «Aceptar» y en «Listo»', async () => {
            await pausa(ctx, 2_000, 5_000);
            const ruta = (q: string) => `/datos/restaurante/pedidos/${pid}/${q}`;
            const [a, b] = await r.actor.manias.dobleToque('POST', ruta('aceptar'), { minutos: 5 });
            e.comprobar(a.ok && b.ok, 'los dos toques de «Aceptar» responden bien', [
              a.texto,
              b.texto,
            ]);
            await pausa(ctx, 4_000, 10_000);
            const [x, y] = await r.actor.manias.dobleToque('POST', ruta('listo'), {});
            e.comprobar(x.ok && y.ok, 'los dos toques de «Listo» responden bien', [
              x.texto,
              y.texto,
            ]);
          });
        } else await cocinar(ctx, r, pid);

        let [i, rep] = await e.paso('le llega la oferta a un repartidor', () =>
          pedirRepartidor(ctx, pid),
        );
        try {
          if (como === 'el repartidor rechaza primero') {
            const otro = await e.paso(
              `${rep.actor.nombre} la rechaza; vuelve a la fila`,
              async () => {
                esperarOk(ctx, await rep.rechazar(pid), 'rechaza');
                soltar(i);
                // Como si hubiera pasado el respiro: si no hay otro libre, le vuelve a él.
                await adelantarOferta(ctx, pid, 200);
                return pedirRepartidor(ctx, pid);
              },
            );
            [i, rep] = otro;
          }
          await e.paso(`${rep.actor.nombre} acepta`, async () => {
            if (como === 'doble toque') {
              const [a, b] = await rep.actor.manias.dobleToque(
                'POST',
                `/datos/repartidor/ofertas/${pid}/aceptar`,
                {},
              );
              e.comprobar(a.ok && b.ok, 'los dos toques responden bien', [a.texto, b.texto]);
            } else esperarOk(ctx, await rep.aceptar(pid), 'acepta');
          });
          await recoger(ctx, rep, pid, r.punto);
          await llevar(ctx, rep, casa);
          if (como === 'en mano con PIN')
            await e.paso('entrega en mano con el PIN', async () => {
              const pin = await cli.pin(pid);
              esperarOk(ctx, await rep.entregarEnMano(pid, casa, pin), 'entrega con PIN');
              await estadoEs(ctx, pid, 'entregado');
            });
          else await entregarConFoto(ctx, rep, pid, casa);
        } finally {
          soltar(i);
        }
        await comprobarDinero(ctx, pid, 'entregado', { libro: false });
        if (como === 'propina después')
          await e.paso('el cliente deja una propina después', async () => {
            await pausa(ctx, 2_000, 6_000);
            esperarOk(ctx, await cli.propina(pid, 300), 'la propina extra');
          });
      },
    };
  };
  async function cocinar(ctx: Ctx, r: ReturnType<typeof vistaRestaurante>, pid: string) {
    await ctx.e.paso('el restaurante lo acepta', async () => {
      await pausa(ctx, 2_000, 6_000);
      esperarOk(ctx, await r.aceptar(pid, ctx.e.azar.entero(5, 20)), 'acepta');
    });
    await ctx.e.paso('lo prepara y lo marca listo', async () => {
      await pausa(ctx, 4_000, 12_000);
      esperarOk(ctx, await r.listo(pid), 'listo');
    });
  }

  const enviados = new Set<ResultadoEscenario>();
  const filasHastaAhora = async () => {
    const r = await sistema.post('/datos/interno/diagnostico/vuelta', { id: vueltaDe('base') });
    return Number((r.datos as { vuelta?: { escritas?: number } | null })?.vuelta?.escritas ?? 0);
  };
  /** Local: cada pedido es su propia vuelta y se mide solo. En pruebas la sesión entera es una. */
  const filasDe = async (ctx: Ctx) => {
    if (d.modo !== 'local') return null;
    const r = await sistema.post('/datos/interno/diagnostico/vuelta', { id: ctx.vuelta });
    const v = (r.datos as { vuelta?: { leidas?: number; escritas?: number } | null })?.vuelta;
    return { leidas: Number(v?.leidas ?? 0), escritas: Number(v?.escritas ?? 0) };
  };
  const resumen = (hechos: readonly ResultadoEscenario[]) => ({
    pedidos: hechos.length,
    bien: hechos.filter((h) => h.ok).length,
    fallos: hechos.filter((h) => !h.ok).length,
  });
  const sesion = await correrSesion<Ctx>({
    corrida,
    semilla,
    destino,
    reloj: relojReal,
    concurrencia: CONCURRENCIA,
    pausaMs: () => azar.entero(3_000, 9_000),
    siguiente: historia,
    contexto: (e, n) => crearCtx(d, e, vueltaDe(`p${n + 1}`), `${corrida.slice(-6)}p${n + 1}`),
    despues: (_e, ctx) => cerrarEscenario(ctx, { desconectar: false }),
    filas: (ctx) => filasDe(ctx),
    alTerminar: (r) =>
      console.warn(
        `  ${r.nombre}: ${veredicto(r) === 'falla' || veredicto(r) === 'conocido' ? 'ROJO' : 'verde'} en ${(r.ms / 1000).toFixed(0)} s${r.error ? ` — ${r.error}` : ''}`,
      ),
    alAvanzar: async (hechos) => {
      const nuevos = hechos.filter((h) => !h.ok && !enviados.has(h));
      nuevos.forEach((h) => enviados.add(h));
      const estado = await avisar({
        accion: 'avance',
        resumen: resumen(hechos),
        fallos: nuevos.map((h) => ({
          cuando: new Date().toISOString(),
          comportamiento: h.etiquetas[0] ?? '',
          mensaje: `${h.nombre}: ${h.error ?? ''}`.slice(0, 500),
        })),
      });
      if (estado === 'parar') {
        parar = true;
        motivoFin = 'lo pidió el superadmin (Parar)';
      }
      if (d.modo === 'staging') {
        const filas = await filasHastaAhora();
        if (filas >= FRENO_FILAS) {
          parar = true;
          motivoFin = `llegó a ${filas} filas escritas (freno en ${FRENO_FILAS}; tope ${6_000})`;
        }
      }
      return !parar;
    },
  });
  abierta = false;
  await despachador;
  resultados.push(...sesion.escenarios);

  // 4. Cierre: el libro del día, los repartidores se desconectan y los restaurantes cierran.
  const cierre: Escenario<Ctx> = {
    nombre: 'La ciudad cierra',
    descripcion: `Fin de la sesión (${motivoFin}). El libro del día cuadra; repartidores desconectados y restaurantes cerrados.`,
    async correr(e, ctx) {
      const ultimo = sesion.escenarios.at(-1);
      await e.paso('el libro del día cuadra', async () => {
        const pid = (
          await ctx.uno(
            `SELECT id FROM pedidos WHERE restaurante_id IN (${restaurantes.map((r) => `'${limpio(r.rid)}'`).join(',')}) ORDER BY creado_en DESC LIMIT 1`,
          )
        )?.id;
        if (pid) await libroCuadra(ctx, String(pid));
        else e.nota('sin pedidos en la sesión');
        if (ultimo) e.nota(`último: ${ultimo.nombre}`);
      });
      await e.paso('todos a casa', async () => {
        for (const p of pool) await vistaRepartidor(ctx, p.datos).desconectar();
        for (const r of restaurantes) await vistaRestaurante(ctx, r).cerrar();
      });
    },
  };
  const r2 = await correrLibreto<Ctx>({
    corrida,
    semilla,
    destino,
    reloj: relojReal,
    escenarios: [cierre],
    contexto: (e) => crearCtx(d, e, vueltaDe('base'), `${corrida.slice(-6)}z`),
  });
  resultados.push(...r2.escenarios);
  await avisar({
    accion: 'terminar',
    resumen: resumen(sesion.escenarios),
    fallos: r2.escenarios
      .filter((h) => !h.ok)
      .map((h) => ({
        cuando: new Date().toISOString(),
        comportamiento: 'cierre',
        mensaje: h.error ?? '',
      })),
  });
  // Lo que escribió la sesión entera (en pruebas, la vuelta que vigila el tope de 6.000).
  const base = Number(await filasHastaAhora());
  const porPedido = sesion.escenarios.reduce((t, x) => t + (x.filas?.escritas ?? 0), 0);
  const total = d.modo === 'staging' ? base : base + porPedido;
  const hechos = sesion.escenarios.length;
  const notaFilas = `Filas escritas en la sesión: ${total}${hechos ? ` (unas ${Math.round(total / hechos)} por pedido, contando la población)` : ''}.`;
  console.warn(`ciudad: terminó porque ${motivoFin}. ${notaFilas}`);
  return terminar(resultados, `Terminó porque ${motivoFin}. ${notaFilas}`);

  function terminar(todos: ResultadoEscenario[], nota?: string): number {
    const conFilas = todos.filter((r) => r.filas);
    const final: ResultadoCorrida = {
      corrida,
      semilla,
      destino,
      inicio: new Date(inicio).toISOString(),
      ms: relojReal.ahora() - inicio,
      ok: todos.every((r) => r.ok),
      escenarios: todos,
      filas: conFilas.length
        ? {
            leidas: conFilas.reduce((s, r) => s + (r.filas?.leidas ?? 0), 0),
            escritas: conFilas.reduce((s, r) => s + (r.filas?.escritas ?? 0), 0),
          }
        : null,
      notas: [
        `Modo ciudad, sesión ${sesionId}: ${N_REST} restaurantes, ${N_REP} repartidores, ${N_CLI} clientes.`,
        ...(nota ? [nota] : []),
      ],
    };
    const carpeta = op.reporte ?? join(import.meta.dirname, '..', 'reportes', corrida);
    const { html } = escribirReporte(final, carpeta);
    if (process.env.GITHUB_STEP_SUMMARY)
      // El archivo del resumen lo da GitHub en la corrida.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumenMarkdown(final));
    const n = contar(final);
    console.warn(
      `ciudad: ${n.bien} de ${n.total} en verde, ${n.fallas} con fallos.\nReporte: ${html}`,
    );
    return final.ok ? 0 : 1;
  }
}
