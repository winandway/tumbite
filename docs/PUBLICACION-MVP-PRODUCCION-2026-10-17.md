# Publicación del MVP integrado en producción — 17 oct 2026

Autorizada por Richard para que el propietario pruebe el MVP en tumbite.com. No es un lanzamiento comercial.

## Qué se publicó

- Commit en main: `d22a9a6a` (unión de `fase-integracion-mvp` `c0483b1b`, la que pasó las 649 pruebas en staging).
- Paquete servido: yapanel-build `4a74590e` («deploy: d22a9a6a…»). Producción responde `d22a9a6` en la dirección de versión.
- Diferencia con lo probado en staging: solo el informe de staging (documento). Código idéntico.

## Condiciones

| #   | Condición                                               | Resultado                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-2 | Solo la integración probada, y comprobar que es esa     | `git diff c0483b1b d22a9a6a` = un documento                                                                                                                                                                                                                       |
| 3   | Punto de restauración                                   | Etiquetas `restauracion-antes-mvp-main` (655ff232) y `restauracion-antes-mvp-paquete` (ecb4712d), subidas                                                                                                                                                         |
| 4   | Tablas y columnas sin alterar datos                     | Esquema solo agrega (sin UPDATE/DELETE nuevos). Creadas: liquidaciones (0 filas), transiciones_pedido (12), columnas de pausa y señal (vacías), avisos_stripe.estado = «hecho». Pedidos, usuarios y restaurantes intactos; la incidencia del 15 oct sigue visible |
| 5   | Retiros, otros servicios y reloj de Cloudflare apagados | Retiros «pendiente», solo Comida, tiempo real «pendiente»                                                                                                                                                                                                         |
| 6-7 | Sin cobros ni pedidos con dinero real                   | No se hizo ninguno                                                                                                                                                                                                                                                |
| 8-9 | Publicar y verificar                                    | verify, publicar y semáforo en verde; verificador «despues» en VERDE                                                                                                                                                                                              |
| 10  | Reversión                                               | No hizo falta                                                                                                                                                                                                                                                     |

## Qué puede probar Richard sin mover dinero

- Página pública en inglés y español, selector de idioma, Cómo funciona, calculadora de franquicia, Docs y textos legales.
- Panel del restaurante: crear cuenta, ficha, horario, menú con opciones, lista de activación, ayuda «¿Cómo hago…?».
- Superadmin: aprobar restaurantes, ver pedidos y la salud del sistema; versión publicada visible.
- App del repartidor en la web: registro, foto de control y «Conectarme».
- App del cliente en la web: registro, restaurantes, menú, opciones de la pizza, carrito, recogida, en la puerta o en mano con PIN.
- **Detenerse antes de pagar.** Producción usa Stripe real: el botón de pagar autorizaría una tarjeta de verdad (se cobra al entregar). El pago completo se prueba en staging.

## Cómo revertir

Restaurar yapanel-build a `restauracion-antes-mvp-paquete` y main a `restauracion-antes-mvp-main` con commits de reversión, y correr el verificador `despues`. Las tablas nuevas pueden quedarse: el código anterior no las usa.
