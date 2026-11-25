import {
  DOCUMENTOS_CONDUCTOR,
  DOCUMENTOS_VEHICULO_PASAJEROS,
  type PerfilPasajeros,
  type ServicioPasajeros,
  documentosDelConductor,
  requisitosQueCumple,
} from './perfilPasajeros';
import { nombrePapelPais } from './papelesPorPais';

/**
 * C-PAPELES-POR-PAIS, segunda parte (24 nov 2026, orden de Richard por Gerencia) — Venezuela lista
 * para encender; Estados Unidos sin cambios; todos los países por configuración.
 *
 * QUÉ papeles se le piden al conductor en cada país, con su nombre en español e inglés, si vencen, si
 * llevan foto y si FRENAN las carreras o SOLO SE PIDEN. Vive en la configuración del país
 * (`config` con clave `pais:XX`, campo `papelesPais`), se edita en Ajustes del superadmin y nace
 * APAGADA: apagada, el conductor ve exactamente lo de siempre (el perfil del país y
 * `DOCUMENTOS_VEHICULO_PASAJEROS`).
 *
 * «Frena» no se elige a mano: es la verdad del reparto. Un papel frena cuando el reparto ya lo exige
 * (el vehículo: registro, póliza y póliza de pasajeros, e inspección en Carro; el conductor: el papel
 * que cumple un requisito de pasajeros no exento en su país). Todo papel nuevo «solo se pide»: se le
 * pide, el equipo lo revisa y la barra lo nombra, pero el reparto no se toca. `normalizarLista` lo
 * fuerza siempre, así nunca se guarda un «frena» que el reparto no cumpla, ni al revés.
 *
 * Una sola pieza para el servidor, Driver y el panel.
 */

export type DondePapel = 'conductor' | 'vehiculo';

/** Los tipos de papel del VEHÍCULO que se pueden pedir (los de `vehiculo_documentos`). */
export const TIPOS_PAPEL_VEHICULO = [
  'registro',
  'seguro',
  'seguro_pasajeros',
  'inspeccion',
  'foto_frente',
  'foto_lado',
  'foto_placa',
  'foto_interior',
] as const;

/** Los tipos de papel del CONDUCTOR que se pueden pedir (los de `conductor_documentos`). */
export const TIPOS_PAPEL_CONDUCTOR = DOCUMENTOS_CONDUCTOR;

export type PapelDeLista = {
  tipo: string;
  donde: DondePapel;
  servicios: ServicioPasajeros[];
  es: string;
  en: string;
  vence: boolean;
  foto: boolean;
  /** La verdad del reparto (se recalcula al guardar y al leer). */
  frena: boolean;
  /**
   * Otros papeles del vehículo que se guardan con el MISMO archivo. Venezuela: la póliza RCV también
   * es la póliza que cubre al pasajero (como ya hace el asistente de fotos).
   */
  tambien?: string[];
};

export type ListaPapelesPais = { activa: boolean; papeles: PapelDeLista[] };

const SERVICIOS: readonly ServicioPasajeros[] = ['moto', 'carro'];

/** Lo que el reparto exige del vehículo para cada servicio de pasajeros. */
const VEHICULO_FRENA: Readonly<Record<ServicioPasajeros, readonly string[]>> = {
  moto: ['registro', 'seguro', 'seguro_pasajeros'],
  carro: ['registro', 'seguro', 'seguro_pasajeros', 'inspeccion'],
};

const enLista = (l: readonly string[], x: string) => l.includes(x);

/** ¿El reparto ya exige este papel para este servicio en este país? */
export function frenaEnReparto(
  tipo: string,
  donde: DondePapel,
  servicio: ServicioPasajeros,
  perfil: PerfilPasajeros,
  exentos: readonly string[],
): boolean {
  if (donde === 'vehiculo')
    return enLista(servicio === 'carro' ? VEHICULO_FRENA.carro : VEHICULO_FRENA.moto, tipo);
  if (perfil.antecedentes !== 'documentos') return false;
  if (!enLista(documentosDelConductor(perfil, servicio), tipo)) return false;
  return requisitosQueCumple(perfil, tipo).some((r) => !exentos.includes(r));
}

/** Los papeles que el reparto exige para un servicio (los que la lista no puede dejar fuera). */
export function papelesQueFrenan(
  servicio: ServicioPasajeros,
  perfil: PerfilPasajeros,
  exentos: readonly string[],
): { tipo: string; donde: DondePapel }[] {
  const veh = (servicio === 'carro' ? VEHICULO_FRENA.carro : VEHICULO_FRENA.moto).map((tipo) => ({
    tipo,
    donde: 'vehiculo' as const,
  }));
  const mios = documentosDelConductor(perfil, servicio)
    .filter((t) => frenaEnReparto(t, 'conductor', servicio, perfil, exentos))
    .map((tipo) => ({ tipo, donde: 'conductor' as const }));
  return [...mios, ...veh];
}

const esTipo = (donde: DondePapel, tipo: string) =>
  donde === 'vehiculo' ? enLista(TIPOS_PAPEL_VEHICULO, tipo) : enLista(TIPOS_PAPEL_CONDUCTOR, tipo);

/** Pone la verdad del reparto en cada papel y quita lo que no es un papel conocido. */
export function normalizarLista(
  lista: ListaPapelesPais,
  perfil: PerfilPasajeros,
  exentos: readonly string[],
): ListaPapelesPais {
  const vistos = new Set<string>();
  const papeles: PapelDeLista[] = [];
  for (const p of lista.papeles) {
    if (!esTipo(p.donde, p.tipo)) continue;
    const servicios = SERVICIOS.filter((s) => p.servicios.includes(s));
    const clave = `${p.donde}:${p.tipo}:${servicios.join(',')}`;
    if (!servicios.length || vistos.has(clave)) continue;
    vistos.add(clave);
    const tambien =
      p.donde === 'vehiculo'
        ? (p.tambien ?? []).filter((t) => t !== p.tipo && enLista(TIPOS_PAPEL_VEHICULO, t))
        : [];
    papeles.push({
      tipo: p.tipo,
      donde: p.donde,
      servicios,
      es: p.es.trim(),
      en: p.en.trim(),
      vence: p.vence,
      foto: p.foto,
      frena: servicios.some((s) => frenaEnReparto(p.tipo, p.donde, s, perfil, exentos)),
      ...(tambien.length ? { tambien } : {}),
    });
  }
  return { activa: lista.activa, papeles };
}

/** Los papeles de la lista para un servicio. */
export function papelesDelServicio(lista: ListaPapelesPais, servicio: ServicioPasajeros) {
  return lista.papeles.filter((p) => p.servicios.includes(servicio));
}

/**
 * Lo que el reparto exige y la lista no pide (ni como papel propio ni guardado «también» con otro).
 * Encender una lista así dejaría al conductor sin poder subir lo que lo frena: no se guarda.
 */
export function faltanEnLista(
  lista: ListaPapelesPais,
  perfil: PerfilPasajeros,
  exentos: readonly string[],
): { servicio: ServicioPasajeros; tipo: string; donde: DondePapel }[] {
  const faltan: { servicio: ServicioPasajeros; tipo: string; donde: DondePapel }[] = [];
  for (const servicio of SERVICIOS) {
    const del = papelesDelServicio(lista, servicio);
    const pide = new Set(
      del.flatMap((p) => [
        `${p.donde}:${p.tipo}`,
        ...(p.tambien ?? []).map((t) => `${p.donde}:${t}`),
      ]),
    );
    for (const f of papelesQueFrenan(servicio, perfil, exentos))
      if (!pide.has(`${f.donde}:${f.tipo}`)) faltan.push({ servicio, ...f });
  }
  return faltan;
}

/** Lo que el conductor sube para un servicio, como lo espera Driver (las mismas claves de siempre). */
export function documentosDeLista(lista: ListaPapelesPais) {
  const tipos = (servicio: ServicioPasajeros, donde: DondePapel) => [
    ...new Set(
      papelesDelServicio(lista, servicio)
        .filter((p) => p.donde === donde)
        .map((p) => p.tipo),
    ),
  ];
  return {
    documentosPorServicio: { moto: tipos('moto', 'conductor'), carro: tipos('carro', 'conductor') },
    documentosVehiculo: { moto: tipos('moto', 'vehiculo'), carro: tipos('carro', 'vehiculo') },
  };
}

/** El nombre es/en de cada papel por servicio, para que Driver pinte lo que manda el servidor. */
export function nombresDeLista(lista: ListaPapelesPais) {
  const nombres = (servicio: ServicioPasajeros) =>
    Object.fromEntries(
      papelesDelServicio(lista, servicio).map((p) => [p.tipo, { es: p.es, en: p.en }]),
    ) as Record<string, { es: string; en: string }>;
  return { moto: nombres('moto'), carro: nombres('carro') };
}

// ───────────────────────── De fábrica ─────────────────────────

const papel = (
  tipo: string,
  donde: DondePapel,
  servicios: ServicioPasajeros[],
  es: string,
  en: string,
  extra: Partial<Pick<PapelDeLista, 'vence' | 'foto' | 'tambien'>> = {},
): PapelDeLista => ({
  tipo,
  donde,
  servicios,
  es,
  en,
  vence: extra.vence ?? false,
  foto: extra.foto ?? true,
  frena: false,
  ...(extra.tambien ? { tambien: extra.tambien } : {}),
});

/**
 * Venezuela (Richard por Gerencia, 24 nov 2026): licencia de conducir, certificado médico, título de
 * propiedad o carnet de circulación, póliza RCV y foto de la moto con la placa visible. Carro suma la
 * revisión del vehículo, que el reparto ya exige. APAGADA de fábrica.
 */
const VENEZUELA: PapelDeLista[] = [
  papel('licencia_moto', 'conductor', ['moto'], 'Licencia de conducir', 'Driver’s license', {
    vence: true,
  }),
  papel('licencia_conducir', 'conductor', ['carro'], 'Licencia de conducir', 'Driver’s license', {
    vence: true,
  }),
  papel(
    'certificado_medico',
    'conductor',
    ['moto', 'carro'],
    'Certificado médico',
    'Medical certificate',
    { vence: true },
  ),
  papel(
    'registro',
    'vehiculo',
    ['moto', 'carro'],
    'Título de propiedad o carnet de circulación',
    'Title or vehicle registration card (carnet de circulación)',
  ),
  papel('seguro', 'vehiculo', ['moto', 'carro'], 'Póliza RCV', 'RCV liability insurance policy', {
    vence: true,
    tambien: ['seguro_pasajeros'],
  }),
  papel(
    'inspeccion',
    'vehiculo',
    ['carro'],
    'Revisión del vehículo',
    'Vehicle inspection certificate',
    { vence: true },
  ),
  papel(
    'foto_placa',
    'vehiculo',
    ['moto'],
    'Foto de la moto con la placa visible',
    'Photo of your motorcycle with the plate visible',
  ),
  papel(
    'foto_placa',
    'vehiculo',
    ['carro'],
    'Foto del carro con la placa visible',
    'Photo of your car with the plate visible',
  ),
];

const NOMBRES_DE_SIEMPRE: Record<string, { es: string; en: string }> = {
  registro: { es: 'Registro o título del vehículo', en: 'Vehicle registration or title' },
  seguro: { es: 'Seguro del vehículo', en: 'Vehicle insurance' },
  seguro_pasajeros: { es: 'Seguro que cubre a los pasajeros', en: 'Rider coverage insurance' },
  inspeccion: { es: 'Inspección del vehículo', en: 'Vehicle inspection' },
  foto_frente: { es: 'Foto del vehículo de frente', en: 'Front photo of the vehicle' },
  foto_lado: { es: 'Foto del vehículo de lado', en: 'Side photo of the vehicle' },
  foto_placa: { es: 'Foto de la placa', en: 'Photo of the license plate' },
  foto_interior: { es: 'Foto del interior', en: 'Photo of the interior' },
  licencia_moto: { es: 'Licencia para manejar moto', en: 'Motorcycle license' },
  licencia_conducir: { es: 'Licencia de conducir', en: 'Driver’s license' },
  antecedentes_penales: {
    es: 'Certificado de antecedentes penales',
    en: 'Criminal record certificate',
  },
  certificado_medico: { es: 'Certificado médico', en: 'Medical certificate' },
};

/** La lista de hoy de un país (lo que ya pide su perfil), para empezar a editarla. */
export function listaDeHoy(perfil: PerfilPasajeros): PapelDeLista[] {
  const nombre = (servicio: ServicioPasajeros, tipo: string) => {
    const base = new Map(Object.entries(NOMBRES_DE_SIEMPRE)).get(tipo) ?? { es: tipo, en: tipo };
    return {
      es: nombrePapelPais(perfil.pais, servicio, tipo, 'es') ?? base.es,
      en: nombrePapelPais(perfil.pais, servicio, tipo, 'en') ?? base.en,
    };
  };
  return SERVICIOS.flatMap((servicio) => [
    ...documentosDelConductor(perfil, servicio).map((tipo) => {
      const n = nombre(servicio, tipo);
      return papel(tipo, 'conductor', [servicio], n.es, n.en, { vence: true });
    }),
    ...(servicio === 'carro'
      ? DOCUMENTOS_VEHICULO_PASAJEROS.carro
      : DOCUMENTOS_VEHICULO_PASAJEROS.moto
    ).map((tipo) => {
      const n = nombre(servicio, tipo);
      return papel(tipo, 'vehiculo', [servicio], n.es, n.en, {
        vence: tipo === 'seguro' || tipo === 'seguro_pasajeros' || tipo === 'inspeccion',
      });
    }),
  ]);
}

/** La lista de fábrica de un país: Venezuela la suya; los demás, la de hoy. Siempre APAGADA. */
export function listaPapelesDeFabrica(perfil: PerfilPasajeros): ListaPapelesPais {
  const papeles = perfil.pais === 'VE' ? VENEZUELA.map((p) => ({ ...p })) : listaDeHoy(perfil);
  return { activa: false, papeles };
}

/** Un nombre de papel por defecto (para el panel y para un papel sin nombre propio). */
export const nombreDePapel = (tipo: string, idioma: string) => {
  const n = new Map(Object.entries(NOMBRES_DE_SIEMPRE)).get(tipo);
  return n ? (idioma === 'en' ? n.en : n.es) : tipo;
};
