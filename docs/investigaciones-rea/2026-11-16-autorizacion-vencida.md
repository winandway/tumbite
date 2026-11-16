# Ficha: autorización de tarjeta vencida antes de la entrega (C-AUTORIZACION-VENCIDA)

16 nov 2026 · todos los países con tarjeta (hoy EE. UU.) · rama `claude/monitoreo-superadmin-4c2586`.

## 1. El problema real

- Pedido de pruebas 407F (sitio de pruebas): pagado el 8 nov, entregado el 16 nov. La tarjeta se autorizó al pedir (`capture_method: manual`) y la captura de la entrega falló porque la autorización ya había vencido. La liquidación quedó en `revision`, la pieza `cobros` del canario en `error` y `/datos/salud` en 503.
- Otra sesión lo cerró a mano por SQL como «no aplica». No había botón en el superadmin y no había aviso previo: con dinero real pasará cada vez que un pedido tarde más que la autorización.

## 2. Referencias y evidencia

| Hallazgo                                                                                                                                                                                                                                            | Etiqueta | Fuente                                                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Una autorización sin capturar vence; al vencer se sueltan los fondos y el pago pasa a `canceled`.                                                                                                                                                   | [DOC]    | Stripe, «Place a hold on a payment method» (docs.stripe.com/payments/place-a-hold-on-a-payment-method), leído el 16 nov 2026 |
| Ventanas en compras sin tarjeta presente: Visa 7 días si la inicia el cliente (CIT) y 5 días si la inicia el comercio (MIT; exactamente 4 días y 18 horas); Mastercard, American Express y Discover 7 días. En persona (Terminal): 2 días (Visa 5). | [DOC]    | Misma página, tabla «Authorization validity windows»                                                                         |
| Stripe y la red deciden CIT o MIT por señales de la persona, no solo por `off_session`.                                                                                                                                                             | [DOC]    | Misma página                                                                                                                 |
| `payment_method_details.card.capture_before` en el cargo dice cuándo vence la autorización exacta.                                                                                                                                                  | [DOC]    | Misma página                                                                                                                 |
| Autorizaciones extendidas (hasta 30 días) solo para algunos rubros y cuentas; captura automática diferida en vista previa privada.                                                                                                                  | [DOC]    | Misma página y «Extended authorization»                                                                                      |
| Uber: al agregar un método de pago, el usuario autoriza guardarlo y cobrar con él «Charges» futuros; si el método elegido falla, puede usar otro de su billetera.                                                                                   | [DOC]    | Términos de uso de Uber, EE. UU., sección de pagos (leídos el 16 nov 2026)                                                   |
| DoorDash: la página de ayuda pública de cargos pendientes no trae el texto del artículo sin entrar. Cómo re-autoriza por dentro.                                                                                                                    | [NV]     | Centro de ayuda público de DoorDash                                                                                          |
| Los grandes vuelven a cobrar con el método guardado cuando la retención se pierde, en vez de perdonar el pedido.                                                                                                                                    | [INF]    | Deducido de los términos de Uber; no se puede ver su sistema interno                                                         |

REA: no se ejecutó sobre apps de terceros (prohibido) ni hizo falta sobre las nuestras: el fallo tiene causa clara y reproducible (Stripe devuelve `canceled` en la captura). La comprobación se hizo con la prueba en rojo y en el panel local con Stripe simulado.

## 3. Diagrama

```
pedir ──► autorizar (manual) ──► [pedido abierto]
                                   │
                    96 h sin capturar ──► reloj (cada hora): UNA fila «autorizacion_por_vencer»
                                   │       + correo al equipo de dinero; canario «autorizaciones: pendiente»
                                   ▼
entregar ──► liquidación ──► capturar ──► OK ──► capturada
                                   │
                              canceled ──► revision (salud 503)
                                   │
              Ficha del pedido: «Resolver autorización vencida» (consulta Stripe)
                 ├─ (a) volver a cobrar: off_session con la tarjeta guardada
                 │       solo si setup_future_usage = off_session y la tarjeta sigue en el cliente;
                 │       control dual por encima del límite; clave fija recobro-<pedido>;
                 │       antes, busca en Stripe un cobro con metadata.recobro_de = pago viejo
                 │       ──► capturada (pago nuevo en pedidos.stripe_pago/stripe_sesion,
                 │           «cobro_reautorizado:<viejo>» para la conciliación)
                 └─ (b) cerrar sin cobro: nota obligatoria; solo si Stripe dice canceled
                         ──► no_aplica (Divoox asume; saldo de restaurante y repartidor se conserva)
              Las dos: bitácora «autorizacion_resuelta» (quién, segunda firma, nota) y acciones_equipo.
```

## 4. Comparación con Divoox antes del cambio

- Antes: la captura vencida dejaba la entrega en `revision` para siempre; el superadmin solo tenía «Reintentar» (fallaba igual) y «Confirmar» (solo si Stripe ya cobró). Ningún aviso previo.
- Se reutiliza: el cobro `off_session` con la tarjeta guardada de la propina después de entregar, el registro de reautorización `cobro_reautorizado:<pago>` del cambio de dirección (la conciliación de diagnóstico exige el viejo anulado), el control dual (`hacerOPedirAprobacion`) y el intermedio de permisos (403, 404 fuera de zona, `acciones_equipo`).

## 5. Decisión

- Permiso nuevo `dinero.resolver_autorizacion` (delicado, mueve dinero) en Finanzas, Supervisor y Total. La consulta es de lectura (`pedidos.ver`). Las tres rutas son ficha del pedido: fuera de la zona, 404.
- Aviso a las 96 horas: antes del plazo más corto (4 días y 18 horas).
- «Cerrar sin cobro»: Divoox asume el monto; el restaurante y el repartidor conservan su saldo (decisión de Richard del 16 oct: en revisión se conserva el saldo). La conciliación del día ya no espera captura de esa entrega.

## 6. Pruebas de aceptación

`apps/servidor/src/autorizacionVencida.test.ts` (14), `apps/panel/src/panel/ResolverAutorizacion.test.tsx` (3), `apps/panel/src/sitio/docs/operaciones.test.ts`. Cada una vista en rojo quitando su pieza (ver CANDADOS.md).

## 7. Sin probar

Nada con Stripe de prueba real en el sitio de pruebas todavía (ver VERIFICAR-PAGOS.md, sección C-AUTORIZACION-VENCIDA).
