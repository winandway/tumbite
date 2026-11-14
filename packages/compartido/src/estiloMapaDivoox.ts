/**
 * C-MAPA-GOOGLE-WEB y C-MAPA-DIA-NOCHE (14 nov 2026, decisión de Richard) — todos los países.
 * Los DOS estilos del mapa de Divoox, de una sola fuente (las paletas de abajo):
 *
 * - «Día · azul Divoox»: tierra azul claro, calles blancas con borde azul, autopistas en azul petróleo.
 * - «Noche · oscuro con azul»: tierra casi negra, calles grises, autopistas en azul claro.
 *
 * Sin rojo en el mapa base: el rojo #F20D20 es de nuestras marcas y de los problemas. Sin puntos de
 * interés ni transporte (solo los parques, como mancha de color sin rótulo).
 *
 * Cada estilo sale en dos formatos, los dos de estas mismas paletas:
 * - `ESTILO_MAPA_DIA` / `ESTILO_MAPA_NOCHE` (formato clásico de reglas): lo usa el código en la opción
 *   `styles` del mapa de Google sin Map ID y en `customMapStyle` de las apps de Android.
 * - `ESTILO_NUBE_DIA` / `ESTILO_NUBE_NOCHE` (formato de los estilos en la nube): se importan en la
 *   consola de Google Cloud («Map styles» → «Create style» → pestaña JSON) y se asocian al Map ID
 *   «Divoox web» como estilo claro y oscuro. Con Map ID el estilo NO sale del código.
 *
 * Los archivos de `identidad-divoox/` (`mapa-google-estilo-divoox-dia.json`, `…-noche.json`,
 * `mapa-google-nube-dia.json`, `…-noche.json`) se generan con
 * `node scripts/marca/generar-estilos-mapa.mjs`; una prueba exige que sean iguales a estas constantes.
 * Ficha con las fuentes: docs/investigaciones-rea/2026-11-14-mapa-dia-noche-e-isotipo.md
 */
export type ReglaEstiloMapa = {
  featureType?: string;
  elementType?: string;
  stylers: Record<string, string | number>[];
};

export type PaletaMapa = {
  nombre: string;
  tierra: string;
  calle: string;
  bordeCalle: string;
  avenida: string;
  bordeAvenida: string;
  autopista: string;
  bordeAutopista: string;
  agua: string;
  parque: string;
  texto: string;
  textoFuerte: string;
  bordeTexto: string;
  textoAgua: string;
};

export const PALETA_MAPA_DIA: PaletaMapa = {
  nombre: 'Día · azul Divoox',
  tierra: '#CBDDE8',
  calle: '#FFFFFF',
  bordeCalle: '#5E8CA6',
  avenida: '#FFFFFF',
  bordeAvenida: '#1F4D69',
  autopista: '#1F4D69',
  bordeAutopista: '#1F4D69',
  agua: '#4FB3D9',
  parque: '#A9DCC0',
  texto: '#1F4D69',
  textoFuerte: '#0C2A3B',
  bordeTexto: '#FFFFFF',
  textoAgua: '#0C4A66',
};

export const PALETA_MAPA_NOCHE: PaletaMapa = {
  nombre: 'Noche · oscuro con azul',
  tierra: '#1C1F24',
  calle: '#4A515C',
  bordeCalle: '#15171B',
  avenida: '#737C8A',
  bordeAvenida: '#15171B',
  autopista: '#5FB4E5',
  bordeAutopista: '#15171B',
  agua: '#0E3F5C',
  parque: '#1F4030',
  texto: '#C4C9D1',
  textoFuerte: '#FFFFFF',
  bordeTexto: '#101010',
  textoAgua: '#7FC4EA',
};

/** El estilo clásico (reglas `featureType` / `elementType` / `stylers`) de una paleta. */
export function estiloDePaleta(p: PaletaMapa): ReglaEstiloMapa[] {
  return [
    { elementType: 'geometry', stylers: [{ color: p.tierra }] },
    { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: p.texto }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: p.bordeTexto }, { weight: 3 }] },
    {
      featureType: 'administrative',
      elementType: 'geometry.stroke',
      stylers: [{ color: p.bordeCalle }],
    },
    { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
    {
      featureType: 'administrative.locality',
      elementType: 'labels.text.fill',
      stylers: [{ color: p.textoFuerte }],
    },
    // Los puntos de interés se apagan enteros (figura, ícono y texto) y uno por uno, para que
    // ningún negocio, residencia o edificio público de Google quede a la vista.
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
    {
      featureType: 'poi.park',
      elementType: 'geometry',
      stylers: [{ visibility: 'on' }, { color: p.parque }],
    },
    { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: p.calle }] },
    { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: p.bordeCalle }] },
    { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: p.texto }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: p.avenida }] },
    {
      featureType: 'road.arterial',
      elementType: 'geometry.stroke',
      stylers: [{ color: p.bordeAvenida }],
    },
    {
      featureType: 'road.arterial',
      elementType: 'labels.text.fill',
      stylers: [{ color: p.textoFuerte }],
    },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: p.autopista }] },
    {
      featureType: 'road.highway',
      elementType: 'geometry.stroke',
      stylers: [{ color: p.bordeAutopista }],
    },
    {
      featureType: 'road.highway',
      elementType: 'labels.text.fill',
      stylers: [{ color: p.textoFuerte }],
    },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: p.agua }] },
    { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: p.textoAgua }] },
  ];
}

/** Una regla del formato de los estilos en la nube de Google (referencia «JSON style reference»). */
export type ReglaEstiloNube = {
  id: string;
  geometry?: { visible?: boolean; fillColor?: string; strokeColor?: string };
  label?: {
    visible?: boolean;
    textFillColor?: string;
    textStrokeColor?: string;
  };
};
export type EstiloNube = {
  variant: 'light' | 'dark';
  backgroundColor: string;
  styles: ReglaEstiloNube[];
};

/** El estilo en la nube (el que se importa en la consola de Google) de una paleta. */
export function estiloNubeDePaleta(p: PaletaMapa, variante: 'light' | 'dark'): EstiloNube {
  const texto = (color: string) => ({ textFillColor: color, textStrokeColor: p.bordeTexto });
  const oculto = { geometry: { visible: false }, label: { visible: false } };
  return {
    variant: variante,
    backgroundColor: p.tierra,
    styles: [
      { id: 'natural.land', geometry: { fillColor: p.tierra } },
      { id: 'natural.water', geometry: { fillColor: p.agua }, label: texto(p.textoAgua) },
      // Ningún punto de interés de Google a la vista: ni la figura, ni el pin, ni el texto.
      { id: 'pointOfInterest', ...oculto },
      {
        id: 'pointOfInterest.recreation.park',
        geometry: { visible: true, fillColor: p.parque },
        label: { visible: false },
      },
      { id: 'infrastructure.transitStation', ...oculto },
      { id: 'infrastructure.railwayTrack', ...oculto },
      { id: 'infrastructure.businessCorridor', geometry: { visible: false } },
      { id: 'political.landParcel', ...oculto },
      { id: 'political.border', geometry: { strokeColor: p.bordeCalle } },
      { id: 'political.city', label: texto(p.textoFuerte) },
      { id: 'political.sublocality', label: texto(p.texto) },
      { id: 'political.neighborhood', label: texto(p.texto) },
      {
        id: 'infrastructure.roadNetwork.road',
        geometry: { fillColor: p.calle, strokeColor: p.bordeCalle },
        label: texto(p.texto),
      },
      {
        id: 'infrastructure.roadNetwork.road.arterial',
        geometry: { fillColor: p.avenida, strokeColor: p.bordeAvenida },
        label: texto(p.textoFuerte),
      },
      {
        id: 'infrastructure.roadNetwork.road.highway',
        geometry: { fillColor: p.autopista, strokeColor: p.bordeAutopista },
        label: texto(p.textoFuerte),
      },
    ],
  };
}

export const ESTILO_MAPA_DIA = estiloDePaleta(PALETA_MAPA_DIA);
export const ESTILO_MAPA_NOCHE = estiloDePaleta(PALETA_MAPA_NOCHE);
export const ESTILO_NUBE_DIA = estiloNubeDePaleta(PALETA_MAPA_DIA, 'light');
export const ESTILO_NUBE_NOCHE = estiloNubeDePaleta(PALETA_MAPA_NOCHE, 'dark');

export type TemaMapa = 'dia' | 'noche';

/** El estilo clásico del tema (para `styles` sin Map ID y `customMapStyle` en Android). */
export const estiloMapaDe = (tema: TemaMapa): ReglaEstiloMapa[] =>
  tema === 'noche' ? ESTILO_MAPA_NOCHE : ESTILO_MAPA_DIA;

/** El color de fondo mientras el mapa carga (el de la tierra del tema). */
export const fondoMapaDe = (tema: TemaMapa): string =>
  (tema === 'noche' ? PALETA_MAPA_NOCHE : PALETA_MAPA_DIA).tierra;

/** Los archivos de `identidad-divoox/` y la constante que tiene que ser igual a cada uno. */
export const ARCHIVOS_ESTILO_MAPA: Record<string, unknown> = {
  'mapa-google-estilo-divoox-dia.json': ESTILO_MAPA_DIA,
  'mapa-google-estilo-divoox-noche.json': ESTILO_MAPA_NOCHE,
  'mapa-google-nube-dia.json': ESTILO_NUBE_DIA,
  'mapa-google-nube-noche.json': ESTILO_NUBE_NOCHE,
};
