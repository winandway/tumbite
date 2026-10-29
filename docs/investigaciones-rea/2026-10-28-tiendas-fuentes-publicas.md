# Tiendas (no restaurantes) en los grandes: catálogo, inventario, sustituciones y búsqueda — fuentes públicas

Fecha: 28 de octubre de 2026. Aplica a: **todos los países** (EE. UU., Venezuela, Colombia), con notas por país.

Método: solo documentación pública (centros de ayuda, portales de desarrolladores, páginas para comercios, blogs oficiales y prensa). Sin entrar con cuentas, sin saltar anti-robots, sin descompilar apps. Complementa la evidencia REA de nuestras propias apps (`evidencia-rea-tiendas-2026-10-28.json.gz`).

Etiquetas: **[DOC]** documentación publicada (con su dirección), **[OBS]** observado en página pública, **[INF]** inferencia nuestra, **[NV]** no verificable con fuentes públicas.

---

## 1. DoorDash (supermercado, conveniencia, farmacia, ferretería, alcohol)

### 1.1 Alta y carga del catálogo

- Hay dos caminos de integración para tiendas: la **API de catálogo** (Catalog Management API) y el **archivo plano** (Inventory Feed Integration, CSV por SFTP). [DOC] https://developer.doordash.com/docs/marketplace/retail/catalog_management/reference · https://developer.doordash.com/docs/marketplace/inventory_feed_integration/explainer/product_catalog
- Por archivo se exige un **mínimo de 200 artículos**, que deben estar tanto en el archivo de catálogo como en el de inventario. [DOC] https://developer.doordash.com/docs/marketplace/inventory_feed_integration/ifi_faq
- Archivo de catálogo: CSV llamado `catalog_{yyyy}{mm}{dd}{hh}{mm}.csv`, subido por SFTP a `catalog/v1`, como mínimo mensual (se recomienda diario o semanal). [DOC] https://developer.doordash.com/docs/marketplace/inventory_feed_integration/explainer/product_catalog
- DoorDash **solo actualiza automáticamente precio y disponibilidad**; nombre, imagen y UPC de un artículo existente no se actualizan solos al cambiar el archivo. [DOC] misma dirección.

### 1.2 Campos del artículo (API de catálogo)

- `merchant_supplied_item_id`: el único que la API exige; único en todo el negocio (todas las sucursales). [DOC] https://developer.doordash.com/docs/marketplace/retail/catalog_management/unit_items
- Para aprobar el catálogo hacen falta además `name`, `images[].url` (al menos una) e `item_categorizations` (granular). Lo que falte queda retenido en revisión, no publicado. [DOC] https://developer.doordash.com/docs/marketplace/retail/catalog_management/reference
- Opcionales: `brand_info.name`, `size` (peso, volumen, dimensiones, `pack_size_details`), `other_identifiers` (tipo UPC/PLU/GTIN/NSC2 + valor), `description` (HTML o texto), `product_attributes`, `product_traits` (`ALCOHOL`, `MEDICATION`, `WEIGHTED`), `program_eligibility` (`SNAP`, `HSA`, `FSA`, sensible a mayúsculas). [DOC] misma dirección.
- **El precio y el inventario NO van en el artículo**: van en la API de inventario por tienda (`base_price_per_measurement_unit` para precio por unidad de medida). [DOC] misma dirección.
- No hay campo dedicado de edad: las restricciones van como `product_attributes` (por ejemplo `restriction_types`), o con el rasgo `ALCOHOL`/`MEDICATION`. [DOC] misma dirección.
- Requisitos por vertical (Mascotas, Belleza, Salud, Oficina, Hogar y mejoras del hogar —ferretería—, Electrónica, Ropa): en todas son obligatorios id del comercio, identificador UPC/GTIN/PLU, nombre, marca y al menos una imagen; además niveles de categoría y atributos propios de cada vertical (en Salud: `product_group`, `variant`, `concerns`, `benefits`). [DOC] https://developer.doordash.com/docs/marketplace/retail/catalog_management/passthrough_catalog_api_requirements

### 1.3 Campos del archivo CSV de catálogo

- Obligatorios: `sku`, `upc`, `consumer_facing_item_name`, `brand_name`, `size_variation`, `unit_of_measurement`, `L1_category`, `L2_category`, `image_url_front`. [DOC] https://developer.doordash.com/docs/marketplace/inventory_feed_integration/explainer/product_catalog
- Condicionales: `secondary_upc`, `plu` (frutas y verduras), `product_group_id` + `variation` (tallas o sabores), `is_alcohol`, `is_weighted_item` + `average_weight_per_each` + `average_weight_uom`. [DOC] misma dirección.
- Recomendados: `short_description`, `extended_size`, `L3_category`, `L4_category`, `abv` (alcohol), `cx_show_by` (pesables), imágenes de atrás, lado e ingredientes. [DOC] misma dirección.
- Opcionales: `private_label`, `nutritional_info`, `ingredients`, `disclaimer`, alérgenos, `dietary_flags`, `is_hsa_fsa_eligible`, `package_type`, `dimensions`, `weight`. [DOC] misma dirección.

### 1.4 Fotos

- Menú en general: horizontal 16:9, miniatura 1:1, mínimo 1400 × 800 px; fotos propias, sin marcas de agua, sin fotos de stock ni copiadas. [DOC] https://help.doordash.com/en-us/merchants/article/photos-terms-glossary · https://help.doordash.com/en-us/merchants/article/common-photo-issues-explained
- Tiendas por archivo: fondo blanco, ideal 2688 × 1512 (16:9), mínimo 480 × 480; el nombre del archivo de la foto es el UPC o el id del comercio. [DOC] https://developer.doordash.com/docs/marketplace/inventory_feed_integration/ifi_faq
- Por API: `https://`, pública, termina en `.jpg/.jpeg/.png`, sin parámetros de consulta. [DOC] https://developer.doordash.com/docs/marketplace/retail/catalog_management/reference

### 1.5 Artículos por peso

- `weighted_item_info`: `average_weight_per_each`, `average_weight_measurement_unit`, `shop_by_measurement_unit` (cómo lo ve el cliente), `price_by_measurement_unit` (unidades `ea`, `kg`, `lb`, `gm`, `oz`). [DOC] https://developer.doordash.com/docs/marketplace/retail/catalog_management/reference
- En el pedido cada línea trae `purchase_type`: `UNIT`, `MEASUREMENT` (por peso, con `requested_quantity` estimado) o `UNIT_TO_MEASUREMENT` (pide unidades, se cobra por peso). Tras recoger, la tienda informa el peso real con `PATCH …/orders/{id}/adjustment`; si se sale de la tolerancia, error 422. El cobro final se calcula con el peso informado. [DOC] https://developer.doordash.com/docs/marketplace/retail/how_to/weighted_items
- No publican el porcentaje de tolerancia ni el colchón de autorización de la tarjeta. [NV]

### 1.6 Inventario y disponibilidad

- Archivo de inventario: se recomienda enviarlo de madrugada (o después del proceso de lotes de la tienda) para que el inventario amanezca al día. [DOC] https://developer.doordash.com/docs/marketplace/inventory_feed_integration/ifi_faq
- Para que el repartidor encuentre el producto, el inventario puede llevar pasillo, zona, estante y lado (recomendado). [DOC] https://developer.doordash.com/docs/drive/how_to/Drive_DSX/build_for_dsx

### 1.7 Quién compra: el repartidor o la tienda

- Existen las dos modalidades: **Dasher Shop & Deliver** (el repartidor busca y paga en la tienda) y **Merchant Pick** (la tienda prepara y el repartidor solo recoge). [DOC] https://developer.doordash.com/docs/drive/how_to/Drive_DSX/build_for_dsx · https://developer.doordash.com/docs/marketplace/retail/how_to/weighted_items
- En Shop & Deliver: el UPC (preferible GTIN-14) es obligatorio para que el repartidor **escanee** cada producto; el PLU para frutas y verduras; foto mínima 1400 × 800; nombre sin abreviaturas; flujos de escaneo `single_scan`, `multi_scan`, `skip_scan` (flores sin escanear); pago en caja con un código de barras/QR de pago (`payment_barcode`). [DOC] misma dirección.
- El personal de la tienda no hace la compra por el repartidor, solo puede ayudarle a ubicar productos. [DOC] https://help.doordash.com/en-us/dashers/article/what-is-doordash-shop-deliver

### 1.8 Sustituciones

- Por cada línea el cliente elige `out_of_stock_preference`: `refund` (reembolso), `substitute` (elige hasta entre tres recomendaciones), `generic_category` (solo ciertas categorías) o `contact` (sin preferencia; hay que contactarlo). DoorDash puede fijar «sustituir» por su modelo de aprendizaje. Instrucciones por artículo de hasta 150 caracteres, que se recuerdan para el próximo pedido. [DOC] https://developer.doordash.com/docs/marketplace/how_to/substitution_preference
- En Shop & Deliver: si hay sustituto aprobado aparece al tocar «Item unavailable»; si no, el repartidor escribe o llama al cliente con opciones; si no responde, reembolso. Si la tienda no activó sustituciones, solo se marca no disponible. [DOC] https://help.doordash.com/en-us/dashers/article/what-is-doordash-shop-deliver · https://developer.doordash.com/en-US/docs/drive/how_to/Drive_DSX/how_to_subs_other_shopping_use_cases/
- Campos: `substitute_item_ids` (elegidos por el cliente) y `merchant_recommended_substitute_item_ids` (recomendados por la tienda). [DOC] https://developer.doordash.com/docs/drive/how_to/Drive_DSX/build_for_dsx

### 1.9 Productos con edad

- Alcohol en EE. UU.: verificación doble, en la app antes de pedir y **escaneo del documento al entregar**; solo mayores de 21, nunca a una persona ebria; si no, se devuelve a la tienda o se desecha responsablemente. [DOC/prensa] https://techcrunch.com/?p=2356336 (anuncio de DoorDash recogido por TechCrunch, 2022). El artículo vigente del centro de ayuda no se pudo leer. [NV]

### 1.10 Horario de la tienda

- No se encontró en esta ronda la página pública del horario de tiendas de retail en la API. [NV] Uber sí documenta horario por pasillo (ver 2.4).

---

## 2. Uber Eats (supermercado y tiendas)

### 2.1 Alta y catálogo

- **Catalog Manager** dentro de Uber Eats Manager: se buscan productos por nombre o **código de barras** en la base de Uber Eats y se agregan con su foto e información; lo que no esté se crea a mano como artículo propio. [DOC] https://merchants.ubereats.com/ec/en/resources/learning-center/catalog-manager/
- Pasillos (aisles) definidos por el comercio, no fijos. Edición masiva de precio y existencia en la pantalla principal («Review changes»). La revisión de fotos tarda hasta 3 días. [DOC] misma dirección.
- Uber ofrece a los supermercados un **catálogo universal** de productos con imágenes. [prensa] https://chainstoreage.com/uber-expands-grocery-delivery-offerings-customers-retailers
- En Australia y Nueva Zelanda los cambios masivos se hacen con una planilla Excel que entrega soporte y se aplican en 1 a 2 días hábiles. [DOC] https://www.uber.com/au/en/blog/catalogue-compliance-on-uber-eats-for-retail-merchants/ — En EE. UU. no se encontró la plantilla pública. [NV]

### 2.2 Campos (API de menú)

- `product_info`: `gtin` (UPC/EAN), `plu` (frutas y verduras), `merchant_id` (si no hay GTIN ni PLU), `target_market` (código numérico ISO 3166), `product_type`, `product_traits`, `countries_of_origin`. [DOC] https://developer.uber.com/docs/eats/references/api/v2/put-eats-stores-storeid-menu
- Venta por peso: `selling_info.selling_options[].sold_by_unit` con `measurement_type` (`COUNT`, `WEIGHT`, `VOLUME`, `LENGTH`), `quantity_constraints` (`min_permitted`, `max_permitted`, `increment`, `default_quantity`, hasta 5 decimales) y `price_info.priced_by_unit`. [DOC] misma dirección.
- Precio en centavos enteros (`price`, unidad menor de la moneda, siempre presente aunque sea 0). [DOC] misma dirección.
- Agotado: `suspension_info.suspension.suspend_until` (marca de tiempo; nulo o pasado = disponible) y `reason`. [DOC] misma dirección.
- Imagen: JPG, WEBP o PNG, menos de 25 MB, entre 320 y 6000 px por lado. [DOC] misma dirección.
- Alcohol: `dish_info.classifications.alcoholic_items` > 0 marca el artículo como alcohólico y ya no se puede desmarcar; solo en mercados habilitados. Impuestos: `tax_rate`, `vat_rate_percentage`, etiquetas como `CAT_ALCOHOL`. [DOC] misma dirección.
- No aparece un campo de tabaco ni `is_restricted` en la API pública. [DOC/NV] misma dirección.
- Algunos accesos a la API requieren aprobación escrita de Uber. [DOC] https://developer.uber.com/docs/eats/references/api/v2/post-eats-stores-storeid-menus-items-itemid

### 2.3 Inventario

- Agotado por el día (vuelve solo al día siguiente) o por más tiempo hasta reactivarlo a mano. [DOC] https://merchants.ubereats.com/ec/en/resources/learning-center/catalog-manager/

### 2.4 Horario

- Cada pasillo puede tener su propio horario y días (por ejemplo, alcohol limitado por la ley local). [DOC] misma dirección.

### 2.5 Sustituciones

- El comprador elige de una lista de reemplazos recomendados y el cliente **aprueba o rechaza** cada uno; puede mandar foto del producto agotado o en mal estado para aprobar, cambiar o reembolsar en vivo; el cliente puede editar el pedido hasta que el comprador lo mete al carrito. [DOC] https://www.uber.com/us/en/blog/built-your-way-grocery-experience/ · https://www.uber.com/newsroom/grocery-product
- Preferencias: reembolso, que el comprador elija, o alternativas indicadas por el cliente. [prensa] https://www.grocerydive.com/news/uber-eats-grocery-delivery-ecommerce-fresh-food-aldi/761356/

### 2.6 Edad

- EE. UU.: por ley local y estatal el repartidor verifica 21+ e identidad; aceptar pedidos de alcohol o tabaco es opcional para el repartidor. [DOC] https://www.uber.com/us/en/blog/alcohol-delivery/
- Australia: se fotografía el documento y un proveedor extrae los datos; sin documento válido no se entrega y se devuelve a la tienda; solo al destinatario indicado. [DOC] https://www.uber.com/au/en/blog/alcohol-delivery-with-uber-eats/

---

## 3. Rappi (Colombia) y Venezuela

### 3.1 Rappi

- Para tiendas, el equipo de retail de Rappi **construye el catálogo maestro** y el árbol de categorías; un SKU que llega en el inventario y ya está en el maestro se agrega solo a la tienda; los que no están, se ignoran (hay que pedirlos al ejecutivo). [DOC] https://rc-rappi-cpg-public-docs.web.app/docs/en-us/integration-guides/rappi-inventory
- No se puede borrar un SKU: se manda `stock = 0` y queda no disponible. [DOC] misma dirección.
- Tipo de venta `sale_type`: `U` (unidades) y `WW` (peso variable y productos transformados, precio por kg). Paquetes sin SKU propio: id `<ean>_<cantidad>`. [DOC] misma dirección.
- Dos flujos: **diario** (todo el catálogo una vez al día, de madrugada, CSV por SFTP) o **delta** (solo lo que cambió, por ventanas, por ejemplo de 10 minutos, por API). [DOC] misma dirección · https://rc-rappi-cpg-public-docs.web.app/docs/api-specs/rappi-inventory
- La API de menú de tiendas usa un SKU asignado por el aliado. [DOC] https://dev-portal.dev.rappi.com/en/managing-store-menus/
- No se encontró la plantilla pública de carga masiva para aliados de supermercado en Colombia, ni su norma de fotos, sustituciones o verificación de edad. [NV]

### 3.2 Venezuela

- Yummy pasó de comida a farmacia, compras y mercado; opera **tiendas oscuras propias** con unos 1.500 productos (datos de 2021–2022). [prensa] https://www.bloombergquint.com/onweb/venezuela-startup-expanding-quick-delivery-business-across-latam · https://forbes.co/2021/08/04/emprendedores/yummy-el-rappi-y-uber-de-los-venezolanos-en-una-sola-app/
- PedidosYa opera en Venezuela desde octubre de 2020 y tiene tiendas PedidosYa Market. [prensa] https://www.bloomberglinea.com/2022/04/18/compras-de-mercado-online-han-incrementado-80-en-venezuela-durante-los-ultimos-6-meses/
- Una parte de las compras de mercado en línea en Venezuela la hacen venezolanos en el exterior para su familia. [prensa] misma dirección. → [INF] conviene pagar desde fuera y entregar a otra persona (encaja con nuestro destinatario de Flex).
- No hay documentación pública de catálogo, campos ni sustituciones de Yummy ni de PedidosYa Market para Venezuela. [NV]
- Edad mínima para alcohol y tabaco en Colombia y Venezuela: 18 años. [INF, sin fuente leída en esta ronda: confirmar con la norma de cada país antes de programarlo]

---

## 4. Instacart (referencia de formato de archivo)

- Columnas obligatorias para todo producto: `available` (1/T/True/Y/Yes o 0/F/False/N/No), `brand_name` (100 caracteres), `cost_price_per_unit` (precio por libra o por unidad), `cost_unit` (`lb`, `kg` o `each`), `location_code` (id de la tienda), `lookup_code` (UPC con dígito verificador o PLU, como texto, nunca en notación científica), `name` (100 caracteres, sin abreviaturas), `size`, `size_uom` (each, oz, lb, mL, L, g, kg, fl oz, etc.; bebidas siempre en volumen), `unit_count` (unidades por paquete). Opcional: `retailer_reference_code` (código interno que agrupa varios códigos de barras). [DOC] https://docs.instacart.com/catalog/catalog_inventory_file/specifications/minimum-catalog-requirements
- `name`, `size`, `size_uom` y `unit_count` solo se exigen al crear el producto; si ya está en su catálogo universal se heredan. [DOC] misma dirección.
- Pesables: `par_weight` (peso promedio por unidad; obliga `cost_unit` en lb o kg; ejemplo: manzanas a 1,99 $/lb con 0,45 lb = 0,89 $ por manzana; Instacart puede ajustarlo con datos reales), `min_picked_weight`, `suggested_incremental_weight`. Dimensiones y peso del paquete obligatorios si pasa de 4 × 2 × 2 pies o 63 lb. [DOC] https://docs.instacart.com/catalog/catalog_inventory_file/specifications/additional-dimensions
- Fotos: PNG o JPG, cuadradas 1:1, recomendado 1000 × 1000, mínimo 600 × 600, máximo 4000 × 4000, menos de 3 MB, fondo blanco puro, producto al ~85 % del cuadro, sin textos añadidos; principal `remote_image_url` y extras en `additional_images_url` (JSON con ángulo: ingredientes, nutrición, medicamento, etc.). Para cambiar una foto se cambia su dirección. [DOC] https://docs.instacart.com/catalog/catalog_inventory_file/specifications/image-source-requirements
- No reutilizar códigos de producto. [DOC] https://docs.instacart.com/catalog/get_started/faq
- La plantilla completa la da un representante y se envía por SFTP. [DOC] misma dirección.

---

## 5. Cómo el cliente encuentra productos por cercanía

- **Por tienda** es el modelo base en todos: el cliente entra a una tienda y recorre sus pasillos y categorías (L1/L2… en DoorDash, aisles en Uber). [DOC] direcciones de 1.3 y 2.1. [OBS] es la estructura visible en las webs públicas de las tres.
- **Búsqueda entre tiendas**: desde noviembre de 2024 DoorDash deja buscar un artículo en varios comercios y ver precio y tiempo de entrega en una sola lista; empezó con alcohol y anunció belleza y electrónica. [prensa] https://techcrunch.com/2024/11/18/doordash-users-can-import-grocery-lists-into-the-app-to-shop-for-items-faster/
- DoorDash también sugiere productos de distintas tiendas a partir de una lista de compras importada, y DoubleDash permite sumar productos de tiendas cercanas al pedido sin cargo extra de envío. [prensa] misma dirección · [DOC] https://about.doordash.com/en-ca/news/introducing-doubledash-a-new-way-to-shop-multiple-stores-in-one-order
- Cómo ordenan «la tienda más cercana que lo tiene» (distancia, tiempo, precio o pago por posición) no está publicado. [NV] [INF] lo razonable es: filtrar tiendas abiertas que entregan en la dirección, que tengan el producto disponible (inventario por tienda), y ordenar por tiempo estimado de entrega y luego precio.

---

## 6. Datos abiertos por código de barras

- **Open Food Facts**: base bajo licencia **ODbL** (atribución y compartir igual: si se mezcla con otra base, el resultado también debe ser abierto), contenidos bajo DbCL y **fotos bajo CC BY-SA** (pueden tener elementos con derechos de terceros). [DOC] https://openfoodfacts.github.io/openfoodfacts-server/api · https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api
- Reglas de uso: User-Agent propio obligatorio («App/Versión (correo)»); límite de 15 lecturas de producto por minuto por IP y 10 búsquedas por minuto (una versión más nueva de la doc dice 100 lecturas por minuto); pasarse puede costar el bloqueo de la IP; para más de unos cientos de productos piden descargar el volcado CSV/JSONL. No usar su búsqueda para «buscar mientras se escribe». [DOC] https://openfoodfacts.github.io/openfoodfacts-server/api
- Proyectos hermanos: Open Beauty Facts, Open Pet Food Facts y Open Products Facts (para no alimentos). [DOC] misma dirección.
- [INF] Uso correcto para Divoox: autocompletar nombre, marca, tamaño y foto al escanear el UPC, **guardando la ficha en una tabla aparte marcada como «de Open Food Facts»**, con la atribución visible y sin mezclarla con nuestro catálogo propietario (para no obligar a abrir toda nuestra base por el «compartir igual»). Las fotos CC BY-SA llevan crédito. La tienda siempre puede reemplazar la foto por la suya, que es lo que piden DoorDash y Uber.

---

## 7. Tabla comparativa de campos del artículo

| Campo                         | DoorDash API                                                                             | DoorDash CSV                       | Uber Eats API            | Rappi                                                    | Instacart CSV                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------- | ------------------------ | -------------------------------------------------------- | ---------------------------------------------- |
| Id propio del comercio (SKU)  | Obligatorio                                                                              | Obligatorio (`sku`)                | Opcional (`merchant_id`) | Obligatorio (id único)                                   | Opcional (`retailer_reference_code`)           |
| Código de barras UPC/GTIN/EAN | Opcional en general; obligatorio en las verticales que no son comida y en Shop & Deliver | Obligatorio (`upc`)                | Opcional (`gtin`)        | Sí (EAN en el id de paquetes) [DOC]; obligatoriedad [NV] | Obligatorio (`lookup_code`)                    |
| PLU (frutas y verduras)       | Opcional                                                                                 | Condicional                        | Opcional                 | [NV]                                                     | Vale como `lookup_code`                        |
| Nombre                        | Obligatorio para aprobar                                                                 | Obligatorio                        | Obligatorio              | Lo arma Rappi                                            | Obligatorio al crear                           |
| Marca                         | Opcional (obligatorio en verticales)                                                     | Obligatorio                        | [NV]                     | Lo arma Rappi                                            | Obligatorio                                    |
| Tamaño y unidad               | Opcional (obligatorio en varias verticales)                                              | Obligatorio                        | Por opciones de venta    | [NV]                                                     | Obligatorio (`size`, `size_uom`, `unit_count`) |
| Precio                        | Va en inventario por tienda                                                              | Va en inventario                   | Obligatorio, en centavos | Obligatorio en inventario                                | Obligatorio                                    |
| Foto                          | Al menos una, obligatoria                                                                | Obligatoria (frente)               | Opcional                 | Lo arma Rappi                                            | Recomendada                                    |
| Categoría                     | Obligatoria                                                                              | L1 y L2 obligatorias               | Pasillo                  | Árbol de Rappi                                           | [NV] en esta ronda                             |
| Descripción                   | Opcional                                                                                 | Recomendada                        | Opcional                 | [NV]                                                     | Opcional                                       |
| Por peso                      | `weighted_item_info`                                                                     | `is_weighted_item` + peso promedio | `sold_by_unit` WEIGHT    | `sale_type = WW`                                         | `cost_unit` lb/kg + `par_weight`               |
| Alcohol / edad                | Rasgo `ALCOHOL`, `MEDICATION`                                                            | `is_alcohol`, `abv`                | `alcoholic_items`        | [NV]                                                     | Página propia de alcohol [NV]                  |
| Disponible / agotado          | Inventario por tienda                                                                    | Inventario                         | `suspension_info`        | `stock = 0`                                              | `available`                                    |
| Ubicación en la tienda        | Pasillo, zona, estante (recomendado)                                                     | —                                  | —                        | —                                                        | [NV]                                           |
| Programas (SNAP, HSA/FSA)     | `program_eligibility`                                                                    | `is_hsa_fsa_eligible`              | —                        | —                                                        | Página SNAP [NV]                               |

---

## 8. Columnas de carga masiva que debemos copiar (estándar Divoox)

Mezcla de DoorDash CSV e Instacart, que son los dos formatos publicados completos. Un archivo de **catálogo** (lo que es el producto) y uno de **inventario** (precio y existencia por tienda), como hacen los tres grandes.

**Catálogo** (una fila por producto):

1. `sku` — obligatorio, único en toda la empresa, texto.
2. `barcode` — obligatorio si el producto tiene código (UPC-A, EAN-13 o GTIN-14, como texto, con dígito verificador; se valida).
3. `secondary_barcode` — opcional.
4. `plu` — opcional, para frutas y verduras.
5. `name` — obligatorio, hasta 100 caracteres, sin abreviaturas; en el idioma del país (en EE. UU. inglés, con `name_es` opcional).
6. `brand` — obligatorio (o «Sin marca»/«Store brand»).
7. `size` — obligatorio, número.
8. `size_unit` — obligatorio: each, oz, fl oz, lb, g, kg, mL, L, gal, in, cm, m.
9. `pack_count` — obligatorio, entero (1 si es suelto).
10. `category_1`, `category_2` — obligatorias; `category_3` recomendada.
11. `image_url` — obligatoria para publicar (o se autocompleta desde el código de barras); `image_url_2…5` opcionales.
12. `description` — opcional.
13. `sold_by` — `each` | `weight`.
14. `average_weight` y `weight_unit` — obligatorios si `sold_by = weight` o si se vende por unidad y se cobra por peso.
15. `restriction` — vacío | `alcohol` | `tobacco` | `otc_medicine` | `prescription` (este último bloqueado al inicio).
16. `abv` — opcional, para alcohol.
17. `product_group_id` y `variant` — opcionales, para tallas, sabores o colores.

**Inventario** (una fila por producto y tienda):

1. `store_code` — obligatorio.
2. `sku` — obligatorio, debe existir en el catálogo.
3. `price` — obligatorio, en centavos enteros de la moneda de la tienda (USD, COP, VES/USD según el perfil del país); si es por peso, precio por unidad de peso.
4. `available` — obligatorio (1/0, sí/no, true/false).
5. `stock_quantity` — opcional.
6. `sale_price` — opcional.
7. `aisle`, `shelf` — opcionales, ayudan al repartidor que compra.

---

## 9. Estándar de inventario y sustituciones

**Inventario**

- Precio y existencia viven **por tienda**, separados de la ficha del producto (DoorDash, Uber, Rappi, Instacart). [DOC] direcciones arriba.
- Nunca se borra un producto: se marca no disponible (Rappi `stock = 0`, Uber suspensión). [DOC]
- Agotado «por hoy» que vuelve solo al día siguiente, o «hasta que lo reactive». [DOC Uber]
- Dos ritmos de actualización: archivo completo diario (de madrugada) y cambios sueltos al momento. [DOC Rappi, DoorDash]
- Horario de la tienda, y horario propio por pasillo para alcohol. [DOC Uber]

**Sustituciones**

- Por cada artículo el cliente elige: **reembolsar**, **cambiar por uno que yo elija** (hasta tres sugerencias), **que el comprador elija uno parecido**, o **contactarme**. [DOC DoorDash, Uber]
- Nota por artículo (150 caracteres) que se recuerda para el próximo pedido. [DOC DoorDash]
- Durante la compra: el cliente aprueba o rechaza cada cambio en vivo, con foto; sin respuesta antes de pagar, reembolso. [DOC Uber, DoorDash]
- Pesables: se cobra con el peso real dentro de una tolerancia; la tarjeta se autoriza por un monto estimado. [DOC DoorDash] (tolerancia [NV]).
- Escaneo del código de barras al recoger cada producto para confirmar que es el correcto. [DOC DoorDash]

---

## Decisión recomendada

1. **Dos tablas, como los grandes:** ficha del producto (una vez por empresa) y oferta por tienda (precio en centavos, disponible, existencia, pasillo). Aplica a todos los países. [INF basada en DOC]
2. **El código de barras es la llave**: se valida el dígito verificador, se guarda como texto y se usa para autocompletar, escanear al recoger y buscar entre tiendas. [INF]
3. **Alta asistida por código de barras** (como el Catalog Manager de Uber): la tienda escanea o escribe el código y se rellena nombre, marca, tamaño y foto desde nuestra base y, si no está, desde Open Food Facts / Open Products Facts, con atribución y en tabla aparte. [INF]
4. **Carga masiva por planilla CSV** con las columnas de la sección 8, con plantilla descargable en el panel y un informe de errores por fila (no se pierde nada de lo cargado). Mínimo recomendado para publicar la tienda: [INF] 50 productos con foto (DoorDash pide 200 por archivo; nuestro mercado es más chico).
5. **Fotos**: cuadradas 1:1, mínimo 600 × 600, fondo blanco, menos de 3 MB, JPG/PNG/WebP; las propias de la tienda reemplazan a las automáticas. [INF basada en DOC Instacart/DoorDash]
6. **Pesables** desde el primer día: `vendido por unidad o por peso`, peso promedio, y ajuste del cobro con el peso real dentro de una tolerancia (proponemos 10 %, [INF]) con autorización previa por un monto mayor. En Venezuela y Colombia se cobra igual en kg. [INF]
7. **Productos con edad**: marca `alcohol`/`tabaco`/`medicamento de venta libre` en el producto; verificación de edad al pedir y escaneo o foto del documento al entregar; 21+ en EE. UU., 18+ en Colombia y Venezuela (confirmar norma); sin documento no se entrega y vuelve a la tienda; horario propio por pasillo para alcohol. Medicamentos con receta: **apagados** hasta orden legal de Richard. [INF basada en DOC]
8. **Sustituciones** con las cuatro opciones por artículo, nota recordada, aprobación en vivo con foto y reembolso automático si no responde. [INF basada en DOC]
9. **Dos modalidades de preparación, con interruptor por tienda**: la tienda prepara (lo normal en Venezuela y Colombia) o el conductor compra y escanea (opción para EE. UU.). [INF]
10. **Búsqueda**: primero por tienda (pasillos y categorías); después búsqueda entre tiendas cercanas que entregan en la dirección y tienen el producto disponible, ordenadas por tiempo de entrega y precio. Empezar por categorías de compra de impulso (bebidas, farmacia), como hizo DoorDash con alcohol. [INF]
11. **Inventario**: agotado por hoy o hasta reactivar; nunca borrar; actualización por planilla diaria o al momento desde el panel/API. [INF basada en DOC]
12. Lo que queda [NV] (plantilla de Rappi Colombia, catálogo de Yummy/PedidosYa Venezuela, tolerancia exacta de peso, orden de la búsqueda entre tiendas) se completa observando con REA como visitante sus webs públicas y nuestro propio sitio de pruebas.
