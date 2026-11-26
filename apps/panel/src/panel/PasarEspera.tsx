import { useState } from 'react';
import { type Idioma, ErrorApi, enIdioma } from '@tumbite/compartido';
import { pedir } from './api';
import { type PasoEspera, pasoDeRespuesta, textoMotivoPaso, textoPasaron } from './esperaCiudad';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte C (25 nov 2026; Venezuela y Estados Unidos). En Zonas: cuántos de
 * la lista de espera pasaron a la zona al abrirla o al guardar un área (lo cuenta el servidor en
 * `espera`), y el botón «Pasar a los que esperan» (`POST /datos/admin/zonas/:id/pasar-espera`) para
 * volver a correr el paso a mano. El servidor va de a un lote con tope: si quedan por revisar, se dice
 * «quedan N» y «Seguir» manda `{ desde: siguiente }` hasta terminar. El resultado va en verde: es un
 * éxito, aunque sean cero.
 */
const T = {
  es: {
    pasar: 'Pasar a los que esperan',
    seguir: 'Seguir',
    pasando: 'Pasando…',
    ayuda: 'Pasa a esta zona a las cuentas de la lista de espera cuya ciudad queda dentro de ella.',
  },
  en: {
    pasar: 'Move in the people waiting',
    seguir: 'Keep going',
    pasando: 'Moving…',
    ayuda: 'Moves into this zone the waitlist accounts whose city falls inside it.',
  },
};

/**
 * El aviso de cuántos pasaron (nada si el servidor no lo dijo) y, si quedan por revisar, «Seguir».
 * `conBoton`: además el botón para correr el paso a mano.
 */
export function PasarEspera({
  zonaId,
  idioma,
  inicial = null,
  conBoton = true,
  alPasar,
}: {
  zonaId: string;
  idioma: Idioma;
  /** Lo que ya respondió el servidor al encender la zona o guardar un área. */
  inicial?: PasoEspera | null;
  conBoton?: boolean;
  alPasar?: () => void;
}) {
  const t = enIdioma(T, idioma);
  const [paso, setPaso] = useState<PasoEspera | null>(inicial);
  // Lo que pasó en todas las vueltas de este mismo «Seguir».
  const [total, setTotal] = useState(inicial?.pasaron ?? 0);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function pasar(desde: string | null) {
    setError('');
    setEnviando(true);
    try {
      const r = pasoDeRespuesta(
        await pedir<unknown>(
          'POST',
          `/datos/admin/zonas/${encodeURIComponent(zonaId)}/pasar-espera`,
          desde ? { desde } : {},
        ),
      ) ?? { pasaron: 0, quedan: 0, siguiente: null, motivo: null };
      setTotal((n) => (desde ? n : 0) + r.pasaron);
      setPaso(r);
      alPasar?.();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }
  const sigue = Boolean(paso && paso.quedan > 0 && paso.siguiente);
  if (!conBoton && !paso) return null;
  return (
    <div className="lista-texto" style={{ flexBasis: '100%' }}>
      {conBoton ? (
        <span>
          <button
            type="button"
            className="boton secundario chico"
            onClick={() => void pasar(null)}
            disabled={enviando}
            title={t.ayuda}
            data-testid={`pasar-espera-${zonaId}`}
          >
            {enviando ? t.pasando : t.pasar}
          </button>
        </span>
      ) : null}
      {paso ? (
        paso.motivo ? (
          <p className="pista" role="status" data-testid="pasaron-espera">
            {textoMotivoPaso(paso.motivo, idioma)}
          </p>
        ) : (
          <p className="ok" role="status" data-testid="pasaron-espera">
            {textoPasaron(total, idioma, sigue ? paso.quedan : 0)}
          </p>
        )
      ) : null}
      {sigue ? (
        <span>
          <button
            type="button"
            className="boton chico"
            onClick={() => void pasar(paso?.siguiente ?? null)}
            disabled={enviando}
            data-testid={`seguir-espera-${zonaId}`}
          >
            {enviando ? t.pasando : t.seguir}
          </button>
        </span>
      ) : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
