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
 * C-PLUS (R-T3, 1 nov 2026, como DashPass): el equipo fija la cuota mensual de Divoox Plus, el
 * mínimo del pedido y cuánto baja el servicio. En cero, está apagado. Con llaves reales de Stripe
 * el servidor no deja encenderlo hasta probar el cobro de punta a punta.
 */
const T = {
  es: {
    titulo: 'Divoox Plus',
    ayuda:
      'Suscripción del cliente: envío gratis y servicio rebajado en pedidos desde el mínimo, con cobro mensual automático. Lo descontado lo pone Divoox; el restaurante y el repartidor cobran igual. Solo en dólares. En cero, está apagado.',
    cuota: 'Cuota mensual (dólares)',
    minimo: 'Pedido mínimo para el beneficio (dólares)',
    pct: 'Descuento en el cargo de servicio (%)',
    guardar: 'Guardar Divoox Plus',
    guardado: 'Guardado.',
  },
  en: {
    titulo: 'Divoox Plus',
    ayuda:
      'Customer membership: free delivery and a lower service fee on orders over the minimum, billed monthly. Divoox covers the discount; restaurants and drivers are paid the same. Dollars only. At zero, it’s off.',
    cuota: 'Monthly fee (dollars)',
    minimo: 'Order minimum for the benefit (dollars)',
    pct: 'Service fee discount (%)',
    guardar: 'Save Divoox Plus',
    guardado: 'Saved.',
  },
};

export function SuperPlus({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: 'divoox-plus',
    cuenta: 'superadmin',
    inicial: { cuota: '', minimo: '', pct: '' },
    almacen: almacenNavegador,
  });
  const { cargarBase } = b;
  const cargar = useCallback(() => {
    pedir<{ centavosMes: number; minimoSubtotal: number; servicioDescuentoPct: number }>(
      'GET',
      '/datos/admin/plus',
    )
      .then((r) =>
        cargarBase({
          cuota: String(r.centavosMes / 100),
          minimo: String(r.minimoSubtotal / 100),
          pct: String(r.servicioDescuentoPct),
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
      await pedir('PUT', '/datos/admin/plus', {
        centavosMes: Math.round(Number(b.valores.cuota || 0) * 100),
        minimoSubtotal: Math.round(Number(b.valores.minimo || 0) * 100),
        servicioDescuentoPct: Math.round(Number(b.valores.pct || 0)),
      });
      await b.limpiar();
      setOk(t.guardado);
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const campo = (clave: 'cuota' | 'minimo' | 'pct', etiqueta: string, valor: string) => (
    <label className="campo">
      {etiqueta}
      <input
        type="number"
        inputMode="decimal"
        value={valor}
        onChange={(e) => b.cambiar(clave, e.target.value)}
      />
    </label>
  );

  return (
    <div data-testid="super-plus">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario tarjeta-form" onSubmit={(e) => void guardar(e)} noValidate>
        {campo('cuota', t.cuota, b.valores.cuota)}
        {campo('minimo', t.minimo, b.valores.minimo)}
        {campo('pct', t.pct, b.valores.pct)}
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
