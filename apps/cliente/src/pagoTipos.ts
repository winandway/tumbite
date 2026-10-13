export type Cobro = {
  pedidoId: string;
  clientSecret: string;
  sesionCliente: string;
  clienteStripe: string;
  clavePublica?: string;
};

export type PropsPago = {
  cobro: Cobro;
  clavePublica: string;
  idioma: 'es' | 'en';
  textos: { pagar: string; cargando: string; sinFormulario: string; reintentar: string };
  alPagar: () => void;
};
