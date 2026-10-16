# Autorización única: publicar la Fase 3 antes de la conciliación del 16 de octubre

**Estado: FIRMADA por Richard.** Este documento no cambia el sistema, ni la conciliación, ni sus registros. Solo deja escrito quién autorizó qué, por qué y con qué límites.

## Qué se autoriza

Publicar en producción la rama `fase-3-exclusividad`, ya validada en el sitio de pruebas, **una sola vez**. Al hacerlo se acepta que:

- la pieza «dinero» de la salud siga en error,
- y que el último semáforo de la publicación termine en rojo,

**exclusivamente** por la discrepancia conocida e intacta de la conciliación del 15 de octubre de 2026:

- 1 pedido: `95fce528-11b2-427e-946a-b4f8a7fd0033`, compra de prueba de Richard;
- 718 centavos vendidos;
- 87 esperados para el restaurante y 520 para el repartidor;
- 0 abonados;
- `cuadra = 0`.

## Por qué

- La Fase 3 no tiene dependencia técnica con la conciliación.
- La conciliación del 16 solo puede calcularse cuando termine el día y revisaría un día sin pedidos.
- La comprobación extraordinaria de solo lectura del 16 de octubre cuadra (`docs/PUBLICACION-ANTICIPADA-FASE-3.md`).

## Límites

1. Vale **solo para esta publicación**. No es una regla nueva.
2. No se modifica la conciliación del 15 ni ninguna otra. La discrepancia queda visible.
3. La decisión de publicar y la de revertir las toma `scripts/produccion/verificar-publicacion.mjs`. Si da ROJO por cualquier cosa distinta de esta excepción, se revierte de inmediato.
4. Cuando corra la conciliación del 16, se vuelve a verificar y se anota aquí el resultado.

## Firma

- Autorizado por: Richard
- Fecha y hora: 2026-10-16 14:42 UTC
- Mensaje con la autorización: «Sí, autorizo», en el chat, en respuesta a «LISTO PARA AUTORIZACIÓN FINAL» (verificador en modo antes: VERDE a las 14:39 UTC)

## Resultado (se completa después de publicar)

- Versión publicada: `36f4e35` (fusión de `fase-3-exclusividad` en `main`; flujo `publicar` 38919092406). Producción la sirve desde el 16 oct a las 15:3x UTC.
- Verificación después de publicar: **VERDE** (`verificar-publicacion.mjs despues 36f4e35`). Todas las piezas de la salud en `ok`, incluida `exclusividad`; `sms`, `retiros` y `tiempoReal` en «pendiente», como estaba previsto. «Dinero» en error SOLO por la conciliación conocida del 15. Los 17 disparadores puestos, 0 inconsistencias, 0 operaciones, solo Comida, retiros apagados. Las 15 rutas críticas en 200. El semáforo de GitHub falló únicamente por `/datos/salud → 503`, como estaba previsto.
- Conciliación del 16: pendiente (corre después de las 00:00 UTC del 17).
