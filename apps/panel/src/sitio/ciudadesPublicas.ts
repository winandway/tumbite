import { type Idioma, enIdioma, perfilPasajeros } from '@tumbite/compartido';
import { CIUDADES, type Lugar, PAISES } from './cobertura';
import {
  CIUDADES_ABIERTAS_PUBLICADAS,
  type EstadoCiudad,
  type ServicioAbierto,
  estadoDeCiudad,
  fraseServicios,
  listaHumana,
} from './paisesAbiertos';
import {
  TARIFAS_PUBLICADAS,
  type TarifasPublicas,
  hora,
  lugaresDe,
  monto,
  nombreCentro,
  porcentaje,
  rangoDe,
} from './tarifasCiudades';

/**
 * C-CIUDAD-ABIERTA-SIN-PRONTO (25 nov 2026, orden de Richard: que Google y los buscadores de IA digan
 * que Divoox YA está en Venezuela) — Venezuela y cualquier país con ciudades con `clave`.
 *
 * Los textos de las páginas de ciudad, de la página del país y de la de tarifas, y sus preguntas
 * frecuentes (las mismas van a la pantalla y a los datos estructurados FAQPage del HTML prearmado).
 *
 * Regla de honestidad: una ciudad abierta dice claro que ya funciona y con qué; una sin servicio
 * abierto NO afirma que haya viajes hoy, y tampoco dice «muy pronto» ni «ya disponible»: dice qué es
 * Divoox, cómo se pide, cómo registrarse como conductor y dónde funciona hoy.
 */
export const TEXTOS_CIUDAD = {
  es: {
    etiquetaAbierta: 'Ya funciona',
    tituloAbierta: 'Divoox en {ciudad}: ya funciona',
    tituloCerrada: 'Divoox en {ciudad}',
    entradaAbierta:
      'En {ciudad} ya puedes pedir {servicios} con Divoox. Ves el precio antes de pedir, sigues a tu conductor en el mapa y pagas {pagos}.',
    entradaCerrada:
      'Divoox es la app para pedir viajes en moto y en carro, comida a domicilio y envíos, y para ganar dinero como conductor. Aquí tienes cómo se pide, cómo se paga y cómo registrarte como conductor en {ciudad}.',
    dondeHoy: 'Hoy Divoox funciona en',
    dondeHoyFin: 'La app te dice si llega a tu zona antes de pedir.',
    comoPedir: 'Cómo se pide un viaje',
    pasosPedir: [
      'Descarga Divoox y crea tu cuenta con tu número de celular.',
      'Escribe a dónde vas: la app te dice si hay servicio en tu zona y te muestra el precio antes de pedir.',
      'Elige cómo pagas ({pagos}) y pide tu viaje.',
      'Sigue a tu conductor en el mapa hasta que llegue por ti.',
    ],
    manejar: 'Maneja con Divoox y gana dinero',
    manejarTexto:
      'Regístrate en Divoox Driver con tu celular, sube tu licencia y los datos de tu moto o de tu carro, y el equipo revisa tus papeles. Necesitas tener {edad} años o más. Con tu cuenta aprobada te conectas cuando quieras y ves cuánto ganas antes de aceptar cada viaje.',
    descargar: 'Descarga la app',
    descargarDriver: 'Descarga Divoox Driver',
    verTarifas: 'Tarifas de mototaxi en {ciudad} →',
    desdeOtra: 'De {desde} a {ciudad} en moto: {precio} (precio fijo de día).',
    datos: 'Datos de {ciudad}',
    estadoRegion: 'Estado',
    pais: 'País',
    otras: 'Más ciudades de {pais}',
    ciudadesPais: 'Divoox en las ciudades de {pais}',
    ciudadesAbiertas: 'Ya funciona en',
    ciudadesMas: 'Más ciudades',
    preguntas: 'Preguntas frecuentes',
  },
  en: {
    etiquetaAbierta: 'Now live',
    tituloAbierta: 'Divoox in {ciudad}: now live',
    tituloCerrada: 'Divoox in {ciudad}',
    entradaAbierta:
      'In {ciudad} you can already request {servicios} with Divoox. You see the price before you request, follow your driver on the map, and pay {pagos}.',
    entradaCerrada:
      'Divoox is the app to request motorbike and car rides, food delivery and package delivery, and to make money as a driver. Here is how to request a ride, how to pay, and how to sign up to drive in {ciudad}.',
    dondeHoy: 'Today Divoox runs in',
    dondeHoyFin: 'The app tells you whether it covers your area before you request.',
    comoPedir: 'How to request a ride',
    pasosPedir: [
      'Download Divoox and create your account with your phone number.',
      'Enter where you are going: the app tells you whether your area is covered and shows the price before you request.',
      'Choose how you pay ({pagos}) and request your ride.',
      'Follow your driver on the map until they pick you up.',
    ],
    manejar: 'Drive with Divoox and make money',
    manejarTexto:
      'Sign up in Divoox Driver with your phone, upload your license and your motorbike or car details, and the team reviews your documents. You must be {edad} or older. Once your account is approved, you go online whenever you want and see what you earn before accepting each ride.',
    descargar: 'Download the app',
    descargarDriver: 'Download Divoox Driver',
    verTarifas: 'Moto taxi fares in {ciudad} →',
    desdeOtra: 'From {desde} to {ciudad} by motorbike: {precio} (daytime fixed price).',
    datos: '{ciudad} at a glance',
    estadoRegion: 'State',
    pais: 'Country',
    otras: 'More cities in {pais}',
    ciudadesPais: 'Divoox in the cities of {pais}',
    ciudadesAbiertas: 'Now live in',
    ciudadesMas: 'More cities',
    preguntas: 'Frequently asked questions',
  },
};

export const TEXTOS_TARIFAS = {
  es: {
    titulo: 'Tarifas de mototaxi en {ciudad}',
    etiqueta: 'Precios fijos',
    entrada:
      'Lo que cuesta un mototaxi de Divoox desde {centro}, por vía, de día y de noche. Son los mismos precios que cobra la app: lo que ves aquí es lo que paga el pasajero.',
    comoFunciona: 'Cómo se cobra',
    reglas: [
      'Es lo más que pagas por ese trayecto: si el precio por distancia sale más barato, la app te cobra el más barato.',
      'Ves el precio exacto antes de pedir y no cambia durante el viaje.',
      'Pagas {pagos}, directo al conductor.',
    ],
    noche:
      'De noche, de {desde} a {hasta} (hora de {ciudad}), el viaje sube {porcentaje}: la columna «De noche» ya lo incluye.',
    minimo: 'Un viaje a un lugar que no está en la lista se cobra por distancia, desde {minimo}.',
    lugar: 'Destino',
    dia: 'De día',
    nocheCol: 'De noche',
    regreso: 'Regreso',
    mismoRegreso: 'igual de regreso',
    regresoA: 'de regreso: {precio}',
    idaVuelta: 'ida y vuelta: {precio}',
    otros: 'Otros trayectos',
    actualizado: 'Precios al {fecha}.',
    sinPrecios:
      'Hoy no hay precios fijos publicados en {ciudad}. La app te muestra el precio exacto antes de pedir.',
    descargar: 'Pide tu mototaxi en la app',
    volverCiudad: '← Divoox en {ciudad}',
    guia: 'Cómo funciona el precio de la zona (Docs) →',
  },
  en: {
    titulo: 'Moto taxi fares in {ciudad}',
    etiqueta: 'Fixed prices',
    entrada:
      'What a Divoox moto taxi costs from {centro}, by road, by day and by night. These are the same prices the app charges: what you see here is what the rider pays.',
    comoFunciona: 'How you are charged',
    reglas: [
      'It is the most you pay for that trip: if the distance-based price comes out lower, the app charges the lower one.',
      'You see the exact price before you request, and it does not change during the ride.',
      'You pay {pagos}, straight to your driver.',
    ],
    noche:
      'At night, from {desde} to {hasta} ({ciudad} time), rides cost {porcentaje} more: the “At night” column already includes it.',
    minimo:
      'A ride to a place that is not on the list is priced by distance, starting at {minimo}.',
    lugar: 'Destination',
    dia: 'Daytime',
    nocheCol: 'At night',
    regreso: 'Return',
    mismoRegreso: 'same on the way back',
    regresoA: 'way back: {precio}',
    idaVuelta: 'round trip: {precio}',
    otros: 'Other trips',
    actualizado: 'Prices as of {fecha}.',
    sinPrecios:
      'There are no fixed prices posted in {ciudad} today. The app shows you the exact price before you request.',
    descargar: 'Request your moto taxi in the app',
    volverCiudad: '← Divoox in {ciudad}',
    guia: 'How local fixed prices work (Docs) →',
  },
};

const PAGOS = new Map<string, Record<Idioma, string>>(
  Object.entries({
    efectivo: { es: 'en efectivo', en: 'in cash' },
    pago_movil: { es: 'por pago móvil', en: 'by pago móvil bank transfer' },
    tarjeta: { es: 'con tarjeta', en: 'by card' },
    yape: { es: 'con Yape', en: 'with Yape' },
    plin: { es: 'con Plin', en: 'with Plin' },
  }),
);
/** «en efectivo o por pago móvil», de los medios de pago del país (perfil en código). */
export function pagosDe(codigoPais: string | undefined, idioma: Idioma): string {
  const xs = perfilPasajeros(codigoPais).metodosPago.map((m) => {
    const p = PAGOS.get(m);
    return p ? enIdioma(p, idioma) : m;
  });
  if (xs.length < 2) return xs.join('');
  return `${xs.slice(0, -1).join(', ')}${idioma === 'en' ? ' or ' : ' o '}${xs.at(-1) ?? ''}`;
}

export const paisDeCiudad = (c: Pick<Lugar, 'pais'>) => PAISES.find((p) => p.slug === c.pais);

/** Las ciudades con clave de un país, con su estado (las abiertas primero, en el orden de la lista). */
export function ciudadesConEstado(
  paisSlug: string,
  ciudades: Record<string, Record<string, ServicioAbierto[]>> = CIUDADES_ABIERTAS_PUBLICADAS,
): { ciudad: Lugar; estado: EstadoCiudad }[] {
  const codigo = PAISES.find((p) => p.slug === paisSlug)?.codigo;
  const xs = CIUDADES.filter((c) => c.pais === paisSlug && c.clave).map((c) => ({
    ciudad: c,
    estado: estadoDeCiudad(c, codigo, ciudades),
  }));
  return [...xs.filter((x) => x.estado.abierta), ...xs.filter((x) => !x.estado.abierta)];
}

const t$ = (s: string, v: Record<string, string>) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => new Map(Object.entries(v)).get(k) ?? m);

/** De qué ciudad tiene tarifas el país y el precio fijo desde ella a otra ciudad («Tucaní: 30 $»). */
export function precioDesdeOtra(
  ciudad: Lugar,
  tarifas: Record<string, TarifasPublicas> = TARIFAS_PUBLICADAS,
): { desde: Lugar; precio: number; t: TarifasPublicas } | null {
  const llano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  for (const [clave, t] of Object.entries(tarifas)) {
    if (clave === ciudad.clave) continue;
    const desde = CIUDADES.find((c) => c.clave === clave && c.pais === ciudad.pais);
    const l = lugaresDe(t).find((x) => llano(x.lugar) === llano(ciudad.nombre.es) && x.ida);
    if (desde && l?.ida) return { desde, precio: l.ida.dia, t };
  }
  return null;
}

/** La ciudad con página de tarifas de un país (la primera abierta que tenga precios). */
export function ciudadConTarifas(
  paisSlug: string,
  tarifas: Record<string, TarifasPublicas> = TARIFAS_PUBLICADAS,
): Lugar | null {
  return (
    CIUDADES.find((c) => c.pais === paisSlug && c.clave && tarifas[c.clave]?.grupos.length) ?? null
  );
}

type Pregunta = [string, string];

/**
 * Las preguntas frecuentes de la página de un país abierto (Venezuela): dónde funciona, cuánto cuesta,
 * cómo se paga (pago móvil y efectivo) y cómo ser conductor. Todo de los datos (estado, tarifas y el
 * perfil del país), para que nunca diga algo que no es.
 */
export function preguntasPais(
  pais: Lugar,
  idioma: Idioma,
  datos: {
    ciudades?: Record<string, Record<string, ServicioAbierto[]>>;
    tarifas?: Record<string, TarifasPublicas>;
  } = {},
): Pregunta[] {
  const nombre = enIdioma(pais.nombre, idioma);
  const perfil = perfilPasajeros(pais.codigo);
  const abiertas = ciudadesConEstado(pais.slug, datos.ciudades).filter((x) => x.estado.abierta);
  const servicios = [
    ...new Map(abiertas.flatMap((x) => x.estado.servicios).map((s) => [s.id, s])).values(),
  ];
  const nombres = listaHumana(
    abiertas.map((x) => enIdioma(x.ciudad.nombre, idioma)),
    idioma,
  );
  const conTarifas = ciudadConTarifas(pais.slug, datos.tarifas);
  const t = conTarifas?.clave ? (datos.tarifas ?? TARIFAS_PUBLICADAS)[conTarifas.clave] : null;
  const rango = t ? rangoDe(t) : null;
  const pagos = pagosDe(pais.codigo, idioma);
  const efectivo = perfil.metodosPago.includes('efectivo');
  const pagoMovil = perfil.metodosPago.includes('pago_movil');
  const es = idioma === 'es';
  const xs: Pregunta[] = [];
  if (abiertas.length)
    xs.push(
      es
        ? [
            `¿Divoox ya funciona en ${nombre}?`,
            `Sí. Divoox ya funciona en ${nombres} con ${fraseServicios(servicios, idioma)}. Descarga la app, crea tu cuenta con tu celular y pide: la app te dice si llega a tu zona y te muestra el precio antes de pedir.`,
          ]
        : [
            `Is Divoox already available in ${nombre}?`,
            `Yes. Divoox is live in ${nombres} with ${fraseServicios(servicios, idioma)}. Download the app, create your account with your phone, and request: the app tells you whether it covers your area and shows the price before you request.`,
          ],
    );
  if (t && rango && conTarifas)
    xs.push(
      es
        ? [
            `¿Cuánto cuesta un mototaxi de Divoox en ${conTarifas.nombre.es}?`,
            `Los viajes desde ${nombreCentro(t.centro ?? conTarifas.nombre.es, idioma)} tienen precio fijo: de día, desde ${monto(t, rango.menor, idioma)} las carreras cortas hasta ${monto(t, rango.mayor, idioma)} los viajes más largos${t.noche ? `, y de noche suben ${porcentaje(t.noche.recargoPb, idioma)}` : ''}. Si el precio por distancia sale más barato, la app cobra el más barato. La lista completa está en «Tarifas de mototaxi en ${conTarifas.nombre.es}».`,
          ]
        : [
            `How much is a Divoox moto taxi in ${conTarifas.nombre.en}?`,
            `Rides from ${nombreCentro(t.centro ?? conTarifas.nombre.en, idioma)} have fixed prices: by day, from ${monto(t, rango.menor, idioma)} for short rides in town up to ${monto(t, rango.mayor, idioma)} for the longest trips${t.noche ? `, and ${porcentaje(t.noche.recargoPb, idioma)} more at night` : ''}. If the distance-based price comes out lower, the app charges the lower one. The full list is on the moto taxi fares page.`,
          ],
    );
  if (pagoMovil)
    xs.push(
      es
        ? [
            '¿Puedo pagar con pago móvil?',
            'Sí. Eliges «Pago móvil» antes de pedir, le pagas al conductor desde tu banco con los datos que te muestra la app, y el conductor confirma que le llegó.',
          ]
        : [
            'Can I pay with pago móvil?',
            'Yes. Choose “Pago móvil” before you request, pay your driver from your bank with the details the app shows you, and your driver confirms it arrived.',
          ],
    );
  if (efectivo)
    xs.push(
      es
        ? [
            '¿Puedo pagar en efectivo?',
            `Sí. Eliges «Efectivo» antes de pedir y le pagas al conductor al llegar. En ${nombre} puedes pagar ${pagos}.`,
          ]
        : [
            'Can I pay in cash?',
            `Yes. Choose “Cash” before you request and pay your driver when you arrive. In ${nombre} you can pay ${pagos}.`,
          ],
    );
  xs.push(
    es
      ? [
          `¿Cómo me hago conductor de Divoox en ${nombre}?`,
          `Descarga Divoox Driver, crea tu cuenta con tu celular, sube tu licencia y los datos de tu moto o de tu carro, y el equipo revisa tus papeles. Necesitas tener ${perfil.edadMinima} años o más. Con tu cuenta aprobada te conectas cuando quieras y ves cuánto ganas antes de aceptar cada viaje.`,
        ]
      : [
          `How do I become a Divoox driver in ${nombre}?`,
          `Download Divoox Driver, create your account with your phone, upload your license and your motorbike or car details, and the team reviews your documents. You must be ${perfil.edadMinima} or older. Once your account is approved, you go online whenever you want and see what you earn before accepting each ride.`,
        ],
  );
  return xs;
}

/** Las preguntas frecuentes de la página de tarifas (de los mismos datos de la tabla). */
export function preguntasTarifas(ciudad: Lugar, t: TarifasPublicas, idioma: Idioma): Pregunta[] {
  const nombre = enIdioma(ciudad.nombre, idioma);
  const rango = rangoDe(t);
  const es = idioma === 'es';
  const pagos = pagosDe(paisDeCiudad(ciudad)?.codigo, idioma);
  const xs: Pregunta[] = [];
  if (rango)
    xs.push(
      es
        ? [
            `¿Cuánto cuesta un mototaxi en ${nombre}?`,
            `Con Divoox, de día, desde ${monto(t, rango.menor, idioma)} una carrera corta hasta ${monto(t, rango.mayor, idioma)} el viaje más largo de la lista, desde ${nombreCentro(t.centro ?? nombre, idioma)}. Es lo más que pagas: si el precio por distancia sale más barato, la app cobra el más barato.`,
          ]
        : [
            `How much is a moto taxi in ${nombre}?`,
            `With Divoox, by day, from ${monto(t, rango.menor, idioma)} for a short ride up to ${monto(t, rango.mayor, idioma)} for the longest trip on the list, from ${nombreCentro(t.centro ?? nombre, idioma)}. It is the most you pay: if the distance-based price comes out lower, the app charges the lower one.`,
          ],
    );
  if (t.noche)
    xs.push(
      es
        ? [
            '¿Cuánto más cuesta de noche?',
            `De ${hora(t.noche.desdeH, idioma)} a ${hora(t.noche.hastaH, idioma)}, hora de ${nombre}, el viaje sube ${porcentaje(t.noche.recargoPb, idioma)}. La app te lo muestra en la tarjeta del precio antes de pedir.`,
          ]
        : [
            'How much more is it at night?',
            `From ${hora(t.noche.desdeH, idioma)} to ${hora(t.noche.hastaH, idioma)}, ${nombre} time, rides cost ${porcentaje(t.noche.recargoPb, idioma)} more. The app shows it on the price card before you request.`,
          ],
    );
  xs.push(
    es
      ? [
          '¿Cómo se paga el mototaxi?',
          `Pagas ${pagos}, directo al conductor. Lo eliges antes de pedir.`,
        ]
      : [
          'How do I pay for the moto taxi?',
          `You pay ${pagos}, straight to your driver. You choose it before you request.`,
        ],
  );
  if (t.minimo)
    xs.push(
      es
        ? [
            '¿Y si mi destino no está en la lista?',
            `Se cobra por distancia, desde ${monto(t, t.minimo.dia, idioma)}. La app te muestra el precio exacto antes de pedir y no cambia durante el viaje.`,
          ]
        : [
            'What if my destination is not on the list?',
            `It is priced by distance, starting at ${monto(t, t.minimo.dia, idioma)}. The app shows you the exact price before you request, and it does not change during the ride.`,
          ],
    );
  return xs;
}

export const reemplazar = t$;
