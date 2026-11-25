import { useEffect, useState } from 'react';
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
 * C-REGRESO-PASAJERO (25 nov 2026; todos los países): la ciudad base del conductor (la ciudad a la
 * que vuelve con «Voy de regreso»). Se llena sola la primera vez que se conecta; aquí el equipo la ve
 * y la cambia, con motivo (queda en el registro). Solo ciudades activas de su país. No cambia su
 * ciudad de trabajo ni su código. Lo escrito no se pierde.
 */
const T = {
  es: {
    titulo: 'Ciudad base',
    ayuda:
      'Es la ciudad a la que vuelve con «Voy de regreso». No cambia su ciudad de trabajo ni su código.',
    actual: 'Ciudad base de hoy',
    sinBase: 'Todavía no tiene (se llena sola cuando se conecta en su ciudad).',
    ciudad: 'Ciudad base nueva',
    elegir: 'Elige una ciudad',
    motivo: 'Motivo (queda en el registro)',
    motivoEjemplo: 'Por qué se cambia y quién lo pidió',
    guardar: 'Guardar la ciudad base',
    cancelar: 'Cancelar',
    listo: (ciudad: string) => `Listo. Su ciudad base es ${ciudad}.`,
  },
  en: {
    titulo: 'Home city',
    ayuda:
      'The city they head back to with “Heading home”. It doesn’t change their work city or their code.',
    actual: 'Current home city',
    sinBase: 'None yet (it fills in when they go online in their city).',
    ciudad: 'New home city',
    elegir: 'Choose a city',
    motivo: 'Reason (kept in the log)',
    motivoEjemplo: 'Why it changes and who asked for it',
    guardar: 'Save home city',
    cancelar: 'Cancel',
    listo: (ciudad: string) => `Done. Their home city is ${ciudad}.`,
  },
};

type Datos = {
  actual: { id: string; nombre: string } | null;
  ciudades: { id: string; nombre: string }[];
};

export function CiudadBaseConductor({
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
    formulario: `ciudad-base-conductor-${id}`,
    cuenta: 'superadmin',
    inicial: { zonaId: '', motivo: '' },
    almacen: almacenNavegador,
  });
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    pedir<Datos>('GET', `/datos/admin/conductores/${id}/ciudad-base`)
      .then(setDatos)
      .catch((e: unknown) => setError(e instanceof ErrorApi ? e.message : String(e)));
  }, [id]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!b.valores.zonaId || b.valores.motivo.trim().length < 3) return;
    setError('');
    setEnviando(true);
    try {
      const r = await pedir<{ actual: { nombre: string } }>(
        'PUT',
        `/datos/admin/conductores/${id}/ciudad-base`,
        { zonaId: b.valores.zonaId, motivo: b.valores.motivo.trim() },
      );
      await b.limpiar();
      alCambiar(t.listo(r.actual?.nombre ?? ''));
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      className="tarjeta-form"
      onSubmit={(e) => void guardar(e)}
      data-testid="ciudad-base-conductor"
    >
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      {datos ? (
        <p>
          {t.actual}: <strong>{datos.actual?.nombre ?? t.sinBase}</strong>
        </p>
      ) : null}
      <label>
        {t.ciudad}
        <select
          value={b.valores.zonaId}
          onChange={(e) => b.cambiar('zonaId', e.target.value)}
          required
        >
          <option value="">{t.elegir}</option>
          {(datos?.ciudades ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
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
        <button type="submit" className="boton" disabled={enviando || !datos}>
          {t.guardar}
        </button>{' '}
        <button type="button" className="enlace" onClick={alCerrar}>
          {t.cancelar}
        </button>
      </p>
    </form>
  );
}
