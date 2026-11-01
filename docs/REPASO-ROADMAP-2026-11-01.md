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
