import type { Idioma } from '@tumbite/compartido';

/**
 * C-CAMILA-CHAT en Divoox Driver (17 nov 2026) — todos los países. Los textos de
 * Ayuda y «Habla con soporte», en los dos idiomas (sin React Native: se prueban solos).
 */
const ES = {
  ayuda: 'Ayuda',
  ayudaTexto: 'Escríbele a soporte, mira tus casos o lee las guías.',
  hablar: 'Habla con soporte',
  hablarDetalle: 'Te responde Camila Campos, del equipo de soporte, o una persona del equipo',
  casos: 'Mis casos y reportes',
  casosDetalle: 'Reporta un problema y sigue lo que ya mandaste',
  guias: 'Guías de Docs',
  guiasDetalle: 'Cómo funciona cada parte de Divoox Driver',
  volver: 'Volver',
};
type TextosSoporte = typeof ES;
const EN: TextosSoporte = {
  ayuda: 'Help',
  ayudaTexto: 'Write to support, check your cases or read the guides.',
  hablar: 'Talk to support',
  hablarDetalle: 'Camila Campos from the Support Team replies, or a person on our team',
  casos: 'My cases and reports',
  casosDetalle: 'Report a problem and follow what you already sent',
  guias: 'Docs guides',
  guiasDetalle: 'How each part of Divoox Driver works',
  volver: 'Back',
};

export function textosSoporte(idioma: Idioma): TextosSoporte {
  return idioma === 'en' ? EN : ES;
}
