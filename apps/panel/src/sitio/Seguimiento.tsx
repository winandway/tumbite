import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
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
    llegada: 'Llegada estimada',
    proxima: 'Eres la próxima parada.',
    faltan: 'Faltan {n} paradas antes de la tuya.',
    mapa: 'Dónde va el conductor ahora (aproximado)',
    lugar: 'Dónde quedó',
    lugares: {
      destinatario: 'Entregado en mano',
      recepcion: 'En la recepción o con el conserje',
      puerta: 'En la puerta',
      buzon: 'En el buzón',
      otro: 'En otro lugar seguro',
    } as Record<string, string>,
    foto: 'Foto de la entrega',
    noEstaras:
      '¿No vas a estar? Usa el enlace que te envió la empresa para dejar instrucciones o confirmar tu ubicación, o escríbele a la empresa que te envía el paquete.',
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
    llegada: 'Estimated arrival',
    proxima: 'You’re the next stop.',
    faltan: '{n} stops before yours.',
    mapa: 'Where the driver is now (approximate)',
    lugar: 'Where it was left',
    lugares: {
      destinatario: 'Handed to you',
      recepcion: 'At the front desk or with the concierge',
      puerta: 'At the door',
      buzon: 'In the mailbox',
      otro: 'In another safe place',
    } as Record<string, string>,
    foto: 'Delivery photo',
    noEstaras:
      'Won’t be home? Use the link the company sent you to leave instructions or confirm your location, or contact the company sending the package.',
  },
};

type Seguimiento = {
  codigo: string;
  estado: string;
  final: boolean;
  eventos: { tipo: string; creadoEn: string }[];
  llegadaEstimada?: string | null;
  paradasAntes?: number | null;
  cerca?: { lat: number; lng: number; actualizadoEn: string } | null;
  entrega?: { lugar: string | null; foto: boolean; entregadoEn: string } | null;
};

/**
 * C-FLEX-SEGUIMIENTO-PLUS: un mapa liviano con las teselas públicas de OpenStreetMap (3 × 3, sin
 * biblioteca ni llave) y un punto donde va el conductor. Solo la posición aproximada del conductor
 * (no es un dato de Google Places), nunca la dirección de destino.
 */
export function teselasOsm(lat: number, lng: number, zoom = 15) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const teselas = [-1, 0, 1].flatMap((dy) =>
    [-1, 0, 1].map((dx) => ({
      url: `https://tile.openstreetmap.org/${zoom}/${cx + dx}/${cy + dy}.png`,
      col: dx + 1,
      fila: dy + 1,
    })),
  );
  // Posición del punto dentro del mosaico de 768 × 768 px.
  return { teselas, punto: { x: (x - cx + 1) * 256, y: (y - cy + 1) * 256 } };
}

function MapaConductor({ lat, lng, etiqueta }: { lat: number; lng: number; etiqueta: string }) {
  const { teselas, punto } = teselasOsm(lat, lng);
  return (
    <figure style={{ margin: '12px 0' }}>
      <div
        role="img"
        aria-label={etiqueta}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 384,
          aspectRatio: '1',
          overflow: 'hidden',
          borderRadius: 12,
          border: '1px solid #2a2a2a',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: 768,
            height: 768,
            left: `calc(50% - ${punto.x}px)`,
            top: `calc(50% - ${punto.y}px)`,
          }}
        >
          {teselas.map((t) => (
            <img
              key={t.url}
              src={t.url}
              alt=""
              width={256}
              height={256}
              style={{ position: 'absolute', left: t.col * 256, top: t.fila * 256 }}
            />
          ))}
        </div>
        <span
          style={{
            position: 'absolute',
            left: 'calc(50% - 9px)',
            top: 'calc(50% - 9px)',
            width: 18,
            height: 18,
            borderRadius: 9,
            background: '#1F4D69',
            border: '3px solid #fff',
            boxShadow: '0 1px 4px rgba(0,0,0,.3)',
          }}
        />
      </div>
      <figcaption className="pista">
        {etiqueta} · ©{' '}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap
        </a>
      </figcaption>
    </figure>
  );
}

export function Seguimiento({ codigo, idioma }: { codigo: string | null; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const estados = new Map(Object.entries(t.estados));
  const lugares = new Map(Object.entries(t.lugares));
  // Regla de la casa: ningún formulario pierde lo escrito (aunque sea un número de guía).
  const b = useBorrador({
    formulario: 'rastreo',
    inicial: { codigo: codigo ?? '' },
    almacen: almacenNavegador,
  });
  const texto = b.valores.codigo || codigo || '';
  const setTexto = (v: string) => b.cambiar('codigo', v);
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

  const fecha = (s: string) =>
    new Date(s.includes('T') ? s : `${s.replace(' ', 'T')}Z`).toLocaleString(idioma);
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
          {datos.llegadaEstimada && !datos.final ? (
            <p>
              <strong>{t.llegada}:</strong> {fecha(datos.llegadaEstimada)}
            </p>
          ) : null}
          {datos.paradasAntes != null && !datos.final ? (
            <p>
              {datos.paradasAntes === 0
                ? t.proxima
                : t.faltan.replace('{n}', String(datos.paradasAntes))}
            </p>
          ) : null}
          {datos.cerca ? (
            <MapaConductor lat={datos.cerca.lat} lng={datos.cerca.lng} etiqueta={t.mapa} />
          ) : null}
          {datos.entrega ? (
            <>
              {datos.entrega.lugar ? (
                <p>
                  <strong>{t.lugar}:</strong>{' '}
                  {lugares.get(datos.entrega.lugar) ?? datos.entrega.lugar}
                </p>
              ) : null}
              {datos.entrega.foto ? (
                <figure style={{ margin: '12px 0' }}>
                  <img
                    src={`/datos/v1/flex/seguimiento/${encodeURIComponent(datos.codigo)}/foto`}
                    alt={t.foto}
                    style={{ maxWidth: '100%', width: 384, borderRadius: 12 }}
                  />
                  <figcaption className="pista">{t.foto}</figcaption>
                </figure>
              ) : null}
            </>
          ) : null}
          {!datos.final ? <p className="pista">{t.noEstaras}</p> : null}
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
