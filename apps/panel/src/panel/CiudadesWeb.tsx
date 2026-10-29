import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { CIUDADES } from '../sitio/cobertura';
import { pedir } from './api';

/**
 * F17 (29 oct 2026): interruptor público de lanzamiento por ciudad. Lo que se marca aquí es lo que
 * la web dice («Ya estamos en Miami» o «Muy pronto»), sin publicar código. Pide confirmación porque
 * lo ve todo el público.
 */
const T = {
  es: {
    titulo: 'Ciudades en la web',
    ayuda:
      'Lo que la web le dice al público de cada ciudad. Encenderla no abre pedidos: eso va en la zona.',
    activa: 'En la web: «Ya estamos»',
    pronto: 'En la web: «Muy pronto»',
    anunciar: 'Anunciar en la web',
    volver: 'Volver a «Muy pronto»',
    seguro: (c: string) => `¿Anunciar ${c} al público ahora?`,
    seguroVolver: (c: string) => `¿Volver ${c} a «Muy pronto»?`,
    si: 'Sí, cambiar',
    no: 'Cancelar',
  },
  en: {
    titulo: 'Cities on the website',
    ayuda:
      'What the website tells the public about each city. Turning it on does not open orders: that is the zone.',
    activa: 'On the website: “Now in”',
    pronto: 'On the website: “Coming soon”',
    anunciar: 'Announce on the website',
    volver: 'Back to “Coming soon”',
    seguro: (c: string) => `Announce ${c} to the public now?`,
    seguroVolver: (c: string) => `Move ${c} back to “Coming soon”?`,
    si: 'Yes, change it',
    no: 'Cancel',
  },
};

export function CiudadesWeb({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [preguntando, setPreguntando] = useState<string | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    pedir<{ ciudades: { slug: string; estado: string }[] }>('GET', '/datos/admin/web/ciudades')
      .then((r) => setEstados(Object.fromEntries(r.ciudades.map((c) => [c.slug, c.estado]))))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, []);
  useEffect(cargar, [cargar]);
  async function cambiar(slug: string, estado: 'activo' | 'pronto') {
    setError('');
    try {
      await pedir('PUT', `/datos/admin/web/ciudades/${slug}`, { estado });
      setPreguntando(null);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <>
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="lista">
        {CIUDADES.map((c) => {
          const nombre = enIdioma(c.nombre, idioma);
          const activa = (estados[c.slug] ?? c.estado) === 'activo';
          return (
            <li key={c.slug}>
              <div className="lista-texto">
                <strong>{nombre}</strong>
                <span className={`insignia ${activa ? 'insignia-aprobado' : ''}`}>
                  {activa ? t.activa : t.pronto}
                </span>
              </div>
              {preguntando === c.slug ? (
                <div className="fila-botones" role="group" aria-label={nombre}>
                  <span>{activa ? t.seguroVolver(nombre) : t.seguro(nombre)}</span>
                  <button
                    type="button"
                    className="boton"
                    onClick={() => void cambiar(c.slug, activa ? 'pronto' : 'activo')}
                  >
                    {t.si}
                  </button>
                  <button
                    type="button"
                    className="boton secundario"
                    onClick={() => setPreguntando(null)}
                  >
                    {t.no}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={activa ? 'boton secundario' : 'boton'}
                  onClick={() => setPreguntando(c.slug)}
                >
                  {activa ? t.volver : t.anunciar}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
