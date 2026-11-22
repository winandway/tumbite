import { afterEach, describe, expect, it, vi } from 'vitest';
import { conciliarFinanzas } from './finanzas/reloj';
import type { Env } from './env';
import { contarFilas } from './presupuestoFilas';
import { mundo } from './pruebas/ayuda';
import { type Lectura, medidorDeLecturas, sembrarVolumen } from './pruebas/lecturas';

/**
 * C-LECTURAS-SALUD (13 nov 2026, regla global «la nube no se come el dinero»). Todos los países.
 *
 * El canario (/datos/salud) es público y GitHub lo llama cada pocos minutos contra producción. En
 * una vuelta de pruebas del 13 nov leyó unas 94.000 filas del sitio de pruebas por llamada. Con la
 * base de volumen (pruebas/lecturas.ts) leía 85.782 (estimadas con el plan de cada consulta): la
 * bandeja de soporte entera (unas 60.000: recorría pedidos, bitácora, libro y recargas, dos veces
 * por fuente), las reservas de viajes (6.000, el libro entero por un LIKE), el libro para los
 * saldos negativos (6.000), sqlite_master cuatro veces (unas 2.950) y los correos del equipo en
 * cada llamada (1.868).
 *
 * Tope: el canario completo lee como mucho 2.000 filas con ese volumen y, sin cambios de color,
 * no escribe ninguna. Y nada se esconde: un problema nuevo se ve en la llamada siguiente.
 */
afterEach(() => vi.unstubAllGlobals());

/**
 * C-LECTURAS-SALUD-2 (18 nov 2026): el tope se parte en dos, porque la lista de disparadores recorre
 * `sqlite_master` entera y eso crece con CADA tabla o índice nuevo del esquema (el 17 nov el total
 * estaba exactamente en 2.000: cualquier tabla nueva lo rompía sin que el canario leyera peor).
 * - `sqlite_master` se recorre UNA sola vez por llamada (lo que fija C-LECTURAS-SALUD);
 * - todo lo demás (los datos de verdad) no pasa de 1.150 filas. Antes eran 1.126 de 2.000.
 */
// +1 (19 nov 2026, C-VERIFICACION-IA): la pieza del canario lee la fila del gasto de IA de hoy.
// +1 (20 nov 2026, C-CAMILA-CORREO-HILO): al juntarse con la pieza del correo entrante, que lee su fila.
// +1 (21 nov 2026, C-REPARACION-PAIS): la marca de la reparación de cuentas de país (una vez por servidor).
// +1 (22 nov 2026, C-SMS-VENEZUELA): la pieza nueva «smsVenezuela» suma su fila del estado del canario.
// +1 (22 nov 2026, C-RASTRO-FUENTES): la marca del relleno hacia atrás de los pasos del registro (una
// fila, solo dentro de la migración completa).
// +1 (22 nov 2026, C-SMS-GASTO): la pieza «smsGasto» cuenta los SMS cobrados de las últimas 24 h (por
// el índice nuevo de sms_enviados por fecha: solo las filas del día).
const TOPE_CANARIO = 1156;
const esEsquema = (l: Lectura) => l.escaneos.some((e) => e.startsWith('sqlite_master'));

const culpables = (l: Lectura[]) =>
  l
    .filter((x) => x.filas > 50)
    .sort((a, b) => b.filas - a.filas)
    .map((x) => `${x.filas} filas (${x.escaneos.join(', ')}): ${x.sql}`)
    .join('\n');

async function escenario() {
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
  let medidor!: ReturnType<typeof medidorDeLecturas>;
  let conteo!: ReturnType<typeof contarFilas>;
  const env = { STRIPE_SECRET_KEY: 'sk_test_x', RELOJ_SECRETO: 'x' };
  const m = mundo(env, {
    host: 'staging.tumbite.com',
    envolver: (db) => {
      medidor = medidorDeLecturas(db);
      conteo = contarFilas(medidor.db);
      return conteo.db;
    },
  });
  await sembrarVolumen(m.DB);
  const salud = async () => {
    const r = await m.llamar('GET', '/datos/salud');
    return r.datos as { piezas: Record<string, string> };
  };
  /** Mide una llamada al canario: filas leídas (estimadas) y escritas. */
  const medir = async () => {
    const antes = conteo.cuenta.escritas;
    const r = await medidor.medir(salud);
    return { ...r, escritas: conteo.cuenta.escritas - antes };
  };
  return { m, salud, medir, env: { ...env, DB: m.DB } as unknown as Env };
}

describe('C-LECTURAS-SALUD · el canario lee poco y no escribe', () => {
  it('con el volumen del sitio de pruebas y el reloj andando: una sola pasada por el esquema, menos de 1.150 filas de datos y 0 escrituras', async () => {
    const { salud, medir, env, m } = await escenario();
    await salud(); // la migración y el primer estado de cada pieza, fuera de la cuenta
    await conciliarFinanzas(env, m.DB); // el reloj deja la suma del libro
    await salud(); // «billeteras» pasa de pendiente a ok: ese cambio sí se anota, una vez
    const r = await medir();
    const delEsquema = r.lecturas.filter(esEsquema);
    expect(delEsquema, 'sqlite_master se recorre una sola vez').toHaveLength(1);
    const datos = r.total - delEsquema.reduce((n, l) => n + l.filas, 0);
    expect(
      datos,
      `el canario leyó ${datos} filas de datos (tope ${TOPE_CANARIO}):\n${culpables(r.lecturas.filter((l) => !esEsquema(l)))}`,
    ).toBeLessThanOrEqual(TOPE_CANARIO);
    expect(r.escritas, 'el canario sin cambios de color no escribe').toBe(0);
    expect(r.resultado.piezas.libro).toBe('ok');
    expect(r.resultado.piezas.bandeja).toBe('ok');
  });

  it('nada se esconde: un caso de dinero, un disparador que falta y un saldo negativo se ven enseguida', async () => {
    const { salud, env, m } = await escenario();
    await conciliarFinanzas(env, m.DB);
    const antes = await salud();
    expect(antes.piezas.bandeja).toBe('ok');
    expect(antes.piezas.retiros).not.toBe('error');

    // Un pedido en efectivo conciliado con diferencia: la bandeja lo ve en la llamada siguiente.
    await m.DB.prepare(
      "UPDATE pedidos SET metodo_pago = 'efectivo', conciliacion_estado = 'con_diferencia' WHERE id = 'vol-p-1'",
    ).run();
    expect((await salud()).piezas.bandeja).toBe('pendiente');

    // Falta un disparador de los retiros: rojo en la llamada siguiente (sin memoria de por medio).
    await m.DB.prepare('DROP TRIGGER retiros_descuenta_saldo').run();
    expect((await salud()).piezas.retiros).toBe('error');

    // Un prepago en negativo: con el reloj, a la vuelta siguiente de la conciliación (un minuto).
    await m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto) VALUES ('neg-1', 'cuenta-negativa', 'prepago', 'US', 'USD', -500, 'prueba')",
    ).run();
    await conciliarFinanzas(env, m.DB);
    expect((await salud()).piezas.libro).toBe('error');
  });

  it('sin conciliación vigente (reloj en pausa) la pieza libro suma el libro ella misma; un «ok» dura 60 s', async () => {
    const { salud, m } = await escenario();
    // Una conciliación vieja (más de 2 horas) no vale: se suma el libro.
    await m.DB.prepare(
      "INSERT INTO config (clave, valor) VALUES ('fin_conciliacion', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor",
    )
      .bind(JSON.stringify({ cuando: '2026-01-01T00:00:00.000Z', ok: true, libroNegativos: 0 }))
      .run();
    expect((await salud()).piezas.libro).toBe('ok');
    await m.DB.prepare(
      "INSERT INTO libro (id, cuenta_id, bolsillo, pais, moneda, monto, concepto) VALUES ('neg-2', 'otra-cuenta', 'punto', 'US', 'USD', -1, 'prueba')",
    ).run();
    // El «ok» se recuerda como mucho 60 segundos en el aislado...
    expect((await salud()).piezas.libro).toBe('ok');
    const ahora = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(ahora + 61_000);
    // ...y después el saldo negativo sale en rojo. El rojo no se recuerda: sale en cada llamada.
    expect((await salud()).piezas.libro).toBe('error');
    expect((await salud()).piezas.libro).toBe('error');
    vi.restoreAllMocks();
  });
});
