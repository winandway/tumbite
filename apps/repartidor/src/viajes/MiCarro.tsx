import { AltaPasajeros } from './AltaPasajeros';

/**
 * Divoox Carro (13 nov 2026, C-CARRO-ALTA-DRIVER) — Venezuela y EE. UU. El alta del taxista: ciudad,
 * carro (con sus plazas: 4, o 6 para Carro XL), papeles del carro y los suyos según su país, estado de
 * la aprobación y el interruptor para recibir viajes de Carro. Pieza común con Divoox Moto.
 */
export function MiCarro() {
  return <AltaPasajeros servicio="carro" />;
}
