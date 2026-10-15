# Corrección del sistema de publicación (Etapa A)

Fecha: 15 de octubre de 2026. Rama: `correccion-publicacion` (nacida de `validacion-staging`), publicada **solo** en el sitio de pruebas por `fase-correccion-publicacion`. **No se publicó nada en producción.**

## 1. Defecto encontrado

1. **El flujo principal (`publicar.yml`) construía las apps web UNA vez, con la dirección de producción, y copiaba ese mismo paquete al sitio de pruebas y a producción.** Las apps del sitio de pruebas (cliente, repartidor y restaurante) le hablaban a producción. Producción las rechazaba (por eso no escribieron nada: 0 cuentas de prueba en producción, comprobado con una consulta de solo lectura), pero era un camino abierto para que un entorno tocara al otro.
2. El flujo de ramas de trabajo (`pruebas-rama.yml`) tenía el mismo defecto hasta la validación del 15 oct (corregido ahí con un primer arreglo).
3. **La herramienta de construcción de las apps reutilizaba lo ya compilado**: aunque cambiara la dirección, podía dejar la vieja dentro (se vio en esta computadora).
4. **Si faltaba la variable, las apps caían en producción** (`EXPO_PUBLIC_API_URL ?? 'https://tumbite.com'`).
5. **Nada impedía que el sitio de pruebas recibiera llaves REALES de Stripe** ni avisaba si producción tenía llaves de prueba.
6. Los perfiles de construcción del celular (`eas.json`) no tenían un perfil para pruebas.

## 2. Causa

Un solo paquete para dos entornos, sin revisión antes de publicar, y una dirección fijada al construir como única fuente de verdad. Ningún candado comparaba «a qué entorno va este paquete» con «a qué servidor habla».

## 3. Corrección implementada (candado C-ENTORNOS-SEPARADOS)

| Capa                                                                                       | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Apps web** (`packages/movil/src/sesion.tsx` + `packages/compartido/src/entornos.ts`)     | En la web, la app habla **siempre con el sitio que la sirvió** si es un sitio de Tumbite (producción, pruebas o local). Una app de pruebas no puede hablarle a producción aunque se hubiera construido mal. En el celular manda la dirección fijada al construir                                                                                                                                                            |
| **Un paquete por entorno** (`scripts/empaquetar.sh`)                                       | Cada entorno se arma **desde cero** (`expo export --clear`, carpetas borradas antes) con **su** dirección: `out-pruebas` con `https://staging.tumbite.com`, `out-produccion` con `https://tumbite.com`. Nunca se copia uno al otro                                                                                                                                                                                          |
| **Revisor de paquetes** (`scripts/verificar-paquete.mjs`), corre dentro de `empaquetar.sh` | Frena la publicación si: una app no trae la dirección de su entorno; hay una dirección del sitio de pruebas en un paquete de producción; una app de pruebas fue construida con producción; el paquete dice ser de otro entorno; hay **cualquier secreto** dentro (llaves de Stripe secretas o publicables, secretos de avisos, llaves de YaDominios); falta una pieza (`_worker.js`, `schema.sql`, las tres apps, el panel) |
| **`publicar.yml`** (flujo de `main`)                                                       | Paquete de pruebas revisado → se publica en pruebas → semáforo de pruebas → paquete de producción armado **aparte** y revisado → se publica en producción → **semáforo de producción nuevo** (solo lectura: producción tiene que servir la versión y responder 200, incluida la salud con su pieza «entorno»)                                                                                                               |
| **`pruebas-rama.yml`** (ramas `fase-*`)                                                    | Arma y revisa **los dos** paquetes; publica **solo** el de pruebas. Así cada rama demuestra que también saldría limpia para producción, sin tocarla                                                                                                                                                                                                                                                                         |
| **Servidor** (`apps/servidor/src/entorno.ts`)                                              | Cada sitio se reconoce por su dominio. En pruebas, una llave **real** de Stripe se **ignora** (no puede cobrar dinero real). La salud suma la pieza **«entorno»**: `error` si pruebas tiene llaves reales, si producción tiene llaves de prueba o si `SITIO_URL` apunta al otro entorno. El semáforo la ve y frena                                                                                                          |
| **Código que viaja a producción**                                                          | Se quitó la dirección del sitio de pruebas del código compartido y del servidor (el revisor la busca en el paquete de producción)                                                                                                                                                                                                                                                                                           |
| **Celular** (`apps/*/eas.json`)                                                            | Perfil nuevo `pruebas` con `https://staging.tumbite.com`; los demás perfiles, producción. Una prueba lo exige                                                                                                                                                                                                                                                                                                               |

**Producción comprobada (solo lectura):** `SITIO_URL = https://tumbite.com`, llave publicable real (`pk_live_…`). La pieza «entorno» le dará `ok`.

**Candados que se mantienen:** seguridad financiera (C-RETIROS-SEGUROS, C-ANULACION-VERIFICADA, C-RELOJ-UNA-VEZ), esquema (C-ESQUEMA-COMPLETO), migraciones (`migraciones/fase1.test.ts`), pruebas automáticas y salud del servidor. Dos candados viejos que revisaban `publicar.yml` ahora revisan `scripts/empaquetar.sh`, que es donde quedó la construcción.

## 4. Archivos modificados

| Archivo                                                                | Cambio                                                                                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `packages/compartido/src/entornos.ts` (+ prueba)                       | **Nuevo**: entornos por dominio y elección del servidor                                                  |
| `packages/movil/src/sesion.tsx`                                        | Las apps usan esa elección                                                                               |
| `apps/servidor/src/entorno.ts` (+ prueba), `app.ts`                    | Llaves reales ignoradas en pruebas; pieza «entorno» en la salud                                          |
| `apps/servidor/src/rutas/diagnostico.ts`                               | Sin dirección de pruebas escrita en el código                                                            |
| `scripts/empaquetar.sh`, `scripts/verificar-paquete.mjs`               | **Nuevos**                                                                                               |
| `apps/servidor/src/publicacion.test.ts`                                | **Nuevo**: el revisor deja pasar lo correcto y frena lo cruzado y los secretos; perfiles del celular     |
| `.github/workflows/publicar.yml`, `pruebas-rama.yml`                   | Un paquete por entorno, revisado; semáforo de producción                                                 |
| `apps/cliente                                                          | repartidor                                                                                               | restaurante/eas.json` | Perfil `pruebas` |
| `apps/servidor/src/repartidorWeb.test.ts`, `restauranteDiseno.test.ts` | Revisan `empaquetar.sh`                                                                                  |
| `eslint.config.mjs`, `.gitignore`, `.prettierignore`                   | Carpetas de paquetes ignoradas; el revisor puede leer rutas variables (solo esa regla, solo ese archivo) |

## 5. Pruebas ejecutadas

| Qué                                                            | Resultado                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify` completo                                      | **506 pruebas en verde**, 0 vulnerabilidades                                                                                                                                                                                                                          |
| Paquete de pruebas y de producción armados en esta computadora | ✅ los dos revisados limpios (269 archivos cada uno)                                                                                                                                                                                                                  |
| **Comprobación en rojo**                                       | Paquete de producción revisado como pruebas → frenado (7 problemas). Paquete de pruebas revisado como producción → frenado (4). Un secreto falso dentro del paquete → frenado. Llave real de Stripe en pruebas → la salud da `entorno: error` y el servidor la ignora |
| Recorrido completo de Comida local (build real)                | ✅ 2 de 2                                                                                                                                                                                                                                                             |

## 6. Resultado en el sitio de pruebas

✅ **Todo en verde.** Ver §7.

## 7. Corrida en el sitio de pruebas

Corrida **38822612288** (workflow `pruebas-rama`, rama `fase-correccion-publicacion`, versión `82baaa2`):

| Paso                                                                                     | Resultado                                                       |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Paquete de PRUEBAS armado y revisado                                                     | ✅ 269 archivos, sin direcciones cruzadas ni secretos           |
| Paquete de PRODUCCIÓN armado y revisado (no publicado)                                   | ✅ 269 archivos, sin direcciones cruzadas ni secretos           |
| Semáforo del sitio de pruebas                                                            | ✅                                                              |
| Salud del sitio de pruebas                                                               | ✅ `entorno: ok` (llaves de prueba de Stripe, dirección propia) |
| Pruebas S de la Fase 0 (incluido el retiro con Stripe de prueba), F1, migraciones y F2   | ✅ todas                                                        |
| Tiempo real en vivo                                                                      | ✅                                                              |
| Recorrido completo de Comida en el sitio de pruebas (inglés y español, Stripe de prueba) | ✅ 2 de 2                                                       |
| Conciliación de saldos contra Stripe                                                     | ✅                                                              |

**Problemas encontrados durante la validación y corregidos:** (1) el recorrido adelantaba el reloj del pedido antes de que llegara la aceptación del restaurante (solo en pruebas, por la demora de red): ahora espera; (2) la prueba F2 corría el reloj real con sus repartidores temporales ya creados, el reloj les ofrecía un pedido y la limpieza fallaba: ahora el reloj se prueba antes y se limpian sus ofertas.

**Producción no se modificó** (sigue en `e5a2ff0`).
