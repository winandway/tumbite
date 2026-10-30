/**
 * C-VIAJE-SEGURIDAD-2 (30 oct 2026), copiado del kit de seguridad de Uber: contactos de confianza que
 * reciben el viaje (siempre o solo de noche), aviso si el viaje se sale de la ruta y límite de horas
 * al volante (12 horas manejando, luego 6 de descanso). Reglas puras: el servidor las aplica.
 */
type Punto = { lat: number; lng: number };

/** De noche = de 9 de la noche a 6 de la mañana en la hora de la ciudad (como Uber). */
export function esDeNoche(ahora: Date, zonaHoraria: string): boolean {
  let hora: number;
  try {
    hora = Number(
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: zonaHoraria })
        .format(ahora)
        .replace(/\D/g, ''),
    );
  } catch {
    hora = ahora.getUTCHours();
  }
  return hora >= 21 || hora < 6;
}

/** Distancia en km del punto al tramo recto origen→destino (aproximación plana, de sobra en una ciudad). */
export function distanciaARutaKm(origen: Punto, destino: Punto, punto: Punto): number {
  const k = Math.cos((origen.lat * Math.PI) / 180) * 111.32;
  const a = { x: origen.lng * k, y: origen.lat * 110.57 };
  const b = { x: destino.lng * k, y: destino.lat * 110.57 };
  const p = { x: punto.lng * k, y: punto.lat * 110.57 };
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const largo2 = dx * dx + dy * dy;
  const t = largo2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / largo2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * ¿El conductor se salió de la ruta? Más de 1,5 km del tramo recto, o más de un cuarto del largo del
 * viaje si es largo (las calles nunca van en línea recta: el margen evita falsas alarmas).
 */
export function seDesvio(origen: Punto, destino: Punto, punto: Punto): boolean {
  const largo = distanciaARutaKm(origen, origen, destino);
  return distanciaARutaKm(origen, destino, punto) > Math.max(1.5, largo * 0.25);
}

export const HORAS_MAXIMAS_VOLANTE = 12;
export const HORAS_DESCANSO = 6;

/**
 * Horas al volante en las últimas 24 horas (cada viaje desde que lo aceptó hasta que terminó). Con 12
 * o más, no recibe viajes hasta cumplir 6 horas seguidas sin manejar desde el último.
 */
export function bloqueoPorHoras(
  viajes: { inicio: string; fin: string | null }[],
  ahora: Date,
): { horas: number; bloqueadoHasta: string | null } {
  const desde = ahora.getTime() - 24 * 3_600_000;
  let ms = 0;
  let ultimoFin = 0;
  for (const v of viajes) {
    const i = Date.parse(v.inicio);
    const f = v.fin ? Date.parse(v.fin) : ahora.getTime();
    if (!Number.isFinite(i) || !Number.isFinite(f) || f <= desde) continue;
    ms += Math.max(0, f - Math.max(i, desde));
    ultimoFin = Math.max(ultimoFin, f);
  }
  const horas = Math.round((ms / 3_600_000) * 10) / 10;
  const libre = ultimoFin + HORAS_DESCANSO * 3_600_000;
  return {
    horas,
    bloqueadoHasta:
      horas >= HORAS_MAXIMAS_VOLANTE && ahora.getTime() < libre
        ? new Date(libre).toISOString()
        : null,
  };
}
