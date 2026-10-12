import { useId, useState } from 'react';
import { Icono } from './Icono';
import {
  ErrorApi,
  type Idioma,
  type TipoEspera,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { api } from '../panel/api';
import { TEXTOS_SITIO } from './textos';

const INICIAL = {
  nombre: '',
  correo: '',
  telefono: '',
  ciudad: '',
  codigoPostal: '',
  negocio: '',
  vehiculo: '',
};

/** Formulario de lista de espera. Nunca pierde lo escrito: si falla, todo se queda en pantalla. */
export function FormEspera({
  tipo,
  idioma,
  titulo,
}: {
  tipo: TipoEspera;
  idioma: Idioma;
  titulo: string;
}) {
  const t = enIdioma(TEXTOS_SITIO, idioma).form;
  const b = useBorrador({
    formulario: `espera-${tipo}`,
    inicial: INICIAL,
    almacen: almacenNavegador,
  });
  const [estado, setEstado] = useState<'libre' | 'enviando' | 'listo'>('libre');
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const id = useId();
  const v = b.valores;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEstado('enviando');
    try {
      await api.pedir('POST', '/datos/lista-espera', {
        tipo,
        idioma,
        ...v,
        vehiculo: tipo === 'repartidor' ? v.vehiculo : '',
      });
      await b.limpiar();
      setEstado('listo');
    } catch (x) {
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
      setEstado('libre');
    }
  }

  const campo = (
    clave: keyof typeof INICIAL,
    valor: string,
    etiqueta: string,
    extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {},
  ) => (
    <div className="campo">
      <label htmlFor={`${id}-${clave}`}>{etiqueta}</label>
      <input
        id={`${id}-${clave}`}
        value={valor}
        onChange={(e) => b.cambiar(clave, e.target.value)}
        aria-invalid={error?.campo === clave}
        placeholder={etiqueta}
        {...extra}
      />
      {error?.campo === clave && <p className="error-campo">{error.mensaje}</p>}
    </div>
  );

  if (estado === 'listo') {
    return (
      <div className="ld-form ld-form-listo" role="status">
        <Icono nombre="listo" tamano={40} />
        <p>{t.listo}</p>
      </div>
    );
  }

  return (
    <form className="ld-form" onSubmit={enviar} noValidate aria-label={titulo}>
      <h3>{titulo}</h3>
      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezar}
          </button>
        </p>
      )}
      {tipo === 'restaurante' &&
        campo('negocio', v.negocio, t.negocio, { autoComplete: 'organization' })}
      {campo('nombre', v.nombre, t.nombre, { autoComplete: 'name' })}
      {campo('correo', v.correo, t.correo, {
        type: 'email',
        autoComplete: 'email',
        placeholder: 'correo@ejemplo.com',
      })}
      {tipo !== 'comensal' &&
        campo('telefono', v.telefono, t.telefono, { type: 'tel', autoComplete: 'tel' })}
      <div className="ld-dos">
        {campo('ciudad', v.ciudad, t.ciudad, { autoComplete: 'address-level2' })}
        {campo('codigoPostal', v.codigoPostal, t.codigoPostal, {
          autoComplete: 'postal-code',
          inputMode: 'numeric',
          // La etiqueta ya dice «(opcional)»; el texto de ayuda corto cabe en el celular.
          placeholder: '12345',
        })}
      </div>
      {tipo === 'repartidor' && (
        <div className="campo">
          <label htmlFor={`${id}-vehiculo`}>{t.vehiculo}</label>
          <select
            id={`${id}-vehiculo`}
            value={v.vehiculo}
            onChange={(e) => b.cambiar('vehiculo', e.target.value)}
          >
            <option value="">{t.elegir}</option>
            <option value="carro">{t.vehiculos.carro}</option>
            <option value="moto">{t.vehiculos.moto}</option>
            <option value="bicicleta">{t.vehiculos.bicicleta}</option>
            <option value="otro">{t.vehiculos.otro}</option>
          </select>
        </div>
      )}
      {error && !error.campo && (
        <p className="error-general" role="alert">
          {error.mensaje}
        </p>
      )}
      <button type="submit" className="boton ancho" disabled={estado === 'enviando'}>
        {estado === 'enviando' ? t.enviando : t.enviar}
      </button>
      <small>{t.privacidad}</small>
    </form>
  );
}
