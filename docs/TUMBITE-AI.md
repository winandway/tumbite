# Tumbite AI — estudio de dónde va la inteligencia artificial (12 oct 2026)

> Pedido por Richard el 12 oct 2026: _«que no seamos uno más del montón… un manager que vigila
> cada pedido, que ve si ya cogió la moto, que le manda un mensaje… pero primero un estudio de en
> qué parte va la IA, qué APIs, qué funciones y con qué código»_.
>
> Este documento es ese estudio. **Nada de esto está construido todavía.** Entra al roadmap como
> Etapa 5 (ver `docs/ROADMAP.md`), con una parte que puede adelantarse sin gastar en IA.

## 1. La idea en una frase

Tumbite AI tiene **dos cerebros**:

1. **El cerebro que calcula** (código exacto, sin modelo de lenguaje): quién está más cerca, cuánto
   tarda, cuándo un pedido va tarde, a quién se le ofrece después. Es rápido, gratis y nunca se
   equivoca en una suma. Así lo hacen DoorDash y Uber: modelos de cálculo y optimización, no chat.
2. **El cerebro que habla** (un modelo de lenguaje barato): convierte lo que el primero detecta en
   mensajes humanos, responde preguntas, traduce menús, resume reseñas y le explica al dueño qué
   pasó en su día.

El **Manager** que Richard describe es la unión de los dos: vigila cada pedido vivo con el cerebro
que calcula y, cuando algo se sale de lo normal, actúa y avisa con el cerebro que habla.

> **Lo que ya existe hoy y no necesita IA:** el pedido se le ofrece primero al repartidor libre
> más cercano al restaurante (en línea recta), y si dos están casi igual de cerca gana el de mejor
> nivel (`repartirOfertas` en `apps/servidor/src/rutas/operacion.ts`). La oferta vence y pasa al
> siguiente. Eso es la base sobre la que se monta todo lo de abajo.

## 2. Dónde va la IA, momento por momento

| Momento del pedido              | Qué hace Tumbite AI                                                                                                                                 | Cerebro            | Beneficio                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------- |
| El cliente abre la app          | Recomienda según su historial, la hora y el clima («¿tu pizza de los viernes?»)                                                                     | Calcula            | Más pedidos repetidos                         |
| El cliente pide                 | Tiempo de entrega **realista** (cocina de ese restaurante a esa hora + tráfico)                                                                     | Calcula            | Menos quejas por «dijeron 30 y fueron 50»     |
| El cliente paga                 | Señal de fraude (tarjeta nueva + dirección rara + monto alto) antes de cocinar                                                                      | Calcula            | Menos contracargos                            |
| El restaurante no acepta        | A los 3 min le suena otra vez; a los 6 lo llama por mensaje; a los 10 se le avisa al cliente con opción de cancelar sin costo                       | Calcula + habla    | Ningún pedido olvidado                        |
| Elegir repartidor               | Por **tiempo real de llegada** (no línea recta), carga actual y nivel; ofrecer **antes** de que la comida esté lista para que llegue justo a tiempo | Calcula            | Comida caliente, menos espera en el mostrador |
| Varios pedidos del mismo sitio  | Juntarlos en un solo viaje si van hacia el mismo lado                                                                                               | Calcula            | Más ganancia por hora para el repartidor      |
| Nadie acepta la oferta          | Ampliar el radio, subir un bono pequeño si la zona está sin repartidores, avisar al admin                                                           | Calcula + habla    | No quedan pedidos varados                     |
| El repartidor va al restaurante | Si no se mueve en 4 min o va en sentido contrario, mensaje: «¿Todo bien? El pedido te espera»                                                       | Calcula + habla    | Menos abandonos                               |
| El repartidor va al cliente     | Llegada estimada que se corrige sola; aviso al cliente «está a 2 minutos»                                                                           | Calcula + habla    | Cliente listo en la puerta                    |
| Algo sale mal                   | Pedido tarde, comida olvidada, repartidor perdido: el Manager lo marca, propone la solución (reasignar, regalo de disculpa) y se lo dice al admin   | Calcula + habla    | Se arregla antes de la queja                  |
| Soporte                         | Chat que responde dudas con los datos reales del pedido; si no puede, pasa a una persona                                                            | Habla              | Soporte 24 h sin contratar                    |
| Restaurante: menú               | Subir una foto del menú en papel y que salga el menú en la app, en español e inglés                                                                 | Habla (con visión) | Alta de restaurantes en minutos               |
| Restaurante: su día             | «Hoy vendiste 18 % más; la margarita fue la estrella; 2 pedidos tardaron por falta de repartidores a las 8 p. m.»                                   | Calcula + habla    | El dueño siente que tiene un gerente          |
| Reseñas                         | Resumen de lo que dicen los clientes y alerta de comentarios ofensivos                                                                              | Habla              | Calidad y moderación (Apple 1.2)              |
| Fidelidad                       | Elegir a quién mandarle el regalo de «cliente que vuelve» y cuándo                                                                                  | Calcula            | Retención                                     |

## 3. El Manager (el corazón de Tumbite AI)

**Qué es:** un vigilante por cada pedido vivo. No toma el pedido (eso lo hacen personas), lo
**acompaña** desde que se paga hasta que se califica.

**Cómo piensa (reglas medibles, no adivinanzas):**

- Cada pedido tiene un **reloj de tiempos esperados**: aceptar (2 min), cocinar (lo que dijo el
  restaurante, corregido con su historial), llegar al restaurante (tiempo de ruta), entregar.
- Cada vez que cambia algo (estado, ubicación del repartidor cada pocos segundos), el Manager
  compara lo real contra lo esperado y clasifica: **verde** (bien), **amarillo** (se está
  atrasando), **rojo** (problema).
- En amarillo **avisa** (mensaje al que se está atrasando). En rojo **actúa** (reasigna, ofrece
  regalo de disculpa, avisa al cliente y al admin) y deja escrito por qué.
- Todo queda en una **bitácora del pedido** que el admin ve en el panel: «19:02 el restaurante no
  respondía, le sonó otra vez; 19:05 aceptó».

**Cómo habla:** el modelo de lenguaje solo redacta el mensaje a partir de los datos que le pasa el
Manager (nunca decide dinero ni reasigna por su cuenta). Si el modelo falla o tarda, sale un
mensaje fijo ya escrito. El pedido nunca depende de que la IA responda.

**Dónde corre:** cada pedido vivo necesita «despertarse» cada pocos segundos aunque nadie toque
nada. YaDominios Cloud no tiene relojes ni Durable Objects, así que (regla de Richard) **esa pieza
va directo a Cloudflare**: un Durable Object por pedido vivo con su alarma, que llama al servidor de
Tumbite. Mientras tanto, la primera versión se engancha a lo que ya existe: cada actualización de
ubicación del repartidor (cada pocos segundos) y el reloj externo de cada 5 minutos.

## 4. Qué APIs y cuánto cuestan (leído el 12 oct 2026)

Precios de agregadores que coinciden entre sí; se confirman en la página oficial antes de encender.

| Para qué                                | Opción recomendada                             | Precio por millón de tokens (entrada / salida)                  | Nota                                                                |
| --------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| Mensajes del Manager, resúmenes         | **Gemini 2.5 Flash-Lite**                      | 0,10 / 0,40 USD                                                 | La más barata de calidad; ya aprobada en las reglas (familia Flash) |
| Chat de soporte, menús desde foto       | **Gemini 2.5 Flash**                           | 0,30 / 2,50 USD                                                 | Aprobado en las reglas; entiende fotos                              |
| Respaldo rápido y barato                | **Groq (Llama 3.1 8B)**                        | 0,05 / 0,08 USD                                                 | Aprobado en las reglas; muy rápido                                  |
| Alternativa de más calidad para soporte | Claude Haiku 4.5                               | 1 / 5 USD                                                       | Más caro; solo si la calidad lo pide, con autorización              |
| Tiempo real de ruta (no línea recta)    | **OSRM** (código abierto, sobre OpenStreetMap) | Gratis, solo el servidor                                        | Sin tráfico en vivo; alcanza para empezar                           |
| Tiempo de ruta con tráfico              | Mapbox Matrix                                  | Gratis hasta 100 000 elementos al mes; luego unos 2 USD por mil | Cuando el volumen lo justifique                                     |

**Cuánto costaría el Manager:** unos 5 mensajes por pedido, cada uno con ~1 000 tokens de entrada y
~100 de salida. Con Flash-Lite: **menos de un décimo de centavo por pedido**. Mil pedidos al día:
**unos 0,70 USD al día**. El chat de soporte y los menús desde foto se cobran aparte, por uso.

## 5. ⚠️ Alarmas (reglas globales que aplican)

- **Modelos caros bloqueados en código.** Antes de la primera llamada se crea
  `apps/servidor/src/ia/guardia.ts`: lista blanca de modelos (Flash-Lite, Flash, Groq 8B) y
  `assert` delante de cada llamada. Un modelo que no esté en la lista no corre nunca, ni de respaldo.
- **Cuenta prepago con tope.** La cuenta del proveedor de IA se abre prepago. Tope propuesto:
  **20 USD al mes** para empezar (alcanza para ~25 000 pedidos vigilados). Si se acaba, el Manager
  sigue con mensajes fijos: la operación no se detiene.
- **Tope por día en código** (contador en la base): si un día pasa de 1 USD, se apaga la IA ese día
  y avisa al admin.
- **Privacidad.** Al modelo no se le manda ni nombre completo, ni teléfono, ni correo, ni la
  dirección exacta: solo lo necesario («pedido 702F, repartidor a 1,2 km, 6 min de atraso»). La
  política de privacidad se actualiza en el mismo trabajo para nombrar al proveedor de IA (Apple
  5.1.2 pide decirlo y pedir permiso para compartir con IA de terceros).
- **La IA nunca mueve dinero.** Reembolsos, bonos y regalos de disculpa los propone el Manager y,
  hasta que Richard diga lo contrario, los aprueba una persona.

## 6. Datos que hacen falta (y que ya se pueden empezar a guardar)

Lo más valioso de la IA es la historia. Desde ya conviene guardar, sin costo:

- Tiempos reales de cada paso (ya existen en `historial_estados`).
- Tiempo prometido vs. tiempo real de cocina por restaurante y hora.
- Posiciones del repartidor durante la entrega, resumidas (no el recorrido completo: la política
  de privacidad dice que solo guardamos la última; si se guarda más, se cambia la política antes).
- Ofertas rechazadas y por qué (distancia, monto).

## 7. Fases (en el orden del roadmap)

- **Fase A — El Manager con reglas (sin modelo de lenguaje, costo cero).** Reloj de tiempos
  esperados, semáforo verde/amarillo/rojo, avisos fijos al restaurante, al repartidor y al cliente,
  bitácora del pedido en el panel del admin. Se puede construir apenas se cierre la Etapa 1.
- **Fase B — Tiempo real de ruta.** OSRM para elegir repartidor por minutos y no por kilómetros,
  oferta anticipada para que llegue cuando la comida esté lista, y juntar pedidos.
- **Fase C — El cerebro que habla.** Guardia de modelos y topes primero; luego mensajes del Manager
  redactados por Flash-Lite, resumen del día para el restaurante y resumen de reseñas.
- **Fase D — Soporte y menús.** Chat de soporte con los datos del pedido y menú desde una foto.
- **Fase E — Aprender.** Tiempos de entrega predichos con la historia propia, recomendaciones y
  señales de fraude.

## 8. Decisiones que son de Richard (👤)

1. Tope mensual de gasto en IA (propuesto: 20 USD prepago).
2. Si el Manager puede dar regalos de disculpa solo (y hasta cuánto) o siempre con aprobación.
3. El nombre: «Tumbite AI» como nombre de la función dentro de la app. Antes de usarlo en
   publicidad, se agrega a la revisión de marca con el abogado.

## Fuentes (leídas el 12 oct 2026)

- Precios Gemini: https://www.morphllm.com/gemini-api-pricing y https://anotherwrapper.com/llm-pricing/gemini-2.5-flash (oficial a confirmar: https://ai.google.dev/gemini-api/docs/pricing)
- Precios Groq: https://www.aipricing.guru/groq-pricing/ y https://www.cloudzero.com/blog/groq-pricing/
- Precios Claude Haiku: https://developer.puter.com/tutorials/claude-api-pricing (oficial a confirmar: https://platform.claude.com/docs/en/about-claude/pricing)
- OSRM y Mapbox Matrix: https://www.woosmap.com/blog/mapbox-pricing y https://www.upperinc.com/?p=3483
- Cómo lo hace DoorDash (tiempos con aprendizaje automático, agrupar pedidos): https://careersatdoordash.com/?p=12607 , charla de 2018 https://conferences.oreilly.com/artificial-intelligence/ai-ny-2018/cdn.oreillystatic.com/en/assets/1/event/280/How%20DoorDash%20leverages%20AI%20in%20its%20world-class%20on-demand%20logistics%20engine%20Presentation.pdf y patente https://patents.google.com/patent/US10872305
