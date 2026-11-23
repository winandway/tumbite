import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  CircleHelp,
  LogOut,
  Menu as IconoMenu,
  Search,
  X,
} from 'lucide-react';
import { type Idioma, MARCA, type Usuario } from '@tumbite/compartido';
import { Enlace } from '../../Enlace';
import { SelectorIdioma } from '../../SelectorIdioma';
import { VersionPublicada } from '../../VersionPublicada';
import { ir } from '../../ruta';
import { type GrupoMenu, IconoDe, type ItemMenu } from './menus';
import { Campana, type CampanaArmazon } from './Campana';
import './armazon.css';
// C-PANEL-DISENO: el sistema de diseño va después y manda en todo el panel.
import '../diseno/diseno.css';

/**
 * C-PANEL-ARMAZON (14 nov 2026, Richard): UN solo armazón para todos los paneles web (superadmin,
 * restaurante, franquicia, Divoox Flex y la cuenta sin panel): menú lateral oscuro con ícono en
 * cada ítem y grupos con título, cabecera con buscador, campana, idioma y cuenta, y el contenido
 * sobre fondo gris claro. Se copia la forma de una plantilla de administración; la marca es Divoox.
 *
 * El tono del menú se cambia en esta línea: 'oscuro' (negro de Divoox, el elegido) o 'claro'.
 */
export const TONO_MENU: 'oscuro' | 'claro' = 'oscuro';

export type { AvisoCampana, CampanaArmazon } from './Campana';

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
    salir: 'Cerrar sesión',
    cuenta: 'Mi cuenta',
    configuracion: 'Configuración',
    flex: 'Divoox Flex (envíos de mi empresa)',
    flexNombre: 'Divoox Flex',
    flexLema: 'Logística de paquetes para empresas',
    inicioSitio: 'Ir al inicio de Divoox',
    ayuda: 'Ayuda del equipo',
    pendiente: (n: number) => (n === 1 ? '1 pendiente' : `${n} pendientes`),
    pendienteUrgente: (n: number, u: number) =>
      `${n === 1 ? '1 pendiente' : `${n} pendientes`} · ${u <= 1 ? '1 pasó su límite (más de 24 h o una emergencia)' : `${u} pasaron su límite (más de 24 h o una emergencia)`}`,
  },
  en: {
    menu: 'Dashboard',
    abrir: 'Open the menu',
    cerrar: 'Close the menu',
    buscar: 'Search the dashboard',
    buscarCorto: 'Search a section…',
    sinResultados: 'We couldn’t find that section.',
    salir: 'Sign out',
    cuenta: 'My account',
    configuracion: 'Settings',
    flex: 'Divoox Flex (my company’s deliveries)',
    flexNombre: 'Divoox Flex',
    flexLema: 'Package logistics for businesses',
    inicioSitio: 'Go to the Divoox home page',
    ayuda: 'Team help',
    pendiente: (n: number) => (n === 1 ? '1 pending' : `${n} pending`),
    pendienteUrgente: (n: number, u: number) =>
      `${n} pending · ${u <= 1 ? '1 is past its limit (over 24 h or an emergency)' : `${u} are past their limit (over 24 h or an emergency)`}`,
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
  const [marcado, setMarcado] = useState(0);
  const elegir = (i: ItemMenu) => {
    setTexto('');
    setAbierto(false);
    ir(i.a);
  };
  const desplegado = abierto && texto.trim() !== '';
  const idOpcion = (n: number) => `${id}-opcion-${n}`;
  return (
    <div className="pd-buscador" ref={caja}>
      <Search size={18} aria-hidden="true" className="pd-buscador-lupa" />
      <input
        type="search"
        role="combobox"
        aria-label={t.buscar}
        aria-expanded={desplegado}
        aria-controls={desplegado ? id : undefined}
        aria-autocomplete="list"
        aria-activedescendant={desplegado && resultados.length > 0 ? idOpcion(marcado) : undefined}
        placeholder={t.buscarCorto}
        value={texto}
        autoComplete="off"
        onChange={(e) => {
          setTexto(e.target.value);
          setMarcado(0);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && resultados.length > 0) {
            e.preventDefault();
            setAbierto(true);
            setMarcado((n) => (n + 1) % resultados.length);
          } else if (e.key === 'ArrowUp' && resultados.length > 0) {
            e.preventDefault();
            setMarcado((n) => (n - 1 + resultados.length) % resultados.length);
          } else if (e.key === 'Enter') {
            const elegido = resultados.at(marcado) ?? resultados[0];
            if (elegido) {
              e.preventDefault();
              elegir(elegido);
            }
          } else if (e.key === 'Escape') setAbierto(false);
        }}
      />
      {desplegado ? (
        <div className="pd-flotante pd-buscador-caja">
          {resultados.length === 0 ? (
            <p className="pd-flotante-vacio" role="status">
              {t.sinResultados}
            </p>
          ) : (
            <ul role="listbox" id={id} aria-label={t.buscar}>
              {resultados.map((i, n) => (
                // El teclado se maneja desde la casilla (flechas y Enter); aquí, el toque o el clic.
                <li
                  key={`${i.grupo}-${i.clave}`}
                  id={idOpcion(n)}
                  role="option"
                  aria-selected={n === marcado}
                  className={n === marcado ? 'pd-opcion-activa' : undefined}
                  onMouseEnter={() => setMarcado(n)}
                  onClick={() => elegir(i)}
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
  campana,
  encabezado,
  volver,
  nombreMenu,
  buscador,
  ayuda,
  children,
}: {
  grupos: GrupoMenu[];
  /** 'logistica' pinta el armazón con el azul de Divoox Flex (C-COLOR-LOGISTICA). */
  variante?: 'comida' | 'logistica';
  /**
   * C-CAMPANA-SE-VACIA: la campana (lo que llegó y si ya se vio). Sin ella, dice que no hay avisos.
   * Las TAREAS van en los números del menú (`pendiente` de cada ítem), no aquí.
   */
  campana?: CampanaArmazon;
  /** Quién soy dentro de este panel (por ejemplo, la empresa y el rol), arriba del menú. */
  encabezado?: { titulo: string; detalle?: string };
  volver?: { texto: string; a: string };
  /** Nombre del menú para los lectores de pantalla (por defecto, «Panel»). */
  nombreMenu?: string;
  /** C-BUSCADOR-SERIO: otro buscador en la cabecera (el del superadmin busca datos, no solo secciones). */
  buscador?: React.ReactNode;
  /**
   * C-AYUDA-INTERNA (16 nov 2026, Richard): la dirección de la ayuda del equipo. Solo la pasa el
   * superadmin (vive bajo su dirección secreta): el «?» junto a la campana. Los demás paneles no.
   */
  ayuda?: string;
  children: React.ReactNode;
}) {
  const sesion = useContext(SesionArmazon);
  const { idioma } = sesion;
  const t = idioma === 'en' ? T.en : T.es;
  // C-AVISOS-MENU: el rojo dice por qué (cuántas pasaron su límite); el verde, cuántas esperan.
  const textoPendiente = (p: NonNullable<ItemMenu['pendiente']>) =>
    p.tono === 'urgente'
      ? t.pendienteUrgente(p.cantidad, p.urgentes ?? p.cantidad)
      : t.pendiente(p.cantidad);
  const [abierto, setAbierto] = useState(false);
  const logistica = variante === 'logistica';
  const idLateral = useId();
  const botonMenu = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const cerrar = () => setAbierto(false);
  // Al abrir el menú del celular, el foco entra en él; al cerrarlo, vuelve al botón que lo abrió.
  const estuvoAbierto = useRef(false);
  useEffect(() => {
    if (abierto) botonCerrar.current?.focus();
    else if (estuvoAbierto.current) botonMenu.current?.focus();
    estuvoAbierto.current = abierto;
  }, [abierto]);
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
      <aside className="pd-lateral" id={idLateral}>
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
            ref={botonCerrar}
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
                  {i.pendiente ? (
                    <span
                      className={`pd-item-pendiente pd-item-${i.pendiente.tono}`}
                      data-testid={`pendiente-${i.clave}`}
                      aria-label={textoPendiente(i.pendiente)}
                      title={textoPendiente(i.pendiente)}
                    >
                      <span className="pd-item-punto" aria-hidden="true" />
                      <span aria-hidden="true">
                        {i.pendiente.cantidad > 99 ? '99+' : i.pendiente.cantidad}
                      </span>
                    </span>
                  ) : null}
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
            ref={botonMenu}
            aria-label={abierto ? t.cerrar : t.abrir}
            aria-expanded={abierto}
            aria-controls={idLateral}
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
          {buscador ?? <Buscador grupos={grupos} idioma={idioma} />}
          <div className="pd-cabecera-derecha">
            {ayuda ? (
              <a
                href={ayuda}
                className="pd-icono-boton pd-ayuda"
                aria-label={t.ayuda}
                title={t.ayuda}
                data-testid="ayuda-interna"
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  ir(ayuda);
                }}
              >
                <CircleHelp size={20} aria-hidden="true" />
              </a>
            ) : null}
            <Campana campana={campana ?? { avisos: [] }} idioma={idioma} />
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
