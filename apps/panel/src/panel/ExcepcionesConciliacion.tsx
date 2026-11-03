import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { Campo, CampoClave } from './CampoClave';
import { pedir } from './api';

/**
 * C-DINERO-30-DIAS (NXT-1, 3 nov 2026): la bandeja de los días de los últimos 30 que no cuadraron.
 * Mientras uno siga sin excusar, el canario de dinero está en rojo. Se excusa con motivo y con la
 * contraseña de una cuenta Total o Finanzas; queda quién y cuándo, y la conciliación no se toca.
 */
const T = {
  es: {
    titulo: 'Días que no cuadraron (últimos 30)',
    ayuda:
      'Mientras un día no cuadre y no tenga su excepción, el canario de dinero queda en rojo. Revisa el detalle y, si la diferencia está explicada (por ejemplo, una compra de prueba), excúsalo con el motivo. La conciliación de ese día no se cambia y la excepción queda con tu nombre.',
    vacio: 'Todos los días de los últimos 30 cuadran.',
    sinPerfil: 'Tu perfil no excusa días. Lo hace una cuenta con perfil Total o Finanzas.',
    pedidos: 'pedidos',
    vendido: 'vendido',
    detalle: 'Ver detalle',
    excusado: 'Excusado',
    por: 'por',
    motivo: 'Motivo (qué explica la diferencia)',
    clave: 'Tu contraseña para excusar',
    ver: 'Ver la contraseña',
    ocultar: 'Ocultar la contraseña',
    excusar: 'Excusar este día',
    hecho: 'Listo: el día quedó excusado con tu nombre.',
  },
  en: {
    titulo: 'Days that didn’t balance (last 30)',
    ayuda:
      'While a day doesn’t balance and has no exception, the money health check stays red. Review the details and, if the difference is explained (for example, a test purchase), excuse it with the reason. That day’s reconciliation isn’t changed and the exception is recorded under your name.',
    vacio: 'Every day in the last 30 balances.',
    sinPerfil: 'Your profile can’t excuse days. A Full or Finance profile account does it.',
    pedidos: 'orders',
    vendido: 'sold',
    detalle: 'See details',
    excusado: 'Excused',
    por: 'by',
    motivo: 'Reason (what explains the difference)',
    clave: 'Your password to excuse',
    ver: 'Show password',
    ocultar: 'Hide password',
    excusar: 'Excuse this day',
    hecho: 'Done: the day is excused under your name.',
  },
};

type Dia = {
  dia: string;
  pedidos: number;
  vendido: number;
  detalle: Record<string, unknown>;
  excusado: boolean;
  motivo: string | null;
  excusadoPorNombre: string | null;
  excusadoEn: string | null;
};

export function ExcepcionesConciliacion({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<{ sinCuadrar: Dia[]; puedoExcusar: boolean } | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: 'excepciones-conciliacion',
    inicial: { motivo: '', clave: '' },
    almacen: almacenNavegador,
    sensibles: ['clave'],
  });
  const cargar = useCallback(() => {
    pedir<{ sinCuadrar: Dia[]; puedoExcusar: boolean }>(
      'GET',
      '/datos/admin/conciliacion/excepciones',
    )
      .then((r) => setD({ sinCuadrar: r.sinCuadrar ?? [], puedoExcusar: Boolean(r.puedoExcusar) }))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, []);
  useEffect(cargar, [cargar]);

  async function excusar(dia: string) {
    setError('');
    setOk('');
    try {
      await pedir('POST', '/datos/admin/conciliacion/excepciones', {
        dia,
        motivo: b.valores.motivo,
        clave: b.valores.clave,
      });
      await b.limpiar();
      setOk(t.hecho);
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const pendientes = d?.sinCuadrar.filter((x) => !x.excusado) ?? [];
  return (
    <section aria-label={t.titulo}>
      <h2>{t.titulo}</h2>
      <p className="suave">{t.ayuda}</p>
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      {error && (
        <p className="error-general" role="alert">
          {error}
        </p>
      )}
      {ok && (
        <p className="ok" role="status">
          {ok}
        </p>
      )}
      {d && !d.sinCuadrar.length ? <p className="ok">{t.vacio}</p> : null}
      {d && pendientes.length > 0 && !d.puedoExcusar ? (
        <p className="aviso">{t.sinPerfil}</p>
      ) : null}
      {d && pendientes.length > 0 && d.puedoExcusar ? (
        <div className="tarjeta-form">
          <Campo
            etiqueta={t.motivo}
            valor={b.valores.motivo}
            cambiar={(v) => b.cambiar('motivo', v)}
          />
          <CampoClave
            etiqueta={t.clave}
            valor={b.valores.clave}
            cambiar={(v) => b.cambiar('clave', v)}
            textoVer={t.ver}
            textoOcultar={t.ocultar}
          />
        </div>
      ) : null}
      {d?.sinCuadrar.length ? (
        <ul className="lista">
          {d.sinCuadrar.map((x) => (
            <li key={x.dia} className="tarjeta-form">
              <strong>{x.dia}</strong> · {x.pedidos} {t.pedidos} ·{' '}
              {formatearMonto(x.vendido, 'USD', idioma)} {t.vendido}
              <details>
                <summary className="suave">{t.detalle}</summary>
                <pre className="suave">{JSON.stringify(x.detalle, null, 1)}</pre>
              </details>
              {x.excusado ? (
                <p className="suave">
                  <strong className="ok">{t.excusado}</strong> {t.por} {x.excusadoPorNombre} ·{' '}
                  {x.excusadoEn} — {x.motivo}
                </p>
              ) : d.puedoExcusar ? (
                <button type="button" className="boton" onClick={() => void excusar(x.dia)}>
                  {t.excusar}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
