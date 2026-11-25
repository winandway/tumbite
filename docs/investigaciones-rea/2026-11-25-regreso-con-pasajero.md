# Regreso con pasajero: investigación y decisión

**Fecha:** 25 nov 2026 · **Rama:** worktree-agent-a59742cd6be12444f (solo local) · **Quién pidió:** Richard, vía el jefe de operaciones · **Países:** todos (la regla es la misma; los números salen de ajustes por país)

Pregunta: un conductor termina un viaje largo en otra ciudad. ¿Cómo hacen los grandes para que vuelva a casa con pasajero y no vacío, y cómo lo hacemos nosotros, ahora que el destino puede estar en cualquier punto del país (C-DESTINO-EN-EL-PAIS)?

## 1. Referencia estudiada

- **Uber** (Destination Mode / Driver Destinations): la función más parecida. Es el estándar.
- **Lyft** (Destination Mode): la misma idea, más simple.
- **DiDi** (Set Mode / Point-to-Point): la misma idea, con otro tope diario.
- **inDrive** (Intercity): resuelve el viaje entre ciudades, pero por negociación de precio, no por filtro de rumbo.
- **BlaBlaCar**: el modelo inverso (el conductor publica su ruta de antemano y el pasajero reserva un asiento).
- **Cabify**: no se investigó a fondo; ver [NV] abajo.
- Estudios de Richard: no se consultaron para esta ficha; el tema (regreso a casa) no está en sus capítulos de comida. Pendiente de cruzar si él los amplía.

## 2. Evidencia y sus limitaciones

**Método y límites.** Solo documentación pública y páginas oficiales leídas como visitante, sin cuentas, sin saltar nada, sin descompilar apps. **No se corrió REA en esta ficha**: no hay artefacto propio nuevo que capturar (la función aún no existe) y los competidores no se analizan con REA (§4 de la metodología). El código nuestro se comparó leyendo el fuente. No hay paquete de evidencia con hash. Las páginas se leyeron con la herramienta de lectura web, que entrega un resumen del texto, no la captura de pantalla; no hay capturas guardadas.

### Uber

- [DOC] Blog oficial de Uber del 12 de mayo de 2026: el modo destino muestra solicitudes «en dirección» a la dirección escrita; el filtro nuevo **prioriza** los viajes que mantienen al conductor rumbo a su destino, estimando el tiempo y la distancia extra que cada viaje le añade. https://www.uber.com/us/en/blog/destination-mode/
- [DOC] Mismo blog: **dos usos por día**; cada sesión empieza cuando le llega una solicitud «Exclusive». O sea, Uber cuenta el uso cuando hay viaje, no cuando se enciende (lo cual coincide con la ayuda que ya leímos el 2 nov: poner el destino y no recibir viaje no gasta el uso).
- [DOC] Mismo blog: dos formas de ruta: **«Flexible»** (amplía el área de búsqueda; puede añadir tiempo a la llegada) y **«Faster»** (solo viajes directamente sobre la ruta; puede dar menos solicitudes). https://www.uber.com/us/en/blog/destination-mode/
- [DOC] Página de Uber Drive: «número limitado de usos por día», sin cifra; «no disponible en NYC»; «puede variar por mercado». https://www.uber.com/us/en/drive/basics/driver-destinations/
- [DOC, fuente secundaria] Resúmenes de terceros (The Rideshare Guy, RidesharingDriver) coinciden: varios viajes seguidos con el mismo destino; se mantiene hasta desconectarse o apagarlo; no se puede encender en un aeropuerto; los conductores reportan que el emparejamiento tarda más. No son documentación de Uber.
- [DOC] Anuncio de Uber de 2016/2015 (TechCrunch y newsroom de Uber): origen de «hasta dos veces al día».
- [NV] Los umbrales exactos de «en dirección» (grados, kilómetros, minutos extra): Uber no los publica.

### Lyft

- [DOC] Es un **filtro**, no una prioridad: «solo emparejas con solicitudes a lo largo de tu ruta»; el conductor ve menos solicitudes de lo normal; se apaga con la «x» junto a la dirección. https://www.lyft.com/hub/posts/destinationmode
- [DOC] Los viajes de modo destino cuentan para la tasa de aceptación y no cuentan para el bono Power Driver ni las garantías por hora.
- [NV] Número de usos por día y duración: la página no los dice.

### DiDi

- [DOC] Ayuda de DiDi Australia, «Point-to-Point trips»: «cada día tienes **3 oportunidades**»; se abre desde «Set Mode»; con el destino puesto solo se piden solicitudes en la ruta hacia allá; consejo oficial: al terminar el día pon tu casa. https://web.didiglobal.com/au/help-center/how-do-point-to-point-trips-work/
- [NV] Cómo mide «en la ruta», cuándo se reinicia el tope, y si aplica fuera de Australia.

### inDrive (Intercity)

- [DOC] El pasajero publica ruta y precio; **los conductores «de la ruta» ven la solicitud** y aceptan o contraofertan precio u hora; el precio final se acuerda antes de salir; se paga directo al conductor. Los conductores pasan verificación previa (experiencia mínima por categoría, edad, licencia de transporte para minibús). https://indrive.com/intercity-rides
- [DOC] Esa página no describe un filtro de rumbo ni una función de «regreso a casa» para el conductor. En la búsqueda sí apareció una sugerencia de usuarios pidiendo que el conductor comparta destino (solicitud de función, no una función confirmada).
- [INF] inDrive resuelve el regreso por **precio** (el conductor pone el que le sirve) más que por prioridad.

### BlaBlaCar

- [DOC, fuente secundaria] Blogs de terceros: el conductor publica ruta, fecha, hora y asientos; el precio por asiento lo sugiere la plataforma dentro de un rango; puede añadir paradas intermedias; el pasajero reserva y la plataforma retiene el pago hasta el día del viaje. Es el modelo de **viaje programado de antemano**; no hay en lo leído una función de «volver ahora».
- [INF] Para nosotros equivale a nuestros viajes programados (`viajesProgramados.ts`), no al despacho inmediato.

### Cabify

- [NV] No se encontró ni se leyó documentación pública de un modo destino de Cabify en esta ronda. No se afirma nada.

### Lo que sale de las referencias (síntesis)

| Dato                | Uber                                      | Lyft             | DiDi         | inDrive                      | BlaBlaCar                 |
| ------------------- | ----------------------------------------- | ---------------- | ------------ | ---------------------------- | ------------------------- |
| Usos al día         | 2 [DOC]                                   | no dicen [NV]    | 3 [DOC]      | no aplica                    | no aplica                 |
| Filtra o prioriza   | prioriza por tiempo/distancia extra [DOC] | filtra [DOC]     | filtra [DOC] | ni uno ni otro; precio [DOC] | reserva previa [DOC sec.] |
| Cuándo gasta el uso | al llegar el viaje exclusivo [DOC]        | [NV]             | [NV]         | —                            | —                         |
| Opciones de rumbo   | Flexible / Faster [DOC]                   | una [DOC]        | una [DOC]    | —                            | paradas [DOC sec.]        |
| Se apaga            | al apagar o desconectarse [DOC sec.]      | con la «x» [DOC] | [NV]         | —                            | —                         |

## 3. Diagrama técnico

```mermaid
flowchart TD
    A[Conductor termina viaje en ciudad B<br/>zona distinta a su ciudad base] -->|[INF] regla nuestra| B{¿Viaje largo?<br/>termina a más de 25 km de su ciudad base}
    B -- no --> Z[Sin botón: modo destino normal]
    B -- sí --> C[Botón «Voy de regreso a CIUDAD BASE»]
    C --> D[PUT /datos/repartidor/regreso<br/>guarda modo_destino tipo=regreso, usos_regreso +1 con tope 2]
    D --> E[repartirOperaciones cada vuelta]
    E --> F[candidatosParaOperacion<br/>elegibles en zona B, libres, ≤15 km de la recogida]
    F --> G{¿Viaje sale de donde está<br/>y va hacia su ciudad?<br/>ángulo ≤45° y acerca ≥5 km}
    G -- sí --> H[Va PRIMERO en la lista<br/>si su recogida ≤ más cercana + 3 km]
    G -- no --> I[Con regreso encendido: NO recibe la oferta<br/>como el filtro actual de modo destino]
    H --> J[Oferta de 30 s, como siempre]
    I --> E
    J --> K[Acepta → lleva al pasajero → llega a ≤0,5 km de su ciudad → el modo se apaga solo]
```

Etiquetas: el esquema de despacho es lo nuestro (código); las reglas de «prioriza» (Uber [DOC]) y «filtra» (Lyft/DiDi [DOC]) vienen de la tabla de arriba; los números de las flechas son [INF] nuestros.

## 4. Comparación con Divoox

| Hallazgo del mercado                                                           | Divoox hoy (archivo:línea)                                                                                                                                                                                                                                      | Veredicto          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Modo destino con tope diario (Uber 2, DiDi 3)                                  | `USOS_DESTINO_DIA = 2`, un uso por encendido, contador por día de la ciudad del conductor: `packages/compartido/src/modoDestino.ts:10`, `apps/servidor/src/modoDestino.ts:93-143`                                                                               | ✅                 |
| Solo llegan solicitudes hacia el destino                                       | El filtro es **duro** y mide solo el **destino del viaje**: `acercaAlDestino` exige acercarse ≥0,5 km (`modoDestino.ts:14`, `operaciones.ts:845-851`). Vale para comida y viajes (`rutas/operacion.ts:2094`)                                                    | ✅                 |
| Prioridad al conductor que va hacia allá (Uber «prioriza»)                     | El orden es primero «quien no la vio», luego **más cercano** a la recogida y luego más puntos (`operaciones.ts:298, 313`). El modo destino no sube a nadie en la lista, solo excluye a los demás                                                                | ❌                 |
| «Cerca de donde estoy» (el viaje sale de donde está)                           | Tope fijo `KM_MAXIMO_OFERTA = 15` (`operaciones.ts:78`); candidatos solo de la **misma zona** de la operación (`operaciones.ts:240`). Vale para el regreso: el conductor está en la zona B (la recogida está en una ciudad abierta)                             | ✅                 |
| Rumbo del viaje (dirección, no solo cercanía final)                            | No existe. Un viaje que lo deja 0,5 km más cerca pero antes lo lleva en sentido contrario cuenta como bueno. No se mide el desvío hasta la recogida                                                                                                             | ❌                 |
| Destino en cualquier punto del país                                            | Sí desde el 25 nov: `destinoEnElPais.ts:59`, `C-DESTINO-EN-EL-PAIS` en `CANDADOS.md`. El tope de km es 1500 y por ciudad                                                                                                                                        | ✅                 |
| Botón de «regreso» con un toque y sin escribir dirección (DiDi: «pon tu casa») | El conductor tiene que escribir la dirección con `CampoDireccion` (`apps/repartidor/src/piezas/ModoDestino.tsx`); no hay «ciudad base» guardada: `repartidores.zona_id` se queda en la **última zona donde estuvo** (`rutas/operacion.ts:1879`), no es el hogar | 🟡                 |
| Tope se gasta cuando llega un viaje (Uber)                                     | Se gasta al **encender** (`modoDestino.ts:111-135`). Un conductor que enciende y no recibe nada pierde un uso                                                                                                                                                   | 🟡                 |
| Apagado al llegar                                                              | `revisarLlegadaDestino` a ≤0,5 km, con cada ubicación (`modoDestino.ts:34`, `rutas/operacion.ts:1898`)                                                                                                                                                          | ✅                 |
| Aviso al pasajero de que viene un conductor de regreso                         | No existe y el mercado no lo hace; no se hace [INF]                                                                                                                                                                                                             | ✅ (no hace falta) |
| Precio distinto en el regreso (inDrive: lo pone el conductor)                  | Precio fijo del viaje, comisión de la política (`operaciones.ts:~780`). No se cambia: es una decisión de dinero                                                                                                                                                 | — se descarta      |

Lectura: lo que ya hay sirve como **filtro duro**. Lo que falta para «regreso con pasajero» es (1) saber la ciudad base, (2) un botón con un toque tras un viaje largo, (3) medir el **rumbo** y no solo el acercamiento final, y (4) **dar prioridad** (no solo filtrar) para que el pasajero que pide en ese sentido encuentre a ese conductor primero.

## 5. Decisión de implementación

Es una función importante: va completa de punta a punta (servidor, panel, app Driver, Docs, pruebas) y para todos los países. No es MVP.

**5.1 Ciudad base.** Columna nueva `repartidores.zona_base_id` (va en COLUMNAS de `esquemaColumnas.ts`, en `schema.sql` y como migración aparte, nota en `CANDADOS.md`). Se llena sola la primera vez que el conductor se conecta (copia de su `zona_id`) y el panel/soporte puede cambiarla. [INF] Alternativa descartada: usar la dirección de su alta, porque no todos los países la piden.

**5.2 «Voy de regreso a <ciudad base>».**

- Ruta nueva `POST /datos/repartidor/regreso` (y `DELETE` para apagar), en `modoDestino.ts`. Reutiliza `modo_destino` con una columna nueva `tipo` (`'destino' | 'regreso'`; `'destino'` por defecto, no cambia nada de lo vigente). El destino guardado es el centro de la ciudad base (`zonas.lat/lng`).
- **Aparece** solo si el conductor está en una zona distinta de su base y a más de **25 km** de su centro. [INF] 25 km: umbral nuestro; el mercado no publica uno. Sale de ajustes por país (`regreso_km_minimo`), por ciudad no.
- **Contador propio** en tabla nueva `usos_regreso (repartidor_id, dia, usos)` (nace completa, sin migración), tope **2 por día** como Uber/Lyft [DOC], con el mismo paso único con tope que el modo destino (BRE-R2). **No gasta** los dos usos del modo destino normal. El uso se **cuenta al aceptar el primer viaje** (como Uber, sesión que empieza con el viaje) y no al encender: encender y no recibir nada no cuesta. [DOC Uber]
- Se apaga solo al llegar a ≤0,5 km de la ciudad base (la regla de hoy), al apagarlo, al desconectarse o a las **6 horas** de encendido [INF: el regreso de una ciudad vecina no pasa de eso]. No se puede encender mientras tiene un viaje en curso.
- No convive con el modo destino normal: encender uno apaga el otro (una sola fila por conductor).

**5.3 Rumbo, no solo cercanía.** Función nueva en `packages/compartido/src/modoDestino.ts`: `rumboHaciaCasa(actual, recogida, destinoViaje, casa)` devuelve true solo si:

1. el viaje **sale de donde está** el conductor (ya cubierto por los 15 km de `KM_MAXIMO_OFERTA`);
2. el ángulo entre «recogida → destino del viaje» y «conductor → casa» es **≤ 45°** [INF; Uber Faster/Flexible ≈ estrecho/ancho, sin cifra pública];
3. el viaje lo acerca **≥ 5 km** a casa (en lugar de los 0,5 km del modo destino normal; el regreso es de decenas de km, y 0,5 km deja pasar viajes inútiles). [INF]

Mientras el regreso está encendido, el conductor **solo recibe** viajes que cumplan las tres (filtro duro, como Lyft/DiDi [DOC]). Si la recogida queda a más de 15 km, no entra (el tope de siempre).

**5.4 Prioridad al pasajero.** En `candidatosParaOperacion` (`operaciones.ts:298` y `313`) se agrega un criterio al sort: primero quien no la vio (se mantiene), **luego quien tiene regreso encendido que cumple `rumboHaciaCasa`**, luego cercanía y puntos. La prioridad tiene un límite para no castigar al pasajero: el de regreso pasa adelante solo si su recogida está a **≤ la del conductor más cercano + 3 km** [INF; evita que un pasajero espere de más por favorecer al de regreso]. Fuera de ese límite, manda la cercanía. La oferta sigue siendo de 30 s y la reoferta, igual (`C-REOFERTA-*`).

**5.5 Lo que NO se toca.** `C-DESTINO-EN-EL-PAIS` (la validación del destino y el tope de km), `C-MODO-DESTINO` y sus pruebas (el modo destino normal queda idéntico), las políticas de comisión y el precio del viaje (decisión de dinero: nada cambia), el despacho de comida (el regreso es solo para Moto, Carro y Envíos; comida no lleva regreso).
Riesgos: (a) una zona con un solo conductor de regreso y rumbo estricto lo deja sin ofertas; se cubre con el botón de apagar y el aviso claro «verás menos viajes» (como Lyft). (b) El sort pasa a depender de una consulta de `modo_destino` por vuelta: ya existe `destinosActivos` en `repartirOperaciones` (una consulta), se reutiliza con el campo `tipo`; cero escrituras nuevas por vuelta (regla de la nube).

**5.6 Pantallas y textos.**

- App Driver (Android e iPhone iguales): tarjeta en Inicio tras un viaje largo con el botón «Voy de regreso a <ciudad>», «Te quedan X usos hoy» y «Verás solo viajes hacia <ciudad>» con el botón «Apagar». Es/en. Sin «Pronto».
- Panel: campo «Ciudad base» del conductor (soporte) y ajustes por país del umbral (km, ángulo, extra de recogida) con los valores por defecto de arriba.
- Docs públicos de conductores, es/en, con capturas reales (sitio de pruebas, datos neutros). Sin umbrales publicados.

## 6. Pruebas de aceptación

Cada una se escribe primero y se ve en rojo (quitando la regla).

1. `rumboHaciaCasa` (compartido): viaje hacia casa a 5 km → sí; viaje hacia casa pero a 3 km → no; viaje perpendicular (90°) → no; en sentido contrario → no; justo en 45° → sí.
2. Servidor, despacho: dos conductores libres en la ciudad B; el B2 (regreso encendido) más lejos que el B1 por 2 km; un viaje B→casa → la oferta va a B2. Con 5 km más lejos → va a B1.
3. Servidor: conductor con regreso encendido **no** recibe un viaje que sale en sentido contrario ni uno que lo acerca menos de 5 km; sí recibe uno que cumple. Quien no lo tiene encendido sigue recibiendo todo (sin cambios).
4. Servidor: el botón solo se acepta con viaje terminado fuera de su ciudad base a más de 25 km; dentro → 409 con mensaje claro; con viaje en curso → 409.
5. Servidor: tope de 2 usos al día, el tercero → 409; el uso se cuenta al aceptar el primer viaje, no al encender; dos toques a la vez no pasan de 2; el contador es independiente del de modo destino.
6. Servidor: se apaga al llegar a ≤0,5 km de la ciudad base, a mano, al desconectarse y a las 6 horas.
7. Servidor: encender el regreso apaga el modo destino normal y al revés; el modo destino normal conserva todas las pruebas de hoy (`modoDestino.test.ts`, `modoDestinoRevision.test.ts`) sin cambios.
8. Servidor: la columna `zona_base_id` y la tabla `usos_regreso` existen en la base de pruebas con el esquema real (candado de columnas); la zona base se llena sola en la primera conexión.
9. Servidor, nube: una vuelta de reparto con regreso encendido no hace más de una consulta extra y **cero escrituras** nuevas (prueba de presupuesto).
10. App Driver: la tarjeta aparece solo en las condiciones de la prueba 4; textos es/en; usa `CampoDireccion` donde pida dirección (no aplica: el destino es la ciudad base); sin «Pronto».
11. Panel: soporte cambia la ciudad base; los ajustes por país se guardan y llegan al despacho.
12. Staging (Stripe en modo prueba): con dos cuentas demo, un conductor termina un viaje Novi→otra ciudad abierta, enciende el regreso, un cliente demo pide un viaje en sentido de regreso y la oferta le llega **primero** a ese conductor; recorrido con capturas reales para Docs.
13. Docs es/en publicados con capturas, sin umbrales ni nada interno.

Lo que **no** se resuelve aquí y requiere decisión de Richard (dinero/legal, no de producto): si el conductor de regreso gana distinto (descuento, comisión menor) y si se publican los viajes de regreso para pasajeros como producto aparte («Intercity»). La propuesta de esta ficha no cambia precios.
