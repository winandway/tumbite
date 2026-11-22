import { useEffect, useState } from 'react';
import { type Idioma, ErrorApi, enIdioma } from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';
import { pedir } from './api';
import { ConfirmarCodigo, usePermisos } from './permisosPanel';

/**
 * C-PERMISOS-FINOS (MON-5, 15 nov 2026) — todos los países. Las dos piezas para lo delicado:
 * - `VerDato`: teléfono o correo enmascarado; «Ver dato» lo muestra completo con
 *   `clientes.datos_personales` y deja una fila en el registro de lo que se vio.
 * - `VerFoto`: la foto de recogida o entrega va borrosa hasta «Ver foto» (con `pedidos.fotos`);
 *   cada vista queda registrada. La foto de la puerta de la casa no pasa por aquí (C-FOTO-PUERTA).
 */
const T = {
  es: {
    verDato: 'Ver dato',
    ocultar: 'Ocultar',
    verFoto: 'Ver foto',
    sinPermisoFoto: 'Tu acceso no incluye ver fotos de entrega.',
    registrada: 'Cada vista queda registrada · Se guarda 30 días',
    borrada: 'Foto borrada por retención',
    sinFoto: 'Sin foto: entrega en mano',
    cargando: 'Cargando…',
    fotoDe: { recogida: 'Foto de recogida', entrega: 'Foto de entrega', ticket: 'Foto del ticket' },
  },
  en: {
    verDato: 'Show',
    ocultar: 'Hide',
    verFoto: 'View photo',
    sinPermisoFoto: 'Your access doesn’t include delivery photos.',
    registrada: 'Every view is logged · Kept for 30 days',
    borrada: 'Photo deleted by retention',
    sinFoto: 'No photo: handed to the customer',
    cargando: 'Loading…',
    fotoDe: { recogida: 'Pickup photo', entrega: 'Drop-off photo', ticket: 'Receipt photo' },
  },
};

export type TipoDato = 'cliente' | 'repartidor' | 'restaurante' | 'cuenta' | 'ticket' | 'pedido';

export function VerDato({
  tipo,
  id,
  campo,
  mascara,
  idioma,
}: {
  tipo: TipoDato;
  id: string;
  campo: 'telefono' | 'correo';
  mascara: string;
  idioma: Idioma;
}) {
  const t = enIdioma(T, idioma);
  const { puedeVer, recargar } = usePermisos();
  const [valor, setValor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pideCodigo, setPideCodigo] = useState(false);
  if (!mascara || mascara === '—') return <span>—</span>;
  async function ver() {
    setError('');
    try {
      const r = await pedir<{ valor: string }>(
        'GET',
        `/datos/admin/datos-personales/${tipo}/${encodeURIComponent(id)}/${campo}`,
      );
      setValor(r.valor);
    } catch (x) {
      if (x instanceof ErrorApi && x.campo === 'segundo_factor') setPideCodigo(true);
      else setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <span className="eq-dato">
      <span className={valor ? 'eq-dato-valor' : 'eq-dato-mascara'}>{valor ?? mascara}</span>
      {puedeVer('clientes.datos_personales') ? (
        // C-FICHA-SIN-CORTES: el ojito (como en las contraseñas). Verlo completo queda en la auditoría.
        <button
          type="button"
          className="eq-dato-ojo"
          aria-label={valor ? t.ocultar : t.verDato}
          title={valor ? t.ocultar : t.verDato}
          aria-pressed={Boolean(valor)}
          onClick={() => (valor ? setValor(null) : void ver())}
        >
          <Icono nombre={valor ? 'ocultar' : 'ver'} tamano={18} />
        </button>
      ) : null}
      {pideCodigo ? (
        <ConfirmarCodigo
          idioma={idioma}
          alConfirmar={() => {
            setPideCodigo(false);
            recargar();
            void ver();
          }}
        />
      ) : null}
      {error ? (
        <span className="error-campo" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}

export function VerFoto({
  pedidoId,
  tipo,
  idioma,
  estado = 'guardada',
}: {
  pedidoId: string;
  tipo: 'recogida' | 'entrega' | 'ticket';
  idioma: Idioma;
  /** guardada | borrada (por los 30 días) | sin_foto (entrega en mano). */
  estado?: 'guardada' | 'borrada' | 'sin_foto';
}) {
  const t = enIdioma(T, idioma);
  const { puedeVer, recargar } = usePermisos();
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [pideCodigo, setPideCodigo] = useState(false);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const titulo = new Map(Object.entries(t.fotoDe)).get(tipo) ?? t.fotoDe.entrega;
  if (estado === 'sin_foto') return <p className="pista">{t.sinFoto}</p>;
  if (estado === 'borrada') return <p className="pista">{t.borrada}</p>;
  async function ver() {
    setError('');
    setCargando(true);
    try {
      const r = await fetch(`/datos/pedidos/${encodeURIComponent(pedidoId)}/evidencia/${tipo}`, {
        credentials: 'same-origin',
        headers: { 'x-idioma': idioma },
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string; campo?: string };
        if (d.campo === 'segundo_factor') setPideCodigo(true);
        else setError(d.error ?? `${r.status}`);
        return;
      }
      setUrl(URL.createObjectURL(await r.blob()));
    } catch (x) {
      setError(String(x));
    } finally {
      setCargando(false);
    }
  }
  return (
    <figure className="eq-foto">
      <div className={url ? 'eq-foto-marco' : 'eq-foto-marco eq-foto-borrosa'}>
        {url ? <img src={url} alt={titulo} /> : <div className="eq-foto-velo" aria-hidden="true" />}
        {!url ? (
          puedeVer('pedidos.fotos') ? (
            <button
              type="button"
              className="boton chico eq-foto-boton"
              disabled={cargando}
              onClick={() => void ver()}
            >
              {cargando ? t.cargando : t.verFoto}
            </button>
          ) : (
            <span className="eq-foto-candado">{t.sinPermisoFoto}</span>
          )
        ) : null}
      </div>
      <figcaption>
        <strong>{titulo}</strong>
        <small>{t.registrada}</small>
      </figcaption>
      {pideCodigo ? (
        <ConfirmarCodigo
          idioma={idioma}
          alConfirmar={() => {
            setPideCodigo(false);
            recargar();
            void ver();
          }}
        />
      ) : null}
      {error ? (
        <p className="error-campo" role="alert">
          {error}
        </p>
      ) : null}
    </figure>
  );
}
