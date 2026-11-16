# Ficha · «Mis viajes» y «Pedir la misma ruta» (15 nov 2026) — todos los países

Candado: C-MISMA-RUTA. Pedido de Richard: al cancelar un viaje había que escribir otra vez las dos direcciones.

## Referencias

Uber (Actividad, «Reservar de nuevo» / «Rebook»), DiDi (Mis viajes, viajes recientes) y Cabify (Mis viajes, repetir trayecto).

## Evidencia y límites

Etiquetas: [DOC] documentación publicada, [OBS] observación pública, [INF] inferencia, [NV] no verificable. Esta ficha NO lleva paquete REA: son apps de terceros (no se descompilan, regla de la casa) y sus pantallas de historial solo se ven con cuenta. Lo marcado [DOC] sale de los centros de ayuda públicos de cada empresa; no se volvió a leer cada página hoy, por eso las afirmaciones finas quedan en [INF] hasta que el investigador las confirme con su enlace.

- [DOC] Uber: la pestaña «Actividad» lista los viajes pasados con mapa de la ruta, fecha, precio y estado; desde el detalle se ve el recibo y la ayuda («Encontrar un objeto perdido»). Fuente: centro de ayuda de Uber, secciones de viajes anteriores y objetos perdidos.
- [OBS] Uber: en la pantalla de inicio aparecen destinos recientes como atajos debajo de «¿A dónde vas?».
- [INF] Uber: «Rebook» / «Reservar de nuevo» en el detalle de un viaje pasado reabre el pedido con las mismas direcciones y cotiza de nuevo; el precio mostrado es el del momento, no el anterior.
- [DOC] DiDi: «Mis viajes» en el menú, con historial, recibo y soporte por viaje. Fuente: ayuda de DiDi pasajero.
- [INF] DiDi y Cabify: los destinos recientes se ofrecen al escribir a dónde vas; volver a pedir pasa siempre por la pantalla de confirmación con precio nuevo.
- [NV] Si alguno repite también la forma de pago y la categoría exacta: no se ve sin cuenta.

## Diagrama

```
Mis viajes (historial, solo lectura, con puntos exactos)
   └─ «Pedir la misma ruta» ─▶ hoja «¿confirmas?» ── cotizar OTRA VEZ en el servidor
                                   ├─ «Sí, pedir ahora» ─▶ POST /viajes (id de la cotización nueva) ─▶ espera de siempre
                                   └─ «Cambiar algo» ─▶ Pedir viaje ya lleno (borrador)
Inicio «Tu último viaje» ─ «Repetir» ─▶ la misma hoja
```

## Comparación con Divoox

- Ya teníamos: historial con recibo y ayuda (C-VIAJES-HISTORIAL), cotización con precio fijo y vencimiento, borrador de Pedir viaje.
- Faltaba: puntos exactos en el historial, mapita, botón de repetir, confirmación con precio nuevo y el atajo del Inicio.

## Decisión

Se copia el estándar: repetir = confirmar con precio de ahora (nunca el viejo), mismo trayecto, paradas, categoría y forma de pago; «Cambiar algo» para ajustar. Se reutiliza la ruta de cotizar de siempre (no hay ruta nueva). Mirar el historial no escribe.

## Pruebas de aceptación

Ver C-MISMA-RUTA en `CANDADOS.md`: repetir arma el pedido con la cotización nueva, el viaje nuevo nace con los mismos puntos y el precio de ahora, el historial no escribe, el mapita proyecta los puntos reales dentro del recuadro.
