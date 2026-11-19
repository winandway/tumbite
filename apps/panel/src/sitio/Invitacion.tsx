import { useEffect, useState } from 'react';
import { GOOGLE_PLAY, type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';

/**
 * C-REFERIDOS-EQUIPOS (17 nov 2026): la página del enlace de invitación (/join/<código>), como los
 * enlaces de invitación de Uber y DiDi. Dice quién invita (solo su nombre) y a qué equipo, y cómo
 * entrar: bajar la app y escribir el código al registrarse. El código la une a su equipo para siempre.
 */
const T = {
  es: {
    titulo: 'Te invitaron a Divoox',
    de: (n: string) => `${n} te invitó a Divoox.`,
    equipo: (e: string, c: string | null) => `Vas a entrar al equipo «${e}»${c ? ` de ${c}` : ''}.`,
    linea: (e: string, c: string | null) =>
      `Vas a pedir entrar a la línea «${e}»${c ? ` de ${c}` : ''}. Su líder te acepta con un toque.`,
    pasos: 'Cómo entrar',
    paso1: 'Baja la app. Si vas a manejar, baja Divoox Driver; si vas a pedir, baja Divoox.',
    paso2: 'Al crear tu cuenta, escribe este código en «Código de invitación»:',
    paso3: 'Listo: quedas registrado con tu invitación.',
    driver: 'Bajar Divoox Driver',
    cliente: 'Bajar Divoox',
    otras: 'Otras formas de bajar las apps',
    noExiste: 'Este enlace de invitación no existe o ya no está activo.',
    cargando: 'Cargando…',
  },
  en: {
    titulo: 'You’re invited to Divoox',
    de: (n: string) => `${n} invited you to Divoox.`,
    equipo: (e: string, c: string | null) => `You’ll join the “${e}” team${c ? ` in ${c}` : ''}.`,
    linea: (e: string, c: string | null) =>
      `You’ll ask to join the “${e}” line${c ? ` in ${c}` : ''}. Its leader accepts you with one tap.`,
    pasos: 'How to join',
    paso1: 'Get the app. If you’ll drive, get Divoox Driver; if you’ll order, get Divoox.',
    paso2: 'When you create your account, enter this code in “Invitation code”:',
    paso3: 'Done: you’re signed up with your invitation.',
    driver: 'Get Divoox Driver',
    cliente: 'Get Divoox',
    otras: 'Other ways to get the apps',
    noExiste: 'This invitation link doesn’t exist or is no longer active.',
    cargando: 'Loading…',
  },
};

type Invitacion = {
  codigo: string;
  nombre: string;
  equipo: string | null;
  ciudad: string | null;
  linea?: boolean;
};

export function Invitacion({ idioma, codigo }: { idioma: Idioma; codigo: string }) {
  const t = enIdioma(T, idioma);
  const [inv, setInv] = useState<Invitacion | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    fetch(`/datos/publico/invitacion/${encodeURIComponent(codigo)}`)
      .then(async (r) =>
        r.ok ? ((await r.json()) as { invitacion: Invitacion }).invitacion : null,
      )
      .then((x) => {
        if (vivo) setInv(x);
      })
      .catch(() => {
        if (vivo) setInv(null);
      });
    return () => {
      vivo = false;
    };
  }, [codigo]);
  return (
    <section className="descargas-cabeza invitacion" data-testid="invitacion">
      <h1>{t.titulo}</h1>
      {inv === undefined ? <p className="pista">{t.cargando}</p> : null}
      {inv === null ? <p role="alert">{t.noExiste}</p> : null}
      {inv ? (
        <>
          <p style={{ fontSize: 20 }}>{t.de(inv.nombre)}</p>
          {inv.equipo ? (
            <p style={{ fontSize: 18 }}>
              {(inv.linea ? t.linea : t.equipo)(inv.equipo, inv.ciudad)}
            </p>
          ) : null}
          <h2>{t.pasos}</h2>
          <ol>
            <li>{t.paso1}</li>
            <li>
              {t.paso2}
              <p
                data-testid="invitacion-codigo"
                style={{ fontSize: 32, fontWeight: 800, letterSpacing: 2, margin: '8px 0' }}
              >
                {inv.codigo}
              </p>
            </li>
            <li>{t.paso3}</li>
          </ol>
          <div className="fila-botones">
            <a
              className="boton"
              href={GOOGLE_PLAY.driver}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.driver}
            </a>
            <a
              className="boton secundario"
              href={GOOGLE_PLAY.cliente}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.cliente}
            </a>
          </div>
          <p>
            <Enlace a="/download">{t.otras}</Enlace>
          </p>
        </>
      ) : null}
    </section>
  );
}
