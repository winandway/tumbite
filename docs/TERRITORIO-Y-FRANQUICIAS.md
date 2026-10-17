# Multiciudad y franquicias — arquitectura territorial (17 oct 2026)

Rama `franquicias-multiciudad`, publicada solo en staging como `fase-franquicias-multiciudad`. Producción no se tocó y no se activó ninguna ciudad.
Candado: **C-TERRITORIO**.

## 1. Qué existía (Fase A, auditoría)

| #   | Pieza                                                                                  | Antes                                                                                                                                                                                      | Clasificación                       |
| --- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | Países, estados, ciudades                                                              | Tabla `zonas` = ciudad, con código `US-FL-MIAMI`, país, moneda, zona horaria. Sin estado ni idioma propio. Lista pública de países y ciudades fija en el código de la web (`cobertura.ts`) | Parcial                             |
| 2   | Cobertura geográfica                                                                   | Un **círculo** por ciudad (centro + 40 km)                                                                                                                                                 | Parcial                             |
| 3   | Restricciones por ubicación                                                            | Catálogo y servicios por ciudad; el pedido solo miraba 25 km al restaurante                                                                                                                | Parcial                             |
| 4   | Restaurantes por ciudad                                                                | `restaurantes.zona_id` por su ubicación                                                                                                                                                    | Implementado                        |
| 5   | Repartidores por territorio                                                            | `repartidores.zona_id` por su GPS; ofertas solo dentro de su ciudad                                                                                                                        | Implementado (ciudad)               |
| 6   | Solicitudes de franquicia                                                              | Formulario público → ticket `franquicia` en la bandeja                                                                                                                                     | Implementado, sin paso a franquicia |
| 7   | Superadmin                                                                             | Resumen, franquicias, zonas (círculo), lista de espera                                                                                                                                     | Implementado                        |
| 8   | Roles de administradores y managers                                                    | Solo `admin` y el dueño de la franquicia. Sin managers                                                                                                                                     | Parcial                             |
| 9   | Asignación de franquicias                                                              | **Una franquicia por ciudad** (regla en la base)                                                                                                                                           | Parcial                             |
| 10  | Informes                                                                               | Métricas por ciudad (pedidos, ventas, ganancia, restaurantes, repartidores, tickets)                                                                                                       | Implementado (ciudad)               |
| —   | Zonas dibujadas, estados de zona, superposición, managers aislados, próximas aperturas | —                                                                                                                                                                                          | No existía                          |

## 2. Qué faltaba

- Dividir una ciudad en **áreas** con su propio borde (polígono) y estado.
- **Varias franquicias** por ciudad, cada una con sus áreas.
- **Managers** con acceso solo a su territorio.
- Regla de **superposición** y de conflicto en el borde.
- Validar la cobertura del pedido **en el servidor** por área.
- Fuera de cobertura: decir **qué ciudades están activas** y **qué abre pronto**.
- Pasar una **solicitud** del formulario a franquicia.
- Condiciones comerciales **configurables** (sin inventar valores).

## 3. Qué se implementó (Fase B y C)

```
PAÍS (zonas.pais) → ESTADO (zonas.region) → CIUDAD (zonas) → ÁREAS (areas, polígonos) → FRANQUICIAS (franquicia_areas)
```

- **Se reutilizó todo lo que había**: la ciudad sigue siendo la `zona` de siempre, y todo lo operativo sigue filtrando por ella. No hay un sistema paralelo.
- **Áreas** (`areas`):
  - Cada área es un polígono `[[lng, lat], …]` con su caja para buscar rápido.
  - Estados: borrador, próximamente, activa, pausada y cerrada.
  - Tiene prioridad y apertura prevista.
- **Cobertura única en el servidor** (`territorio.ts`):
  - Si la dirección cae en un área activa de una ciudad activa, está **dentro**.
  - Si cae en un área publicada pero no activa, el servidor responde ese estado (próximamente, pausada o cerrada) y no se atiende.
  - Si la ciudad **no tiene áreas publicadas**, sigue su círculo de siempre. Así **Miami funciona igual** hasta que se le dibujen áreas; las de borrador no cuentan.
- **Superposición**:
  - Dos áreas publicadas de una misma ciudad no pueden pisarse; el servidor responde 409.
  - Sí pueden **compartir el borde**, y las de borrador pueden pisarse.
  - En el borde compartido gana la **mayor prioridad**; si empatan, la **más antigua**.
- **Marcas de área**:
  - El restaurante queda marcado al guardar su dirección.
  - El repartidor, con su GPS.
  - El pedido toma el área del restaurante.
  - Al dibujar o cambiar un área, los restaurantes de la ciudad se recalculan.
- **Catálogo y pedido**:
  - En una ciudad con áreas solo salen los restaurantes de áreas activas.
  - El pedido se rechaza en el servidor si la entrega cae fuera del área activa.
- **Franquicias**:
  - La tabla se rehízo **sin perder filas** para admitir varias por ciudad. En producción hoy hay cero.
  - Cada área pertenece a **una sola** franquicia.
  - El dueño y los managers se asignan **por correo**. Si la persona aún no tiene cuenta, el acceso le funciona apenas se registre con ese correo.
  - Las **condiciones comerciales** (cuota de entrada, porcentaje, cuota mensual, plazo, exclusividad) nacen en `null`, «pendiente de definición comercial». Ningún cálculo de dinero las usa.
  - Una solicitud del formulario se convierte en franquicia «prospecto» con un clic, una sola vez.
- **Panel del manager** (`/panel/franchise-…`):
  - Ve su territorio, sus restaurantes, sus repartidores y sus pedidos de los últimos 30 días, sin datos del cliente.
  - Ve sus incidencias y las marca respondidas o cerradas.
  - Lo ajeno responde 404, también lo de otra franquicia de la misma ciudad.
  - Una franquicia sin áreas no ve nada de su ciudad.
- **Superadmin**:
  - En Zonas, el botón «Áreas» de cada ciudad abre el mapa (Leaflet con OpenStreetMap) para dibujar, publicar, pausar o cerrar áreas y editar su borde.
  - En Franquicias, «Territorio y equipo» y la lista de solicitudes.
  - En el Resumen, los resultados por ciudad: franquicias, áreas, áreas sin franquicia, pedidos y ventas.
- **App del cliente**: fuera de cobertura dice «tu zona abre el …», «ya estamos en: …» y «próximas aperturas: …».
- **Preparado para varios países, monedas e idiomas**: cada ciudad lleva país, estado, moneda, zona horaria e idioma. No se activó nada nuevo.
- **Docs**: la guía pública de franquicias explica zonas, managers y la cobertura, en español e inglés.

### Pruebas (candados)

- **Geometría** (`territorio.test.ts` de la biblioteca compartida): dentro, fuera y borde; validación; superposición; regla de conflicto.
- **Servidor** (`territorio.test.ts`):
  - Miami sin áreas sigue igual.
  - Áreas que se pisan se rechazan.
  - Probados los estados dentro, próximamente, fuera y pausada.
  - El catálogo y el pedido respetan el área.
  - Dos franquicias en Miami, cada una ve solo lo suyo.
  - El manager no entra a otra franquicia ni toca su incidencia.
  - La franquicia sin áreas no ve nada.
  - La solicitud se convierte una sola vez.
- **Migración** (`esquemaTerritorio.test.ts`): rehace la tabla vieja sin perder filas, y su definición es igual a la de `schema.sql`.
- **Pantalla** (`Superadmin.test.tsx`): territorio y equipo.
- **Comprobadas en rojo**: rompiendo el aislamiento y la validación del pedido, las pruebas fallan.
- **Total:** verify completo en verde, con 671 pruebas.
- **Vista en el panel local**: se dibujó un área sobre el mapa de Miami, se guardó como activa, se asignó a una franquicia y su panel mostró el territorio con sus dos restaurantes.

## 4. Cómo se activa una ciudad nueva

1. Superadmin → **Zonas** → «Nueva zona»: código (`US-FL-ORLANDO`), nombre, estado o provincia, centro y radio. Nace **apagada**.
2. **Áreas** de esa ciudad: dibujar cada área en el mapa y guardarla en **borrador**.
3. Cuando una zona esté lista para anunciarse: ponerla en **Próximamente** con su apertura prevista. Desde ahí sale en «próximas aperturas» en la app.
4. El día del lanzamiento: área en **Activa** y ciudad en **Activar**. Las dos cosas hacen falta; ninguna ciudad se activa sola.

## 5. Cómo se divide una ciudad en franquicias

1. Dibujar las áreas de la ciudad. Pueden compartir borde, pero no pisarse.
2. **Franquicias** → «Nueva franquicia»: elegir la ciudad y ponerle nombre (por ejemplo, «Miami Norte»). Se pueden crear varias en la misma ciudad.
3. «Territorio y equipo» → marcar sus áreas → «Guardar territorio». Un área ya asignada a otra franquicia aparece bloqueada.

## 6. Cómo se asigna un Manager

1. Franquicias → la franquicia → «Territorio y equipo» → «Equipo con acceso a su panel».
2. Escribir el correo, elegir «Manager» (o «Dueño») y tocar «Dar acceso».
3. La persona entra al panel con su cuenta de ese correo y la lleva a su franquicia. Si aún no tiene cuenta, se crea una con ese correo y ya entra.
4. Quitar el acceso: en el menú de tres puntos, «Quitar acceso».

## 7. Qué falta para publicar

- [x] **Staging en verde** con esta rama: corrida `39035763449` (commit `f8fc3b0`) con pruebas S, tiempo real, recorrido completo en/es y conciliación en verde. En staging: Miami sigue «dentro» por su círculo, una dirección de Nueva York sale «fuera» con la lista de ciudades activas, y la tabla de franquicias ya tiene la forma nueva. Los arreglos visuales posteriores (casilla y estado traducido) se publicaron después en la misma rama.
- [ ] **Autorización de Richard** para producción. Esta tarea pedía no cambiar producción; con el flujo permanente pasaría sola, pero aquí se respetó la orden de la tarea.
- [ ] Al publicar en producción:
  - La migración rehace la tabla de franquicias. Hoy está vacía, así que no hay riesgo de datos.
  - Se crean las tablas nuevas y las columnas de área.
  - Miami **no cambia** mientras no se le dibujen áreas.
- [ ] **Decisión comercial** 👤: valores de las condiciones de franquicia (cuota, porcentaje, plazo, exclusividad). Hoy quedan pendientes y no afectan ningún cobro.
- [ ] **Pendiente técnico** (no bloquea):
  - El despacho de repartidores sigue siendo por ciudad: un repartidor puede llevar pedidos de cualquier área de su ciudad, como hacen los grandes dentro de un mercado [INF].
  - Si se quiere limitar el despacho por franquicia, es un cambio aparte.

## Referencias

Los grandes de reparto dividen cada mercado en zonas de operación con su propio estado (abierta o en pausa) y despachan dentro del mercado. Esto es [INF]: es una inferencia de su comportamiento público y no se verificó con documentación en esta tarea. El diseño se apoya en lo que ya tenía Tumbite, no en un componente interno de nadie.
