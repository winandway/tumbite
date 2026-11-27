import { useId, useState } from 'react';
import {
  alEscribir,
  errorCasilla,
  tecladoDe,
  type Idioma,
  type TipoCasilla,
} from '@tumbite/compartido';
import { Icono } from '../sitio/Icono';

/** Campo de contraseña con ojito. Arranca oculta. Todas las pantallas usan este, nunca un input suelto. */
export function CampoClave(props: {
  etiqueta: string;
  valor: string;
  cambiar: (v: string) => void;
  textoVer: string;
  textoOcultar: string;
  autoComplete?: 'current-password' | 'new-password';
  error?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="campo">
      <label htmlFor={id}>{props.etiqueta}</label>
      <div className="clave">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={props.valor}
          onChange={(e) => props.cambiar(e.target.value)}
          autoComplete={props.autoComplete ?? 'current-password'}
          aria-invalid={Boolean(props.error)}
        />
        <button
          type="button"
          className="ojito"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? props.textoOcultar : props.textoVer}
          aria-pressed={visible}
        >
          <Icono nombre={visible ? 'ocultar' : 'ver'} tamano={20} />
        </button>
      </div>
      {props.error && <p className="error-campo">{props.error}</p>}
    </div>
  );
}

export function Campo(props: {
  etiqueta: string;
  valor: string;
  cambiar: (v: string) => void;
  /** El `type` del `<input>` (`email`, `tel`, `number`…). Para el DATO de la casilla es `casilla`. */
  tipo?: string;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
  /** C-REVISA-TUS-DATOS: «Editar» en la revisión vuelve con esta casilla ya abierta. */
  enfocar?: boolean;
  /** El teclado del celular que corresponde (`tel`, `email`…). */
  modoTeclado?: 'text' | 'tel' | 'email' | 'numeric';
  /**
   * C-CASILLA-CON-SU-TIPO (27 nov 2026): qué dato lleva la casilla (nombre, celular, correo,
   * documento, placa, año, monto, dirección). De ahí salen su teclado, lo que nunca entra al
   * escribir (letras en el celular) y el aviso debajo, en palabras, al salir de la casilla. Lo
   * escrito nunca se borra. Se llama `casilla` y no `tipo` porque `tipo` ya es el `type` del input.
   */
  casilla?: TipoCasilla;
  /** País (ISO) para el celular, el documento y la placa. */
  pais?: string | null;
  /** Vacío también se avisa al salir. */
  obligatorio?: boolean;
  /** Por defecto, el idioma de la página. */
  idioma?: Idioma;
}) {
  const id = useId();
  const idError = `${id}-error`;
  const [tocado, setTocado] = useState(false);
  const teclado = props.casilla ? tecladoDe(props.casilla) : null;
  const idioma: Idioma =
    props.idioma ??
    (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'es');
  // El aviso propio, al salir de la casilla; el que llega de afuera (servidor, «Siguiente») manda.
  const propio =
    props.casilla && tocado
      ? errorCasilla(props.casilla, props.valor, {
          idioma,
          pais: props.pais,
          obligatorio: Boolean(props.obligatorio),
        })
      : null;
  const error = props.error ?? propio ?? undefined;
  const modo = props.modoTeclado ?? (teclado ? teclado.inputMode : undefined);
  return (
    <div className="campo">
      <label htmlFor={id}>{props.etiqueta}</label>
      <input
        id={id}
        type={props.tipo ?? 'text'}
        value={props.valor}
        onChange={(e) =>
          props.cambiar(props.casilla ? alEscribir(props.casilla, e.target.value) : e.target.value)
        }
        onBlur={() => setTocado(true)}
        autoComplete={props.autoComplete ?? teclado?.autoComplete}
        autoCapitalize={teclado?.autoCapitalize}
        autoCorrect={teclado && !teclado.autoCorrect ? 'off' : undefined}
        maxLength={teclado?.maxLength}
        placeholder={props.placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? idError : undefined}
        inputMode={modo}
        // Solo al volver de «Editar», a pedido de la persona.
        autoFocus={props.enfocar}
      />
      {error && (
        <p className="error-campo" id={idError}>
          {error}
        </p>
      )}
    </div>
  );
}
