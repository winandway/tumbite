import { useId, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { api } from '../panel/api';
import { Enlace } from '../Enlace';
import { Icono } from './Icono';
import { PAISES } from './cobertura';

const T = {
  es: {
    titulo: 'Quiero una franquicia de Tumbite',
    texto:
      'Cuéntanos de ti y de tu ciudad. Te respondemos con los números de tu ciudad y los siguientes pasos.',
    nombre: 'Nombre y apellido',
    correo: 'Correo',
    telefono: 'Teléfono (con código de país)',
    pais: 'País',
    ciudad: 'Ciudad',
    empresa: 'Empresa (opcional)',
    capital: 'Capital disponible para el lanzamiento',
    capitales: {
      'menos-50k': 'Menos de 50 000 USD',
      '50k-150k': '50 000 a 150 000 USD',
      '150k-500k': '150 000 a 500 000 USD',
      'mas-500k': 'Más de 500 000 USD',
    },
    experiencia: 'Tu experiencia (restaurantes, reparto, negocios) (opcional)',
    cuando: '¿Cuándo quieres arrancar?',
    cuandos: {
      ya: 'Lo antes posible',
      '3-meses': 'En los próximos 3 meses',
      '6-meses': 'En los próximos 6 meses',
      'mas-adelante': 'Más adelante',
    },
    mensaje: 'Algo más que debamos saber (opcional)',
    elegir: 'Elige una opción',
    enviar: 'Enviar mi solicitud',
    enviando: 'Enviando…',
    listo:
      'Recibimos tu solicitud. Te mandamos un correo con el enlace a tu conversación con nuestro equipo.',
    verConversacion: 'Ver mi conversación',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
    privacidad: 'Usamos tus datos solo para responder tu solicitud.',
  },
  en: {
    titulo: 'I want a Tumbite franchise',
    texto:
      'Tell us about you and your city. We’ll reply with the numbers for your city and the next steps.',
    nombre: 'Full name',
    correo: 'Email',
    telefono: 'Phone (with country code)',
    pais: 'Country',
    ciudad: 'City',
    empresa: 'Company (optional)',
    capital: 'Capital available for the launch',
    capitales: {
      'menos-50k': 'Under $50,000',
      '50k-150k': '$50,000 to $150,000',
      '150k-500k': '$150,000 to $500,000',
      'mas-500k': 'Over $500,000',
    },
    experiencia: 'Your experience (restaurants, delivery, business) (optional)',
    cuando: 'When do you want to start?',
    cuandos: {
      ya: 'As soon as possible',
      '3-meses': 'In the next 3 months',
      '6-meses': 'In the next 6 months',
      'mas-adelante': 'Later on',
    },
    mensaje: 'Anything else we should know (optional)',
    elegir: 'Choose an option',
    enviar: 'Send my request',
    enviando: 'Sending…',
    listo: 'We received your request. We emailed you the link to your conversation with our team.',
    verConversacion: 'See my conversation',
    recuperado: 'We restored what you were typing.',
    empezar: 'Start over',
    privacidad: 'We only use your information to reply to your request.',
  },
};

const INICIAL = {
  nombre: '',
  correo: '',
  telefono: '',
  pais: '',
  ciudad: '',
  empresa: '',
  capital: '',
  experiencia: '',
  cuando: '',
  mensaje: '',
};

/**
 * «Quiero una franquicia»: abre un ticket (correo a la persona con su enlace privado y aviso a
 * Richard). Nunca pierde lo escrito.
 */
export function FormFranquicia({ idioma, pais }: { idioma: Idioma; pais?: string }) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: 'franquicia',
    inicial: { ...INICIAL, pais: pais ?? '' },
    almacen: almacenNavegador,
  });
  const [estado, setEstado] = useState<'libre' | 'enviando' | 'listo'>('libre');
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const id = useId();
  const v = b.valores;
  const valor = (clave: keyof typeof INICIAL) => new Map(Object.entries(v)).get(clave) ?? '';

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEstado('enviando');
    try {
      const r = await api.pedir<{ enlace: string }>('POST', '/datos/franquicias', {
        ...v,
        idioma,
      });
      await b.limpiar();
      setEnlace(r.enlace);
      setEstado('listo');
    } catch (x) {
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
      setEstado('libre');
    }
  }

  if (estado === 'listo')
    return (
      <div className="ld-form ld-form-listo" role="status">
        <Icono nombre="listo" tamano={40} />
        <p>{t.listo}</p>
        {enlace && <Enlace a={enlace}>{t.verConversacion}</Enlace>}
      </div>
    );

  const error_ = (clave: string) =>
    error?.campo === clave ? <p className="error-campo">{error.mensaje}</p> : null;
  const texto = (
    clave: keyof typeof INICIAL,
    etiqueta: string,
    extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {},
  ) => (
    <div className="campo">
      <label htmlFor={`${id}-${clave}`}>{etiqueta}</label>
      <input
        id={`${id}-${clave}`}
        value={valor(clave)}
        onChange={(e) => b.cambiar(clave, e.target.value)}
        aria-invalid={error?.campo === clave}
        placeholder={etiqueta}
        {...extra}
      />
      {error_(clave)}
    </div>
  );
  const lista = (
    clave: 'capital' | 'cuando' | 'pais',
    etiqueta: string,
    opciones: [string, string][],
  ) => (
    <div className="campo">
      <label htmlFor={`${id}-${clave}`}>{etiqueta}</label>
      <select
        id={`${id}-${clave}`}
        value={valor(clave)}
        onChange={(e) => b.cambiar(clave, e.target.value)}
        aria-invalid={error?.campo === clave}
      >
        <option value="">{t.elegir}</option>
        {opciones.map(([valor, nombre]) => (
          <option key={valor} value={valor}>
            {nombre}
          </option>
        ))}
      </select>
      {error_(clave)}
    </div>
  );

  return (
    <form className="ld-form form-franquicia" onSubmit={enviar} noValidate aria-label={t.titulo}>
      <h3>{t.titulo}</h3>
      <p>{t.texto}</p>
      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezar}
          </button>
        </p>
      )}
      {texto('nombre', t.nombre, { autoComplete: 'name' })}
      {texto('correo', t.correo, {
        type: 'email',
        autoComplete: 'email',
        placeholder: 'correo@ejemplo.com',
      })}
      {texto('telefono', t.telefono, { type: 'tel', autoComplete: 'tel' })}
      <div className="ld-dos">
        {lista(
          'pais',
          t.pais,
          PAISES.map((p) => [enIdioma(p.nombre, idioma), enIdioma(p.nombre, idioma)]),
        )}
        {texto('ciudad', t.ciudad, { autoComplete: 'address-level2' })}
      </div>
      {texto('empresa', t.empresa, { autoComplete: 'organization' })}
      {lista('capital', t.capital, Object.entries(t.capitales))}
      {lista('cuando', t.cuando, Object.entries(t.cuandos))}
      <div className="campo">
        <label htmlFor={`${id}-experiencia`}>{t.experiencia}</label>
        <textarea
          id={`${id}-experiencia`}
          rows={3}
          value={v.experiencia}
          onChange={(e) => b.cambiar('experiencia', e.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor={`${id}-mensaje`}>{t.mensaje}</label>
        <textarea
          id={`${id}-mensaje`}
          rows={3}
          value={v.mensaje}
          onChange={(e) => b.cambiar('mensaje', e.target.value)}
        />
      </div>
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
