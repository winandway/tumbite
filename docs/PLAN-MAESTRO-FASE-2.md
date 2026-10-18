# Plan maestro — Fase 2 de Tumbite (18 oct 2026)

La Fase 1 construyó Tumbite desde cero hasta la auditoría final (`docs/AUDITORIA-FINAL-2026-10-18.md`). La Fase 2 empieza con el prompt de Richard del 18 oct: cerrar la auditoría y preparar el MVP para operar en Estados Unidos, Colombia y Venezuela, con el modelo internacional aprobado (cobro directo, capital del repartidor, saldo prepago de comisiones, recargas en puntos de venta). Este documento es la lista única: cada punto dice prioridad, condición de lanzamiento, dependencias, responsable, evidencia, criterio de aceptación y estado. Se actualiza en cada trabajo.

Estados: **hecho** (probado en automático y publicado o listo para publicar), **construido sin prueba real** (código y pruebas simuladas; falta la operación real o la cuenta), **pendiente**, **bloqueado por Richard** (👤).

Condición de lanzamiento: **MVP** (va antes de las tiendas), **país** (va antes de encender ese país), **después** (sigue en el plan, no frena el lanzamiento).

## Lista de lanzamiento unificada (MVP)

La auditoría tenía dos listas que no coincidían del todo (la sección 4 «MVP» y la recomendación de la sección 7). Aquí se unifican: **todo lo de la sección 4 es condición de lanzamiento**, salvo los puntos marcados «después» con su motivo escrito. Nada se eligió en silencio.

### A. Dinero, acceso, seguridad y controles operativos

| #    | Punto                                                                                   | Estado                                     | Evidencia                                                 | Criterio de aceptación                                                    | Depende de        |
| ---- | --------------------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------- |
| F6   | Total del carrito = total del servidor (recoger sin envío)                              | hecho                                      | `fallosDinero.test.ts`, prod b7031f4c                     | 409 si la app manda otro total                                            | —                 |
| F7   | Cambio de dirección actualiza el cobro antes de pagar; 409 si Stripe rechaza            | hecho                                      | `fallosDinero.test.ts`                                    | prueba en rojo pasada                                                     | —                 |
| F8   | Recalcular sin plato respeta la recogida                                                | hecho                                      | `fallosDinero.test.ts`                                    | devolución = total − nuevo total                                          | —                 |
| F10  | Webhook de cuentas conectadas con su propio secreto                                     | construido sin prueba real                 | `fallosDinero.test.ts`, canario `webhookStripeConectadas` | 👤 crear el endpoint en Stripe y pegar `STRIPE_WEBHOOK_SECRET_CONECTADAS` | Richard           |
| 3    | Circuito de pagos completo en staging con Stripe de prueba (S2–S5, S7, S11, recorrido)  | hecho en cada publicación (`pruebas-rama`) | GitHub, `VERIFICAR-PAGOS.md`                              | todo verde antes de producción                                            | —                 |
| 4    | Compra real de un dólar en tumbite.com                                                  | 👤                                         | `VERIFICAR-PAGOS.md`                                      | cobro visible en Stripe y pedido avanzando                                | Richard           |
| F19  | Tope de intentos del PIN; límite de entrada persistente                                 | hecho                                      | `seguridadIntentos.test.ts`                               | 5 equivocaciones bloquean; 429 sobrevive al aislado                       | —                 |
| F11  | Canario rojo con reloj atrasado un día; correo al equipo; vigía de GitHub               | hecho                                      | `canario.test.ts`, `reloj.test.ts`, `canario.yml`         | un correo por cambio de color                                             | —                 |
| 7    | Superadmin: interruptor de retiros, cobros en revisión, abonos fallidos, conciliación   | hecho                                      | `superDinero.test.ts`, `ControlDinero.test.tsx`           | las cuatro pantallas operan sin API                                       | —                 |
| 8    | Retiro mínimo y frecuencia; cuándo encender retiros                                     | 👤                                         | `DECISIONES-RICHARD-FASE-2.md` 4                          | interruptor encendido por Richard                                         | Richard           |
| 26   | Soporte: cancelar y devolver, quitar repartidor, cerrados, suspender cuentas            | hecho                                      | `superadminOperacion.test.ts`                             | acciones en la ficha del pedido y de la cuenta                            | —                 |
| A.12 | Impuesto de ventas configurable; devoluciones después de entregar; disputas por webhook | construido sin prueba real                 | `devolucionesDisputas.test.ts`, `bolsillos.test.ts`       | 👤 tasa y registro con el contador; disputa real en Stripe de prueba      | Richard, contador |
| B.9  | Decisiones de Richard listadas                                                          | hecho                                      | `docs/DECISIONES-RICHARD-FASE-2.md`                       | lista viva                                                                | —                 |

### B. Modelo financiero internacional

| #   | Punto                                                                                             | Estado                                                                                  | Evidencia                                  | Criterio                                             | Depende de                   |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------- | ---------------------------- |
| B.1 | Fichas REA/DOC de Colombia, Venezuela, Stripe internacional y cobro directo                       | hecho                                                                                   | `docs/investigaciones-rea/2026-10-18-*.md` | referencias y etiquetas [DOC]/[OBS]/[INF]/[NV]       | —                            |
| B.2 | Libro mayor por país y moneda, inmutable, con referencia única                                    | hecho                                                                                   | `internacional.test.ts`, canario `libro`   | ningún prepago/fondo negativo                        | —                            |
| B.3 | Saldo prepago: reserva al aceptar, cobro al conciliar, liberación                                 | hecho                                                                                   | `internacional.test.ts` 8, 16              | sin saldo no se ofrece ni se acepta                  | —                            |
| B.4 | Cobro directo con tres estados y conciliación; cliente que no paga → deuda                        | hecho                                                                                   | `internacional.test.ts` 7, 9, 10, 12       | entregar no toca el cobro                            | —                            |
| B.5 | Cuentas del repartidor para transferencias (contraseña, historial, 24 h, confirmación del equipo) | hecho                                                                                   | `cuentasCobro.test.ts`                     | el cliente ve beneficiario y cuenta vigente          | —                            |
| B.6 | Recargas en puntos de venta (códigos de un canje) y recarga por Stripe                            | hecho                                                                                   | `internacional.test.ts` 13 + concurrencia  | canje doble → uno solo                               | —                            |
| B.7 | Conectores reales por país (Wompi/dLocal, pago móvil)                                             | pendiente / 👤                                                                          | fichas CO y VE                             | contrato y cuenta del proveedor; nada real sin ellos | Richard, abogados            |
| B.8 | Reconstrucción por pedido y conciliación por país                                                 | hecho (`/admin/libro/pedido/:id`, `/admin/libro/comisiones/:pais`) / pendiente el panel | `internacional.test.ts`                    | cada pedido reconstruye quién recibió qué            | —                            |
| 11  | Cancelado tras la compra con foto del ticket                                                      | pendiente                                                                               | ficha cobro directo §4                     | estado propio + foto                                 | decisión 👤 de quién absorbe |
| 14  | Tope diario de efectivo                                                                           | construido (lógica) / 👤 cifra                                                          | `cobroDirecto.ts`                          | cifra por país                                       | Richard                      |

### C. Recorrido completo (cliente, restaurante, repartidor)

| #       | Punto                                                          | Estado                                          | Evidencia                   | Criterio                                                              |
| ------- | -------------------------------------------------------------- | ----------------------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| F5      | Turnstile en web y apps                                        | construido sin prueba real                      | `turnstileApps.test.ts`     | 👤 las dos llaves; entrar con el recuadro                             |
| F16     | Idioma y versión de la app al servidor; «actualiza la app»     | hecho                                           | `versionApp.test.ts`        | 426 con `APP_VERSION_MINIMA`                                          |
| 12      | Pestaña Pedidos real con recibo y repetir                      | hecho                                           | `favoritos.test.ts`         | historial, recibo, repetir                                            |
| 13      | Favoritos reales                                               | hecho                                           | `favoritos.test.ts`         | corazón guarda y quita                                                |
| 14      | Direcciones guardadas con instrucciones                        | hecho                                           | `cupones.test.ts`           | chips en el carrito, tope 10                                          |
| 15      | Cupones y promociones reales                                   | hecho                                           | `cupones.test.ts`           | validación en servidor; descuento lo absorbe Tumbite (👤 por campaña) |
| 16      | Comentario en calificación; queja guiada con reembolso parcial | hecho (reembolso automático apagado 👤)         | `quejasGuiadas.test.ts`     | propuesta en el ticket; devolución con tope si está encendido         |
| 17      | Apple Pay y Google Pay                                         | construido sin prueba real                      | `VERIFICAR-PAGOS.md`        | 👤 interruptores en Stripe e identificador de Apple                   |
| F13/F14 | «Recibiendo pedidos» real; ítem de cobro; correo al dueño      | hecho                                           | `restauranteEstado.test.ts` | verde solo si recibe de verdad                                        |
| 19      | Reseñas con respuesta                                          | hecho                                           | `restauranteMas.test.ts`    | el cliente ve la respuesta                                            |
| 20      | Reordenar platos y categorías; festivos                        | hecho                                           | `restauranteMas.test.ts`    | menú público en ese orden; cerrado el festivo                         |
| 21      | Varios usuarios con roles                                      | hecho                                           | `restauranteMas.test.ts`    | manager/staff; solo el dueño toca equipo y dinero                     |
| 22      | Correo al restaurante al aprobar/pausar/rechazar               | hecho                                           | `restauranteEstado.test.ts` | con motivo                                                            |
| 23      | GPS en segundo plano; navegación                               | hecho (GPS); navegación externa (como DoorDash) | `repartidorFondo.test.ts`   | posición con la pantalla apagada (👤 probar en el teléfono)           |
| 24      | Verificación de edad con documento y nombre de quien recibe    | hecho                                           | `operacion.test.ts`         | sin documento no se entrega                                           |
| 25      | Retiro instantáneo                                             | después (cuando Richard encienda retiros)       | —                           | —                                                                     |
| C.6     | Pantallas del cobro directo en las tres apps + Docs es/en      | hecho (capturas cuando un país esté encendido)  | `internacional.test.ts`     | —                                                                     |

### D. Operación, cuentas externas e infraestructura

| #   | Punto                                                        | Estado                                                               | Evidencia                                     | Criterio                                                 |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------- |
| 27  | Aviso al equipo al llegar una verificación; paginación       | hecho                                                                | `kyc.ts`, `SuperKyc.tsx`                      | correo + «Ver más»                                       |
| 28  | Pantalla de salud; restauración de respaldo probada          | hecho                                                                | `respaldoRestaurar.test.ts`, `Superadmin.tsx` | restaurar en pruebas devuelve la base al día de la copia |
| 29  | Cuentas externas                                             | 👤                                                                   | abajo                                         | —                                                        |
| 30  | Prueba en la calle                                           | 👤                                                                   | `docs/PLAN-DE-PRUEBA-EN-CALLE.md`             | tres pedidos reales en modo prueba                       |
| 31  | Tiempo real en producción (Worker de Cloudflare)             | 👤                                                                   | Fase 2 tiempo real                            | aprobación de Richard                                    |
| 32  | F17 Miami y ciudades                                         | hecho (Miami «muy pronto» hasta el lanzamiento; 👤 el día que lance) | `cobertura.ts`                                | portada y página de ciudad coinciden                     |
| 33  | Textos de la web honestos                                    | hecho                                                                | `textos.ts`, `ComoFunciona.tsx`               | nada promete lo que no existe                            |
| 34  | Un solo buzón público                                        | hecho (`support@tumbite.com`)                                        | `Pie.tsx`, `ComoFunciona.tsx`                 | 👤 confirmar que el buzón existe                         |
| 35  | Fichas de App Store y Google Play con capturas del recorrido | pendiente (al final)                                                 | —                                             | capturas reales, es/en                                   |

#### Cuentas externas (punto 29) — qué destranca cada una

- **Apple Developer (Windoce LLC):** compilar para iPhone, TestFlight, App Store, Apple Pay en la app (identificador de comercio). Sin ella no hay app de iPhone en tienda.
- **Expo (organización y proyecto, `extra.eas.projectId` en los tres `app.json`):** compilar con EAS y registrar los avisos al celular (F12). Sin ella, cero push.
- **Firebase (proyecto gratis):** avisos al celular en Android (llave FCM en Expo).
- **Google Maps (llave Android):** el mapa en Android (hoy solo iPhone).
- **Twilio (cuenta + número de EE.UU.):** SMS de respaldo y llamadas con número oculto (construidas, apagadas).
- **Checkr:** antecedentes de repartidores (construido, apagado).
- **Turnstile (dos llaves):** escudo anti-robots en web y apps (construido, apagado).
- **Stripe:** segundo endpoint de cuentas conectadas, `transfer.created`, Apple Pay/Google Pay, Stripe Tax (con el contador).
- **Wompi/dLocal (Colombia) y Mercantil/Pabilo (Venezuela):** contacto comercial, entidad local y abogados (ver `DECISIONES-RICHARD-FASE-2.md`).

### E. Pruebas integrales, piloto y tiendas

| #   | Punto                                                                                                                    | Estado                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| E.1 | Concurrencia, reintentos y reversión del bloque B (canje doble, reserva, saldo nunca negativo, recarga Stripe duplicada) | hecho (`internacional.test.ts`)                                                          |
| E.2 | Recorrido visual en celular es/en de lo nuevo; capturas a Docs y web                                                     | pendiente: necesita un país encendido en staging (👤) y las cuentas de Expo para los APK |
| E.3 | Piloto en calle y operaciones reales autorizadas                                                                         | 👤                                                                                       |
| E.4 | Fichas de tiendas                                                                                                        | pendiente (al final)                                                                     |

### F. Ampliaciones posteriores (se conservan)

Los puntos 36 a 67 de la auditoría (pedido programado, pedido en grupo, suscripción, pickup con descuento, impuesto por estado completo con Stripe Tax, chat de soporte con reembolsos guiados, recomendaciones, regalos entre usuarios, DoubleDash, promociones pagadas, rendimiento completo, documentos fiscales 1099, sucursales, punto de venta, auto-respuestas, tablet quiosco, turnos y mapa de calor, ganar por tiempo, niveles con requisitos reales, pedidos agrupados, seguro y centro de seguridad, 1099 del repartidor, contracargos con evidencia por API, roles internos del superadmin, tickets con asignación, informes por fecha, configuración por ciudad, franquicias con cobro, avisos al equipo por SMS, restauración desde el panel, servicios Moto/Carro/Envíos/Mercado/Farmacia/Licores, Tumbite AI) siguen aquí, en ese orden sugerido, y entran después del MVP.

## Qué países y métodos pueden habilitarse según la evidencia (actualizado 18 oct 2026, noche)

- **Estados Unidos, tarjeta (Stripe):** el circuito pasa en staging con Stripe de prueba en cada publicación; **no está probado comercialmente**: falta la compra real de un dólar y una devolución real (👤). El circuito existente se conserva; no se rediseña para Latinoamérica.
- **Estados Unidos, cobro directo (efectivo o transferencia) y recargas:** construido, con pruebas automáticas y recorrido local; **apagado**. Se habilita solo con el piloto de `docs/PILOTO-POR-PAIS.md`.
- **Colombia:** Stripe desde la cuenta de EE. UU. **sí** cobra tarjetas colombianas (como internacionales, también en pesos); **no** ofrece PSE, Nequi ni Daviplata, **no** permite abrir cuenta local y **no** paga a cuentas colombianas en autoservicio (Connect solo «recibir»; Global Payouts en vista previa). El cobro directo y las recargas para comisiones son técnicamente operables, pero ningún método se habilita sin entidad local, abogado colombiano y piloto.
- **Venezuela:** Stripe **no** paga a nadie en Venezuela y **no** cobra en bolívares; el cobro con tarjeta internacional en dólares es posible con filtro de sanciones. La afirmación «solo el cobro directo es viable sin licencia del BCV» queda **pendiente de validación profesional** (abogado venezolano y de sanciones): el estudio la encontró demasiado estricta y con fuentes incompletas.
- **Lanzamiento simultáneo:** todos los mercados pasan la misma compuerta de `docs/PILOTO-POR-PAIS.md`. Ningún país se habilita por una fecha.

Fichas: `docs/investigaciones-rea/2026-10-18-stripe-por-producto-y-bcv.md` (Stripe por producto, sanciones, BCV y SFC) y `docs/RECONCILIACION-FASE-2.md` (estado de los 67 puntos y F5–F20).
