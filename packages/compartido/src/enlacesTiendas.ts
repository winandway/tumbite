/**
 * C-ENLACES-TIENDAS (4 nov 2026): las fichas públicas de las tres apps en Google Play (publicadas y
 * comprobadas ese día). Una sola lista para la web, los correos y las invitaciones. El App Store se
 * agrega cuando Apple apruebe cada app.
 */
export const GOOGLE_PLAY = {
  cliente: 'https://play.google.com/store/apps/details?id=com.windoce.tumbite',
  driver: 'https://play.google.com/store/apps/details?id=com.windoce.tumbite.driver',
  restaurantes: 'https://play.google.com/store/apps/details?id=com.windoce.tumbite.restaurants',
} as const;
export type AppDivoox = keyof typeof GOOGLE_PLAY;
