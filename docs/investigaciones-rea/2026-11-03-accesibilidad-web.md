# Accesibilidad de la web pública y de la app del cliente en la web (LAN-4, 3 nov 2026) — EE. UU.

## Referencia y por qué

- [DOC] UsableNet, informe de fin de año 2025 de demandas por accesibilidad digital (más de 5000 demandas; Nueva York y Florida concentran la mayoría): https://info.usablenet.com/2025-year-end-digital-accessibility-lawsuit-report-plain-text
- [DOC] EcomBack, demandas 2025 por estado (Nueva York 1108, Florida 950, California 787), citado en https://www.accessibilitychecker.org/blog/ada-website-lawsuits-by-state/
- [DOC] Los dos informes cuentan distinto (tribunales federales y estatales); coinciden en que Florida está entre los dos estados con más demandas. Divoox abre en Miami.
- [INF] DoorDash y Uber Eats publican su compromiso de accesibilidad y se rigen por WCAG 2.1 AA; es el estándar que se exige en estas demandas.

## Herramienta

- axe-core por `@axe-core/playwright` 4.14.0 (código abierto, licencia MPL-2.0), reglas WCAG 2.1 A y AA. Prueba: `e2e/recorrido/accesibilidad.spec.ts` (recorrido local, inglés y español, celular y computadora): portada, «Cómo funciona», Docs y una guía, lista de restaurantes, ficha, carrito y pedido. Falla con una sola infracción «crítica» o «seria». El mapa (Leaflet, biblioteca externa) queda fuera.

## Lo que encontró la primera corrida (3 nov) y cómo se arregló

| Dónde                                      | Regla                                                                                                                | Arreglo                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Toda la web                                | `label-content-name-mismatch` en el selector de idioma                                                               | El nombre empieza por lo que se ve: «EN · Change language»            |
| Toda la web                                | `listitem` en el pie                                                                                                 | El `role="tabpanel"` pasa a un `div` que envuelve la lista            |
| Portada                                    | contraste del botón «Buscar» (blanco sobre #F20D20, 4,3:1) y del precio tachado (#8a8a8a)                            | Rojo oscuro de la marca #C20A1A y gris #666B73                        |
| Docs                                       | contraste de la tecla del atajo (#777)                                                                               | #5E5E5E                                                               |
| App: lista, carrito                        | `aria-required-attr` en los radios (react-native-web no traduce `accessibilityState`)                                | `aria-checked` / `aria-selected` / `aria-pressed` además del estado   |
| App: lista, ficha, carrito, barra de abajo | contraste del rojo principal con texto chico o texto blanco                                                          | Rojo oscuro de la marca (`C.acento`) en esos textos y píldoras        |
| App: lista y ficha                         | `nested-interactive` y `label-content-name-mismatch` (corazón dentro de la tarjeta, «+» dentro de la fila del plato) | Botones lado a lado; la tarjeta y la fila se nombran con lo que se ve |
| App: pedido                                | `aria-progressbar-name`                                                                                              | La barra de pasos lleva el estado como nombre                         |

## Lo que queda (deuda vigilada, sin infracciones críticas ni serias en las pantallas revisadas)

- Otras pantallas de la app que usan `accessibilityState` sin `aria-*` (pantallas fuera de esta revisión: cuenta, envíos, viajes). Se suman a la prueba cuando se toquen.
- Las apps de Driver y del restaurante no entran en esta revisión (no son de cara al público de Miami en la web).
