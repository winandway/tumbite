# Ficha: varios locales en una sola cuenta (29 oct 2026) — todos los países

## Referencia

- [DOC] DoorDash Merchant y Uber Eats Manager dejan que un dueño o una cadena maneje varias tiendas desde una sola cuenta: un selector de tienda arriba, menús compartidos o por tienda, informes por tienda y en conjunto, y cada tienda con su horario, su dirección y su cuenta de pagos.
- [INF] Cada local sigue siendo un comercio aparte para el cliente (su ficha, su menú, su distancia).

## Lo que hoy supone «un local por dueño» en Divoox

| Pieza                                     | Dónde                                                                                                           | Qué supone                                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Elegir «mi restaurante»                   | `rutas/catalogo.ts` `miRestaurante`, `rutas/operacion.ts` `miRestauranteId`, `rutas/regalos.ts`, `rutas/kyc.ts` | `SELECT … WHERE dueno_id = ? OR miembro … LIMIT 1` implícito (`first`): toma el primero |
| Crear el restaurante                      | `PUT /datos/mi-restaurante`                                                                                     | crea uno si el dueño no tiene; si tiene, edita ese                                      |
| Fotos del local                           | `rutas/fotos.ts`                                                                                                | busca el restaurante por `dueno_id`                                                     |
| Verificación del local (foto en el lugar) | `kyc` (llave `usuario_id`)                                                                                      | una verificación por persona, no por local                                              |
| Cobros a Stripe Connect                   | `cuentas_stripe` (llave `usuario_id`)                                                                           | una cuenta de pagos por dueño (sirve igual para varios locales del mismo dueño)         |
| Activación, abrir y cerrar, señal         | `activacionDe`, `senal_en` por restaurante                                                                      | ya es por restaurante                                                                   |
| Avisos y correos al dueño                 | `manager.ts`, `pausa.ts`, `pedidos.ts` (`r.dueno_id`)                                                           | ya van al dueño del restaurante del pedido: funcionan con varios                        |
| Miembros                                  | `miembros_restaurante` (restaurante, usuario, rol)                                                              | un miembro puede estar en varios, pero el panel toma el primero                         |
| Panel y app del restaurante               | `apps/panel`, `apps/restaurante`                                                                                | no hay selector de local                                                                |

## Decisión de arquitectura (propuesta)

1. **Sin cambiar las tablas de pedidos ni de cobros.** Cada local sigue siendo una fila de `restaurantes`; el dueño puede tener varias.
2. **El local activo viaja en una cabecera** `x-restaurante: <id>` desde el panel y la app. Una sola función del servidor, `localActivo(c)`, reemplaza a `miRestaurante` y `miRestauranteId`: si viene la cabecera, comprueba que el local sea del dueño o que sea miembro; si no viene, toma el primero (lo de hoy, nada se rompe).
3. **«Agregar un local»** en el panel: crea otra fila de `restaurantes` con el mismo dueño, nace sin aprobar y pasa por la misma activación y aprobación que el primero.
4. **Verificación del local por local:** la foto en el lugar se guarda por restaurante (tabla nueva `kyc_local`), la identidad sigue por persona.
5. **Cobros:** la misma cuenta de Stripe del dueño para todos sus locales (como hoy); el informe de dinero se puede filtrar por local.
6. **Selector** «Local: Miami Norte ▾» arriba en el panel y en la app del restaurante, con «Todos» en el tablero.

## Pruebas de aceptación

- Un dueño con dos locales ve y cambia pedidos de cada uno sin mezclar; un miembro de un solo local no ve el otro.
- Sin cabecera, todo se comporta como hoy (las pruebas actuales siguen en verde sin tocarlas).
- El segundo local pasa por aprobación y activación propias.
- El tablero «Todos» suma los dos locales en la misma moneda.

## Riesgo

Toca más de 20 lugares del servidor que hoy toman «el primer restaurante del dueño». Por eso va con la función única `localActivo` y la regla «sin cabecera = lo de hoy», y se construye en una rama con el recorrido completo en verde antes de fusionar.

## Bloqueo encontrado al empezar (29 oct 2026)

`restaurantes.dueno_id` es `UNIQUE` en `schema.sql`: la base no deja que un dueño tenga dos restaurantes. En SQLite quitar un `UNIQUE` exige reconstruir la tabla (crear otra sin la regla, copiar, cambiar de nombre), y de `restaurantes` cuelgan pedidos, platos, horarios, miembros, cobros y más. Es una migración de producción delicada: **espera el visto bueno de Richard** antes de hacerse, con respaldo previo, ensayo en el sitio de pruebas y punto de restauración.

Alternativa sin tocar la tabla (descartada): crear cada local nuevo con otro «dueño» técnico y dar al dueño real el rol de dueño por `miembros_restaurante`. Complica cobros, avisos y permisos y va contra la regla de no inventar.
