/**
 * C-PLAZO-PAPELES (19 nov 2026, decisión de Richard) — por país, por configuración.
 *
 * «Al crear la cuenta ya lo deja trabajar… le damos un mes para que suba los datos; si al mes no los
 * sube, la cuenta no le pasa más… se le manda siempre un recordatorio». Cada país tiene su POLÍTICA
 * (editable en el superadmin, guardada en la configuración del país):
 *
 * - `dias`: días de plazo desde que crea la cuenta para subir y aprobar el resto de sus papeles.
 *   0 = sin plazo: todo aprobado antes de empezar (Estados Unidos, como siempre).
 * - `paraEmpezar`: lo que SÍ se exige antes del primer viaje aunque haya plazo.
 * - `exentos`: requisitos del catálogo que ese país no exige nunca (Venezuela no pide antecedentes).
 * - `asistente`: el conductor sube sus papeles con el asistente de verificación (una horma por foto).
 * - `aprobacionAutomatica`: la IA aprueba sola lo que viene todo en verde. APAGADA de fábrica.
 * - `sinReverso`: las fotos «por detrás» que ese país NO pide, porque su documento no trae nada útil
 *   atrás (C-DOCUMENTO-SIN-REVERSO: la cédula de Venezuela). Sin escribir = se piden.
 *
 * Una sola pieza para el servidor, Driver y el panel. Nada de esto vive en condiciones sueltas.
 */

/** Lo que se puede exigir para empezar. «cara» es la foto de la cara (seguridad del pasajero). */
export const PAPELES_PARA_EMPEZAR = ['cara', 'identidad', 'licencia', 'seguro'] as const;
export type PapelParaEmpezar = (typeof PAPELES_PARA_EMPEZAR)[number];

export type PoliticaPlazoPapeles = {
  dias: number;
  paraEmpezar: PapelParaEmpezar[];
  exentos: string[];
  asistente: boolean;
  aprobacionAutomatica: boolean;
  /** C-DOCUMENTO-SIN-REVERSO. Ausente o vacío = el país pide los dos reversos, como siempre. */
  sinReverso?: PasoReverso[];
};

/** Las fotos «por detrás» que un país puede dejar de pedir. */
export const PASOS_REVERSO = ['doc_reverso', 'licencia_reverso'] as const;
export type PasoReverso = (typeof PASOS_REVERSO)[number];

export const PLAZO_DIAS_MAXIMO = 90;

const SIN_PLAZO: PoliticaPlazoPapeles = {
  dias: 0,
  paraEmpezar: [],
  exentos: [],
  asistente: false,
  aprobacionAutomatica: false,
};

const DE_FABRICA = new Map<string, PoliticaPlazoPapeles>([
  // Venezuela: trabaja desde que crea la cuenta; 30 días para el resto. Para empezar, solo la foto
  // de la cara (no es un documento: es seguridad del pasajero).
  // Richard (19 nov): en Venezuela NO se exigen antecedentes, ni se muestran como requisito. La base
  // lo respeta igual que la app (tabla `politica_requisitos`, vista `conductores_elegibles` y los
  // disparadores de `habilitaciones`: apps/servidor/src/esquemaPlazo.ts).
  [
    'VE',
    {
      dias: 30,
      paraEmpezar: ['cara'],
      exentos: ['antecedentes', 'antecedentes_pasajeros'],
      asistente: true,
      aprobacionAutomatica: false,
      // C-DOCUMENTO-SIN-REVERSO (23 nov 2026, Richard): la cédula venezolana no tiene nada útil por
      // detrás (una lámina en blanco con un número de serie): solo se fotografía por delante. La
      // licencia venezolana SÍ tiene dos caras y se sigue pidiendo por frente y por reverso.
      sinReverso: ['doc_reverso'],
    },
  ],
  // Perú («hay que ser más serios»): licencia y seguro (SOAT) aprobados para empezar; 30 días para el resto.
  [
    'PE',
    {
      dias: 30,
      paraEmpezar: ['cara', 'licencia', 'seguro'],
      exentos: [],
      asistente: true,
      aprobacionAutomatica: false,
    },
  ],
]);

/** Los países que traen política de fábrica (los demás, sin plazo y sin exentos). */
export const PAISES_CON_PLAZO: readonly string[] = [...DE_FABRICA.keys()];

export function politicaPlazoDeFabrica(pais: string | null | undefined): PoliticaPlazoPapeles {
  const p = DE_FABRICA.get((pais ?? '').toUpperCase()) ?? SIN_PLAZO;
  return {
    ...p,
    paraEmpezar: [...p.paraEmpezar],
    exentos: [...p.exentos],
    sinReverso: [...(p.sinReverso ?? [])],
  };
}

/** Qué requisitos del catálogo hay detrás de cada papel «para empezar». */
const REQUISITOS_DE_PAPEL = new Map<PapelParaEmpezar, readonly string[]>([
  ['cara', []],
  ['identidad', ['identidad']],
  ['licencia', ['licencia', 'licencia_moto']],
  // El seguro del vehículo y, donde se llevan pasajeros, el que los cubre (en Perú, el SOAT).
  ['seguro', ['seguro_vehiculo', 'seguro_pasajeros']],
]);

/** Los requisitos que se exigen aunque el conductor esté dentro de su plazo. */
export function requisitosParaEmpezar(p: Pick<PoliticaPlazoPapeles, 'paraEmpezar'>): Set<string> {
  return new Set(p.paraEmpezar.flatMap((x) => [...(REQUISITOS_DE_PAPEL.get(x) ?? [])]));
}

/** Días a los que se recuerda, contados hacia el final del plazo. */
export const HITOS_RECORDATORIO = [15, 10, 5, 1] as const;

const DIA_MS = 86_400_000;
const aFecha = (s: string) => new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`);

/** Días que le quedan (hacia arriba: «te queda 1 día» hasta la última hora). Nunca negativo. */
export function diasRestantes(venceEn: string, ahora: Date = new Date()): number {
  return Math.max(0, Math.ceil((aFecha(venceEn).getTime() - ahora.getTime()) / DIA_MS));
}

/**
 * El recordatorio que toca hoy: el hito más cercano ya alcanzado que todavía no se avisó. `ultimo`
 * son los días que quedaban en el último aviso (null = solo el de bienvenida). 0 = el del vencimiento.
 */
export function hitoQueToca(dias: number, ultimo: number | null): number | null {
  if (dias <= 0) return ultimo === 0 ? null : 0;
  const hito = HITOS_RECORDATORIO.filter((h) => dias <= h).at(-1);
  if (hito === undefined) return null;
  return ultimo !== null && ultimo <= hito ? null : hito;
}

// ───────────────────────── El asistente de verificación ─────────────────────────

/** Una foto por paso. El orden es el del asistente. */
export const PASOS_VERIFICACION = [
  'doc_frente',
  'doc_reverso',
  'licencia_frente',
  'licencia_reverso',
  'seguro',
  'cara',
] as const;
export type PasoVerificacion = (typeof PASOS_VERIFICACION)[number];
export const esPasoVerificacion = (s: string): s is PasoVerificacion =>
  (PASOS_VERIFICACION as readonly string[]).includes(s);

/**
 * C-DOCUMENTO-SIN-REVERSO (23 nov 2026). Los pasos que le tocan a un conductor según su país: quita
 * los reversos que ese país no pide. Una sola pieza para el asistente, el envío a revisión, el flujo
 * viejo de «Mis datos», los recordatorios y la ficha del equipo.
 */
export function quitarReversos<T extends string>(
  pasos: readonly T[],
  politica: Pick<PoliticaPlazoPapeles, 'sinReverso'> | null | undefined,
): T[] {
  const fuera = new Set<string>(politica?.sinReverso ?? []);
  return pasos.filter((p) => !fuera.has(p));
}

/** ¿Ese país pide el reverso del documento de identidad? */
export const pideReversoDocumento = (
  politica: Pick<PoliticaPlazoPapeles, 'sinReverso'> | null | undefined,
) => !(politica?.sinReverso ?? []).includes('doc_reverso');

/** La horma de cada paso: tarjeta (documento de bolsillo), hoja (póliza) u óvalo (cara). */
export type Horma = 'tarjeta' | 'hoja' | 'ovalo';
const HORMAS = new Map<PasoVerificacion, Horma>([
  ['doc_frente', 'tarjeta'],
  ['doc_reverso', 'tarjeta'],
  ['licencia_frente', 'tarjeta'],
  ['licencia_reverso', 'tarjeta'],
  ['seguro', 'hoja'],
  ['cara', 'ovalo'],
]);
export const hormaDePaso = (p: PasoVerificacion): Horma => HORMAS.get(p) ?? 'tarjeta';

/**
 * C-PAPELES-SOLO-CAMARA (20 nov 2026, Richard: «la licencia se le tiene que tomar una foto real con
 * la cámara. No es para subir un archivo. La cara es foto real»). ¿Esta foto solo se acepta tomada en
 * vivo con la cámara de la app?
 *
 * - En los países con asistente (`politica.asistente`), TODAS las fotos de verificación: cara,
 *   documento, licencia y seguro. Nada se elige de los archivos del teléfono.
 * - Sin asistente (Estados Unidos, verificación de siempre), solo la cara.
 *
 * La única pieza que lo decide: el servidor la usa para rechazar y la app para no ofrecer archivos.
 * El servidor lo comprueba con lo que la app DECLARA (`?origen=camara`): es una barrera razonable,
 * no una prueba imposible de falsear. La segunda barrera es la IA, que avisa si la foto parece una
 * foto de otra foto o de una pantalla, y la última es la persona del equipo que la revisa.
 */
export const soloEnVivo = (p: PasoVerificacion, asistente: boolean) => asistente || p === 'cara';

/** A qué papel de «Tus papeles» pertenece cada foto. */
export type PapelDelConductor = 'identidad' | 'licencia' | 'seguro' | 'cara';
const PAPEL_DE_PASO = new Map<PasoVerificacion, PapelDelConductor>([
  ['doc_frente', 'identidad'],
  ['doc_reverso', 'identidad'],
  ['licencia_frente', 'licencia'],
  ['licencia_reverso', 'licencia'],
  ['seguro', 'seguro'],
  ['cara', 'cara'],
]);
export const papelDePaso = (p: PasoVerificacion): PapelDelConductor =>
  PAPEL_DE_PASO.get(p) ?? 'identidad';

/** Qué espera la IA ver en cada paso (la misma lista cerrada que se le da al modelo). */
export const CLASES_DE_FOTO = [
  'identidad_frente',
  'identidad_reverso',
  'licencia_frente',
  'licencia_reverso',
  'seguro',
  'cara',
  'otra_cosa',
] as const;
export type ClaseDeFoto = (typeof CLASES_DE_FOTO)[number];
const CLASE_DE_PASO = new Map<PasoVerificacion, ClaseDeFoto>([
  ['doc_frente', 'identidad_frente'],
  ['doc_reverso', 'identidad_reverso'],
  ['licencia_frente', 'licencia_frente'],
  ['licencia_reverso', 'licencia_reverso'],
  ['seguro', 'seguro'],
  ['cara', 'cara'],
]);
export const claseDePaso = (p: PasoVerificacion): ClaseDeFoto =>
  CLASE_DE_PASO.get(p) ?? 'otra_cosa';

/** Verde = la IA lo ve bien; amarillo = duda (decide una persona); rojo = no coincide. */
export type ColorIa = 'verde' | 'amarillo' | 'rojo' | 'sin_ia';

/** Textos del asistente por paso, en los dos idiomas. El documento se llama como en el país. */
export function textosDePaso(
  paso: PasoVerificacion,
  pais: string | null | undefined,
  ingles: boolean,
): { titulo: string; guia: string; nombre: string; frase: string } {
  const pe = (pais ?? '').toUpperCase() === 'PE';
  const us = (pais ?? '').toUpperCase() === 'US';
  const doc = ingles ? 'ID' : pe ? 'DNI' : us ? 'identificación' : 'cédula';
  const Doc = `${doc.charAt(0).toUpperCase()}${doc.slice(1)}`;
  const seguro = ingles
    ? pe
      ? 'SOAT insurance'
      : 'vehicle insurance'
    : pe
      ? 'SOAT'
      : 'seguro del vehículo';
  const Seguro = `${seguro.charAt(0).toUpperCase()}${seguro.slice(1)}`;
  const t = (titulo: string, nombre: string, frase: string, cola = '') => ({
    titulo,
    nombre,
    frase,
    guia: ingles ? `Fit ${frase} inside the frame${cola}` : `Pon ${frase} dentro del marco${cola}`,
  });
  switch (paso) {
    case 'doc_frente':
      return ingles
        ? t('FRONT', `${Doc} (front)`, `the front of your ${doc}`)
        : t('FRENTE', `${Doc} (frente)`, `el frente de tu ${doc}`);
    case 'doc_reverso':
      return ingles
        ? t('BACK', `${Doc} (back)`, `the back of your ${doc}`)
        : t('REVERSO', `${Doc} (reverso)`, `el reverso de tu ${doc}`);
    case 'licencia_frente':
      return ingles
        ? t('LICENSE · FRONT', 'License (front)', 'the front of your license')
        : t('LICENCIA · FRENTE', 'Licencia (frente)', 'el frente de tu licencia');
    case 'licencia_reverso':
      return ingles
        ? t('LICENSE · BACK', 'License (back)', 'the back of your license')
        : t('LICENCIA · REVERSO', 'Licencia (reverso)', 'el reverso de tu licencia');
    case 'seguro':
      return ingles
        ? t('INSURANCE', Seguro, `your ${seguro}`, ', with the dates visible')
        : t('SEGURO', Seguro, `tu ${seguro}`, ', con las fechas a la vista');
    case 'cara':
      return ingles
        ? {
            titulo: 'FACE',
            nombre: 'Your face',
            frase: 'a photo of your face',
            guia: 'Fit your face inside the oval, without a hat or dark glasses',
          }
        : {
            titulo: 'CARA',
            nombre: 'Tu cara',
            frase: 'una foto de tu cara',
            guia: 'Pon tu cara dentro del óvalo, sin gorra ni lentes oscuros',
          };
  }
}

/** Lo que se le dice al momento cuando la foto no es la del paso. */
export function avisoNoCoincide(
  vio: ClaseDeFoto,
  paso: PasoVerificacion,
  pais: string | null | undefined,
  ingles: boolean,
): string {
  const aqui = textosDePaso(paso, pais, ingles).frase;
  const pasoDeClase = [...CLASE_DE_PASO.entries()].find(([, c]) => c === vio)?.[0];
  if (!pasoDeClase)
    return ingles
      ? `This doesn’t look right. This step needs ${aqui}. Take it again.`
      : `Esto no parece lo que va aquí: ${aqui}. Tómala otra vez.`;
  const parece = textosDePaso(pasoDeClase, pais, ingles).frase;
  return ingles
    ? `This looks like ${parece}; this step needs ${aqui}.`
    : `Esto parece ${parece}; aquí va ${aqui}.`;
}
