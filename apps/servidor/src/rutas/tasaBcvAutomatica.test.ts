import { describe, expect, it } from 'vitest';
import { crearBasePruebas } from '../pruebas/d1';
import { mundo } from '../pruebas/ayuda';
import { TAREAS_RELOJ, correrRelojUnaVez } from './operacion';
import { TAREA_TASA_BCV, saludTasaBcv, tasaVigente, tomarTasaBcv } from './tasasReferencia';

/**
 * C-TASA-BCV-AUTO (14 nov 2026) — Venezuela. La tasa oficial del Banco Central se toma sola una vez
 * al día de su portada (la misma que lee Flex), con fecha valor y validación de cordura; la del equipo
 * escrita hoy manda. Ninguna prueba sale a internet: la página es una copia con la forma real.
 */
const pagina = (tasa: string, fecha: string) =>
  `<html><div id="dolar" class="col-sm-12"><div class="field-content"><span> USD</span>
   <div class="col-sm-6"> <strong class="strong-tb">${tasa}</strong> </div></div></div>
   <div class="pull-right dinpro center">Fecha Valor: <span property="dc:date" content="${fecha}T00:00:00-04:00">x</span></div></html>`;

const lector = (html: string | null) => {
  let llamadas = 0;
  return {
    get llamadas() {
      return llamadas;
    },
    leer: async () => {
      llamadas++;
      if (html === null) throw new Error('sin red');
      return html;
    },
  };
};
/** El respaldo (DolarApi, dólar oficial) con su forma real; null = no responde. */
const lectorRespaldo = (json: { promedio: number; fechaActualizacion: string } | null) => {
  let llamadas = 0;
  return {
    get llamadas() {
      return llamadas;
    },
    leer: async () => {
      llamadas++;
      if (json === null) throw new Error('sin red');
      return json as unknown;
    },
  };
};
/** 14 nov 2026 a las 10:00 de Caracas (14:00 UTC). */
const AHORA = Date.UTC(2026, 10, 14, 14, 0);

async function filas(db: D1Database) {
  return (
    await db
      .prepare('SELECT fecha, fuente, tasa FROM tasas_cambio ORDER BY fecha, fuente')
      .all<{ fecha: string; fuente: string; tasa: number }>()
  ).results;
}

describe('C-TASA-BCV-AUTO', () => {
  it('guarda la oficial con su fecha valor y fuente «bcv»; una lectura y una escritura', async () => {
    const db = crearBasePruebas();
    const l = lector(pagina('914,02180000', '2026-11-14'));
    const r = await tomarTasaBcv(db, { leer: l.leer, ahora: AHORA });
    expect(r).toMatchObject({ estado: 'guardada', tasa: 914.0218, fecha: '2026-11-14' });
    expect(l.llamadas).toBe(1);
    expect(await filas(db)).toEqual([{ fecha: '2026-11-14', fuente: 'bcv', tasa: 914.0218 }]);
    // Vale para el equivalente en bolívares de los viajes.
    expect(await tasaVigente(db, 'VE', AHORA)).toMatchObject({ tasa: 914.0218, fuente: 'bcv' });
    expect(await saludTasaBcv(db, AHORA)).toBe('ok');
  });

  it('un salto mayor al permitido no se usa: queda retenida, se conserva la anterior y el canario avisa', async () => {
    const db = crearBasePruebas();
    await tomarTasaBcv(db, {
      leer: lector(pagina('900,00000000', '2026-11-13')).leer,
      ahora: AHORA,
    });
    const r = await tomarTasaBcv(db, {
      leer: lector(pagina('1.200,00000000', '2026-11-14')).leer,
      ahora: AHORA,
      saltoMaximoPct: 20,
    });
    expect(r.estado).toBe('retenida');
    expect(await tasaVigente(db, 'VE', AHORA)).toMatchObject({ tasa: 900, fecha: '2026-11-13' });
    expect(await saludTasaBcv(db, AHORA)).toBe('error');
    // Flex lee solo la fuente «bcv» (flex/tasas.ts): la retenida no le llega.
    const deFlex = await db
      .prepare("SELECT tasa FROM tasas_cambio WHERE pais = 'VE' AND fuente = 'bcv'")
      .all<{ tasa: number }>();
    expect(deFlex.results.map((f) => f.tasa)).toEqual([900]);
  });

  it('una fecha valor futura (publicada de tarde) no se usa hasta su día', async () => {
    const db = crearBasePruebas();
    await tomarTasaBcv(db, {
      leer: lector(pagina('900,00000000', '2026-11-13')).leer,
      ahora: AHORA,
    });
    await tomarTasaBcv(db, {
      leer: lector(pagina('905,00000000', '2026-11-16')).leer,
      ahora: AHORA,
    });
    expect(await tasaVigente(db, 'VE', AHORA)).toMatchObject({ tasa: 900 });
    expect(await tasaVigente(db, 'VE', Date.UTC(2026, 10, 16, 14))).toMatchObject({ tasa: 905 });
  });

  it('C-TASA-MODOS: en fin de semana, con solo la oficial publicada para el lunes, se usa esa (hasta 4 días adelante)', async () => {
    // El caso real de producción del sábado 14 nov 2026: una sola fila, con fecha valor del lunes.
    const db = crearBasePruebas();
    await db
      .prepare(
        "INSERT INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', '2026-11-16', 'bcv', 914.0218)",
      )
      .run();
    expect(await tasaVigente(db, 'VE', AHORA)).toMatchObject({
      tasa: 914.0218,
      fecha: '2026-11-16',
      fuente: 'bcv',
    });
    expect(await saludTasaBcv(db, AHORA)).toBe('ok');
    // Una fecha valor a más de 4 días no se usa.
    const lejos = crearBasePruebas();
    await lejos
      .prepare(
        "INSERT INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', '2026-11-19', 'bcv', 920)",
      )
      .run();
    expect(await tasaVigente(lejos, 'VE', AHORA)).toBeNull();
  });

  it('C-TASA-MODOS: portada con fecha valor futura y sin oficial de hoy: una lectura del respaldo trae la del día vigente', async () => {
    const db = crearBasePruebas();
    const respaldo = lectorRespaldo({
      promedio: 911.6243,
      fechaActualizacion: '2026-11-13T00:00:00-04:00',
    });
    const r = await tomarTasaBcv(db, {
      leer: lector(pagina('914,02180000', '2026-11-16')).leer,
      leerRespaldo: respaldo.leer,
      ahora: AHORA,
    });
    expect(r).toMatchObject({ estado: 'guardada', tasa: 914.0218, fecha: '2026-11-16' });
    expect(respaldo.llamadas).toBe(1);
    expect(await filas(db)).toEqual([
      { fecha: '2026-11-13', fuente: 'bcv', tasa: 911.6243 },
      { fecha: '2026-11-16', fuente: 'bcv', tasa: 914.0218 },
    ]);
    expect(await tasaVigente(db, 'VE', AHORA)).toMatchObject({
      tasa: 911.6243,
      fecha: '2026-11-13',
    });
    // Con la del día ya guardada, la siguiente lectura no vuelve al respaldo.
    await tomarTasaBcv(db, {
      leer: lector(pagina('914,02180000', '2026-11-16')).leer,
      leerRespaldo: respaldo.leer,
      ahora: AHORA,
    });
    expect(respaldo.llamadas).toBe(1);
  });

  it('C-TASA-MODOS: si la portada no responde, la oficial sale del respaldo (una sola lectura extra)', async () => {
    const db = crearBasePruebas();
    const respaldo = lectorRespaldo({
      promedio: 911.6243,
      fechaActualizacion: '2026-11-13T00:00:00-04:00',
    });
    const r = await tomarTasaBcv(db, {
      leer: lector(null).leer,
      leerRespaldo: respaldo.leer,
      ahora: AHORA,
    });
    expect(r).toMatchObject({ estado: 'guardada', tasa: 911.6243, fecha: '2026-11-13' });
    expect(respaldo.llamadas).toBe(1);
    expect(await saludTasaBcv(db, AHORA)).toBe('ok');
    // Respaldo caído también: nada se escribe.
    const db2 = crearBasePruebas();
    const caido = lectorRespaldo(null);
    expect(
      (await tomarTasaBcv(db2, { leer: lector(null).leer, leerRespaldo: caido.leer, ahora: AHORA }))
        .estado,
    ).toBe('sin-lectura');
    expect(await filas(db2)).toEqual([]);
  });

  it('la del equipo escrita hoy manda sobre la automática; la de ayer no', async () => {
    const db = crearBasePruebas();
    await tomarTasaBcv(db, {
      leer: lector(pagina('914,02180000', '2026-11-14')).leer,
      ahora: AHORA,
    });
    await db
      .prepare(
        "INSERT INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', '2026-11-13', 'equipo', 950)",
      )
      .run();
    expect(await tasaVigente(db, 'VE', AHORA)).toMatchObject({ tasa: 914.0218, fuente: 'bcv' });
    await db
      .prepare(
        "INSERT INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', '2026-11-14', 'equipo', 920)",
      )
      .run();
    expect(await tasaVigente(db, 'VE', AHORA)).toMatchObject({ tasa: 920, fuente: 'equipo' });
  });

  it('si la página no responde o cambió, no escribe nada ni reintenta', async () => {
    const db = crearBasePruebas();
    const caida = lector(null);
    expect((await tomarTasaBcv(db, { leer: caida.leer, ahora: AHORA })).estado).toBe('sin-lectura');
    expect(caida.llamadas).toBe(1);
    const rara = lector('<html>otra página</html>');
    expect((await tomarTasaBcv(db, { leer: rara.leer, ahora: AHORA })).estado).toBe('sin-lectura');
    expect(await filas(db)).toEqual([]);
    expect(await saludTasaBcv(db, AHORA)).toBe('pendiente');
  });

  it('C-TASA-CORDURA: la tarea lee si no hay una lectura de las últimas 20 horas, a cualquier hora (ya no depende del minuto exacto)', async () => {
    const db = crearBasePruebas();
    const l = lector(pagina('914,02180000', '2026-11-14'));
    const correr = (ms: number) =>
      TAREA_TASA_BCV.correr({ __lectorTasaBcv: l.leer, __ahora: ms } as never, db);
    // El reloj no pasó justo a las 14:00: a las 14:07 lee igual (antes, ese día se quedaba sin tasa).
    await correr(Date.UTC(2026, 10, 14, 14, 7));
    expect(l.llamadas).toBe(1);
    // Con una lectura reciente no vuelve a leer.
    await correr(Date.UTC(2026, 10, 14, 15, 0));
    await correr(Date.UTC(2026, 10, 14, 20, 0));
    expect(l.llamadas).toBe(1);
    expect(TAREA_TASA_BCV).toMatchObject({ critica: false, cada: 'hora' });
    // Si la lectura falla, el intento se repite a la hora siguiente (no se pierde el día).
    const otra = crearBasePruebas();
    const caida = lector(null);
    const correrCaida = (ms: number) =>
      TAREA_TASA_BCV.correr({ __lectorTasaBcv: caida.leer, __ahora: ms } as never, otra);
    await correrCaida(Date.UTC(2026, 10, 14, 14, 0));
    await correrCaida(Date.UTC(2026, 10, 14, 15, 0));
    expect(caida.llamadas).toBe(2);
  });

  it('C-TASA-CORDURA: la misma tasa leída otro día (fin de semana) deja la marca de lectura y el canario sigue vivo', async () => {
    const db = crearBasePruebas();
    const l = lector(pagina('914,02180000', '2026-11-14'));
    await tomarTasaBcv(db, { leer: l.leer, ahora: AHORA });
    // Dos días después nadie leyó: «atrasado» (antes seguía en «ok» cinco días).
    await db.prepare("UPDATE tasas_cambio SET creado_en = datetime('now', '-50 hours')").run();
    expect(await saludTasaBcv(db)).toBe('atrasado');
    // Una lectura con la misma tasa y la misma fecha valor no crea filas, pero deja la marca.
    await tomarTasaBcv(db, { leer: l.leer });
    expect(await filas(db)).toHaveLength(1);
    const marca = await db
      .prepare("SELECT creado_en > datetime('now', '-1 hour') AS hoy FROM tasas_cambio")
      .first<{ hoy: number }>();
    expect(marca?.hoy).toBe(1);
  });

  it('C-TASA-CORDURA: una tasa escrita a mano que no se parece a la oficial ni se guarda ni se muestra, y el canario la delata', async () => {
    const m = mundo();
    const admin = await m.cuenta('admin', 'Soporte Divoox');
    const hoy = "date('now', '-4 hours')";
    await m.DB.prepare(
      `INSERT INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', ${hoy}, 'bcv', 917.7751)`,
    ).run();
    const poner = (tasa: number) =>
      m.llamar('PUT', '/datos/admin/tasas-referencia/VE', { tasa }, admin.token);
    const modo = (cuerpo: unknown) =>
      m.llamar('PUT', '/datos/admin/tasas-referencia/VE/modo', cuerpo, admin.token);
    // Lo que pasó el 19 nov: un guion de capturas escribió 240 como «tasa del día».
    const mala = await poner(240);
    expect(mala.estado).toBe(422);
    expect(mala.datos.error).toMatch(/917[.,]78/);
    expect((await poner(91_777)).estado).toBe(422);
    expect((await modo({ modo: 'fija', tasaFija: 240 })).estado).toBe(422);
    expect(await tasaVigente(m.DB, 'VE')).toMatchObject({ tasa: 917.7751, fuente: 'bcv' });
    // Una corrección creíble (o el paralelo como tasa fija) sí pasa.
    expect((await poner(930)).estado).toBe(200);
    expect(await tasaVigente(m.DB, 'VE')).toMatchObject({ tasa: 930, fuente: 'equipo' });
    expect((await modo({ modo: 'fija', tasaFija: 1_072 })).estado).toBe(200);
    expect(await tasaVigente(m.DB, 'VE')).toMatchObject({ tasa: 1_072, fuente: 'fija' });
    expect(await saludTasaBcv(m.DB)).toBe('ok');
    // Si el valor malo llega por otro lado (una fila escrita directo en la base), NO se muestra:
    // sale la oficial y el canario se pone en rojo.
    await modo({ modo: 'oficial' });
    await m.DB.prepare(
      `INSERT OR REPLACE INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', ${hoy}, 'equipo', 240)`,
    ).run();
    expect(await tasaVigente(m.DB, 'VE')).toMatchObject({ tasa: 917.7751, fuente: 'bcv' });
    expect(await saludTasaBcv(m.DB)).toBe('error');
    await m.DB.prepare("DELETE FROM tasas_cambio WHERE fuente = 'equipo'").run();
    expect(await saludTasaBcv(m.DB)).toBe('ok');
    // Lo mismo con una fija que quedó vieja tras una devaluación.
    await m.DB.prepare(
      "INSERT OR REPLACE INTO tasas_modo (pais, modo, tasa_fija) VALUES ('VE', 'fija', 250)",
    ).run();
    expect(await tasaVigente(m.DB, 'VE')).toMatchObject({ tasa: 917.7751, fuente: 'bcv' });
    expect(await saludTasaBcv(m.DB)).toBe('error');
  });

  it('devaluación real: el mismo salto leído dos días seguidos se acepta; mientras tanto manda la del equipo', async () => {
    const db = crearBasePruebas();
    const leer = (t: string, f: string) => lector(pagina(t, f)).leer;
    await tomarTasaBcv(db, { leer: leer('900,00000000', '2026-11-12'), ahora: AHORA });
    // Día 1 del salto: retenida.
    expect(
      (await tomarTasaBcv(db, { leer: leer('1.200,00000000', '2026-11-13'), ahora: AHORA })).estado,
    ).toBe('retenida');
    await db
      .prepare(
        "INSERT INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', '2026-11-14', 'equipo', 1190)",
      )
      .run();
    expect(await tasaVigente(db, 'VE', AHORA)).toMatchObject({ tasa: 1190, fuente: 'equipo' });
    // Día 2: casi la misma tasa nueva (dentro del margen): se acepta.
    const r = await tomarTasaBcv(db, { leer: leer('1.205,00000000', '2026-11-14'), ahora: AHORA });
    expect(r.estado).toBe('guardada');
    expect(await saludTasaBcv(db, AHORA)).toBe('ok');
    // Otro salto distinto al día siguiente vuelve a quedar retenido.
    expect(
      (await tomarTasaBcv(db, { leer: leer('2.000,00000000', '2026-11-15'), ahora: AHORA })).estado,
    ).toBe('retenida');
  });

  it('el primer día sin oficial anterior: solo se acepta cerca de la última del equipo', async () => {
    const db = crearBasePruebas();
    await db
      .prepare(
        "INSERT INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', '2026-11-13', 'equipo', 36.5)",
      )
      .run();
    expect(
      (
        await tomarTasaBcv(db, {
          leer: lector(pagina('914,02180000', '2026-11-14')).leer,
          ahora: AHORA,
        })
      ).estado,
    ).toBe('retenida');
    const db2 = crearBasePruebas();
    await db2
      .prepare(
        "INSERT INTO tasas_cambio (pais, fecha, fuente, tasa) VALUES ('VE', '2026-11-13', 'equipo', 910)",
      )
      .run();
    expect(
      (
        await tomarTasaBcv(db2, {
          leer: lector(pagina('914,02180000', '2026-11-14')).leer,
          ahora: AHORA,
        })
      ).estado,
    ).toBe('guardada');
  });

  it('en el reloj real: declara dos filas y 60 vueltas (una hora entera) leen una sola vez y escriben solo esa fila de más', async () => {
    const t = TAREAS_RELOJ.find((x) => x.nombre === 'tasa_bcv');
    expect(t).toMatchObject({ critica: false, cada: 'hora', escriturasEsperadas: 2 });
    const vueltas = async (html: string | null) => {
      const m = mundo();
      await m.cuenta('cliente');
      const l = lector(html);
      const base = { ...(m.extra as object), ENTORNO_RELOJ: 'produccion', __lectorTasaBcv: l.leer };
      await correrRelojUnaVez(base as never, m.DB, '2026-11-14T13:29', 'externo');
      const cambios = async () =>
        Number((await m.DB.prepare('SELECT total_changes() AS n').first<{ n: number }>())?.n ?? 0);
      const antes = await cambios();
      for (let i = 0; i < 60; i++) {
        const ventana = `2026-11-14T${i < 30 ? '13' : '14'}:${String((30 + i) % 60).padStart(2, '0')}`;
        const env = { ...base, __ahora: Date.parse(`${ventana}:00Z`) };
        await correrRelojUnaVez(env as never, m.DB, ventana, 'externo');
      }
      return { escritas: (await cambios()) - antes, lecturas: l.llamadas };
    };
    const sinTasa = await vueltas(null);
    const conTasa = await vueltas(pagina('914,02180000', '2026-11-14'));
    // Sin respuesta, un intento por hora (las 13 y las 14); con respuesta, una sola lectura.
    expect(sinTasa.lecturas).toBe(2);
    expect(conTasa.lecturas).toBe(1);
    // Con la tasa ya leída, la hora entera no escribe ni una fila de más por la tasa.
    expect(conTasa.escritas - sinTasa.escritas).toBeLessThanOrEqual(1);
    expect(conTasa.escritas - sinTasa.escritas).toBeGreaterThanOrEqual(0);
  });
});
