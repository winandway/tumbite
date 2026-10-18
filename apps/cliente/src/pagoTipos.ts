export type Cobro = {
  pedidoId: string;
  clientSecret: string;
  sesionCliente: string;
  clienteStripe: string;
  clavePublica?: string;
  /** El cálculo del servidor; su total es el que manda. */
  desglose?: { totalCliente: number };
  /** Cobro directo (efectivo o transferencia al repartidor): no hay formulario de tarjeta. */
  directo?: boolean;
};

export type PropsPago = {
  cobro: Cobro;
  clavePublica: string;
  idioma: 'es' | 'en';
  textos: { pagar: string; cargando: string; sinFormulario: string; reintentar: string };
  alPagar: () => void;
};
