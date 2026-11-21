import { ICONOS_LUGAR, type Idioma, type PuntoConfirmado } from '@tumbite/compartido';

/**
 * C-EDITAR-ES-EDITAR (21 nov 2026, fallo visto por Richard en su iPhone) — todos los países.
 * En «Tus direcciones», «Editar» abre la hoja de la dirección: tipo con ícono y nombre propio,
 * apartamento, punto de referencia, el punto en el mapa y, abajo y opcional, las fotos de la
 * entrada con el mensaje para quien llega. Antes no había «Editar», y al ajustar una dirección ya
 * guardada la app saltaba sola a las fotos: la persona creía que editaba y le pedían fotos.
 * Ficha: docs/investigaciones-rea/2026-11-21-editar-direccion.md.
 */
export type DatosEditables = {
  id: string;
  etiqueta: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  apto?: string | null;
  referencia?: string | null;
  instrucciones?: string | null;
  entrega?: 'puerta' | 'mano';
  icono?: string | null;
};

/** Las acciones de una dirección guardada, en el orden en que salen en sus tres puntos. */
export const ACCIONES_DE_DIRECCION = ['editar', 'ajustar', 'fotos', 'borrar'] as const;
export type AccionDeDireccion = (typeof ACCIONES_DE_DIRECCION)[number];

/** Lo que acepta el servidor en `etiqueta` (esquemaDireccion). */
export const NOMBRE_MAXIMO = 30;

/** Lo que la persona escribe en la hoja (todo texto, para el borrador). */
export type FormularioDireccion = {
  nombre: string;
  icono: string;
  apto: string;
  referencia: string;
  instrucciones: string;
};

export const formularioDe = (d: DatosEditables): FormularioDireccion => ({
  nombre: d.etiqueta ?? '',
  icono: d.icono ?? '',
  apto: d.apto ?? '',
  referencia: d.referencia ?? '',
  instrucciones: d.instrucciones ?? '',
});

const iconoValido = (x: string | null | undefined) =>
  (ICONOS_LUGAR as readonly string[]).includes(x ?? '') ? (x as string) : '';

/** Los nombres que ponen los botones Casa y Trabajo (los demás íconos no inventan nombre). */
const NOMBRES_FIJOS = {
  es: { casa: 'Casa', trabajo: 'Trabajo' },
  en: { casa: 'Home', trabajo: 'Work' },
} as const;
const nombresPuestos = new Set<string>(
  Object.values(NOMBRES_FIJOS).flatMap((n) => [n.casa, n.trabajo]),
);

/**
 * Tocar un tipo («¿Dónde te entregamos?»): cambia el ícono y, si es Casa o Trabajo, pone su nombre
 * solo cuando la casilla está vacía o tiene el que puso otro botón. Un nombre propio nunca se pisa.
 */
export function elegirTipo(
  v: FormularioDireccion,
  icono: string,
  idioma: Idioma,
): FormularioDireccion {
  const n = idioma === 'en' ? NOMBRES_FIJOS.en : NOMBRES_FIJOS.es;
  const fijo = icono === 'casa' ? n.casa : icono === 'trabajo' ? n.trabajo : '';
  const propio = v.nombre.trim() !== '' && !nombresPuestos.has(v.nombre.trim());
  return { ...v, icono, nombre: propio || !fijo ? v.nombre : fijo };
}

/** El cuerpo de `PUT /datos/mis-direcciones/:id`: cambia lo editable y conserva todo lo demás. */
export const cuerpoDeEdicion = (d: DatosEditables, v: FormularioDireccion) => ({
  etiqueta: v.nombre.trim().slice(0, NOMBRE_MAXIMO),
  direccion: d.direccion,
  lat: d.lat,
  lng: d.lng,
  apto: v.apto.trim(),
  referencia: v.referencia.trim(),
  instrucciones: v.instrucciones.trim(),
  entrega: d.entrega ?? 'puerta',
  icono: iconoValido(v.icono),
});

/**
 * El cuerpo del PUT al ajustar el punto de una dirección YA guardada: corrige esa misma dirección
 * por su id (antes iba por POST, que busca por el texto, y si el texto cambiaba creaba otra).
 */
export const cuerpoDePunto = (
  d: DatosEditables,
  p: Pick<PuntoConfirmado, 'direccion' | 'punto' | 'referencia' | 'apto'>,
) => ({
  etiqueta: (d.etiqueta ?? '').slice(0, NOMBRE_MAXIMO),
  direccion: p.direccion,
  lat: p.punto.lat,
  lng: p.punto.lng,
  apto: (p.apto ?? '').trim(),
  referencia: (p.referencia ?? '').trim(),
  instrucciones: d.instrucciones ?? '',
  entrega: d.entrega ?? 'puerta',
  icono: iconoValido(d.icono),
});

/**
 * Después de confirmar el punto en el mapa. La hoja de la dirección se OFRECE una sola vez y solo
 * al guardar una dirección NUEVA sin fotos; al ajustar una que ya estaba guardada se vuelve atrás:
 * nadie termina en las fotos sin haberlas pedido.
 */
export function despuesDeConfirmarPunto(p: {
  eraGuardada: boolean;
  tieneFotos: boolean;
}): 'lista' | 'hoja' | 'cerrar' {
  if (p.eraGuardada) return 'lista';
  return p.tieneFotos ? 'cerrar' : 'hoja';
}
