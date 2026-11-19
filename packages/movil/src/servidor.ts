import { elegirServidor } from '@tumbite/compartido/src/entornos';

/**
 * C-FRANJA-SOLO-EN-PRUEBAS (18 nov 2026) — todos los países. La dirección del servidor con el que
 * habla esta app. Este archivo NO importa nada más de la app, a propósito: estaba en `sesion.tsx`,
 * que forma un círculo de importaciones con otras pantallas, y la franja «PRUEBAS» la leía antes
 * de que tuviera valor. Sin valor, la app se creía «de pruebas» y la versión de la tienda (46 del
 * cliente, 42 de Driver) pintó la franja a todo el mundo. No le agregues importaciones.
 *
 * En la web, la app habla con el sitio que la sirvió (pruebas con pruebas, producción con
 * producción); en el celular, con la dirección fijada al construir (C-ENTORNOS-SEPARADOS).
 */
export const URL_SERVIDOR = elegirServidor(
  typeof window !== 'undefined' && window.location?.origin ? window.location.origin : null,
  process.env.EXPO_PUBLIC_API_URL,
);
