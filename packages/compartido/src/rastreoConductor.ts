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
  /**
   * C-LATIDO-UBICACION: hora (reloj del celular, ms) en que el GPS hizo esta lectura. Viaja con
   * `enviadaEn` (mismo reloj) para que el servidor sepa su edad aunque el reloj del celular esté mal.
   */
  leidaEn?: number;
  /**
   * Revisión 2 del 13 nov 2026: Date.now() del celular en el momento en que la app RECIBIÓ la
   * lectura (`marcarRecibida`). La hora del GPS puede venir de otro reloj (en Android, la del
   * satélite) y con el reloj del sistema mal puesto toda lectura parecería vieja. No viaja: al
   * enviar se convierte en `edadMs`, medida con el mismo reloj.
   */
  recibidaEn?: number;
};

/** Marca una lectura con la hora (reloj del celular) en que la app la recibió. */
export function marcarRecibida<T extends object>(
  l: T,
  ahora = Date.now(),
): T & { recibidaEn: number } {
  return { ...l, recibidaEn: ahora };
}

/**
 * Lo que de verdad viaja. Con la lectura marcada al recibirla: su edad (`edadMs`, un solo reloj).
 * Sin marca (por ejemplo, la última conocida del sistema): la hora del GPS y la del envío, como antes.
 */
export function paraEnviarUbicacion(
  cuerpo: CuerpoUbicacion,
  ahora = Date.now(),
): Omit<CuerpoUbicacion, 'recibidaEn'> & { enviadaEn: number; edadMs?: number } {
  const { recibidaEn, ...resto } = cuerpo;
  if (recibidaEn == null) return { ...resto, enviadaEn: ahora };
  const { leidaEn: _hora, ...sinHora } = resto;
  void _hora;
  return { ...sinHora, edadMs: Math.round(ahora - recibidaEn), enviadaEn: ahora };
}

/** Lo único que viaja al servidor: posición, precisión y si el propio celular la marca simulada. */
export function cuerpoUbicacion(l: {
  coords: { latitude: number; longitude: number; accuracy?: number | null };
  mocked?: boolean;
  timestamp?: number;
  recibidaEn?: number;
}): CuerpoUbicacion {
  return {
    lat: l.coords.latitude,
    lng: l.coords.longitude,
    precision: l.coords.accuracy ?? null,
    simulada: l.mocked === true,
    ...(typeof l.timestamp === 'number' && Number.isFinite(l.timestamp)
      ? { leidaEn: Math.round(l.timestamp) }
      : {}),
    ...(typeof l.recibidaEn === 'number' ? { recibidaEn: l.recibidaEn } : {}),
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
