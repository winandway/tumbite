# Tumbite (carpeta PAPOS)

Marketplace de reparto de comida tipo DoorDash. Arranca en Miami. Empresa: Windoce LLC.
Las reglas globales de Richard aplican; estas se suman.

## Leer antes de trabajar

- `docs/REQUISITOS.md` — documento madre (modelo de dinero, planes, regalos, niveles, fases).
- `docs/PANTALLAS-Y-PLAN.md` — mapa de pantallas y los 10 pasos de la Fase 1.
- `PENDIENTES.md` — la fila; los 👤 dependen de Richard.
- `CANDADOS.md` — lo que funciona y no se toca.
- `docs/CONTRATO-YADOMINIOS.md` — cómo se publica.

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

## Perímetro

- Carpeta: solo `/Users/windocellc/PAPOS`.
- GitHub: repositorio `tumbite` de la cuenta conectada en `gh`.
- YaDominios Cloud: solo el sitio `tumbite`.
- Stripe: solo la cuenta de Windoce LLC (modo de prueba hasta probar el circuito completo).
- Nada más existe para la IA en este proyecto.

## Compuertas

`npm run verify` = typecheck + lint + pruebas con cobertura + build + audit. El pre-push lo exige.
La auditoría de seguridad cubre servidor, panel y compartido; los avisos de las herramientas de compilación de Expo están anotados en `CANDADOS.md` (deuda vigilada).
