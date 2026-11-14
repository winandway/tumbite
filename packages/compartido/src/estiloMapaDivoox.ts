/**
 * C-MAPA-GOOGLE-WEB (14 nov 2026) — todos los países. Estilo del mapa de Google de Divoox: fondo
 * claro, calles limpias, sin puntos de interés ni transporte (solo los parques en verde suave) y sin
 * el rojo de la marca en el mapa base (el rojo #F20D20 es de las marcas; el azul petróleo #1F4D69 de
 * logística, también solo en marcas).
 *
 * Dos usos, el MISMO estilo:
 * - sin Map ID, el código lo pasa en la opción `styles` del mapa (Google solo la admite sin Map ID);
 * - con Map ID (mapa vectorial), se importa en la consola de Google Cloud: «Map styles» → «Create
 *   style» → pestaña JSON → pegar `identidad-divoox/mapa-google-estilo-divoox.json`. Una prueba
 *   exige que ese archivo y esta constante sean iguales.
 */
export type ReglaEstiloMapa = {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string | number>[];
};

export const ESTILO_MAPA_DIVOOX: ReglaEstiloMapa[] = [
  {
    elementType: 'geometry',
    stylers: [
      {
        color: '#F5F5F3',
      },
    ],
  },
  {
    elementType: 'labels.icon',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#666B73',
      },
    ],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [
      {
        color: '#FFFFFF',
      },
      {
        weight: 3,
      },
    ],
  },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#D9DBDE',
      },
    ],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#101010',
      },
    ],
  },
  {
    featureType: 'poi',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [
      {
        visibility: 'on',
      },
      {
        color: '#E4EFE0',
      },
    ],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [
      {
        color: '#FFFFFF',
      },
    ],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#E3E4E6',
      },
    ],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#666B73',
      },
    ],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [
      {
        color: '#ECECEC',
      },
    ],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#D9DBDE',
      },
    ],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#101010',
      },
    ],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#8E9198',
      },
    ],
  },
  {
    featureType: 'transit',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [
      {
        color: '#D6E4EC',
      },
    ],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#8E9198',
      },
    ],
  },
];
