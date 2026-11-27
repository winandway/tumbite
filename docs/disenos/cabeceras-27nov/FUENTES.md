# Cabeceras de marca del inicio del cliente — fuentes y licencia (27 nov 2026)

Orden de Richard vía Gerencia (27 nov 2026): que la cabecera de la app de clientes muestre todo lo que
hace Divoox, con imágenes serias; una moto de trabajo real (nunca la Vespa); diez cabeceras que rotan.
Candados: C-CABECERAS-MARCA, C-CABECERA-SOLO-ABIERTOS, C-CABECERA-ROTA, C-MOTO-SERIA.

## Cómo se hicieron

- **Modelo:** Seedream 4 en fal.ai (`fal-ai/bytedance/seedream/v4/text-to-image`, unos 3 centavos por
  imagen), el modelo barato aprobado en `apps/servidor/src/modeloGuard.ts`. Ningún modelo caro.
- **Fondo:** quitado con BiRefNet (`fal-ai/birefnet`).
- **Generador:** `scripts/banners/generar-cabeceras.mjs` (los textos de cada imagen están ahí).
- **Costo:** 21 imágenes generadas (dos o tres opciones por cabecera), unos 65 centavos en total.
- **Licencia:** imágenes generadas para Windoce LLC con su cuenta de fal.ai; los términos de fal.ai y
  de ByteDance Seedream permiten el uso comercial del resultado. No son fotos de stock de terceros.
- **Revisión:** sin marcas reales, sin personas, sin placas con texto y sin la marca de ningún
  fabricante de motos. La moto traía unas letras inventadas en la tapa lateral: se borraron a mano.
- Comida (pizza) y Mercado (canasta) reutilizan las imágenes del borrador del inicio aprobado el
  17 nov 2026 (también Seedream 4).

## Las diez

| Id               | Imagen en la app      | Sale solo si está abierto     | Titular (es / en)                                                                |
| ---------------- | --------------------- | ----------------------------- | -------------------------------------------------------------------------------- |
| marca-moto       | heroe-moto.webp       | Moto                          | Tu mototaxi llega en minutos / Your motorcycle ride, in minutes                  |
| marca-comida     | heroe-comida.webp     | Comida                        | Tus pedidos favoritos, más cerca / Your favorite orders, closer                  |
| marca-carro      | heroe-carro.webp      | Carro                         | Viaja cómodo en carro, a donde quieras / Ride in comfort, wherever you go        |
| marca-mercado    | heroe-mercado.webp    | Mercado                       | Tu mercado en casa, en minutos / Your groceries at home, in minutes              |
| marca-envios     | heroe-envios.webp     | Envíos                        | Envía lo que necesites, hoy mismo / Send what you need, today                    |
| marca-farmacia   | heroe-farmacia.webp   | Farmacia                      | Lo de la farmacia, directo a tu puerta / Pharmacy essentials, right to your door |
| marca-billetera  | heroe-billetera.webp  | cualquier servicio            | Paga con tu saldo Divoox en un toque / Pay with your Divoox balance in one tap   |
| marca-ferreteria | heroe-ferreteria.webp | Más (tiendas)                 | Herramientas y materiales para tu obra / Tools and supplies for every project    |
| marca-licores    | heroe-licores.webp    | Licores                       | Tus bebidas para la ocasión, a domicilio / Drinks for every occasion, delivered  |
| marca-aliados    | heroe-aliados.webp    | siempre (no promete servicio) | Comercios aliados que crecen con Divoox / Local businesses growing with Divoox   |

Las originales a 1024 px están en esta carpeta (`heroe-*.webp`). En la app van a 520 px de ancho
(el doble de lo que ocupan en un teléfono), en WebP, de 18 a 50 KB cada una.

## El ícono de Moto

La misma moto de 150 cc (`moto.webp`, 260 px) reemplaza la Vespa en la cuadrícula del cliente, en los
íconos viejos del cliente y de la Driver (`servicio-moto.png`), en el ícono de servicios de la Driver y
en el borrador del inicio de la página de progreso. Las motos de reparto con caja (flota) no cambian.
