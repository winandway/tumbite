import { type OpcionElegida, textoLinea } from '@tumbite/compartido';

/**
 * C-COMANDA (29 oct 2026): la comanda impresa del restaurante, como la impresora de DoorDash y
 * Uber Eats. Usa la impresión del navegador en formato de 80 mm (sirve con cualquier impresora
 * térmica instalada en la computadora o la tableta). Sin dinero del cliente ni su dirección.
 */
export type PedidoComanda = {
  id: string;
  entrega?: 'puerta' | 'mano' | 'recoger';
  notas: string;
  programadoPara?: string | null;
  lineas: {
    nombreEs: string;
    nombreEn: string;
    cantidad: number;
    opciones?: OpcionElegida[];
    sustitucion?: string;
  }[];
};

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
  return `<!doctype html><html><head><meta charset="utf-8"><title>#${p.id.slice(0, 4).toUpperCase()}</title>
<style>@page{size:80mm auto;margin:4mm}body{font-family:monospace;font-size:13px;width:72mm;margin:0}
h1{font-size:22px;margin:0 0 4px}h2{font-size:14px;margin:6px 0}table{width:100%;border-collapse:collapse}
td{padding:3px 0;vertical-align:top}.c{width:34px;font-weight:bold}.n{border-top:1px dashed #000;margin-top:8px;padding-top:6px}</style>
</head><body><h1>#${p.id.slice(0, 4).toUpperCase()}</h1>${restaurante ? `<div>${escapar(restaurante)}</div>` : ''}<div>${escapar(hora)}</div>
<h2>${modo}${p.programadoPara ? (en ? ' · SCHEDULED' : ' · PROGRAMADO') : ''}</h2><table>${lineas}</table>
${p.notas ? `<div class="n"><b>${en ? 'Notes' : 'Notas'}:</b> ${escapar(p.notas)}</div>` : ''}
<script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}</script></body></html>`;
}

/** Abre la comanda en una ventana y lanza la impresión. */
export function imprimirComanda(p: PedidoComanda, restaurante: string, idioma: 'es' | 'en') {
  const v = window.open('', '_blank', 'width=360,height=600');
  if (!v) return false;
  v.document.open();
  v.document.write(htmlComanda(p, restaurante, idioma));
  v.document.close();
  return true;
}
