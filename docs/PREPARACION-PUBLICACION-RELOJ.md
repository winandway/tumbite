# Preparación de la publicación del reloj seguro

Fecha: 16 de octubre de 2026, 16:30 UTC. **Solo preparación:** no se fusionó, no se publicó, no se activó el reloj de Cloudflare de producción y no hubo operaciones de dinero. Las consultas a producción fueron de solo lectura (0 escrituras).

## A. Estado actual de producción

- Sirve `36f4e35` (la Fase 3). `main` tiene el mismo código: encima solo hay un commit de documentos (`408d3a5`), que la rama del reloj ya contiene.
- La rama `fase-reloj-seguro` contiene la integración validada `5959c5f`, más el verificador nuevo (`104d8ca`) y documentos.
- Verificador en modo «antes»: **VERDE.** El único error es la conciliación conocida del 15 (pedido `95fce528`, 7,18 USD), intacta. No hay otros errores de dinero, movimientos, cobros abiertos ni retiros.
- Verificador en modo «después» de la Fase 3: **VERDE.** Los 17 disparadores, 0 inconsistencias, 0 operaciones, exclusividad en `ok`.
- 0 pedidos activos, 0 repartidores ocupados o conectados, 0 retiros, sin la bandera de retiros. Solo Comida; Moto y Carro apagados.
- Respaldo automático del 16 a las 01:43 UTC. Desde entonces no cambió ningún pedido, usuario ni historial.
- La conciliación del 16 todavía no existe: corre después de las 00:00 UTC del 17.

## B. Resultado de la validación final

- **Sitio de pruebas, corrida 38927605929, base real y Stripe en modo prueba: todo en verde al primer intento.** Pasaron S2 a S5, S7 y S11, F1, M4 y M5, F2, F3 y RELOJ, el tiempo real en vivo, el recorrido completo de Comida en inglés y en español, y la conciliación.
- **Los errores de las tareas críticas no se silencian:** la lista de tareas no tiene ningún `catch`, y lo fija una prueba comprobada en rojo. Son críticas ofertas, operaciones, Manager, conciliación, retiros y conciliación de retiros.
- **El verificador ahora revisa el reloj** con el modo `despues-reloj`:
  - la pieza `reloj` tiene que estar en `ok`, o en `atrasado` cuando solo hay el programador de GitHub. **Nunca acepta `error`.**
  - la última vuelta no puede tener tareas críticas fallidas.

  Probado en producción hoy: da ROJO, porque el reloj seguro todavía no está publicado. En el sitio de pruebas da `reloj: ok`, con los 17 disparadores y 0 fallas en 24 horas.

## C. Riesgos pendientes

1. Producción será más estricta. Las tareas ya no tragan sus errores: si alguna falla hoy en silencio, la salud se pondrá en rojo y el verificador dará ROJO, lo que lleva a revertir.
2. Mientras no cuadre la conciliación del 16, el semáforo de GitHub seguirá en rojo solo por la pieza «dinero». Si se publica antes de esta noche, hace falta la misma excepción documentada que con la Fase 3. **Si se publica después de que cuadre, no hace falta ninguna excepción.**
3. Una tarea que se cuelga frena a las que vienen detrás en esa vuelta. La salud lo detecta en 5 minutos.
4. Siguen pendientes, sin implementar: el versionado visible, las imágenes en WebP, y la corrección del catálogo y la sesión.

## D. Criterios

**Para publicar, justo antes:**

- `verificar-publicacion.mjs antes 36f4e35` en VERDE;
- el sitio de pruebas en verde;
- 0 pedidos activos;
- ningún dato cambiado desde el último respaldo;
- su autorización expresa;
- y, si es antes de que cuadre la conciliación del 16, la excepción escrita.

**Para revertir de inmediato:** `verificar-publicacion.mjs despues-reloj <versión>` da ROJO por cualquier motivo. Por ejemplo:

- la pieza `reloj` en `error` o ausente;
- una tarea crítica fallida en la última vuelta;
- cualquier otra pieza en error que no sea la excepción conocida;
- faltan disparadores de la Fase 3;
- aparece Moto o Carro, o se encienden los retiros;
- cae una ruta crítica.

**Cómo se revierte:** revertir el commit de la fusión en `main`, que vuelve a `36f4e35`, en unos 40 minutos. La tabla `reloj_tareas` queda sin uso y no hay datos que deshacer.

## E. Confirmación

**LISTO PARA AUTORIZACIÓN FINAL.**
