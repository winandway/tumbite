/**
 * C-RASTRO (22 nov 2026, Richard): los pasos del registro, en orden, para el embudo y para decir en
 * la ficha de cada cuenta «dónde lo dejó». Los tres primeros pasan ANTES de crear la cuenta y solo se
 * cuentan (sin persona). Los demás los anota el servidor cuando ocurren, una vez por cuenta.
 */
export const PASOS_ANONIMOS = ['abrio', 'formulario', 'revisar'] as const;
export type PasoAnonimo = (typeof PASOS_ANONIMOS)[number];

export const PASOS_CONDUCTOR = [
  ...PASOS_ANONIMOS,
  'cuenta',
  'telefono',
  'aviso_ia',
  'foto_cara',
  'foto_documento',
  'foto_licencia',
  'vehiculo',
  'enviado',
  'aprobado',
  'conectado',
  'primer_viaje',
  // C-CORREO-NO-FRENA (23 nov 2026, Richard): el correo se confirma en segundo plano; va al final.
  'correo',
] as const;
export const PASOS_CLIENTE = [
  ...PASOS_ANONIMOS,
  'cuenta',
  'telefono',
  'primer_viaje',
  'correo',
] as const;
export type PasoRegistro = (typeof PASOS_CONDUCTOR)[number];
export type AppRastro = 'cliente' | 'repartidor' | 'restaurante';

/**
 * C-CORREO-NO-FRENA (23 nov 2026, decisión de Richard): pasos que se piden en segundo plano y no frenan
 * el registro. No cuentan para «Le falta» ni para «se quedó aquí» del embudo.
 */
export const PASOS_QUE_NO_FRENAN: readonly PasoRegistro[] = ['correo'];
export const pasoQueNoFrena = (p: string) => (PASOS_QUE_NO_FRENAN as readonly string[]).includes(p);

export const pasosDe = (app: AppRastro): readonly PasoRegistro[] =>
  app === 'repartidor' ? PASOS_CONDUCTOR : PASOS_CLIENTE;

/** Cómo se llama cada paso en el panel del equipo. */
export const NOMBRE_PASO: Record<PasoRegistro, { es: string; en: string }> = {
  abrio: { es: 'Pantalla de registro abierta', en: 'Sign-up screen opened' },
  formulario: { es: 'Datos empezados a llenar', en: 'Started filling in details' },
  revisar: { es: 'Pantalla «Revisa tus datos»', en: '“Review your details” screen' },
  cuenta: { es: 'Creación de la cuenta', en: 'Account creation' },
  correo: { es: 'Confirmación del correo', en: 'Email confirmation' },
  telefono: { es: 'Verificación del teléfono', en: 'Phone verification' },
  aviso_ia: { es: 'Aviso de revisión de documentos', en: 'Document review notice' },
  foto_cara: { es: 'Foto de la cara', en: 'Face photo' },
  foto_documento: { es: 'Foto del documento', en: 'ID document photo' },
  foto_licencia: { es: 'Foto de la licencia', en: 'Driver license photo' },
  vehiculo: { es: 'Registro del vehículo', en: 'Vehicle registration' },
  enviado: { es: 'Envío a revisión', en: 'Submission for review' },
  aprobado: { es: 'Aprobación del equipo', en: 'Team approval' },
  conectado: { es: 'Primera conexión', en: 'First time online' },
  primer_viaje: { es: 'Primer viaje o pedido terminado', en: 'First completed ride or order' },
};

/**
 * C-FOTO-CARA-A-LA-VISTA (23 nov 2026) — todos los países. Los hitos del conductor alrededor de la
 * foto de la cara y de la conexión: lo que vio, lo que abrió y lo que falló. No son pasos en fila (no
 * entran al embudo de pasos): dicen DÓNDE se traba. Una fila por cuenta, hito y motivo, la primera vez.
 * Los marcados «servidor» los anota el servidor solo (sirven también con las apps ya publicadas).
 */
export const HITOS_CONDUCTOR = [
  // servidor: Driver pidió «Tus papeles» y le falta la cara para empezar (la tarjeta le toca).
  'cara_pedida',
  'tarjeta_cara_vista',
  'asistente_abierto',
  'camara_abierta',
  'foto_tomada',
  'camara_fallo',
  'subida_fallida',
  // servidor: el servidor rechazó la foto (tamaño, tipo, sin consentimiento…).
  'subida_rechazada',
  // servidor: quiso conectarse y el servidor no lo dejó (cara, términos, teléfono…).
  'conectar_rechazado',
] as const;
export type HitoConductor = (typeof HITOS_CONDUCTOR)[number];

/** Los que manda la app, con los motivos que acepta el servidor (lo demás se rechaza). */
export const HITOS_DESDE_APP = {
  tarjeta_cara_vista: [''],
  asistente_abierto: [''],
  camara_abierta: [''],
  foto_tomada: [''],
  camara_fallo: ['no_arranca', 'montaje', 'disparo', 'permiso'],
  subida_fallida: ['tiempo', 'sin_conexion', 'servidor', 'rechazo'],
} as const satisfies Partial<Record<HitoConductor, readonly string[]>>;
export type HitoDesdeApp = keyof typeof HITOS_DESDE_APP;

export const NOMBRE_HITO: Record<HitoConductor, { es: string; en: string }> = {
  cara_pedida: { es: 'Le tocó la foto de la cara para empezar', en: 'Face photo needed to start' },
  tarjeta_cara_vista: { es: 'Vio la tarjeta de la foto de la cara', en: 'Saw the face photo card' },
  asistente_abierto: { es: 'Abrió el asistente de papeles', en: 'Opened the documents assistant' },
  camara_abierta: { es: 'Abrió la cámara', en: 'Opened the camera' },
  foto_tomada: { es: 'Tomó una foto', en: 'Took a photo' },
  camara_fallo: { es: 'La cámara falló', en: 'The camera failed' },
  subida_fallida: { es: 'No se pudo subir la foto', en: 'Photo upload failed' },
  subida_rechazada: { es: 'El servidor rechazó la foto', en: 'The server rejected the photo' },
  conectar_rechazado: { es: 'No lo dejamos conectarse', en: 'Couldn’t go online' },
};

/** Cómo se dice cada motivo en el panel del equipo. */
export const NOMBRE_MOTIVO_HITO: Record<string, { es: string; en: string }> = {
  no_arranca: { es: 'la cámara no arrancó', en: 'the camera didn’t start' },
  montaje: { es: 'la cámara no abrió', en: 'the camera didn’t open' },
  disparo: { es: 'no se pudo tomar la foto', en: 'the photo couldn’t be taken' },
  permiso: { es: 'sin permiso de cámara', en: 'no camera permission' },
  tiempo: { es: 'la subida tardó demasiado', en: 'the upload took too long' },
  sin_conexion: { es: 'sin conexión', en: 'no connection' },
  servidor: { es: 'error del servidor', en: 'server error' },
  rechazo: { es: 'el servidor la rechazó', en: 'rejected by the server' },
  tamano: { es: 'la foto pesa demasiado', en: 'photo too large' },
  tipo: { es: 'no era una foto', en: 'not a photo' },
  en_vivo: { es: 'no venía de la cámara', en: 'not taken with the camera' },
  consentimiento: { es: 'faltaba aceptar el uso de la foto', en: 'consent missing' },
  aprobado: { es: 'ese papel ya estaba aprobado', en: 'already approved' },
  almacen: { es: 'el almacén de fotos no respondía', en: 'photo storage unavailable' },
  vacia: { es: 'no llegó ninguna foto', en: 'no photo arrived' },
  cara: { es: 'falta la foto de la cara', en: 'face photo missing' },
  kyc: { es: 'falta verificar la identidad', en: 'identity not verified' },
  papeles: { es: 'faltan la licencia o el seguro', en: 'license or insurance missing' },
  terminos: { es: 'faltaba aceptar los términos', en: 'terms not accepted' },
  telefono: { es: 'faltaba confirmar el celular', en: 'phone not confirmed' },
  selfie: { es: 'foto de control pendiente', en: 'identity check pending' },
  selfie_casco: { es: 'foto con casco pendiente', en: 'helmet photo pending' },
  bloque_flex: { es: 'estaba en un bloque de Flex', en: 'in a Flex block' },
  servicioId: { es: 'servicio no aprobado', en: 'service not approved' },
  sin_restaurantes: { es: 'no hay restaurantes en su zona', en: 'no restaurants in their area' },
  otro: { es: 'otro motivo', en: 'other reason' },
};
