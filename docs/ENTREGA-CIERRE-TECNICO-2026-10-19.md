# Entrega del cierre técnico — versión vigente: 20 oct 2026 (ronda de estabilidad y recuperación)

> **El MVP NO está terminado. Los pagos NO están probados con dinero real. El incidente de la foto de recogida NO está resuelto: su causa sigue sin confirmar.** Versión: publicado en c275d744 el 20 oct (staging verde en la corrida 39349948748, recorrido en inglés y español; producción con `publicar` 39353082904 y el verificador «después» en verde, pieza de errores en ok; punto de restauración previo `restauracion-2026-10-20-estabilidad` sobre cfc1cec7). Las rondas anteriores siguen abajo como historial.

## Estado vigente y evidencias

| Pieza                                           | Estado                                                                                                               | Evidencia                                                               |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| EE. UU., tarjeta                                | Publicado; probado en local y staging con Stripe de prueba                                                           | Recorrido es/en en staging (ver «Versión»)                              |
| EE. UU., efectivo y transferencia               | Apagados; probados en local y staging solo durante la corrida                                                        | Ídem                                                                    |
| Colombia (COP) y Venezuela (VES), cobro en mano | Probados **solo en local**, con cifras ficticias, en pantalla y por API; ahora aislados por corrida                  | C-RECORRIDO-AISLADO; staging espera la fila 3.1                         |
| Errores no controlados                          | Ahora quedan escritos y visibles (canario, superadmin, verificador)                                                  | C-ERRORES-VISIBLES                                                      |
| Foto de recogida (500 en staging del 19 oct)    | Huella reproducida en local; el reintento la completa sin duplicar; **causa sin confirmar**                          | `docs/INCIDENTE-FOTO-RECOGIDA-2026-10-19.md`, C-FOTO-RECOGIDA-REINTENTO |
| Restauración de la base                         | Se prueba en **cada** corrida con datos fijos; la variante con la base del recorrido dice «NO EJECUTADA» si no corre | C-RESTAURACION-SIEMPRE                                                  |
| Archivos (fotos, identidad, vehículo)           | **Sin copia**: el respaldo vive en el mismo almacén                                                                  | `docs/RECUPERACION-COMPLETA-2026-10-20.md`                              |
| Borrar la cuenta                                | Ahora borra también los documentos del vehículo, como prometía la política                                           | C-BORRADO-VEHICULO                                                      |

|                                     | Pruebas automáticas | Local en pantalla | Staging                 | Teléfono real | Dinero real |
| ----------------------------------- | ------------------- | ----------------- | ----------------------- | ------------- | ----------- |
| EE. UU., tarjeta                    | Sí                  | Sí                | Sí                      | No            | No          |
| EE. UU., cobro en mano              | Sí                  | Sí                | Sí (durante la corrida) | No            | No          |
| Colombia y Venezuela, cobro en mano | Sí                  | Sí                | **No**                  | No            | No          |
| Restauración                        | Sí (siempre)        | Sí                | **No** (fila 4.1)       | —             | —           |

## Trabajo técnico pendiente de nuestro lado

- Construir la copia separada de la base y los archivos cuando se autorice la fila 2.1.
- Construir la tasa USD/VES por pedido si Richard la aprueba (fila 7.4): diseño listo en `docs/DISENO-TASA-VES.md`.
- Cuando vuelva a fallar algo en staging o producción: leer «Errores del servidor» y corregir con prueba en rojo.

## Riesgos abiertos e impacto

| Riesgo                                                    | Impacto                                                                                      |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Pérdida del almacén o una llave robada                    | Se pierden base, respaldos, fotos de entrega y verificaciones: alto, hasta tener la fila 2.1 |
| Fallo esporádico de la foto de recogida                   | Bajo: el repartidor reintenta y nada se duplica; ahora se ve el mensaje                      |
| Cobro en mano fuera de EE. UU. sin staging ni dinero real | Bloquea encender esos países                                                                 |
| Tarjeta sin prueba con dinero real                        | Bloquea anunciar ventas (fila 5.1)                                                           |

## Decisiones y autorizaciones indispensables

Una sola solicitud: `docs/SOLICITUD-AUTORIZACIONES-2026-10-20.md` (siete grupos). Ninguna fila está autorizada. Las decisiones corregidas están en `docs/DECISIONES-PREPARADAS-2026-10-19.md`.

## Siguiente acción

Richard: fila 5.1 (compra real), fila 2.1 (copia separada) y decisión 7.1. Nosotros: construir lo que se autorice, en ese orden.

---

## Historial: entrega del 19 oct (tarde y noche)

## Entrega del cierre técnico — 19 de octubre de 2026 (tarde)

> **El MVP NO está terminado.** Corrige la entrega anterior (`docs/ENTREGA-RONDA-MVP-2026-10-19.md`), que decía que todo lo restante dependía de Richard aunque listaba trabajo técnico. Estado punto por punto: `docs/RECONCILIACION-FASE-2.md` (sección 10). Versión: publicado en 26649f68 el 19 oct (staging verde en la corrida 39310077342 con el recorrido completo en inglés y español; producción con `publicar` 39314512825 y el verificador «después» en verde; punto de restauración previo `restauracion-2026-10-19-cierre-tecnico` sobre 62a5d345).

## 1. El alcance, separado

### 1.1 Trabajo técnico que hicimos en esta ronda (con prueba en rojo, candado y Docs)

| Qué                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Candado                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Bandeja de soporte del cobro en mano** (requisito antes de encender efectivo o transferencia en cualquier país): transferencias por verificar, diferencias, excedentes, comida pagada y no entregada, pago en el local sin confirmar, incidencias, recargas disputadas y sin confirmar; importes y moneda, participantes, evidencias, bitácora, libro, historial, responsable, estado y «espera decisión»; acciones auditadas e idempotentes; nada se borra ni se compensa solo | C-BANDEJA-DINERO                         |
| Moneda del pedido en todo el recorrido (cliente, restaurante, repartidor, superadmin, recibos, avisos, Docs); el carrito usa las tarifas del país del restaurante; totales por moneda, nunca mezclados; EE. UU. sin cambios                                                                                                                                                                                                                                                       | C-MONEDA-RECORRIDO                       |
| Recarga con monto o moneda distintos en Stripe: no se acredita y abre una incidencia                                                                                                                                                                                                                                                                                                                                                                                              | C-BANDEJA-DINERO                         |
| Emitir un código, cerrar la conciliación de un pedido en mano, reserva al quitar un plato: sin estados a medias; el reloj retoma conciliaciones pendientes                                                                                                                                                                                                                                                                                                                        | C-CONCILIACION-ATOMICA, C-RESERVA-AJUSTE |
| Alta de miembros en una sola sentencia; purga de sesiones vencidas                                                                                                                                                                                                                                                                                                                                                                                                                | ídem                                     |
| Recorrido del cobro en mano completo, también en staging                                                                                                                                                                                                                                                                                                                                                                                                                          | C-COBRO-DIRECTO-STAGING                  |
| Restauración aislada de un respaldo real, verificada                                                                                                                                                                                                                                                                                                                                                                                                                              | C-RESTAURACION-AISLADA                   |

### 1.2 Trabajo técnico que queda de nuestro lado

- «Hoy» del repartidor ya suma los pedidos cobrados en mano (hecho en esta ronda). La billetera sigue siendo solo de Stripe a propósito (es dinero que pasa por Tumbite).
- Topes fijos que no sirven en pesos: bono de la oferta abierta (100), precio máximo de una opción (10000), propina máxima (50000), cupones sin zona y tope de reembolso de quejas. Necesitan cifras por país: **las cifras son decisión de Richard**; el código para leerlas por país es nuestro y va junto con las tarifas.
- Aviso de saldo bajo, motivos al cobrar, «No tengo con qué pagar», ganancias con «cobrado en mano» (no bloquean; cruce del 19 oct).

### 1.3 Configuración externa autorizada

Ninguna pendiente de ejecutar: no hay autorizaciones escritas para recursos nuevos.

### 1.4 Autorizaciones pendientes (una sola solicitud: `docs/SOLICITUD-AUTORIZACIONES-2026-10-19.md`)

Aviso de Stripe de cuentas conectadas (prueba y real), Turnstile, tres proyectos de Expo, Firebase, tiempo real en producción, restauración real en staging y la compra real con tarjeta.

### 1.5 Decisiones comerciales de Richard

Decisión 20 (quién absorbe la comida comprada y no entregada: **bloquea encender el efectivo**), decisión 22 (plazo de la transferencia por verificar: bloquea solo la transferencia), decisión 23 (tolerancia del ticket: no bloquea), tarifas de cada país, topes por país, qué hacer con el saldo de una recarga disputada, decisiones 1–4 (impuesto, devoluciones, disputas, retiros).

### 1.6 Pruebas que no se pueden hacer desde aquí

Teléfono real (apps compiladas con Expo), piloto en la calle, dinero real.

## 2. Recorridos comprobados

| Recorrido                                                                                                                                                 | Local (esta computadora)                | Staging (Stripe en modo prueba) | Teléfono real | Dinero real |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------- | ------------- | ----------- |
| Pedido con tarjeta completo, cliente, restaurante, repartidor y soporte, en celular, español e inglés                                                     | Verde                                   | Verde (corrida 39310077342)     | No            | No          |
| Cobro en mano: recarga por código, oferta con método y adelanto, reserva de la comisión, pago en el local y ticket, entrega y «Cobré» con la conciliación | Verde                                   | Verde                           | No            | No          |
| Transferencia «aún no me llega» (caso en la bandeja) y después confirmada                                                                                 | Verde                                   | Verde                           | No            | No          |
| Cliente ausente: no se deja en lugar seguro, «El cliente no pagó», deuda y comida como pérdida                                                            | Verde                                   | Verde                           | No            | No          |
| Soporte: bandeja con el caso, tomar y nota, pantalla en es/en                                                                                             | Verde                                   | Verde                           | No            | No          |
| Restauración de un respaldo                                                                                                                               | Aislada, verde (C-RESTAURACION-AISLADA) | Espera autorización             | —             | —           |

En staging el cobro en mano se enciende solo durante la corrida y solo para EE. UU. con las cuentas de la corrida; vuelve a quedar apagado. **Monedas:** las corridas son en dólares (no hay zonas de Colombia ni Venezuela); los pesos y bolívares están cubiertos por las pruebas automáticas (C-TARIFAS-PAIS, C-MONEDA-RECORRIDO).

**Fallos encontrados por el sitio de pruebas en esta ronda:** la lista de restaurantes es virtual con más de cien (la prueba ahora busca por nombre, como una persona) y un corte de red dejaba la app en «No pudimos confirmar tu sesión» (arreglado en el producto: C-SESION-REINTENTA). Un rechazo interno de GitHub y un corte de conexión del alojamiento se repitieron sin cambios y pasaron.

## 3. Riesgos técnicos restantes

| Riesgo                                                                                                          | Impacto                                                |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Alta simultánea de un miembro: protegida con una sola sentencia, pero no se pudo reproducir la carrera en local | Bajo: el peor caso era una persona en dos restaurantes |
| Detalle de una incidencia guardado solo en español                                                              | Bajo: lo lee soporte                                   |
| La bandeja recorre hasta 500 casos por tipo en cada consulta                                                    | Bajo hoy; revisar al crecer                            |
| Lo de 1.2                                                                                                       | Bloquea encender un país, no EE. UU.                   |

## 4. Estado por país y método

- **Estados Unidos:** tarjeta encendida y publicada; probada en staging con Stripe de prueba; **sin prueba con dinero real**. Efectivo, transferencia y recargas: apagados; probados de punta a punta en local y en staging con las cuentas de la corrida.
- **Colombia y Venezuela:** sin zona ni tarifas; el servidor no acepta pedidos allí. El código del cobro en mano y la bandeja ya existen; faltan las decisiones 20 y 22, las tarifas, lo de 1.2, la entidad local, los abogados y el piloto.

## 5. Próxima acción

De Richard: la decisión 20 y la solicitud de autorizaciones (empezando por la compra real con tarjeta). De nuestro lado: leer por país los topes fijos (bono, opción, propina, cupones, quejas) para que estén listos cuando Richard ponga las cifras.

---

## Actualización del 19 oct (noche): topes por país y evidencia internacional

Versión: publicado en cfc1cec7 el 19 oct (staging verde en la corrida 39330638689, en inglés y español; producción con `publicar` 39334118221 y el verificador «después» en verde; punto de restauración previo `restauracion-2026-10-19-topes-pais` sobre 26649f68). **El MVP sigue sin terminar y ningún país distinto de EE. UU. está listo para encenderse.**

### Qué quedó comprobado, por país y entorno

|                                                    | Pruebas automáticas | Local en pantalla                                                     | Staging                                     | Teléfono real | Dinero real |
| -------------------------------------------------- | ------------------- | --------------------------------------------------------------------- | ------------------------------------------- | ------------- | ----------- |
| EE. UU., tarjeta                                   | Sí                  | Sí (es/en)                                                            | Sí (es/en)                                  | No            | No          |
| EE. UU., efectivo y transferencia (apagados)       | Sí                  | Sí (es/en)                                                            | Sí (es/en, solo durante la corrida)         | No            | No          |
| Colombia, cobro en mano en COP (cifras ficticias)  | Sí                  | **Sí** (español): carrito, oferta, pago en el local, «Cobré», bandeja | **No**: staging no tiene zonas de otro país | No            | No          |
| Venezuela, cobro en mano en VES (cifras ficticias) | Sí                  | **Sí** (inglés), mismo recorrido                                      | **No**                                      | No            | No          |

En pantalla se comprobó lo que la persona toca (botones y campos de las apps). Por la API del producto se comprobaron los pasos sin pantalla propia en la prueba: aceptar, listo, recogida, llegada, entrega, transferencia, pago de menos, excedente, cliente ausente, conciliación.

### Defectos reales que encontró el recorrido en pesos y bolívares (arreglados)

1. La app del repartidor leía los pesos como dólares en el pago en el local (los multiplicaba por cien).
2. El carrito ofrecía las formas de pago de la ciudad guardada del cliente, no del restaurante.
3. Las tarifas de un país no aceptaban montos altos en su moneda.
4. El carrito ofrecía «Tarjeta» en pesos y bolívares, que el servidor rechaza.

### Riesgo abierto de esta ronda

- En una corrida de staging falló una vez la foto de recogida de un pedido de prueba y no se repitió en la siguiente. No se vio la respuesta del servidor (ahora la prueba la muestra si vuelve a pasar): **causa sin confirmar**, se vigila.

### Trabajo técnico que sigue pendiente

- Recorrido del cobro en mano en staging con una ciudad de otro país: espera permiso para crear allí un país y una ciudad de prueba (escritura en la base de staging).
- Decidir si se respalda también el almacén de fotos (hoy el respaldo es solo de la base).
- Lo demás de esta ronda quedó hecho.

### Autorizaciones y decisiones indispensables

Están en `docs/SOLICITUD-AUTORIZACIONES-2026-10-19.md` (grupos A a F) y `docs/DECISIONES-PREPARADAS-2026-10-19.md` (decisiones 20 y 22, tarifas, topes y recarga disputada, con recomendación e impacto). Ninguna está aprobada.

### Próxima acción

Richard: la decisión 20 y, si quiere ver el cobro en mano en staging en pesos, el permiso para crear allí un país y una ciudad de prueba con cifras ficticias, que se apagan al terminar.
