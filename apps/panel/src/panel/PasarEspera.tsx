import { useState } from 'react';
import { type Idioma, ErrorApi, enIdioma } from '@tumbite/compartido';
import { pedir } from './api';
import { pasaronDeRespuesta, textoPasaron } from './esperaCiudad';

/**
 * C-REGISTRO-TODO-EL-PAIS, parte C (25 nov 2026; Venezuela y Estados Unidos). En Zonas: cuántos de
 * la lista de espera pasaron a la zona al abrirla o al guardar un área (lo cuenta el servidor en
 * `pasaronDeEspera`), y el botón «Pasar a los que esperan» (`POST /datos/admin/zonas/:id/pasar-espera`)
 * para volver a correr el paso a mano. El resultado va en verde: es un éxito, aunque sean cero.
 */
const T = {
  es: {
    pasar: 'Pasar a los que esperan',
    pasando: 'Pasando…',
    ayuda: 'Pasa a esta zona a las cuentas de la lista de espera cuya ciudad queda dentro de ella.',
  },
  en: {
    pasar: 'Move in the people waiting',
    pasando: 'Moving…',
    ayuda: 'Moves into this zone the waitlist accounts whose city falls inside it.',
  },
};

/** El aviso verde de cuántos pasaron (nada si el servidor no lo dijo). */
export function AvisoPasaron({ n, idioma }: { n: number | null; idioma: Idioma }) {
  if (n == null) return null;
  return (
    <p className="ok" role="status" data-testid="pasaron-espera">
      {textoPasaron(n, idioma)}
    </p>
  );
}

export function PasarEspera({
  zonaId,
  idioma,
  alPasar,
}: {
  zonaId: string;
  idioma: Idioma;
  alPasar?: () => void;
}) {
  const t = enIdioma(T, idioma);
  const [n, setN] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function pasar() {
    setError('');
    setN(null);
    setEnviando(true);
    try {
      const r = await pedir<{ pasaronDeEspera: number }>(
        'POST',
        `/datos/admin/zonas/${encodeURIComponent(zonaId)}/pasar-espera`,
      );
      setN(pasaronDeRespuesta(r) ?? 0);
      alPasar?.();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <div className="lista-texto" style={{ flexBasis: '100%' }}>
      <span>
        <button
          type="button"
          className="boton secundario chico"
          onClick={() => void pasar()}
          disabled={enviando}
          title={t.ayuda}
          data-testid={`pasar-espera-${zonaId}`}
        >
          {enviando ? t.pasando : t.pasar}
        </button>
      </span>
      <AvisoPasaron n={n} idioma={idioma} />
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
