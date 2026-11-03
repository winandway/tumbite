import { type OpcionElegida, textoLinea } from './catalogo';

/**
 * C-COMANDA (29 oct 2026) y C-COMANDA-APP (LAN-3, 3 nov 2026): la comanda impresa del restaurante,
 * como la impresora de DoorDash Merchant y Uber Eats Manager. UNA sola pieza para el panel web
 * (impresión del navegador) y la app del restaurante (impresión del sistema: AirPrint en iPhone,
 * servicio de impresión en Android). Formato de 80 mm, el de las impresoras térmicas de cocina.
 * Sin dinero del cliente ni su dirección: aunque el pedido los traiga, aquí no se leen. Tampoco las
 * notas del pedido (LAN-3x): son las indicaciones para el repartidor (portón, timbre, apartamento) y
 * este papel queda en la cocina y pegado a la bolsa; DoorDash Merchant y Uber Eats Manager tampoco
 * las imprimen. La nota de cada plato y las alergias sí van.
 */
export type PedidoComanda = {
  id: string;
  /** C-PEDIDO-PRUEBA: el de práctica lleva su marca y el número que se ve en la pantalla. */
  prueba?: boolean;
  entrega?: 'puerta' | 'mano' | 'recoger';
  /** LAN-3y: el nombre del cliente; la comanda solo imprime nombre e inicial (`nombreCorto`). */
  clienteCorto?: string | null;
  /** Indicaciones para el repartidor: NO se imprimen (LAN-3x). */
  notas?: string;
  alergias?: string;
  programadoPara?: string | null;
  lineas: {
    nombreEs: string;
    nombreEn: string;
    cantidad: number;
    opciones?: OpcionElegida[];
    /** La nota del plato («sin cebolla»): sí va, la necesita la cocina. */
    nota?: string | null;
    sustitucion?: string;
    reemplazo?: { nombreEs?: string; nombreEn?: string } | null;
  }[];
};

/**
 * LAN-3y: como DoorDash Merchant y Uber Eats Manager, la bolsa lleva el nombre corto del cliente
 * para que el repartidor la encuentre: el primer nombre y la inicial del apellido («Ana G.»). Nunca
 * el apellido completo ni el teléfono.
 */
export function nombreCorto(nombre: string | null | undefined): string {
  const partes = String(nombre ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return '';
  const mayus = (t: string) => t.charAt(0).toLocaleUpperCase() + t.slice(1);
  const primero = mayus(partes[0]!);
  // Solo hay una casilla de nombre: la inicial es la de la segunda palabra («Ana García» →
  // «Ana G.»). Nunca sale una palabra entera más allá del primer nombre.
  const apellido = partes[1];
  return apellido ? `${primero} ${apellido.charAt(0).toLocaleUpperCase()}.` : primero;
}

/** 80 mm en puntos de impresión (72 por pulgada): el ancho que se le pide a la impresión del sistema. */
export const ANCHO_COMANDA_PUNTOS = 227;

const SEGUROS = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
]);
const escapar = (t: string) => t.replace(/[&<>"']/g, (ch) => SEGUROS.get(ch) ?? ch);

export function htmlComanda(
  p: PedidoComanda,
  restaurante: string,
  idioma: 'es' | 'en',
  ahora = new Date(),
  opciones: { imprimirAlAbrir?: boolean } = {},
) {
  const en = idioma === 'en';
  const modo =
    p.entrega === 'recoger'
      ? en
        ? 'PICKUP'
        : 'RECOGE EN EL LOCAL'
      : en
        ? 'DELIVERY'
        : 'A DOMICILIO';
  const hora = ahora.toLocaleString(en ? 'en-US' : 'es-US', {
    hour: 'numeric',
    minute: '2-digit',
    day: 'numeric',
    month: 'short',
  });
  const lineas = p.lineas
    .map(
      (l) => `<tr><td class="c">${l.cantidad}×</td><td>${escapar(textoLinea(l, idioma))}</td></tr>`,
    )
    .join('');
  // El mismo número que la pantalla: el pedido de prueba («prueba-…») se numera después del prefijo.
  const numero = p.prueba ? p.id.slice(7, 11).toUpperCase() : p.id.slice(0, 4).toUpperCase();
  const cliente = nombreCorto(p.clienteCorto);
  const marca = p.prueba ? (en ? 'TEST · ' : 'PRUEBA · ') : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>${marca}#${numero}</title>
<style>@page{size:80mm auto;margin:4mm}body{font-family:monospace;font-size:13px;width:72mm;margin:0}
h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;margin:6px 0}table{width:100%;border-collapse:collapse}
td{padding:3px 0;vertical-align:top}.c{width:34px;font-weight:bold}.n{border-top:1px dashed #000;margin-top:8px;padding-top:6px}</style>
</head><body><h1>${marca}#${numero}</h1>${restaurante ? `<div>${escapar(restaurante)}</div>` : ''}${cliente ? `<div class="cl"><b>${escapar(cliente)}</b></div>` : ''}<div>${escapar(hora)}</div>
<h2>${modo}${p.programadoPara ? (en ? ' · SCHEDULED' : ' · PROGRAMADO') : ''}</h2><table>${lineas}</table>
${p.alergias ? `<div class="n"><b>*** ${en ? 'ALLERGY' : 'ALERGIA'}: ${escapar(p.alergias)} ***</b></div>` : ''}
${opciones.imprimirAlAbrir ? '<script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}</script>' : ''}</body></html>`;
}
