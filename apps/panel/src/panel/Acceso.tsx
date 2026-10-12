import { useState } from 'react';
import {
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
  const v = b.valores;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
      // Si falla, lo escrito se queda en pantalla.
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
      <h1>{modo === 'entrar' ? t.entrar : t.registrarse}</h1>
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
          placeholder="correo@ejemplo.com"
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
          <p className="nota-legal">
            {t.aceptas}{' '}
            <a href="/terminos" target="_blank" rel="noopener noreferrer">
              {t.terminos}
            </a>
            ,{' '}
            <a href="/terminos-restaurantes" target="_blank" rel="noopener noreferrer">
              {t.terminosRestaurantes}
            </a>{' '}
            {t.yLa}{' '}
            <a href="/privacidad" target="_blank" rel="noopener noreferrer">
              {t.privacidad}
            </a>
            .
          </p>
        )}
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
        <button type="button" className="enlace" onClick={() => ir('/olvide')}>
          {t.olvide}
        </button>
      )}
    </main>
  );
}
