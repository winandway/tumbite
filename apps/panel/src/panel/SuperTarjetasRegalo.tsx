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
 * C-TARJETAS-REGALO (R-T4, 1 nov 2026): el equipo enciende las tarjetas de regalo y fija el monto
 * mínimo y máximo. Con llaves reales de Stripe el servidor no deja encenderlas hasta probar el
 * cobro de punta a punta.
 */
const T = {
  es: {
    titulo: 'Tarjetas de regalo',
    ayuda:
      'El cliente compra una tarjeta para alguien; le llega un código por correo y al canjearlo queda como saldo para sus pedidos. El restaurante y el repartidor cobran igual. Solo en dólares.',
    activas: 'Tarjetas de regalo encendidas',
    cuota: 'Monto mínimo (dólares)',
    minimo: 'Monto máximo (dólares)',
    guardar: 'Guardar tarjetas de regalo',
    guardado: 'Guardado.',
  },
  en: {
    titulo: 'Gift cards',
    ayuda:
      'Customers buy a card for someone; they get a code by email and redeeming it adds a balance for their orders. Restaurants and drivers are paid the same. Dollars only.',
    activas: 'Gift cards on',
    cuota: 'Minimum amount (dollars)',
    minimo: 'Maximum amount (dollars)',
    guardar: 'Save gift cards',
    guardado: 'Saved.',
  },
};

export function SuperTarjetasRegalo({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: 'tarjetas-regalo',
    cuenta: 'superadmin',
    inicial: { activas: false, cuota: '', minimo: '' },
    almacen: almacenNavegador,
  });
  const { cargarBase } = b;
  const cargar = useCallback(() => {
    pedir<{ activas: boolean; minimo: number; maximo: number }>(
      'GET',
      '/datos/admin/tarjetas-regalo',
    )
      .then((r) =>
        cargarBase({
          activas: r.activas,
          cuota: String(r.minimo / 100),
          minimo: String(r.maximo / 100),
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
      await pedir('PUT', '/datos/admin/tarjetas-regalo', {
        activas: b.valores.activas,
        minimo: Math.round(Number(b.valores.cuota || 0) * 100),
        maximo: Math.round(Number(b.valores.minimo || 0) * 100),
      });
      await b.limpiar();
      setOk(t.guardado);
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const campo = (clave: 'cuota' | 'minimo', etiqueta: string, valor: string) => (
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
    <div data-testid="super-tarjetas-regalo">
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario tarjeta-form" onSubmit={(e) => void guardar(e)} noValidate>
        <label className="casilla-fila">
          <input
            type="checkbox"
            checked={b.valores.activas}
            onChange={(e) => b.cambiar('activas', e.target.checked)}
          />
          {t.activas}
        </label>
        {campo('cuota', t.cuota, b.valores.cuota)}
        {campo('minimo', t.minimo, b.valores.minimo)}
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
