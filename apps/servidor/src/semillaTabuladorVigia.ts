import { distanciaKm } from '@tumbite/compartido';
import { nuevoId } from './cripto';
import { filaATarifa, tarifaActiva } from './rutas/viajesPasajero';
import { zonaPara } from './rutas/zonas';
import {
  CASCO_EL_VIGIA,
  type DestinoTabulador,
  TABULADOR_EL_VIGIA,
  VIAS_TABULADOR,
} from './tabuladorElVigia';

/**
 * C-TABULADOR-VIGIA (25 nov 2026, Richard) — Venezuela, zona VE-MER-ELVIGIA. La semilla de UNA sola
 * vez que carga el tabulador de moto taxi de El Vigía como precios fijos de la zona (Moto, dólares),
 * pone la tarifa aprendida de la calle (docs/TABULADOR-EL-VIGIA.md) con su recarga nocturna del 30 % y
 * el umbral en 0, y deja que en El Vigía la comisión la pague el conductor (el pasajero paga el precio
 * de la hoja, sin nada encima).
 *
 * - Corre en la migración de arranque. Si la zona no existe o no tiene tarifa de Moto en dólares, no
 *   hace nada y NO pone la marca: lo intenta otra vez en la siguiente publicación.
 * - La marca (`config`) se toma ANTES de escribir (`INSERT OR IGNORE`): dos servidores a la vez, solo
 *   uno corre. Si el lote falla, la marca se borra y se reintenta.
 * - Nunca pisa lo del equipo: una ruta que ya existe (mismo lugar o mismo nombre) no se duplica, quién
 *   paga se siembra solo si la ciudad no tiene su propia fila, y después de la marca la tarifa y las
 *   rutas son del panel (otra publicación no las toca).
 * - Presupuesto (regla de la nube): UN lote, como mucho TOPE_ESCRITURAS_SEMILLA_VIGIA escrituras
 *   (unas 130 rutas, una de quién paga, dos de la tarifa y la marca).
 */
export const CLAVE_SEMILLA_TABULADOR_VIGIA = 'semilla:tabulador-el-vigia:1';
export const ZONA_TABULADOR_VIGIA = 'VE-MER-ELVIGIA';
export const TOPE_ESCRITURAS_SEMILLA_VIGIA = 200;

/** La tarifa aprendida (centavos de dólar). Ver docs/TABULADOR-EL-VIGIA.md, sección 4. */
export const TARIFA_APRENDIDA_VIGIA = { base: 0, porKm: 33, porMinuto: 0, minimo: 100 } as const;
/** +30 % de noche (21:00 a 06:00, hora de Venezuela: las horas por defecto). */
export const RECARGO_NOCHE_VIGIA_PB = 3000;

/** La regla de la nube: la semilla no escribe más del tope (si pasa, no escribe nada). */
export function exigirPresupuestoSemilla(escrituras: number): void {
  if (escrituras > TOPE_ESCRITURAS_SEMILLA_VIGIA)
    throw new Error(`semilla El Vigía: ${escrituras} escrituras pasan el tope`);
}

/** Solo los destinos a menos de esto (en línea recta) se miran para el regreso (los demás, no). */
const KM_MAXIMO_REGRESO = 50;
/** Dos lugares a menos de esto son el mismo (para no duplicar lo que el equipo ya cargó). */
const KM_MISMO_LUGAR = 0.3;

const normal = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

type Existente = {
  desde_lat: number | null;
  desde_lng: number | null;
  desde_nombre: string | null;
  hasta_lat: number;
  hasta_lng: number;
  hasta_nombre: string;
};

export type RutaSemilla = {
  grupo: string;
  desde: { lat: number; lng: number; radioKm: number; nombre: string };
  hasta: { lat: number; lng: number; radioKm: number; nombre: string };
  precio: number;
  revisar: boolean;
};

/** La ida de un destino: desde el casco urbano hasta el lugar. */
export function rutaDeIda(d: DestinoTabulador): RutaSemilla {
  return {
    grupo: VIAS_TABULADOR[d.via],
    desde: { ...CASCO_EL_VIGIA },
    hasta: { lat: d.lat, lng: d.lng, radioKm: d.radioKm, nombre: d.nombre },
    precio: d.precio,
    revisar: d.revisar,
  };
}

/** El regreso: desde el lugar hasta el casco urbano (solo si el lugar está dentro de la zona). */
export function rutaDeRegreso(d: DestinoTabulador): RutaSemilla {
  return {
    grupo: VIAS_TABULADOR[d.via],
    desde: { lat: d.lat, lng: d.lng, radioKm: d.radioKm, nombre: d.nombre },
    hasta: { ...CASCO_EL_VIGIA },
    precio: d.precio,
    revisar: d.revisar,
  };
}

/** ¿El equipo ya tiene esta ruta (mismo sentido, mismo lugar o mismo nombre)? */
export function yaExiste(r: RutaSemilla, existentes: readonly Existente[]): boolean {
  const esIda = r.hasta.nombre !== CASCO_EL_VIGIA.nombre;
  return existentes.some((e) => {
    if (esIda) {
      // Una ida a ese lugar: mismo nombre, o un «hasta» a menos de 300 m, saliendo del casco o de toda la zona.
      const salidaCasco =
        e.desde_lat == null ||
        e.desde_lng == null ||
        distanciaKm({ lat: e.desde_lat, lng: e.desde_lng }, CASCO_EL_VIGIA) <=
          CASCO_EL_VIGIA.radioKm;
      return (
        salidaCasco &&
        (normal(e.hasta_nombre) === normal(r.hasta.nombre) ||
          distanciaKm({ lat: e.hasta_lat, lng: e.hasta_lng }, r.hasta) <= KM_MISMO_LUGAR)
      );
    }
    // Un regreso desde ese lugar hacia el casco.
    if (e.desde_lat == null || e.desde_lng == null) return false;
    const llegaAlCasco =
      distanciaKm({ lat: e.hasta_lat, lng: e.hasta_lng }, CASCO_EL_VIGIA) <= CASCO_EL_VIGIA.radioKm;
    return (
      llegaAlCasco &&
      (normal(e.desde_nombre ?? '') === normal(r.desde.nombre) ||
        distanciaKm({ lat: e.desde_lat, lng: e.desde_lng }, r.desde) <= KM_MISMO_LUGAR)
    );
  });
}

export type ResultadoSemillaVigia = {
  rutas: number;
  omitidas: number;
  regresos: number;
  quienPaga: boolean;
  tarifa: boolean;
  escrituras: number;
};

/** Devuelve lo que sembró, o null si no corrió (ya corrió, corre en otro lado o falta la zona). */
export async function sembrarTabuladorVigia(db: D1Database): Promise<ResultadoSemillaVigia | null> {
  const zona = await db
    .prepare('SELECT id, pais, moneda FROM zonas WHERE id = ?')
    .bind(ZONA_TABULADOR_VIGIA)
    .first<{ id: string; pais: string; moneda: string }>();
  if (!zona) return null;
  const tarifa = await tarifaActiva(db, 'moto', zona.id);
  if (!tarifa || tarifa.moneda.toUpperCase() !== 'USD') return null;
  const marca = await db
    .prepare("INSERT OR IGNORE INTO config (clave, valor) VALUES (?, 'corriendo')")
    .bind(CLAVE_SEMILLA_TABULADOR_VIGIA)
    .run();
  if (!Number(marca.meta?.changes ?? 0)) return null;
  try {
    const { results: existentes } = await db
      .prepare(
        `SELECT desde_lat, desde_lng, desde_nombre, hasta_lat, hasta_lng, hasta_nombre
           FROM rutas_precio_zona WHERE zona_id = ? AND servicio_id = 'moto' LIMIT 500`,
      )
      .bind(zona.id)
      .all<Existente>();
    const nuevas: RutaSemilla[] = [];
    let omitidas = 0;
    let regresos = 0;
    for (const d of TABULADOR_EL_VIGIA) {
      const candidatas = [rutaDeIda(d)];
      // El regreso solo si el lugar es de esta zona (la zona del viaje se decide por la recogida).
      if (distanciaKm(d, CASCO_EL_VIGIA) <= KM_MAXIMO_REGRESO) {
        const z = await zonaPara(db, d.lat, d.lng);
        if (z?.id === zona.id) {
          candidatas.push(rutaDeRegreso(d));
          regresos++;
        }
      }
      for (const r of candidatas)
        if (yaExiste(r, existentes)) omitidas++;
        else nuevas.push(r);
    }
    const sentencias: D1PreparedStatement[] = nuevas.map((r) =>
      db
        .prepare(
          `INSERT INTO rutas_precio_zona (id, zona_id, servicio_id, moneda, desde_lat, desde_lng, desde_radio_km,
             desde_nombre, hasta_lat, hasta_lng, hasta_radio_km, hasta_nombre, precio, creada_por,
             actualizada_por, grupo, revisar)
           VALUES (?, ?, 'moto', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'C-TABULADOR-VIGIA', 'C-TABULADOR-VIGIA', ?, ?)`,
        )
        .bind(
          nuevoId(),
          zona.id,
          tarifa.moneda,
          r.desde.lat,
          r.desde.lng,
          r.desde.radioKm,
          r.desde.nombre,
          r.hasta.lat,
          r.hasta.lng,
          r.hasta.radioKm,
          r.hasta.nombre,
          r.precio,
          r.grupo,
          r.revisar ? 1 : 0,
        ),
    );
    // Quién paga la comisión en El Vigía: el conductor (solo si la ciudad no tiene ya su fila).
    sentencias.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO quien_paga_viajes (pais, ciudad, valor, cambiado_por)
           VALUES (?, ?, 'conductor', 'C-TABULADOR-VIGIA')`,
        )
        .bind(zona.pais, zona.id),
    );
    // La tarifa aprendida: versión nueva (como el panel: se cierra la activa y nace otra), con lo
    // demás de la tarifa de hoy igual (espera, cancelación, tope, etc.).
    const t = filaATarifa(tarifa);
    const idTarifa = nuevoId();
    sentencias.push(
      db
        .prepare(
          "UPDATE tarifas_viaje SET activa = 0, cerrada_en = datetime('now') WHERE id = ? AND activa = 1",
        )
        .bind(tarifa.id),
      db
        .prepare(
          `INSERT INTO tarifas_viaje (id, servicio_id, zona_id, moneda, base, por_km, por_minuto, minimo,
             espera_gratis_s, por_minuto_espera, cancelacion_gratis_s, cargo_cancelacion,
             cargo_no_se_presento, tope_dinamico_pb, redondeo, cargo_fijo, factor_calle_pb, velocidad_kmh,
             de_prueba, motivo, creada_por, xl_pb, valor_maximo, comfort_pb, premium_pb, espera_parada_gratis_s,
             km_maximo, umbral_precio_zona_pb, recargo_noche_pb, noche_desde_h, noche_hasta_h)
           VALUES (?, 'moto', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL)`,
        )
        .bind(
          idTarifa,
          zona.id,
          tarifa.moneda,
          TARIFA_APRENDIDA_VIGIA.base,
          TARIFA_APRENDIDA_VIGIA.porKm,
          TARIFA_APRENDIDA_VIGIA.porMinuto,
          TARIFA_APRENDIDA_VIGIA.minimo,
          t.esperaGratisS,
          t.porMinutoEspera,
          t.cancelacionGratisS,
          t.cargoCancelacion,
          t.cargoNoSePresento,
          t.topeDinamicoPb,
          t.redondeo,
          t.cargoFijo,
          t.factorCallePb,
          t.velocidadKmh,
          tarifa.de_prueba,
          'C-TABULADOR-VIGIA: tarifa aprendida del tabulador de la calle (docs/TABULADOR-EL-VIGIA.md)',
          t.xlPb ?? null,
          t.valorMaximo ?? null,
          t.comfortPb ?? null,
          t.premiumPb ?? null,
          t.esperaParadaGratisS,
          t.kmMaximo ?? null,
          RECARGO_NOCHE_VIGIA_PB,
        ),
    );
    // + la marca (al empezar) y su cierre (al final del lote).
    const escrituras = sentencias.length + 2;
    exigirPresupuestoSemilla(escrituras);
    const resultado: ResultadoSemillaVigia = {
      rutas: nuevas.length,
      omitidas,
      regresos,
      quienPaga: true,
      tarifa: true,
      escrituras,
    };
    sentencias.push(
      db
        .prepare("UPDATE config SET valor = ?, actualizado_en = datetime('now') WHERE clave = ?")
        .bind(
          JSON.stringify({
            hecha: true,
            ...resultado,
            tarifaAnterior: tarifa.id,
            tarifaNueva: idTarifa,
          }),
          CLAVE_SEMILLA_TABULADOR_VIGIA,
        ),
    );
    await db.batch(sentencias);
    console.warn(
      `semilla: tabulador de El Vigía cargado (${nuevas.length} rutas, ${omitidas} ya estaban) y tarifa de Moto aprendida (C-TABULADOR-VIGIA)`,
    );
    return resultado;
  } catch (e) {
    // Sin la marca, la próxima publicación lo intenta otra vez.
    await db
      .prepare('DELETE FROM config WHERE clave = ?')
      .bind(CLAVE_SEMILLA_TABULADOR_VIGIA)
      .run()
      .catch((x: unknown) => console.error('semilla El Vigía: no se pudo soltar la marca', x));
    throw e;
  }
}
