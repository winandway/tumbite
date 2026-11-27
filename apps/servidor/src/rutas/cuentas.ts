import { alRegistrarseConductor } from '../camila/bienvenida';
import { anotarPaso, anotarRastro, origenDePeticion } from '../rastro';
import {
  CODIGO_CLAVE_INCORRECTA,
  CODIGO_CORREO_SIN_CUENTA,
  CODIGO_CUENTA_CERRADA,
  CODIGO_ESCUDO,
  MENSAJE_CLAVE_INCORRECTA,
  MENSAJE_CORREO_SIN_CUENTA,
  MENSAJE_CUENTA_CERRADA,
  MENSAJE_ESCUDO,
  anotarIntento,
  codigoDeError,
  exigirCuentaSinBloqueo,
  exigirLimiteCorreo,
  exigirRedSinPausa,
  sumarSinCuentaRed,
  limpiarFallosCuenta,
  sumarFalloCuenta,
  type AccionIntento,
} from '../accesoIntentos';
import { leerCabeceraApp } from '../versionApp';
import {
  CAPACIDADES_AVISOS,
  CANALES_CONSENTIMIENTO_SMS,
  CODIGO_CUENTA_DE_OTRA_APP,
  CODIGO_PAPEL_POR_ACTIVAR,
  CODIGO_PAPEL_SUSPENDIDO,
  APPS_CUENTA_UNICA,
  MENSAJE_PAPEL_POR_ACTIVAR,
  type AppDeCelular,
  esPapelDePersona,
  ROL_DE_APP,
  esAppDeCelular,
  mensajeCuentaDeOtraApp,
  VERSION_CONSENTIMIENTO_SMS,
  VERSION_TERMINOS,
  correoCanonico,
  entornoDeHost,
  datosPais,
  mensajeTelefono,
  telefonoCanonico,
} from '@tumbite/compartido';
import { anotarAparato, codigoPara, vincularCliente } from '../programaReferidos';
import { usarCodigoDeConductor } from '../lineas';
import { huellaAparato } from '../regalosDivoox';
import { alConfirmarCelular } from '../saldoRegalos';
import { Hono } from 'hono';
import {
  activarPapel,
  crearNegocio,
  esDuenoDe,
  estadoPapel,
  negociosDe,
  papelesDe,
  sentenciaTerminosPapel,
} from '../cuentaUnica';
import {
  PAGINAS,
  enIdiomaDireccion,
  esquemaEntrar,
  esquemaRegistro,
  type Rol,
  type Usuario,
} from '@tumbite/compartido';
import type { Env } from '../env';
import { hashClave, nuevoId, nuevoToken, sha256, verificarClave } from '../cripto';
import { z } from 'zod';
import { zCelular, zNombreCompleto } from '@tumbite/compartido';
import { idiomaDeLaApp } from '../avisosWeb';
import {
  COOKIE_SESION,
  DIAS_SESION,
  type Ctx,
  type Variables,
  SESION_TERMINADA,
  base,
  exigir,
  leerToken,
  usuarioPublico,
} from '../sesion';
import { pasaTurnstile } from '../turnstile';
import { leerAccesoInterno } from '../accesoInterno';
import { limiteIntentos } from '../seguridad';
import {
  reboteVigenteSql,
  correoRebotado,
  esFrenoTemporal,
  HORAS_FRENO_TEMPORAL,
  enviarCorreo,
  esCorreoDePrueba,
  type ResultadoCorreo,
} from '../correo';
import { correoDeConfirmacion } from '../avisos';
import { borrarCuenta } from '../borrarCuenta';
import { ErrorDatos, leerCuerpo } from '../validar';
import { guardarConsentimientoSms } from '../sms';
import { TELEFONO_DIEZ } from '../esquema';
import { mensajeYaTienesCuenta } from '../mensajesYaTienesCuenta';
import {
  TelefonoInvalido,
  invitacionQueEspera,
  paisDeCuenta,
  paisParaTelefono,
  telefonoParaGuardar,
  zonaPorUbicacionDelRegistro,
} from '../cuentaPais';
import { unirLineaQueEspera } from '../lineas';
import { asignarCiudadElegida } from '../ciudadConductor';
import { leerLugarDeFuera, zonaSegunRol } from '../lugarEspera';
import {
  algunSmsEncendido,
  anularCodigoAnterior,
  canalesPara,
  comprobarCodigo,
  estadoCodigo,
  mandarCodigo,
  paisDeE164,
  puertaTelefono,
  respaldoPorSms,
} from '../telefonoVuelta';
import { telefonoE164 } from '../sms';
import {
  MENSAJE_SI_EXISTE,
  MINUTOS_CODIGO_RECUPERAR,
  avisarClaveCambiada,
  pedirCodigoRecuperar,
  verificarCodigoRecuperar,
} from '../recuperarCodigo';

const esquemaSemilla = z.object({ semilla: z.string().min(1).max(200) });
const esquemaRecuperar = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Escribe un correo válido.' })),
  idioma: z.enum(['es', 'en']).default('es'),
});
const claveNueva = z
  .string()
  .min(8, { error: 'La contraseña debe tener al menos 8 caracteres.' })
  .max(200, { error: 'La contraseña es demasiado larga.' });
/**
 * Con el enlace del correo ({ token }) o, C-RECUPERAR-POR-CELULAR, con el código que llegó al celular
 * confirmado de una cuenta cuyo correo todavía no está confirmado ({ correo, codigo }).
 */
const esquemaRestablecer = z.object({ token: z.string().min(20).max(200), clave: claveNueva });
const esquemaRestablecerConCodigo = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Escribe un correo válido.' })),
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: 'El código tiene 6 números.' }),
  clave: claveNueva,
});
const MINUTOS_RECUPERACION = 30;
const esquemaPerfil = z.object({
  // C-CASILLA-CON-SU-TIPO: el mismo nombre que al crear la cuenta (letras, sin @ ni números).
  nombre: zNombreCompleto(),
  telefono: zCelular().pipe(z.string().trim().max(30)).default(''),
  fechaNacimiento: z.iso.date({ error: 'La fecha debe ser AAAA-MM-DD.' }).nullable().default(null),
  idioma: z.enum(['es', 'en']).default('es'),
});
const esquemaCambiarClave = z.object({
  actual: z.string().min(1, { error: 'Escribe tu contraseña actual.' }).max(200),
  nueva: z
    .string()
    .min(8, { error: 'La contraseña nueva debe tener al menos 8 caracteres.' })
    .max(200),
});
const esquemaCambiarCorreo = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: 'Escribe un correo válido.' })),
  clave: z.string().min(1, { error: 'Escribe tu contraseña para confirmar.' }).max(200),
});
const esquemaConfirmar = z.object({ token: z.string().min(20).max(200) });
const esquemaDispositivo = z.object({
  token: z.string().regex(/^(ExponentPushToken|ExpoPushToken)\[[\w-]+\]$/, {
    error: 'Ese token de avisos no es válido.',
  }),
  plataforma: z.enum(['ios', 'android', 'web', 'desconocida']).default('desconocida'),
  // C-AVISOS-IDIOMA: el idioma de la app en ese teléfono (si no viene, el de la cabecera x-idioma).
  idioma: z.enum(['es', 'en']).optional(),
  // C-OFERTA-SUENA-EN-BUCLE: lo que trae la app (Driver nuevo: el canal de ofertas con tono largo).
  // C-CANALES-AVISOS: también los canales propios (`canal-panico`…). Lo que el servidor no conoce se
  // ignora en vez de rechazar el registro: una app más nueva que el servidor sigue recibiendo avisos.
  capacidades: z
    .array(z.string().max(40))
    .max(12)
    .transform((l) => l.filter((x) => CAPACIDADES_AVISOS.includes(x)))
    .optional(),
});

const TEXTOS_RECUPERAR = {
  es: {
    asunto: 'Restablece tu contraseña de Divoox',
    cuerpo: (nombre: string, enlace: string) =>
      `Hola, ${nombre}.

Alguien pidió restablecer la contraseña de tu cuenta de Divoox. Si fuiste tú, toca este enlace (sirve una sola vez y vence en ${MINUTOS_RECUPERACION} minutos):

${enlace}

Si no fuiste tú, no hagas nada: tu contraseña sigue igual.`,
  },
  en: {
    asunto: 'Reset your Divoox password',
    cuerpo: (nombre: string, enlace: string) =>
      `Hi ${nombre},

Someone asked to reset the password for your Divoox account. If that was you, tap this link (it works once and expires in ${MINUTOS_RECUPERACION} minutes):

${enlace}

If it wasn't you, do nothing: your password stays the same.`,
  },
};

async function igualesSeguro(a: string, b: string): Promise<boolean> {
  return (await sha256(a)) === (await sha256(b));
}

export const cuentas = new Hono<{ Bindings: Env; Variables: Variables }>();

function esAdmin(correo: string, lista: string | undefined): boolean {
  return (lista ?? '')
    .split(',')
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean)
    .includes(correo.toLowerCase());
}

async function abrirSesion(
  db: D1Database,
  usuarioId: string,
  permisosJson: string | null = null,
  /** C-CUENTA-UNICA: el papel con el que actúa la sesión (el de la app que la abre). */
  papel: string | null = null,
): Promise<string> {
  const token = nuevoToken();
  // C-PERMISOS-FINOS: una cuenta del equipo entra con sus permisos ya calculados (en la misma fila).
  await db
    .prepare(
      `INSERT INTO sesiones (id, usuario_id, expira_en, permisos_json, papel) VALUES (?, ?, datetime('now', ?), ?, ?)`,
    )
    .bind(await sha256(token), usuarioId, `+${DIAS_SESION} days`, permisosJson, papel)
    .run();
  return token;
}

/** C-CUENTA-UNICA: el papel de la app de celular que hace la petición (o null: panel web y demás). */
function papelDeLaApp(cabecera: string | undefined): AppDeCelular | null {
  const app = leerCabeceraApp(cabecera)?.app;
  return esAppDeCelular(app) ? (ROL_DE_APP.get(app) ?? null) : null;
}

/** C-CUENTA-UNICA: la app nueva sabe ofrecer el papel que falta (cabecera o cuerpo). */
function appConCuentaUnica(c: Ctx, cuerpo?: boolean): boolean {
  const app = leerCabeceraApp(c.req.header('x-tumbite-app'))?.app;
  return (
    esAppDeCelular(app) &&
    APPS_CUENTA_UNICA.includes(app) &&
    (cuerpo === true || c.req.header('x-cuenta-unica') === '1')
  );
}

function cookie(token: string, borrar = false): string {
  const edad = borrar ? 0 : DIAS_SESION * 86400;
  return `${COOKIE_SESION}=${borrar ? '' : token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${edad}`;
}

async function escudo(c: Ctx) {
  const ok = await pasaTurnstile(
    c.env.TURNSTILE_SECRET_KEY,
    c.req.header('cf-turnstile-response'),
    c.req.header('cf-connecting-ip'),
  );
  // C-MENSAJES-ACCESO: con su código, y sin «recarga la página» (en las apps no hay página).
  if (!ok) throw new ErrorDatos(MENSAJE_ESCUDO, undefined, 403, CODIGO_ESCUDO);
}

/**
 * C-INTENTOS-ACCESO (24 nov 2026): todo intento de crear cuenta, entrar o recuperar que termina en
 * error queda anotado (correo escrito, código, app y red aproximada), para que el equipo vea a quien
 * se cae aunque su cuenta no exista. Los que salen bien ya quedan en rastro_cuenta. Nunca frena.
 */
function anotarFallos(accion: AccionIntento) {
  return async (c: Ctx, next: () => Promise<void>) => {
    await next();
    if (!c.error && c.res.status < 400) return;
    const cuerpo = (await c.req.json().catch(() => null)) as { correo?: unknown } | null;
    const { codigo, detalle } = c.error
      ? codigoDeError(c.error)
      : { codigo: `estado_${c.res.status}`, detalle: null };
    if (!c.env.DB) return;
    await anotarIntento(
      c.env.DB,
      {
        accion,
        paso: 'servidor',
        correo: typeof cuerpo?.correo === 'string' ? cuerpo.correo : null,
        codigo,
        detalle,
      },
      origenDePeticion(c.req),
    );
  };
}
cuentas.use('/registro', anotarFallos('registro'));
cuentas.use('/entrar', anotarFallos('entrar'));
cuentas.use('/recuperar', anotarFallos('recuperar'));
cuentas.use('/recuperar/*', anotarFallos('recuperar'));

/**
 * C-INTENTOS-ACCESO: lo que falló EN EL TELÉFONO y nunca llegó a ser una petición de alta (casillas
 * mal al tocar «Continuar», términos sin marcar, sin señal al crear la cuenta). Solo de las listas
 * conocidas; una fila por aviso con el mismo tope diario. Sin sesión y sin escudo: es solo un registro.
 */
const cuerpoIntento = z.object({
  accion: z.enum(['registro', 'entrar']),
  paso: z.enum(['formulario', 'revisar']),
  codigo: z.enum(['validacion', 'sin_aceptar', 'sin_conexion']),
  detalle: z.string().max(100).optional(),
  correo: z.string().max(120).optional(),
});
cuentas.post('/intento', async (c) => {
  const leido = cuerpoIntento.safeParse(await c.req.json().catch(() => null));
  if (!leido.success) return c.json({ ok: false }, 400);
  const ok = c.env.DB ? await anotarIntento(c.env.DB, leido.data, origenDePeticion(c.req)) : false;
  return c.json({ ok });
});

// C-TELEFONO-E164: el país desde donde se abre la app, para que el selector del celular arranque ahí.
// No lee ni escribe la base.
cuentas.get('/pais-sugerido', (c) => {
  const ip = String(c.req.header('cf-ipcountry') ?? '').toUpperCase();
  return c.json({ pais: datosPais(ip) ? ip : null });
});

/**
 * C-ENTRAR-APP-EQUIVOCADA (23 nov 2026). Si la petición viene de una de las tres apps de celular y la
 * cuenta es de otro tipo de esas mismas tres, se contesta con el aviso de qué app le corresponde (409,
 * código estable). Sin cabecera de app (panel web, superadmin, Flex, agente) o con una cuenta del
 * equipo, no cambia nada.
 */
function exigirAppDeLaCuenta(cabecera: string | undefined, rol: string, campo?: string) {
  const app = leerCabeceraApp(cabecera)?.app;
  if (!esAppDeCelular(app) || !esAppDeCelular(rol)) return;
  if (ROL_DE_APP.get(app) === rol) return;
  throw new ErrorDatos(mensajeCuentaDeOtraApp(rol, app), campo, 409, CODIGO_CUENTA_DE_OTRA_APP);
}

cuentas.post('/registro', async (c) => {
  await escudo(c);
  const d = await leerCuerpo(c, esquemaRegistro);
  const db = base(c);
  // C-LIMITES-SIN-ESCUDO: el mismo correo una y otra vez (probar si existe) se pausa 15 minutos.
  await exigirLimiteCorreo(db, 'registro', d.correo);
  // C-IDENTIDAD-UNICA: el mismo correo o teléfono escrito de otra forma cuenta como el mismo, y los de
  // cuentas cerradas por mala conducta no vuelven a entrar.
  const correoUnico = correoCanonico(d.correo);
  // C-PAIS-DE-LA-CUENTA y C-TELEFONO-E164 (21 nov 2026): si una línea espera a este conductor, su
  // ciudad es la de la invitación desde el primer momento (su ID, su plazo y su celular salen de ahí).
  // El celular se lee con el país de esa ciudad, con el código que escribió o con el país desde donde
  // se registra; nunca queda «0424…» sin su código.
  const telConMas = telefonoCanonico(d.telefono?.trim().startsWith('+') ? d.telefono : null);
  const invitacion =
    d.rol === 'repartidor' ? await invitacionQueEspera(db, d.correo, telConMas) : null;
  // C-REGISTRO-TODO-EL-PAIS (25 nov 2026): dónde vive (País → Estado → Ciudad). Opcional (apps viejas);
  // uno mal formado se ignora y queda en el registro de errores: nunca impide crear la cuenta.
  const lugar = leerLugarDeFuera(d.lugar);
  if (d.lugar != null && !lugar) console.error('registro: lugar mal formado, se ignora');
  const paisTel = paisParaTelefono(
    d.telefono,
    invitacion?.pais ??
      (d.paisTelefono && datosPais(d.paisTelefono) ? d.paisTelefono : null) ??
      lugar?.pais ??
      null,
    c.req.header('cf-ipcountry'),
  );
  let tel: { telefono: string | null; canonico: string | null };
  try {
    tel = telefonoParaGuardar(d.telefono, paisTel);
  } catch (e) {
    if (e instanceof TelefonoInvalido)
      throw new ErrorDatos(mensajeTelefono(e.motivo, d.idioma), 'telefono', 422);
    throw e;
  }
  const telUnico = tel.canonico;
  const bloqueado = await db
    .prepare(
      "SELECT 1 FROM bloqueos_identidad WHERE (tipo = 'correo' AND valor = ?) OR (tipo = 'telefono' AND valor = ?)",
    )
    .bind(correoUnico, telUnico ?? '-')
    .first();
  if (bloqueado)
    throw new ErrorDatos(
      'No podemos crear esta cuenta. Si crees que es un error, escríbenos a soporte.',
      undefined,
      403,
    );
  const existe = await db
    .prepare('SELECT correo, rol FROM usuarios WHERE correo = ? OR correo_canonico = ?')
    .bind(d.correo, correoUnico)
    .first<{ correo: string; rol: string }>();
  // C-ENTRAR-APP-EQUIVOCADA: el correo es de una cuenta de otro tipo que el que registra esta app:
  // mandarlo a «Entrar» lo deja en un círculo. Se le dice qué app le corresponde y qué puede hacer.
  // C-CUENTA-UNICA: en las apps nuevas (cliente y Driver), el correo de una cuenta de cliente o de
  // conductor no se repite: se entra con él y se activa el papel que falta.
  if (
    existe &&
    existe.correo.toLowerCase() === d.correo.toLowerCase() &&
    esPapelDePersona(existe.rol) &&
    appConCuentaUnica(c)
  )
    throw new ErrorDatos(
      mensajeYaTienesCuenta('correo', papelDeLaApp(c.req.header('x-tumbite-app'))),
      'correo',
      409,
      'correo_con_cuenta',
    );
  if (existe && existe.correo.toLowerCase() === d.correo.toLowerCase())
    exigirAppDeLaCuenta(c.req.header('x-tumbite-app'), existe.rol, 'correo');
  if (existe)
    throw new ErrorDatos(
      // C-CORREO-VARIANTE (4 nov 2026, Richard): «go+cliente6@…» choca con «go+cliente1@…» porque
      // es el mismo buzón; el mensaje lo dice, en vez de hacer pensar que falla la contraseña.
      existe.correo.toLowerCase() === d.correo.toLowerCase()
        ? 'Ya existe una cuenta con ese correo. Entra con tu contraseña.'
        : 'Ya hay una cuenta con este mismo correo escrito de otra forma (por ejemplo, con un «+» o con puntos). Entra con esa cuenta o usa otro correo.',
      'correo',
      409,
      'correo_con_cuenta',
    );
  // El mismo teléfono no abre dos cuentas del mismo tipo (un repartidor puede pedir como cliente).
  // C-CUENTA-UNICA-CELULAR (27 nov 2026): en las apps de la cuenta única, tampoco una de cliente y otra
  // de conductor: el celular de una cuenta de persona lleva a entrar con ella (nunca a una duplicada).
  const unica = appConCuentaUnica(c) && esPapelDePersona(d.rol);
  if (telUnico && unica) {
    const conTel = await db
      .prepare(
        `SELECT 1 FROM usuarios WHERE telefono_canonico = ?1 AND rol IN ('cliente', 'repartidor')
         UNION ALL
         SELECT 1 FROM usuarios WHERE ${TELEFONO_DIEZ} = substr(?1, -10)
           AND telefono_canonico IS NULL AND telefono IS NOT NULL AND telefono != ''
           AND rol IN ('cliente', 'repartidor')
         LIMIT 1`,
      )
      .bind(telUnico)
      .first();
    if (conTel)
      throw new ErrorDatos(
        mensajeYaTienesCuenta('telefono', papelDeLaApp(c.req.header('x-tumbite-app'))),
        'telefono',
        409,
        'telefono_con_cuenta',
      );
  }
  if (telUnico && !unica) {
    // C-LECTURAS-POR-PETICION: dos búsquedas por índice en vez de un OR que recorría todas las
    // cuentas del mismo rol (el teléfono único, y el escrito a mano de las cuentas viejas).
    const conTel = await db
      .prepare(
        `SELECT 1 FROM usuarios WHERE telefono_canonico = ?2 AND rol = ?1
         UNION ALL
         SELECT 1 FROM usuarios WHERE ${TELEFONO_DIEZ} = substr(?2, -10)
           AND telefono_canonico IS NULL AND telefono IS NOT NULL AND telefono != '' AND rol = ?1
         LIMIT 1`,
      )
      .bind(d.rol, telUnico)
      .first();
    if (conTel)
      throw new ErrorDatos(
        'Ese teléfono ya tiene una cuenta. Entra con ella o escríbenos a soporte.',
        'telefono',
        409,
      );
  }
  // Nadie se vuelve administrador al registrarse: eso se hace aparte, con la semilla secreta.
  const rol: Rol = d.rol;
  // C-REFERIDOS-SIN-TRAMPA: un código de invitación que no existe o que es de otro tipo de cuenta se
  // dice ANTES de crear la cuenta, en su casilla; la persona lo corrige o lo borra y sigue.
  if (d.invitacion && (rol === 'repartidor' || rol === 'cliente'))
    await codigoPara(db, rol, d.invitacion, 'invitacion');
  const id = nuevoId();
  // C-REGISTRO-TODO-EL-PAIS: si su ciudad cae dentro de una zona abierta, esa es su ciudad (como
  // elegirla en Driver). Si no, la cuenta se crea igual y queda en espera de su ciudad. Con lugar, la
  // ubicación de la red ya no decide (la persona dijo dónde vive).
  const produccion = entornoDeHost(new URL(c.req.url).host) === 'produccion';
  // C-LUGAR-CLIENTE-CON-SERVICIO: el cliente, con la regla de su inicio; el conductor, con la suya.
  const zonaLugar = lugar ? await zonaSegunRol(db, rol, lugar, produccion) : null;
  const zonaCuenta =
    rol === 'repartidor'
      ? (invitacion?.zonaId ??
        (lugar
          ? (zonaLugar?.id ?? null)
          : // C-SIN-ZONA-VISIBLE: sin invitación, la ciudad de la ubicación del registro (solo si cae
            // en una zona). Si no, «sin zona»: nunca una ciudad por defecto.
            await zonaPorUbicacionDelRegistro(
              db,
              (c.req.raw as { cf?: { latitude?: unknown; longitude?: unknown } }).cf,
            )))
      : null;
  const espera =
    lugar &&
    (rol === 'repartidor' || rol === 'cliente') &&
    !(rol === 'repartidor' ? zonaCuenta : zonaLugar)
      ? 1
      : null;
  await db
    .prepare(
      // C-TELEFONO-AL-REGISTRARSE: la cuenta de cliente o de conductor creada en una app con la
      // pantalla del código queda obligada a confirmar su celular (la puerta decide si HOY se exige).
      // C-REGISTRO-TODO-EL-PAIS: el lugar va en la MISMA fila (ninguna escritura de más).
      `INSERT INTO usuarios (id, correo, nombre, telefono, fecha_nacimiento, rol, idioma, clave_hash, correo_canonico, telefono_canonico, zona_id, telefono_exigido_en,
         lugar_pais, lugar_estado, lugar_municipio, lugar_ciudad, lugar_id, lugar_lat, lugar_lng, lugar_en, lugar_espera)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') END,
         ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? IS NOT NULL THEN datetime('now') END, ?)`,
    )
    .bind(
      id,
      d.correo,
      d.nombre,
      tel.telefono,
      d.fechaNacimiento ?? null,
      rol,
      d.idioma,
      await hashClave(d.clave),
      correoUnico,
      telUnico,
      zonaCuenta,
      d.verificaTelefono && (rol === 'cliente' || rol === 'repartidor') ? 1 : 0,
      lugar?.pais ?? null,
      lugar?.estado ?? null,
      lugar?.municipio ?? null,
      lugar?.ciudad ?? null,
      lugar?.lugarId ?? null,
      lugar?.lat ?? null,
      lugar?.lng ?? null,
      lugar?.lugarId ?? null,
      espera,
    )
    .run();
  // Su ciudad salió de su lugar: queda como ciudad elegida, con su ID y su plazo (como en Driver).
  if (rol === 'repartidor' && !invitacion && zonaLugar && zonaCuenta === zonaLugar.id)
    await asignarCiudadElegida(c.env, db, id, zonaLugar.id).catch((e: unknown) =>
      console.error('registro: ciudad del lugar', e),
    );
  // C-TERMINOS-ACTUALIZADOS: al crear la cuenta acepta los términos vigentes (casilla del registro).
  // C-CUENTA-UNICA: y los términos de SU papel, aparte (si después activa otro, acepta los de ese).
  await db.batch([
    db
      .prepare('INSERT OR IGNORE INTO terminos_aceptados (usuario_id, version) VALUES (?, ?)')
      .bind(id, VERSION_TERMINOS),
    sentenciaTerminosPapel(db, id, rol),
  ]);
  // C-SMS-CONSENTIMIENTO: solo si marcó la casilla de SMS (aparte de los términos y sin marcar).
  if (d.smsConsentimiento) await guardarConsentimientoSms(db, id, true, d.canal ?? 'web');
  const token = await abrirSesion(db, id, null, papelDeLaApp(c.req.header('x-tumbite-app')));
  // C-RASTRO: de dónde vino el alta (app, versión, plataforma y red aproximada) y el paso «cuenta».
  const origen = origenDePeticion(c.req);
  await anotarRastro(db, id, 'alta', origen).catch((e: unknown) =>
    console.error('registro: rastro', e),
  );
  await anotarPaso(db, id, 'cuenta', origen);
  // C-REFERIDOS-EQUIPOS: la huella del aparato (antifraude) y el código con el que lo invitaron. El
  // código ya se comprobó arriba; lo que falle aquí no frena el registro, pero queda en el registro de errores.
  await anotarAparato(db, id, await huellaAparato(c.req.header('x-aparato'))).catch((e: unknown) =>
    console.error('registro: aparato', e),
  );
  if (d.invitacion)
    await (
      rol === 'repartidor'
        ? usarCodigoDeConductor(c.env, db, id, d.invitacion)
        : rol === 'cliente'
          ? vincularCliente(db, id, d.invitacion, null)
          : Promise.resolve(null)
    ).catch((e: unknown) => {
      console.error('registro: invitación', e instanceof ErrorDatos ? e.message : e);
    });
  // C-LINEA-SE-UNE-SOLA (21 nov 2026): la línea que esperaba a este correo o celular se crea en este
  // mismo momento, sin que el líder tenga que abrir «Mi línea». Si algo falla, la invitación sigue
  // viva y se vuelve a intentar al confirmar el correo, al entrar o al abrir «Mi línea».
  if (rol === 'repartidor')
    await unirLineaQueEspera(db, id).catch((e: unknown) =>
      console.error('registro: línea del líder invitado', e),
    );
  // C-CORREO-HONESTO: la cuenta se crea igual; la respuesta dice si el enlace salió de verdad.
  const envio = await mandarConfirmacion(c.env, db, {
    id,
    nombre: d.nombre,
    correo: d.correo,
    idioma: d.idioma,
  });
  // C-CAMILA-BIENVENIDA: Camila le da la bienvenida al conductor y, si vino con el código de un
  // líder, le avisa al líder con el contador. Nunca frena el registro.
  if (rol === 'repartidor')
    await alRegistrarseConductor(
      c.env,
      db,
      { id, nombre: d.nombre, idioma: d.idioma },
      lugar?.pais ?? c.req.header('cf-ipcountry'),
    );
  const usuario: Usuario = { id, nombre: d.nombre, correo: d.correo, rol, idioma: d.idioma };
  c.header('Set-Cookie', cookie(token));
  return c.json({ token, usuario, correoEnviado: envio.ok }, 201);
});

cuentas.post('/entrar', async (c) => {
  await escudo(c);
  const d = await leerCuerpo(c, esquemaEntrar);
  const db = base(c);
  // C-MENSAJES-ACCESO (24 nov 2026, Richard): cada caso con su mensaje y su código. Antes «El correo o
  // la contraseña no coinciden» servía para los dos y la persona sin cuenta creía que fallaba la clave.
  // Contra quien prueba correos o claves a lo bruto: Turnstile, el límite por red y la pausa por cuenta.
  const ip = c.req.header('cf-connecting-ip');
  await exigirRedSinPausa(db, ip);
  await exigirCuentaSinBloqueo(db, d.correo);
  const fila = await db
    .prepare(
      'SELECT id, nombre, correo, rol, idioma, clave_hash, activo FROM usuarios WHERE correo = ?',
    )
    .bind(d.correo)
    .first<Usuario & { clave_hash: string; activo: number }>();
  if (!fila) {
    await sumarSinCuentaRed(db, ip);
    throw new ErrorDatos(MENSAJE_CORREO_SIN_CUENTA, 'correo', 401, CODIGO_CORREO_SIN_CUENTA);
  }
  if (!(await verificarClave(d.clave, fila.clave_hash))) {
    await sumarFalloCuenta(db, d.correo);
    throw new ErrorDatos(MENSAJE_CLAVE_INCORRECTA, 'clave', 401, CODIGO_CLAVE_INCORRECTA);
  }
  if (!Number(fila.activo))
    throw new ErrorDatos(MENSAJE_CUENTA_CERRADA, undefined, 403, CODIGO_CUENTA_CERRADA);
  await limpiarFallosCuenta(db, d.correo);
  // C-CUENTA-UNICA: el papel con el que entra esta app. Con la misma cuenta, la app de clientes entra
  // como cliente y Driver como conductor; si el papel falta, la app nueva lo ofrece y la publicada
  // antes ve el aviso de C-ENTRAR-APP-EQUIVOCADA (sin abrir ni cerrar ninguna sesión).
  const papelApp = papelDeLaApp(c.req.header('x-tumbite-app'));
  let rolSesion: Usuario['rol'] = fila.rol;
  if (
    papelApp &&
    papelApp !== fila.rol &&
    esPapelDePersona(papelApp) &&
    esPapelDePersona(fila.rol)
  ) {
    const estado = await estadoPapel(db, fila, papelApp);
    if (estado === 'suspendido')
      throw new ErrorDatos(
        'Tu cuenta de conductor está suspendida. Puedes seguir pidiendo en la app de Divoox; para saber qué falta, escríbenos a soporte.',
        undefined,
        403,
        CODIGO_PAPEL_SUSPENDIDO,
      );
    if (estado !== 'activo') {
      if (!appConCuentaUnica(c, d.cuentaUnica))
        exigirAppDeLaCuenta(c.req.header('x-tumbite-app'), fila.rol);
      if (!d.activarPapel)
        throw new ErrorDatos(
          MENSAJE_PAPEL_POR_ACTIVAR.get(papelApp) ?? '',
          undefined,
          409,
          CODIGO_PAPEL_POR_ACTIVAR,
        );
      if (!d.aceptaTerminosPapel)
        throw new ErrorDatos(
          'Para seguir, marca la casilla de los términos.',
          'aceptaTerminosPapel',
          422,
        );
      const principal = await activarPapel(db, fila, papelApp);
      await anotarPaso(db, fila.id, 'cuenta', origenDePeticion(c.req)).catch((e: unknown) =>
        console.error('entrar: paso del papel nuevo', e),
      );
      // El conductor nuevo, como en el registro: su ciudad por la ubicación, la línea que lo espera
      // y la bienvenida de Camila. Nada de esto frena la entrada.
      if (papelApp === 'repartidor' && principal === 'repartidor') {
        const zona = await zonaPorUbicacionDelRegistro(
          db,
          (c.req.raw as { cf?: { latitude?: unknown; longitude?: unknown } }).cf,
        ).catch(() => null);
        if (zona)
          await db
            .prepare('UPDATE usuarios SET zona_id = ? WHERE id = ? AND zona_id IS NULL')
            .bind(zona, fila.id)
            .run();
        await alRegistrarseConductor(
          c.env,
          db,
          { id: fila.id, nombre: fila.nombre, idioma: fila.idioma },
          c.req.header('cf-ipcountry'),
        );
      }
    }
    rolSesion = papelApp;
  } else {
    // C-ENTRAR-APP-EQUIVOCADA: con la contraseña ya comprobada, una cuenta en la app de celular que no
    // es la suya no abre sesión ni cierra las que tiene (al conductor, entrar le borraba la de Driver).
    exigirAppDeLaCuenta(c.req.header('x-tumbite-app'), fila.rol);
    // C-CUENTA-UNICA-SUSPENSION: el conductor con su papel suspendido no entra a Driver ni al panel.
    if (esPapelDePersona(fila.rol) && (await estadoPapel(db, fila, fila.rol)) === 'suspendido')
      throw new ErrorDatos(
        'Tu cuenta de conductor está suspendida. Puedes seguir pidiendo en la app de Divoox; para saber qué falta, escríbenos a soporte.',
        undefined,
        403,
        CODIGO_PAPEL_SUSPENDIDO,
      );
  }
  // C-PERMISOS-FINOS: una cuenta del equipo suspendida, retirada o vencida no entra (lo dice claro).
  const acceso = fila.rol === 'admin' ? await leerAccesoInterno(db, c.env, fila) : null;
  if (acceso && acceso.estado !== 'activo')
    throw new ErrorDatos(
      'Tu acceso al equipo de Divoox está suspendido o vencido. Habla con quien gestiona el equipo.',
      undefined,
      403,
    );
  if (acceso)
    await db
      .prepare(
        `INSERT INTO equipo_cuentas (usuario_id, ultima_entrada_en) VALUES (?, datetime('now'))
         ON CONFLICT(usuario_id) DO UPDATE SET ultima_entrada_en = excluded.ultima_entrada_en`,
      )
      .bind(fila.id)
      .run();
  // C-REPARTIDOR-UN-TELEFONO (8 nov 2026, Richard): un repartidor trabaja en UN solo teléfono, como
  // en Uber y DoorDash. Entrar en otro cierra la sesión del anterior: si no, los dos reciben las
  // mismas ofertas. Restaurantes y empresas sí pueden tener varias pantallas abiertas.
  // C-CUENTA-UNICA: solo las sesiones de conductor; la app de clientes de la misma persona sigue.
  if (rolSesion === 'repartidor') {
    await db
      .prepare(
        "DELETE FROM sesiones WHERE usuario_id = ? AND (papel IS NULL OR papel = 'repartidor')",
      )
      .bind(fila.id)
      .run();
    // C-LINEA-SE-UNE-SOLA: la línea que lo espera se une también al entrar.
    await unirLineaQueEspera(db, fila.id).catch((e: unknown) =>
      console.error('entrar: línea del líder invitado', e),
    );
  }
  const token = await abrirSesion(db, fila.id, acceso ? JSON.stringify(acceso) : null, papelApp);
  // C-RASTRO: cada entrada queda con su app, versión, plataforma y red aproximada.
  await anotarRastro(db, fila.id, 'entrada', origenDePeticion(c.req)).catch((e: unknown) =>
    console.error('entrar: rastro', e),
  );
  await anotarAparato(db, fila.id, await huellaAparato(c.req.header('x-aparato'))).catch(
    (e: unknown) => console.error('entrar: aparato', e),
  );
  const usuario: Usuario = {
    id: fila.id,
    nombre: fila.nombre,
    correo: fila.correo,
    rol: rolSesion,
    idioma: fila.idioma,
  };
  c.header('Set-Cookie', cookie(token));
  return c.json({ token, usuario });
});

/**
 * C-CORREO-HONESTO (19 nov 2026): lo que la app le dice a la persona cuando el enlace NO salió.
 * Antes la pantalla decía «Te lo mandamos otra vez» aunque el proveedor lo hubiera rechazado.
 */
export const CORREO_NO_EXISTE =
  'No pudimos entregar el correo: esa dirección no existe o no recibe mensajes. Revisa que esté bien escrita o cambia tu correo.';
/** C-REBOTE-TEMPORAL: el proveedor frenó la dirección por un rechazo temporal (no es que no exista). */
export const CORREO_FRENADO =
  'Tu proveedor de correo no aceptó el mensaje por ahora. Intenta otra vez mañana; si sigue sin llegar, revisa que tu correo esté bien escrito o escríbenos a soporte.';
export const CORREO_NO_SALIO =
  'No pudimos mandar el correo en este momento. Intenta otra vez en unos minutos; si sigue sin llegar, escríbenos a soporte.';
export const CORREO_CAMBIADO_SIN_ENLACE =
  'Cambiamos tu correo, pero no pudimos mandarte el enlace en este momento. Toca «Mandar el enlace otra vez» en unos minutos.';

/** Si el enlace no salió, la petición responde con la verdad (nunca un «enviado» falso). */
export function exigirEnvio(r: ResultadoCorreo, sinEnlace = CORREO_NO_SALIO): void {
  if (r.ok) return;
  if (r.rebotado)
    throw new ErrorDatos(
      esFrenoTemporal(r.motivo) ? CORREO_FRENADO : CORREO_NO_EXISTE,
      'correo',
      422,
    );
  throw new ErrorDatos(sinEnlace, undefined, 503);
}

/** Enlace para confirmar el correo: vence en 2 días, un solo uso. No bloquea entrar. */
export async function mandarConfirmacion(
  env: Env,
  db: D1Database,
  u: { id: string; nombre: string; correo: string; idioma: 'es' | 'en' },
  /** C-CORREO-HONESTO: la línea de disculpa, solo para un reenvío por un problema nuestro. */
  disculpa = false,
): Promise<ResultadoCorreo> {
  const token = nuevoToken();
  await db
    .prepare(
      `INSERT INTO confirmaciones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', '+2 days'))`,
    )
    .bind(await sha256(token), u.id)
    .run();
  return correoDeConfirmacion(env, {
    correo: u.correo,
    nombre: u.nombre,
    idioma: u.idioma,
    token,
    disculpa,
  });
}

/** El teléfono registra su token de avisos. Si ya estaba, se reactiva y se anota la visita. */
cuentas.post('/dispositivo', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaDispositivo);
  const db = base(c);
  // Un token solo cambia de dueño si el dueño anterior ya cerró sesión (activo = 0):
  // nadie se queda con los avisos de otro registrando su token.
  // C-AVISOS-IDIOMA (16 nov 2026): el teléfono guarda el idioma de su app (el elegido en el selector
  // o, si no eligió, el del teléfono). Las apps ya publicadas lo mandan en la cabecera x-idioma de
  // cada petición: con eso los avisos salen bien sin esperar una versión nueva.
  const idioma = idiomaDeLaApp(d.idioma, c.req.header('x-idioma'));
  const r = await db
    .prepare(
      `INSERT INTO dispositivos (token, usuario_id, plataforma, idioma, capacidades, app) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(token) DO UPDATE SET usuario_id = excluded.usuario_id, plataforma = excluded.plataforma, activo = 1, visto_en = datetime('now'),
         idioma = COALESCE(excluded.idioma, dispositivos.idioma),
         capacidades = COALESCE(excluded.capacidades, dispositivos.capacidades),
         app = COALESCE(excluded.app, dispositivos.app)
       WHERE dispositivos.usuario_id = excluded.usuario_id OR dispositivos.activo = 0`,
    )
    .bind(
      d.token,
      u.id,
      d.plataforma,
      idioma,
      d.capacidades?.length ? d.capacidades.join(',') : null,
      // C-CUENTA-UNICA-AVISOS: de qué app es este token, para que el aviso de conductor llegue a
      // Driver y el de cliente a la app de clientes aunque sea la misma cuenta en el mismo teléfono.
      papelDeLaApp(c.req.header('x-tumbite-app')),
    )
    .run();
  if (!r.meta.changes)
    throw new ErrorDatos(
      'Este teléfono sigue con otra cuenta. Cierra sesión allí primero.',
      undefined,
      409,
    );
  // El idioma de la app también es el de la cuenta (correos y SMS). No escribe si ya es ese.
  if (idioma)
    await db
      .prepare('UPDATE usuarios SET idioma = ?1 WHERE id = ?2 AND idioma IS NOT ?1')
      .bind(idioma, u.id)
      .run();
  return c.json({ ok: true });
});

cuentas.delete('/dispositivo', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaDispositivo);
  await base(c)
    .prepare('UPDATE dispositivos SET activo = 0 WHERE token = ? AND usuario_id = ?')
    .bind(d.token, u.id)
    .run();
  return c.json({ ok: true });
});

cuentas.post('/confirmar', async (c) => {
  const d = await leerCuerpo(c, esquemaConfirmar);
  const db = base(c);
  const id = await sha256(d.token);
  const r = await db
    .prepare(
      "SELECT c.usuario_id, u.rol FROM confirmaciones c JOIN usuarios u ON u.id = c.usuario_id WHERE c.id = ? AND c.usada_en IS NULL AND c.expira_en > datetime('now')",
    )
    .bind(id)
    .first<{ usuario_id: string; rol: Rol }>();
  if (!r)
    throw new ErrorDatos('Este enlace ya no sirve. Entra a tu cuenta y pide otro.', undefined, 410);
  await db.batch([
    db
      .prepare("UPDATE usuarios SET correo_confirmado_en = datetime('now') WHERE id = ?")
      .bind(r.usuario_id),
    db.prepare("UPDATE confirmaciones SET usada_en = datetime('now') WHERE id = ?").bind(id),
  ]);
  if (r.rol === 'repartidor')
    await unirLineaQueEspera(db, r.usuario_id).catch((e: unknown) =>
      console.error('confirmar: línea del líder invitado', e),
    );
  // C-CORREO-OBLIGATORIO: con el rol, la página del enlace ofrece volver a la app del cliente.
  return c.json({ ok: true, rol: r.rol });
});

/** Vuelve a mandar el enlace de confirmación a la cuenta que está entrando. */
cuentas.post('/confirmar/reenviar', async (c) => {
  const u = exigir(c);
  const db = base(c);
  const f = await db
    .prepare('SELECT correo_confirmado_en FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ correo_confirmado_en: string | null }>();
  if (f?.correo_confirmado_en) return c.json({ ok: true, yaConfirmado: true });
  exigirEnvio(await mandarConfirmacion(c.env, db, u));
  return c.json({ ok: true, yaConfirmado: false });
});

/**
 * Recuperar contraseña. Responde SIEMPRE igual (exista o no el correo), para no revelar
 * qué correos tienen cuenta. El enlace sirve una vez y vence a los 30 minutos.
 */
cuentas.post('/recuperar', async (c) => {
  await escudo(c);
  const d = await leerCuerpo(c, esquemaRecuperar);
  const db = base(c);
  // C-LIMITES-SIN-ESCUDO: por red (correos sin cuenta) y por correo, además del límite por minuto.
  await exigirRedSinPausa(db, c.req.header('cf-connecting-ip'));
  await exigirLimiteCorreo(db, 'recuperar', d.correo);
  const fila = await db
    .prepare(
      `SELECT id, nombre, idioma, correo_confirmado_en IS NOT NULL AS correo_ok,
              telefono_verificado_en IS NOT NULL AS telefono_ok
         FROM usuarios WHERE correo = ? AND activo = 1`,
    )
    .bind(d.correo)
    .first<{
      id: string;
      nombre: string;
      idioma: 'es' | 'en';
      correo_ok: number;
      telefono_ok: number;
    }>();
  // C-RECUPERAR-POR-CELULAR (23 nov 2026): la contraseña se recupera solo por un medio VERIFICADO. Con el
  // correo sin confirmar y el celular confirmado, el código va al celular y el correo no recibe nada
  // (quien escribió mal su correo no le regala la cuenta al dueño de ese buzón). Sin celular confirmado,
  // el enlace va al correo, como siempre funcionó. La respuesta es la misma en todos los casos.
  if (fila && !Number(fila.correo_ok) && Number(fila.telefono_ok)) {
    await mandarCodigo(
      c.env,
      db,
      fila.id,
      (d.idioma ?? fila.idioma) === 'en' ? 'en' : 'es',
      c.req.header('cf-connecting-ip') ?? null,
      undefined,
      false,
      'recuperar',
    ).catch((e: unknown) =>
      console.error(
        'recuperar: el código al celular no salió',
        e instanceof Error ? e.message : String(e),
      ),
    );
    return c.json({ ok: true });
  }
  // C-RECUPERAR-WHATSAPP (27 nov 2026, Richard por Gerencia): NUNCA se dice si el correo tiene cuenta;
  // la respuesta es la misma. La pantalla ofrece «Crear cuenta» siempre (así nadie espera un enlace que
  // no va a llegar sin saber qué hacer). El correo sin cuenta sigue sumando al freno por red.
  if (!fila) {
    await sumarSinCuentaRed(db, c.req.header('cf-connecting-ip'));
    // C-INTENTOS-ACCESO: el equipo sigue viendo a quien se cae (solo por dentro; la persona no).
    await anotarIntento(
      db,
      {
        accion: 'recuperar',
        paso: 'servidor',
        correo: d.correo,
        codigo: CODIGO_CORREO_SIN_CUENTA,
        detalle: null,
      },
      origenDePeticion(c.req),
    );
    return c.json({ ok: true });
  }
  {
    const token = nuevoToken();
    await db
      .prepare(
        `INSERT INTO recuperaciones (id, usuario_id, expira_en) VALUES (?, ?, datetime('now', ?))`,
      )
      .bind(await sha256(token), fila.id, `+${MINUTOS_RECUPERACION} minutes`)
      .run();
    const base_ = (c.env.SITIO_URL ?? 'https://divoox.com').replace(/\/$/, '');
    const lengua = d.idioma ?? fila.idioma;
    const t = lengua === 'en' ? TEXTOS_RECUPERAR.en : TEXTOS_RECUPERAR.es;
    await enviarCorreo(c.env, {
      de: 'avisos',
      para: d.correo,
      asunto: t.asunto,
      texto: t.cuerpo(
        fila.nombre,
        `${base_}${enIdiomaDireccion(PAGINAS.resetPassword, lengua)}?token=${token}`,
      ),
    });
  }
  return c.json({ ok: true });
});

cuentas.post('/restablecer', async (c) => {
  const db = base(c);
  // C-RECUPERAR-POR-CELULAR: con el código del celular en vez del enlace del correo.
  const crudo: unknown = await c.req.raw
    .clone()
    .json()
    .catch(() => null);
  if (crudo && typeof crudo === 'object' && 'codigo' in crudo) {
    const d = await leerCuerpo(c, esquemaRestablecerConCodigo);
    const u = await db
      .prepare(
        `SELECT id FROM usuarios WHERE correo = ? AND activo = 1
            AND correo_confirmado_en IS NULL AND telefono_verificado_en IS NOT NULL`,
      )
      .bind(d.correo)
      .first<{ id: string }>();
    if (!u)
      throw new ErrorDatos(
        'Ese código ya venció. Pide uno nuevo desde «Olvidé mi contraseña».',
        'codigo',
        409,
      );
    await comprobarCodigo(db, u.id, d.codigo);
    await db.batch([
      db
        .prepare('UPDATE usuarios SET clave_hash = ? WHERE id = ?')
        .bind(await hashClave(d.clave), u.id),
      db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(u.id),
    ]);
    await avisarClaveCambiada(c.env, db, u.id, c.req.header('cf-connecting-ip'));
    return c.json({ ok: true });
  }
  const d = await leerCuerpo(c, esquemaRestablecer);
  const id = await sha256(d.token);
  const r = await db
    .prepare(
      "SELECT usuario_id FROM recuperaciones WHERE id = ? AND usada_en IS NULL AND expira_en > datetime('now')",
    )
    .bind(id)
    .first<{ usuario_id: string }>();
  if (!r)
    throw new ErrorDatos(
      'Este enlace ya no sirve. Pide uno nuevo desde «Olvidé mi contraseña».',
      undefined,
      410,
    );
  await db.batch([
    db
      .prepare('UPDATE usuarios SET clave_hash = ? WHERE id = ?')
      .bind(await hashClave(d.clave), r.usuario_id),
    db.prepare("UPDATE recuperaciones SET usada_en = datetime('now') WHERE id = ?").bind(id),
    // Se cierran todas las sesiones viejas: si alguien tenía la cuenta abierta, queda fuera.
    db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(r.usuario_id),
    // C-RECUPERAR-WHATSAPP: los demás pases de esta cuenta dejan de servir.
    db
      .prepare(
        "UPDATE recuperaciones SET usada_en = datetime('now') WHERE usuario_id = ? AND usada_en IS NULL",
      )
      .bind(r.usuario_id),
  ]);
  // C-RECUPERAR-WHATSAPP: queda en la auditoría y se avisa por el otro canal.
  await avisarClaveCambiada(c.env, db, r.usuario_id, c.req.header('cf-connecting-ip'));
  return c.json({ ok: true });
});

/**
 * C-RECUPERAR-WHATSAPP (27 nov 2026): recuperar la cuenta con un código. La persona escribe su celular
 * o su correo y elige cómo recibirlo (WhatsApp, recomendado; correo; o SMS si WhatsApp no le llega).
 * La respuesta es SIEMPRE la misma, exista o no la cuenta.
 */
const esquemaRecuperarCodigo = z.object({
  identificador: z
    .string()
    .trim()
    .min(3, { error: 'Escribe tu número de celular o tu correo.' })
    .max(120),
  paisTelefono: z.string().trim().toUpperCase().length(2).optional(),
  canal: z.enum(['whatsapp', 'sms', 'correo']).default('whatsapp'),
  idioma: z.enum(['es', 'en']).default('es'),
});
const esquemaRecuperarVerificar = z.object({
  identificador: z.string().trim().min(3).max(120),
  paisTelefono: z.string().trim().toUpperCase().length(2).optional(),
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: 'El código tiene 6 números.' }),
  idioma: z.enum(['es', 'en']).default('es'),
});

cuentas.post('/recuperar/codigo', async (c) => {
  await escudo(c);
  const d = await leerCuerpo(c, esquemaRecuperarCodigo);
  const db = base(c);
  await exigirRedSinPausa(db, c.req.header('cf-connecting-ip'));
  let segundoPlano: ((p: Promise<unknown>) => void) | undefined;
  try {
    const ctx = c.executionCtx;
    segundoPlano = (p) => ctx.waitUntil(p);
  } catch {
    // Sin contexto (pruebas): se manda en la misma petición.
  }
  await pedirCodigoRecuperar(
    c.env,
    db,
    d,
    { ip: c.req.header('cf-connecting-ip'), ipPais: c.req.header('cf-ipcountry') },
    segundoPlano,
  );
  return c.json({
    ok: true,
    mensaje: MENSAJE_SI_EXISTE[d.idioma],
    venceEnMinutos: MINUTOS_CODIGO_RECUPERAR,
  });
});

cuentas.post('/recuperar/verificar', async (c) => {
  const d = await leerCuerpo(c, esquemaRecuperarVerificar);
  const cuentasAbiertas = await verificarCodigoRecuperar(base(c), d, {
    ip: c.req.header('cf-connecting-ip'),
    ipPais: c.req.header('cf-ipcountry'),
  });
  return c.json({ ok: true, cuentas: cuentasAbiertas });
});

cuentas.post('/salir', async (c) => {
  const token = leerToken(c);
  if (token && c.env.DB)
    await c.env.DB.prepare('DELETE FROM sesiones WHERE id = ?')
      .bind(await sha256(token))
      .run();
  c.header('Set-Cookie', cookie('', true));
  return c.json({ ok: true });
});

/**
 * Convertir una cuenta en administradora. Hace falta TODO esto a la vez:
 * haber entrado, que el correo esté en ADMIN_CORREOS y conocer ADMIN_SEMILLA
 * (secreto del panel de YaDominios). Registrarse con un correo de la lista no basta.
 */
cuentas.post('/hacer-admin', async (c) => {
  const u = exigir(c);
  const { semilla } = await leerCuerpo(c, esquemaSemilla);
  const secreto = c.env.ADMIN_SEMILLA;
  if (
    !secreto ||
    secreto.length < 24 ||
    !esAdmin(u.correo, c.env.ADMIN_CORREOS) ||
    !(await igualesSeguro(semilla, secreto))
  ) {
    throw new ErrorDatos('No se pudo completar.', undefined, 403);
  }
  await base(c).prepare("UPDATE usuarios SET rol = 'admin' WHERE id = ?").bind(u.id).run();
  return c.json({ ok: true });
});

/**
 * Borrar la cuenta (Apple lo exige dentro de la app). Los datos personales se borran;
 * los pedidos se quedan sin nombre, porque la contabilidad y los impuestos los necesitan.
 */
/**
 * C-PASE-WEB (LG1): la app pide un pase de un solo uso (2 minutos) para abrir una página del panel
 * dentro de la misma app (registro y panel de la empresa de logística) sin volver a escribir la clave.
 * Solo se guarda el hash del código; al usarlo se borra y se abre una sesión nueva en esa vista web.
 */
cuentas.post('/pase-web', async (c) => {
  const u = exigir(c);
  const codigo = nuevoToken();
  const db = base(c);
  await db.batch([
    db.prepare("DELETE FROM pases_web WHERE vence_en < datetime('now')"),
    db
      .prepare(
        "INSERT INTO pases_web (codigo_hash, usuario_id, vence_en) VALUES (?, ?, datetime('now', '+2 minutes'))",
      )
      .bind(await sha256(codigo), u.id),
  ]);
  return c.json({ codigo });
});

/** Solo se puede ir al panel o a la web propia, nunca a otro sitio. */
const DESTINO_PASE = new Set(['/panel', '/panel/business', '/es/panel', '/es/panel/business']);

cuentas.get('/pase-web/:codigo', async (c) => {
  const db = base(c);
  const f = await db
    .prepare(
      "DELETE FROM pases_web WHERE codigo_hash = ? AND vence_en > datetime('now') RETURNING usuario_id",
    )
    .bind(await sha256(c.req.param('codigo')))
    .first<{ usuario_id: string }>();
  const ir = c.req.query('ir') ?? '/panel';
  const destino = DESTINO_PASE.has(ir) ? ir : '/panel';
  if (f) c.header('Set-Cookie', cookie(await abrirSesion(db, f.usuario_id)));
  return c.redirect(destino, 302);
});

cuentas.delete('/yo', async (c) => {
  const u = exigir(c);
  const db = base(c);
  // C-SALDO-CLIENTE (I4): «?saldo=acepto» = vio el aviso de su Saldo Divoox y confirmó perderlo.
  await borrarCuenta(c.env, db, u, { saldoAceptado: c.req.query('saldo') === 'acepto' });
  c.header('Set-Cookie', cookie('', true));
  return c.json({ ok: true });
});

/**
 * C-REBOTE-TEMPORAL (reintento): si el enlace de confirmación no salió porque el proveedor frenó la
 * dirección por un rechazo temporal, cuando ese freno vence (24 h) se manda otra vez SOLO, una única
 * vez, la próxima vez que la persona abre la app. Nadie lo reenvía a mano. La fila del freno se toma
 * con un UPDATE (dos aperturas a la vez no mandan dos) y queda marcada «[reintentado]».
 */
export const MARCA_REINTENTADO = '[reintentado]';
export async function reintentarTrasFreno(env: Env, db: D1Database, u: Usuario): Promise<boolean> {
  const f = await db
    .prepare(
      `SELECT r.correo FROM correos_rebotados r JOIN usuarios x ON x.id = ?1
        WHERE r.correo = lower(x.correo) AND x.correo_confirmado_en IS NULL
          AND r.motivo LIKE '%recipient_suppressed%' AND r.motivo NOT LIKE '%5.1.1%'
          AND r.motivo NOT LIKE '%${MARCA_REINTENTADO}%'
          AND r.creado_en <= datetime('now', '-${HORAS_FRENO_TEMPORAL} hours')`,
    )
    .bind(u.id)
    .first<{ correo: string }>();
  if (!f) return false;
  // Se aparta primero: el freno vencido deja de contar y queda marcado para no repetir.
  const mia = await db
    .prepare(
      `UPDATE correos_rebotados SET motivo = motivo || ' ${MARCA_REINTENTADO}', creado_en = datetime('now', '-${HORAS_FRENO_TEMPORAL + 1} hours')
        WHERE correo = ? AND motivo NOT LIKE '%${MARCA_REINTENTADO}%'`,
    )
    .bind(f.correo)
    .run();
  if (!mia.meta.changes) return false;
  const r = await mandarConfirmacion(env, db, u);
  if (!r.ok) {
    console.error('confirmación: el reintento tras el freno tampoco salió', u.id, r.motivo);
    // Si volvió a frenar, el rebote nuevo no se reintenta otra vez: una sola vez.
    await db
      .prepare(
        `UPDATE correos_rebotados SET motivo = motivo || ' ${MARCA_REINTENTADO}' WHERE correo = ? AND motivo NOT LIKE '%${MARCA_REINTENTADO}%'`,
      )
      .bind(f.correo)
      .run();
  }
  return r.ok;
}

cuentas.get('/yo', async (c) => {
  const u = exigir(c);
  await reintentarTrasFreno(c.env, base(c), u).catch((e: unknown) =>
    console.error('confirmación: reintento tras el freno', e),
  );
  return c.json({ usuario: usuarioPublico(u) });
});

// ---------- C-CUENTA-UNICA: los papeles de la persona y sus restaurantes ----------

/** La persona detrás de la sesión (la dueña, si la sesión actúa como uno de sus restaurantes). */
async function personaDeLaSesion(c: Ctx) {
  const u = exigir(c);
  if (u.persona) {
    const f = await base(c)
      .prepare('SELECT id, nombre, correo, rol, idioma FROM usuarios WHERE id = ? AND activo = 1')
      .bind(u.persona.id)
      .first<Usuario>();
    if (!f) throw new ErrorDatos(SESION_TERMINADA, undefined, 401);
    return { sesion: u, persona: f };
  }
  return { sesion: u, persona: u };
}

async function fijarActuaComo(c: Ctx, negocioId: string | null) {
  const token = leerToken(c);
  if (!token) throw new ErrorDatos(SESION_TERMINADA, undefined, 401);
  await base(c)
    .prepare('UPDATE sesiones SET actua_como = ? WHERE id = ?')
    .bind(negocioId, await sha256(token))
    .run();
}

/** Qué papeles tiene la persona y de qué restaurantes es dueña (para el panel web y las apps). */
cuentas.get('/papeles', async (c) => {
  const { sesion, persona } = await personaDeLaSesion(c);
  const db = base(c);
  const [papeles, negocios] = await Promise.all([
    esPapelDePersona(persona.rol) ? papelesDe(db, persona) : Promise.resolve([]),
    negociosDe(db, persona.id),
  ]);
  return c.json({
    persona: {
      id: persona.id,
      nombre: persona.nombre,
      correo: persona.correo,
      // Para llenar la ficha del restaurante nuevo con lo ya conocido.
      telefono:
        (
          await db
            .prepare('SELECT telefono FROM usuarios WHERE id = ?')
            .bind(persona.id)
            .first<{ telefono: string | null }>()
        )?.telefono ?? null,
    },
    papeles,
    negocios,
    actuaComo: sesion.persona ? sesion.id : null,
    // C-CUENTA-UNICA-RESTAURANTE: el panel ofrece «Registrar mi restaurante» solo a una persona
    // (cliente o conductor). Una cuenta de restaurante o de un empleado no se vuelve dueña sola.
    puedeRegistrarRestaurante: esPapelDePersona(persona.rol),
  });
});

/**
 * C-CUENTA-UNICA-RESTAURANTE: «Registrar mi restaurante» desde una cuenta de cliente o de conductor,
 * con lo ya conocido (nombre, correo y celular de la persona). Crea el negocio aparte y la sesión del
 * panel pasa a actuar como ese restaurante; la ficha se llena en «Mi restaurante» y pasa por la
 * aprobación del equipo como cualquier alta.
 */
cuentas.post('/mis-restaurantes', limiteIntentos(10, 60_000), async (c) => {
  const { persona } = await personaDeLaSesion(c);
  if (!esPapelDePersona(persona.rol))
    throw new ErrorDatos(
      'Esta cuenta no puede registrar un restaurante. Entra con tu cuenta personal de Divoox.',
      undefined,
      403,
    );
  const d = await leerCuerpo(
    c,
    z.object({
      nombre: z.string().trim().min(2, { error: 'Escribe el nombre de tu restaurante.' }).max(80),
      aceptaTerminos: z.literal(true, { error: 'Para seguir, marca la casilla de los términos.' }),
    }),
  );
  const db = base(c);
  const id = await crearNegocio(db, persona, d.nombre);
  await fijarActuaComo(c, id);
  return c.json({ negocioId: id }, 201);
});

/** Elegir con cuál de sus restaurantes trabaja el panel (o volver a la cuenta personal con null). */
cuentas.post('/actuar-como', async (c) => {
  const { persona } = await personaDeLaSesion(c);
  const d = await leerCuerpo(c, z.object({ negocioId: z.string().min(1).max(80).nullable() }));
  if (d.negocioId && !(await esDuenoDe(base(c), persona.id, d.negocioId)))
    throw new ErrorDatos('Ese restaurante no es tuyo.', undefined, 403);
  await fijarActuaComo(c, d.negocioId);
  return c.json({ ok: true });
});

// ---------- C-TELEFONO-AL-REGISTRARSE: el celular se confirma con un código por SMS ----------

const esquemaCodigo = z.object({
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, { error: 'El código tiene 6 números.' }),
});
const esquemaCambiarTelefono = z.object({
  telefono: zCelular().pipe(
    z.string().trim().min(6, { error: 'Escribe tu número de celular.' }).max(30),
  ),
  paisTelefono: z.string().trim().toUpperCase().length(2).optional(),
});

/** Qué toca con el celular de esta cuenta: confirmarlo (obligatorio), sugerirlo, o nada. */
cuentas.get('/telefono', async (c) => {
  const u = exigir(c);
  const db = base(c);
  // C-WHATSAPP-ENTREGA: si el código por WhatsApp no se entregó a tiempo, sale por SMS antes de contestar.
  await respaldoPorSms(c.env, db, u.id).catch((e: unknown) =>
    console.error('telefono: respaldo al mirar la puerta', String(e)),
  );
  // C-CORREO-NO-FRENA: el cliente al que hoy lo frena el correo confirma el celular en su lugar.
  const conCorreo =
    u.rol === 'cliente'
      ? await db
          .prepare('SELECT correo, correo_confirmado_en FROM usuarios WHERE id = ?')
          .bind(u.id)
          .first<{ correo: string; correo_confirmado_en: string | null }>()
      : null;
  const p = await puertaTelefono(c.env, db, u.id, {
    enLugarDelCorreo: conCorreo
      ? estadoCorreoCuenta(
          c.req.url,
          conCorreo.correo,
          Boolean(conCorreo.correo_confirmado_en),
          false,
        ).debeConfirmarCorreo
      : false,
  });
  // El país del celular guardado (o el de la cuenta): el selector de la pantalla arranca ahí.
  const f = p
    ? await db
        .prepare('SELECT telefono FROM usuarios WHERE id = ?')
        .bind(u.id)
        .first<{ telefono: string | null }>()
    : null;
  const e164 = telefonoE164(f?.telefono);
  const pais = p ? ((e164 ? paisDeE164(e164) : null) ?? (await paisDeCuenta(db, u.id))) : null;
  return c.json({
    puerta: p
      ? {
          motivo: p.motivo,
          ultimos: p.ultimos,
          obligatorio: p.obligatorio,
          pais,
          // Si ya hay un código vigente, la app no manda otro solo al abrirse.
          ...(await estadoCodigo(db, u.id)),
          // C-CODIGO-CANALES: si se puede pedir por SMS cuando no llega por WhatsApp.
          smsDisponible: e164 ? (await canalesPara(c.env, db, e164)).includes('sms') : false,
        }
      : null,
  });
});

const esquemaPedirCodigo = z.object({ canal: z.enum(['sms']).optional() });

cuentas.post('/telefono/codigo', async (c) => {
  const u = exigir(c);
  // C-CODIGO-CANALES: sin cuerpo, WhatsApp primero; { canal: 'sms' } cuando no le llegó por WhatsApp.
  const { canal } = (await c.req.raw.clone().text()).trim()
    ? await leerCuerpo(c, esquemaPedirCodigo)
    : { canal: undefined };
  const r = await mandarCodigo(
    c.env,
    base(c),
    u.id,
    u.idioma === 'en' ? 'en' : 'es',
    c.req.header('cf-connecting-ip') ?? null,
    canal,
  );
  return c.json({ ok: true, ...r });
});

cuentas.post('/telefono/verificar', async (c) => {
  const u = exigir(c);
  const { codigo } = await leerCuerpo(c, esquemaCodigo);
  await comprobarCodigo(base(c), u.id, codigo);
  // C-SALDO-BIENVENIDA: el cliente nuevo que confirma su celular recibe la bienvenida de su ciudad (si
  // la regla está encendida); sin ciudad, queda para su primera cotización. Nunca frena la respuesta.
  if (u.rol === 'cliente')
    await alConfirmarCelular(c.env, base(c), u.id, await huellaAparato(c.req.header('x-aparato')));
  return c.json({ ok: true });
});

/**
 * Un número mal escrito no deja a nadie atrapado: mientras no esté confirmado, se cambia aquí, con la
 * misma lectura por país y la misma regla de «un teléfono, una cuenta de cada tipo» del registro.
 */
cuentas.put('/telefono', async (c) => {
  const u = exigir(c);
  const db = base(c);
  if (!algunSmsEncendido(c.env))
    throw new ErrorDatos('No hace falta confirmar tu teléfono ahora.', undefined, 409);
  const d = await leerCuerpo(c, esquemaCambiarTelefono);
  const f = await db
    .prepare('SELECT rol, telefono_verificado_en FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ rol: string; telefono_verificado_en: string | null }>();
  if (f?.telefono_verificado_en)
    throw new ErrorDatos(
      'Tu celular ya está confirmado. Para cambiarlo, escribe a soporte.',
      'telefono',
      409,
    );
  const pais = paisParaTelefono(
    d.telefono,
    d.paisTelefono && datosPais(d.paisTelefono) ? d.paisTelefono : await paisDeCuenta(db, u.id),
    c.req.header('cf-ipcountry'),
  );
  let tel: { telefono: string | null; canonico: string | null };
  try {
    tel = telefonoParaGuardar(d.telefono, pais);
  } catch (e) {
    if (e instanceof TelefonoInvalido)
      throw new ErrorDatos(
        mensajeTelefono(e.motivo, u.idioma === 'en' ? 'en' : 'es'),
        'telefono',
        422,
      );
    throw e;
  }
  if (tel.canonico) {
    const otro = await db
      .prepare(
        `SELECT 1 FROM usuarios WHERE telefono_canonico = ?2 AND rol = ?1 AND id != ?3
         UNION ALL
         SELECT 1 FROM usuarios WHERE ${TELEFONO_DIEZ} = substr(?2, -10)
           AND telefono_canonico IS NULL AND telefono IS NOT NULL AND telefono != '' AND rol = ?1 AND id != ?3
         LIMIT 1`,
      )
      .bind(f?.rol ?? u.rol, tel.canonico, u.id)
      .first();
    if (otro)
      throw new ErrorDatos(
        'Ese teléfono ya tiene una cuenta. Entra con ella o escríbenos a soporte.',
        'telefono',
        409,
      );
  }
  await db
    .prepare('UPDATE usuarios SET telefono = ?, telefono_canonico = ? WHERE id = ?')
    .bind(tel.telefono, tel.canonico, u.id)
    .run();
  await anularCodigoAnterior(db, u.id);
  const p = await puertaTelefono(c.env, db, u.id);
  return c.json({ puerta: p });
});

// ---------- Configuración de la cuenta ----------

cuentas.get('/perfil', async (c) => {
  const u = exigir(c);
  const f = await base(c)
    .prepare(
      `SELECT nombre, correo, telefono, fecha_nacimiento, idioma, correo_confirmado_en, sms_consentido_en,
         telefono_verificado_en,
         EXISTS (SELECT 1 FROM correos_rebotados r WHERE r.correo = lower(usuarios.correo) AND ${reboteVigenteSql('r')}
           -- C-REBOTE-TEMPORAL: un freno temporal del proveedor no le pide a la persona cambiar su correo.
           AND NOT (r.motivo LIKE '%recipient_suppressed%' AND r.motivo NOT LIKE '%5.1.1%')) AS rebotado
       FROM usuarios WHERE id = ?`,
    )
    .bind(u.id)
    .first<Record<string, unknown>>();
  return c.json({
    perfil: {
      nombre: String(f?.nombre ?? ''),
      correo: String(f?.correo ?? ''),
      telefono: String(f?.telefono ?? ''),
      fechaNacimiento: (f?.fecha_nacimiento as string | null) ?? null,
      idioma: f?.idioma === 'en' ? 'en' : 'es',
      correoConfirmado: Boolean(f?.correo_confirmado_en),
      // C-CORREO-HONESTO: la dirección no existe o no recibe: la app pide revisarla o cambiarla.
      correoRebotado: !f?.correo_confirmado_en && Number(f?.rebotado ?? 0) === 1,
      smsConsentimiento: Boolean(f?.sms_consentido_en),
      ...estadoCorreoCuenta(
        c.req.url,
        String(f?.correo ?? ''),
        Boolean(f?.correo_confirmado_en),
        Boolean(f?.telefono_verificado_en),
      ),
    },
  });
});

/**
 * El correo de la cuenta, para las apps:
 * - `correoPorConfirmar`: falta confirmarlo. La franja suave de las apps lo pide en segundo plano
 *   (C-CORREO-NO-FRENA): se puede seguir usando todo.
 * - `debeConfirmarCorreo`: la puerta que SÍ frena (`PuertaCorreo` de la app del cliente). Desde el
 *   23 nov 2026 (decisión de Richard) solo frena si la cuenta tampoco tiene el celular confirmado con
 *   el código: el registro queda hecho con el teléfono y el correo se verifica cuando la persona quiera.
 *   Sin celular confirmado (por ejemplo, donde el código no tiene por dónde salir, C-TELEFONO-SIN-CANAL)
 *   sigue como siempre (C-CORREO-OBLIGATORIO). Las apps ya publicadas leen este campo: con publicar el
 *   servidor, a quien confirmó el celular se le abre la puerta.
 * Fuera de producción, las cuentas de dominios que no existen (las del recorrido) no tienen correo por
 * confirmar, salvo las «verificar.…», que lo prueban.
 */
export function estadoCorreoCuenta(
  url: string,
  correo: string,
  confirmado: boolean,
  telefonoConfirmado: boolean,
): { correoPorConfirmar: boolean; debeConfirmarCorreo: boolean } {
  const porConfirmar = correoPorConfirmar(url, correo, confirmado);
  return {
    correoPorConfirmar: porConfirmar,
    debeConfirmarCorreo: porConfirmar && !telefonoConfirmado,
  };
}

function correoPorConfirmar(url: string, correo: string, confirmado: boolean): boolean {
  if (confirmado) return false;
  if (entornoDeHost(new URL(url).host) === 'produccion') return true;
  return !esCorreoDePrueba(correo) || correo.toLowerCase().startsWith('verificar.');
}

cuentas.patch('/yo', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaPerfil);
  if (u.correo.endsWith('@windoce.com') && !/soporte/i.test(d.nombre))
    throw new ErrorDatos(
      'Las cuentas de nuestro equipo deben llevar «Soporte» en el nombre.',
      'nombre',
    );
  // C-SMS-CONSENTIMIENTO: el permiso de SMS se dio para un número; si el número cambia, el permiso
  // no pasa al nuevo (la persona vuelve a marcar la casilla si quiere).
  // C-TELEFONO-E164: el celular nuevo se guarda en E.164 con el país de la cuenta, y su llave única
  // se pone al día con él (antes quedaba la del número viejo).
  let tel: { telefono: string | null; canonico: string | null };
  try {
    tel = telefonoParaGuardar(
      d.telefono,
      (await paisDeCuenta(base(c), u.id)) ??
        paisParaTelefono(d.telefono, null, c.req.header('cf-ipcountry')),
    );
  } catch (e) {
    if (e instanceof TelefonoInvalido)
      throw new ErrorDatos(mensajeTelefono(e.motivo, d.idioma), 'telefono', 422);
    throw e;
  }
  if (tel.canonico) {
    const otro = await base(c)
      .prepare('SELECT 1 FROM usuarios WHERE telefono_canonico = ? AND rol = ? AND id != ? LIMIT 1')
      .bind(tel.canonico, u.rol, u.id)
      .first();
    if (otro)
      throw new ErrorDatos(
        'Ese teléfono ya tiene una cuenta. Entra con ella o escríbenos a soporte.',
        'telefono',
        409,
      );
  }
  await base(c)
    .prepare(
      `UPDATE usuarios SET nombre = ?1, fecha_nacimiento = ?3, idioma = ?4,
        sms_consentido_en = CASE WHEN COALESCE(telefono, '') = COALESCE(?2, '') THEN sms_consentido_en ELSE NULL END,
        telefono = ?2, telefono_canonico = ?6 WHERE id = ?5`,
    )
    .bind(d.nombre, tel.telefono, d.fechaNacimiento, d.idioma, u.id, tel.canonico)
    .run();
  if (u.rol === 'repartidor')
    await unirLineaQueEspera(base(c), u.id).catch((e: unknown) =>
      console.error('perfil: línea del líder invitado', e),
    );
  // C-AVISOS-IDIOMA: el idioma elegido en la cuenta también vale para sus avisos (si cambió).
  if (d.idioma !== u.idioma) {
    const db = base(c);
    await db.batch([
      db
        .prepare('UPDATE dispositivos SET idioma = ?1 WHERE usuario_id = ?2 AND idioma IS NOT ?1')
        .bind(d.idioma, u.id),
      db
        .prepare(
          'UPDATE suscripciones_web SET idioma = ?1 WHERE usuario_id = ?2 AND idioma IS NOT ?1',
        )
        .bind(d.idioma, u.id),
    ]);
  }
  return c.json({ usuario: { ...usuarioPublico(u), nombre: d.nombre, idioma: d.idioma } });
});

/**
 * C-SMS-CONSENTIMIENTO: aceptar o retirar los SMS desde la cuenta (la misma casilla, sin marcar
 * por defecto). Retirar borra la fecha: desde ese momento el servidor no manda SMS a esa persona,
 * salvo el código que pida ella misma en ese momento.
 */
cuentas.put('/sms', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(
    c,
    z.object({ acepta: z.boolean(), canal: z.enum(CANALES_CONSENTIMIENTO_SMS).default('web') }),
  );
  await guardarConsentimientoSms(base(c), u.id, d.acepta, d.canal);
  return c.json({ smsConsentimiento: d.acepta, version: VERSION_CONSENTIMIENTO_SMS });
});

/** El idioma de los avisos sigue al de la app (C-REPARTIDOR-GRANDES): antes se quedaba el del registro. */
cuentas.put('/idioma', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, z.object({ idioma: z.enum(['es', 'en']) }));
  const db = base(c);
  // C-AVISOS-IDIOMA: la persona eligió idioma: sus teléfonos y navegadores también lo toman (los
  // avisos le llegan en ese idioma en todos). No escribe lo que ya está en ese idioma.
  await db.batch([
    db
      .prepare('UPDATE usuarios SET idioma = ?1 WHERE id = ?2 AND idioma IS NOT ?1')
      .bind(d.idioma, u.id),
    db
      .prepare('UPDATE dispositivos SET idioma = ?1 WHERE usuario_id = ?2 AND idioma IS NOT ?1')
      .bind(d.idioma, u.id),
    db
      .prepare(
        'UPDATE suscripciones_web SET idioma = ?1 WHERE usuario_id = ?2 AND idioma IS NOT ?1',
      )
      .bind(d.idioma, u.id),
  ]);
  return c.json({ idioma: d.idioma });
});

/** Cambiar la contraseña sabiendo la actual. Cierra las demás sesiones; la de ahora sigue. */
cuentas.post('/clave', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaCambiarClave);
  const db = base(c);
  const f = await db
    .prepare('SELECT clave_hash FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ clave_hash: string }>();
  if (!f || !(await verificarClave(d.actual, f.clave_hash)))
    // C-SESION-TERMINADA: 403, no 401 (la sesión es buena; 401 hace que la app salga).
    throw new ErrorDatos('La contraseña actual no es correcta.', 'actual', 403);
  const token = leerToken(c);
  await db.batch([
    db
      .prepare('UPDATE usuarios SET clave_hash = ? WHERE id = ?')
      .bind(await hashClave(d.nueva), u.id),
    db
      .prepare('DELETE FROM sesiones WHERE usuario_id = ? AND id != ?')
      .bind(u.id, token ? await sha256(token) : ''),
  ]);
  return c.json({ ok: true });
});

/** Cambiar el correo con la contraseña. El correo nuevo queda sin confirmar y se le manda el enlace. */
cuentas.post('/correo', async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, esquemaCambiarCorreo);
  const db = base(c);
  const f = await db
    .prepare('SELECT clave_hash FROM usuarios WHERE id = ?')
    .bind(u.id)
    .first<{ clave_hash: string }>();
  if (!f || !(await verificarClave(d.clave, f.clave_hash)))
    throw new ErrorDatos('La contraseña no es correcta.', 'clave', 403);
  if (d.correo === u.correo.toLowerCase()) return c.json({ usuario: usuarioPublico(u) });
  const existe = await db.prepare('SELECT 1 FROM usuarios WHERE correo = ?').bind(d.correo).first();
  if (existe) throw new ErrorDatos('Ya existe una cuenta con ese correo.', 'correo', 409);
  // C-CORREO-HONESTO: una dirección que ya rebotó no se acepta (no recibiría el enlace).
  if (await correoRebotado(c.env, d.correo)) throw new ErrorDatos(CORREO_NO_EXISTE, 'correo', 422);
  await db
    .prepare('UPDATE usuarios SET correo = ?, correo_confirmado_en = NULL WHERE id = ?')
    .bind(d.correo, u.id)
    .run();
  exigirEnvio(
    await mandarConfirmacion(c.env, db, {
      id: u.id,
      nombre: u.nombre,
      correo: d.correo,
      idioma: u.idioma,
    }),
    CORREO_CAMBIADO_SIN_ENLACE,
  );
  return c.json({ usuario: { ...usuarioPublico(u), correo: d.correo } });
});

/**
 * C-PUENTE-PANEL (2 nov 2026, Richard: «que no tenga que salir afuera para nada»): las pantallas del
 * panel web que la app abre (Configuración, Ganancias…) se abren DENTRO de la app con la sesión ya
 * iniciada. La app pide un código de un solo uso (vence en 60 segundos, solo queda su hash); el visor
 * de la app abre /datos/cuentas/puente/<código>, que deja la cookie de sesión y lleva a la página.
 * Solo a direcciones del propio sitio: nunca redirige afuera.
 */
const destinoPuente = z
  .string()
  .trim()
  .max(300)
  .regex(/^\/(?!\/)[A-Za-z0-9/_\-?=&.%]*$/);

cuentas.post('/puente', limiteIntentos(20, 60_000), async (c) => {
  const u = exigir(c);
  const d = await leerCuerpo(c, z.object({ a: destinoPuente }));
  const db = base(c);
  const codigo = nuevoToken();
  await db
    .prepare(
      "INSERT INTO puentes_sesion (id, usuario_id, expira_en, papel) VALUES (?, ?, datetime('now', '+60 seconds'), ?)",
    )
    // C-CUENTA-UNICA: la página se abre con el mismo papel de la app que la pidió.
    .bind(await sha256(codigo), u.id, esPapelDePersona(u.rol) ? u.rol : null)
    .run();
  const origen = new URL(c.req.url).origin;
  return c.json({ url: `${origen}/datos/cuentas/puente/${codigo}?a=${encodeURIComponent(d.a)}` });
});

cuentas.get('/puente/:codigo', limiteIntentos(30, 60_000), async (c) => {
  const a = destinoPuente.safeParse(c.req.query('a') ?? '/');
  const destino = a.success ? a.data : '/';
  const db = base(c);
  const fila = await db
    .prepare(
      "UPDATE puentes_sesion SET usado = 1 WHERE id = ? AND usado = 0 AND expira_en > datetime('now') RETURNING usuario_id, papel",
    )
    .bind(await sha256(c.req.param('codigo')))
    .first<{ usuario_id: string; papel: string | null }>();
  // Código usado, vencido o inventado: se llega a la página igual y el panel pide entrar.
  if (!fila) return c.redirect(destino, 302);
  const token = await abrirSesion(db, fila.usuario_id, null, fila.papel);
  c.header('Set-Cookie', cookie(token));
  c.header('Cache-Control', 'no-store');
  return c.redirect(destino, 302);
});
