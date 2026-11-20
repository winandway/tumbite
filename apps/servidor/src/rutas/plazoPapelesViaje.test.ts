import { afterEach, describe, expect, it } from 'vitest';
import { CIUDAD_PRUEBAS_VENEZUELA as CCS, politicaPlazoDeFabrica } from '@tumbite/compartido';
import {
  ORIGEN_CCS,
  abrirCaracas,
  aprobarConductorMoto,
  escenarioVe,
  pedirMotoVe,
  subirA,
} from '../pruebas/motoVe';
import { recordarPlazos } from '../plazoPapeles';
import { sincronizarPoliticaRequisitos } from '../esquemaPlazo';
import { type LlamadaIa, usarModeloVerificacion } from '../verificacionIa';
import { correrPlazoPapeles, plazoCumplido } from './verificacionConductor';

/**
 * C-PLAZO-PAPELES de punta a punta, con VIAJE (19 nov 2026, decisión de Richard) — Venezuela.
 * El reparto de viajes lo decide la base (vista `conductores_elegibles`), no TypeScript: esta prueba
 * comprueba que la base dice lo mismo que la app en todo el recorrido:
 * registro → activo → viaje → recordatorio → pausa al vencer → reactivación.
 * El modelo de la verificación es de mentira: ninguna prueba llama a Gemini.
 */
afterEach(() => usarModeloVerificacion(null));

const caraDeMentira: LlamadaIa = async () => ({
  texto: JSON.stringify({ clase: 'cara', legible: true, vencido: 'no_se_ve', confianza: 95 }),
  entrada: 1300,
  salida: 150,
});

async function nuevoEnCaracas() {
  const e = await escenarioVe();
  expect((await abrirCaracas(e)).estado).toBe(201);
  // El regalo de arranque de la ciudad: el saldo prepago con que paga sus primeras comisiones.
  expect(
    (
      await e.m.llamar(
        'PUT',
        `/datos/admin/regalo-conductor-nuevo/${CCS.id}`,
        { monto: 300, presupuesto: 3000, activo: true },
        e.admin.token,
      )
    ).estado,
  ).toBe(200);
  const rep = await e.m.cuenta('repartidor', 'Conductor de ejemplo');
  const yo = (metodo: string, ruta: string, cuerpo?: unknown) =>
    e.m.llamar(metodo, ruta, cuerpo, rep.token);
  let n = 0;
  const paso = async (op: string, nombre: string, cuerpo: unknown = {}) => {
    n++;
    const r = await e.m.crudo(`/datos/conductor/operaciones/${op}/${nombre}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${rep.token}`,
        'content-type': 'application/json',
        'idempotency-key': `plazo-${nombre}-${n}-${rep.id.slice(0, 8)}`,
      },
      body: JSON.stringify(cuerpo),
    });
    return { estado: r.status, datos: (await r.json()) as Record<string, unknown> };
  };
  const elegible = async () =>
    Boolean(
      await e.m.DB.prepare(
        "SELECT 1 FROM conductores_elegibles WHERE conductor_id = ? AND servicio_id = 'moto'",
      )
        .bind(rep.id)
        .first(),
    );
  const ofertaDe = async (viaje: string) =>
    (
      (await yo('GET', '/datos/conductor/operaciones/ofertas')).datos.ofertas as {
        operacionId: string;
      }[]
    ).find((o) => o.operacionId === viaje);
  const conectar = () =>
    yo('POST', '/datos/repartidor/conectar', { conectado: true, ...ORIGEN_CCS });
  /** El registro corto: ciudad, su moto y la foto de su cara. Nada más. */
  const registrar = async () => {
    usarModeloVerificacion(caraDeMentira);
    await e.m.DB.prepare("UPDATE usuarios SET fecha_nacimiento = '1994-05-10' WHERE id = ?")
      .bind(rep.id)
      .run();
    expect((await yo('PUT', '/datos/conductor/ciudad', { zonaId: CCS.id })).estado).toBe(200);
    const v = await yo('POST', '/datos/conductor/vehiculos', {
      tipo: 'moto',
      marca: 'Bera',
      modelo: 'SBR',
      anio: 2023,
      color: 'Negro',
      placa: `AB${Math.floor(Math.random() * 1e6)}`,
    });
    expect(v.estado).toBe(201);
    const vehiculo = v.datos.id as string;
    await yo('GET', '/datos/conductor/verificacion');
    expect(
      (await yo('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: vehiculo })).estado,
    ).toBe(200);
    expect((await yo('POST', '/datos/kyc/consentimiento', { acepto: true })).estado).toBe(200);
    expect(
      (await subirA(e, '/datos/conductor/verificacion/foto/cara?origen=camara', rep.token)).estado,
    ).toBe(201);
    expect(
      (await yo('PUT', '/datos/conductor/preferencias', { servicioId: 'moto', activa: true }))
        .estado,
    ).toBe(200);
    expect((await conectar()).estado).toBe(200);
    await yo('POST', '/datos/repartidor/ubicacion', { lat: ORIGEN_CCS.lat, lng: ORIGEN_CCS.lng });
    return vehiculo;
  };
  const vencer = () =>
    e.m.DB.prepare(
      "UPDATE plazo_papeles SET vence_en = datetime('now', '-1 hour') WHERE conductor_id = ?",
    )
      .bind(rep.id)
      .run();
  return { e, rep, yo, paso, elegible, ofertaDe, conectar, registrar, vencer };
}

describe('C-PLAZO-PAPELES: de crear la cuenta a llevar un pasajero, y de la pausa a volver', () => {
  it('registro → activo → viaje → recordatorio → pausa al vencer → reactivación', async () => {
    const c = await nuevoEnCaracas();
    const { e } = c;
    const vehiculo = await c.registrar();

    // ACTIVO: la base lo ofrece para Moto sin que nadie del equipo haya aprobado nada.
    expect(await c.elegible()).toBe(true);
    const sinAprobar = await e.m.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM habilitaciones WHERE conductor_id = ?1 AND estado = 'aprobada') AS h,
              (SELECT COUNT(*) FROM cumplimientos WHERE conductor_id = ?1 AND estado = 'aprobado') AS c,
              (SELECT estado FROM vehiculos WHERE id = ?2) AS v`,
    )
      .bind(c.rep.id, vehiculo)
      .first<{ h: number; c: number; v: string }>();
    expect(sinAprobar?.h).toBe(0);
    expect(sinAprobar?.c).toBe(0);
    expect(sinAprobar?.v).not.toBe('aprobado');

    // VIAJE: le llega la oferta, lo acepta, recoge con el PIN y lo termina.
    const v = await pedirMotoVe(e, 'efectivo');
    expect(await c.ofertaDe(v.id)).toBeTruthy();
    expect((await c.paso(v.id, 'aceptar')).estado).toBe(200);
    expect((await c.paso(v.id, 'llegue')).estado).toBe(200);
    const pin = (await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token)).datos
      .viaje.pin;
    expect((await c.paso(v.id, 'iniciar', { pin })).estado).toBe(200);
    expect((await c.paso(v.id, 'terminar')).estado).toBe(200);
    const viaje = await e.m.llamar('GET', `/datos/viajes/${v.id}`, undefined, e.cliente.token);
    expect(viaje.datos.viaje.estado).toBe('terminado');

    // RECORDATORIO: a 10 días del final, un aviso (una sola fila escrita) y sigue trabajando.
    const env = { DB: e.m.DB } as never;
    const situacion = async () => ((await plazoCumplido(e.m.DB, c.rep.id)) ? 'completo' : 'falta');
    await e.m.DB.prepare(
      "UPDATE plazo_papeles SET vence_en = datetime('now', '+10 days') WHERE conductor_id = ?",
    )
      .bind(c.rep.id)
      .run();
    expect((await recordarPlazos(env, e.m.DB, situacion)).avisados).toBe(1);
    expect((await recordarPlazos(env, e.m.DB, situacion)).avisados).toBe(0);
    expect(await c.elegible()).toBe(true);

    // PAUSA AL VENCER: en el mismo instante en que vence, la base deja de ofrecerlo (es una fecha:
    // no depende de que corra ninguna tarea). No se borra nada.
    await c.vencer();
    expect(await c.elegible()).toBe(false);
    const otro = await pedirMotoVe(e, 'efectivo');
    expect(await c.ofertaDe(otro.id)).toBeUndefined();
    expect((await recordarPlazos(env, e.m.DB, situacion)).vencidos).toBe(1);
    expect((await c.yo('GET', '/datos/conductor/verificacion')).datos.plazo.estado).toBe('vencido');
    const sigue = await e.m.DB.prepare(
      'SELECT (SELECT activo FROM usuarios WHERE id = ?1) AS a, (SELECT COUNT(*) FROM vehiculos WHERE conductor_id = ?1) AS v',
    )
      .bind(c.rep.id)
      .first<{ a: number; v: number }>();
    expect(sigue).toEqual({ a: 1, v: 1 });

    // REACTIVACIÓN: sube lo que faltaba, el equipo lo aprueba (sin antecedentes: Venezuela no los
    // pide) y vuelve a recibir viajes, ya con la regla entera.
    await aprobarConductorMoto(e, c.rep, vehiculo);
    await c.yo('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: vehiculo });
    expect((await c.conectar()).estado).toBe(200);
    await c.yo('POST', '/datos/repartidor/ubicacion', {
      lat: ORIGEN_CCS.lat,
      lng: ORIGEN_CCS.lng,
    });
    expect(await c.elegible()).toBe(true);
    expect(await plazoCumplido(e.m.DB, c.rep.id)).toBe(true);
    const sinAntecedentes = await e.m.DB.prepare(
      "SELECT COUNT(*) AS n FROM cumplimientos WHERE conductor_id = ? AND requisito LIKE 'antecedentes%'",
    )
      .bind(c.rep.id)
      .first<{ n: number }>();
    expect(sinAntecedentes?.n).toBe(0);
  });

  it('lo que el equipo negó sigue negado dentro del plazo: vehículo rechazado o habilitación suspendida', async () => {
    const c = await nuevoEnCaracas();
    const vehiculo = await c.registrar();
    expect(await c.elegible()).toBe(true);
    await c.e.m.DB.prepare(
      "INSERT INTO habilitaciones (conductor_id, servicio_id, estado) VALUES (?, 'moto', 'suspendida') ON CONFLICT(conductor_id, servicio_id) DO UPDATE SET estado = 'suspendida'",
    )
      .bind(c.rep.id)
      .run();
    expect(await c.elegible()).toBe(false);
    await c.e.m.DB.prepare(
      "UPDATE habilitaciones SET estado = 'pendiente' WHERE conductor_id = ? AND servicio_id = 'moto'",
    )
      .bind(c.rep.id)
      .run();
    expect(await c.elegible()).toBe(true);
    await c.e.m.DB.prepare('DROP TRIGGER IF EXISTS vehiculos_transicion_valida').run();
    await c.e.m.DB.prepare("UPDATE vehiculos SET estado = 'rechazado' WHERE id = ?")
      .bind(vehiculo)
      .run();
    expect(await c.elegible()).toBe(false);
  });

  it('un país sin plazo no cambia: en Estados Unidos, sin aprobación la base no ofrece a nadie', async () => {
    const c = await nuevoEnCaracas();
    await c.registrar();
    // El mismo conductor, sin su plazo: la regla entera.
    await c.e.m.DB.prepare('DELETE FROM plazo_papeles WHERE conductor_id = ?').bind(c.rep.id).run();
    expect(await c.elegible()).toBe(false);
  });

  it('la política que la base lee sale de la configuración del país y solo se escribe lo que cambia', async () => {
    const c = await nuevoEnCaracas();
    const filas = async () =>
      (
        await c.e.m.DB.prepare(
          'SELECT pais, requisito, regla FROM politica_requisitos ORDER BY pais, regla, requisito',
        ).all<{ pais: string; requisito: string; regla: string }>()
      ).results.map((f) => `${f.pais}:${f.requisito}:${f.regla}`);
    expect(await filas()).toEqual([
      'PE:licencia:para_empezar',
      'PE:licencia_moto:para_empezar',
      'PE:seguro_pasajeros:para_empezar',
      'PE:seguro_vehiculo:para_empezar',
      'VE:antecedentes:exento',
      'VE:antecedentes_pasajeros:exento',
    ]);
    // Sin cambios, sincronizar no escribe nada.
    expect(await sincronizarPoliticaRequisitos(c.e.m.DB)).toBe(0);
    // El equipo decide que Venezuela pida la licencia para empezar: la base lo sabe en el acto.
    const vehiculo = await c.registrar();
    expect(await c.elegible()).toBe(true);
    const r = await c.e.m.llamar(
      'PUT',
      '/datos/admin/paises/VE',
      { plazoPapeles: { ...politicaPlazoDeFabrica('VE'), paraEmpezar: ['cara', 'licencia'] } },
      c.e.admin.token,
    );
    expect(r.estado).toBe(200);
    expect(await filas()).toContain('VE:licencia_moto:para_empezar');
    expect(await c.elegible()).toBe(false);
    expect(vehiculo).toBeTruthy();
  });

  it('la tarea diaria solo trabaja a su hora', async () => {
    const c = await nuevoEnCaracas();
    const r = await correrPlazoPapeles({ DB: c.e.m.DB } as never, c.e.m.DB);
    if (new Date().getUTCHours() !== 13) expect(r).toBe(0);
  });
});

describe('C-PLAZO-PAPELES: la lista de conductores del equipo', () => {
  it('muestra el estado de papeles y los días que quedan, y filtra «con plazo por vencer»', async () => {
    const c = await nuevoEnCaracas();
    await c.registrar();
    const lista = (filtro = '') =>
      c.e.m.llamar('GET', `/datos/admin/repartidores${filtro}`, undefined, c.e.admin.token);
    const yo = (r: { datos: { repartidores: { id: string }[] } }) =>
      r.datos.repartidores.find((x) => x.id === c.rep.id) as
        { papeles: string; diasPlazo: number | null } | undefined;
    expect(yo(await lista())).toMatchObject({ papeles: 'en_plazo', diasPlazo: 30 });
    // Con 30 días por delante no está «por vencer».
    expect(yo(await lista('?plazo=por_vencer'))).toBeUndefined();
    expect(yo(await lista('?plazo=en_plazo'))).toBeTruthy();
    await c.e.m.DB.prepare(
      "UPDATE plazo_papeles SET vence_en = datetime('now', '+4 days') WHERE conductor_id = ?",
    )
      .bind(c.rep.id)
      .run();
    expect(yo(await lista('?plazo=por_vencer'))).toMatchObject({
      papeles: 'en_plazo',
      diasPlazo: 4,
    });
    await c.vencer();
    expect(yo(await lista('?plazo=por_vencer'))).toBeUndefined();
    expect(yo(await lista('?plazo=vencido'))).toMatchObject({
      papeles: 'vencido',
      diasPlazo: null,
    });
    // Quien no tiene plazo (los de antes) sale como siempre.
    await c.e.m.DB.prepare('DELETE FROM plazo_papeles WHERE conductor_id = ?').bind(c.rep.id).run();
    expect(yo(await lista())).toMatchObject({ papeles: 'sin_plazo', diasPlazo: null });
  });
});

describe('C-PLAZO-PAPELES: Venezuela no pide antecedentes', () => {
  it('el equipo aprueba la habilitación de Moto sin certificado de antecedentes, y en la lista del conductor no aparecen', async () => {
    const c = await nuevoEnCaracas();
    const vehiculo = await c.registrar();
    const req = await c.yo('GET', '/datos/conductor/servicios/moto/requisitos');
    expect(req.estado).toBe(200);
    expect(JSON.stringify(req.datos)).not.toMatch(/antecedentes/);
    await aprobarConductorMoto(c.e, c.rep, vehiculo);
    const h = await c.e.m.DB.prepare(
      "SELECT estado FROM habilitaciones WHERE conductor_id = ? AND servicio_id = 'moto'",
    )
      .bind(c.rep.id)
      .first<{ estado: string }>();
    expect(h?.estado).toBe('aprobada');
  });
});
