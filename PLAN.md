# Plan: Tiendas (Mercado, Farmacia, Licores, Ferretería y más) — Fase 1: catálogo

País: Estados Unidos, Venezuela y Colombia (moneda y datos por país). Rama `fase-tiendas-1`.
Meta de esta fase: que las empresas invitadas entren YA y suban su catálogo, aunque el público todavía
no vea las tiendas («muy pronto»). Evidencia: `docs/investigaciones-rea/2026-10-28-tiendas-*`.

- [x] Paso 1: REA sobre las páginas públicas de DoorDash para comercios (supermercado y tiendas) y evidencia guardada.
- [ ] Paso 2: Reglas comunes: tipos de comercio, su servicio, categorías bilingües por tipo, columnas estándar de la hoja de productos y validación de cada fila (`packages/compartido/src/tiendas.ts`) con pruebas.
- [ ] Paso 3: Base: tipo de comercio en el negocio; código de barras, SKU, marca, tamaño, venta por unidad o peso, existencias, edad mínima y receta en el producto; índices.
- [ ] Paso 4: Servidor: elegir el tipo de comercio; lista de productos con búsqueda y páginas; importar la hoja (vista previa y confirmar, actualiza por SKU o código de barras); las tiendas no salen entre los restaurantes. Pruebas en rojo.
- [ ] Paso 5: Panel: tipo de negocio en «Mi negocio»; pantalla «Productos» con buscador, páginas, plantilla para descargar e importar la hoja con vista previa. Pruebas.
- [ ] Paso 6: Integrar el informe de fuentes públicas (DoorDash, Uber Eats, Rappi, Instacart) y ajustar lo que falte.
- [ ] Paso 7: Docs: guía bilingüe «Sube el catálogo de tu tienda», con captura real; página de comercios en la web; candado y fila.
- [ ] Paso 8: Pruebas completas, sitio de pruebas y producción, comprobado en vivo.
