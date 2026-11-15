import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { api } from './api';
import { AvisoBorrador } from './AvisoBorrador';

/** «1,5» o «1.5» según el idioma, a partir de puntos base (15 000). */
export const vecesDe = (pb: number, idioma: Idioma) =>
  (pb / 10_000).toLocaleString(idioma === 'en' ? 'en-US' : 'es', { maximumFractionDigits: 2 });

const T = {
  es: {
    titulo: 'Tarifa dinámica de Auto',
    ahora: 'Ahora',
    normal: 'precio normal',
    veces: 'veces el precio normal',
    buscando: 'viajes buscando conductor',
    libres: 'conductores libres',
    modos: {
      auto: 'Automática: sube y baja sola con la demanda',
      manual: 'Fijada a mano',
      apagada: 'Apagada: todos los viajes a precio normal',
    } as Record<string, string>,
    hasta: 'hasta',
    tope: 'Tope de esta ciudad',
    topePais: 'tope del país',
    fijar: 'Fijar a mano por un rato',
    multiplicador: 'Veces el precio normal (por ejemplo 1,2)',
    minutos: 'Durante cuántos minutos (de 5 a 360)',
    motivo: 'Motivo (un evento, la lluvia, una emergencia)',
    guardar: 'Fijar',
    apagar: 'Apagar la tarifa dinámica',
    automatica: 'Volver a automática',
    hecho: 'Listo. Las cotizaciones nuevas ya lo usan.',
    numero: 'Escribe las veces y los minutos con números.',
    faltaMotivo: 'Escribe el motivo.',
  },
  en: {
    titulo: 'Auto dynamic pricing',
    ahora: 'Now',
    normal: 'normal price',
    veces: 'times the normal price',
    buscando: 'rides looking for a driver',
    libres: 'available drivers',
    modos: {
      auto: 'Automatic: goes up and down with demand',
      manual: 'Set by hand',
      apagada: 'Off: every ride at the normal price',
    } as Record<string, string>,
    hasta: 'until',
    tope: 'This city’s cap',
    topePais: 'country cap',
    fijar: 'Set by hand for a while',
    multiplicador: 'Times the normal price (for example 1.2)',
    minutos: 'For how many minutes (5 to 360)',
    motivo: 'Reason (an event, rain, an emergency)',
    guardar: 'Set',
    apagar: 'Turn dynamic pricing off',
    automatica: 'Back to automatic',
    hecho: 'Done. New quotes use it now.',
    numero: 'Enter the multiplier and the minutes as numbers.',
    faltaMotivo: 'Enter the reason.',
  },
};

type Estado = {
  encendida: boolean;
  topePb: number;
  topePaisPb: number;
  modo: string;
  multiplicadorPb: number;
  demanda: number;
  oferta: number;
  valeHasta: string | null;
  motivo: string;
};

/**
 * C-CARRO-DINAMICA: cómo va la tarifa dinámica de una ciudad y lo que el equipo puede hacer con ella:
 * fijarla a mano por un rato (dentro del tope), apagarla (emergencia) o devolverla a automática. Lo
 * escrito no se pierde (borrador) y cada cambio queda en la auditoría con su motivo.
 */
export function DinamicaCiudad({ zona, idioma }: { zona: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<Estado | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: `dinamica-carro-${zona}`,
    cuenta: 'superadmin',
    inicial: { multiplicador: '', minutos: '60', motivo: '' },
    almacen: almacenNavegador,
  });
  const ruta = `/datos/admin/viajes/dinamica/carro/${zona}`;
  const cargar = useCallback(() => {
    api
      .pedir<{ dinamica: Estado | null }>('GET', ruta)
      .then((r) => setD(r.dinamica))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [ruta]);
  useEffect(() => {
    cargar();
    const r = setInterval(cargar, 30_000);
    return () => clearInterval(r);
  }, [cargar]);

  async function enviar(cuerpo: Record<string, unknown>) {
    setError('');
    setOk('');
    if (!b.valores.motivo.trim()) return setError(t.faltaMotivo);
    try {
      const r = await api.pedir<{ dinamica: Estado | null }>('PUT', ruta, {
        ...cuerpo,
        motivo: b.valores.motivo.trim(),
      });
      setD(r.dinamica);
      await b.limpiar();
      setOk(t.hecho);
    } catch (x) {
      // Lo escrito se queda para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  function fijar(e: React.FormEvent) {
    e.preventDefault();
    const veces = Number(b.valores.multiplicador.replace(',', '.'));
    const minutos = Number(b.valores.minutos);
    if (!(veces >= 1) || !Number.isInteger(minutos)) {
      setOk('');
      return setError(t.numero);
    }
    void enviar({ modo: 'manual', multiplicadorPb: Math.round(veces * 10_000), minutos });
  }

  if (!d) return null;
  return (
    <div className="tarjeta-form" data-testid={`dinamica-${zona}`}>
      <h3>{t.titulo}</h3>
      <p>
        <strong>
          {t.ahora}:{' '}
          {d.multiplicadorPb > 10_000
            ? `${vecesDe(d.multiplicadorPb, idioma)} ${t.veces}`
            : t.normal}
        </strong>
        {' · '}
        {d.demanda} {t.buscando} · {d.oferta} {t.libres}
      </p>
      <p className="pista">
        {new Map(Object.entries(t.modos)).get(d.modo) ?? d.modo}
        {d.modo === 'manual' && d.valeHasta ? ` (${t.hasta} ${d.valeHasta} UTC)` : ''}
        {d.motivo ? ` · ${d.motivo}` : ''}
        {' · '}
        {t.tope}: × {vecesDe(d.topePb, idioma)} ({t.topePais} × {vecesDe(d.topePaisPb, idioma)})
      </p>
      <form className="flex-form" onSubmit={fijar} noValidate>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.multiplicador}</span>
          <input
            inputMode="decimal"
            value={b.valores.multiplicador}
            onChange={(e) => b.cambiar('multiplicador', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.minutos}</span>
          <input
            inputMode="numeric"
            value={b.valores.minutos}
            onChange={(e) => b.cambiar('minutos', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.motivo}</span>
          <input value={b.valores.motivo} onChange={(e) => b.cambiar('motivo', e.target.value)} />
        </label>
        <div className="fila-botones">
          <button type="submit" className="boton">
            {t.guardar}
          </button>
          {d.modo !== 'apagada' ? (
            <button
              type="button"
              className="boton secundario"
              onClick={() => void enviar({ modo: 'apagada' })}
            >
              {t.apagar}
            </button>
          ) : null}
          {d.modo !== 'auto' ? (
            <button
              type="button"
              className="boton secundario"
              onClick={() => void enviar({ modo: 'auto' })}
            >
              {t.automatica}
            </button>
          ) : null}
        </div>
      </form>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
    </div>
  );
}
