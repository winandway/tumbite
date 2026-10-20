# Diseño técnico: precio en dólares cobrado en bolívares con la tasa del BCV guardada por pedido

**Fecha:** 19 oct 2026. **Estado:** diseño, **no construido y no aprobado**. No fija ninguna política comercial: los valores marcados «parámetro» los decide Richard (y el contador o abogado venezolano donde se dice). Enlazado desde `docs/DECISIONES-PREPARADAS-2026-10-19.md` (sección 3, Venezuela).

**Etiquetas:** [DOC] fuente oficial leída hoy · [OBS] prensa o tercero · [INF] inferencia nuestra · [NV] no verificado.

---

## 1. Las dos cosas que no hay que confundir

|                                | (1) Tarifas fijas expresadas en bolívares                                                                                                                                                            | (2) Precio fijado en USD, cobrado en VES con tasa guardada por pedido                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Estado                         | **Ya soportado** (C-TARIFAS-PAIS, C-TOPES-PAIS, C-RECORRIDO-INTERNACIONAL)                                                                                                                           | **No construido**                                                                                                                                                             |
| Cómo funciona                  | La zona tiene `moneda = 'VES'`; el menú, las tarifas y los topes del país se escriben en céntimos de bolívar (`DECIMALES_MONEDA` da 2 decimales a VES); cada pedido guarda `moneda` y `tarifas_json` | El menú y las tarifas se escriben en centavos de dólar; al crear el pedido se convierten a céntimos de bolívar con una tasa oficial concreta, que queda guardada en el pedido |
| Qué pasa cuando cambia la tasa | Nada: las cifras quedan viejas hasta que alguien las reescriba a mano en el panel                                                                                                                    | El pedido nuevo usa la tasa nueva; los pedidos ya creados no cambian                                                                                                          |
| Riesgo                         | Precios desactualizados en días; la ficha de pagos de Venezuela cita que la Ley de Precios Justos y la SUNDDE exigen la tasa del BCV para precios en divisas [OBS]                                   | Depende de tener una tasa oficial vigente cada día (ver sección 3)                                                                                                            |
| Probado                        | Recorrido local en VES (inglés), montos amplios; sin dinero real                                                                                                                                     | Nada                                                                                                                                                                          |

Lo que sigue es solo el diseño de (2).

---

## 2. Qué publica el BCV y cómo (comprobado hoy)

- **Dónde:** la portada del BCV muestra el «tipo de cambio de referencia» del USD y otras monedas con su **Fecha Valor**. Leída el 19 oct 2026 a las 20:31 (hora de Caracas aprox.): «USD 881,87690000 · Fecha Valor: Martes, 20 Octubre 2026» [DOC]. Es decir: **ocho decimales, coma decimal**, y la tasa publicada un día hábil vale para el **día hábil siguiente**.
- **Qué es:** «promedio ponderado resultante de las operaciones diarias de las mesas de cambio» (Resolución 19-05-01, citada en la ficha `investigaciones-rea/2026-10-18-pagos-venezuela.md`) [DOC].
- **Histórico:** la página «Tipo de cambio de referencia del SMC» ofrece una planilla `.xls` por trimestre (por ejemplo, la del cuarto trimestre de 2026). Cada hoja dice «Fecha Operación» y «Fecha Valor» (ej.: operación 16/10/2026 → valor 19/10/2026; operación 19/10/2026 → valor 20/10/2026), y una nota al pie: el tipo de cambio «aplicará para todas aquellas operaciones de liquidación de monedas extranjeras del sector público y privado, para la fecha valor establecida» [DOC]. La planilla del 4.º trimestre se guardó por última vez el 19 oct 2026 a las 21:41 (metadatos del archivo).
- **Días sin publicación:** en la planilla no hay operación los sábados, domingos ni el 12 de octubre (festivo): después de la operación del viernes 09/10 viene la del martes 13/10 [DOC]. **No hay tasa con fecha valor para cada día del calendario.**
- **API oficial:** **no encontramos ninguna** en el sitio del BCV (ni documentación ni punto de consulta) [NV: búsqueda en el sitio y en la web, 19 oct]. La ficha de pagos cita terceros que ofrecen la tasa por API (un banco y un agregador) [OBS], sin documentación pública verificada.
- **Certificado:** al leer `bcv.org.ve` por HTTPS, la verificación del certificado falló («unable to verify the first certificate»); solo se pudo leer desactivando la verificación en la terminal local. **En un Worker no se puede desactivar la verificación**, así que es probable que la lectura automática desde el servidor falle [INF, no probado desde un Worker]. Nunca se desactiva la verificación en producción.

---

## 3. De dónde sale la tasa (diseño sin política)

Orden de confiabilidad propuesto; Richard elige cuáles se encienden:

1. **Carga manual con doble confirmación (base, siempre disponible).** Una persona autorizada copia la tasa y la fecha valor desde la portada o la planilla del BCV en el superadmin y adjunta la captura o el archivo; **una segunda persona la confirma**. Hasta confirmarla, no vale. Sin fuentes no oficiales: nunca tasa paralela.
2. **Lectura automática de la planilla o la portada del BCV** como **comprobación cruzada**, no como fuente única: si coincide con la manual, se marca «verificada»; si difiere, alerta y no se usa ninguna hasta que una persona decida. Depende de que la lectura funcione desde el reloj (Worker `tumbite-reloj`, hoy solo en staging) con el certificado válido; si no funciona, queda solo la manual.
3. **API de un banco o agregador** [NV]: solo si se contrata y su contrato dice que replica la tasa oficial del BCV; entra en la solicitud de autorizaciones como recurso nuevo.

**Frecuencia:** una vez por día hábil, después de la publicación del BCV (en la planilla del 19 oct la publicación se vio de tarde; la hora exacta de publicación no está documentada [NV]). El reloj revisa varias veces por la tarde y la noche; la carga manual cubre lo que falte.

---

## 4. Reglas técnicas

| Tema                    | Diseño                                                                                                                                                                                                                                                                                                   | ¿Parámetro de quién?                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Tasa aplicable          | La **confirmada** con la **fecha valor más reciente que sea menor o igual a la fecha de hoy en Caracas** (`zonas.zona_horaria`, America/Caracas). Una tasa publicada hoy con fecha valor de mañana **no** se usa hoy. Fines de semana y festivos usan la del último día hábil                            | Que esta sea la regla legal correcta lo valida el contador venezolano [INF] |
| Antigüedad máxima       | Si la última fecha valor confirmada tiene más de **N días hábiles** de atraso, no hay tasa vigente                                                                                                                                                                                                       | N lo fija Richard                                                           |
| Formato                 | Se guarda como entero escalado: `tasa_e8` = Bs por USD × 100.000.000 (881,87690000 → 88187690000). **Nunca coma flotante**                                                                                                                                                                               | —                                                                           |
| Conversión              | `céntimos_VES = centavos_USD × tasa_e8 / 100.000.000`, con aritmética entera grande (BigInt): 1.000 USD × 8,8·10¹⁰ ya roza el límite de los enteros seguros de JavaScript                                                                                                                                | —                                                                           |
| Redondeo                | A **un céntimo de bolívar** (unidad menor, 2 decimales). Dirección: **parámetro**; el valor de partida del diseño es «mitad hacia arriba»                                                                                                                                                                | Dirección: contador venezolano y Richard                                    |
| Qué se convierte        | Se calcula el desglose completo en USD con el cálculo de siempre y se convierte **cada componente** con la misma tasa; el total en VES es la **suma de los componentes convertidos**, para que el recibo cuadre. Se guarda también la diferencia contra convertir el total directamente (para auditoría) | —                                                                           |
| Caducidad en el carrito | La cotización que ve el cliente lleva el `tasa_id`. Al crear el pedido, el servidor vuelve a calcular; si la tasa aplicable cambió, responde 409 con el total nuevo (igual que hoy cuando el total del carrito no coincide)                                                                              | Cuánto puede vivir una cotización: Richard                                  |
| Caducidad en el pedido  | Creado el pedido, **su tasa no cambia nunca**: plato quitado, cambio de dirección, reembolsos y conciliación usan la tasa guardada (igual que `tarifas_json`)                                                                                                                                            | —                                                                           |
| Variación anómala       | Si la tasa nueva se aparta de la anterior más de **X %**, queda retenida hasta una segunda confirmación                                                                                                                                                                                                  | X lo fija Richard                                                           |
| Correcciones            | Una tasa cargada no se edita ni se borra: una corrección es una fila nueva que la reemplaza, con motivo y autor; los pedidos ya creados conservan la que usaron                                                                                                                                          | —                                                                           |
| Sin tasa vigente        | **No se crean pedidos en VES con precio en USD**: 409 «Todavía no tenemos la tasa oficial de hoy», cero pedidos creados; el canario marca la pieza `tasa` en error y avisa al superadmin                                                                                                                 | —                                                                           |

---

## 5. Qué guarda cada pedido (columnas nuevas, van en `esquemaColumnas.ts`)

- `moneda` = `VES` (lo que se cobra; ya existe).
- `moneda_precio` = `USD` (en qué se fijó el precio).
- `tasa_id`, `tasa_e8`, `tasa_fecha_valor`, `tasa_fuente` (`manual`, `bcv_planilla`, `bcv_portada`, `api_<proveedor>`), `tasa_aplicada_en` (hora del servidor).
- `total_usd_referencia` y el desglose en USD dentro de `tarifas_json` (o `desglose_usd_json`).
- `redondeo_dif` (céntimos de diferencia entre la suma de componentes y el total convertido directo).

Tabla nueva `tasas_cambio`: `id`, `moneda_base` (USD), `moneda_cotizada` (VES), `tasa_e8`, `fecha_valor`, `fecha_operacion`, `fuente`, `evidencia` (clave del archivo o captura en el almacén), `cargada_por`, `confirmada_por`, `confirmada_en`, `reemplaza_a`, `motivo`, `creado_en`. Única por (`moneda_base`, `moneda_cotizada`, `fecha_valor`) entre las vigentes.

La zona necesita `moneda_precio` (USD) además de `moneda` (VES). El menú del restaurante y las tarifas del país se escriben en USD; las pantallas muestran el bolívar como monto a pagar y el dólar como referencia (cambio en cliente, restaurante, repartidor, recibo, correos y bandeja; la prueba estática de C-MONEDA-RECORRIDO se amplía).

Fuera de este diseño: IGTF, IVA, si se acepta efectivo en dólares y la viabilidad legal del modelo en Venezuela (decisiones 8, 12 y 15).

---

## 6. Pruebas de aceptación

La primera se escribe y se comprueba **en rojo** antes del código.

1. **Rojo:** pedido en una zona VE con precio en USD y **sin tasa confirmada vigente** → 409 y cero filas en `pedidos`. Con la guarda quitada, la prueba debe fallar (hoy, sin la guarda, el pedido se crearía).
2. **Conversión exacta:** 12,50 USD (1250 centavos) con tasa 881,87690000 → 1.102.346,125 céntimos → **1.102.346** con «mitad hacia arriba» (Bs 11.023,46). Con la otra dirección de redondeo, el valor que corresponda.
3. **Sin coma flotante:** 1.000.000 USD × tasa de ocho decimales da el mismo resultado que el cálculo con BigInt; una prueba estática falla si la tasa se lee con `parseFloat` o `Number` sobre el texto.
4. **El desglose cuadra:** la suma de los componentes convertidos es igual al total en VES; `redondeo_dif` queda guardado.
5. **Fecha valor:** el lunes por la noche, con la tasa de fecha valor martes ya cargada, un pedido usa la de fecha valor lunes; el martes a las 00:00 de Caracas usa la del martes (y no a las 00:00 UTC).
6. **Fin de semana y festivo:** el sábado usa la última fecha valor anterior; con más de N días hábiles sin tasa, 409.
7. **Doble confirmación:** una tasa cargada por una sola persona no vale; la confirma otra y empieza a valer.
8. **Variación anómala:** una tasa que se aparta más de X % queda retenida y no se usa.
9. **Cotización vieja:** el carrito envía un `tasa_id` que ya no es el aplicable → 409 con el total nuevo; nada se crea.
10. **Pedido inmutable:** cambiar o corregir la tasa después no cambia el total, el reembolso ni la conciliación de un pedido ya creado.
11. **Corrección:** una tasa corregida deja la vieja en el historial y los pedidos viejos apuntan a la vieja.
12. **Canario:** sin tasa vigente en un país VE encendido, la pieza `tasa` está en error; con tasa vigente, ok.
13. **Nada cambia fuera:** EE. UU. y Colombia (y VES con tarifas fijas en bolívares, el modo 1) dan exactamente los mismos totales que hoy.
14. **Recorrido en pantalla:** cliente ve monto en Bs y referencia en USD con la tasa y su fecha; repartidor y restaurante ven el mismo monto en Bs; el recibo muestra tasa, fecha valor y fuente.

---

## 7. Fuentes

- Banco Central de Venezuela, portada con el tipo de cambio de referencia (leída el 19 oct 2026): https://www.bcv.org.ve/
- Banco Central de Venezuela, «Tipo de cambio de referencia del SMC» (planillas trimestrales): https://www.bcv.org.ve/estadisticas/tipo-cambio-de-referencia-smc
- Banco Central de Venezuela, planilla del 4.º trimestre de 2026 (leída el 19 oct 2026): https://www.bcv.org.ve/sites/default/files/EstadisticasGeneral/2_1_2d26_smc.xls
- Ficha interna con la Resolución 19-05-01, la Ley de Precios Justos y la SUNDDE: `docs/investigaciones-rea/2026-10-18-pagos-venezuela.md`, sección 2.7.
