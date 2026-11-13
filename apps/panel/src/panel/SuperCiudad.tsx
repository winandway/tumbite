import { useCallback, useEffect, useRef, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { pedir } from './api';

/**
 * C-CIUDAD-PRUEBAS (13 nov 2026, pedido de Richard): la ciudad de pruebas EN VIVO. Una población
 * falsa del simulador compra, vende y reparte; aquí se ve qué pedidos van en cada estado, cuántos
 * clientes compran, qué restaurantes venden, qué repartidores están en la zona (lista y mapa), las
 * ventas de la sesión y los fallos que va encontrando. Solo existe en el sitio de pruebas y en local
 * (el menú no la muestra en producción y el servidor responde «No encontrado» allí). Mirar no
 * escribe nada. Todos los países.
 *
 * C-CIUDAD-JUEGO (SIM-7): el MODO JUEGO. «Encender la ciudad» arma restaurantes y repartidores
 * robot; mientras esta pantalla está abierta manda un latido cada 4 segundos y los robots avanzan
 * (aceptan, preparan, recogen, manejan y entregan). Una persona pide desde la app real del
 * cliente y paga en efectivo al recibir. «Pantalla grande» es el mapa para un televisor.
 */
const T = {
  es: {
    titulo: 'Ciudad de pruebas',
    ayuda:
      'Clientes, restaurantes y repartidores falsos del simulador de compras usan Divoox de punta a punta. Esta pantalla se actualiza sola cada 5 segundos.',
    comoArrancar:
      'Para arrancar una sesión del simulador en el sitio de pruebas: GitHub → Actions → «simulador» → Run workflow → modo «ciudad» (pedidos y minutos). En la computadora: npm run simulador:ciudad.',
    sinSesion: 'Todavía no hay ninguna sesión de la ciudad.',
    sesion: 'Sesión',
    estados: { corriendo: 'En curso', parar: 'Parando…', terminada: 'Terminada' } as Record<
      string,
      string
    >,
    parar: 'Parar la sesión',
    pedidoParar: 'Pedido enviado: la sesión termina los pedidos en curso y cierra.',
    meta: (p: number, m: number) => `Hasta ${p} pedidos o ${m} minutos`,
    clientes: 'Clientes comprando',
    restaurantes: 'Restaurantes vendiendo',
    repartidores: 'Repartidores conectados',
    entregados: 'Entregados',
    ventas: 'Ventas entregadas',
    cancelados: 'Cancelados',
    fallos: 'Fallos encontrados',
    sinFallos: 'Ningún fallo en esta sesión.',
    porEstado: 'Pedidos por estado',
    pedidos: 'Últimos pedidos',
    zona: 'Repartidores en la zona',
    restaurante: 'Restaurante',
    estado: 'Estado',
    total: 'Total',
    hora: 'Hora',
    nombre: 'Nombre',
    conectado: 'Conectado',
    ocupado: 'Con pedido',
    libre: 'Libre',
    desconectado: 'Desconectado',
    ultimaSenal: 'Última señal',
    actualizado: 'Actualizado',
    nombresEstado: {
      pago_pendiente: 'Pago pendiente',
      pagado: 'Pagado',
      aceptado: 'Aceptado',
      listo: 'Listo',
      en_camino: 'En camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
    } as Record<string, string>,
    // Modo juego
    juego: 'Modo juego',
    juegoAyuda:
      'Restaurantes y repartidores robot. Una persona pide desde la app del cliente y los robots aceptan, preparan, recogen y entregan mientras esta pantalla está abierta.',
    encender: 'Encender la ciudad',
    apagar: 'Apagar la ciudad',
    encendida: 'Encendida',
    apagada: 'Apagada',
    armando: (n: number, t: number) => `Armando la ciudad… ${n} de ${t} robots`,
    latido: (s: number) => `Hace ${s} s`,
    quieta: 'Quieta: nadie tiene esta pantalla abierta. Los robots esperan.',
    filas: (n: number, t: number) =>
      `${n.toLocaleString('es-US')} de ${t.toLocaleString('es-US')} filas`,
    seApaga: (m: number) => `Se apaga sola a los ${m} minutos o al llegar al tope de filas.`,
    motivoFin: 'Se apagó porque',
    comoJugar: 'Cómo se juega',
    pasos: [
      'Toca «Encender la ciudad» y deja esta pantalla abierta (en la computadora o en el televisor).',
      'En un celular abre la app del cliente del sitio de pruebas y entra con cualquier cuenta de cliente.',
      'Elige uno de los restaurantes «del Robot», arma tu pedido y paga con «Efectivo al recibir»: no hace falta tarjeta.',
      'Mira en el mapa cómo la moto robot lo recoge y te lo lleva. Al final, aquí sale lo que compró cada jugador.',
    ],
    latidoEtiqueta: 'Latido',
    filasEtiqueta: 'Filas escritas de la sesión',
    pantallaGrande: 'Pantalla grande',
    salirGrande: 'Salir de la pantalla grande',
    enCurso: 'Pedidos en curso',
    sinEnCurso: 'Nadie está pidiendo ahora. Pide desde la app del cliente.',
    jugadores: 'Jugadores',
    sinJugadores: 'Todavía no pidió nadie en esta sesión.',
    gastado: 'Gastó',
    minutos: (m: number) => `${m} min`,
    erroresServidor: 'Errores del servidor durante la sesión',
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
  },
  en: {
    titulo: 'Test city',
    ayuda:
      'Simulated customers, restaurants and drivers from the order simulator use Divoox end to end. This page refreshes itself every 5 seconds.',
    comoArrancar:
      'To start a simulator session on the test site: GitHub → Actions → “simulador” → Run workflow → “ciudad” mode (orders and minutes). On the computer: npm run simulador:ciudad.',
    sinSesion: 'There’s no test city session yet.',
    sesion: 'Session',
    estados: { corriendo: 'Running', parar: 'Stopping…', terminada: 'Finished' } as Record<
      string,
      string
    >,
    parar: 'Stop the session',
    pedidoParar: 'Request sent: the session finishes the orders in progress and closes.',
    meta: (p: number, m: number) => `Up to ${p} orders or ${m} minutes`,
    clientes: 'Customers ordering',
    restaurantes: 'Restaurants selling',
    repartidores: 'Drivers online',
    entregados: 'Delivered',
    ventas: 'Delivered sales',
    cancelados: 'Canceled',
    fallos: 'Problems found',
    sinFallos: 'No problems in this session.',
    porEstado: 'Orders by status',
    pedidos: 'Latest orders',
    zona: 'Drivers in the area',
    restaurante: 'Restaurant',
    estado: 'Status',
    total: 'Total',
    hora: 'Time',
    nombre: 'Name',
    conectado: 'Online',
    ocupado: 'On an order',
    libre: 'Available',
    desconectado: 'Offline',
    ultimaSenal: 'Last signal',
    actualizado: 'Updated',
    nombresEstado: {
      pago_pendiente: 'Awaiting payment',
      pagado: 'Paid',
      aceptado: 'Accepted',
      listo: 'Ready',
      en_camino: 'On the way',
      entregado: 'Delivered',
      cancelado: 'Canceled',
    } as Record<string, string>,
    juego: 'Game mode',
    juegoAyuda:
      'Robot restaurants and drivers. A person orders from the customer app and the robots accept, prepare, pick up and deliver while this page is open.',
    encender: 'Turn on the city',
    apagar: 'Turn off the city',
    encendida: 'On',
    apagada: 'Off',
    armando: (n: number, t: number) => `Setting up the city… ${n} of ${t} robots`,
    latido: (s: number) => `${s} s ago`,
    quieta: 'Paused: nobody has this page open. The robots are waiting.',
    filas: (n: number, t: number) =>
      `${n.toLocaleString('en-US')} of ${t.toLocaleString('en-US')} rows`,
    seApaga: (m: number) => `Turns itself off after ${m} minutes or at the row limit.`,
    motivoFin: 'It turned off because',
    comoJugar: 'How to play',
    pasos: [
      'Tap “Turn on the city” and keep this page open (on the computer or the TV).',
      'On a phone, open the customer app on the test site and sign in with any customer account.',
      'Pick one of the “del Robot” restaurants, build your order and pay with “Cash on delivery”: no card needed.',
      'Watch the robot scooter pick it up and bring it to you on the map. At the end, this page shows what each player bought.',
    ],
    latidoEtiqueta: 'Heartbeat',
    filasEtiqueta: 'Rows written this session',
    pantallaGrande: 'Big screen',
    salirGrande: 'Leave big screen',
    enCurso: 'Orders in progress',
    sinEnCurso: 'Nobody is ordering right now. Order from the customer app.',
    jugadores: 'Players',
    sinJugadores: 'Nobody has ordered in this session yet.',
    gastado: 'Spent',
    minutos: (m: number) => `${m} min`,
    erroresServidor: 'Server errors during the session',
    efectivo: 'Cash',
    tarjeta: 'Card',
  },
};

type Fallo = { cuando: string; comportamiento: string; mensaje: string; pedido?: string };
type Jugador = {
  nombre: string;
  gastado: number;
  moneda: string;
  fallos: Fallo[];
  pedidos: {
    id: string;
    estado: string;
    total: number;
    moneda: string;
    metodoPago: string;
    restaurante: string;
    platos: string[];
    creadoEn: string;
    minutos: number | null;
  }[];
};
type EnCurso = {
  id: string;
  estado: string;
  lat: number | null;
  lng: number | null;
  restauranteId: string;
  repartidorId: string | null;
  cliente: string;
};
type Vivo = {
  sesion: {
    id: string;
    estado: string;
    inicio: string;
    fin: string | null;
    meta: { pedidos?: number; minutos?: number };
    fallos: Fallo[];
  } | null;
  porEstado?: Record<string, number>;
  clientesComprando?: number;
  restaurantesVendiendo?: number;
  ventas?: { entregados: number; total: number; moneda: string; cancelados: number };
  pedidos?: {
    id: string;
    estado: string;
    total: number;
    moneda: string;
    restaurante: string;
    creadoEn: string;
  }[];
  restaurantes?: { id: string; nombre: string; lat: number; lng: number; abierto: number }[];
  repartidores?: {
    id: string;
    nombre: string;
    conectado: boolean;
    ocupado: boolean;
    lat: number | null;
    lng: number | null;
    ubicacionEn: string | null;
  }[];
  juego?: {
    encendida: boolean;
    segundosSinLatido: number | null;
    quieta: boolean;
    filas: { sesion: number; tope: number };
    minutosMax: number;
    robots: { listos: number; total: number };
    motivoFin: string | null;
  };
  enCurso?: EnCurso[];
  jugadores?: Jugador[];
  erroresServidor?: { metodo: string; ruta: string; mensaje: string; creadoEn: string }[];
};

const ORDEN = [
  'pago_pendiente',
  'pagado',
  'aceptado',
  'listo',
  'en_camino',
  'entregado',
  'cancelado',
];
/** Cada cuánto late la pantalla con la ciudad encendida (los robots avanzan un paso). */
export const LATIDO_MS = 4_000;

/** Hora local de una fecha de la base (UTC, «AAAA-MM-DD HH:MM:SS» o ISO). */
const hora = (x: string | null | undefined, idioma: Idioma = 'es') => {
  if (!x) return '—';
  const d = new Date(x.includes('T') ? x : `${x.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
};

export function SuperCiudad({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [vivo, setVivo] = useState<Vivo | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [cuando, setCuando] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [grande, setGrande] = useState(false);
  const raiz = useRef<HTMLElement | null>(null);
  const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));
  const cargar = useCallback(async () => {
    try {
      const r = await pedir<Vivo>('GET', '/datos/admin/ciudad-pruebas');
      setVivo(r);
      setError('');
      setCuando(new Date().toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es-US'));
      return r;
    } catch (x) {
      setError(mensaje(x));
      return null;
    }
  }, [idioma]);

  const s = vivo?.sesion ?? null;
  const juego = vivo?.juego ?? null;
  const esJuego = Boolean(juego);
  const late = Boolean(
    s && juego?.encendida && juego.robots.listos >= juego.robots.total && !trabajando,
  );

  // Mirar: solo GET. Con la ciudad de juego encendida, un latido antes de cada mirada.
  useEffect(() => {
    let vivoEfecto = true;
    let ocupado = false;
    const vuelta = async () => {
      if (ocupado) return;
      ocupado = true;
      try {
        if (late && s) {
          const r = await pedir<{ estado: string; motivo?: string }>(
            'POST',
            '/datos/admin/ciudad-pruebas/latido',
            { sesion: s.id },
          ).catch((x: unknown) => {
            if (vivoEfecto) setError(mensaje(x));
            return null;
          });
          if (r?.motivo && vivoEfecto) setAviso(`${t.motivoFin} ${r.motivo}.`);
        }
        if (vivoEfecto) await cargar();
      } finally {
        ocupado = false;
      }
    };
    if (!late) void vuelta();
    const id = window.setInterval(() => void vuelta(), late ? LATIDO_MS : 5_000);
    return () => {
      vivoEfecto = false;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar, late, s?.id]);

  async function parar() {
    if (!s) return;
    try {
      await pedir('POST', '/datos/admin/ciudad-pruebas/parar', { sesion: s.id });
      setAviso(t.pedidoParar);
      await cargar();
    } catch (x) {
      setError(mensaje(x));
    }
  }

  /** Encender arma un robot por llamada: se llama hasta que estén todos. */
  async function encender() {
    setTrabajando(true);
    setAviso('');
    setError('');
    try {
      for (let i = 0; i < 12; i++) {
        const r = await pedir<{ sesion: string; listos: number; total: number }>(
          'POST',
          '/datos/admin/ciudad-pruebas/encender',
          {},
        );
        setAviso(t.armando(r.listos, r.total));
        if (r.listos >= r.total) break;
      }
      setAviso('');
      await cargar();
    } catch (x) {
      setError(mensaje(x));
      await cargar();
    } finally {
      setTrabajando(false);
    }
  }

  async function apagar() {
    if (!s) return;
    setTrabajando(true);
    try {
      await pedir('POST', '/datos/admin/ciudad-pruebas/apagar', { sesion: s.id });
      await cargar();
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setTrabajando(false);
    }
  }

  function alternarGrande() {
    const nuevo = !grande;
    setGrande(nuevo);
    // En el televisor, además, pantalla completa del navegador (si lo permite).
    try {
      if (nuevo) void raiz.current?.requestFullscreen?.().catch(() => undefined);
      else if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    } catch {
      // Sin pantalla completa del navegador la vista grande igual ocupa toda la ventana.
    }
  }

  const reps = vivo?.repartidores ?? [];
  const conectados = reps.filter((r) => r.conectado).length;
  const nombreEstado = (e: string) => new Map(Object.entries(t.nombresEstado)).get(e) ?? e;
  const encendida = Boolean(esJuego && juego?.encendida);
  const enCurso = vivo?.enCurso ?? [];
  const mapa = (
    <MapaCiudad
      restaurantes={vivo?.restaurantes ?? []}
      repartidores={reps}
      enCurso={enCurso}
      etiquetaLibre={t.libre}
      etiquetaOcupado={t.ocupado}
      grande={grande}
    />
  );

  return (
    <section
      ref={raiz}
      className={`super ciudad-pruebas${grande ? ' ciudad-tv' : ''}`}
      data-testid="super-ciudad"
    >
      {grande ? (
        <>
          <div className="ciudad-tv-mapa">{mapa}</div>
          <aside className="ciudad-tv-lista">
            <div className="ciudad-tv-cabecera">
              <h1>{t.titulo}</h1>
              <button type="button" className="boton secundario" onClick={alternarGrande}>
                {t.salirGrande}
              </button>
            </div>
            <p className={encendida ? 'ciudad-bien' : 'pista'}>
              <strong>{encendida ? t.encendida : t.apagada}</strong>
            </p>
            <h2>{t.enCurso}</h2>
            {enCurso.length === 0 ? <p className="pista">{t.sinEnCurso}</p> : null}
            <ul className="ciudad-tv-pedidos">
              {enCurso.map((p) => (
                <li key={p.id}>
                  <span>
                    {p.cliente} ·{' '}
                    {vivo?.restaurantes?.find((r) => r.id === p.restauranteId)?.nombre ?? ''}
                  </span>
                  <strong className={p.estado === 'en_camino' ? 'ciudad-bien' : undefined}>
                    {nombreEstado(p.estado)}
                  </strong>
                </li>
              ))}
            </ul>
          </aside>
        </>
      ) : (
        <>
          <h1>{t.titulo}</h1>
          <p className="pista">{t.ayuda}</p>
          {error ? (
            <p className="error-general" role="alert">
              {error}
            </p>
          ) : null}
          {aviso ? (
            <p className="texto-exito" role="status">
              {aviso}
            </p>
          ) : null}

          <div className="ciudad-juego" data-testid="ciudad-juego">
            <div className="ciudad-cabecera">
              <div>
                <h2>{t.juego}</h2>
                <p className="pista">{t.juegoAyuda}</p>
              </div>
              <div className="ciudad-botones">
                {encendida ? (
                  <>
                    {/* Si el armado se cortó a la mitad, «Encender» sigue desde donde quedó. */}
                    {juego && juego.robots.listos < juego.robots.total ? (
                      <button
                        type="button"
                        className="boton"
                        onClick={() => void encender()}
                        disabled={trabajando}
                      >
                        {t.encender}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="boton"
                        onClick={alternarGrande}
                        disabled={trabajando}
                      >
                        {t.pantallaGrande}
                      </button>
                    )}
                    <button
                      type="button"
                      className="boton secundario"
                      onClick={() => void apagar()}
                      disabled={trabajando}
                    >
                      {t.apagar}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="boton"
                    onClick={() => void encender()}
                    disabled={trabajando}
                  >
                    {t.encender}
                  </button>
                )}
              </div>
            </div>
            {juego ? (
              <ul className="ciudad-estados" aria-label={t.juego}>
                <li className={encendida ? 'ciudad-bien' : undefined}>
                  <span>{t.estado}</span>
                  <strong>{encendida ? t.encendida : t.apagada}</strong>
                </li>
                {encendida && juego.robots.listos < juego.robots.total ? (
                  <li>
                    <span>{t.juego}</span>
                    <strong>{t.armando(juego.robots.listos, juego.robots.total)}</strong>
                  </li>
                ) : null}
                {encendida && juego.segundosSinLatido != null ? (
                  <li>
                    <span>{t.latidoEtiqueta}</span>
                    <strong>{t.latido(juego.segundosSinLatido)}</strong>
                  </li>
                ) : null}
                <li>
                  <span>{t.filasEtiqueta}</span>
                  <strong>{t.filas(juego.filas.sesion, juego.filas.tope)}</strong>
                </li>
              </ul>
            ) : null}
            {juego?.quieta ? <p className="pista">{t.quieta}</p> : null}
            {encendida ? <p className="pista">{t.seApaga(juego?.minutosMax ?? 60)}</p> : null}
            {juego && !juego.encendida && juego.motivoFin ? (
              <p className="pista">
                {t.motivoFin} {juego.motivoFin}.
              </p>
            ) : null}
            <details className="ciudad-como" open={!esJuego}>
              <summary>{t.comoJugar}</summary>
              <ol>
                {t.pasos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </details>
          </div>

          {vivo && !s ? (
            <>
              <p>{t.sinSesion}</p>
              <p className="pista">{t.comoArrancar}</p>
            </>
          ) : null}
          {s ? (
            <>
              <div className="ciudad-cabecera">
                <p className="ciudad-sesion">
                  <strong>
                    {t.sesion} {s.id}
                  </strong>{' '}
                  ·{' '}
                  <span className={`ciudad-estado ciudad-estado-${s.estado}`}>
                    {new Map(Object.entries(t.estados)).get(s.estado) ?? s.estado}
                  </span>
                  {esJuego ? null : ` · ${t.meta(s.meta.pedidos ?? 0, s.meta.minutos ?? 0)}`} ·{' '}
                  {t.actualizado} {cuando}
                </p>
                {s.estado === 'corriendo' && !esJuego ? (
                  <button type="button" className="boton secundario" onClick={() => void parar()}>
                    {t.parar}
                  </button>
                ) : null}
              </div>
              <ul className="super-tarjetas" aria-label={t.titulo}>
                <li className="super-tarjeta">
                  <span>{t.clientes}</span>
                  <strong>{vivo?.clientesComprando ?? 0}</strong>
                </li>
                <li className="super-tarjeta">
                  <span>{t.restaurantes}</span>
                  <strong>{vivo?.restaurantesVendiendo ?? 0}</strong>
                </li>
                <li className="super-tarjeta">
                  <span>{t.repartidores}</span>
                  <strong>
                    {conectados} / {reps.length}
                  </strong>
                </li>
                <li className="super-tarjeta">
                  <span>{t.entregados}</span>
                  <strong className="ciudad-bien">{vivo?.ventas?.entregados ?? 0}</strong>
                </li>
                <li className="super-tarjeta">
                  <span>{t.ventas}</span>
                  <strong className="ciudad-bien">
                    {formatearMonto(
                      vivo?.ventas?.total ?? 0,
                      vivo?.ventas?.moneda ?? 'USD',
                      idioma,
                    )}
                  </strong>
                </li>
                <li className="super-tarjeta">
                  <span>{t.cancelados}</span>
                  <strong>{vivo?.ventas?.cancelados ?? 0}</strong>
                </li>
                <li className={`super-tarjeta ${s.fallos.length ? 'super-tarjeta-alerta' : ''}`}>
                  <span>{t.fallos}</span>
                  <strong>{s.fallos.length}</strong>
                </li>
              </ul>

              {esJuego ? (
                <>
                  <h2>{t.jugadores}</h2>
                  {(vivo?.jugadores ?? []).length === 0 ? (
                    <p className="pista">{t.sinJugadores}</p>
                  ) : (
                    <ul className="ciudad-jugadores" data-testid="ciudad-jugadores">
                      {(vivo?.jugadores ?? []).map((j) => (
                        <li key={j.nombre} className="ciudad-jugador">
                          <div className="ciudad-cabecera">
                            <strong>{j.nombre}</strong>
                            <span className="ciudad-bien">
                              {t.gastado} {formatearMonto(j.gastado, j.moneda, idioma)}
                            </span>
                          </div>
                          <ul className="lista">
                            {j.pedidos.map((p) => (
                              <li key={p.id}>
                                <div className="lista-texto">
                                  <strong>
                                    {hora(p.creadoEn, idioma)} · {p.restaurante} ·{' '}
                                    <span
                                      className={
                                        p.estado === 'entregado' ? 'ciudad-bien' : undefined
                                      }
                                    >
                                      {nombreEstado(p.estado)}
                                    </span>
                                  </strong>
                                  <span>
                                    {p.platos.join(', ')} ·{' '}
                                    {formatearMonto(p.total, p.moneda, idioma)} ·{' '}
                                    {p.metodoPago === 'tarjeta' ? t.tarjeta : t.efectivo}
                                    {p.minutos != null ? ` · ${t.minutos(p.minutos)}` : ''}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                          {j.fallos.length ? (
                            <ul className="lista ciudad-fallos">
                              {j.fallos.map((f, i) => (
                                <li key={`${f.cuando}-${i}`}>
                                  <div className="lista-texto">
                                    <strong>{f.comportamiento}</strong>
                                    <span>{f.mensaje}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              ) : null}

              <h2>{t.porEstado}</h2>
              <ul className="ciudad-estados">
                {ORDEN.map((e) => (
                  <li key={e} className={e === 'entregado' ? 'ciudad-bien' : undefined}>
                    <span>{nombreEstado(e)}</span>
                    <strong>{new Map(Object.entries(vivo?.porEstado ?? {})).get(e) ?? 0}</strong>
                  </li>
                ))}
              </ul>

              <h2>{t.zona}</h2>
              {mapa}
              <div className="tabla-ancha">
                <table className="tabla tabla-apilada">
                  <thead>
                    <tr>
                      <th>{t.nombre}</th>
                      <th>{t.estado}</th>
                      <th>{t.ultimaSenal}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((r) => (
                      <tr key={r.id}>
                        <td data-etiqueta={t.nombre}>{r.nombre}</td>
                        <td data-etiqueta={t.estado}>
                          {!r.conectado ? t.desconectado : r.ocupado ? t.ocupado : t.libre}
                        </td>
                        <td data-etiqueta={t.ultimaSenal}>{hora(r.ubicacionEn, idioma)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2>{t.fallos}</h2>
              {s.fallos.length === 0 ? (
                <p className="texto-exito">{t.sinFallos}</p>
              ) : (
                <ul className="lista ciudad-fallos">
                  {[...s.fallos].reverse().map((f, i) => (
                    <li key={`${f.cuando}-${i}`}>
                      <div className="lista-texto">
                        <strong>{f.comportamiento}</strong>
                        <span>
                          {hora(f.cuando, idioma)} · {f.mensaje}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {(vivo?.erroresServidor ?? []).length ? (
                <>
                  <h2>{t.erroresServidor}</h2>
                  <ul className="lista ciudad-fallos">
                    {(vivo?.erroresServidor ?? []).map((e, i) => (
                      <li key={`${e.creadoEn}-${i}`}>
                        <div className="lista-texto">
                          <strong>
                            {e.metodo} {e.ruta}
                          </strong>
                          <span>
                            {hora(e.creadoEn, idioma)} · {e.mensaje}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <h2>{t.pedidos}</h2>
              <div className="tabla-ancha">
                <table className="tabla tabla-apilada">
                  <thead>
                    <tr>
                      <th>{t.hora}</th>
                      <th>{t.restaurante}</th>
                      <th>{t.estado}</th>
                      <th>{t.total}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(vivo?.pedidos ?? []).map((p) => (
                      <tr key={p.id}>
                        <td data-etiqueta={t.hora}>{hora(p.creadoEn, idioma)}</td>
                        <td data-etiqueta={t.restaurante}>{p.restaurante}</td>
                        <td
                          data-etiqueta={t.estado}
                          className={p.estado === 'entregado' ? 'ciudad-bien' : undefined}
                        >
                          {nombreEstado(p.estado)}
                        </td>
                        <td data-etiqueta={t.total}>{formatearMonto(p.total, p.moneda, idioma)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="pista">{t.comoArrancar}</p>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

/** Una moto vista desde arriba, en SVG (sin emojis). */
const MOTO = (color: string) =>
  `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="#fff" stroke="${color}" stroke-width="2"/><circle cx="9" cy="20" r="3.2" fill="none" stroke="${color}" stroke-width="2"/><circle cx="23" cy="20" r="3.2" fill="none" stroke="${color}" stroke-width="2"/><path d="M9 20 L14 13 L19 13 L23 20 M14 13 L12 10 M19 13 L21 9 L24 9" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`;

/**
 * El mapa de la zona (la misma pieza Leaflet del panel): restaurantes, repartidores y, en el juego,
 * a dónde va cada pedido. Las motos se deslizan de una posición a la siguiente entre latidos.
 */
function MapaCiudad({
  restaurantes,
  repartidores,
  enCurso,
  etiquetaLibre,
  etiquetaOcupado,
  grande,
}: {
  restaurantes: NonNullable<Vivo['restaurantes']>;
  repartidores: NonNullable<Vivo['repartidores']>;
  enCurso: EnCurso[];
  etiquetaLibre: string;
  etiquetaOcupado: string;
  grande: boolean;
}) {
  const caja = useRef<HTMLDivElement | null>(null);
  const mapa = useRef<import('leaflet').Map | null>(null);
  const capa = useRef<import('leaflet').LayerGroup | null>(null);
  const motos = useRef(new Map<string, import('leaflet').Marker>());
  const L = useRef<typeof import('leaflet') | null>(null);
  const [listo, setListo] = useState(false);
  const encuadrado = useRef(false);
  const centro = restaurantes[0];

  useEffect(() => {
    if (!caja.current || mapa.current || !centro) return;
    let vivo = true;
    void (async () => {
      const leaflet = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      if (!vivo || !caja.current || typeof leaflet.map !== 'function') return;
      L.current = leaflet;
      const m = leaflet.map(caja.current).setView([centro.lat, centro.lng], 14);
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        })
        .addTo(m);
      capa.current = leaflet.layerGroup().addTo(m);
      mapa.current = m;
      // La caja termina de tomar su tamaño después de pintar: sin esto quedan cuadros grises.
      window.setTimeout(() => m.invalidateSize(), 200);
      setListo(true);
    })();
    return () => {
      vivo = false;
    };
  }, [centro]);

  // Al pasar a la pantalla grande (o volver), el mapa cambia de tamaño.
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    const id = window.setTimeout(() => {
      m.invalidateSize();
      encuadrado.current = false;
    }, 250);
    return () => window.clearTimeout(id);
  }, [grande]);

  useEffect(() => {
    const leaflet = L.current;
    const g = capa.current;
    if (!listo || !leaflet || !g) return;
    g.clearLayers();
    for (const r of restaurantes)
      leaflet
        .circleMarker([r.lat, r.lng], { radius: 9, color: '#101010', weight: 2, fillOpacity: 0.9 })
        .bindTooltip(r.nombre, { permanent: grande, direction: 'top' })
        .addTo(g);
    // A dónde va cada pedido: la casa del jugador.
    for (const p of enCurso) {
      if (p.lat == null || p.lng == null) continue;
      leaflet
        .marker([p.lat, p.lng], {
          icon: leaflet.divIcon({
            className: 'ciudad-casa',
            html: '<span></span>',
            iconSize: [18, 18],
          }),
        })
        .bindTooltip(p.cliente, { permanent: grande, direction: 'right' })
        .addTo(g);
    }
    // Las motos: cada una se desliza desde donde estaba hasta su posición nueva.
    const vistas = new Set<string>();
    for (const d of repartidores) {
      if (!d.conectado || d.lat == null || d.lng == null) continue;
      vistas.add(d.id);
      // Libre en verde (listo para trabajar); con pedido en el azul de logística (el rojo es
      // solo para problemas).
      const color = d.ocupado ? '#1F4D69' : '#0d7a3a';
      const icono = leaflet.divIcon({
        className: 'ciudad-moto',
        html: MOTO(color),
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const texto = `${d.nombre} · ${d.ocupado ? etiquetaOcupado : etiquetaLibre}`;
      const ya = motos.current.get(d.id);
      if (!ya) {
        const mk = leaflet
          .marker([d.lat, d.lng], { icon: icono })
          .bindTooltip(texto)
          .addTo(mapa.current!);
        motos.current.set(d.id, mk);
        continue;
      }
      ya.setIcon(icono);
      ya.setTooltipContent(texto);
      deslizar(ya, d.lat, d.lng);
    }
    for (const [id, mk] of motos.current)
      if (!vistas.has(id)) {
        mk.remove();
        motos.current.delete(id);
      }
    // Que se vean todos: el encuadre sigue a la gente de la ciudad.
    const puntos = [
      ...restaurantes.map((r) => [r.lat, r.lng] as [number, number]),
      ...repartidores
        .filter((d) => d.conectado && d.lat != null && d.lng != null)
        .map((d) => [d.lat as number, d.lng as number] as [number, number]),
      ...enCurso
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => [p.lat as number, p.lng as number] as [number, number]),
    ];
    if (puntos.length > 1 && !encuadrado.current) {
      mapa.current?.invalidateSize();
      mapa.current?.fitBounds(puntos, { padding: [32, 32], maxZoom: 16 });
      encuadrado.current = true;
    }
  }, [listo, restaurantes, repartidores, enCurso, etiquetaLibre, etiquetaOcupado, grande]);

  return (
    <div
      ref={caja}
      className={`ciudad-mapa${grande ? ' ciudad-mapa-grande' : ''}`}
      role="img"
      aria-label="mapa"
    />
  );
}

/** Mueve el marcador hasta el punto nuevo en lo que dura un latido (suave, sin saltos). */
function deslizar(mk: import('leaflet').Marker, lat: number, lng: number) {
  const desde = mk.getLatLng();
  if (desde.lat === lat && desde.lng === lng) return;
  const inicio = performance.now();
  const dura = LATIDO_MS - 300;
  const paso = (ahora: number) => {
    const f = Math.min(1, (ahora - inicio) / dura);
    mk.setLatLng([desde.lat + (lat - desde.lat) * f, desde.lng + (lng - desde.lng) * f]);
    if (f < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
