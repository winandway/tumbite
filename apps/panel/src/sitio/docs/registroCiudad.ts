import type { Idioma } from '@tumbite/compartido';
import type { Captura, Guia, SeccionDocs } from './guias';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte C (25 nov 2026, Richard) — Venezuela y Estados Unidos. La guía
 * pública «Cómo registrarte desde cualquier ciudad» / «How to sign up from any city» (sección «Tu
 * cuenta»), en español e inglés: País → Estado → Ciudad, y qué pasa si en tu ciudad todavía no hay
 * viajes. Nunca lista dónde funciona Divoox (C-SIN-LISTA-DE-CIUDADES) ni nada técnico o interno.
 *
 * Entra en Docs cuando existen sus capturas REALES (regla del proyecto: ninguna guía sin capturas,
 * nunca maquetas). Salen de las pantallas de registro de la parte A al integrar:
 * `docs/capturas/registro-ciudad-<paso>-<es|en>.png` → `apps/panel/public/docs/registro-ciudad-<paso>-<es|en>.webp`.
 * Con las diez en su lugar, se pone REGISTRO_CIUDAD_PUBLICADA en true y se regenera el índice de
 * Camila (`node scripts/camila/generar-docs.mjs`).
 *
 * Qué va en cada captura (en español, una ciudad hispana; en inglés, una de Estados Unidos; nombres
 * neutros, correos de ejemplo y números 555; ninguna lista de ciudades «donde funciona»):
 * - `pais`: el paso «¿Dónde vives?» con la casilla País abierta.
 * - `estado`: la casilla Estado con la lista de estados del país elegido.
 * - `ciudad`: la casilla Ciudad con las sugerencias que salen al escribir las primeras letras.
 * - `en-espera`: la pantalla después de crear la cuenta en una ciudad sin viajes: «Tu cuenta quedó
 *   creada. En tu ciudad todavía no hay viajes; te avisamos apenas abramos.»
 * - `papeles`: Divoox Driver en espera: «Deja tu cuenta lista» con sus pasos y, debajo, «Aún no hay
 *   viajes en tu ciudad» (los textos de `apps/repartidor/src/piezas/esperaCiudadTextos.ts`).
 */
export const REGISTRO_CIUDAD_PUBLICADA = true;

export const PASOS_CAPTURA_REGISTRO_CIUDAD = [
  'pais',
  'estado',
  'ciudad',
  'en-espera',
  'papeles',
] as const;

const foto = (
  paso: (typeof PASOS_CAPTURA_REGISTRO_CIUDAD)[number],
  idioma: Idioma,
  alt: string,
  pie: string,
): Captura => ({ src: `/docs/registro-ciudad-${paso}-${idioma}.webp`, alt, pie });

export const GUIA_REGISTRO_CIUDAD: Record<Idioma, Guia> = {
  es: {
    id: 'sign-up-from-any-city',
    titulo: 'Cómo registrarte desde cualquier ciudad',
    resumen:
      'Te registras diciendo dónde vives: tu país, tu estado y tu ciudad. Tu cuenta se crea siempre, aunque en tu ciudad todavía no haya viajes, y te avisamos apenas abramos ahí.',
    explicacion: [
      'Al crear tu cuenta en Divoox Driver, en la app de Divoox o en la web, te preguntamos dónde vives. Eliges tu país, después tu estado y después tu ciudad o tu pueblo. Para encontrarla rápido, escribe las primeras letras: te sugerimos las ciudades de tu estado, aunque no pongas los acentos.',
      'Te preguntamos dónde vives, no dónde está Divoox. Encuentras tu ciudad aunque todavía no trabajemos ahí: está la lista completa de tu país.',
      'Si en tu ciudad ya hay viajes, quedas listo para empezar: sigues tu registro como siempre.',
      'Si en tu ciudad todavía no hay viajes, tu cuenta queda creada igual. La app te lo dice con claridad: «Tu cuenta quedó creada. En tu ciudad todavía no hay viajes; te avisamos apenas abramos.» No pierdes nada de lo que escribiste.',
      'Mientras tanto puedes entrar a tu cuenta y, si vas a conducir, dejarla lista. En el inicio de Divoox Driver lo ves como «Deja tu cuenta lista», con los pasos que te faltan: con tu foto y tus papeles al día, empiezas el mismo día que abramos en tu ciudad. Debajo dice «Aún no hay viajes en tu ciudad» y que te avisamos apenas abramos.',
      'Cuando abrimos en tu ciudad, tu cuenta pasa sola, sin que hagas nada, y te avisamos por correo y en la app con lo que te falta para empezar.',
      'Si te equivocaste de ciudad mientras esperas, toca «Cambiar» en «Tu ciudad», en el inicio de la app. Si ya trabajas con nosotros y te mudas, escríbenos desde la app a soporte y la cambiamos.',
    ],
    capturas: [
      foto(
        'pais',
        'es',
        'El paso «¿Dónde vives?» del registro con la casilla País abierta y la lista de países.',
        'Primero eliges tu país.',
      ),
      foto(
        'estado',
        'es',
        'La casilla Estado del registro con la lista de los estados del país elegido.',
        'Después, tu estado.',
      ),
      foto(
        'ciudad',
        'es',
        'La casilla Ciudad del registro con las primeras letras escritas y las ciudades sugeridas debajo.',
        'Escribe las primeras letras y elige tu ciudad.',
      ),
      foto(
        'en-espera',
        'es',
        'La pantalla después de crear la cuenta en una ciudad sin viajes: «Tu cuenta quedó creada. En tu ciudad todavía no hay viajes; te avisamos apenas abramos.»',
        'Tu cuenta queda creada aunque en tu ciudad todavía no haya viajes.',
      ),
      foto(
        'papeles',
        'es',
        'Divoox Driver con la cuenta en espera de su ciudad: «Deja tu cuenta lista» con el paso que falta y, debajo, «Aún no hay viajes en tu ciudad».',
        'Mientras esperas, dejas tu cuenta lista: empiezas el mismo día que abramos.',
      ),
    ],
    preguntas: [
      '¿Puedo registrarme si Divoox todavía no está en mi ciudad?',
      '¿Por qué me preguntan dónde vivo?',
      'No encuentro mi ciudad, ¿qué hago?',
      '¿Qué pasa con mi cuenta si en mi ciudad todavía no hay viajes?',
      '¿Cómo me entero cuando Divoox llegue a mi ciudad?',
    ],
    pasos: [
      'Abre Divoox Driver, la app de Divoox o la web y toca «Crea tu cuenta».',
      'En «¿Dónde vives?» elige tu país y tu estado.',
      'En «Ciudad» escribe las primeras letras de tu ciudad o tu pueblo y tócala en la lista.',
      'Termina tu registro. Si en tu ciudad todavía no hay viajes, tu cuenta queda creada igual y te avisamos apenas abramos.',
      'Si vas a conducir, entra a tu cuenta y déjala lista mientras esperas: tu foto, tu vehículo y tus papeles.',
    ],
    nota: 'Si no encuentras tu ciudad, prueba sin acentos o con el nombre del municipio, o elige la ciudad más cercana y escríbenos a soporte.',
  },
  en: {
    id: 'sign-up-from-any-city',
    titulo: 'How to sign up from any city',
    resumen:
      'You sign up by telling us where you live: your country, your state and your city. Your account is always created, even if there are no trips in your city yet, and we let you know as soon as we open there.',
    explicacion: [
      'When you create your account in Divoox Driver, in the Divoox app or on the website, we ask where you live. Pick your country, then your state, then your city or town. To find it fast, type the first letters: we suggest the cities in your state, even if you skip the accents.',
      'We ask where you live, not where Divoox is. You will find your city even if we don’t work there yet: the full list for your country is there.',
      'If there are already trips in your city, you are ready to go: keep signing up as usual.',
      'If there are no trips in your city yet, your account is still created. The app tells you clearly: “Your account was created. There are no trips in your city yet; we’ll let you know as soon as we open.” Nothing you typed is lost.',
      'In the meantime you can sign in and, if you are going to drive, get your account ready. On the Divoox Driver home screen you see it as “Get your account ready,” with the steps you have left: with your photo and documents up to date, you start the same day we open in your city. Below it says “No trips in your city yet” and that we’ll let you know as soon as we open.',
      'When we open in your city, your account moves in on its own, without you doing anything, and we let you know by email and in the app what you still need to start.',
      'If you picked the wrong city while you wait, tap “Change” under “Your city” on the app’s home screen. If you already work with us and you move, write to support from the app and we will change it.',
    ],
    capturas: [
      foto(
        'pais',
        'en',
        'The “Where do you live?” sign-up step with the Country box open and the list of countries.',
        'First, pick your country.',
      ),
      foto(
        'estado',
        'en',
        'The State box of the sign-up with the list of states of the chosen country.',
        'Then your state.',
      ),
      foto(
        'ciudad',
        'en',
        'The City box of the sign-up with the first letters typed and the suggested cities below.',
        'Type the first letters and pick your city.',
      ),
      foto(
        'en-espera',
        'en',
        'The screen after creating the account in a city with no trips yet: “Your account was created. There are no trips in your city yet; we’ll let you know as soon as we open.”',
        'Your account is created even if there are no trips in your city yet.',
      ),
      foto(
        'papeles',
        'en',
        'Divoox Driver with the account waiting for its city: “Get your account ready” with the step left and, below, “No trips in your city yet.”',
        'While you wait, you get your account ready: you start the same day we open.',
      ),
    ],
    preguntas: [
      'Can I sign up if Divoox isn’t in my city yet?',
      'Why do you ask where I live?',
      'I can’t find my city. What do I do?',
      'What happens to my account if there are no trips in my city yet?',
      'How will I know when Divoox comes to my city?',
    ],
    pasos: [
      'Open Divoox Driver, the Divoox app or the website and tap “Create your account.”',
      'In “Where do you live?” pick your country and your state.',
      'In “City,” type the first letters of your city or town and tap it in the list.',
      'Finish signing up. If there are no trips in your city yet, your account is still created and we let you know as soon as we open.',
      'If you are going to drive, sign in and get your account ready while you wait: your photo, your vehicle and your documents.',
    ],
    nota: 'If you can’t find your city, try without accents or with the county name, or pick the closest city and write to support.',
  },
};

/**
 * Las guías viejas que hablan del registro o de «todavía no llegamos a tu zona» ganan un párrafo
 * que remite a la nueva (solo cuando la nueva está publicada, para no enlazar a una guía oculta).
 */
const PARRAFOS: Record<Idioma, Readonly<Record<string, string>>> = {
  es: {
    'create-account':
      'Al registrarte también te preguntamos dónde vives: tu país, tu estado y tu ciudad. Tu cuenta se crea siempre, aunque en tu ciudad todavía no haya viajes. Lo explicamos en «Cómo registrarte desde cualquier ciudad».',
    'get-started':
      'Puedes registrarte como conductor desde cualquier ciudad de tu país. Si en la tuya todavía no hay viajes, tu cuenta queda creada, vas subiendo tus papeles y te avisamos apenas abramos. Lo explicamos en «Cómo registrarte desde cualquier ciudad».',
    'where-divoox-works':
      'Si ya creaste tu cuenta y dijiste dónde vives, no hace falta anotarte aparte: tu cuenta queda en espera de tu ciudad y te avisamos apenas abramos ahí.',
  },
  en: {
    'create-account':
      'When you sign up we also ask where you live: your country, your state and your city. Your account is always created, even if there are no trips in your city yet. We explain it in “How to sign up from any city.”',
    'get-started':
      'You can sign up as a driver from any city in your country. If there are no trips in yours yet, your account is created, you upload your documents and we let you know as soon as we open. We explain it in “How to sign up from any city.”',
    'where-divoox-works':
      'If you already created your account and said where you live, there is no need to sign up again: your account waits for your city and we let you know as soon as we open there.',
  },
};

/** En qué sección vive cada guía vieja que se toca (los ids se repiten entre secciones). */
const SECCION_DE: Readonly<Record<string, SeccionDocs['id']>> = {
  'create-account': 'account',
  'get-started': 'drivers',
  'where-divoox-works': 'ordering',
};

export function conRegistroCiudad(
  secciones: SeccionDocs[],
  idioma: Idioma,
  publicada = REGISTRO_CIUDAD_PUBLICADA,
): SeccionDocs[] {
  if (!publicada) return secciones;
  const parrafos = new Map(Object.entries(idioma === 'en' ? PARRAFOS.en : PARRAFOS.es));
  const nueva = idioma === 'en' ? GUIA_REGISTRO_CIUDAD.en : GUIA_REGISTRO_CIUDAD.es;
  const secDe = new Map(Object.entries(SECCION_DE));
  return secciones.map((s) => ({
    ...s,
    guias: [
      ...s.guias.map((g) => {
        const extra = secDe.get(g.id) === s.id ? parrafos.get(g.id) : undefined;
        return extra ? { ...g, explicacion: [...(g.explicacion ?? []), extra] } : g;
      }),
      ...(s.id === 'account' ? [nueva] : []),
    ],
  }));
}
