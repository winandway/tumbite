import { useEffect, useState } from 'react';
import {
  type Disponibilidad,
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  fraseDisponibilidad,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-DISPONIBLE-MUNDO (10 nov 2026) — todos los países. En la web: dónde ya funciona Divoox (para
 * el registro) y, para el restaurante cuya ciudad todavía no tiene cobertura, «Quiero traer
 * Divoox a mi ciudad». Nadie queda fuera del registro por su país.
 */
const T = {
  es: {
    yaFunciona: 'Divoox ya funciona en: {lista}.',
    otraCiudad:
      '¿Tu ciudad no está? Crea tu cuenta igual: te avisamos apenas lleguemos y tu cuenta ya queda lista.',
    titulo: 'Quiero traer Divoox a mi ciudad',
    intro:
      'Tu restaurante ya quedó registrado, pero Divoox todavía no reparte en tu ciudad. Dinos cuál es y abrimos primero donde más restaurantes nos lo piden.',
    ciudad: 'Ciudad y país',
    ciudadEjemplo: 'Ciudad, país',
    enviar: 'Quiero traer Divoox a mi ciudad',
    enviando: 'Enviando…',
    listo: 'Recibido. Nuestro equipo te escribe para llevar Divoox a {ciudad}.',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
  },
  en: {
    yaFunciona: 'Divoox already works in: {lista}.',
    otraCiudad:
      'Don’t see your city? Create your account anyway: we’ll let you know the moment we arrive and your account will be ready.',
    titulo: 'Bring Divoox to my city',
    intro:
      'Your restaurant is registered, but Divoox doesn’t deliver in your city yet. Tell us which one and we’ll open first where the most restaurants ask.',
    ciudad: 'City and country',
    ciudadEjemplo: 'City, country',
    enviar: 'Bring Divoox to my city',
    enviando: 'Sending…',
    listo: 'Got it. Our team will write to you about bringing Divoox to {ciudad}.',
    recuperado: 'We recovered what you were writing.',
    empezar: 'Start over',
  },
};

/** «Divoox ya funciona en: Miami (Estados Unidos)», para la pantalla de crear la cuenta. */
export function DondeFuncionaWeb({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<Disponibilidad | null>(null);
  useEffect(() => {
    let vivo = true;
    pedir<Disponibilidad>('GET', '/datos/disponibilidad')
      .then((r) => {
        if (vivo) setD(r);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  if (!d?.paises?.length) return null;
  return (
    <p className="suave" data-testid="donde-funciona">
      {t.yaFunciona.replace('{lista}', fraseDisponibilidad(d, idioma))} {t.otraCiudad}
    </p>
  );
}

export function TraerDivoox({
  idioma,
  cuenta,
  nombre,
  correo,
  negocio,
  telefono,
  punto,
}: {
  idioma: Idioma;
  cuenta: string;
  nombre: string;
  correo: string;
  negocio: string;
  telefono: string;
  punto: { lat: number; lng: number } | null;
}) {
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: 'traer-divoox',
    cuenta,
    inicial: { ciudad: '' },
    almacen: almacenNavegador,
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState('');

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError('');
    try {
      await pedir('POST', '/datos/lista-espera', {
        tipo: 'restaurante',
        nombre,
        correo,
        negocio,
        telefono,
        ciudad: b.valores.ciudad,
        idioma,
        origen: 'web',
        lat: punto?.lat ?? null,
        lng: punto?.lng ?? null,
      });
      setHecho(b.valores.ciudad);
      await b.limpiar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  if (hecho)
    return (
      <p className="ok" role="status" data-testid="traer-divoox-listo">
        {t.listo.replace('{ciudad}', hecho)}
      </p>
    );
  return (
    <form onSubmit={enviar} className="tarjeta-form" data-testid="traer-divoox" noValidate>
      <h2>{t.titulo}</h2>
      <p className="suave">{t.intro}</p>
      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezar}
          </button>
        </p>
      )}
      <label className="campo">
        <span>{t.ciudad}</span>
        <input
          value={b.valores.ciudad}
          onChange={(x) => b.cambiar('ciudad', x.target.value)}
          placeholder={t.ciudadEjemplo}
          autoComplete="address-level2"
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="boton" disabled={enviando}>
        {enviando ? t.enviando : t.enviar}
      </button>
    </form>
  );
}
