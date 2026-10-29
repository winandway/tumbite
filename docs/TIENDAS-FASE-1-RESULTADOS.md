# Tiendas · Fase 1: el catálogo

**Fecha:** 28 oct 2026 · **Rama:** `fase-tiendas-1` · **País:** todos (abre en EE. UU., Venezuela y Colombia) · **Candado:** C-TIENDAS-CATALOGO.

## En una frase

Los supermercados, farmacias, licorerías, ferreterías y demás tiendas ya pueden entrar al panel, elegir su tipo de negocio y subir su catálogo con la planilla estándar o uno por uno. El público todavía no lo ve: queda listo para el lanzamiento.

## De dónde sale

Se estudió el proceso completo de DoorDash, Uber Eats, Rappi e Instacart: REA sobre las páginas públicas de DoorDash para comercios, y su documentación pública. Hay dos documentos en la carpeta investigaciones-rea: el informe de fuentes públicas de tiendas y su evidencia.

## Qué quedó hecho

| Pieza            | Qué hace                                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tipo de negocio  | Restaurante, supermercado, conveniencia, farmacia, licorería, ferretería, mascotas, belleza u otra tienda. Cada uno sale en su servicio: Mercado, Farmacia, Licores o Más.                                            |
| Ficha y oferta   | La ficha del producto va aparte del precio y la existencia de la tienda, como los grandes.                                                                                                                            |
| Código de barras | Se valida con su dígito verificador. Se busca por código, SKU, nombre o marca.                                                                                                                                        |
| Planilla         | Las columnas estándar de DoorDash e Instacart, en inglés o en español. Vista previa con lo que se crea, lo que se actualiza y el error de cada fila. Actualiza por SKU, nunca duplica. Hasta 5.000 filas por archivo. |
| Inventario       | Agotado por hoy (vuelve solo) o hasta reactivar. Nunca se borra.                                                                                                                                                      |
| Restricciones    | Alcohol, tabaco y medicamentos de venta libre marcados. Los medicamentos con receta siguen bloqueados.                                                                                                                |
| Panel            | Pantalla «Productos (tienda)» con todo lo anterior.                                                                                                                                                                   |
| Docs y web       | Guía «Sube el catálogo de tu tienda» en los dos idiomas con captura real, y un bloque en la portada para tiendas.                                                                                                     |

## Lo que falta (siguientes fases)

- **Vitrina:** las tiendas cerca del cliente, con pasillos y buscador dentro de cada tienda.
- **Compra:** carrito, pago, la tienda prepara el pedido, sustituciones con cuatro opciones, productos por peso y edad al entregar.
- **Búsqueda entre tiendas y alta por código de barras** con Open Food Facts.

## Lo que decide Richard

- La edad mínima para alcohol en Colombia y Venezuela. El informe supone 18, sin norma leída.
- Cuándo se encienden las tiendas para el público en cada país.
