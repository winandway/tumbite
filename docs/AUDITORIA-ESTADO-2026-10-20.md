# Dónde estamos — auditoría del 20 oct 2026

> Para leer con el equipo y responder con un solo mensaje (plantilla al final). Fuentes: el registro único `docs/RECONCILIACION-FASE-2.md`, la solicitud `docs/SOLICITUD-AUTORIZACIONES-2026-10-20.md`, `PENDIENTES.md` y `docs/ROADMAP.md`.

## 1. En una frase

**La plataforma está construida y publicada en tumbite.com, y probada de punta a punta en el sitio de pruebas con dinero de prueba. No está lanzada: no está en las tiendas de apps, no se ha cobrado con dinero real y no hay un piloto en la calle.** Lo que falta para lanzar en Miami depende casi todo de cuentas y decisiones de Richard.

## 2. El camino, etapa por etapa

| Etapa                                      | Qué es                                                                                           | Estado                                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| 0 — Bases                                  | Sitio de pruebas, correo, administrador, reloj y respaldo                                        | ✅ Hecha                                                                          |
| 1 — Dinero de punta a punta                | Cobro con tarjeta, pago al restaurante y al repartidor                                           | 🟡 Construida y probada con dinero de prueba; **falta la compra real** (fila 5.1) |
| 2, 2½ y 2¾ — Operar como los grandes       | Ciclo del pedido, despacho, foto y PIN, chat, quejas, reseñas, favoritos, cupones                | ✅ Publicadas                                                                     |
| Fase 2 — Internacional                     | Varias ciudades y países, franquicias, cobro en mano (efectivo, transferencia, pago en el local) | ✅ Construida; Colombia y Venezuela **apagados** a propósito                      |
| 3 — Tiendas y lanzamiento cerrado en Miami | Apps en App Store y Google Play, prueba en la calle, pocos restaurantes                          | 🔴 **Aquí estamos.** Bloqueada por las cuentas de Apple, Google, Expo y Firebase  |
| 4 — Crecer                                 | Pedido programado, suscripción, pedido en grupo, mercado, farmacia, motos y carros…              | ⏳ Después del lanzamiento (31 ideas anotadas)                                    |

## 3. Qué funciona hoy (comprobado)

- Tres apps (cliente, restaurante, repartidor) y paneles web, en inglés y español.
- Pedido completo: menú, carrito, pago con tarjeta dentro de la app, seguimiento en el mapa, chat, foto de recogida y de entrega, PIN, propina, reseña y queja.
- Restaurantes: alta con verificación, pedidos con alarma, horarios, equipo, menú y su dinero.
- Repartidores: oferta con el pago antes de aceptar, ganancias, saldo, pausa y ayuda.
- Superadmin y franquicias: ciudades dibujadas en el mapa, bandeja de soporte, control del dinero, salud del sistema y, desde hoy, los errores del servidor a la vista.
- Respaldo diario de la base, con la restauración probada en cada verificación.
- El cobro en mano (efectivo y transferencia al repartidor) funciona, pero está apagado en todos los países hasta que Richard decida.

## 4. Qué falta de nuestro lado (técnico)

| Qué                                                              | Por qué todavía no                                       | Cuándo                                                                     |
| ---------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| GPS del repartidor con la app en segundo plano, y navegación     | El código está; hay que probarlo en un teléfono real     | Cuando estén las apps compiladas (necesita las cuentas de Expo y Firebase) |
| Firma al entregar (cuando se exija)                              | La verificación de edad ya está; falta la firma          | Antes de encender licores                                                  |
| Un solo correo público (hoy salen correos desde dos direcciones) | Arreglo pequeño                                          | Lo hago en la próxima ronda                                                |
| La web lee las ciudades del servidor (hoy la lista está fija)    | Arreglo pequeño                                          | Próxima ronda                                                              |
| Fichas y capturas de las tiendas                                 | Se toman al final, cuando las pantallas ya no cambien    | Justo antes de subir a las tiendas                                         |
| Copia separada de la base y los archivos                         | Espera el «sí» a la fila 2.1                             | Al aprobarse                                                               |
| Precio en dólares cobrado en bolívares (Venezuela)               | Diseñado; espera la decisión 7.4                         | Si se aprueba                                                              |
| Pasarela de pagos de Colombia (tarjeta, PSE, Nequi)              | Necesita el contrato del socio de Bogotá con la pasarela | Cuando exista ese contrato                                                 |

## 5. Qué depende de Richard, en palabras simples

Los números son los de la solicitud única.

- **5.1 — Compra real.** Comprar en tumbite.com con tu tarjeta un plato de un dólar (se cobran 4,99) y devolver 1,00. Es la única forma de demostrar que el cobro real funciona. **Es lo más importante.**
- **6.1 a 6.4 — Cuentas de Apple, Google Play, Expo y Google (Firebase).** Sin ellas las apps no llegan a los teléfonos ni a las tiendas. Abrirlas exige tu identidad y tu tarjeta; lo técnico lo hago yo.
- **1.1 a 1.4 — Configuraciones gratis:** el aviso de Stripe para las cuentas de los restaurantes y el escudo anti-robots de la entrada. Solo hace falta tu «sí»; las hago yo.
- **6.6 — Terminar la activación de Stripe Connect en modo prueba:** para que un restaurante pueda activar sus cobros en el sitio de pruebas.
- **2.1 — Copia separada:** un almacén en otra cuenta para que, si se pierde el principal, no se pierdan la base, las fotos y las verificaciones. Hoy cuesta cero.
- **3.1 — Ciudades de prueba de Colombia y Venezuela en el sitio de pruebas:** permiso para que la prueba automática en pesos y bolívares también corra allá (hoy solo corre en esta computadora). No toca producción ni dinero real.
- **4.1 — Restaurar un respaldo en el sitio de pruebas:** permiso para borrar lo que haya en el sitio de pruebas y volver a un día anterior, para demostrar que el respaldo sirve de verdad. No toca producción.
- **7.1 a 7.6 — Decisiones de dinero:** quién paga la comida comprada y no entregada, qué pasa con una transferencia sin confirmar, la recarga disputada, la tasa de Venezuela, las tarifas de cada país.
- **Otras de la fila:** número de WhatsApp de soporte, nombre del negocio que sale en el cobro de la tarjeta, abogado para los textos legales y la marca, y la prueba en la calle con tres cuentas.
- **Nuevo:** elegir el nombre definitivo (`docs/NOMBRES-PROPUESTOS-2026-10-20.md`).

## 6. Orden recomendado para lanzar en Miami

1. **5.1** compra real.
2. **6.1 a 6.4** cuentas de Apple, Google, Expo y Firebase → yo compilo las apps para teléfono real.
3. **1.1 a 1.4 y 6.6** configuraciones gratis.
4. **Nombre definitivo** (si se va a cambiar, antes de subir a las tiendas).
5. **Prueba en la calle** con tres cuentas.
6. **2.1** copia separada.
7. Subir a las tiendas y lanzamiento cerrado con pocos restaurantes.

Bogotá y Venezuela van aparte: decisiones 7.1, 7.2 y 7.5, el socio local, su pasarela y su abogado.

## 7. Plantilla de respuesta del equipo

Copiar, completar y mandar en un solo mensaje:

```
INICIO DEL PROMPT
Respuesta de Richard y su equipo a la auditoría del 20 oct (Tumbite).

Autorizaciones (sí / no por fila):
- 5.1 compra real:
- 6.1 a 6.4 cuentas (Apple, Google Play, Expo, Firebase): ya abiertas / las abrimos el día …
- 1.1, 1.2, 1.3, 1.4 configuraciones gratis:
- 6.6 Stripe Connect en modo prueba:
- 2.1 copia separada, con tope de 5 dólares al mes:
- 3.1 ciudades de prueba de Colombia y Venezuela en el sitio de pruebas:
- 4.1 restaurar un respaldo en el sitio de pruebas:

Decisiones:
- 7.1 comida comprada y no entregada:
- 7.2 transferencia sin confirmar:
- 7.3 recarga disputada:
- 7.4 tasa de Venezuela (construir sí / no):
- 7.5 tarifas de Colombia y Venezuela:

Nombre de la marca: finalistas … (o «seguimos con Tumbite»)
Prioridad del equipo: Miami primero / Bogotá primero / las dos
Otros datos (WhatsApp de soporte, nombre en el cobro de la tarjeta):
FINAL DEL PROMPT PARA Claude, sesión de Tumbite
```
