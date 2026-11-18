/**
 * C-CAMBIAR-VEHICULO (robot de Android, 18 nov 2026; todos los países): con la moto como vehículo
 * activo, «Carro con pasajero» decía «Falta 1 papel» (la inspección, que el Corolla SÍ tenía) y no
 * había cómo cambiar de vehículo. Como en Uber Driver («Vehicles» → elegir el que vas a usar): si
 * otro vehículo aprobado del conductor cumple TODO lo del servicio, la tarjeta dice «Usa tu Toyota
 * Corolla» y lleva a cambiarlo. Pura, sin consultas: la llama `estadoDelConductor`.
 */
export type VehiculoConductor = {
  id: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  anio?: number | null;
};

export type RequisitoServicio = {
  servicio_id: string;
  requisito: string;
  nivel: string;
  /** Solo para los que pide el TIPO de vehículo (servicio_vehiculo_requisitos). */
  vehiculo_tipo: string | null;
};

export function vehiculoQueSirve(e: {
  servicioId: string;
  activoId: string | null;
  vehiculos: readonly VehiculoConductor[];
  tiposCompatibles: readonly string[];
  anioMinimo?: ReadonlyMap<string, number | null>;
  requisitos: readonly RequisitoServicio[];
  /** `requisito|vehiculo_id` de lo aprobado y vigente ('' para lo del conductor). */
  cumplidos: ReadonlySet<string>;
}): VehiculoConductor | null {
  for (const v of e.vehiculos) {
    if (v.id === e.activoId || !e.tiposCompatibles.includes(v.tipo)) continue;
    const minimo = e.anioMinimo?.get(v.tipo);
    if (minimo && (v.anio ?? 0) < minimo) continue;
    const pide = e.requisitos.filter(
      (r) =>
        r.servicio_id === e.servicioId && (r.vehiculo_tipo == null || r.vehiculo_tipo === v.tipo),
    );
    const cumple = pide.every((r) =>
      e.cumplidos.has(`${r.requisito}|${r.nivel === 'vehiculo' ? v.id : ''}`),
    );
    if (cumple) return v;
  }
  return null;
}

export function nombreVehiculo(v: VehiculoConductor): string {
  return [v.marca, v.modelo].filter(Boolean).join(' ').trim();
}
