import { nombreFormaPago } from '@tumbite/compartido';
/**
 * C-CIUDAD-REPORTE (13 nov 2026, todos los países): el reporte de los jugadores de la ciudad de
 * pruebas se arma en el navegador con lo que la pantalla ya tiene y se descarga como CSV. No
 * escribe nada en la base ni pide nada nuevo al servidor.
 */
type Fallo = { cuando: string; pedido?: string; comportamiento: string; mensaje: string };
type PedidoJugador = {
  id: string;
  estado: string;
  total: number;
  moneda: string;
  metodoPago: string;
  restaurante: string;
  platos: string[];
  creadoEn: string;
  minutos: number | null;
};
export type JugadorReporte = {
  nombre: string;
  gastado: number;
  moneda: string;
  fallos: Fallo[];
  pedidos: PedidoJugador[];
};

const ENCABEZADOS = {
  es: 'jugador,tipo,hora,restaurante,estado,platos,total,moneda,pago,minutos,detalle',
  en: 'player,type,time,restaurant,status,items,total,currency,payment,minutes,detail',
};

/** Una celda CSV: comillas si hace falta, y nunca una fórmula (=, +, -, @) en la hoja de cálculo. */
function celda(v: string | number | null | undefined): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) || s.startsWith("'") ? `"${s.replace(/"/g, '""')}"` : s;
}

const monto = (centavos: number) => (centavos / 100).toFixed(2);

export function reporteJugadoresCsv(jugadores: JugadorReporte[], idioma: 'es' | 'en'): string {
  const filas = [idioma === 'en' ? ENCABEZADOS.en : ENCABEZADOS.es];
  for (const j of jugadores) {
    for (const p of j.pedidos)
      filas.push(
        [
          j.nombre,
          idioma === 'en' ? 'order' : 'pedido',
          p.creadoEn,
          p.restaurante,
          p.estado,
          p.platos.join(' + '),
          monto(p.total),
          p.moneda,
          nombreFormaPago(p.metodoPago, idioma),
          p.minutos,
          '',
        ]
          .map(celda)
          .join(','),
      );
    for (const f of j.fallos)
      filas.push(
        [
          j.nombre,
          idioma === 'en' ? 'failure' : 'fallo',
          f.cuando,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          `${f.comportamiento}: ${f.mensaje}`,
        ]
          .map(celda)
          .join(','),
      );
  }
  return `${filas.join('\n')}\n`;
}

export const nombreReporte = (sesion: string) => `ciudad-${sesion}.csv`;

/** Marca de orden de bytes: Excel abre el CSV en UTF-8 (acentos bien). */
const BOM = String.fromCharCode(0xfeff);

/** Descarga un texto como archivo, sin servidor (Blob + enlace temporal). */
export function descargarTexto(nombre: string, contenido: string, tipo = 'text/csv') {
  const url = URL.createObjectURL(
    new Blob([`${BOM}${contenido}`], { type: `${tipo};charset=utf-8` }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
