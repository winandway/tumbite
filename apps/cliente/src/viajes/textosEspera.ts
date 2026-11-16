/** C-ESPERA-ADELANTE (fase cero): los textos de la pantalla «Buscando tu conductor». */
type TextosEspera = {
  titulo: string;
  tituloEnvio: string;
  calma: string;
  compartir: string;
  cancelarNota: string;
};

export const TEXTOS_ESPERA: Record<'es' | 'en', TextosEspera> = {
  es: {
    titulo: 'Buscando tu conductor',
    tituloEnvio: 'Buscando un conductor para tu paquete',
    calma: 'Les avisamos a los conductores más cerca de ti. Suele tardar menos de un minuto.',
    compartir: 'Compartir',
    cancelarNota: 'Cancelar es gratis mientras buscamos',
  },
  en: {
    titulo: 'Finding your driver',
    tituloEnvio: 'Finding a driver for your package',
    calma: 'We’re letting the closest drivers know. It usually takes less than a minute.',
    compartir: 'Share',
    cancelarNota: 'Canceling is free while we search',
  },
};
