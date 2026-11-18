# Subir la tarifa cuando nadie acepta (C-SUBIR-TARIFA) — 18 nov 2026

Pedido de los mototaxistas del piloto (El Vigía y Tucaní) vía Gerencia: «¿qué pasa si nadie toma la
oferta porque el precio es muy bajo?». País: Venezuela primero; EE. UU. con sus propios valores.

## 1. Referencias y evidencia

| Hallazgo                                                                                                                                                                        | Etiqueta    | Fuente                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DiDi «Poné Tu Precio» (Argentina): el pasajero contraoferta el precio; los conductores presentan sus ofertas; el pasajero elige.                                                | [REA] [OBS] | Página pública `web.didiglobal.com/ar/pasajero/didi-pone-tu-precio`, capturada con REA (árbol de accesibilidad, sha256 9ab86e0c…).                                                                                               |
| inDrive: hay una tarifa mínima recomendada; el pasajero puede ofrecer esa o una mayor; si nadie acepta puede «hacer una nueva oferta»; el precio no se cambia durante el viaje. | [DOC]       | Ayuda pública `indrive.com/es-mx/help/passengers/how-fares-are-calculated` (leída como visitante). REA con navegador sin cabeza recibió 403 de CloudFront en otra página de su ayuda: no se insistió (no se saltan anti-robots). |
| inDrive y DiDi (en sus apps): botón «Aumentar tarifa» / «Raise fare» con montos fijos mientras se busca.                                                                        | [INF]       | No hay página pública que lo describa; se infiere de lo anterior y de la práctica conocida del mercado. No se abrieron sus apps ni se usaron cuentas.                                                                            |
| Uber: la dinámica sube el precio por demanda, no por el pasajero.                                                                                                               | [DOC]       | Conocido; no aplica a este flujo.                                                                                                                                                                                                |

Paquete de evidencia: `evidencia-rea-2026-11-18-subir-tarifa.json.gz` (sha256 del JSON sin comprimir:
680361d971578c8cc4fe46ca1683e600b2b9dbd4488f2d926109765da3bc3795).

## 2. Diagrama

```
Pasajero pide ─► buscando ─► oferta 30 s a un conductor ─► nadie acepta
                     │                                    │
                     │        (pasan «esperaS» segundos)   ▼
                     └──────────────────────────── «Subir la tarifa» (+0,25 / +0,50 / +1,00)
                                                          │  POST /viajes/:id/subir-tarifa {monto, clave}
                                                          ▼
              cotización.total += monto · desglose.subidaPasajero · cambios_viaje (tipo subida)
              eventos_operacion «subida_tarifa» · oferta abierta → retirada
                                                          ▼
              repartirOperaciones: ofrece al más cercano, también a quien la dejó vencer o la rechazó
              (vuelveAOfrecerse: oferta anterior a la subida) · aviso al celular · «Tarifa subida»
```

## 3. Comparación con Divoox

- Teníamos precio fijo por cotización y la reoferta (C-REOFERTA-VENCIDA). No había forma de mejorar el
  precio sin cancelar y volver a pedir (y cancelar perdía el lugar en la fila de ofertas).
- Ya existía un cambio de precio a mitad de viaje (C-VIAJE-PARADAS, `cambios_viaje`): se reutiliza el
  mismo registro con `tipo = 'subida'`.

## 4. Decisiones

1. **Montos fijos, no texto libre** (como los botones de inDrive/DiDi [INF]): evita errores y abusos.
   Por ciudad y servicio en `ajustes_viaje_zona` (superadmin, «Interruptores por ciudad»). Sin pasos,
   apagado. Propuesta: El Vigía y Tucaní con 0,25 / 0,50 / 1,00 USD, 40 s, 3 veces, tope 1,5×.
   EE. UU.: 1 / 2 / 3 USD cuando se encienda, pero ver punto 5.
2. **No se cancela el viaje**: el precio nuevo vive en la cotización del viaje (de ahí salen comisión,
   ganancia de la oferta, cobro en mano y recibo).
3. **A quién se reofrece**: a todos los cercanos, también a quien la dejó vencer **y a quien la
   rechazó** (con precio nuevo es una oferta nueva; criterio de inDrive, donde una oferta nueva llega
   a todos [DOC]). Los rechazos no se reescriben (la tasa de aceptación no cambia).
4. **Regalo**: el regalo de Divoox no crece; la subida la paga el pasajero en mano.
5. **Tarjeta**: nunca por encima de lo ya autorizado. En EE. UU. (solo tarjeta) subir exigiría una
   autorización nueva en Stripe: queda **apagado** allá hasta que exista ese flujo.
6. **Topes**: veces por viaje (3) y precio máximo (1,5× la cotización original), configurables.
   Espera entre subidas (40 s). Idempotente por clave.

## 5. Pruebas de aceptación

`apps/servidor/src/rutas/subirTarifa.test.ts` (12) y `apps/panel/src/panel/pasosSubida.test.ts`.
