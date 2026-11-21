import { useEffect, useState } from 'react';
import { GOOGLE_PLAY, type Idioma, enIdioma } from '@tumbite/compartido';
import { Enlace } from '../Enlace';

/**
 * C-INVITAR-LIDER-UN-PASO (21 nov 2026): la página del enlace personal de un líder invitado
 * (/driver/lead/<token>), como la invitación de Uber Fleet. Dice la línea y la ciudad, y con qué
 * correo crear la cuenta. «Crear mi cuenta» abre Divoox Driver en la web con su correo ya puesto; la
 * línea queda a su nombre sola en cuanto la crea.
 */
const T = {
  es: {
    titulo: 'Te invitamos a llevar una línea en Divoox',
    linea: (l: string, c: string) => `Vas a ser el líder de la línea «${l}» en ${c}.`,
    correo: 'Crea tu cuenta con este correo:',
    sinCorreo: 'Crea tu cuenta con el mismo celular con que te invitaron.',
    pasos: 'Cómo empezar',
    paso1: 'Toca «Crear mi cuenta» (o baja Divoox Driver en tu teléfono).',
    paso2: 'Crea tu cuenta de conductor con ese correo o celular.',
    paso3:
      'Listo: la línea queda a tu nombre sola. Desde «Mi línea» compartes el código con tus conductores.',
    crear: 'Crear mi cuenta',
    bajar: 'Bajar Divoox Driver',
    otras: 'Otras formas de bajar las apps',
    noExiste:
      'Esta invitación ya no está vigente: puede que ya hayas creado tu cuenta. Si no, pídele al equipo de Divoox un enlace nuevo.',
    cargando: 'Cargando…',
  },
  en: {
    titulo: 'You’re invited to lead a line on Divoox',
    linea: (l: string, c: string) => `You’ll be the leader of the “${l}” line in ${c}.`,
    correo: 'Create your account with this email:',
    sinCorreo: 'Create your account with the same cell phone you were invited with.',
    pasos: 'How to get started',
    paso1: 'Tap “Create my account” (or get Divoox Driver on your phone).',
    paso2: 'Create your driver account with that email or cell phone.',
    paso3:
      'Done: the line is yours automatically. From “My line” you share the code with your drivers.',
    crear: 'Create my account',
    bajar: 'Get Divoox Driver',
    otras: 'Other ways to get the apps',
    noExiste:
      'This invitation is no longer active: you may have already created your account. If not, ask the Divoox team for a new link.',
    cargando: 'Loading…',
  },
};

type Invitacion = { linea: string; ciudad: string; correo: string | null };

export function InvitacionLider({ idioma, token }: { idioma: Idioma; token: string }) {
  const t = enIdioma(T, idioma);
  const [inv, setInv] = useState<Invitacion | null | undefined>(undefined);
  useEffect(() => {
    let vivo = true;
    fetch(`/datos/lineas/invitacion/${encodeURIComponent(token)}`)
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
  }, [token]);
  return (
    <section className="descargas-cabeza invitacion" data-testid="invitacion-lider">
      <h1>{t.titulo}</h1>
      {inv === undefined ? <p className="pista">{t.cargando}</p> : null}
      {inv === null ? <p role="alert">{t.noExiste}</p> : null}
      {inv ? (
        <>
          <p style={{ fontSize: 20 }}>{t.linea(inv.linea, inv.ciudad)}</p>
          {inv.correo ? (
            <>
              <p>{t.correo}</p>
              <p data-testid="invitacion-lider-correo" style={{ fontSize: 22, fontWeight: 700 }}>
                {inv.correo}
              </p>
            </>
          ) : (
            <p>{t.sinCorreo}</p>
          )}
          <h2>{t.pasos}</h2>
          <ol>
            <li>{t.paso1}</li>
            <li>{t.paso2}</li>
            <li>{t.paso3}</li>
          </ol>
          <div className="fila-botones">
            <a
              className="boton"
              data-testid="invitacion-lider-crear"
              href={`/driver/?invitacion=${encodeURIComponent(token)}`}
            >
              {t.crear}
            </a>
            <a
              className="boton secundario"
              href={GOOGLE_PLAY.driver}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.bajar}
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
