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
 * C-PAGO-PICO (D7, 1 nov 2026, como el «Peak Pay» de DoorDash): el equipo fija cuánto se suma a
 * cada pedido en las zonas con mucha demanda y el presupuesto del día. En cero, está apagado.
 */
const T = {
  es: {
    titulo: 'Pago por hora pico',
    ayuda:
      'En las zonas que el mapa del repartidor marca con mucha demanda, cada oferta suma este monto, que pone Divoox y se paga al entregar. Al gastarse el presupuesto del día, se detiene solo. En cero, está apagado.',
    monto: 'Monto por pedido (dólares)',
    presupuesto: 'Presupuesto por día (dólares)',
    guardar: 'Guardar el pago pico',
    guardado: 'Guardado. Se aplica en las próximas ofertas.',
    apagado: 'Apagado',
  },
  en: {
    titulo: 'Peak Pay',
    ayuda:
      'In the zones the driver map marks as busy, each offer adds this amount, paid by Divoox on delivery. Once the daily budget is used up, it stops on its own. At zero, it’s off.',
    monto: 'Amount per order (dollars)',
    presupuesto: 'Budget per day (dollars)',
    guardar: 'Save Peak Pay',
    guardado: 'Saved. It applies to the next offers.',
    apagado: 'Off',
  },
};

export function SuperPagoPico({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: 'pago-pico',
    cuenta: 'superadmin',
    inicial: { monto: '', presupuesto: '' },
    almacen: almacenNavegador,
  });
  const { cargarBase } = b;
  const cargar = useCallback(() => {
    pedir<{ centavos: number; presupuestoDiaCentavos: number }>('GET', '/datos/admin/pago-pico')
      .then((r) =>
        cargarBase({
          monto: String(r.centavos / 100),
          presupuesto: String(r.presupuestoDiaCentavos / 100),
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
      await pedir('PUT', '/datos/admin/pago-pico', {
        centavos: Math.round(Number(b.valores.monto || 0) * 100),
        presupuestoDiaCentavos: Math.round(Number(b.valores.presupuesto || 0) * 100),
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
    <div data-testid="super-pago-pico">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario tarjeta-form" onSubmit={(e) => void guardar(e)} noValidate>
        <label>
          {t.monto}
          <input
            type="number"
            inputMode="decimal"
            value={b.valores.monto}
            onChange={(e) => b.cambiar('monto', e.target.value)}
          />
        </label>
        <label>
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
