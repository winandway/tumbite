import { Image } from 'react-native';
import comida from '../../assets/servicios/comida.webp';
import moto from '../../assets/servicios/moto.webp';
import carro from '../../assets/servicios/carro.webp';
import envios from '../../assets/servicios/envios.webp';
import flex from '../../assets/servicios/flex.webp';

/**
 * C-ICONOS-SERVICIO (Richard, 18 nov 2026; todos los países): cada servicio de Driver lleva el MISMO
 * dibujo que el cliente (copias byte a byte de apps/cliente/assets/inicio-nuevo). «Moto con
 * pasajero» llevaba una bicicleta. El candado servicios/iconosServicio.test.ts compara los archivos.
 */
export const DIBUJOS_SERVICIO: ReadonlyMap<string, number> = new Map([
  ['comida', comida],
  ['moto', moto],
  ['carro', carro],
  ['envios', envios],
  ['flex', flex],
]);

export function IconoServicio({ id, tamano = 36 }: { id: string; tamano?: number }) {
  const fuente = DIBUJOS_SERVICIO.get(id) ?? envios;
  return (
    <Image
      source={fuente}
      style={{ width: tamano, height: tamano }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      accessible={false}
    />
  );
}
