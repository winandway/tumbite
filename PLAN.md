# Plan: Tiendas (Mercado, Farmacia, Licores, Ferretería y más) — Fase 1: catálogo

País: Estados Unidos, Venezuela y Colombia (moneda y datos por país). Rama `fase-tiendas-1`.
Meta: que las empresas invitadas entren YA y suban su catálogo, aunque el público todavía no vea las
tiendas («muy pronto»). Evidencia: `docs/investigaciones-rea/2026-10-28-tiendas-fuentes-publicas.md`
y `evidencia-rea-tiendas-2026-10-28.json.gz`.

Fases siguientes (otras ramas): 2 vitrina (tiendas cerca, pasillos, buscador por tienda); 3 compra
(carrito, pago, preparación por la tienda, sustituciones, pesables, edad al entregar); 4 búsqueda
entre tiendas y alta por código de barras (Open Food Facts).

- [x] Paso 1: REA sobre las páginas públicas de DoorDash para comercios y evidencia guardada; informe de fuentes públicas.
- [x] Paso 2: Reglas comunes (`packages/compartido/src/tiendas.ts`): tipos de comercio y su servicio, categorías bilingües, columnas estándar de la planilla (catálogo e inventario), validación de fila, dígito verificador del código de barras, restricciones (receta apagada). Pruebas.
- [x] Paso 3: Base: tipo de comercio en el negocio; ficha del producto (`catalogo_productos`) y oferta por tienda (`catalogo_ofertas`); índices.
- [x] Paso 4: Servidor: elegir el tipo; lista de productos con búsqueda y páginas; crear, editar y agotar (nunca borrar); importar la planilla con vista previa y confirmar (actualiza por SKU); las tiendas no salen entre los restaurantes. Pruebas en rojo.
- [x] Paso 5: Panel: tipo de negocio en «Mi negocio»; pantalla «Productos» con buscador, páginas, plantilla para descargar e importar con vista previa y errores por fila. Pruebas.
- [x] Paso 6: Docs: guía bilingüe «Sube el catálogo de tu tienda» con captura real; web de comercios; candado y fila.
- [ ] Paso 7: Pruebas completas, sitio de pruebas y producción, comprobado en vivo.
