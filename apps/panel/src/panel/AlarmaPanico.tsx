import { useEffect, useRef, useState } from 'react';
import { pedir } from './api';
import './alarmaPanico.css';

/**
 * C-PANICO-PANEL (24 nov 2026) — todos los países. Un pánico sin atender hace sonar el panel del
 * equipo y lo pone en rojo aunque la pestaña esté detrás (hasta donde el navegador lo deja):
 *
 * - Pregunta cada 30 s, con la pestaña a la vista o no (el navegador puede espaciarlo a 1 min detrás).
 *   Una lectura chica; mirar no escribe nada.
 * - Con un pánico abierto: franja roja fija arriba, la sirena propia de pánico en bucle, el título de
 *   la pestaña parpadea y, si el navegador dio permiso, un aviso del sistema.
 * - «Silenciar» calla la sirena hasta que llegue un pánico NUEVO; la franja sigue roja hasta que se
 *   atiende en «Viajes» (o se abre el aviso en la app, en el del repartidor).
 */
export type EstadoPanico = { cantidad: number; ultimo: string | null };

/** Suena si hay pánicos abiertos y el último no es el que ya se silenció. */
export const debeSonar = (e: EstadoPanico | null, silenciado: string | null) =>
  Boolean(e && e.cantidad > 0 && e.ultimo && e.ultimo !== silenciado);

const TEXTOS = {
  es: {
    franja: (n: number) =>
      n === 1
        ? 'PÁNICO sin atender: alguien pide ayuda'
        : `PÁNICO sin atender: ${n} personas piden ayuda`,
    ver: 'Ver y atender',
    silenciar: 'Silenciar',
    titulo: '‼ PÁNICO',
    aviso: 'Alguien tocó el botón de pánico en Divoox',
  },
  en: {
    franja: (n: number) =>
      n === 1 ? 'Unanswered PANIC: someone needs help' : `Unanswered PANIC: ${n} people need help`,
    ver: 'View and respond',
    silenciar: 'Mute',
    titulo: '‼ PANIC',
    aviso: 'Someone pressed the panic button on Divoox',
  },
};

const CADA_MS = 30_000;

export function AlarmaPanico({ idioma, base }: { idioma: 'es' | 'en'; base: string }) {
  const t = idioma === 'en' ? TEXTOS.en : TEXTOS.es;
  const [estado, setEstado] = useState<EstadoPanico | null>(null);
  const [silenciado, setSilenciado] = useState<string | null>(null);
  const sirena = useRef<HTMLAudioElement | null>(null);
  const avisado = useRef<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const leer = () =>
      void pedir<EstadoPanico>('GET', '/datos/admin/panico/sin-atender')
        .then((r) => {
          if (vivo) setEstado({ cantidad: r.cantidad, ultimo: r.ultimo });
        })
        .catch((e: unknown) => console.warn('pánico del panel: no se pudo leer', e));
    leer();
    const reloj = window.setInterval(leer, CADA_MS);
    return () => {
      vivo = false;
      window.clearInterval(reloj);
    };
  }, []);

  const sonar = debeSonar(estado, silenciado);

  // La sirena en bucle mientras toque.
  useEffect(() => {
    if (!sonar) {
      sirena.current?.pause();
      return;
    }
    sirena.current ??= new Audio('/panico.wav');
    sirena.current.loop = true;
    void sirena.current.play().catch((e: unknown) => console.warn('pánico del panel: sonido', e));
    return () => sirena.current?.pause();
  }, [sonar]);

  // El título parpadea y, con permiso del navegador, un aviso del sistema (una vez por pánico).
  useEffect(() => {
    if (!sonar || !estado?.ultimo) return;
    const original = document.title;
    let alterno = false;
    const reloj = window.setInterval(() => {
      alterno = !alterno;
      document.title = alterno ? t.titulo : original;
    }, 1000);
    if (
      avisado.current !== estado.ultimo &&
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted'
    ) {
      avisado.current = estado.ultimo;
      try {
        new Notification(t.titulo, {
          body: t.aviso,
          tag: 'divoox-panico',
          requireInteraction: true,
        });
      } catch (e) {
        console.warn('pánico del panel: aviso del sistema', e);
      }
    }
    return () => {
      window.clearInterval(reloj);
      document.title = original;
    };
  }, [sonar, estado?.ultimo, t]);

  if (!estado || estado.cantidad <= 0) return null;
  return (
    <div className="alarma-panico" role="alert" data-testid="alarma-panico">
      <strong>{t.franja(estado.cantidad)}</strong>
      <a className="boton" href={`${base}/rides`}>
        {t.ver}
      </a>
      {sonar ? (
        <button
          type="button"
          className="boton secundario"
          onClick={() => setSilenciado(estado.ultimo)}
        >
          {t.silenciar}
        </button>
      ) : null}
    </div>
  );
}
