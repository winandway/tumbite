# Divoox · Requisito de monetización prepagada multiservicio

> Dictado por Richard el 27 de octubre de 2026, durante la Fase 4 de Flex. Es un requisito permanente del proyecto: se lee antes de tocar cualquier cobro de comisiones a conductores.

## El requisito (palabras de Richard, resumidas)

Divoox cobra sus comisiones descontándolas automáticamente del **saldo prepago de los conductores** en los mercados donde esté habilitado, en todos los servicios de reparto: Food, Grocery, Express (A → B), Flex y los que vengan.

1. El conductor recarga saldo (por ejemplo, $20).
2. Recibe ofertas compatibles con su vehículo, ubicación y disponibilidad.
3. Acepta el trabajo.
4. El sistema comprueba y, si corresponde, **reserva** la comisión prevista.
5. Al completar el servicio, **descuenta** la comisión aplicable.
6. Si se cancela, aplica la política de cancelaciones y **libera o ajusta** la reserva.
7. Cada movimiento queda en la billetera.

- Comisiones fijas o porcentuales, por país, ciudad, servicio y conductor.
- **Estados Unidos:** se conservan Stripe Connect y los flujos actuales.
- **Sudamérica:** saldo prepago por mercado, sujeto a los proveedores de recarga y a los requisitos legales.
- Excepciones y modalidades híbridas **sin duplicar el motor financiero**.
- Descuento **atómico e idempotente**: nunca dos cobros por el mismo servicio.
- **No** se activan pagos reales ni se exige saldo a conductores en mercados nuevos sin autorización comercial y legal.

## Auditoría (27 oct 2026): qué existe

| Componente                                                                                    | Estado                                                                                                                                                                                                         | Dónde                                                                                                       |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Recargas del conductor por código de punto de venta                                           | Implementado (canje único, atómico, auditado)                                                                                                                                                                  | `apps/servidor/src/internacional/recargas.ts`                                                               |
| Recargas del conductor con tarjeta (Stripe, aviso firmado, una sola vez)                      | Implementado; sin compra real                                                                                                                                                                                  | `crearRecargaStripe`, `acreditarRecargaStripe`                                                              |
| Billetera prepago del conductor (bolsillo `prepago` del libro, nunca negativo, no se retira)  | Implementado                                                                                                                                                                                                   | `apps/servidor/src/internacional/libro.ts`                                                                  |
| Separación prepago / ganancias retirables                                                     | Implementado (ganancias en `movimientos`; el retiro solo mira eso)                                                                                                                                             | `retiros.ts`, `finanzas/conductor.ts` (`saldosConductor`)                                                   |
| Reserva al aceptar, cobro al completar, liberación al cancelar                                | **Implementado para Food en cobro directo** (efectivo/transferencia); **parcial** para los demás servicios                                                                                                     | `reservarComision`, `sentenciasCobrarReserva`, `liberarReserva`                                             |
| Políticas de comisión por país                                                                | **Parcial en Food** (`comisionPb` y `cargoFijo` por país); **motor común** (servicio, país, ciudad, empresa o conductor, fija, porcentual, volumen, promociones, vigencia, revisión legal) creado en la Fase 4 | `internacional/paises.ts`; `packages/compartido/src/finanzas.ts`, `apps/servidor/src/finanzas/politicas.ts` |
| Cobro de comisión al conductor reutilizable por servicio (atómico, idempotente, sin negativo) | Implementado en la Fase 4; **no enchufado todavía** a Express, Grocery ni Flex conductor                                                                                                                       | `finanzas/conductor.ts` (`cobrarComisionConductor`)                                                         |
| Conciliación                                                                                  | Implementado (Food diaria; billeteras de empresa Flex en la Fase 4)                                                                                                                                            | `conciliacion.ts`, `finanzas/reloj.ts`                                                                      |
| Stripe Connect en EE. UU.                                                                     | Implementado y sin cambios                                                                                                                                                                                     | `rutas/dinero.ts`, `retiros.ts`                                                                             |
| Express, Grocery                                                                              | **Inexistentes como servicios** (solo en el catálogo)                                                                                                                                                          | —                                                                                                           |

## Cómo se cumple sin duplicar nada

- Una sola billetera del conductor: el bolsillo `prepago` del libro. No se crea otra.
- Una sola capa de políticas: `politicas_financieras` (con `tipo_cuenta = 'conductor'`). El prepago de conductores **no rige** en un mercado hasta que la política tenga la revisión legal y comercial aprobada (`revision_legal_aprobada`), lo que cumple «no exigir saldo sin autorización».
- Reserva y cobro: se reutilizan `reservarComision` / `sentenciasCobrarReserva` / `liberarReserva` (referencias únicas por servicio) y `cobrarComisionConductor`.
- EE. UU. sigue con Stripe Connect: allí no se crean políticas de prepago de conductores.

## Estado al 30 oct 2026 (revisado en el código)

1. Food en cobro directo pasa por la capa de políticas sin cambiar el resultado: **hecho** (C-FOOD-POLITICAS, `comisionFood`, 29 oct).
2. Reserva y cobro por servicio: **hecho** para Moto, Carro y Envíos (`comisionConductor` en `operaciones.ts`, conciliado en la salud «viajes») y para Tiendas (sus compras son pedidos y usan el camino de Food). Flex conductor **no aplica**: en Flex paga la empresa desde su billetera, no el conductor.
3. Política de cancelaciones por servicio: **hecho** (`politicaCancelacionVigente`).
4. Activación por mercado: **espera la autorización comercial y legal escrita de Richard** (👤 en `PENDIENTES.md`). En EE. UU. sigue Stripe Connect, sin prepago de conductores.
