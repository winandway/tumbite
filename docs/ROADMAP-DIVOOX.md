# Roadmap de Divoox, en orden (29 oct 2026, noche; estado al 30 oct)

> Este es el plan maestro. Reemplaza el orden de `docs/ROADMAP.md`, del 11 de octubre, que queda como historia.
> La fábrica (`FILA.md`) sigue este orden de arriba abajo, sin saltarse etapas.
> Lo que solo puede hacer Richard va en `PENDIENTES.md` (los 👤) y nunca frena lo que la IA puede hacer.
> Toda función nueva arranca con REA de verdad y deja su ficha en `docs/investigaciones-rea/`.

## 1. En qué estado está cada servicio hoy

| Servicio        | Qué es                                  | Construido                                 | Sitio de pruebas | Producción (divoox.com)                              | Lo que falta                                                              |
| --------------- | --------------------------------------- | ------------------------------------------ | ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------- |
| **Comida**      | Pedidos a restaurantes                  | Sí, completo                               | Encendido        | **Encendido** (Miami todavía «muy pronto» en la web) | Lanzar: compra real de 1 dólar, prueba en la calle, tiendas de apps       |
| **Mercado**     | Supermercado                            | Sí (28 oct)                                | Encendido        | Apagado                                              | Compra de prueba hecha por Richard el 29 oct; falta el país para encender |
| **Farmacia**    | Productos de venta libre                | Sí (28 oct)                                | Encendido        | Apagado                                              | Igual que Mercado                                                         |
| **Licores**     | Mayores de 21, con verificación de edad | Sí (28 oct)                                | Encendido        | Apagado                                              | Igual que Mercado                                                         |
| **Moto**        | Viajes de pasajeros en moto             | Sí, completo (30 oct)                      | Encendido        | Apagado                                              | Solo lo de Richard: país, legal, seguro, tarifas                          |
| **Carro**       | Viajes de pasajeros en carro            | Sí, con XL (30 oct)                        | Encendido        | Apagado                                              | Solo lo de Richard: país, legal, seguro, tarifas                          |
| **Envíos**      | Paquetes de persona a persona           | Sí (30 oct), sobre el motor de viajes      | Encendido        | Apagado                                              | Solo lo de Richard: valor máximo, seguro del paquete y precio             |
| **Más**         | La puerta a todo lo demás               | Sí: todos los servicios en grupos (30 oct) | Encendido        | Apagado                                              | Nada                                                                      |
| **Divoox Flex** | Logística de paquetes para empresas     | Sí (fases 1 a 6)                           | Encendido        | **Encendido** (recargas apagadas)                    | Nada con dinero real probado                                              |

## 2. El orden

Cada etapa se cierra antes de abrir la siguiente. Dentro de cada etapa, primero lo que toca dinero y
clientes, después lo que destranca, después el resto.

### Etapa 1 — Comida lista para lanzar en Miami

1. 🤖 Comprobar en producción el embudo de pedidos de los informes.
2. 🤖 Repaso en el celular de todas las pantallas de las tres apps y del panel, en el sitio de pruebas,
   buscando fallos. Se usa REA sobre nuestras propias apps. Cada fallo lleva su prueba en rojo y su arreglo.
3. 👤 Compra real de 1 dólar (`docs/PRUEBA-REAL-1-DOLAR.md`), prueba en la calle, cuenta de Apple,
   sesión de administrador para Google Play, Twilio, Checkr, abogado y contador.
4. 👤 Encender Miami en la web cuando todo lo anterior esté en verde.

### Etapa 1½ — Identidad de los repartidores (urgente, pedido de Richard el 29 oct)

- 🤖 Ficha REA de verificación de identidad (documento, selfie, caras repetidas) y de la ley de datos biométricos.
- 🤖 Foto de perfil real, aprobada contra el documento por un verificador y bloqueada después.
- 🤖 Correo y teléfono únicos de verdad, también frente a cuentas cerradas.
- 🤖 Lista de personas bloqueadas por mala conducta, comparada al registrarse.
- 🤖 Comparación de caras con IA detrás de un interruptor; 👤 Richard aprueba el proveedor, el costo y el consentimiento legal.

### Etapa 2 — Tiendas: Mercado, Farmacia y Licores

5. 🤖 Ficha REA comparando con DoorDash, Instacart y Uber Eats, con su documentación pública y su web
   vista como visitante: qué nos falta del ciclo completo (comprador que reemplaza en vivo con foto,
   chat de reemplazos, horarios por tienda, límites de licores por estado).
6. 🤖 Construir lo que la ficha diga que falta, solo en el sitio de pruebas.
7. 👤 Elegir el país para encender (la compra de prueba con la tarjeta de prueba ya la hizo Richard el 29 oct).

### Etapa 3 — Moto

8. 🤖 Pago de los viajes con tarjeta (Stripe en modo prueba) y propina.
9. 🤖 El cargo de cancelación va al conductor afectado, no al del siguiente viaje.
10. 🤖 Seguridad: contactos de emergencia, aviso si el viaje se desvía y límite de horas al volante.
11. 🤖 Interruptores por ciudad: código solo de noche y selfie con casco.
12. 🤖 Guías de Docs de Moto escritas y guardadas sin publicar (se publican al encender).
13. 👤 Primer país y su aprobación legal, aseguradora del pasajero, tarifas reales y la orden de encender.

### Etapa 4 — Carro

14. 🤖 Ficha REA de Carro: Uber y DiDi por su documentación y web pública, y apps de transporte de código
    abierto con licencia que lo permita.
15. 🤖 Carro sobre el motor de Moto, solo en pruebas: requisitos del conductor (inspección del vehículo,
    seguro de pasajeros), tipos de carro, tarifa, oferta y viaje de punta a punta en cada publicación.
16. 👤 Las mismas decisiones que Moto (país, legal, seguro, tarifas).

### Etapa 5 — Envíos de persona a persona

17. 🤖 Ficha REA: Uber Connect y DoorDash Drive o recogida de paquetes; qué se reutiliza de Flex
    (custodia, pruebas de entrega, PIN).
18. 🤖 Construir Envíos solo en pruebas: cotizar de A a B con direcciones reales, pagar, recoger con foto
    y entregar con PIN, todo con su seguimiento.
19. 👤 Valor máximo declarado, seguro del paquete y precio.

### Etapa 6 — «Más»

20. 🤖 Ficha REA de la pantalla «Explorar» o «Browse» de los grandes, y construirla: todos los servicios
    y categorías en una sola pantalla.

### Etapa 8 — Brechas frente a los grandes (30 oct 2026, hecha)

Auditoría de los estudios de Richard y de la comparación del ciclo del pedido. Todo lo que no depende de dinero ni de cuentas quedó construido, probado y en Docs: calificación pública del restaurante, aceptación automática, nota por plato, agotado por hoy, correo de entrega con foto, casilla de apartamento, menú desde planilla y alta asistida, opciones anidadas y copiar opciones, menús por horario, horario y reseñas en la app del restaurante, fotos en el chat. Queda: editar las opciones de los platos desde la app (hoy en el panel).

### Etapa 7 — Crecer (todo decide Richard)

21. 👤 Suscripción tipo DashPass, tarjetas de regalo, anuncios pagados, pago por tiempo al repartidor,
    impuesto por condado, pedir a dos tiendas a la vez, mapa de Google en la web y varios locales por cuenta.
    Cada una tiene su punto trabado en `FILA.md` y se construye apenas Richard la decida.

## 3. Reglas que siguen valiendo en todas las etapas

- Todo cambio dice a qué país aplica. Cada país es su propio sistema.
- Nada con dinero real. Todo se prueba en el sitio de pruebas con Stripe en modo prueba.
- Moto, Carro, Envíos y Tiendas no se encienden en producción sin la orden de Richard.
- Toda función nueva se termina de punta a punta: servidor, panel, apps, Docs, web, pruebas y publicación.
