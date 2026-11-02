# Repaso del roadmap de Divoox (1 nov 2026, tarde)

Pedido de Richard: «demos un repaso de qué falta y retomemos una parte del roadmap para terminarla
al 100%… sin preguntar, en piloto automático».

## Cómo está cada parte

| Parte                        | Estado                                                                 | Lo que falta                                                      | De quién         |
| ---------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------- |
| Comida                       | En producción                                                          | Compra real de 1 dólar, prueba en la calle, abrir Miami en la web | Richard          |
| Logística (Divoox Flex)      | En producción, ordenada el 1 nov                                       | Probar la ruta en la calle con las etiquetas                      | Richard          |
| Envíos de A a B              | En producción «solo piloto» (Miami y Novi)                             | Probarlo                                                          | Richard          |
| Mercado, Farmacia y Licores  | Construido; se enciende por piloto                                     | Que se registren tiendas reales                                   | Tiendas          |
| Moto y Carro                 | Construido, apagado                                                    | Permiso legal y seguro del pasajero                               | Richard (legal)  |
| Rewards y pago por hora pico | En producción, apagados                                                | Porcentaje y presupuesto                                          | Richard (dinero) |
| Soporte                      | Un buzón por app, «Mis casos de ayuda» con capturas, gerente de correo | Fichas de las tiendas cuando terminen las revisiones              | Yo, después      |
| Apps                         | En revisión en Apple y Google; TestFlight al día                       | Aprobación                                                        | Apple y Google   |

## Lo que se puede construir ya (como el mercado, apagado hasta que pongas el dinero)

Igual que el pago por hora pico: completo de punta a punta, probado en el sitio de pruebas y en
producción apagado. Tú solo pones los montos desde el superadmin.

1. **Ganar por tiempo** («Earn by Time» de Uber y DoorDash): el repartidor elige cobrar por minuto
   y milla en vez de por oferta. Apagado con tarifa en cero.
2. **Anuncios patrocinados para restaurantes y tiendas** (como «Sponsored» de DoorDash): el
   restaurante paga por salir primero, con presupuesto diario y reporte. Apagado hasta fijar precio.
3. **Suscripción tipo DashPass**: envío gratis y menos servicio por una cuota mensual. Toca cobros
   recurrentes: se prueba de punta a punta solo con Stripe en modo prueba; en producción apagada.
4. **Tarjetas de regalo y regalar un pedido**. Toca dinero: igual, modo prueba y apagado.

Quedan fuera, porque no son decisiones de producto:

- Varios locales por cuenta: hay que reconstruir una tabla de producción; necesita tu sí.
- Impuesto por condado: lo decide el contador.
- Comparación de caras con IA: proveedor, costo y abogado.
- Traducción automática: proveedor y tope de gasto.
- Mapa de Google en la web: gasta dinero si pasa de lo gratis; necesita tu sí al tope.
- GPS en segundo plano: espera la aprobación de Google.

## Orden

Se hace en el orden de la lista, cada uno terminado al 100% antes del siguiente: servidor, panel,
apps, Docs en dos idiomas, pruebas en rojo, sitio de pruebas y producción (apagado). La fila de
trabajo es `FILA.md`.

## Resultado (1 nov 2026, noche)

Las cuatro quedaron construidas de punta a punta, publicadas en producción y **apagadas**:

| Función               | Qué hace                                                                                        | Cómo se enciende                         | Estado del cobro                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Ganar por tiempo      | El repartidor elige cobrar por hora activa y milla                                              | Superadmin → Rewards → tarifa por hora   | Usa el mismo camino que el pago por hora pico                                       |
| Anuncios patrocinados | El restaurante sale primero con «Patrocinado» y paga solo por pedido entregado desde el anuncio | Superadmin → Rewards → precio por pedido | Se descuenta del saldo del restaurante                                              |
| Divoox Plus           | Envío gratis y medio servicio desde el mínimo, cuota mensual                                    | Superadmin → Rewards → cuota             | Probado en el sitio de pruebas con Stripe en modo prueba; bloqueado con dinero real |
| Tarjetas de regalo    | Regalar un monto con mensaje; el código se canjea como saldo                                    | Superadmin → Rewards → encender          | Probado en el sitio de pruebas con Stripe en modo prueba; bloqueado con dinero real |

De paso se arregló la bandeja de casos de dinero del superadmin: abrir un caso tardaba más de veinte segundos cuando había muchos (C-BANDEJA-UN-CASO).

Lo que falta para encender cada una: el monto o precio (decisión de Richard) y, para Plus y las tarjetas, mirar la hoja de pago en el celular con la 4242 antes de quitar el bloqueo de dinero real.
