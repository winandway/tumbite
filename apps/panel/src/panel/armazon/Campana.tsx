import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import type { Idioma } from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import { pedir } from '../api';
import { AyudaAqui } from '../AyudaAqui';

/**
 * C-CAMPANA-SE-VACIA (23 nov 2026, Richard) — la pieza ÚNICA de la campana de todos los paneles web
 * (superadmin, restaurante, franquicia, Divoox Flex). Sus palabras: «uno le da clic, la abre, los lee,
 * ve el historial y ya esa no se vuelve a ver más».
 *
 * - Es de LECTURA: el número cuenta solo lo que esa persona todavía no vio.
 * - Al abrirla va a CERO en ese momento y avisa al servidor UNA vez («visto hasta» el aviso más nuevo).
 *   El servidor lo guarda por cuenta: tampoco sale nuevo en el celular ni en otra computadora.
 * - Lo leído queda como historial, apagado; lo nuevo, resaltado. Lo resuelto se dice en verde.
 * - Cada aviso dice qué pasó y cuándo, y con un toque lleva al lugar donde se resuelve.
 * - Las TAREAS no viven aquí: son los números del menú (C-CONTADORES-DE-TAREA), que bajan al hacerlas.
 */
export type AvisoCampana = {
  clave: string;
  /** Qué pasó («Ticket nuevo»). */
  texto: string;
  /** Un dato corto para reconocerlo (el asunto, el nombre). */
  detalle?: string;
  /** Cuándo pasó, «AAAA-MM-DD HH:MM:SS» en UTC (como lo da el servidor). */
  en: string;
  /** El lugar donde se resuelve. */
  a: string;
  leido: boolean;
  resuelto?: boolean;
};

export type CampanaArmazon = {
  avisos: AvisoCampana[];
  /** El gesto de abrirla con algo nuevo: guardar «visto hasta» en el servidor. */
  alAbrir?: (hasta: string) => void;
};

const T = {
  es: {
    avisos: 'Avisos',
    sinLeer: (n: number) => `Avisos: ${n} sin leer`,
    vacio: 'No hay avisos todavía.',
    resuelto: 'Resuelto',
    nuevo: 'Nuevo',
  },
  en: {
    avisos: 'Notifications',
    sinLeer: (n: number) => `Notifications: ${n} unread`,
    vacio: 'No notifications yet.',
    resuelto: 'Resolved',
    nuevo: 'New',
  },
};

/** «hace 5 min», «hace 2 h», «hace 3 días» (o la fecha, si es más vieja). */
export function haceCuanto(en: string, idioma: Idioma, ahora = Date.now()) {
  const ms = Date.parse(`${en.replace(' ', 'T')}Z`);
  if (Number.isNaN(ms)) return '';
  const seg = Math.max(0, Math.round((ahora - ms) / 1000));
  const rtf = new Intl.RelativeTimeFormat(idioma === 'en' ? 'en-US' : 'es-US', { numeric: 'auto' });
  if (seg < 60) return rtf.format(0, 'second');
  if (seg < 3600) return rtf.format(-Math.round(seg / 60), 'minute');
  if (seg < 86_400) return rtf.format(-Math.round(seg / 3600), 'hour');
  if (seg < 7 * 86_400) return rtf.format(-Math.round(seg / 86_400), 'day');
  return new Date(ms).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-US', {
    month: 'short',
    day: 'numeric',
  });
}

/** El más nuevo de la lista (hasta ahí «lo vio»). */
export const hastaDe = (avisos: { en: string }[]) =>
  avisos.reduce((h, a) => (a.en > h ? a.en : h), '');

/** Guarda en el servidor que esa persona vio su campana hasta `hasta` (UNA escritura como mucho). */
export function guardarVisto(campana: string, hasta: string) {
  if (!hasta) return;
  void pedir('POST', '/datos/campana/visto', { campana, hasta }).catch((e: unknown) =>
    console.warn('campana: no se pudo guardar lo visto', e),
  );
}

export function Campana({ campana, idioma }: { campana: CampanaArmazon; idioma: Idioma }) {
  const t = idioma === 'en' ? T.en : T.es;
  const [abierto, setAbierto] = useState(false);
  // Lo que ya vio en esta pantalla (mientras llega la próxima lectura del servidor).
  const [vistoLocal, setVistoLocal] = useState('');
  // Los que eran nuevos al abrirla: se ven resaltados mientras está abierta.
  const [nuevosAlAbrir, setNuevosAlAbrir] = useState<ReadonlySet<string>>(new Set());
  const caja = useRef<HTMLDivElement>(null);
  const avisos = useMemo(
    () =>
      campana.avisos.map((a) => ({
        ...a,
        leido: a.leido || (vistoLocal !== '' && a.en <= vistoLocal),
      })),
    [campana.avisos, vistoLocal],
  );
  const sinLeer = avisos.filter((a) => !a.leido).length;

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const abrir = () => {
    if (abierto) {
      setAbierto(false);
      return;
    }
    setNuevosAlAbrir(new Set(avisos.filter((a) => !a.leido).map((a) => a.clave)));
    if (sinLeer > 0) {
      const hasta = hastaDe(avisos);
      setVistoLocal(hasta);
      campana.alAbrir?.(hasta);
    }
    setAbierto(true);
  };

  return (
    <div className="pd-campana" ref={caja}>
      <button
        type="button"
        className="pd-icono-boton"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label={sinLeer > 0 ? t.sinLeer(sinLeer) : t.avisos}
        data-testid="campana"
        onClick={abrir}
      >
        <Bell size={20} aria-hidden="true" />
        {sinLeer > 0 ? (
          <span className="pd-campana-numero" aria-hidden="true">
            {sinLeer > 99 ? '99+' : sinLeer}
          </span>
        ) : null}
      </button>
      {abierto ? (
        <div className="pd-flotante pd-campana-caja">
          <p className="pd-flotante-titulo">
            {t.avisos}
            {/* C-AYUDA-AQUI: solo existe en el superadmin (los demás paneles no tienen ayuda interna). */}
            <AyudaAqui guia="bell-and-menu-numbers" idioma={idioma} />
          </p>
          {avisos.length === 0 ? (
            <p className="pd-flotante-vacio">{t.vacio}</p>
          ) : (
            <ul className="pd-campana-lista">
              {avisos.map((a) => {
                const nuevo = nuevosAlAbrir.has(a.clave);
                return (
                  <li key={a.clave} className={nuevo ? 'pd-aviso-nuevo' : 'pd-aviso-leido'}>
                    <Enlace a={a.a} onClick={() => setAbierto(false)}>
                      <span className="pd-aviso-punto" aria-hidden="true" />
                      <span className="pd-aviso-cuerpo">
                        <span className="pd-aviso-texto">
                          {a.texto}
                          {nuevo ? <span className="oculto"> · {t.nuevo}</span> : null}
                        </span>
                        {a.detalle ? <span className="pd-aviso-detalle">{a.detalle}</span> : null}
                        <span className="pd-aviso-pie">
                          <time dateTime={`${a.en.replace(' ', 'T')}Z`}>
                            {haceCuanto(a.en, idioma)}
                          </time>
                          {a.resuelto ? (
                            <span className="pd-aviso-resuelto">{t.resuelto}</span>
                          ) : null}
                        </span>
                      </span>
                    </Enlace>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
