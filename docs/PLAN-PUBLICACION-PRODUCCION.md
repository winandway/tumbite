# Plan de publicación controlada a producción

Fecha: 15 de octubre de 2026. **NO EJECUTADO.** Se ejecuta solo con la autorización explícita de Richard.

## Qué corrige en producción

1. **Doble pago en retiros** (Fase 0, C-RETIROS-SEGUROS). Hoy un retiro con la respuesta de Stripe perdida puede pagarse dos veces. Nadie lo ha usado con dinero real.
2. **`evidencias.modo` y `evidencias.nota` que faltan** (C-ESQUEMA-COMPLETO). Hoy el repartidor no ve «Conectarme» y no se guardan las fotos de recogida y entrega: Comida no puede completar una entrega.
3. Arrastra lo validado en pruebas: la anulación verificada, el candado del reloj por minuto, los entornos separados (Etapa A) y el catálogo de servicios con Moto y Carro **apagados**. Todo eso queda inerte o en su estado seguro (ver §4).

## 1. Respaldo (antes de nada)

| Paso | Cómo                                                                                                                                                                                        | Qué tiene que verse                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1.1  | Respaldo completo de la base de producción: `POST https://tumbite.com/datos/respaldo` con la cabecera del secreto del reloj (lo hace el workflow `reloj` desde GitHub; nadie ve el secreto) | `{"ok": true, "tablas": …, "filas": …}` |
| 1.2  | Salud de producción                                                                                                                                                                         | `respaldo: ok` con la fecha de hoy      |
| 1.3  | Anotar la versión que sirve producción (`<meta name="version">`)                                                                                                                            | Hoy `e5a2ff0`                           |

## 2. Verificaciones previas (solo lectura, con la llave de «Acceso para IA» de producción)

| #   | Consulta                                                                                                                              | Resultado esperado                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | `SELECT id, usuario_id, monto, concepto, referencia FROM movimientos WHERE concepto = 'retiro' OR referencia LIKE 'retiro-fallido-%'` | **0 filas** (el retiro nunca se usó con dinero real). Si hay filas: cada `retiro-fallido-*` se revisa en Stripe antes de seguir    |
| 2.2 | `SELECT COUNT(*) FROM pedidos WHERE estado IN ('pagado','aceptado','listo','en_camino')`                                              | 0 (sin pedidos en curso). Si hay, se espera a que terminen                                                                         |
| 2.3 | `SELECT COUNT(*) FROM repartidores WHERE conectado = 1`                                                                               | 0                                                                                                                                  |
| 2.4 | Columnas de `evidencias`                                                                                                              | Faltan `modo` y `nota` (es lo que se corrige)                                                                                      |
| 2.5 | `SELECT valor FROM config WHERE clave = 'retiros_activos'`                                                                            | Sin fila (retiros nacerán **apagados**)                                                                                            |
| 2.6 | Variables de producción                                                                                                               | `SITIO_URL = https://tumbite.com`; Stripe con llaves **reales** (`pk_live_…`); **sin** variables del tiempo real (quedará apagado) |

## 3. Ejecución

1. Fusionar la rama validada a `main` (el informe de pruebas cita la versión exacta).
2. `verify` corre completo (pruebas, tipos, lint, empaquetado, auditoría).
3. `publicar` (corregido en la Etapa A): paquete de pruebas revisado → pruebas → semáforo de pruebas → **paquete de producción armado aparte y revisado** → producción → **semáforo de producción**.
4. Si cualquier paso falla, el flujo se detiene solo y producción queda como estaba (salvo el último paso, ver §6).

## 4. Migraciones exactas

**Automáticas al publicar (solo crean lo que falta, no tocan datos):**

| Qué                                                                                                    | Dónde                                    | Efecto                                                                                           |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Tabla `retiros`, sus índices y 3 disparadores; índice `movimientos_retiro_revertido`                   | `schema.sql`                             | Retiros seguros. El índice nuevo solo cubre referencias `retiro-revertido:%`, que hoy no existen |
| Tablas del catálogo, vehículos, habilitaciones, requisitos, preferencias, auditoría y sus disparadores | `schema.sql`                             | Vacías salvo el catálogo inicial. Moto y Carro «próximamente»                                    |
| Tablas del tiempo real (`tareas_programadas`, `peticiones_internas`, `lotes_ubicacion`)                | `schema.sql`                             | Vacías. Sin las variables, las rutas internas no existen                                         |
| `evidencias.modo`, `evidencias.nota`, `repartidores.vehiculo_activo_id`                                | `esquema.ts` (COLUMNAS, al arrancar)     | Las dos primeras arreglan Comida; la tercera queda vacía                                         |
| Comida implementada y disponible en Miami                                                              | `esquema.ts` (al arrancar, una sola vez) | Igual que hoy                                                                                    |

**NO se corren** en esta publicación: M4 y M5 (vehículos y habilitaciones de repartidores existentes) ni ninguna migración de la Fase 3. Esas van aparte, con su propio respaldo y autorización.

## 5. Pruebas posteriores

| #   | Qué                                                                          | Resultado esperado                                                                                         |
| --- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 5.1 | Semáforo de producción (automático)                                          | versión nueva servida y todas las rutas en 200                                                             |
| 5.2 | Salud                                                                        | `esquema: ok`, `entorno: ok`, `retiros: pendiente` (apagados), `servicios: ok`, `stripe: ok`, `dinero: ok` |
| 5.3 | Solo lectura: columnas de `evidencias`                                       | `modo` y `nota` presentes                                                                                  |
| 5.4 | Solo lectura: `SELECT servicio_id FROM servicios_implementados`              | solo `comida`                                                                                              |
| 5.5 | Una cuenta de repartidor de prueba de Richard entra al Driver en tumbite.com | aparece «Conectarme»                                                                                       |
| 5.6 | La compra real de un dólar (pendiente de Richard)                            | circuito de pago completo, como dice VERIFICAR-PAGOS                                                       |

## 6. Plan de recuperación

| Si…                             | Se hace                                                                                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| El semáforo de pruebas falla    | Nada llega a producción (el flujo se detiene solo)                                                                                                                                               |
| El semáforo de producción falla | Se revierte el commit en `main` y el flujo republica la versión anterior. Las tablas y columnas nuevas quedan sin uso y no estorban (SQLite no borra columnas con seguridad; tampoco hace falta) |
| Algo raro con los retiros       | Ya nacen apagados. Emergencia: variable `RETIROS_APAGADOS=1` en el panel de producción y republicar                                                                                              |
| Un dato se dañó                 | Restaurar desde el respaldo del paso 1.1 (copia en el almacén del sitio)                                                                                                                         |

## 7. Retiros reales

**Siguen apagados** después de publicar (sin la fila `retiros_activos = '1'` no se puede retirar). Para encenderlos hace falta una decisión aparte de Richard, después de: el aviso `transfer.created` activado en Stripe de producción, Connect activado en la cuenta real (Stripe la revisa) y una primera prueba controlada.
