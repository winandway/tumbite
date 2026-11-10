import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, GOOGLE_PLAY } from '@tumbite/compartido';
import { api } from '../panel/api';

/**
 * C-FLOTA-PROPIA (10 nov 2026) — Chile y todos los países. La página del enlace con el que un
 * restaurante invita a su repartidor: quién lo invita y los tres pasos para entrar a su equipo.
 */
const ANDROID = GOOGLE_PLAY.driver;
const IPHONE = 'https://apps.apple.com/app/id6829108327';

const T = {
  es: {
    titulo: (r: string) => `${r} te invitó a su equipo de reparto en Divoox Driver`,
    hola: (nombre: string) => `Hola, ${nombre}.`,
    pasos: [
      'Instala Divoox Driver en tu celular.',
      'Crea tu cuenta o entra con el MISMO correo o celular donde te llegó esta invitación. Si usas otros, en el inicio de la app toca «¿Te invitaron? Pega el enlace» y pega este enlace.',
      'En la app aparece la invitación del restaurante: toca «Aceptar». Desde ahí te llegan solo los pedidos de ese restaurante.',
    ],
    android: 'Descargar en Google Play',
    iphone: 'Descargar en el App Store',
    vencida: 'Esta invitación ya no está vigente. Pídele al restaurante que te mande una nueva.',
    noExiste: 'Esta invitación no existe. Revisa que el enlace esté completo.',
    cargando: 'Cargando…',
  },
  en: {
    titulo: (r: string) => `${r} invited you to its delivery team on Divoox Driver`,
    hola: (nombre: string) => `Hi, ${nombre}.`,
    pasos: [
      'Install Divoox Driver on your phone.',
      'Create your account or sign in with the SAME email or phone where you got this invitation. If you use different ones, on the app’s home screen tap “Were you invited? Paste the link” and paste this link.',
      'The restaurant’s invitation shows up in the app: tap “Accept.” From then on you only get that restaurant’s orders.',
    ],
    android: 'Get it on Google Play',
    iphone: 'Download on the App Store',
    vencida: 'This invitation is no longer valid. Ask the restaurant to send you a new one.',
    noExiste: 'This invitation doesn’t exist. Check that the link is complete.',
    cargando: 'Loading…',
  },
};

type Datos = { restaurante: string; nombre: string; estado: string };

export function InvitacionFlota({ token, idioma }: { token: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .pedir<Datos>('GET', `/datos/flota/invitacion/${token}`)
      .then(setDatos)
      .catch((x: unknown) =>
        setError(x instanceof ErrorApi && x.estado === 404 ? t.noExiste : String(x)),
      );
  }, [token, t.noExiste]);
  if (error)
    return (
      <main className="ticket seguimiento">
        <p className="error-general" role="alert">
          {error}
        </p>
      </main>
    );
  if (!datos)
    return (
      <main className="ticket seguimiento">
        <p>{t.cargando}</p>
      </main>
    );
  return (
    <main className="ticket seguimiento" data-testid="invitacion-flota">
      <h1>{t.titulo(datos.restaurante)}</h1>
      {datos.estado === 'pendiente' ? (
        <>
          <p>{t.hola(datos.nombre)}</p>
          <ol className="flex-pasos">
            {t.pasos.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
          <p className="flex-encabezado-botones">
            <a className="boton" href={ANDROID} target="_blank" rel="noopener noreferrer">
              {t.android}
            </a>
            <a className="boton secundario" href={IPHONE} target="_blank" rel="noopener noreferrer">
              {t.iphone}
            </a>
          </p>
        </>
      ) : (
        <p className="error-general" role="alert">
          {t.vencida}
        </p>
      )}
    </main>
  );
}
