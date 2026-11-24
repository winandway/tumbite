/**
 * El canal «pedidos» de Android: los avisos del servidor llegan por él (channelId 'pedidos').
 * Cada app declara `extra.sonidoAvisos` y su sonido suena aunque la app esté cerrada: la alarma
 * del restaurante, la del conductor (oferta.wav) y la campanita del cliente (aviso.wav)
 * (C-AVISOS-CANAL, C-AVISO-PAQUETE). Android fija el sonido al crear el canal: en un teléfono que
 * ya tenía la app, el sonido nuevo sale al reinstalarla.
 */
export const CANAL_AVISOS = 'pedidos';

/**
 * C-OFERTA-SUENA-EN-BUCLE (18 nov 2026; todos los países): las ofertas al conductor van por un canal
 * PROPIO de Android, con importancia máxima y el tono largo (29 s). Android no deja cambiar el sonido
 * de un canal ya creado, por eso es un id nuevo. Solo lo crea la app que trae ese tono
 * (`extra.sonidoOfertas`, Driver) y se lo dice al servidor con la capacidad `ofertas-bucle`.
 */
export const CANAL_OFERTAS = 'ofertas';
export const SONIDO_OFERTAS = 'oferta_larga.wav';
export const CAPACIDAD_OFERTAS_BUCLE = 'ofertas-bucle';

export function canalOfertas(
  extra: Record<string, unknown> | null | undefined,
  importanciaMax: number,
) {
  if (typeof extra?.sonidoOfertas !== 'string') return null;
  return {
    name: 'Ofertas',
    importance: importanciaMax,
    sound: extra.sonidoOfertas,
    vibrationPattern: [0, 500, 250, 500, 250, 500],
    enableVibrate: true,
  };
}

export function canalPedidos(
  extra: Record<string, unknown> | null | undefined,
  importanciaMax: number,
) {
  const sonido = typeof extra?.sonidoAvisos === 'string' ? extra.sonidoAvisos : 'default';
  return { name: 'Pedidos', importance: importanciaMax, sound: sonido };
}

/**
 * C-CANALES-AVISOS (24 nov 2026) — todos los países. Canales propios de Android, cada uno con su
 * sonido ORIGINAL (generado por síntesis, ver `docs/SONIDOS-ORIGEN.md`), para que cada aviso se
 * reconozca de oído y lo común no suene como una alarma:
 *
 * - `pedido_nuevo` (Restaurants): el pedido nuevo y sus recordatorios, con un tono largo de alarma.
 * - `panico` (todas): el pánico al responsable de zona y al equipo, fuerte y distinto de todo.
 * - `dinero` (todas): recargas, cobros y saldo.
 * - `llego` (clientes): «llegó tu conductor».
 * - `avisos` (Restaurants): lo común («ya recibes pedidos otra vez») con el tono normal del teléfono.
 *   En Restaurants el canal `pedidos` ya existe con la alarma y Android no deja cambiarle el sonido,
 *   por eso lo común va por este id nuevo.
 *
 * Cada app declara en `extra.canalesAvisos` los canales que trae (id → archivo de sonido o
 * `default`); la app los crea y se lo dice al servidor con la capacidad `canal-<id>`. El servidor
 * solo manda por un canal (y con su sonido) al teléfono que lo declaró: las apps ya publicadas
 * siguen recibiendo por `pedidos` con el sonido de siempre, sin romperse.
 */
export const CANALES_EXTRA = ['pedido_nuevo', 'panico', 'dinero', 'llego', 'avisos'] as const;
export type CanalExtra = (typeof CANALES_EXTRA)[number];
/** Los canales que un aviso puede pedir (`avisos` es el de lo común: no se pide, se cae en él). */
export type CanalAviso = Exclude<CanalExtra, 'avisos'>;

/** El sonido de cada canal (el mismo nombre de archivo en Android e iPhone). */
export const SONIDO_CANAL: Record<CanalAviso, string> = {
  pedido_nuevo: 'pedido_nuevo_largo.wav',
  panico: 'panico.wav',
  dinero: 'dinero.wav',
  llego: 'llego.wav',
};

export const capacidadCanal = (canal: CanalExtra) => `canal-${canal.replace('_', '-')}`;

/** Todas las capacidades que el servidor entiende (lo demás que mande una app se ignora). */
export const CAPACIDADES_AVISOS: readonly string[] = [
  CAPACIDAD_OFERTAS_BUCLE,
  ...CANALES_EXTRA.map(capacidadCanal),
];

const NOMBRE_CANAL: Record<CanalExtra, string> = {
  pedido_nuevo: 'Pedido nuevo',
  panico: 'Pánico',
  dinero: 'Dinero',
  llego: 'Llegó tu conductor',
  avisos: 'Avisos',
};

/** La vibración: el pánico insiste más que nadie; el pedido nuevo, como la oferta. */
const VIBRACION_CANAL: Partial<Record<CanalExtra, number[]>> = {
  pedido_nuevo: [0, 500, 250, 500, 250, 500],
  panico: [0, 800, 200, 800, 200, 800, 200, 800],
};

export type CanalAndroid = {
  id: CanalExtra;
  name: string;
  importance: number;
  sound: string | null;
  vibrationPattern?: number[];
  enableVibrate?: boolean;
  bypassDnd?: boolean;
};

/**
 * Los canales extra que trae una app (de `extra.canalesAvisos`). Un id desconocido o un sonido que no
 * es texto se ignoran. `importancias`: la máxima para lo urgente y la normal para lo común.
 */
export function canalesExtra(
  extra: Record<string, unknown> | null | undefined,
  importancias: { max: number; normal: number },
): CanalAndroid[] {
  const pedidos = extra?.canalesAvisos;
  if (!pedidos || typeof pedidos !== 'object') return [];
  const lista: CanalAndroid[] = [];
  for (const id of CANALES_EXTRA) {
    const sonido = new Map(Object.entries(pedidos)).get(id) as unknown;
    if (typeof sonido !== 'string' || !sonido) continue;
    const vibracion = new Map(Object.entries(VIBRACION_CANAL)).get(id);
    lista.push({
      id,
      name: new Map(Object.entries(NOMBRE_CANAL)).get(id) ?? id,
      importance: id === 'avisos' ? importancias.normal : importancias.max,
      sound: sonido === 'default' ? 'default' : sonido,
      ...(vibracion ? { vibrationPattern: vibracion, enableVibrate: true } : {}),
      ...(id === 'panico' ? { bypassDnd: true } : {}),
    });
  }
  return lista;
}

/**
 * El canal y el sonido con que le llega un aviso a UN teléfono, según lo que ese teléfono declaró.
 * Sin la capacidad, lo de siempre (canal `pedidos` y el sonido del aviso o el del teléfono).
 */
export function canalParaAparato(
  aviso: { canal?: CanalAviso; sonido?: string },
  capacidades: readonly string[],
): { channelId: string; sound: string } {
  if (aviso.canal && capacidades.includes(capacidadCanal(aviso.canal)))
    return { channelId: aviso.canal, sound: SONIDO_CANAL[aviso.canal] };
  // Lo común en una app que trae su canal de lo común (Restaurants): tono normal, no la alarma.
  const comun = capacidades.includes(capacidadCanal('avisos'));
  if (comun && !aviso.sonido) return { channelId: 'avisos', sound: 'default' };
  return { channelId: CANAL_AVISOS, sound: aviso.sonido ?? 'default' };
}

/**
 * Lo que una app crea y declara al registrar el teléfono. En iPhone no hay canales, pero el sonido va
 * en el aviso: se declaran igual (los archivos van en la app) salvo que la app diga
 * `canalesSoloAndroid` (Restaurants: en iPhone se queda exactamente como está).
 */
export function capacidadesDeCanales(
  extra: Record<string, unknown> | null | undefined,
  plataforma: string,
  importancias: { max: number; normal: number },
): { crear: CanalAndroid[]; capacidades: string[] } {
  const canales = canalesExtra(extra, importancias);
  const declara =
    plataforma === 'android' || (plataforma === 'ios' && extra?.canalesSoloAndroid !== true);
  return {
    crear: plataforma === 'android' ? canales : [],
    capacidades: declara ? canales.map((c) => capacidadCanal(c.id)) : [],
  };
}
