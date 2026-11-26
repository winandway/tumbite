import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { pedir } from './api';

/**
 * C-CAMBIAR-CIUDAD-ADMIN (piloto, 18 nov 2026; todos los países): desde los tres puntos de la ficha
 * del repartidor (y de la de Moto), el equipo cambia su ciudad. Las ciudades salen del servidor
 * (activas, de su zona de trabajo, sin zonas internas de prueba en producción). Motivo obligatorio y
 * un paso de confirmación dentro del mismo formulario (sin ventanas del navegador); si cambia de
 * país, además una casilla. Lo escrito no se pierde.
 */
const T = {
  es: {
    titulo: 'Cambiar ciudad',
    ayuda:
      'Pasa al conductor a otra ciudad. Tiene que estar desconectado y sin trabajo en curso. Su código de conductor cambia al de la ciudad nueva y todo queda en el registro.',
    ciudad: 'Ciudad nueva',
    elegir: 'Elige una ciudad',
    motivo: 'Motivo (queda en el registro)',
    motivoEjemplo: 'Por qué se cambia y quién lo autorizó',
    seguir: 'Revisar el cambio',
    cancelar: 'Cancelar',
    confirmar: (ciudad: string) => `Vas a pasar a este conductor a ${ciudad}.`,
    pais: (de: string, a: string) =>
      `Es un cambio de país (de ${de} a ${a}). Su moneda, su forma de cobro y los papeles que se le piden pasan a ser los del país nuevo. Si tiene dinero, papeles, vehículo o servicios del país viejo, no se permite hasta que el equipo los revise.`,
    confirmoPais: 'Confirmo el cambio de país',
    si: 'Sí, cambiar la ciudad',
    volver: 'Volver',
    sinCambio: 'No se cambió nada.',
    listo: (codigo: string) => `Listo. Su código nuevo es ${codigo}.`,
    sinCiudades: 'No hay otras ciudades activas en tu zona de trabajo.',
  },
  en: {
    titulo: 'Change city',
    ayuda:
      'Move the driver to another city. They must be offline with no job in progress. Their driver code changes to the new city’s and everything is logged.',
    ciudad: 'New city',
    elegir: 'Choose a city',
    motivo: 'Reason (kept in the log)',
    motivoEjemplo: 'Why it changes and who approved it',
    seguir: 'Review the change',
    cancelar: 'Cancel',
    confirmar: (ciudad: string) => `You’re about to move this driver to ${ciudad}.`,
    pais: (de: string, a: string) =>
      `This is a country change (from ${de} to ${a}). Their currency, payout method and required documents become the new country’s. If they have money, documents, a vehicle or services from the old country, it isn’t allowed until the team reviews them.`,
    confirmoPais: 'I confirm the country change',
    si: 'Yes, change the city',
    volver: 'Back',
    sinCambio: 'Nothing was changed.',
    listo: (codigo: string) => `Done. Their new code is ${codigo}.`,
    sinCiudades: 'There are no other active cities in your work area.',
  },
};

type Destinos = {
  actual: { zonaId: string; pais: string };
  ciudades: { id: string; nombre: string; pais: string }[];
};

export function CambiarCiudadConductor({
  id,
  idioma,
  alCerrar,
  alCambiar,
}: {
  id: string;
  idioma: Idioma;
  alCerrar: () => void;
  alCambiar: (aviso: string) => void;
}) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: `ciudad-conductor-${id}`,
    cuenta: 'superadmin',
    inicial: { zonaId: '', motivo: '' },
    almacen: almacenNavegador,
    // C-BORRADOR-ELECCION-SOLA: la ciudad elegida sola no es «lo que estabas escribiendo».
    noBastan: ['zonaId'],
  });
  const [destinos, setDestinos] = useState<Destinos | null>(null);
  const [paso, setPaso] = useState<'llenar' | 'confirmar'>('llenar');
  const [confirmoPais, setConfirmoPais] = useState(false);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    pedir<Destinos>('GET', `/datos/admin/conductores/${id}/ciudades-destino`)
      .then(setDestinos)
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, [id]);
  // C-BORRADOR-SIN-AVISO-VACIO: una ciudad recuperada que ya no se puede elegir (la actual, una cerrada
  // o de una versión vieja) se descarta al llegar las ciudades: así no queda un «Recuperamos…» con la
  // casilla vacía. Lo demás escrito se respeta.
  const { valores: vb, setValores: ponerValores } = b;
  useEffect(() => {
    if (!destinos || !vb.zonaId) return;
    if (!(destinos.ciudades ?? []).some((c) => c.id === vb.zonaId))
      ponerValores({ ...vb, zonaId: '' });
  }, [destinos, vb, ponerValores]);
  const destino = destinos?.ciudades?.find((c) => c.id === b.valores.zonaId) ?? null;
  const otroPais = Boolean(destino && destinos?.actual && destino.pais !== destinos.actual.pais);

  async function cambiar() {
    if (!destino) return;
    setError('');
    setEnviando(true);
    try {
      const r = await pedir<{ codigo: string }>('PUT', `/datos/admin/conductores/${id}/ciudad`, {
        zonaId: destino.id,
        motivo: b.valores.motivo.trim(),
        ...(otroPais ? { cambioPais: true } : {}),
      });
      await b.limpiar();
      alCambiar(t.listo(r.codigo ?? ''));
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      className="tarjeta-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (paso === 'llenar') {
          if (!destino || b.valores.motivo.trim().length < 3) return;
          setEstado('');
          setError('');
          setConfirmoPais(false);
          setPaso('confirmar');
        } else void cambiar();
      }}
      data-testid="cambiar-ciudad-repartidor"
    >
      <h2>
        {t.titulo} <AyudaAqui guia="change-driver-city" idioma={idioma} />
      </h2>
      <p className="pista">{t.ayuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      {paso === 'llenar' ? (
        <>
          {destinos && (destinos.ciudades ?? []).length === 0 ? <p>{t.sinCiudades}</p> : null}
          <label>
            {t.ciudad}
            <select
              value={b.valores.zonaId}
              onChange={(e) => b.cambiar('zonaId', e.target.value)}
              required
            >
              <option value="">{t.elegir}</option>
              {(destinos?.ciudades ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre} ({c.pais})
                </option>
              ))}
            </select>
          </label>
          <label>
            {t.motivo}
            <input
              value={b.valores.motivo}
              onChange={(e) => b.cambiar('motivo', e.target.value)}
              placeholder={t.motivoEjemplo}
              required
              minLength={3}
              maxLength={200}
            />
          </label>
        </>
      ) : (
        <div data-testid="cambiar-ciudad-confirmar">
          <p>
            <strong>{t.confirmar(destino?.nombre ?? '')}</strong>
          </p>
          {otroPais && destinos && destino ? (
            <>
              <p className="pista">{t.pais(destinos.actual.pais, destino.pais)}</p>
              <label className="casilla">
                <input
                  type="checkbox"
                  checked={confirmoPais}
                  onChange={(e) => setConfirmoPais(e.target.checked)}
                />{' '}
                {t.confirmoPais}
              </label>
            </>
          ) : null}
        </div>
      )}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {estado ? <p role="status">{estado}</p> : null}
      <p>
        {paso === 'llenar' ? (
          <>
            <button type="submit" className="boton" disabled={!destinos}>
              {t.seguir}
            </button>{' '}
            <button
              type="button"
              className="enlace"
              onClick={() => {
                // Cancelar a propósito tira lo escrito (regla del borrador).
                void b.limpiar();
                alCerrar();
              }}
            >
              {t.cancelar}
            </button>
          </>
        ) : (
          <>
            <button
              type="submit"
              className="boton"
              disabled={enviando || (otroPais && !confirmoPais)}
            >
              {t.si}
            </button>{' '}
            <button
              type="button"
              className="enlace"
              onClick={() => {
                setPaso('llenar');
                setEstado(t.sinCambio);
              }}
            >
              {t.volver}
            </button>
          </>
        )}
      </p>
    </form>
  );
}
