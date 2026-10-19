# Entrega de la ronda MVP — 19 de octubre de 2026

> **El MVP NO está terminado.** Esta ronda cerró defectos y vacíos que dependían de nosotros y los publicó. Lo que falta depende de cuentas, autorizaciones, decisiones o pruebas reales de Richard (sección 6). Estado vigente punto por punto: `docs/RECONCILIACION-FASE-2.md`.

## 1. Qué quedó publicado (producción 62a5d345, verificada)

| Arreglo                                                                                                                                                        | Candado                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Tarifas y moneda del país en cada pedido; EE. UU. idéntico; un país sin tarifas no recibe pedidos; tarjeta solo en dólares                                     | C-TARIFAS-PAIS                     |
| Cobro en mano, oferta y saldo prepago en la moneda del pedido                                                                                                  | C-MONEDA-LOCAL                     |
| Conciliación diaria sin mezclar el cobro en mano ni monedas                                                                                                    | C-CONCILIACION-DIRECTA             |
| La oferta dice «efectivo/transferencia» y cuánto se adelanta en el local                                                                                       | C-COBRO-DIRECTO                    |
| Un pedido cobrado en mano no se deja en un lugar seguro                                                                                                        | C-SIN-LUGAR-SEGURO-DIRECTO         |
| Quince riesgos de dinero, permisos, evidencias y GPS                                                                                                           | C-RIESGOS-19OCT, C-RESERVA-ATOMICA |
| **La lista de restaurantes y el buscador fallaban con más de 100 restaurantes en una zona** (encontrado en staging; producción habría fallado igual al crecer) | C-LIMITE-PARAMETROS                |
| Copia diaria del sitio de pruebas                                                                                                                              | prueba en `respaldo.test.ts`       |
| Docs públicos del repartidor (oferta con cobro en mano, lugar seguro)                                                                                          | —                                  |

Cada arreglo tiene su prueba comprobada en rojo. Pruebas: 820 en verde, `npm run verify` en verde.

## 2. Recorridos comprobados

| Recorrido                                                                             | Dónde                                       | Resultado                                                                                                          |
| ------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Pedido completo en celular, español e inglés, con capturas (152)                      | Local                                       | Verde                                                                                                              |
| El mismo recorrido con Stripe en modo prueba                                          | Staging (corrida 39266539598)               | Verde, después de dos fallos reales del producto que se corrigieron (lista y buscador con más de 100 restaurantes) |
| Pedido en efectivo con pago en el local, recarga por código y cancelación con pérdida | Solo local (el paso 18 no corre en staging) | Verde                                                                                                              |
| Producción                                                                            | Verificador «después»                       | Verde                                                                                                              |

**No comprobado:** teléfono real (apps compiladas), operación en la calle, dinero real.

## 3. Cruce con los grandes (REA y documentación pública)

Ficha: `docs/investigaciones-rea/2026-10-19-cruce-procesos-mvp.md`. Conclusiones:

- En EE. UU. no apareció ningún vacío nuevo que frene la tarjeta.
- El diseño del servidor (tres estados, libro, reserva, prepago sin negativo) coincide con DiDi e inDrive [DOC]; no se rehace.
- Ninguna plataforma grande documenta la transferencia directa al repartidor [DOC/OBS]: es diseño propio de Tumbite y se confirma a mano.
- Para encender el cobro en mano en Colombia o Venezuela quedaban seis vacíos: cerrados hoy cuatro (moneda, conciliación, oferta, lugar seguro).

## 4. Diferencias decididas por nosotros (sin decisión comercial)

Lugar seguro prohibido en cobro en mano (como DoorDash); roles del equipo como DoorDash Merchant (staff opera, manager edita menú y horarios, dueño los datos); la oferta muestra el adelanto en el local (como DiDi y Rappi); la tarjeta no se ofrece fuera del dólar hasta construir la conversión de Stripe; la foto del ticket se conserva si el pedido quedó con diferencia.

## 5. Construido sin prueba real y riesgos abiertos

- Todo el cobro con tarjeta en EE. UU.: probado en staging, **no** con dinero real (`docs/PRUEBA-REAL-1-DOLAR.md`: autoriza 4,99, devuelve 1,00; no prueba entrega con repartidor, liquidación al restaurante, retiros ni devolución total).
- Cobro en mano y recargas: probados en simulación y local; **apagados** en todos los países.
- Abiertos: bandeja de soporte del cobro en mano (vacío 5); saldo de una recarga disputada (decisión); monto de Stripe que no cuadra en una recarga sin alarma; emitir y anular un código y cerrar la conciliación de un pedido en mano en dos pasos (sin duplicar dinero); sesiones vencidas sin purga; restauración real del respaldo sin probar; resto de pantallas en dólares.

## 6. Lo que solo Richard puede dar

| Qué                                                                                                                             | Para qué                                       |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Autorizar crear el aviso de Stripe de cuentas conectadas (prueba y real)                                                        | Activar cobros de restaurantes y repartidores  |
| Autorizar el widget de Turnstile                                                                                                | Escudo anti-robots en entrar y registrarse     |
| Autorizar los tres proyectos de Expo y Firebase                                                                                 | Avisos al celular y apps en el teléfono        |
| Autorizar la compra real con tarjeta (4,99, anulación, devolución de 1,00)                                                      | Primera evidencia de dinero real               |
| Autorizar una restauración de prueba del respaldo en staging (borra los datos de pruebas desde la copia)                        | Probar que el respaldo sirve                   |
| Cuentas de Apple, Google Maps Android, Twilio, Checkr                                                                           | Tiendas, mapa, llamada oculta, antecedentes    |
| Decisiones 1–4 y 20–23 (`docs/DECISIONES-RICHARD-FASE-2.md`), tarifas por país, qué hacer con el saldo de una recarga disputada | Impuesto, devoluciones, retiros, cobro en mano |
| Clave de Expo expuesta                                                                                                          | Cerrar la exposición                           |

## 7. Estado por país y método

- **Estados Unidos:** tarjeta encendida y publicada, sin prueba con dinero real. Efectivo, transferencia y recargas apagados.
- **Colombia:** no hay zona ni tarifas; el servidor ya no aceptaría pedidos con cifras en dólares. Falta entidad local, abogado, tarifas en pesos, pantallas en pesos y piloto.
- **Venezuela:** igual que Colombia, más la validación del BCV y de sanciones de EE. UU. (pendiente de abogado).

## 8. Siguiente acción

De nuestro lado: la bandeja de soporte del cobro en mano y pasar a la moneda del pedido el resto de las pantallas. Del lado de Richard: la compra real con tarjeta y las autorizaciones de la sección 6.
