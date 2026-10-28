import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { api } from '../panel/api';
import { Enlace } from '../Enlace';
import { ElegirPunto } from './ElegirPunto';

const T = {
  es: {
    titulo: 'Confirma dónde recibes tu paquete',
    cargando: 'Cargando…',
    noExiste: 'Este enlace no existe o venció. Pídele uno nuevo a quien te envía el paquete.',
    teEnvia: 'te envía un paquete con Divoox.',
    paraQue:
      'Marca en el mapa el punto exacto de entrega. Así el conductor llega directo, sin llamarte para preguntar.',
    direccion: 'Dirección',
    referencias: 'Punto de referencia',
    referenciasEj: 'Por ejemplo: casa azul frente a la panadería, segundo piso',
    obligatoria: '(obligatorio)',
    confirmar: 'Confirmar mi ubicación',
    confirmando: 'Guardando…',
    faltaPunto: 'Toca el mapa para marcar el punto de entrega.',
    listo: '¡Listo! Tu ubicación quedó confirmada. El conductor va a llegar a ese punto.',
    cambiar:
      'Si te mudaste o te equivocaste, puedes volver a marcarla mientras el paquete no salga.',
    yaSalio: 'Este paquete ya va en camino: la ubicación ya no se puede cambiar.',
    app: 'Con la app de Divoox tus próximos paquetes llegan ya ubicados y los sigues en vivo.',
    seguir: 'Rastrear un paquete',
    privado: 'Solo la empresa que te envía el paquete y el conductor ven este punto.',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
  },
  en: {
    titulo: 'Confirm where you receive your package',
    cargando: 'Loading…',
    noExiste: 'This link doesn’t exist or has expired. Ask the sender for a new one.',
    teEnvia: 'is sending you a package with Divoox.',
    paraQue:
      'Mark the exact delivery spot on the map. That way the driver goes straight there, without calling you to ask.',
    direccion: 'Address',
    referencias: 'Landmark',
    referenciasEj: 'For example: blue house across from the bakery, second floor',
    obligatoria: '(required)',
    confirmar: 'Confirm my location',
    confirmando: 'Saving…',
    faltaPunto: 'Tap the map to mark the delivery spot.',
    listo: 'Done! Your location is confirmed. The driver will come to that spot.',
    cambiar: 'If you moved or made a mistake, you can mark it again until the package leaves.',
    yaSalio: 'This package is already on its way: the location can no longer be changed.',
    app: 'With the Divoox app your next packages arrive already located and you can follow them live.',
    seguir: 'Track a package',
    privado: 'Only the sender and the driver can see this spot.',
    recuperado: 'We restored what you were typing.',
    empezar: 'Start over',
  },
};

type Envio = {
  empresa: string;
  destinatario: string;
  direccion: string;
  referencias: string;
  punto: { lat: number; lng: number } | null;
  confirmada: boolean;
  pais: string;
  referenciasObligatorias: boolean;
  centroMapa: { lat: number; lng: number };
  abierto: boolean;
};

/**
 * Divoox Flex · «Confirma dónde recibes» (C-FLEX-UBICACION). La empresa le manda este enlace por
 * WhatsApp al destinatario; sin cuenta, marca su casa en el mapa con un punto de referencia y la ruta
 * puede salir. Ningún programa grande de última milla lo trae (investigación del 28 oct 2026).
 */
export function ConfirmarUbicacion({ codigo, idioma }: { codigo: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [envio, setEnvio] = useState<Envio | null>(null);
  const [falla, setFalla] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const b = useBorrador({
    formulario: 'ubicacion-entrega',
    cuenta: codigo,
    inicial: { direccion: '', referencias: '', lat: '', lng: '' },
    almacen: almacenNavegador,
  });

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  const cargar = useCallback(() => {
    api
      .pedir<{ envio: Envio }>('GET', `/datos/v1/flex/publico/ubicacion/${codigo}`)
      .then((r) => setEnvio(r.envio))
      .catch((x: unknown) =>
        setFalla(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : String(x)),
      );
  }, [codigo, t.noExiste]);
  useEffect(() => {
    const r = setTimeout(cargar, 0);
    return () => clearTimeout(r);
  }, [cargar]);

  const v = b.valores;
  const punto = v.lat ? { lat: Number(v.lat), lng: Number(v.lng) } : (envio?.punto ?? null);

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    if (!punto) return setFalla(t.faltaPunto);
    setEnviando(true);
    setFalla('');
    try {
      await api.pedir('POST', `/datos/v1/flex/publico/ubicacion/${codigo}`, {
        lat: punto.lat,
        lng: punto.lng,
        ...(v.direccion.trim().length >= 3 ? { direccion: v.direccion.trim() } : {}),
        referencias: v.referencias.trim() || envio?.referencias || '',
      });
      await b.limpiar();
      setListo(true);
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  if (!envio)
    return (
      <main className="ticket">
        <h1>{t.titulo}</h1>
        <p role={falla ? 'alert' : 'status'}>{falla || t.cargando}</p>
      </main>
    );

  return (
    <main className="ticket confirmar-ubicacion">
      <h1>{t.titulo}</h1>
      <p>
        <strong>{envio.empresa}</strong> {t.teEnvia} {t.paraQue}
      </p>
      {listo ? (
        <section role="status">
          <p className="aviso-exito">{t.listo}</p>
          <p>{t.cambiar}</p>
          <p>{t.app}</p>
          <Enlace a="/track" className="boton secundario">
            {t.seguir}
          </Enlace>
        </section>
      ) : !envio.abierto ? (
        <p role="alert">{t.yaSalio}</p>
      ) : (
        <form className="formulario" onSubmit={(e) => void confirmar(e)} noValidate>
          {b.recuperado && (
            <p className="aviso-borrador">
              {t.recuperado}{' '}
              <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
                {t.empezar}
              </button>
            </p>
          )}
          <ElegirPunto
            punto={punto}
            cambiar={(p) => {
              b.cambiar('lat', String(p.lat));
              b.cambiar('lng', String(p.lng));
            }}
            centro={envio.centroMapa}
            pais={envio.pais}
            idioma={idioma}
            alDireccion={(d) => b.cambiar('direccion', d)}
          />
          <label className="campo">
            <span>{t.direccion}</span>
            <input
              value={v.direccion || envio.direccion}
              onChange={(e) => b.cambiar('direccion', e.target.value)}
            />
          </label>
          <label className="campo">
            <span>
              {t.referencias} {envio.referenciasObligatorias ? t.obligatoria : ''}
            </span>
            <input
              value={v.referencias || envio.referencias}
              placeholder={t.referenciasEj}
              onChange={(e) => b.cambiar('referencias', e.target.value)}
            />
          </label>
          {falla && (
            <p className="error-general" role="alert">
              {falla}
            </p>
          )}
          <button type="submit" className="boton" disabled={enviando}>
            {enviando ? t.confirmando : t.confirmar}
          </button>
          <p className="pista">{t.privado}</p>
        </form>
      )}
    </main>
  );
}
