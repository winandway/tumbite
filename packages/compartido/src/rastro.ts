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
  'correo',
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
] as const;
export const PASOS_CLIENTE = [
  ...PASOS_ANONIMOS,
  'cuenta',
  'correo',
  'telefono',
  'primer_viaje',
] as const;
export type PasoRegistro = (typeof PASOS_CONDUCTOR)[number];
export type AppRastro = 'cliente' | 'repartidor' | 'restaurante';

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
