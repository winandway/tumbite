import type { ConfigDinero } from './bolsillos';
import { formatearMonto } from './dinero';
import type { Idioma } from './idiomas';

/**
 * «¿Qué son estas tarifas?» del carrito (C-TARIFAS-EXPLICADAS), como «Fees & Estimated Tax» de
 * DoorDash y «Fees» de Uber Eats: qué es cada cargo, con los números reales de la configuración del
 * país del restaurante (nunca un número escrito a mano que se quede viejo). Lógica pura.
 */
export type CargoExplicado = {
  clave: 'envio' | 'servicio' | 'pequeno' | 'impuesto' | 'propina';
  texto: string;
};

const pct = (pb: number) => `${(pb / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })} %`;

export function explicarTarifas(c: ConfigDinero, moneda: string, idioma: Idioma): CargoExplicado[] {
  const m = (centavos: number) => formatearMonto(centavos, moneda, idioma);
  const en = idioma === 'en';
  const lista: CargoExplicado[] = [
    {
      clave: 'envio',
      texto: en
        ? `Delivery: starts at ${m(c.envioBase)} for the first ${c.envioKmIncluidos} km and adds ${m(c.envioPorKm)} per extra km, up to ${m(c.envioMaximo)}. It helps pay your driver.`
        : `Envío: desde ${m(c.envioBase)} los primeros ${c.envioKmIncluidos} km y ${m(c.envioPorKm)} por cada km de más, hasta ${m(c.envioMaximo)}. Ayuda a pagarle a tu repartidor.`,
    },
    {
      clave: 'servicio',
      texto: en
        ? `Service fee: ${pct(c.servicioPb)} of your subtotal (at least ${m(c.servicioMinimo)}, at most ${m(c.servicioMaximo)}). It keeps Divoox running: support, safety, and payments.`
        : `Tarifa de servicio: el ${pct(c.servicioPb)} de tu subtotal (mínimo ${m(c.servicioMinimo)}, máximo ${m(c.servicioMaximo)}). Mantiene Divoox funcionando: soporte, seguridad y pagos.`,
    },
    {
      clave: 'pequeno',
      texto: en
        ? `Small order fee: ${m(c.cargoPedidoPequeno)}, only when your subtotal is under ${m(c.pedidoMinimo)}. Add a bit more and it goes away.`
        : `Cargo por pedido pequeño: ${m(c.cargoPedidoPequeno)}, solo si tu subtotal no llega a ${m(c.pedidoMinimo)}. Si sumas un poco más, desaparece.`,
    },
  ];
  if ((c.impuestoPb ?? 0) > 0)
    lista.push({
      clave: 'impuesto',
      texto: en
        ? `Tax: what the law in your area requires; Divoox doesn’t keep it.`
        : `Impuesto: el que exige la ley de tu zona; Divoox no se queda con él.`,
    });
  lista.push({
    clave: 'propina',
    texto: en
      ? `Tip: 100% goes to your driver. You can change it before paying.`
      : `Propina: el 100 % es para tu repartidor. Puedes cambiarla antes de pagar.`,
  });
  return lista;
}
