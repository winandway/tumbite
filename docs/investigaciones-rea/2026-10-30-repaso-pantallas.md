# Repaso de pantallas en el sitio de pruebas con REA (Etapa 1, punto 2)

Fecha: 30 de octubre de 2026. País: todos los países. Sitio: staging.tumbite.com, tamaño de celular (375 × 812).

## Evidencia

- Paquete REA: `evidencia-rea-2026-10-30-repaso-pantallas.json`
  (sha256 `12a12e96db7fdf42bc12bb229ac74f53542d7b9a420d69f3055a236d8ebc1eee`, después de quitar las
  sesiones demo, que además se cerraron al terminar).
- Capturas [REA] de cinco recorridos con consola, errores de página y red:
  1. Web pública en inglés y español: portada, cómo funciona, restaurantes, repartidores, Docs,
     franquicias, empresas.
  2. App web del cliente con la cuenta demo: inicio, buscar, restaurantes, tiendas, pedidos, cuenta,
     carrito, favoritos, avisos, paquetes, viaje, Mercado, Moto y Más (14 pantallas, 40 respuestas del
     servidor, todas 200).
  3. App web del repartidor: inicio, pedidos, ganancias y perfil (en inglés y en español).
  4. Panel del restaurante: inicio, mi restaurante, menú, pedidos, beneficios, regalos, reseñas,
     equipo, productos y empresa (10 pantallas, todas las respuestas 200).
- Las sesiones se abrieron por el servidor (nunca se escribió una contraseña en la página) y se
  cerraron al final: las tres responden 401.

## Hallazgos

| #   | Dónde                                                             | Qué se vio [REA]                                                                         | Causa                                                                                    | Arreglo                                                                                            |
| --- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Todas las pantallas que sirve el servidor (web y app del cliente) | Error en consola: el script de estadísticas de Cloudflare viola la política de seguridad | El borde inyecta `static.cloudflareinsights.com` y la política de scripts no lo permitía | Se permite solo ese dominio en `script-src`. Candado C-CSP-ESTADISTICAS, prueba en rojo y en verde |
| 2   | Driver · inicio (español)                                         | «0h 0m Conectado» al lado de «Desconectado»                                              | La etiqueta del tiempo en línea decía «Conectado»                                        | «En línea» (inglés: «Time online»)                                                                 |
| 3   | Driver · ganancias · «Tu año»                                     | «1 entregas»                                                                             | Plural fijo                                                                              | Singular con una entrega («1 entrega», «1 delivery»)                                               |

Sin hallazgos: ninguna pantalla dio error de página, ninguna petición al servidor falló y todas
cargaron con la sesión correcta.

## Límites

- [REA] solo sobre nuestras apps en el sitio de pruebas. No se tocó ninguna app de terceros.
- Las apps nativas (Android y iPhone) no se recorrieron aquí: se recorrió su versión web, que
  comparte el mismo código de pantallas.
- Los cambios de Driver se suben a Google Play cuando Google apruebe la revisión en curso (candado
  C-PLAY-NO-CANCELAR); mientras tanto quedan acumulados.

## Pruebas de aceptación

- La política de seguridad permite exactamente: el propio sitio, Stripe, Turnstile y las
  estadísticas de Cloudflare (prueba en `apps/servidor/src/app.test.ts`).
- Un nuevo recorrido con REA no muestra errores de consola por la política de seguridad.

## Publicación

Aprobado en el sitio de pruebas el 30 oct 2026 (corrida completa en verde, incluido el recorrido de Comida) y publicado en producción por el flujo permanente. Las apps (Driver) suben a Google Play en la próxima versión acumulada, cuando Google apruebe la revisión en curso.
