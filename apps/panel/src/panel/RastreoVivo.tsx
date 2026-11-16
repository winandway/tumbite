import { useEffect, useState } from 'react';
import {
  type Detenido,
  type FaseRastreo,
  type Idioma,
  decodificarRuta,
  enIdioma,
  minutosDeLlegada,
  textoDetenido,
  textoFase,
  textoUltimaSenal,
} from '@tumbite/compartido';
import { pedir } from './api';
import { MapaFicha, type PuntoFicha, textoMetros } from './FichaPiezas';
import { useHora } from './horario';
import { usePermisos } from './permisosPanel';

/**
 * C-RASTREO-VIVO (16 nov 2026, orden de Richard: «nosotros vivimos del tiempo y de los mapas»).
 * Todos los países. El rastreo en vivo de la ficha del pedido y de la del viaje: el tramo en palabras,
 * la hora de llegada («Llega a las 3:28 p. m. · faltan 9 min · 3,2 km»), el mapa de Google con el
 * local o la recogida, el destino, la ruta y el repartidor que se desliza solo, y si está detenido.
 *
 * Dinero y privacidad:
 * - Pregunta cada `REFRESCO_RASTREO_MS` SOLO mientras la ficha está abierta y la pestaña visible
 *   (oculta, se pausa) y solo mientras el pedido o viaje está vivo. La consulta solo lee.
 * - Solo con el permiso `viajes.ubicacion_en_vivo` (el servidor lo exige igual).
 */
export const REFRESCO_RASTREO_MS = 5_000;
/** Con la última señal más vieja que esto, se dice («Última señal hace…») y la marca se apaga. */
const SENAL_VIEJA_S = 60;

export type DatosRastreo = {
  vivo: boolean;
  estado: string;
  fase: FaseRastreo | null;
  esEnvio: boolean;
  origen: { lat: number; lng: number } | null;
  destino: { lat: number; lng: number } | null;
  posicion: { lat: number; lng: number; en: string; haceS: number } | null;
  llegada: {
    fase: FaseRastreo;
    llegaEn: string;
    faltanS: number;
    tramoFaltanS: number | null;
    distanciaM: number;
    fuente: 'trafico' | 'estimada';
    calculadaHaceS: number;
  } | null;
  ruta: string | null;
  detenido: Detenido | null;
};

const T = {
  es: {
    titulo: 'En vivo',
    llega: 'Llega a las {h}',
    faltan: 'faltan {m} min',
    alLocal: 'Llega al restaurante en {m} min',
    aRecogida: 'Llega a la recogida en {m} min',
    sinTrafico: 'Calculada sin tráfico (sin conexión con el servicio de mapas o al tope del día).',
    sinPosicion: 'Todavía no hay una ubicación del repartidor.',
    sinPermiso: 'Tu cuenta no tiene permiso para ver la ubicación en vivo.',
    cerrado: 'Terminó: la ubicación en vivo ya no se muestra.',
    error: 'No se pudo actualizar el rastreo. Lo intentamos de nuevo en unos segundos.',
    mapa: 'Mapa en vivo del pedido',
    repartidor: 'Repartidor',
    conductor: 'Conductor',
    restaurante: 'Restaurante',
    recogida: 'Recogida',
    cliente: 'Cliente (destino)',
    destino: 'Destino',
  },
  en: {
    titulo: 'Live',
    llega: 'Arrives at {h}',
    faltan: '{m} min left',
    alLocal: 'Reaches the restaurant in {m} min',
    aRecogida: 'Reaches the pickup in {m} min',
    sinTrafico:
      'Estimated without traffic (no connection to the maps service, or the daily limit was reached).',
    sinPosicion: 'There’s no driver location yet.',
    sinPermiso: 'Your account doesn’t have access to the live location.',
    cerrado: 'Finished: the live location is no longer shown.',
    error: 'The tracking couldn’t be updated. We’ll try again in a few seconds.',
    mapa: 'Live map of the order',
    repartidor: 'Driver',
    conductor: 'Driver',
    restaurante: 'Restaurant',
    recogida: 'Pickup',
    cliente: 'Customer (drop-off)',
    destino: 'Drop-off',
  },
};

/** Pide el rastreo cada pocos segundos mientras la pestaña está visible y el pedido vivo. */
export function useRastreo(ruta: string, activo: boolean) {
  const [datos, setDatos] = useState<DatosRastreo | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!activo) return;
    let vivo = true;
    let reloj: ReturnType<typeof setTimeout> | null = null;
    const visible = () => document.visibilityState !== 'hidden';
    const programar = () => {
      if (reloj) clearTimeout(reloj);
      reloj = visible() ? setTimeout(consultar, REFRESCO_RASTREO_MS) : null;
    };
    async function consultar() {
      if (!vivo || !visible()) return;
      try {
        const d = await pedir<DatosRastreo>('GET', ruta);
        if (!vivo) return;
        setDatos(d);
        setError(false);
        // Cerrado: no se vuelve a preguntar.
        if (d.vivo) programar();
      } catch (e) {
        console.error('rastreo en vivo', e);
        if (!vivo) return;
        setError(true);
        programar();
      }
    }
    const alCambiar = () => {
      if (visible()) void consultar();
      else if (reloj) {
        clearTimeout(reloj);
        reloj = null;
      }
    };
    document.addEventListener('visibilitychange', alCambiar);
    void consultar();
    return () => {
      vivo = false;
      if (reloj) clearTimeout(reloj);
      document.removeEventListener('visibilitychange', alCambiar);
    };
  }, [ruta, activo]);
  return { datos, error };
}

/** La tarjeta «En vivo» de la ficha. `fijos`: el local o la recogida y el destino. */
export function RastreoVivo({
  tipo,
  id,
  idioma,
  zona,
  pais,
  fijos,
  vivo,
}: {
  tipo: 'pedido' | 'viaje';
  id: string;
  idioma: Idioma;
  zona: string | null;
  pais?: string | null;
  fijos: PuntoFicha[];
  vivo: boolean;
}) {
  const t = enIdioma(T, idioma);
  const lengua = idioma === 'en' ? 'en' : 'es';
  const h = useHora(idioma, pais);
  const { puedeVer } = usePermisos();
  const permitido = puedeVer('viajes.ubicacion_en_vivo');
  const ruta = `/datos/admin/${tipo === 'pedido' ? 'pedidos' : 'viajes'}/${encodeURIComponent(id)}/rastreo`;
  const { datos, error } = useRastreo(ruta, permitido && vivo);
  if (!vivo) return null;
  if (!permitido)
    return (
      <section className="tarjeta-form ficha-vivo" aria-labelledby="ficha-vivo-titulo">
        <h2 id="ficha-vivo-titulo">{t.titulo}</h2>
        <p className="ficha-nota">{t.sinPermiso}</p>
      </section>
    );
  const d = datos;
  const pos = d?.posicion ?? null;
  const senalVieja = pos != null && pos.haceS > SENAL_VIEJA_S;
  // C-MAPA-LEYENDA: cada marca dice qué es (al tocarla, debajo del mapa) y la leyenda lo explica.
  const esViaje = tipo === 'viaje';
  const nombreLocal = esViaje ? t.recogida : t.restaurante;
  const nombreDestino = esViaje ? t.destino : t.cliente;
  const nombreMovil = esViaje && !d?.esEnvio ? t.conductor : t.repartidor;
  const esLocal = (idPunto: string) => idPunto === 'rest' || idPunto === 'o';
  const puntos = [
    ...fijos.map((f) => ({
      ...f,
      etiqueta: `${esLocal(f.id) ? nombreLocal : nombreDestino}: ${f.etiqueta}`,
    })),
    ...(pos
      ? [
          {
            id: 'repartidor',
            lat: pos.lat,
            lng: pos.lng,
            color: '#101010',
            etiqueta: nombreMovil,
            isotipo: true,
            apagado: senalVieja,
          },
        ]
      : []),
  ];
  const linea = d?.ruta ? decodificarRuta(d.ruta) : [];
  const l = d?.llegada ?? null;
  return (
    <section className="tarjeta-form ficha-vivo" aria-labelledby="ficha-vivo-titulo">
      <div className="ficha-encabezado-seccion">
        <h2 id="ficha-vivo-titulo">
          {t.titulo}
          {d?.fase ? (
            <span className="ficha-vivo-fase"> · {textoFase(d.fase, lengua, d.esEnvio)}</span>
          ) : null}
        </h2>
        {d?.detenido ? (
          <span className="bs-estado bs-problema" data-testid="ficha-detenido">
            {textoDetenido(d.detenido, lengua)}
          </span>
        ) : null}
      </div>
      {d && !d.vivo ? <p className="ficha-nota">{t.cerrado}</p> : null}
      {l ? (
        <p className="ficha-vivo-llegada" data-testid="ficha-llegada">
          <strong>{t.llega.replace('{h}', h.fecha(l.llegaEn, zona, 'hora'))}</strong>
          {' · '}
          {t.faltan.replace('{m}', String(minutosDeLlegada(l.faltanS)))}
          {' · '}
          {textoMetros(l.distanciaM, idioma)}
        </p>
      ) : null}
      {l && l.tramoFaltanS != null && (l.fase === 'al_restaurante' || l.fase === 'a_recogida') ? (
        <p className="ficha-nota">
          {(l.fase === 'al_restaurante' ? t.alLocal : t.aRecogida).replace(
            '{m}',
            String(minutosDeLlegada(l.tramoFaltanS)),
          )}
        </p>
      ) : null}
      {l?.fuente === 'estimada' ? <p className="ficha-nota">{t.sinTrafico}</p> : null}
      {d?.vivo && !pos ? <p className="ficha-nota">{t.sinPosicion}</p> : null}
      {senalVieja && pos ? (
        <p className="ficha-nota" data-testid="ficha-senal">
          {textoUltimaSenal(pos.haceS, lengua)}
        </p>
      ) : null}
      {error ? (
        <p className="error-general" role="status">
          {t.error}
        </p>
      ) : null}
      <MapaFicha
        puntos={puntos}
        idioma={idioma}
        etiqueta={t.mapa}
        lineas={linea.length > 1 ? [{ id: 'ruta', puntos: linea, color: '#F20D20' }] : []}
        leyenda={[
          { texto: nombreMovil, isotipo: true },
          ...(fijos.some((f) => esLocal(f.id))
            ? [{ texto: nombreLocal, color: fijos.find((f) => esLocal(f.id))?.color }]
            : []),
          ...(fijos.some((f) => !esLocal(f.id))
            ? [{ texto: nombreDestino, color: fijos.find((f) => !esLocal(f.id))?.color }]
            : []),
        ]}
        enVivo
      />
    </section>
  );
}
