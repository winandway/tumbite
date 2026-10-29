import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { api } from '../panel/api';
import { Enlace } from '../Enlace';

/**
 * C-SEGURIDAD-REPARTIDOR (29 oct 2026): lo que ve el contacto de confianza de un repartidor.
 * Sin cuenta, sin indexar, solo su primer nombre y su ubicación, y se apaga a las 12 horas.
 */
const T = {
  es: {
    titulo: 'Recorrido de un repartidor',
    cargando: 'Cargando…',
    noExiste: 'Este enlace no existe o está incompleto.',
    terminado: 'Este enlace ya se apagó.',
    privado:
      'Te compartieron este recorrido. Solo lo ve quien tiene el enlace, y se apaga en 12 horas.',
    conectado: 'Conectado y repartiendo',
    desconectado: 'Desconectado en este momento',
    mapa: 'Ver dónde está en el mapa',
    actualizado: 'Se actualiza solo cada pocos segundos.',
    volver: '← Volver al inicio',
  },
  en: {
    titulo: 'A driver’s trip',
    cargando: 'Loading…',
    noExiste: 'This link doesn’t exist or is incomplete.',
    terminado: 'This link has turned off.',
    privado:
      'This trip was shared with you. Only people with the link can see it, and it turns off in 12 hours.',
    conectado: 'Online and delivering',
    desconectado: 'Offline right now',
    mapa: 'See where they are on the map',
    actualizado: 'Updates on its own every few seconds.',
    volver: '← Back to home',
  },
};

type Recorrido = {
  terminado: boolean;
  nombre?: string;
  conectado?: boolean;
  ubicacion?: { lat: number; lng: number } | null;
};

export function RecorridoCompartido({ codigo, idioma }: { codigo: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [r, setR] = useState<Recorrido | null>(null);
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
      .pedir<{ recorrido: Recorrido }>('GET', `/datos/publico/recorrido/${codigo}`)
      .then((x) => setR(x.recorrido))
      .catch((x: unknown) =>
        setFalla(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : String(x)),
      );
  }, [codigo, t.noExiste]);
  useEffect(() => {
    cargar();
    const v = setInterval(cargar, 5_000);
    return () => clearInterval(v);
  }, [cargar]);
  if (!r || r.terminado)
    return (
      <main className="ticket">
        <h1>{t.titulo}</h1>
        <p role={falla ? 'alert' : 'status'}>
          {falla || (r?.terminado ? t.terminado : t.cargando)}
        </p>
        <Enlace a="/" className="docs-volver">
          {t.volver}
        </Enlace>
      </main>
    );
  return (
    <main className="ticket">
      <h1>
        {t.titulo}: {r.nombre}
      </h1>
      <p className="ticket-estado">
        <span className="insignia ticket-abierto">
          {r.conectado ? t.conectado : t.desconectado}
        </span>{' '}
        {t.privado}
      </p>
      {r.ubicacion ? (
        <p>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${r.ubicacion.lat},${r.ubicacion.lng}`}
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
