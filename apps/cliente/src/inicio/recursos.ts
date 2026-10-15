/**
 * Recursos gráficos del inicio (carpeta diseno-frontend, diseño aprobado el 14 oct 2026).
 * Los «relleno-*» son fotos de muestra: se enseñan mientras no hay datos reales, marcadas
 * «Ejemplo», para que la pantalla nunca se vea vacía delante de un socio o un inversionista.
 */
import logo from '../../assets/inicio/logo.png';
import heroHamburguesa from '../../assets/inicio/hero-hamburguesa.png';
import iconoCampana from '../../assets/inicio/icono-campana.png';
import iconoCupon from '../../assets/inicio/icono-cupon.png';
import iconoLupa from '../../assets/inicio/icono-lupa.png';
import iconoFiltros from '../../assets/inicio/icono-filtros.png';
import iconoBilletera from '../../assets/inicio/icono-billetera.png';
import iconoEstrella from '../../assets/inicio/icono-estrella.png';
import iconoCorazon from '../../assets/inicio/icono-corazon.png';
import iconoEnvio from '../../assets/inicio/icono-envio.png';
import navInicio from '../../assets/inicio/nav-inicio.png';
import navPedidos from '../../assets/inicio/nav-pedidos.png';
import navFavoritos from '../../assets/inicio/nav-favoritos.png';
import navCuenta from '../../assets/inicio/nav-cuenta.png';
import servicioComida from '../../assets/inicio/servicio-comida.png';
import servicioMercado from '../../assets/inicio/servicio-mercado.png';
import servicioEnvios from '../../assets/inicio/servicio-envios.png';
import servicioFarmacia from '../../assets/inicio/servicio-farmacia.png';
import servicioMoto from '../../assets/inicio/servicio-moto.png';
import servicioLicores from '../../assets/inicio/servicio-licores.png';
import servicioCarro from '../../assets/inicio/servicio-carro.png';
import servicioMas from '../../assets/inicio/servicio-mas.png';
import rellenoCombo from '../../assets/inicio/relleno-combo-familiar.png';
import rellenoOfertaHamburguesa from '../../assets/inicio/relleno-oferta-hamburguesa.png';
import rellenoOfertaSushi from '../../assets/inicio/relleno-oferta-sushi.png';
import rellenoRestHamburguesas from '../../assets/inicio/relleno-restaurante-hamburguesas.png';
import rellenoRestSushi from '../../assets/inicio/relleno-restaurante-sushi.png';
import rellenoRestPizza from '../../assets/inicio/relleno-restaurante-pizza.png';

export const IMG = {
  logo,
  heroHamburguesa,
  iconoCampana,
  iconoCupon,
  iconoLupa,
  iconoFiltros,
  iconoBilletera,
  iconoEstrella,
  iconoCorazon,
  iconoEnvio,
  nav: { inicio: navInicio, pedidos: navPedidos, favoritos: navFavoritos, cuenta: navCuenta },
  servicios: {
    comida: servicioComida,
    mercado: servicioMercado,
    envios: servicioEnvios,
    farmacia: servicioFarmacia,
    moto: servicioMoto,
    licores: servicioLicores,
    carro: servicioCarro,
    mas: servicioMas,
  },
  relleno: {
    combo: rellenoCombo,
    ofertas: [rellenoOfertaHamburguesa, rellenoOfertaSushi],
    restaurantes: [rellenoRestHamburguesas, rellenoRestSushi, rellenoRestPizza],
  },
} as const;

/** Foto de muestra según la categoría del restaurante (cuando no subió la suya). */
export function fotoDeRelleno(categoria: string, indice: number) {
  const c = categoria.toLowerCase();
  if (/pizza/.test(c)) return rellenoRestPizza;
  if (/sushi|japon|asi/.test(c)) return rellenoRestSushi;
  if (/hamburg|burger|americ/.test(c)) return rellenoRestHamburguesas;
  return IMG.relleno.restaurantes.at(indice % 3) ?? rellenoRestHamburguesas;
}

/** Ícono de cada servicio y de cada pestaña (mapas, para no indexar objetos con texto). */
export const ICONO_SERVICIO = new Map<keyof typeof IMG.servicios, number>(
  Object.entries(IMG.servicios) as [keyof typeof IMG.servicios, number][],
);
export const ICONO_NAV = new Map<keyof typeof IMG.nav, number>(
  Object.entries(IMG.nav) as [keyof typeof IMG.nav, number][],
);
