# Prueba real con tarjeta en tumbite.com: autoriza 4,99 dólares y devuelve 1,00 — preparada, NO autorizada (19 oct 2026)

> **Corrección del 19 oct:** el nombre «prueba de un dólar» engañaba. El plato cuesta 1,00, pero con el servicio mínimo y el cargo por pedido pequeño la tarjeta **autoriza y cobra 4,99 dólares**; la devolución es **parcial, de 1,00**. Lo que esta prueba demuestra y lo que NO demuestra está abajo, en «Límites».

Esta prueba mueve dinero real con una tarjeta de Richard. **No se ejecuta sin su autorización escrita** para esta prueba concreta (importe, tarjeta y fecha). La automatización de tareas no la autoriza.

## Qué demuestra

1. Que un cobro con tarjeta real llega a Stripe en modo real y el pedido avanza (cobro capturado al entregar).
2. Que una cancelación antes de que el restaurante acepte anula la autorización y no cobra nada.
3. Que una devolución después de cobrar llega a la tarjeta.

Con eso, en `VERIFICAR-PAGOS.md` pasan a verde **solo** estas tres filas: cobro real con tarjeta al recoger, anulación de una autorización real y devolución parcial real. Los pagos de Estados Unidos **siguen sin estar comercialmente probados** en todo lo que aparece en «Límites».

## Límites: lo que esta prueba NO demuestra

| No demuestra                                      | Por qué                                                                                                                            | Cómo se probaría después                                                                  |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| La entrega con repartidor                         | El pedido es «Recojo en el local»: no hay envío, ni oferta, ni GPS, ni foto de entrega, ni pago al repartidor                      | Piloto en la calle con un repartidor del equipo                                           |
| La liquidación al restaurante                     | Que el cobro se capture no prueba que la parte del restaurante llegue a su cuenta conectada de Stripe ni que el pago semanal salga | Restaurante con su cuenta conectada aprobada y un pago real a su banco, visto en su panel |
| Retiros del repartidor                            | Están apagados por decisión de Richard                                                                                             | Solo con su orden expresa                                                                 |
| Una devolución total                              | Solo se devuelve 1,00 de 4,99                                                                                                      | Otra operación autorizada, devolviendo el total                                           |
| Otros métodos                                     | Apple Pay y Google Pay no están en la app; efectivo, transferencia y recargas no pasan por esta prueba                             | Su propio piloto (ver `docs/PILOTO-POR-PAIS.md`)                                          |
| Disputas y contracargos                           | Requieren que el banco abra una disputa                                                                                            | Modo de prueba de Stripe (tarjetas de disputa) en staging                                 |
| Propina extra, cambio de dirección, plato agotado | No se usan en esta compra                                                                                                          | Ya probados en staging con Stripe de prueba; con dinero real, en el piloto                |
| Otras monedas                                     | La tarjeta solo se acepta en dólares (C-TARIFAS-PAIS)                                                                              | —                                                                                         |

## Con qué se hace (consultado en producción el 19 oct, solo lectura)

- **Restaurante:** «Restaurante el Beef USA», zona Novi (Michigan), aprobado y abierto, con un plato de 1,00 dólar.
- **Cuenta del cliente:** una cuenta de cliente de Richard en tumbite.com (no la de pruebas).
- **Modo de entrega:** «Recojo en el local», para no necesitar repartidor (la entrega con repartidor se prueba en la calle).
- **Tarifas vigentes en producción:** servicio 5 % con mínimo 1,99; pedido pequeño 2,00 si la comida no llega a 10,00; envío 0 al recoger; impuesto apagado.

## Importes

| Operación                                                    | Cliente paga                                                  | Qué tiene que pasar                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A. Compra de 1,00 dólar al recoger                           | 1,00 + 1,99 servicio + 2,00 pedido pequeño = **4,99 dólares** | Stripe muestra la autorización; al marcar «Entregado al cliente» con el PIN, el cobro se captura |
| B. Segunda compra igual, cancelada antes de aceptar          | **0 dólares** (la autorización de 4,99 se anula)              | Stripe muestra el pago «cancelado», sin cargo                                                    |
| C. Devolución de 1,00 dólar del pedido A desde el superadmin | Le vuelven **1,00 dólar**                                     | Stripe muestra el reembolso; el pedido guarda la devolución                                      |

**De dónde sale cada cifra (tarifas vigentes en producción, consultadas el 19 oct):** plato 1,00; servicio 5 % de 1,00 = 0,05, que sube al mínimo de 1,99; cargo por pedido pequeño 2,00 porque la comida no llega a 10,00; envío 0 por ser recogida; impuesto apagado. Total 4,99.

**Costo real estimado para Windoce:** la comisión de Stripe del pedido A (tarifa pública estándar de tarjetas en EE. UU., 2,9 % + 0,30 = unos 0,44 dólares; el contrato real de la cuenta puede ser otro) no se recupera con la devolución. La autorización anulada del pedido B no cobra comisión de procesamiento según la documentación de Stripe [pendiente de confirmar en el panel de la cuenta]. Total que sale de la tarjeta de Richard: 4,99 − 1,00 = **3,99 dólares**, que entran a la cuenta de Stripe de Windoce menos esa comisión. **Límite de dinero de la prueba: como máximo 4,99 dólares autorizados a la vez, dos veces (A y B); nada más.**

## Pasos (Richard toca la app; yo vigilo y anoto)

1. Richard entra a tumbite.com/app con su cuenta de cliente, abre «Restaurante el Beef USA», agrega el plato de 1,00 y elige «Recojo en el local».
2. Paga con su tarjeta dentro de la app.
3. Yo confirmo en la base (solo lectura) que el pedido quedó «pagado» y que el cobro quedó autorizado; el restaurante acepta y marca listo.
4. Al recoger, se marca «Entregado al cliente» con el PIN: el cobro se captura.
5. Richard repite la compra (operación B) y la cancela desde la app antes de que el restaurante acepte.
6. Desde el superadmin se devuelve 1,00 dólar del pedido A (operación C).
7. Richard me pega las tres líneas que muestra su banco (o el panel de Stripe): cobro de 4,99, anulación y reembolso de 1,00.

## Evidencias que se guardan en `VERIFICAR-PAGOS.md`

- Fecha y hora, identificador de cada pedido, identificador del pago en Stripe (no el número de la tarjeta).
- Estado del pedido, del cobro y de la devolución en la base.
- Captura del panel de Stripe o del banco de cada operación (la trae Richard; Tumbite no entra a su banco).

## Lo que necesito de Richard

Una línea: «Autorizo la prueba real de 4,99 dólares con mi tarjeta, con cancelación y devolución de 1,00 dólar, el día X». Y estar con el celular para pagar y confirmar en su banco.
