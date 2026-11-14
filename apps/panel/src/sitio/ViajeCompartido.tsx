import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { api } from '../panel/api';
import { Enlace } from '../Enlace';

const T = {
  es: {
    titulo: 'Viaje en Moto en vivo',
    tituloCarro: 'Viaje en Carro en vivo',
    // C-ENVIO-TEXTOS (14 nov 2026): quien recibe un paquete ve su envío, no «un viaje».
    tituloEnvio: 'Tu paquete en vivo',
    privadoEnvio:
      'Te enviaron un paquete. Solo lo ve quien tiene el enlace, y se apaga al entregarlo.',
    terminadoEnvio: 'Este envío ya terminó. El enlace dejó de mostrar el recorrido.',
    estadosEnvio: {
      buscando: 'Buscando conductor',
      pago_pendiente: 'Buscando conductor',
      asignado: 'El conductor va a recoger el paquete',
      conductor_llego: 'El conductor está recogiendo el paquete',
      en_curso: 'Tu paquete va en camino',
    } as Record<string, string>,
    carro: 'Carro',
    cargando: 'Cargando el viaje…',
    noExiste: 'Este enlace no existe o está incompleto.',
    terminado: 'Este viaje ya terminó. El enlace dejó de mostrar el recorrido.',
    privado:
      'Te compartieron este viaje. Solo lo ve quien tiene el enlace, y se apaga al terminar.',
    estados: {
      buscando: 'Buscando conductor',
      pago_pendiente: 'Buscando conductor',
      asignado: 'El conductor va a recoger',
      conductor_llego: 'El conductor llegó a la recogida',
      en_curso: 'En camino al destino',
    } as Record<string, string>,
    conductor: 'Conductor',
    moto: 'Moto',
    placa: 'Placa',
    desde: 'Desde',
    hacia: 'Hacia',
    mapa: 'Ver la ubicación del conductor en el mapa',
    actualizado: 'Se actualiza solo cada pocos segundos.',
    volver: '← Volver al inicio',
  },
  en: {
    titulo: 'Live Moto ride',
    tituloCarro: 'Live car ride',
    tituloEnvio: 'Your package, live',
    privadoEnvio:
      'Someone sent you a package. Only people with the link can see it, and it turns off once it’s delivered.',
    terminadoEnvio: 'This delivery has ended. The link no longer shows the trip.',
    estadosEnvio: {
      buscando: 'Looking for a driver',
      pago_pendiente: 'Looking for a driver',
      asignado: 'The driver is heading to pick up the package',
      conductor_llego: 'The driver is picking up the package',
      en_curso: 'Your package is on its way',
    } as Record<string, string>,
    carro: 'Car',
    cargando: 'Loading the ride…',
    noExiste: 'This link doesn’t exist or is incomplete.',
    terminado: 'This ride has ended. The link no longer shows the trip.',
    privado:
      'This ride was shared with you. Only people with the link can see it, and it turns off when the ride ends.',
    estados: {
      buscando: 'Looking for a driver',
      pago_pendiente: 'Looking for a driver',
      asignado: 'The driver is heading to pickup',
      conductor_llego: 'The driver arrived at pickup',
      en_curso: 'On the way to the destination',
    } as Record<string, string>,
    conductor: 'Driver',
    moto: 'Motorcycle',
    placa: 'Plate',
    desde: 'From',
    hacia: 'To',
    mapa: 'See the driver’s location on the map',
    actualizado: 'Updates on its own every few seconds.',
    volver: '← Back to home',
  },
};

type Compartido = {
  estado: string;
  servicio?: string;
  terminado: boolean;
  origen?: string;
  destino?: string;
  conductor?: string | null;
  vehiculo?: {
    marca: string | null;
    modelo: string | null;
    color: string | null;
    placa: string | null;
  } | null;
  ubicacion?: { lat: number; lng: number } | null;
};

/**
 * Divoox Moto · M6: lo que ve quien recibe el enlace de «Compartir mi viaje» (como «Share My Ride»
 * de Grab). Sin cuenta, sin indexar, y se apaga solo cuando el viaje termina.
 */
export function ViajeCompartido({ codigo, idioma }: { codigo: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [viaje, setViaje] = useState<Compartido | null>(null);
  const [falla, setFalla] = useState('');

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const cargar = useCallback(() => {
    api
      .pedir<{ viaje: Compartido }>('GET', `/datos/publico/viaje/${codigo}`)
      .then((r) => setViaje(r.viaje))
      .catch((x: unknown) =>
        setFalla(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : String(x)),
      );
  }, [codigo, t.noExiste]);
  useEffect(() => {
    cargar();
    const r = setInterval(cargar, 5_000);
    return () => clearInterval(r);
  }, [cargar]);

  const envio = viaje?.servicio === 'envios';
  const titulo = envio ? t.tituloEnvio : viaje?.servicio === 'carro' ? t.tituloCarro : t.titulo;
  const estados = envio ? t.estadosEnvio : t.estados;
  if (!viaje || viaje.terminado)
    return (
      <main className="ticket">
        <h1>{titulo}</h1>
        <p role={falla ? 'alert' : 'status'}>
          {falla || (viaje?.terminado ? (envio ? t.terminadoEnvio : t.terminado) : t.cargando)}
        </p>
        <Enlace a="/" className="docs-volver">
          {t.volver}
        </Enlace>
      </main>
    );

  const v = viaje.vehiculo;
  return (
    <main className="ticket">
      <h1>{titulo}</h1>
      <p className="ticket-estado">
        <span className="insignia ticket-abierto">{estados[viaje.estado] ?? viaje.estado}</span>{' '}
        {envio ? t.privadoEnvio : t.privado}
      </p>
      {viaje.conductor ? (
        <p>
          <strong>{t.conductor}:</strong> {viaje.conductor}
          {v ? (
            <>
              <br />
              <strong>{viaje.servicio === 'carro' ? t.carro : t.moto}:</strong>{' '}
              {[v.marca, v.modelo, v.color].filter(Boolean).join(' · ')}
              {v.placa ? (
                <>
                  <br />
                  <strong>{t.placa}:</strong> {v.placa}
                </>
              ) : null}
            </>
          ) : null}
        </p>
      ) : null}
      <p>
        <strong>{t.desde}:</strong> {viaje.origen}
        <br />
        <strong>{t.hacia}:</strong> {viaje.destino}
      </p>
      {viaje.ubicacion ? (
        <p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${viaje.ubicacion.lat},${viaje.ubicacion.lng}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.mapa}
          </a>
        </p>
      ) : null}
      <p className="ticket-estado">{t.actualizado}</p>
    </main>
  );
}
