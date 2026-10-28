import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { api } from '../panel/api';
import { ir } from '../ruta';

/**
 * Divoox Flex · seguimiento público por número de guía (como el rastreo de MRW y Zoom): quien
 * recibe un paquete escribe su código y ve en qué va, con fecha y hora. Solo estados y fechas:
 * nunca dirección, teléfono ni nombres (C-FLEX-SEGUIMIENTO).
 */
const T = {
  es: {
    titulo: 'Rastrea tu paquete',
    intro:
      'Escribe el número de seguimiento que aparece en tu etiqueta o en el mensaje que te enviaron.',
    campo: 'Número de seguimiento',
    buscar: 'Rastrear',
    buscando: 'Buscando…',
    noExiste: 'No encontramos ese número. Revisa que esté completo (empieza por DVX).',
    estadoActual: 'Estado actual',
    historial: 'Historial',
    estados: {
      creado: 'Envío creado',
      registrado_centro: 'Recibido en el centro',
      preparado: 'Preparado para salir',
      asignado: 'Asignado a un conductor',
      cargado: 'Cargado en el vehículo',
      en_transito: 'En camino a tu dirección',
      entregado: 'Entregado',
      entrega_fallida: 'No se pudo entregar',
      en_devolucion: 'En devolución',
      devuelto: 'Devuelto al remitente',
      cancelado: 'Cancelado',
    } as Record<string, string>,
    privado: 'Por tu privacidad, aquí no mostramos direcciones ni nombres.',
  },
  en: {
    titulo: 'Track your package',
    intro: 'Enter the tracking number shown on your label or in the message you received.',
    campo: 'Tracking number',
    buscar: 'Track',
    buscando: 'Searching…',
    noExiste: 'We couldn’t find that number. Make sure it’s complete (it starts with DVX).',
    estadoActual: 'Current status',
    historial: 'History',
    estados: {
      creado: 'Shipment created',
      registrado_centro: 'Received at the hub',
      preparado: 'Ready to leave',
      asignado: 'Assigned to a driver',
      cargado: 'Loaded on the vehicle',
      en_transito: 'On its way to your address',
      entregado: 'Delivered',
      entrega_fallida: 'Delivery attempt failed',
      en_devolucion: 'Being returned',
      devuelto: 'Returned to sender',
      cancelado: 'Canceled',
    } as Record<string, string>,
    privado: 'For your privacy, we don’t show addresses or names here.',
  },
};

type Seguimiento = {
  codigo: string;
  estado: string;
  final: boolean;
  eventos: { tipo: string; creadoEn: string }[];
};

export function Seguimiento({ codigo, idioma }: { codigo: string | null; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const estados = new Map(Object.entries(t.estados));
  const [texto, setTexto] = useState(codigo ?? '');
  const [datos, setDatos] = useState<Seguimiento | null>(null);
  const [falla, setFalla] = useState('');
  const [buscando, setBuscando] = useState(false);

  const buscar = useCallback(
    async (c: string) => {
      const limpio = c.trim().toUpperCase().replace(/\s+/g, '');
      if (!limpio) return;
      setBuscando(true);
      setFalla('');
      try {
        const r = await api.pedir<{ seguimiento: Seguimiento }>(
          'GET',
          `/datos/v1/flex/seguimiento/${encodeURIComponent(limpio)}`,
        );
        setDatos(r.seguimiento);
      } catch (x) {
        setDatos(null);
        setFalla(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : String(x));
      } finally {
        setBuscando(false);
      }
    },
    [t.noExiste],
  );
  useEffect(() => {
    if (!codigo) return;
    const r = setTimeout(() => void buscar(codigo), 0);
    return () => clearTimeout(r);
  }, [codigo, buscar]);

  const fecha = (s: string) => new Date(`${s.replace(' ', 'T')}Z`).toLocaleString(idioma);
  const pasos = (datos?.eventos ?? []).filter((e) => estados.has(e.tipo));
  return (
    <main className="ticket seguimiento">
      <h1>{t.titulo}</h1>
      <p>{t.intro}</p>
      <form
        className="formulario"
        onSubmit={(e) => {
          e.preventDefault();
          const c = texto.trim().toUpperCase();
          ir(`${idioma === 'es' ? '/es' : ''}/track/${encodeURIComponent(c)}`);
          void buscar(c);
        }}
      >
        <label className="campo">
          <span>{t.campo}</span>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="DVX0000000000"
            autoCapitalize="characters"
            autoComplete="off"
          />
        </label>
        <button type="submit" className="boton" disabled={buscando}>
          {buscando ? t.buscando : t.buscar}
        </button>
      </form>
      {falla && (
        <p className="error-general" role="alert">
          {falla}
        </p>
      )}
      {datos && (
        <section aria-live="polite">
          <p className="ticket-estado">
            {t.estadoActual}:{' '}
            <span className={`insignia ${datos.estado === 'entregado' ? 'insignia-aprobado' : ''}`}>
              {estados.get(datos.estado) ?? datos.estado}
            </span>{' '}
            · {datos.codigo}
          </p>
          <h2>{t.historial}</h2>
          <ol className="ticket-hilo">
            {pasos
              .slice()
              .reverse()
              .map((e, i) => (
                <li key={`${e.creadoEn}-${i}`} className="del-equipo">
                  <strong>{estados.get(e.tipo)}</strong>
                  <time dateTime={e.creadoEn}>{fecha(e.creadoEn)}</time>
                </li>
              ))}
          </ol>
          <p className="ticket-estado">{t.privado}</p>
        </section>
      )}
    </main>
  );
}
