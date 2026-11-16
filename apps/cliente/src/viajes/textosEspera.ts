import type { VehiculoEspera } from './escenaBuscando';

/**
 * C-ESPERA-ADELANTE y C-ESPERA-VEHICULO (fase cero): los textos de la pantalla de espera, por
 * servicio (tabla de la sección 8 del sistema de diseño).
 */
type TextosEspera = {
  titulo: Record<VehiculoEspera, string>;
  calma: Record<VehiculoEspera, string>;
  recoger: string;
  entregar: string;
  queEnvias: string;
  parada: string;
  compartir: string;
  cancelarNota: string;
  envioEn: { moto: string; carro: string };
};

export const TEXTOS_ESPERA: Record<'es' | 'en', TextosEspera> = {
  es: {
    titulo: {
      carro: 'Buscando tu conductor',
      'moto-pasajero': 'Buscando tu moto',
      'moto-envio': 'Buscando quién lleve tu envío',
      'carro-envio': 'Buscando quién lleve tu envío',
    },
    calma: {
      carro: 'Les avisamos a los conductores más cerca de ti. Suele tardar menos de un minuto.',
      'moto-pasajero':
        'Les avisamos a los conductores de moto más cerca de ti. Suele tardar menos de un minuto.',
      'moto-envio':
        'Les avisamos a los repartidores más cerca de ti. Suele tardar menos de un minuto.',
      'carro-envio':
        'Les avisamos a los repartidores más cerca de ti. Suele tardar menos de un minuto.',
    },
    recoger: 'Recoger',
    entregar: 'Entregar',
    queEnvias: 'Qué envías',
    parada: 'Parada',
    compartir: 'Compartir',
    cancelarNota: 'Cancelar es gratis mientras buscamos',
    envioEn: { moto: 'Envío en moto', carro: 'Envío en carro' },
  },
  en: {
    titulo: {
      carro: 'Finding your driver',
      'moto-pasajero': 'Finding your motorcycle',
      'moto-envio': 'Finding a courier',
      'carro-envio': 'Finding a courier',
    },
    calma: {
      carro: 'We’re letting the closest drivers know. It usually takes less than a minute.',
      'moto-pasajero':
        'We’re letting the closest motorcycle drivers know. It usually takes less than a minute.',
      'moto-envio': 'We’re letting the closest couriers know. It usually takes less than a minute.',
      'carro-envio':
        'We’re letting the closest couriers know. It usually takes less than a minute.',
    },
    recoger: 'Pick up',
    entregar: 'Drop off',
    queEnvias: 'What you’re sending',
    parada: 'Stop',
    compartir: 'Share',
    cancelarNota: 'Canceling is free while we search',
    envioEn: { moto: 'Delivery by motorcycle', carro: 'Delivery by car' },
  },
};
