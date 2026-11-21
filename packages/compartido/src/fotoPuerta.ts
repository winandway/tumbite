import type { Idioma } from './idiomas';

/**
 * C-FOTO-PUERTA (15 nov 2026) — todos los países. La «foto de la puerta»: cada dirección guardada
 * del cliente puede llevar hasta tres fotos, en orden fijo de afuera hacia adentro, que solo ve el
 * repartidor del pedido mientras va en camino. Ficha: Gerencia, FOTO-DE-LA-PUERTA-DIVOOX (5 y 6).
 * Lógica pura, sin React: la comparten la app del cliente, la del repartidor y las pruebas.
 */
export type TipoLugar = 'casa' | 'edificio';
export type RolPuerta = 'frente' | 'puerta' | 'entrada' | 'paso' | 'apto';

/** Orden fijo de cada tipo de lugar: el índice + 1 es el orden de la foto (1, 2, 3). */
export const ROLES_PUERTA: Record<TipoLugar, readonly RolPuerta[]> = {
  casa: ['frente', 'puerta'],
  edificio: ['entrada', 'paso', 'apto'],
};

/** Tamaños de la conversión en el teléfono (la original nunca se sube). */
export const TAMANOS_FOTO_PUERTA = {
  grande: { lado: 1024, calidad: 0.75 },
  mini: { lado: 200, calidad: 0.7 },
} as const;

/**
 * C-CASA-POR-DEFECTO (Richard, 21 nov 2026): casa o edificio es lo que eligió la persona y, si no
 * eligió, CASA («hay más casas que edificios»). Antes el apartamento escrito lo volvía edificio, y la
 * casilla «Casa o apartamento» del punto exacto se llena también con el número de una casa: a Richard
 * le salía edificio sin haberlo dicho. Mismo criterio en el servidor (`rutas/fotoPuerta.ts`).
 */
export function tipoLugarDe(tipoLugar: string | null | undefined): TipoLugar {
  return tipoLugar === 'edificio' ? 'edificio' : 'casa';
}

/** El rol de una foto según su orden (1..3) y el tipo de lugar; null si ese orden no existe. */
const rolesDe = (tipo: TipoLugar) => (tipo === 'casa' ? ROLES_PUERTA.casa : ROLES_PUERTA.edificio);

export function rolDeOrden(tipo: TipoLugar, orden: number): RolPuerta | null {
  return Number.isInteger(orden) && orden >= 1 ? (rolesDe(tipo).at(orden - 1) ?? null) : null;
}

/** Cuántas fotos admite cada tipo de lugar (casa 2, edificio 3). */
export const maximoFotosPuerta = (tipo: TipoLugar) => rolesDe(tipo).length;

type TextoRol = { titulo: string; indicacion: string; rotulo: string };

const ROLES: Record<Idioma, Record<RolPuerta, TextoRol>> = {
  es: {
    frente: {
      titulo: 'Frente de la casa',
      indicacion:
        'Párate en la calle, frente a tu casa. Que se vea la puerta y algo que te distinga: el color, el portón, el tapete. De día es mejor.',
      rotulo: 'Frente',
    },
    puerta: {
      titulo: 'Puerta de cerca',
      indicacion: 'Acércate a la puerta. Que se vea bien cómo es: el modelo, el color, el timbre.',
      rotulo: 'Puerta',
    },
    entrada: {
      titulo: 'Entrada del edificio',
      indicacion:
        'Párate frente a la entrada del edificio. Que se vea la puerta principal, el nombre o el número del edificio y algo que lo distinga.',
      rotulo: 'Entrada',
    },
    paso: {
      titulo: 'Paso intermedio (portería, portón, ascensor o pasillo)',
      indicacion:
        'Si hay que pasar un portón, una portería o un pasillo, toma una foto de ese punto.',
      rotulo: 'Portería o pasillo',
    },
    apto: {
      titulo: 'Puerta del apartamento',
      indicacion:
        'Ya adentro, párate frente a tu puerta. Que se vea el modelo de la puerta y, si puedes, el número.',
      rotulo: 'Puerta del apartamento',
    },
  },
  en: {
    frente: {
      titulo: 'Front of the house',
      indicacion:
        'Stand on the street, facing your house. Make sure the door shows, plus something that sets it apart: the color, the gate, the doormat. Daylight works best.',
      rotulo: 'Front',
    },
    puerta: {
      titulo: 'Door up close',
      indicacion:
        'Get close to the door. Make it easy to see what it looks like: the style, the color, the doorbell.',
      rotulo: 'Door',
    },
    entrada: {
      titulo: 'Building entrance',
      indicacion:
        'Stand in front of the building entrance. Make sure the main door, the building name or number, and something that sets it apart are visible.',
      rotulo: 'Entrance',
    },
    paso: {
      titulo: 'Along the way (front desk, gate, elevator or hallway)',
      indicacion:
        'If the courier has to go through a gate, a front desk or a hallway, take a photo of that spot.',
      rotulo: 'Front desk or hallway',
    },
    apto: {
      titulo: 'Apartment door',
      indicacion:
        'Once inside, stand in front of your door. Show the style of the door and, if you can, the number.',
      rotulo: 'Apartment door',
    },
  },
};

export const textoRolPuerta = (idioma: Idioma, rol: RolPuerta): TextoRol =>
  new Map(Object.entries(idioma === 'en' ? ROLES.en : ROLES.es)).get(rol) ?? ROLES.es.frente;

/** Las casillas que tocan a ese tipo de lugar, en su orden, con sus textos. */
export function casillasPuerta(tipo: TipoLugar, idioma: Idioma) {
  return rolesDe(tipo).map((rol, i) => ({
    orden: i + 1,
    rol,
    ...textoRolPuerta(idioma, rol),
  }));
}

const COMUNES = {
  es: {
    // C-EDITAR-ES-EDITAR: la hoja sirve también para viajes; no habla solo del repartidor.
    titulo: 'Que te encuentren a la primera',
    subtitulo: 'Fotos de la entrada para quien llega a entregarte o a buscarte.',
    pregunta: '¿Es una casa o un edificio?',
    casa: 'Casa',
    edificio: 'Edificio o conjunto',
    cambiar: 'Cambiar',
    cambiarTipoTitulo: '¿Cambiar el tipo de lugar?',
    cambiarTipoMensaje: 'Se borran las fotos que no son de la entrada. La primera foto se queda.',
    esCasa: 'Es una casa',
    esEdificio: 'Es un edificio o conjunto',
    indicaciones: [
      'Sin personas, sin placas de carros y sin ventanas con gente adentro.',
      'Si es de noche, enciende la luz o espera al día; una foto oscura no sirve.',
      'Horizontal, con la puerta en el centro.',
    ],
    privacidad:
      'Solo tu repartidor la ve, solo mientras te lleva un pedido. Puedes borrarla cuando quieras.',
    opcional: 'Opcional',
    listo: 'Listo',
    ahoraNo: 'Ahora no',
    cambiarFoto: 'Cambiar foto',
    borrarFoto: 'Borrar foto',
    masOpciones: 'Más opciones',
    borrarTitulo: '¿Borrar esta foto?',
    borrarMensaje: 'Tu repartidor ya no la verá. Puedes tomar otra cuando quieras.',
    borrar: 'Borrar',
    cancelar: 'Cancelar',
    subiendo: 'Subiendo la foto…',
    guardada: 'Foto guardada',
    reintentar: 'Reintentar',
    sinSubir: 'No se pudo subir. Tu foto sigue aquí.',
    cargando: 'Cargando tus fotos…',
    errorCarga: 'No pudimos cargar tus fotos. Revisa tu conexión.',
    deCuantas: '{n} de {total}',
  },
  en: {
    titulo: 'Help them find you fast',
    subtitulo: 'Entrance photos for whoever comes to deliver to you or pick you up.',
    pregunta: 'Is it a house or a building?',
    casa: 'House',
    edificio: 'Building or complex',
    cambiar: 'Change',
    cambiarTipoTitulo: 'Change the type of place?',
    cambiarTipoMensaje:
      'The photos other than the entrance will be deleted. The first photo stays.',
    esCasa: 'It’s a house',
    esEdificio: 'It’s a building or complex',
    indicaciones: [
      'No people, no license plates and no windows with people inside.',
      'At night, turn on the light or wait for daylight; a dark photo won’t help.',
      'Landscape, with the door in the center.',
    ],
    privacidad:
      'Only your courier sees it, and only while bringing you an order. You can delete it anytime.',
    opcional: 'Optional',
    listo: 'Done',
    ahoraNo: 'Not now',
    cambiarFoto: 'Change photo',
    borrarFoto: 'Delete photo',
    masOpciones: 'More options',
    borrarTitulo: 'Delete this photo?',
    borrarMensaje: 'Your courier won’t see it anymore. You can take another one anytime.',
    borrar: 'Delete',
    cancelar: 'Cancel',
    subiendo: 'Uploading the photo…',
    guardada: 'Photo saved',
    reintentar: 'Try again',
    sinSubir: 'It couldn’t be uploaded. Your photo is still here.',
    cargando: 'Loading your photos…',
    errorCarga: 'We couldn’t load your photos. Check your connection.',
    deCuantas: '{n} of {total}',
  },
};

export const textosFotoPuerta = (idioma: Idioma) => (idioma === 'en' ? COMUNES.en : COMUNES.es);

/** La ruta de una foto de la puerta del cliente (con su tamaño y su versión para refrescar). */
export function rutaFotoPuerta(
  direccionId: string,
  orden: number,
  op: { mini?: boolean; version?: number } = {},
): string {
  const base = `/datos/mis-direcciones/${encodeURIComponent(direccionId)}/fotos/${orden}`;
  const q = [op.mini ? 'tam=mini' : '', op.version ? `v=${op.version}` : ''].filter(Boolean);
  return q.length ? `${base}?${q.join('&')}` : base;
}

/** La ruta con la que el repartidor ve una foto de la puerta del pedido que lleva. */
export function rutaPuertaRepartidor(pedidoId: string, orden: number, mini = false): string {
  return `/datos/repartidor/pedidos/${encodeURIComponent(pedidoId)}/puerta/${orden}${mini ? '?tam=mini' : ''}`;
}
