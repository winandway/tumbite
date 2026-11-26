# Vistas previas por rama (C-VISTA-PREVIA-RAMA)

Desde el 26 de noviembre de 2026, cada rama de trabajo `fase-*` se prueba en **su propio sitio de
pruebas**, con **su propia base de datos**, y ya no hace fila en el sitio de pruebas compartido
(staging.tumbite.com). La fila compartida queda solo para `main` (la publicación normal).

## Qué es

| Pieza               | Nombre                                               | Para qué                                                                                               |
| ------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Sitio de la rama    | `https://divoox-preview-<rama>.windoce1.workers.dev` | El mismo paquete de pruebas que iría a staging, servido por un worker de Cloudflare propio de la rama. |
| Base de la rama     | D1 `divoox-preview-<rama>`                           | Base aparte, nueva para cada rama. Nunca la de producción ni la del sitio compartido.                  |
| Almacén de archivos | R2 `divoox-preview-archivos`                         | Uno solo para todas las vistas previas; se vacía solo a los 14 días.                                   |

`<rama>` es el nombre de la rama sin `fase-`, en minúsculas y con guiones
(`fase-licencia-una-cara` → `divoox-preview-licencia-una-cara`). Todo vive en la cuenta de
Cloudflare de Divoox (windoce1, id 4d9e131f2c18bc10ac4700d689d5556c).

## Cómo abre su vista previa cualquier sesión

### En GitHub (el camino normal)

Basta con empujar la rama `fase-…`. El flujo **vista-previa-rama** compila, verifica, arma el paquete
de pruebas, abre (o actualiza) la vista previa de esa rama y corre los guiones de punta a punta contra
ella. Ramas distintas corren **a la vez**; dos empujes de la misma rama: el nuevo reemplaza al viejo.
La dirección de la vista previa sale en el resumen de la corrida («Dónde quedó la vista previa»).

Al **borrar la rama**, el flujo **vista-previa-cerrar** borra su worker y su base.

### Desde esta Mac (para mirar algo a mano)

```bash
cd /Users/windocellc/Divoox && npm run build && bash scripts/empaquetar.sh pruebas
```

```bash
cd /Users/windocellc/Divoox && node scripts/vista-previa/vista-previa.mjs abrir fase-mi-rama
```

El guion imprime `url=…` (la dirección) y `reloj=…` (el secreto de las rutas internas de pruebas de
esa vista previa, para correr un guion: `URL_PRUEBAS=<url> RELOJ_SECRETO=<reloj> node scripts/staging/probar-moto.mjs`).
Sin token de Cloudflare usa sola la sesión aparte `HOME=~/.tumbite-cloudflare`.

Otras órdenes:

```bash
cd /Users/windocellc/Divoox && node scripts/vista-previa/vista-previa.mjs listar
```

```bash
cd /Users/windocellc/Divoox && node scripts/vista-previa/vista-previa.mjs abrir fase-mi-rama --reiniciar
```

```bash
cd /Users/windocellc/Divoox && node scripts/vista-previa/vista-previa.mjs cerrar fase-mi-rama
```

`--reiniciar` borra la base de la rama y la vuelve a crear vacía.

## Cómo se siembra la base

1. Se crea la base `divoox-preview-<rama>` (la primera vez).
2. Se le aplica `schema.sql`, igual que la plataforma en cada publicación (solo crea lo que falta).
3. Se le escribe la marca `config.vista_previa_base = divoox-preview-<rama>` (el candado de abajo).
4. Al primer pedido, el servidor corre sus migraciones y semillas de siempre.
5. Se siembran los ajustes de pruebas que los guiones dan por hechos (promociones encendidas,
   recargas con tarjeta en EE. UU., anuncios, Plus, etc.), solo si faltan:
   `scripts/vista-previa/semilla-config.json` (copiados del sitio compartido el 26 nov 2026).
   El worker lleva además los ajustes del sitio de pruebas: foto de control siempre, flota propia y
   alcohol sin horario, y su propia semilla de administración (la dirección privada del superadmin).
6. Los guiones crean sus propias cuentas de prueba (correos `.invalid`/`.test`, celulares ficticios)
   y la ciudad de pruebas de Venezuela, **El Vigía** (`VE-MER-ELVIGIA`). No hay datos reales.

## Los candados (que una vista previa nunca escriba en producción)

- **En el servidor** (`apps/servidor/src/vistaPrevia.ts`): en un dominio de vista previa, el servidor
  exige que el worker diga su base (`VISTA_PREVIA_BASE`, con el prefijo `divoox-preview-`) y que la
  base conectada tenga esa misma marca. Producción y el sitio compartido no la tienen: si una vista
  previa quedara conectada a una de ellas, responde **503 a todo** sin leer ni escribir nada más.
  Prueba: `apps/servidor/src/vistaPrevia.test.ts` (comprobada en rojo quitando el candado).
- **En el guion** (`scripts/vista-previa/reglas.mjs`): se niega a crear, usar o borrar una base que
  no empiece por `divoox-preview-`, o que sea (por nombre o por id) `site-tumbite-db` (producción) o
  `site-tumbite-pruebas-db` (sitio compartido). Antes de nada comprueba que el worker conocido
  `tumbite-reloj` exista en la cuenta (si no, para). Prueba: `apps/servidor/src/vistaPreviaGuion.test.ts`.
- **Sin llaves de producción**: la vista previa solo recibe su secreto del reloj (nuevo en cada
  publicación) y, si existen, llaves de Stripe de **modo prueba** (el guion rechaza cualquier otra).
- El dominio de vista previa cuenta como **pruebas** (`entornoDeHost`), así que vale todo lo del sitio
  de pruebas: no se indexa, Stripe real se ignora, las cuentas de guion no reciben códigos de verdad.

## Lo que hace falta para encenderlo en GitHub

1. Secreto del repositorio `CLOUDFLARE_TOKEN_VISTAS_PREVIAS`: token de Cloudflare de la cuenta
   windoce1 con **Workers Scripts: Edit**, **D1: Edit** y **Workers R2 Storage: Edit** (solo esa cuenta).
2. Secretos `STRIPE_SECRET_KEY_PRUEBA` y `STRIPE_PUBLISHABLE_KEY_PRUEBA` (las llaves de **modo
   prueba** de Stripe, las mismas del sitio de pruebas). Sin ellas, la corrida queda en rojo y dice
   que Perú y Carro con tarjeta, las pruebas S, el recorrido de Comida y la conciliación no se probaron.
3. Variable del repositorio `VISTA_PREVIA_POR_RAMA = si`. Con ella se enciende «vista-previa-rama» y se
   apaga «pruebas-rama» (las ramas dejan de publicar en staging). Para volver atrás, se borra la variable.

## Medido el 26 de noviembre de 2026 (desde esta Mac)

- Abrir una vista previa **nueva** (base, esquema, marca y worker): 85 a 94 segundos.
- **Volver a publicar** en una rama que ya tiene la suya: 21 a 36 segundos.
- Dos ramas a la vez (`fase-vista-previa-textos` y `fase-vista-previa-textos-b`, la segunda con un
  cambio de textos en el título de la portada): cada una sirvió su propio texto, y staging el suyo.
- Los cinco guiones que no usan tarjeta (Moto, Moto en Venezuela, Agente, Regalo con viaje real y
  Comida en Venezuela) corrieron en las dos ramas **al mismo tiempo**, cada una en su base: 109 y
  135 segundos por rama, todo en verde. Antes, cada rama esperaba su turno en el sitio compartido
  (horas en los días de mucho trabajo).

## Lo que no va en la vista previa

- **Tiempo real** (los Workers `tumbite-tiempo-real` y `tumbite-reloj` con Durable Objects): siguen
  conectados al sitio compartido; su prueba en vivo es el flujo a mano «tiempo-real-staging».
  Los **avisos de Stripe** (webhooks) sí van: en cada publicación el guion crea en Stripe, en modo
  prueba, el aviso de esa vista previa (`…/datos/stripe/aviso`, con los mismos eventos que el aviso
  principal del servidor) y le pasa su secreto al worker. Al cerrar la rama se borra. Hay uno por rama
  abierta (Stripe admite 16 por cuenta; hoy hay 3 de otros sitios).
