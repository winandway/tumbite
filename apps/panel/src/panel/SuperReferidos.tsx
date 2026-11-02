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
 * C-REFERIDOS (CLI-7, 2 nov 2026): el equipo enciende «Invita a un amigo» y fija cuánto recibe cada
 * uno. Nace apagado y en cero; el servidor no deja encenderlo sin al menos un monto.
 */
const T = {
  es: {
    titulo: 'Invita a un amigo',
    ayuda:
      'Cada cliente tiene un código para compartir. El amigo recibe su crédito al usarlo antes de su primer pedido; quien invitó recibe el suyo cuando ese pedido se entrega. Una vez por amigo. El crédito es saldo de regalo (en dólares) y lo paga Divoox.',
    activos: 'Invitaciones encendidas',
    amigo: 'Crédito para el amigo (dólares)',
    invita: 'Crédito para quien invita (dólares)',
    totales: (i: number, p: number) => `Amigos invitados: ${i} · con su primer pedido: ${p}`,
    guardar: 'Guardar invitaciones',
    guardado: 'Guardado.',
  },
  en: {
    titulo: 'Invite a friend',
    ayuda:
      'Every customer has a code to share. The friend gets their credit by using it before their first order; the inviter gets theirs once that order is delivered. Once per friend. Credit is gift balance (in dollars), paid by Divoox.',
    activos: 'Invites on',
    amigo: 'Credit for the friend (dollars)',
    invita: 'Credit for the inviter (dollars)',
    totales: (i: number, p: number) => `Friends invited: ${i} · with a first order: ${p}`,
    guardar: 'Save invites',
    guardado: 'Saved.',
  },
};

type Ajustes = {
  activos: boolean;
  paraAmigo: number;
  paraQuienInvita: number;
  invitados: number;
  premiados: number;
};

export function SuperReferidos({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [totales, setTotales] = useState({ invitados: 0, premiados: 0 });
  const b = useBorrador({
    formulario: 'referidos',
    cuenta: 'superadmin',
    inicial: { activos: false, amigo: '', invita: '' },
    almacen: almacenNavegador,
  });
  const { cargarBase } = b;
  const cargar = useCallback(() => {
    pedir<Ajustes>('GET', '/datos/admin/referidos')
      .then((r) => {
        setTotales({ invitados: r.invitados, premiados: r.premiados });
        cargarBase({
          activos: r.activos,
          amigo: String(r.paraAmigo / 100),
          invita: String(r.paraQuienInvita / 100),
        });
      })
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [cargarBase]);
  useEffect(cargar, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await pedir('PUT', '/datos/admin/referidos', {
        activos: b.valores.activos,
        paraAmigo: Math.round(Number(b.valores.amigo || 0) * 100),
        paraQuienInvita: Math.round(Number(b.valores.invita || 0) * 100),
      });
      await b.limpiar();
      setOk(t.guardado);
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const campo = (clave: 'amigo' | 'invita', etiqueta: string, valor: string) => (
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
    <div data-testid="super-referidos">
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
            checked={b.valores.activos}
            onChange={(e) => b.cambiar('activos', e.target.checked)}
          />
          {t.activos}
        </label>
        {campo('amigo', t.amigo, b.valores.amigo)}
        {campo('invita', t.invita, b.valores.invita)}
        <p className="pista">{t.totales(totales.invitados, totales.premiados)}</p>
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
