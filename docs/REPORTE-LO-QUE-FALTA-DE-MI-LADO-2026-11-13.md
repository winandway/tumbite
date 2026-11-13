# Lo que falta del lado de la IA — 13 de noviembre de 2026

Pedido por Richard: un reporte serio, sin adornos, de lo que falta del lado de la IA para probar
la parte de comida con un cliente interesado. Apple queda aparte (está en revisión).

**Respuesta corta: no, mi lado no está al cien por ciento.** Esta es la lista completa.

## A. Lo que falta para probar comida con el cliente

| #   | Qué falta                                                                                                                    | Estado real                                                                                                                                                                                                                                                                             | Quién                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| 1   | **Simulador de compras y entregas** (clientes, restaurantes y repartidores falsos que hacen el pedido completo, con reporte) | En construcción desde hoy. Lo que entregué el 11 de noviembre fue una máquina que prueba el dinero, no lo que se pidió. Sí existía un recorrido automático de un pedido por las tres apps web en cada publicación, pero es un solo camino feliz y no deja un reporte que se pueda leer. | IA                                   |
| 2   | **Revisión de calidad de los nueve arreglos de la calle**                                                                    | Nunca se corrió. Los nueve arreglos están publicados con su prueba cada uno, pero el repaso de un segundo revisor está pendiente.                                                                                                                                                       | IA                                   |
| 3   | **Ubicación del repartidor con la pantalla apagada**                                                                         | No está construida. Esperaba a que Google aprobara; Google aprobó el 11 de noviembre, así que ya no hay excusa. Hoy el repartidor tiene que llevar la app abierta.                                                                                                                      | IA                                   |
| 4   | **Lo que ninguna prueba automática cubre**                                                                                   | Escanear el código con la cámara, que el aviso llegue al celular y suene, y el mapa en un Android real. Solo se han visto en la prueba de la calle. El simulador no lo va a cubrir en su primera versión (corre sobre el servidor y las apps web).                                      | IA, después del simulador            |
| 5   | **El reloj de producción está atrasado**                                                                                     | El canario de producción lo dice hoy. De ese reloj cuelgan cancelar pedidos abandonados y el cobro al entregar. El arreglo de raíz es el reloj de Cloudflare, que ya está construido y espera un sí. Con un cliente real esto no puede quedar así.                                      | Richard dice sí; IA lo enciende      |
| 6   | **Pagos con dinero real: NO probados**                                                                                       | El circuito está probado de punta a punta solo en modo de prueba. No se debe anunciar ni mandar clientes a pagar con tarjeta hasta hacer la compra real de un dólar.                                                                                                                    | Richard hace la compra; IA la revisa |
| 7   | **La web pública no refleja los cambios del 11 de noviembre**                                                                | Solo se actualizaron las guías de Docs.                                                                                                                                                                                                                                                 | IA                                   |
| 8   | **Cada vuelta de pruebas lee casi seiscientas mil filas**                                                                    | Medido, sin arreglar. No rompe nada, pero es gasto.                                                                                                                                                                                                                                     | IA                                   |
| 9   | **Correo de contacto de las fichas de Google Play**                                                                          | Esperaba la aprobación; ya se puede cambiar.                                                                                                                                                                                                                                            | IA                                   |

## B. Lo que falta para arrancar en Venezuela

| #   | Qué falta                                                         | Estado real                                                                                                                                                                                                                               | Quién                           |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 10  | **App instalable desde el navegador** (para iPhone sin tienda)    | Hecha hoy para las tres apps; en publicación. Límites: instalada así no recibe avisos al celular ni manda ubicación con la pantalla apagada, y el código de recogida se escribe en vez de escanearse. Falta su guía en Docs con capturas. | IA                              |
| 11  | **Avisos al celular en la versión instalada desde el navegador**  | No construido. Sin esto, un restaurante o repartidor con iPhone no se entera de un pedido si no tiene la app abierta.                                                                                                                     | IA                              |
| 12  | **Tarifas en moneda local**                                       | El formato de la moneda está listo; las tarifas por país no están construidas (según la lista de pendientes; no lo volví a comprobar hoy).                                                                                                | IA, con las tarifas del mercado |
| 13  | **Formas de pago de Venezuela**                                   | Existe pagar al recibir y la transferencia que el restaurante verifica a mano. No hay conexión automática con pago móvil (necesita contrato con un proveedor). Nada de esto se ha probado en la calle.                                    | Contrato: Richard; resto: IA    |
| 14  | **Comisión descontada del saldo prepago del conductor en comida** | A medias según la lista de pendientes: falta unificar comida con la capa común. No lo volví a comprobar hoy.                                                                                                                              | IA                              |

## C. Lo que sí quedó terminado y comprobado

- Las tres apps en Google Play con la versión nueva (aprobadas el 11 de noviembre), con íconos y gráficos distintos por app.
- Los nueve fallos de la prueba en la calle, corregidos y publicados, cada uno con su prueba.
- Las guías públicas en español e inglés al día con esos cambios.
- El circuito de dinero en modo de prueba, probado cada día y conciliado contra Stripe.
- Tope de gasto de la base del sitio de pruebas.

## Orden en que lo voy a cerrar

1. Simulador (1), corriendo cada día, y arreglar lo que encuentre.
2. Revisión de calidad (2).
3. Ubicación con la pantalla apagada (3) y avisos en la versión del navegador (11).
4. Venezuela: tarifas en moneda local (12) y comisión prepago en comida (14).
5. Web pública (7), correo de las fichas (9) y lecturas (8).
