import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  montoATexto,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { Campo, CampoClave } from './CampoClave';
import { pedir } from './api';

/**
 * C-CONTROL-DUAL (SIG-4, 2 nov 2026): la bandeja «Para aprobar». El dinero hecho a mano por encima
 * del límite de su moneda (devoluciones, reembolsos, ajustes de billetera, fondos de puntos de venta
 * y cobros confirmados a mano) espera aquí hasta que OTRA persona con perfil Total o Finanzas lo
 * apruebe con su contraseña. Si no hay nadie más que pueda aprobar, la pantalla lo dice.
 */
const T = {
  es: {
    titulo: 'Para aprobar',
    ayuda:
      'El dinero que se mueve a mano por encima del límite lo aprueba otra persona del equipo, nunca la misma que lo pidió. Así trabajan los bancos: una persona lo pide y otra lo revisa.',
    vacio: 'No hay nada esperando aprobación.',
    pidio: 'Lo pidió',
    motivo: 'Motivo',
    clave: 'Tu contraseña para aprobar',
    ver: 'Ver la contraseña',
    ocultar: 'Ocultar la contraseña',
    aprobar: 'Aprobar',
    nota: 'Motivo del rechazo',
    rechazar: 'Rechazar',
    retirar: 'Retirar mi solicitud',
    tuya: 'Es tuya: la aprueba otra persona.',
    aprobada: 'Aprobado: el movimiento ya se hizo.',
    rechazada: 'Rechazado: no se movió nada.',
    sinPerfil: 'Tu perfil no aprueba dinero. Lo aprueba una cuenta con perfil Total o Finanzas.',
    sinOtra:
      'No hay otra cuenta con perfil Total o Finanzas: nadie más puede aprobar lo que tú pidas. Asigna ese perfil a otra persona en «Equipo interno».',
    limites: 'Límite por moneda',
    limitesAyuda:
      'Por encima de este monto, el movimiento a mano espera la segunda firma; se suma lo que la misma persona movió en 24 horas. En cero, todo la pide. Bajarlo es inmediato; subirlo lo aprueba otra cuenta Total.',
    guardar: 'Guardar límites',
    guardado: 'Límites guardados.',
    recientes: 'Últimas revisadas',
    estados: {
      aprobada: 'Aprobada',
      rechazada: 'Rechazada',
      fallida: 'No se pudo hacer',
      ejecutando: 'Haciéndose',
    },
    tipos: {
      devolucion_pedido: 'Devolución de un pedido',
      reembolso_recarga: 'Reembolso de una recarga',
      ajuste_billetera: 'Ajuste de billetera',
      fondo_punto: 'Fondo de un punto de venta',
      confirmar_liquidacion: 'Cobro confirmado a mano',
      excedente_devuelto: 'Excedente devuelto por el repartidor',
      umbral: 'Subir el límite del control dual',
    },
  },
  en: {
    titulo: 'Approvals',
    ayuda:
      'Money moved by hand above the limit is approved by another team member, never the one who asked for it. That’s how banks work: one person requests, another reviews.',
    vacio: 'Nothing is waiting for approval.',
    pidio: 'Requested by',
    motivo: 'Reason',
    clave: 'Your password to approve',
    ver: 'Show password',
    ocultar: 'Hide password',
    aprobar: 'Approve',
    nota: 'Reason for rejecting',
    rechazar: 'Reject',
    retirar: 'Withdraw my request',
    tuya: 'It’s yours: someone else approves it.',
    aprobada: 'Approved: the money movement is done.',
    rechazada: 'Rejected: nothing moved.',
    sinPerfil: 'Your profile can’t approve money. A Full or Finance profile approves it.',
    sinOtra:
      'There’s no other account with a Full or Finance profile: nobody else can approve what you request. Give that profile to someone else in «Internal team».',
    limites: 'Limit per currency',
    limitesAyuda:
      'Above this amount, a manual money movement waits for the second signature; what the same person moved in 24 hours adds up. At zero, everything needs it. Lowering it is immediate; raising it is approved by another Full account.',
    guardar: 'Save limits',
    guardado: 'Limits saved.',
    recientes: 'Recently reviewed',
    estados: {
      aprobada: 'Approved',
      rechazada: 'Rejected',
      fallida: 'Couldn’t be done',
      ejecutando: 'In progress',
    },
    tipos: {
      devolucion_pedido: 'Order refund',
      reembolso_recarga: 'Top-up refund',
      ajuste_billetera: 'Wallet adjustment',
      fondo_punto: 'Sales point funding',
      confirmar_liquidacion: 'Charge confirmed by hand',
      excedente_devuelto: 'Overpayment returned by the driver',
      umbral: 'Raise the dual-control limit',
    },
  },
};

/** Lo que responde el servidor cuando el movimiento quedó esperando la segunda firma (202). */
export type RespuestaPendiente = {
  pendiente?: boolean;
  aprobadores?: number;
  aprobacion?: { tipo?: string };
};

/** Aviso en el idioma de la pantalla; `null` si el movimiento se hizo de una. */
export function textoPendiente(r: unknown, idioma: Idioma): string | null {
  const p = (r ?? {}) as RespuestaPendiente;
  if (!p.pendiente) return null;
  // SIG-4x: subir un límite lo aprueba otra cuenta Total; mientras tanto sigue el de antes.
  if (p.aprobacion?.tipo === 'umbral')
    return idioma === 'en'
      ? 'Raising the limit is approved by another Full account: it’s waiting in «Approvals». Until then, the previous limit stays.'
      : 'Subir el límite lo aprueba otra cuenta con perfil Total: quedó esperando en «Para aprobar». Mientras tanto sigue el límite de antes.';
  const sinOtra = !p.aprobadores;
  if (idioma === 'en')
    return sinOtra
      ? 'This amount is above the dual-control limit and no other Full or Finance account can approve it. It was saved in «Approvals»: give that profile to someone else in «Internal team».'
      : 'This amount is above the dual-control limit: it’s waiting for another team member (Full or Finance) to approve it in «Approvals».';
  return sinOtra
    ? 'Este monto pasa el límite del control dual y no hay otra cuenta con perfil Total o Finanzas que lo pueda aprobar. Quedó guardado en «Para aprobar»: asigna ese perfil a otra persona en «Equipo interno».'
    : 'Este monto pasa el límite del control dual: quedó esperando que otra persona del equipo (Total o Finanzas) lo apruebe en «Para aprobar».';
}

type Solicitud = {
  id: string;
  tipo: keyof (typeof T)['es']['tipos'];
  objeto: string;
  monto: number;
  moneda: string;
  motivo: string;
  estado: string;
  nota: string | null;
  error: string | null;
  pedidoPor: string;
  pedidoPorNombre: string | null;
  creadoEn: string;
  revisadoPorNombre: string | null;
};
type Bandeja = {
  pendientes: Solicitud[];
  recientes: Solicitud[];
  umbrales: Record<string, number>;
  miPerfil: string;
  puedoAprobar: boolean;
  aprobadoresAparte: number;
};

export function SuperAprobaciones({ idioma, miId }: { idioma: Idioma; miId: string }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<Bandeja | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: 'super-aprobaciones',
    cuenta: miId,
    inicial: { clave: '', nota: '', limites: '{}' },
    almacen: almacenNavegador,
    sensibles: ['clave'],
  });
  const limites = JSON.parse(b.valores.limites || '{}') as Record<string, string>;
  const cargar = useCallback(() => {
    pedir<Bandeja>('GET', '/datos/admin/aprobaciones-dinero')
      .then(setD)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, []);
  useEffect(cargar, [cargar]);
  if (!d) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const tipo = (s: Solicitud) => new Map(Object.entries(t.tipos)).get(s.tipo) ?? s.tipo;
  const estado = (e: string) => new Map(Object.entries(t.estados)).get(e) ?? e;
  const limite = (moneda: string) =>
    new Map(Object.entries(limites)).get(moneda) ??
    montoATexto(new Map(Object.entries(d.umbrales)).get(moneda) ?? 0, moneda);

  async function hacer(fn: () => Promise<string | void>, exito: string) {
    setError('');
    setOk('');
    try {
      const otro = await fn();
      setOk(otro || exito);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  const aprobar = (s: Solicitud) =>
    hacer(async () => {
      await pedir('POST', `/datos/admin/aprobaciones-dinero/${s.id}/aprobar`, {
        clave: b.valores.clave,
      });
      b.cambiar('clave', '');
    }, t.aprobada);
  const rechazar = (s: Solicitud) =>
    hacer(async () => {
      await pedir('POST', `/datos/admin/aprobaciones-dinero/${s.id}/rechazar`, {
        nota: b.valores.nota,
      });
      b.cambiar('nota', '');
    }, t.rechazada);
  const guardarLimites = (e: React.FormEvent) => {
    e.preventDefault();
    void hacer(async () => {
      const umbrales = Object.fromEntries(
        Object.keys(d.umbrales).map((m) => [m, textoAMonto(limite(m), m)]),
      );
      const r = await pedir('PUT', '/datos/admin/aprobaciones-dinero/umbrales', { umbrales });
      await b.limpiar();
      // SIG-4x: si alguno sube, queda esperando la firma de otra cuenta Total (202).
      return textoPendiente(r, idioma) ?? undefined;
    }, t.guardado);
  };

  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <p className="suave">{t.ayuda}</p>
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      {!d.puedoAprobar && <p className="aviso">{t.sinPerfil}</p>}
      {d.aprobadoresAparte === 0 && <p className="aviso">{t.sinOtra}</p>}
      {error && <p role="alert">{error}</p>}
      {ok && <p role="status">{ok}</p>}
      {d.pendientes.length === 0 ? (
        <p>{t.vacio}</p>
      ) : (
        <>
          {d.puedoAprobar && (
            <div className="tarjeta-form">
              <CampoClave
                etiqueta={t.clave}
                valor={b.valores.clave}
                cambiar={(v) => b.cambiar('clave', v)}
                textoVer={t.ver}
                textoOcultar={t.ocultar}
              />
              <Campo
                etiqueta={t.nota}
                valor={b.valores.nota}
                cambiar={(v) => b.cambiar('nota', v)}
              />
            </div>
          )}
          <ul className="lista">
            {d.pendientes.map((s) => {
              const mia = s.pedidoPor === miId;
              return (
                <li key={s.id} className="tarjeta-form">
                  <strong>{tipo(s)}</strong> · {formatearMonto(s.monto, s.moneda, idioma)}
                  <p className="suave">
                    {t.pidio}: {s.pedidoPorNombre ?? '—'} · {s.creadoEn}
                  </p>
                  {s.motivo && (
                    <p>
                      {t.motivo}: {s.motivo}
                    </p>
                  )}
                  <div className="fila-botones">
                    {mia ? (
                      <>
                        <span className="suave">{t.tuya}</span>
                        <button
                          type="button"
                          className="boton secundario"
                          onClick={() => void rechazar(s)}
                        >
                          {t.retirar}
                        </button>
                      </>
                    ) : d.puedoAprobar ? (
                      <>
                        <button type="button" className="boton" onClick={() => void aprobar(s)}>
                          {t.aprobar}
                        </button>
                        <button
                          type="button"
                          className="boton secundario"
                          onClick={() => void rechazar(s)}
                        >
                          {t.rechazar}
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h2>{t.limites}</h2>
      <p className="suave">{t.limitesAyuda}</p>
      <form className="tarjeta-form" onSubmit={guardarLimites}>
        {Object.keys(d.umbrales).map((m) => (
          <Campo
            key={m}
            etiqueta={m}
            valor={limite(m)}
            cambiar={(v) => b.cambiar('limites', JSON.stringify({ ...limites, [m]: v }))}
          />
        ))}
        {d.miPerfil === 'total' && (
          <button type="submit" className="boton">
            {t.guardar}
          </button>
        )}
      </form>

      {d.recientes.length > 0 && (
        <>
          <h2>{t.recientes}</h2>
          <ul className="lista">
            {d.recientes.map((s) => (
              <li key={s.id}>
                {tipo(s)} · {formatearMonto(s.monto, s.moneda, idioma)} ·{' '}
                <span
                  className={s.estado === 'aprobada' ? 'insignia insignia-aprobado' : 'insignia'}
                >
                  {estado(s.estado)}
                </span>{' '}
                <span className="suave">
                  {s.pedidoPorNombre ?? '—'} → {s.revisadoPorNombre ?? '—'}
                  {s.error ? ` · ${s.error}` : ''}
                  {s.nota ? ` · ${s.nota}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
