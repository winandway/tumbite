# Divoox Rewards · Fase 2 · Diseño técnico (30 oct 2026) — todos los países

Rama `rewards-diseno`. **Nada de esto está en producción** ni cambia el despacho, el dinero o lo que ve el
repartidor. Simulaciones reproducibles en `scripts/rewards/` (datos sintéticos; no tocan la base).

## 0. Las dos correcciones (hechas en la rama, con prueba en rojo)

`apps/servidor/src/rutas/metricasVentana.test.ts` (C-METRICAS-VENTANA):

| Defecto                                                                                 | Reproducción (antes)                                                                  | Corrección                                                                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Las notas que fueron culpa del restaurante se quitaban después de tomar las últimas 100 | 100 notas nuevas con 10 excluidas y 10 viejas válidas: el promedio usaba **90 notas** | El filtro va dentro de la consulta, antes del límite: **100 notas válidas**, promedio 4,6 |
| Pedido sin hora de aceptación o de entrega contaba como puntual                         | 1 tarde + 1 sin hora: **50 %** sobre 2                                                | Queda fuera de la cuenta: **0 %** sobre 1                                                 |

Las 856 pruebas del servidor pasan. Efecto en producción cuando se publique: algunos repartidores verán
su promedio y su puntualidad cambiar un poco (más exactos). Se publica solo con autorización.

## A. Escalas del puntaje (`simular_puntaje.py`)

Fórmula candidata 30 / 25 / 20 / 15 / 10. Población sintética de 4.000 repartidores, ventanas de 100.

**Hallazgo principal: la escala lineal de finalización (90 % = 0, 100 % = 30) es injusta.** Hay un
precipicio en 90 %: a 89 % y a 90 % se tienen 0 puntos, y cada abandono vale 3. Un repartidor con 96 %
real varía ±6 puntos solo por azar.

**Recomendación: escala suave por tramos** — 85 % = 0, 90 % = 12, 95 % = 24, 100 % = 30.

| Finalización | Lineal (puntos) | Suave (puntos) |
| ------------ | --------------- | -------------- |
| 88 %         | 0               | 7,2            |
| 90 %         | 0               | 12             |
| 93 %         | 9               | 19,2           |
| 95 %         | 15              | 24             |
| 99 %         | 27              | 28,8           |

- Ruido con 96 % real: lineal ±6,0 puntos; **suave ±3,3** (la mitad).
- El mínimo de 90 % para seguir activo no cambia; solo cambia cuánto pesa en el puntaje.

**Umbrales.** Con las escalas fijadas, los umbrales que dan la distribución objetivo (15 / 45 / 30 / 10)
salen **63 / 77 / 85**. Con 60 / 75 / 90 solo el 2 % llega a Diamante. Un repartidor excelente típico
(100 % finalización, 97 % puntual, sin incidentes, 4,9, 80 % aceptación) saca **95,9**: Diamante es
alcanzable con trabajo excelente. Los umbrales definitivos se recalculan con datos reales (Fase 3).

**Estabilidad.** Entre dos ventanas de 100 independientes cambia de nivel el 34–38 % (mucho ruido); con
3 puntos de margen para bajar, 29 %. En la práctica la ventana es móvil (cambia de a una entrega) y el
cambio diario es mucho menor, pero confirma que hace falta la gracia de 7 días y el margen.

## B. Fórmula de Flex sin distorsionar las últimas 100

Cada servicio aporta **unidades** a una sola ventana de reputación con peso:

- Comida, Tiendas, Express: cada pedido o viaje es una unidad de peso 1.
- Ruta Flex r con n paquetes asignados: una unidad de peso **wᵣ = min(10, max(1, n / 3))**
  (30 paquetes pesan 10; 6 pesan 2).

La ventana toma las unidades más nuevas hasta sumar peso 100; la última entra con el peso que falte.
Cada medida M es el promedio ponderado: **M = Σ wᵢ·mᵢ / Σ wᵢ**.

Valores de una ruta:

- Finalización: **fᵣ = Eᵣ / (n − Xᵣ)**. E son los paquetes entregados. X son las fallas excusadas:
  destinatario ausente, dirección incorrecta o acceso imposible, **con evidencia** (foto, GPS a menos de
  150 m y llamada intentada; las tablas `flex_incidencias` y `flex_pruebas` ya lo guardan). Un paquete
  excusado y devuelto al centro no resta.
- Puntualidad: paradas entregadas dentro de su ventana entre las paradas medibles.
- Calidad: tasa de incidentes verificados por paquete, (menores + 3·mayores) / n, llevada a la escala de
  20 puntos.
- Aceptación: la oferta de la ruta es **una oferta de peso 1** (rechazar una ruta grande no pesa 10).
- Estrellas: Flex no las tiene; esa medida se calcula solo con las unidades que sí tienen.
- Experiencia: 1 por paquete entregado, en su propio contador por servicio.

Ejemplo: 90 pedidos de comida y una ruta de 30 paquetes con 27 entregados, 2 ausentes con evidencia y 1
falla propia. La ruta entra con peso 10 y finalización 27 / 28 = 96,4 %. Una sola ruta no puede ser más
del 10 % de la ventana.

## C. Presupuesto del primer premio (30 USD a las 100 entregas en 60 días) — `presupuesto_primer_hito.py`

| Ciudad              | Nuevos al mes | Llegan a 100 (25 / 40 / 55 %) | Costo mensual             |
| ------------------- | ------------- | ----------------------------- | ------------------------- |
| Lanzamiento (Miami) | 40            | 10 / 16 / 22                  | 300 / 480 / 660 USD       |
| Crecimiento         | 150           | 38 / 60 / 83                  | 1.125 / 1.800 / 2.475 USD |
| Escala              | 600           | 150 / 240 / 330               | 4.500 / 7.200 / 9.900 USD |

Esas primeras 100 entregas dejan 114 a 264 USD de contribución por repartidor: el premio es el 11–26 %
de lo que generan, como costo de captación. **Topes:** un presupuesto mensual por ciudad (propuesta para
Miami: 600 USD); cuando se agota, el premio queda en espera para el mes siguiente y se avisa antes.

Prevención de abuso:

- Solo cuentan pedidos pagados, entregados y sin reclamo aprobado en 14 días.
- Al menos 60 clientes distintos entre las 100; máximo 3 pedidos del mismo cliente.
- El cliente no puede ser el propio repartidor (identidad, tarjeta, teléfono o dispositivo compartidos).
- Una vez por persona verificada (KYC), no por cuenta.
- Dentro de los primeros 60 días desde la activación.

## D. Despacho con y sin ventaja de nivel — `simular_despacho.py`

Ciudad sintética de 12 × 12 km, 60 repartidores (12 Inicial, 27 Plata, 15 Oro, 6 Diamante), 30 corridas.

**Pocos pedidos para muchos repartidores** (0,75 pedidos por minuto):

| Política             | Entrega  | Km extra a la recogida | Pedidos Inicial / Diamante | USD por hora Inicial / Diamante | Desigualdad (Gini) |
| -------------------- | -------- | ---------------------- | -------------------------- | ------------------------------- | ------------------ |
| A sin ventaja        | 19,4 min | 0,49                   | 3,1 / 3,1                  | 5,57 / 5,54                     | 0,352              |
| B segundos 20/45/75  | 19,4 min | 0,58                   | 2,6 / 3,8                  | 4,58 / 6,86                     | 0,345              |
| C = B + cupo 15 %    | 19,4 min | 0,59                   | 2,8 / 3,6                  | 4,92 / 6,57                     | 0,348              |
| D prioridad estricta | 19,3 min | **1,73**               | **0,0** / 9,1              | **0,01** / 19,63                | **0,600**          |

**Mucha demanda** (2,2 pedidos por minuto): A, B y C quedan casi iguales (19,7–19,8 min; Diamante gana
5 a 9 % más por hora que Inicial). D vuelve a castigar a Inicial (11,60 contra 25,04 USD por hora) y
triplica los km extra.

Conclusiones:

- La prioridad estricta crea el círculo cerrado: Inicial no recibe pedidos y se recorre 3,5 veces más
  en vacío. Descartada.
- La ventaja en segundos da una diferencia real y moderada (Diamante +23 % por hora cuando sobran
  repartidores), sin empeorar la entrega y con +0,09 km a la recogida.
- El cupo del 15 % devuelve a Inicial parte de lo perdido (+7 %) casi sin costo.
- La entrega no cambia porque la cocina (12 min) tapa la diferencia de recogida. En la ciudad real se
  mide con zonas de prueba y zonas de control (Fase 4).
- Límite: datos sintéticos, aceptación al azar entre 62 y 87 %.

## E. Alternativa al vencimiento automático de premios pendientes

Cuatro estados, cada uno con su significado contable:

1. **Progreso.** Contador hacia el hito. No es dinero ni promesa.
2. **Condicionado** («por desbloquear»). Hito alcanzado, pero falta el nivel requerido. **No vence por
   fecha.** Se desbloquea cuando el repartidor alcanza el nivel en cualquier momento posterior. Solo se
   cancela por fraude o seguridad probados, por baja voluntaria de la cuenta, o si el programa termina
   con aviso previo (las condiciones se fijan al publicar el programa). Con 180 días de inactividad se
   archiva y vuelve al regresar. Contablemente es un pasivo contingente: no se registra como deuda; se
   provisiona según la tasa histórica de desbloqueo.
3. **Ganado.** Condiciones cumplidas. Es deuda con el repartidor. Retención de 14 días para reclamos de
   esas entregas.
4. **Pagado.** A la billetera, con el concepto `regalo` (ya existe y no se usa) y una referencia única
   `rewards:<programa>:<hito>:<repartidor>`. El índice único de la billetera impide el doble pago. Solo se
   revierte por fraude probado.

Separación contable:

- El prepago del conductor (`libro`, no se retira) nunca recibe premios.
- Las ganancias por entregas (`venta`, `entrega`, `propina`) y los premios (`regalo`) van en
  `movimientos` con conceptos distintos.
- Los estados 1 a 3 viven en su propia tabla.

## Arquitectura de la Fase 2 (modo sombra)

- Interruptor por país `REWARDS_MODO`: apagado, sombra o activo. Fase 2 solo usa sombra en staging.
- **Tablas nuevas** (todas con `CREATE IF NOT EXISTS`, sin tocar las existentes):
  - `reputacion_diaria`: repartidor, fecha, puntaje, componentes, nivel calculado y versión de la fórmula.
  - `reputacion_exclusiones`: unidad, motivo, evidencia y regla.
  - `apelaciones_repartidor`: unidad, motivo, estado, quién resolvió y cuándo.
  - `rewards_hitos`: repartidor, programa, hito, estado y monto, con clave única.
- **Pieza pura `reputacion.ts`** en compartido: escalas, unidades ponderadas, encogimiento de estrellas
  e histéresis. Probada con casos de borde: 89, 90 y 91 %; ventana con menos de 100 unidades; ruta de 30
  paquetes.
- **Experiencia:** se lee de la columna `puntos` actual y de los conteos por servicio. No se borra nada.
- **Tarea del reloj `reputacion_sombra`:** calcula y guarda una vez al día. No la lee ni el despacho ni
  las pantallas.
- **Reversión:** apagar el interruptor. Las tablas nuevas se ignoran, el despacho y las pantallas no
  cambiaron, y la columna `puntos`, el destacado y la billetera siguen intactos.

## Decisiones que necesitan aprobación

1. Escala suave de finalización (85 / 90 / 95 / 100) en lugar de la lineal.
2. Umbrales iniciales 63 / 77 / 85, que se recalculan con datos reales antes de activar.
3. Peso de la ruta Flex: min(10, n / 3); una ruta pesa como máximo el 10 % de la ventana.
4. Ventaja en segundos 20 / 45 / 75 y cupo del 15 %, a validar con zonas de prueba.
5. Presupuesto mensual del primer premio por ciudad (Miami: 600 USD) y sus reglas contra el abuso.
6. Premios condicionados sin vencimiento por fecha (estados 1 a 4).
7. Construir la Fase 2 en modo sombra solo en staging.
