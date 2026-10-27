import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { optimizarRuta } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';
import { vencerOfertasFlex } from './automatizacion';
import { repartirEventos } from './integraciones';

/**
 * Divoox Flex · Fase 3: medición de escala (C-FLEX-ESCALA). No corre en `npm run verify` (tarda);
 * se corre a mano con:  FLEX_ESCALA=1 npx vitest run apps/servidor/src/flex/escala.test.ts
 *
 * Siembra N empresas, cada una con una ruta EN CURSO de P paquetes (una parada por paquete) y su
 * historial de custodia (4 eventos por paquete, que a su vez llenan la bandeja de eventos), y mide
 * las consultas que más se usan. Es SQLite local en memoria: mide el costo de las consultas y que
 * usen índices; NO mide la red de D1 (cada consulta en producción suma unos milisegundos de viaje).
 */
const B = '/datos/v1/flex';
const ESCENARIOS: [number, number][] = [
  [10, 40],
  [10, 150],
  [100, 40],
  [100, 150],
  [1000, 40],
  [1000, 150],
];

async function sembrar(
  m: ReturnType<typeof mundo>,
  n: number,
  p: number,
  dueno: string,
  conductor: string,
) {
  const db = m.DB;
  const serie = `WITH RECURSIVE s(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM s WHERE i < ?1 - 1)`;
  const ids = `WITH RECURSIVE s(i) AS (SELECT 0 UNION ALL SELECT i + 1 FROM s WHERE i < ?1 * ?2 - 1)`;
  const pasos = [
    db
      .prepare(
        `${serie} INSERT INTO usuarios (id, correo, nombre, rol, clave_hash)
         SELECT 'u' || i, 'c' || i || '@escala.test', 'Conductor ' || i, 'repartidor', 'x' FROM s WHERE i > 0`,
      )
      .bind(n),
    db
      .prepare(
        `${serie} INSERT INTO empresas (id, nombre, pais, moneda, dueno_id)
         SELECT 'e' || i, 'Empresa ' || i, 'US', 'USD', ?2 FROM s`,
      )
      .bind(n, dueno),
    db
      .prepare(
        `INSERT INTO empresa_miembros (empresa_id, usuario_id, rol) VALUES ('e0', ?, 'dueno')`,
      )
      .bind(dueno),
    db
      .prepare(
        `${serie} INSERT INTO empresa_centros (id, empresa_id, nombre, direccion, pais, ciudad, lat, lng)
         SELECT 'h' || i, 'e' || i, 'Centro', 'Calle 1', 'US', 'Miami', 25.77, -80.19 FROM s`,
      )
      .bind(n),
    db
      .prepare(
        `${serie} INSERT INTO rutas_flex (id, empresa_id, centro_id, nombre, conductor_id, estado, modalidad, iniciada_en)
         SELECT 'r' || i, 'e' || i, 'h' || i, 'Ruta ' || i, CASE WHEN i = 0 THEN ?2 ELSE 'u' || i END,
                'en_curso', 'asignacion', datetime('now') FROM s`,
      )
      .bind(n, conductor),
    db
      .prepare(
        `${serie} INSERT INTO conductor_ocupacion (conductor_id, tipo, ruta_id)
         SELECT CASE WHEN i = 0 THEN ?2 ELSE 'u' || i END, 'ruta_flex', 'r' || i FROM s`,
      )
      .bind(n, conductor),
    db
      .prepare(
        `${ids} INSERT INTO envios (id, empresa_id, centro_id, referencia_externa, destinatario_nombre, direccion, lat, lng, estado)
         SELECT 'v' || i, 'e' || CAST(i / ?2 AS INTEGER), 'h' || CAST(i / ?2 AS INTEGER), 'REF-' || i, 'Destinatario', 'Calle ' || i,
                25.70 + (i % CAST(?2 AS INTEGER)) * 0.001, -80.20 + ((i * 7) % CAST(?2 AS INTEGER)) * 0.001, 'en_proceso' FROM s`,
      )
      .bind(n, p),
    db
      .prepare(
        `${ids} INSERT INTO paquetes (id, envio_id, empresa_id, codigo_seguimiento, codigo_etiqueta, peso_g, estado)
         SELECT 'k' || i, 'v' || i, 'e' || CAST(i / ?2 AS INTEGER), 'DVX' || i, 'ET' || i, 1500, 'en_transito' FROM s`,
      )
      .bind(n, p),
    db
      .prepare(
        `${ids} INSERT INTO ruta_paradas (id, ruta_id, orden, envio_id, estado)
         SELECT 'pa' || i, 'r' || CAST(i / ?2 AS INTEGER), (i % CAST(?2 AS INTEGER)) + 1, 'v' || i, 'pendiente' FROM s`,
      )
      .bind(n, p),
    db
      .prepare(
        `${ids} INSERT INTO ruta_paquetes (ruta_id, paquete_id, parada_id, empresa_id, cargado_en)
         SELECT 'r' || CAST(i / ?2 AS INTEGER), 'k' || i, 'pa' || i, 'e' || CAST(i / ?2 AS INTEGER), datetime('now') FROM s`,
      )
      .bind(n, p),
  ];
  for (const [i, paso] of pasos.entries())
    await paso.run().catch((e: unknown) => {
      throw new Error(`siembra paso ${i}: ${String(e)}`);
    });
  // Custodia: 4 eventos por paquete (los disparadores llenan la bandeja de eventos).
  for (const tipo of ['creado', 'asignado', 'cargado', 'en_transito'])
    await db
      .prepare(
        `${ids} INSERT INTO paquete_eventos (paquete_id, empresa_id, tipo, actor_tipo, operacion_ref, idempotencia)
         SELECT 'k' || i, 'e' || CAST(i / ?2 AS INTEGER), ?3, 'sistema', CASE WHEN ?3 = 'creado' THEN NULL ELSE 'r' || CAST(i / ?2 AS INTEGER) END,
                'esc:' || ?3 || ':' || i FROM s`,
      )
      .bind(n, p, tipo)
      .run();
}

async function medir(f: () => Promise<unknown>, veces = 5): Promise<number> {
  const t: number[] = [];
  for (let i = 0; i < veces; i++) {
    const a = performance.now();
    await f();
    t.push(performance.now() - a);
  }
  t.sort((x, y) => x - y);
  return Math.round((t[Math.floor(t.length / 2)] ?? 0) * 10) / 10;
}

describe.skipIf(!process.env.FLEX_ESCALA)('Flex · medición de escala (C-FLEX-ESCALA)', () => {
  it('mide las consultas clave con 10, 100 y 1000 empresas y rutas de 40 y 150 paquetes', async () => {
    const filas: Record<string, unknown>[] = [];
    for (const [n, p] of ESCENARIOS) {
      const m = mundo();
      const dueno = await m.cuenta('cliente', 'Dueña Escala');
      const cond = await m.cuenta('repartidor', 'Conductor Escala');
      const tSiembra = performance.now();
      await sembrar(m, n, p, dueno.id, cond.id);
      const siembraMs = Math.round(performance.now() - tSiembra);
      const pedir = async (ruta: string, token: string, metodo = 'GET', cuerpo?: unknown) => {
        const r = await m.llamar(metodo, ruta, cuerpo, token);
        expect(r.estado, ruta).toBe(200);
        return r;
      };
      const fila = {
        empresas: n,
        paquetesPorRuta: p,
        paquetesTotales: n * p,
        eventosBandeja: Number(
          (await m.DB.prepare('SELECT COUNT(*) AS c FROM flex_eventos').first<{ c: number }>())?.c,
        ),
        siembraMs,
        rutasEnCursoMs: await medir(() => pedir(`${B}/empresas/e0/rutas-operativas`, dueno.token)),
        detalleRutaMs: await medir(() => pedir(`${B}/empresas/e0/rutas/r0/detalle`, dueno.token)),
        indicadoresMs: await medir(() => pedir(`${B}/empresas/e0/operaciones`, dueno.token)),
        rutaConductorMs: await medir(() => pedir(`${B}/conductor/rutas/r0`, cond.token)),
        optimizarMs: await medir(() =>
          pedir(`${B}/empresas/e0/rutas/r0/optimizar`, dueno.token, 'POST', {}),
        ),
        optimizarPuroMs: await medir(async () =>
          optimizarRuta(
            Array.from({ length: p }, (_, i) => ({
              id: `x${i}`,
              lat: 25.7 + ((i * 7919) % p) / 1000,
              lng: -80.3 + ((i * 104729) % p) / 1000,
            })),
            { lat: 25.77, lng: -80.19 },
          ),
        ),
        vencerOfertasMs: await medir(() => vencerOfertasFlex(m.extra as never, m.DB)),
        repartir300EventosMs: await medir(() => repartirEventos(m.DB, 300), 3),
      };
      // Las consultas de la empresa no deben recorrer tablas enteras.
      const plan = (
        await m.DB.prepare(
          `EXPLAIN QUERY PLAN SELECT * FROM rutas_flex r WHERE r.empresa_id = 'e0' AND r.estado = 'en_curso'`,
        ).all<{ detail: string }>()
      ).results.map((x) => x.detail);
      expect(plan.join(' ')).toMatch(/USING INDEX|USING COVERING INDEX/);
      filas.push(fila);
      console.warn(JSON.stringify(fila));
    }
    writeFileSync(
      fileURLToPath(new URL('../../../../docs/flex-escala-fase3.json', import.meta.url).href),
      `${JSON.stringify({ medidoEn: new Date().toISOString(), nota: 'SQLite local en memoria (node:sqlite), mediana de 5 corridas; no incluye la red de D1.', escenarios: filas }, null, 2)}\n`,
    );
  }, 600_000);
});
