import { useEffect, useState } from 'react';
import { crearInfoVersion, textoVersion, type Idioma, type InfoVersion } from '@tumbite/compartido';

// Lo graba vite.config.ts al COMPILAR la web (C-VERSION-DEL-ARTEFACTO). En las pruebas no existe.
declare const VERSION_WEB: { version: string; commit: string } | undefined;

/** La versión de ESTA web (la landing y el panel salen de la misma compilación). */
export const VERSION_DE_LA_WEB: InfoVersion =
  typeof VERSION_WEB === 'object' && VERSION_WEB
    ? crearInfoVersion(VERSION_WEB.version, VERSION_WEB.commit)
    : crearInfoVersion(undefined, undefined);

const T = {
  es: { web: 'Web', servidor: 'Servidor' },
  en: { web: 'Web', servidor: 'Server' },
};

/**
 * Línea discreta con la versión. Con `conServidor`, también la del servidor desplegado, leída de
 * /datos/version: si las dos no coinciden, se ve a simple vista.
 */
export function VersionPublicada({
  idioma,
  conServidor = false,
}: {
  idioma: Idioma;
  conServidor?: boolean;
}) {
  const [servidor, setServidor] = useState<InfoVersion | null>(null);
  useEffect(() => {
    if (!conServidor) return;
    let vivo = true;
    fetch('/datos/version', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { servidor?: InfoVersion } | null) => {
        if (vivo && d?.servidor)
          setServidor(crearInfoVersion(d.servidor.version, d.servidor.commit));
      })
      .catch((e: unknown) => console.warn('versión del servidor: no se pudo leer', e));
    return () => {
      vivo = false;
    };
  }, [conServidor]);
  const t = idioma === 'en' ? T.en : T.es;
  return (
    <small className="version-publicada" data-testid="version-publicada">
      {conServidor ? `${t.web}: ` : ''}
      {textoVersion(VERSION_DE_LA_WEB, idioma)}
      {servidor ? ` · ${t.servidor}: ${servidor.commit}` : ''}
    </small>
  );
}
