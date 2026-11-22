import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  TEXTOS_PAGO_COMIDA_RESTAURANTE,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from './api';
import { Campo, CampoClave } from './CampoClave';

const PROPIOS = {
  es: {
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
    ver: 'Ver la contraseña',
    ocultar: 'Ocultar la contraseña',
  },
  en: {
    recuperado: 'We recovered what you were writing.',
    empezar: 'Start over',
    ver: 'Show password',
    ocultar: 'Hide password',
  },
};

type Cuenta = { id: string; banco: string; telefono: string; documento: string; titular: string };
type Saldo = {
  moneda: string;
  disponible: number;
  sinSaldo: boolean;
  comision: { activa: boolean; deUnPedidoDe10: number };
  recargas: { activas: boolean };
};
const VACIA = { banco: '', telefono: '', documento: '', titular: '' };
const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

/**
 * C-COMIDA-PAGO-RESTAURANTE y C-SALDO-RESTAURANTE: lo mismo que el inicio de la app del restaurante,
 * en la computadora. La cuenta de pago móvil donde los clientes le pagan la comida (cambiarla pide la
 * contraseña, que nunca entra al borrador) y el saldo del restaurante con su comisión de hoy. Solo
 * aparece en los países de pago directo.
 */
export function CuentaSaldoRestaurante({
  idioma,
  usuarioId,
}: {
  idioma: Idioma;
  usuarioId: string;
}) {
  const es = idioma === 'en' ? 'en' : 'es';
  const t = enIdioma(TEXTOS_PAGO_COMIDA_RESTAURANTE, es);
  const tp = enIdioma(PROPIOS, es);
  const [datos, setDatos] = useState<{ exigida: boolean; cuenta: Cuenta | null } | null>(null);
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({
    formulario: 'cuenta-cobro-restaurante',
    cuenta: usuarioId,
    inicial: VACIA,
    almacen: almacenNavegador,
  });

  const cargar = useCallback(() => {
    pedir<NonNullable<typeof datos>>('GET', '/datos/restaurante/cuenta-cobro')
      .then((r) => {
        setDatos(r);
        if (r.exigida)
          pedir<Saldo>('GET', '/datos/restaurante/saldo')
            .then(setSaldo)
            .catch((x: unknown) => setError(mensaje(x)));
      })
      .catch((x: unknown) => setError(mensaje(x)));
  }, []);
  useEffect(cargar, [cargar]);

  if (!datos?.exigida) return null;
  const v = b.valores;
  const conFormulario = abierto || b.recuperado;
  const cuenta = datos.cuenta;

  async function guardar() {
    setGuardando(true);
    setError('');
    try {
      const r = await pedir<{ enVigorYa: boolean }>('POST', '/datos/restaurante/cuenta-cobro', {
        clave,
        banco: v.banco.trim(),
        telefono: v.telefono.trim(),
        documento: v.documento.trim(),
        titular: v.titular.trim(),
      });
      await b.limpiar();
      setClave('');
      setAbierto(false);
      setAviso(r.enVigorYa ? '' : t.cuentaEnEspera);
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para reintentar.
      setError(mensaje(x));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <div className="tarjeta-form" data-testid="cuenta-cobro-restaurante">
        <h2>{t.cuentaTitulo}</h2>
        <p className="suave">{t.cuentaAyuda}</p>
        {cuenta ? (
          <p>
            <strong>{cuenta.titular}</strong>
            <br />
            {cuenta.banco} · {cuenta.telefono} · {cuenta.documento}
          </p>
        ) : (
          <p role="alert" data-testid="cuenta-cobro-falta">
            {t.cuentaFalta}
          </p>
        )}
        {aviso && <p className="ok">{aviso}</p>}
        {conFormulario ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void guardar();
            }}
          >
            {b.recuperado && (
              <p className="aviso-borrador">
                {tp.recuperado}{' '}
                <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
                  {tp.empezar}
                </button>
              </p>
            )}
            <Campo
              etiqueta={t.cuentaBanco}
              placeholder={t.cuentaBancoAyuda}
              valor={v.banco}
              cambiar={(x) => b.cambiar('banco', x)}
            />
            <Campo
              etiqueta={t.cuentaTelefono}
              placeholder={t.cuentaTelefonoAyuda}
              valor={v.telefono}
              cambiar={(x) => b.cambiar('telefono', x)}
              modoTeclado="tel"
            />
            <Campo
              etiqueta={t.cuentaDocumento}
              placeholder={t.cuentaDocumentoAyuda}
              valor={v.documento}
              cambiar={(x) => b.cambiar('documento', x)}
            />
            <Campo
              etiqueta={t.cuentaTitular}
              placeholder={t.cuentaTitularAyuda}
              valor={v.titular}
              cambiar={(x) => b.cambiar('titular', x)}
            />
            <CampoClave
              etiqueta={t.cuentaClave}
              valor={clave}
              cambiar={setClave}
              textoVer={tp.ver}
              textoOcultar={tp.ocultar}
            />
            <button
              type="submit"
              className="boton"
              data-testid="cuenta-cobro-guardar"
              disabled={guardando}
            >
              {t.cuentaGuardar}
            </button>{' '}
            <button
              type="button"
              className="boton secundario"
              onClick={() => {
                setAbierto(false);
                void b.empezarDeNuevo();
              }}
            >
              {t.cuentaCancelar}
            </button>
          </form>
        ) : (
          <button
            type="button"
            className="boton secundario"
            data-testid="cuenta-cobro-abrir"
            onClick={() => setAbierto(true)}
          >
            {cuenta ? t.cuentaCambiar : t.cuentaAgregar}
          </button>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
      {saldo && (
        <div className="tarjeta-form" data-testid="saldo-restaurante">
          <h2>{t.saldoTitulo}</h2>
          <p>
            <strong data-testid="saldo-restaurante-disponible">
              {formatearMonto(saldo.disponible, saldo.moneda, es)}
            </strong>{' '}
            <span className="suave">{t.saldoDisponible}</span>
          </p>
          <p className={saldo.comision.activa ? undefined : 'ok'}>
            {saldo.comision.activa
              ? t.saldoComision.replace(
                  '{monto}',
                  formatearMonto(saldo.comision.deUnPedidoDe10, saldo.moneda, es),
                )
              : t.saldoGratis}
          </p>
          {saldo.sinSaldo && <p role="alert">{t.saldoSin}</p>}
          <p className="suave">{saldo.recargas.activas ? t.recargaEnApp : t.recargasApagadas}</p>
        </div>
      )}
    </>
  );
}
