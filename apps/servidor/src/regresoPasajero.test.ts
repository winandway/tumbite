import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { reiniciarEsquema } from './esquema';
import { contarUsoRegreso } from './modoDestino';
import { repartirOperaciones } from './operaciones';
import { contarFilas } from './presupuestoFilas';
import { mundo } from './pruebas/ayuda';
import { conductorDeMoto } from './pruebas/conductorMoto';

/**
 * C-REGRESO-PASAJERO (25 nov 2026; todos los países). Ficha:
 * docs/investigaciones-rea/2026-11-25-regreso-con-pasajero.md (pruebas de aceptación 2 a 9 y 11).
 * El conductor está en la ciudad B (Miami en la base de prueba) y su ciudad base queda ~60 km al
 * norte. Cada prueba se vio en ROJO quitando su regla (anotado en CANDADOS.md).
 */
const ZONA = 'US-FL-MIAMI';
const BASE = { id: 'US-FL-NORTE-PRUEBA', nombre: 'Ciudad Norte', lat: 26.3, lng: -80.19 };
const ORIGEN = { lat: 25.7617, lng: -80.1918, direccion: 'Punto de recogida' };
/** Un kilómetro hacia el sur, en grados de latitud. */
const KM = 1 / 111.2;
const alSur = (km: number) => ({ lat: ORIGEN.lat - km * KM, lng: ORIGEN.lng });

async function escena() {
  const m = mundo({}, { host: 'staging.tumbite.com' });
  const admin = await m.cuenta('admin', 'Soporte Divoox');
  const cliente = await m.cuenta('cliente', 'Pasajero Uno');
  const cliente2 = await m.cuenta('cliente', 'Pasajero Dos');
  await m.DB.prepare(
    `INSERT OR IGNORE INTO zonas (id, nombre, pais, moneda, zona_horaria, lat, lng, radio_km, activa)
     VALUES (?, ?, 'US', 'USD', 'America/New_York', ?, ?, 20, 1)`,
  )
    .bind(BASE.id, BASE.nombre, BASE.lat, BASE.lng)
    .run();
  await m.llamar('PUT', '/datos/admin/servicios/moto', { estado: 'disponible' }, admin.token);
  await m.llamar(
    'PUT',
    `/datos/admin/servicios/moto/zonas/${ZONA}`,
    { estado: 'disponible' },
    admin.token,
  );
  await m.llamar(
    'POST',
    '/datos/admin/viajes/tarifas',
    {
      servicio: 'moto',
      zona: ZONA,
      tarifa: { base: 150, porKm: 60, porMinuto: 12, minimo: 400 },
      motivo: 'Tarifa de prueba',
    },
    admin.token,
  );
  /** Un viaje desde el punto de recogida hasta `destino`. */
  const pedirViaje = async (destino: { lat: number; lng: number }, otro = false) => {
    const token = otro ? cliente2.token : cliente.token;
    const c = (
      await m.llamar(
        'POST',
        '/datos/viajes/cotizar',
        {
          servicio: 'moto',
          origen: ORIGEN,
          destino: { ...destino, direccion: 'Destino del viaje' },
        },
        token,
      )
    ).datos.cotizacion;
    const r = await m.llamar(
      'POST',
      '/datos/viajes',
      { cotizacionId: c.id, metodoPago: 'efectivo' },
      token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBeLessThan(300);
    return r.datos.viaje.id as string;
  };
  const ofrecidaA = async (operacion: string) =>
    (
      await m.DB.prepare(
        "SELECT conductor_id FROM ofertas_operacion WHERE operacion_id = ? AND estado = 'ofrecida'",
      )
        .bind(operacion)
        .first<{ conductor_id: string }>()
    )?.conductor_id ?? null;
  /** Un conductor de Moto en `donde`, con su ciudad base al norte. */
  const conductor = async (donde: { lat: number; lng: number }, base: string | null = BASE.id) => {
    const c = await conductorDeMoto(m, donde);
    await m.DB.prepare('UPDATE repartidores SET zona_base_id = ? WHERE usuario_id = ?')
      .bind(base, c.id)
      .run();
    return c;
  };
  const regreso = (token: string, metodo: 'GET' | 'POST' | 'DELETE' = 'POST') =>
    m.llamar(metodo, '/datos/repartidor/regreso', undefined, token);
  return { m, admin, pedirViaje, ofrecidaA, conductor, regreso };
}

/** Rumbo norte (hacia su ciudad base), a 15 km: lo acerca de sobra. */
const HACIA_CASA = { lat: ORIGEN.lat + 15 * KM, lng: ORIGEN.lng };

describe('regreso con pasajero: prioridad en el despacho (C-REGRESO-PASAJERO)', () => {
  it('2. el que va de regreso, 2 km más lejos que el más cercano, recibe primero el viaje hacia su casa', async () => {
    const e = await escena();
    const b1 = await e.conductor(alSur(1));
    const b2 = await e.conductor(alSur(3));
    expect((await e.regreso(b2.token)).estado).toBe(200);
    const viaje = await e.pedirViaje(HACIA_CASA);
    await repartirOperaciones(undefined, e.m.DB);
    expect(await e.ofrecidaA(viaje)).toBe(b2.id);
    expect(b1.id).not.toBe(b2.id);
  });

  it('2. con 5 km de más, manda la cercanía: va al más cercano', async () => {
    const e = await escena();
    const b1 = await e.conductor(alSur(1));
    const b2 = await e.conductor(alSur(6));
    expect((await e.regreso(b2.token)).estado).toBe(200);
    const viaje = await e.pedirViaje(HACIA_CASA);
    await repartirOperaciones(undefined, e.m.DB);
    expect(await e.ofrecidaA(viaje)).toBe(b1.id);
  });

  it('11. los ajustes del país llegan al despacho: con +1 km de margen, gana la cercanía', async () => {
    const e = await escena();
    const r = await e.m.llamar(
      'PUT',
      '/datos/admin/regreso/ajustes',
      { pais: 'US', kmMinimo: 25, anguloMaximo: 45, acercaMinimoKm: 5, extraRecogidaKm: 1 },
      e.admin.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    const b1 = await e.conductor(alSur(1));
    const b2 = await e.conductor(alSur(3));
    expect((await e.regreso(b2.token)).estado).toBe(200);
    const viaje = await e.pedirViaje(HACIA_CASA);
    await repartirOperaciones(undefined, e.m.DB);
    expect(await e.ofrecidaA(viaje)).toBe(b1.id);
    const lista = await e.m.llamar('GET', '/datos/admin/regreso/ajustes', undefined, e.admin.token);
    expect(lista.datos.paises).toEqual(
      expect.arrayContaining([expect.objectContaining({ pais: 'US', extraRecogidaKm: 1 })]),
    );
    // Fuera de los límites, no se guarda.
    const malo = await e.m.llamar(
      'PUT',
      '/datos/admin/regreso/ajustes',
      { pais: 'US', kmMinimo: 25, anguloMaximo: 170, acercaMinimoKm: 5, extraRecogidaKm: 1 },
      e.admin.token,
    );
    expect(malo.estado).toBe(400);
  });
});

describe('regreso con pasajero: filtro por rumbo (C-REGRESO-PASAJERO)', () => {
  it('3. en sentido contrario no le llega; quien no tiene el regreso, sí', async () => {
    const e = await escena();
    const b2 = await e.conductor(alSur(0.5));
    expect((await e.regreso(b2.token)).estado).toBe(200);
    const contra = await e.pedirViaje({ lat: ORIGEN.lat - 15 * KM, lng: ORIGEN.lng });
    await repartirOperaciones(undefined, e.m.DB);
    expect(await e.ofrecidaA(contra)).toBeNull();
    const b1 = await e.conductor(alSur(2));
    await repartirOperaciones(undefined, e.m.DB);
    expect(await e.ofrecidaA(contra)).toBe(b1.id);
  });

  it('3. uno que lo acerca menos de 5 km no le llega; uno que cumple, sí', async () => {
    const e = await escena();
    const b2 = await e.conductor(alSur(0.5));
    expect((await e.regreso(b2.token)).estado).toBe(200);
    const corto = await e.pedirViaje({ lat: ORIGEN.lat + 3 * KM, lng: ORIGEN.lng });
    await repartirOperaciones(undefined, e.m.DB);
    expect(await e.ofrecidaA(corto)).toBeNull();
    const bueno = await e.pedirViaje(HACIA_CASA, true);
    await repartirOperaciones(undefined, e.m.DB);
    expect(await e.ofrecidaA(bueno)).toBe(b2.id);
  });

  it('6. pasadas 6 horas no filtra ni prioriza, y se apaga solo', async () => {
    const e = await escena();
    const b2 = await e.conductor(alSur(0.5));
    expect((await e.regreso(b2.token)).estado).toBe(200);
    await e.m.DB.prepare(
      "UPDATE modo_destino SET encendido_en = datetime('now', '-7 hours') WHERE repartidor_id = ?",
    )
      .bind(b2.id)
      .run();
    const contra = await e.pedirViaje({ lat: ORIGEN.lat - 15 * KM, lng: ORIGEN.lng });
    await repartirOperaciones(undefined, e.m.DB);
    expect(await e.ofrecidaA(contra)).toBe(b2.id);
    expect((await e.regreso(b2.token, 'GET')).datos).toMatchObject({
      activo: false,
      motivo: 'tiempo',
    });
  });
});

describe('regreso con pasajero: el botón (C-REGRESO-PASAJERO)', () => {
  it('4. solo lejos de su ciudad base: dentro → 409 con mensaje claro; sin base → 409', async () => {
    const e = await escena();
    const enCasa = await e.conductor({ lat: BASE.lat - 5 * KM, lng: BASE.lng });
    const estado = await e.regreso(enCasa.token, 'GET');
    expect(estado.datos).toMatchObject({ disponible: false, activo: false, ciudad: BASE.nombre });
    const r = await e.regreso(enCasa.token);
    expect(r.estado).toBe(409);
    expect(r.datos.error).toMatch(/cerca de tu ciudad base|close to your home city/);
    const sinBase = await e.conductor(alSur(0.5), null);
    const r2 = await e.regreso(sinBase.token);
    expect(r2.estado).toBe(409);
    expect(r2.datos.error).toMatch(/ciudad base|home city/);
    const lejos = await e.conductor(alSur(0.5));
    expect((await e.regreso(lejos.token, 'GET')).datos).toMatchObject({
      disponible: true,
      ciudad: BASE.nombre,
      usosRestantes: 2,
    });
  });

  it('4. con un viaje en curso → 409', async () => {
    const e = await escena();
    const c = await e.conductor(alSur(0.5));
    const viaje = await e.pedirViaje(HACIA_CASA);
    await repartirOperaciones(undefined, e.m.DB);
    expect(await e.ofrecidaA(viaje)).toBe(c.id);
    expect(await c.paso(viaje, 'aceptar')).toBe(200);
    expect((await e.regreso(c.token, 'GET')).datos.disponible).toBe(false);
    const r = await e.regreso(c.token);
    expect(r.estado).toBe(409);
    expect(r.datos.error).toMatch(/viaje en curso|current trip/);
  });
});

describe('regreso con pasajero: usos del día (C-REGRESO-PASAJERO)', () => {
  const usosRegreso = async (m: ReturnType<typeof mundo>, id: string) =>
    Number(
      (
        await m.DB.prepare(
          'SELECT COALESCE(SUM(usos), 0) AS n FROM usos_regreso WHERE repartidor_id = ?',
        )
          .bind(id)
          .first<{ n: number }>()
      )?.n,
    );

  it('5. el uso se cuenta al aceptar el primer viaje, no al encender; el tercero → 409', async () => {
    const e = await escena();
    const c = await e.conductor(alSur(0.5));
    // Encender y apagar sin viaje no cuesta.
    expect((await e.regreso(c.token)).datos).toMatchObject({ activo: true, usosHoy: 0 });
    expect((await e.regreso(c.token, 'DELETE')).datos).toMatchObject({
      activo: false,
      usosRestantes: 2,
    });
    expect((await e.regreso(c.token)).estado).toBe(200);
    const viaje = await e.pedirViaje(HACIA_CASA);
    await repartirOperaciones(undefined, e.m.DB);
    expect(await c.paso(viaje, 'aceptar')).toBe(200);
    expect(await usosRegreso(e.m, c.id)).toBe(1);
    // Un segundo viaje en el mismo regreso no cuenta otro uso.
    await contarUsoRegreso(e.m.DB, c.id);
    expect(await usosRegreso(e.m, c.id)).toBe(1);
    // Dos usos gastados: el tercero no se enciende.
    await e.m.DB.prepare('UPDATE usos_regreso SET usos = 2 WHERE repartidor_id = ?')
      .bind(c.id)
      .run();
    await e.m.DB.prepare('DELETE FROM conductor_ocupacion WHERE conductor_id = ?')
      .bind(c.id)
      .run()
      .catch(() => undefined);
    await e.m.DB.prepare("UPDATE modo_destino SET activo = 0, motivo = 'a_mano'").run();
    const tercero = await e.regreso(c.token);
    expect(tercero.estado).toBe(409);
    expect(tercero.datos.error).toMatch(/dos veces|twice/);
  });

  it('5. dos aceptaciones a la vez no pasan de dos; el contador es aparte del modo destino', async () => {
    const e = await escena();
    const c = await e.conductor(alSur(0.5));
    // Primer regreso con su viaje: un uso.
    expect((await e.regreso(c.token)).estado).toBe(200);
    await contarUsoRegreso(e.m.DB, c.id);
    expect(await usosRegreso(e.m, c.id)).toBe(1);
    // Segundo regreso: dos aceptaciones a la vez cuentan UNA.
    await e.regreso(c.token, 'DELETE');
    expect((await e.regreso(c.token)).datos).toMatchObject({ activo: true, usosHoy: 1 });
    await Promise.all([contarUsoRegreso(e.m.DB, c.id), contarUsoRegreso(e.m.DB, c.id)]);
    expect(await usosRegreso(e.m, c.id)).toBe(2);
    await e.m.DB.prepare('UPDATE modo_destino SET uso_contado = 0 WHERE repartidor_id = ?')
      .bind(c.id)
      .run();
    await contarUsoRegreso(e.m.DB, c.id);
    expect(await usosRegreso(e.m, c.id)).toBe(2);
    // Los usos del modo destino de siempre siguen intactos.
    const d = await e.m.llamar('GET', '/datos/repartidor/destino', undefined, c.token);
    expect(d.datos).toMatchObject({ activo: false, usosRestantes: 2 });
  });
});

describe('regreso con pasajero: se apaga (C-REGRESO-PASAJERO)', () => {
  it('6. a mano y al desconectarse', async () => {
    const e = await escena();
    const c = await e.conductor(alSur(0.5));
    await e.regreso(c.token);
    expect((await e.regreso(c.token, 'DELETE')).datos).toMatchObject({
      activo: false,
      motivo: 'a_mano',
    });
    await e.regreso(c.token);
    await e.m.llamar('POST', '/datos/repartidor/conectar', { conectado: false }, c.token);
    expect((await e.regreso(c.token, 'GET')).datos).toMatchObject({
      activo: false,
      motivo: 'desconectado',
    });
  });

  it('6. al llegar a medio kilómetro de su ciudad base', async () => {
    const e = await escena();
    const c = await e.conductor(alSur(0.5));
    await e.regreso(c.token);
    await e.m.envejecerGps(c.id, 7200);
    await e.m.DB.prepare(
      "UPDATE ubicaciones_recientes SET creado_en = datetime(creado_en, '-7200 seconds')",
    ).run();
    await e.m.ubicar(c.token, { lat: BASE.lat + 0.002, lng: BASE.lng });
    expect((await e.regreso(c.token, 'GET')).datos).toMatchObject({
      activo: false,
      motivo: 'llegada',
    });
  });
});

describe('regreso con pasajero: convive con el modo destino (C-REGRESO-PASAJERO)', () => {
  it('7. encender el regreso apaga el modo destino, y al revés', async () => {
    const e = await escena();
    const c = await e.conductor(alSur(0.5));
    const destino = { direccion: 'Casa de prueba', lat: 25.9, lng: -80.2 };
    expect((await e.m.llamar('PUT', '/datos/repartidor/destino', destino, c.token)).estado).toBe(
      200,
    );
    expect((await e.regreso(c.token)).datos.activo).toBe(true);
    expect(
      (await e.m.llamar('GET', '/datos/repartidor/destino', undefined, c.token)).datos.activo,
    ).toBe(false);
    const otra = await e.m.llamar('PUT', '/datos/repartidor/destino', destino, c.token);
    expect(otra.datos.activo).toBe(true);
    expect((await e.regreso(c.token, 'GET')).datos.activo).toBe(false);
    // Apagar el modo destino no toca un regreso, ni apagar el regreso toca el modo destino.
    await e.m.llamar('DELETE', '/datos/repartidor/destino', undefined, c.token);
    await e.regreso(c.token);
    await e.m.llamar('DELETE', '/datos/repartidor/destino', undefined, c.token);
    expect((await e.regreso(c.token, 'GET')).datos.activo).toBe(true);
  });
});

describe('regreso con pasajero: la ciudad base (C-REGRESO-PASAJERO)', () => {
  it('8. se llena sola en la primera conexión y no cambia al conectarse en otra ciudad', async () => {
    const m = mundo({}, { host: 'staging.tumbite.com' });
    const r = await m.cuenta('repartidor', 'Conductor Nuevo');
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 25.77, lng: -80.19 },
      r.token,
    );
    const base = () =>
      m.DB.prepare('SELECT zona_base_id FROM repartidores WHERE usuario_id = ?')
        .bind(r.id)
        .first<{ zona_base_id: string | null }>();
    expect((await base())?.zona_base_id).toBe('US-FL-MIAMI');
    await m.DB.prepare(
      `INSERT OR IGNORE INTO zonas (id, nombre, pais, lat, lng, radio_km, activa)
       VALUES ('US-FL-OTRA-PRUEBA', 'Otra Ciudad', 'US', 26.5, -80.1, 20, 1)`,
    ).run();
    await m.llamar('POST', '/datos/repartidor/conectar', { conectado: false }, r.token);
    await m.llamar(
      'POST',
      '/datos/repartidor/conectar',
      { conectado: true, lat: 26.5, lng: -80.1 },
      r.token,
    );
    expect((await base())?.zona_base_id).toBe('US-FL-MIAMI');
  });

  it('11. el equipo ve y cambia la ciudad base desde la ficha (con auditoría)', async () => {
    const e = await escena();
    const c = await e.conductor(alSur(0.5), null);
    const ver = await e.m.llamar(
      'GET',
      `/datos/admin/conductores/${c.id}/ciudad-base`,
      undefined,
      e.admin.token,
    );
    expect(ver.datos.actual).toBeNull();
    expect(ver.datos.ciudades.map((z: { id: string }) => z.id)).toContain(BASE.id);
    const r = await e.m.llamar(
      'PUT',
      `/datos/admin/conductores/${c.id}/ciudad-base`,
      { zonaId: BASE.id, motivo: 'Vive en Ciudad Norte' },
      e.admin.token,
    );
    expect(r.estado, JSON.stringify(r.datos)).toBe(200);
    expect((await e.regreso(c.token, 'GET')).datos.ciudad).toBe(BASE.nombre);
    const aud = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM auditoria_admin WHERE accion = 'conductor.ciudad_base'",
    ).first<{ n: number }>();
    expect(aud?.n).toBe(1);
    // Un conductor no puede tocarla.
    expect(
      (
        await e.m.llamar(
          'PUT',
          `/datos/admin/conductores/${c.id}/ciudad-base`,
          { zonaId: BASE.id, motivo: 'Yo mismo' },
          c.token,
        )
      ).estado,
    ).toBe(403);
  });

  it('8. una base vieja recibe sola zona_base_id, tipo y uso_contado al arrancar', async () => {
    const m = mundo();
    await m.DB.prepare('ALTER TABLE repartidores DROP COLUMN zona_base_id').run();
    await m.DB.prepare('ALTER TABLE modo_destino DROP COLUMN tipo').run();
    await m.DB.prepare('ALTER TABLE modo_destino DROP COLUMN uso_contado').run();
    reiniciarEsquema();
    const salud = await m.llamar('GET', '/datos/salud');
    expect(salud.datos.piezas.esquema).toBe('ok');
    const cols = async (t: string) =>
      (
        await m.DB.prepare(`SELECT name FROM pragma_table_info('${t}')`).all<{ name: string }>()
      ).results.map((c) => c.name);
    expect(await cols('repartidores')).toContain('zona_base_id');
    expect(await cols('modo_destino')).toEqual(expect.arrayContaining(['tipo', 'uso_contado']));
    expect(await cols('usos_regreso')).toEqual(['repartidor_id', 'dia', 'usos']);
  });
});

describe('regreso con pasajero: presupuesto de la base (C-REGRESO-PASAJERO)', () => {
  /** Las sentencias y filas escritas de UNA vuelta de reparto. */
  async function vuelta(conRegreso: boolean) {
    const e = await escena();
    // El viaje primero (sin nadie cerca aún), así la vuelta medida es la que hace la oferta.
    const viaje = await e.pedirViaje(HACIA_CASA);
    const b1 = await e.conductor(alSur(1));
    const b2 = await e.conductor(alSur(3));
    if (conRegreso) expect((await e.regreso(b2.token)).estado).toBe(200);
    expect(await e.ofrecidaA(viaje)).toBeNull();
    const { db, cuenta } = contarFilas(e.m.DB, { conFirst: true });
    let sentencias = 0;
    const contada = new Proxy(db, {
      get(t, p) {
        if (p === 'prepare')
          return (sql: string) => {
            sentencias++;
            return t.prepare(sql);
          };
        const v = Reflect.get(t, p) as unknown;
        return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
      },
    });
    await repartirOperaciones(undefined, contada);
    expect(await e.ofrecidaA(viaje)).toBe(conRegreso ? b2.id : b1.id);
    return { escritas: cuenta.escritas, sentencias };
  }

  it('9. con el regreso encendido, la vuelta no hace consultas de más ni escribe una fila más', async () => {
    const sin = await vuelta(false);
    const con = await vuelta(true);
    expect(con.escritas).toBe(sin.escritas);
    expect(con.sentencias).toBeLessThanOrEqual(sin.sentencias);
  });
});

describe('regreso con pasajero: la app (C-REGRESO-PASAJERO)', () => {
  it('10. Driver tiene la tarjeta, sin «Pronto», con su texto en los dos idiomas', () => {
    const raiz = join(__dirname, '..', '..', '..');
    const app = readFileSync(join(raiz, 'apps/repartidor/src/piezas/RegresoACasa.tsx'), 'utf8');
    expect(app).toContain('/datos/repartidor/regreso');
    expect(app).toMatch(/Voy de regreso a/);
    expect(app).toMatch(/Heading home to/);
    expect(app).not.toMatch(/Pronto|Coming soon/i);
    expect(readFileSync(join(raiz, 'apps/repartidor/src/Inicio.tsx'), 'utf8')).toContain(
      '<RegresoACasa',
    );
  });
});
