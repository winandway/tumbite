# Tres decisiones cerradas como el mercado (13 nov 2026)

**Ejecución de REA: ninguna.** Ficha corta «sin ejecución de REA; fuentes [DOC] y [OBS] de terceros». Las tres decisiones estaban anotadas sin cerrar; la regla «decidir como el mercado» dice que la IA aplica el estándar y Richard solo decide lo legal, las cuentas y el dinero real. Aquí solo se fijan **valores y reglas**: nada enciende retiros, reembolsos automáticos ni mueve dinero distinto. Todos los países.

## 1. Retiro mínimo

- **[OBS, terceros]** DoorDash Fast Pay cobra unos 1,99 dólares por retiro inmediato, con un mínimo bajo (cerca de 1 dólar); Uber Instant Pay cobra unos 1,25 dólares. Los dos pagan **gratis cada semana** de forma automática. Fuentes: The Rideshare Guy (therideshareguy.com/when-do-gig-workers-get-paid), Ridesharing Driver (ridesharingdriver.com/instant-pay-debit-card). Las cifras exactas se ven en la app y cambian: **[NV]** desde fuera.
- **Nuestro caso:** Divoox no cobra por retirar y Stripe cobra 25 centavos por cada retiro.
- **Decisión:** retiro mínimo de **10 dólares** (antes 1). Con eso el costo de Stripe queda en 2,5 % como mucho, sin cobrarle una comisión al repartidor ni al restaurante. Solo hay retiros en dólares.
- **Brecha anotada (no se hace ahora porque mueve dinero):** el pago semanal automático y gratis que usa el mercado.
- **Dónde vive:** `retiroMinimo` en `packages/compartido/src/decisionesMercado.ts`; lo exige `POST /datos/billetera/retirar` y lo dice la Billetera del panel.

## 2. Tope del reembolso automático sin revisión humana

- **[DOC]** La ficha `2026-10-29-ayuda-con-mi-pedido.md`: DoorDash y Uber Eats devuelven al instante las quejas pequeñas por plato y mandan a revisión las grandes; el monto exacto que usan es **[NV]**.
- **Cifras ya preparadas** en `docs/DECISIONES-PREPARADAS-2026-10-19.md`: 15 dólares en EE. UU., 30.000 pesos en Colombia y 5 dólares en Venezuela.
- **Decisión:** esas cifras quedan como **techo del mercado por país**. Aunque soporte suba su tope, el reembolso automático nunca pasa de ahí; lo que pasa va a una persona. Un país sin cifra no devuelve solo. El interruptor del reembolso automático **sigue apagado** (es dinero; lo enciende Richard).
- **Dónde vive:** `topeReembolsoSinRevision` en `decisionesMercado.ts`; lo aplica la queja guiada en `rutas/tickets.ts`.

## 3. Pedido ya listo que se cancela: quién paga la comida

- **[DOC]** DoorDash para comercios: el comercio cobra un pedido cancelado solo si había confirmado, la comida estaba preparada y la cancelación no fue su culpa. Fuente: help.doordash.com/en-us/merchants/article/do-i-get-paid-for-cancelled-orders (detalle en `2026-11-10-cancelar-pedido-listo.md`).
- **[OBS, terceros]** Del lado del cliente: después de que el restaurante confirmó, DoorDash devuelve como mucho el envío y la propina. Fuentes: Business Insider («How to cancel a DoorDash order and receive a refund»), Ridester. **[OBS]** Rappi cobró el total a un cliente que canceló con la comida empezada (reclamos de consumidores). Uber no lo publica: **[NV]**.
- **Decisión (igual en todos los países):**
  - El **cliente** cancela con la comida hecha: recupera envío y propina; la comida la paga él y el restaurante la cobra.
  - Causa del **restaurante**: el cliente recupera todo; el restaurante no cobra la comida.
  - Causa de **Divoox o del reparto**: el cliente recupera todo; Divoox le paga la comida al restaurante.
- **Hoy:** al aprobar una cancelación, soporte ve y deja anotado ese reparto (`repartoCancelacionListo`, en la respuesta y en la bitácora del pedido). El dinero que se mueve **sigue siendo el reembolso completo al cliente**; aplicar el reparto con dinero (reembolso parcial y pago de la comida) queda para cuando Richard lo encienda.
- **Pendiente de producto (no de decisión):** el cliente todavía no puede cancelar solo un pedido aceptado; lo hace por soporte.

## Pruebas

`packages/compartido/src/decisionesMercado.test.ts`, `apps/servidor/src/rutas/retiros.test.ts`, `apps/servidor/src/quejasGuiadas.test.ts`, `apps/servidor/src/rutas/cancelaciones.test.ts` y `apps/panel/src/panel/BilleteraRetiro.test.tsx`, comprobadas en rojo.
