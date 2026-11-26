import {
  type ColorIa,
  type Idioma,
  type PapelDelConductor,
  type PasoVerificacion,
  hormaDePaso,
  textosDePaso,
} from '@tumbite/compartido';
import { textoCara } from '../piezas/esperaCiudadTextos';

/**
 * C-ASISTENTE-DRIVER (20 nov 2026, Richard: «que sean como unas hormas, y cada foto que tome tenga
 * miniatura, le da siguiente… un asistente que valga la pena») — todos los países con `asistente`.
 *
 * La lógica pura del asistente de verificación de Driver: el orden de los pasos, qué se enseña en
 * cada momento y los textos. Las pantallas (`AsistentePapeles`, `RevisaTusPapeles`, `TusPapeles`)
 * solo dibujan lo que sale de aquí, para poder probarlo sin teléfono.
 */

export type EstadoPapel = 'pendiente' | 'por_enviar' | 'en_revision' | 'aprobado' | 'repetir';

export type FotoDePaso = {
  id: string;
  estado: 'vigente' | 'repetir';
  motivo: string;
  color: ColorIa | string;
  creadoEn: string;
};

export type PasoDelServidor = {
  paso: PasoVerificacion;
  papel: PapelDelConductor;
  soloEnVivo: boolean;
  foto: FotoDePaso | null;
};

export type PapelDelServidor = {
  papel: PapelDelConductor;
  pasos: PasoVerificacion[];
  estado: EstadoPapel;
  motivo: string;
};

/** Lo que contesta `GET /datos/conductor/verificacion`. */
export type Verificacion = {
  pais: string | null;
  asistente: boolean;
  plazo: {
    estado: string;
    venceEn: string | null;
    dias: number;
    diasPolitica: number;
    paraEmpezar: string[];
  };
  perfil: { nombre: string; tieneCara: boolean };
  consentimiento: boolean;
  /** C-PERMISO-IA: `null` = todavía no contestó; un servidor viejo no lo manda (no se pide). */
  permisoIa?: boolean | null;
  /** C-AVISO-IA-UNICO: la pantalla del aviso de IA está pendiente (un servidor viejo no lo manda). */
  avisoIaPendiente?: boolean;
  pasos: PasoDelServidor[];
  papeles: PapelDelServidor[];
  listos: number;
  total: number;
  puedeEnviar: boolean;
};

/**
 * El orden del asistente: la cara primero (es lo que deja empezar a trabajar y arma la tarjeta de
 * perfil), después cada documento por delante y por detrás, y el seguro al final.
 */
const ORDEN: readonly PasoVerificacion[] = [
  'cara',
  'doc_frente',
  'doc_reverso',
  'licencia_frente',
  'licencia_reverso',
  'seguro',
];

export function pasosEnOrden(v: Pick<Verificacion, 'pasos'>): PasoDelServidor[] {
  return [...v.pasos].sort((a, b) => ORDEN.indexOf(a.paso) - ORDEN.indexOf(b.paso));
}

/** Una foto cuenta como tomada si está vigente (la que el equipo pidió repetir, no). */
export const fotoLista = (p: PasoDelServidor) => p.foto?.estado === 'vigente';

/** ¿Se puede cambiar esta foto? Mientras su papel no esté aprobado. */
export function sePuedeCambiar(v: Pick<Verificacion, 'papeles'>, p: PasoDelServidor): boolean {
  return v.papeles.find((x) => x.papel === p.papel)?.estado !== 'aprobado';
}

/** El paso por donde se retoma: la primera foto que falta o que hay que repetir. null = están todas. */
export function pasoPendiente(v: Pick<Verificacion, 'pasos'>): PasoVerificacion | null {
  return pasosEnOrden(v).find((p) => !fotoLista(p))?.paso ?? null;
}

/** El paso que sigue a `actual`: la siguiente foto que falta; si no falta ninguna, a «Revisa tus papeles». */
export function siguientePaso(
  v: Pick<Verificacion, 'pasos'>,
  actual: PasoVerificacion,
): PasoVerificacion | null {
  const orden = pasosEnOrden(v);
  const i = orden.findIndex((p) => p.paso === actual);
  const despues = orden.slice(i + 1).find((p) => !fotoLista(p));
  if (despues) return despues.paso;
  return orden.find((p) => !fotoLista(p) && p.paso !== actual)?.paso ?? null;
}

/** «Paso 2 de 6» y el avance de la barra (fotos tomadas sobre el total). */
export function avanceDeFotos(v: Pick<Verificacion, 'pasos'>): { listas: number; total: number } {
  return { listas: v.pasos.filter(fotoLista).length, total: v.pasos.length };
}

/** Qué dibujo lleva cada paso (la horma gris antes de la foto y la ilustración del borrador). */
export type ClaseDibujo = 'cara' | 'docF' | 'docR' | 'licF' | 'licR' | 'seguro';
const DIBUJOS = new Map<PasoVerificacion, ClaseDibujo>([
  ['cara', 'cara'],
  ['doc_frente', 'docF'],
  ['doc_reverso', 'docR'],
  ['licencia_frente', 'licF'],
  ['licencia_reverso', 'licR'],
  ['seguro', 'seguro'],
]);
export const dibujoDePaso = (p: PasoVerificacion): ClaseDibujo => DIBUJOS.get(p) ?? 'docF';

/** La cara va en círculo; lo demás, en tarjeta de esquinas redondeadas. */
export const esRedonda = (p: PasoVerificacion) => hormaDePaso(p) === 'ovalo';

/**
 * Proporción ancho/alto de la horma: el óvalo de la cara o la tarjeta de bolsillo. La póliza del
 * seguro usa la misma tarjeta, como el borrador aprobado (forma «carnet») y su dibujo (160×100):
 * con 1,3 el dibujo quedaba con bandas y la vista previa (1,586) no coincidía con el marco.
 */
export function proporcionDeHorma(p: PasoVerificacion): number {
  return hormaDePaso(p) === 'ovalo' ? 0.78 : 1.586;
}

const TITULOS = {
  es: new Map<PasoVerificacion, [string, string]>([
    ['cara', ['Tu cara', 'De frente y con buena luz. Será tu foto de perfil.']],
    ['doc_frente', ['Tu documento, por el frente', 'Completo y con todos los datos a la vista.']],
    ['doc_reverso', ['Tu documento, por el reverso', 'Dale la vuelta y tómalo completo.']],
    [
      'licencia_frente',
      ['Tu licencia, por el frente', 'Vigente y con todos los datos a la vista.'],
    ],
    ['licencia_reverso', ['Tu licencia, por el reverso', 'Dale la vuelta y tómala completa.']],
    ['seguro', ['El seguro de tu vehículo', 'Vigente y con las fechas a la vista.']],
  ]),
  en: new Map<PasoVerificacion, [string, string]>([
    ['cara', ['Your face', 'Facing the camera, in good light. It becomes your profile photo.']],
    ['doc_frente', ['Your ID, front', 'The whole card, with every detail visible.']],
    ['doc_reverso', ['Your ID, back', 'Flip it over and capture the whole card.']],
    ['licencia_frente', ['Your license, front', 'Valid, with every detail visible.']],
    ['licencia_reverso', ['Your license, back', 'Flip it over and capture the whole card.']],
    ['seguro', ['Your vehicle insurance', 'Valid, with the dates visible.']],
  ]),
};

/** Todo lo que se escribe en un paso: título grande, ayuda, el lado en mayúsculas y la frase del marco. */
export function textosDelPaso(paso: PasoVerificacion, pais: string | null, idioma: Idioma) {
  const ingles = idioma === 'en';
  const base = textosDePaso(paso, pais, ingles);
  const [titulo, ayuda] = (ingles ? TITULOS.en : TITULOS.es).get(paso) ?? [base.nombre, ''];
  const lado =
    paso === 'doc_frente' || paso === 'licencia_frente'
      ? ingles
        ? 'FRONT'
        : 'FRENTE'
      : paso === 'doc_reverso' || paso === 'licencia_reverso'
        ? ingles
          ? 'BACK'
          : 'REVERSO'
        : null;
  return { titulo, ayuda, lado, nombre: base.nombre, marco: `${base.guia}.` };
}

/** En qué momento del paso está la pantalla. */
export type MomentoDelPaso =
  | 'horma' // todavía no hay foto: el dibujo de lo que se va a pedir y los dos botones
  | 'vista_previa' // acaba de tomarla: «Usar esta» o «Repetir»
  | 'aviso' // la IA avisó que no parece lo pedido o que no se lee
  | 'lista' // foto guardada, con su marca verde
  | 'repetir'; // el equipo pidió repetirla, con su motivo

export function momentoDelPaso(o: {
  foto: FotoDePaso | null;
  fotoNueva: boolean;
  aviso: string;
}): MomentoDelPaso {
  if (o.fotoNueva) return 'vista_previa';
  if (o.aviso) return 'aviso';
  if (o.foto?.estado === 'repetir') return 'repetir';
  return o.foto ? 'lista' : 'horma';
}

/** ¿La respuesta del servidor al subir pide enseñar el aviso antes de seguir? */
export function avisoDeLaIa(ia: { color?: string; aviso?: string } | undefined): string {
  if (!ia?.aviso) return '';
  return ia.color === 'rojo' || ia.color === 'amarillo' ? ia.aviso : '';
}

/**
 * El recorte de la foto al marco de la cámara. La vista previa llena la pantalla («cover»), así que
 * la foto se escala y se centra; de ahí sale qué pedazo de la foto quedó dentro del marco. Se deja
 * un margen alrededor para no cortar un borde del documento. Si la foto y la pantalla no están en la
 * misma orientación no se recorta (null): vale más una foto entera que una mal cortada.
 */
export function recorteAlMarco(
  foto: { width: number; height: number },
  vista: { width: number; height: number },
  marco: { x: number; y: number; width: number; height: number },
  margen = 0.08,
): { originX: number; originY: number; width: number; height: number } | null {
  if (!(foto.width > 0 && foto.height > 0 && vista.width > 0 && vista.height > 0)) return null;
  if (foto.width > foto.height !== vista.width > vista.height) return null;
  const escala = Math.max(vista.width / foto.width, vista.height / foto.height);
  const fueraX = (foto.width * escala - vista.width) / 2;
  const fueraY = (foto.height * escala - vista.height) / 2;
  const mx = marco.width * margen;
  const my = marco.height * margen;
  const x0 = Math.max(0, (marco.x - mx + fueraX) / escala);
  const y0 = Math.max(0, (marco.y - my + fueraY) / escala);
  const x1 = Math.min(foto.width, (marco.x + marco.width + mx + fueraX) / escala);
  const y1 = Math.min(foto.height, (marco.y + marco.height + my + fueraY) / escala);
  const width = Math.floor(x1 - x0);
  const height = Math.floor(y1 - y0);
  if (width < 50 || height < 50) return null;
  return { originX: Math.floor(x0), originY: Math.floor(y0), width, height };
}

/** La tarjeta «Tus papeles» del inicio: qué se le dice y a qué invita. null = no se muestra. */
export type TarjetaPapeles = {
  tono: 'normal' | 'aviso' | 'problema' | 'exito';
  titulo: string;
  detalle: string;
  accion: string;
};

export function tarjetaPapeles(
  v: Verificacion | null,
  idioma: Idioma,
  /** C-REGISTRO-TODO-EL-PAIS: su ciudad todavía no abre (la cara deja la cuenta lista, no «empieza»). */
  enEspera = false,
): TarjetaPapeles | null {
  if (!v || !v.asistente) return null;
  const en = idioma === 'en';
  const aprobados = v.papeles.filter((p) => p.estado === 'aprobado').length;
  if (v.papeles.length > 0 && aprobados === v.papeles.length) return null;
  const { listas, total } = avanceDeFotos(v);
  const faltanFotos = listas < total;
  const hayRepetir = v.papeles.some((p) => p.estado === 'repetir');
  const dias = v.plazo.dias;
  const queda = en
    ? dias === 1
      ? '1 day left'
      : `${dias} days left`
    : dias === 1
      ? 'Te queda 1 día'
      : `Te quedan ${dias} días`;
  if (v.plazo.estado === 'vencido')
    return {
      tono: 'problema',
      titulo: en ? 'Your account is paused' : 'Tu cuenta está en pausa',
      detalle: en
        ? 'The time to upload your documents ended. Upload what’s missing and you’ll get trips again once they’re approved.'
        : 'Se acabó el plazo para subir tus papeles. Sube lo que falta y vuelves a recibir viajes en cuanto se aprueben.',
      accion: en ? 'Upload my documents' : 'Subir mis papeles',
    };
  if (!v.perfil.tieneCara && v.plazo.paraEmpezar.includes('cara') && enEspera)
    return {
      tono: 'aviso',
      ...textoCara(idioma, true),
      accion: en ? 'Take my photo' : 'Tomar mi foto',
    };
  if (!v.perfil.tieneCara && v.plazo.paraEmpezar.includes('cara'))
    return {
      tono: 'aviso',
      titulo: en ? 'Take your face photo to start' : 'Tómate la foto de tu cara para empezar',
      detalle: en
        ? 'It takes a moment. It’s the photo riders see, and with it you can start working.'
        : 'Se toma en un momento. Es la foto que ven los pasajeros, y con ella ya puedes trabajar.',
      accion: en ? 'Take my photo' : 'Tomar mi foto',
    };
  if (hayRepetir)
    return {
      tono: 'aviso',
      titulo: en ? 'We need one photo again' : 'Hay que repetir una foto',
      detalle: v.papeles.find((p) => p.estado === 'repetir')?.motivo || queda,
      accion: en ? 'Retake it' : 'Repetirla',
    };
  if (faltanFotos || v.puedeEnviar) {
    const enPlazo = v.plazo.estado === 'en_plazo';
    return {
      tono: enPlazo && dias <= 5 ? 'aviso' : 'normal',
      titulo: en ? 'Your documents' : 'Tus papeles',
      detalle: enPlazo
        ? en
          ? `${queda} to upload them. ${listas} of ${total} photos ready.`
          : `${queda} para subirlos. ${listas} de ${total} fotos listas.`
        : en
          ? `${listas} of ${total} photos ready.`
          : `${listas} de ${total} fotos listas.`,
      accion: faltanFotos
        ? listas
          ? en
            ? 'Continue'
            : 'Continuar'
          : en
            ? 'Upload my documents'
            : 'Subir mis papeles'
        : en
          ? 'Review and send'
          : 'Revisar y enviar',
    };
  }
  return {
    tono: 'exito',
    titulo: en ? 'Documents sent' : 'Papeles enviados',
    detalle: en
      ? 'Our team is reviewing them. We’ll let you know here and by email.'
      : 'Nuestro equipo los está revisando. Te avisamos aquí y por correo.',
    accion: en ? 'See my documents' : 'Ver mis papeles',
  };
}

/** El texto corto del estado de cada papel en «Tus papeles» y su tono (verde solo lo que salió bien). */
export function estadoDePapel(
  estado: EstadoPapel,
  idioma: Idioma,
): { texto: string; tono: 'exito' | 'aviso' | 'neutro' } {
  const en = idioma === 'en';
  switch (estado) {
    case 'aprobado':
      return { texto: en ? 'Approved' : 'Aprobado', tono: 'exito' };
    case 'en_revision':
      return { texto: en ? 'Under review' : 'En revisión', tono: 'neutro' };
    case 'por_enviar':
      return { texto: en ? 'Ready to send' : 'Lista para enviar', tono: 'neutro' };
    case 'repetir':
      return { texto: en ? 'Retake' : 'Hay que repetir', tono: 'aviso' };
    default:
      return { texto: en ? 'Pending' : 'Pendiente', tono: 'neutro' };
  }
}

const NOMBRES_PAPEL = {
  es: new Map<PapelDelConductor, string>([
    ['cara', 'Tu cara'],
    ['identidad', 'Documento de identidad'],
    ['licencia', 'Licencia'],
    ['seguro', 'Seguro del vehículo'],
  ]),
  en: new Map<PapelDelConductor, string>([
    ['cara', 'Your face'],
    ['identidad', 'ID document'],
    ['licencia', 'License'],
    ['seguro', 'Vehicle insurance'],
  ]),
};
export const nombreDePapel = (p: PapelDelConductor, idioma: Idioma): string =>
  (idioma === 'en' ? NOMBRES_PAPEL.en : NOMBRES_PAPEL.es).get(p) ?? p;

/** El nombre corto de cada foto en la rejilla de «Revisa tus papeles» («Licencia, frente»). */
export function nombreDeFoto(paso: PasoVerificacion, pais: string | null, idioma: Idioma): string {
  return textosDePaso(paso, pais, idioma === 'en')
    .nombre.replace(' (', ', ')
    .replace(')', '');
}

/**
 * C-FOTO-CARA-A-LA-VISTA (23 nov 2026): la cara es lo que le falta para empezar a trabajar (su país la
 * pide para empezar y todavía no la tomó). Mientras sea así, la tarjeta de la cara va ARRIBA DE TODO
 * en el inicio, con su botón a la vista.
 */
export function faltaCaraParaEmpezar(v: Verificacion | null): boolean {
  return Boolean(
    v &&
    v.asistente &&
    v.plazo.estado !== 'vencido' &&
    !v.perfil.tieneCara &&
    v.plazo.paraEmpezar.includes('cara'),
  );
}

/**
 * Las fotos que ya subieron en esta pantalla cuentan como tomadas aunque la relectura de «Tus papeles»
 * falle (con mala señal): antes volvía a pedir la foto que ya estaba guardada.
 */
export function conFotosLocales(
  v: Verificacion,
  subidas: ReadonlyMap<string, string>,
): Verificacion {
  if (!subidas.size) return v;
  const pasos = v.pasos.map((p) => {
    const cuando = subidas.get(p.paso);
    if (!cuando || p.foto?.estado === 'vigente') return p;
    return {
      ...p,
      foto: { id: 'local', estado: 'vigente' as const, motivo: '', color: '', creadoEn: cuando },
    };
  });
  return {
    ...v,
    pasos,
    perfil: { ...v.perfil, tieneCara: v.perfil.tieneCara || subidas.has('cara') },
  };
}

/**
 * Qué se le ofrece junto al motivo de «no te puedes conectar»: tomar la foto de la cara, ir a «Mis
 * datos y vehículo», o la tarjeta que ya está arriba (términos, celular, foto de control).
 */
export function accionDeMotivo(campo: string | undefined): 'cara' | 'datos' | 'arriba' | null {
  if (campo === 'cara') return 'cara';
  if (campo === 'kyc' || campo === 'papeles') return 'datos';
  if (
    campo === 'terminos' ||
    campo === 'telefono' ||
    campo === 'selfie' ||
    campo === 'selfie_casco'
  )
    return 'arriba';
  return null;
}
