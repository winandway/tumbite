# Tumbite — Sugerencias de expansión y landing (traídas por Richard, 10 oct 2026)

> Fuente: texto que Richard pegó en la sesión (asesoría externa). Aquí queda guardado y clasificado
> para que no se pierda. Cada punto dice: ✅ ya está · 🛠️ se hace ahora · 🔜 Fase 2 · 👤 decisión de Richard.

## 1. App del cliente

| Sugerencia                                               | Estado                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registro rápido con teléfono (código por WhatsApp o SMS) | 🔜 Fase 2. Cada código cuesta dinero (proveedor de SMS/WhatsApp): se enciende con tope de gasto escrito (regla de gastos automáticos).                                                                                                                  |
| Entrar con Google o Apple                                | 🔜 Fase 2. Ojo: si se ofrece Google en iPhone, Apple EXIGE ofrecer también «Iniciar sesión con Apple».                                                                                                                                                  |
| Marcar la ubicación en un mapa interactivo               | 🔜 Fase 2 (mapa nativo en la app). Hoy: ubicación del teléfono + dirección escrita.                                                                                                                                                                     |
| Pagos en EE.UU.: Stripe, Apple Pay, Google Pay           | ✅ Construido (Stripe Checkout). 🔴 Sin probar con llaves reales.                                                                                                                                                                                       |
| Pagos en Venezuela: Pago Móvil automatizado y Zelle      | 👤 Decisión de Richard: lanzar o no en Venezuela. Nota honesta: Zelle no tiene API para comercios; «automatizar» Zelle no es posible por vía oficial. Pago Móvil sí tiene pasarelas de bancos venezolanos. Se investiga en Laboratorio AI si se decide. |
| Seguimiento: Confirmado → En cocina → En camino          | ✅ Hecho (cinco pasos con barra).                                                                                                                                                                                                                       |

## 2. App del repartidor

| Sugerencia                                                 | Estado                                                                       |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Navegación con Google Maps, Waze o Apple Maps con un toque | ✅ Apple Maps / Google Maps. 🛠️ Se suma Waze.                                |
| Oferta clara: cuánto gana, distancia, punto de recogida    | ✅ Hecho.                                                                    |
| Billetera: saldo, historial del día, retiro                | ✅ Hecho (retiro cuando quiera, mínimo 1 dólar).                             |
| Que no gaste batería                                       | ✅ La ubicación se manda solo al moverse 30 m o cada 10 s, y solo conectado. |

## 3. Panel del restaurante

| Sugerencia                                             | Estado                           |
| ------------------------------------------------------ | -------------------------------- |
| Apagar un plato agotado con un toque                   | ✅ Hecho (Disponible / Agotado). |
| Alarma fuerte y continua hasta aceptar                 | ✅ Hecho (app y web).            |
| Resumen del día: pedidos, dinero neto tras la comisión | 🛠️ Se hace ahora.                |

## 4. Ventaja competitiva: soporte humano por WhatsApp

| Sugerencia                                          | Estado                                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Soporte humano por WhatsApp en menos de dos minutos | 🛠️ El botón de WhatsApp se pone en la landing y las apps. 👤 Falta el número de WhatsApp de soporte de Tumbite. |

## 5. Arquitectura de base de datos

| Sugerencia                                                           | Estado                                                                                                                                                                                                   |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Distancias con Haversine en el servidor                              | ✅ Hecho.                                                                                                                                                                                                |
| Indexación geoespacial ligera (H3 o similar) para no saturar la base | 🛠️ Se hace con **geohash** (texto corto por zona del mapa, se indexa en SQLite). H3 queda para cuando haya miles de repartidores.                                                                        |
| Multi-inquilino por pueblo (`pueblo_id`)                             | 🛠️ Se hace ahora como `zona_id` («US-FL-MIAMI»), en usuarios, restaurantes, repartidores, pedidos y lista de espera, con índices compuestos zona + estado.                                               |
| Historial de estados del pedido                                      | 🛠️ Se hace ahora (tabla aparte, una fila por cambio).                                                                                                                                                    |
| Tiempo real con WebSockets / Durable Objects                         | 🔜 Fase 2. Hoy el seguimiento pregunta cada 5 s (alcanza para el lanzamiento). YaDominios Cloud no tiene Durable Objects: por la regla de Richard, esa pieza irá directo a Cloudflare cuando haga falta. |
| Aislar datos al saltar de pueblo en pueblo                           | 🛠️ Una sola base con `zona_id` en todo (lo más simple y barato). Cuando una zona crezca mucho, se puede mover a su propia base sin cambiar las apps, porque todo ya viene marcado por zona.              |

## 6. Landing desde el minuto cero para los tres públicos

| Sugerencia                                             | Estado                                                                                                        |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Tres llamados: comensales, restaurantes, repartidores  | 🛠️ Se hace ahora, con formulario de lista de espera para cada uno.                                            |
| «Cupón de envío gratis al lanzamiento» para comensales | 👤 Decisión de dinero de Richard. La landing promete solo «avisarte primero» hasta que lo apruebe.            |
| «Comisión 0 % los primeros 3 meses» para restaurantes  | 👤 Decisión de dinero de Richard. La landing muestra los planes aprobados (desde 7,5 %) hasta que lo apruebe. |
| Mostrar las pantallas, los pasos y los mapas           | 🛠️ Se hace ahora.                                                                                             |
