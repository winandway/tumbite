import { useEffect, useState } from 'react';
import { fechaHoraLocal } from '@tumbite/compartido';
import { pedir } from '../api';
import { BASE_FLEX, type Contexto, mensajeDe } from './PanelEmpresa';

/**
 * C-FLEX-RUTA-CALLES (Flex Fase 7). Todos los países. Kilómetros, duración y hora estimada por
 * parada de la ruta. Mirar solo lee lo guardado; «Calcular tiempos reales» confirma con el orden de
 * ahora (si ya estaba calculado para ese orden, no vuelve a preguntar a Google).
 */
const T = {
  es: {
    titulo: 'Recorrido por calles',
    sin: 'Todavía sin calcular. Se calcula solo al asignar u ofrecer la ruta.',
    calcular: 'Calcular tiempos reales',
    calculando: 'Calculando…',
    km: 'km',
    manejo: 'de manejo',
    google: 'Distancia y tiempo por calles, sin tráfico.',
    estimada: 'Estimación aproximada (no había consultas disponibles).',
    llegada: 'Llegada estimada',
  },
  en: {
    titulo: 'Route by road',
    sin: 'Not calculated yet. It’s calculated when you assign or offer the route.',
    calcular: 'Calculate real times',
    calculando: 'Calculating…',
    km: 'km',
    manejo: 'of driving',
    google: 'Road distance and time, without traffic.',
    estimada: 'Rough estimate (no lookups were available).',
    llegada: 'Estimated arrival',
  },
};

type Calles = { fuente: 'google' | 'estimada'; metros: number; segundos: number };
type Horas = { paradaId: string; llegada: string }[];

export function textoKm(metros: number, idioma: 'es' | 'en') {
  return (metros / 1000).toLocaleString(idioma === 'es' ? 'es' : 'en-US', {
    maximumFractionDigits: 1,
  });
}
export function textoDuracion(segundos: number) {
  const min = Math.round(segundos / 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

export function RecorridoCalles({
  ctx,
  rutaId,
  nombres,
  puedeCalcular,
}: {
  ctx: Contexto;
  rutaId: string;
  /** Nombre visible de cada parada, en orden (para la lista de horas). */
  nombres: { id: string; nombre: string }[];
  puedeCalcular: boolean;
}) {
  const idioma = ctx.idioma === 'en' ? 'en' : 'es';
  const t = idioma === 'en' ? T.en : T.es;
  const [d, setD] = useState<{ calles: Calles | null; horas: Horas } | null>(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const url = `${BASE_FLEX}/empresas/${ctx.empresa.id}/rutas/${rutaId}/calles`;
  useEffect(() => {
    pedir<{ calles: Calles | null; horas: Horas }>('GET', url)
      .then(setD)
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [url]);
  async function calcular() {
    setTrabajando(true);
    setError('');
    try {
      setD(await pedir('POST', url, {}));
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setTrabajando(false);
    }
  }
  const nombre = new Map(nombres.map((n) => [n.id, n.nombre]));
  return (
    <div className="flex-tarjeta">
      <h3>{t.titulo}</h3>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {d?.calles ? (
        <>
          <p>
            <strong>
              {textoKm(d.calles.metros, idioma)} {t.km}
            </strong>{' '}
            · {textoDuracion(d.calles.segundos)} {t.manejo}
          </p>
          <p className="pista">{d.calles.fuente === 'google' ? t.google : t.estimada}</p>
          <details>
            <summary>{t.llegada}</summary>
            <ol>
              {d.horas.map((h) => (
                <li key={h.paradaId}>
                  {nombre.get(h.paradaId) ?? ''} · {fechaHoraLocal(h.llegada, ctx.idioma)}
                </li>
              ))}
            </ol>
          </details>
        </>
      ) : d ? (
        <p className="pista">{t.sin}</p>
      ) : null}
      {puedeCalcular ? (
        <button
          type="button"
          className="boton secundario"
          disabled={trabajando}
          onClick={() => void calcular()}
        >
          {trabajando ? t.calculando : t.calcular}
        </button>
      ) : null}
    </div>
  );
}
