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

## Ensayo general hecho por la IA en local (12 oct 2026)

El recorrido completo funcionó en la computadora con los tres papeles. Lo que apareció y ya está arreglado: la app y el panel se pisaban la sesión en el mismo navegador, pantallas sin sesión, la web sin mapa, Enter que no entraba. Detalle en `CANDADOS.md` (C-SESION-APP).

**Consejo para el día de la prueba:** cada papel en su propio teléfono si se puede. Si hay que usar uno solo, ya no se pisan, pero es más fácil seguir el recorrido con un teléfono por papel.

## Restaurantes de prueba en Novi (creados el 12 oct 2026, pedido por Richard)

En la zona «Novi (pruebas)», aprobados y abiertos, con platos de 1 a 3 dólares. Sus dueños son cuentas sin contraseña (nadie entra con ellas; se manejan desde el superadmin):

- Pizzería Novi (prueba) — 43155 Main St, Novi, MI 48375
- Tacos Twelve Oaks (prueba) — 27500 Novi Rd, Novi, MI 48377
- Burger Town Center (prueba) — 26132 Ingersol Dr, Novi, MI 48375
- Café Fountain Walk (prueba) — 44175 W 12 Mile Rd, Novi, MI 48377

Antes del lanzamiento abierto se pausan o se borran desde el superadmin (decisión de Richard).
