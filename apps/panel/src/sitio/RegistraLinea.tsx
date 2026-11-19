import { useEffect, useId, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { api } from '../panel/api';
import { Turnstile, reiniciarTurnstile } from '../panel/Turnstile';

/**
 * C-LINEAS-TAXI (19 nov 2026): «Registra tu línea». El formulario público de las líneas de taxi y
 * mototaxi con los seis datos que pide el comercial «Así va a funcionar tu línea». Llega al equipo de
 * Divoox como solicitud; nadie crea una línea sin que el equipo la apruebe tras verificar el celular del
 * líder. Nunca pierde lo escrito (borrador) y lleva Turnstile.
 */
const T = {
  es: {
    titulo: 'Registra tu línea',
    texto:
      'Si tu línea de taxis o mototaxis quiere trabajar con Divoox, cuéntanos de ella. Nuestro equipo verifica el celular del líder y te avisa cuando tu línea esté lista.',
    nombre: 'Nombre de la línea',
    ciudad: 'Ciudad',
    elegir: 'Elige tu ciudad',
    tipo: 'Tipo de servicio',
    tipos: { taxi: 'Taxi', mototaxi: 'Mototaxi', ambos: 'Taxi y mototaxi' },
    conductores: 'Cuántos conductores tiene',
    lider: 'Líder de la línea',
    liderNombre: 'Nombre del líder',
    liderTelefono: 'Celular del líder (con código de país)',
    contacto2: 'Segundo contacto de emergencia',
    contacto2Nombre: 'Nombre del segundo contacto',
    contacto2Telefono: 'Celular del segundo contacto (con código de país)',
    ayudaContactos:
      'Si un conductor de tu línea pide ayuda en la app, el líder y el segundo contacto reciben un mensaje con su ubicación.',
    enviar: 'Enviar mi solicitud',
    enviando: 'Enviando…',
    listo: 'Recibimos tu solicitud. Verificamos el celular del líder y te avisamos por mensaje.',
    otra: 'Registrar otra línea',
    repetida: 'Ya teníamos una solicitud de esta línea. Ya está en revisión.',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
    privacidad: 'Usamos estos datos solo para registrar tu línea y avisarte.',
  },
  en: {
    titulo: 'Register your line',
    texto:
      'If your taxi or mototaxi line wants to work with Divoox, tell us about it. Our team verifies the leader’s cell phone and lets you know when your line is ready.',
    nombre: 'Line name',
    ciudad: 'City',
    elegir: 'Choose your city',
    tipo: 'Type of service',
    tipos: { taxi: 'Taxi', mototaxi: 'Mototaxi', ambos: 'Taxi and mototaxi' },
    conductores: 'How many drivers it has',
    lider: 'Line leader',
    liderNombre: 'Leader’s name',
    liderTelefono: 'Leader’s cell phone (with country code)',
    contacto2: 'Second emergency contact',
    contacto2Nombre: 'Second contact’s name',
    contacto2Telefono: 'Second contact’s cell phone (with country code)',
    ayudaContactos:
      'If a driver in your line asks for help in the app, the leader and the second contact get a message with the driver’s location.',
    enviar: 'Send my request',
    enviando: 'Sending…',
    listo: 'We received your request. We verify the leader’s cell phone and will text you.',
    otra: 'Register another line',
    repetida: 'We already had a request for this line. It is under review.',
    recuperado: 'We restored what you were typing.',
    empezar: 'Start over',
    privacidad: 'We use this information only to register your line and contact you.',
  },
};

const INICIAL = {
  nombre: '',
  zonaId: '',
  tipo: '',
  conductores: '',
  liderNombre: '',
  liderTelefono: '',
  contacto2Nombre: '',
  contacto2Telefono: '',
};
type Clave = keyof typeof INICIAL;

export function RegistraLinea({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const id = useId();
  const b = useBorrador({
    formulario: 'registra-linea',
    cuenta: 'publico',
    inicial: INICIAL,
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [ciudades, setCiudades] = useState<{ id: string; nombre: string }[]>([]);
  const [turnstileSitio, setTurnstileSitio] = useState('');
  const [estado, setEstado] = useState<'libre' | 'enviando' | 'listo' | 'repetida'>('libre');
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ ciudades: { id: string; nombre: string }[] }>(
        'GET',
        '/datos/publico/lineas/ciudades',
      )
      .then((r) => vivo && setCiudades(r.ciudades))
      .catch(() => undefined);
    api
      .pedir<{ turnstileSitio?: string }>('GET', '/datos/publico')
      .then((p) => vivo && setTurnstileSitio(p.turnstileSitio ?? ''))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEstado('enviando');
    try {
      const r = await api.pedir<{ repetida: boolean }>('POST', '/datos/publico/lineas/solicitud', {
        nombre: v.nombre,
        zonaId: v.zonaId,
        tipo: v.tipo,
        conductores: Number(v.conductores) || 0,
        liderNombre: v.liderNombre,
        liderTelefono: v.liderTelefono,
        contacto2Nombre: v.contacto2Nombre,
        contacto2Telefono: v.contacto2Telefono,
      });
      await b.limpiar();
      setEstado(r.repetida ? 'repetida' : 'listo');
    } catch (x) {
      if (x instanceof ErrorApi && x.estado === 403) reiniciarTurnstile();
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
      setEstado('libre');
    }
  }

  if (estado === 'listo' || estado === 'repetida')
    return (
      <main className="legal contacto">
        <h1>{t.titulo}</h1>
        <div className="contacto-listo" role="status">
          <p>{estado === 'listo' ? t.listo : t.repetida}</p>
          <button type="button" className="boton secundario" onClick={() => setEstado('libre')}>
            {t.otra}
          </button>
        </div>
      </main>
    );

  const err = (c: string) =>
    error?.campo === c ? <p className="error-campo">{error.mensaje}</p> : null;
  const texto = (
    c: Clave,
    etiqueta: string,
    extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {},
  ) => (
    <div className="campo">
      <label htmlFor={`${id}-${c}`}>{etiqueta}</label>
      <input
        id={`${id}-${c}`}
        value={new Map(Object.entries(v)).get(c) ?? ''}
        onChange={(e) => b.cambiar(c, e.target.value)}
        aria-invalid={error?.campo === c}
        placeholder={etiqueta}
        {...extra}
      />
      {err(c)}
    </div>
  );

  return (
    <main className="legal contacto">
      <h1>{t.titulo}</h1>
      <p className="pista">{t.texto}</p>
      <form className="ld-form form-franquicia" onSubmit={enviar} noValidate aria-label={t.titulo}>
        {b.recuperado && (
          <p className="aviso-borrador">
            {t.recuperado}{' '}
            <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
              {t.empezar}
            </button>
          </p>
        )}
        {texto('nombre', t.nombre)}
        <div className="ld-dos">
          <div className="campo">
            <label htmlFor={`${id}-zonaId`}>{t.ciudad}</label>
            <select
              id={`${id}-zonaId`}
              value={v.zonaId}
              onChange={(e) => b.cambiar('zonaId', e.target.value)}
              aria-invalid={error?.campo === 'zonaId'}
            >
              <option value="">{t.elegir}</option>
              {ciudades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {err('zonaId')}
          </div>
          <div className="campo">
            <label htmlFor={`${id}-tipo`}>{t.tipo}</label>
            <select
              id={`${id}-tipo`}
              value={v.tipo}
              onChange={(e) => b.cambiar('tipo', e.target.value)}
              aria-invalid={error?.campo === 'tipo'}
            >
              <option value="">{t.elegir}</option>
              {Object.entries(t.tipos).map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
            {err('tipo')}
          </div>
        </div>
        {texto('conductores', t.conductores, { type: 'number', inputMode: 'numeric', min: 1 })}
        <h3>{t.lider}</h3>
        {texto('liderNombre', t.liderNombre, { autoComplete: 'name' })}
        {texto('liderTelefono', t.liderTelefono, { type: 'tel', autoComplete: 'tel' })}
        <h3>{t.contacto2}</h3>
        <p className="pista">{t.ayudaContactos}</p>
        {texto('contacto2Nombre', t.contacto2Nombre)}
        {texto('contacto2Telefono', t.contacto2Telefono, { type: 'tel' })}
        {error && !error.campo && (
          <p className="error-general" role="alert">
            {error.mensaje}
          </p>
        )}
        <Turnstile sitio={turnstileSitio} idioma={idioma} />
        <button type="submit" className="boton ancho" disabled={estado === 'enviando'}>
          {estado === 'enviando' ? t.enviando : t.enviar}
        </button>
        <small>{t.privacidad}</small>
      </form>
    </main>
  );
}
