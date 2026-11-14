# Simulador de compras y entregas

Personas falsas (clientes, comercios, repartidores) que usan el producto de punta a punta por su API, sin humanos, para que cuando una persona lo pruebe con celulares de verdad ya haya pasado este filtro. Investigación de cómo lo hacen Uber, DoorDash y Lyft: `docs/investigaciones-rea/2026-11-13-simulador-de-compras-y-entregas.md`.

Dos partes:

- **`nucleo/`**: la pieza universal. No sabe nada de Divoox; sirve para cualquier app con servidor HTTP.
- **`divoox/`**: el paquete de Divoox encima (actores, escenarios de comida, comprobación del dinero).

## Cómo se corre (Divoox)

```bash
cd /Users/windocellc/Divoox && npm run simulador
```

Arma solo el servidor local en `.simulador/` (puerto 8791, base nueva, Stripe y Twilio simulados), corre toda la batería y deja el reporte en `simulador/reportes/<corrida>/reporte.html` (y `reporte.json`). No toca el sitio de pruebas ni gasta nada.

Opciones (van después de `--`):

| Opción                 | Qué hace                                                               |
| ---------------------- | ---------------------------------------------------------------------- |
| `--solo "rechaza,PIN"` | Solo los escenarios cuyo nombre contiene alguno de esos textos         |
| `--etiqueta diario`    | Solo el subconjunto que corre cada día contra el sitio de pruebas      |
| `--etiqueta moto`      | Solo Divoox Moto en Venezuela (efectivo, pago móvil y sin saldo)       |
| `--etiqueta venezuela` | Comida en Venezuela (El Vigía, en efectivo, comisión del saldo)        |
| `--semilla 1234`       | Repite una corrida: mismos nombres, mismas rutas de GPS, mismas manías |

Contra el sitio de pruebas lo corre el flujo de GitHub `simulador.yml` (manual y una vez al día), con `SIMULADOR_URL` y `SIMULADOR_SECRETO`. Solo acepta `staging.tumbite.com` o `tumbite-pruebas.sitios.dev`: nunca producción.

## Divoox Moto en Venezuela

`simulador/divoox/moto.ts` (etiqueta `moto`; «efectivo» y «sin saldo» también van en `diario`). Hace el mismo camino que `scripts/staging/probar-moto-venezuela.mjs` con cuentas FIJAS de la puerta de diagnóstico (`zz-mtve-…`): el saldo y el libro del conductor no se borran nunca y su alta vuelve a empezar en cada escenario. En local Moto está cerrado como en producción, así que el escenario abre la compuerta de Venezuela en la base local; en el sitio de pruebas no hace falta. Candado C-MOTO-VE-PUNTA-A-PUNTA.

## Cómo se lee el reporte

Cada escenario sale en verde o en rojo, con su línea de tiempo paso a paso. En el paso que falló dice por qué y qué respondió el servidor en ese momento; cada paso guarda sus peticiones (quién, qué pidió, qué respondió, cuánto tardó) y marca las «manías» (doble toque, respuesta perdida, fuera de orden). Arriba, cuántas filas escribió el servidor en cada escenario (presupuesto de la base).

Un escenario con `falloConocido` sigue saliendo en rojo («fallo conocido»): un fallo del producto no se esconde. Si un día pasa, el reporte avisa que hay que quitar la marca.

## Cómo se adapta el núcleo a otra app

1. **Destino.** Decide contra qué servidor corre (local o pruebas) y nunca contra producción.
2. **Actores.** `e.actor({ nombre, base, cabeceras })` da un cliente HTTP con su sesión (`entrar(token)`), que reintenta solo los cortes de red y anota cada petición. Las manías están en `actor.manias`: `dobleToque`, `repetirTrasCorte`, `tardar`, `fueraDeOrden`.
3. **Contexto.** En `correrLibreto({ contexto })` se arma lo que cada escenario necesita (cuentas, cabecera de la vuelta de pruebas, accesos de diagnóstico). `despues` cierra lo que quedó abierto aunque el escenario falle; `filas` dice cuántas filas gastó (si el servidor las cuenta).
4. **Escenarios.** Un objeto `{ nombre, descripcion, etiquetas, vigila, correr(e, ctx) }`. Dentro, `e.paso('nombre', async () => …)`, `e.comprobar(condición, 'qué se espera', loQueSeVio)` y `e.esperar('qué', intento, { topeMs })`. Nada de esperas fijas: se espera un estado con tope.
5. **GPS y reloj.** `ruta(origen, destino, { azar })` da puntos creíbles por calles; `crearEmisor(reloj, enviar, { minimoMs })` los manda sin pasar de una frecuencia (cada posición puede ser una escritura). El reloj del SISTEMA (vencer una oferta, dar por perdido a alguien) lo adelanta cada paquete según cómo guarde sus horas.
6. **Reporte.** `escribirReporte(resultado, carpeta)` y `resumenMarkdown(resultado)` para la página de la corrida.

Lo que no lleva el núcleo a propósito: modelos de IA (el «humano» es un actor con manías y azar con semilla), servicios de pago y dependencias externas.

## Modo ciudad

Una población falsa (por defecto 3 restaurantes, 4 repartidores y 8 clientes) compra, vende y reparte durante una sesión ACOTADA, a ritmo creíble y mezclando al azar los comportamientos de los escenarios (a la puerta, en mano con PIN, para recoger, plato agotado, doble toque, el repartidor rechaza primero, propina después, el cliente cancela, el restaurante rechaza). El «humano» es el actor con manías y azar con semilla: ningún modelo de IA.

```bash
cd /Users/windocellc/Divoox && npm run simulador:ciudad -- --pedidos 20 --minutos 15
```

| Opción                                                   | Qué hace                                     |
| -------------------------------------------------------- | -------------------------------------------- |
| `--pedidos 20` / `--minutos 15`                          | Se detiene al llegar a cualquiera de los dos |
| `--restaurantes 3` / `--repartidores 4` / `--clientes 8` | Tamaño de la población                       |
| `--concurrencia 2`                                       | Pedidos en curso a la vez                    |
| `--semilla 7`                                            | Repite la misma mezcla de comportamientos    |

- **Cuentas que se reutilizan:** los correos son fijos (`ciudad.restaurante1@simulador.test`…) y la clave se deriva del secreto del sitio; si la cuenta ya existe, entra con ella (menos filas). El menú tampoco se duplica.
- **Presupuesto:** contra el sitio de pruebas toda la sesión es una sola vuelta (`x-vuelta-pruebas: simulador-<corrida>`) y deja de empezar pedidos al llegar a 4.500 filas escritas (el tope es 6.000).
- **Repartidores:** un solo despachador consulta las ofertas de los que están libres (una petición a la vez, sin pasar del límite por dirección) y les manda el latido de ubicación cada 2 minutos.
- **En vivo:** superadmin → «Ciudad de pruebas» (solo en el sitio de pruebas y en local; en producción no existe). Muestra pedidos por estado, clientes comprando, restaurantes vendiendo, repartidores en la zona (lista y mapa), ventas y los fallos de la sesión, y tiene el botón «Parar la sesión».
- **Arrancar en el sitio de pruebas:** GitHub → Actions → «simulador» → Run workflow → modo «ciudad».
- El reporte queda igual que el del libreto: un escenario por pedido, con su línea de tiempo.

## Modo juego (sin GitHub, desde la pantalla)

Superadmin → «Ciudad de pruebas» → «Encender la ciudad». Arma 3 restaurantes y 4 repartidores robot (cuentas fijas `juego.<rol><n>@simulador.test`) en Novi, Michigan (o en Miami si el sitio no tiene esa zona). Mientras la pantalla está abierta, cada 4 segundos manda un latido y los robots avanzan por la API real. Cualquier persona pide desde la app del cliente a un restaurante «del Robot» y paga con «Efectivo al recibir» (solo esos restaurantes, solo en pruebas y en local). «Pantalla grande» es el mapa para el televisor. Se apaga sola a los 60 minutos o a las 3.000 filas escritas. Detalle y topes: `CANDADOS.md`, C-CIUDAD-JUEGO.
