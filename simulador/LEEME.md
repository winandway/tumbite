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
| `--semilla 1234`       | Repite una corrida: mismos nombres, mismas rutas de GPS, mismas manías |

Contra el sitio de pruebas lo corre el flujo de GitHub `simulador.yml` (manual y una vez al día), con `SIMULADOR_URL` y `SIMULADOR_SECRETO`. Solo acepta `staging.tumbite.com` o `tumbite-pruebas.sitios.dev`: nunca producción.

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

Ver la sección del modo ciudad en `divoox/ciudad.ts` y en este mismo archivo cuando esté (población con semilla que compra, vende y reparte durante una sesión acotada, con su pantalla en vivo en el superadmin del sitio de pruebas).
