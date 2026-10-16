import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * C-TRANSICIONES-PEDIDO: la tabla transiciones_pedido coincide con lo que el producto hace de
 * verdad. Lee el código del servidor, saca cada cambio de estado de un pedido y lo compara con
 * las filas de schema.sql, en los dos sentidos:
 *  - todo cambio que escribe el código está permitido en la tabla (si no, la base lo rechazaría
 *    en producción);
 *  - toda fila de la tabla la usa el código (si no, la tabla permite algo que nadie hace).
 */
const SRC = join(__dirname);
const leer = (r: string) => readFileSync(join(SRC, r), 'utf8');
const ARCHIVOS = ['rutas/operacion.ts', 'rutas/pedidos.ts', 'manager.ts'];

type Par = `${string}->${string}`;
const par = (d: string, h: string): Par => `${d}->${h}`;

function tablaDelEsquema() {
  const schema = readFileSync(join(SRC, '..', '..', '..', 'schema.sql'), 'utf8');
  const bloque = /INSERT OR IGNORE INTO transiciones_pedido[^;]*;/.exec(schema)![0];
  const filas = [...bloque.matchAll(/\('(\w+)', '(\w+)', (\d)\)/g)];
  return {
    normales: new Set(filas.filter((f) => f[3] === '0').map((f) => par(f[1]!, f[2]!))),
    reversiones: new Set(filas.filter((f) => f[3] === '1').map((f) => par(f[1]!, f[2]!))),
  };
}

const lista = (txt: string) => [...txt.matchAll(/'(\w+)'/g)].map((m) => m[1]!);

function cambiosDelCodigo() {
  const normales = new Set<Par>();
  const reversiones = new Set<Par>();
  const sinGuarda: string[] = [];
  const desdeCancelables = new Set<string>();
  for (const archivo of ARCHIVOS) {
    const src = leer(archivo);
    // 1. UPDATE pedidos SET estado = '<hacia>' … WHERE … estado = '<desde>' | estado IN (…)
    for (const m of src.matchAll(/UPDATE pedidos SET estado = '(\w+)'[^"`]*?WHERE([^"`]*)["`]/g)) {
      const hacia = m[1]!;
      const donde = m[2]!;
      const uno = /estado = '(\w+)'/.exec(donde);
      const varios = /estado IN \(([^)]*)\)/.exec(donde);
      const desde = uno ? [uno[1]!] : varios ? lista(varios[1]!) : [];
      // «estado = ?»: el estado de partida llega como parámetro. En cancelarConReembolso sale
      // de las listas `desde: [...]` de quien la llama, que el paso 3 ya lee.
      const porParametro = /estado = \?/.test(donde);
      if (!desde.length && !porParametro) sinGuarda.push(`${archivo}: → ${hacia}`);
      for (const d of desde) normales.add(par(d, hacia));
    }
    // 2. cambiarEstado(…, ['<desde>'…], '<hacia>', …) (rutas del restaurante)
    for (const m of src.matchAll(/cambiarEstado\(\s*[^[]*\[([^\]]*)\],\s*'(\w+)'/g))
      for (const d of lista(m[1]!)) normales.add(par(d, m[2]!));
    // 3. cancelarConReembolso(…, { desde: [ … ] }) → cancelado
    for (const m of src.matchAll(/desde: \[([^\]]*)\]/g))
      for (const d of lista(m[1]!)) {
        normales.add(par(d, 'cancelado'));
        desdeCancelables.add(d);
      }
  }
  // 4. La vuelta atrás del Manager: «SET estado = ?, cancelado_en = NULL … WHERE estado = 'cancelado'»
  //    devuelve el pedido a cualquier estado desde el que se pudo cancelar.
  if (
    /UPDATE pedidos SET estado = \?, cancelado_en = NULL WHERE id = \? AND estado = 'cancelado'/.test(
      leer('manager.ts'),
    )
  )
    for (const d of desdeCancelables) reversiones.add(par('cancelado', d));
  return { normales, reversiones, sinGuarda };
}

/**
 * Los UPDATE sin `estado` en el WHERE: su estado de partida lo garantiza una lectura justo antes.
 * Se listan aquí uno por uno; uno nuevo hace fallar la prueba y obliga a revisarlo.
 */
const SIN_GUARDA_REVISADOS: Record<string, Par> = {
  // Avisos de Stripe: el código comprueba `pedido.estado === 'pago_pendiente'` antes (3 avisos).
  'rutas/pedidos.ts: → pagado': par('pago_pendiente', 'pagado'),
  // Entrega del repartidor: la ruta exige el pedido «en_camino» y suyo antes de capturar.
  // Recogida en el local: exige «listo». Por eso las dos filas.
  'rutas/operacion.ts: → entregado': par('en_camino', 'entregado'),
};

describe('la tabla de transiciones coincide con el código real (C-TRANSICIONES-PEDIDO)', () => {
  const tabla = tablaDelEsquema();
  const codigo = cambiosDelCodigo();

  it('la tabla tiene 12 filas: 9 transiciones normales y 3 vueltas atrás', () => {
    expect(tabla.normales.size).toBe(9);
    expect(tabla.reversiones.size).toBe(3);
  });

  it('todo cambio de estado que escribe el código está permitido en la tabla', () => {
    for (const p of codigo.normales) expect(tabla.normales, `el código hace ${p}`).toContain(p);
    for (const p of codigo.reversiones)
      expect(tabla.reversiones, `el código revierte ${p}`).toContain(p);
  });

  it('los cambios sin guarda en el WHERE son exactamente los revisados', () => {
    const unicos = [...new Set(codigo.sinGuarda)].sort();
    expect(unicos).toEqual(Object.keys(SIN_GUARDA_REVISADOS).sort());
    for (const p of Object.values(SIN_GUARDA_REVISADOS)) expect(tabla.normales).toContain(p);
    expect(tabla.normales).toContain(par('listo', 'entregado'));
  });

  it('toda fila de la tabla la usa el código: no hay transiciones de más', () => {
    const usadas = new Set<Par>([
      ...codigo.normales,
      ...Object.values(SIN_GUARDA_REVISADOS),
      par('listo', 'entregado'), // recogida en el local (sin guarda, ver arriba)
    ]);
    for (const p of tabla.normales) expect(usadas, `nadie usa ${p}`).toContain(p);
    for (const p of tabla.reversiones)
      expect(codigo.reversiones, `nadie revierte ${p}`).toContain(p);
  });
});
