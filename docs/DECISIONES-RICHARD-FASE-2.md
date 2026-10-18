# Decisiones que solo Richard puede tomar — Fase 2 (actualizado 18 oct 2026)

Lista viva. Cada punto dice qué se decide, qué hay hoy por defecto (sin inventar quién pierde) y qué se destraba. Nada de esto frena el trabajo técnico: se avanza con el valor por defecto y se cambia cuando Richard diga.

## Dinero en Estados Unidos

1. **Impuesto de ventas.** Tasa (Miami-Dade 7 %: 6 % estatal + 1 % condado) y qué se grava además de la comida (envío, servicio). Hoy: 0 % (apagado) en Dinero → Impuesto de ventas; la base guarda `impuesto` por pedido. Falta el código fiscal de comida preparada con el contador y el registro en Florida (Stripe Tax Complete, desde 90 dólares al mes, o a mano).
2. **Quién asume cada devolución después de entregar** (comida fría, faltante, pedido equivocado). Hoy: la asume Tumbite por defecto; el superadmin puede cargarla al restaurante o al repartidor caso por caso.
3. **Disputas (contracargos).** Si una disputa abierta bloquea el retiro de ese dinero al restaurante o al repartidor mientras se resuelve. Hoy: no bloquea; solo avisa y pone el canario en rojo. Stripe cobra 15 dólares por disputa recibida y 15 por contestada (se devuelven si se gana).
4. **Retiros:** retiro mínimo (hoy 1 dólar; recomendado 10 porque Stripe cobra 25 centavos), frecuencia, y cuándo encender el interruptor (ahora está en Dinero → Retiros a banco; solo Richard, con confirmación).
5. **Compra real de un dólar** en tumbite.com para dar los pagos por probados (regla global).
6. **Segundo endpoint de Stripe** para cuentas conectadas (`STRIPE_WEBHOOK_SECRET_CONECTADAS`) y el aviso `transfer.created`: hay que crearlos en el panel de Stripe (ver `VERIFICAR-PAGOS.md`).
7. **Apple Pay y Google Pay:** interruptores en Stripe e identificador de comercio en Apple.

## Modelo internacional (cobro directo, capital del repartidor, recargas)

8. **Entidad por país.** Colombia: S.A.S. colombiana propia, dLocal como «merchant of record» con Windoce LLC, o franquiciado local que contrate la pasarela (Wompi necesita RUT y cuenta Bancolombia). Venezuela: **conclusión pendiente de validación profesional.** El estudio del 18 oct encontró que recaudar y repartir dinero de terceros exige autorización del BCV como proveedor no bancario (y que no se otorgan nuevas desde 2021), que la norma excluye los prepagos de servicios y que además aplican sanciones de EE. UU. Que «solo el cobro directo es viable» NO está establecido: también podrían caber el cobro con tarjeta internacional en dólares y el saldo para comisiones. Lo valida un abogado venezolano y uno de sanciones (fichas `docs/investigaciones-rea/2026-10-18-pagos-venezuela.md` y `2026-10-18-stripe-por-producto-y-bcv.md`).
9. **Comisión de Tumbite por país y por pedido** (porcentaje sobre la comida, cargo fijo, o ambos) y **cuánto gana el repartidor** por entrega en cada país.
10. **Remuneración de los puntos de venta** de recargas (porcentaje por recarga vendida), **límites** (recarga mínima y máxima por día, saldo máximo) y **reglas de devolución** de una recarga.
11. **Tope de efectivo y pedidos sin capital:** si un repartidor sin saldo prepago suficiente puede aceptar un pedido en efectivo, y qué pasa con la comisión (reserva al aceptar; hoy no se habilita saldo negativo ni crédito).
12. **Monedas y tasa:** en Venezuela, precios en dólares convertidos a bolívares con la tasa BCV del día (fuente oficial, fecha, redondeo); en Colombia, pesos sin decimales. ¿Se acepta efectivo en dólares en Venezuela? ¿Zelle fuera de la app con referencia?
13. **Pérdidas:** quién asume la comida cuando el cliente no aparece o no paga tras la compra del repartidor (nunca se inventa: hoy queda registrado como «pendiente de decisión» en el libro).
14. **Confirmación de transferencias al repartidor:** manual (el repartidor confirma en su banco) hasta contratar un lector autorizado (Mercantil API o Pabilo, desde 35 dólares al mes) — decidir si se contrata y con qué cuenta.
15. **Abogados:** colombiano (retención de saldos en billetera, 4x1000, retenciones), venezolano (licencia BCV, IGTF 3 %, SUNDDE) y de EE.UU. (sanciones a Venezuela, Stripe con tarjetahabientes venezolanos).

## Nuevas del recorrido internacional completo (18 oct 2026, tarde)

20. **Comida comprada y no entregada.** Si el pedido se cancela (soporte, cliente que no paga, repartidor soltado por soporte) después de que el repartidor pagó la comida en el local, hoy queda escrito en el libro como «comida comprada sin entregar», pendiente de decisión. Falta decidir quién la absorbe: el repartidor, el restaurante (si la recibe de vuelta), el cliente (como deuda) o Tumbite. Es la decisión 13 aplicada al pago en el local.
21. **Excedente del cliente.** Si el cliente paga de más (por ejemplo, una transferencia repetida), hoy queda escrito que el repartidor le debe la diferencia. Falta decidir el plazo para devolverla y qué pasa si no la devuelve.
22. **Transferencia por verificar.** Hoy el repartidor puede entregar con la transferencia sin ver y confirmarla después (o 0 si no llegó). Falta decidir el plazo máximo antes de que soporte intervenga.
23. **Tolerancia del ticket.** Hoy cualquier diferencia entre el ticket, lo que pagó el repartidor y lo que esperaba la app deja la conciliación «con diferencia» para soporte. Falta decidir si hay una tolerancia (por ejemplo, redondeos) que no abra revisión.

## Cuentas y accesos

16. Apple Developer, Expo (organización y proyecto), Firebase, Google Maps Android, Twilio, Checkr, Turnstile (las dos llaves), Wompi/dLocal (contacto comercial), Mercantil (cuenta jurídica y credenciales del portal).
17. Cambiar las contraseñas de prueba que quedaron en el historial del repositorio.
18. Aprobar el Worker de tiempo real de Cloudflare en producción.

## Piloto

19. Prueba en la calle con el plan de `docs/PLAN-DE-PRUEBA-EN-CALLE.md` y, si el lanzamiento es simultáneo, un piloto por país con la misma compuerta.
