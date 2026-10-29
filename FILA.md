# FILA — el rumbo de la IA en Divoox (Tumbite)

> Esta es LA lista de trabajo de la IA. Una sola, en orden, solo con lo que la IA puede hacer sola.
> El gancho de la fábrica (`scripts/fabrica/seguir.sh`) no deja que la sesión se quede parada
> mientras quede un `- [ ]` aquí: le devuelve el siguiente punto.
>
> - `[ ]` por hacer · `[x]` hecho (con commit) · `[!]` trabado por Richard (la razón al lado).
> - Lo que depende de Richard vive en `PENDIENTES.md` (los 👤), no aquí.
> - Cada punto dice a qué país aplica.
> - Freno manual: crear el archivo `.fabrica-pausa` en la raíz (o que Richard diga «para»).
> - Al vaciarse, la IA rellena la fila con lo siguiente de `docs/ROADMAP.md` y `PENDIENTES.md`.

## Ahora

- [ ] Detalle del pedido del cliente: «Tipo de entrega» debe mostrar cómo se entregó de verdad (pedido 5A2F dice «Dejar en la puerta» y arriba «Te lo entregaron en mano»), y los pedidos con alcohol deben decir «En mano». Prueba en rojo, arreglo, staging, producción. Todos los países.
- [x] Auditoría Tumbite → Divoox, parte 1: inventario completo (archivo, línea, texto, corrección) en `docs/AUDITORIA-MARCA-DIVOOX.md`, separando lo visible al público, lo legal, lo de configuración y lo interno que se queda. Todos los países.
- [x] (29 oct: nada visible quedaba; ver la auditoría) Auditoría Tumbite → Divoox, parte 2: corregir todo lo visible que NO sea legal ni configuración crítica (web, apps, Docs, correos, avisos), con su prueba, staging y producción. Lo legal queda anotado para Richard. Todos los países.
- [x] (ya en producción desde el 27 oct) Remitente de los correos en divoox.com: averiguar el proveedor de correo, qué hace falta para verificar el dominio y dejarlo listo de nuestro lado; si solo falta un paso de Richard, anotarlo con su croquis. Todos los países.
- [x] Monetización prepago, paso 1: Food pasa por la capa de políticas de cobro sin cambiar ningún resultado (pruebas que comparan antes y después). Todos los países; EE. UU. sigue con Stripe Connect.
- [x] Monetización prepago, paso 2: política de cancelaciones por servicio dentro de la misma capa, con sus pruebas. Todos los países.
- [x] Superadmin, pantalla de «Cancelaciones» en Finanzas (ver, crear y aprobar la regla por servicio y país) sobre las rutas nuevas, con su prueba. Todos los países.
- [x] F17: ciudades de la web desde el servidor, con interruptor de lanzamiento por ciudad en el superadmin; Miami sigue «muy pronto» hasta que Richard lo encienda. Todos los países.
- [!] (necesita que Richard abra su sesión de administrador en divoox.com/panel; yo no escribo contraseñas) Google Play, accesos de revisión: preparar el escenario aislado en staging y comprobar que las tres cuentas de revisión entran en las tres apps. EE. UU.
- [x] (ya estaban en docs/TIENDAS.md, «Fichas de la tienda», y scripts/marca/fichas-tiendas.mjs; las tiendas de productos no se anuncian mientras estén apagadas) Fichas de las tiendas (Google Play y App Store): textos en inglés y español y capturas del recorrido listas en `docs/FICHAS-TIENDAS.md`, para subirlas al cerrar las pantallas. Todos los países.
- [x] Limpiar `PENDIENTES.md`: marcar lo que ya quedó resuelto (Google Places, Stripe de prueba, cuenta de administrador, Xcode, etc.) y dejar los 👤 vigentes arriba. Todos los países.

## Siguiente (de la lista final de la auditoría del 18 oct, lo que hacen DoorDash y Uber Eats)

- [x] «Pedir otra vez» en Comida y Tiendas: botón en el pedido entregado y en «Pedidos» que vuelve a llenar el carrito con lo mismo (solo lo que sigue disponible, con su precio de hoy y aviso de lo que falta). App del cliente, web de la app, Docs con captura. Todos los países.
- [x] Pedido programado (elegir día y hora de entrega) en Comida: cliente elige franja, el restaurante lo ve como programado y se le avisa antes, el repartidor lo recibe a su hora; cobro igual que hoy. Ficha REA antes. Servidor, tres apps, panel, Docs. Todos los países.
- [ ] Captura real del carrito con «Programar» y de la etiqueta «Programado» (recorrido), para la guía schedule-an-order y la web. Todos los países.
- [x] Rendimiento del restaurante (ventas por hora y día, ticket promedio, tiempo de preparación real contra prometido, clientes nuevos y recurrentes) en el panel y la app del restaurante, con Docs. Todos los países.
- [x] Roles internos del superadmin (soporte, finanzas, solo lectura) con registro de quién hizo qué. Todos los países.

- [ ] Comprobar en el sitio de pruebas, con el navegador, todo lo publicado hoy (carrito con «Programar», «Pedir otra vez», Cancelaciones, Ciudades en la web, Equipo interno, rendimiento del restaurante) y sacar las capturas reales para Docs y la web. Todos los países.
- [x] Informes del superadmin por rango de fechas (pedidos, ventas, comisiones, cancelados, por ciudad) con exportación a CSV. Todos los países.
- [x] Tickets de soporte con prioridad, asignación a una persona del equipo y respuestas guardadas (plantillas). Todos los países.
- [x] «Pedir otra vez» en el inicio del cliente: fila con los últimos comercios donde pidió, como DoorDash. Todos los países.

- [x] (como respuestas sugeridas según las estrellas) Reseñas del restaurante: respuestas guardadas para contestar con un toque (panel y app). Todos los países.
- [x] Avisos al equipo configurables por persona y por tipo (pedidos sin repartidor, dinero, tickets urgentes). Todos los países.

## Cada sesión

- Mirar si Google aprobó las tres apps (consola de Google Play); si sí, anotarlo y seguir el plan de las apps.
