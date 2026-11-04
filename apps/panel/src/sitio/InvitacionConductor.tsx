import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, GOOGLE_PLAY } from '@tumbite/compartido';
import { api } from '../panel/api';

/**
 * C-FLEX-INVITAR-CONDUCTOR (1 nov 2026, como Onfleet y Spoke): la página del enlace que la empresa
 * le manda a su conductor. Dice quién lo invita y los tres pasos: instalar Divoox Driver, entrar con
 * el mismo celular o correo de la invitación y aceptarla en la app.
 */
const ANDROID = GOOGLE_PLAY.driver;
const IPHONE = 'https://apps.apple.com/app/id6829108327';

const T = {
  es: {
    titulo: (empresa: string) => `${empresa} te invitó a repartir con Divoox Driver`,
    hola: (nombre: string) => `Hola, ${nombre}.`,
    pasos: [
      'Instala Divoox Driver en tu celular.',
      'Crea tu cuenta o entra con el MISMO celular o correo donde te llegó esta invitación. Si ese celular o correo ya lo usas en otra cuenta de Divoox, crea tu cuenta de Driver con otros y, en el inicio de la app, toca «¿Una empresa te invitó? Pega su enlace».',
      'En la app aparece la invitación de tu empresa: toca «Aceptar». Desde ahí, tus rutas llegan a «Mi ruta (paquetes)».',
    ],
    android: 'Descargar en Google Play',
    iphone: 'Descargar en el App Store',
    vencida: 'Esta invitación ya no está vigente. Pídele a tu empresa que te mande una nueva.',
    noExiste: 'Esta invitación no existe. Revisa que el enlace esté completo.',
    cargando: 'Cargando…',
  },
  en: {
    titulo: (empresa: string) => `${empresa} invited you to deliver with Divoox Driver`,
    hola: (nombre: string) => `Hi, ${nombre}.`,
    pasos: [
      'Install Divoox Driver on your phone.',
      'Create your account or sign in with the SAME phone or email where you got this invitation. If you already use that phone or email in another Divoox account, create your Driver account with different ones and, on the app’s home screen, tap “Did a company invite you? Paste its link.”',
      'Your company’s invitation shows up in the app: tap “Accept.” From then on, your routes arrive in “My route (packages).”',
    ],
    android: 'Get it on Google Play',
    iphone: 'Download on the App Store',
    vencida: 'This invitation is no longer valid. Ask your company to send you a new one.',
    noExiste: 'This invitation doesn’t exist. Check that the link is complete.',
    cargando: 'Loading…',
  },
};

export function InvitacionConductor({ token, idioma }: { token: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<{ empresa: string; nombre: string; vigente: boolean } | null>(
    null,
  );
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .pedir<{ empresa: string; nombre: string; vigente: boolean }>(
        'GET',
        `/datos/v1/flex/invitacion-conductor/${token}`,
      )
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
    <main className="ticket seguimiento" data-testid="invitacion-conductor">
      <h1>{t.titulo(datos.empresa)}</h1>
      {datos.vigente ? (
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
