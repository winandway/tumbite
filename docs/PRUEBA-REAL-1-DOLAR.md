# Prueba real de un dólar en tumbite.com — preparada, NO autorizada todavía (19 oct 2026)

Esta prueba mueve dinero real con una tarjeta de Richard. **No se ejecuta sin su autorización escrita** para esta prueba concreta (importe, tarjeta y fecha). La automatización de tareas no la autoriza.

## Qué demuestra

1. Que un cobro con tarjeta real llega a Stripe en modo real y el pedido avanza (cobro capturado al entregar).
2. Que una cancelación antes de que el restaurante acepte anula la autorización y no cobra nada.
3. Que una devolución después de cobrar llega a la tarjeta.

Con eso, el punto 4 de la auditoría y la fila «Probado con Stripe real» de `VERIFICAR-PAGOS.md` pasan a verde. Sin eso, los pagos de Estados Unidos **no** están comercialmente probados.

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

**Costo real estimado para Windoce:** la comisión de Stripe del pedido A (2,9 % + 0,30 = unos 0,44 dólares) no se recupera con la devolución. Total que sale de la tarjeta de Richard: 4,99 − 1,00 = **3,99 dólares**, que entran a la cuenta de Stripe de Windoce menos esa comisión.

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
