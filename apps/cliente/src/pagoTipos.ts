export type Cobro = {
  pedidoId: string;
  clientSecret: string;
  sesionCliente: string;
  clienteStripe: string;
};

export type PropsPago = {
  cobro: Cobro;
  clavePublica: string;
  idioma: 'es' | 'en';
  textos: { pagar: string };
  alPagar: () => void;
};
