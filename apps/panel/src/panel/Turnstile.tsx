import { useEffect, useRef } from 'react';
import type { Idioma } from '@tumbite/compartido';

type TurnstileGlobal = {
  render: (
    el: HTMLElement,
    op: {
      sitekey: string;
      language?: string;
      callback: (pase: string) => void;
      'expired-callback'?: () => void;
    },
  ) => string;
  reset: (id?: string) => void;
};
type Ventana = Window & { turnstile?: TurnstileGlobal; tumbitePase?: string };

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let idWidget: string | undefined;

/** Borra el pase usado y pide otro (después de un 403 del servidor). */
export function reiniciarTurnstile() {
  const w = window as Ventana;
  w.tumbitePase = undefined;
  try {
    w.turnstile?.reset(idWidget);
  } catch {
    /* sin widget todavía */
  }
}

/**
 * Escudo anti-robots de Cloudflare en la web (F5 de la auditoría). Carga el script una vez,
 * pinta el widget y deja el pase en `window.tumbitePase`, que `api.ts` manda en la cabecera
 * `cf-turnstile-response`. Sin clave del sitio (desde /datos/publico) no se pinta nada.
 */
export function Turnstile({ sitio, idioma }: { sitio: string; idioma: Idioma }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!sitio || !ref.current) return;
    const w = window as Ventana;
    const el = ref.current;
    const pintar = () => {
      if (!w.turnstile || !el.isConnected || el.childElementCount) return;
      idWidget = w.turnstile.render(el, {
        sitekey: sitio,
        language: idioma,
        callback: (pase) => {
          w.tumbitePase = pase;
        },
        'expired-callback': () => {
          w.tumbitePase = undefined;
        },
      });
    };
    if (w.turnstile) pintar();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
      if (!s) {
        s = document.createElement('script');
        s.src = SCRIPT;
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener('load', pintar);
      return () => s?.removeEventListener('load', pintar);
    }
  }, [sitio, idioma]);
  if (!sitio) return null;
  return <div ref={ref} className="turnstile" data-testid="turnstile" />;
}
