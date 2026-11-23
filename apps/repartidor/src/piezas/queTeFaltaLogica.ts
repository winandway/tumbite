import type { Idioma } from '@tumbite/compartido';

/**
 * C-QUE-TE-FALTA (23 nov 2026) — todos los países. Lo que el servidor dice que le falta al conductor
 * para recibir carreras (`GET /datos/conductor/que-te-falta`, la misma regla del reparto), dicho en
 * palabras y con a dónde lleva su botón. La app no lo adivina: solo lo dice.
 */
export type FaltaServidor = {
  clave: string;
  quien: 'conductor' | 'divoox';
  vehiculoId?: string;
  vehiculoTipo?: string;
  motivo?: string;
};

/** A dónde lleva el botón. `null` = lo hacemos nosotros (sin botón) o no hay nada que tocar. */
export type AccionFalta =
  | 'cara'
  | 'papeles'
  | 'telefono'
  | 'vehiculo_nuevo'
  | 'vehiculo'
  | 'activar_vehiculo'
  | 'encender'
  | 'recargar'
  | 'pago_movil'
  | 'ubicacion';

export type AvisoFalta = {
  clave: string;
  titulo: string;
  detalle: string;
  boton: string | null;
  accion: AccionFalta | null;
  /** «nosotros»: está en manos del equipo (se dice así, sin botón). */
  nuestro: boolean;
};

const NOMBRE_VEHICULO = {
  es: new Map([
    ['moto', 'tu moto'],
    ['carro', 'tu carro'],
    ['scooter', 'tu scooter'],
    ['bicicleta', 'tu bicicleta'],
  ]),
  en: new Map([
    ['moto', 'your motorbike'],
    ['carro', 'your car'],
    ['scooter', 'your scooter'],
    ['bicicleta', 'your bicycle'],
  ]),
};

/** Lo que se muestra (en la pantalla de inicio, arriba) para cada cosa que falta. */
export function avisoDeFalta(f: FaltaServidor, idioma: Idioma): AvisoFalta | null {
  const en = idioma === 'en';
  const v =
    (en ? NOMBRE_VEHICULO.en : NOMBRE_VEHICULO.es).get(f.vehiculoTipo ?? '') ??
    (en ? 'your vehicle' : 'tu vehículo');
  const V = v.charAt(0).toUpperCase() + v.slice(1);
  // El género en español: la moto y la bicicleta; el carro, el scooter y el vehículo.
  const fem = f.vehiculoTipo === 'moto' || f.vehiculoTipo === 'bicicleta';
  const o = fem ? 'a' : 'o';
  const lo = fem ? 'la' : 'lo';
  const a = (
    titulo: string,
    detalle: string,
    boton: string | null,
    accion: AccionFalta | null,
  ): AvisoFalta => ({ clave: f.clave, titulo, detalle, boton, accion, nuestro: !accion });
  switch (f.clave) {
    case 'cara':
      return a(
        en ? 'Take your face photo to start' : 'Tómate la foto de tu cara para empezar',
        en
          ? 'It’s the photo riders see. With it you can go online and start working.'
          : 'Es la foto que ven los pasajeros. Con ella ya puedes conectarte y trabajar.',
        en ? 'Take my photo' : 'Tomar mi foto',
        'cara',
      );
    case 'telefono':
      return a(
        en ? 'Confirm your phone' : 'Confirma tu celular',
        en
          ? 'Enter the code we sent you by text to go online.'
          : 'Escribe el código que te mandamos por SMS para conectarte.',
        null,
        'telefono',
      );
    case 'sin_vehiculo':
      return a(
        en ? 'Add your vehicle' : 'Registra tu vehículo',
        en
          ? 'Tell us what you drive (make, model and license plate) to get trips.'
          : 'Dinos con qué trabajas (marca, modelo y placa) para recibir carreras.',
        en ? 'Add my vehicle' : 'Registrar mi vehículo',
        'vehiculo_nuevo',
      );
    case 'sin_placa':
      return a(
        en ? `${V} is missing its license plate` : `A ${v} le falta la placa`,
        en
          ? 'Add it so we can check it and you can start getting trips.'
          : 'Escríbela para que podamos revisarla y empieces a recibir carreras.',
        en ? 'Add the plate' : 'Completar la placa',
        'vehiculo',
      );
    case 'vehiculo_rechazado':
      return f.quien === 'divoox'
        ? a(
            en ? `${V} is suspended` : `${V} está suspendid${o}`,
            f.motivo || (en ? 'Our team will contact you.' : 'Nuestro equipo te contactará.'),
            null,
            null,
          )
        : a(
            en ? `We need you to fix ${v}` : `Hay que corregir ${v}`,
            f.motivo ||
              (en
                ? 'Check the details and send it again.'
                : `Revisa los datos y envía${lo} otra vez.`),
            en ? 'Fix it' : 'Corregir',
            'vehiculo',
          );
    case 'vehiculo_sin_enviar':
      // C-LLEGA-SOLO-A-REVISION: con lo que pide la revisión subido, pasa sola; si no pasó, falta subir.
      return a(
        en ? `Upload ${v}’s documents` : `Sube los papeles de ${v}`,
        en
          ? 'Once the registration (and the policy, if requested) is uploaded, it goes to review on its own.'
          : `Cuando subas el registro (y la póliza, si te la pedimos), pasa ${fem ? 'sola' : 'solo'} a revisión.`,
        en ? 'Upload documents' : 'Subir los papeles',
        'vehiculo',
      );
    case 'vehiculo_en_revision':
      return a(
        en ? `We’re reviewing ${v}` : `Estamos revisando ${v}`,
        en
          ? 'You don’t need to do anything. We’ll let you know here as soon as it’s approved.'
          : `No tienes que hacer nada. Te avisamos aquí en cuanto ${lo} aprobemos.`,
        null,
        null,
      );
    case 'vehiculo_sin_activar':
      return a(
        en ? `Turn on ${v}` : `Activa ${v}`,
        en
          ? 'It’s registered but not in use. Turn it on to get trips with it.'
          : `Está registrad${o}, pero no ${lo} estás usando. Actíva${lo} para recibir carreras con ${fem ? 'ella' : 'él'}.`,
        en ? `Use ${v}` : `Usar ${v}`,
        'activar_vehiculo',
      );
    case 'papeles_sin_enviar':
      return a(
        en ? 'Send your documents for review' : 'Envía tus papeles a revisión',
        en
          ? 'You took all the photos. Send them so our team can review them.'
          : 'Ya tomaste todas las fotos. Envíalas para que nuestro equipo las revise.',
        en ? 'Send for review' : 'Enviar a revisión',
        'papeles',
      );
    case 'sin_restaurantes':
      // C-SERVICIO-SIN-OFERTA: lo único que podría hacer es Comida y su zona no tiene restaurantes.
      return a(
        en ? 'No restaurants in your area yet' : 'Todavía no hay restaurantes en tu zona',
        en
          ? 'We’ll let you know here when the first one opens. Meanwhile, no food orders can arrive.'
          : 'Te avisamos aquí cuando abra el primero. Mientras tanto no te pueden llegar pedidos de Comida.',
        null,
        null,
      );
    case 'servicio_no_disponible':
      return a(
        en ? 'No service open in your city yet' : 'Todavía no hay servicios abiertos en tu ciudad',
        en
          ? 'We’ll let you know here as soon as one opens.'
          : 'Te avisamos aquí en cuanto abramos uno.',
        null,
        null,
      );
    case 'sin_habilitacion':
      return a(
        en ? 'We’re reviewing your documents' : 'Estamos revisando tus papeles',
        en
          ? 'You don’t need to do anything. We’ll let you know here as soon as they’re approved.'
          : 'No tienes que hacer nada. Te avisamos aquí en cuanto los aprobemos.',
        null,
        null,
      );
    case 'sin_servicio_encendido':
      return a(
        en ? 'Turn on a service' : 'Enciende un servicio',
        en
          ? 'You’re online but no service is on, so no trips arrive.'
          : 'Estás conectado, pero ningún servicio está encendido: así no te llegan carreras.',
        en ? 'Turn on my services' : 'Encender mis servicios',
        'encender',
      );
    case 'sin_saldo':
      return a(
        en ? 'Add balance for the commission' : 'Recarga saldo para la comisión',
        en
          ? 'Your balance doesn’t cover the commission of a trip, so no trips arrive.'
          : 'Tu saldo no alcanza para la comisión de una carrera: así no te llegan.',
        en ? 'Add balance' : 'Recargar saldo',
        'recargar',
      );
    case 'sin_pago_movil':
      return a(
        en ? 'Add your mobile payment account' : 'Agrega tu cuenta de pago móvil',
        en
          ? 'Trips paid by mobile payment only go to drivers who have it.'
          : 'Las carreras que se pagan por pago móvil solo van a quien la tiene cargada.',
        en ? 'Add my account' : 'Agregar mi cuenta',
        'pago_movil',
      );
    case 'ubicacion_vieja':
      return a(
        en ? 'Your location isn’t updating' : 'Tu ubicación no se está actualizando',
        en
          ? 'Check that location (GPS) is on and that you have signal.'
          : 'Revisa que la ubicación (GPS) esté encendida y que tengas señal.',
        en ? 'Check my location' : 'Revisar mi ubicación',
        'ubicacion',
      );
    default:
      // «desconectado» lo dice la barra de conectarse, justo debajo; lo desconocido no se inventa.
      return null;
  }
}

/** Una cosa a la vez, por orden de importancia: la primera que se puede decir. */
export function primeraFalta(
  faltas: readonly FaltaServidor[] | null | undefined,
  idioma: Idioma,
): { aviso: AvisoFalta; falta: FaltaServidor; despues: number } | null {
  const lista = (faltas ?? [])
    .map((f) => ({ f, aviso: avisoDeFalta(f, idioma) }))
    .filter((x): x is { f: FaltaServidor; aviso: AvisoFalta } => x.aviso !== null);
  const p = lista[0];
  return p ? { aviso: p.aviso, falta: p.f, despues: lista.length - 1 } : null;
}

/** Un vehículo ya guardado, como lo devuelve `GET /datos/conductor/vehiculos`. */
export type VehiculoEditable = {
  id: string;
  tipo: string;
  marca: string;
  modelo: string;
  anio: number | null;
  color: string;
  placa: string;
  placaEstado?: string;
  plazas: number | null;
  estado: string;
};

const CON_MOTOR = new Set(['carro', 'moto', 'scooter']);

/** ¿Le falta la placa? (con motor, sin placa; o sin el estado, donde la placa no es nacional). */
export function faltaPlaca(v: VehiculoEditable, placaNacional: boolean): boolean {
  return CON_MOTOR.has(v.tipo) && (!v.placa || (!placaNacional && !v.placaEstado));
}
