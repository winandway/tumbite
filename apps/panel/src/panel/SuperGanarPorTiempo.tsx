import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';

/**
 * C-GANAR-POR-TIEMPO (R-T1, 1 nov 2026, como «Earn by Time» de DoorDash): el equipo fija cuánto se
 * garantiza por hora activa y por milla a quien elige cobrar por tiempo. En cero, está apagado.
 */
const T = {
  es: {
    titulo: 'Ganar por tiempo',
    ayuda:
      'El repartidor que elige «por tiempo» tiene garantizado este monto por hora activa (desde que acepta hasta que entrega) más el monto por milla. Si la oferta paga más, gana la oferta. Propinas y hora pico, aparte. En cero, está apagado.',
    monto: 'Por hora activa (dólares)',
    presupuesto: 'Por milla (dólares)',
    guardar: 'Guardar ganar por tiempo',
    guardado: 'Guardado. Se aplica en las próximas ofertas.',
    apagado: 'Apagado',
  },
  en: {
    titulo: 'Earn by Time',
    ayuda:
      'Drivers who choose “by time” are guaranteed this amount per active hour (from accepting to delivering) plus the per-mile amount. If the offer pays more, the offer wins. Tips and Peak Pay are extra. At zero, it’s off.',
    monto: 'Per active hour (dollars)',
    presupuesto: 'Per mile (dollars)',
    guardar: 'Save Earn by Time',
    guardado: 'Saved. It applies to the next offers.',
    apagado: 'Off',
  },
};

export function SuperGanarPorTiempo({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: 'ganar-por-tiempo',
    cuenta: 'superadmin',
    inicial: { monto: '', presupuesto: '' },
    almacen: almacenNavegador,
  });
  const { cargarBase } = b;
  const cargar = useCallback(() => {
    pedir<{ centavosHora: number; centavosMilla: number }>('GET', '/datos/admin/ganar-por-tiempo')
      .then((r) =>
        cargarBase({
          monto: String(r.centavosHora / 100),
          presupuesto: String(r.centavosMilla / 100),
        }),
      )
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [cargarBase]);
  useEffect(cargar, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await pedir('PUT', '/datos/admin/ganar-por-tiempo', {
        centavosHora: Math.round(Number(b.valores.monto || 0) * 100),
        centavosMilla: Math.round(Number(b.valores.presupuesto || 0) * 100),
      });
      await b.limpiar();
      setOk(t.guardado);
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <div data-testid="super-ganar-por-tiempo">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario tarjeta-form" onSubmit={(e) => void guardar(e)} noValidate>
        <label className="campo">
          {t.monto}
          <input
            type="number"
            inputMode="decimal"
            value={b.valores.monto}
            onChange={(e) => b.cambiar('monto', e.target.value)}
          />
        </label>
        <label className="campo">
          {t.presupuesto}
          <input
            type="number"
            inputMode="decimal"
            value={b.valores.presupuesto}
            onChange={(e) => b.cambiar('presupuesto', e.target.value)}
          />
        </label>
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
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
