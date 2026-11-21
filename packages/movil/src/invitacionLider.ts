import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { tokenDeEnlace } from '@tumbite/compartido';
import { URL_SERVIDOR } from './sesion';

/**
 * C-INVITAR-LIDER-UN-PASO (21 nov 2026): Driver abierto desde el enlace personal de un líder invitado
 * (`…/driver/?invitacion=<token>` en la web, o el mismo parámetro en el enlace de la app). Devuelve la
 * línea, la ciudad y el correo con que tiene que crear su cuenta, para abrir «Crear cuenta» con el
 * correo ya puesto. Sin enlace, o si la invitación ya no está vigente, null.
 */
export type InvitacionLiderApp = { linea: string; ciudad: string; correo: string | null };

export function useInvitacionLider(
  activa: boolean,
  alLlegar?: (inv: InvitacionLiderApp) => void,
): InvitacionLiderApp | null {
  const [inv, setInv] = useState<InvitacionLiderApp | null>(null);
  useEffect(() => {
    if (!activa) return;
    let vivo = true;
    Linking.getInitialURL()
      .then((url) => {
        const token = tokenDeEnlace(url);
        if (!token) return null;
        return fetch(`${URL_SERVIDOR}/datos/lineas/invitacion/${token}`).then(async (r) =>
          r.ok ? ((await r.json()) as { invitacion: InvitacionLiderApp }).invitacion : null,
        );
      })
      .then((x) => {
        if (vivo && x) {
          setInv(x);
          alLlegar?.(x);
        }
      })
      .catch(() => {
        // Sin red o enlace raro: se crea la cuenta como siempre; la línea igual se une por el correo.
      });
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se lee una vez al abrir
  }, [activa]);
  return inv;
}
