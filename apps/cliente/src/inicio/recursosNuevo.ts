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
import ofertaPizza from '../../assets/inicio-nuevo/oferta-pizza.webp';
import fotoPizza from '../../assets/inicio-nuevo/foto-pizza.webp';
// C-PORTADA-SOLO-ABIERTOS: la portada de marca usa el isotipo (generado desde identidad-divoox).
import isotipo from '../../assets/comida/mascota.webp';

export const IMG_NUEVO = {
  logoOscuro,
  servicios: { comida, mercado, farmacia, licores, carro, moto, envios, flex } as Record<
    string,
    number
  >,
  carros: { estandar: carro, comfort: confort, premium: confort, xl } as Record<string, number>,
  heroes: {
    'heroe-moto': heroeMoto,
    'heroe-comida': heroeComida,
    'heroe-mercado': heroeMercado,
    'heroe-marca': isotipo,
  } as Record<string, number>,
  ofertaPizza,
  fotoPizza,
};
