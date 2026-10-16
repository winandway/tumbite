# Informe de integración del MVP de Comida

**Fecha:** 16 de octubre de 2026, noche (UTC).

**Rama:** `integracion-mvp`, que sale de `fase-reloj-seguro`. El nombre no empieza por `fase-`, así que **no publica nada sola**.

**Commit de código integrado:** `105c7e50`. Este informe va en un commit aparte, solo de documentos.

**No se hizo nada de esto:**

- tocar el sitio de pruebas (sigue en `7ba6ed1`, el reloj seguro solo);
- tocar producción (sigue en `36f4e35`);
- publicar;
- activar Cloudflare;
- usar Stripe real ni dinero real;
- modificar las ramas originales.

## 1. Qué se integró, en este orden

| #   | Rama                                           | Commit original | Unión en la integración |
| --- | ---------------------------------------------- | --------------- | ----------------------- |
| 0   | `fase-reloj-seguro` (base)                     | `7ba6ed1e`      | —                       |
| 1   | `hito1-catalogo-sesion`                        | `c63088e5`      | `d39ef555`              |
| 2   | `versionado-visible`                           | `c5952afa`      | `cf35b3a1`              |
| 3   | `fallos-criticos` (con su cierre de seguridad) | `eaf6e5dd`      | `84c19d1b`              |
| 4   | `transiciones-pedido` (Entrega 1)              | `feb54fee`      | `7b8419dc`              |
| 5   | `pausa-sin-senal` (Entrega 3)                  | `da7dcf23`      | `43751449`              |
| 6   | `cobro-al-entregar` (Entrega 1b y L1)          | `e58a0005`      | `105c7e50`              |

- **Ramas originales intactas:** se compararon sus commits antes y después, y son idénticos.
- **Las siete están contenidas en la integración**, comprobado con `merge-base`.
- **Todas las uniones se guardaron con los controles previos** (formato, estilo, secretos y pruebas afectadas). No se saltó ninguno.

## 2. Conflictos resueltos

**Criterio:** conservar las protecciones de cada entrega. Ningún conflicto obligó a elegir entre dos protecciones: todos eran agregados en el mismo lugar o versiones del mismo archivo.

| Unión         | Archivo                                                | Conflicto                                                                                                             | Cómo se resolvió                                                                                                                                                              |
| ------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2             | `packages/compartido/src/index.ts`                     | Exportaciones del Hito 1 y del versionado                                                                             | Se conservaron todas                                                                                                                                                          |
| 2, 3, 4, 5, 6 | `CANDADOS.md`                                          | Cada entrega agregó su candado al final                                                                               | Se conservaron todos (los 9 candados nuevos están)                                                                                                                            |
| 3 y 6         | `apps/servidor/src/rutas/diagnostico.ts`               | Las pruebas RELOJ, S12 y L1 se agregaron al final del mismo archivo; la unión automática las mezclaba línea por línea | **A mano:** el archivo de la integración, más cada bloque entero (S12 y después L1) con sus importaciones. Comprobado: están las tres pruebas                                 |
| 4 y 6         | `apps/servidor/src/app.ts` (salud)                     | Las piezas `reloj`, `transiciones` y `cobros` cortadas a mitad de instrucción                                         | **A mano:** cada pieza completa, con su cierre. Antes, una resolución automática de este mismo archivo dejó una pieza cortada; por eso se hizo a mano y se comprobó con tipos |
| 4             | `docs/RESULTADOS-FALLOS-CRITICOS.md`                   | Dos versiones del informe                                                                                             | Se conservó la más nueva (con el cierre de seguridad y la corrida del sitio de pruebas)                                                                                       |
| 5             | `apps/servidor/src/esquema.ts`                         | Columnas nuevas de los fallos (`avisos_stripe.estado`) y de la pausa (`senal_en`, `pausa_aviso_en`)                   | Se conservaron las tres; se regeneró la lista de columnas                                                                                                                     |
| 6             | `apps/servidor/src/rutas/pedidos.ts` (aviso de Stripe) | Los fallos envolvieron el manejador en el bloque con estados; el cobro al entregar cambió una línea adentro           | Se tomó la versión de los fallos (la idempotencia persistente) y se le aplicó la línea `liquidarDesdeAviso`                                                                   |
| 6             | `apps/servidor/src/rutas/operacion.ts`                 | Importaciones de la pausa y de las liquidaciones                                                                      | Se conservaron las dos                                                                                                                                                        |
| 6             | `scripts/staging/probar-staging.mjs`                   | S12 y L1 en la misma línea                                                                                            | Se conservaron las dos                                                                                                                                                        |

**Comprobaciones después de resolver:**

- **Tareas del reloj, en orden:**
  - críticas: `ofertas`, `operaciones`, `manager`, `liquidaciones`, `conciliacion`, `retiros`, `conciliacion_retiros`;
  - no críticas: `sin_repartidor`, `pausa_sin_senal`, `fotos`.
- **Salud:** las piezas `reloj`, `transiciones`, `cobros` y `exclusividad` están.
- **Aviso de Stripe:** conserva los estados `procesando` y `hecho` y el cierre de la liquidación.
- **Cobro:** ya no existe `capturarCobro`, que cobraba antes de registrar. Las dos entregas usan `sentenciaLiquidacion`.
- **Pausa:** la señal se anota al preguntar por pedidos.

### Incompatibilidades encontradas por la integración

**Una sola**, encontrada ya antes en la unión local de prueba de la Entrega 1b: la prueba de la Entrega 1 que lee el código esperaba que la entrega cambiara a «entregado» sin el estado en la condición, y la Entrega 1b se lo agregó. Se corrigió en su rama original antes de integrar (`feb54fee`): un cambio que gana protección está bien, uno nuevo sin protección falla. En esta integración no apareció ninguna otra.

## 3. Pruebas

| Prueba                                                                                                                                                                                  | Resultado                                                                                                                                                                      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`npm run verify` completo:** tipos de todo el proyecto, estilo, pruebas con cobertura, compilación y auditoría                                                                        | ✅ **649 pruebas en 107 archivos, 0 vulnerabilidades**                                                                                                                         |
| Estados de pedidos (Entrega 1: transiciones, rutas y código real)                                                                                                                       | ✅ 17                                                                                                                                                                          |
| Cobros y L1 (Entrega 1b)                                                                                                                                                                | ✅ 19                                                                                                                                                                          |
| Idempotencia de avisos, cancelación y los cinco fallos                                                                                                                                  | ✅ 20                                                                                                                                                                          |
| Retiros y saldo retirable (Fase 0 + «solo lo cobrado»)                                                                                                                                  | ✅ 23                                                                                                                                                                          |
| Exclusividad del repartidor (Fase 3)                                                                                                                                                    | ✅ 26                                                                                                                                                                          |
| Pausa de restaurantes (Entrega 3)                                                                                                                                                       | ✅ 16                                                                                                                                                                          |
| Reloj y tareas críticas                                                                                                                                                                 | ✅ 17                                                                                                                                                                          |
| Catálogo y sesión (Hito 1)                                                                                                                                                              | ✅ 16                                                                                                                                                                          |
| Versionado visible y revisor de paquetes                                                                                                                                                | ✅ 14                                                                                                                                                                          |
| Ciclo completo simulado (operación, incluida la conciliación diaria)                                                                                                                    | ✅ 64                                                                                                                                                                          |
| **Tipos de las tres apps** (cliente, repartidor, restaurante), el panel y el paquete móvil                                                                                              | ✅                                                                                                                                                                             |
| **Paquetes del sitio de pruebas y de producción**, armados en la computadora y no subidos                                                                                               | ✅ Los dos revisados: 273 archivos, sin direcciones cruzadas ni secretos. Las tres apps web compilan y llevan el commit de la integración. El panel sirve la versión `105c7e5` |
| **Recorrido completo de Comida en el navegador, en la computadora**: cliente, restaurante y repartidor de verdad, con Stripe y Twilio simulados, pasando por el cobro nuevo al entregar | ✅ **inglés (1,4 min) y español (1,3 min)**                                                                                                                                    |

## 4. Riesgos pendientes

1. **El sitio de pruebas no ha visto esta integración.** Todo lo de arriba es local o simulado. D1 real, Stripe en modo prueba y los Workers de tiempo real solo se comprueban en staging (§6).
2. **L1 nunca corrió contra Stripe de verdad.** Su lógica está probada contra un Stripe simulado fiel, pero los mensajes y estados reales de Stripe se confirman en staging.
3. **Tres columnas nuevas en tablas que ya existen** (`avisos_stripe.estado`, `restaurantes.senal_en`, `restaurantes.pausa_aviso_en`) y **dos tablas nuevas** (`transiciones_pedido`, `liquidaciones`). Entran solas al arrancar (COLUMNAS y `schema.sql`), y la salud `esquema` frena la publicación si faltara algo. Hay que verlo en staging antes que en producción.
4. **El disparador de transiciones** se crea al arrancar, junto con los de la Fase 3, en la misma consulta. Un arranque lento ya pasó una vez con la Fase 3: hay que vigilar el primer arranque en staging.
5. **La pausa sin señal** cierra a los 5 minutos una tienda cuya app quede en segundo plano en el celular. Valor provisional decidido por Richard.
6. **Los cobros en revisión** dejan saldo anotado y no retirable. La resolución es administrativa (decisión de Richard). La billetera todavía muestra el saldo total, no el retirable.
7. **El reloj de producción sigue siendo el de GitHub**, impuntual. Las tareas nuevas (`liquidaciones`, `pausa_sin_senal`) dependen de él para los reintentos y los avisos hasta encender el de Cloudflare. La pausa misma y el registro de la entrega no dependen del reloj.
8. **Orden de publicación.** Esta integración contiene el reloj seguro. Si se publicara entera, el reloj saldría junto con todo lo demás, contra el orden aprobado (primero el reloj solo).

## 5. Bloqueos restantes

- **La conciliación del 16 de octubre** todavía no apareció en producción (la vigilancia, solo de lectura, sigue hasta las 08:00 UTC del 17). Sin ella no se publica el reloj seguro.
- **Autorizaciones de Richard:**
  1. publicar el reloj seguro;
  2. encender el reloj de Cloudflare en producción;
  3. llevar esta integración al sitio de pruebas;
  4. publicar el resto.

## 6. Pasos exactos para validarla después en el sitio de pruebas

Cada paso, con autorización.

1. **Publicar primero el reloj seguro** en producción, solo, con su procedimiento (`docs/INTEGRACION-RELOJ-RESULTADOS.md`) y `verificar-publicacion.mjs despues-reloj` en verde.
2. **Crear la rama del sitio de pruebas** desde esta integración, con un nombre que empiece por `fase-`, porque así se publica sola en staging. Por ejemplo `fase-integracion-mvp`, a partir de `integracion-mvp`. Subirla.
3. **Esperar la corrida `pruebas-rama`** y comprobar, paso por paso:
   - tipos, estilo, pruebas, compilación, auditoría y gitleaks;
   - los dos paquetes revisados y el semáforo del sitio de pruebas;
   - S2 a S5, S7, **S11, S12 y L1** (Stripe TEST);
   - F1, M4 y M5, F2, **F3**, **RELOJ**;
   - tiempo real en vivo;
   - **recorrido completo en inglés y en español**;
   - conciliación de prueba.
4. **Salud del sitio de pruebas** (`/datos/salud`): `esquema`, `exclusividad`, `reloj`, `transiciones`, `cobros` y `dinero` en `ok`. Se lee la versión servida y la de `/datos/version`: tienen que coincidir.
5. **Comprobaciones a mano en el sitio de pruebas**, solo leyendo la base:
   - existen `transiciones_pedido` (12 filas) y `liquidaciones`;
   - existen las columnas `avisos_stripe.estado`, `restaurantes.senal_en` y `restaurantes.pausa_aviso_en`;
   - existe el disparador `pedidos_transicion_valida`;
   - la liquidación del pedido del recorrido quedó `capturada`.
6. **Prueba de la pausa en D1 real:**
   - un restaurante de prueba con la señal de hace más de 5 minutos no aparece abierto y crear un pedido da 409;
   - al abrir su panel vuelve solo.
7. **Las tres apps en el sitio de pruebas:**
   - el catálogo no desaparece (la prueba `e2e/hito1`, cien aperturas);
   - la versión del menú de la cuenta coincide con el servidor (`e2e/hito1/version.spec.ts`).
8. **Si todo da verde:** informe, devolver el sitio de pruebas a lo que corresponda según el orden de publicación, y pedir la autorización de cada publicación a producción por separado.
