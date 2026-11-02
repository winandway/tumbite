import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  type RangoLlegada,
  enIdioma,
  senalPerdida,
  textoActualizado,
  textoAtrasado,
  textoRango,
} from '@tumbite/compartido';
import { api } from '../panel/api';
import { Enlace } from '../Enlace';

/**
 * C-SEGUIMIENTO-COMPARTIDO (29 oct 2026): lo que ve quien recibe el enlace de «Compartir el
 * seguimiento» de un pedido (como Uber Eats). Sin cuenta, sin indexar, sin dirección ni dinero;
 * el repartidor solo mientras va en camino; se apaga al entregar.
 * C-SEGUIMIENTO-HONESTO (BRE-2, 2 nov 2026): «Actualizado hace X s», aviso si se perdió la señal
 * del repartidor (el punto deja de ofrecerse como en vivo) y la llegada como rango.
 */
const T = {
  es: {
    titulo: 'Seguimiento de un pedido',
    cargando: 'Cargando el pedido…',
    noExiste: 'Este enlace no existe o está incompleto.',
    entregado: 'Este pedido ya se entregó. El enlace dejó de mostrar el seguimiento.',
    cancelado: 'Este pedido se canceló.',
    privado:
      'Te compartieron este pedido. Solo lo ve quien tiene el enlace, y se apaga al entregar.',
    estados: {
      pago_pendiente: 'Confirmando el pago',
      pagado: 'Esperando que el restaurante lo acepte',
      aceptado: 'El restaurante lo está preparando',
      listo: 'Listo, esperando al repartidor',
      en_camino: 'En camino',
    } as Record<string, string>,
    de: 'De',
    repartidor: 'Repartidor',
    mapa: 'Ver dónde va el repartidor en el mapa',
    actualizado: 'Se actualiza solo cada pocos segundos.',
    sinSenal:
      'Perdimos la señal del repartidor. Lo que ves es su última ubicación conocida; sigue en camino y la hora puede cambiar.',
    ultimaUbicacion: 'Ver su última ubicación conocida',
    llegaEntre: 'Llega entre',
    aMasTardar: 'A más tardar a las',
    volver: '← Volver al inicio',
  },
  en: {
    titulo: 'Order tracking',
    cargando: 'Loading the order…',
    noExiste: 'This link doesn’t exist or is incomplete.',
    entregado: 'This order was delivered. The link no longer shows tracking.',
    cancelado: 'This order was canceled.',
    privado:
      'This order was shared with you. Only people with the link can see it, and it turns off when it’s delivered.',
    estados: {
      pago_pendiente: 'Confirming payment',
      pagado: 'Waiting for the restaurant to accept',
      aceptado: 'The restaurant is preparing it',
      listo: 'Ready, waiting for the driver',
      en_camino: 'On the way',
    } as Record<string, string>,
    de: 'From',
    repartidor: 'Driver',
    mapa: 'See where the driver is on the map',
    actualizado: 'Updates on its own every few seconds.',
    sinSenal:
      'We lost the driver’s signal. What you see is their last known location; they’re still on the way and the time may change.',
    ultimaUbicacion: 'See their last known location',
    llegaEntre: 'Arrives between',
    aMasTardar: 'Latest arrival by',
    volver: '← Back to home',
  },
};

type Compartido = {
  estado: string;
  terminado: boolean;
  restaurante: string;
  repartidor?: string | null;
  ubicacion?: { lat: number; lng: number } | null;
  haceSegundos?: number | null;
  senalPerdida?: boolean;
  llegaAMasTardar?: string | null;
  llegadaRango?: RangoLlegada | null;
};

export function PedidoCompartido({ codigo, idioma }: { codigo: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [p, setP] = useState<Compartido | null>(null);
  const [falla, setFalla] = useState('');
  // Cuándo llegó la última respuesta: «hace X s» sigue contando entre consulta y consulta.
  const [recibido, setRecibido] = useState(() => Date.now());
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const r = setInterval(() => setAhora(Date.now()), 1_000);
    return () => clearInterval(r);
  }, []);
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  const cargar = useCallback(() => {
    api
      .pedir<{ pedido: Compartido }>('GET', `/datos/publico/pedido/${codigo}`)
      .then((r) => {
        setP(r.pedido);
        setRecibido(Date.now());
        setAhora(Date.now());
      })
      .catch((x: unknown) =>
        setFalla(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : String(x)),
      );
  }, [codigo, t.noExiste]);
  useEffect(() => {
    cargar();
    const r = setInterval(cargar, 5_000);
    return () => clearInterval(r);
  }, [cargar]);

  if (!p || p.terminado)
    return (
      <main className="ticket">
        <h1>{t.titulo}</h1>
        <p role={falla ? 'alert' : 'status'}>
          {falla ||
            (p?.terminado ? (p.estado === 'cancelado' ? t.cancelado : t.entregado) : t.cargando)}
        </p>
        <Enlace a="/" className="docs-volver">
          {t.volver}
        </Enlace>
      </main>
    );
  const hace =
    p.haceSegundos != null
      ? p.haceSegundos + Math.max(0, Math.floor((ahora - recibido) / 1000))
      : null;
  const sinSenal = Boolean(p.senalPerdida) || senalPerdida(hace);
  return (
    <main className="ticket">
      <h1>{t.titulo}</h1>
      <p className="ticket-estado">
        <span className="insignia ticket-abierto">{t.estados[p.estado] ?? p.estado}</span>{' '}
        {t.privado}
      </p>
      <p>
        <strong>{t.de}:</strong> {p.restaurante}
        {p.repartidor ? (
          <>
            <br />
            <strong>{t.repartidor}:</strong> {p.repartidor}
          </>
        ) : null}
      </p>
      {p.llegadaRango ? (
        <p>
          {p.llegadaRango.atrasado ? <strong>{textoAtrasado(idioma)} · </strong> : null}
          <strong>{t.llegaEntre}</strong> {textoRango(p.llegadaRango, idioma)}
          {p.llegaAMasTardar && !p.llegadaRango.atrasado ? (
            <>
              <br />
              {t.aMasTardar}{' '}
              {new Date(p.llegaAMasTardar).toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </>
          ) : null}
        </p>
      ) : null}
      {sinSenal ? <p role="alert">{t.sinSenal}</p> : null}
      {p.ubicacion ? (
        <p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${p.ubicacion.lat},${p.ubicacion.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {sinSenal ? t.ultimaUbicacion : t.mapa}
          </a>
        </p>
      ) : null}
      <p className="ticket-estado">
        {hace != null ? textoActualizado(hace, idioma) : t.actualizado}
      </p>
    </main>
  );
}
