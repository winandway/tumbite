import { beforeEach, describe, expect, it } from 'vitest';
import { CIUDAD_EL_VIGIA as EVG } from '@tumbite/compartido';
import { mundo } from '../pruebas/ayuda';
import { sembrarTabuladorVigia } from '../semillaTabuladorVigia';
import { olvidarCacheTarifas } from './tarifasWeb';

/**
 * C-TARIFAS-PUBLICAS y C-CIUDAD-ABIERTA-SIN-PRONTO (25 nov 2026, encargo de Richard) — Venezuela.
 * La web dice qué ciudades tienen algo abierto y cuánto cuesta un mototaxi en El Vigía, de los MISMOS
 * datos que cobra el sistema: si cambia un precio en la base, cambia la página.
 */
async function elVigia({ sembrar = true } = {}) {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const r = await m.llamar(
    'POST',
    '/datos/admin/viajes/ciudades',
    {
      servicio: 'moto',
      zona: {
        id: EVG.id,
        nombre: EVG.nombre,
        lat: EVG.lat,
        lng: EVG.lng,
        radioKm: EVG.radioKm,
        zonaHoraria: EVG.zonaHoraria,
      },
      motivo: 'El Vigía para Moto',
    },
    admin.token,
  );
  expect(r.estado, JSON.stringify(r.datos)).toBe(201);
  if (sembrar) expect(await sembrarTabuladorVigia(m.DB)).not.toBeNull();
  return { m, admin };
}

type Lugar = { lugar: string; ida: { dia: number; noche: number | null } | null };
const lugares = (d: { grupos: { grupo: string | null; lugares: Lugar[] }[] }) =>
  d.grupos.flatMap((g) => g.lugares.map((l) => ({ ...l, grupo: g.grupo })));

describe('C-CIUDAD-ABIERTA-SIN-PRONTO: las ciudades abiertas para la web', () => {
  it('la ruta de países trae cada ciudad pública con lo abierto, por su clave y sin ids internos', async () => {
    const { m, admin } = await elVigia({ sembrar: false });
    // Una zona de pruebas no se anuncia como ciudad (C-DISPONIBLE-MUNDO).
    await m.llamar(
      'POST',
      '/datos/admin/viajes/ciudades',
      {
        servicio: 'moto',
        zona: {
          id: 'VE-MER-PRUEBA',
          nombre: 'Ejido (pruebas)',
          lat: 8.55,
          lng: -71.24,
          radioKm: 5,
          zonaHoraria: 'America/Caracas',
        },
        motivo: 'pruebas',
      },
      admin.token,
    );
    const r = await m.llamar('GET', '/datos/web/paises');
    expect(r.estado).toBe(200);
    expect(Object.keys(r.datos.ciudades.VE)).toEqual(['el-vigia']);
    expect(r.datos.ciudades.VE['el-vigia'].map((s: { id: string }) => s.id)).toEqual(['moto']);
    expect(JSON.stringify(r.datos)).not.toMatch(/VE-MER|pruebas/i);

    await m.DB.prepare("UPDATE servicios_zona SET estado = 'suspendido' WHERE zona_id = ?")
      .bind(EVG.id)
      .run();
    expect((await m.llamar('GET', '/datos/web/paises')).datos.ciudades.VE).toBeUndefined();
  });
});

describe('C-TARIFAS-PUBLICAS: los precios de El Vigía salen de la base', () => {
  beforeEach(() => olvidarCacheTarifas());
  it('sin el servicio abierto no se publica ningún precio', async () => {
    const { m } = await elVigia();
    await m.DB.prepare("UPDATE servicios_zona SET estado = 'suspendido' WHERE zona_id = ?")
      .bind(EVG.id)
      .run();
    olvidarCacheTarifas();
    expect((await m.llamar('GET', '/datos/web/tarifas/el-vigia')).estado).toBe(404);
    expect((await m.llamar('GET', '/datos/web/tarifas/caracas')).estado).toBe(404);
  });

  it('por vía, con el precio de día y de noche que paga el pasajero, sin ids ni lo interno', async () => {
    const { m } = await elVigia();
    const r = await m.llamar('GET', '/datos/web/tarifas/el-vigia');
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    expect(r.datos.moneda).toBe('USD');
    expect(r.datos.centro).toBe('El Vigía (casco urbano)');
    const xs = lugares(r.datos);
    const vega = xs.find((l) => l.lugar === 'La Vega I');
    expect(vega?.grupo).toBe('Vía Mérida');
    // En El Vigía la comisión la paga el conductor: el pasajero paga la hoja. De noche, +30 %.
    expect(vega?.ida).toEqual({ dia: 200, noche: 260 });
    expect(xs.find((l) => l.lugar === 'Mérida')?.ida).toEqual({ dia: 3000, noche: 3900 });
    expect(r.datos.grupos.map((g: { grupo: string }) => g.grupo)).toEqual(
      expect.arrayContaining(['Vía Mérida', 'Vía El Zulia', 'Vía Táchira', 'Vía Panamericana']),
    );
    expect(r.datos.noche).toEqual({
      recargoPb: 3000,
      desdeH: 21,
      hastaH: 6,
      zonaHoraria: 'America/Caracas',
    });
    expect(r.datos.minimo).toEqual({ dia: 100, noche: 130 });
    // Los puntos «revisar» (aproximados) no se publican: La Vega II, Pedeca.
    expect(xs.map((l) => l.lugar)).not.toContain('La Vega II');
    expect(xs.map((l) => l.lugar)).not.toContain('Pedeca');
    const texto = JSON.stringify(r.datos);
    expect(texto).not.toMatch(/VE-MER|"id"|comision|conductor|umbral|C-TABULADOR|creada/i);
    expect(r.res.headers.get('cache-control')).toMatch(/public, max-age=300/);
  });

  it('si cambia un precio en la base, cambia lo publicado; una ruta apagada desaparece', async () => {
    const { m } = await elVigia();
    await m.DB.prepare(
      "UPDATE rutas_precio_zona SET precio = 250 WHERE zona_id = ? AND hasta_nombre = 'La Vega I'",
    )
      .bind(EVG.id)
      .run();
    await m.DB.prepare(
      "UPDATE rutas_precio_zona SET activa = 0 WHERE zona_id = ? AND hasta_nombre = 'Tovar'",
    )
      .bind(EVG.id)
      .run();
    // Pasados los 5 minutos de la caché (aquí, olvidándola) la página toma el precio nuevo.
    olvidarCacheTarifas();
    const r = await m.llamar('GET', '/datos/web/tarifas/el-vigia');
    const xs = lugares(r.datos);
    expect(xs.find((l) => l.lugar === 'La Vega I')?.ida).toEqual({ dia: 250, noche: 325 });
    expect(xs.map((l) => l.lugar)).not.toContain('Tovar');
  });

  it('mirar no escribe en la base', async () => {
    const { m } = await elVigia();
    const antes = await m.DB.prepare('SELECT COUNT(*) AS n FROM auditoria_admin').first<{
      n: number;
    }>();
    const prep = m.DB.prepare.bind(m.DB);
    const escrituras: string[] = [];
    m.DB.prepare = ((sql: string) => {
      if (/^\s*(insert|update|delete|replace)/i.test(sql)) escrituras.push(sql);
      return prep(sql);
    }) as typeof m.DB.prepare;
    await m.llamar('GET', '/datos/web/tarifas/el-vigia');
    await m.llamar('GET', '/datos/web/paises');
    m.DB.prepare = prep;
    expect(escrituras).toEqual([]);
    const despues = await m.DB.prepare('SELECT COUNT(*) AS n FROM auditoria_admin').first<{
      n: number;
    }>();
    expect(despues?.n).toBe(antes?.n);
  });

  it('lecturas por visita: la primera lee, las siguientes no; una ciudad inexistente o un servicio que no existe no leen', async () => {
    const { m } = await elVigia();
    const prep = m.DB.prepare.bind(m.DB);
    let consultas = 0;
    m.DB.prepare = ((sql: string) => {
      consultas++;
      return prep(sql);
    }) as typeof m.DB.prepare;
    const medir = async (ruta: string) => {
      consultas = 0;
      const r = await m.llamar('GET', ruta);
      return { estado: r.estado, consultas };
    };
    const primera = await medir('/datos/web/tarifas/el-vigia');
    expect(primera.estado).toBe(200);
    // Zonas, abiertos (y aperturas), tarifa, rutas, política y quién paga: acotado.
    expect(primera.consultas).toBeGreaterThan(0);
    expect(primera.consultas).toBeLessThanOrEqual(12);
    expect(await medir('/datos/web/tarifas/el-vigia')).toEqual({ estado: 200, consultas: 0 });
    expect(await medir('/datos/web/tarifas/caracas')).toEqual({ estado: 404, consultas: 0 });
    expect(await medir('/datos/web/tarifas/el-vigia?servicio=carro')).toEqual({
      estado: 404,
      consultas: 0,
    });
    olvidarCacheTarifas();
    // En frío, una ciudad que no existe cuesta una sola lectura (la lista de zonas).
    expect(await medir('/datos/web/tarifas/no-existe')).toEqual({ estado: 404, consultas: 1 });
    m.DB.prepare = prep;
  });
});
