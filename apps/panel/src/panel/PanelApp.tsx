import { useEffect, useState } from 'react';
import { VersionPublicada } from '../VersionPublicada';
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
import { Configuracion } from './Configuracion';
import { Icono } from '../sitio/Icono';
import { api } from './api';
import { TEXTOS_PANEL } from './textos';
import { MiRestaurante } from './MiRestaurante';
import { Menu } from './Menu';
import { Productos } from './Productos';
import { AdminRestaurantes } from './AdminRestaurantes';
import { AdminDinero } from './AdminDinero';
import { Resenas } from './Resenas';
import { Equipo } from './Equipo';
import { Billetera } from './Billetera';
import { Regalos } from './Regalos';
import { Pedidos } from './Pedidos';
import { AdminEspera, AdminZonas } from './AdminZonas';
import { SuperFranquicias, SuperResumen, SuperTickets } from './Superadmin';
import { PanelFranquicia } from './PanelFranquicia';
import { PanelEmpresa } from './flex/PanelEmpresa';
import { TableroRestaurante } from './TableroRestaurante';
import { MiEmpresa } from './MiEmpresa';
import { SuperKyc } from './SuperKyc';
import { SuperBandeja } from './SuperBandeja';
import { SuperPedido, SuperPedidos } from './SuperPedido';
import {
  SuperCiudades,
  SuperCliente,
  SuperClientes,
  SuperRepartidor,
  SuperRepartidores,
  SuperRestaurante,
} from './SuperFichas';
import { AyudaBurbuja } from './AyudaBurbuja';
import { ir } from '../ruta';
import { SuperFinanzas } from './SuperFinanzas';
import { SuperViajes } from './SuperViajes';
import { pedir } from './api';

/**
 * Sección del superadmin según la parte de la dirección después de su base secreta
 * (/panel/control-<id>). Las herramientas de siempre (restaurantes, dinero…) viven también ahí.
 */
export function seccionAdmin(sub: string, base: string, usuario: Usuario, idioma: 'es' | 'en') {
  if (sub === '') return <SuperResumen base={base} idioma={idioma} />;
  if (sub === '/tickets') return <SuperTickets base={base} idioma={idioma} ticketId={null} />;
  const t = /^\/tickets\/([0-9a-f-]{36})$/.exec(sub);
  if (t?.[1]) return <SuperTickets base={base} idioma={idioma} ticketId={t[1]} />;
  if (sub === '/franchises') return <SuperFranquicias usuario={usuario} idioma={idioma} />;
  if (sub === '/cities') return <SuperCiudades base={base} idioma={idioma} />;
  if (sub === '/verifications') return <SuperKyc base={base} idioma={idioma} id={null} />;
  const kycId = /^\/verifications\/([0-9a-f-]{36})$/.exec(sub);
  if (kycId?.[1]) return <SuperKyc base={base} idioma={idioma} id={kycId[1]} />;
  if (sub === '/cash') return <SuperBandeja base={base} idioma={idioma} clave={null} />;
  const caso = /^\/cash\/([^/]+)$/.exec(sub);
  if (caso?.[1])
    return <SuperBandeja base={base} idioma={idioma} clave={decodeURIComponent(caso[1])} />;
  if (sub === '/rides') return <SuperViajes base={base} idioma={idioma} />;
  if (sub === '/flexfinance') return <SuperFinanzas base={base} idioma={idioma} empresaId={null} />;
  const finEmpresa = /^\/flexfinance\/([0-9a-f-]{36})$/.exec(sub);
  if (finEmpresa?.[1])
    return <SuperFinanzas base={base} idioma={idioma} empresaId={finEmpresa[1]} />;
  if (sub === '/drivers') return <SuperRepartidores base={base} idioma={idioma} />;
  if (sub === '/customers') return <SuperClientes base={base} idioma={idioma} />;
  if (sub === '/restaurants') return <AdminRestaurantes idioma={idioma} base={base} />;
  if (sub === '/orders') return <SuperPedidos base={base} idioma={idioma} />;
  const pedidoId = /^\/(?:orders|pedidos)\/([0-9a-f-]{36})$/.exec(sub);
  if (pedidoId?.[1]) return <SuperPedido base={base} id={pedidoId[1]} idioma={idioma} />;
  const ficha = /^\/(drivers|customers|restaurants)\/([0-9a-f-]{36})$/.exec(sub);
  if (ficha?.[1] === 'drivers' && ficha[2])
    return <SuperRepartidor base={base} id={ficha[2]} idioma={idioma} />;
  if (ficha?.[1] === 'customers' && ficha[2])
    return <SuperCliente base={base} id={ficha[2]} idioma={idioma} />;
  if (ficha?.[1] === 'restaurants' && ficha[2])
    return <SuperRestaurante base={base} id={ficha[2]} idioma={idioma} />;
  return seccion(`/panel${sub}`, usuario, idioma);
}

function seccion(ruta: string, usuario: Usuario, idioma: 'es' | 'en'): React.ReactNode {
  if (usuario.rol === 'restaurante') {
    if (ruta === '/panel/restaurant') return <MiRestaurante usuario={usuario} idioma={idioma} />;
    if (ruta === '/panel/menu') return <Menu usuario={usuario} idioma={idioma} />;
    if (ruta === '/panel/products') return <Productos idioma={idioma} />;
    if (ruta === '/panel/company') return <MiEmpresa usuario={usuario} idioma={idioma} />;
    if (ruta === '/panel/earnings') return <Billetera usuario={usuario} idioma={idioma} />;
    if (ruta === '/panel/gifts') return <Regalos usuario={usuario} idioma={idioma} />;
    if (ruta === '/panel/reviews') return <Resenas idioma={idioma} />;
    if (ruta === '/panel/team') return <Equipo idioma={idioma} />;
    if (ruta === '/panel/orders') return <Pedidos idioma={idioma} />;
  }
  if (usuario.rol === 'admin') {
    if (ruta === '/panel/restaurants') return <AdminRestaurantes idioma={idioma} />;
    if (ruta === '/panel/money') return <AdminDinero usuario={usuario} idioma={idioma} />;
    if (ruta === '/panel/zones') return <AdminZonas usuario={usuario} idioma={idioma} />;
    if (ruta === '/panel/waitlist') return <AdminEspera idioma={idioma} />;
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

  async function borrarCuenta(usuario: Usuario) {
    try {
      await borrarBorradoresDe(almacenNavegador, usuario.id);
      window.location.href = '/';
    } catch (e) {
      window.alert(e instanceof Error ? e.message : String(e));
    }
  }

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

  // Dirección secreta del superadmin: solo el servidor la sabe y solo se la dice a un admin.
  const [baseAdmin, setBaseAdmin] = useState<string | null>(null);
  const [miFranquicia, setMiFranquicia] = useState<string | null>(null);
  useEffect(() => {
    if (!usuario) return;
    if (usuario.rol === 'admin')
      void pedir<{ ruta: string | null }>('GET', '/datos/admin/ruta').then((r) =>
        setBaseAdmin(r.ruta ? `/panel/${r.ruta}` : '/panel'),
      );
    else
      void pedir<{ ruta: string | null }>('GET', '/datos/mi-franquicia')
        .then((r) => setMiFranquicia(r.ruta ? `/panel/${r.ruta}` : null))
        .catch(() => setMiFranquicia(null));
  }, [usuario]);
  // El admin siempre trabaja bajo su dirección secreta: /panel y las rutas viejas lo llevan ahí.
  useEffect(() => {
    if (!baseAdmin || baseAdmin === '/panel') return;
    if (ruta === '/panel') ir(baseAdmin);
    else if (
      /^\/panel\/(restaurantes|dinero|repartidores|zonas|espera|ciudades|clientes)$/.test(ruta)
    )
      ir(`${baseAdmin}${ruta.slice('/panel'.length)}`);
  }, [baseAdmin, ruta]);

  const esControl = ruta.startsWith('/panel/control-');
  const esFranquicia = ruta.startsWith('/panel/franchise-');
  // Divoox Flex (empresas de paquetería): cualquier cuenta con sesión; el servidor decide qué ve.
  const esFlex = ruta === '/panel/business' || ruta.startsWith('/panel/business/');
  // La dirección del superadmin no existe para nadie más (ni siquiera muestra el login).
  if (
    esControl &&
    !estado.cargando &&
    (usuario?.rol !== 'admin' || (baseAdmin && !ruta.startsWith(baseAdmin)))
  )
    return (
      <div className="pagina">
        <main className="contenido">
          <h1>{t.noExiste}</h1>
          <Enlace a="/">{t.alInicio}</Enlace>
        </main>
      </div>
    );

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
          <img
            className="logo-marca"
            src="/marca/divoox-logo.svg"
            alt={MARCA.nombre}
            width={138}
            height={34}
          />
        </Enlace>
        <div className="cabecera-derecha">
          {usuario && (
            <details className="cuenta">
              <summary>{usuario.nombre.split(' ')[0]}</summary>
              <div className="cuenta-menu">
                <p>{usuario.correo}</p>
                {/* Borrar la cuenta vive en Configuración, escondido y con confirmación escrita. */}
                <Enlace a="/panel/settings" className="boton secundario">
                  <Icono nombre="ajustes" tamano={16} /> {t.configuracion}
                </Enlace>
                <Enlace a="/panel/business" className="boton secundario">
                  <Icono nombre="ruta" tamano={16} /> {t.flex}
                </Enlace>
                <button type="button" onClick={() => void salir(usuario)}>
                  {t.salir}
                </button>
                <VersionPublicada idioma={idioma} conServidor />
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
      ) : esFranquicia ? (
        <main className="contenido">
          <PanelFranquicia ruta={ruta.slice('/panel/'.length)} idioma={idioma} />
        </main>
      ) : esFlex ? (
        <main className="contenido contenido-flex">
          <PanelEmpresa ruta={ruta} idioma={idioma} />
        </main>
      ) : menu.length === 0 && ruta === '/panel/settings' ? (
        <main className="contenido">
          <Configuracion
            usuario={usuario}
            idioma={idioma}
            alCambiar={(u) => setEstado({ cargando: false, usuario: u })}
            alBorrar={() => borrarCuenta(usuario)}
          />
        </main>
      ) : menu.length === 0 ? (
        <main className="contenido">
          <p>{t.soloEquipo}</p>
          {miFranquicia && (
            <p>
              <Enlace a={miFranquicia} className="boton">
                {t.miFranquicia}
              </Enlace>
            </p>
          )}
          <div className="fila-botones">
            <a className="boton" href="/app/">
              {t.irApp}
            </a>
            <Enlace a="/panel/business" className="boton secundario">
              {t.flex}
            </Enlace>
            <Enlace a="/panel/settings" className="boton secundario">
              <Icono nombre="ajustes" tamano={16} /> {t.configuracion}
            </Enlace>
          </div>
        </main>
      ) : (
        <div className="panel-cuerpo">
          <nav className="panel-menu" aria-label="Panel">
            {menu.map(([clave, texto]) => {
              const raiz = usuario.rol === 'admin' && baseAdmin ? baseAdmin : '/panel';
              const destino = clave === 'inicio' ? raiz : `${raiz}/${clave}`;
              return (
                <Enlace key={clave} a={destino} className={ruta === destino ? 'activo' : undefined}>
                  {texto}
                </Enlace>
              );
            })}
          </nav>
          <main className="panel-contenido">
            {ruta === '/panel/settings' ? (
              <Configuracion
                usuario={usuario}
                idioma={idioma}
                alCambiar={(u) => setEstado({ cargando: false, usuario: u })}
                alBorrar={() => borrarCuenta(usuario)}
              />
            ) : (
              ((usuario.rol === 'admin' && baseAdmin && ruta.startsWith(baseAdmin)
                ? seccionAdmin(ruta.slice(baseAdmin.length), baseAdmin, usuario, idioma)
                : seccion(ruta, usuario, idioma)) ??
              (ruta === '/panel' && usuario.rol === 'restaurante' ? (
                <TableroRestaurante nombre={usuario.nombre.split(' ')[0] ?? ''} idioma={idioma} />
              ) : ruta === '/panel' ? (
                <>
                  <h1>
                    {t.hola}, {usuario.nombre.split(' ')[0]}
                  </h1>
                  <p>{usuario.rol === 'admin' ? t.bienvenidaAdmin : t.bienvenidaRest}</p>
                </>
              ) : (
                <p>{t.pronto}</p>
              )))
            )}
          </main>
        </div>
      )}
      {usuario?.rol === 'restaurante' && <AyudaBurbuja idioma={idioma} />}
    </div>
  );
}
