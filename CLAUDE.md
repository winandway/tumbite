# Tumbite

Marketplace de reparto de comida tipo DoorDash. Arranca en Miami. Empresa: Windoce LLC.
Las reglas globales de Richard aplican; estas se suman.

## Los estudios de Richard se consultan SIEMPRE (dictado el 14 oct 2026)

- Carpeta `Proyectos Para estudiar y copiar clonar ideas /` (con espacio al final del nombre; se queda en el repo). Tiene estudios profundos, con fuentes, de cómo funcionan DoorDash, Uber Eats, Rappi y el reparto de comida en general. Richard los suma cuando encuentra más.
- **Se consultan cada vez que se va a construir una parte, cuando se sospecha que algo no está bien, o cuando llega una orden de desarrollar algo:** se busca en los estudios qué dicen de esa parte y se compara con lo que ya tenemos. Lo que no tengamos se anota como brecha; lo que coincide se confirma. Se sigue sacando información de ahí hasta que una comparación salga sin diferencias.
- **No se le pregunta a Richard si quiere una herramienta que los grandes ya tienen (dictado el 14 oct 2026).** Se copia como la hacen ellos, con interruptor para que el usuario final decida (PIN sí/no, en la puerta o en mano), se decide cómo encaja y se le presenta el plan. Se le pregunta solo lo que únicamente él puede dar: una cuenta, una clave, dinero, un dato legal. Todas las herramientas de los estudios son importantes; ninguna se descarta por «menos prioritaria».
- La comparación viva está en `docs/COMPARACION-CICLO-PEDIDO.md` (sección «Los estudios de Richard»). Cada hallazgo nuevo se anota ahí con la página del estudio de donde salió.

## «No inventemos la rueda» (eslogan y regla, Richard, 18 oct 2026)

Se copia el **estándar del mercado** de reparto (DoorDash, Uber Eats, Rappi): la interfaz, los menús, el orden de las cosas y los flujos. Buscador arriba, «Hola, fulano», logo, campana, cupón, servicios, y abajo lo que publicó el vendedor. Cambiamos colores, marca y lo nuestro; no la estructura. Antes de diseñar una pantalla se pregunta «¿cuál es el estándar?» y se copia, salvo motivo de negocio escrito. Richard autorizó estudiar los planos de los grandes con REA y observación pública (no se descompilan sus apps de tienda: lo prohíben sus términos y expondría a Windoce; no hace falta).

## Metodología permanente de Tumbite (dictada por Richard, 18 oct 2026)

REA es una herramienta **principal** de investigación y comparación funcional durante el desarrollo, no solo cuando aparecen dudas. Antes de desarrollar o modificar una funcionalidad importante:

1. Investigar cómo la resuelven DoorDash, Uber Eats, Rappi u otras referencias relevantes.
2. Estudiar el **proceso completo**, no solamente una pantalla aislada.
3. Identificar los estándares funcionales que usan esas plataformas.
4. Compararlos con el código actual de Tumbite.
5. Reutilizar lo que ya funciona correctamente.
6. Implementar las capacidades faltantes con nuestro propio código y diseño.
7. Mantener coherencia entre cliente, restaurante, repartidor, servidor y paneles.
8. Diferenciar los comportamientos observados de las reglas internas que no podemos verificar ([OBS]/[DOC] frente a [INF]/[NV]).
9. Probar en staging y publicar en producción por el flujo habitual.

Objetivo: que Tumbite alcance los estándares funcionales de las principales plataformas del mercado. **No improvisar** procesos cuando existen referencias funcionales que podemos estudiar. **No reconstruir** componentes que ya funcionan. **No limitar** artificialmente las funcionalidades por el tamaño de la competencia. **No atribuir al propietario** restricciones o decisiones que no haya expresado.

## Ingeniería con REA: regla permanente (dictada por Richard, 16 oct 2026)

Método completo: `docs/METODOLOGIA-INGENIERIA-REA.md`. Se lee antes de diseñar o modificar cualquier función importante. Aprobada por Richard el 16 oct 2026.

**Toda función nueva importante empieza así, en este orden:**

INVESTIGACIÓN → EVIDENCIA [REA] / [OBS] / [DOC] → DIAGRAMA → COMPARACIÓN CON TUMBITE → DECISIÓN DE ARQUITECTURA → IMPLEMENTACIÓN → PRUEBAS

**No frena lo urgente ni lo simple:** una emergencia (algo roto que afecta usuarios o dinero), un arreglo con causa clara, un texto o un estilo van directo a la prueba en rojo y al arreglo. La ficha, si hace falta, se escribe después. Las restricciones de pagos siguen intactas, y la publicación sigue el flujo permanente (ver «Flujo permanente de publicación»).

- **Antes de diseñar o cambiar una función importante**, en este orden:
  1. Identificar las referencias.
  2. Investigar cómo lo resuelven. REA se usa solo si hay un artefacto **autorizado** y compatible.
  3. Completar con documentación técnica pública y observación directa.
  4. Hacer diagramas de arquitectura, estados, componentes y flujos.
  5. Comparar con nuestro código.
  6. Decidir qué mejorar, reutilizar o simplificar.
  7. Diseñar la solución propia, compatible con la arquitectura actual.
  8. Implementar con pruebas, la primera en rojo, y validar en staging.
- **Referencias:**
  - Comida: DoorDash, Uber Eats y Grubhub.
  - Repartidores: DoorDash Dasher y Uber Driver.
  - Restaurantes: DoorDash Merchant y Uber Eats Manager.
  - Otras plataformas cuando aporten algo.
  - Además, los estudios de Richard (sección de arriba).
- **REA va primero en:** arquitectura de apps, experiencia del cliente, catálogo y carrito, ciclo del pedido, despacho y asignación, tiempo real, apps de restaurante y de repartidor, rendimiento y escala.
  - No se impone en arreglos simples: ahí la prueba directa es mejor evidencia.
- **Cada hallazgo lleva su etiqueta**, y una inferencia nunca se presenta como componente interno confirmado:
  - [REA]: evidencia de REA, con su hash.
  - [OBS]: observación pública.
  - [DOC]: documentación publicada.
  - [INF]: inferencia.
  - [NV]: no verificable.
- **Límite legal (no se negocia):**
  - Nunca se descompila ni se analiza con REA una app o un paquete de terceros sin autorización. Sus términos lo prohíben y REA solo autoriza software propio o con permiso.
  - Nunca se entra a sistemas privados, se usan cuentas, se saltan verificaciones anti-robots o se captura tráfico ajeno.
  - REA se usa sobre nuestras propias apps, el sitio de pruebas y bibliotecas con licencia que lo permita.
  - Los competidores se estudian con su documentación pública y observando su web como visitante.
- **Cada función investigada deja su ficha** en `docs/investigaciones-rea/`, con la plantilla de la metodología: referencia, evidencia y límites, diagrama, comparación, decisión y pruebas de aceptación.

## Leer antes de trabajar

- `docs/REQUISITOS.md` — documento madre (modelo de dinero, planes, regalos, niveles, fases).
- `docs/PANTALLAS-Y-PLAN.md` — mapa de pantallas y los 10 pasos de la Fase 1.
- `docs/ROADMAP.md` — el orden de las etapas. No se adelanta nada: una etapa no empieza hasta cerrar la anterior.
- `PENDIENTES.md` — la fila; los 👤 dependen de Richard.
- `CANDADOS.md` — lo que funciona y no se toca.
- `VERIFICAR-PAGOS.md` — estado del circuito de pagos. Se lee ANTES de decir nada sobre cobros.
- `docs/CONTRATO-YADOMINIOS.md` — cómo se publica.
- `docs/PLAN-MAESTRO-FASE-2.md`, `docs/INFORME-FINAL-FASE-2.md` y `docs/DECISIONES-RICHARD-FASE-2.md` — la Fase 2 (modelo internacional): el plan, el cierre del 18 oct y lo que solo Richard decide.
- `docs/COMPARACION-CICLO-PEDIDO.md` — cómo funciona de verdad un pedido en DoorDash y Uber Eats frente al nuestro, con las brechas por orden. Se lee antes de tocar el ciclo del pedido.

## Identidad de Divoox (aprobada por Richard el 23 oct 2026) — SOLO estos colores

- **La marca pública es Divoox; Tumbite es el nombre interno del proyecto** (tablas, código, repositorio, sitio de pruebas). Solo cambia lo visible.
- **Archivos maestros:** carpeta `identidad-divoox/` en la raíz (manual de marca en PDF, vectores SVG aprobados, PNG, favicon). Las piezas de la web y las apps se generan SOLO desde esos vectores con `node scripts/marca/generar-identidad.mjs` (nunca a mano, nunca estiradas).
- Rojo principal `#F20D20` (acento oscuro de apoyo `#C20A1A`), negro principal `#101010`, blanco `#FFFFFF`, gris de apoyo `#666B73`.
- PROHIBIDO el morado y cualquier otro color de marca. Grises neutros solo para bordes y textos suaves.
- Reglas del manual: no deformar, inclinar ni poner sombras o efectos 3D; espacio libre alrededor; en tamaño pequeño, el isotipo. El logo completo para fondo oscuro lleva la X roja: nunca sobre fondo rojo.
- Íconos de las apps (variantes oficiales): cliente fondo rojo, repartidor fondo negro, restaurante fondo blanco.
- Estilo de referencia: Uber Eats (titular grande, buscador de dirección con pin, comida grande a la derecha), con PIZZAS, no hamburguesas.
- Tipografías: Poppins (titulares y botones) y Montserrat (textos).

## Kit de marca anterior (Tumbite, retirado)

- La carpeta `logo-imagenes-banner-marketing/` (fuera de git) es el kit de Tumbite: ya no se usa para nada visible. La mascota se reemplazó por el isotipo de Divoox.

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

## Todas las pruebas: solo en el sitio de pruebas y con Stripe en modo prueba (regla permanente, Richard, 15 oct 2026)

- Toda prueba nueva de Tumbite se hace en el sitio de pruebas (staging.tumbite.com), **exclusivamente con Stripe en modo prueba**.
- **Prohibido usar tarjetas reales o generar cobros reales para probar**, también en tumbite.com. Lo que pasó: una compra de prueba real de 7,18 dólares quedó abierta desde el 12 oct; Richard decidió no reembolsarla y se marcó como entregada el 15 oct.
- Nada se publica en producción sin pasar antes por staging (flujo permanente, abajo).

## Flujo permanente de publicación (dictado por Richard, 17 oct 2026)

DESARROLLO → STAGING → PRUEBAS → PRODUCCIÓN. **Toda versión aprobada en staging continúa a producción como parte normal del ciclo**, sin esperar otra autorización. Entregas frecuentes: nada aprobado se queda acumulado sin publicar.

- En producción NO se repite la batería completa que ya pasó en staging: control previo («antes»), puntos de restauración (etiquetas), publicar, y verificación breve («despues») con el verificador de producción.
- Se comprueba que lo publicado sea idéntico al código aprobado en staging (solo pueden diferir documentos).
- Siguen prohibidos sin orden expresa: cambiar configuraciones financieras, activar retiros, activar servicios pendientes (Moto, Carro, reloj de Cloudflare en producción) y cualquier operación con dinero real.
- Si aparece un fallo real, se corrige y se sigue el flujo habitual (vuelve a pasar por staging).

## Perímetro

- Carpeta: solo `/Users/windocellc/tumbite`.
- GitHub: repositorio `tumbite` de la cuenta conectada en `gh`.
- YaDominios Cloud: solo el sitio `tumbite`.
- Stripe: solo la cuenta de Windoce LLC (modo de prueba hasta probar el circuito completo).
- Cloudflare (Workers externos de la Fase 2, decidido por Richard el 15 oct 2026): cuenta de windoce1@gmail.com (id 4d9e131f2c18bc10ac4700d689d5556c), SIEMPRE en la sesión aparte `HOME=~/.tumbite-cloudflare npx wrangler …` (la sesión por defecto de esta computadora es OTRA cuenta). Solo los Workers `tumbite-tiempo-real` y `tumbite-reloj`, conectados a staging hasta que Richard apruebe producción.
- Nada más existe para la IA en este proyecto.

## Compuertas

`npm run verify` = typecheck + lint + pruebas con cobertura + build + audit. El pre-push lo exige.
La auditoría de seguridad cubre servidor, panel y compartido; los avisos de las herramientas de compilación de Expo están anotados en `CANDADOS.md` (deuda vigilada).

## Diseño: nada que huela a plantilla de IA (dictado por Richard, 12 oct 2026)

- PROHIBIDAS las franjas gruesas de color arriba o al costado de las tarjetas (la «sonrisa» roja de los formularios). Las tarjetas llevan borde fino gris oscuro (`1px solid #2a2a2a`) y sombra suave.
- Moderno y sobrio: nada de degradados, brillos, emojis ni adornos repetidos que se ven en todas las páginas hechas con IA.

## Cada actualización pone al día Docs Y la web, con capturas originales (dictado por Richard, 18 oct 2026)

- En **cada** actualización visible no basta con actualizar las capturas y las guías de Docs: **también se actualiza la web pública** (la portada, «Cómo funciona», las páginas para restaurantes, repartidores y franquicias).
- **La web solo muestra capturas ORIGINALES de la app real** (las del recorrido, `docs/capturas/recorrido/` → WebP en `apps/panel/public/`). Mostrar pantallas que no son las de la app es engañar al público. Nada de maquetas, dibujos ni pantallas inventadas donde se presente «así es la app».
- Cada vez que una pantalla cambia, su captura en la web y en Docs se rehace en el mismo trabajo (`npm run recorrido:capturas`).
- El texto de la web se refuerza con información precisa de lo que la app ya hace; nunca promete lo que no existe (lo que viene se dice «muy pronto»).
- Las capturas de las tiendas (App Store y Google Play) salen de las mismas originales, y solo se suben cuando las pantallas estén cerradas (ver `docs/AUDITORIA-FINAL-*.md`).

## Docs públicos de cada función (dictado por Richard, 12 oct 2026)

- Toda función nueva visible lleva su guía en `/docs` (`apps/panel/src/sitio/docs/guias.ts`), en español e inglés, para el público (cliente, restaurante, repartidor, vendedor), con capturas en `apps/panel/public/docs/`. Nada técnico ni privado (nunca la dirección del superadmin). Regla global «TODO LO NUEVO SE EXPLICA AL PÚBLICO EN DOCS».
