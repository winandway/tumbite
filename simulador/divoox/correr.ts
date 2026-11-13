import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  type Escenario,
  contar,
  correrLibreto,
  escribirReporte,
  filtrar,
  relojReal,
  resumenMarkdown,
  semillaDe,
  veredicto,
} from '../nucleo/index.ts';
import { destinoDesdeEntorno, levantarServidorLocal } from './destino.ts';
import { libroCuadra, pedidosDelLibro } from './dinero.ts';
import { ESCENARIOS } from './escenarios.ts';
import { ESCENARIOS_MOTO } from './moto.ts';
import { type Ctx, cerrarEscenario, crearCtx } from './mundo.ts';

/**
 * El simulador de compras y entregas de Divoox. Todos los países.
 *
 *   npm run simulador                       toda la batería contra el servidor LOCAL (lo arma solo)
 *   npm run simulador -- --solo "rechaza"   solo los escenarios cuyo nombre contiene ese texto
 *   npm run simulador -- --etiqueta diario  solo los del subconjunto diario
 *   npm run simulador -- --semilla 1234     repite una corrida (mismos nombres, rutas y manías)
 *   SIMULADOR_URL=https://staging.tumbite.com SIMULADOR_SECRETO=… npm run simulador -- --etiqueta diario
 *                                           contra el sitio de pruebas (lo hace el flujo de GitHub)
 *
 * Deja el reporte en simulador/reportes/<corrida>/ (reporte.html y reporte.json). Sale con error si
 * algún escenario quedó en rojo (también los fallos conocidos: no se esconden).
 */
const { values: op } = parseArgs({
  options: {
    solo: { type: 'string' },
    etiqueta: { type: 'string' },
    semilla: { type: 'string' },
    corrida: { type: 'string' },
    reporte: { type: 'string' },
  },
});

const remoto = Boolean(process.env.SIMULADOR_URL ?? process.env.RECORRIDO_URL);
const apagar = remoto ? () => {} : await levantarServidorLocal();
let codigo = 1;
try {
  const d = destinoDesdeEntorno();
  const semilla = semillaDe(op.semilla);
  const corrida =
    op.corrida ?? process.env.SIMULADOR_CORRIDA ?? `${Date.now().toString(36)}-${semilla}`;
  // En el sitio de pruebas TODA la corrida es una sola vuelta de pruebas (tope de 6.000 filas);
  // en local cada escenario lleva la suya para medirla por separado.
  const vueltaDe = (i: number) =>
    d.modo === 'staging' ? `simulador-${corrida}` : `simulador-${corrida}-e${i + 1}`;
  const escenarios = filtrar(
    [...ESCENARIOS, ...ESCENARIOS_MOTO].filter(
      (e) => d.modo === 'local' || !(e.etiquetas ?? []).includes('solo-local'),
    ),
    { solo: op.solo ?? null, etiqueta: op.etiqueta ?? null },
  );
  if (!escenarios.length) throw new Error('Ningún escenario coincide con el filtro.');
  // C-LECTURAS-POR-PETICION (13 nov 2026): el libro del día se concilia UNA vez, al final, con los
  // pedidos de todos los escenarios (antes una vez por escenario: cada una lee el día entero).
  const libroFinal: Escenario<Ctx> = {
    nombre: 'El libro del día cuadra (una vez, al final de la corrida)',
    descripcion:
      'La conciliación del servidor con todos los pedidos de la corrida: el libro del día cuadra por dentro y, en el sitio de pruebas, cada cobro coincide con Stripe (modo prueba).',
    async correr(e, ctx) {
      await e.paso('el libro del día cuadra', async () => {
        if (pedidosDelLibro.size) await libroCuadra(ctx, [...pedidosDelLibro]);
        else e.nota('ningún escenario dejó pedidos para conciliar');
      });
    },
  };
  escenarios.push(libroFinal);
  console.warn(
    `simulador: ${escenarios.length} escenarios contra ${d.base} (semilla ${semilla}, corrida ${corrida})`,
  );
  const leidasAntes = new Map<number, { leidas: number; escritas: number }>();
  const cuentaVuelta = async (ctx: Ctx) => {
    const r = await ctx.sistema.post('/datos/interno/diagnostico/vuelta', { id: ctx.vuelta });
    const v = (r.datos as { vuelta?: { leidas: number; escritas: number } | null })?.vuelta;
    return { leidas: Number(v?.leidas ?? 0), escritas: Number(v?.escritas ?? 0) };
  };
  const resultado = await correrLibreto<Ctx>({
    corrida,
    semilla,
    destino:
      d.modo === 'local' ? `el servidor local (${d.base})` : `el sitio de pruebas (${d.base})`,
    reloj: relojReal,
    escenarios,
    contexto: async (e, i) => {
      const ctx = crearCtx(d, e, vueltaDe(i), `${corrida.slice(-6)}e${i + 1}${e.azar.id(3)}`);
      leidasAntes.set(i, await cuentaVuelta(ctx));
      return ctx;
    },
    despues: (_e, ctx) => cerrarEscenario(ctx),
    filas: async (ctx, i) => {
      const ahora = await cuentaVuelta(ctx);
      const antes = leidasAntes.get(i) ?? { leidas: 0, escritas: 0 };
      return { leidas: ahora.leidas - antes.leidas, escritas: ahora.escritas - antes.escritas };
    },
    alEmpezar: (e, i, n) => console.warn(`  [${i + 1}/${n}] ${e.nombre}…`),
    alTerminar: (r) =>
      console.warn(
        `        ${{ bien: 'verde', falla: 'ROJO', conocido: 'rojo (fallo conocido)', yaNoFalla: 'verde (ya no falla: quitar la marca)' }[veredicto(r)]} en ${(r.ms / 1000).toFixed(1)} s${r.filas ? `, ${r.filas.escritas} filas escritas` : ''}${r.error ? `\n        ${r.error}` : ''}`,
      ),
  });
  const carpeta = op.reporte ?? join(import.meta.dirname, '..', 'reportes', corrida);
  const { html } = escribirReporte(resultado, carpeta);
  if (process.env.GITHUB_STEP_SUMMARY)
    // El archivo del resumen lo da GitHub en la corrida.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, resumenMarkdown(resultado));
  const n = contar(resultado);
  console.warn(
    `simulador: ${n.bien} de ${n.total} en verde, ${n.fallas} fallas nuevas, ${n.conocidos} fallos conocidos${resultado.filas ? `, ${resultado.filas.escritas} filas escritas` : ''}.\nReporte: ${html}`,
  );
  codigo = resultado.ok ? 0 : 1;
} catch (e) {
  console.error('simulador:', e instanceof Error ? e.message : e);
} finally {
  apagar();
}
process.exit(codigo);
