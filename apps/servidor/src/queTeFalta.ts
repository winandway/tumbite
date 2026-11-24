import { cuentasQueReciben, esPagoACelular, perfilPasajeros } from '@tumbite/compartido';
import type { Env } from './env';
import { comisionTipicaComida } from './internacional/cobroDirecto';
import { saldoLibro } from './internacional/libro';
import { leerConfigPais } from './internacional/paises';
import { MINUTOS_UBICACION_VIGENTE } from './operaciones';
import { empezarPlazo, graciaDe } from './plazoPapeles';
import { comisionTipicaMoto } from './rutas/viajesPasajero';
import { estadoVerificacion } from './rutas/verificacionConductor';
import { puertaTelefono } from './telefonoVuelta';

/**
 * C-QUE-TE-FALTA (23 nov 2026, conductor real de Venezuela con su moto guardada sin placa) — todos los
 * países. «Qué te falta para recibir carreras», calculado UNA sola vez aquí con las mismas reglas que
 * usa el reparto para ofrecer un viaje (la vista `conductores_elegibles`, la ubicación vigente de
 * `candidatosParaOperacion`, el saldo para la comisión y la cuenta de pago a celular de
 * `operaciones.ts`). Lo usan Driver (el bloque de arriba del inicio y el motivo al deslizar) y la
 * ficha del conductor en el panel. La app no lo adivina.
 *
 * Solo LEE (nunca escribe por mirar): una consulta grande con todo lo del conductor, más el saldo y el
 * teléfono donde rigen. Va en orden de importancia: lo primero de la lista es lo que hay que hacer ya.
 */
export type ClaveFalta =
  | 'cara'
  | 'telefono'
  | 'sin_vehiculo'
  | 'sin_placa'
  | 'vehiculo_rechazado'
  | 'vehiculo_sin_enviar'
  | 'vehiculo_en_revision'
  | 'vehiculo_sin_activar'
  | 'servicio_no_disponible'
  | 'sin_habilitacion'
  | 'sin_servicio_encendido'
  | 'sin_saldo'
  | 'sin_pago_movil'
  | 'ubicacion_vieja'
  | 'papeles_sin_enviar'
  | 'sin_restaurantes'
  | 'desconectado';

export type Falta = {
  clave: ClaveFalta;
  /** «conductor»: lo hace él (lleva botón). «divoox»: lo hacemos nosotros (sin botón). */
  quien: 'conductor' | 'divoox';
  vehiculoId?: string;
  vehiculoTipo?: string;
  /** El motivo que escribió el equipo (vehículo rechazado). */
  motivo?: string;
};

const MOTORIZADOS = new Set(['carro', 'moto', 'scooter']);
const PASAJEROS = new Set(['moto', 'carro']);
/** El orden en que se elige «el» vehículo cuando no tiene uno activo. */
const RANGO_VEHICULO = ['aprobado', 'en_revision', 'registrado', 'rechazado'];

type FilaVehiculo = {
  id: string;
  tipo: string;
  placa: string;
  placa_estado: string;
  estado: string;
  motivo: string;
};

export async function queTeFalta(
  db: D1Database,
  id: string,
  env?: Env,
): Promise<{
  recibeViajes: boolean;
  faltas: Falta[];
  /** El vehículo que se mira (el activo o el mejor que tenga): lo usa la barra de activación. */
  vehiculo: { id: string; tipo: string; estado: string } | null;
}> {
  // La cuenta nueva de un país con plazo nace con él (una sola escritura en su vida, como al leer
  // «Tus papeles»): sin esto, la primera lectura no sabía que la cara era lo que faltaba.
  if (env) await empezarPlazo(env, db, id, 'registro');
  const [g, filas] = await Promise.all([
    graciaDe(db, id),
    db.batch([
      db
        .prepare(
          `SELECT d.conectado, d.vehiculo_activo_id AS activo, z.pais, z.moneda, d.zona_id AS zona,
             (d.ubicacion_en IS NOT NULL AND d.ubicacion_en > datetime('now', '-${MINUTOS_UBICACION_VIGENTE} minutes')) AS ubicacion,
             EXISTS (SELECT 1 FROM conductores_elegibles e WHERE e.conductor_id = d.usuario_id) AS elegible,
             EXISTS (SELECT 1 FROM conductores_elegibles e WHERE e.conductor_id = d.usuario_id AND e.servicio_id != 'comida') AS elegible_sin_comida,
             EXISTS (SELECT 1 FROM restaurantes r WHERE r.zona_id = d.zona_id AND r.estado = 'aprobado') AS restaurantes,
             EXISTS (SELECT 1 FROM kyc k WHERE k.usuario_id = d.usuario_id AND k.selfie IS NOT NULL) AS cara,
             EXISTS (SELECT 1 FROM preferencias_servicio p WHERE p.conductor_id = d.usuario_id AND p.activa = 1) AS encendido,
             EXISTS (SELECT 1 FROM habilitaciones h WHERE h.conductor_id = d.usuario_id AND h.estado = 'aprobada') AS habilitado,
             EXISTS (SELECT 1 FROM servicios_zona sz WHERE sz.zona_id = d.zona_id AND sz.estado = 'disponible') AS abierto
             FROM repartidores d LEFT JOIN zonas z ON z.id = d.zona_id
            WHERE d.usuario_id = ?`,
        )
        .bind(id),
      db
        .prepare(
          "SELECT id, tipo, placa, placa_estado, estado, motivo FROM vehiculos WHERE conductor_id = ? AND estado != 'retirado' ORDER BY creado_en",
        )
        .bind(id),
      db
        .prepare(
          "SELECT tipo, pais FROM cuentas_cobro WHERE usuario_id = ? AND activa = 1 AND activa_desde <= datetime('now')",
        )
        .bind(id),
    ]),
  ]);
  const f = filas[0]?.results.at(0) as
    | {
        conectado: number;
        activo: string | null;
        pais: string | null;
        moneda: string | null;
        zona: string | null;
        ubicacion: number;
        elegible: number;
        elegible_sin_comida: number;
        restaurantes: number;
        cara: number;
        encendido: number;
        habilitado: number;
        abierto: number;
      }
    | undefined;
  const vehiculos = (filas[1]?.results ?? []) as FilaVehiculo[];
  const cuentas = (filas[2]?.results ?? []) as { tipo: string; pais: string }[];
  const faltas: Falta[] = [];
  const poner = (x: Falta) => faltas.push(x);
  const pais = f?.pais ?? g.pais ?? 'US';
  const perfil = perfilPasajeros(pais);

  // 1. La cara, donde su país la pide para empezar (la tarjeta de la cara).
  if (g.activa && g.politica.paraEmpezar.includes('cara') && !Number(f?.cara))
    poner({ clave: 'cara', quien: 'conductor' });
  // 2. El celular, donde se exige confirmarlo para conectarse.
  if (env && (await puertaTelefono(env, db, id).catch(() => null))?.obligatorio)
    poner({ clave: 'telefono', quien: 'conductor' });

  // 3. El vehículo: el activo, o el mejor que tenga.
  const activo = vehiculos.find((v) => v.id === f?.activo) ?? null;
  const elegido =
    activo ??
    [...vehiculos].sort(
      (a, b) => RANGO_VEHICULO.indexOf(a.estado) - RANGO_VEHICULO.indexOf(b.estado),
    )[0] ??
    null;
  let enviarDespues: { vehiculoId: string; vehiculoTipo: string } | null = null;
  const enPlazo = (estado: string) =>
    g.activa && estado !== 'rechazado' && estado !== 'suspendido' && estado !== 'retirado';
  if (!elegido) poner({ clave: 'sin_vehiculo', quien: 'conductor' });
  else {
    const de = { vehiculoId: elegido.id, vehiculoTipo: elegido.tipo };
    const editable = elegido.estado === 'registrado' || elegido.estado === 'rechazado';
    const sinPlaca =
      MOTORIZADOS.has(elegido.tipo) &&
      (!elegido.placa || (!perfil.placaNacional && !elegido.placa_estado));
    if (sinPlaca && editable) poner({ clave: 'sin_placa', quien: 'conductor', ...de });
    if (elegido.estado === 'rechazado')
      poner({ clave: 'vehiculo_rechazado', quien: 'conductor', motivo: elegido.motivo, ...de });
    else if (elegido.estado === 'suspendido')
      poner({ clave: 'vehiculo_rechazado', quien: 'divoox', motivo: elegido.motivo, ...de });
    else if (elegido.estado === 'registrado' && !g.activa)
      poner({ clave: 'vehiculo_sin_enviar', quien: 'conductor', ...de });
    // C-PAPEL-DICE-LA-VERDAD: dentro del plazo trabaja con ella, pero nadie la revisa hasta enviarla.
    else if (elegido.estado === 'registrado') enviarDespues = { ...de };
    else if (elegido.estado === 'en_revision' && !g.activa)
      poner({ clave: 'vehiculo_en_revision', quien: 'divoox', ...de });
    // Se puede activar: aprobado, o dentro del plazo (regla de `PUT /conductor/vehiculo-activo`).
    if (!activo && (elegido.estado === 'aprobado' || enPlazo(elegido.estado)))
      poner({ clave: 'vehiculo_sin_activar', quien: 'conductor', ...de });
  }

  // 4. Los servicios de su ciudad, su aprobación y su encendido.
  if (f && !Number(f.abierto) && !Number(f.elegible))
    poner({ clave: 'servicio_no_disponible', quien: 'divoox' });
  else if (f && !Number(f.habilitado) && !g.activa && !Number(f.elegible))
    poner({ clave: 'sin_habilitacion', quien: 'divoox' });
  // Al deslizar «Conectarme» se encienden todos los aprobados: solo falta si ya está conectado.
  if (f && Number(f.conectado) && !Number(f.encendido))
    poner({ clave: 'sin_servicio_encendido', quien: 'conductor' });

  // C-SERVICIO-SIN-OFERTA: solo podría hacer Comida y su zona no tiene restaurantes todavía.
  const soloComidaVacia =
    Boolean(f) &&
    Number(f?.elegible) === 1 &&
    !Number(f?.elegible_sin_comida) &&
    !Number(f?.restaurantes);
  if (soloComidaVacia) poner({ clave: 'sin_restaurantes', quien: 'divoox' });

  // 5. El dinero: saldo para la comisión y la cuenta donde le pagan los pasajeros a celular.
  if (f?.zona && f.moneda) {
    const cfg = await leerConfigPais(db, pais);
    const comision = Math.max(
      await comisionTipicaMoto(db, { id: f.zona, pais, moneda: f.moneda }).catch(() => 0),
      cfg.efectivoActivo || cfg.transferenciaRepartidorActiva
        ? await comisionTipicaComida(db, pais, f.moneda).catch(() => 0)
        : 0,
    );
    if (comision > 0 && (await saldoLibro(db, id, 'prepago', pais, f.moneda)) < comision)
      poner({ clave: 'sin_saldo', quien: 'conductor' });
  }
  const aCelular = perfil.metodosPago.filter((m) => esPagoACelular(m));
  const llevaPasajeros = vehiculos.some((v) => PASAJEROS.has(v.tipo));
  if (
    aCelular.length &&
    llevaPasajeros &&
    !cuentas.some(
      (c) => c.pais === pais && aCelular.some((m) => cuentasQueReciben(m).includes(c.tipo)),
    )
  )
    poner({ clave: 'sin_pago_movil', quien: 'conductor' });

  // 6. Lo subido que todavía nadie revisa porque falta enviarlo (C-PAPEL-DICE-LA-VERDAD).
  if (enviarDespues)
    poner({ clave: 'vehiculo_sin_enviar', quien: 'conductor', ...(enviarDespues as object) });
  if (g.politica.asistente) {
    const v = await estadoVerificacion(db, id);
    const todas = v.pasos.every((p) => v.fotos.get(p)?.estado === 'vigente');
    if (todas && v.papeles.some((p) => p.estado === 'por_enviar'))
      poner({ clave: 'papeles_sin_enviar', quien: 'conductor' });
  }

  // 7. Conectado, pero sin ubicación reciente (GPS apagado o sin señal): no le llegan ofertas.
  if (f && Number(f.conectado) && Number(f.elegible) && !Number(f.ubicacion))
    poner({ clave: 'ubicacion_vieja', quien: 'conductor' });
  if (f && !Number(f.conectado) && !faltas.some((x) => x.quien === 'conductor'))
    poner({ clave: 'desconectado', quien: 'conductor' });

  // «Recibe viajes» = la misma regla del reparto (C-EN-LINEA-DE-VERDAD); la ubicación vieja va aparte.
  return {
    recibeViajes: Boolean(f && Number(f.elegible)) && !soloComidaVacia,
    faltas,
    vehiculo: elegido ? { id: elegido.id, tipo: elegido.tipo, estado: elegido.estado } : null,
  };
}
