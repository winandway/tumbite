// La versión web importa la hoja de estilos del mapa (Leaflet); las imágenes del diseño son PNG/WebP.
declare module '*.css';
declare module '*.png' {
  const imagen: number;
  export default imagen;
}
declare module '*.webp' {
  const imagen: number;
  export default imagen;
}
