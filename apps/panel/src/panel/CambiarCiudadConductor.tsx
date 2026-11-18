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
 * del repartidor, el equipo cambia su ciudad: lista de ciudades activas, motivo obligatorio y
 * confirmación (otra más si es un cambio de país). El servidor no lo permite con el conductor
 * conectado o con un trabajo en curso, y lo deja en la auditoría. Lo escrito no se pierde.
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
    guardar: 'Cambiar ciudad',
    cancelar: 'Cancelar',
    confirmar: (ciudad: string) => `¿Pasar a este conductor a ${ciudad}?`,
    confirmarPais: (texto: string) =>
      `${texto}\n\nAl cambiar de país, su moneda, su forma de cobro y los papeles que se le piden pasan a ser los del país nuevo. Sus papeles y aprobaciones se quedan. ¿Seguir?`,
    listo: (codigo: string) => `Listo. Su código nuevo es ${codigo}.`,
  },
  en: {
    titulo: 'Change city',
    ayuda:
      'Move the driver to another city. They must be offline with no job in progress. Their driver code changes to the new city’s and everything is logged.',
    ciudad: 'New city',
    elegir: 'Choose a city',
    motivo: 'Reason (kept in the log)',
    motivoEjemplo: 'Why it changes and who approved it',
    guardar: 'Change city',
    cancelar: 'Cancel',
    confirmar: (ciudad: string) => `Move this driver to ${ciudad}?`,
    confirmarPais: (texto: string) =>
      `${texto}\n\nWhen the country changes, their currency, payout method and required documents become the new country’s. Their documents and approvals stay. Continue?`,
    listo: (codigo: string) => `Done. Their new code is ${codigo}.`,
  },
};

type Ciudad = { id: string; nombre: string; pais: string; activa: boolean };

export function CambiarCiudadConductor({
  id,
  zonaActual,
  idioma,
  alCerrar,
  alCambiar,
}: {
  id: string;
  /** El nombre de su ciudad de hoy (no se ofrece). */
  zonaActual: string;
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
  });
  const [ciudades, setCiudades] = useState<Ciudad[]>([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    pedir<{ ciudades: Ciudad[] }>('GET', '/datos/admin/ciudades')
      .then((r) => setCiudades(r.ciudades.filter((c) => c.activa)))
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const destino = ciudades.find((c) => c.id === b.valores.zonaId);
    if (!destino || b.valores.motivo.trim().length < 3) return;
    if (!window.confirm(t.confirmar(destino.nombre))) return;
    setError('');
    setEnviando(true);
    const cuerpo = { zonaId: destino.id, motivo: b.valores.motivo.trim() };
    try {
      let r: { codigo?: string | null };
      try {
        r = await pedir('PUT', `/datos/admin/conductores/${id}/ciudad`, cuerpo);
      } catch (x) {
        // Cambio de país: el servidor pide confirmarlo aparte.
        if (
          !(x instanceof ErrorApi) ||
          x.campo !== 'cambioPais' ||
          /saldo|balance/i.test(x.message)
        )
          throw x;
        if (!window.confirm(t.confirmarPais(x.message))) return;
        r = await pedir('PUT', `/datos/admin/conductores/${id}/ciudad`, {
          ...cuerpo,
          cambioPais: true,
        });
      }
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
      onSubmit={(e) => void enviar(e)}
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
      <label>
        {t.ciudad}
        <select
          value={b.valores.zonaId}
          onChange={(e) => b.cambiar('zonaId', e.target.value)}
          required
        >
          <option value="">{t.elegir}</option>
          {ciudades
            .filter((c) => c.nombre !== zonaActual)
            .map((c) => (
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
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <p>
        <button type="submit" className="boton" disabled={enviando}>
          {t.guardar}
        </button>{' '}
        <button type="button" className="enlace" onClick={alCerrar}>
          {t.cancelar}
        </button>
      </p>
    </form>
  );
}
