import { sqlAptos } from './aprobadosNoElegibles';
import type { Env } from './env';
import { notificar } from './notificaciones';
import { type ClaveFalta, type Falta, queTeFalta } from './queTeFalta';
import { type PapelQueFalta, papelesPaisQueFaltan } from './papelesPais';

/**
 * C-BARRA-ACTIVACION (23 nov 2026, Richard: «una barra del usuario, su barra verde, con los pasos
 * mínimos para que se active… al llegar al final, yo de mi lado estaría seguro que su moto ya puede
 * recibir carreras») — todos los países.
 *
 * UNA sola fuente de verdad para el panel (Verificaciones, la ficha y la lista de conductores) y para
 * Driver: los pasos salen de `queTeFalta` (la misma pieza que ve el conductor en Driver) y el
 * veredicto sale del MISMO texto de la vista `conductores_elegibles` que usa el reparto (`sqlAptos`: la
 * vista sin «conectado», o sea, quien recibiría viajes con solo abrir Driver). Nunca una lista aparte
 * que pueda mentir: si la barra dice «ya puede», el reparto lo toma; si el reparto no lo toma, la
 * barra nombra lo que falta.
 *
 * Solo LEE (mirar no escribe): queTeFalta + una lectura de su verificación + una de la vista.
 */

export type ClavePaso =
  | 'telefono'
  | 'cara'
  | 'documento'
  | 'identidad'
  | 'vehiculo'
  | 'vehiculo_aprobado'
  | 'vehiculo_activo'
  | 'servicio'
  | 'zona'
  | 'saldo'
  | 'papeles'
  /** C-PAPELES-POR-PAIS: los papeles de su país que «solo se piden» (nunca frena; solo con la lista encendida). */
  | 'papeles_pais'
  | 'requisitos'
  | 'conectado'
  | 'pago_movil';

/** Quién tiene que hacerlo: el conductor, el equipo (con su botón en el panel) o el sistema solo. */
export type Quien = 'conductor' | 'equipo' | 'sistema';

export type Paso = {
  clave: ClavePaso;
  /** `hecho` en verde, `pendiente` en gris, `problema` en rojo (solo lo que de verdad está mal). */
  estado: 'hecho' | 'pendiente' | 'problema';
  quien: Quien;
  /** Un paso opcional («recibe más carreras») nunca impide activarse. */
  opcional: boolean;
  /** La falta de «qué te falta» que lo explica (la misma que ve el conductor en Driver). */
  falta?: ClaveFalta;
  vehiculoId?: string;
  motivo?: string;
  /** C-PAPELES-POR-PAIS: en el paso `papeles_pais`, cuáles faltan o esperan revisión. */
  papelesPais?: PapelQueFalta[];
};

export type Activacion = {
  pasos: Paso[];
  /** El reparto lo tomaría con solo abrir Driver y conectarse (misma vista del reparto). */
  listo: boolean;
  /** Está recibiendo carreras ahora mismo (conectado y elegible). */
  recibiendo: boolean;
  /** Los servicios que recibiría (o recibe): `moto`, `carro`, `comida`… */
  servicios: string[];
  /** El primer paso que falta (para la frase «Todavía no: falta X, le toca a Y»). */
  siguiente: Paso | null;
  hechos: number;
  total: number;
  /** El vehículo que se mira (activo o el mejor que tenga). */
  vehiculo: { id: string; tipo: string; estado: string; activo?: boolean } | null;
};

/** El paso de la barra al que corresponde cada falta de «qué te falta». */
const PASO_DE_TABLA: Record<ClaveFalta, ClavePaso> = {
  telefono: 'telefono',
  cara: 'cara',
  sin_vehiculo: 'vehiculo',
  sin_placa: 'vehiculo',
  // C-BARRA-VEHICULO-COHERENTE: registrado con su placa pero sin enviar = lo que falta es mandarlo a
  // revisión (el paso de la aprobación, que le toca a él), no «registrarlo».
  vehiculo_sin_enviar: 'vehiculo_aprobado',
  vehiculo_rechazado: 'vehiculo_aprobado',
  vehiculo_en_revision: 'vehiculo_aprobado',
  vehiculo_sin_activar: 'vehiculo_activo',
  servicio_no_disponible: 'zona',
  sin_restaurantes: 'zona',
  sin_habilitacion: 'servicio',
  sin_servicio_encendido: 'conectado',
  sin_saldo: 'saldo',
  sin_pago_movil: 'pago_movil',
  papeles_sin_enviar: 'papeles',
  ubicacion_vieja: 'conectado',
  desconectado: 'conectado',
};

/** El orden de la barra: lo primero es lo que hay que hacer primero. */
export const ORDEN_PASOS: readonly ClavePaso[] = [
  'telefono',
  'cara',
  'documento',
  'identidad',
  'vehiculo',
  'vehiculo_aprobado',
  'vehiculo_activo',
  'servicio',
  'zona',
  'saldo',
  'papeles',
  'papeles_pais',
  'requisitos',
  'conectado',
  'pago_movil',
];

/** De quién depende cada paso. */
const QUIEN_DE_TABLA: Record<ClavePaso, Quien> = {
  telefono: 'conductor',
  cara: 'conductor',
  documento: 'conductor',
  identidad: 'equipo',
  vehiculo: 'conductor',
  vehiculo_aprobado: 'equipo',
  vehiculo_activo: 'sistema',
  servicio: 'equipo',
  zona: 'equipo',
  saldo: 'conductor',
  papeles: 'conductor',
  papeles_pais: 'conductor',
  requisitos: 'equipo',
  conectado: 'conductor',
  pago_movil: 'conductor',
};

const PASO_DE = new Map(Object.entries(PASO_DE_TABLA)) as Map<ClaveFalta, ClavePaso>;
const QUIEN_DE = new Map(Object.entries(QUIEN_DE_TABLA)) as Map<ClavePaso, Quien>;
const quienBase = (c: ClavePaso): Quien => QUIEN_DE.get(c) ?? 'equipo';

function quienDe(paso: ClavePaso, f: Falta): Quien {
  if (f.quien === 'conductor') return 'conductor';
  return quienBase(paso) === 'sistema' ? 'sistema' : 'equipo';
}

/** Los servicios que el reparto le daría a este conductor con solo conectarse (la vista sin «conectado»). */
export async function serviciosAptos(db: D1Database, id: string): Promise<string[]> {
  const { results } = await db
    .prepare(
      `WITH uno AS MATERIALIZED (SELECT ? AS id)
       SELECT DISTINCT servicio_id FROM (${sqlAptos(undefined, 'uno')}) ORDER BY servicio_id`,
    )
    .bind(id)
    .all<{ servicio_id: string }>();
  return results.map((r) => r.servicio_id);
}

/** Varios a la vez (la lista de conductores): UNA lectura por página, nunca una por fila. */
export async function aptosDeVarios(db: D1Database, ids: readonly string[]): Promise<Set<string>> {
  const lista = [...new Set(ids)].slice(0, 100);
  if (!lista.length) return new Set();
  const { results } = await db
    .prepare(
      `WITH pg AS MATERIALIZED (SELECT value AS id FROM json_each(?))
       SELECT DISTINCT conductor_id FROM (${sqlAptos(undefined, 'pg')})`,
    )
    .bind(JSON.stringify(lista))
    .all<{ conductor_id: string }>();
  return new Set(results.map((r) => r.conductor_id));
}

/** Los servicios que se reparten como operación (viaje o envío): ahí el saldo prepago frena la oferta. */
export const SERVICIOS_CON_SALDO: ReadonlySet<string> = new Set(['moto', 'carro', 'envios']);

const bloquea = (p: Paso) => !p.opcional && p.clave !== 'conectado';

export async function barraActivacion(db: D1Database, id: string, env?: Env): Promise<Activacion> {
  const [q, kyc, aptos, delPais] = await Promise.all([
    queTeFalta(db, id, env),
    db
      .prepare(
        'SELECT estado, motivo, doc_frente IS NOT NULL AS documento FROM kyc WHERE usuario_id = ?',
      )
      .bind(id)
      .first<{ estado: string; motivo: string; documento: number }>(),
    serviciosAptos(db, id),
    papelesPaisQueFaltan(db, id),
  ]);
  // C-BARRA-SALDO (ensayo general, 24 nov 2026): donde rige el prepago, el reparto de viajes y envíos
  // salta a quien no le alcanza el saldo para la comisión (C-SALDO-OFERTAS, en operaciones.ts). La
  // vista no lo sabe: sin esto la barra decía «Ya puede recibir carreras» y «Saldo · No lo frena».
  const sinSaldo = q.faltas.some((f) => f.clave === 'sin_saldo');
  const aptosDeVerdad = sinSaldo ? aptos.filter((sv) => !SERVICIOS_CON_SALDO.has(sv)) : aptos;
  const listo = aptosDeVerdad.length > 0;
  const recibiendo = q.recibeViajes && listo;
  const porPaso = new Map<ClavePaso, Paso>();
  const poner = (p: Paso) => {
    if (!porPaso.has(p.clave)) porPaso.set(p.clave, p);
  };
  for (const f of q.faltas) {
    const clave = PASO_DE.get(f.clave) ?? 'requisitos';
    poner({
      clave,
      estado: f.clave === 'vehiculo_rechazado' ? 'problema' : 'pendiente',
      quien: quienDe(clave, f),
      opcional: clave === 'pago_movil',
      falta: f.clave,
      ...(f.vehiculoId ? { vehiculoId: f.vehiculoId } : {}),
      ...(f.motivo ? { motivo: f.motivo } : {}),
    });
  }
  // La verificación de identidad: el documento lo sube él; aprobarla es del equipo.
  const estadoKyc = kyc?.estado ?? 'sin_enviar';
  if (estadoKyc !== 'aprobado') {
    if (!Number(kyc?.documento))
      poner({ clave: 'documento', estado: 'pendiente', quien: 'conductor', opcional: false });
    poner({
      clave: 'identidad',
      estado: estadoKyc === 'rechazado' ? 'problema' : 'pendiente',
      quien: estadoKyc === 'pendiente' ? 'equipo' : 'conductor',
      opcional: false,
      ...(estadoKyc === 'rechazado' && kyc?.motivo ? { motivo: kyc.motivo } : {}),
    });
  }
  // El vehículo en revisión DENTRO del plazo no lo frena, pero el equipo todavía tiene que aprobarlo.
  if (q.vehiculo?.estado === 'en_revision')
    poner({
      clave: 'vehiculo_aprobado',
      estado: 'pendiente',
      quien: 'equipo',
      opcional: false,
      vehiculoId: q.vehiculo.id,
    });
  // C-BARRA-VEHICULO-COHERENTE (25 nov 2026, Richard en la ficha de un conductor de Tucaní: «Vehículo
  // registrado: le toca al conductor» en gris y «Vehículo aprobado» y «Vehículo en uso» en verde) —
  // todos los países. «Aprobado» y «en uso» son verdes SOLO si su vehículo lo está de verdad: un paso
  // sin falta ya no se da por hecho. La barra y los estados del vehículo dicen lo mismo.
  const v = q.vehiculo;
  if (v?.estado !== 'aprobado')
    poner({
      clave: 'vehiculo_aprobado',
      estado: v?.estado === 'vencido' ? 'problema' : 'pendiente',
      quien: v?.estado === 'en_revision' ? 'equipo' : 'conductor',
      opcional: false,
      ...(v ? { vehiculoId: v.id } : {}),
      ...(v?.estado === 'registrado' ? { falta: 'vehiculo_sin_enviar' as const } : {}),
    });
  if (!v?.activo)
    poner({
      clave: 'vehiculo_activo',
      estado: 'pendiente',
      // Aprobado y sin usar lo elige él; si no está aprobado, queda en uso solo al aprobarlo.
      quien: v?.estado === 'aprobado' ? 'conductor' : 'sistema',
      opcional: false,
      ...(v ? { vehiculoId: v.id } : {}),
    });
  // C-PAPELES-POR-PAIS: con la lista de su país encendida, sus papeles que «solo se piden». Nunca frena
  // (el reparto no los mira): es opcional y la frase del final sigue saliendo del reparto.
  if (delPais)
    poner(
      delPais.length
        ? {
            clave: 'papeles_pais',
            estado: 'pendiente',
            quien: delPais.some((p) => p.estado === 'falta') ? 'conductor' : 'equipo',
            opcional: true,
            papelesPais: delPais,
          }
        : { clave: 'papeles_pais', estado: 'hecho', quien: 'conductor', opcional: true },
    );
  // Ningún paso nombrado lo frena y aun así el reparto no lo toma: un requisito de su servicio (un
  // papel del vehículo o la habilitación) sigue sin aprobar. Nunca «todo en verde» y «todavía no».
  if (!listo && ![...porPaso.values()].some(bloquea))
    poner({ clave: 'requisitos', estado: 'pendiente', quien: 'equipo', opcional: false });

  const pasos: Paso[] = ORDEN_PASOS.filter(
    (c) => (c !== 'requisitos' && c !== 'papeles_pais') || porPaso.has(c),
  ).map((c): Paso => {
    const p = porPaso.get(c);
    if (c === 'conectado')
      return recibiendo
        ? { clave: c, estado: 'hecho', quien: 'conductor', opcional: false }
        : (p ?? {
            clave: c,
            estado: 'pendiente',
            quien: 'conductor',
            opcional: false,
            falta: 'desconectado',
          });
    if (!p) return { clave: c, estado: 'hecho', quien: quienBase(c), opcional: c === 'pago_movil' };
    // El reparto ya lo toma (p. ej. dentro del plazo de papeles): lo pendiente no lo frena.
    return listo && bloquea(p) ? { ...p, opcional: true } : p;
  });
  const siguiente = recibiendo
    ? null
    : (pasos.find((p) => p.estado !== 'hecho' && bloquea(p)) ??
      pasos.find((p) => p.clave === 'conectado') ??
      null);
  const cuentan = pasos.filter((p) => !p.opcional || p.estado === 'hecho');
  return {
    pasos,
    listo,
    recibiendo,
    servicios: aptosDeVerdad,
    siguiente,
    hechos: cuentan.filter((p) => p.estado === 'hecho').length,
    total: cuentan.length,
    vehiculo: q.vehiculo,
  };
}

/**
 * C-BARRA-ACTIVACION, el aviso: cuando una decisión del equipo deja al conductor listo para recibir
 * carreras, le llega UNA vez en la vida «Ya puedes recibir carreras» (y, si no tiene su pago móvil
 * donde rige, que por ahora solo le llegan en efectivo). Una sola escritura: la marca, tomada antes de
 * avisar para que dos decisiones a la vez no lo avisen dos veces. Nunca rompe la decisión que lo llamó.
 */
export async function avisarSiQuedoActivo(env: Env, db: D1Database, id: string): Promise<boolean> {
  try {
    const ya = await db
      .prepare('SELECT activacion_avisada_en AS en FROM repartidores WHERE usuario_id = ?')
      .bind(id)
      .first<{ en: string | null }>();
    if (!ya || ya.en) return false;
    if (!(await serviciosAptos(db, id)).length) return false;
    const marca = await db
      .prepare(
        "UPDATE repartidores SET activacion_avisada_en = datetime('now') WHERE usuario_id = ? AND activacion_avisada_en IS NULL",
      )
      .bind(id)
      .run();
    if (!Number(marca.meta?.changes ?? 0)) return false;
    const soloEfectivo = (await queTeFalta(db, id)).faltas.some(
      (f) => f.clave === 'sin_pago_movil',
    );
    await notificar(env, db, { id: id, app: 'repartidor' }, (i) => ({
      titulo: i === 'en' ? 'You can now receive trips' : 'Ya puedes recibir carreras',
      cuerpo: soloEfectivo
        ? i === 'en'
          ? 'Open Divoox Driver and swipe to go online. For now you only get cash trips: add your mobile payment account to get more.'
          : 'Abre Divoox Driver y desliza para conectarte. Por ahora solo recibes carreras en efectivo: agrega tu pago móvil para recibir más.'
        : i === 'en'
          ? 'Open Divoox Driver and swipe to go online.'
          : 'Abre Divoox Driver y desliza para conectarte.',
      datos: { tipo: 'conductor_activado' },
    }));
    return true;
  } catch (e) {
    console.error('activación: aviso al conductor', String(e));
    return false;
  }
}
