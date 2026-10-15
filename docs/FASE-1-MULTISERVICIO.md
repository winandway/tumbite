# Fase 1 — Multiservicio: catálogo, vehículos, habilitaciones y preferencias

Fecha: 15 de octubre de 2026. Rama: `multiservicio-fase-1`, nacida de `fase-0-seguridad-financiera`. **Pruebas solo locales.** El nombre de la rama no dispara ningún workflow: no se publicó en pruebas ni en producción. No se corrió ninguna migración sobre datos reales. No se tocó Durable Objects ni el reloj externo. Base de diseño: `docs/ARQUITECTURA-MULTISERVICIO-V1.md` (§8, §11, §13, §14, §18, §19), V1.1 punto 1 y V1.2.

## 1. Código implementado

### 1.1 Catálogo de servicios

| Pieza                                                                                               | Qué hace                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tablas `servicios`, `servicios_zona`, `servicio_vehiculos`, `servicio_requisitos`, `requisitos_def` | El catálogo: qué servicios existen, en qué ciudad están, con qué vehículos y con qué requisitos                                                                                                                                                     |
| Catálogo inicial                                                                                    | Comida, Moto, Carro, Mercado, Envíos y Farmacia, con nombre y descripción en español e inglés. **Solo Comida queda disponible**; el resto, «próximamente»                                                                                           |
| `servicios_implementados` + `SERVICIOS_IMPLEMENTADOS` (`apps/servidor/src/esquema.ts`)              | Lo escribe **el código** al arrancar, nunca el panel. Hoy solo dice `comida`. Si una versión deja de saber atender un servicio, lo suspende antes de dejar de declararlo                                                                            |
| Disparadores `servicios_exige_implementado(_alta)` y `servicios_zona_exige_implementado(_alta)`     | La base no deja encender un servicio, ni en una ciudad, si el código no lo declaró implementado                                                                                                                                                     |
| Disparador `servicios_zona_piso_pasajeros`                                                          | Un servicio de pasajeros no se enciende sin identidad, antecedentes de pasajeros, historial de manejo y seguro de pasajeros                                                                                                                         |
| Bloqueo de esta fase (`bloquearPasajeros`)                                                          | El panel rechaza encender Moto o Carro, aunque algún día estén implementados, hasta la fase 8 (doble aprobación y aprobación legal)                                                                                                                 |
| Disparadores `zonas_catalogo_alta` y `zonas_catalogo_activa`                                        | Una ciudad nueva nace con todo el catálogo «próximamente». Al prenderla se abre Comida, como funciona hoy, salvo que una persona del equipo ya haya decidido otra cosa en esa ciudad                                                                |
| `GET /datos/servicios?lat=&lng=`                                                                    | El catálogo para la app del cliente, por ciudad, con `accion`: `abrir`, `muy_pronto`, `en_pausa`, `no_disponible_zona` o `actualizar_app`. Lee la versión de la app en la cabecera `x-tumbite-app`; sin cabecera la trata como 0.1.0. Caché de 60 s |
| Pieza `servicios` en `/datos/salud`                                                                 | `error` si falta un disparador, si un servicio de pasajeros quedó encendido o si algo encendido no está implementado                                                                                                                                |

### 1.2 Vehículos

| Pieza                                                            | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tablas `vehiculos`, `vehiculo_documentos`, `vehiculo_revisiones` | Vehículos del conductor, sus documentos (archivo privado en el almacén) y su historial                                                                                                                                                                                                                                                                                                                                        |
| Restricciones en la base                                         | Un motorizado no se aprueba sin placa (CHECK). Una placa no vive en dos cuentas (índice único). Transiciones permitidas (`vehiculos_transicion_valida`). Un motorizado no se aprueba sin registro y seguro aprobados y vigentes (`vehiculos_aprobar_exige_documentos`). Cada cambio de estado queda en el historial (`vehiculos_historial`). Un documento nuevo reemplaza al anterior del mismo tipo sin borrarlo             |
| `repartidores.vehiculo_activo_id`                                | Columna nueva por `esquema.ts` (agregar una columna vacía es seguro en SQLite). Nadie la lee para Comida todavía                                                                                                                                                                                                                                                                                                              |
| Rutas del conductor                                              | `GET` y `POST /datos/conductor/vehiculos`; `PUT /datos/conductor/vehiculos/:id` (solo registrado o rechazado); `POST …/:id/documentos?tipo=` (JPG, PNG, WebP o PDF, máximo 5 MB, revisando los bytes); `POST …/:id/enviar`; `POST …/:id/retirar`; `PUT /datos/conductor/vehiculo-activo` (solo aprobado y suyo; no con una entrega en curso). Máximo 5 vehículos                                                              |
| Rutas del admin                                                  | `GET /datos/admin/vehiculos?estado=`; `PUT /datos/admin/vehiculos/:id/documentos/:doc` (aprobar o rechazar; el seguro, el seguro de pasajeros y la inspección cuentan como requisito cumplido); `PUT /datos/admin/vehiculos/:id` (aprobar, rechazar o suspender, con motivo obligatorio para rechazar o suspender; si deja de estar aprobado, deja de ser el activo); `GET …/documentos/:doc/archivo` (solo admin, sin caché) |

### 1.3 Habilitaciones, requisitos y preferencias

| Pieza                                                                                                                                      | Qué hace                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Tablas `habilitaciones`, `habilitaciones_historial`, `cumplimientos`, `preferencias_servicio`, `conductor_bloqueos`, `auditoria_admin`     | Quién puede trabajar en qué servicio, qué requisitos cumplió, qué quiere recibir, y quién cambió qué en el panel                                                                                                                                                                                                         |
| Disparadores `habilitaciones_exigen_requisitos(_alta)`                                                                                     | Nadie aprueba una habilitación si a la persona le falta un requisito obligatorio de nivel «conductor». El historial se escribe solo                                                                                                                                                                                      |
| `GET /datos/conductor/servicios`                                                                                                           | Por servicio: estado en su ciudad, habilitación, vehículo compatible, requisitos que faltan, preferencia, si puede activarlo y el motivo (`habilitado`, `pendiente_aprobacion`, `sin_habilitacion`, `requisitos_faltantes`, `vehiculo_incompatible`, `proximamente`, `en_pausa`, `no_disponible_zona`, `actualizar_app`) |
| `PUT /datos/conductor/preferencias`                                                                                                        | Guarda lo que quiere recibir. 409 si intenta activar algo que no puede                                                                                                                                                                                                                                                   |
| `GET` y `PUT /datos/admin/habilitaciones/:conductor/:servicio`                                                                             | Aprobar, rechazar, suspender o dejar pendiente. Si faltan requisitos, 409 con la lista                                                                                                                                                                                                                                   |
| `PUT /datos/admin/cumplimientos/:conductor/:requisito`                                                                                     | Requisitos que revisa una persona (licencia, edad, capacitación, casco). Identidad y antecedentes **no**: esos los aprueban sus proveedores                                                                                                                                                                              |
| `PUT /datos/admin/servicios/:id`, `PUT /datos/admin/servicios/:id/zonas/:zona`, `GET /datos/admin/servicios`, `GET /datos/admin/auditoria` | Panel del catálogo. Todo cambio queda en `auditoria_admin` con el antes y el después                                                                                                                                                                                                                                     |

Todos los mensajes nuevos tienen su versión en inglés (31 traducciones). Solo el rol `admin` entra a las rutas de administración.

## 2. Archivos modificados

| Archivo                                                                                            | Cambio                                                                                               |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `schema.sql`                                                                                       | Solo tablas, índices, disparadores y catálogo nuevos (`CREATE … IF NOT EXISTS` e `INSERT OR IGNORE`) |
| `apps/servidor/src/esquema.ts`                                                                     | Columna `repartidores.vehiculo_activo_id`; `SERVICIOS_IMPLEMENTADOS` y su sincronización al arrancar |
| `apps/servidor/src/rutas/servicios.ts`                                                             | **Nuevo**: todas las rutas de la fase y la pieza de salud                                            |
| `apps/servidor/src/app.ts`                                                                         | Monta las rutas y la pieza `servicios` de la salud                                                   |
| `apps/servidor/src/mensajesEn.ts`                                                                  | 31 traducciones                                                                                      |
| `apps/servidor/src/rutas/servicios.test.ts`                                                        | **Nuevo**: 19 pruebas                                                                                |
| `apps/servidor/src/rutas/migracionFase1.test.ts`                                                   | **Nuevo**: corre las migraciones preparadas sobre una base de prueba                                 |
| `docs/fase-1/M4-vehiculos.sql`, `M5-comida-y-vehiculo-activo.sql`, `verificar.sql`, `revertir.sql` | **Nuevos**: migraciones preparadas, verificación de solo lectura y vuelta atrás                      |
| `docs/FASE-1-MULTISERVICIO.md`, `CANDADOS.md`, `PENDIENTES.md`, `docs/COMPARACION-CICLO-PEDIDO.md` | Documentación                                                                                        |

Las apps (cliente, Driver y restaurante) **no cambiaron**: todavía no leen el catálogo.

## 3. Pruebas ejecutadas

| Qué                                                                        | Resultado                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` (tipos, lint, pruebas con cobertura, build y auditoría)   | **Todo en verde** (cifra exacta en §8)                                                                                                                                                                                                        |
| `servicios.test.ts`                                                        | **19 de 19**                                                                                                                                                                                                                                  |
| `migracionFase1.test.ts`                                                   | **1 de 1**                                                                                                                                                                                                                                    |
| Recorrido completo en el navegador con el build real (`npm run recorrido`) | **2 de 2** (inglés y español): Comida igual                                                                                                                                                                                                   |
| Comprobación en rojo                                                       | Sin el disparador de «implementado», la prueba de la base falla. Sin la habilitación de Comida «de legado», falla la prueba de Comida intacta. Sin el disparador de ciudades, falla la de ciudad nueva. Las tres vuelven a verde al restaurar |

Lo que cubren las 19 pruebas:

- **Catálogo**: Comida se abre en Miami y lo demás sale «muy pronto». Fuera de una ciudad activa nada se abre. Una app más vieja que la mínima recibe «actualizar_app».
- **Moto y Carro bloqueados**: el panel rechaza encenderlos en el servicio y en la ciudad. La base también rechaza escribirlo directo, y la lista de implementados es solo Comida. El panel sí puede pausar y reabrir Comida, con su auditoría. Solo el admin entra.
- **Comida intacta**: un repartidor de hoy, sin ninguna fila nueva, ve Comida habilitada, activa y «habilitado». No puede activar Moto, y su preferencia se guarda.
- **Vehículos**:
  - el circuito completo (registro, documentos, envío, aprobación de documentos y del vehículo) con su historial, y el seguro aprobado como requisito cumplido;
  - no se aprueba sin documentos;
  - una placa no puede estar en dos cuentas;
  - el vehículo activo tiene que estar aprobado y ser suyo, y suspenderlo lo quita como activo;
  - los documentos solo los abre el admin, sin caché.
- **Habilitaciones**:
  - Moto no se habilita sin requisitos, y el panel muestra los que faltan;
  - identidad y antecedentes no se aprueban desde el panel;
  - con los requisitos cumplidos se habilita y queda en el historial, pero sigue sin poder activarse porque el servicio está apagado;
  - nadie aprueba pasajeros escribiendo directo en la base.
- **Salud**: dice `ok`, y `error` si alguien enciende Moto a la fuerza.
- **Ciudades**: una ciudad nueva abre Comida al prenderse, y una ciudad donde el equipo pausó Comida no la reabre sola.

## 4. Compatibilidad con Comida

- **El código de Comida no cambió**: pedidos, despacho, ofertas, QR, chat, seguimiento, pagos, billetera y calificaciones son los mismos archivos.
- **Ninguna ruta existente lee las tablas nuevas.** El despacho sigue eligiendo repartidores como hoy. La migración M6, que haría que el despacho mire la elegibilidad, es código aparte, con bandera y fuera de esta fase.
- **Un repartidor de hoy, sin migración, sigue igual**: el catálogo lo trata como habilitado en Comida («legado») y con Comida activa.
- **Las apps instaladas no cambian**: no llaman a las rutas nuevas, y las rutas nuevas solo agregan.
- **La base solo crece**: tablas nuevas y una columna vacía en `repartidores`. Ningún dato existente se modifica al publicar.
- **Probado**: las 416 pruebas que ya existían siguen en verde, más 20 nuevas, y el recorrido completo en el navegador.

## 5. Migraciones preparadas (NO ejecutadas sobre datos reales)

| Paso  | Archivo                                       | Qué hace                                                                                                                                                            | Cómo se comprueba                                                | Vuelta atrás                |
| ----- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------- |
| M1–M3 | `schema.sql` y `esquema.ts`                   | Tablas vacías, catálogo y columna nueva. Corren solos al publicar                                                                                                   | Salud `servicios: ok`; `GET /datos/servicios` muestra Comida     | No hace falta: nada las lee |
| M4    | `docs/fase-1/M4-vehiculos.sql`                | Copia el vehículo declarado de cada repartidor. Queda aprobado si es bici o a pie, o motorizado con placa; si no, registrado. **Las placas repetidas no se copian** | `verificar.sql` (1 y 2)                                          | `revertir.sql`              |
| M5    | `docs/fase-1/M5-comida-y-vehiculo-activo.sql` | Habilita Comida a todos los repartidores actuales, deja Comida activa, pone su vehículo copiado como activo y su identidad aprobada (KYC) como requisito cumplido   | `verificar.sql` (3 y 4): nadie sin Comida, Moto y Carro apagados | `revertir.sql`              |

Las dos son **idempotentes**: la prueba las corre dos veces y no duplica nada. Orden el día que se aprueben: respaldo → sitio de pruebas → `verificar.sql` antes y después → producción con la misma secuencia. **No cambian quién recibe pedidos**, porque Comida no lee estas tablas hasta M6.

## 6. Problemas encontrados

1. **La fila del repartidor nace tarde.** La tabla `repartidores` recibe la fila la primera vez que la persona usa la app, no al registrarse. Sin cuidado, un repartidor nuevo vería «no disponible en tu zona». Ya resuelto: se usa la zona de su cuenta o la de fábrica, y la fila se crea al elegir vehículo.
2. **Ciudades nuevas sin catálogo.** Una ciudad creada desde el superadmin entre dos publicaciones no tenía filas de catálogo. Ya resuelto con dos disparadores, probados en rojo.
3. **La latencia de la base** (medida en la Fase 0: de 12 a 270 ms de ida y vuelta por consulta). `GET /datos/conductor/servicios` hace 2 consultas seguidas y 5 en paralelo. Con la latencia peor puede tardar cerca de un segundo. No bloquea esta fase, pero conviene un único `SELECT` cuando la app lo use.
4. **La preferencia de Comida se guarda pero no se aplica todavía.** Apagar Comida en preferencias no frena las ofertas hasta M6. Ninguna app lo muestra aún, así que nadie puede llevarse una sorpresa.
5. **Permisos finos y doble aprobación** (`admin_permisos`, `cambios_pendientes`, V1 §18) no están en esta fase. Hoy todo lo hace el rol `admin`, con auditoría. Son obligatorios antes de encender pasajeros (fase 8).
6. **Dos brechas frente a los estudios de Richard** (anotadas en `docs/COMPARACION-CICLO-PEDIDO.md`): la edad mínima por estado y por vehículo, y la licencia más el seguro según el vehículo en Comida. Las dos van con M6, con interruptor, para no cambiar hoy quién reparte.
7. **Tarifas** (`tarifas`, V1 §8) no entran en esta fase: son de los viajes (fase 7).
8. **Guías públicas en Docs**: no hay nada nuevo que vea el público. Las guías del catálogo, los vehículos y las preferencias se escriben cuando las apps lo muestren.

## 7. Pendientes en staging

1. **Publicar esta rama en el sitio de pruebas** (renombrarla a `fase-1-…` o lanzar el workflow a mano), cuando Richard lo apruebe. Comprobar la salud `servicios: ok` en la base real, y que los 13 disparadores nuevos se crean con el ejecutor de YaDominios (como S1 en la Fase 0).
2. **Prueba S de disparadores del catálogo en D1 real**: encender Moto directo en la base de pruebas tiene que fallar con `servicio_no_implementado`. Se agrega al diagnóstico interno como S2 de la Fase 0.
3. **M4 y M5 sobre la copia de pruebas**, con `verificar.sql` antes y después, y luego `revertir.sql` para comprobar la vuelta atrás.
4. **Recorrido completo de Comida en el sitio de pruebas** después de M5: necesita las llaves de modo prueba de Stripe en ese sitio (pendiente de la Fase 0).
5. **Medir la ruta del conductor** con la latencia real y decidir si se junta en una sola consulta.

## 8. Cifras finales

- `npm run verify` en la rama: **80 archivos y 436 pruebas en verde** (416 de antes y 20 nuevas). Tipos y lint limpios, build correcto y **0 vulnerabilidades**.
- Cobertura global: 79,6 % de sentencias y 81,9 % de líneas.
- Recorrido completo en el navegador: 2 de 2.
