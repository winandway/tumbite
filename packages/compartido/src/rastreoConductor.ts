import { LATIDO_UBICACION_MS, MOVIDO_LATIDO_M } from './latidoUbicacion';
import { metrosEntre, type Punto } from './llegada';

/**
 * C-GPS-PANTALLA-APAGADA (13 nov 2026, todos los países): la ubicación del conductor con la
 * pantalla apagada. Como Dasher y Uber Driver: se rastrea mientras está conectado o tiene un
 * pedido, viaje o ruta en curso, y se para en cuanto se desconecta sin trabajo pendiente. Nunca
 * se rastrea a alguien desconectado.
 *
 * Presupuesto de escrituras: cada envío guarda una muestra en el servidor. Con trabajo en curso se
 * manda cada 25 m (los hitos de «llegó al restaurante / a la puerta» lo necesitan); libre, solo al
 * moverse 250 m o con el latido de 2 minutos (el despacho necesita una posición de los últimos
 * 10 minutos, no una por cuadra).
 */
export type ModoRastreo = 'apagado' | 'libre' | 'activo';

export const MOVIDO_LIBRE_M = 250;

export function modoRastreo(e: {
  conectado: boolean;
  pedidoActivo?: boolean;
  viajeActivo?: boolean;
  rutaFlexActiva?: boolean;
  conSesion?: boolean;
}): ModoRastreo {
  if (e.conSesion === false) return 'apagado';
  if (e.pedidoActivo || e.viajeActivo || e.rutaFlexActiva) return 'activo';
  return e.conectado ? 'libre' : 'apagado';
}

export function tocaMandarSegunModo(
  modo: ModoRastreo,
  ultimo: (Punto & { en: number }) | null,
  lectura: Punto,
  ahora = Date.now(),
): boolean {
  if (modo === 'apagado') return false;
  if (!ultimo) return true;
  if (ahora - ultimo.en >= LATIDO_UBICACION_MS) return true;
  const umbral = modo === 'activo' ? MOVIDO_LATIDO_M : MOVIDO_LIBRE_M;
  return metrosEntre(ultimo, lectura) >= umbral;
}

export type CuerpoUbicacion = {
  lat: number;
  lng: number;
  precision: number | null;
  simulada: boolean;
};

/** Lo único que viaja al servidor: posición, precisión y si el propio celular la marca simulada. */
export function cuerpoUbicacion(l: {
  coords: { latitude: number; longitude: number; accuracy?: number | null };
  mocked?: boolean;
}): CuerpoUbicacion {
  return {
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    precision: l.coords.accuracy ?? null,
    simulada: l.mocked === true,
  };
}

/**
 * Cola corta sin señal: el servidor no recibe la hora de la lectura, así que mandar un punto viejo
 * lo pondría donde ya no está. Se guarda solo el último y se entrega mientras tenga menos de
 * 2 minutos; más viejo se descarta.
 */
export const PENDIENTE_VIGENTE_MS = 120_000;

export function colaUbicacion() {
  let pendiente: { cuerpo: CuerpoUbicacion; en: number } | null = null;
  return {
    guardar(cuerpo: CuerpoUbicacion, ahora = Date.now()) {
      pendiente = { cuerpo, en: ahora };
    },
    tomar(ahora = Date.now()): CuerpoUbicacion | null {
      const p = pendiente;
      pendiente = null;
      if (!p || ahora - p.en >= PENDIENTE_VIGENTE_MS) return null;
      return p.cuerpo;
    },
  };
}

/**
 * Como Dasher («Otorga permisos para disfrutar de la mejor experiencia»): antes del cuadro del
 * sistema se explica para qué se usa la ubicación. Solo si todavía no lo dio y se le puede pedir.
 */
export function necesitaExplicacionPrevia(p: { granted: boolean; canAskAgain: boolean }): boolean {
  return !p.granted && p.canAskAgain;
}
