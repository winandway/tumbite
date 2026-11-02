import { montoATexto } from './dinero';

/**
 * Planillas CSV (C-PLANILLA-PEDIDOS, C-PLANILLA-GANANCIAS). Celda segura: comillas dobladas y sin
 * fórmulas (=, +, -, @) que una hoja de cálculo ejecutaría al abrirla. Lógica pura.
 */
export function celdaCsv(v: string | number): string {
  const t = String(v);
  const segura = /^[=+\-@]/.test(t) && typeof v === 'string' ? `'${t}` : t;
  return /[",\n]/.test(segura) ? `"${segura.replace(/"/g, '""')}"` : segura;
}

/** Las ganancias del repartidor, una fila por entrega, como el estado de cuenta de Uber Driver. */
export function planillaGanancias(
  pedidos: {
    codigo: string;
    restaurante: string;
    entregadoEn: string;
    moneda?: string;
    base: number;
    bono: number;
    propina: number;
    propinaPosterior: number;
    total: number;
  }[],
): string {
  return [
    'fecha,pedido,restaurante,moneda,base,bonos,propinas,total',
    ...pedidos.map((p) => {
      const m = p.moneda ?? 'USD';
      return [
        p.entregadoEn,
        p.codigo,
        p.restaurante,
        m,
        montoATexto(p.base, m),
        montoATexto(p.bono, m),
        montoATexto(p.propina + p.propinaPosterior, m),
        montoATexto(p.total, m),
      ]
        .map(celdaCsv)
        .join(',');
    }),
  ].join('\n');
}
