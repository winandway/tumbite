# Cómo se restaura un respaldo de la base (29 oct 2026) — todos los países

Este documento explica, paso a paso, cómo se recupera la base de Divoox desde una copia de
seguridad. Está escrito para que otra persona del equipo, u otra IA sin memoria, lo pueda hacer.

## 1. Qué se respalda y dónde queda

- **Cuándo:** una vez al día. El reloj de GitHub (`.github/workflows/reloj.yml`) llama a
  `POST /datos/respaldo?siHaceFalta=1` en producción y en pruebas. El servidor solo copia si ese
  día todavía no hay copia.
- **Qué:** todas las tablas, cada una en un archivo JSON. Las sesiones no se copian, a propósito:
  al restaurar, todo el mundo tiene que volver a entrar.
- **Dónde:** en el almacén de archivos del mismo sitio, en `respaldos/AAAA-MM-DD/<tabla>.json`.
  Se guardan los últimos 30 días.
- **Cómo se vigila:** la pieza `respaldo` de `/datos/salud` dice `ok` si hay copia de hoy o de
  ayer, y `atrasado` si no. Mira el almacén de verdad, no una variable (candado C-RESPALDO-REAL).

## 2. La prueba automática (en cada corrida, sin tocar nada real)

`apps/servidor/src/restauracionAislada.test.ts` hace esto en cada `npm run verify` y en la nube:

1. Toma la base del recorrido completo de la app, con pedidos, libro de dinero y cobro en mano.
2. La respalda con la misma función de producción (`respaldarBase`).
3. La restaura con `restaurarDesdeRespaldo` en una base nueva y vacía.
4. Comprueba que las filas son las mismas, tabla por tabla (menos `sesiones`), que no hay llaves
   rotas (`PRAGMA foreign_key_check` vacío), que los saldos del libro coinciden por cuenta, bolsillo
   y moneda, que la salud está en verde, que la lista de restaurantes responde y que una cuenta real
   entra y ve sus pedidos.

Si esa prueba se pone en rojo, nada se publica (compuerta del pre-push y de la nube).

`apps/servidor/src/respaldoRestaurar.test.ts` prueba además el camino corto: respaldar, dañar y
restaurar.

## 3. Restaurar en el sitio de pruebas

Solo existe en el sitio de pruebas. Tiene doble cerrojo: el host tiene que ser el de pruebas, y
la llamada tiene que traer el secreto del reloj.

**Antes:** esto borra todo lo creado en pruebas después de esa copia y cierra todas las sesiones
de pruebas. Necesita el visto bueno de Richard (fila 4.1 de
`docs/SOLICITUD-AUTORIZACIONES-2026-10-20.md`).

1. Mirar qué días hay: el canario `https://staging.tumbite.com/datos/salud` dice el último.
2. Lanzar la restauración desde GitHub o la terminal, con el secreto `RELOJ_SECRETO`, que está en
   los secretos del repositorio:
   `POST https://staging.tumbite.com/datos/respaldo/restaurar?dia=AAAA-MM-DD` con la cabecera
   `x-reloj-secreto`.
3. La respuesta dice cuántas tablas y filas volvieron: `{ ok: true, tablas, filas }`.
4. Comprobar: `/datos/salud` en verde, `/datos/version` responde, entrar con una cuenta demo
   (`docs/CUENTAS-DE-PRUEBA.md`) y ver sus pedidos. Correr `npm run recorrido` contra pruebas.

## 4. Producción: a mano, con el equipo delante

En producción **no hay botón ni ruta de restaurar, por diseño**: una restauración equivocada
borraría pedidos y dinero reales. Si alguna vez hiciera falta:

1. Parar las publicaciones: avisar al equipo y no hacer `git push` a `main`.
2. Hacer una copia nueva de cómo está la base ahora, aunque esté dañada. Se lanza desde GitHub
   Actions → «reloj» → «Run workflow» con «respaldo» marcado. Así se puede volver atrás.
3. Bajar del almacén los JSON del día elegido, con la API de YaDominios Cloud y el token del sitio.
4. Ensayar primero en el sitio de pruebas, con el paso 3 de arriba y esos mismos archivos.
5. Con el ensayo en verde, cargar las tablas en producción por la API de consultas de YaDominios
   (`POST https://yapanel.yadominios.com/api/hosting/db/query`), tabla por tabla, en el mismo orden
   que usa `restaurarDesdeRespaldo`: llaves foráneas diferidas, disparadores quitados y recreados.
6. Comprobar: `/datos/salud`, la conciliación del día, `scripts/produccion/verificar-publicacion.mjs`
   y una compra de prueba en pruebas, nunca en producción.
7. Anotar en `CANDADOS.md` qué pasó, qué día se restauró y por qué.

## 5. Qué no tocar

- El cerrojo de host de pruebas de `POST /datos/respaldo/restaurar` (`apps/servidor/src/respaldo.ts`).
- `NO_SE_RESPALDAN` (hoy solo `sesiones`): copiar sesiones dejaría entrar con pases viejos.
- La prueba `restauracionAislada.test.ts`: es la garantía de que las copias sirven.
