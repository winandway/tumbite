// La versión web importa hojas de estilo (el mapa de Leaflet).
declare module '*.css';
// Imágenes del diseño del inicio: Expo las resuelve a un identificador numérico.
declare module '*.png' {
  const imagen: number;
  export default imagen;
}
