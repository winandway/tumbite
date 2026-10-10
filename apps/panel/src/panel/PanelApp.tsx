import { useEffect, useState } from 'react';
import {
  MARCA,
  type Usuario,
  almacenNavegador,
  borrarBorradoresDe,
  enIdioma,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { SelectorIdioma } from '../SelectorIdioma';
import { useIdioma } from '../usarIdioma';
import { Acceso } from './Acceso';
import { api } from './api';
import { TEXTOS_PANEL } from './textos';

type Estado = { cargando: true } | { cargando: false; usuario: Usuario | null };

export function PanelApp({
  ruta,
  secciones,
}: {
  ruta: string;
  secciones?: Record<string, React.ReactNode>;
}) {
  const [idioma, cambiar] = useIdioma();
  const t = enIdioma(TEXTOS_PANEL, idioma);
  const [estado, setEstado] = useState<Estado>({ cargando: true });

  useEffect(() => {
    api
      .yo()
      .then((r) => setEstado({ cargando: false, usuario: r.usuario }))
      .catch(() => setEstado({ cargando: false, usuario: null }));
  }, []);

  async function salir(usuario: Usuario) {
    try {
      await api.salir();
    } catch (e) {
      console.warn('salir: el servidor no respondió, se sale igual', e);
    }
    await borrarBorradoresDe(almacenNavegador, usuario.id);
    window.location.href = '/panel'; // carga completa: nada queda de la sesión anterior
  }

  const usuario = estado.cargando ? null : estado.usuario;
  const menu =
    usuario?.rol === 'admin'
      ? Object.entries(t.menuAdmin)
      : usuario?.rol === 'restaurante'
        ? Object.entries(t.menuRest)
        : [];

  return (
    <div className="pagina panel">
      <header className="cabecera">
        <Enlace a="/" className="logo">
          <img src="/icono.svg" alt="" width={32} height={32} /> {MARCA.nombre}
        </Enlace>
        <div className="cabecera-derecha">
          {usuario && (
            <details className="cuenta">
              <summary>{usuario.nombre.split(' ')[0]}</summary>
              <div className="cuenta-menu">
                <p>{usuario.correo}</p>
                <button type="button" onClick={() => void salir(usuario)}>
                  {t.salir}
                </button>
              </div>
            </details>
          )}
          <SelectorIdioma idioma={idioma} cambiar={cambiar} />
        </div>
      </header>

      {estado.cargando ? (
        <main className="contenido">
          <p>{t.cargando}</p>
        </main>
      ) : !usuario ? (
        <Acceso idioma={idioma} alEntrar={(u) => setEstado({ cargando: false, usuario: u })} />
      ) : menu.length === 0 ? (
        <main className="contenido">
          <p>{t.soloEquipo}</p>
        </main>
      ) : (
        <div className="panel-cuerpo">
          <nav className="panel-menu" aria-label="Panel">
            {menu.map(([clave, texto]) => {
              const destino = clave === 'inicio' ? '/panel' : `/panel/${clave}`;
              return (
                <Enlace key={clave} a={destino} className={ruta === destino ? 'activo' : undefined}>
                  {texto}
                </Enlace>
              );
            })}
          </nav>
          <main className="panel-contenido">
            {secciones?.[ruta.replace('/panel/', '').replace('/panel', 'inicio')] ??
              (ruta === '/panel' ? (
                <>
                  <h1>
                    {t.hola}, {usuario.nombre.split(' ')[0]}
                  </h1>
                  <p>{usuario.rol === 'admin' ? t.bienvenidaAdmin : t.bienvenidaRest}</p>
                </>
              ) : (
                <p>{t.pronto}</p>
              ))}
          </main>
        </div>
      )}
    </div>
  );
}
