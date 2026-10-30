/**
 * Divoox Rewards · Fase 2 · motor de reputación (30 oct 2026, aprobado por Richard en modo sombra).
 * Pieza pura: no lee la base ni decide nada operativo. Calcula la reputación de 0 a 100 de un
 * repartidor con sus últimas unidades de trabajo de todos los servicios, con pesos, escalas por
 * medida, muestras pequeñas y casos excusados. Diseño: docs/REWARDS-FASE-2-DISENO.md.
 *
 * La reputación NO decide elegibilidad ni permanencia (condición A): eso es `elegibilidad`, aparte.
 */

export const VERSION_FORMULA = 'r2-2026-10-30';

export type ServicioRep = 'comida' | 'tiendas' | 'express' | 'flex';

/** Lo que se cumplió de lo que se podía evaluar. `total` 0 o null = no evaluable. */
export type Fraccion = { ok: number; total: number };

/**
 * Una unidad de trabajo: un pedido, un viaje o una ruta Flex. Cada medida es null cuando esa unidad
 * no la tiene o quedó excusada (no cuenta ni a favor ni en contra).
 */
export type Unidad = {
  servicio: ServicioRep;
  /** Fecha de cierre de la unidad (para ordenar; la más nueva primero). */
  fecha: string;
  /** Paquetes asignados de una ruta Flex (para su peso). Ignorado en los demás servicios. */
  paquetes?: number;
  finalizacion: Fraccion | null;
  puntualidad: Fraccion | null;
  /** Incidentes verificados sobre `base` cosas evaluadas (1 pedido, o n paquetes). */
  incidentes: { menores: number; mayores: number; base: number } | null;
  /** Estrellas que le dio el cliente o el pasajero en esta unidad (ya sin las que fueron culpa ajena). */
  estrellas: number | null;
};

/** Una oferta que se le hizo: un pedido, un viaje o una ruta (peso 1 siempre). */
export type OfertaRep = { fecha: string; aceptada: boolean; excusada?: boolean };

export const VENTANA = 100;
export const VENTANA_OFERTAS = 100;
/** Peso mínimo de una medida para no mezclarla con el valor de referencia. */
export const MUESTRA_MINIMA = 20;
/** Por debajo de este peso total la reputación es «provisional» (como las primeras 50 de DoorDash). */
export const PESO_PROVISIONAL = 50;
export const UMBRALES = { plata: 63, oro: 77, diamante: 85 } as const;
export const MARGEN_BAJADA = 3;
export const DIAS_GRACIA = 7;

/** Valores de referencia para muestras pequeñas: un repartidor típico, ni bueno ni malo. */
export const REFERENCIA = {
  finalizacion: 0.95,
  puntualidad: 0.9,
  tasaIncidentes: 0.01,
  estrellas: 4.8,
  aceptacion: 0.65,
} as const;

/** Peso de una unidad: 1, o el de una ruta Flex (min(10, max(1, n/3))). Una ruta nunca pasa de 10. */
export function pesoUnidad(u: Pick<Unidad, 'servicio' | 'paquetes'>): number {
  if (u.servicio !== 'flex') return 1;
  const n = Math.max(0, u.paquetes ?? 0);
  return Math.min(10, Math.max(1, n / 3));
}

const recortar = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function escalaLineal(x: number, cero: number, lleno: number, puntos: number): number {
  return recortar((x - cero) / (lleno - cero), 0, 1) * puntos;
}

/** Escala suave de finalización: 85 % = 0, 90 % = 12, 95 % = 24, 100 % = 30 (sin precipicio en 90 %). */
const TRAMOS_FINALIZACION: readonly [number, number][] = [
  [0.85, 0],
  [0.9, 0.4],
  [0.95, 0.8],
  [1, 1],
];
export function puntosFinalizacion(x: number): number {
  const t = TRAMOS_FINALIZACION;
  if (x <= (t.at(0)?.[0] ?? 0)) return 0;
  for (let i = 1; i < t.length; i++) {
    const [b, fb] = t.at(i)!;
    const [a, fa] = t.at(i - 1)!;
    if (x <= b) return (fa + ((fb - fa) * (x - a)) / (b - a)) * 30;
  }
  return 30;
}
export const puntosPuntualidad = (x: number) => escalaLineal(x, 0.75, 0.98, 25);
/** Calidad: 20 sin incidentes; cada 1 % de incidentes menores resta 1 punto y cada mayor cuenta 3. */
export const puntosCalidad = (tasa: number) => recortar(20 - 100 * tasa, 0, 20);
export const puntosSatisfaccion = (x: number) => escalaLineal(x, 4.2, 5, 15);
export const puntosAceptacion = (x: number) => escalaLineal(x, 0.4, 0.85, 10);

/** Las unidades más nuevas hasta sumar peso 100; la última entra con el peso que falte. */
export function ventanaPonderada(unidades: Unidad[]): { u: Unidad; w: number }[] {
  const orden = [...unidades].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
  const out: { u: Unidad; w: number }[] = [];
  let suma = 0;
  for (const u of orden) {
    if (suma >= VENTANA) break;
    const w = Math.min(pesoUnidad(u), VENTANA - suma);
    out.push({ u, w });
    suma += w;
  }
  return out;
}

/** Promedio ponderado con encogimiento hacia la referencia si hay poco peso. */
function mezclar(valores: { v: number; w: number }[], referencia: number) {
  const peso = valores.reduce((s, x) => s + x.w, 0);
  const suma = valores.reduce((s, x) => s + x.v * x.w, 0);
  const falta = Math.max(0, MUESTRA_MINIMA - peso);
  const valor = peso + falta > 0 ? (suma + falta * referencia) / (peso + falta) : referencia;
  return { valor, peso, suficiente: peso >= MUESTRA_MINIMA };
}

export type Componente = {
  valor: number;
  puntos: number;
  /** Peso con datos reales (sin la referencia). */
  peso: number;
  suficiente: boolean;
};

export type Reputacion = {
  version: string;
  puntaje: number;
  provisional: boolean;
  pesoVentana: number;
  porServicio: Partial<Record<ServicioRep, number>>;
  componentes: {
    finalizacion: Componente;
    puntualidad: Componente;
    calidad: Componente;
    satisfaccion: Componente;
    aceptacion: Componente;
  };
  nivelCalculado: NivelRep;
};

export type NivelRep = 'inicial' | 'plata' | 'oro' | 'diamante';
export const ORDEN_NIVELES: readonly NivelRep[] = ['inicial', 'plata', 'oro', 'diamante'];

export function nivelPorPuntaje(p: number): NivelRep {
  if (p >= UMBRALES.diamante) return 'diamante';
  if (p >= UMBRALES.oro) return 'oro';
  if (p >= UMBRALES.plata) return 'plata';
  return 'inicial';
}

const umbralDe = (n: NivelRep) =>
  n === 'diamante'
    ? UMBRALES.diamante
    : n === 'oro'
      ? UMBRALES.oro
      : n === 'plata'
        ? UMBRALES.plata
        : 0;

export function calcularReputacion(unidades: Unidad[], ofertas: OfertaRep[]): Reputacion {
  const v = ventanaPonderada(unidades);
  const pesoVentana = v.reduce((s, x) => s + x.w, 0);
  const porServicio: Partial<Record<ServicioRep, number>> = {};
  for (const { u, w } of v) porServicio[u.servicio] = (porServicio[u.servicio] ?? 0) + w;

  const fr = (f: Fraccion | null) => (f && f.total > 0 ? f.ok / f.total : null);
  const recoger = (f: (u: Unidad) => number | null) =>
    v.flatMap(({ u, w }) => {
      const x = f(u);
      return x == null ? [] : [{ v: x, w }];
    });

  const fin = mezclar(
    recoger((u) => fr(u.finalizacion)),
    REFERENCIA.finalizacion,
  );
  const pun = mezclar(
    recoger((u) => fr(u.puntualidad)),
    REFERENCIA.puntualidad,
  );
  const cal = mezclar(
    recoger((u) =>
      u.incidentes && u.incidentes.base > 0
        ? (u.incidentes.menores + 3 * u.incidentes.mayores) / u.incidentes.base
        : null,
    ),
    REFERENCIA.tasaIncidentes,
  );
  const est = mezclar(
    recoger((u) => u.estrellas),
    REFERENCIA.estrellas,
  );
  // Aceptación justa: las últimas 100 ofertas no excusadas, cada una pesa 1 (también una ruta).
  const validas = [...ofertas]
    .filter((o) => !o.excusada)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    .slice(0, VENTANA_OFERTAS);
  const ace = mezclar(
    validas.map((o) => ({ v: o.aceptada ? 1 : 0, w: 1 })),
    REFERENCIA.aceptacion,
  );

  const c = (m: ReturnType<typeof mezclar>, puntos: number): Componente => ({
    valor: Math.round(m.valor * 10000) / 10000,
    puntos: Math.round(puntos * 10) / 10,
    peso: Math.round(m.peso * 10) / 10,
    suficiente: m.suficiente,
  });
  const componentes = {
    finalizacion: c(fin, puntosFinalizacion(fin.valor)),
    puntualidad: c(pun, puntosPuntualidad(pun.valor)),
    calidad: c(cal, puntosCalidad(cal.valor)),
    satisfaccion: c(est, puntosSatisfaccion(est.valor)),
    aceptacion: c(ace, puntosAceptacion(ace.valor)),
  };
  const puntaje =
    Math.round(
      (puntosFinalizacion(fin.valor) +
        puntosPuntualidad(pun.valor) +
        puntosCalidad(cal.valor) +
        puntosSatisfaccion(est.valor) +
        puntosAceptacion(ace.valor)) *
        10,
    ) / 10;
  return {
    version: VERSION_FORMULA,
    puntaje,
    provisional: pesoVentana < PESO_PROVISIONAL,
    pesoVentana: Math.round(pesoVentana * 10) / 10,
    porServicio,
    componentes,
    nivelCalculado: nivelPorPuntaje(puntaje),
  };
}

/**
 * Nivel con gracia: sube al momento; baja solo después de DIAS_GRACIA días seguidos por debajo del
 * umbral de su nivel menos MARGEN_BAJADA. `debajoDesde` es la fecha (AAAA-MM-DD) en que empezó a estar
 * por debajo, o null.
 */
export function siguienteNivel(
  previo: { nivel: NivelRep; debajoDesde: string | null } | null,
  puntaje: number,
  hoy: string,
): { nivel: NivelRep; debajoDesde: string | null } {
  const calculado = nivelPorPuntaje(puntaje);
  if (!previo) return { nivel: calculado, debajoDesde: null };
  const ip = ORDEN_NIVELES.indexOf(previo.nivel);
  const ic = ORDEN_NIVELES.indexOf(calculado);
  if (ic >= ip) return { nivel: ic > ip ? calculado : previo.nivel, debajoDesde: null };
  if (puntaje >= umbralDe(previo.nivel) - MARGEN_BAJADA)
    return { nivel: previo.nivel, debajoDesde: null };
  const desde = previo.debajoDesde ?? hoy;
  const dias = Math.floor((Date.parse(hoy) - Date.parse(desde)) / 86_400_000);
  return dias >= DIAS_GRACIA
    ? { nivel: calculado, debajoDesde: null }
    : { nivel: previo.nivel, debajoDesde: desde };
}

/**
 * Condición A: la elegibilidad (mínimos para seguir activo) es aparte de la reputación y solo se
 * juzga con muestra suficiente. En la Fase 2 es informativa: no desactiva a nadie.
 */
export const MINIMOS = { estrellas: 4.2, finalizacion: 0.9 } as const;
export function elegibilidad(r: Reputacion): {
  estado: 'ok' | 'en_riesgo' | 'sin_datos';
  motivos: string[];
} {
  const motivos: string[] = [];
  const f = r.componentes.finalizacion;
  const s = r.componentes.satisfaccion;
  if (!f.suficiente && !s.suficiente) return { estado: 'sin_datos', motivos };
  if (f.suficiente && f.valor < MINIMOS.finalizacion) motivos.push('finalizacion');
  if (s.suficiente && s.valor < MINIMOS.estrellas) motivos.push('estrellas');
  return { estado: motivos.length ? 'en_riesgo' : 'ok', motivos };
}
