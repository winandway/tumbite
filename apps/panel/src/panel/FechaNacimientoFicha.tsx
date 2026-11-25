import { useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  edadEnAnios,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { pedir } from './api';
import { Insignia } from './diseno/Insignia';

/**
 * C-FECHA-GUARDADA (Richard, 25 nov 2026) — todos los países. La fecha de nacimiento en la ficha del
 * conductor: la guardada en su cuenta con su edad (y si salió de su documento, con qué confianza se
 * leyó); sin fecha, en rojo con «Escribir la fecha», que se guarda con el motivo en la auditoría. Lo
 * escrito no se pierde (borrador).
 */
const T = {
  es: {
    sinFecha: 'Sin fecha de nacimiento',
    sinFechaAyuda: 'Sin ella la edad no se puede calcular y no se habilita.',
    anios: (n: number) => `${n} años`,
    leida: (n: number | null) =>
      n == null ? 'leída de su documento' : `leída de su documento (${n} % de confianza)`,
    propuesta: (f: string, n: number | null) =>
      `Su documento parece decir ${f}${n == null ? '' : ` (${n} % de confianza)`}: compárala con la foto.`,
    confirmada: 'confirmada al aprobar la identidad',
    escribir: 'Escribir la fecha',
    fecha: 'Fecha de nacimiento',
    motivo: 'Motivo (queda en el registro)',
    motivoEjemplo: 'De dónde sale la fecha',
    guardar: 'Guardar la fecha',
    cancelar: 'Cancelar',
    guardada: 'Fecha guardada.',
  },
  en: {
    sinFecha: 'No date of birth',
    sinFechaAyuda: 'Without it the age can’t be worked out and they can’t be enabled.',
    anios: (n: number) => `${n} years old`,
    leida: (n: number | null) =>
      n == null ? 'read from their ID' : `read from their ID (${n}% confidence)`,
    propuesta: (f: string, n: number | null) =>
      `Their ID seems to say ${f}${n == null ? '' : ` (${n}% confidence)`}: compare it with the photo.`,
    confirmada: 'confirmed when the identity was approved',
    escribir: 'Enter the date',
    fecha: 'Date of birth',
    motivo: 'Reason (kept in the log)',
    motivoEjemplo: 'Where the date comes from',
    guardar: 'Save the date',
    cancelar: 'Cancel',
    guardada: 'Date saved.',
  },
};

export type DatosDocumentoFicha = {
  nacimiento: string;
  confianzaNacimiento: number | null;
  estado: string;
} | null;

export function FechaNacimientoFicha({
  id,
  fecha,
  datos,
  idioma,
  alGuardar,
}: {
  id: string;
  fecha: string | null;
  datos: DatosDocumentoFicha;
  idioma: Idioma;
  alGuardar: () => void;
}) {
  const t = enIdioma(T, idioma);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: `fecha-nacimiento-${id}`,
    cuenta: 'superadmin',
    inicial: { fecha: datos?.nacimiento ?? '', motivo: '' },
    almacen: almacenNavegador,
  });
  const edad = edadEnAnios(fecha);
  const deDocumento = Boolean(fecha && datos?.nacimiento === fecha);

  async function guardar() {
    setError('');
    setEnviando(true);
    try {
      await pedir('PUT', `/datos/admin/conductores/${id}/fecha-nacimiento`, {
        fecha: b.valores.fecha,
        motivo: b.valores.motivo.trim(),
      });
      await b.limpiar();
      setAbierto(false);
      alGuardar();
    } catch (x) {
      // Lo escrito se queda para reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  if (fecha)
    return (
      <span data-testid="ficha-nacimiento">
        {fecha} · <Insignia tono="hecho">{edad == null ? fecha : t.anios(edad)}</Insignia>
        {deDocumento ? (
          <small className="suave">
            {' '}
            ·{' '}
            {datos?.estado === 'confirmado'
              ? t.confirmada
              : t.leida(datos?.confianzaNacimiento ?? null)}
          </small>
        ) : null}
      </span>
    );
  return (
    <span data-testid="ficha-nacimiento">
      <Insignia tono="problema" testId="sin-fecha">
        {t.sinFecha}
      </Insignia>{' '}
      <small className="suave">{t.sinFechaAyuda}</small>
      {datos?.nacimiento ? (
        <small className="suave" data-testid="fecha-propuesta">
          <br />
          {t.propuesta(datos.nacimiento, datos.confianzaNacimiento)}
        </small>
      ) : null}{' '}
      {!abierto ? (
        <button
          type="button"
          className="boton chico"
          onClick={() => setAbierto(true)}
          data-testid="escribir-fecha"
        >
          {t.escribir}
        </button>
      ) : (
        <form
          className="tarjeta-form"
          onSubmit={(e) => {
            e.preventDefault();
            void guardar();
          }}
          data-testid="form-fecha"
        >
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <label className="campo">
            <span>{t.fecha}</span>
            <input
              type="date"
              required
              value={b.valores.fecha}
              onChange={(e) => b.cambiar('fecha', e.target.value)}
            />
          </label>
          <label className="campo">
            <span>{t.motivo}</span>
            <input
              required
              minLength={3}
              maxLength={200}
              value={b.valores.motivo}
              placeholder={t.motivoEjemplo}
              onChange={(e) => b.cambiar('motivo', e.target.value)}
            />
          </label>
          {error ? (
            <p className="error-general" role="alert">
              {error}
            </p>
          ) : null}
          <div className="fila-botones">
            <button
              type="submit"
              className="boton"
              disabled={enviando || !b.valores.fecha || b.valores.motivo.trim().length < 3}
            >
              {t.guardar}
            </button>
            <button
              type="button"
              className="boton terciario"
              onClick={() => {
                void b.limpiar();
                setAbierto(false);
              }}
            >
              {t.cancelar}
            </button>
          </div>
        </form>
      )}
    </span>
  );
}
