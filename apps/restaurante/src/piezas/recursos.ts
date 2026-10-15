/** Logotipo, mascota e íconos de la app del restaurante (diseño aprobado el 14 oct 2026). */
import logo from '../../assets/rest/logo.png';
import mascota from '../../assets/rest/mascota.webp';
import navInicio from '../../assets/rest/nav-inicio.png';
import navPedidos from '../../assets/rest/nav-pedidos.png';
import navMenu from '../../assets/rest/nav-menu.png';
import navEstadisticas from '../../assets/rest/nav-estadisticas.png';
import navMas from '../../assets/rest/nav-mas.png';
import iconoCamara from '../../assets/rest/icono-camara.png';

export const IMG = { logo, mascota, iconoCamara } as const;
export type Pestana = 'inicio' | 'pedidos' | 'menu' | 'estadisticas' | 'mas';
export const ICONO_PESTANA = new Map<Pestana, number>([
  ['inicio', navInicio],
  ['pedidos', navPedidos],
  ['menu', navMenu],
  ['estadisticas', navEstadisticas],
  ['mas', navMas],
]);
