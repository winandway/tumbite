# Plan del catálogo del cliente y diagnóstico del reloj

Fecha: 16 de octubre de 2026, 11:30 UTC. **Solo plan y diagnóstico: no se escribió código, no se cambió infraestructura, no se fusionó ni se publicó nada.**

## A. Plan de corrección del catálogo

La causa está comprobada en `docs/EVALUACION-FASES-4-5-Y-MVP.md` §F. En resumen:

- el inicio y la lista piden los restaurantes dos veces, primero sin ubicación y después con ella;
- vuelven a empezar cada vez que cambia la sesión o el idioma;
- no descartan una respuesta vieja que llega tarde;
- sin ubicación, el servidor contesta con Miami, que en producción está vacía.

Archivos que se tocarían, todos de la app del cliente y nada del servidor: `apps/cliente/src/Inicio.tsx`, `apps/cliente/src/app/restaurants.tsx`, una pieza nueva compartida (`apps/cliente/src/comida/useRestaurantes.ts`) y los textos.

### 1. Que una respuesta vieja no pise una lista más nueva

- **Una sola pieza para las dos pantallas:** `useRestaurantes`. Hoy el inicio y la lista tienen cada uno su propia copia de la carga.
- **Cada consulta lleva un número**, y solo se aplica la respuesta de la ÚLTIMA. Una respuesta vieja que llega tarde se descarta. Además, la consulta anterior se cancela al empezar una nueva.
- **Una lista con ubicación nunca se reemplaza por una sin ubicación.** Una respuesta sin ubicación solo se muestra si todavía no hay nada mejor en pantalla.

### 2. Mantener la ubicación que eligió el cliente

Orden de prioridad del punto de búsqueda:

1. la ubicación que trae la dirección de la portada (`?lat=&lng=`);
2. la dirección que el cliente eligió en el mapa (ya existe `ElegirEnMapa` en el carrito);
3. el GPS del teléfono;
4. ninguna.

El punto elegido se guarda en el teléfono (`almacenTelefono`, la misma pieza que ya guarda el carrito) y lo comparten el inicio, la lista y el carrito. Al volver a abrir la app, se usa enseguida, sin esperar al GPS.

### 3. Evitar consultas repetidas

- La carga deja de depender de que cambien la sesión o el idioma. La lista es pública y el servidor ya manda los textos en los dos idiomas, así que cambiar de idioma no necesita volver a pedirla.
- **Recuerdo de 60 segundos:** el mismo punto, ya consultado, no se vuelve a pedir al pasar del inicio a la lista.
- **Se vuelve a pedir solo en estos casos:** cuando cambia el punto, cuando la persona tira hacia abajo para refrescar, o al volver a la app después de más de cinco minutos.

### 4. Decir claramente cuando una zona no tiene restaurantes

La pantalla tendrá cinco estados, y nunca quedará vacía sin explicación:

| Estado                                                                | Qué ve el cliente (es / en)                                                                                                                                 |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cargando                                                              | Tarjetas grises de espera                                                                                                                                   |
| Con restaurantes                                                      | La lista, ordenada por abiertos y cercanía                                                                                                                  |
| Zona sin restaurantes (el servidor devuelve la zona y 0 restaurantes) | «Todavía no hay restaurantes en {zona}. Pronto llegan.» / «No restaurants in {zone} yet. They’re coming soon.» + «Avísame» (lista de espera, que ya existe) |
| Fuera de zona (`fueraDeZona: true`, que el servidor ya manda)         | «Todavía no llegamos a tu zona.» / «We’re not in your area yet.» + las ciudades donde sí estamos + «Avísame»                                                |
| Error de red                                                          | «No pudimos cargar los restaurantes.» + «Reintentar». Si había una lista en pantalla, **se queda**                                                          |

**Decisión de negocio que no tomo yo:** en producción, los cinco restaurantes aprobados están en «Novi (pruebas)». Hay que decidir si esa zona de pruebas se muestra al público en la lista de ciudades, o si se apaga antes del lanzamiento y se dan de alta restaurantes reales en Miami.

### 5. Comida igual en español e inglés

- No cambia el carrito, ni el pago, ni el seguimiento, ni el menú.
- Los textos nuevos van en `textos.ts`, en los dos idiomas.
- Siguen en pie los candados C-UBICACION-NO-FRENA (la lista sale sin esperar al GPS), C-INICIO-DISENO y C-COMIDA-DISENO.
- Lleva su guía pública en Docs, en los dos idiomas: «¿Por qué no veo restaurantes en mi zona?».

### 6. Pruebas que fijan que los restaurantes no desaparecen

**Automáticas, de la pieza nueva y de las dos pantallas.** Cada una se comprueba en rojo, con el fallo de hoy metido a propósito:

1. La respuesta con ubicación llega primero y la de sin ubicación después: la lista NO se reemplaza.
2. La sesión o el idioma cambian a mitad de carga: no hay una consulta nueva y la lista sigue.
3. El mismo punto dentro de 60 segundos: una sola consulta.
4. `fueraDeZona`: sale el aviso, no una pantalla vacía.
5. Zona con 0 restaurantes: sale el aviso de la zona.
6. Un error de red con una lista ya en pantalla: la lista se queda y aparece «Reintentar».
7. Lo mismo, en inglés.

**De punta a punta (Playwright, en el sitio de pruebas):**

- Ubicación simulada en una zona con restaurantes. Se retrasa a propósito la respuesta sin ubicación para forzar la carrera. Se comprueba que la lista sigue visible y con el mismo número de restaurantes después de 15 segundos.
- Ubicación fuera de zona: se ve el aviso.
- Se agrega como paso al recorrido completo de Comida, en español e inglés.

**Visuales:**

- Capturas a 375 px de ancho, en español y en inglés, de los cinco estados, guardadas en `docs/capturas/`.
- Prueba en el navegador integrado antes de publicar.
- Después de publicar, Richard la prueba en su teléfono.

**Estimación:** un día de trabajo.

**Va gratis:** es un fallo nuestro.

## B. Diagnóstico del reloj de producción

### 1. Por qué GitHub no lo corre cada 5 minutos

La documentación oficial de GitHub sobre los eventos que disparan flujos, consultada hoy, dice tres cosas:

- «El evento programado puede retrasarse en períodos de mucha carga».
- «Si la carga es suficientemente alta, algunas tareas en cola pueden descartarse».
- «En un repositorio público, los flujos programados se apagan solos tras 60 días sin actividad».

Es un servicio sin garantía de horario. Los datos reales lo confirman: en las últimas 15 vueltas, el reloj corrió cada 2 a 5 horas (hoy, a las 01:42 y a las 06:23 UTC), aunque está programado cada 5 minutos. Cada vez que corre, termina bien.

### 2. Qué depende del reloj

| Tarea                                                                                      | ¿Tiene otro disparador?                                                                                                  |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Ofrecer pedidos sin repartidor                                                             | **Sí:** cada vez que un repartidor con la app abierta pide sus ofertas                                                   |
| El Manager: avisos, poner en rojo y cancelar pedidos que nadie confirma, con su devolución | **En parte:** mira un pedido cada vez que su cliente abre el seguimiento. Si el cliente cierra la app, depende del reloj |
| Conciliación diaria del dinero                                                             | **No.** Solo el reloj                                                                                                    |
| Respaldo diario de la base                                                                 | **No.** Solo el reloj (paso del mismo flujo)                                                                             |
| Reintentar y conciliar retiros dudosos                                                     | **No.** Hoy no importa: los retiros están apagados                                                                       |
| Borrar las fotos de más de 30 días                                                         | **No.** Puede esperar                                                                                                    |
| Reparto de operaciones (Fase 3)                                                            | **No.** En producción no hay operaciones                                                                                 |

### 3. Qué pasa con un retraso de varias horas

- **Pedido sin confirmar con el cliente fuera de la app:** el restaurante no lo atiende y el cliente cierra la app. La cancelación con devolución de los 6 a 10 minutos puede llegar horas tarde. El cliente se queda horas con su dinero retenido. **Es el riesgo más serio.**
- **Pedido listo sin repartidores mirando:** si ningún repartidor tiene la app abierta, nadie lo dispara.
- **Conciliación y salud del dinero:** llegan tarde. Lo estamos viendo hoy: la salud seguirá en rojo hasta que corra.
- **Respaldo diario:** con mala suerte, un día sin respaldo.
- **Con tráfico real esto no es aceptable.** Hoy, sin pedidos reales, no hace daño.

### 4. ¿Hay que pasarlo a algo más fiable?

**Sí, antes de recibir clientes reales.** Ya está construido y probado:

- el trabajador `tumbite-reloj` de Cloudflare corre cada minuto y llama a la ruta interna firmada del servidor;
- un candado garantiza que el reloj de GitHub y el de Cloudflare nunca hagan dos veces la misma tarea en el mismo minuto;
- funciona en el sitio de pruebas desde el 15 de octubre, con todas sus vueltas a tiempo.

Pasarlo a producción significa:

1. cargar la llave interna en el sitio tumbite (yo lo hago con la llave de producción y sin mostrar ningún secreto);
2. que el reloj de Cloudflare llame también a producción (un segundo reloj, o el mismo con las dos direcciones).

Cuesta cero dentro del plan gratuito de Cloudflare.

**Necesita su autorización expresa,** porque es cambiar la infraestructura de producción. GitHub se quedaría como respaldo.

### 5. ¿La vigilancia sigue si termina esta sesión?

**No.** La vigilancia que dejé corriendo es un proceso de esta computadora, dentro de esta sesión de Claude: si la sesión o la app se cierran, se detiene. Ya pasó una vez: dos vigilancias de una sesión anterior quedaron «detenidas» al cerrarse.

Lo que **sí sigue igual** pase lo que pase: el reloj de GitHub y la conciliación misma, que corren en GitHub y en el servidor. Mi vigilancia solo mira.

Si la sesión se cierra, en la siguiente reviso a mano la conciliación con una sola consulta de lectura.

## C. Estado de la conciliación (11:30 UTC)

- La del **15 de octubre** sigue intacta: 1 pedido, 718 centavos, `cuadra = 0`. No se tocó.
- La del **16 de octubre** todavía no existe, y es lo normal: solo puede correr después de las 00:00 UTC del 17 (las 8 p. m. de Miami). Con el reloj de GitHub, lo probable es que llegue entre las 00:00 y las 05:00 UTC.
- La vigilancia de solo lectura está activa: revisa cada 10 minutos y avisa al aparecer, o a la 01:30 UTC si todavía no corrió.
- **No lanzaré el reloj a mano sin su autorización expresa.**

## D. La Fase 3 sigue sin publicarse

- Producción sirve `f5b2b1a`.
- `main` está en `f5b2b1a`.
- La rama `fase-3-exclusividad` **no** está dentro de `main`.
- No hubo movimientos de dinero.
