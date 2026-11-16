# Conductor de confianza y viajes fijos (rutinas): cómo lo resuelve el mercado

**Fecha:** 16 de noviembre de 2026. **Puesto:** investigador. **Aplica a:** todos los países (el piloto de El Vigía y Tucaní es el primer uso; Venezuela efectivo primero, EE. UU. con tarjeta).
**No se tocó código del producto.**

## 1. Pregunta y contexto real

El piloto en El Vigía y Tucaní tiene mototaxistas con clientes fijos: una señora cuyo mototaxista lleva a su hija a la escuela por la mañana y la busca al mediodía; un cliente que va al trabajo todos los días a la misma hora; un cliente que siempre llama al mismo conductor. Hay que decidir cómo se construye «conductor de confianza» y «viajes fijos» copiando el estándar del mercado.

## 2. Referencias y límites de la evidencia

Etiquetas: [DOC] documentación o prensa oficial publicada; [OBS] observado en web pública; [REA] evidencia REA con hash; [INF] inferencia; [NV] no verificable.

**Límite honesto sobre REA:** la herramienta `inspect_web_page` de REA exige un navegador con puerto de depuración (CDP) ya abierto y esta sesión no lo tenía. **No se corrió REA y no hay paquete `evidencia-rea-*.json` ni hash.** Por eso en esta ficha NO aparece ninguna etiqueta [REA]; todo sale de documentación pública leída con búsqueda y lectura de páginas. Las páginas oficiales de Uber y Lyft estaban en parte detrás de JavaScript o devolvieron 403; lo que no se pudo leer en la fuente oficial va como [NV] o con su fuente secundaria nombrada. Nunca se usaron cuentas, apps de terceros descompiladas ni tráfico ajeno.

Fuentes (URL completas, para el archivo; no se leen en el chat):

- Uber, programar un viaje (centro de ayuda): https://help.uber.com/h/63165ec1-0910-409e-972f-0b8d8df1a605
- Uber Reserve, página oficial (Reino Unido): https://www.uber.com/gb/en/ride/how-it-works/reserve/
- Uber, anuncio de Reserve y conductor favorito, TechCrunch, 10 nov 2020: https://techcrunch.com/2020/11/10/uber-will-now-let-users-book-rides-30-days-in-advance-and-pick-a-favorite-driver
- Uber, cuentas para adolescentes (blog oficial): https://www.uber.com/us/en/blog/teen-accounts/
- Uber, páginas oficiales de adolescentes por país: https://www.uber.com/de/en/ride/teens/ y https://www.uber.com/ca/en/ride/teens
- Uber teens, cobertura NBC DFW: https://www.nbcdfw.com/news/national-international/uber-launches-new-feature-to-ensure-safe-trips-for-teens/3478167
- Uber, anonimización de teléfonos: https://www.uber.com/blog/phone-anonymisation
- Uber, normas de la comunidad (no operar fuera de la app): https://www.uber.com/us/en/drive/basics/uber-community-guidelines
- Lyft, viajes programados: https://www.lyft.com/rider/schedule-rides
- Bolt, Perfil Familiar (adultos): https://techweez.com/2025/07/23/bolt-family-profile-ride-booking-feature/
- Bolt y Dubai Taxi, viajes escolares programados (prensa): https://scenenow.com/News/Scheduled-School-Ride-Option-Introduced-Across-Dubai-App-Platforms
- Gojek, viajes programados GoRide/GoCar: https://www.gojek.com/help/gocar/fitur-jadwalin-pesanan/
- Hopp (Canadá), guía del conductor de viajes programados: https://gethopp.com/en-ca/driver/guide/scheduled-rides/
- HopSkipDrive (viajes de niños con repetición, avisos al padre, conductor consistente): https://www.hopskipdrive.com/families/ y https://secure.businesswire.com/news/home/20260514110338/en/HopSkipDrive-Brings-Free-Ride-Recording-and-Consistent-CareDriver-Program-to-2026-2027-School-Year
- Grab, GrabFamily y reserva anticipada: https://www.grab.com/sg/driver/family/
- inDrive, elegir conductor entre ofertas y viajes entre ciudades: https://indrive.com/intercity-rides
- Rapido, Power Pass (prensa 2019): https://yourstory.com/2019/07/bike-taxi-app-rapido-power-pass-subscription-programme
- Rapido, suscripción del conductor (prensa 2024): https://www.medianama.com/2024/02/223-rapido-subscription-model-auto-drivers/
- DiDi México, bloqueo de conductores (Xataka): https://www.xataka.com.mx/aplicaciones/didi-permite-bloquear-conductores-pasajeros-mexico-para-lograr-mejores-experiencias-asi-puedes-hacerlo/amp
- Cabify, manual de usuarios (reserva con 1 hora mínima): https://cabify.com/static/pages/business/learning-center/manual-usuarios.pdf

## 3. Hallazgos por tema

### 3.1 Marcar conductor favorito y pedirlo; espera exclusiva

- Uber: después de un viaje se marca al conductor como favorito; al reservar un viaje programado se elige un favorito y se le ofrece primero. [DOC] (TechCrunch 2020; fuente secundaria ridesharingdriver.com, leída).
- Solo funciona en viajes programados, no en los de pedir ya. [DOC] (misma fuente secundaria; Uber dice en su ayuda que no se puede pedir un conductor concreto en viajes inmediatos, [DOC] ayuda de Uber vía búsqueda). La disponibilidad cambia por ciudad. [DOC]
- **Cuánto espera antes de pasar a los demás: Uber no lo publica.** [NV] Lo que sí está dicho: si el favorito no acepta, la solicitud pasa a otros conductores cercanos, y el conductor no recibe penalización por rechazar. [DOC]
- Cuántos favoritos se pueden tener: una fuente dice varios [OBS secundaria]; TechCrunch no lo precisa. [NV]
- Lyft: no se encontró función de conductor favorito. [NV] La búsqueda solo encontró que los viajes programados «se emparejan primero». [DOC] Wingz tiene «Favorite Driver» pero su página dio 403. [NV]
- Bolt, DiDi, Cabify, Yango, Grab, Rapido, Gojek: ninguna fuente pública encontrada con conductor favorito. [NV] DiDi México tiene lo contrario: bloquear conductores. [DOC]
- inDrive: no hay favoritos; el pasajero escoge entre los conductores que ofrecieron, viendo oferta, calificación, viajes hechos, carro y tiempo de llegada. [DOC] Esa es su manera de «elegir conductor».

### 3.2 Viajes programados y repetidos

| Plataforma           | Programar                                                                                                                                                                            | Repetir (días/hora/ida y vuelta)                                                                        | Asignación y aviso                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uber (ayuda)         | De 30 min a 30 días antes [DOC]; Reserve hasta 90 días y 15 min de espera incluida [DOC, varía por país]                                                                             | Sin viajes recurrentes propios [OBS secundaria, fuente vieja]. [NV] hoy                                 | La app envía la solicitud antes de la hora; avisa con notificación cuando hay conductor y cuando está cerca; no garantiza conductor; si no consigue, avisa («raro») [DOC] |
| Lyft                 | Hasta 90 días [DOC]; pide mínimo no publicado                                                                                                                                        | Sin repetición publicada [NV]                                                                           | «Se emparejan primero»; cancelar o editar hasta 1 h antes; el conductor espera si llegas tarde [DOC]                                                                      |
| Bolt                 | Programar con fecha y hora; Kenia 72 h [OBS prensa]                                                                                                                                  | Dubái: escuelas con reservas por día, semana o mes [DOC prensa, aclara que lo permiten las autoridades] | 20 % de descuento en zonas escolares [DOC prensa]                                                                                                                         |
| Gojek                | De 7 días a 15 min antes; recargo Rp 3.000 moto y Rp 10.000 carro; un solo viaje programado a la vez [DOC]                                                                           | No; no se puede editar, se cancela y se vuelve a pedir [DOC]                                            | Recordatorio 10 min antes [DOC]; qué pasa sin conductor [NV]                                                                                                              |
| Cabify               | Mínimo 1 h antes [DOC]; cancelar con menos de 45 min cuesta (Zaragoza) y con menos de 20 min (Buenos Aires) [DOC]                                                                    | [NV]                                                                                                    | [NV]                                                                                                                                                                      |
| Hopp (Canadá)        | Hasta 7 días; el conductor acepta la reserva en su lista; si no está en línea a la hora, pasa a otro; se recomienda conectarse 45 min antes; el pasajero tiene 5 min de espera [DOC] | [NV]                                                                                                    | Cobro automático por no presentarse o cancelar con menos de 1 h [DOC]                                                                                                     |
| HopSkipDrive (niños) | Un viaje suelto hasta 6 u 8 horas antes (dos páginas dicen cosas distintas) [DOC]                                                                                                    | **Sí: el padre toca los días y se repite cada semana** [DOC]                                            | Avisos al padre en cada paso [DOC]                                                                                                                                        |
| inDrive              | Viajes entre ciudades con fecha y hora; las ofertas llegan en un minuto [DOC]                                                                                                        | [NV]                                                                                                    | El pasajero acepta una oferta y contacta al conductor [DOC]                                                                                                               |
| Grab                 | Reserva anticipada, con vuelo para aeropuerto [DOC]                                                                                                                                  | [NV]                                                                                                    | [NV]                                                                                                                                                                      |
| DiDi, Yango, Rapido  | No se halló función oficial de programar en la fuente leída [NV]                                                                                                                     | [NV]                                                                                                    | [NV]                                                                                                                                                                      |

Conclusión de mercado: **los grandes de transporte general programan pero casi ninguno repite**. Quien sí repite es HopSkipDrive, porque es transporte de niños con conductor consistente. [INF] Ese es nuestro caso de la escuela.

### 3.3 Viajes de menores

- Uber cuentas para adolescentes (edades de 13 o 14 a 17 según la página; las dos cifras aparecen en fuentes distintas, [NV] la exacta por país): el padre invita desde su Perfil Familiar, el adolescente completa una inducción de seguridad, **el adolescente le da al conductor un PIN único antes de subir** y el conductor no puede iniciar el viaje sin teclearlo. [DOC]
- Seguimiento en vivo del padre de recogida a destino, aviso cada vez que el adolescente pide un viaje, Compartir viaje activado por defecto, RideCheck (detecta desvío, parada inesperada o fin anticipado), y todo eso **no se puede apagar**. [DOC]
- El destino queda bloqueado: el conductor no lo puede cambiar, solo el adolescente. [DOC]
- Conductores: con experiencia y bien calificados; todos pasaron verificación de antecedentes. [DOC] Cuántos viajes y qué nota exacta: [NV].
- Los avisos exactos de «recogido» y «dejado»: Uber los resume como «alertas en tiempo real»; el texto no los separa. [NV]
- HopSkipDrive: avisos cuando el conductor viene en camino, cuando recogió y cuando dejó al niño; el conductor confirma una palabra clave y la fecha de nacimiento en cada recogida (no PIN); huellas digitales contra el FBI, cinco años de experiencia cuidando niños. [DOC] Además un programa de «conductor consistente» que repite el mismo conductor y un reemplazo que ya haya llevado al estudiante si el titular falla (para escuelas, no para familias). [DOC]
- Bolt: su Perfil Familiar solo admite adultos de 18 años; no sirve para un menor viajando solo. El padre recibe aviso de inicio y fin de cada viaje y puede ver el recorrido en vivo y fijar un tope mensual de gasto. [DOC prensa] En Dubái, Bolt ofrece viajes escolares con **PIN de seguridad** y conductores «top». [DOC prensa]
- Grab: GrabFamily es asiento para niños acompañados, no niños solos. [DOC]

### 3.4 Si el conductor fijo no está o no acepta

- Uber: pasa a otro conductor cercano y no hay castigo al conductor [DOC]; si nadie acepta, avisa al pasajero [DOC].
- Hopp: si el conductor no está en línea a la hora, la reserva pasa a otro [DOC].
- HopSkipDrive: reemplazo que ya conozca al niño (programa para escuelas) [DOC].
- Cuánto antes se busca el reemplazo: [NV] en todas.

### 3.5 Pago semanal, mensual, paquetes

- Rapido Power Pass (2019): suscripción de pasajero con ahorro de hasta 40 % por periodo fijo. [DOC prensa; poca fiabilidad y de 2019, hoy [NV]] Lo que sí está bien documentado es la suscripción del **conductor** (cuota fija diaria en lugar de comisión). [DOC prensa 2024]
- Bolt Dubái: reservas escolares por día, semana o mes, con 20 % de descuento. [DOC prensa]
- Bolt Perfil Familiar: tope de gasto mensual por miembro. [DOC prensa]
- Uber, Lyft, Cabify, DiDi: no se halló paquete de viajes fijos pagados por semana o mes. [NV]
- HopSkipDrive cobra por viaje, con ayuda a escuelas por contrato. [INF]

### 3.6 Cómo evitan que se salten la app

- Uber anonimiza teléfonos: ni el conductor ve el número del pasajero ni al revés. [DOC] Hay países donde se apagó el SMS. [DOC]
- Las normas de la comunidad de Uber prohíben operar viajes fuera de la plataforma; en la guía de India, nunca solicitar ni aceptar pago fuera del sistema; en Brasil se pide al pasajero que no pida viajes fuera. [DOC] Hay avisos reales a conductores que hicieron un viaje fuera de la app tras cancelarlo en ella (prensa, enero de 2026). [DOC prensa]
- Pedir al pasajero que cancele después de aceptar puede costar perder acceso al mercado. [DOC]
- **Comisión baja a favoritos, sanciones específicas por saltarse la app en favoritos:** no publicado. [NV]
- Yango: su programa de lealtad premia al conductor con pasajeros más fiables. [DOC] Es incentivo, no candado.

### 3.7 Pausar o saltar un viaje fijo

- Programados sueltos: Uber cancela sin cargo hasta que acepta un conductor y luego aplica las tarifas normales [DOC]; Lyft cancela o edita hasta 1 h antes [DOC]; Gojek no edita, se cancela y se pide de nuevo [DOC]; Hopp cobra si se cancela con menos de 1 h [DOC].
- Pausar toda una repetición (vacaciones, feriados): HopSkipDrive deja elegir los días; el pausado exacto no está descrito en lo leído. [NV]

## 4. Diagramas en texto

**Estados de un viaje fijo (la rutina, el «molde»)**

```
borrador -> (cliente confirma días/hora/ida-vuelta + conductor de confianza) -> propuesta_al_conductor
propuesta_al_conductor -> (acepta) -> activa
propuesta_al_conductor -> (rechaza o 24 h sin respuesta) -> sin_conductor (el cliente elige otro o la deja abierta)
activa -> (cliente o conductor pausa) -> pausada -> (reanuda) -> activa
activa -> (cliente termina o el conductor se retira) -> terminada
cada día: activa -> genera la ocurrencia (viaje programado) -> se salta si hay "saltar este día" o feriado marcado
```

**Estados de cada ocurrencia (el viaje de ese día)**

```
creada(T-48 h) -> avisada_al_conductor(T-12 h) -> confirmada ("voy", si el conductor la toca)
-> recordatorio_a_ambos(T-30 min) -> sin_confirmar? (T-20 min: se abre a otros de la zona, el titular sigue pudiendo tomarla)
-> en_camino -> recogida (PIN) -> en_curso -> terminada
saltada (hasta T-60 min sin cargo) | cancelada | sin_conductor (aviso al cliente y al responsable)
```

**Pedido al conductor de confianza (viaje de pedir ya)**

```
pedido -> oferta exclusiva al favorito (60 s)
   favorito acepta -> asignado
   favorito rechaza / no contesta -> se abre a los demás cercanos
   si el cliente puso "solo mi conductor": espera hasta 5 min y después le pregunta si abre a otros
```

**Viaje de menor**

```
responsable crea o aprueba -> asignado solo a conductor habilitado (acepta_menores + aprobado por el responsable)
-> aviso "conductor en camino" -> PIN (el menor lo dice) -> aviso "recogido: hora y lugar"
-> seguimiento en vivo (enlace sin app) -> aviso "dejado: hora y lugar"
alertas extra: retraso mayor de 10 min, desvío mayor de 300 m, parada mayor de 3 min.
```

## 5. Comparación con lo que ya tiene Divoox

Lo que ya existe en el código (leído, no modificado):

- Viajes programados: desde 30 minutos hasta 7 días, cancelación sin cargo hasta 60 minutos antes, y búsqueda de conductor 15 minutos antes de la hora por defecto (ajustable por ciudad). `packages/compartido/src/viajesProgramados.ts`.
- PIN de 4 dígitos para empezar un viaje, apagable por zona y servicio. `apps/servidor/src/viajeCrear.ts`, `apps/servidor/src/rutas/ajustesViaje.ts`.
- Columna `acepta_menores` en vehículos. `apps/servidor/src/esquema.ts`.
- Enlace de seguimiento en vivo para quien recibe un envío, sin necesidad de app. `apps/servidor/src/rutas/viajesPasajero.ts`.

Brechas:

| Necesidad del piloto         | Estado en Divoox                                           | Brecha                                                                |
| ---------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| Conductor de confianza       | No existe                                                  | Tabla de vínculos y oferta exclusiva                                  |
| Viaje fijo (rutina repetida) | No existe; solo programados sueltos                        | Molde de rutina + generador de ocurrencias                            |
| Menores con responsable      | Solo bandera `acepta_menores`                              | Perfil de responsable, avisos, PIN de menor, seguimiento              |
| Reemplazo si el fijo falla   | No existe                                                  | Apertura a otros a T-20 min                                           |
| Pago semanal o mensual       | No existe                                                  | Liquidación semanal visible; nada de dinero real sin orden de Richard |
| Evitar saltarse la app       | Teléfono visible tras aceptar, según el flujo actual [INF] | Reglas de comisión y ocultar el número de teléfono hasta aceptar      |

## 6. Decisión recomendada

**Se construye el conductor de confianza como vínculo, y la rutina como un molde que genera viajes programados normales.** Cada ocurrencia usa el programado que ya existe; así no se duplica el circuito de pagos, cancelación y despacho.

Números (todas son [INF], porque Uber, Lyft y los demás no publican sus tiempos; se eligieron para una moto con conexión irregular y se ajustan con datos del piloto):

1. **Espera exclusiva al conductor de confianza (pedir ya): 60 segundos.** Pasado ese tiempo, o si rechaza, el pedido se abre a los demás. Si el cliente marca «solo mi conductor», espera hasta 5 minutos y después se le pregunta si abre a otros.
2. **Rutina: el titular es el conductor de confianza elegido; las ocurrencias se crean 48 horas antes de la hora** (por encima del mínimo actual de 30 minutos y dentro del máximo de 7 días).
3. **Aviso previo al conductor: 12 horas antes, y recordatorio 30 minutos antes. Al cliente: recordatorio 30 minutos antes** (Gojek avisa 10 min antes; la moto necesita más margen).
4. **Reemplazo: si a 20 minutos de la hora el titular no tocó «voy», se abre a los demás de la zona (el titular sigue pudiendo tomarla). Hoy el despacho arranca 15 minutos antes; en rutinas con titular, 20.**
5. **Saltar un día o pausar: sin cargo hasta 60 minutos antes** (igual que `cancelacionGratisMin`). Pausar toda la rutina con fecha de regreso.
6. **PIN de 4 dígitos por viaje** (el que ya existe), obligatorio en menores y no apagable, con bloqueo tras 5 intentos fallidos y aviso al responsable. Mejora opcional ya probada por HopSkipDrive: palabra clave elegida por el responsable.
7. **Avisos al responsable del menor, siempre por notificación y, si hay número, por mensaje: 1) conductor aceptó, 2) conductor en camino, 3) recogido (hora y lugar), 4) dejado (hora y lugar), 5) retraso mayor de 10 minutos, 6) desvío mayor de 300 m o parada mayor de 3 minutos.** Seguimiento en vivo por enlace, sin app (como el de envíos).
8. **Quién puede llevar menores:** solo conductor con `acepta_menores`, verificado y **aprobado por el responsable** (en el piloto, el mismo conductor de confianza que ya conoce). Destino bloqueado: el conductor no lo cambia.
9. **Pagos:** en Venezuela, efectivo por viaje con el conductor marcando «cobrado». Liquidación semanal visible para el cliente y el conductor como resumen, sin paquetes prepagados todavía. Cualquier cobro automático o prepago pasa por Richard (dinero y legal, 👤).
10. **Anti-evasión [INF]:** el número de teléfono se muestra solo tras aceptar; el valor que se ofrece en la app es la rutina (recordatorios, reemplazo, seguimiento, historial) y la comisión en viajes de confianza se decide por Richard (el mercado no publica la cifra, [NV]).

## 7. Pruebas de aceptación

Todas se escriben primero en rojo (Vitest en `apps/servidor` y `packages/compartido`) y se prueban en el sitio de pruebas con zona VE-MER-ELVIGIA; sin dinero real.

1. Pedir ya a un favorito: el favorito recibe la oferta; a los 60 s sin respuesta pasa a los demás; si rechaza, pasa de inmediato.
2. «Solo mi conductor»: no pasa a otros antes de 5 minutos.
3. Crear rutina lunes a viernes 6:30 ida y 12:30 vuelta: genera exactamente las ocurrencias de las próximas 48 horas, sin duplicar al repetir el generador.
4. Aviso al conductor a T-12 h y a ambos a T-30 min; llegan una sola vez.
5. Titular sin «voy» a T-20 min: se abre a otros; si el titular toma el viaje antes de que otro lo acepte, queda con el titular.
6. Saltar un día a más de 60 min: sin cargo y la rutina sigue; a menos de 60 min: sigue la regla de cancelación actual.
7. Pausar la rutina con fecha de regreso: no genera ocurrencias en ese tiempo y reanuda sola.
8. Viaje de menor: no se asigna a un conductor sin `acepta_menores` ni sin aprobación del responsable; no inicia sin PIN correcto; 5 fallos bloquean y avisan; el conductor no cambia el destino.
9. El responsable recibe los seis avisos del punto 7 en orden, con hora y lugar, y el enlace abre el seguimiento sin sesión.
10. Prueba en rojo comprobada: quitar el bloqueo de menores o el tope de espera hace fallar su prueba.
11. Candado de docs: guía pública en Docs en español e inglés con capturas, en el mismo trabajo (no se publica sin ella).

## 8. Lo que no se pudo verificar (queda abierto)

- Tiempo exacto que Uber da al favorito antes de abrir. [NV]
- Si Lyft, Bolt, DiDi, Cabify, Yango, Rapido, Grab o Gojek tienen favorito o repetición propia hoy. [NV] Habría que mirar su app o centro de ayuda de cada país.
- Edad mínima exacta de las cuentas para adolescentes de Uber (13 o 14). [NV]
- Comisión reducida para favoritos y sanciones por evasión específicas a favoritos. [NV]
- Corrida de REA con hash sobre las webs públicas: pendiente de abrir un navegador con puerto de depuración.

## 9. Evidencia REA (corrida el 16 nov 2026, después de la primera versión de la ficha)

REA se corrió de verdad con `capture_browser_scenario` (Chromium 159 de Playwright, sin cuenta, como visitante, árbol de accesibilidad de la página pública). Paquete: `docs/investigaciones-rea/evidencia-rea-2026-11-16-conductor-confianza.json` (SHA-256 del archivo `3dd8187ba259406dd50af2b2c90818674db142c5a74d50f7de880e32c7a068c2`).

- [REA] Uber for Teens (uber.com/us/en/ride/teens, evidencia `ev_69b8016e…`, árbol `6bd2f316…`): «live trip and delivery tracking», «real-time status updates», viajes de adolescentes con destino bloqueado (solo el adolescente lo cambia), y «PIN verification and RideCheck™ … always automatically turned on and cannot be turned off». Edad: «They must be at least 13 years old». El 911 que marca el padre muestra la ubicación del padre.
- [REA] La dirección pública de Uber Reserve (uber.com/us/en/ride/uberreserve, evidencia `ev_9447dde4…`) hoy responde «página no encontrada»; la reserva vive en la app («Schedule a ride» → m.uber.com/go/reserve). Lo de Reserve queda como [DOC] de la ficha.

## 10. Lo que se construyó (decisión aplicada)

- **Conductor de confianza:** hasta 3, se marca desde un viaje terminado con él. Al pedir para ya, el viaje se le ofrece SOLO a él por **60 segundos** si está conectado (señal de los últimos 10 minutos) y a 15 km o menos; si lo rechaza, se le vence o no está, pasa a los demás de una vez. En un viaje programado o fijo nace **30 minutos antes** y se le guarda solo a él hasta **5 minutos antes**; después, a los demás. Si el pasajero o el conductor se bloquearon, nunca se le ofrece.
- **Viajes fijos:** días de la semana, ida y vuelta opcional, a la hora local de la ciudad (con horario de verano). Cada salida nace como viaje programado **24 horas antes** (precio fijo; cancelación gratis hasta 60 minutos antes, como los programados). Pausa con o sin fecha, saltar un día, borrar. Hasta 10 por cliente.
- **Conductor:** agenda de 7 días, aviso al crearle un viaje fijo, aviso previo **30 minutos antes**, «No puedo» (ese viaje va a cualquiera y el cliente lo sabe) y «Dejar este viaje fijo».
- **Menores:** PIN **fijo de 4 dígitos** que el responsable le enseña al menor (adaptación de la palabra clave de HopSkipDrive [DOC]: en El Vigía los niños no tienen teléfono para recibir un PIN por viaje como en Uber [INF]); obligatorio aunque la ciudad no pida PIN; bloqueo a los 5 fallos (el de siempre); solo vehículos con «Acepto llevar menores»; avisos al responsable al aceptar, al llegar, al recogerlo, al dejarlo y si no salió.
- **Pendiente de decisión de negocio (Richard):** pago semanal o mensual y comisión rebajada para viajes de confianza. Hoy se paga cada viaje como siempre.
