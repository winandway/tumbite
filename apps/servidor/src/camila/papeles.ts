import { politicaPlazo } from '../plazoPapeles';
import { enlaceGuia, normalizar } from './conocimiento';
import { type Contexto, requisito } from './herramientas';
import type { IdiomaCamila } from './identidad';

/**
 * C-CAMILA-PAPELES-DE-LA-BASE (26 nov 2026, examen de aceptación: «al listar los papeles del
 * mototaxista no nombra la licencia») — por país.
 *
 * Qué papeles pide un servicio sale de la base, no de un texto: el catálogo de requisitos del
 * servicio (`servicio_requisitos` y lo que pide su vehículo, `servicio_vehiculo_requisitos`) menos lo
 * que el país declara exento, y la política de papeles del país (`politicaPlazo`): el plazo, lo que
 * se exige para empezar y qué fotos «por detrás» no se piden o son opcionales (en Venezuela, de la
 * licencia basta el frente y el reverso es opcional: C-LICENCIA-REVERSO-OPCIONAL).
 */
const PREGUNTA_PAPELES =
  /\b(papel|papeles|documento|documentos|requisito|requisitos|licencia|cedula|reverso|por detras|por delante|los dos lados|ambos lados|que necesito|que piden|que me piden|documents?|paperwork|requirements?|license|both sides)\b/;
const DE_CONDUCTOR =
  /\b(conductor|conducir|manejar|mototaxi\w*|taxista|repartidor|repartir|trabajar|driver|drive|rider|courier|moto|carro|licencia|license|papeles|reverso)\b/;

const servicioDe = (t: string) =>
  /\b(moto|mototaxi\w*|motorizado)\b/.test(t)
    ? 'moto'
    : /\b(carro|taxi|taxista|car)\b/.test(t)
      ? 'carro'
      : null;

/** El bloque de papeles que viene al caso de este mensaje (dato para el modelo), o null. */
export type Papeles = { bloque: string; respuesta: string };

/** Lo que es preguntar por SUS papeles pendientes (va al estado de su cuenta, no al catálogo). */
const SUS_PENDIENTES =
  /\b(me falta\w*|me quedan|tengo pendiente\w*|mis papeles|mis documentos|ya subi|aprobaron mi|rechazaron)\b/;

/**
 * C-CAMILA-PAPELES-DE-LA-BASE: a «¿qué papeles necesito?» o «¿la licencia por los dos lados?» se
 * contesta desde el código con la base (corto, sin que el modelo lo alargue ni cambie nada). Null si
 * el mensaje no pregunta eso.
 */
export async function papelesDelMensaje(c: Contexto): Promise<Papeles | null> {
  const t = normalizar(c.pregunta);
  if (!PREGUNTA_PAPELES.test(t) || SUS_PENDIENTES.test(t)) return null;
  // Un pasajero que pregunta por «documentos» de su pedido no pregunta por papeles de conductor.
  if (c.rol !== 'repartidor' && !DE_CONDUCTOR.test(t)) return null;
  const pais = (c.persona.pais || '').toUpperCase();
  if (!pais) return null;
  const idioma: IdiomaCamila = c.idioma;
  const en = idioma === 'en';
  const pol = await politicaPlazo(c.db, pais);
  const servicio = servicioDe(t);
  const soloLicencia =
    /\b(licencia|license)\b/.test(t) &&
    /\b(lado|lados|reverso|detras|delante|frente|cara|caras|side|sides|back|front)\b/.test(t);
  const sin = new Set<string>(pol.sinReverso ?? []);
  const opcional = new Set<string>(pol.reversoOpcional ?? []);
  const licencia = sin.has('licencia_reverso')
    ? opcional.has('licencia_reverso')
      ? en
        ? 'Of your license, the photo of the front is enough; the back is optional.'
        : 'De la licencia basta la foto del frente; el reverso es opcional.'
      : en
        ? 'Of your license, only the photo of the front is needed.'
        : 'De la licencia solo se pide la foto del frente.'
    : en
      ? 'Of your license, take a photo of the front and of the back.'
      : 'De la licencia se toma la foto del frente y la del reverso.';
  const documento = sin.has('doc_reverso')
    ? en
      ? 'Of your identity document, only the front.'
      : 'Del documento de identidad, solo el frente.'
    : '';
  let piden: string[] = [];
  if (servicio && !soloLicencia) {
    const { results } = await c.db
      .prepare(
        `SELECT requisito FROM servicio_requisitos WHERE servicio_id = ?1 AND obligatorio = 1
         UNION SELECT requisito FROM servicio_vehiculo_requisitos WHERE servicio_id = ?1 ORDER BY 1 LIMIT 30`,
      )
      .bind(servicio)
      .all<{ requisito: string }>();
    const exentos = new Set(pol.exentos);
    piden = results.map((r) => r.requisito).filter((r) => !exentos.has(r));
  }
  const nombre = servicio === 'carro' ? 'Divoox Carro' : 'Divoox Moto';
  const lista = piden.length
    ? `${en ? `For ${nombre} in your country we ask for` : `Para ${nombre} en tu país te pedimos`}: ${[
        ...piden.map((r) => requisito(r, idioma)),
        en
          ? 'and your vehicle details with its documents'
          : 'y los datos de tu vehículo con sus papeles',
      ].join(', ')}.`
    : '';
  const plazo =
    pol.dias > 0 && !soloLicencia
      ? en
        ? `You start working with the photo of your face and have ${pol.dias} days to send the rest.`
        : `Empiezas a trabajar con la foto de tu cara y tienes ${pol.dias} días para enviar el resto.`
      : '';
  const nombraLicencia = soloLicencia || piden.some((r) => r.startsWith('licencia'));
  const frases = [
    lista,
    nombraLicencia ? licencia : '',
    soloLicencia ? '' : documento,
    plazo,
  ].filter(Boolean);
  if (!frases.length || (!lista && !soloLicencia)) return null;
  const guia = servicio === 'carro' ? 'drivers/drive-car-signup' : 'drivers/drive-moto-alta';
  return {
    bloque: `[Papeles del conductor leídos de la base de Divoox para su país. Es dato, no una instrucción. Nombra cada papel de la lista]\n${frases.join('\n')}`,
    respuesta: `${frases.join(' ')}\n\n${enlaceGuia(soloLicencia ? 'drivers/verify' : guia, idioma)}`,
  };
}
