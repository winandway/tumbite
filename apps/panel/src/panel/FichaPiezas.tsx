import { useState } from 'react';
import {
  Bike,
  Car,
  EyeOff,
  LifeBuoy,
  Package,
  ShoppingBasket,
  UtensilsCrossed,
} from 'lucide-react';
import {
  type Idioma,
  type Tramo,
  enIdioma,
  nombreServicioMonitoreo,
  textoDiferencia,
  textoDuracion,
} from '@tumbite/compartido';
import {
  type LineaMapaWeb,
  MapaGoogleBajoDemanda,
  elegirMapaWeb,
  urlMarcaIsotipo,
} from '@tumbite/compartido/src/mapaWebGoogle';
import { useHora } from './horario';
import { usePermisos } from './permisosPanel';

/**
 * C-FICHA-OPERACION (15 nov 2026). Todos los países. Las piezas de la ficha del pedido y de la del
 * viaje en el superadmin: ícono del servicio, tarjeta de tiempos (verde si cumplió, rojo si se
 * pasó, gris si falta un dato y cuál), línea de tiempo única (el Manager en capa tenue que se
 * oculta), foto de evidencia borrosa hasta «Ver foto» y mapa pequeño (solo si hay llave del mapa).
 */

/** El ícono de cada servicio (los mismos dibujos en la lista, la bandeja y las fichas). */
function DibujoServicio({ servicio }: { servicio: string }) {
  const p = { size: 16, strokeWidth: 1.9, 'aria-hidden': true } as const;
  switch (servicio) {
    case 'comida':
      return <UtensilsCrossed {...p} />;
    case 'tiendas':
      return <ShoppingBasket {...p} />;
    case 'auto':
      return <Car {...p} />;
    case 'moto':
      return <Bike {...p} />;
    case 'envios':
      return <Package {...p} />;
    default:
      return <LifeBuoy {...p} />;
  }
}

const SERVICIOS_CON_ICONO = new Set(['comida', 'tiendas', 'auto', 'moto', 'envios', 'general']);

export function IconoServicio({
  servicio,
  idioma,
  conTexto = false,
}: {
  servicio: string | null | undefined;
  idioma: Idioma;
  conTexto?: boolean;
}) {
  const clave = servicio && SERVICIOS_CON_ICONO.has(servicio) ? servicio : 'general';
  const nombre = nombreServicioMonitoreo(
    clave as Parameters<typeof nombreServicioMonitoreo>[0],
    idioma === 'en' ? 'en' : 'es',
  );
  return (
    <span className="icono-servicio" title={nombre}>
      <DibujoServicio servicio={clave} />
      {conTexto ? <span>{nombre}</span> : <span className="solo-lector">{nombre}</span>}
    </span>
  );
}

const TT = {
  es: {
    titulo: 'Tiempos',
    real: 'Tomó',
    previsto: 'Previsto',
    diferencia: 'Diferencia',
    lleva: 'Lleva',
    cumplio: 'A tiempo',
    sePaso: 'Se pasó',
    enCurso: 'En curso',
    sinCerrar: 'Sin cerrar',
    abiertoHace: 'Abierto hace',
    explicaSinCerrar:
      'Nadie cerró este paso y no hubo movimiento en más de 12 horas: no se mide. Revisa si se entregó y ciérralo, o cancélalo.',
    sinDato: 'Sin dato',
    porDefecto: 'previsto de fábrica: faltaba la ubicación o el tiempo del restaurante',
    falta: 'Falta:',
    tramos: {
      preparacion: 'Preparación',
      ida: 'Ida del repartidor al restaurante',
      espera: 'Espera en el restaurante',
      entrega: 'Recorrido de la entrega',
      total: 'Total',
      asignacion: 'Espera hasta asignar conductor',
      llegada: 'Llegada del conductor',
      espera_pasajero: 'Espera del pasajero',
      recorrido: 'Recorrido',
    } as Record<string, string>,
    ayudas: {
      preparacion: 'aceptado → comida lista',
      ida: 'aceptó la oferta → llegó al restaurante',
      espera: 'llegó → recogió',
      entrega: 'recogió → entregó',
      total: 'pagado → entregado',
      asignacion: 'buscando → asignado (tope de búsqueda)',
      llegada: 'asignado → llegó',
      espera_pasajero: 'llegó → empezó (espera gratis de la tarifa)',
      recorrido: 'empezó → terminó (duración cotizada)',
    } as Record<string, string>,
    faltas: {
      aceptado: 'la hora en que el restaurante aceptó',
      tiempo_prometido: 'el tiempo que dio el restaurante',
      listo: 'la hora de «comida lista»',
      repartidor_acepto: 'la hora en que el repartidor aceptó la oferta',
      distancia_repartidor: 'la distancia del repartidor al restaurante cuando se le ofreció',
      llego_restaurante: 'la llegada del repartidor al restaurante',
      recogido: 'la hora de la recogida',
      entregado: 'la hora de la entrega',
      cancelado: 'no llegó a pasar (cancelado)',
      inicio_busqueda: 'cuándo empezó a buscar conductor',
      asignado: 'la hora de asignación',
      distancia_conductor: 'la distancia del conductor a la recogida cuando se le ofreció',
      tarifa: 'la tarifa copiada en la cotización',
      conductor_llego: 'la llegada del conductor',
      iniciado: 'la hora en que empezó el viaje',
      terminado: 'la hora en que terminó',
      duracion_cotizada: 'la duración cotizada',
    } as Record<string, string>,
  },
  en: {
    titulo: 'Times',
    real: 'Took',
    previsto: 'Expected',
    diferencia: 'Difference',
    lleva: 'So far',
    cumplio: 'On time',
    sePaso: 'Late',
    enCurso: 'In progress',
    sinCerrar: 'Not closed',
    abiertoHace: 'Open for',
    explicaSinCerrar:
      'Nobody closed this step and nothing has happened in over 12 hours, so it isn’t measured. Check whether it was delivered and close it, or cancel it.',
    sinDato: 'No data',
    porDefecto: 'default estimate: the location or the restaurant’s time was missing',
    falta: 'Missing:',
    tramos: {
      preparacion: 'Preparation',
      ida: 'Driver to the restaurant',
      espera: 'Wait at the restaurant',
      entrega: 'Delivery trip',
      total: 'Total',
      asignacion: 'Wait for a driver',
      llegada: 'Driver arrival',
      espera_pasajero: 'Rider wait',
      recorrido: 'Trip',
    } as Record<string, string>,
    ayudas: {
      preparacion: 'accepted → food ready',
      ida: 'accepted the offer → arrived at the restaurant',
      espera: 'arrived → picked up',
      entrega: 'picked up → delivered',
      total: 'paid → delivered',
      asignacion: 'searching → assigned (search limit)',
      llegada: 'assigned → arrived',
      espera_pasajero: 'arrived → started (free wait in the fare)',
      recorrido: 'started → finished (quoted duration)',
    } as Record<string, string>,
    faltas: {
      aceptado: 'when the restaurant accepted',
      tiempo_prometido: 'the time the restaurant gave',
      listo: 'when the food was ready',
      repartidor_acepto: 'when the driver accepted the offer',
      distancia_repartidor: 'the driver’s distance to the restaurant when offered',
      llego_restaurante: 'the driver’s arrival at the restaurant',
      recogido: 'the pickup time',
      entregado: 'the delivery time',
      cancelado: 'it never happened (canceled)',
      inicio_busqueda: 'when the driver search started',
      asignado: 'the assignment time',
      distancia_conductor: 'the driver’s distance to the pickup when offered',
      tarifa: 'the fare saved with the quote',
      conductor_llego: 'the driver’s arrival',
      iniciado: 'when the trip started',
      terminado: 'when the trip finished',
      duracion_cotizada: 'the quoted duration',
    } as Record<string, string>,
  },
};

const tono = (r: Tramo['resultado']) =>
  r === 'cumplio' ? 'exito' : r === 'se_paso' ? 'problema' : r === 'en_curso' ? 'vivo' : 'neutro';

/** La tarjeta de tiempos de la ficha (arriba de todo). */
export function TarjetaTiempos({ tiempos, idioma }: { tiempos: Tramo[]; idioma: Idioma }) {
  const t = enIdioma(TT, idioma);
  const tramos = new Map(Object.entries(t.tramos));
  const ayudas = new Map(Object.entries(t.ayudas));
  const faltas = new Map(Object.entries(t.faltas));
  const resultado = (r: Tramo['resultado']) =>
    r === 'cumplio'
      ? t.cumplio
      : r === 'se_paso'
        ? t.sePaso
        : r === 'en_curso'
          ? t.enCurso
          : r === 'sin_cerrar'
            ? t.sinCerrar
            : t.sinDato;
  return (
    <section className="tarjeta-form ficha-tiempos" aria-labelledby="ficha-tiempos-titulo">
      <h2 id="ficha-tiempos-titulo">{t.titulo}</h2>
      <ul className="ficha-tramos">
        {tiempos.map((x) => (
          <li key={x.clave} className={`ficha-tramo ficha-tramo-${tono(x.resultado)}`}>
            <div className="ficha-tramo-nombre">
              <strong>{tramos.get(x.clave) ?? x.clave}</strong>
              <small>{ayudas.get(x.clave)}</small>
            </div>
            <div className="ficha-tramo-cifras">
              <span>
                <small>
                  {x.resultado === 'en_curso'
                    ? t.lleva
                    : x.resultado === 'sin_cerrar'
                      ? t.abiertoHace
                      : t.real}
                </small>
                <b>{textoDuracion(x.realS)}</b>
              </span>
              <span>
                <small>{t.previsto}</small>
                <b>{textoDuracion(x.previstoS)}</b>
              </span>
              <span className={`bs-estado bs-${tono(x.resultado)}`}>
                {resultado(x.resultado)}
                {x.diferenciaMin != null &&
                x.resultado !== 'en_curso' &&
                x.resultado !== 'sin_cerrar'
                  ? ` · ${textoDiferencia(x.diferenciaMin, idioma === 'en' ? 'en' : 'es')}`
                  : ''}
              </span>
            </div>
            {x.falta.length ? (
              <p className="ficha-tramo-falta">
                {t.falta} {x.falta.map((f) => faltas.get(f) ?? f).join(', ')}.
              </p>
            ) : null}
            {x.previstoPorDefecto ? <p className="ficha-tramo-falta">{t.porDefecto}</p> : null}
            {x.resultado === 'sin_cerrar' ? (
              <p className="ficha-tramo-falta">{t.explicaSinCerrar}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export type Paso = {
  tipo: string;
  evento: string;
  fecha: string;
  quien: string | null;
  rol: string | null;
  detalle: string | null;
  capa: 'principal' | 'manager';
  desdeAnteriorS: number | null;
};

const TL = {
  es: {
    titulo: 'Línea de tiempo',
    verManager: 'Ver lo que hizo el Manager',
    ocultarManager: 'Ocultar lo que hizo el Manager',
    manager: 'Manager',
    despues: 'después',
    roles: {
      cliente: 'cliente',
      restaurante: 'restaurante',
      repartidor: 'repartidor',
      conductor: 'conductor',
      soporte: 'soporte',
      sistema: 'sistema',
    } as Record<string, string>,
  },
  en: {
    titulo: 'Timeline',
    verManager: 'Show what the Manager did',
    ocultarManager: 'Hide what the Manager did',
    manager: 'Manager',
    despues: 'later',
    roles: {
      cliente: 'customer',
      restaurante: 'restaurant',
      repartidor: 'driver',
      conductor: 'driver',
      soporte: 'support',
      sistema: 'system',
    } as Record<string, string>,
  },
};

/** La línea de tiempo única: hora, qué pasó, quién y el tiempo desde el paso anterior. */
export function LineaTiempo({
  pasos,
  idioma,
  zona,
  eventos,
  cuentaEliminada,
}: {
  pasos: Paso[];
  idioma: Idioma;
  zona: string | null;
  eventos: Record<string, string>;
  cuentaEliminada: string;
}) {
  const t = enIdioma(TL, idioma);
  const h = useHora(idioma);
  const [conManager, setConManager] = useState(true);
  const hayManager = pasos.some((p) => p.capa === 'manager');
  const mapa = new Map(Object.entries(eventos));
  const roles = new Map(Object.entries(t.roles));
  const sufijo = h.sufijoZona(zona, pasos[0]?.fecha);
  return (
    <section className="tarjeta-form" aria-labelledby="ficha-linea-titulo">
      <div className="ficha-encabezado-seccion">
        <h2 id="ficha-linea-titulo">
          {t.titulo}
          {sufijo ? <span className="hora-zona"> · {sufijo}</span> : null}
        </h2>
        {hayManager ? (
          <button
            type="button"
            className="enlace"
            aria-pressed={conManager}
            onClick={() => setConManager((v) => !v)}
          >
            {conManager ? t.ocultarManager : t.verManager}
          </button>
        ) : null}
      </div>
      <ol className="super-bitacora ficha-linea">
        {pasos
          .filter((p) => conManager || p.capa !== 'manager')
          .map((p, i) => {
            const quien =
              p.rol === 'cliente' && p.quien == null && p.tipo === 'estado'
                ? cuentaEliminada
                : p.quien;
            return (
              <li
                key={`${p.evento}-${p.fecha}-${i}`}
                className={`ficha-paso-${p.tipo}${p.capa === 'manager' ? ' super-bitacora-manager ficha-paso-tenue' : ''}`}
              >
                <time dateTime={p.fecha}>
                  {h.fecha(p.fecha, zona, 'hora')}
                  {p.desdeAnteriorS != null && p.desdeAnteriorS > 0 ? (
                    <span className="ficha-desde">
                      {' '}
                      · {textoDuracion(p.desdeAnteriorS)} {t.despues}
                    </span>
                  ) : null}
                </time>
                <strong>
                  {p.capa === 'manager' ? `${t.manager}: ` : ''}
                  {mapa.get(p.evento) ?? p.evento}
                  {p.detalle && p.tipo === 'ticket' ? ` · ${p.detalle}` : ''}
                </strong>
                {quien || p.rol ? (
                  <span>
                    {[quien, p.rol ? roles.get(p.rol) : null].filter(Boolean).join(' · ')}
                  </span>
                ) : null}
              </li>
            );
          })}
      </ol>
    </section>
  );
}

const TF = {
  es: {
    ver: 'Ver foto',
    ocultar: 'Ocultar foto',
    cargando: 'Cargando la foto…',
    error:
      'No se pudo abrir la foto. Puede que ya se haya borrado o que tu cuenta no tenga permiso.',
    sinPermiso: 'Tu cuenta no tiene permiso para ver fotos de evidencia.',
    privada: 'Foto privada: se abre solo al tocar «Ver foto».',
  },
  en: {
    ver: 'View photo',
    ocultar: 'Hide photo',
    cargando: 'Loading the photo…',
    error:
      'The photo couldn’t be opened. It may have been deleted or your account may not have access.',
    sinPermiso: 'Your account doesn’t have access to evidence photos.',
    privada: 'Private photo: it only opens when you tap “View photo”.',
  },
};

/**
 * Foto de evidencia BORROSA hasta tocar «Ver foto»: antes de tocar no se pide nada al servidor (así
 * cada apertura es una petición a la ruta de evidencias, que es la que registra quién la vio).
 */
export function FotoEvidencia({ url, alt, idioma }: { url: string; alt: string; idioma: Idioma }) {
  const t = enIdioma(TF, idioma);
  const [abierta, setAbierta] = useState(false);
  const [estado, setEstado] = useState<'' | 'cargando' | 'lista' | 'error'>('');
  // C-PERMISOS-FINOS: los permisos efectivos de la sesión (el servidor frena igual y anota cada vista).
  const { puedeVer } = usePermisos();
  if (!puedeVer('pedidos.fotos')) return <p className="ficha-nota">{t.sinPermiso}</p>;
  return (
    <div className="ficha-foto">
      {abierta ? (
        <>
          {estado !== 'lista' && estado !== 'error' ? (
            <p className="ficha-nota" role="status">
              {t.cargando}
            </p>
          ) : null}
          {estado === 'error' ? (
            <p className="error-general" role="alert">
              {t.error}
            </p>
          ) : (
            <img
              src={url}
              alt={alt}
              className={
                estado === 'lista' ? 'ficha-foto-imagen' : 'ficha-foto-imagen ficha-foto-oculta'
              }
              onLoad={() => setEstado('lista')}
              onError={() => setEstado('error')}
            />
          )}
        </>
      ) : (
        <div className="ficha-foto-borrosa" aria-hidden="true">
          <EyeOff size={28} strokeWidth={1.6} />
        </div>
      )}
      <button
        type="button"
        className="boton secundario"
        onClick={() => {
          setAbierta((v) => !v);
          setEstado(abierta ? '' : 'cargando');
        }}
      >
        {abierta ? t.ocultar : t.ver}
      </button>
      {!abierta ? <p className="ficha-nota">{t.privada}</p> : null}
    </div>
  );
}

export type PuntoFicha = { id: string; lat: number; lng: number; color: string; etiqueta: string };

/**
 * C-MAPA-LEYENDA (16 nov 2026, Richard no supo quién era quién en el mapa del #B4290C): la leyenda
 * fija debajo del mapa en vivo. Cada renglón dice qué es cada marca con su mismo dibujo: el
 * isotipo = repartidor o conductor; el punto negro = restaurante o recogida; el punto rojo = cliente
 * o destino. Tocar una marca escribe su nombre debajo del mapa.
 */
export type RenglonLeyenda = { texto: string; color?: string; isotipo?: boolean };

/** Mapa pequeño con los puntos de la ficha (solo con la llave del mapa web; se abre al tocar). */
export function MapaFicha({
  puntos,
  idioma,
  etiqueta,
  lineas = [],
  enVivo = false,
  leyenda,
}: {
  puntos: (PuntoFicha & { isotipo?: boolean; apagado?: boolean })[];
  idioma: Idioma;
  etiqueta: string;
  /** C-RASTREO-VIVO: la ruta de Google (solo sobre el mapa de Google). */
  lineas?: LineaMapaWeb[];
  /** C-RASTREO-VIVO: abierto de entrada, más alto y con la marca que se desliza. */
  enVivo?: boolean;
  /** C-MAPA-LEYENDA: qué es cada marca, siempre visible debajo del mapa. */
  leyenda?: RenglonLeyenda[];
}) {
  const [tocado, setTocado] = useState<string | null>(null);
  const llave = (import.meta.env.VITE_GOOGLE_MAPS_WEB_KEY as string | undefined) ?? '';
  const mapId = (import.meta.env.VITE_GOOGLE_MAPS_WEB_MAP_ID as string | undefined) ?? '';
  if (!puntos.length || elegirMapaWeb({ llave }) !== 'google') return null;
  const centro = {
    lat: puntos.reduce((s, p) => s + p.lat, 0) / puntos.length,
    lng: puntos.reduce((s, p) => s + p.lng, 0) / puntos.length,
  };
  const marcaTocada = puntos.find((p) => p.id === tocado);
  const mapa = (
    <MapaGoogleBajoDemanda
      llave={llave}
      mapId={mapId}
      idioma={idioma === 'en' ? 'en' : 'es'}
      centro={centro}
      zoom={14}
      alto={enVivo ? 340 : 240}
      etiqueta={etiqueta}
      puntos={puntos.map((p) => ({ ...p, radio: 8, alTocar: () => setTocado(p.id) }))}
      lineas={lineas}
      abierto={enVivo}
      deslizar={enVivo}
    />
  );
  if (!leyenda?.length) return mapa;
  return (
    <div className="ficha-mapa-con-leyenda">
      {mapa}
      <ul className="ficha-leyenda" aria-label={idioma === 'en' ? 'Map key' : 'Qué es cada marca'}>
        {leyenda.map((r) => (
          <li key={r.texto}>
            {r.isotipo ? (
              <img src={urlMarcaIsotipo()} alt="" width={22} height={22} />
            ) : (
              <span
                className="ficha-leyenda-punto"
                style={{ background: r.color }}
                aria-hidden="true"
              />
            )}
            {r.texto}
          </li>
        ))}
      </ul>
      {marcaTocada ? (
        <p className="ficha-mapa-tocado" role="status" data-testid="mapa-tocado">
          {marcaTocada.etiqueta}
        </p>
      ) : null}
    </div>
  );
}

/** «85 m» o «1.2 km». */
export function textoMetros(m: number | null | undefined, idioma: Idioma): string {
  if (m == null) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  const km = new Intl.NumberFormat(idioma === 'en' ? 'en-US' : 'es-US', {
    maximumFractionDigits: 1,
  }).format(m / 1000);
  return `${km} km`;
}

/** Distancia entre dos puntos en metros (la misma fórmula del servidor). */
export function metrosEntre(
  a: { lat: number; lng: number } | null | undefined,
  b: { lat: number; lng: number } | null | undefined,
): number | null {
  if (!a || !b) return null;
  const r = 6_371_000;
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(h)));
}
