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
  abrio: { es: 'Abrió la pantalla de registro', en: 'Opened the sign-up screen' },
  formulario: { es: 'Empezó a llenar sus datos', en: 'Started filling in details' },
  revisar: { es: 'Llegó a «Revisa tus datos»', en: 'Reached “Review your details”' },
  cuenta: { es: 'Creó la cuenta', en: 'Created the account' },
  correo: { es: 'Confirmó su correo', en: 'Confirmed email' },
  telefono: { es: 'Verificó su teléfono', en: 'Verified phone' },
  aviso_ia: {
    es: 'Contestó el aviso de revisión de documentos',
    en: 'Answered the document review notice',
  },
  foto_cara: { es: 'Subió la foto de su cara', en: 'Uploaded face photo' },
  foto_documento: { es: 'Subió su documento', en: 'Uploaded ID document' },
  foto_licencia: { es: 'Subió su licencia', en: 'Uploaded driver license' },
  vehiculo: { es: 'Registró su vehículo', en: 'Added vehicle' },
  enviado: { es: 'Envió todo a revisión', en: 'Submitted for review' },
  aprobado: { es: 'El equipo lo aprobó', en: 'Approved by the team' },
  conectado: { es: 'Se conectó por primera vez', en: 'Went online for the first time' },
  primer_viaje: { es: 'Terminó su primer viaje o pedido', en: 'Completed first ride or order' },
};
