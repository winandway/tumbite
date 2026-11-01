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
 * C-ANUNCIOS (R-T2, 1 nov 2026, como «Sponsored Listings» de DoorDash): el equipo fija cuánto paga
 * un restaurante por cada pedido que llega desde su anuncio y cuántos patrocinados salen arriba.
 * En cero, está apagado.
 */
const T = {
  es: {
    titulo: 'Anuncios patrocinados',
    ayuda:
      'El restaurante que se anuncia sale primero en el inicio con la etiqueta «Patrocinado» y paga este monto solo por cada pedido entregado que llegó desde su anuncio, nunca por vistas ni toques, hasta su presupuesto semanal. En cero, está apagado.',
    monto: 'Por pedido del anuncio (dólares)',
    presupuesto: 'Patrocinados arriba de la lista',
    guardar: 'Guardar anuncios',
    guardado: 'Guardado. Se aplica en la próxima lista que vea un cliente.',
    apagado: 'Apagado',
  },
  en: {
    titulo: 'Sponsored listings',
    ayuda:
      'A restaurant that advertises shows first on the home screen with a “Sponsored” label and pays this amount only for each delivered order that came from its ad, never for views or taps, up to its weekly budget. At zero, it’s off.',
    monto: 'Per order from the ad (dollars)',
    presupuesto: 'Sponsored spots at the top',
    guardar: 'Save sponsored listings',
    guardado: 'Saved. It applies to the next list a customer sees.',
    apagado: 'Off',
  },
};

export function SuperAnuncios({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: 'anuncios',
    cuenta: 'superadmin',
    inicial: { monto: '', presupuesto: '' },
    almacen: almacenNavegador,
  });
  const { cargarBase } = b;
  const cargar = useCallback(() => {
    pedir<{ centavosPorPedido: number; maxEnLista: number }>('GET', '/datos/admin/anuncios')
      .then((r) =>
        cargarBase({
          monto: String(r.centavosPorPedido / 100),
          presupuesto: String(r.maxEnLista),
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
      await pedir('PUT', '/datos/admin/anuncios', {
        centavosPorPedido: Math.round(Number(b.valores.monto || 0) * 100),
        maxEnLista: Math.round(Number(b.valores.presupuesto || 0)),
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
    <div data-testid="super-anuncios">
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
            inputMode="numeric"
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
