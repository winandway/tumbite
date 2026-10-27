/* eslint-disable security/detect-object-injection -- índices numéricos sobre arreglos propios */
import { distanciaKm } from './catalogo';

/**
 * Divoox Flex · Fase 3: optimizador BÁSICO de rutas y comprobación de capacidad (C-FLEX-OPTIMIZAR).
 *
 * Es solo una SUGERENCIA: el servidor nunca la aplica sola ni sobre una ruta que ya salió.
 * - Orden: vecino más cercano desde el centro y después mejora local 2-opt.
 * - Distancia: en línea recta (gran círculo). Se devuelve marcada como ESTIMADA; nunca se inventan
 *   tiempos de manejo (no hay datos de tráfico ni de calles).
 * - Ventanas horarias: si la ventana de A termina antes de que empiece la de B, A va antes que B.
 * - Paradas obligatorias: van antes que las que no lo son, salvo que una ventana diga lo contrario.
 * - Paradas sin coordenadas: no se pueden ordenar; quedan al final, en su orden, y se avisan.
 * Pura y sin dependencias: corre igual en el servidor, el panel y las pruebas.
 */

export type ParadaOptimizable = {
  id: string;
  lat: number | null;
  lng: number | null;
  ventanaDesde?: string | null;
  ventanaHasta?: string | null;
  obligatoria?: boolean;
};

export type Origen = { lat: number; lng: number } | null;

export type AvisoOptimizacion =
  'sin_coordenadas' | 'sin_origen' | 'ventana_invalida' | 'pocas_paradas';

export type ResultadoOptimizacion = {
  orden: string[];
  sinCoordenadas: string[];
  /** Metros en línea recta del orden actual y del sugerido (solo paradas con coordenadas). */
  distanciaActualM: number | null;
  distanciaSugeridaM: number | null;
  /** Siempre true: es línea recta, no distancia de manejo. */
  distanciaEstimada: true;
  /** Ahorro en porcentaje (0 si no mejora). Null si no hay distancia comparable. */
  mejoraPct: number | null;
  /** True si el orden sugerido es distinto del actual. */
  cambia: boolean;
  avisos: AvisoOptimizacion[];
};

const momento = (s: string | null | undefined): number | null => {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
};

/** La ventana de la parada; si está al revés (desde después de hasta) no se usa para ordenar. */
function ventana(p: ParadaOptimizable): { desde: number | null; hasta: number | null } {
  const desde = momento(p.ventanaDesde);
  const hasta = momento(p.ventanaHasta);
  if (desde !== null && hasta !== null && desde > hasta) return { desde: null, hasta: null };
  return { desde, hasta };
}

/** ¿a TIENE que ir antes que b? (ventanas primero; después, obligatorias antes que opcionales). */
export function vaAntes(a: ParadaOptimizable, b: ParadaOptimizable): boolean {
  const va = ventana(a);
  const vb = ventana(b);
  if (va.hasta !== null && vb.desde !== null && va.hasta <= vb.desde) return true;
  const ventanaDiceLoContrario = vb.hasta !== null && va.desde !== null && vb.hasta <= va.desde;
  return Boolean(a.obligatoria) && !b.obligatoria && !ventanaDiceLoContrario;
}

const metros = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  distanciaKm(a, b) * 1000;

type ConCoordenadas = ParadaOptimizable & { lat: number; lng: number };

function largo(origen: Origen, lista: ConCoordenadas[]): number {
  let total = 0;
  let previo: { lat: number; lng: number } | null = origen;
  for (const p of lista) {
    if (previo) total += metros(previo, p);
    previo = p;
  }
  return total;
}

/** Orden válido = nadie queda antes que alguien que tiene que ir antes que él. */
export function ordenRespetaReglas(lista: ParadaOptimizable[]): boolean {
  for (let i = 0; i < lista.length; i++)
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i];
      const b = lista[j];
      if (a && b && vaAntes(b, a)) return false;
    }
  return true;
}

export function optimizarRuta(
  paradas: ParadaOptimizable[],
  origen: Origen,
  opciones: { maxPasadas?: number } = {},
): ResultadoOptimizacion {
  const avisos = new Set<AvisoOptimizacion>();
  const conCoord = paradas.filter(
    (p): p is ConCoordenadas =>
      typeof p.lat === 'number' &&
      typeof p.lng === 'number' &&
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lng),
  );
  const sinCoordenadas = paradas.filter((p) => !conCoord.includes(p as ConCoordenadas));
  if (sinCoordenadas.length) avisos.add('sin_coordenadas');
  if (!origen) avisos.add('sin_origen');
  for (const p of paradas) {
    const d = momento(p.ventanaDesde);
    const h = momento(p.ventanaHasta);
    if (d !== null && h !== null && d > h) avisos.add('ventana_invalida');
  }
  if (conCoord.length < 3) avisos.add('pocas_paradas');

  // 1) Vecino más cercano: solo se elige entre las paradas que no tienen a nadie pendiente
  //    que deba ir antes (ventanas y obligatorias).
  const pendientes = [...conCoord];
  const orden: ConCoordenadas[] = [];
  let actual: { lat: number; lng: number } | null = origen;
  while (pendientes.length) {
    const libres = pendientes.filter((p) => !pendientes.some((q) => q !== p && vaAntes(q, p)));
    // Si las reglas se contradicen (no debería pasar), se sigue con todas para no colgarse.
    const candidatas = libres.length ? libres : pendientes;
    let mejor = candidatas[0] as ConCoordenadas;
    if (actual) {
      let mejorD = Infinity;
      for (const c of candidatas) {
        const d = metros(actual, c);
        if (d < mejorD) {
          mejorD = d;
          mejor = c;
        }
      }
    }
    orden.push(mejor);
    pendientes.splice(pendientes.indexOf(mejor), 1);
    actual = mejor;
  }

  // 2) Mejora local 2-opt: se invierte un tramo si acorta y no rompe ninguna regla dentro del tramo.
  const hayReglas = conCoord.some((a) => conCoord.some((b) => a !== b && vaAntes(a, b)));
  const maxPasadas = opciones.maxPasadas ?? 20;
  for (let pasada = 0; pasada < maxPasadas; pasada++) {
    let mejoro = false;
    for (let i = 0; i < orden.length - 1; i++) {
      let tramoConRegla = false;
      for (let j = i + 1; j < orden.length; j++) {
        const pj = orden[j] as ConCoordenadas;
        if (hayReglas && !tramoConRegla)
          for (let k = i; k < j; k++)
            if (vaAntes(orden[k] as ConCoordenadas, pj)) {
              tramoConRegla = true;
              break;
            }
        if (tramoConRegla) break; // invertir rompería una regla (y tramos más largos también)
        const antes = i === 0 ? origen : (orden[i - 1] as ConCoordenadas);
        const pi = orden[i] as ConCoordenadas;
        const despues = orden[j + 1] ?? null;
        const viejo = (antes ? metros(antes, pi) : 0) + (despues ? metros(pj, despues) : 0);
        const nuevo = (antes ? metros(antes, pj) : 0) + (despues ? metros(pi, despues) : 0);
        if (nuevo + 0.5 < viejo) {
          const tramo = orden.slice(i, j + 1).reverse();
          orden.splice(i, tramo.length, ...tramo);
          mejoro = true;
        }
      }
    }
    if (!mejoro) break;
  }

  const sugerido = [...orden.map((p) => p.id), ...sinCoordenadas.map((p) => p.id)];
  const actualConCoord = paradas.filter((p): p is ConCoordenadas =>
    conCoord.includes(p as ConCoordenadas),
  );
  const distanciaActualM = conCoord.length ? Math.round(largo(origen, actualConCoord)) : null;
  const distanciaSugeridaM = conCoord.length ? Math.round(largo(origen, orden)) : null;
  // Si el orden de la empresa ya era igual de bueno (o mejor) y válido, se respeta.
  const actualValido = ordenRespetaReglas(actualConCoord);
  const quedarse =
    actualValido &&
    distanciaActualM !== null &&
    distanciaSugeridaM !== null &&
    distanciaSugeridaM >= distanciaActualM;
  const ordenFinal = quedarse ? paradas.map((p) => p.id) : sugerido;
  const sugeridaFinal = quedarse ? distanciaActualM : distanciaSugeridaM;
  const mejoraPct =
    distanciaActualM && sugeridaFinal !== null
      ? Math.max(0, Math.round(((distanciaActualM - sugeridaFinal) / distanciaActualM) * 1000) / 10)
      : distanciaActualM === 0
        ? 0
        : null;
  return {
    orden: ordenFinal,
    sinCoordenadas: sinCoordenadas.map((p) => p.id),
    distanciaActualM,
    distanciaSugeridaM: sugeridaFinal,
    distanciaEstimada: true,
    mejoraPct,
    cambia: ordenFinal.some((id, i) => paradas[i]?.id !== id),
    avisos: [...avisos],
  };
}

// ───────────────────────────── Capacidad del vehículo ─────────────────────────────

/** Lo que la empresa declaró del vehículo. Lo que no declaró es DESCONOCIDO (no se inventa). */
export type CapacidadVehiculo = {
  maxPaquetes?: number | null;
  maxPesoG?: number | null;
  maxVolumenCm3?: number | null;
  maxLadoCm?: number | null;
};

export type PaqueteMedible = {
  pesoG?: number | null;
  largoCm?: number | null;
  anchoCm?: number | null;
  altoCm?: number | null;
};

export type ExcesoCapacidad = {
  campo: 'paquetes' | 'peso' | 'volumen' | 'lado';
  limite: number;
  valor: number;
};

export type ResultadoCapacidad = {
  /** ok = cabe con los datos conocidos; excede = algo se pasa; desconocida = faltan datos para saberlo. */
  estado: 'ok' | 'excede' | 'desconocida';
  paquetes: number;
  pesoG: number;
  paquetesSinPeso: number;
  volumenCm3: number;
  paquetesSinMedidas: number;
  excesos: ExcesoCapacidad[];
  /** Qué no se sabe (para mostrarlo como «sin dato», nunca como 0). */
  desconocidos: (
    'capacidad' | 'max_paquetes' | 'max_peso' | 'max_volumen' | 'max_lado' | 'peso' | 'medidas'
  )[];
};

export function evaluarCapacidad(
  cap: CapacidadVehiculo | null,
  paquetes: PaqueteMedible[],
): ResultadoCapacidad {
  let pesoG = 0;
  let sinPeso = 0;
  let volumen = 0;
  let sinMedidas = 0;
  let ladoMayor = 0;
  for (const p of paquetes) {
    if (typeof p.pesoG === 'number') pesoG += p.pesoG;
    else sinPeso++;
    if (
      typeof p.largoCm === 'number' &&
      typeof p.anchoCm === 'number' &&
      typeof p.altoCm === 'number'
    ) {
      volumen += p.largoCm * p.anchoCm * p.altoCm;
      ladoMayor = Math.max(ladoMayor, p.largoCm, p.anchoCm, p.altoCm);
    } else sinMedidas++;
  }
  const excesos: ExcesoCapacidad[] = [];
  const desconocidos: ResultadoCapacidad['desconocidos'] = [];
  if (!cap) desconocidos.push('capacidad');
  const c = cap ?? {};
  if (c.maxPaquetes) {
    if (paquetes.length > c.maxPaquetes)
      excesos.push({ campo: 'paquetes', limite: c.maxPaquetes, valor: paquetes.length });
  } else if (cap) desconocidos.push('max_paquetes');
  if (c.maxPesoG) {
    if (pesoG > c.maxPesoG) excesos.push({ campo: 'peso', limite: c.maxPesoG, valor: pesoG });
  } else if (cap) desconocidos.push('max_peso');
  if (c.maxVolumenCm3) {
    if (volumen > c.maxVolumenCm3)
      excesos.push({ campo: 'volumen', limite: c.maxVolumenCm3, valor: volumen });
  } else if (cap) desconocidos.push('max_volumen');
  if (c.maxLadoCm) {
    if (ladoMayor > c.maxLadoCm)
      excesos.push({ campo: 'lado', limite: c.maxLadoCm, valor: ladoMayor });
  } else if (cap) desconocidos.push('max_lado');
  if (sinPeso) desconocidos.push('peso');
  if (sinMedidas) desconocidos.push('medidas');
  const estado = excesos.length
    ? 'excede'
    : !cap || (sinPeso && c.maxPesoG) || (sinMedidas && (c.maxVolumenCm3 || c.maxLadoCm))
      ? 'desconocida'
      : 'ok';
  return {
    estado,
    paquetes: paquetes.length,
    pesoG,
    paquetesSinPeso: sinPeso,
    volumenCm3: volumen,
    paquetesSinMedidas: sinMedidas,
    excesos,
    desconocidos,
  };
}
