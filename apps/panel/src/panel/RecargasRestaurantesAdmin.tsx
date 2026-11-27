import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  almacenNavegador,
  enIdioma,
  fechaHoraLocal,
  formatearMonto,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import { Campo } from './CampoClave';
import { MenuTresPuntos } from './MenuTresPuntos';
import { AyudaAqui } from './AyudaAqui';
import { pedir } from './api';

/**
 * C-SALDO-RESTAURANTE: el equipo revisa las recargas que declaran los restaurantes (referencia y
 * comprobante), las acredita con la doble firma del dinero o las rechaza con motivo, y puede cargar
 * saldo a mano. Mismas piezas que el saldo del conductor. Hoy la comisión del restaurante es 0 %.
 */
const T = {
  es: {
    titulo: 'Saldo de restaurantes',
    ayuda:
      'Recargas que declaró un restaurante. Antes de acreditar, busca el pago en el banco de Divoox por el monto y la referencia: la foto no es prueba.',
    pendientes: 'Recargas por revisar',
    sin: 'No hay recargas por revisar.',
    verFoto: 'Ver comprobante',
    acreditar: 'Acreditar',
    acreditada: 'Recarga acreditada.',
    opciones: 'Más opciones',
    rechazar: 'Rechazar',
    rechazada: 'Recarga rechazada.',
    motivoRechazo: 'Motivo del rechazo',
    cargaTitulo: 'Cargar saldo a mano',
    restauranteId: 'Restaurante (id)',
    restauranteIdAyuda: 'Identificador del restaurante',
    monto: 'Monto de la carga (USD)',
    motivo: 'Motivo de la carga',
    comprobante: 'Comprobante o referencia (opcional)',
    cargar: 'Cargar saldo',
    cargado: 'Saldo cargado.',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
  },
  en: {
    titulo: 'Restaurant balance',
    ayuda:
      'Top-ups reported by a restaurant. Before crediting, find the payment in the Divoox bank by amount and reference: the photo is not proof.',
    pendientes: 'Top-ups to review',
    sin: 'No top-ups to review.',
    verFoto: 'View receipt',
    acreditar: 'Credit',
    acreditada: 'Top-up credited.',
    opciones: 'More options',
    rechazar: 'Reject',
    rechazada: 'Top-up rejected.',
    motivoRechazo: 'Reason for rejection',
    cargaTitulo: 'Add balance manually',
    restauranteId: 'Restaurant (id)',
    restauranteIdAyuda: 'Restaurant identifier',
    monto: 'Top-up amount (USD)',
    motivo: 'Reason for the top-up',
    comprobante: 'Receipt or reference (optional)',
    cargar: 'Add balance',
    cargado: 'Balance added.',
    recuperado: 'We recovered what you were writing.',
    empezar: 'Start over',
  },
};

type Pendiente = {
  id: string;
  restaurante: string | null;
  monto: number;
  moneda: string;
  referencia: string;
  banco: string;
  creadoEn: string;
};

const mensajeDe = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

export function RecargasRestaurantesAdmin({ idioma }: { idioma: 'es' | 'en' }) {
  const t = enIdioma(T, idioma);
  const [lista, setLista] = useState<Pendiente[] | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [rechazando, setRechazando] = useState<string | null>(null);
  const rb = useBorrador({
    formulario: 'super-recarga-restaurante-rechazo',
    inicial: { motivo: '' },
    almacen: almacenNavegador,
  });
  const cb = useBorrador({
    formulario: 'super-carga-saldo-restaurante',
    inicial: { restauranteId: '', monto: '', motivo: '', comprobante: '' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ recargas: Pendiente[] }>(
      'GET',
      '/datos/admin/finanzas/restaurantes-saldo/recargas?estado=pendiente',
    )
      .then((r) => setLista(r.recargas))
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, []);
  useEffect(cargar, [cargar]);

  async function acreditar(id: string) {
    setError('');
    setOk('');
    try {
      // C-CONTROL-DUAL: por encima del umbral queda esperando a otra persona (202 con el aviso).
      const r = await pedir<{ pendiente?: boolean; mensaje?: string }>(
        'POST',
        `/datos/admin/finanzas/restaurantes-saldo/recargas/${id}/acreditar`,
        {},
      );
      setOk(r.pendiente ? (r.mensaje ?? t.acreditada) : t.acreditada);
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function rechazar(id: string) {
    setError('');
    setOk('');
    try {
      await pedir('POST', `/datos/admin/finanzas/restaurantes-saldo/recargas/${id}/rechazar`, {
        motivo: rb.valores.motivo,
      });
      await rb.limpiar();
      setRechazando(null);
      setOk(t.rechazada);
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function cargarSaldo(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      const v = cb.valores;
      const r = await pedir<{ pendiente?: boolean; mensaje?: string }>(
        'POST',
        `/datos/admin/finanzas/restaurantes/${encodeURIComponent(v.restauranteId.trim())}/saldo`,
        {
          monto: textoAMonto(v.monto, 'USD'),
          motivo: v.motivo,
          comprobante: v.comprobante,
        },
      );
      await cb.limpiar();
      setOk(r.pendiente ? (r.mensaje ?? t.cargado) : t.cargado);
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(mensajeDe(x));
    }
  }

  return (
    <section data-testid="saldo-restaurantes">
      <h2>
        {t.titulo} <AyudaAqui guia="restaurant-balance-top-ups" idioma={idioma} />
      </h2>
      <p className="pista">{t.ayuda}</p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="exito" role="status">
          {ok}
        </p>
      ) : null}
      <h3>{t.pendientes}</h3>
      {lista === null ? null : lista.length === 0 ? (
        <p className="pista">{t.sin}</p>
      ) : (
        <ul className="super-lista">
          {lista.map((r) => (
            <li key={r.id}>
              <strong>{r.restaurante ?? ''}</strong> · {formatearMonto(r.monto, r.moneda, idioma)} ·{' '}
              {r.referencia}
              {r.banco ? ` · ${r.banco}` : ''} · {fechaHoraLocal(r.creadoEn, idioma)} ·{' '}
              <a
                href={`/datos/admin/finanzas/restaurantes-saldo/recargas/${r.id}/comprobante`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.verFoto}
              </a>{' '}
              <button type="button" className="boton" onClick={() => void acreditar(r.id)}>
                {t.acreditar}
              </button>
              <MenuTresPuntos
                etiqueta={t.opciones}
                opciones={[
                  { texto: t.rechazar, peligro: true, alTocar: () => setRechazando(r.id) },
                ]}
              />
              {rechazando === r.id ? (
                <form
                  className="flex-form flex-inline"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void rechazar(r.id);
                  }}
                >
                  <Campo
                    etiqueta={t.motivoRechazo}
                    valor={rb.valores.motivo}
                    cambiar={(v) => rb.cambiar('motivo', v)}
                  />
                  <button type="submit" className="boton peligro">
                    {t.rechazar}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <h3>{t.cargaTitulo}</h3>
      <form className="flex-form" noValidate onSubmit={(e) => void cargarSaldo(e)}>
        {cb.recuperado ? (
          <p className="aviso-borrador">
            {t.recuperado}{' '}
            <button type="button" className="enlace" onClick={() => void cb.empezarDeNuevo()}>
              {t.empezar}
            </button>
          </p>
        ) : null}
        <Campo
          etiqueta={t.restauranteId}
          valor={cb.valores.restauranteId}
          cambiar={(v) => cb.cambiar('restauranteId', v)}
        />
        <Campo
          casilla="monto"
          etiqueta={t.monto}
          valor={cb.valores.monto}
          cambiar={(v) => cb.cambiar('monto', v)}
        />
        <Campo
          etiqueta={t.motivo}
          valor={cb.valores.motivo}
          cambiar={(v) => cb.cambiar('motivo', v)}
        />
        <Campo
          etiqueta={t.comprobante}
          valor={cb.valores.comprobante}
          cambiar={(v) => cb.cambiar('comprobante', v)}
        />
        <button type="submit" className="boton" data-testid="cargar-saldo-restaurante">
          {t.cargar}
        </button>
      </form>
    </section>
  );
}
