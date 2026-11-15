# Docs: buscador de verdad y lupa para las capturas (15 nov 2026) — todos los países

Pedido de Richard al revisar Docs con lentes: las capturas no se pueden leer, y el buscador no
encuentra palabras en inglés que la gente usa en español («wallet» no daba nada; «billetera» sí).

## 1. Referencias y evidencia

- [DOC] Cómo lo hacen las documentaciones grandes: el buscador de Algolia DocSearch (React, Vite,
  Docusaurus y miles de documentaciones) abre un modal con ⌘K y una **lista de resultados mientras se
  escribe**, agrupada por sección, con la palabra resaltada, navegable con flechas y Enter. Las
  documentaciones que publican imágenes de pantalla (Stripe, Notion, GitBook, Docusaurus con el
  complemento de zoom) las abren en grande en una capa a pantalla completa con zoom.
- [DOC] Documentación oficial leída esta sesión: MiniSearch 7.2.0 (búsqueda difusa, por prefijo,
  pesos por campo, consultas combinadas con AND/OR), PhotoSwipe 5.4.4 (visor de imágenes: pellizco,
  doble toque, rueda, arrastre, flechas, Escape, foco atrapado, carga diferida del módulo).
- [REA] `capture_browser_scenario` sobre nuestra propia página de Docs (sitio local), guía de la
  billetera de Flex en español: evidencia `evidencia-rea-2026-11-15-docs-lupa.json.gz`, id
  `ev_0523b1d6d478de5eb08ee4c69759aa147ad5981e14b4680e5403a6b05eb74b68`, escenario
  `614f2c5252bc2e01675ea3b3d5e77821302c4834b3b57e66618fe584a4b62a10`. Hallazgo: el visor
  (`lupaVisor`), PhotoSwipe, su hoja de estilos, las medidas y la imagen grande
  (`/docs/grande/flex-billetera-es.webp`) se piden **solo después del toque** (eventos 898 a 912;
  la carga de la página termina en el 897). La espera del paso «visor» marcó error porque encontró
  dos imágenes (la liviana de relleno y la grande ya cargada): es la prueba de que el visor abrió.
- Límite: no se descompila ni se captura el tráfico de terceros; los grandes se estudian por su
  documentación pública.

## 2. El motor del buscador

Richard propuso «el motor de código libre con el algoritmo de Google». Con honestidad: **Google no
publica su motor de búsqueda**; no existe una versión libre «con su algoritmo». Lo que sí existe es la
misma familia de técnicas que usan los buscadores (índice invertido y puntaje de relevancia tipo
BM25), en librerías de código libre que corren en el navegador.

| Candidato            | Licencia   | Encaja      | Por qué                                                                                                                                                                                                               |
| -------------------- | ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MiniSearch 7.2.0** | MIT        | **Elegido** | Índice invertido en memoria con BM25+, búsqueda por prefijo y difusa (errores de escritura), pesos por campo, consultas AND/OR anidadas (sirven para los equivalentes de idioma). Unos 6 KB comprimido. Sin servidor. |
| FlexSearch 0.8       | Apache 2.0 | No          | Muy rápido, pero su tolerancia a errores es por «codificadores» fonéticos pensados para inglés; los pesos por campo y la mezcla de consultas son más rígidos.                                                         |
| Fuse.js 7.5          | Apache 2.0 | No          | Difuso de verdad, pero recorre todo el texto en cada búsqueda (sin índice): con 348 guías largas y búsqueda en cada tecla se vuelve lento, y su puntaje no es de relevancia por palabras.                             |
| Orama 3.1            | Apache 2.0 | No          | Muy completo (también vectores), pero mucho más pesado de lo que hace falta.                                                                                                                                          |
| Pagefind 1.6         | MIT        | No          | Excelente para sitios estáticos: indexa el HTML ya generado. Docs es una aplicación de una sola página: no hay HTML por guía que indexar sin cambiar cómo se publica.                                                 |
| Lunr 2.3.9           | MIT        | No          | Sin mantenimiento desde 2020.                                                                                                                                                                                         |
| Algolia DocSearch    | servicio   | No          | Es un servicio externo y pago para sitios comerciales; la regla es nada de servicios pagos ni externos.                                                                                                               |

Cómo quedó (`apps/panel/src/sitio/docs/buscar.ts`):

- Índice por idioma armado una sola vez, la primera vez que alguien escribe (unos 40 ms por idioma).
- Campos y pesos: título 5, resumen 2, preguntas de la gente 2, pasos 1, explicación, nota y pies de
  las capturas 1.
- La palabra escrita busca por su comienzo y tolera un error (dos en las largas). Sin acentos ni
  mayúsculas. Las palabras de relleno («cómo», «de», «the») no cuentan.
- **Diccionario de equivalencias** (`sinonimos.ts`, una sola pieza): wallet ↔ billetera, tracking ↔
  rastreo/seguimiento, top up ↔ recargar, driver ↔ repartidor/conductor, delivery ↔ entrega, payout ↔
  retiro, tip ↔ propina, pago móvil ↔ mobile payment, Zelle ↔ pago local… Las frases («top up») cuentan
  como una sola idea. Una palabra mal escrita que no está en el índice («biletera» en inglés) toma los
  equivalentes de la palabra del diccionario más parecida. La palabra a medio escribir («walle») ya
  trae a sus equivalentes. Lo escrito tal cual pesa más que su equivalente del otro idioma.
- Cada idea debe aparecer (AND); si así no sale nada, basta con una (OR).
- Medido (348 guías, dos idiomas): cada búsqueda tarda entre 0,1 y 2,5 milésimas. Nada se escribe en
  la base ni sale de la computadora de quien busca.

| Búsqueda           | Español                               | Inglés                                              |
| ------------------ | ------------------------------------- | --------------------------------------------------- |
| wallet             | 17 guías, la billetera de Flex arriba | 17                                                  |
| billetera          | 17                                    | 17 (Your wallet…)                                   |
| biletera (error)   | 17                                    | 17                                                  |
| tracking / rastreo | 27 / 27                               | 29 / 21                                             |
| recargar / top up  | 21 / 10                               | 23 / 27                                             |
| moto               | 61                                    | 13                                                  |
| pago móvil         | 11                                    | 2 (en EE. UU. no existe; trae los pagos al recibir) |
| Zelle              | 9                                     | 7                                                   |
| propina            | 33                                    | 24                                                  |

## 3. La lupa

- Una sola pieza para todas las capturas de Docs: `Lupa.tsx` (el botón «Ampliar la imagen» /
  «Enlarge image» con la lupa en la esquina) y `lupaVisor.ts` (PhotoSwipe, cargado solo al tocar).
- Nitidez: las capturas del celular en Docs van a 540 de ancho. `scripts/docs/capturas-grandes.mjs`
  busca la original de cada una (misma proporción, al menos 1,4 veces más ancha) y deja una segunda
  versión en `public/docs/grande/` (hasta 2000 de ancho, calidad 80): 463 de 711 la tienen, unos
  32 MB en el repositorio, **cero bytes más al cargar la página** (la evidencia REA lo confirma).
  El visor muestra primero la liviana que ya está en pantalla y la cambia por la grande cuando llega.
- Peso: la página principal suma unos 6 KB comprimidos (MiniSearch). El visor pesa 23 KB comprimidos
  más 1,4 KB de estilos, y solo se baja al abrir la primera captura.
- Comportamiento: imagen al máximo con su pie debajo; «+» y «−», rueda, doble clic; pellizco, doble
  toque y arrastre en el celular; flechas entre capturas; Escape, la X o tocar afuera cierran; el foco
  queda atrapado entre los botones del visor y vuelve a la captura que se estaba viendo.

## 4. Pruebas de aceptación

- `guiasSemana.test.ts`, bloques C-DOCS-BUSCADOR y C-DOCS-BUSCADOR-BILINGUE (rojo comprobado
  vaciando el diccionario: seis pruebas en rojo).
- `Docs.test.tsx`: lista de sugerencias con teclado, lupa en cada captura (rojo comprobado volviendo
  a la imagen suelta), versión grande y medidas de toda captura, búsqueda vieja que no tapa la guía.
- Recorrido en navegador real: celular de 375 y computadora, español e inglés.
