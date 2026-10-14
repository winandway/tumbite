/**
 * Lo que el restaurante ve del repartidor en su mostrador (panel web y tableta), y cuándo un
 * pedido se pone en amarillo: la foto del repartidor lleva más de 2 minutos sin confirmar.
 */
export type RepartidorEnPedido = {
  nombre: string;
  minutosParaLlegar: number | null;
  llego: boolean;
  esperandoDesde: string | null;
  esperaEvitableSeg: number | null;
  /** Escaneó el código de la pantalla: la app ya comprobó que es el pedido correcto. */
  verificado: boolean;
  salio: boolean;
};

export const MINUTOS_PARA_AMARILLO = 2;
/** A estos minutos de llegar, la tableta avisa con sonido (DoorDash avisa a 5). */
export const MINUTOS_AVISO_LLEGADA = 5;

const ms = (t: string | null | undefined) => {
  if (!t) return null;
  const v = Date.parse(t.includes('T') ? t : `${t.replace(' ', 'T')}Z`);
  return Number.isNaN(v) ? null : v;
};

/** ¿La foto del repartidor lleva más de 2 minutos esperando que el restaurante confirme? */
export function fotoSinConfirmar(
  p: { estado: string; fotoRecogida?: { tomadaEn: string; confirmadaEn: string | null } | null },
  ahora = Date.now(),
): boolean {
  if (p.estado !== 'listo' || !p.fotoRecogida || p.fotoRecogida.confirmadaEn) return false;
  const tomada = ms(p.fotoRecogida.tomadaEn);
  return tomada != null && ahora - tomada > MINUTOS_PARA_AMARILLO * 60_000;
}

/** La línea del repartidor en la tarjeta del pedido, o nada si no hay nada que decir. */
export function lineaRepartidor(
  r: RepartidorEnPedido | null | undefined,
  idioma: 'es' | 'en',
  ahora = Date.now(),
): string | null {
  if (!r || r.salio) return null;
  const en = idioma === 'en';
  if (!r.llego) {
    if (r.minutosParaLlegar == null) return null;
    return en
      ? `${r.nombre} arrives in ${r.minutosParaLlegar} min`
      : `${r.nombre} llega en ${r.minutosParaLlegar} min`;
  }
  const desde = ms(r.esperandoDesde);
  if (desde == null) return en ? `${r.nombre} is here` : `${r.nombre} ya llegó`;
  if (ahora < desde) {
    const faltan = Math.ceil((desde - ahora) / 60_000);
    return en
      ? `${r.nombre} is here · ready in ${faltan} min`
      : `${r.nombre} ya llegó · listo en ${faltan} min`;
  }
  const espera = Math.floor((ahora - desde) / 60_000);
  return en
    ? `${r.nombre} is waiting · ${espera} min past your ready time`
    : `${r.nombre} está esperando · ${espera} min después de tu hora de listo`;
}

/** Qué sonido corto toca la tableta por este repartidor: se acerca, llegó, o nada. */
export function avisoLlegada(r: RepartidorEnPedido | null | undefined): 'llego' | 'cerca' | null {
  if (!r || r.salio) return null;
  if (r.llego) return 'llego';
  if (r.minutosParaLlegar != null && r.minutosParaLlegar <= MINUTOS_AVISO_LLEGADA) return 'cerca';
  return null;
}
