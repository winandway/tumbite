import type { Idioma } from '@tumbite/compartido';
import { textosServicios } from './textos';

/**
 * C-SERVICIOS-CONECTADOS (16 nov 2026) — todos los países. Lo que dice y dibuja el panel de
 * servicios del Driver a partir de lo que manda el servidor (`/datos/conductor/panel-servicios`).
 * Sin React para probarlo en node.
 */
export type ServicioId = 'comida' | 'envios' | 'moto' | 'carro';
export type EstadoTarjetaServidor =
  | 'conectado'
  | 'en_pausa'
  | 'haciendo'
  | 'desconectado'
  | 'bloqueado_flex'
  | 'en_revision'
  | 'agregar';
export type TipoLleva = 'comida' | 'envio' | 'viaje' | 'ruta_flex';

export type ServicioPanel = {
  servicioId: ServicioId;
  nombre: string;
  vehiculo: string | null;
  estado: EstadoTarjetaServidor;
  motivo: string;
  requisitosFaltantes: string[];
  /** C-CAMBIAR-VEHICULO: el vehículo aprobado suyo con el que este servicio sí funciona. */
  cambiarA?: { id: string; nombre: string; tipo: string } | null;
};
export type BloqueFlex = {
  rutaId: string;
  nombre: string;
  estado: string;
  empresa: string;
  bloqueDesde: string | null;
  bloqueHasta: string | null;
};
export type PanelServicios = {
  conectadoGeneral: boolean;
  conectados: number;
  lleva: { servicioId: string; tipo: TipoLleva } | null;
  bloqueFlex: BloqueFlex | null;
  servicios: ServicioPanel[];
};

/** Ícono (Ionicons, de línea) de cada servicio. */
export function iconoServicio(
  id: string,
): 'bag-handle-outline' | 'cube-outline' | 'speedometer-outline' | 'car-outline' {
  // C-ICONOS-SERVICIO: en pantalla va el dibujo del cliente (IconoServicio); esto es el respaldo.
  if (id === 'comida') return 'bag-handle-outline';
  if (id === 'moto') return 'speedometer-outline';
  if (id === 'carro') return 'car-outline';
  return 'cube-outline';
}

/** El nombre en la tarjeta: Envíos dice con qué vehículo los hace («Envíos en moto»). */
export function nombreServicio(
  s: Pick<ServicioPanel, 'servicioId' | 'nombre' | 'vehiculo'>,
  idioma: Idioma,
) {
  const t = textosServicios(idioma);
  const base = new Map(Object.entries(t.nombres)).get(s.servicioId) ?? s.nombre;
  const en = s.vehiculo ? new Map(Object.entries(t.enVehiculo)).get(s.vehiculo) : undefined;
  return s.servicioId === 'envios' && en ? `${base} ${en}` : base;
}

/** La segunda línea de la tarjeta según su estado. */
export function detalleServicio(s: ServicioPanel, idioma: Idioma): string {
  const t = textosServicios(idioma);
  switch (s.estado) {
    case 'conectado':
      return new Map(Object.entries(t.esperandoDe)).get(s.servicioId) ?? t.esperandoDe.comida!;
    case 'en_pausa':
      return t.enPausa;
    case 'haciendo':
      return t.haciendo;
    case 'bloqueado_flex':
      return t.bloqueado;
    case 'agregar':
      return t.agregar;
    case 'en_revision':
      if (s.motivo === 'actualizar_app') return t.actualizarApp;
      if (s.cambiarA) return t.usaTuVehiculo(s.cambiarA.nombre || t.tuOtroVehiculo);
      if (s.requisitosFaltantes.length) return t.faltan(s.requisitosFaltantes.length);
      return t.enRevision;
    default:
      return t.desconectado;
  }
}

/** Título del aviso fijo del estado 2 («Estás llevando una comida»). */
export function tituloLlevando(tipo: TipoLleva, idioma: Idioma): string {
  const t = textosServicios(idioma);
  return new Map(Object.entries(t.llevando)).get(tipo) ?? t.llevando.comida!;
}

/** Segunda línea del aviso fijo: en un viaje, «cuando termine el viaje». */
export function textoLlevando(tipo: TipoLleva, idioma: Idioma): string {
  const t = textosServicios(idioma);
  return tipo === 'viaje'
    ? t.llevandoTextoViaje
    : tipo === 'ruta_flex'
      ? t.llevandoTextoRuta
      : t.llevandoTexto;
}

/** Une una lista en palabras: «A», «A y B», «A, B y C». */
export function unirLista(partes: string[], idioma: Idioma): string {
  const y = textosServicios(idioma).y;
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} ${y} ${partes.at(-1)}`;
}

/**
 * La franja «En pausa» del estado 2: qué servicios quedaron en pausa (los que estaban conectados y
 * no son el que lleva) y hasta cuándo, según lo que lleva. Si no hay ninguno en pausa, null.
 */
export function franjaPausa(
  panel: Pick<PanelServicios, 'lleva' | 'servicios'>,
  idioma: Idioma,
): { titulo: string; texto: string; servicios: ServicioPanel[] } | null {
  if (!panel.lleva) return null;
  const t = textosServicios(idioma);
  const enPausa = panel.servicios.filter((s) => s.estado === 'en_pausa');
  if (!enPausa.length) return null;
  return {
    titulo: t.enPausaLista(
      unirLista(
        enPausa.map((s) => nombreServicio(s, idioma)),
        idioma,
      ),
    ),
    texto:
      new Map(Object.entries(t.hastaEntregar)).get(panel.lleva.tipo) ?? t.hastaEntregar.comida!,
    servicios: enPausa,
  };
}

/** Orden de la lista: lo conectado arriba, después lo que se puede conectar, y al final agregar. */
const ORDEN: Record<EstadoTarjetaServidor, number> = {
  haciendo: 0,
  conectado: 1,
  en_pausa: 2,
  bloqueado_flex: 3,
  desconectado: 4,
  en_revision: 5,
  agregar: 6,
};
const ORDEN_SERVICIO = ['comida', 'envios', 'moto', 'carro'];
export function ordenarServicios(servicios: ServicioPanel[]): ServicioPanel[] {
  const rango = (s: ServicioPanel) => new Map(Object.entries(ORDEN)).get(s.estado) ?? 9;
  const lugar = (s: ServicioPanel) => {
    const i = ORDEN_SERVICIO.indexOf(s.servicioId);
    return i < 0 ? 9 : i;
  };
  return [...servicios].sort((a, b) => rango(a) - rango(b) || lugar(a) - lugar(b));
}

/** ¿Hay algo aprobado que se pueda conectar (para el botón grande «Conectarme»)? */
export function hayConectables(servicios: ServicioPanel[]): boolean {
  return servicios.some((s) => s.estado === 'desconectado' || s.estado === 'conectado');
}

/** Hora corta de una fecha de la base («2026-11-16 19:00:00» en UTC). */
export function horaCorta(f: string, idioma: Idioma): string {
  return new Date(`${f.replace(' ', 'T')}Z`).toLocaleTimeString(
    idioma === 'en' ? 'en-US' : 'es-US',
    {
      hour: 'numeric',
      minute: '2-digit',
    },
  );
}

/** El renglón del bloque reservado de la tarjeta de Flex («Hoy, 2:00 a 5:30 pm»). */
export function textoBloque(
  b: { bloqueDesde?: string | null; bloqueHasta?: string | null },
  idioma: Idioma,
  ahora = new Date(),
) {
  const t = textosServicios(idioma);
  if (!b.bloqueDesde || !b.bloqueHasta) return t.bloqueSinHora;
  const desde = new Date(`${b.bloqueDesde.replace(' ', 'T')}Z`);
  const hoy = desde.toDateString() === ahora.toDateString();
  const d = horaCorta(b.bloqueDesde, idioma);
  const h = horaCorta(b.bloqueHasta, idioma);
  if (hoy) return t.bloqueHoy(d, h);
  const dia = desde.toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  return t.bloqueDia(dia.charAt(0).toUpperCase() + dia.slice(1), d, h);
}

/**
 * Adónde lleva cada paso que falta en «Agregar un servicio»: la identidad a «Documentos»; lo del
 * vehículo y los papeles de pasajeros al alta de Moto o Carro; el resto, a los datos de reparto.
 */
export type Destino = 'identidad' | 'alta-moto' | 'alta-carro' | 'datos-reparto';
export function destinoDePaso(
  servicioId: string,
  requisito: string,
  grupo: 'perfil' | 'vehiculo',
): Destino {
  if (requisito === 'identidad') return 'identidad';
  if (servicioId === 'moto') return 'alta-moto';
  if (servicioId === 'carro') return 'alta-carro';
  if (grupo === 'perfil' && requisito.startsWith('antecedentes')) return 'identidad';
  return 'datos-reparto';
}

/**
 * C-ULTIMO-SERVICIO (robot de Android, 18 nov 2026): el aviso tras desconectar `id`. Si no queda
 * ningún otro servicio conectado (o en pausa, o en curso), no dice «Lo demás sigue conectado».
 */
export function textoTrasDesconectar(
  servicios: ServicioPanel[],
  id: string,
  idioma: Idioma,
): string {
  const t = textosServicios(idioma);
  const quedan = servicios.some(
    (x) =>
      x.servicioId !== id &&
      (x.estado === 'conectado' || x.estado === 'en_pausa' || x.estado === 'haciendo'),
  );
  return quedan ? t.avisoTexto : t.avisoTextoUltimo;
}

/**
 * C-AVATAR-SIN-LINEA (robot de Android, 18 nov 2026): en Perfil, el avatar salía como un círculo
 * gris con una línea suelta (una foto diminuta estirada). Una foto de menos de 32 px por lado, o sin
 * medidas, no sirve de avatar: se muestran las iniciales.
 */
export function fotoSirveDeAvatar(ancho?: number, alto?: number): boolean {
  return (ancho ?? 0) >= 32 && (alto ?? 0) >= 32;
}
