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
import { MiRestaurante } from './MiRestaurante';
import { Menu } from './Menu';
import { AdminRestaurantes } from './AdminRestaurantes';

function seccion(ruta: string, usuario: Usuario, idioma: 'es' | 'en'): React.ReactNode {
  if (usuario.rol === 'restaurante') {
    if (ruta === '/panel/restaurante') return <MiRestaurante usuario={usuario} idioma={idioma} />;
    if (ruta === '/panel/menu') return <Menu usuario={usuario} idioma={idioma} />;
  }
  if (usuario.rol === 'admin') {
    if (ruta === '/panel/restaurantes') return <AdminRestaurantes idioma={idioma} />;
  }
  return null;
}

type Estado = { cargando: true } | { cargando: false; usuario: Usuario | null };

export function PanelApp({ ruta }: { ruta: string }) {
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
            {seccion(ruta, usuario, idioma) ??
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
