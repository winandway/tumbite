/**
 * C-PAPELES-POR-PAIS (19 nov 2026 — Perú). Los TIPOS de papel son los mismos en todos los países
 * (registro, seguro, inspección, licencia, antecedentes); lo que cambia es CÓMO SE LLAMAN en cada
 * país. Una sola pieza para Driver y para el panel: si el país tiene nombre propio para ese papel,
 * se usa; si no, la pantalla pinta su nombre de siempre.
 *
 * Perú (ficha docs/investigaciones-rea/2026-11-19-ica-peru.md, sección 4.3): en Ica «moto» es el
 * mototaxi. SOAT o CAT, tarjeta de identificación vehicular, revisión técnica (CITV), licencia de la
 * clase B para moto y mototaxi y de la clase A para carro, y antecedentes penales o Certificado
 * Único Laboral.
 */
type Nombre = { es: string; en: string };
type Servicio = 'moto' | 'carro';

const PERU: Record<Servicio, Record<string, Nombre>> = {
  moto: {
    registro: {
      es: 'Tarjeta de identificación vehicular',
      en: 'Vehicle identification card (tarjeta de identificación vehicular)',
    },
    seguro: { es: 'SOAT o CAT vigente', en: 'Valid SOAT or CAT (mandatory accident insurance)' },
    seguro_pasajeros: {
      es: 'SOAT o CAT que cubre a los pasajeros',
      en: 'SOAT or CAT covering your passengers',
    },
    inspeccion: {
      es: 'Revisión técnica vehicular (CITV)',
      en: 'Vehicle technical inspection certificate (CITV)',
    },
    foto_frente: { es: 'Foto del mototaxi o la moto de frente', en: 'Front photo of your vehicle' },
    licencia_moto: {
      es: 'Licencia de conducir clase B (B-IIc para mototaxi, B-IIb para moto)',
      en: 'Class B driver’s license (B-IIc for mototaxi, B-IIb for motorcycle)',
    },
    antecedentes_penales: {
      es: 'Certificado de antecedentes penales o Certificado Único Laboral',
      en: 'Criminal record certificate or Certificado Único Laboral',
    },
  },
  carro: {
    registro: {
      es: 'Tarjeta de identificación vehicular',
      en: 'Vehicle identification card (tarjeta de identificación vehicular)',
    },
    seguro: { es: 'SOAT vigente', en: 'Valid SOAT (mandatory accident insurance)' },
    seguro_pasajeros: {
      es: 'SOAT que cubre a los pasajeros',
      en: 'SOAT covering your passengers',
    },
    inspeccion: {
      es: 'Revisión técnica vehicular (CITV)',
      en: 'Vehicle technical inspection certificate (CITV)',
    },
    licencia_conducir: {
      es: 'Licencia de conducir clase A (A-I o A-IIa)',
      en: 'Class A driver’s license (A-I or A-IIa)',
    },
    antecedentes_penales: {
      es: 'Certificado de antecedentes penales o Certificado Único Laboral',
      en: 'Criminal record certificate or Certificado Único Laboral',
    },
  },
};

/** Lo que el conductor ya cumple, dicho con las palabras del país. */
const REQUISITOS_PERU: Record<Servicio, Record<string, Nombre>> = {
  moto: {
    seguro_pasajeros: {
      es: 'SOAT o CAT que cubre a los pasajeros, aprobado',
      en: 'SOAT or CAT covering passengers, approved',
    },
    historial_manejo: { es: 'Licencia de la clase B aprobada', en: 'Class B license approved' },
    licencia_moto: { es: 'Licencia de la clase B aprobada', en: 'Class B license approved' },
  },
  carro: {
    seguro_pasajeros: {
      es: 'SOAT que cubre a los pasajeros, aprobado',
      en: 'SOAT covering passengers, approved',
    },
    inspeccion_vehiculo: {
      es: 'Revisión técnica vehicular (CITV) aprobada',
      en: 'Vehicle technical inspection (CITV) approved',
    },
    historial_manejo: { es: 'Licencia de la clase A aprobada', en: 'Class A license approved' },
    licencia: { es: 'Licencia de la clase A aprobada', en: 'Class A license approved' },
  },
};

const AYUDA_SEGURO_PERU: Record<Servicio, Nombre> = {
  moto: {
    es: 'El SOAT o el CAT ya cubre a tus pasajeros: sube el mismo en las dos casillas.',
    en: 'Your SOAT or CAT already covers your passengers: upload the same one in both boxes.',
  },
  carro: {
    es: 'El SOAT ya cubre a tus pasajeros: sube el mismo en las dos casillas.',
    en: 'Your SOAT already covers your passengers: upload the same one in both boxes.',
  },
};

const POR_PAIS = new Map<string, Record<Servicio, Record<string, Nombre>>>([['PE', PERU]]);
const REQUISITOS_POR_PAIS = new Map<string, Record<Servicio, Record<string, Nombre>>>([
  ['PE', REQUISITOS_PERU],
]);
const AYUDA_SEGURO = new Map<string, Record<Servicio, Nombre>>([['PE', AYUDA_SEGURO_PERU]]);

const elegir = (n: Nombre | undefined, idioma: string) =>
  n ? (idioma === 'en' ? n.en : n.es) : null;
const deServicio = <T>(m: Record<Servicio, T> | undefined, servicio: string): T | undefined =>
  m ? (servicio === 'carro' ? m.carro : m.moto) : undefined;
const pais2 = (pais: string | null | undefined) => (pais ?? '').toUpperCase();

/** El nombre de un papel en el país del conductor, o null si el país usa el nombre de siempre. */
export function nombrePapelPais(
  pais: string | null | undefined,
  servicio: string,
  tipo: string,
  idioma: string,
): string | null {
  const m = deServicio(POR_PAIS.get(pais2(pais)), servicio);
  return elegir(m ? new Map(Object.entries(m)).get(tipo) : undefined, idioma);
}

/** El nombre de un requisito cumplido o pendiente en el país, o null. */
export function nombreRequisitoPais(
  pais: string | null | undefined,
  servicio: string,
  requisito: string,
  idioma: string,
): string | null {
  const m = deServicio(REQUISITOS_POR_PAIS.get(pais2(pais)), servicio);
  return elegir(m ? new Map(Object.entries(m)).get(requisito) : undefined, idioma);
}

/** La ayuda sobre el seguro que cubre a los pasajeros, con las palabras del país, o null. */
export function ayudaSeguroPais(
  pais: string | null | undefined,
  servicio: string,
  idioma: string,
): string | null {
  return elegir(deServicio(AYUDA_SEGURO.get(pais2(pais)), servicio), idioma);
}
