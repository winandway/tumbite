import { useEffect, useState } from 'react';
import {
  correoEjemplo,
  pareceCorreo,
  ErrorApi,
  type Idioma,
  type Usuario,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { api } from './api';
import { ir } from '../ruta';
import { Campo, CampoClave } from './CampoClave';
import { Turnstile, reiniciarTurnstile } from './Turnstile';
import { TEXTOS_PANEL } from './textos';

const INICIAL = { nombre: '', correo: '', telefono: '', clave: '' };

/** Entrar y crear cuenta de restaurante. Lo escrito nunca se pierde (menos la contraseña). */
export function Acceso({ idioma, alEntrar }: { idioma: Idioma; alEntrar: (u: Usuario) => void }) {
  const t = enIdioma(TEXTOS_PANEL, idioma);
  const [modo, setModo] = useState<'entrar' | 'registro'>('entrar');
  const b = useBorrador({
    formulario: `panel-${modo}`,
    inicial: INICIAL,
    almacen: almacenNavegador,
    sensibles: ['clave'],
  });
  const [error, setError] = useState<{ mensaje: string; campo?: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Casilla de aceptación de los términos al crear la cuenta (pedido de Richard, 27 oct 2026).
  const [acepto, setAcepto] = useState(false);
  const [turnstileSitio, setTurnstileSitio] = useState('');
  const v = b.valores;
  // Escudo anti-robots (F5): la clave pública la publica el servidor; vacía = apagado.
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ turnstileSitio?: string }>('GET', '/datos/publico')
      .then((p) => {
        if (vivo) setTurnstileSitio(p.turnstileSitio ?? '');
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pareceCorreo(v.correo)) {
      setError({ mensaje: t.correoInvalido, campo: 'correo' });
      return;
    }
    if (modo === 'registro' && !acepto) {
      setError({ mensaje: t.faltaAceptar });
      return;
    }
    setEnviando(true);
    try {
      const r =
        modo === 'entrar'
          ? await api.entrar({ correo: v.correo, clave: v.clave })
          : await api.registro({
              nombre: v.nombre,
              correo: v.correo,
              clave: v.clave,
              telefono: v.telefono || undefined,
              rol: 'restaurante',
              idioma,
            });
      await b.limpiar();
      alEntrar(r.usuario);
    } catch (x) {
      // Si falla, lo escrito se queda en pantalla. Un 403 del escudo pide otro pase.
      if (x instanceof ErrorApi && x.estado === 403) reiniciarTurnstile();
      setError(
        x instanceof ErrorApi ? { mensaje: x.message, campo: x.campo } : { mensaje: String(x) },
      );
    } finally {
      setEnviando(false);
    }
  }

  const errorDe = (campo: string) => (error?.campo === campo ? error.mensaje : undefined);

  return (
    <main className="acceso">
      <h1>{modo === 'entrar' ? t.tituloEntrar : t.registrarse}</h1>
      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezarDeNuevo}
          </button>
        </p>
      )}
      <form onSubmit={enviar} noValidate>
        {modo === 'registro' && (
          <Campo
            etiqueta={t.nombre}
            valor={v.nombre}
            cambiar={(x) => b.cambiar('nombre', x)}
            autoComplete="name"
            placeholder={t.nombre}
            error={errorDe('nombre')}
          />
        )}
        <Campo
          etiqueta={t.correo}
          tipo="email"
          valor={v.correo}
          cambiar={(x) => b.cambiar('correo', x)}
          autoComplete="email"
          placeholder={correoEjemplo(idioma)}
          error={errorDe('correo')}
        />
        {modo === 'registro' && (
          <Campo
            etiqueta={t.telefono}
            tipo="tel"
            valor={v.telefono}
            cambiar={(x) => b.cambiar('telefono', x)}
            autoComplete="tel"
            placeholder={t.telefono}
            error={errorDe('telefono')}
          />
        )}
        <CampoClave
          etiqueta={t.clave}
          valor={v.clave}
          cambiar={(x) => b.cambiar('clave', x)}
          textoVer={t.verClave}
          textoOcultar={t.ocultarClave}
          autoComplete={modo === 'entrar' ? 'current-password' : 'new-password'}
          error={errorDe('clave')}
        />
        {error && !error.campo && (
          <p className="error-general" role="alert">
            {error.mensaje}
          </p>
        )}
        {modo === 'registro' && (
          <label className="nota-legal casilla-acepto">
            <input type="checkbox" checked={acepto} onChange={(x) => setAcepto(x.target.checked)} />{' '}
            {t.aceptas}{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer">
              {t.terminos}
            </a>
            ,{' '}
            <a href="/restaurant-terms" target="_blank" rel="noopener noreferrer">
              {t.terminosRestaurantes}
            </a>{' '}
            {t.yLa}{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer">
              {t.privacidad}
            </a>
            .
          </label>
        )}
        <Turnstile sitio={turnstileSitio} idioma={idioma} />
        <button type="submit" className="boton ancho" disabled={enviando}>
          {enviando ? t.enviando : modo === 'entrar' ? t.entrar : t.registrarse}
        </button>
      </form>
      <button
        type="button"
        className="enlace"
        onClick={() => {
          setError(null);
          setModo(modo === 'entrar' ? 'registro' : 'entrar');
        }}
      >
        {modo === 'entrar' ? t.noTengo : t.yaTengo}
      </button>
      {modo === 'entrar' && (
        <button type="button" className="enlace" onClick={() => ir('/forgot-password')}>
          {t.olvide}
        </button>
      )}
    </main>
  );
}
