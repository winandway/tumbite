# Tumbite (carpeta PAPOS)

Marketplace de reparto de comida tipo DoorDash. Arranca en Miami. Empresa: Windoce LLC.
Las reglas globales de Richard aplican; estas se suman.

## Leer antes de trabajar

- `docs/REQUISITOS.md` — documento madre (modelo de dinero, planes, regalos, niveles, fases).
- `docs/PANTALLAS-Y-PLAN.md` — mapa de pantallas y los 10 pasos de la Fase 1.
- `PENDIENTES.md` — la fila; los 👤 dependen de Richard.
- `CANDADOS.md` — lo que funciona y no se toca.
- `VERIFICAR-PAGOS.md` — estado del circuito de pagos. Se lee ANTES de decir nada sobre cobros.
- `docs/CONTRATO-YADOMINIOS.md` — cómo se publica.

## Colores corporativos (dictado por Richard, 10 oct 2026) — SOLO estos

- Rojo escarlata, dominante: `#FF3008` (el oficial del kit aprobado; `#EB1700` solo como tono más oscuro de apoyo).
- Blanco `#FFFFFF`.
- Gris oscuro Cod Gray `#191919` (textos, cabeceras oscuras, botón secundario fuerte).
- PROHIBIDO el morado y cualquier otro color de marca. Grises neutros solo para bordes y textos suaves.
- Estilo de referencia: Uber Eats (titular grande, buscador de dirección con pin, comida grande a la derecha), con PIZZAS, no hamburguesas.
- Tipografías del manual: Poppins (titulares y botones) y Montserrat (textos).

## Kit de marca oficial

- Carpeta `logo-imagenes-banner-marketing/` (solo en esta computadora, fuera de git por peso). Lo aprobado está en `Tumbite_Kit_Final_Aprobado_v1/` (logo, mascota, variantes, manuales). Leer su `LEEME_PRIMERO.txt` antes de usar nada.
- Reglas del manual: no deformar, rotar, recolorear ni quitar partes de la mascota; margen libre del tamaño de un ojo; usar PNG (el SVG experimental fue RECHAZADO, no usarlo).
- Las versiones para la web (WebP livianos) están en `apps/panel/public/marca/`. Los íconos de las apps se arman con la mascota completa sobre escarlata (cliente), gris oscuro (repartidor) y blanco (restaurante).

## Estructura

- `apps/cliente`, `apps/repartidor`, `apps/restaurante` — tres apps Expo (un solo código compartido). Se instalan dependencias con `npx expo install` dentro de cada app.
- `apps/panel` — paneles web (Vite + React).
- `apps/servidor` — servidor Hono; se empaqueta como `_worker.js`. Rutas bajo `/datos`, NUNCA `/api`.
- `packages/compartido` — marca, idiomas, dinero (siempre en centavos enteros).

## Publicación

- Cuenta de YaDominios Cloud y del dominio tumbite.com: tumbite.com@gmail.com (de Richard). No hace falta ninguna API ni credencial para publicar: el sitio se conecta en el panel con el repo y la rama.
- El sitio sirve la landing pública en «/» y los paneles en «/panel».

- Servidor + panel: YaDominios Cloud, sitio conectado a la rama `yapanel-build` (la llena el Action `publicar`).
- YaDominios Cloud no tiene Durable Objects ni cron: el seguimiento en vivo empieza con consultas cada pocos segundos; si hace falta tiempo real con Durable Objects, esa pieza va directo a Cloudflare (regla de Richard).
- Apps: EAS Build → TestFlight y Google Play, cuenta de Windoce LLC.

## Base de datos: cuidado con los cambios de tablas

- `schema.sql` corre en CADA publicación y solo con `CREATE ... IF NOT EXISTS`. Agregar una columna a una tabla que YA existe en producción NO se aplica solo (en SQLite `ALTER TABLE ADD COLUMN` no es idempotente y rompería la publicación).
- Hasta el primer lanzamiento las tablas nacen completas. Después de lanzar, cada columna nueva se hace con una migración aparte (ruta de admin o la API de consultas de YaDominios con el token del panel), anotada en `CANDADOS.md`.

## Perímetro

- Carpeta: solo `/Users/windocellc/PAPOS`.
- GitHub: repositorio `tumbite` de la cuenta conectada en `gh`.
- YaDominios Cloud: solo el sitio `tumbite`.
- Stripe: solo la cuenta de Windoce LLC (modo de prueba hasta probar el circuito completo).
- Nada más existe para la IA en este proyecto.

## Compuertas

`npm run verify` = typecheck + lint + pruebas con cobertura + build + audit. El pre-push lo exige.
La auditoría de seguridad cubre servidor, panel y compartido; los avisos de las herramientas de compilación de Expo están anotados en `CANDADOS.md` (deuda vigilada).
