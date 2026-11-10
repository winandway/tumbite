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
  textoPesoReal,
  type OpcionElegida,
  ANCHOS_COMANDA,
  type AnchoComanda,
  escposPrueba,
} from '@tumbite/compartido';
import { MenuTresPuntos } from './MenuTresPuntos';
import { ReportarPanel } from './ReportarPanel';
import { PedirCancelacion } from './PedirCancelacion';
import { LuzSemaforo } from './LuzSemaforo';
import QRCode from 'qrcode';
import { pedir } from './api';
import { useModoTableta } from './modoTableta';
import { imprimirComanda, type ResultadoImpresion } from './comanda';
import { useImpresora } from './impresora';

/** C-COMANDA: la preferencia vive en este navegador (cada tableta o computadora decide). */
const LLAVE_IMPRIMIR = 'divoox.imprimirAlAceptar';
/** C-COMANDA-COMPLETA: el ancho del papel (58 u 80 mm) se guarda por restaurante en este navegador. */
const llaveAncho = (rid: string) => `divoox.anchoComanda.${rid}`;
const leerAncho = (rid: string): AnchoComanda => {
  try {
    return localStorage.getItem(llaveAncho(rid)) === '58' ? 58 : 80;
  } catch {
    return 80;
  }
};
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
  /** C-CANCELAR-LISTO: estado de la última solicitud de cancelación a soporte, si hubo. */
  cancelacion?: 'pendiente' | 'aprobada' | 'rechazada' | null;
  /** C-PEDIDO-PRUEBA: pedido ficticio para practicar (sin cobro ni repartidor). */
  prueba?: boolean;
  /** C-PEDIDO-PROGRAMADO: inicio de la franja (UTC) o null. */
  programadoPara?: string | null;
  entrega?: 'puerta' | 'mano' | 'recoger';
  requiereEdad?: boolean;
  subtotal: number;
  /** C-MONEDA-RECORRIDO: la moneda del pedido. */
  moneda?: string;
  notas: string;
  /** C-ALERGIAS: pedido de alergias del cliente (resaltado). */
  alergias?: string;
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
    nota?: string | null;
    sustitucion?: string;
    reemplazo?: { nombreEs?: string; nombreEn?: string } | null;
    pesable?: boolean;
    unidadPeso?: string | null;
    pesoEstimado?: number | null;
    pesoReal?: number;
  }[];
};

const T = {
  es: {
    titulo: 'Pedidos',
    activar: 'Activar sonido de alarma',
    sonidoOk: 'Alarma activada',
    bloqueado: 'El navegador silenció la alarma. Toca aquí para que suene con cada pedido nuevo.',
    tableta: 'Modo tableta',
    tabletaAyuda: 'Pantalla completa y siempre encendida, con la alarma.',
    salirTableta: 'Salir del modo tableta',
    vacio: 'Sin pedidos por ahora.',
    pruebaBoton: 'Enviar un pedido de prueba',
    pruebaAyuda:
      'Te llega un pedido ficticio con platos de tu menú para practicar: aceptar, imprimir y marcar listo. No se cobra, no sale repartidor y no cuenta en tus ventas.',
    pruebaInsignia: 'PRUEBA',
    pruebaListo:
      'Así se ve un pedido listo. En uno real, aquí llega el repartidor a recogerlo; en la prueba no sale nadie.',
    pruebaTerminar: 'Terminar la prueba',
    pesoReal: 'Peso real',
    guardarPeso: 'Guardar peso',
    pesoAyuda: 'Pésalo y escribe el peso real: se cobra eso, hasta un 15 % más de lo estimado.',
    aceptar: 'Aceptar',
    imprimir: 'Imprimir comanda',
    imprimirAlAceptar: 'Imprimir la comanda al aceptar',
    ancho: 'Ancho del papel',
    conectarUsb: 'Conectar impresora (USB)',
    conectarSerie: 'Conectar por puerto serie o Bluetooth',
    conectada: 'Impresora conectada',
    imprimirPrueba: 'Imprimir prueba',
    desconectar: 'Desconectar',
    sinSoporte:
      'Este navegador no conecta la impresora directo: la comanda sale por la impresión del navegador. Para conectarla, usa Chrome o Edge en una computadora.',
    errorConectar:
      'No pudimos conectar la impresora. Revisa que esté encendida y enchufada, y vuelve a intentarlo.',
    falloImpresora:
      'La impresora conectada no respondió: abrimos la impresión del navegador para que la comanda no se pierda.',
    ventanaBloqueada:
      'El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes de este sitio.',
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
    pedirCancelacion: 'Pedir cancelación a soporte',
    cancelacionPendiente: 'Cancelación pedida: soporte la está revisando.',
    cancelacionRechazada: 'Soporte no aprobó la cancelación: el pedido sigue en curso.',
    confirmar: '¿Rechazar este pedido? Se le devuelve todo el dinero al cliente.',
    mas: 'Más opciones',
    notas: 'Notas',
    alergias: 'ALERGIA',
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
    bloqueado: 'Your browser muted the alarm. Tap here so it rings for every new order.',
    tableta: 'Tablet mode',
    tabletaAyuda: 'Full screen and always on, with the alarm.',
    salirTableta: 'Exit tablet mode',
    vacio: 'No orders right now.',
    pruebaBoton: 'Send a test order',
    pruebaAyuda:
      'You get a pretend order with items from your menu to practice: accept, print, and mark ready. Nothing is charged, no driver is sent, and it doesn’t count in your sales.',
    pruebaInsignia: 'TEST',
    pruebaListo:
      'This is what a ready order looks like. On a real one, the driver comes to pick it up here; on a test order nobody is sent.',
    pruebaTerminar: 'Finish the test',
    pesoReal: 'Actual weight',
    guardarPeso: 'Save weight',
    pesoAyuda:
      'Weigh it and enter the actual weight: that’s what’s charged, up to 15% over the estimate.',
    aceptar: 'Accept',
    imprimir: 'Print ticket',
    imprimirAlAceptar: 'Print the ticket when accepting',
    ancho: 'Paper width',
    conectarUsb: 'Connect printer (USB)',
    conectarSerie: 'Connect by serial port or Bluetooth',
    conectada: 'Printer connected',
    imprimirPrueba: 'Print test',
    desconectar: 'Disconnect',
    sinSoporte:
      'This browser can’t connect the printer directly: tickets print through the browser’s print window. To connect it, use Chrome or Edge on a computer.',
    errorConectar:
      'We couldn’t connect the printer. Make sure it’s on and plugged in, and try again.',
    falloImpresora:
      'The connected printer didn’t respond: we opened the browser’s print window so the ticket isn’t lost.',
    ventanaBloqueada: 'The browser blocked the print window. Allow pop-ups for this site.',
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
    pedirCancelacion: 'Ask support to cancel',
    cancelacionPendiente: 'Cancellation requested: support is reviewing it.',
    cancelacionRechazada: 'Support didn’t approve the cancellation: the order stays in progress.',
    confirmar: 'Reject this order? The customer gets a full refund.',
    mas: 'More options',
    notas: 'Notes',
    alergias: 'ALLERGY',
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

/** La alarma de pedidos nuevos: suena en bucle hasta que se atienden (C-ALARMA-SIEMPRE). */
function crearAlarma() {
  const a = new Audio('/alarma.wav');
  a.loop = true;
  return a;
}

export function Pedidos({ idioma }: { idioma: Idioma }) {
  const [reportando, setReportando] = useState<string | null>(null);
  // C-CANCELAR-LISTO: el pedido listo cuya cancelación se está pidiendo a soporte.
  const [cancelando, setCancelando] = useState<string | null>(null);
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
  // C-COMANDA-COMPLETA: el nombre real del restaurante va arriba de la comanda (antes salía vacío).
  const [restaurante, setRestaurante] = useState<{ id: string; nombre: string } | null>(null);
  const [ancho, setAncho] = useState<AnchoComanda>(80);
  useEffect(() => {
    pedir<{ restaurante: { id?: string; nombre?: string; aceptarSolo?: boolean } }>(
      'GET',
      '/datos/mi-restaurante',
    )
      .then((r) => {
        setAceptarSolo(Boolean(r.restaurante.aceptarSolo));
        const id = String(r.restaurante.id ?? '');
        setRestaurante({ id, nombre: String(r.restaurante.nombre ?? '') });
        if (id) setAncho(leerAncho(id));
      })
      .catch(() => setAceptarSolo(null));
  }, []);
  const impresora = useImpresora();
  const [avisoImpresion, setAvisoImpresion] = useState('');
  const [pinLocal, setPinLocal] = useState<Record<string, string>>({});
  const [edadLocal, setEdadLocal] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  // C-TIENDAS-PESO-REAL: el peso escrito por producto, «pedido:producto» → texto.
  const [pesos, setPesos] = useState<Record<string, string>>({});
  // C-ALARMA-SIEMPRE (8 nov 2026): la alarma nace encendida, como la tableta de DoorDash. Antes solo
  // sonaba si alguien tocaba «Activar sonido» y el primer pedido de prueba de Richard no sonó.
  const [sonido, setSonido] = useState(true);
  // El navegador puede bloquear el sonido hasta que la persona toque la página: se avisa en grande.
  const [bloqueado, setBloqueado] = useState(false);
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
      // BRE-R (3): el de prueba no tiene repartidor que escanee: no lleva QR de recogida.
      if (p.estado !== 'listo' || p.prueba || qrs[p.id]) continue;
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
    if (!sonido) return;
    audio.current ??= crearAlarma();
    const a = audio.current;
    if (hayNuevos || hayUrgente) {
      Promise.resolve(a.play())
        .then(() => setBloqueado(false))
        .catch(() => setBloqueado(true));
    } else a.pause();
  }, [hayNuevos, hayUrgente, sonido]);
  // Cualquier toque en la página destraba el sonido bloqueado por el navegador.
  useEffect(() => {
    if (!bloqueado) return;
    const destrabar = () => {
      const a = audio.current;
      if (a && (hayNuevos || hayUrgente))
        Promise.resolve(a.play())
          .then(() => setBloqueado(false))
          .catch(() => undefined);
      else setBloqueado(false);
    };
    window.addEventListener('pointerdown', destrabar);
    window.addEventListener('keydown', destrabar);
    return () => {
      window.removeEventListener('pointerdown', destrabar);
      window.removeEventListener('keydown', destrabar);
    };
  }, [bloqueado, hayNuevos, hayUrgente]);
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
    audio.current ??= crearAlarma();
    const a = audio.current;
    setSonido(true);
    if (hayNuevos || hayUrgente)
      Promise.resolve(a.play())
        .then(() => setBloqueado(false))
        .catch(() => setBloqueado(true));
    else setBloqueado(false);
  }

  const [imprimirAlAceptar, setImprimirAlAceptar] = useState(leerImprimir);
  const idiomaComanda = idioma === 'en' ? 'en' : 'es';
  function imprimir(p: Pedido) {
    void imprimirComanda(p, restaurante?.nombre ?? '', idiomaComanda, {
      ancho,
      impresora: impresora.conexion,
    }).then((r: ResultadoImpresion) =>
      setAvisoImpresion(
        r === 'navegador-por-fallo'
          ? t.falloImpresora
          : r === 'bloqueada'
            ? t.ventanaBloqueada
            : '',
      ),
    );
  }
  async function conectar(tipo: 'usb' | 'serie') {
    try {
      await impresora.conectar(tipo);
      setAvisoImpresion('');
    } catch (e) {
      // Cerrar la ventana del navegador sin elegir no es un error que haya que mostrar.
      if (e instanceof Error && e.name === 'NotFoundError') return;
      console.warn('impresora: no se pudo conectar', e);
      setAvisoImpresion(t.errorConectar);
    }
  }
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
        <button
          type="button"
          className="boton secundario"
          title={t.pruebaAyuda}
          data-testid="pedido-prueba"
          disabled={pedidos.some(
            (p) => p.prueba && ['pagado', 'aceptado', 'listo'].includes(p.estado),
          )}
          onClick={() => void accion('/datos/restaurante/pedido-prueba')}
        >
          {t.pruebaBoton}
        </button>
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
      <div className="fila-impresora" data-testid="impresora">
        <label className="campo-check">
          {t.ancho}{' '}
          <select
            aria-label={t.ancho}
            value={ancho}
            disabled={!restaurante}
            onChange={(ev) => {
              const a: AnchoComanda = ev.target.value === '58' ? 58 : 80;
              setAncho(a);
              try {
                if (restaurante?.id) localStorage.setItem(llaveAncho(restaurante.id), String(a));
              } catch {
                /* sin almacén: vale mientras la página esté abierta */
              }
            }}
          >
            {ANCHOS_COMANDA.map((a) => (
              <option key={a} value={a}>
                {a} mm
              </option>
            ))}
          </select>
        </label>
        {impresora.conexion ? (
          <>
            <span className="ok" role="status">
              {t.conectada} · {impresora.conexion.nombre}
            </span>
            <button
              type="button"
              className="boton secundario"
              onClick={() => {
                const c = impresora.conexion;
                if (!c) return;
                c.enviar(escposPrueba(ancho, idiomaComanda)).catch((e: unknown) => {
                  console.warn('impresora: falló la prueba', e);
                  setAvisoImpresion(t.errorConectar);
                });
              }}
            >
              {t.imprimirPrueba}
            </button>
            <button
              type="button"
              className="boton secundario"
              onClick={() => void impresora.desconectar()}
            >
              {t.desconectar}
            </button>
          </>
        ) : impresora.soporte.usb || impresora.soporte.serie ? (
          <>
            {impresora.soporte.usb ? (
              <button type="button" className="boton" onClick={() => void conectar('usb')}>
                {t.conectarUsb}
              </button>
            ) : null}
            {impresora.soporte.serie ? (
              <button
                type="button"
                className="boton secundario"
                onClick={() => void conectar('serie')}
              >
                {t.conectarSerie}
              </button>
            ) : null}
          </>
        ) : (
          <span className="ayuda">{t.sinSoporte}</span>
        )}
        {avisoImpresion ? (
          <span className="error" role="alert">
            {avisoImpresion}
          </span>
        ) : null}
      </div>
      {bloqueado && (
        <button
          type="button"
          className="aviso-alarma"
          data-testid="alarma-bloqueada"
          onClick={activarSonido}
        >
          <Icono nombre="alarma" tamano={20} /> {t.bloqueado}
        </button>
      )}
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
                {p.prueba ? (
                  <span className="insignia insignia-programado">{t.pruebaInsignia}</span>
                ) : null}{' '}
                #{(p.prueba ? p.id.slice(7, 11) : p.id.slice(0, 4)).toUpperCase()} ·{' '}
                {t.estados[p.estado] ?? p.estado} ·{' '}
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
              {p.lineas.map((l, i) => (
                <span key={`${i}-${l.platoId}`}>
                  {l.cantidad} × {textoLinea(l, idioma)}
                  {/* C-TIENDAS-COMPRA: en una tienda, qué hacer si falta este producto. */}
                  {notaSustitucion(l, idioma) ? (
                    <em className="nota-sustitucion"> · {notaSustitucion(l, idioma)}</em>
                  ) : null}
                  {/* C-TIENDAS-PESO-REAL: la tienda escribe el peso real al preparar. */}
                  {l.pesable && l.pesoEstimado ? (
                    <span className="peso-real">
                      {l.pesoReal != null ? (
                        <em> · {textoPesoReal(l, idioma === 'en' ? 'en' : 'es')}</em>
                      ) : (
                        <em> · {t.pesoAyuda}</em>
                      )}
                      {['pagado', 'aceptado'].includes(p.estado) ? (
                        <>
                          <label>
                            {t.pesoReal} ({l.unidadPeso ?? 'kg'})
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.001"
                              value={pesos[`${p.id}:${i}`] ?? ''}
                              onChange={(ev) =>
                                setPesos((x) => ({
                                  ...x,
                                  [`${p.id}:${i}`]: ev.target.value,
                                }))
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="boton secundario"
                            disabled={!(Number(pesos[`${p.id}:${i}`]) > 0)}
                            onClick={() =>
                              void accion(`/datos/restaurante/pedidos/${p.id}/pesos`, {
                                pesos: [
                                  {
                                    platoId: l.platoId,
                                    linea: i,
                                    peso: Number(pesos[`${p.id}:${i}`]),
                                  },
                                ],
                              })
                            }
                          >
                            {t.guardarPeso}
                          </button>
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </span>
              ))}
              {p.notas && (
                <span>
                  {t.notas}: {p.notas}
                </span>
              )}
              {p.alergias ? (
                <strong role="alert" className="alergia">
                  {t.alergias}: {p.alergias}
                </strong>
              ) : null}
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
              {p.estado === 'listo' && p.entrega !== 'recoger' && !p.prueba && qrs[p.id] && (
                <figure className="qr-pedido">
                  <img src={qrs[p.id]} alt={`QR ${p.id.slice(0, 4).toUpperCase()}`} />
                  <strong>{p.id.slice(0, 4).toUpperCase()}</strong>
                  <figcaption>{t.qrAyuda}</figcaption>
                </figure>
              )}
              {p.prueba && p.estado === 'listo' ? (
                <span className="ok">{t.pruebaListo}</span>
              ) : null}
              {p.estado === 'listo' && p.repartidor?.verificado && !p.fotoRecogida && (
                <span className="repartidor-linea">{t.verificado}</span>
              )}
              {p.estado === 'listo' &&
                !p.prueba &&
                !p.fotoRecogida &&
                !p.repartidor?.verificado && <span className="suave">{t.esperandoFoto}</span>}
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
                        if (imprimirAlAceptar) imprimir(p);
                        void accion(`/datos/restaurante/pedidos/${p.id}/aceptar`, { minutos: m });
                      }}
                    >
                      {t.aceptar} · {m} {t.min}
                      {m === cocina.prepSugerida ? ` · ${t.sugerido}` : ''}
                    </button>
                  ),
                )}
              {['aceptado', 'listo'].includes(p.estado) ? (
                <button type="button" className="boton secundario" onClick={() => imprimir(p)}>
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
              {p.prueba && p.estado === 'listo' ? (
                <button
                  type="button"
                  className="boton exito"
                  onClick={() => void accion(`/datos/restaurante/pedidos/${p.id}/terminar-prueba`)}
                >
                  {t.pruebaTerminar}
                </button>
              ) : null}
              {p.estado === 'aceptado' && !p.repartidor && !p.prueba && (
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
                // BRE-R (2): un pedido de prueba no existe para soporte; reportarlo terminaba en error.
                ...(p.prueba ? [] : [{ texto: t.reportar, alTocar: () => setReportando(p.id) }]),
                ...((p.estado === 'pagado' || p.estado === 'aceptado') &&
                !p.repartidor &&
                !p.prueba &&
                puedeMarcarFalta(p.ajuste, p.lineas)
                  ? [
                      {
                        texto: p.lineas.some((l) => l.sustitucion) ? t.faltaProducto : t.faltaPlato,
                        alTocar: () => setFaltando(p.id),
                      },
                    ]
                  : []),
                // C-CANCELAR-LISTO: ya listo no se rechaza con un toque; se pide a soporte con motivo.
                ...(p.estado === 'listo' && !p.prueba && p.cancelacion !== 'pendiente'
                  ? [
                      {
                        texto: t.pedirCancelacion,
                        peligro: true,
                        alTocar: () => setCancelando(p.id),
                      },
                    ]
                  : []),
                ...(p.estado === 'pagado' || p.estado === 'aceptado'
                  ? [
                      {
                        texto: t.rechazar,
                        peligro: true,
                        alTocar: () => {
                          if (p.prueba || window.confirm(t.confirmar))
                            void accion(`/datos/restaurante/pedidos/${p.id}/rechazar`);
                        },
                      },
                    ]
                  : []),
              ]}
            />
            {p.estado === 'listo' && p.cancelacion === 'pendiente' ? (
              <p className="suave" role="status" data-testid="cancelacion-pendiente">
                {t.cancelacionPendiente}
              </p>
            ) : null}
            {p.estado === 'listo' && p.cancelacion === 'rechazada' ? (
              <p className="suave" role="status">
                {t.cancelacionRechazada}
              </p>
            ) : null}
            {cancelando === p.id && (
              <PedirCancelacion
                pedidoId={p.id}
                idioma={idioma}
                alCerrar={() => setCancelando(null)}
                alEnviar={() => void cargar()}
              />
            )}
            {reportando === p.id && (
              <ReportarPanel pedidoId={p.id} idioma={idioma} alCerrar={() => setReportando(null)} />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
