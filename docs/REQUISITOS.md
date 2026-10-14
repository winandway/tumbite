# Tumbite — Requisitos base (versión 1)

> **Nombre elegido: Tumbite** (10 oct 2026). Tummy (pancita) + bite (bocado), con eco de «tumbao». tumbite.com libre al momento de elegir. La carpeta se llamó PAPOS hasta el 10 oct 2026; ahora es `tumbite`.

> Documento madre del proyecto. Se escribió el 10 de octubre de 2026, antes de tocar código.
> Lo que cambie después se anota aquí mismo. La investigación de GitHub está en `investigacion-bases-github.md`.

## 1. Qué es

Marketplace de reparto de comida tipo DoorDash, para muchos restaurantes. Arranca en **Miami, EE.UU.**, bilingüe español/inglés desde el día uno. App nativa en **Google Play y App Store** (no solo navegador).

Filosofía: **no reinventar la rueda.** Se usa lo que ya existe y funciona (Stripe, mapas, notificaciones). Lo nuestro es la experiencia y los valores agregados.

## 2. Las cinco piezas

| Pieza             | Para quién                            | Dónde corre                       |
| ----------------- | ------------------------------------- | --------------------------------- |
| App Cliente       | quien pide comida                     | iPhone y Android                  |
| App Repartidor    | repartidores propios e independientes | iPhone y Android                  |
| App Restaurante   | el mostrador del restaurante          | tablet o celular (iPad / Android) |
| Panel Restaurante | dueño del restaurante                 | web                               |
| Panel Admin       | nosotros (cuentas «Soporte»)          | web                               |

Tecnología: Expo (React Native). **Un solo código, tres apps** en las tiendas (cliente, repartidor, restaurante): se programa una vez y salen tres apps con su propio nombre. Motivo: el permiso de ubicación permanente queda solo en la app del repartidor, y cada público tiene su ficha en la tienda. Detalle en `investigacion-apps-y-rangos.md`. Pantallas de Enatega (licencia MIT) solo como referencia de flujos.

## 3. Modelo de dinero (ajustado tras la alerta)

### El problema

Con solo la comisión al restaurante no alcanza para pagar al repartidor (pedido de 30 dólares al 7,5 % = 2,25 dólares).

### La solución: como lo hace toda la industria

Cada pedido tiene **cuatro bolsillos**, todos editables desde el Panel Admin:

| Quién paga  | Concepto                          | A dónde va                                       |
| ----------- | --------------------------------- | ------------------------------------------------ |
| Restaurante | Comisión según su plan            | **Nuestra ganancia**                             |
| Cliente     | Tarifa de envío (según distancia) | **Repartidor**                                   |
| Cliente     | Propina                           | **Repartidor, 100 %**                            |
| Cliente     | Tarifa de servicio (pequeña, %)   | **Nuestra ganancia** (cubre lo que cobra Stripe) |

Reglas extra:

- **Pago mínimo garantizado al repartidor por pedido.** Si envío + propina no llegan al mínimo, la plataforma completa la diferencia. Así ningún repartidor rechaza pedidos cortos.
- **Tarifa de pedido pequeño** si el pedido no llega a un monto mínimo.
- **Recoger en el local (pickup):** sin envío, comisión más baja. Otra fuente de pedidos.

### Ejemplo con los valores vigentes (punto de equilibrio, 13 oct 2026; todos editables)

Pedido de 30 dólares de comida, a 2 km, restaurante en plan Inicial, propina de 4 dólares. Detalle, competencia y fuentes en `docs/MODELO-DE-DINERO.md`.

|                                                                 | Monto     |
| --------------------------------------------------------------- | --------- |
| Comida                                                          | 30,00     |
| Envío (cliente, desde 3,99)                                     | 3,99      |
| Servicio 5 %, mínimo 1,99 (cliente)                             | 1,99      |
| Propina (cliente)                                               | 4,00      |
| **Cliente paga**                                                | **39,98** |
| Repartidor recibe (mínimo 5,00 + propina)                       | 9,00      |
| Comisión 7,5 % (restaurante)                                    | 2,25      |
| Restaurante recibe                                              | 27,75     |
| Tumbite (comisión + servicio − 1,01 que completa al repartidor) | 3,23      |
| Cobro de la tarjeta de Stripe (2,9 % + 0,30)                    | 1,46      |
| **Tumbite neto**                                                | **1,77**  |

> Hasta el 13 oct 2026 el envío arrancaba en 2,99 y el servicio mínimo era 0,99: con eso, el pedido normal del plan Inicial dejaba pérdida. Lo vigila el candado C-EQUILIBRIO.

### Planes para restaurantes (mitad de DoorDash, editables)

| Plan (ES / EN)    | Comisión | Equivale a DoorDash |
| ----------------- | -------- | ------------------- |
| Inicial / Starter | 7,5 %    | Basic 15 %          |
| Crece / Growth    | 12,5 %   | Plus 25 %           |
| Élite / Pro       | 15 %     | Premier 30 %        |

Nombres, porcentajes y beneficios se cambian desde el Panel Admin sin publicar la app.

### Billeteras (Stripe Connect, cuentas Express)

- Restaurante y repartidor independiente meten sus datos bancarios **en la pantalla de Stripe**. Nosotros nunca vemos ni guardamos un número de cuenta. Stripe verifica identidad y emite los formularios de impuestos.
- En nuestras apps: saldo, historial, botón **Retirar**.
- Pago automático semanal sin costo + retiro instantáneo a tarjeta de débito con tarifa.
- Repartidores **empleados**: ven sus ganancias en la app, pero cobran por nómina.

## 4. Valores agregados (lo que la competencia no tiene)

### 4.1 Fidelidad de clientes, pagada por el restaurante: «Regalos y marketing»

Idea de Richard.

- Cada restaurante aparta un **porcentaje de sus ventas para regalarle a sus clientes fieles**. Por defecto **3 %**, él lo cambia cuando quiera (incluso a 0).
- El Panel Restaurante tiene **dos pantallas**:
  - **Beneficios**: el dinero del restaurante (ventas, comisiones, saldo, retiros).
  - **Regalos y marketing**: su presupuesto para regalos, cuánto lleva acumulado, cuánto gastó y qué le devolvió.
- Recomendaciones que le damos (activables con un toque):
  - **Regalo de cumpleaños** (ej. una pizza) a clientes que ya le han comprado. El cliente registra su fecha de cumpleaños al crear la cuenta.
  - **Tarjeta de sellos digital**: a la compra 10, un regalo.
  - **Cliente que vuelve**: regalo a quien no compra hace 30 días.
- **Cómo se maneja el dinero (recomendación):** no le «guardamos» la plata al restaurante. El 3 % funciona como un **tope de presupuesto**: se va acumulando con sus ventas, y cuando un cliente usa un regalo, el costo se descuenta de su pago de ese día. Así no retenemos dinero ajeno (más simple y más seguro legalmente) y el restaurante ve todo igual en su pantalla.

### 4.2 Fidelidad de restaurantes, pagada por nosotros: el programa de música

Idea de Richard.

- Un **porcentaje de nuestras ganancias** (sugerido: 5 %, editable) va a un fondo para premiar a los restaurantes que trabajan bien (buenas calificaciones, pocos pedidos cancelados, rapidez).
- Premios: publicidad pagada por nosotros, **una banda o grupo de música en vivo un fin de semana**, con camisetas de nuestra marca.
- Propósito: mantener viva la música hecha por personas y el arte local, en una época en que la IA hace música sola.
- Nombre del programa: **pendiente** (ver preguntas).

### 4.3 Ideas nuestras que se suman

- **«Música en vivo esta semana»** dentro de la App Cliente: mapa y lista de restaurantes con banda ese fin de semana. Le lleva clientes al restaurante premiado y público al músico.
- **Propina al músico** desde la app (100 % para el artista).
- **Transparencia total al restaurante**: cada pedido muestra el desglose exacto (qué pagó el cliente, comisión, lo que recibe). La competencia esconde cargos.
- **Fidelidad de repartidores**: bonos a los mejor calificados y más puntuales.
- **Sin cobro por cambio de plan** y sin contratos de permanencia.

## 4.4 Niveles (rangos) y reparto justo

Ver `investigacion-apps-y-rangos.md`. Resumen:

- Repartidores: cuatro niveles por puntos, se mantienen por estrellas, completados y puntualidad (últimos 100 pedidos).
- Reparto: primero cercanía y rapidez; el nivel desempata; niveles altos ven primero pedidos grandes y tienen horario libre.
- Rechazar no castiga. Estrellas por culpa del restaurante no cuentan. Aviso antes de bajar y apelación en la app.
- Restaurantes y clientes también tienen niveles; los restaurantes top alimentan el programa de música.

## 5. Recepción de pedidos en el restaurante

- App en tablet o celular, **alarma sonora fuerte** que no para hasta aceptar, botones grandes «Aceptar» y «Listo».
- Tiempo de preparación ajustable por pedido.
- Pausar el restaurante con un toque (cerrado, mucha demanda).
- Fase 2: impresora de cocina y conexión con cajas registradoras (Toast, Square, Clover).

## 6. Fases

**Fase 1 — Lanzamiento en Miami**
Las cinco piezas, cobro con Stripe, billeteras, seguimiento del repartidor en vivo, planes editables, Regalos y marketing (cumpleaños, sellos, cliente que vuelve), bilingüe, recogida en local.

**Fase 2**
Programa de música y «Música en vivo esta semana», propina al músico, impresora y cajas registradoras, suscripción para clientes tipo DashPass, nómina de repartidores empleados.

> El circuito de pagos se prueba de punta a punta (cliente, restaurante, repartidor, retiro) antes de anunciar nada. Regla global.

## 7. Pendiente de verificar con el contador / abogado

- Impuesto de ventas en Florida para plataformas de pedidos.
- Repartidores empleados e independientes al mismo tiempo: clasificación legal.
- Seguro para repartidores.
