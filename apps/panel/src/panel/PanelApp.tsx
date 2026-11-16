import { AvisosWebPanel, darDeBajaAlSalir } from './AvisosWebPanel';
import { Flota } from './Flota';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Armazon, type AvisoArmazon, SesionArmazon } from './armazon/Armazon';
import { EncabezadoPagina, Metricas, TarjetaMetrica } from './armazon/Piezas';
import {
  gruposAdmin,
  gruposCuenta,
  gruposRestaurante,
  IconoDe,
  titulosGrupo,
} from './armazon/menus';
import {
  MARCA,
  PATRON_ID_FICHA,
  type Usuario,
  almacenNavegador,
  borrarBorradoresDe,
  enIdioma,
  entornoDeHost,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { SelectorIdioma } from '../SelectorIdioma';
import { useIdioma } from '../usarIdioma';
import { Acceso } from './Acceso';
import { Configuracion } from './Configuracion';
import { api } from './api';
import { TEXTOS_PANEL } from './textos';
import { MiRestaurante } from './MiRestaurante';
import { Menu } from './Menu';
import { Productos } from './Productos';
import { AdminRestaurantes } from './AdminRestaurantes';
import { AdminDinero } from './AdminDinero';
import { Resenas } from './Resenas';
import { Anuncios } from './Anuncios';
import { Promociones } from './Promociones';
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
import { SuperEquipo } from './SuperEquipo';
import { SuperAprobaciones } from './SuperAprobaciones';
import { SuperPiloto } from './SuperPiloto';
import { SuperRewards } from './SuperRewards';
import { SuperInformes } from './SuperInformes';
import { SuperViajes } from './SuperViajes';
import { SuperMoto } from './SuperMoto';
import { SuperCiudad } from './SuperCiudad';
import { pedir } from './api';
import { BuscadorSuper } from './BuscadorSuper';
import {
  FranjaSegundoFactor,
  PermisosContexto,
  filtrarMenu,
  useAccesoInterno,
} from './permisosPanel';

/**
 * Sección del superadmin según la parte de la dirección después de su base secreta
 * (/panel/control-<id>). Las herramientas de siempre (restaurantes, dinero…) viven también ahí.
 */
/** C-CIUDAD-PRUEBAS: la ciudad de pruebas no aparece en producción. */
const enProduccion = () =>
  entornoDeHost(window.location.host) !== 'pruebas' &&
  entornoDeHost(window.location.host) !== 'local';

/**
 * C-SUPERADMIN-ENLACES (15 nov 2026): las fichas del superadmin aceptan CUALQUIER id de la base
 * (UUID, «zz-vivo-r-…», «vol-p-1»…), con UN solo patrón para todas. Antes cada ficha exigía un UUID
 * de 36 letras y un restaurante con otro id abría «Esta página no existe».
 */
// eslint-disable-next-line security/detect-non-literal-regexp -- patrón fijo del propio código (compartido)
const FICHA = new RegExp(`^/([a-z]+)/(${PATRON_ID_FICHA})$`);
export const PREFIJOS_FICHA = [
  'orders',
  'pedidos',
  'customers',
  'drivers',
  'restaurants',
  'tickets',
  'verifications',
  'flexfinance',
  'team',
] as const;

/** La ficha que corresponde a /<prefijo>/<id>, o null si la dirección no es de una ficha. */
function fichaAdmin(sub: string, base: string, idioma: 'es' | 'en'): React.ReactNode {
  const m = FICHA.exec(sub);
  const id = m?.[2];
  if (!m || !id) return null;
  switch (m[1]) {
    case 'orders':
    case 'pedidos':
      return <SuperPedido base={base} id={id} idioma={idioma} />;
    case 'customers':
      return <SuperCliente base={base} id={id} idioma={idioma} />;
    case 'drivers':
      return <SuperRepartidor base={base} id={id} idioma={idioma} />;
    case 'restaurants':
      return <SuperRestaurante base={base} id={id} idioma={idioma} />;
    case 'tickets':
      return <SuperTickets base={base} idioma={idioma} ticketId={id} />;
    case 'verifications':
      return <SuperKyc base={base} idioma={idioma} id={id} />;
    case 'flexfinance':
      return <SuperFinanzas base={base} idioma={idioma} empresaId={id} />;
    case 'team':
      return <SuperEquipo base={base} idioma={idioma} miId="" personaId={id} />;
    default:
      return null;
  }
}

export function seccionAdmin(sub: string, base: string, usuario: Usuario, idioma: 'es' | 'en') {
  if (sub === '') return <SuperResumen base={base} idioma={idioma} />;
  if (sub === '/tickets') return <SuperTickets base={base} idioma={idioma} ticketId={null} />;
  if (sub === '/franchises') return <SuperFranquicias usuario={usuario} idioma={idioma} />;
  if (sub === '/cities') return <SuperCiudades base={base} idioma={idioma} />;
  if (sub === '/verifications') return <SuperKyc base={base} idioma={idioma} id={null} />;
  if (sub === '/cash') return <SuperBandeja base={base} idioma={idioma} clave={null} />;
  const caso = /^\/cash\/([^/]+)$/.exec(sub);
  if (caso?.[1])
    return <SuperBandeja base={base} idioma={idioma} clave={decodeURIComponent(caso[1])} />;
  if (sub === '/rides') return <SuperViajes base={base} idioma={idioma} />;
  if (sub === '/moto') return <SuperMoto base={base} idioma={idioma} />;
  if (sub === '/team') return <SuperEquipo base={base} idioma={idioma} miId={usuario.id} />;
  if (sub === '/approvals') return <SuperAprobaciones idioma={idioma} miId={usuario.id} />;
  if (sub === '/pilot') return <SuperPiloto idioma={idioma} />;
  // C-CIUDAD-PRUEBAS: solo en el sitio de pruebas y en local (en producción no existe).
  if (sub === '/test-city' && !enProduccion()) return <SuperCiudad idioma={idioma} />;
  if (sub === '/rewards') return <SuperRewards idioma={idioma} />;
  if (sub === '/reports') return <SuperInformes idioma={idioma} />;
  if (sub === '/flexfinance') return <SuperFinanzas base={base} idioma={idioma} empresaId={null} />;
  if (sub === '/drivers') return <SuperRepartidores base={base} idioma={idioma} />;
  if (sub === '/customers') return <SuperClientes base={base} idioma={idioma} />;
  if (sub === '/restaurants') return <AdminRestaurantes idioma={idioma} base={base} />;
  if (sub === '/orders') return <SuperPedidos base={base} idioma={idioma} />;
  return fichaAdmin(sub, base, idioma) ?? seccion(`/panel${sub}`, usuario, idioma);
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
    if (ruta === '/panel/ads') return <Anuncios usuario={usuario} idioma={idioma} />;
    if (ruta === '/panel/promotions') return <Promociones usuario={usuario} idioma={idioma} />;
    if (ruta === '/panel/team') return <Equipo idioma={idioma} />;
    if (ruta === '/panel/fleet') return <Flota idioma={idioma} />;
    if (ruta === '/panel/orders')
      return (
        <>
          {/* C-AVISOS-WEB: avisos del navegador también en la computadora del restaurante. */}
          <AvisosWebPanel usuario={usuario} idioma={idioma} />
          <Pedidos idioma={idioma} />
        </>
      );
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
    // C-AVISOS-WEB: primero este navegador deja de recibir los avisos de la cuenta (tope de 3 s).
    await darDeBajaAlSalir();
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
  // C-FLOTA-PROPIA / C-SOLO-LO-TERMINADO: «Mis repartidores» solo aparece donde ya se puede usar.
  const [flotaDisponible, setFlotaDisponible] = useState(false);
  useEffect(() => {
    if (usuario?.rol !== 'restaurante') return;
    void pedir<{ disponible?: boolean }>('GET', '/datos/mi-restaurante/flota')
      .then((r) => setFlotaDisponible(r?.disponible === true))
      .catch(() => setFlotaDisponible(false));
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
  const esAdmin = usuario?.rol === 'admin';
  const esRestaurante = usuario?.rol === 'restaurante';
  const raizAdmin = esAdmin && baseAdmin ? baseAdmin : '/panel';
  // C-PERMISOS-FINOS: los permisos efectivos de quien entró (una lectura por sesión del panel).
  const permisos = useAccesoInterno(esAdmin);
  // C-PANEL-ARMAZON: el menú de cada rol, en grupos y con su ícono (armazon/menus.ts).
  const grupos = !usuario
    ? []
    : esAdmin
      ? filtrarMenu(gruposAdmin(t, idioma, raizAdmin, ruta, !enProduccion()), permisos.puedeVer)
      : esRestaurante
        ? gruposRestaurante(t, idioma, ruta, flotaDisponible)
        : gruposCuenta(t, idioma, ruta, miFranquicia);

  // La campana: lo que espera por la persona (lectura; como mucho una vez por minuto).
  const [avisosCrudos, setAvisosCrudos] = useState<{ clave: string; cantidad: number }[]>([]);
  const ultimaLectura = useRef(0);
  useEffect(() => {
    if (!usuario || (!esAdmin && !esRestaurante)) return;
    const leer = () => {
      if (document.visibilityState === 'hidden') return;
      if (Date.now() - ultimaLectura.current < 55_000) return;
      ultimaLectura.current = Date.now();
      void pedir<{ avisos: { clave: string; cantidad: number }[] }>('GET', '/datos/panel/avisos')
        .then((r) => setAvisosCrudos(r.avisos ?? []))
        .catch((e: unknown) => console.warn('avisos del panel: no se pudieron leer', e));
    };
    leer();
    // Una lectura chica por minuto y solo con la pestaña a la vista (no escribe nada).
    const reloj = window.setInterval(leer, 60_000);
    return () => window.clearInterval(reloj);
  }, [usuario, esAdmin, esRestaurante, ruta]);
  const avisos: AvisoArmazon[] = avisosCrudos.flatMap((a) => {
    if (a.clave === 'tickets')
      return [{ ...a, texto: t.avisos.tickets, a: `${raizAdmin}/tickets` }];
    if (a.clave === 'restaurantes')
      return [{ ...a, texto: t.avisos.restaurantes, a: `${raizAdmin}/restaurants` }];
    if (a.clave === 'pedidos') return [{ ...a, texto: t.avisos.pedidos, a: '/panel/orders' }];
    return [];
  });

  const sesion = useMemo(
    () => ({
      usuario,
      idioma,
      cambiar,
      salir: () => {
        if (usuario) void salir(usuario);
      },
    }),
    [usuario, idioma, cambiar],
  );

  const configuracion = usuario ? (
    <Configuracion
      usuario={usuario}
      idioma={idioma}
      alCambiar={(u) => setEstado({ cargando: false, usuario: u })}
      alBorrar={() => borrarCuenta(usuario)}
      alSalir={() => salir(usuario)}
    />
  ) : null;

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

  // Sin sesión (o mientras se sabe): la cabecera sencilla con el logo y el idioma.
  if (estado.cargando || !usuario)
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
            <SelectorIdioma idioma={idioma} cambiar={cambiar} />
          </div>
        </header>
        {estado.cargando ? (
          <main className="contenido">
            <p>{t.cargando}</p>
          </main>
        ) : (
          <Acceso
            idioma={idioma}
            tipo={esFlex ? 'empresa' : 'restaurante'}
            alEntrar={(u) => setEstado({ cargando: false, usuario: u })}
          />
        )}
      </div>
    );

  let contenido: React.ReactNode;
  if (esFlex)
    // Divoox Flex arma su propio menú (depende de la empresa): usa el mismo armazón, en azul.
    return (
      <SesionArmazon.Provider value={sesion}>
        <div className="pagina panel">
          <PanelEmpresa ruta={ruta} idioma={idioma} />
          {esRestaurante && <AyudaBurbuja idioma={idioma} />}
        </div>
      </SesionArmazon.Provider>
    );
  if (esFranquicia) {
    const g = titulosGrupo(idioma);
    return (
      <SesionArmazon.Provider value={sesion}>
        <div className="pagina panel">
          <Armazon
            grupos={[
              {
                titulo: g.operacion,
                items: [{ clave: 'inicio', texto: t.menuAdmin.inicio, a: ruta, activo: true }],
              },
              {
                titulo: g.ajustes,
                items: [{ clave: 'settings', texto: t.configuracion, a: '/panel/settings' }],
              },
            ]}
            volver={
              esAdmin && baseAdmin
                ? { texto: t.volverSuperadmin, a: `${baseAdmin}/franchises` }
                : undefined
            }
          >
            <PanelFranquicia ruta={ruta.slice('/panel/'.length)} idioma={idioma} />
          </Armazon>
          {esRestaurante && <AyudaBurbuja idioma={idioma} />}
        </div>
      </SesionArmazon.Provider>
    );
  }
  if (ruta === '/panel/settings') contenido = configuracion;
  else if (usuario.rol === 'repartidor' && ruta === '/panel/earnings')
    // C-ALTA-COBROS-DENTRO: Driver abre aquí sus cobros (puente con la sesión ya iniciada).
    contenido = <Billetera usuario={usuario} idioma={idioma} />;
  else if (!esAdmin && !esRestaurante)
    contenido = (
      <section className="super">
        <EncabezadoPagina
          titulo={`${t.hola}, ${usuario.nombre.split(' ')[0] ?? ''}`}
          detalle={t.soloEquipo}
        />
        <Metricas>
          <li className="pd-metrica">
            <a className="pd-metrica-enlace" href="/app/">
              <TarjetaMetricaCuerpo icono="app" etiqueta={t.irApp} detalle={t.irAppAyuda} />
            </a>
          </li>
          {miFranquicia ? (
            <TarjetaMetrica
              icono="franchise"
              etiqueta={t.miFranquicia}
              valor=""
              detalle={t.miFranquiciaAyuda}
              a={miFranquicia}
            />
          ) : null}
          <TarjetaMetrica
            icono="flex"
            tono="logistica"
            etiqueta={t.flex}
            valor=""
            detalle={t.flexLema}
            a="/panel/business"
          />
          <TarjetaMetrica
            icono="settings"
            etiqueta={t.configuracion}
            valor=""
            detalle={t.configuracionAyuda}
            a="/panel/settings"
          />
        </Metricas>
      </section>
    );
  else
    contenido =
      (esAdmin && baseAdmin && ruta.startsWith(baseAdmin)
        ? seccionAdmin(ruta.slice(baseAdmin.length), baseAdmin, usuario, idioma)
        : seccion(ruta, usuario, idioma)) ??
      (ruta === '/panel' && esRestaurante ? (
        <TableroRestaurante nombre={usuario.nombre.split(' ')[0] ?? ''} idioma={idioma} />
      ) : ruta === '/panel' ? (
        <EncabezadoPagina
          titulo={`${t.hola}, ${usuario.nombre.split(' ')[0] ?? ''}`}
          detalle={t.bienvenidaAdmin}
        />
      ) : (
        <p role="alert">{t.noExiste}</p>
      ));

  return (
    <SesionArmazon.Provider value={sesion}>
      <PermisosContexto.Provider value={permisos}>
        <div className="pagina panel">
          <Armazon
            grupos={grupos}
            avisos={avisos}
            buscador={
              esAdmin && baseAdmin && baseAdmin !== '/panel' ? (
                <BuscadorSuper base={baseAdmin} idioma={idioma} grupos={grupos} />
              ) : undefined
            }
          >
            {esAdmin ? <FranjaSegundoFactor idioma={idioma} /> : null}
            {contenido}
          </Armazon>
          {esRestaurante && <AyudaBurbuja idioma={idioma} />}
        </div>
      </PermisosContexto.Provider>
    </SesionArmazon.Provider>
  );
}

/** El cuerpo de una tarjeta de acceso (ícono, nombre y una línea) para un enlace que sale del panel. */
function TarjetaMetricaCuerpo({
  icono,
  etiqueta,
  detalle,
}: {
  icono: string;
  etiqueta: string;
  detalle: string;
}) {
  return (
    <>
      <span className="pd-metrica-icono pd-tono-neutro" aria-hidden="true">
        <IconoDe clave={icono} tamano={22} />
      </span>
      <span className="pd-metrica-texto">
        <span className="pd-metrica-etiqueta">{etiqueta}</span>
        <small className="pd-metrica-detalle">{detalle}</small>
      </span>
    </>
  );
}
