/**
 * C-COBRO-MISMOS-DATOS: el cuerpo de `POST /datos/pedidos` tal como lo manda el carrito, sin el
 * total. Vive aquí (y no dentro de la pantalla) para que una prueba del servidor lo compare campo
 * por campo con su esquema: un campo que el servidor acepta y el carrito no manda (o al revés) se
 * queda fuera de la huella del cobro y la prueba se pone en rojo.
 */
export interface LineaCarritoParaPedido {
  platoId: string;
  cantidad: number;
  opciones?: { id: string }[];
  sustitucion?: string;
  reemplazo?: { platoId: string } | null;
  nota?: string;
}

export interface DatosCuerpoPedido {
  restauranteId: string | null;
  esTienda?: boolean;
  lineas: LineaCarritoParaPedido[];
  propinaCentavos: number;
  anuncioId?: string;
  usarSaldoRegalo: boolean;
  valores: {
    direccion: string;
    apto: string;
    notas: string;
    alergias: string;
    entrega?: string;
    pin?: string;
    paraNombre: string;
    paraTelefono: string;
    paraMensaje: string;
  };
  comoRegalo: boolean;
  metodoPago: 'tarjeta' | 'efectivo' | 'transferencia_repartidor';
  cupon?: string;
  punto: { lat: number; lng: number } | null;
  regalo: 'cumpleanos' | 'sellos' | 'vuelve' | null;
  programadoPara?: string;
}

export function armarCuerpoPedido(d: DatosCuerpoPedido) {
  const v = d.valores;
  return {
    restauranteId: d.restauranteId,
    lineas: d.lineas.map((l) => ({
      platoId: l.platoId,
      cantidad: l.cantidad,
      opciones: (l.opciones ?? []).map((o) => o.id),
      ...(d.esTienda ? { sustitucion: l.sustitucion ?? 'reembolsar' } : {}),
      ...(d.esTienda && l.sustitucion === 'especifico' && l.reemplazo
        ? { reemplazoId: l.reemplazo.platoId }
        : {}),
      ...(l.nota ? { nota: l.nota } : {}),
    })),
    propinaCentavos: d.propinaCentavos,
    // C-ANUNCIOS: si entró tocando el anuncio de este restaurante (se cobra al restaurante).
    anuncioId: d.anuncioId,
    usarSaldoRegalo: d.usarSaldoRegalo,
    direccion: v.direccion,
    apto: v.apto,
    notas: v.notas,
    alergias: v.alergias,
    paraOtro: d.comoRegalo
      ? { nombre: v.paraNombre, telefono: v.paraTelefono, mensaje: v.paraMensaje }
      : null,
    entrega: v.entrega === 'recoger' ? 'recoger' : v.entrega === 'mano' ? 'mano' : 'puerta',
    pin: v.pin !== 'no',
    metodoPago: d.metodoPago,
    cupon: d.cupon,
    lat: d.punto?.lat ?? null,
    lng: d.punto?.lng ?? null,
    regalo: d.regalo,
    ...(d.programadoPara ? { programadoPara: d.programadoPara } : {}),
  };
}
