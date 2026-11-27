/**
 * C-INICIO-NUEVO: ilustraciones de un solo estilo del borrador aprobado (Seedream 4, 17 nov 2026;
 * originales en progreso/borrador-inicio/img). Comida = pizza (regla de marca).
 */
import logoOscuro from '../../assets/inicio-nuevo/logo-oscuro.png';
import comida from '../../assets/inicio-nuevo/comida.webp';
import mercado from '../../assets/inicio-nuevo/mercado.webp';
import farmacia from '../../assets/inicio-nuevo/farmacia.webp';
import licores from '../../assets/inicio-nuevo/licores.webp';
import carro from '../../assets/inicio-nuevo/carro.webp';
import confort from '../../assets/inicio-nuevo/confort.webp';
import xl from '../../assets/inicio-nuevo/xl.webp';
import moto from '../../assets/inicio-nuevo/moto.webp';
import envios from '../../assets/inicio-nuevo/envios.webp';
import flex from '../../assets/inicio-nuevo/flex.webp';
import heroeMoto from '../../assets/inicio-nuevo/heroe-moto.webp';
import heroeComida from '../../assets/inicio-nuevo/heroe-comida.webp';
import heroeMercado from '../../assets/inicio-nuevo/heroe-mercado.webp';
// C-CABECERAS-MARCA (27 nov 2026): Seedream 4 + BiRefNet; fuentes en docs/disenos/cabeceras-27nov.
import heroeCarro from '../../assets/inicio-nuevo/heroe-carro.webp';
import heroeFarmacia from '../../assets/inicio-nuevo/heroe-farmacia.webp';
import heroeLicores from '../../assets/inicio-nuevo/heroe-licores.webp';
import heroeFerreteria from '../../assets/inicio-nuevo/heroe-ferreteria.webp';
import heroeEnvios from '../../assets/inicio-nuevo/heroe-envios.webp';
import heroeBilletera from '../../assets/inicio-nuevo/heroe-billetera.webp';
import heroeAliados from '../../assets/inicio-nuevo/heroe-aliados.webp';
import ofertaPizza from '../../assets/inicio-nuevo/oferta-pizza.webp';
import fotoPizza from '../../assets/inicio-nuevo/foto-pizza.webp';

import type { ImagenCabecera } from '@tumbite/compartido';

export const IMG_NUEVO = {
  logoOscuro,
  servicios: { comida, mercado, farmacia, licores, carro, moto, envios, flex } as Record<
    string,
    number
  >,
  carros: { estandar: carro, comfort: confort, premium: confort, xl } as Record<string, number>,
  // Las diez cabeceras de marca: una imagen por cada una (C-CABECERAS-MARCA).
  heroes: {
    'heroe-moto': heroeMoto,
    'heroe-carro': heroeCarro,
    'heroe-comida': heroeComida,
    'heroe-mercado': heroeMercado,
    'heroe-farmacia': heroeFarmacia,
    'heroe-licores': heroeLicores,
    'heroe-ferreteria': heroeFerreteria,
    'heroe-envios': heroeEnvios,
    'heroe-billetera': heroeBilletera,
    'heroe-aliados': heroeAliados,
  } satisfies Record<ImagenCabecera, number>,
  ofertaPizza,
  fotoPizza,
};
