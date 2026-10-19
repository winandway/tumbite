# Informe de la Fase 2 — estado real al 18 de octubre de 2026 (noche)

Este informe reemplaza al de la tarde. Cada pieza lleva **uno** de estos estados, sin mezclarlos:

| Estado                         | Qué significa                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Implementado**               | El código existe en el repositorio.                                                                                                             |
| **Probado localmente**         | Pasa sus pruebas automáticas (con la prueba en rojo comprobada) y, si es visible, el recorrido en esta computadora.                             |
| **Aprobado en staging**        | Pasó la batería completa en el sitio de pruebas: pruebas S, tiempo real, recorrido en inglés y español con Stripe en modo prueba, conciliación. |
| **Publicado**                  | Está en tumbite.com, con control «antes», etiqueta de restauración y verificación «después».                                                    |
| **Probado con operación real** | Se hizo una operación con dinero real autorizada por Richard y está fechada en `VERIFICAR-PAGOS.md`.                                            |
| **Bloqueado**                  | No puede avanzar sin una cuenta, un contrato, una decisión o una validación profesional; se dice cuál.                                          |

Documentos de respaldo: la reconciliación punto por punto (`docs/RECONCILIACION-FASE-2.md`), Stripe por producto y BCV (`docs/investigaciones-rea/2026-10-18-stripe-por-producto-y-bcv.md`), el piloto por país (`docs/PILOTO-POR-PAIS.md`), las decisiones de Richard (`docs/DECISIONES-RICHARD-FASE-2.md`) y el estado de cada cobro (`VERIFICAR-PAGOS.md`).

**Nada de la Fase 2 está «probado con operación real».** La Fase 2 **no está terminada**: quedan requisitos de lanzamiento abiertos (sección 5).

## 1. Bloques C y D: qué pasó con la publicación

- La tarde del 18 el informe anterior decía «aprobados en staging y camino a producción». **No era cierto todavía:** el recorrido de staging falló tres veces seguidas en el mismo paso (la app del cliente no alcanzaba a confirmar la sesión al recargar).
- **Causa real:** cada arranque del servidor revisaba las columnas de la base con 40 consultas seguidas; el primer arranque tardaba más que los 8 segundos que la app espera. Se arregló con un solo lote (candado C-ARRANQUE-RAPIDO, prueba en rojo comprobada). En staging, la sesión pasó de 2 segundos (o colgarse) a 0,2 segundos.
- Después, el recorrido pasó completo en inglés y falló en español por una carrera de la propia prueba (salía de la pantalla antes de que el servidor guardara el favorito); se corrigió la prueba.
- Con los dos arreglos, la batería completa de staging salió en verde el 18 oct a las 18:44 (hora de Miami) sobre la versión 6a2228c5: pruebas S, tiempo real, recorrido en inglés y español con Stripe en modo prueba (incluido el pedido en efectivo hasta la compra en el local y la cancelación por soporte de un pedido aceptado) y conciliación.

- **Publicado el 18 oct por la noche** con el flujo permanente: control «antes» en verde, etiqueta de restauración `restauracion-2026-10-18-bloque-c` (apunta a la versión anterior, b7031f4c), publicación de 748bffe0 y verificación «después» en verde. El canario quedó sano y el cobro en mano sigue apagado en producción (Estados Unidos sin efectivo ni transferencia).

## 2. Estado por pieza

| Pieza                                                                                                                                                                                          | Implementado | Probado localmente                  | Aprobado en staging     | Publicado                                   | Operación real                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------- | ----------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| Bloque A: dinero y controles de EE. UU. (F6, F7, F8, F10 en código, PIN, intentos, canario, Turnstile en código, versión mínima, devoluciones, disputas, impuesto apagado)                     | Sí           | Sí                                  | Sí                      | Sí (b7031f4c)                               | No                                                             |
| Bloque B: libro, prepago, cobro directo, recargas, cuentas de cobro, países                                                                                                                    | Sí           | Sí                                  | Sí                      | Sí (b7031f4c), **apagado por país**         | No                                                             |
| Bloque C: pantallas (pago al recibir, favoritos, direcciones, cupones, queja guiada, reseñas, festivos, equipo, orden del menú, GPS de fondo, edad)                                            | Sí           | Sí                                  | Sí (6a2228c5, 18 oct)   | Sí (748bffe0, 18 oct)                       | No                                                             |
| Bloque D: operación (aviso de verificaciones, salud en el panel, restaurar respaldos en pruebas, web honesta)                                                                                  | Sí           | Sí                                  | Sí (6a2228c5, 18 oct)   | Sí (748bffe0, 18 oct)                       | —                                                              |
| Arranque rápido (C-ARRANQUE-RAPIDO)                                                                                                                                                            | Sí           | Sí                                  | Sí (sesión en 0,2 s)    | Sí (748bffe0, 18 oct)                       | —                                                              |
| Recorrido internacional: pago de la comida en el local, ticket, diferencias, transferencia por verificar, excedente, pérdida de comida comprada, devolución sin Stripe (C-COBRO-DIRECTO-LOCAL) | Sí           | Sí, con recorrido local en pantalla | Sí (6a2228c5, 18 oct)   | Sí (748bffe0, 18 oct), **apagado por país** | No                                                             |
| F9: llamada con número oculto (método del puente)                                                                                                                                              | Sí           | Sí                                  | Sí (6a2228c5, 18 oct)   | Sí (748bffe0, 18 oct)                       | No: falta la cuenta de Twilio                                  |
| F18: notas por culpa del restaurante y términos del nivel                                                                                                                                      | Sí           | Sí                                  | Sí (6a2228c5, 18 oct)   | Sí (748bffe0, 18 oct)                       | —                                                              |
| Pagos con tarjeta en EE. UU. (Stripe)                                                                                                                                                          | Sí           | Sí                                  | Sí, en cada publicación | Sí                                          | **No**: falta la compra real de un dólar y una devolución real |

## 2b. Ronda del 19 de octubre (versión 5944bc25)

| Pieza                                                                      | Implementado | Probado localmente                          | Aprobado en staging                                                             | Publicado             | Operación real                          |
| -------------------------------------------------------------------------- | ------------ | ------------------------------------------- | ------------------------------------------------------------------------------- | --------------------- | --------------------------------------- |
| Ruta interna para consultar y crear los avisos de Stripe (C-STRIPE-AVISOS) | Sí           | Sí                                          | Sí (consultada en staging: falta el aviso de cuentas conectadas en modo prueba) | Sí (f6da2d18, 19 oct) | —                                       |
| Foto del ticket del restaurante (C-FOTO-TICKET)                            | Sí           | Sí, botón visto en pantalla en el recorrido | Sí                                                                              | Sí (f6da2d18, 19 oct) | No                                      |
| Formato de montos por moneda (C-MONEDA-LOCAL)                              | Sí           | Sí                                          | Sí                                                                              | Sí (f6da2d18, 19 oct) | — (se conecta con las tarifas por país) |
| Pruebas propias de los puntos 27 y 33                                      | Sí           | Sí                                          | Sí                                                                              | Sí (f6da2d18, 19 oct) | —                                       |
| Rotación de la clave expuesta del cliente de pruebas                       | Hecha        | Comprobada: la vieja da 401 y la nueva 200  | —                                                                               | —                     | —                                       |

**Hallazgo del 19 oct:** la cuenta de Stripe de producción de Tumbite es la de Windoce LLC y está **compartida con otros negocios de Windoce** (tiene avisos de otros sitios). Consecuencias: cualquier riesgo de esa cuenta (disputas, sanciones si se cobrara a Venezuela) afecta a todos los negocios; y el aviso de cuentas conectadas de Tumbite se crea en esa misma cuenta, apuntando solo a tumbite.com. La consulta interna se limitó a los avisos de Tumbite. Recomendación: cuenta de Stripe propia para Tumbite antes de operar fuera de EE. UU. (decisión de Richard).

**Estado del segundo aviso (cuentas conectadas), comprobado por la ruta interna:** no existe ni en modo prueba (staging) ni en modo real (producción). El aviso principal de producción no lleva los eventos de cuentas conectadas. Crearlo es un paso de un minuto con la ruta, en cuanto Richard lo autorice.

## 3. El recorrido internacional aprobado, paso por paso

| Paso aprobado por Richard                                                                                      | Dónde está                                                                                                                                   | Estado                                         |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1. El repartidor aporta su capital de trabajo                                                                  | La app lo dice al pagar en el local («Tumbite no presta ni pone este dinero»). No hay crédito ni saldo negativo.                             | Implementado y probado localmente              |
| 2. Paga la comida al recoger, en efectivo o con su tarjeta                                                     | «Paga la comida en el restaurante»: monto, método, lo que pagó; sin ese registro el pedido no sale                                           | Implementado, probado localmente y en pantalla |
| 3. Recibe el ticket y lo entrega con el pedido                                                                 | Se anota el total del ticket; la app y el restaurante le recuerdan entregarlo. **No hay foto del ticket todavía** (solo el monto).           | Implementado (sin foto)                        |
| 4. El cliente paga al recibir, en efectivo o por transferencia a una cuenta propia y verificada del repartidor | Pago al recibir en el carrito; la cuenta que ve el cliente es la vigente (cambios con contraseña, 24 h o confirmación del equipo)            | Implementado y probado                         |
| 5. La app muestra el importe exacto, los conceptos y el beneficiario                                           | Recibo con comida, envío, servicio y propina; monto sin propina; nombre del titular y cuenta                                                 | Implementado y probado                         |
| 6. El repartidor confirma la recepción                                                                         | «Cobré» con el monto; queda como **confirmación manual del repartidor** con quién, cuánto y cuándo. No hay verificación bancaria automática. | Implementado y probado                         |
| 7. Tumbite cobra la comisión del saldo prepago                                                                 | Se aparta al aceptar y se cobra al conciliar, una sola vez (reintentos sin doble comisión)                                                   | Implementado y probado                         |
| 8. Pedido, cobro y conciliación con estados y evidencias separados                                             | Tres estados en el pedido + libro por pedido + bitácora                                                                                      | Implementado y probado                         |

Casos límite probados (pruebas automáticas): saldo insuficiente y reservas simultáneas; cancelación antes y después de comprar la comida; cliente que no paga; transferencia pendiente, que nunca llegó (o fue a otra cuenta) y duplicada; propina en mano que no cuenta como excedente; ticket e importe distintos; devolución en un pedido pagado en mano (sin tocar Stripe); reintentos sin doble comisión ni doble registro.

**Límite conocido:** las apps muestran los montos con formato de dólares; antes de un piloto en Colombia o Venezuela hay que mostrar la moneda local.

## 4. Conclusiones corregidas sobre pagos

- **Estados Unidos:** el circuito con tarjeta existe, pasa en staging y está publicado, pero **no está probado comercialmente**: falta la compra real de un dólar y una devolución real. No se rediseñó para Latinoamérica.
- **Stripe, producto por producto:**

| Producto (cuenta de Stripe de EE. UU.)              | Colombia                                                                                                           | Venezuela                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Cobrar tarjetas del país                            | Sí, como internacionales, también en pesos (sin American Express)                                                  | Con restricciones: en dólares, filtro de sanciones, tarjetas con cupo limitado |
| Métodos locales (PSE, Nequi, Daviplata, pago móvil) | No                                                                                                                 | No                                                                             |
| Recargas del saldo para comisiones                  | Posible como cobro normal si el saldo solo paga comisiones de Tumbite y nunca se devuelve en dinero; falta abogado | Igual; la norma del BCV excluye los prepagos de servicios; falta abogado       |
| Cuentas conectadas                                  | Solo «recibir», sin pagos entre países en autoservicio                                                             | No                                                                             |
| Pagos a destinatarios                               | Global Payouts solo en vista previa; exige licencia de transmisor                                                  | No                                                                             |

- **Venezuela y el BCV:** la frase «solo el cobro directo es viable sin licencia del BCV» queda **pendiente de validación profesional**. La investigación la encontró demasiado estricta (también podrían caber la tarjeta internacional en dólares y el saldo para comisiones) y con fuentes incompletas. La validan un abogado venezolano y uno de sanciones de EE. UU.
- **Código preparado frente a configuración externa comprobada:**

| Pieza                                           | Código                  | Configuración externa                                                        |
| ----------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| Stripe (tarjeta, webhook principal)             | Listo                   | Comprobada en staging (modo prueba) y en producción (canario en verde)       |
| Stripe, segundo webhook (cuentas conectadas)    | Listo                   | **Pendiente**: hay que crearlo en Stripe (👤)                                |
| Turnstile                                       | Listo                   | **Pendiente**: faltan las dos llaves (👤)                                    |
| Avisos al celular                               | Listo                   | Configurado en el servidor; faltan Firebase y Expo para las apps reales (👤) |
| Tiempo real (Cloudflare)                        | Listo                   | Comprobado en staging; producción espera la aprobación de Richard            |
| Proveedores locales (Wompi, dLocal, pago móvil) | **No construido** (B.7) | Sin contrato                                                                 |
| Twilio (SMS y llamadas)                         | Listo                   | **Pendiente**: falta la cuenta (👤)                                          |

## 5. Lo que sigue abierto del alcance de la Fase 2

Requisitos de lanzamiento (MVP) que siguen abiertos, del más importante al menos (detalle y criterio de aceptación en la reconciliación):

1. Compra real de un dólar y devolución real en tumbite.com (👤).
2. Segundo webhook de Stripe y activación de pagos del restaurante probada en staging (👤).
3. Retiros: mínimo, frecuencia y encendido (👤 decisión).
4. Apple Pay y Google Pay: interruptores en Stripe y cuenta de Apple (👤).
5. Contraseñas expuestas en el historial (👤).
6. Cuentas de Expo, Apple, Firebase, Google Maps, Twilio y Checkr (👤).
7. GPS de fondo probado en un teléfono real (depende de Expo).
8. Prueba en la calle (👤) y tiempo real en producción (👤 aprobación).
9. Ciudades de la web desde el servidor (F17): la lista fija es intencional hasta que exista el interruptor público de lanzamiento por ciudad; depende de la decisión de lanzamiento.
10. Fichas de las tiendas (al final).
11. Pago móvil y pasarelas locales (B.7): sin contrato.
12. Montos en moneda local en las apps antes de cualquier piloto fuera de EE. UU.

Ampliaciones posteriores (puntos 36 a 67): ninguna terminada; once parciales y veintiuna pendientes, separadas del lanzamiento.

## 6. Decisiones que solo Richard puede tomar (las que cambian dinero o responsabilidad)

Están numeradas en `docs/DECISIONES-RICHARD-FASE-2.md`. Las nuevas de hoy: quién absorbe la comida comprada que no se entrega (20), plazo para devolver un excedente del cliente (21), plazo de una transferencia por verificar (22) y tolerancia del ticket (23). Siguen abiertas las de comisión por país, pago al repartidor por país, puntos de venta, tope de efectivo, tasa BCV, entidad por país y abogados.
