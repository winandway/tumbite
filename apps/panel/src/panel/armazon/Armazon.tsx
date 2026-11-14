import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bell, ChevronDown, LogOut, Menu as IconoMenu, Search, X } from 'lucide-react';
import { type Idioma, MARCA, type Usuario } from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import { SelectorIdioma } from '../../SelectorIdioma';
import { VersionPublicada } from '../../VersionPublicada';
import { ir } from '../../ruta';
import { type GrupoMenu, IconoDe, type ItemMenu } from './menus';
import './armazon.css';

/**
 * C-PANEL-ARMAZON (14 nov 2026, Richard): UN solo armazón para todos los paneles web (superadmin,
 * restaurante, franquicia, Divoox Flex y la cuenta sin panel): menú lateral oscuro con ícono en
 * cada ítem y grupos con título, cabecera con buscador, campana, idioma y cuenta, y el contenido
 * sobre fondo gris claro. Se copia la forma de una plantilla de administración; la marca es Divoox.
 *
 * El tono del menú se cambia en esta línea: 'oscuro' (negro de Divoox, el elegido) o 'claro'.
 */
export const TONO_MENU: 'oscuro' | 'claro' = 'oscuro';

export type AvisoArmazon = { clave: string; texto: string; cantidad: number; a: string };

type Sesion = {
  usuario: Usuario | null;
  idioma: Idioma;
  cambiar: (i: Idioma) => void;
  salir: () => void;
};

/** Quien arma la página (PanelApp) deja aquí la sesión; el armazón la usa donde se dibuje. */
export const SesionArmazon = createContext<Sesion>({
  usuario: null,
  idioma: 'es',
  cambiar: () => undefined,
  salir: () => undefined,
});

const T = {
  es: {
    menu: 'Panel',
    abrir: 'Abrir el menú',
    cerrar: 'Cerrar el menú',
    buscar: 'Buscar en el panel',
    buscarCorto: 'Buscar una sección…',
    sinResultados: 'No encontramos esa sección.',
    avisos: 'Avisos',
    sinAvisos: 'No hay avisos nuevos.',
    salir: 'Cerrar sesión',
    cuenta: 'Mi cuenta',
    configuracion: 'Configuración',
    flex: 'Divoox Flex (envíos de mi empresa)',
    flexNombre: 'Divoox Flex',
    flexLema: 'Logística de paquetes para empresas',
    inicioSitio: 'Ir al inicio de Divoox',
  },
  en: {
    menu: 'Dashboard',
    abrir: 'Open the menu',
    cerrar: 'Close the menu',
    buscar: 'Search the dashboard',
    buscarCorto: 'Search a section…',
    sinResultados: 'We couldn’t find that section.',
    avisos: 'Notifications',
    sinAvisos: 'No new notifications.',
    salir: 'Sign out',
    cuenta: 'My account',
    configuracion: 'Settings',
    flex: 'Divoox Flex (my company’s deliveries)',
    flexNombre: 'Divoox Flex',
    flexLema: 'Package logistics for businesses',
    inicioSitio: 'Go to the Divoox home page',
  },
};

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Cierra una ventanita al tocar fuera o con Escape. */
function useCerrarFuera(abierto: boolean, cerrar: () => void) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) cerrar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto, cerrar]);
  return caja;
}

/** Buscador de la cabecera: encuentra cualquier sección del menú por su nombre. */
function Buscador({ grupos, idioma }: { grupos: GrupoMenu[]; idioma: Idioma }) {
  const t = idioma === 'en' ? T.en : T.es;
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const id = useId();
  const caja = useCerrarFuera(abierto, () => setAbierto(false));
  const resultados = useMemo(() => {
    const q = sinAcentos(texto.trim());
    if (!q) return [];
    return grupos
      .flatMap((g) => g.items.map((i) => ({ ...i, grupo: g.titulo })))
      .filter((i) => sinAcentos(`${i.texto} ${i.grupo}`).includes(q))
      .slice(0, 8);
  }, [grupos, texto]);
  const elegir = (i: ItemMenu) => {
    setTexto('');
    setAbierto(false);
    ir(i.a);
  };
  return (
    <div className="pd-buscador" ref={caja}>
      <Search size={18} aria-hidden="true" className="pd-buscador-lupa" />
      <input
        type="search"
        role="searchbox"
        aria-label={t.buscar}
        aria-controls={id}
        placeholder={t.buscarCorto}
        value={texto}
        autoComplete="off"
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          const primero = resultados[0];
          if (e.key === 'Enter' && primero) {
            e.preventDefault();
            elegir(primero);
          }
        }}
      />
      {abierto && texto.trim() ? (
        <div className="pd-flotante pd-buscador-caja" id={id}>
          {resultados.length === 0 ? (
            <p className="pd-flotante-vacio">{t.sinResultados}</p>
          ) : (
            <ul role="listbox" aria-label={t.buscar}>
              {resultados.map((i) => (
                <li
                  key={`${i.grupo}-${i.clave}`}
                  role="option"
                  aria-selected={false}
                  tabIndex={0}
                  onClick={() => elegir(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') elegir(i);
                  }}
                >
                  <IconoDe clave={i.clave} tamano={18} />
                  <span>{i.texto}</span>
                  <small>{i.grupo}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Campana: los avisos reales que le pasan (nunca un número inventado). */
function Campana({ avisos, idioma }: { avisos: AvisoArmazon[]; idioma: Idioma }) {
  const t = idioma === 'en' ? T.en : T.es;
  const [abierto, setAbierto] = useState(false);
  const caja = useCerrarFuera(abierto, () => setAbierto(false));
  const conAlgo = avisos.filter((a) => a.cantidad > 0);
  const total = conAlgo.reduce((s, a) => s + a.cantidad, 0);
  return (
    <div className="pd-campana" ref={caja}>
      <button
        type="button"
        className="pd-icono-boton"
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-label={total > 0 ? `${t.avisos}: ${total}` : t.avisos}
        onClick={() => setAbierto((a) => !a)}
      >
        <Bell size={20} aria-hidden="true" />
        {total > 0 ? (
          <span className="pd-campana-numero" aria-hidden="true">
            {total > 99 ? '99+' : total}
          </span>
        ) : null}
      </button>
      {abierto ? (
        <div className="pd-flotante pd-campana-caja">
          <p className="pd-flotante-titulo">{t.avisos}</p>
          {conAlgo.length === 0 ? (
            <p className="pd-flotante-vacio">{t.sinAvisos}</p>
          ) : (
            <ul>
              {conAlgo.map((a) => (
                <li key={a.clave}>
                  <Enlace a={a.a} onClick={() => setAbierto(false)}>
                    <span>{a.texto}</span>
                    <strong>{a.cantidad}</strong>
                  </Enlace>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Cuenta({ sesion, logistica }: { sesion: Sesion; logistica: boolean }) {
  const t = sesion.idioma === 'en' ? T.en : T.es;
  const [abierto, setAbierto] = useState(false);
  const caja = useCerrarFuera(abierto, () => setAbierto(false));
  const { usuario } = sesion;
  if (!usuario) return null;
  const nombre = usuario.nombre.split(' ')[0] ?? usuario.nombre;
  return (
    <div className="pd-cuenta cuenta" ref={caja}>
      <button
        type="button"
        className="pd-cuenta-boton"
        aria-haspopup="true"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        <span className="pd-avatar" aria-hidden="true">
          {nombre.slice(0, 1).toUpperCase()}
        </span>
        <span className="pd-cuenta-nombre">{nombre}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {abierto ? (
        <div className="pd-flotante pd-cuenta-caja cuenta-menu">
          <p className="pd-cuenta-quien">
            <strong>{usuario.nombre}</strong>
            <span>{usuario.correo}</span>
          </p>
          <Enlace
            a="/panel/settings"
            className="pd-cuenta-enlace"
            onClick={() => setAbierto(false)}
          >
            <IconoDe clave="settings" tamano={18} />
            {t.configuracion}
          </Enlace>
          {!logistica ? (
            <Enlace
              a="/panel/business"
              className="pd-cuenta-enlace"
              onClick={() => setAbierto(false)}
            >
              <IconoDe clave="flex" tamano={18} />
              {t.flex}
            </Enlace>
          ) : null}
          <button type="button" className="pd-cuenta-salir" onClick={() => sesion.salir()}>
            <LogOut size={18} aria-hidden="true" />
            {t.salir}
          </button>
          <VersionPublicada idioma={sesion.idioma} conServidor />
        </div>
      ) : null}
    </div>
  );
}

export function Armazon({
  grupos,
  variante = 'comida',
  avisos,
  encabezado,
  volver,
  nombreMenu,
  children,
}: {
  grupos: GrupoMenu[];
  /** 'logistica' pinta el armazón con el azul de Divoox Flex (C-COLOR-LOGISTICA). */
  variante?: 'comida' | 'logistica';
  /** Avisos reales para la campana. Sin esta lista, la campana dice que no hay avisos. */
  avisos?: AvisoArmazon[];
  /** Quién soy dentro de este panel (por ejemplo, la empresa y el rol), arriba del menú. */
  encabezado?: { titulo: string; detalle?: string };
  volver?: { texto: string; a: string };
  /** Nombre del menú para los lectores de pantalla (por defecto, «Panel»). */
  nombreMenu?: string;
  children: React.ReactNode;
}) {
  const sesion = useContext(SesionArmazon);
  const { idioma } = sesion;
  const t = idioma === 'en' ? T.en : T.es;
  const [abierto, setAbierto] = useState(false);
  const logistica = variante === 'logistica';
  const cerrar = () => setAbierto(false);
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abierto]);

  return (
    <div
      className={`pd pd-${variante}${logistica ? ' flex-panel' : ''}${abierto ? ' pd-menu-abierto' : ''}`}
      data-menu={TONO_MENU}
      data-testid="armazon"
    >
      <aside className="pd-lateral">
        <div className="pd-lateral-cabeza">
          <Enlace a="/" className="pd-marca" onClick={cerrar}>
            <img
              src={
                TONO_MENU === 'oscuro' || logistica
                  ? '/marca/divoox-logo-oscuro.svg'
                  : '/marca/divoox-logo.svg'
              }
              alt={MARCA.nombre}
              width={130}
              height={32}
            />
          </Enlace>
          <button
            type="button"
            className="pd-lateral-cerrar"
            aria-label={t.cerrar}
            onClick={cerrar}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </div>
        {volver ? (
          <Enlace a={volver.a} className="pd-volver flex-volver" onClick={cerrar}>
            <ArrowLeft size={16} aria-hidden="true" />
            {volver.texto.replace(/^←\s*/, '')}
          </Enlace>
        ) : null}
        {encabezado ? (
          <p className="pd-quien flex-nombre">
            <strong>{encabezado.titulo}</strong>
            {encabezado.detalle ? <small>{encabezado.detalle}</small> : null}
          </p>
        ) : null}
        <nav className="panel-menu pd-menu" aria-label={nombreMenu ?? t.menu}>
          {grupos.map((g) => (
            <div key={g.titulo} className="pd-grupo">
              <p className="pd-grupo-titulo">{g.titulo}</p>
              {g.items.map((i) => (
                <Enlace
                  key={i.clave}
                  a={i.a}
                  className={i.activo ? 'pd-item activo' : 'pd-item'}
                  onClick={cerrar}
                  actual={i.activo}
                >
                  <IconoDe clave={i.clave} tamano={19} />
                  <span>{i.texto}</span>
                </Enlace>
              ))}
            </div>
          ))}
        </nav>
        {sesion.usuario ? (
          <button
            type="button"
            className="panel-menu-salir pd-salir"
            data-testid="menu-salir"
            onClick={() => sesion.salir()}
          >
            <LogOut size={19} strokeWidth={1.9} aria-hidden="true" />
            <span>{t.salir}</span>
          </button>
        ) : null}
      </aside>
      <button type="button" className="pd-velo" tabIndex={-1} aria-hidden="true" onClick={cerrar} />
      <div className="pd-principal">
        <header className={`pd-cabecera${logistica ? ' flex-franja' : ''}`}>
          <button
            type="button"
            className="pd-icono-boton pd-hamburguesa"
            aria-label={abierto ? t.cerrar : t.abrir}
            aria-expanded={abierto}
            onClick={() => setAbierto((a) => !a)}
          >
            <IconoMenu size={22} aria-hidden="true" />
          </button>
          {logistica ? (
            <p className="flex-franja-marca pd-servicio" data-testid="flex-marca">
              <strong>{t.flexNombre}</strong>
              <span>{t.flexLema}</span>
            </p>
          ) : null}
          <Buscador grupos={grupos} idioma={idioma} />
          <div className="pd-cabecera-derecha">
            <Campana avisos={avisos ?? []} idioma={idioma} />
            <SelectorIdioma idioma={idioma} cambiar={sesion.cambiar} />
            <Cuenta sesion={sesion} logistica={logistica} />
            {logistica && sesion.usuario ? (
              <button
                type="button"
                className="pd-salir-franja"
                data-testid="flex-salir"
                onClick={() => sesion.salir()}
              >
                <LogOut size={17} aria-hidden="true" />
                <span>{t.salir}</span>
              </button>
            ) : null}
          </div>
        </header>
        <main className="pd-contenido panel-contenido">{children}</main>
      </div>
    </div>
  );
}
