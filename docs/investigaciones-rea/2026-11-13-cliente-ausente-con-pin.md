# Cliente ausente con PIN (C-CLIENTE-AUSENTE) — 13 nov 2026 — todos los países

## Referencias

- DoorDash (Dasher): ayuda pública «What should I do if the customer is unavailable?» y la pantalla de la entrega en la puerta.
- Uber Eats (repartidores): ayuda pública «Can't reach the customer / Unable to deliver».

## Evidencia y límites

- [DOC] DoorDash: el Dasher llega, intenta contactar al cliente (llamada y mensaje desde la app) y arranca un reloj de espera de 5 minutos visible en la app. Al vencer puede marcar «cliente no disponible» con foto; el pedido se cierra, el Dasher cobra la entrega.
- [DOC] Uber Eats: el reloj es de 8 minutos después de intentar contactar; al vencer, «Unable to deliver»; el repartidor cobra el viaje y el cliente paga el pedido.
- [DOC] En los dos, si el pedido exige identificación (alcohol), la comida no se deja en la puerta.
- [INF] Con un código de entrega (PIN) la lógica es la misma que con alcohol: sin el código no se deja; se cierra como no entregado por ausencia.
- [NV] Qué hace cada uno internamente con la comida (devolverla al local o que la descarte el repartidor) y los criterios exactos de reembolso: no se puede verificar desde afuera.
- No se usó REA sobre apps de terceros (prohibido). No se capturó tráfico ajeno. Esta ficha se escribió con las fuentes públicas citadas; los detalles finos de cada pantalla quedan para la próxima revisión con REA sobre la web pública de ayuda.

## Diagrama

```
en_camino → llegó (dos lecturas en la puerta) → «El cliente no aparece»
  → aviso al cliente (push + SMS si hay Twilio) + chat y llamada con número oculto
  → reloj visible (configurable, 5 min por defecto)
  → sin PIN: «Dejar en lugar seguro» (foto + nota)
  → con PIN o con edad: «Cliente no apareció: cerrar con foto» (foto del lugar, la comida no se deja)
       → pedido «entregado» con evidencia modo «ausente»
       → el cobro se captura (el cliente paga), repartidor y restaurante cobran lo suyo
       → aviso «No pudimos entregar tu pedido» + caso de soporte con la foto y las horas
  → en efectivo o transferencia: no se cierra como ausente; sigue «El cliente no pagó»
```

## Comparación con Divoox

- Ya existía: «El cliente no aparece», el aviso al cliente, la espera de 5 minutos y el lugar seguro con foto y nota; llamada con número oculto y chat.
- Faltaba: con PIN el repartidor quedaba atrapado (sin lugar seguro y sin forma de cerrar). La espera estaba fija en el código.

## Decisión

- Se reutiliza el camino del dinero de una entrega (captura, abonos, conciliación): no hay segunda implementación.
- La espera sale de la configuración `ESPERA_CLIENTE_AUSENTE_MIN` (entre 2 y 15; sin valor, 5) y la app la recibe en el pedido activo.
- No hay reembolso automático; el caso queda en soporte para decidir con la evidencia.

## Pruebas de aceptación

- `operacion.test.ts`: «C-CLIENTE-AUSENTE: con PIN y sin cliente…» (de punta a punta por la API) y «…se cobra en mano…».
- `pinSinFotoApp.test.ts`: la app ofrece el cierre con foto solo pasada la espera y con PIN o edad.
