/**
 * Idiomas de la app. Regla de la casa: el español lleva la bandera de España
 * y el inglés la de Estados Unidos. Nunca otra bandera para el idioma.
 */
export const IDIOMAS = [
  { codigo: 'es', bandera: '🇪🇸', nombre: 'Español' },
  { codigo: 'en', bandera: '🇺🇸', nombre: 'English' },
] as const;

export type Idioma = (typeof IDIOMAS)[number]['codigo'];

export const IDIOMA_POR_DEFECTO: Idioma = 'es';

const TEXTOS = {
  es: {
    bienvenida: 'Comida rica, con ritmo, hasta tu puerta.',
    empezar: 'Empezar',
    'app.cliente': 'Pide comida',
    'app.repartidor': 'Reparte y gana',
    'app.restaurante': 'Recibe tus pedidos',
    'panel.titulo': 'Panel de Tumbite',
    'panel.restaurante': 'Mi restaurante',
    'panel.admin': 'Administración',
    'pie.derechos': 'Todos los derechos reservados.',
    'pie.desarrollo': 'Desarrollado por',
  },
  en: {
    bienvenida: 'Great food, with rhythm, right to your door.',
    empezar: 'Get started',
    'app.cliente': 'Order food',
    'app.repartidor': 'Deliver and earn',
    'app.restaurante': 'Receive your orders',
    'panel.titulo': 'Tumbite Dashboard',
    'panel.restaurante': 'My restaurant',
    'panel.admin': 'Admin',
    'pie.derechos': 'All rights reserved.',
    'pie.desarrollo': 'Developed by',
  },
} as const;

export type ClaveTexto = keyof (typeof TEXTOS)['es'];

/** Devuelve el texto en el idioma pedido; si falta, cae al español. */
export function t(idioma: Idioma, clave: ClaveTexto): string {
  // Las dos llaves vienen de tipos cerrados (Idioma y ClaveTexto), no de la persona usuaria.
  // eslint-disable-next-line security/detect-object-injection
  return TEXTOS[idioma][clave] ?? TEXTOS.es[clave];
}

export function esIdioma(valor: unknown): valor is Idioma {
  return IDIOMAS.some((i) => i.codigo === valor);
}
