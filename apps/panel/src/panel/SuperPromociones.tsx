import { useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-PROMO-RESTAURANTE (BRE-5): el interruptor de las promociones que arman y pagan los
 * restaurantes. Nace apagado; apagarlo deja de aplicarlas al momento (las ya cobradas quedan).
 */
const T = {
  es: {
    titulo: 'Promociones de los restaurantes',
    ayuda:
      'Cada restaurante arma su promoción (porcentaje, envío gratis o «gasta X y ahorra Y») y la paga él: sale de lo que le toca del pedido. Divoox no pone dinero. Apagado, nadie puede crearlas y no se aplica ninguna.',
    encendidas: 'Promociones encendidas',
    guardado: 'Guardado.',
  },
  en: {
    titulo: 'Restaurant promotions',
    ayuda:
      'Each restaurant creates its promotion (percentage off, free delivery or “spend X, save Y”) and funds it: it comes out of what it earns on the order. Divoox puts in no money. When off, nobody can create them and none applies.',
    encendidas: 'Promotions on',
    guardado: 'Saved.',
  },
};

export function SuperPromociones({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [encendidas, setEncendidas] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  useEffect(() => {
    pedir<{ encendidas: boolean }>('GET', '/datos/admin/promociones')
      .then((r) => setEncendidas(r.encendidas))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, []);

  async function cambiar(valor: boolean) {
    setError('');
    setOk('');
    try {
      const r = await pedir<{ encendidas: boolean }>('PUT', '/datos/admin/promociones', {
        encendidas: valor,
      });
      setEncendidas(r.encendidas);
      setOk(t.guardado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <div data-testid="super-promociones">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      {encendidas != null ? (
        <label className="casilla-fila">
          <input
            type="checkbox"
            checked={encendidas}
            onChange={(e) => void cambiar(e.target.checked)}
          />
          {t.encendidas}
        </label>
      ) : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
    </div>
  );
}
