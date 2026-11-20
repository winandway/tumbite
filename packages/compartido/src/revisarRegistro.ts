import type { Idioma } from './idiomas';

/**
 * C-REVISA-TUS-DATOS (19 nov 2026, orden de Richard) — todos los países. Al crear la cuenta, nada se
 * manda solo: primero «Revisa tus datos», con el correo arriba y en grande, y la cuenta se crea solo
 * con el toque en «Crear mi cuenta». Esta es la lógica pura que comparten la web y las tres apps:
 * la validación de cada casilla (el error se dice al lado de la casilla) y la lista de datos que se
 * muestran para revisar. La contraseña nunca entra en esa lista.
 *
 * La sugerencia del dominio mal escrito (gmial.com → gmail.com) vive en `sugerirCorreo.ts`.
 */

/** Las casillas del registro que se validan y se revisan. */
export type CasillaRegistro =
  'nombre' | 'correo' | 'telefono' | 'fechaNacimiento' | 'invitacion' | 'clave';

export type DatosRegistroEscritos = {
  nombre: string;
  correo: string;
  telefono: string;
  clave: string;
  fechaNacimiento?: string;
  invitacion?: string;
};

export type FalloCasilla = { campo: CasillaRegistro; mensaje: string };

/** Una fila de «Revisa tus datos» (todo menos el correo, que va arriba y aparte). */
export type FilaRevision = { campo: CasillaRegistro; etiqueta: string; valor: string };

const ES = {
  titulo: 'Revisa tus datos',
  intro: 'Antes de crear tu cuenta, mira que todo esté bien escrito.',
  etiquetaCorreo: 'Tu correo',
  correoPregunta: '¿Está bien escrito? Aquí te mandamos el enlace para activar tu cuenta.',
  editar: 'Editar',
  crearMiCuenta: 'Crear mi cuenta',
  creando: 'Creando tu cuenta…',
  editarDatos: 'Editar datos',
  continuar: 'Continuar',
  etiquetas: {
    nombre: 'Nombre',
    telefono: 'Celular',
    fechaNacimiento: 'Cumpleaños',
    invitacion: 'Código de invitación',
  },
  errores: {
    correoVacio: 'Escribe tu correo.',
    correoEspacios: 'El correo no lleva espacios.',
    correoSinArroba: 'Al correo le falta la arroba (@).',
    correoDosArrobas: 'El correo lleva una sola arroba (@).',
    correoSinUsuario: 'Falta lo que va antes de la arroba.',
    correoSinDominio: 'Falta el dominio después de la arroba, por ejemplo gmail.com.',
    correoTerminacion: 'Revisa el final del correo, por ejemplo .com.',
    nombreVacio: 'Escribe tu nombre.',
    telefonoLetras: 'El celular lleva solo números.',
    telefonoCorto: 'Al celular le faltan números.',
    telefonoLargo: 'El celular tiene números de más.',
    claveCorta: 'La contraseña lleva al menos 8 caracteres.',
    invitacion: 'El código lleva solo letras y números.',
  },
  meses: [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
  ],
};

const EN: typeof ES = {
  titulo: 'Review your details',
  intro: 'Before we create your account, make sure everything is spelled right.',
  etiquetaCorreo: 'Your email',
  correoPregunta: 'Is it spelled right? We’ll send the link to activate your account here.',
  editar: 'Edit',
  crearMiCuenta: 'Create my account',
  creando: 'Creating your account…',
  editarDatos: 'Edit details',
  continuar: 'Continue',
  etiquetas: {
    nombre: 'Name',
    telefono: 'Mobile phone',
    fechaNacimiento: 'Birthday',
    invitacion: 'Invitation code',
  },
  errores: {
    correoVacio: 'Enter your email.',
    correoEspacios: 'An email can’t have spaces.',
    correoSinArroba: 'Your email is missing the @.',
    correoDosArrobas: 'An email has only one @.',
    correoSinUsuario: 'Add the part before the @.',
    correoSinDominio: 'Add the domain after the @, for example gmail.com.',
    correoTerminacion: 'Check the end of your email, for example .com.',
    nombreVacio: 'Enter your name.',
    telefonoLetras: 'Use numbers only.',
    telefonoCorto: 'Your phone number is missing digits.',
    telefonoLargo: 'Your phone number has too many digits.',
    claveCorta: 'Your password needs at least 8 characters.',
    invitacion: 'The code uses letters and numbers only.',
  },
  meses: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};

/** Los textos de «Revisa tus datos» en el idioma de la persona. */
export const textosRevisar = (idioma: Idioma) => (idioma === 'en' ? EN : ES);

/** El correo como se manda: sin espacios a los lados y en minúsculas. */
export const correoLimpio = (correo: string) => correo.trim().toLowerCase();

/** Por qué el correo no sirve todavía, en palabras; null si está bien formado. */
export function errorCorreo(correo: string, idioma: Idioma): string | null {
  const e = textosRevisar(idioma).errores;
  const limpio = correo.trim();
  if (!limpio) return e.correoVacio;
  if (/\s/.test(limpio)) return e.correoEspacios;
  const partes = limpio.split('@');
  if (partes.length === 1) return e.correoSinArroba;
  if (partes.length > 2) return e.correoDosArrobas;
  const [usuario = '', dominio = ''] = partes;
  if (!usuario) return e.correoSinUsuario;
  if (!dominio || !dominio.includes('.') || dominio.startsWith('.')) return e.correoSinDominio;
  if (dominio.includes('..') || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(dominio))
    return e.correoTerminacion;
  return null;
}

/**
 * Lo que queda en la casilla del celular mientras se escribe: solo números (y un «+» al principio,
 * para el código del país). Las letras, espacios y guiones no entran.
 */
export function soloNumerosTelefono(texto: string): string {
  const mas = texto.trimStart().startsWith('+') ? '+' : '';
  return mas + texto.replace(/\D/g, '');
}

/** El celular es opcional: vacío está bien; escrito, solo números y de 7 a 15 cifras. */
export function errorTelefono(telefono: string, idioma: Idioma): string | null {
  const e = textosRevisar(idioma).errores;
  const limpio = telefono.trim();
  if (!limpio) return null;
  if (!/^\+?\d+$/.test(limpio)) return e.telefonoLetras;
  const cifras = limpio.replace(/\D/g, '').length;
  if (cifras < 7) return e.telefonoCorto;
  if (cifras > 15) return e.telefonoLargo;
  return null;
}

/** Valida las casillas que esa pantalla muestra, en su orden. Vacío = todo bien. */
export function validarRegistro(
  datos: DatosRegistroEscritos,
  idioma: Idioma,
  casillas: readonly CasillaRegistro[],
): FalloCasilla[] {
  const e = textosRevisar(idioma).errores;
  const fallos: FalloCasilla[] = [];
  const fallo = (campo: CasillaRegistro, mensaje: string | null) => {
    if (mensaje) fallos.push({ campo, mensaje });
  };
  for (const campo of casillas) {
    if (campo === 'nombre') fallo(campo, datos.nombre.trim().length < 2 ? e.nombreVacio : null);
    else if (campo === 'correo') fallo(campo, errorCorreo(datos.correo, idioma));
    else if (campo === 'telefono') fallo(campo, errorTelefono(datos.telefono, idioma));
    else if (campo === 'clave') fallo(campo, datos.clave.length < 8 ? e.claveCorta : null);
    else if (campo === 'invitacion') {
      const codigo = (datos.invitacion ?? '').trim();
      fallo(campo, codigo && !/^[A-Z0-9-]{1,20}$/i.test(codigo) ? e.invitacion : null);
    }
    // La fecha la valida su propia casilla (CampoFecha): a medias queda vacía y no bloquea.
  }
  return fallos;
}

/** «AAAA-MM-DD» → «15 de marzo de 1990» / «March 15, 1990». Otra cosa: tal cual. */
export function fechaParaLeer(iso: string, idioma: Idioma): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const mes = textosRevisar(idioma).meses.at(Number(m[2]) - 1);
  if (!mes) return iso;
  const dia = Number(m[3]);
  return idioma === 'en' ? `${mes} ${dia}, ${m[1]}` : `${dia} de ${mes} de ${m[1]}`;
}

/**
 * Los datos que se muestran debajo del correo, más pequeños, cada uno con su «Editar». Solo los que
 * esa pantalla pide; los opcionales vacíos no salen. Nunca el correo (va arriba) ni la contraseña.
 */
export function filasParaRevisar(
  datos: DatosRegistroEscritos,
  idioma: Idioma,
  casillas: readonly CasillaRegistro[],
): FilaRevision[] {
  const t = textosRevisar(idioma).etiquetas;
  const filas: FilaRevision[] = [];
  for (const campo of casillas) {
    if (campo === 'nombre' && datos.nombre.trim())
      filas.push({ campo, etiqueta: t.nombre, valor: datos.nombre.trim() });
    else if (campo === 'telefono' && datos.telefono.trim())
      filas.push({ campo, etiqueta: t.telefono, valor: datos.telefono.trim() });
    else if (campo === 'fechaNacimiento' && datos.fechaNacimiento)
      filas.push({
        campo,
        etiqueta: t.fechaNacimiento,
        valor: fechaParaLeer(datos.fechaNacimiento, idioma),
      });
    else if (campo === 'invitacion' && datos.invitacion?.trim())
      filas.push({ campo, etiqueta: t.invitacion, valor: datos.invitacion.trim().toUpperCase() });
  }
  return filas;
}
