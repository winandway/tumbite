import type { Idioma, Sustitucion } from '@tumbite/compartido';

/** Textos de las tiendas (Mercado, Farmacia, Licores y más) en la app del cliente. */
const ES = {
  verTiendas: 'Ver tiendas cerca',
  tiendasCerca: 'Tiendas cerca de ti',
  buscarProducto: 'Busca un producto en todas las tiendas',
  buscarEnTienda: 'Busca en esta tienda',
  sinTiendas: 'Todavía no hay tiendas de este tipo en tu zona.',
  fueraDeZona: 'Todavía no llegamos a tu zona.',
  productos: '{n} productos',
  abierta: 'Abierta',
  cerrada: 'Cerrada',
  todo: 'Todo',
  agregar: 'Agregar',
  agregado: 'Agregado',
  verCarrito: 'Ver carrito',
  sinResultados: 'No encontramos ese producto.',
  cargarMas: 'Ver más productos',
  porPeso: 'Precio estimado: se ajusta al pesarlo',
  antes: 'Antes',
  enTienda: 'En {tienda}',
  otraTienda:
    'Tu carrito es de otra tienda o restaurante. Termina ese pedido o vacía el carrito para comprar aquí.',
  vaciarYAgregar: 'Vaciar y agregar',
  siNoHay: 'Si no hay:',
  sustituciones: {
    reembolsar: 'Reembolsar',
    similar: 'Uno parecido',
    contactar: 'Avísame',
  } as Record<Sustitucion, string>,
  edad: 'Se pide identificación al entregar',
  reintentar: 'Reintentar',
  error: 'No pudimos cargar las tiendas. Revisa tu conexión.',
};

const EN: typeof ES = {
  verTiendas: 'See stores nearby',
  tiendasCerca: 'Stores near you',
  buscarProducto: 'Search a product in every store',
  buscarEnTienda: 'Search this store',
  sinTiendas: 'There are no stores of this kind in your area yet.',
  fueraDeZona: 'We don’t deliver to your area yet.',
  productos: '{n} products',
  abierta: 'Open',
  cerrada: 'Closed',
  todo: 'All',
  agregar: 'Add',
  agregado: 'Added',
  verCarrito: 'View cart',
  sinResultados: 'We couldn’t find that product.',
  cargarMas: 'See more products',
  porPeso: 'Estimated price: adjusted when weighed',
  antes: 'Was',
  enTienda: 'At {tienda}',
  otraTienda:
    'Your cart is from another store or restaurant. Finish that order or empty the cart to shop here.',
  vaciarYAgregar: 'Empty and add',
  siNoHay: 'If it’s out:',
  sustituciones: {
    reembolsar: 'Refund it',
    similar: 'Something similar',
    contactar: 'Ask me',
  },
  edad: 'ID is required at delivery',
  reintentar: 'Try again',
  error: 'We couldn’t load the stores. Check your connection.',
};

export const textosTiendas = (idioma: Idioma) => (idioma === 'en' ? EN : ES);
