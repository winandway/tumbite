import { useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from './api';
import { AyudaAqui } from './AyudaAqui';

/**
 * C-CUENTA-UNICA-SUSPENSION (24 nov 2026, decisión de Richard; todos los países). Suspender pide el
 * POR QUÉ, porque cambia a quién alcanza: «papeles vencidos» apaga solo el papel de conductor (sigue
 * pidiendo como cliente); «fraude» o «seguridad» suspenden a la persona entera, también como cliente
 * y sus restaurantes; «otra razón», la cuenta entera como siempre. En la ficha de un conductor,
 * «papeles vencidos» va primero y marcado: es lo más común y lo que menos daño hace por un descuido.
 */
export type MotivoTipo = 'papeles' | 'fraude' | 'seguridad' | 'otro';

const T = {
  es: {
    titulo: 'Suspender la cuenta',
    porQue: '¿Por qué la suspendes?',
    papeles: 'Papeles vencidos: solo deja de conducir (puede seguir pidiendo)',
    fraude: 'Fraude: se suspende la persona entera, también como cliente y sus restaurantes',
    seguridad: 'Seguridad: se suspende la persona entera, también como cliente y sus restaurantes',
    otro: 'Otra razón: se suspende la cuenta entera',
    motivo: 'Motivo (queda en el registro)',
    corto: 'Escribe el motivo (al menos 3 letras).',
    guardar: 'Suspender',
    cancelar: 'Cancelar',
  },
  en: {
    titulo: 'Suspend account',
    porQue: 'Why are you suspending it?',
    papeles: 'Expired documents: they only stop driving (they can keep ordering)',
    fraude: 'Fraud: the whole person is suspended, as a customer too, and their restaurants',
    seguridad: 'Safety: the whole person is suspended, as a customer too, and their restaurants',
    otro: 'Another reason: the whole account is suspended',
    motivo: 'Reason (kept in the log)',
    corto: 'Write the reason (at least 3 letters).',
    guardar: 'Suspend',
    cancelar: 'Cancel',
  },
};

export function SuspenderCuenta({
  id,
  esConductor,
  idioma,
  alCerrar,
  alSuspender,
}: {
  id: string;
  esConductor: boolean;
  idioma: Idioma;
  alCerrar: () => void;
  alSuspender: () => void;
}) {
  const t = enIdioma(T, idioma);
  const opciones: MotivoTipo[] = esConductor
    ? ['papeles', 'fraude', 'seguridad', 'otro']
    : ['fraude', 'seguridad', 'otro'];
  const b = useBorrador({
    formulario: `suspender-${id}`,
    inicial: { tipo: (esConductor ? 'papeles' : 'otro') as string, motivo: '' },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function suspender() {
    setError('');
    if (v.motivo.trim().length < 3) return setError(t.corto);
    setOcupado(true);
    try {
      await pedir('PATCH', `/datos/admin/usuarios/${id}`, {
        activo: false,
        motivo: v.motivo.trim(),
        malaConducta: false,
        motivoTipo: v.tipo,
      });
      await b.limpiar();
      alSuspender();
    } catch (x) {
      // Lo escrito se queda para corregir y reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form
      className="formulario tarjeta-form"
      noValidate
      data-testid="form-suspender"
      onSubmit={(e) => {
        e.preventDefault();
        void suspender();
      }}
    >
      <h3>
        {t.titulo} <AyudaAqui guia="merge-two-accounts" idioma={idioma} />
      </h3>
      <fieldset>
        <legend>{t.porQue}</legend>
        {opciones.map((o) => (
          <label key={o} className="casilla">
            <input
              type="radio"
              name={`motivo-tipo-${id}`}
              value={o}
              checked={v.tipo === o}
              onChange={() => b.cambiar('tipo', o)}
            />{' '}
            {new Map<MotivoTipo, string>([
              ['papeles', t.papeles],
              ['fraude', t.fraude],
              ['seguridad', t.seguridad],
              ['otro', t.otro],
            ]).get(o)}
          </label>
        ))}
      </fieldset>
      <label className="campo">
        {t.motivo}
        <textarea value={v.motivo} onChange={(e) => b.cambiar('motivo', e.target.value)} />
      </label>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="boton" disabled={ocupado}>
        {t.guardar}
      </button>{' '}
      <button type="button" className="enlace" onClick={alCerrar}>
        {t.cancelar}
      </button>
    </form>
  );
}
