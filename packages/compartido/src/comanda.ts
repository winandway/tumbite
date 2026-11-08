import { type OpcionElegida, limpiarNotaPlato, nombrePlato } from './catalogo';
import { notaSustitucion } from './tiendas';

/**
 * C-COMANDA (29 oct 2026), C-COMANDA-APP (LAN-3, 3 nov 2026) y C-COMANDA-COMPLETA (8 nov 2026):
 * la comanda impresa del restaurante, como la impresora de DoorDash Merchant y Uber Eats Manager.
 * UNA sola pieza para el panel web (impresión del navegador o impresora térmica conectada por USB o
 * puerto serie, C-IMPRESORA-NAVEGADOR) y la app del restaurante (impresión del sistema: AirPrint en
 * iPhone, servicio de impresión en Android). Dos anchos: 80 mm (el de cocina) y 58 mm.
 * Sin dinero del cliente ni su dirección: aunque el pedido los traiga, aquí no se leen. Tampoco las
 * notas del pedido (LAN-3x): son las indicaciones para el repartidor (portón, timbre, apartamento) y
 * este papel queda en la cocina y pegado a la bolsa; DoorDash Merchant y Uber Eats Manager tampoco
 * las imprimen. La nota de cada plato, la preferencia si no hay y las alergias sí van.
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
  /** Horas en UTC de la base («AAAA-MM-DD hh:mm:ss»): la del pedido y la de aceptarlo. */
  creadoEn?: string | null;
  pagadoEn?: string | null;
  aceptadoEn?: string | null;
  /** Minutos de preparación que puso el restaurante al aceptar: da la hora de listo. */
  tiempoPrepMin?: number | null;
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

/** C-COMANDA-COMPLETA: los dos anchos de papel de las impresoras térmicas. */
export type AnchoComanda = 58 | 80;
export const ANCHOS_COMANDA: readonly AnchoComanda[] = [80, 58];
/** Caracteres por renglón con la letra normal (fuente A de ESC/POS). */
export const COLUMNAS_COMANDA: Record<AnchoComanda, number> = { 58: 32, 80: 48 };

/** Una línea debajo del plato: opción, exclusión, nota o preferencia si no hay. */
export type DetalleComanda = { texto: string; fuerte: boolean };

/** Lo que sale en el papel, ya armado: lo dibujan el HTML y el ticket ESC/POS por igual. */
export type Comanda = {
  idioma: 'es' | 'en';
  restaurante: string;
  /** «PRUEBA · #A5CC» o «#ABCD». */
  titulo: string;
  modo: string;
  /** «PROGRAMADO · 7:30 p. m.» o null. */
  programado: string | null;
  cliente: string;
  horaPedido: { etiqueta: string; hora: string };
  horaListo: { etiqueta: string; hora: string } | null;
  lineas: { cantidad: number; nombre: string; detalles: DetalleComanda[] }[];
  alergias: string;
  articulos: string;
  pie: string;
};

const deSql = (s: string) => new Date(`${s.replace(' ', 'T')}Z`);

/**
 * Las exclusiones («Sin cebolla», «No onion») van en mayúscula y negrita: es lo que más se equivoca
 * en una cocina. «Con tomate» / «With tomato» se resalta igual. El resto, con «+» delante.
 */
function detalleOpcion(nombre: string): DetalleComanda {
  const sin = /^(sin|no|without|hold)\s+/i.exec(nombre);
  if (sin) return { texto: nombre.toLocaleUpperCase(), fuerte: true };
  const con = /^(con|with)\s+/i.exec(nombre);
  if (con)
    return {
      texto: `${con[1]!.toLocaleUpperCase()} ${nombre.slice(con[0].length)}`,
      fuerte: true,
    };
  return { texto: `+ ${nombre}`, fuerte: false };
}

/** C-COMANDA-COMPLETA: arma la comanda una sola vez para el HTML y para la impresora. */
export function estructuraComanda(
  p: PedidoComanda,
  restaurante: string,
  idioma: 'es' | 'en',
  ahora = new Date(),
): Comanda {
  const en = idioma === 'en';
  const reloj = (d: Date, conDia = false) =>
    d.toLocaleString(en ? 'en-US' : 'es-US', {
      hour: 'numeric',
      minute: '2-digit',
      ...(conDia ? { day: 'numeric', month: 'short' } : {}),
    });
  const tipo =
    p.entrega === 'recoger'
      ? en
        ? 'PICKUP'
        : 'RECOGE EN EL LOCAL'
      : en
        ? 'DELIVERY'
        : 'A DOMICILIO';
  const modo = p.prueba ? `${en ? 'TEST ORDER' : 'PEDIDO DE PRUEBA'} · ${tipo}` : tipo;
  // El mismo número que la pantalla: el pedido de prueba («prueba-…») se numera después del prefijo.
  const numero = p.prueba ? p.id.slice(7, 11).toUpperCase() : p.id.slice(0, 4).toUpperCase();
  const marca = p.prueba ? (en ? 'TEST · ' : 'PRUEBA · ') : '';
  const pedidoEn = p.pagadoEn || p.creadoEn;
  const listo =
    p.aceptadoEn && p.tiempoPrepMin
      ? new Date(deSql(p.aceptadoEn).getTime() + p.tiempoPrepMin * 60_000)
      : null;
  const lineas = p.lineas.map((l) => {
    const detalles: DetalleComanda[] = (l.opciones ?? [])
      .map((o) => nombrePlato(o, idioma))
      .filter(Boolean)
      .map(detalleOpcion);
    const nota = limpiarNotaPlato(l.nota);
    if (nota) detalles.push({ texto: `${en ? 'Note' : 'Nota'}: ${nota}`, fuerte: true });
    const sust = notaSustitucion(l, idioma);
    if (sust) detalles.push({ texto: sust, fuerte: false });
    return { cantidad: l.cantidad, nombre: nombrePlato(l, idioma), detalles };
  });
  const total = p.lineas.reduce((s, l) => s + l.cantidad, 0);
  return {
    idioma,
    restaurante: restaurante.trim(),
    titulo: `${marca}#${numero}`,
    modo,
    programado: p.programadoPara
      ? `${en ? 'SCHEDULED' : 'PROGRAMADO'} · ${reloj(deSql(p.programadoPara), true)}`
      : null,
    cliente: nombreCorto(p.clienteCorto),
    horaPedido: {
      etiqueta: en ? 'Ordered' : 'Pedido',
      hora: reloj(pedidoEn ? deSql(pedidoEn) : ahora, true),
    },
    horaListo: listo ? { etiqueta: en ? 'Ready by' : 'Listo a las', hora: reloj(listo) } : null,
    lineas,
    alergias: (p.alergias ?? '').trim(),
    articulos: en
      ? `${total} ${total === 1 ? 'item' : 'items'}`
      : `${total} ${total === 1 ? 'artículo' : 'artículos'}`,
    pie: 'Divoox',
  };
}

const SEGUROS = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
]);
const escapar = (t: string) => t.replace(/[&<>"']/g, (ch) => SEGUROS.get(ch) ?? ch);

/** Medidas de cada ancho: papel, área impresa y letra. */
const MEDIDAS: Record<AnchoComanda, { area: string; margen: string; letra: number }> = {
  80: { area: '72mm', margen: '4mm', letra: 13 },
  58: { area: '50mm', margen: '2mm', letra: 11 },
};

export function htmlComanda(
  p: PedidoComanda,
  restaurante: string,
  idioma: 'es' | 'en',
  ahora = new Date(),
  opciones: { imprimirAlAbrir?: boolean; ancho?: AnchoComanda } = {},
) {
  const c = estructuraComanda(p, restaurante, idioma, ahora);
  const ancho: AnchoComanda = opciones.ancho === 58 ? 58 : 80;
  const m = ancho === 58 ? MEDIDAS[58] : MEDIDAS[80];
  const l = m.letra;
  const lineas = c.lineas
    .map(
      (x) =>
        `<tr><td class="c">${x.cantidad}×</td><td><div class="p">${escapar(x.nombre)}</div>${x.detalles
          .map((d) => `<div class="d${d.fuerte ? ' f' : ''}">${escapar(d.texto)}</div>`)
          .join('')}</td></tr>`,
    )
    .join('');
  const horas = [c.horaPedido, c.horaListo]
    .filter((h): h is { etiqueta: string; hora: string } => Boolean(h))
    .map((h) => `<div>${escapar(h.etiqueta)}: <b>${escapar(h.hora)}</b></div>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapar(c.titulo)}</title>
<style>@page{size:${ancho}mm auto;margin:${m.margen}}*{box-sizing:border-box}body{font-family:monospace;font-size:${l}px;width:${m.area};margin:0;color:#000}
.r{text-align:center;font-weight:bold;font-size:${l + 2}px;margin:0 0 2px}h1{font-size:${l * 2}px;text-align:center;margin:2px 0}
h2{font-size:${l + 1}px;text-align:center;margin:4px 0;padding:3px 0;border-top:2px solid #000;border-bottom:2px solid #000}
.cl{font-size:${l + 4}px;font-weight:bold;margin:6px 0 2px}table{width:100%;border-collapse:collapse;margin-top:6px;border-top:1px dashed #000}
td{padding:4px 0;vertical-align:top;border-bottom:1px dashed #000}.c{width:${l * 3}px;font-weight:bold;font-size:${l + 5}px}
.p{font-weight:bold;font-size:${l + 2}px}.d{padding-left:10px}.f{font-weight:bold}
.n{border:2px solid #000;margin-top:8px;padding:4px;font-weight:bold}.t{margin-top:6px;font-weight:bold}.pie{text-align:center;margin-top:8px}</style>
</head><body>${c.restaurante ? `<div class="r">${escapar(c.restaurante)}</div>` : ''}<h1>${escapar(c.titulo)}</h1>
<h2>${escapar(c.modo)}${c.programado ? `<br>${escapar(c.programado)}` : ''}</h2>${c.cliente ? `<div class="cl">${escapar(c.cliente)}</div>` : ''}${horas}
<table>${lineas}</table>
${c.alergias ? `<div class="n">*** ${idioma === 'en' ? 'ALLERGY' : 'ALERGIA'}: ${escapar(c.alergias)} ***</div>` : ''}
<div class="t">${escapar(c.articulos)}</div><div class="pie">${escapar(c.pie)}</div>
${opciones.imprimirAlAbrir ? '<script>window.onload=function(){window.print();setTimeout(function(){window.close()},500)}</script>' : ''}</body></html>`;
}
