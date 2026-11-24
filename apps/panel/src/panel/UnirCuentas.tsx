import { useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from './api';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { Campo } from './CampoClave';
import { usePermisos } from './permisosPanel';

/**
 * C-CUENTA-UNICA-UNIR (24 nov 2026, Richard; todos los países). Para quien ya tiene DOS cuentas de la
 * misma persona (una de conductor y una de cliente, con correos distintos): el equipo las une en una.
 * Nunca se unen solas: primero «Revisar» (dice qué impide unirlas y qué se mueve) y después «Unir»
 * con el motivo y la confirmación. Solo el equipo central (permiso de configuración, alcance total).
 * Su explicación vive en la ayuda interna «?», nunca en Docs públicos.
 */
type Revision = {
  conductor: { id: string; nombre: string; correo: string } | null;
  cliente: { id: string; nombre: string; correo: string } | null;
  frenos: string[];
  mueve: { pedidos: number; viajes: number; direcciones: number };
};

const T = {
  es: {
    titulo: 'Unir dos cuentas de la misma persona',
    explica:
      'La cuenta de conductor queda como la única (su correo y su contraseña siguen) y gana el papel de cliente. La de cliente se cierra y su historial pasa a la de conductor. El dinero no se mezcla.',
    conductor: 'Número de la cuenta de conductor',
    cliente: 'Número de la cuenta de cliente',
    motivo: 'Motivo (queda en el registro)',
    revisar: 'Revisar',
    unir: 'Unir las dos cuentas',
    confirmo: 'Confirmé con la persona que las dos cuentas son suyas.',
    noSe: 'No se pueden unir todavía:',
    sePuede: 'Se pueden unir. Pasan a la cuenta de conductor:',
    pedidos: 'pedidos',
    viajes: 'viajes y envíos',
    direcciones: 'direcciones',
    listo:
      'Listo: las dos cuentas quedaron unidas. La persona entra con el correo de su cuenta de conductor.',
    faltaConfirmar: 'Marca la casilla de confirmación.',
  },
  en: {
    titulo: 'Merge two accounts of the same person',
    explica:
      'The driver account stays as the only one (its email and password keep working) and gains the customer role. The customer account is closed and its history moves to the driver account. Money is never mixed.',
    conductor: 'Driver account ID',
    cliente: 'Customer account ID',
    motivo: 'Reason (kept in the log)',
    revisar: 'Review',
    unir: 'Merge both accounts',
    confirmo: 'I confirmed with the person that both accounts are theirs.',
    noSe: 'They can’t be merged yet:',
    sePuede: 'They can be merged. Moving to the driver account:',
    pedidos: 'orders',
    viajes: 'rides and deliveries',
    direcciones: 'addresses',
    listo: 'Done: both accounts are merged. The person signs in with their driver account email.',
    faltaConfirmar: 'Check the confirmation box.',
  },
};

export function UnirCuentas({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const puede = usePermisos().puedeVer('config.editar');
  const b = useBorrador({
    formulario: 'unir-cuentas',
    inicial: { conductorId: '', clienteId: '', motivo: '', confirmo: false },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [revision, setRevision] = useState<Revision | null>(null);
  const [error, setError] = useState('');
  const [listo, setListo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  if (!puede) return null;
  const ids = { conductorId: v.conductorId.trim(), clienteId: v.clienteId.trim() };

  async function revisar() {
    setError('');
    setListo('');
    setOcupado(true);
    try {
      setRevision(await pedir<Revision>('POST', '/datos/admin/cuentas/unir/revisar', ids));
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }
  async function unir() {
    setError('');
    if (!v.confirmo) return setError(t.faltaConfirmar);
    setOcupado(true);
    try {
      await pedir('POST', '/datos/admin/cuentas/unir', {
        ...ids,
        motivo: v.motivo.trim(),
        confirmo: true,
      });
      await b.limpiar();
      setRevision(null);
      setListo(t.listo);
    } catch (x) {
      // Lo escrito se queda: se corrige y se vuelve a intentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }
  const sePuede = revision && revision.frenos.length === 0;
  return (
    <form
      className="formulario tarjeta-form"
      noValidate
      data-testid="form-unir-cuentas"
      onSubmit={(e) => {
        e.preventDefault();
        void (sePuede ? unir() : revisar());
      }}
    >
      <h2>
        {t.titulo} <AyudaAqui guia="merge-two-accounts" idioma={idioma} />
      </h2>
      <p className="pista">{t.explica}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <Campo
        etiqueta={t.conductor}
        valor={v.conductorId}
        cambiar={(x) => {
          b.cambiar('conductorId', x);
          setRevision(null);
        }}
        autoComplete="off"
      />
      <Campo
        etiqueta={t.cliente}
        valor={v.clienteId}
        cambiar={(x) => {
          b.cambiar('clienteId', x);
          setRevision(null);
        }}
        autoComplete="off"
      />
      {revision ? (
        sePuede ? (
          <div className="aviso-exito" data-testid="unir-se-puede">
            <p>
              {t.sePuede} {revision.mueve.pedidos} {t.pedidos}, {revision.mueve.viajes} {t.viajes},{' '}
              {revision.mueve.direcciones} {t.direcciones}.
            </p>
            <p>
              <strong>{revision.conductor?.nombre}</strong> · {revision.conductor?.correo} ←{' '}
              {revision.cliente?.correo}
            </p>
            <Campo
              etiqueta={t.motivo}
              valor={v.motivo}
              cambiar={(x) => b.cambiar('motivo', x)}
              autoComplete="off"
            />
            <label className="casilla">
              <input
                type="checkbox"
                checked={v.confirmo}
                onChange={(e) => b.cambiar('confirmo', e.target.checked)}
              />{' '}
              {t.confirmo}
            </label>
          </div>
        ) : (
          <div className="error-general" role="alert" data-testid="unir-frenos">
            <p>{t.noSe}</p>
            <ul>
              {revision.frenos.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )
      ) : null}
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {listo ? (
        <p className="aviso-exito" role="status">
          {listo}
        </p>
      ) : null}
      <button type="submit" className="boton" disabled={ocupado}>
        {sePuede ? t.unir : t.revisar}
      </button>
    </form>
  );
}
