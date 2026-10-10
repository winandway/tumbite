import { useId, useState } from 'react';

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
          {visible ? '🙈' : '👁'}
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
  tipo?: string;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="campo">
      <label htmlFor={id}>{props.etiqueta}</label>
      <input
        id={id}
        type={props.tipo ?? 'text'}
        value={props.valor}
        onChange={(e) => props.cambiar(e.target.value)}
        autoComplete={props.autoComplete}
        placeholder={props.placeholder}
        aria-invalid={Boolean(props.error)}
      />
      {props.error && <p className="error-campo">{props.error}</p>}
    </div>
  );
}
