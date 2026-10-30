import { useCallback, useEffect, useRef, useState } from 'react';
import { Icono } from '../sitio/Icono';
import {
  ErrorApi,
  type Idioma,
  enIdioma,
  formatearMonto,
  type RepartidorEnPedido,
  avisoLlegada,
  fotoSinConfirmar,
  lineaRepartidor,
  notaSustitucion,
  deSqlUtc,
  puedeMarcarFalta,
  textoFranja,
  textoLinea,
  type OpcionElegida,
} from '@tumbite/compartido';
import { MenuTresPuntos } from './MenuTresPuntos';
import { ReportarPanel } from './ReportarPanel';
import { LuzSemaforo } from './LuzSemaforo';
import QRCode from 'qrcode';
import { pedir } from './api';
import { useModoTableta } from './modoTableta';
import { imprimirComanda } from './comanda';

/** C-COMANDA: la preferencia vive en este navegador (cada tableta o computadora decide). */
const LLAVE_IMPRIMIR = 'divoox.imprimirAlAceptar';
const leerImprimir = () => {
  try {
    return localStorage.getItem(LLAVE_IMPRIMIR) === '1';
  } catch {
    return false;
  }
};

type Pedido = {
  id: string;
  estado: string;
  /** C-PEDIDO-PROGRAMADO: inicio de la franja (UTC) o null. */
  programadoPara?: string | null;
  entrega?: 'puerta' | 'mano' | 'recoger';
  requiereEdad?: boolean;
  subtotal: number;
  /** C-MONEDA-RECORRIDO: la moneda del pedido. */
  moneda?: string;
  notas: string;
  creadoEn: string;
  pagadoEn: string | null;
  aceptadoEn: string | null;
  listoEn: string | null;
  recogidoEn: string | null;
  tiempoPrepMin: number | null;
  fotoRecogida?: { tomadaEn: string; confirmadaEn: string | null } | null;
  repartidor?: RepartidorEnPedido | null;
  ajuste?: {
    platoId: string;
    nombreEs: string;
    nombreEn: string;
    estado: 'pendiente' | 'quitado' | 'cancelado';
    devolucion: number | null;
    creadoEn: string;
  } | null;
  lineas: {
    platoId: string;
    nombreEs: string;
    nombreEn: string;
    cantidad: number;
    opciones?: OpcionElegida[];
    sustitucion?: string;
  }[];
};

const T = {
  es: {
    titulo: 'Pedidos',
    activar: 'Activar sonido de alarma',
    sonidoOk: 'Alarma activada',
    tableta: 'Modo tableta',
    tabletaAyuda: 'Pantalla completa y siempre encendida, con la alarma.',
    salirTableta: 'Salir del modo tableta',
    vacio: 'Sin pedidos por ahora.',
    aceptar: 'Aceptar',
    imprimir: 'Imprimir comanda',
    imprimirAlAceptar: 'Imprimir la comanda al aceptar',
    recoge: 'El cliente lo recoge en el local (sin repartidor)',
    pinCliente: 'PIN del cliente (4 dígitos, está en su app)',
    mayorEdad: 'Revisé el documento: quien recibe es mayor de 21',
    entregadoLocal: 'Entregado al cliente',
    sugerido: 'sugerido',
    cocina: 'Cocina ocupada',
    cocinaAyuda: 'Suma minutos al tiempo sugerido de los pedidos nuevos.',
    aceptarSolo: 'Aceptar pedidos automáticamente',
    aceptarSoloAyuda:
      'Los pedidos nuevos se aceptan solos con el tiempo sugerido y el repartidor sale enseguida. Igual suena la alarma.',
    normal: 'Normal',
    min: 'min',
    listo: '¡Listo!',
    rechazar: 'Rechazar pedido',
    reportar: 'Reportar un problema',
    confirmar: '¿Rechazar este pedido? Se le devuelve todo el dinero al cliente.',
    mas: 'Más opciones',
    notas: 'Notas',
    esperandoFoto: 'Esperando que el repartidor tome la foto del pedido en su app.',
    sinConfirmar: 'La foto lleva más de 2 minutos sin confirmar. El repartidor te está esperando.',
    faltaPlato: 'Me falta un plato',
    faltaProducto: 'Falta un producto',
    programado: 'Programado',
    cualFalta:
      '¿Cuál plato no tienes? Al cliente le avisamos y decide: quitarlo (se le devuelve esa parte) o cancelar todo.',
    avisarFalta: 'Avisar al cliente',
    reemplazos:
      'Propón hasta 3 reemplazos de tu tienda (el cliente nunca paga más que el original):',
    buscarReemplazo: 'Buscar un producto',
    esperandoCliente:
      'Avisamos al cliente que no tienes «{plato}». Esperando su respuesta (máximo 5 minutos)…',
    quitado: 'El cliente quitó «{plato}». Prepara el resto.',
    masTiempo: '+5 min',
    masTiempoAyuda: 'Puedes subir el tiempo mientras no haya salido un repartidor.',
    qrAyuda:
      'Muéstrale este código al repartidor: lo escanea desde su app y así confirma que es su pedido.',
    verificado:
      'Código verificado por el repartidor. Cuando tome la foto de la bolsa, el pedido sale solo.',
    fotoDelRepartidor: 'Foto que tomó el repartidor',
    confirmarRecogida: 'Confirmar: se lo entregué al repartidor',
    ayudaConfirmar:
      'Revisa que sea tu pedido y confirma. Recién ahí sale en camino y el cliente ve la foto.',
    estados: {
      pagado: 'Nuevo',
      aceptado: 'Preparando',
      listo: 'Listo para recoger',
      en_camino: 'En camino',
      entregado: 'Entregado',
      cancelado: 'Cancelado',
    } as Record<string, string>,
  },
  en: {
    titulo: 'Orders',
    activar: 'Turn on alarm sound',
    sonidoOk: 'Alarm on',
    tableta: 'Tablet mode',
    tabletaAyuda: 'Full screen and always on, with the alarm.',
    salirTableta: 'Exit tablet mode',
    vacio: 'No orders right now.',
    aceptar: 'Accept',
    imprimir: 'Print ticket',
    imprimirAlAceptar: 'Print the ticket when accepting',
    recoge: 'Customer picks up in store (no driver)',
    pinCliente: 'Customer PIN (4 digits, in their app)',
    mayorEdad: 'I checked the ID: the recipient is 21 or older',
    entregadoLocal: 'Handed to the customer',
    sugerido: 'suggested',
    cocina: 'Busy kitchen',
    cocinaAyuda: 'Adds minutes to the suggested time for new orders.',
    aceptarSolo: 'Accept orders automatically',
    aceptarSoloAyuda:
      'New orders are accepted with the suggested time and a driver is sent right away. The alarm still rings.',
    normal: 'Normal',
    min: 'min',
    listo: 'Ready!',
    rechazar: 'Reject order',
    reportar: 'Report a problem',
    confirmar: 'Reject this order? The customer gets a full refund.',
    mas: 'More options',
    notas: 'Notes',
    esperandoFoto: 'Waiting for the driver to take a photo of the order in their app.',
    sinConfirmar: 'The photo has been waiting over 2 minutes. The driver is waiting on you.',
    faltaPlato: 'I’m out of an item',
    faltaProducto: 'An item is missing',
    programado: 'Scheduled',
    cualFalta:
      'Which item are you out of? We notify the customer and they decide: remove it (that part is refunded) or cancel everything.',
    avisarFalta: 'Notify the customer',
    reemplazos:
      'Suggest up to 3 replacements from your store (the customer never pays more than the original):',
    buscarReemplazo: 'Search a product',
    esperandoCliente:
      'We told the customer you’re out of “{plato}”. Waiting for their answer (up to 5 minutes)…',
    quitado: 'The customer removed “{plato}”. Prepare the rest.',
    masTiempo: '+5 min',
    masTiempoAyuda: 'You can add time as long as no driver has left yet.',
    qrAyuda:
      'Show this code to the driver: they scan it from their app to confirm it’s their order.',
    verificado:
      'Code verified by the driver. Once they photograph the bag, the order goes out on its own.',
    fotoDelRepartidor: 'Photo taken by the driver',
    confirmarRecogida: 'Confirm: I handed it to the driver',
    ayudaConfirmar:
      'Check that it’s your order and confirm. Only then does it go out, and the customer sees the photo.',
    estados: {
      pagado: 'New',
      aceptado: 'Preparing',
      listo: 'Ready for pickup',
      en_camino: 'On the way',
      entregado: 'Delivered',
      cancelado: 'Canceled',
    } as Record<string, string>,
  },
};

export function Pedidos({ idioma }: { idioma: Idioma }) {
  const [reportando, setReportando] = useState<string | null>(null);
  // «Me falta un plato»: el pedido donde se está eligiendo el plato.
  const [faltando, setFaltando] = useState<string | null>(null);
  const [platoFalta, setPlatoFalta] = useState('');
  // C-TIENDAS-REEMPLAZOS: búsqueda en el catálogo propio y hasta tres reemplazos elegidos.
  const [buscaReemplazo, setBuscaReemplazo] = useState('');
  const [encontrados, setEncontrados] = useState<
    { id: string; nombreEs: string; nombreEn: string; disponible: boolean }[]
  >([]);
  const [propuestas, setPropuestas] = useState<string[]>([]);
  useEffect(() => {
    if (!faltando || buscaReemplazo.trim().length < 2) return;
    const reloj = setTimeout(() => {
      pedir<{ productos: typeof encontrados }>(
        'GET',
        `/datos/mi-restaurante/productos?q=${encodeURIComponent(buscaReemplazo.trim())}`,
      )
        .then((r) => setEncontrados(r.productos.filter((x) => x.disponible).slice(0, 8)))
        .catch(() => setEncontrados([]));
    }, 300);
    return () => clearTimeout(reloj);
  }, [faltando, buscaReemplazo]);
  const t = enIdioma(T, idioma);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cocina, setCocina] = useState({ prepSugerida: 20, cocinaOcupada: 0 });
  // C-ACEPTAR-SOLO: null mientras carga (no se pinta un interruptor que no se sabe cómo está).
  const [aceptarSolo, setAceptarSolo] = useState<boolean | null>(null);
  useEffect(() => {
    pedir<{ restaurante: { aceptarSolo?: boolean } }>('GET', '/datos/mi-restaurante')
      .then((r) => setAceptarSolo(Boolean(r.restaurante.aceptarSolo)))
      .catch(() => setAceptarSolo(null));
  }, []);
  const [pinLocal, setPinLocal] = useState<Record<string, string>>({});
  const [edadLocal, setEdadLocal] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [sonido, setSonido] = useState(false);
  // Los códigos QR de los pedidos listos (uno por pedido, dibujados una sola vez).
  const [qrs, setQrs] = useState<Record<string, string>>({});
  const audio = useRef<HTMLAudioElement | null>(null);
  const tableta = useModoTableta();

  const cargar = useCallback(async () => {
    try {
      const r = await pedir<{ pedidos: Pedido[]; prepSugerida: number; cocinaOcupada: number }>(
        'GET',
        '/datos/restaurante/pedidos',
      );
      setPedidos(r.pedidos);
      setCocina({ prepSugerida: r.prepSugerida, cocinaOcupada: r.cocinaOcupada });
      setError('');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }, []);

  useEffect(() => {
    const primero = setTimeout(() => void cargar(), 0);
    const reloj = setInterval(() => void cargar(), 5000);
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
    };
  }, [cargar]);

  useEffect(() => {
    for (const p of pedidos) {
      if (p.estado !== 'listo' || qrs[p.id]) continue;
      void QRCode.toDataURL(`tumbite:pedido:${p.id}`, { margin: 1, width: 180 }).then((url) =>
        setQrs((q) => (q[p.id] ? q : { ...q, [p.id]: url })),
      );
    }
  }, [pedidos, qrs]);
  // Mientras el cliente decide sobre un plato agotado, el pedido no cuenta como «nuevo sin atender».
  const hayNuevos = pedidos.some((p) => p.estado === 'pagado' && p.ajuste?.estado !== 'pendiente');
  // Amarillo con alarma: la foto del repartidor lleva más de 2 minutos sin confirmar.
  const hayUrgente = pedidos.some((p) => fotoSinConfirmar(p));
  useEffect(() => {
    const a = audio.current;
    if (!a || !sonido) return;
    if (hayNuevos || hayUrgente) void a.play().catch(() => undefined);
    else a.pause();
  }, [hayNuevos, hayUrgente, sonido]);
  // Un sonido corto, una sola vez por pedido, cuando el repartidor está a 5 minutos y cuando llega.
  const avisados = useRef(new Set<string>());
  useEffect(() => {
    if (!sonido) return;
    for (const p of pedidos) {
      const aviso = avisoLlegada(p.repartidor);
      if (!aviso) continue;
      const clave = `${p.id}:${aviso}`;
      if (avisados.current.has(clave)) continue;
      avisados.current.add(clave);
      void new Audio('/alarma.wav').play().catch(() => undefined);
    }
  }, [pedidos, sonido]);

  function activarSonido() {
    // Los navegadores solo dejan sonar después de un toque de la persona.
    const a = new Audio('/alarma.wav');
    a.loop = true;
    audio.current = a;
    setSonido(true);
  }

  const [imprimirAlAceptar, setImprimirAlAceptar] = useState(leerImprimir);
  async function accion(ruta: string, cuerpo: unknown = {}) {
    try {
      await pedir('POST', ruta, cuerpo);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <section>
      <div className="titulo-fila">
        <h1>{t.titulo}</h1>
        <label className="campo-check">
          <input
            type="checkbox"
            checked={imprimirAlAceptar}
            onChange={(ev) => {
              setImprimirAlAceptar(ev.target.checked);
              try {
                localStorage.setItem(LLAVE_IMPRIMIR, ev.target.checked ? '1' : '0');
              } catch {
                /* sin almacén en este navegador: vale solo mientras la página esté abierta */
              }
            }}
          />{' '}
          {t.imprimirAlAceptar}
        </label>
        {tableta.activo ? (
          <button type="button" className="boton secundario" onClick={() => void tableta.salir()}>
            {t.salirTableta}
          </button>
        ) : (
          <button
            type="button"
            className="boton"
            title={t.tabletaAyuda}
            onClick={() => {
              if (!sonido) activarSonido();
              void tableta.entrar();
            }}
          >
            {t.tableta}
          </button>
        )}
        {sonido ? (
          <span className="ok">
            <Icono nombre="alarma" tamano={18} /> {t.sonidoOk}
          </span>
        ) : (
          <button type="button" className="boton" onClick={activarSonido}>
            <Icono nombre="alarma" tamano={18} /> {t.activar}
          </button>
        )}
      </div>
      {error && <p className="error-general">{error}</p>}
      <div className="cocina" aria-label={t.cocina}>
        <strong>{t.cocina}</strong>
        <span className="suave"> {t.cocinaAyuda}</span>
        <div className="cocina-opciones">
          {[0, 10, 20].map((min) => (
            <button
              key={min}
              type="button"
              className={cocina.cocinaOcupada === min ? 'boton chico' : 'boton secundario chico'}
              aria-pressed={cocina.cocinaOcupada === min}
              onClick={() =>
                void pedir<{ prepSugerida: number; cocinaOcupada: number }>(
                  'PATCH',
                  '/datos/restaurante/cocina',
                  { extraMin: min },
                )
                  .then(setCocina)
                  .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)))
              }
            >
              {min ? `+${min} ${t.min}` : t.normal}
            </button>
          ))}
        </div>
      </div>
      {aceptarSolo !== null ? (
        <label className="cocina flex-check">
          <input
            type="checkbox"
            aria-label={t.aceptarSolo}
            checked={aceptarSolo}
            onChange={(e) => {
              const activo = e.target.checked;
              setAceptarSolo(activo);
              void pedir('PATCH', '/datos/mi-restaurante/aceptar-solo', { activo }).catch(
                (x: unknown) => {
                  setAceptarSolo(!activo);
                  setError(x instanceof ErrorApi ? x.message : String(x));
                },
              );
            }}
          />{' '}
          <strong>{t.aceptarSolo}</strong>
          <span className="suave"> {t.aceptarSoloAyuda}</span>
        </label>
      ) : null}
      {pedidos.length === 0 && <p>{t.vacio}</p>}
      <ul className="lista">
        {pedidos.map((p) => (
          <li
            key={p.id}
            className={p.estado === 'pagado' ? 'resaltado' : fotoSinConfirmar(p) ? 'atencion' : ''}
          >
            <div className="lista-texto">
              <strong>
                #{p.id.slice(0, 4).toUpperCase()} · {t.estados[p.estado] ?? p.estado} ·{' '}
                {formatearMonto(p.subtotal, p.moneda ?? 'USD', idioma)}
              </strong>
              {p.programadoPara && !['entregado', 'cancelado'].includes(p.estado) ? (
                <span className="insignia insignia-programado">
                  {t.programado} ·{' '}
                  {textoFranja(
                    deSqlUtc(p.programadoPara),
                    Intl.DateTimeFormat().resolvedOptions().timeZone,
                    idioma === 'en' ? 'en' : 'es',
                  )}
                </span>
              ) : null}
              <LuzSemaforo pedido={p} idioma={idioma} />
              {lineaRepartidor(p.repartidor, idioma) && (
                <span className="repartidor-linea">{lineaRepartidor(p.repartidor, idioma)}</span>
              )}
              {fotoSinConfirmar(p) && (
                <span className="atencion-texto" role="alert">
                  {t.sinConfirmar}
                </span>
              )}
              {p.lineas.map((l) => (
                <span key={l.platoId}>
                  {l.cantidad} × {textoLinea(l, idioma)}
                  {/* C-TIENDAS-COMPRA: en una tienda, qué hacer si falta este producto. */}
                  {notaSustitucion(l, idioma) ? (
                    <em className="nota-sustitucion"> · {notaSustitucion(l, idioma)}</em>
                  ) : null}
                </span>
              ))}
              {p.notas && (
                <span>
                  {t.notas}: {p.notas}
                </span>
              )}
              {p.entrega === 'recoger' && ['pagado', 'aceptado', 'listo'].includes(p.estado) ? (
                <p className="ok">
                  <strong>{t.recoge}</strong>
                </p>
              ) : null}
              {p.estado === 'listo' && p.entrega === 'recoger' && (
                <div className="recoger-local">
                  <label className="campo">
                    <span>{t.pinCliente}</span>
                    <input
                      inputMode="numeric"
                      maxLength={4}
                      value={pinLocal[p.id] ?? ''}
                      onChange={(ev) =>
                        setPinLocal((x) => ({
                          ...x,
                          [p.id]: ev.target.value.replace(/\D/g, '').slice(0, 4),
                        }))
                      }
                    />
                  </label>
                  {p.requiereEdad ? (
                    <label className="interruptor">
                      <input
                        type="checkbox"
                        checked={edadLocal[p.id] ?? false}
                        onChange={(ev) =>
                          setEdadLocal((x) => ({ ...x, [p.id]: ev.target.checked }))
                        }
                      />
                      {t.mayorEdad}
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="boton exito"
                    onClick={() =>
                      void accion(`/datos/restaurante/pedidos/${p.id}/entregado-local`, {
                        pin: pinLocal[p.id] ?? '',
                        mayorEdad: edadLocal[p.id] ?? false,
                      })
                    }
                  >
                    {t.entregadoLocal}
                  </button>
                </div>
              )}
              {p.estado === 'listo' && p.entrega !== 'recoger' && qrs[p.id] && (
                <figure className="qr-pedido">
                  <img src={qrs[p.id]} alt={`QR ${p.id.slice(0, 4).toUpperCase()}`} />
                  <strong>{p.id.slice(0, 4).toUpperCase()}</strong>
                  <figcaption>{t.qrAyuda}</figcaption>
                </figure>
              )}
              {p.estado === 'listo' && p.repartidor?.verificado && !p.fotoRecogida && (
                <span className="repartidor-linea">{t.verificado}</span>
              )}
              {p.estado === 'listo' && !p.fotoRecogida && !p.repartidor?.verificado && (
                <span className="suave">{t.esperandoFoto}</span>
              )}
              {p.estado === 'listo' && p.fotoRecogida && (
                <figure className="foto-recogida">
                  <img
                    src={`/datos/pedidos/${p.id}/evidencia/recogida?v=${encodeURIComponent(p.fotoRecogida.tomadaEn)}`}
                    alt={t.fotoDelRepartidor}
                  />
                  <figcaption>{t.ayudaConfirmar}</figcaption>
                </figure>
              )}
            </div>
            <div className="fila-botones">
              {p.ajuste?.estado === 'pendiente' && (
                <span className="atencion-texto" role="status">
                  {t.esperandoCliente.replace(
                    '{plato}',
                    idioma === 'en' ? p.ajuste.nombreEn || p.ajuste.nombreEs : p.ajuste.nombreEs,
                  )}
                </span>
              )}
              {p.ajuste?.estado === 'quitado' && p.estado === 'pagado' && (
                <span className="repartidor-linea">
                  {t.quitado.replace(
                    '{plato}',
                    idioma === 'en' ? p.ajuste.nombreEn || p.ajuste.nombreEs : p.ajuste.nombreEs,
                  )}
                </span>
              )}
              {faltando === p.id && (
                <div className="falta-plato">
                  <label>
                    {t.cualFalta}
                    <select value={platoFalta} onChange={(ev) => setPlatoFalta(ev.target.value)}>
                      <option value="">—</option>
                      {p.lineas.map((l) => (
                        <option key={l.platoId} value={l.platoId}>
                          {textoLinea(l, idioma)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {p.lineas.some((l) => l.sustitucion) ? (
                    <fieldset className="reemplazos">
                      <legend>{t.reemplazos}</legend>
                      <input
                        type="search"
                        value={buscaReemplazo}
                        onChange={(ev) => setBuscaReemplazo(ev.target.value)}
                        placeholder={t.buscarReemplazo}
                        aria-label={t.buscarReemplazo}
                      />
                      {encontrados.map((x) => (
                        <label key={x.id}>
                          <input
                            type="checkbox"
                            checked={propuestas.includes(x.id)}
                            disabled={!propuestas.includes(x.id) && propuestas.length >= 3}
                            onChange={(ev) =>
                              setPropuestas((ps) =>
                                ev.target.checked ? [...ps, x.id] : ps.filter((y) => y !== x.id),
                              )
                            }
                          />{' '}
                          {idioma === 'en' ? x.nombreEn || x.nombreEs : x.nombreEs || x.nombreEn}
                        </label>
                      ))}
                    </fieldset>
                  ) : null}
                  <button
                    type="button"
                    className="boton"
                    disabled={!platoFalta}
                    onClick={() =>
                      void accion(`/datos/restaurante/pedidos/${p.id}/falta`, {
                        platoId: platoFalta,
                        propuestas,
                      }).then(() => {
                        setFaltando(null);
                        setPlatoFalta('');
                        setPropuestas([]);
                        setBuscaReemplazo('');
                        setEncontrados([]);
                      })
                    }
                  >
                    {t.avisarFalta}
                  </button>
                </div>
              )}
              {p.estado === 'pagado' &&
                p.ajuste?.estado !== 'pendiente' &&
                [cocina.prepSugerida, ...[10, 20, 30].filter((m) => m !== cocina.prepSugerida)].map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      className={m === cocina.prepSugerida ? 'boton exito' : 'boton'}
                      onClick={() => {
                        if (imprimirAlAceptar)
                          imprimirComanda(p, '', idioma === 'en' ? 'en' : 'es');
                        void accion(`/datos/restaurante/pedidos/${p.id}/aceptar`, { minutos: m });
                      }}
                    >
                      {t.aceptar} · {m} {t.min}
                      {m === cocina.prepSugerida ? ` · ${t.sugerido}` : ''}
                    </button>
                  ),
                )}
              {['aceptado', 'listo'].includes(p.estado) ? (
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => imprimirComanda(p, '', idioma === 'en' ? 'en' : 'es')}
                >
                  {t.imprimir}
                </button>
              ) : null}
              {p.estado === 'aceptado' && (
                <button
                  type="button"
                  className="boton"
                  onClick={() => void accion(`/datos/restaurante/pedidos/${p.id}/listo`)}
                >
                  {t.listo}
                </button>
              )}
              {p.estado === 'aceptado' && !p.repartidor && (
                <button
                  type="button"
                  className="boton secundario"
                  title={t.masTiempoAyuda}
                  onClick={() =>
                    void pedir('PATCH', `/datos/restaurante/pedidos/${p.id}/tiempo`, {
                      minutos: Math.min(120, (p.tiempoPrepMin ?? 20) + 5),
                    })
                      .then(cargar)
                      .catch((x) => setError(x instanceof ErrorApi ? x.message : String(x)))
                  }
                >
                  {t.masTiempo}
                </button>
              )}
              {p.estado === 'listo' && p.fotoRecogida && (
                <button
                  type="button"
                  className="boton exito"
                  onClick={() =>
                    void accion(`/datos/restaurante/pedidos/${p.id}/confirmar-recogida`)
                  }
                >
                  {t.confirmarRecogida}
                </button>
              )}
            </div>
            <MenuTresPuntos
              etiqueta={t.mas}
              opciones={[
                { texto: t.reportar, alTocar: () => setReportando(p.id) },
                ...((p.estado === 'pagado' || p.estado === 'aceptado') &&
                !p.repartidor &&
                puedeMarcarFalta(p.ajuste, p.lineas)
                  ? [
                      {
                        texto: p.lineas.some((l) => l.sustitucion) ? t.faltaProducto : t.faltaPlato,
                        alTocar: () => setFaltando(p.id),
                      },
                    ]
                  : []),
                ...(p.estado === 'pagado' || p.estado === 'aceptado'
                  ? [
                      {
                        texto: t.rechazar,
                        peligro: true,
                        alTocar: () => {
                          if (window.confirm(t.confirmar))
                            void accion(`/datos/restaurante/pedidos/${p.id}/rechazar`);
                        },
                      },
                    ]
                  : []),
              ]}
            />
            {reportando === p.id && (
              <ReportarPanel pedidoId={p.id} idioma={idioma} alCerrar={() => setReportando(null)} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
