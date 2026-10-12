# Plan de prueba en la calle (dictado por Richard, 12 oct 2026)

## Lo que salió mal en la primera prueba (11–12 oct) y no se repite

1. **Se probó a medias:** se pagaron 7,18 dólares y no se probó al repartidor. Toda prueba con dinero real prueba el circuito completo: cliente, restaurante y repartidor.
2. **Después de pagar, la persona no volvió a su pedido:** quedó en la página de «Pago recibido» y tuvo que ir hacia atrás a mano. Arreglado: el botón «Ver mi pedido» (12 oct). Con el pago sin salto ya ni siquiera se sale de la app.
3. **No había cuentas preparadas antes de empezar:** se crearon sobre la marcha. Antes de la prueba quedan las tres cuentas creadas y probadas.
4. **El restaurante quedó en una zona que no correspondía** (Miami con dirección de Michigan): se creó la zona de pruebas «Novi».
5. **El navegador del teléfono invertía colores** (modo oscuro forzado y traductor de Google): se prueba en Safari normal; la web ya fuerza modo claro.

## La segunda prueba, en orden

- **Antes (la IA):** zona de pruebas Novi activa; restaurante aprobado y abierto con un plato de un dólar; pago sin salto en la app; correo, avisos y canario en verde. Revisar `/datos/salud`.
- **Cuentas (Richard, una vez):** cliente (`tumbite.com+cliente@gmail.com`), restaurante (`tumbite.com+restaurante@gmail.com`), repartidor (`tumbite.com+repartidor@gmail.com`, en la app web del repartidor, `https://tumbite.com/repartidor/`, abierta en Safari).
- **Dirección real a unas tres cuadras** del restaurante, marcada en el mapa, para probar mapa y tiempo estimado.
- **El recorrido:** el cliente pide y paga dentro de la app → suena la alarma del restaurante y lo acepta → «¡Listo!» → al repartidor le llega la oferta → la acepta, va al restaurante, «Recogido» → recorrido en bicicleta las tres cuadras con la ubicación encendida → el cliente lo ve acercarse en el mapa → «Entregado» → el dinero aparece en las billeteras del restaurante y del repartidor → el cliente califica.
- **Qué se anota:** cada paso con hora y captura; cualquier cosa rara va a esta lista como fallo y se arregla antes de la siguiente prueba.
