# Ficha · Despacho de Comida por el catálogo de habilitaciones (NXT-6, 3 nov 2026)

Candado: C-DESPACHO-CATALOGO. Todos los países.

## Referencias y evidencia

- [DOC] Estudio de Richard «Estudio_Delivery_Tumbite» (E2), página 3, «Arranque en frío»: el repartidor entra con edad mínima por estado, identidad, SSN y **licencia y seguro si va en carro**; antecedentes (Checkr en DoorDash); identidad continua; cuenta de pago; y recién entonces «se pone en línea en una zona».
- [DOC] Mismo estudio, comparativa del alta (p. 3-4): DoorDash y Uber Eats activan al repartidor por vehículo; a pie o en bicicleta no piden licencia ni seguro.
- [INF] Por lo anterior, el despacho de los grandes solo ofrece un pedido a quien ya está activado para ese servicio con un vehículo aceptado. Cómo lo filtran por dentro no se ve desde afuera [NV].
- REA: no aplica a este punto. Es una regla interna del servidor y la prueba directa (en rojo) es mejor evidencia; no hay pantalla nueva de los grandes que observar.

## Diagrama

```
pedido listo para ofrecer
   └─ candidatos libres de la zona (celdas vecinas → zona → agrupables)
        └─ ¿la zona tiene el interruptor encendido? ── no ──► igual que siempre (C-COMIDA-INTACTA)
              └─ sí ─► por orden: motivoServicio(repartidor, 'comida') === 'habilitado'
                         (sin bloqueo · habilitación aprobada o legado · vehículo aprobado y
                          compatible · requisitos del servicio y del vehículo · Comida encendido)
                         └─ se queda con el primero (o los 20 de la oferta abierta)
```

## Comparación con Divoox

- Ya existía el catálogo (`habilitaciones`, `servicio_vehiculos`, `servicio_requisitos`, `servicio_vehiculo_requisitos`, `conductor_bloqueos`) y `estadoDelConductor`, que lo lee para la app. Moto y Carro usan la vista `conductores_elegibles`. Comida no lo leía.
- Se reutiliza `estadoDelConductor` (la misma regla que ve el conductor) en vez de escribir otra.

## Decisión

- Interruptor por zona, tabla `despacho_catalogo_zonas`, que nace apagado. No se enciende donde Comida no está disponible (dejaría la zona sin repartidores).
- El repartidor de siempre, sin fila en `habilitaciones`, sigue habilitado para Comida (legado, igual que en la app).
- Al conectarse en una zona encendida, la app le dice por qué no le llegarían pedidos (como DoorDash: sin activar no se reparte).

## Pruebas de aceptación

`apps/servidor/src/despachoCatalogo.test.ts` (apagado igual que antes; suspendido fuera; carro sin licencia o seguro fuera y con ellos dentro; bloqueo y Comida apagado fuera; interruptor solo del equipo, zona válida, 409 donde Comida no está, auditoría) y `apps/panel/src/panel/DespachoCatalogo.test.tsx`.
