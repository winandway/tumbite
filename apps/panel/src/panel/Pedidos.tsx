import { useCallback, useEffect, useRef, useState } from 'react';
import { Icono } from '../sitio/Icono';
import {
  ErrorApi,
  type Idioma,
  enIdioma,
  formatearDolares,
  nombrePlato,
} from '@tumbite/compartido';
import { MenuTresPuntos } from './MenuTresPuntos';
import { ReportarPanel } from './ReportarPanel';
import { LuzSemaforo } from './LuzSemaforo';
import { pedir } from './api';

type Pedido = {
  id: string;
  estado: string;
  subtotal: number;
  notas: string;
  creadoEn: string;
  pagadoEn: string | null;
  aceptadoEn: string | null;
  listoEn: string | null;
  recogidoEn: string | null;
  tiempoPrepMin: number | null;
  lineas: { platoId: string; nombreEs: string; nombreEn: string; cantidad: number }[];
};

const T = {
  es: {
    titulo: 'Pedidos',
    activar: 'Activar sonido de alarma',
    sonidoOk: 'Alarma activada',
    vacio: 'Sin pedidos por ahora.',
    aceptar: 'Aceptar',
    min: 'min',
    listo: '¡Listo!',
    rechazar: 'Rechazar pedido',
    reportar: 'Reportar un problema',
    confirmar: '¿Rechazar este pedido? Se le devuelve todo el dinero al cliente.',
    mas: 'Más opciones',
    notas: 'Notas',
    estados: {
      pagado: 'Nuevo',
      aceptado: 'Preparando',
      listo: 'Listo para recoger',
      en_camino: 'En camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
    } as Record<string, string>,
  },
  en: {
    titulo: 'Orders',
    activar: 'Turn on alarm sound',
    sonidoOk: 'Alarm on',
    vacio: 'No orders right now.',
    aceptar: 'Accept',
    min: 'min',
    listo: 'Ready!',
    rechazar: 'Reject order',
    reportar: 'Report a problem',
    confirmar: 'Reject this order? The customer gets a full refund.',
    mas: 'More options',
    notas: 'Notes',
    estados: {
      pagado: 'New',
      aceptado: 'Preparing',
      listo: 'Ready for pickup',
      en_camino: 'On the way',
      entregado: 'Delivered',
      cancelado: 'Canceled',
    } as Record<string, string>,
  },
};

export function Pedidos({ idioma }: { idioma: Idioma }) {
  const [reportando, setReportando] = useState<string | null>(null);
  const t = enIdioma(T, idioma);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [error, setError] = useState('');
  const [sonido, setSonido] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);

  const cargar = useCallback(async () => {
    try {
      setPedidos((await pedir<{ pedidos: Pedido[] }>('GET', '/datos/restaurante/pedidos')).pedidos);
      setError('');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }, []);

  useEffect(() => {
    const primero = setTimeout(() => void cargar(), 0);
    const reloj = setInterval(() => void cargar(), 5000);
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
    };
  }, [cargar]);

  const hayNuevos = pedidos.some((p) => p.estado === 'pagado');
  useEffect(() => {
    const a = audio.current;
    if (!a || !sonido) return;
    if (hayNuevos) void a.play().catch(() => undefined);
    else a.pause();
  }, [hayNuevos, sonido]);

  function activarSonido() {
    // Los navegadores solo dejan sonar después de un toque de la persona.
    const a = new Audio('/alarma.wav');
    a.loop = true;
    audio.current = a;
    setSonido(true);
  }

  async function accion(ruta: string, cuerpo: unknown = {}) {
    try {
      await pedir('POST', ruta, cuerpo);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <section>
      <div className="titulo-fila">
        <h1>{t.titulo}</h1>
        {sonido ? (
          <span className="ok">
            <Icono nombre="alarma" tamano={18} /> {t.sonidoOk}
          </span>
        ) : (
          <button type="button" className="boton" onClick={activarSonido}>
            <Icono nombre="alarma" tamano={18} /> {t.activar}
          </button>
        )}
      </div>
      {error && <p className="error-general">{error}</p>}
      {pedidos.length === 0 && <p>{t.vacio}</p>}
      <ul className="lista">
        {pedidos.map((p) => (
          <li key={p.id} className={p.estado === 'pagado' ? 'resaltado' : ''}>
            <div className="lista-texto">
              <strong>
                #{p.id.slice(0, 4).toUpperCase()} · {t.estados[p.estado] ?? p.estado} ·{' '}
                {formatearDolares(p.subtotal, idioma)}
              </strong>
              <LuzSemaforo pedido={p} idioma={idioma} />
              {p.lineas.map((l) => (
                <span key={l.platoId}>
                  {l.cantidad} × {nombrePlato(l, idioma)}
                </span>
              ))}
              {p.notas && (
                <span>
                  {t.notas}: {p.notas}
                </span>
              )}
            </div>
            <div className="fila-botones">
              {p.estado === 'pagado' &&
                [10, 20, 30].map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="boton"
                    onClick={() =>
                      void accion(`/datos/restaurante/pedidos/${p.id}/aceptar`, { minutos: m })
                    }
                  >
                    {t.aceptar} · {m} {t.min}
                  </button>
                ))}
              {p.estado === 'aceptado' && (
                <button
                  type="button"
                  className="boton"
                  onClick={() => void accion(`/datos/restaurante/pedidos/${p.id}/listo`)}
                >
                  {t.listo}
                </button>
              )}
            </div>
            <MenuTresPuntos
              etiqueta={t.mas}
              opciones={[
                { texto: t.reportar, alTocar: () => setReportando(p.id) },
                ...(p.estado === 'pagado' || p.estado === 'aceptado'
                  ? [
                      {
                        texto: t.rechazar,
                        peligro: true,
                        alTocar: () => {
                          if (window.confirm(t.confirmar))
                            void accion(`/datos/restaurante/pedidos/${p.id}/rechazar`);
                        },
                      },
                    ]
                  : []),
              ]}
            />
            {reportando === p.id && (
              <ReportarPanel pedidoId={p.id} idioma={idioma} alCerrar={() => setReportando(null)} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
