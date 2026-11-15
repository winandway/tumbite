/**
 * C-DOCS-BUSCADOR-BILINGUE (15 nov 2026): las palabras que la gente usa en los dos idiomas.
 *
 * En español mucha gente escribe «wallet», «tracking» o «top up», y en inglés alguien puede
 * escribir «billetera». Cada grupo junta las palabras que significan lo mismo para buscar en Docs:
 * si se escribe una, el buscador busca también las demás. Todo va sin acentos y en minúsculas
 * (el buscador normaliza lo escrito igual). Una frase de varias palabras («top up», «pago movil»)
 * cuenta como una sola idea.
 *
 * Para sumar una palabra: se agrega al grupo que corresponde (o un grupo nuevo) y se suma su
 * ejemplo a la prueba de `guiasSemana.test.ts`, bloque «C-DOCS-BUSCADOR».
 */
export const SINONIMOS: readonly (readonly string[])[] = [
  ['wallet', 'billetera', 'monedero', 'cartera'],
  ['balance', 'saldo'],
  ['tracking', 'track', 'rastreo', 'rastrear', 'seguimiento', 'seguir', 'localizar'],
  ['top up', 'topup', 'top-up', 'reload', 'recargar', 'recarga', 'recargas'],
  [
    'driver',
    'drivers',
    'dasher',
    'courier',
    'repartidor',
    'repartidores',
    'conductor',
    'conductores',
    'chofer',
    'taxista',
  ],
  ['delivery', 'deliveries', 'deliver', 'entrega', 'entregas', 'entregar', 'reparto', 'domicilio'],
  ['payout', 'payouts', 'withdraw', 'withdrawal', 'cash out', 'retiro', 'retiros', 'retirar'],
  ['deposit', 'deposito', 'abono'],
  ['tip', 'tips', 'propina', 'propinas'],
  ['pago movil', 'mobile payment'],
  // Zelle y la transferencia son pagos locales: en inglés llevan a la guía de «Local payment».
  ['zelle', 'local payment', 'pago local', 'transferencia', 'bank transfer'],
  ['cash', 'efectivo'],
  ['card', 'cards', 'tarjeta', 'tarjetas'],
  ['payment', 'payments', 'pay', 'pago', 'pagos', 'pagar', 'cobro', 'cobrar'],
  ['order', 'orders', 'pedido', 'pedidos', 'orden', 'ordenes', 'ordenar'],
  ['restaurant', 'restaurants', 'restaurante', 'restaurantes', 'merchant', 'comercio'],
  ['refund', 'refunds', 'reembolso', 'reembolsos', 'devolucion', 'devoluciones'],
  ['receipt', 'receipts', 'invoice', 'recibo', 'recibos', 'comprobante', 'comprobantes', 'factura'],
  ['commission', 'commissions', 'fee', 'fees', 'comision', 'comisiones'],
  ['earnings', 'ganancias', 'ganar', 'earn'],
  ['account', 'cuenta'],
  ['sign up', 'signup', 'register', 'registro', 'registrarse', 'alta'],
  ['log in', 'login', 'sign in', 'entrar', 'iniciar sesion'],
  ['password', 'contrasena', 'clave'],
  ['ride', 'rides', 'trip', 'viaje', 'viajes'],
  ['car', 'cars', 'carro', 'auto', 'coche', 'taxi'],
  ['moto', 'motorcycle', 'motorbike', 'mototaxi', 'motocicleta'],
  ['package', 'packages', 'parcel', 'paquete', 'paquetes'],
  ['shipping', 'shipment', 'ship', 'send', 'envio', 'envios', 'enviar'],
  ['label', 'labels', 'etiqueta', 'etiquetas'],
  ['route', 'routes', 'ruta', 'rutas'],
  ['support', 'help', 'soporte', 'ayuda'],
  ['schedule', 'scheduled', 'programar', 'programado', 'reservar'],
  [
    'coupon',
    'coupons',
    'promo',
    'promotion',
    'discount',
    'cupon',
    'cupones',
    'promocion',
    'descuento',
  ],
  ['notification', 'notifications', 'alert', 'aviso', 'avisos', 'notificacion', 'alerta'],
  ['map', 'maps', 'mapa', 'mapas'],
  ['store', 'stores', 'shop', 'grocery', 'tienda', 'tiendas', 'supermercado', 'mercado'],
  ['franchise', 'franquicia', 'franquicias'],
  ['menu', 'carta', 'platos'],
  ['customer', 'customers', 'client', 'cliente', 'clientes'],
  ['address', 'direccion', 'direcciones'],
  ['photo', 'picture', 'foto', 'fotos'],
  ['bank', 'banco', 'cuenta bancaria'],
  ['cancel', 'cancelar', 'cancelacion'],
  ['rating', 'ratings', 'calificacion', 'calificar', 'estrellas'],
  ['spreadsheet', 'excel', 'hoja', 'csv'],
  ['import', 'importar'],
  ['export', 'exportar'],
  ['screenshot', 'screenshots', 'image', 'captura', 'capturas', 'imagen'],
  ['search', 'buscar', 'buscador'],
  ['zoom', 'ampliar', 'enlarge', 'lupa'],
];

/** Cada palabra o frase, con el grupo al que pertenece. */
export const GRUPO_DE: ReadonlyMap<string, readonly string[]> = new Map(
  SINONIMOS.flatMap((g) => g.map((p) => [p, g] as const)),
);
