import type { Idioma } from './idiomas';

/**
 * C-PERFIL-CONDUCTOR (20 nov 2026, todos los países): «Así te ven los pasajeros». El perfil del
 * conductor que ve el pasajero en su viaje (como la tarjeta de Uber y DiDi) y que el propio
 * conductor ve en Driver. Diseño aprobado: `progreso/borrador-registro` (función perfilConductor,
 * variante oscura).
 *
 * Esta es la ÚNICA pieza que decide qué se muestra. La usan el servidor, Driver y la app del
 * pasajero:
 * - Sin trayectoria (menos de MIN_CALIFICACIONES_PERFIL calificaciones o ningún viaje) sale
 *   «Nuevo en Divoox»: NUNCA ceros, «0 viajes» ni una calificación vacía.
 * - Lo opcional que falta (línea, idiomas, dato) no se le muestra al pasajero; al conductor sí, como
 *   invitación a agregarlo.
 * - Los sellos («Identidad verificada», «Vehículo verificado») solo salen al pasajero si de verdad
 *   lo están; al conductor le salen los dos, apagados si todavía no.
 * - Las cifras con el formato de cada idioma: 1.240 y 4,9 en español; 1,240 y 4.9 en inglés.
 */

/** Como Uber: el promedio se muestra desde 5 calificaciones; antes, «Nuevo». */
export const MIN_CALIFICACIONES_PERFIL = 5;
/** El dato corto que escribe el conductor para sus pasajeros. */
export const MAX_DATO_PERFIL = 120;
/** Los idiomas que puede marcar, en este orden (el de la pantalla). */
export const IDIOMAS_PERFIL = ['es', 'en', 'pt'] as const;
export type IdiomaPerfil = (typeof IDIOMAS_PERFIL)[number];

/** Viajes, calificación y desde cuándo está en Divoox. Solo existe con trayectoria. */
export type TrayectoriaConductor = {
  viajes: number;
  calificacion: number;
  /** Fecha de alta (texto de la base, «AAAA-MM-DD …»). */
  desde: string;
};

/** Lo que manda el servidor: lo público del conductor, sin apellido, teléfono, correo ni documento. */
export type PerfilConductorPublico = {
  nombre: string;
  vehiculo: { marca: string | null; modelo: string | null; color: string | null } | null;
  placa: string | null;
  /** null = «Nuevo en Divoox». */
  trayectoria: TrayectoriaConductor | null;
  identidadVerificada: boolean;
  vehiculoVerificado: boolean;
  /** Hay foto verificada (la miniatura de su selfie aprobada). */
  foto: boolean;
  linea: string | null;
  idiomas: IdiomaPerfil[];
  dato: string | null;
};

/**
 * Lo que se le puede decir al pasajero de la trayectoria, o null («Nuevo en Divoox»). Con pocas
 * calificaciones el promedio engaña (una sola de 5 daría «5,0»), por eso se espera al mínimo.
 */
export function trayectoriaPublica(
  viajes: number | null | undefined,
  promedio: number | null | undefined,
  calificaciones: number | null | undefined,
  desde: string | null | undefined,
): TrayectoriaConductor | null {
  const n = Math.floor(Number(viajes ?? 0));
  const p = Number(promedio);
  if (!desde || !(n > 0)) return null;
  if (promedio == null || !Number.isFinite(p) || p <= 0) return null;
  if (Number(calificaciones ?? 0) < MIN_CALIFICACIONES_PERFIL) return null;
  return { viajes: n, calificacion: Math.round(p * 10) / 10, desde };
}

/** Deja solo los idiomas conocidos, sin repetir y en el orden de la pantalla. */
export function idiomasValidos(lista: readonly unknown[] | null | undefined): IdiomaPerfil[] {
  const dados = new Set((lista ?? []).map((x) => String(x)));
  return IDIOMAS_PERFIL.filter((i) => dados.has(i));
}

/** Lee la columna guardada («es,en») sin romperse con basura. */
export function leerIdiomasGuardados(texto: string | null | undefined): IdiomaPerfil[] {
  return idiomasValidos((texto ?? '').split(','));
}

/** El dato limpio: sin espacios de sobra ni saltos de línea, recortado al máximo. */
export function limpiarDato(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_DATO_PERFIL);
}

const NOMBRE_IDIOMA = {
  es: new Map<IdiomaPerfil, string>([
    ['es', 'Español'],
    ['en', 'Inglés'],
    ['pt', 'Portugués'],
  ]),
  en: new Map<IdiomaPerfil, string>([
    ['es', 'Spanish'],
    ['en', 'English'],
    ['pt', 'Portuguese'],
  ]),
};

export function nombreIdiomaPerfil(codigo: IdiomaPerfil, idioma: Idioma): string {
  return (idioma === 'en' ? NOMBRE_IDIOMA.en : NOMBRE_IDIOMA.es).get(codigo) ?? codigo;
}

/**
 * «Español e inglés», «Español, inglés y portugués»; «Spanish and English». En español va «e» ante
 * una palabra que suena con «i» (inglés), como manda la gramática.
 */
export function listaIdiomas(codigos: readonly IdiomaPerfil[], idioma: Idioma): string {
  const nombres = idiomasValidos(codigos).map((c, i) => {
    const n = nombreIdiomaPerfil(c, idioma);
    return idioma === 'es' && i > 0 ? n.toLowerCase() : n;
  });
  if (nombres.length <= 1) return nombres.join('');
  const ultimo = nombres.at(-1) ?? '';
  const antes = nombres.slice(0, -1).join(', ');
  if (idioma === 'en') return `${antes} and ${ultimo}`;
  return `${antes} ${/^h?i/i.test(ultimo) ? 'e' : 'y'} ${ultimo}`;
}

/** 1.240 en español, 1,240 en inglés (sin depender de Intl, que no siempre trae los datos). */
export function numeroPerfil(n: number, idioma: Idioma): string {
  const sep = idioma === 'en' ? ',' : '.';
  let resto = String(Math.max(0, Math.floor(n)));
  const grupos: string[] = [];
  while (resto.length > 3) {
    grupos.unshift(resto.slice(-3));
    resto = resto.slice(0, -3);
  }
  grupos.unshift(resto);
  return grupos.join(sep);
}

/** 4,9 en español, 4.9 en inglés. Siempre con un decimal. */
export function calificacionPerfil(n: number, idioma: Idioma): string {
  const t = (Math.round(n * 10) / 10).toFixed(1);
  return idioma === 'en' ? t : t.replace('.', ',');
}

/** «2 años», «5 meses», «Menos de un mes». `ahora` se pasa en las pruebas. */
export function tiempoEnDivoox(desde: string, idioma: Idioma, ahora = new Date()): string {
  const d = new Date(`${desde.slice(0, 10)}T00:00:00Z`);
  const en = idioma === 'en';
  if (Number.isNaN(d.getTime())) return en ? 'Under a month' : 'Menos de un mes';
  let meses =
    (ahora.getUTCFullYear() - d.getUTCFullYear()) * 12 + (ahora.getUTCMonth() - d.getUTCMonth());
  if (ahora.getUTCDate() < d.getUTCDate()) meses -= 1;
  if (meses >= 12) {
    const a = Math.floor(meses / 12);
    return en ? `${a} ${a === 1 ? 'year' : 'years'}` : `${a} ${a === 1 ? 'año' : 'años'}`;
  }
  if (meses >= 1)
    return en
      ? `${meses} ${meses === 1 ? 'month' : 'months'}`
      : `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  return en ? 'Under a month' : 'Menos de un mes';
}

export const TEXTOS_PERFIL_CONDUCTOR = {
  es: {
    asiTeVen: 'Así te ven los pasajeros',
    tuConductor: 'Tu conductor',
    viajes: 'Viajes',
    calificacion: 'Calificación',
    enDivoox: 'En Divoox',
    nuevo: 'Nuevo en Divoox',
    nuevoPropio: 'Tus viajes y tu calificación aparecen aquí cuando empieces.',
    identidad: 'Identidad verificada',
    vehiculo: 'Vehículo verificado',
    linea: 'Línea',
    idiomas: 'Habla',
    dato: 'Un dato suyo',
    agrega: 'Sin agregar todavía',
    completar: 'Completar mi perfil',
    tuVehiculo: 'Tu vehículo',
    tuNombre: 'Tu nombre',
    // El formulario
    preguntaIdiomas: '¿Qué idiomas hablas?',
    ayudaIdiomas: 'Lo verá el pasajero en tu perfil. Puedes marcar varios.',
    preguntaDato: 'Cuéntale algo de ti a tus pasajeros',
    ayudaDato: 'Es opcional. Algo corto que te guste contar.',
    etiquetaDato: 'Un dato tuyo',
    ejemploDato: 'Algo que te guste contar',
    quedan: (n: number) => (n === 1 ? 'Queda 1 letra' : `Quedan ${n} letras`),
    guardar: 'Guardar mi perfil',
    guardado: 'Listo. Así te verán los pasajeros desde tu próximo viaje.',
    volver: 'Volver a mi perfil',
    privado:
      'Los pasajeros solo ven tu nombre de pila. Nunca tu apellido, tu teléfono ni tu correo.',
    cargando: 'Cargando tu perfil…',
    sinConexion: 'No pudimos cargar tu perfil. Revisa tu conexión y vuelve a intentarlo.',
    reintentar: 'Volver a intentar',
  },
  en: {
    asiTeVen: 'How riders see you',
    tuConductor: 'Your driver',
    viajes: 'Trips',
    calificacion: 'Rating',
    enDivoox: 'With Divoox',
    nuevo: 'New to Divoox',
    nuevoPropio: 'Your trips and rating show up here once you start.',
    identidad: 'Identity verified',
    vehiculo: 'Vehicle verified',
    linea: 'Fleet',
    idiomas: 'Speaks',
    dato: 'About them',
    agrega: 'Not added yet',
    completar: 'Complete my profile',
    tuVehiculo: 'Your vehicle',
    tuNombre: 'Your name',
    preguntaIdiomas: 'What languages do you speak?',
    ayudaIdiomas: 'Riders will see it on your profile. You can pick more than one.',
    preguntaDato: 'Tell riders something about you',
    ayudaDato: 'Optional. Something short you like to share.',
    etiquetaDato: 'About you',
    ejemploDato: 'Something you like to share',
    quedan: (n: number) => (n === 1 ? '1 character left' : `${n} characters left`),
    guardar: 'Save my profile',
    guardado: 'Done. Riders will see this starting with your next trip.',
    volver: 'Back to my profile',
    privado: 'Riders only see your first name. Never your last name, phone number or email.',
    cargando: 'Loading your profile…',
    sinConexion: 'We couldn’t load your profile. Check your connection and try again.',
    reintentar: 'Try again',
  },
};

export type FilaPerfil = {
  clave: 'linea' | 'idiomas' | 'dato';
  etiqueta: string;
  /** null = falta (solo llega así al propio conductor, como invitación). */
  valor: string | null;
};

export type VistaPerfilConductor = {
  nombre: string;
  vehiculo: string;
  placa: string | null;
  /** Las tres cifras, o null si es nuevo. */
  cifras: { valor: string; etiqueta: string }[] | null;
  /** «Nuevo en Divoox» (solo cuando no hay cifras). */
  nuevo: string | null;
  /** La línea de ayuda debajo de «Nuevo en Divoox» (solo para el propio conductor). */
  nuevoAyuda: string | null;
  sellos: { clave: 'identidad' | 'vehiculo'; texto: string; verificado: boolean }[];
  filas: FilaPerfil[];
  /** El aro verde de la foto: identidad verificada. */
  fotoVerificada: boolean;
  textoFalta: string;
};

/**
 * Convierte el perfil público en lo que se dibuja. `propio` = lo mira el mismo conductor en Driver
 * (ve las invitaciones a completar); si no, lo mira un pasajero (solo lo que existe y lo verificado).
 */
export function vistaPerfilConductor(
  p: PerfilConductorPublico,
  op: { idioma: Idioma; propio: boolean; ahora?: Date },
): VistaPerfilConductor {
  const { idioma, propio } = op;
  const t = TEXTOS_PERFIL_CONDUCTOR[idioma === 'en' ? 'en' : 'es'];
  const nombre = (p.nombre ?? '').trim().split(/\s+/)[0] || (propio ? t.tuNombre : '');
  const vehiculo =
    [p.vehiculo?.marca, p.vehiculo?.modelo, p.vehiculo?.color]
      .map((x) => (x ?? '').trim())
      .filter(Boolean)
      .join(' ') || (propio ? t.tuVehiculo : '');
  const tr = p.trayectoria;
  const cifras =
    tr && tr.viajes > 0 && tr.calificacion > 0
      ? [
          { valor: numeroPerfil(tr.viajes, idioma), etiqueta: t.viajes },
          { valor: `${calificacionPerfil(tr.calificacion, idioma)} ★`, etiqueta: t.calificacion },
          { valor: tiempoEnDivoox(tr.desde, idioma, op.ahora), etiqueta: t.enDivoox },
        ]
      : null;
  const sellos = [
    { clave: 'identidad' as const, texto: t.identidad, verificado: p.identidadVerificada },
    { clave: 'vehiculo' as const, texto: t.vehiculo, verificado: p.vehiculoVerificado },
  ].filter((s) => propio || s.verificado);
  const idiomas = listaIdiomas(p.idiomas ?? [], idioma);
  const dato = limpiarDato(p.dato);
  const filas: FilaPerfil[] = [
    { clave: 'linea' as const, etiqueta: t.linea, valor: (p.linea ?? '').trim() || null },
    { clave: 'idiomas' as const, etiqueta: t.idiomas, valor: idiomas || null },
    { clave: 'dato' as const, etiqueta: t.dato, valor: dato || null },
  ].filter((f) => f.valor != null || propio);
  return {
    nombre,
    vehiculo,
    placa: (p.placa ?? '').trim() || null,
    cifras,
    nuevo: cifras ? null : t.nuevo,
    nuevoAyuda: cifras || !propio ? null : t.nuevoPropio,
    sellos,
    filas,
    fotoVerificada: p.identidadVerificada,
    textoFalta: t.agrega,
  };
}
