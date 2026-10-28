# Divoox Flex · Fase 3 — Resultados

Fecha: 27 de octubre de 2026. Rama `fase-flex-3`, creada sobre `fase-flex-2` (la Fase 2 ya publicada y en verde en el sitio de pruebas, versión `713e6e8`, incluido el recorrido de Comida con Stripe en modo prueba). **Solo desarrollo y sitio de pruebas: nada en producción.** Sin cobros, sin Stripe Connect para Flex, sin pagos a conductores, sin Deliveries para clientes. No se creó un segundo reloj: todo lo automático corre en el reloj que ya existía.

Documentos relacionados: `docs/API-DIVOOX-FLEX-V1.md` (sección «Fase 3»), `docs/DIVOOX-FLEX-PROTOCOLO-PILOTO.md`, `docs/flex-escala-fase3.json`, `CANDADOS.md` (C-FLEX-EVENTOS, C-FLEX-VENCIMIENTO, C-FLEX-AVISOS, C-FLEX-INTEGRACIONES, C-FLEX-SSRF, C-FLEX-OPTIMIZAR, C-FLEX-CAPACIDAD, C-FLEX-RETENCION, C-FLEX-KPI, C-REVISORES-CONFIRMADOS).

## 1. Resumen

Flex ya repartía rutas de punta a punta (Fase 2). La Fase 3 lo vuelve **automático, conectable y medible**:

- **Ofertas que vencen solas**: el reloj existente devuelve a borrador las ofertas vencidas, suelta paquetes y reserva, avisa a la empresa y al conductor, y deja el evento en la auditoría. Idempotente y a prueba de carreras con una aceptación en el mismo instante.
- **Avisos al celular** (Expo) al conductor y a la empresa en cada momento importante, una sola vez cada uno, en el idioma de la persona y **sin datos del destinatario**. Tocar el aviso abre «Mi ruta» en esa ruta.
- **Integraciones salientes firmadas** (lo que en la industria se llama webhooks): 12 eventos, firma HMAC con marca de tiempo e id único, cola con reintentos y espera creciente, registro de intentos, desactivación automática, botón de prueba, rotación del secreto con periodo de gracia, aislamiento entre empresas y **protección anti-SSRF** completa.
- **Bandeja de eventos escrita por la base** en la misma transacción que cada cambio de custodia, de ruta o incidencia: no se puede perder ni inventar un evento.
- **Orden sugerido** (vecino más cercano + 2-opt, ventanas horarias, paradas urgentes primero), siempre como sugerencia y nunca sobre una ruta en la calle; distancia en línea recta marcada como aproximada y **sin tiempos inventados**.
- **Capacidad del vehículo** declarada por la empresa (paquetes, peso, volumen, lado máximo), con aviso **antes** de asignar y confirmación explícita; lo no declarado es «sin dato». No se tocó la tabla de vehículos de Comida.
- **Operación**: indicadores reales del periodo sin un solo dato de dinero.
- **Retención** por país y servicio con **simulación obligatoria**; las pruebas de entrega (fotos y firmas) **nunca** se borran sin una política aprobada por una persona.
- **Escala medida** con 10, 100 y 1000 empresas y rutas de 40 y 150 paquetes.
- **Protocolo de celulares reales y ruta piloto** escrito; **cuentas de revisores** resueltas en el código.

## 2. Archivos creados

- Servidor: `apps/servidor/src/flex/avisosFlex.ts` (avisos sin duplicar), `flex/integraciones.ts` (integraciones, firma, anti-SSRF, cifrado, despacho), `flex/operaciones.ts` (optimizar, capacidad, vehículos, indicadores), `flex/automatizacion.ts` (tareas del reloj, retención y limpieza), `flex/flexFase3.test.ts` (31 pruebas), `flex/escala.test.ts` (medición, corre a mano), `pruebas/flex.ts` (ayudantes de prueba compartidos).
- Compartido: `packages/compartido/src/flexOptimizar.ts` (optimizador y capacidad, puros) y `flexOptimizar.test.ts` (12 pruebas).
- Panel: `apps/panel/src/panel/flex/PantallasFase3.tsx` (Operación, Integraciones, Vehículos, sugerencia de orden, capacidad al asignar) y `PantallasFase3.test.tsx` (5 pruebas).
- Documentos: este informe, `docs/DIVOOX-FLEX-PROTOCOLO-PILOTO.md`, `docs/flex-escala-fase3.json`, capturas nuevas en `docs/capturas/flex/` (`panel-fase3-*.jpg`).

## 3. Archivos modificados

- `schema.sql`: tablas nuevas (sección 4) y `flex_pruebas.purgada_en`. `apps/servidor/src/esquema.ts` (columna nueva en la lista de migración segura), `esquemaColumnas.ts` regenerado.
- `apps/servidor/src/esquemaFlex.ts`: 4 disparadores nuevos que llenan la bandeja de eventos.
- `apps/servidor/src/flex/rutasEmpresa.ts` (avisos en asignar, ofrecer, retirar, cancelar y autorizar reintento; comprobación de capacidad; `volverABorrador` devuelve su clave y admite `liberada_sistema`), `flex/conductor.ts` (avisos en aceptar, rechazar, iniciar, entregar, incidencia, devolución y cierre), `flex/index.ts` (rutas nuevas y despacho tras cada escritura), `rutas/operacion.ts` (tareas de Flex en el reloj existente), `rutas/superadmin.ts` (cuentas de revisión viejas se confirman), `env.ts` (`FLEX_LLAVE_WEBHOOKS`), `mensajesEn.ts` (20 traducciones), `rutas/revisores.test.ts`.
- `packages/compartido/src/flex.ts` (permiso `integraciones.gestionar`), `index.ts`. `packages/movil/src/avisos.ts` (`useToqueAviso`).
- `apps/repartidor/src/Inicio.tsx` y `flex/MiRuta.tsx` (abrir la ruta del aviso).
- `apps/panel/src/panel/flex/PanelEmpresa.tsx`, `PantallasRutas.tsx`, `textos.ts`, `apps/panel/src/estilos.css`, `apps/panel/src/sitio/docs/guias.ts` (guía pública nueva es/en y dos guías puestas al día).
- `docs/API-DIVOOX-FLEX-V1.md`, `.env.example`, `CANDADOS.md`, `PENDIENTES.md`, `PLAN.md`.

## 4. Migraciones

Todas nacen con `CREATE TABLE IF NOT EXISTS` (seguras en cada publicación). Ninguna toca tablas de Comida ni de dinero.

| Tabla                              | Para qué                                                              |
| ---------------------------------- | --------------------------------------------------------------------- |
| `flex_eventos`                     | Bandeja de eventos de salida (la llenan disparadores)                 |
| `flex_webhooks`                    | Destinos de integración, secreto cifrado, estado, fallos seguidos     |
| `flex_webhook_entregas`            | Cola: un evento por destino, una sola vez (UNIQUE), reintentos        |
| `flex_webhook_intentos`            | Registro de cada intento (sin cuerpo ni secreto)                      |
| `flex_avisos`                      | Clave única por aviso al celular (no se repite)                       |
| `flex_retencion`, `flex_limpiezas` | Políticas por país y servicio; registro de simulaciones y ejecuciones |
| `flex_capacidad_vehiculo`          | Capacidad declarada por la empresa (aparte de `vehiculos`)            |

Columna nueva en tabla existente: `flex_pruebas.purgada_en` (vía la lista `COLUMNAS`, idempotente). Disparadores nuevos (en `esquemaFlex.ts`, recreados por `asegurarFase3`): `flex_eventos_custodia`, `flex_eventos_ruta_asignada`, `flex_eventos_ruta_estado`, `flex_eventos_incidencia`.

## 5. Endpoints (15 nuevos, prefijo `/datos/v1/flex`)

- Integraciones (6): `GET/POST …/integraciones`, `PATCH …/integraciones/{w}`, `POST …/rotar`, `POST …/probar`, `GET …/intentos`.
- Operación (5): `POST …/rutas/{r}/optimizar`, `GET …/vehiculos`, `PUT …/vehiculos/{v}/capacidad`, `GET …/rutas/{r}/capacidad`, `GET …/operaciones`.
- Retención, solo superadmin (4): `GET/PUT /admin/retencion`, `POST /admin/retencion/simular`, `POST /admin/retencion/ejecutar`.
- Cambiados: `asignar` y `ofrecer` aceptan `vehiculoId` + `confirmarCapacidad`.

Detalle completo, cuerpos y verificación de la firma: `docs/API-DIVOOX-FLEX-V1.md`.

## 6. Pantallas

- Panel de la empresa, menú nuevo: **Operación** (indicadores con fechas), **Vehículos** (capacidad), **Integraciones** (alta con el secreto visible una sola vez, prueba, intentos; rotar, pausar y desactivar dentro de los tres puntos).
- Detalle de la ruta: elegir **vehículo** al asignar con el aviso de capacidad y la casilla «Lo sé, asignar igual»; **Sugerir orden** con distancia antes y después, paradas urgentes y «Aplicar este orden».
- Divoox Driver: tocar un aviso de Flex abre «Mi ruta» en esa ruta.
- Todos los formularios nuevos usan el borrador (no pierden lo escrito); éxito en verde; nada de emojis; lo destructivo en los tres puntos.

## 7. Automatización (reloj existente)

Cuatro tareas nuevas dentro de `TAREAS_RELOJ` (GitHub Actions → `/datos/reloj` cada 5 minutos), aisladas entre sí (si una falla, las demás siguen y la salud lo muestra):

| Tarea                     | Crítica | Qué hace                                                                                                                                                                    |
| ------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flex_ofertas`            | Sí      | Ofertas vencidas → borrador, suelta paquetes y reserva, auditoría `ruta.oferta_vencida` (actor sistema), avisos. Si el conductor aceptó en el mismo instante, gana uno solo |
| `flex_ofertas_por_vencer` | No      | Aviso al conductor a 10 minutos del vencimiento, una vez por oferta                                                                                                         |
| `flex_integraciones`      | No      | Reparte eventos (hasta 20 vueltas de 300) y envía hasta 50 entregas                                                                                                         |
| `flex_limpieza`           | No      | Una vez al día: limpieza según políticas aprobadas                                                                                                                          |

Además, tras cada escritura de la API de Flex se intenta mandar enseguida (en segundo plano, sin demorar la respuesta) lo pendiente de esa empresa.

## 8. Notificaciones

| A quién                                  | Cuándo                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Conductor                                | Oferta, asignación, oferta por vencer, oferta retirada o vencida, ruta cancelada, reintento autorizado         |
| Empresa (dueño, operaciones, operadores) | Aceptada, rechazada, oferta vencida, en camino, incidencia, entregas terminadas, devolución en camino, cerrada |

Clave única por aviso y persona (`flex_avisos`): repetir la petición, que el reloj pase dos veces o dos aislados a la vez no duplican. Textos en español e inglés según la cuenta. Ninguno lleva nombre, teléfono ni dirección del destinatario (comprobado en prueba). Un fallo del aviso nunca deshace la operación.

## 9. Integraciones salientes

- 12 eventos + `*`. Cuerpo estable con `id`, `type`, `created_at`, `company_id`, `api_version`, `data`.
- Firma `Divoox-Signature: t=…,v1=…` (HMAC-SHA256 sobre `"{t}.{cuerpo}"`); durante la rotación van dos firmas. Id único `Divoox-Event-Id` (protección contra repeticiones junto con la tolerancia de 5 minutos).
- Cola con candado por fila (dos vueltas a la vez no mandan lo mismo: probado), reintentos a 1, 5, 15, 60, 180, 360 y 720 minutos (8 intentos), desactivación tras 15 fallos seguidos con entrada en la auditoría, reactivación por la empresa.
- Botón de prueba (`ping`), registro de intentos, rotación con gracia de 0 a 168 horas.
- Aislamiento: lo de otra empresa responde 404; los eventos solo van a los destinos de su empresa; las claves de API no gestionan integraciones (403).

## 10. Seguridad

- **Anti-SSRF**: solo HTTPS en el 443; sin usuario y contraseña; sin IP escritas; sin `localhost`, `.local`, `.internal`, `.lan`, `.corp` y otros sufijos internos ni los propios dominios de Divoox; resolución por DNS sobre HTTPS y rechazo si alguna IP es privada, local, de enlace, de documentación, multidifusión o reservada (v4, v6 y v4 dentro de v6, incluido `169.254.169.254`); redirecciones nunca seguidas; comprobación al registrar **y** antes de cada envío.
- **Secretos**: se muestran una vez; se guardan cifrados con AES-GCM. Llave `FLEX_LLAVE_WEBHOOKS`; si falta, una derivada del secreto del reloj (marcada «provisional» en cada secreto para poder migrarla); sin ninguna, las integraciones responden 503.
- **Sin datos personales** en eventos y avisos.
- **Lo destructivo** (retención) exige rol de superadmin, simulación previa y política aprobada para lo sensible.

## 11. Optimizador

- Puro, en `packages/compartido` (servidor, panel y pruebas usan el mismo código), separado de la interfaz.
- Vecino más cercano desde el centro + mejora local 2-opt que nunca rompe una regla.
- Reglas: si la ventana de A termina antes de que empiece la de B, A va antes; las paradas urgentes van antes que las demás salvo que una ventana diga lo contrario; ventanas al revés se ignoran y se avisan; paradas sin coordenadas al final y avisadas.
- Si el orden de la empresa ya es igual o mejor, no se cambia.
- 150 paradas: unos 12 ms (sección 14). Nunca escribe; aplicar = el reordenamiento de siempre, que la base solo acepta antes de salir.
- No calcula tiempos de manejo (no tenemos datos de calles ni tráfico): solo distancia en línea recta, marcada como aproximada.

## 12. Capacidad de vehículos

- La empresa declara por vehículo de sus conductores: máximo de paquetes, peso (kg), volumen (litros) y lado más largo de un paquete (cm). Tabla propia; `vehiculos` de Comida intacta (probado).
- Al asignar u ofrecer con un vehículo: si excede, `409 capacidad` hasta que la empresa confirme. Sin capacidad declarada o sin pesos y medidas, el estado es «desconocida» y se dice qué falta; nunca se toma como «cabe».

## 13. Retención y limpieza

| Categoría       | Días de fábrica | Aprobada de fábrica | Qué borra                                                               |
| --------------- | --------------- | ------------------- | ----------------------------------------------------------------------- |
| `idempotencia`  | 7               | Sí                  | Respuestas guardadas de claves de idempotencia (empresas y conductores) |
| `avisos`        | 30              | Sí                  | Registro de avisos enviados                                             |
| `integraciones` | 30              | Sí                  | Entregas terminadas, sus intentos y eventos ya repartidos               |
| `ubicacion`     | 90              | **No**              | Última ubicación del conductor en rutas cerradas                        |
| `pruebas`       | 365             | **No**              | Archivo de fotos y firmas (la fila queda con `purgada_en`)              |

Políticas por país (`US`, `CO`… o `*`) y servicio (`flex` o `*`); gana la más específica. La simulación cuenta sin tocar nada; ejecutar a mano exige una simulación de la última hora. Nunca se borra una prueba ligada a una incidencia abierta. La custodia (eventos) es inmutable y no entra en la limpieza.

## 14. Escalabilidad

Medido con `FLEX_ESCALA=1` (SQLite local en memoria, mediana de 5 corridas; **no incluye la red de D1**, que en producción suma unos milisegundos por consulta). Cada empresa con una ruta en curso; 4 eventos de custodia por paquete.

| Empresas | Paquetes por ruta | Paquetes totales | Eventos en bandeja | Rutas en curso (ms) | Detalle de ruta (ms) | Indicadores (ms) | Ruta del conductor (ms) | Sugerir orden (ms) | Repartir 300 eventos (ms) |
| -------- | ----------------- | ---------------- | ------------------ | ------------------- | -------------------- | ---------------- | ----------------------- | ------------------ | ------------------------- |
| 10       | 40                | 400              | 1 600              | 0,3                 | 0,6                  | 0,2              | 0,4                     | 1,5                | 0                         |
| 10       | 150               | 1 500            | 6 000              | 0,2                 | 1,5                  | 0,4              | 1,4                     | 12,5               | 0,3                       |
| 100      | 40                | 4 000            | 16 000             | 0,3                 | 0,5                  | 0,2              | 0,4                     | 1,0                | 0,3                       |
| 100      | 150               | 15 000           | 60 000             | 0,2                 | 1,2                  | 0,3              | 1,1                     | 11,6               | 0,4                       |
| 1000     | 40                | 40 000           | 160 000            | 0,2                 | 0,4                  | 0,4              | 0,5                     | 1,1                | 0,4                       |
| 1000     | 150               | 150 000          | 600 000            | 0,2                 | 1,3                  | 0,3              | 1,2                     | 14,9               | 1,0                       |

Lectura: el costo de las consultas de una empresa **no crece** con el número de empresas (usan índices por empresa y por ruta; comprobado con el plan de la consulta). El orden sugerido de 150 paradas tarda unos 12 a 15 ms de CPU, muy por debajo del límite de un Worker. Límites a vigilar en producción: (1) D1 tiene un solo escritor: con 1000 empresas escaneando a la vez, las escrituras se encolan (cada escaneo es un lote corto); (2) la bandeja de eventos crece unos 5 eventos por paquete: la limpieza de 30 días la mantiene acotada; (3) el reparto da hasta 20 vueltas de 300 eventos cada 5 minutos (unos 1,7 millones al día) más una vuelta tras cada escritura.

## 15. Pruebas ejecutadas

Obligatorias del pedido, todas automáticas (SQLite en memoria; avisos, DNS y sistemas de las empresas simulados; nada sale a internet):

- Bandeja de eventos: un evento por cambio de custodia, de ruta e incidencia; repetir la petición no duplica; devoluciones al centro como `package.returned`; sin datos personales.
- Vencimiento: vuelve a borrador, suelta paquetes y ocupación, auditoría de sistema, avisos una vez, segunda vuelta sin efectos; carrera aceptar contra vencer (gana uno); las tareas están en el reloj existente.
- Avisos: una vez cada uno, idioma por persona, sin datos del destinatario; retirar y cancelar avisan.
- Anti-SSRF: 8 direcciones prohibidas por forma, 12 IP privadas y 4 públicas, nombres que resuelven a IP internas, redirección no seguida.
- Integraciones: secreto una vez y cifrado; 503 sin llave; firma válida, alterada, con otro secreto y fuera de tiempo; solo los eventos pedidos; sin repetición; reintentos y rendición; desactivación tras 15 fallos y reactivación; dos despachos a la vez; rotación con dos firmas y sin gracia; aislamiento y claves de API.
- Optimización y capacidad: sugerencia más corta sin escribir; aplicable solo antes de salir; aviso y confirmación de capacidad; lo desconocido no se inventa; vehículos de Comida intactos; ventanas, urgentes, sin coordenadas, 150 paradas en menos de 1 s.
- Retención: simular no borra; ejecutar borra lo técnico; nunca pruebas sin política; con política aprobada borra el archivo y deja la fila; protege pruebas de incidencias abiertas; solo superadmin; ejecutar sin simular, no.
- Indicadores: números reales, «sin dato» sin ventanas, ningún campo de dinero, aislamiento.
- Panel: indicadores, secreto visible una vez, desactivar en los tres puntos, aviso de capacidad con confirmación, sugerencia que se aplica solo al tocar, capacidad en kg y litros.
- Revisores: el botón confirma las cuentas viejas de revisión y solo esas.

**Candados comprobados en rojo** (se rompió a propósito cada protección y la prueba falló): bandeja de eventos, anti-SSRF por DNS, avisos sin duplicar, retención sin política, redirección, capacidad y cuentas de revisores.

`npm run verify` (tipos, lint, pruebas con cobertura, build y auditoría): ver la sección «Resultado de la verificación» al final.

## 16. Protocolo de celulares reales, ruta piloto y cuentas de revisores

- **Protocolo y piloto**: `docs/DIVOOX-FLEX-PROTOCOLO-PILOTO.md` — requisitos, preparación, 18 pasos con el resultado esperado, qué medir, planilla y criterios de aceptación para una ruta de 20 a 40 paquetes en Android y iPhone. **No se ejecutó en la calle**: necesita personas y celulares; los avisos en Android esperan Firebase y en iPhone la cuenta de Apple.
- **Cuentas de revisores**: las tres cuentas de las tiendas creadas antes del candado del 27 oct quedaban sin el correo confirmado y, con la Fase 1, el servidor dejaría de reconocerlas como revisoras. **Resuelto en el código**: volver a tocar «Crear cuentas de revisión» en el superadmin las confirma (solo las marcadas como revisor con su rol; nunca una cuenta ajena; no cambia sus claves). **No se tocó ninguna cuenta real**: hacerlo en producción es un paso del día de la publicación, con autorización.

## 17. Riesgos pendientes y limitaciones

1. **Llave de cifrado en producción**: en staging ya está la llave dedicada. En producción, sin `FLEX_LLAVE_WEBHOOKS`, los secretos se cifrarían con una llave derivada del secreto del reloj (provisional). Se pone el día que Flex pase a producción.
2. **Latencia de las integraciones**: casi inmediata tras cada escritura; en el peor caso, hasta 5 minutos (el reloj). El orden de los eventos no está garantizado (se documenta usar `occurred_at`).
3. **DNS rebinding**: se comprueba el DNS antes de cada envío, pero entre la comprobación y la conexión el nombre podría cambiar. En Cloudflare Workers las conexiones a redes privadas ya están bloqueadas por la plataforma, lo que cierra ese hueco en la práctica.
4. **Avisos al celular**: dependen de Firebase (Android) y Apple (iPhone), todavía pendientes de Richard. El código está listo y probado con el transporte simulado.
5. **Optimización**: línea recta, no calles ni tráfico; sin tiempos estimados por decisión (no inventar).
6. **Escala**: medida en SQLite local; falta una medición en D1 real con carga concurrente (en el piloto).
7. **Piloto en la calle**: no ejecutado (requiere personas y celulares).

## 18. Recomendaciones y decisiones para la Fase 4 (dinero)

1. Ejecutar el piloto de la sección 16 en staging antes de cualquier cobro.
2. Poner `FLEX_LLAVE_WEBHOOKS` en producción el día que Flex pase allá (en staging ya está).
3. Decidir el modelo de cobro de Flex (por paquete, por ruta o por bloque de horas) y la custodia de fondos (recomendación de la auditoría: Stripe cobra, el libro registra), con la compra real de 1 dólar como prueba previa obligatoria.
4. Aprobar o no las políticas de retención sensibles (ubicación y pruebas) por país: es una decisión legal y de negocio.
5. Al publicar en producción: marcar confirmadas las cuentas de revisión con el botón del superadmin (con autorización).

**Esperando la autorización de la Fase 4.**

## Resultado de la verificación

| Comprobación                                                                       | Resultado                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run verify` (tipos, lint sin avisos, pruebas con cobertura, build, auditoría) | Verde                                                                                                                                                                                                                                |
| Archivos de prueba                                                                 | 158 pasan, 1 saltado (la medición de escala, que corre a mano)                                                                                                                                                                       |
| Pruebas                                                                            | 975 pasan, 2 saltadas                                                                                                                                                                                                                |
| Vulnerabilidades (`npm audit`, nivel alto)                                         | 0                                                                                                                                                                                                                                    |
| Tipos de las apps (cliente, Driver, restaurante) y paquetes                        | Sin errores                                                                                                                                                                                                                          |
| Recorrido en pantalla del panel (local)                                            | Operación, Vehículos, Integraciones (secreto una vez, menú de tres puntos), sugerencia y aplicación del orden (19,5 km a 7,7 km), aviso de capacidad (8 de 6), freno del servidor sin confirmar y exclusividad del conductor ocupado |

Encontrado y corregido durante el recorrido: los menús de tres puntos de Flex salían como botones rojos (ahora son un menú blanco con lo destructivo en rojo), los decimales salían con punto en español (ahora con coma) y la lista sugerida tenía doble numeración.

## Sitio de pruebas (staging)

| Comprobación                                             | Resultado                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Publicación de la rama `fase-flex-3` (versión `de2eaf6`) | Verde: compuertas, paquete, semáforo 200, pruebas S de la Fase 0, tiempo real en vivo, conciliación contra Stripe en modo prueba                                                                                                                                          |
| Recorrido completo de Comida                             | Primer intento: el recorrido en inglés se cortó por tiempo (el navegador del cliente perdió la conexión: 51 peticiones sin respuesta mientras el navegador del conductor recibía cientos de respuestas 200 del mismo servidor). Segundo intento: verde en los dos idiomas |
| Salud después de publicar                                | `ok`, esquema `ok` (tablas y columna nuevas aplicadas), reloj `ok`                                                                                                                                                                                                        |
| Llave `FLEX_LLAVE_WEBHOOKS`                              | Cargada en el sitio de pruebas con la llave del sitio de pruebas (`scripts/staging/cargar-llave-flex.sh`; copia en `~/.config/tumbite/flex-llave-webhooks-pruebas`, fuera del repo). **Producción no se tocó.**                                                           |
