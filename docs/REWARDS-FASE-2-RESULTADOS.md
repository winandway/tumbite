# Divoox Rewards · Informe de cierre de la Fase 2 (modo sombra)

Fecha: 30 de octubre de 2026. País: todos los países. Rama: `fase-rewards-2` (commit final `a003672`; primera versión `83ac137`).
Diseño: `docs/REWARDS-FASE-2-DISENO.md`. Plan general: `docs/PLAN-NIVELES-Y-PREMIOS.pdf`.

## Conclusión

**FASE 2: COMPLETADA.** El motor de reputación corre en modo sombra solo en el sitio de pruebas,
calculó de verdad con un repartidor de prueba, y producción no recibió nada. No se avanza a la
Fase 3 ni se publica en producción sin orden expresa.

## Las cuatro comprobaciones finales

| Comprobación                             | Resultado                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pruebas recibió la versión nueva         | `staging.tumbite.com/datos/version` responde `a003672`. La corrida completa del flujo de pruebas terminó en VERDE: tipos, lint, pruebas, build, auditoría, gitleaks, publicación SOLO en pruebas, semáforo 200, Moto, avisos de Stripe de prueba, pruebas S de la Fase 0, tiempo real, recorrido completo de Comida con Stripe de prueba y conciliación. |
| Cálculo real con un repartidor de prueba | `POST /datos/admin/rewards/sombra/<repartidor demo>/calcular` (cuenta demo.soporte, rol admin). Resultado abajo.                                                                                                                                                                                                                                         |
| Producción sin cambios                   | `divoox.com` y `tumbite.com` siguen en `bb587af` (igual que `main`). Salud 200; portada, `/es`, `/panel` y `/docs` en 200. La dirección de sombra responde 404 en producción.                                                                                                                                                                            |
| Informe con las siete evidencias         | Este documento.                                                                                                                                                                                                                                                                                                                                          |

### El cálculo real en pruebas (repartidor demo, 30 oct 2026)

- Modo: `sombra`. Versión de la fórmula: `r2-2026-10-30`.
- Puntaje **77,6 → nivel Oro, provisional** (peso de ventana 1 de 100: tiene una sola entrega de Tiendas).
- Componentes (con la muestra pequeña mezclada con la referencia, condición A):
  finalización 0,9525 → 24,3 · puntualidad 0,905 → 16,8 · calidad 0,0095 → 19,1 ·
  satisfacción 4,81 → 11,4 · aceptación 0,6675 → 5,9.
- Elegibilidad: `sin_datos` (informativa; no decide nada).
- Experiencia: 1 entrega de Tiendas, 10 puntos históricos.
- Guardado: una fila en `reputacion_diaria` del día, ninguna fila de hitos (no llega a 100 unidades).
- Llamarlo otra vez el mismo día reemplaza la misma fila: no se duplica.

## Evidencia 1 · Archivos creados y modificados (20 archivos, +2372 / −15)

Creados:

- `packages/compartido/src/reputacion.ts` y su prueba: el motor común (pesos 30/25/20/15/10,
  escalas suaves, ventana ponderada de 100, mezcla con referencia, histéresis, elegibilidad aparte).
- `packages/compartido/src/rewardsHitos.ts` y su prueba: estados de premio sin pagos y antifraude por servicio.
- `apps/servidor/src/rewards/sombra.ts`: lectores de comida, Tiendas, Express y Flex; cálculo diario; hitos con presupuesto.
- `apps/servidor/src/rewards/rutas.ts`: consulta y cálculo solo para admin y solo en pruebas.
- `apps/servidor/src/rewards/sombra.test.ts` y `apps/servidor/src/rutas/metricasVentana.test.ts`.
- `scripts/rewards/simular_puntaje.py`, `simular_despacho.py`, `presupuesto_primer_hito.py`.
- `docs/REWARDS-FASE-2-DISENO.md` y este informe.

Modificados:

- `schema.sql` (solo `CREATE TABLE IF NOT EXISTS`: `reputacion_diaria`, `rewards_presupuesto`,
  `rewards_reservas`, `rewards_hitos`, `rewards_eventos`, `apelaciones_repartidor`) y `esquemaColumnas.ts` regenerado.
- `apps/servidor/src/rutas/repartidorGrandes.ts`: las dos correcciones de métricas.
- `apps/servidor/src/rutas/operacion.ts` e `interno.ts`: tarea del reloj `rewards_sombra` (no crítica) con el entorno.
- `apps/servidor/src/app.ts` y `mensajesEn.ts`: montar las rutas y el texto en inglés.

Nada se borró ni se alteró en tablas existentes. Ninguna migración destructiva.

## Evidencia 2 · Resultados de las pruebas

- `npm run verify` completo en verde: tipos, lint, **1384 pruebas** con cobertura, build, auditoría
  (0 vulnerabilidades altas), gitleaks.
- Pruebas nuevas de Rewards: 38 (13 del motor, 5 de hitos y antifraude, 18 del modo sombra y la limpieza, 2 de métricas).
- Las mismas pasaron en GitHub en el flujo de pruebas antes de publicar en el sitio de pruebas.
- Las pruebas de las dos correcciones se comprobaron en ROJO antes del arreglo.

### Lo que encontró la corrida completa en pruebas (y se arregló)

La primera corrida completa en el sitio de pruebas falló. Se investigó y se arregló antes de cerrar:

1. **Fallo de Rewards (real):** el cálculo diario guardaba una fila para repartidores de prueba sin
   ninguna entrega, y esa fila impedía borrarlos (la limpieza de tiempo real y la de cobros del sitio
   de pruebas daban error 500 y dejaron un cobro de prueba «en revisión», lo que puso en rojo la salud
   de pruebas). Arreglo: no se guarda foto de un repartidor sin actividad, toda limpieza de prueba
   borra lo de Rewards antes que al usuario, y el reloj procesa 10 repartidores por vuelta en lugar
   de 40. Candado C-REWARDS-LIMPIEZA, con pruebas comprobadas en rojo. Los datos de prueba que quedaron
   a medias en el sitio de pruebas se borraron igual que lo hace su propia limpieza (Stripe en modo prueba;
   ningún dinero real). En producción no pasa: allí Rewards no existe y las cuentas no se borran, se anonimizan.
2. **Prueba vieja del recorrido (no de Rewards):** desde la regla de un teléfono por cuenta (29 oct) el
   recorrido repetía los mismos números, y esperaba ver Carro «en construcción» cuando en pruebas todos
   los servicios están encendidos. Ahora usa teléfonos propios por corrida y elige un servicio que
   siga por venir según el estado real.

Después de los arreglos, la corrida completa salió en verde.

## Evidencia 3 · Casos límite y las dos correcciones

Correcciones (candado C-METRICAS-VENTANA):

1. **Ventana de estrellas:** antes se tomaban las últimas 100 y DESPUÉS se quitaban las que eran culpa
   del restaurante, así la ventana quedaba en 90. Ahora el filtro va dentro de la consulta, antes del
   límite: siempre son las últimas 100 que cuentan. Prueba: antes 90 notas, ahora 100 con promedio 4,6.
2. **Puntualidad:** un pedido sin hora de aceptación contaba como puntual. Ahora solo cuentan los que
   tienen las dos horas. Prueba: antes 50 % de 2, ahora 0 % de 1.

Casos límite cubiertos (condiciones A, B y C):

- 89, 90 y 91 % de finalización dan puntos distintos y continuos (sin precipicio).
- Repartidor excelente llega a Diamante; con 89 % de finalización la reputación no se hunde a cero y
  la elegibilidad queda aparte, «en riesgo» (A: reputación separada de permanencia).
- Nuevo con una sola mala nota: se mezcla con la referencia y no se hunde (A: muestras pequeñas).
- Ofertas excusadas no cuentan; sin ofertas, la aceptación no castiga (B: aceptación por oferta).
- Ruta Flex de 30 paquetes pesa 10; de 600 también; de 1 pesa 1. La ventana suma exactamente 100.
- Una ruta mala no domina: 90 pedidos perfectos y una ruta con 10 fallas propias da 0,9667 (B).
- Ruta con todo ausente y con prueba (denominador cero): no rompe ni castiga (B).
- Express: las cancelaciones del cliente no cuentan contra el conductor.
- Antifraude distinto por servicio (C): comida y Tiendas con tope de 3 por cliente y 50 % de clientes
  distintos; Express con 1 km mínimo y 40 %; Flex sin regla de clientes, con empresa verificada, no
  propia, ruta cerrada y tope de 30 paquetes por ruta.
- Histéresis: sube de inmediato; para bajar necesita 3 puntos por debajo y 7 días; si se recupera, el contador se borra.

## Evidencia 4 · Ejemplos de puntaje

| Servicio        | Escenario                                                               | Puntaje | Nivel                                                                       |
| --------------- | ----------------------------------------------------------------------- | ------- | --------------------------------------------------------------------------- |
| Comida          | 100 pedidos, 4 tarde, estrellas 5 y 4                                   | 94,1    | Diamante                                                                    |
| Express         | 40 viajes, 2 cancelados por el conductor, 3 por el cliente (no cuentan) | 84,6    | Oro (puntualidad y calidad usan la referencia: Express todavía no las mide) |
| Flex + comida   | Ruta de 30 con 2 ausentes con prueba y 1 falla propia, más comida       | 99,2    | Diamante (peso: Flex 10, comida 90)                                         |
| Real en pruebas | Repartidor demo, 1 entrega de Tiendas                                   | 77,6    | Oro, provisional                                                            |

## Evidencia 5 · El modo sombra no afecta la operación

- Interruptor en código: solo corre si el reloj llama al sitio de pruebas. En producción, en local
  o sin entorno, `apagado`, aunque la variable diga otra cosa (prueba).
- La prueba toma una foto de puntos, destacado, billetera, saldo prepago, ofertas, pedidos y rutas
  antes y después de correr: quedan idénticos.
- No toca el despacho, ni los niveles visibles, ni el saldo prepago, ni ningún pago.
- Las rutas de consulta no existen en producción (404) y en pruebas solo las ve un admin (un repartidor recibe 403).
- Premios: ningún estado llega a «pagado». Sin presupuesto reservado el hito queda «sin_presupuesto»
  (no es obligación). Diez llamadas a la vez dejan una fila, una reserva y un evento. El tope del mes no se pasa (D).

## Evidencia 6 · Procedimiento de reversa (probado)

1. **Apagar:** poner `REWARDS_MODO=apagado` en las variables del sitio de pruebas y republicar. El reloj deja de calcular.
2. **Vaciar (opcional):** borrar las filas de las seis tablas nuevas. Nada operativo depende de ellas.
3. **Volver el código:** el sitio de pruebas vuelve a `main` con cualquier publicación de `main`;
   las tablas nuevas quedan vacías e inofensivas.

La prueba «apagar el interruptor detiene todo; vaciar las tablas nuevas no cambia nada de lo operativo»
lo comprueba: con el interruptor apagado no se escribe nada y, tras vaciar las tablas, la foto operativa es idéntica.

## Evidencia 7 · Decisiones pendientes para la Fase 3

**Decisión de producto ya tomada por Richard (30 oct 2026), para las fases siguientes:** los premios
serán VARIABLES, calculados como un porcentaje configurable del margen de contribución real de las
entregas elegibles. No habrá montos fijos. Se desbloquean por hitos, con condiciones transparentes.
No cambia el motor actual: el hito de 30 USD de la Fase 2 es solo una hipótesis para probar estados.

Lo que falta decidir o construir antes de la Fase 3:

1. El porcentaje del margen de contribución y el presupuesto por ciudad (decisión de Richard).
2. Revisión de un abogado: términos del programa, clasificación contable y fiscal del premio.
3. Umbrales finales calibrados con datos reales (hoy 63 / 77 / 85, hipótesis).
4. Cómo se marca un reclamo como «queja verificada» en soporte (hoy se lee `verificada` y `gravedad`).
5. Que Express mida puntualidad y calidad propias (hoy usa la referencia).
6. Reglas finas para excusar ofertas (distancia y pago).
7. Lectura completa del registro de retiros de ruta de Flex.
8. Pantallas para el repartidor y el flujo de apelaciones (la tabla ya existe, sin uso).
9. Aviso operativo: cuando `main` se publique de nuevo, el sitio de pruebas vuelve al código de
   `main` y el modo sombra deja de correr hasta fusionar esta rama.

Problemas reales pendientes: ninguno.
