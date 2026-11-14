import { afterEach, describe, expect, it, vi } from 'vitest';
import { distanciaKm } from '@tumbite/compartido';
import { conPatrocinados } from './anuncios';
import { minutosPausa } from './pausa';
import { promocionesVigentes } from './promociones';
import { mundo } from './pruebas/ayuda';
import {
  type Lectura,
  medidorDeLecturas,
  sembrarCatalogo,
  sembrarVolumen,
} from './pruebas/lecturas';
import { aRestaurante, conCalificaciones, conHorarios } from './rutas/catalogo';
import { ZONA_INICIAL, zonaPara } from './rutas/zonas';

/**
 * C-LECTURAS-CATALOGO (14 nov 2026, orden de Richard; regla «la nube no se come el dinero»). Todos
 * los países. `GET /datos/restaurantes` (lo primero que abre CADA cliente) leyó 179.848 filas en
 * una vuelta del sitio de pruebas: la calificación de cada restaurante unía `calificaciones` con
 * TODOS los pedidos de su historia, y los turnos se leían restaurante por restaurante.
 *
 * Esta prueba arma la base con el volumen del sitio de pruebas (600 restaurantes en una zona,
 * 100.000 pedidos viejos, 33.000 calificaciones, 6.300 turnos, cierres y promociones) y fija:
 * (1) la respuesta es EXACTAMENTE la de antes (comparada con la implementación vieja, copiada
 * aquí), (2) un tope de filas leídas y CERO escrituras, (3) el resumen sigue al día.
 */
afterEach(() => vi.unstubAllGlobals());

type FilaRest = Record<string, unknown>;

/** La implementación de antes del 14 nov (copiada tal cual de rutas/catalogo.ts). */
async function listadoViejo(db: D1Database, q: { lat?: number; lng?: number; zona?: string }) {
  const lat = Number(q.lat);
  const lng = Number(q.lng);
  const tieneCoords = Number.isFinite(lat) && Number.isFinite(lng);
  const zona = q.zona
    ? { id: q.zona }
    : tieneCoords
      ? await zonaPara(db, lat, lng)
      : { id: ZONA_INICIAL };
  if (!zona) return { restaurantes: [], zona: null, fueraDeZona: true };
  const { results } = await db
    .prepare(
      `SELECT * FROM restaurantes WHERE zona_id = ? AND estado = 'aprobado'
       AND tipo_comercio = 'restaurante'
       AND (NOT EXISTS (SELECT 1 FROM areas WHERE zona_id = ?1 AND estado <> 'borrador')
            OR area_id IN (SELECT id FROM areas WHERE zona_id = ?1 AND estado = 'activa'))
       ORDER BY abierto DESC, nombre`,
    )
    .bind(zona.id)
    .all<FilaRest>();
  const minutos = await minutosPausa(db);
  let lista = await conCalificaciones(
    db,
    (await conHorarios(db, results)).map((f) => aRestaurante(f, minutos)),
  );
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    lista = lista
      .map((r) =>
        r.lat != null && r.lng != null
          ? {
              ...r,
              distanciaKm:
                Math.round(distanciaKm({ lat, lng }, { lat: r.lat, lng: r.lng }) * 10) / 10,
            }
          : r,
      )
      .sort(
        (a, b) =>
          Number(b.abiertoAhora) - Number(a.abiertoAhora) ||
          (a.distanciaKm ?? 999) - (b.distanciaKm ?? 999),
      );
  }
  const conAnuncios = await conPatrocinados(db, lista);
  const promos = await promocionesVigentes(
    db,
    conAnuncios.map((r) => r.id),
  );
  return {
    restaurantes: conAnuncios.map((r) => {
      const suyas = promos.get(r.id);
      return suyas ? { ...r, promocion: suyas[0], promociones: suyas } : r;
    }),
    zona: { id: zona.id },
    fueraDeZona: false,
  };
}

async function escenario() {
  let medidor!: ReturnType<typeof medidorDeLecturas>;
  const m = mundo(
    {},
    { host: 'staging.tumbite.com', envolver: (db) => (medidor = medidorDeLecturas(db)).db },
  );
  await sembrarVolumen(m.DB);
  await sembrarCatalogo(m.DB);
  await m.llamar('GET', '/datos/version'); // la migración (y el relleno del resumen), fuera de la cuenta
  return { m, medidor };
}

const culpables = (l: Lectura[]) =>
  l
    .filter((x) => x.filas > 20)
    .map((x) => `${x.filas} filas (${x.escaneos.join(', ')}): ${x.sql}`)
    .join('\n');
const cambios = async (db: D1Database) =>
  Number((await db.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0);

describe('C-LECTURAS-CATALOGO · el listado de restaurantes', () => {
  it('devuelve EXACTAMENTE lo mismo que la implementación vieja (con coordenadas, por zona y sin nada)', async () => {
    const { m } = await escenario();
    // Restaurantes con 10 opiniones o más (calificación pública) y una cambiada y otra borrada.
    await m.DB.prepare(
      "UPDATE calificaciones SET estrellas_restaurante = 1 WHERE pedido_id IN ('vol-h-3', 'vol-h-603')",
    ).run();
    await m.DB.prepare("DELETE FROM calificaciones WHERE pedido_id = 'vol-h-1203'").run();
    await m.DB.prepare(
      "DELETE FROM horarios_restaurante WHERE restaurante_id = 'vol-r-4' AND abre = '18:00'",
    ).run();
    await m.DB.prepare(
      "INSERT INTO horarios_restaurante (restaurante_id, dia, abre, cierra) VALUES ('vol-r-5', 3, '06:00', '07:00')",
    ).run();
    for (const [ruta, q] of [
      ['/datos/restaurantes?lat=25.77&lng=-80.19', { lat: 25.77, lng: -80.19 }],
      ['/datos/restaurantes?zona=US-FL-MIAMI', { zona: 'US-FL-MIAMI' }],
      ['/datos/restaurantes', {}],
    ] as const) {
      const nuevo = await m.llamar('GET', ruta);
      expect(nuevo.estado).toBe(200);
      const viejo = await listadoViejo(m.DB, q);
      expect(viejo.restaurantes.length, ruta).toBeGreaterThan(0);
      expect(JSON.stringify(nuevo.datos), ruta).toBe(JSON.stringify(viejo));
    }
    // Hay de todo en la muestra: calificaciones públicas, promociones, abiertos y cerrados.
    const r = await m.llamar('GET', '/datos/restaurantes?lat=25.77&lng=-80.19');
    const lista = r.datos.restaurantes as { calificacion: unknown; promocion?: unknown }[];
    expect(lista.some((x) => x.calificacion)).toBe(true);
    expect(lista.some((x) => x.promocion)).toBe(true);
  }, 120_000);

  it('lee una fila por restaurante, no la historia de pedidos, y no escribe nada', async () => {
    const { m, medidor } = await escenario();
    const viejo = await medidor.medir(() => listadoViejo(medidor.db, { lat: 25.77, lng: -80.19 }));
    const antes = await cambios(m.DB);
    const todo = await medidor.medir(() =>
      m.llamar('GET', '/datos/restaurantes?lat=25.77&lng=-80.19'),
    );
    const pagina = await medidor.medir(() =>
      m.llamar('GET', '/datos/restaurantes?lat=25.77&lng=-80.19&limite=30'),
    );
    expect(await cambios(m.DB), 'el listado no escribe').toBe(antes);
    expect(todo.resultado.estado).toBe(200);
    expect(pagina.resultado.estado).toBe(200);
    // Antes: más de cien mil filas con esta base (la historia de pedidos de cada restaurante).
    expect(viejo.total, culpables(viejo.lecturas)).toBeGreaterThan(100_000);
    // Una zona de 600 restaurantes, página de 30: menos de 2.000 filas.
    expect(
      pagina.total,
      `página leyó ${pagina.total}:\n${culpables(pagina.lecturas)}`,
    ).toBeLessThan(2_000);
    // El listado entero (las apps publicadas no piden página): las 600 filas y las promociones.
    expect(todo.total, `todo leyó ${todo.total}:\n${culpables(todo.lecturas)}`).toBeLessThan(2_500);
    const datos = pagina.resultado.datos as {
      restaurantes: unknown[];
      pagina: { total: number; siguiente: number | null };
    };
    expect(datos.restaurantes).toHaveLength(30);
    expect(datos.pagina).toMatchObject({ desde: 0, limite: 30, siguiente: 30 });
    // La página es el mismo orden que el listado entero.
    const enteros = (todo.resultado.datos as { restaurantes: { id: string }[] }).restaurantes;
    expect((datos.restaurantes as { id: string }[]).map((x) => x.id)).toEqual(
      enteros.slice(0, 30).map((x) => x.id),
    );
    const segunda = await m.llamar(
      'GET',
      '/datos/restaurantes?lat=25.77&lng=-80.19&limite=30&desde=30',
    );
    expect((segunda.datos.restaurantes as { id: string }[]).map((x) => x.id)).toEqual(
      enteros.slice(30, 60).map((x) => x.id),
    );
  }, 120_000);

  it('el resumen de calificaciones y turnos sigue al día con altas, cambios y bajas', async () => {
    const m = mundo();
    await m.llamar('GET', '/datos/version');
    const ins = (sql: string) => m.DB.prepare(sql).run();
    await ins(
      "INSERT INTO usuarios (id, correo, nombre, rol, clave_hash) VALUES ('c1','c1@ejemplo.com','C','cliente','x'), ('d1','d1@ejemplo.com','D','restaurante','x')",
    );
    await ins("INSERT INTO restaurantes (id, dueno_id, nombre) VALUES ('rest1', 'd1', 'Local')");
    for (const id of ['p1', 'p2', 'p3'])
      await m.DB.prepare(
        `INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio,
           cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan, direccion)
         VALUES (?, 'c1', 'rest1', 'entregado', '[]', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'basico', 'Calle 1')`,
      )
        .bind(id)
        .run();
    const resumen = () =>
      m.DB.prepare(
        "SELECT calif_suma AS s, calif_n AS n, horarios_json AS h FROM restaurantes WHERE id = 'rest1'",
      ).first<{ s: number; n: number; h: string | null }>();
    await ins(
      "INSERT INTO calificaciones (pedido_id, estrellas_restaurante, estrellas_repartidor) VALUES ('p1', 5, 5), ('p2', 3, 4), ('p3', NULL, 4)",
    );
    expect(await resumen()).toMatchObject({ s: 8, n: 2 });
    // La app vuelve a calificar (ON CONFLICT … DO UPDATE, como operacion.ts).
    await ins(
      `INSERT INTO calificaciones (pedido_id, estrellas_restaurante, estrellas_repartidor, culpa_restaurante, comentario)
       VALUES ('p3', 4, 4, 0, '') ON CONFLICT(pedido_id) DO UPDATE SET estrellas_restaurante = excluded.estrellas_restaurante`,
    );
    expect(await resumen()).toMatchObject({ s: 12, n: 3 });
    await ins("UPDATE calificaciones SET estrellas_restaurante = NULL WHERE pedido_id = 'p1'");
    expect(await resumen()).toMatchObject({ s: 7, n: 2 });
    await ins("UPDATE calificaciones SET comentario = 'hola' WHERE pedido_id = 'p2'");
    await ins("DELETE FROM calificaciones WHERE pedido_id = 'p2'");
    expect(await resumen()).toMatchObject({ s: 4, n: 1 });
    // Turnos.
    await ins(
      "INSERT INTO horarios_restaurante (restaurante_id, dia, abre, cierra) VALUES ('rest1', 2, '09:00', '17:00'), ('rest1', 1, '10:00', '14:00')",
    );
    const turnos = async () =>
      (JSON.parse(String((await resumen())?.h)) as { dia: number }[]).map((t) => t.dia).sort();
    expect(await turnos()).toEqual([1, 2]);
    await ins("UPDATE horarios_restaurante SET dia = 4 WHERE restaurante_id = 'rest1' AND dia = 1");
    expect(await turnos()).toEqual([2, 4]);
    await ins("DELETE FROM horarios_restaurante WHERE restaurante_id = 'rest1'");
    expect(await turnos()).toEqual([]);
  });
});

describe('C-LECTURAS-DEMANDA · el mapa de demanda del repartidor', () => {
  const VIEJA = `SELECT r.lat, r.lng FROM pedidos p JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE r.zona_id = ? AND r.lat IS NOT NULL AND r.lng IS NOT NULL
          AND p.estado IN ('pagado','aceptado','listo','en_camino','entregado')
          AND p.creado_en >= datetime('now', '-60 minutes')
        LIMIT 5000`;
  const NUEVA = `SELECT r.lat, r.lng FROM pedidos p INDEXED BY pedidos_zona_estado
         CROSS JOIN restaurantes r ON r.id = p.restaurante_id
        WHERE p.zona_id = ?1 AND p.estado IN ('pagado','aceptado','listo','en_camino','entregado')
          AND p.creado_en >= datetime('now', '-60 minutes')
          AND r.zona_id = ?1 AND r.lat IS NOT NULL AND r.lng IS NOT NULL
        LIMIT 5000`;

  it('lee los pedidos de la última hora (no la historia) y cuenta lo mismo que antes', async () => {
    const { m, medidor } = await escenario();
    // Pedidos de la última hora en varios locales (y viejos, y cancelados, que no cuentan).
    await m.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 80)
       INSERT INTO pedidos (id, cliente_id, restaurante_id, estado, lineas_json, subtotal, envio, servicio,
         cargo_pequeno, propina, total, comision, pago_restaurante, pago_repartidor, complemento, ganancia, plan,
         direccion, lat, lng, creado_en, zona_id)
       SELECT 'dem-' || i, 'vol-u-1', 'vol-r-' || (1 + i % 12),
         CASE WHEN i % 10 = 0 THEN 'cancelado' WHEN i % 3 = 0 THEN 'entregado' ELSE 'pagado' END,
         '[]', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'basico', 'Calle', 25.78, -80.2,
         datetime('now', '-' || CASE WHEN i % 7 = 0 THEN 90 ELSE i % 50 END || ' minutes'), 'US-FL-MIAMI' FROM n`,
    ).run();
    const rep = await m.cuenta('repartidor', 'Repartidor Demanda');
    const antes = await cambios(m.DB);
    const r = await medidor.medir(() =>
      m.llamar('GET', '/datos/repartidor/demanda?lat=25.77&lng=-80.19', undefined, rep.token),
    );
    expect(r.resultado.estado).toBe(200);
    expect(await cambios(m.DB), 'mirar la demanda no escribe').toBe(antes);
    expect((r.resultado.datos as { zonas: unknown[] }).zonas.length).toBeGreaterThan(0);
    // Los mismos pedidos que la consulta vieja (mismas posiciones de locales, misma cantidad).
    const vieja = await medidor.medir(() =>
      medidor.db.prepare(VIEJA).bind('US-FL-MIAMI').all<{ lat: number; lng: number }>(),
    );
    const nueva = await m.DB.prepare(NUEVA).bind('US-FL-MIAMI').all<{ lat: number; lng: number }>();
    const orden = (x: { lat: number; lng: number }[]) => x.map((f) => `${f.lat},${f.lng}`).sort();
    expect(orden(nueva.results)).toEqual(orden(vieja.resultado.results));
    expect(vieja.resultado.results.length).toBeGreaterThan(30);
    // La ruta usa exactamente esa consulta.
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const fuente = readFileSync(join(__dirname, 'rutas', 'demanda.ts'), 'utf8');
    expect(fuente.replace(/\s+/g, ' ')).toContain(NUEVA.replace(/\s+/g, ' '));
    // Antes: la historia de pedidos de cada local de la zona (decenas de miles con esta base).
    expect(vieja.total, culpables(vieja.lecturas)).toBeGreaterThan(20_000);
    // Ahora: los pedidos de la zona en esos cinco estados creados en la última hora (un rango por
    // estado sobre el índice; el estimador cuenta cada rango abierto como un cuarto del índice, por
    // eso aquí se fija el plan) y el local de cada uno por su clave.
    const plan = await m.DB.prepare(`EXPLAIN QUERY PLAN ${NUEVA}`)
      .bind('US-FL-MIAMI')
      .all<{ detail: string }>();
    expect(plan.results.map((x) => x.detail)).toEqual([
      'SEARCH p USING INDEX pedidos_zona_estado (zona_id=? AND estado=? AND creado_en>?)',
      'SEARCH r USING INDEX sqlite_autoindex_restaurantes_1 (id=?)',
    ]);
    // Lo demás de la ruta (la zona y el pago pico) lee unas pocas filas.
    const resto = r.lecturas.filter((l) => !l.sql.includes('pedidos_zona_estado'));
    expect(
      resto.reduce((x, l) => x + l.filas, 0),
      culpables(resto),
    ).toBeLessThan(200);
  }, 120_000);
});
