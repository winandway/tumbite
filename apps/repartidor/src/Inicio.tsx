import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { detenerUbicacionFondo, iniciarUbicacionFondo } from './ubicacionFondo';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import {
  ErrorApi,
  type Idioma,
  type Nivel,
  enIdioma,
  formatearMonto,
  textoAMonto,
  PRECISION_MAXIMA_M,
  llego,
  metrosEntre,
  textoLinea,
  type OpcionElegida,
  type Pendiente,
  crearCola,
  sePuedeReintentar,
} from '@tumbite/compartido';
import { BilleteraRepartidor, type DatosBilletera } from './Billetera';
import { MisDatos } from './MisDatos';
import { Verificacion } from './Verificacion';
import { BarraInferior, type Pestana } from './piezas/BarraInferior';
import { BotonRedondo } from './piezas/BotonRedondo';
import { CabeceraDriver } from './piezas/CabeceraDriver';
import { Mapa } from './piezas/Mapa';
import { ModalMuyPronto } from './piezas/ModalMuyPronto';
import { Progreso } from './piezas/Progreso';
import { ResumenDia } from './piezas/ResumenDia';
import { IMG } from './piezas/recursos';
import { textosDriver } from './piezas/textos';
import { Oferta } from './grandes/Oferta';
import { Calificaciones } from './grandes/Calificaciones';
import { Ganancias } from './grandes/Ganancias';
import { Avisos } from './grandes/Avisos';
import { AyudaPedido } from './grandes/Ayuda';
import { PagoEnLocal } from './grandes/PagoEnLocal';
import { Alta } from './grandes/Alta';
import { textosGrandes } from './grandes/textos';
import { MiRuta } from './flex/MiRuta';
import { type OfertaViaje, OfertaViajeModal } from './viajes/OfertaViaje';
import { type ViajeConductor, ViajeActivo } from './viajes/ViajeActivo';
import {
  Boton,
  C,
  ChatPedido,
  MenuCuenta,
  ReportarProblema,
  TEXTOS_MOVIL,
  e,
  useSesion,
  useToqueAviso,
} from '@tumbite/movil';

/** Pregunta sí/no al repartidor (en el celular con la ventana del sistema; en la web con la del navegador). */
function confirmar(texto: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(texto));
  return new Promise((resolver) =>
    Alert.alert('Divoox', texto, [
      { text: 'No', style: 'cancel', onPress: () => resolver(false) },
      { text: 'OK', onPress: () => resolver(true) },
    ]),
  );
}

type Lugar = {
  nombre: string;
  direccion: string;
  telefono: string;
  lat: number | null;
  lng: number | null;
};
type Pedido = {
  id: string;
  estado: string;
  direccion: string;
  notas: string;
  lat: number | null;
  lng: number | null;
  propina: number;
  pagoRepartidor: number;
  bono?: number;
  distanciaKm: number | null;
  restaurante: Lugar;
  segundos?: number;
  ofertaEn?: string;
  fotoRecogida?: { tomadaEn: string; confirmadaEn: string | null } | null;
  minutosParaListo?: number;
  verificado?: boolean;
  llegoRestaurante?: boolean;
  llegoCliente?: boolean;
  distanciaAlLocalKm?: number | null;
  distanciaTotalKm?: number | null;
  minutosEstimados?: number | null;
  articulos?: number;
  noApareceEn?: string | null;
  excepcionUbicacion?: 'pedida' | 'autorizada' | null;
  entrega?: 'puerta' | 'mano';
  pinRequerido?: boolean;
  requiereEdad?: boolean;
  grupoId?: string | null;
  /** Fase 2 · cobro directo. */
  metodoPago?: 'tarjeta' | 'efectivo' | 'transferencia_repartidor';
  /** Moneda del pedido (C-TARIFAS-PAIS): USD, COP, VES… */
  moneda?: string;
  cobroEstado?: string;
  total?: number;
  lineas: {
    platoId: string;
    nombreEs: string;
    nombreEn: string;
    cantidad: number;
    opciones?: OpcionElegida[];
  }[];
};
type Estado = {
  conectado: boolean;
  pausado?: boolean;
  puntos: number;
  nivel: Nivel;
  activo: Pedido | null;
  selfieControlPendiente?: boolean;
  /** Otros pedidos del mismo restaurante que lleva en este viaje. */
  agrupados?: Pedido[];
};
type Billetera = DatosBilletera;

/**
 * La ubicación con un tope de 15 segundos. Si la precisión alta falla (en Android, cuando la
 * persona no activa la «precisión de ubicación» de Google), se pide con precisión normal; si el
 * GPS no responde, se usa la última conocida.
 */
async function ubicacionConLimite(): Promise<Location.LocationObject | null> {
  const tope = new Promise<null>((r) => setTimeout(() => r(null), 15000));
  const actual = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
    .catch(() => Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }))
    .catch(() => null);
  const p = await Promise.race([actual, tope]);
  return p ?? (await Location.getLastKnownPositionAsync().catch(() => null));
}

const T = {
  es: {
    vistaMiRuta: 'Mi ruta (paquetes)',
    miRutaAyuda:
      'Rutas de paquetes de las empresas con las que trabajas: carga, entregas y devoluciones.',
    conectado: 'Conectado: recibiendo pedidos',
    desconectado: 'Desconectado',
    conectar: 'Conectarme',
    desconectar: 'Desconectarme',
    sinUbicacion: 'Para recibir pedidos necesitamos tu ubicación mientras usas la app.',
    buscandoUbicacion: 'Buscando tu ubicación…',
    ubicacionTarda:
      'No pudimos leer tu ubicación. Revisa que el GPS esté encendido y que Divoox tenga permiso de ubicación, y vuelve a intentar.',
    buscando: 'Buscando pedidos cerca de ti…',
    oferta: 'Nueva oferta',
    ganas: 'Ganas',
    propinaIncluida: 'incluye propina de',
    aceptar: 'Aceptar',
    rechazar: 'No, gracias',
    sinCastigo: 'Rechazar no te baja de nivel.',
    recoger: 'Recoge en',
    entregar: 'Entrega en',
    comoLlegar: 'Cómo llegar',
    fotoRecogida: 'Tomar foto del pedido',
    fotoRecogidaAyuda:
      'Toma la foto de la bolsa cerrada, con el sello o el ticket a la vista. El restaurante la confirma en su pantalla y ahí empieza tu entrega.',
    esperaConfirmacion: 'Foto enviada. Espera que el restaurante confirme en su pantalla.',
    repetirFoto: 'Repetir la foto',
    teFaltan: 'Te faltan',
    alLlegar: 'El botón para entregar aparece cuando llegues a la puerta.',
    confirmandoGps:
      'Estás en la puerta. Confirmando tu ubicación con el GPS (unos segundos, con el celular quieto).',
    gpsImpreciso: 'Tu GPS está impreciso aquí',
    sinGps: '¿El GPS no te marca en la puerta?',
    sinGpsAyuda:
      'Cuéntanos qué pasa (edificio, garaje, celular sin señal). Soporte lo revisa y te autoriza entregar.',
    pedirExcepcion: 'No puedo confirmar mi ubicación',
    esperandoSoporte:
      'Soporte está revisando tu caso. Mientras tanto, si el GPS te confirma, el botón aparece solo.',
    autorizado: 'Soporte autorizó la entrega sin la confirmación del GPS.',
    fotoEntrega: 'Tomar foto de la entrega',
    bono: 'Incluye un bono de',
    llamarCliente: 'Llamar al cliente (número oculto)',
    selfieControl: 'Foto de control: confirma que eres tú',
    agrupado: 'Pedido agrupado (mismo restaurante, mismo viaje)',
    agrupadoAyuda: 'Lo recoges junto con el principal y lo entregas en su propia dirección.',
    mayorEdad: 'Revisé el documento: quien recibe es mayor de 21',
    mayorEdadAyuda: 'Este pedido tiene productos para mayores de 21: solo en mano y con documento.',
    selfieControlAyuda:
      'De vez en cuando, antes de conectarte, te pedimos una foto de tu cara. Nuestro equipo la compara con la de tu registro. De frente y con buena luz.',
    tomarSelfie: 'Tomarme la foto ahora',
    selfieLista: 'Foto enviada. Ya puedes conectarte.',
    llamandoCliente:
      'Te estamos llamando. Contesta y te conectamos con el cliente; ninguno ve el número del otro.',
    bonoPorque: 'por tomar un pedido que otros dejaron pasar.',
    pendienteConfirmar:
      'Sin señal: guardamos tu entrega en el celular. Pendiente de confirmar: se envía sola cuando vuelva la señal. No la repitas.',
    pendientes: 'Pendiente de confirmar',
    pendienteEnviado: 'Entrega enviada: ya quedó confirmada.',
    sinCaras:
      'No le tomes foto a la cara de nadie. Deja la comida en la puerta o en las manos del cliente y toma la foto de lado: que se vean solo las manos, la comida y la entrada de la casa.',
    subiendo: 'Enviando la foto…',
    escanear: 'Escanear el código del restaurante',
    escribirCodigo: 'O escribe el número del pedido (4 letras o números)',
    verificar: 'Verificar',
    verificadoOk:
      'Código verificado: es tu pedido. Ahora toma la foto de la bolsa y sales de una, sin esperar al restaurante.',
    cerrar: 'Cerrar',
    noPuedo: 'No puedo seguir con este pedido',
    motivo: 'Cuéntanos por qué. Se le ofrece a otro repartidor y no te baja de nivel.',
    soltar: 'Soltar el pedido',
    pidio: {
      puerta: 'El cliente pidió: dejar en la puerta',
      mano: 'El cliente pidió: entregar en mano',
    } as Record<string, string>,
    enMano: 'Entregado en mano',
    pinPedir: 'PIN de 4 dígitos (lo tiene quien recibe, en su app)',
    noAparece: 'El cliente no aparece',
    esperando5: 'Avisamos al cliente. Escríbele por el chat y espera',
    dejarSeguro: 'Dejar en lugar seguro (con foto)',
    dondeLoDejas: 'Escribe dónde lo dejas (con el portero, detrás de la maceta…)',
    permisoCamara: 'Para tomar la foto necesitamos permiso para usar la cámara.',
    esperando: 'El restaurante lo está terminando…',
    listoEn: 'Listo en',
    listoYa: 'Ya está listo para recoger.',
    nivel: 'Tu nivel',
    puntos: 'puntos',
    faltan: 'Te faltan',
    para: 'para',
    saldo: 'Tu saldo',
    menu: 'Menú',
    vistaInicio: 'Inicio',
    vistaBilletera: 'Mi billetera',
    vistaDatos: 'Mis datos y vehículo',
    verBilletera: 'Ver mi billetera y movimientos →',
    volverInicio: '← Volver al inicio',
    conectarBanco: 'Conectar mi cuenta bancaria',
    retirarPanel: 'Retirar todo',
    llamar: 'Llamar al restaurante',
    notas: 'Indicaciones',
    retirado: 'Retiro en camino a tu banco.',
    retiroEnProceso: 'Retiro en proceso: Stripe lo está confirmando. Ya salió de tu saldo.',
    pedido: 'Pedido',
  },
  en: {
    vistaMiRuta: 'My route (packages)',
    miRutaAyuda:
      'Package routes from the companies you work with: loading, deliveries and returns.',
    conectado: 'Online: receiving orders',
    desconectado: 'Offline',
    conectar: 'Go online',
    desconectar: 'Go offline',
    sinUbicacion: 'To receive orders we need your location while you use the app.',
    buscandoUbicacion: 'Finding your location…',
    ubicacionTarda:
      'We couldn’t read your location. Make sure GPS is on and Divoox has location permission, then try again.',
    buscando: 'Looking for orders near you…',
    oferta: 'New offer',
    ganas: 'You earn',
    propinaIncluida: 'includes a tip of',
    aceptar: 'Accept',
    rechazar: 'No, thanks',
    sinCastigo: 'Declining never lowers your level.',
    recoger: 'Pick up at',
    entregar: 'Deliver to',
    comoLlegar: 'Directions',
    fotoRecogida: 'Take a photo of the order',
    fotoRecogidaAyuda:
      'Take a photo of the closed bag with the seal or receipt showing. The restaurant confirms it on their screen, and then your delivery starts.',
    esperaConfirmacion: 'Photo sent. Wait for the restaurant to confirm it on their screen.',
    repetirFoto: 'Retake the photo',
    teFaltan: 'Still',
    alLlegar: 'The button to deliver appears when you reach the door.',
    confirmandoGps:
      'You’re at the door. Confirming your location with GPS (a few seconds, keep the phone still).',
    gpsImpreciso: 'Your GPS is imprecise here',
    sinGps: 'GPS not placing you at the door?',
    sinGpsAyuda:
      'Tell us what’s going on (tall building, garage, no signal). Support reviews it and authorizes the delivery.',
    pedirExcepcion: 'I can’t confirm my location',
    esperandoSoporte:
      'Support is reviewing your case. Meanwhile, if GPS confirms you, the button appears on its own.',
    autorizado: 'Support authorized the delivery without GPS confirmation.',
    fotoEntrega: 'Take the delivery photo',
    bono: 'Includes a bonus of',
    llamarCliente: 'Call the customer (masked number)',
    selfieControl: 'Identity check photo: confirm it’s you',
    agrupado: 'Grouped order (same restaurant, same trip)',
    agrupadoAyuda: 'You pick it up with the main one and deliver it to its own address.',
    mayorEdad: 'I checked the ID: the recipient is 21 or older',
    mayorEdadAyuda: 'This order has 21+ items: hand delivery only, with an ID check.',
    selfieControlAyuda:
      'Every so often, before you go online, we ask for a photo of your face. Our team compares it with the one on file. Face the camera in good light.',
    tomarSelfie: 'Take my photo now',
    selfieLista: 'Photo sent. You can go online now.',
    llamandoCliente:
      'We’re calling you now. Answer and we’ll connect you with the customer; neither of you sees the other’s number.',
    bonoPorque: 'for taking an order others passed on.',
    pendienteConfirmar:
      'No signal: we saved your delivery on the phone. Pending confirmation: it’s sent on its own when the signal is back. Don’t redo it.',
    pendientes: 'Pending confirmation',
    pendienteEnviado: 'Delivery sent: it’s now confirmed.',
    sinCaras:
      'Never take a photo of anyone’s face. Leave the food at the door or in the customer’s hands and take the photo from the side: only the hands, the food, and the home’s entrance should show.',
    subiendo: 'Sending the photo…',
    escanear: 'Scan the restaurant’s code',
    escribirCodigo: 'Or type the order number (4 characters)',
    verificar: 'Verify',
    verificadoOk:
      'Code verified: it’s your order. Now photograph the bag and you’re on your way, no need to wait for the restaurant.',
    cerrar: 'Close',
    noPuedo: 'I can’t continue with this order',
    motivo: 'Tell us why. It’s offered to another driver and your level isn’t affected.',
    soltar: 'Release the order',
    pidio: {
      puerta: 'Customer chose: leave at the door',
      mano: 'Customer chose: hand it to them',
    } as Record<string, string>,
    enMano: 'Handed to the customer',
    pinPedir: '4-digit PIN (the person receiving has it in their app)',
    noAparece: 'Customer isn’t here',
    esperando5: 'We told the customer. Message them in the chat and wait',
    dejarSeguro: 'Leave in a safe spot (with photo)',
    dondeLoDejas: 'Where are you leaving it (with the doorman, behind the planter…)',
    permisoCamara: 'To take the photo, we need permission to use the camera.',
    esperando: 'The restaurant is finishing it…',
    listoEn: 'Ready in',
    listoYa: 'Ready for pickup now.',
    nivel: 'Your level',
    puntos: 'points',
    faltan: 'You need',
    para: 'to reach',
    saldo: 'Your balance',
    menu: 'Menu',
    vistaInicio: 'Home',
    vistaBilletera: 'My wallet',
    vistaDatos: 'My details and vehicle',
    verBilletera: 'See my wallet and activity →',
    volverInicio: '← Back to home',
    conectarBanco: 'Connect my bank account',
    retirarPanel: 'Cash out all',
    llamar: 'Call the restaurant',
    notas: 'Instructions',
    retirado: 'Cash-out on its way to your bank.',
    retiroEnProceso:
      'Withdrawal in progress: Stripe is confirming it. It already left your balance.',
    pedido: 'Order',
  },
};

function abrirMapa(lat: number | null, lng: number | null, direccion: string) {
  const destino = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(direccion);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${destino}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destino}`;
  void Linking.openURL(url);
}

export function Inicio() {
  useKeepAwake();
  const { api, idioma, salir, cambiarIdioma: cambiarIdiomaSesion, usuario } = useSesion();
  // El idioma de los avisos al celular sigue al de la app (antes se quedaba el del registro).
  const cambiarIdioma = useCallback(
    (i: Idioma) => {
      cambiarIdiomaSesion(i);
      void api.pedir('PUT', '/datos/cuentas/idioma', { idioma: i }).catch(() => undefined);
    },
    [api, cambiarIdiomaSesion],
  );
  const td = textosDriver(idioma);
  // El mapa ocupa lo que queda de pantalla: la mitad en celulares normales.
  const alturaMapa = Math.max(240, Math.round(useWindowDimensions().height * 0.42));
  const t = enIdioma(T, idioma);
  const tm = enIdioma(TEXTOS_MOVIL, idioma);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [ofertas, setOfertas] = useState<Pedido[]>([]);
  // Divoox Moto (M4): la oferta de un viaje y el viaje en curso (otra operación, no un pedido).
  const [ofertasViaje, setOfertasViaje] = useState<OfertaViaje[]>([]);
  const [viajeActivo, setViajeActivo] = useState<ViajeConductor | null>(null);
  const [billetera, setBilletera] = useState<Billetera | null>(null);
  const [error, setError] = useState('');
  const [cambiando, setCambiando] = useState(false);
  const [vista, setVista] = useState<
    'inicio' | 'billetera' | 'datos' | 'pedidos' | 'calificaciones' | 'avisos' | 'alta' | 'miRuta'
  >('inicio');
  // Flex · Fase 3: tocar un aviso de ruta abre «Mi ruta» directamente en esa ruta.
  const [rutaDelAviso, setRutaDelAviso] = useState<string | null>(null);
  const alTocarAviso = useCallback((d: Record<string, unknown>) => {
    if (d.tipo === 'flex' && typeof d.rutaId === 'string') {
      setRutaDelAviso(d.rutaId);
      setVista('miRuta');
    }
  }, []);
  useToqueAviso(alTocarAviso);
  const [ayudaAbierta, setAyudaAbierta] = useState(false);
  const tg = textosGrandes(idioma);
  const [pronto, setPronto] = useState(false);
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [seccionPerfil, setSeccionPerfil] = useState<'vehiculo' | 'documentos' | 'soporte' | null>(
    null,
  );
  const [mostrarChat, setMostrarChat] = useState(true);
  // Desde cuándo está conectado en esta sesión (el servidor no lo guarda).
  const [conectadoDesde, setConectadoDesde] = useState<number | null>(null);
  const [kycAprobado, setKycAprobado] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  // El error de la recarga automática va aparte: si no, cada recarga borraba el aviso de un botón.
  const [errorCarga, setErrorCarga] = useState('');
  const [aviso, setAviso] = useState('');
  // Cola sin señal: lo que no se pudo mandar se guarda en el celular y se reintenta solo.
  const cola = useMemo(
    () =>
      crearCola({
        leer: () => AsyncStorage.getItem('tumbite.cola-entregas'),
        escribir: (v) => AsyncStorage.setItem('tumbite.cola-entregas', v),
      }),
    [],
  );
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const vigilante = useRef<Location.LocationSubscription | null>(null);
  // Dónde está ahora (para saber si ya llegó a la puerta y mostrar el botón de entregar).
  const [aqui, setAqui] = useState<{ lat: number; lng: number } | null>(null);
  // Precisión del GPS en metros (la reporta el celular); se manda con cada ubicación.
  const [precision, setPrecision] = useState<number | null>(null);
  const [motivoGps, setMotivoGps] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  // Verificar el pedido en el restaurante (QR o número), soltarlo, y la entrega en la puerta.
  const [escaneando, setEscaneando] = useState(false);
  const [permisoCamara, pedirCamara] = useCameraPermissions();
  const [codigo, setCodigo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [pinEntrega, setPinEntrega] = useState('');
  const [mayorEdad, setMayorEdad] = useState(false);
  const [tic, setTic] = useState(() => Date.now());
  useEffect(() => {
    const reloj = setInterval(() => setTic(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, []);

  const cargar = useCallback(async () => {
    try {
      const s = await api.pedir<Estado>('GET', '/datos/repartidor/estado');
      setEstado(s);
      if (s.conectado) setConectadoDesde((d) => d ?? Date.now());
      else setConectadoDesde(null);
      if (s.conectado && !s.activo)
        setOfertas(
          (await api.pedir<{ ofertas: Pedido[] }>('GET', '/datos/repartidor/ofertas')).ofertas,
        );
      else setOfertas([]);
      // Viajes de Moto: el viaje en curso manda; si no hay, las ofertas (el servidor nunca da las dos).
      const v = await api
        .pedir<{ operacion: ViajeConductor | null }>('GET', '/datos/conductor/operaciones/actual')
        .catch(() => ({ operacion: null }));
      setViajeActivo(v.operacion);
      setOfertasViaje(
        s.conectado && !s.activo && !v.operacion
          ? (
              await api
                .pedir<{ ofertas: OfertaViaje[] }>('GET', '/datos/conductor/operaciones/ofertas')
                .catch(() => ({ ofertas: [] }))
            ).ofertas
          : [],
      );
      setBilletera(await api.pedir<Billetera>('GET', '/datos/billetera'));
      api
        .pedir<{ kyc: { estado: string } }>('GET', '/datos/kyc')
        .then((k) => setKycAprobado(k.kyc.estado === 'aprobado'))
        .catch(() => undefined);
      setErrorCarga('');
    } catch (x) {
      setErrorCarga(x instanceof ErrorApi ? x.message : String(x));
    }
  }, [api]);

  useEffect(() => {
    const primero = setTimeout(() => void cargar(), 0);
    const reloj = setInterval(() => void cargar(), 5000);
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
    };
  }, [cargar]);

  // Lo pendiente se reintenta cada 10 segundos; lo que el servidor rechaza se muestra y se descarta.
  const textoEnviado = t.pendienteEnviado;
  useEffect(() => {
    const reintentar = async () => {
      const r = await cola.reintentar(async (p) => {
        if (p.tipo === 'foto') {
          const blob = await (await fetch(p.cuerpo)).blob();
          await api.subirFoto(blob, p.ruta);
        } else await api.pedir('POST', p.ruta, JSON.parse(p.cuerpo) as unknown);
      });
      setPendientes(await cola.listar());
      if (r.enviados.length) {
        setAviso(textoEnviado);
        await cargar();
      }
      if (r.rechazados.length) setError(r.rechazados.map((x) => x.error).join(' '));
    };
    void cola.listar().then(setPendientes);
    const reloj = setInterval(() => void reintentar(), 10_000);
    return () => clearInterval(reloj);
  }, [api, cargar, cola, textoEnviado]);

  /** La foto como «data:» para guardarla en el celular si no hay señal. */
  const comoDataUrl = (blob: Blob) =>
    new Promise<string>((ok, mal) => {
      type Lector = {
        result: unknown;
        onload: (() => void) | null;
        onerror: (() => void) | null;
        readAsDataURL: (b: Blob) => void;
      };
      const lector = new (globalThis as unknown as { FileReader: new () => Lector }).FileReader();
      lector.onload = () => ok(String(lector.result));
      lector.onerror = () => mal(new Error('foto'));
      lector.readAsDataURL(blob);
    });

  /**
   * Sin señal o con un error pasajero del servidor, la entrega se guarda en la cola y se reintenta
   * sola (C-COLA-ERROR-PASAJERO); si el servidor la rechaza de verdad, se muestra el motivo.
   */
  async function guardarSiSinSenal(x: unknown, p: Omit<Pendiente, 'id' | 'creadoEn'>) {
    if (!sePuedeReintentar(x)) return false;
    await cola.agregar(p);
    setPendientes(await cola.listar()); // la tarjeta «Pendiente de confirmar» lo explica
    return true;
  }

  // Al salir de la pantalla (cerrar sesión, cambiar de cuenta) el GPS de fondo se apaga.
  useEffect(() => () => void detenerUbicacionFondo(), []);

  // Mientras está conectado, la ubicación se manda cada vez que se mueve (solo con la app abierta).
  useEffect(() => {
    if (!estado?.conectado) {
      vigilante.current?.remove();
      vigilante.current = null;
      void detenerUbicacionFondo();
      return;
    }
    let vivo = true;
    // GPS en segundo plano (punto 23): sigue mandando posición con la pantalla apagada o detrás del mapa.
    void iniciarUbicacionFondo({ titulo: tg.fondo.titulo, cuerpo: tg.fondo.cuerpo });
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 30, timeInterval: 10_000 },
      (p) => {
        setAqui({ lat: p.coords.latitude, lng: p.coords.longitude });
        setPrecision(p.coords.accuracy ?? null);
        void api
          .pedir('POST', '/datos/repartidor/ubicacion', {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
            precision: p.coords.accuracy ?? null,
          })
          .catch(() => undefined);
      },
    ).then((s) => {
      if (vivo) vigilante.current = s;
      else s.remove();
    });
    return () => {
      vivo = false;
      vigilante.current?.remove();
      vigilante.current = null;
    };
  }, [estado?.conectado, api, tg.fondo.titulo, tg.fondo.cuerpo]);

  // En camino: la ubicación se revisa cada 5 segundos para saber si ya llegó a la puerta.
  const enCamino = estado?.activo?.estado === 'en_camino';
  useEffect(() => {
    if (!enCamino) return;
    let vivo = true;
    const leer = async () => {
      const p = await ubicacionConLimite();
      if (!vivo || !p) return;
      setAqui({ lat: p.coords.latitude, lng: p.coords.longitude });
      setPrecision(p.coords.accuracy ?? null);
      await api
        .pedir('POST', '/datos/repartidor/ubicacion', {
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          precision: p.coords.accuracy ?? null,
        })
        .catch(() => undefined);
    };
    void leer();
    const reloj = setInterval(() => void leer(), 5000);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [enCamino, api]);

  /** Foto con la cámara + la ubicación de ese momento: así se prueba dónde y qué se entregó. */
  async function tomarFoto(ruta: string, frontal = false) {
    if (subiendo) return;
    setError('');
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) return setError(t.permisoCamara);
      const r = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        ...(frontal ? { cameraType: ImagePicker.CameraType.front } : {}),
      });
      const foto = r.canceled ? null : r.assets[0];
      if (!foto) return;
      setSubiendo(true);
      const p = await ubicacionConLimite();
      if (!p) return setError(t.ubicacionTarda);
      setAqui({ lat: p.coords.latitude, lng: p.coords.longitude });
      const blob = await (await fetch(foto.uri)).blob();
      const rutaCompleta = `${ruta}${ruta.includes('?') ? '&' : '?'}lat=${p.coords.latitude}&lng=${p.coords.longitude}`;
      try {
        await api.subirFoto(blob, rutaCompleta);
      } catch (x) {
        // Solo la entrega se guarda sin señal (la recogida la confirma el restaurante en persona).
        const esEntrega = ruta.includes('/entregado');
        if (
          !esEntrega ||
          !(await guardarSiSinSenal(x, {
            ruta: rutaCompleta,
            tipo: 'foto',
            cuerpo: await comoDataUrl(blob),
          }))
        )
          throw x;
      }
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      await cargar();
    } finally {
      setSubiendo(false);
    }
  }

  // Nunca en silencio: mientras busca la ubicación lo dice, y si algo falla se ve en pantalla.
  async function alternar() {
    if (cambiando) return;
    setError('');
    setAviso('');
    setCambiando(true);
    try {
      if (estado?.conectado) {
        await api.pedir('POST', '/datos/repartidor/conectar', { conectado: false });
        return await cargar();
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return setError(t.sinUbicacion);
      const p = await ubicacionConLimite();
      if (!p) return setError(t.ubicacionTarda);
      const r = await api.pedir<{ conectado: boolean; cobertura?: string }>(
        'POST',
        '/datos/repartidor/conectar',
        { conectado: true, lat: p.coords.latitude, lng: p.coords.longitude },
      );
      if (r.cobertura && r.cobertura !== 'dentro') setAviso(tg.pausa.fueraZona);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : t.ubicacionTarda);
    } finally {
      setCambiando(false);
    }
  }

  async function verificar(texto: string) {
    if (!estado?.activo) return;
    setError('');
    try {
      await api.pedir('POST', `/datos/repartidor/pedidos/${estado.activo.id}/verificar`, {
        codigo: texto.trim(),
      });
      setCodigo('');
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function escanear() {
    if (!permisoCamara?.granted) {
      const r = await pedirCamara();
      if (!r.granted) return setError(t.permisoCamara);
    }
    setEscaneando(true);
  }

  /** Entregado en mano: el cliente lo recibió; sin foto, pero solo en la puerta. */
  async function entregarEnMano() {
    if (!estado?.activo || subiendo) return;
    setError('');
    setSubiendo(true);
    try {
      const p = await ubicacionConLimite();
      if (!p) return setError(t.ubicacionTarda);
      const ruta = `/datos/repartidor/pedidos/${estado.activo.id}/entregado`;
      const cuerpo = {
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        modo: 'mano',
        ...(estado.activo.pinRequerido ? { pin: pinEntrega.trim() } : {}),
        ...(estado.activo.requiereEdad
          ? {
              mayorEdad,
              documento,
              documentoUltimos4: ultimos4.trim(),
              nombreRecibe: nombreRecibe.trim(),
            }
          : {}),
      };
      try {
        await api.pedir('POST', ruta, cuerpo);
      } catch (x) {
        if (!(await guardarSiSinSenal(x, { ruta, tipo: 'json', cuerpo: JSON.stringify(cuerpo) })))
          throw x;
      }
      setPinEntrega('');
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setSubiendo(false);
    }
  }

  // Fase 2 · cobro directo: lo que recibió del cliente, el saldo prepago y el código de recarga.
  const [montoCobro, setMontoCobro] = useState('');
  // Mayoría de edad (punto 24): documento revisado y quién recibió (queda en la evidencia de la entrega).
  const [documento, setDocumento] = useState<'licencia' | 'pasaporte' | 'otro'>('licencia');
  const [ultimos4, setUltimos4] = useState('');
  const [nombreRecibe, setNombreRecibe] = useState('');
  const [codigoRecarga, setCodigoRecarga] = useState('');
  const [prepago, setPrepago] = useState<{
    /** Moneda del país del repartidor (el saldo va en su unidad menor). */
    moneda?: string;
    disponible: number;
    reservado: number;
    efectivoActivo: boolean;
    transferenciaActiva: boolean;
    recargasPuntoVenta: boolean;
  } | null>(null);
  // Pedidos cobrados en mano de hoy: no pasan por la billetera de Stripe, así que «Hoy» los suma
  // desde Ganancias (C-MONEDA-RECORRIDO). Solo donde el país tiene el cobro en mano encendido.
  const [enManoHoy, setEnManoHoy] = useState<{ total: number; entregas: number; moneda: string }>({
    total: 0,
    entregas: 0,
    moneda: 'USD',
  });
  const cobroEnManoActivo = Boolean(prepago?.efectivoActivo || prepago?.transferenciaActiva);
  const movimientosVistos = billetera?.movimientos?.length ?? 0;
  const entregaActiva = estado?.activo?.id ?? null;
  useEffect(() => {
    if (!cobroEnManoActivo) return;
    let vivo = true;
    api
      .pedir<{
        pedidos: { entregadoEn: string; total: number; moneda: string; cobradoEnMano?: boolean }[];
      }>('GET', '/datos/repartidor/ganancias')
      .then((g) => {
        if (!vivo) return;
        const hoy = new Date().toLocaleDateString('en-CA');
        const de = g.pedidos.filter(
          (p) =>
            p.cobradoEnMano &&
            new Date(`${p.entregadoEn.replace(' ', 'T')}Z`).toLocaleDateString('en-CA') === hoy,
        );
        setEnManoHoy({
          total: de.reduce((x, p) => x + p.total, 0),
          entregas: de.length,
          moneda: de[0]?.moneda ?? prepago?.moneda ?? 'USD',
        });
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, cobroEnManoActivo, movimientosVistos, entregaActiva, prepago?.moneda]);
  const cargarPrepago = useCallback(async () => {
    try {
      setPrepago(await api.pedir('GET', '/datos/repartidor/saldo-prepago'));
    } catch {
      setPrepago(null);
    }
  }, [api]);
  useEffect(() => {
    if (vista !== 'billetera') return;
    let vivo = true;
    void (async () => {
      try {
        const s = await api.pedir<typeof prepago>('GET', '/datos/repartidor/saldo-prepago');
        if (vivo) setPrepago(s);
      } catch {
        if (vivo) setPrepago(null);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [vista, api]);
  async function cobre(pedidoId: string) {
    const monto = textoAMonto(montoCobro, activo?.moneda);
    if (!Number.isFinite(monto) || monto < 0) return setError(tg.prepago.codigo);
    setError('');
    try {
      await api.pedir('POST', `/datos/repartidor/pedidos/${pedidoId}/cobre`, {
        montoRecibido: monto,
        nota: '',
      });
      setAviso(tg.pedido.cobroOk);
      setMontoCobro('');
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  async function noPago(pedidoId: string) {
    if (!(await confirmar(tg.pedido.noPagoConfirmar))) return;
    await accion(`/datos/repartidor/pedidos/${pedidoId}/no-pago`, { motivo: tg.pedido.noPago });
  }
  async function canjear() {
    setError('');
    try {
      await api.pedir('POST', '/datos/repartidor/recargar', { codigo: codigoRecarga.trim() });
      setAviso(tg.prepago.canjeado);
      setCodigoRecarga('');
      await cargarPrepago();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  /** Acciones de viajes: llevan su clave de idempotencia (el servidor la exige). */
  async function accionViaje(ruta: string) {
    setError('');
    try {
      await api.pedir(
        'POST',
        ruta,
        {},
        {
          cabeceras: {
            'idempotency-key': `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
          },
        },
      );
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
    await cargar();
  }

  async function accion(ruta: string, cuerpo: unknown = {}) {
    setError('');
    try {
      await api.pedir('POST', ruta, cuerpo);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      await cargar();
    }
  }

  /** «Llegué al restaurante»: manda la posición de ahora; si está lejos, dice a cuántos metros. */
  async function llegue(pedidoId: string) {
    setError('');
    try {
      const p = await ubicacionConLimite();
      if (!p) return setError(t.ubicacionTarda);
      const r = await api.pedir<{ llegue: boolean; metros: number }>(
        'POST',
        `/datos/repartidor/pedidos/${pedidoId}/llegue`,
        { lat: p.coords.latitude, lng: p.coords.longitude },
      );
      if (r.llegue) setAviso(tg.pedido.llegueOk);
      else setError(tg.pedido.llegueLejos.replace('{m}', String(r.metros)));
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function banco() {
    try {
      const r = await api.pedir<{ url: string }>('POST', '/datos/billetera/conectar', {});
      await Linking.openURL(r.url);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function retirar() {
    if (!billetera) return;
    try {
      const r = await api.pedir<{ retiro?: { estado?: string } }>(
        'POST',
        '/datos/billetera/retirar',
        {
          montoCentavos: billetera.saldo,
        },
      );
      // Fase 0: si Stripe todavía no confirmó, se dice «en proceso», no «retirado».
      setAviso(r.retiro?.estado === 'en_proceso' ? t.retiroEnProceso : t.retirado);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const activo = estado?.activo;
  // Verificar el pedido en el restaurante: escanear el QR de su pantalla o escribir el número.
  const bloqueCodigo =
    activo && activo.estado === 'listo' ? (
      activo.verificado ? (
        <Text
          style={{ marginTop: 10, color: C.exito, fontWeight: '700' }}
          accessibilityRole="alert"
        >
          {t.verificadoOk}
        </Text>
      ) : (
        <>
          {Platform.OS !== 'web' ? (
            <Boton texto={t.escanear} alTocar={() => void escanear()} exito />
          ) : null}
          <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: 6 }}>{t.escribirCodigo}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput
              value={codigo}
              onChangeText={(x) => setCodigo(x.toUpperCase().slice(0, 4))}
              placeholder="A1B2"
              accessibilityLabel={t.escribirCodigo}
              autoCapitalize="characters"
              style={[e.input, { flex: 1, letterSpacing: 4 }]}
            />
            <View style={{ width: 120 }}>
              <Boton texto={t.verificar} alTocar={() => void verificar(codigo)} secundario />
            </View>
          </View>
        </>
      )
    ) : null;
  const mensajes = (
    <>
      {error || errorCarga ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error || errorCarga}
        </Text>
      ) : null}
      {estado?.selfieControlPendiente ? (
        <View style={[e.tarjeta, { borderWidth: 2, borderColor: C.primario }]}>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>{t.selfieControl}</Text>
          <Text style={{ color: '#5E5E5E', fontSize: 13, marginBottom: 6 }}>
            {t.selfieControlAyuda}
          </Text>
          <Boton
            texto={subiendo ? t.subiendo : t.tomarSelfie}
            alTocar={() =>
              void tomarFoto('/datos/kyc/selfie-control', true).then(() => setAviso(t.selfieLista))
            }
            cargando={subiendo}
          />
        </View>
      ) : null}
      {pendientes.length ? (
        <View style={[e.tarjeta, { borderColor: '#B26A00' }]}>
          <Text style={{ color: '#B26A00', fontWeight: '800' }}>
            {t.pendientes}: {pendientes.length}
          </Text>
          <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.pendienteConfirmar}</Text>
        </View>
      ) : null}
      {aviso ? (
        <Text
          style={{ color: '#0d7a3a', fontWeight: '700', marginBottom: 8 }}
          accessibilityRole="alert"
        >
          {aviso}
        </Text>
      ) : null}
    </>
  );

  // ───────── Diseño nuevo (14 oct 2026): datos reales de hoy, tiempo conectado en esta sesión ─────────
  const hoyLocal = new Date().toLocaleDateString('en-CA');
  const deHoy = (billetera?.movimientos ?? []).filter(
    (m) => new Date(`${m.fecha.replace(' ', 'T')}Z`).toLocaleDateString('en-CA') === hoyLocal,
  );
  const gananciasHoy = deHoy
    .filter((m) => m.concepto !== 'retiro' && m.monto > 0)
    .reduce((x, m) => x + m.monto, 0);
  const entregasHoy =
    new Set(deHoy.filter((m) => m.concepto === 'entrega').map((m) => m.pedidoId)).size +
    enManoHoy.entregas;
  const segundosConectado =
    estado?.conectado && conectadoDesde
      ? Math.max(0, Math.floor((tic - conectadoDesde) / 1000))
      : 0;
  const objetivo =
    activo?.estado === 'en_camino'
      ? activo.lat != null && activo.lng != null
        ? { lat: activo.lat, lng: activo.lng }
        : null
      : activo?.restaurante.lat != null && activo?.restaurante.lng != null
        ? { lat: activo.restaurante.lat, lng: activo.restaurante.lng }
        : null;
  const metrosObjetivo = aqui && objetivo ? metrosEntre(aqui, objetivo) : null;
  const distanciaTexto =
    metrosObjetivo == null
      ? ''
      : idioma === 'en'
        ? `${(metrosObjetivo / 1609.34).toFixed(1)} mi`
        : metrosObjetivo < 1000
          ? `${metrosObjetivo} ${td.metros}`
          : `${(metrosObjetivo / 1000).toFixed(1)} ${td.km}`;
  const pasoActivo: 0 | 1 | 2 = activo?.estado === 'en_camino' ? (activo.llegoCliente ? 2 : 1) : 0;
  const marcadoresOfertas = ofertas
    .filter((o) => o.restaurante.lat != null && o.restaurante.lng != null)
    .map((o) => ({
      id: o.id,
      punto: { lat: o.restaurante.lat as number, lng: o.restaurante.lng as number },
      nombre: o.restaurante.nombre,
    }));
  const etiquetasMapa = { yo: td.tuUbicacion, restaurante: t.recoger, casa: t.entregar };
  const lienzo = (pestana: Pestana, cuerpo: ReactNode, sinScroll = false) => (
    <SafeAreaView
      style={[e.fondo, { backgroundColor: '#F4F6F9' }]}
      edges={['top', 'left', 'right']}
    >
      <CabeceraDriver
        idioma={idioma}
        cambiarIdioma={cambiarIdioma}
        alMenu={() => setMenuAbierto((x) => !x)}
        alCampana={() => setVista('avisos')}
        punto={Boolean(estado?.selfieControlPendiente || pendientes.length)}
      />
      {menuAbierto ? (
        <View style={[e.tarjeta, { marginHorizontal: 16, marginTop: 8 }]}>
          {(
            [
              ['inicio', t.vistaInicio],
              ['miRuta', t.vistaMiRuta],
              ['billetera', t.vistaBilletera],
              ['datos', t.vistaDatos],
            ] as const
          ).map(([v, texto]) => (
            <Text
              key={v}
              style={{ paddingVertical: 10, fontWeight: vista === v ? '800' : '600' }}
              onPress={() => {
                setVista(v);
                setMenuAbierto(false);
              }}
              accessibilityRole="button"
            >
              {texto}
            </Text>
          ))}
        </View>
      ) : null}
      {sinScroll ? (
        <View style={{ flex: 1 }}>{cuerpo}</View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {cuerpo}
        </ScrollView>
      )}
      <BarraInferior
        idioma={idioma}
        activa={pestana}
        alTocar={(p) => setVista(p === 'ganancias' ? 'billetera' : p === 'perfil' ? 'datos' : p)}
      />
      <ModalMuyPronto visible={pronto} cerrar={() => setPronto(false)} idioma={idioma} />
      <Modal visible={escaneando} animationType="slide" onRequestClose={() => setEscaneando(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              setEscaneando(false);
              void verificar(data);
            }}
          />
          <View style={{ padding: 16 }}>
            <Boton texto={t.cerrar} alTocar={() => setEscaneando(false)} secundario />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  // ───────── Ganancias: Hoy / Semana / Mes con los movimientos reales, y la billetera ─────────
  if (vista === 'billetera' && billetera) {
    const ahora = new Date();
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - ((ahora.getDay() + 6) % 7));
    inicioSemana.setHours(0, 0, 0, 0);
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const movs = (billetera.movimientos ?? []).filter(
      (m) => m.concepto !== 'retiro' && m.monto > 0,
    );
    const fechaDe = (m: { fecha: string }) => new Date(`${m.fecha.replace(' ', 'T')}Z`);
    const enPeriodo = movs.filter((m) =>
      periodo === 'hoy'
        ? fechaDe(m).toLocaleDateString('en-CA') === hoyLocal
        : periodo === 'semana'
          ? fechaDe(m) >= inicioSemana
          : fechaDe(m) >= inicioMes,
    );
    const total = enPeriodo.reduce((x, m) => x + m.monto, 0);
    const porPedido = new Map<string, { monto: number; fecha: string }>();
    for (const m of enPeriodo) {
      const k = m.pedidoId ?? m.id;
      const prev = porPedido.get(k);
      porPedido.set(k, { monto: (prev?.monto ?? 0) + m.monto, fecha: prev?.fecha ?? m.fecha });
    }
    return lienzo(
      'ganancias',
      <View style={{ padding: 16, gap: 12 }}>
        {mensajes}
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>{td.ganancias}</Text>
        {prepago &&
        (prepago.efectivoActivo || prepago.transferenciaActiva || prepago.recargasPuntoVenta) ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: '#2a2a2a',
              borderRadius: 12,
              padding: 12,
              gap: 8,
              backgroundColor: '#fff',
            }}
            testID="saldo-prepago"
          >
            <Text style={{ fontWeight: '900', color: C.secundario }}>{tg.prepago.titulo}</Text>
            <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{tg.prepago.ayuda}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.secundario }}>{tg.prepago.disponible}</Text>
              <Text
                style={{
                  fontWeight: '900',
                  color: prepago.disponible > 0 ? '#0D7A3A' : C.primario,
                }}
              >
                {formatearMonto(prepago.disponible, prepago.moneda, idioma)}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.secundario }}>{tg.prepago.reservado}</Text>
              <Text style={{ fontWeight: '800', color: C.secundario }}>
                {formatearMonto(prepago.reservado, prepago.moneda, idioma)}
              </Text>
            </View>
            {prepago.disponible <= 0 ? (
              <Text style={{ color: C.primario, fontSize: 12 }}>{tg.prepago.sinSaldo}</Text>
            ) : null}
            {prepago.recargasPuntoVenta ? (
              <>
                <TextInput
                  value={codigoRecarga}
                  onChangeText={setCodigoRecarga}
                  placeholder={tg.prepago.codigo}
                  accessibilityLabel={tg.prepago.codigo}
                  autoCapitalize="characters"
                  style={e.input}
                />
                <Boton texto={tg.prepago.canjear} alTocar={() => void canjear()} />
              </>
            ) : null}
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['hoy', 'semana', 'mes'] as const).map((pz) => (
            <Pressable
              key={pz}
              onPress={() => setPeriodo(pz)}
              accessibilityRole="tab"
              accessibilityState={{ selected: periodo === pz }}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: periodo === pz ? C.primario : '#fff',
              }}
            >
              <Text style={{ fontWeight: '700', color: periodo === pz ? '#fff' : C.secundario }}>
                {pz === 'hoy' ? td.hoy : pz === 'semana' ? td.semana : td.mes}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={e.tarjeta}>
          <Text style={{ color: '#5E5E5E', fontWeight: '600' }}>
            {periodo === 'hoy'
              ? td.totalDe.hoy
              : periodo === 'semana'
                ? td.totalDe.semana
                : td.totalDe.mes}
          </Text>
          <Text style={{ fontSize: 34, fontWeight: '900', color: C.secundario }}>
            {/* Billetera de Stripe: solo pedidos con tarjeta, hoy siempre en USD. */}
            {formatearMonto(total, 'USD', idioma)}
          </Text>
          <Text style={{ color: '#5E5E5E' }}>
            {porPedido.size} {td.entregas.toLowerCase()}
            {periodo === 'hoy' && segundosConectado
              ? ` · ${Math.floor(segundosConectado / 3600)}h ${Math.floor((segundosConectado % 3600) / 60)}m`
              : ''}
          </Text>
        </View>
        <Ganancias api={api} idioma={idioma} periodo={periodo} />
        <BilleteraRepartidor
          datos={billetera}
          idioma={idioma}
          retirar={() => void retirar()}
          conectar={() => void banco()}
        />
      </View>,
    );
  }

  // ───────── Como los grandes (18 oct 2026): calificaciones, avisos y alta guiada ─────────
  if (vista === 'calificaciones')
    return lienzo('perfil', <Calificaciones api={api} idioma={idioma} />);
  if (vista === 'avisos') return lienzo('inicio', <Avisos api={api} idioma={idioma} />);
  // Divoox Flex: las rutas de paquetes de las empresas (una ruta = un solo trabajo activo).
  if (vista === 'miRuta')
    return lienzo(
      'pedidos',
      <MiRuta key={rutaDelAviso ?? 'lista'} api={api} idioma={idioma} abrirRutaId={rutaDelAviso} />,
    );
  if (vista === 'alta')
    return lienzo(
      'perfil',
      <Alta
        api={api}
        idioma={idioma}
        abrir={(paso) => {
          if (paso === 'banco') {
            setVista('billetera');
            return;
          }
          setVista('datos');
          setSeccionPerfil(paso === 'datos' ? 'vehiculo' : 'documentos');
        }}
      />,
    );

  // ───────── Pedidos: el historial real de entregas ─────────
  if (vista === 'pedidos') {
    const entregas = (billetera?.movimientos ?? []).filter((m) => m.concepto === 'entrega');
    return lienzo(
      'pedidos',
      <View style={{ padding: 16, gap: 12 }}>
        {mensajes}
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>
          {td.nav.pedidos}
        </Text>
        <Pressable
          onPress={() => setVista('miRuta')}
          accessibilityRole="button"
          style={[e.tarjeta, { borderWidth: 1, borderColor: '#2a2a2a' }]}
        >
          <Text style={{ fontWeight: '900', color: C.secundario }}>{t.vistaMiRuta}</Text>
          <Text style={{ color: '#5E5E5E' }}>{t.miRutaAyuda}</Text>
        </Pressable>
        {entregas.length === 0 ? (
          <Text style={{ color: '#5E5E5E' }}>{td.sinPedidos}</Text>
        ) : (
          entregas.map((m) => (
            <View
              key={m.id}
              style={[e.tarjeta, { flexDirection: 'row', justifyContent: 'space-between' }]}
            >
              <View>
                <Text style={{ fontWeight: '800', color: C.secundario }}>
                  #{(m.pedidoId ?? m.id).slice(0, 4).toUpperCase()}
                </Text>
                <Text style={{ color: '#5E5E5E', fontSize: 12 }}>
                  {new Date(`${m.fecha.replace(' ', 'T')}Z`).toLocaleString(
                    idioma === 'en' ? 'en-US' : 'es-US',
                    { dateStyle: 'medium', timeStyle: 'short' },
                  )}
                </Text>
              </View>
              <Text style={{ fontWeight: '900', color: C.secundario }}>
                {formatearMonto(m.monto, 'USD', idioma)}
              </Text>
            </View>
          ))
        )}
      </View>,
    );
  }

  // ───────── Perfil: datos, vehículo, documentos, idioma, soporte, salir ─────────
  if (vista === 'datos') {
    const iniciales = (usuario?.nombre ?? '')
      .split(' ')
      .slice(0, 2)
      .map((x) => x[0] ?? '')
      .join('')
      .toUpperCase();
    const fila = (nombre: string, alTocar: () => void, abierto = false, detalle?: string) => (
      <Pressable
        onPress={alTocar}
        accessibilityRole="button"
        accessibilityLabel={nombre}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: '#EEF0F3',
        }}
      >
        <View>
          <Text style={{ fontWeight: '700', color: C.secundario }}>{nombre}</Text>
          {detalle ? <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{detalle}</Text> : null}
        </View>
        <Text style={{ color: '#8A8A8A', fontSize: 18 }}>{abierto ? '˅' : '›'}</Text>
      </Pressable>
    );
    return lienzo(
      'perfil',
      <View style={{ padding: 16, gap: 12 }}>
        {mensajes}
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <View
            style={{
              width: 92,
              height: 92,
              borderRadius: 46,
              backgroundColor: C.primario,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontSize: 34, fontWeight: '900' }}>{iniciales}</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario, marginTop: 8 }}>
            {usuario?.nombre}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text style={{ color: '#5E5E5E' }}>{td.repartidor}</Text>
            <View
              style={{
                backgroundColor: kycAprobado ? '#E6F4EC' : '#F4F5F7',
                borderRadius: 999,
                paddingHorizontal: 10,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '700',
                  color: kycAprobado ? C.exito : '#5E5E5E',
                }}
              >
                {kycAprobado ? td.verificado : td.sinVerificar}
              </Text>
            </View>
          </View>
        </View>
        <View style={[e.tarjeta, { paddingVertical: 2 }]}>
          {fila(
            td.miVehiculo,
            () => setSeccionPerfil((x) => (x === 'vehiculo' ? null : 'vehiculo')),
            seccionPerfil === 'vehiculo',
          )}
          {seccionPerfil === 'vehiculo' ? <MisDatos /> : null}
          {fila(
            td.documentos,
            () => setSeccionPerfil((x) => (x === 'documentos' ? null : 'documentos')),
            seccionPerfil === 'documentos',
          )}
          {seccionPerfil === 'documentos' ? <Verificacion /> : null}
          {fila(tg.calif.titulo, () => setVista('calificaciones'))}
          {fila(tg.alta.titulo, () => setVista('alta'))}
          {fila(
            td.idioma,
            () => cambiarIdioma(idioma === 'es' ? 'en' : 'es'),
            false,
            idioma === 'es' ? 'Español' : 'English',
          )}
          {fila(
            td.soporte,
            () => setSeccionPerfil((x) => (x === 'soporte' ? null : 'soporte')),
            seccionPerfil === 'soporte',
          )}
          {seccionPerfil === 'soporte' ? (
            <View style={{ paddingVertical: 8 }}>
              <ReportarProblema pedidoId={estado?.activo?.id} />
              <MenuCuenta />
            </View>
          ) : null}
        </View>
        <Boton texto={tm.salir} alTocar={() => void salir()} secundario />
      </View>,
    );
  }

  // ───────── Divoox Moto (M4): el viaje en curso ocupa el inicio, como Uber Driver ─────────
  if (viajeActivo && vista === 'inicio')
    return lienzo(
      'inicio',
      <ViajeActivo
        api={{
          pedir: async (metodo, ruta, cuerpo, extra) => {
            // Antes de «Llegué», la posición de AHORA (el servidor exige estar en la recogida).
            if (ruta.endsWith('/llegue')) {
              const p = await ubicacionConLimite();
              if (p)
                await api
                  .pedir('POST', '/datos/repartidor/ubicacion', {
                    lat: p.coords.latitude,
                    lng: p.coords.longitude,
                    precision: p.coords.accuracy ?? null,
                  })
                  .catch(() => undefined);
            }
            return api.pedir(metodo, ruta, cuerpo, extra);
          },
        }}
        idioma={idioma}
        viaje={viajeActivo}
        alCambiar={() => void cargar()}
      />,
    );

  // ───────── Inicio: pedido activo (cabecera roja con distancia, mapa, progreso) o mapa con ofertas ─────────
  if (activo) {
    const casaActivo =
      activo.lat != null && activo.lng != null ? { lat: activo.lat, lng: activo.lng } : null;
    const restActivo =
      activo.restaurante.lat != null && activo.restaurante.lng != null
        ? { lat: activo.restaurante.lat, lng: activo.restaurante.lng }
        : null;
    return lienzo(
      'inicio',
      <View>
        <View style={{ backgroundColor: C.primario, paddingHorizontal: 16, paddingVertical: 14 }}>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>
            {distanciaTexto || (activo.estado === 'en_camino' ? td.entregaEn : td.recogeEn)}
          </Text>
          <Text style={{ color: '#fff', fontWeight: '700' }} numberOfLines={1}>
            {activo.estado === 'en_camino' ? activo.direccion : activo.restaurante.direccion}
          </Text>
        </View>
        <Mapa
          yo={aqui}
          restaurante={restActivo}
          casa={activo.estado === 'en_camino' ? casaActivo : null}
          alto={220}
          etiquetas={etiquetasMapa}
        />
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            marginTop: -18,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}>
            <Image
              source={IMG.comida}
              style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: '#F4F5F7' }}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#5E5E5E', fontSize: 12 }}>
                {activo.estado === 'en_camino' ? td.entregaEn : td.recogeEn}
              </Text>
              <Text
                style={{ fontWeight: '900', fontSize: 17, color: C.secundario }}
                numberOfLines={1}
              >
                {activo.estado === 'en_camino' ? activo.direccion : activo.restaurante.nombre}
              </Text>
              <Text style={{ color: '#5E5E5E', fontSize: 12 }} numberOfLines={1}>
                {activo.estado === 'en_camino' ? activo.notas || '' : activo.restaurante.direccion}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingBottom: 8 }}>
            <BotonRedondo
              glifo="mapa"
              nombre={td.abrirMapas}
              alTocar={() =>
                activo.estado === 'en_camino'
                  ? abrirMapa(activo.lat, activo.lng, activo.direccion)
                  : abrirMapa(
                      activo.restaurante.lat,
                      activo.restaurante.lng,
                      activo.restaurante.direccion,
                    )
              }
            />
            <BotonRedondo
              glifo="llamar"
              nombre={td.llamar}
              alTocar={() =>
                activo.estado === 'en_camino' || activo.estado === 'listo'
                  ? void api
                      .pedir('POST', `/datos/pedidos/${activo.id}/llamar`, {})
                      .then(() => setAviso(t.llamandoCliente))
                      .catch((x: unknown) =>
                        setError(x instanceof ErrorApi ? x.message : String(x)),
                      )
                  : activo.restaurante.telefono
                    ? void Linking.openURL(`tel:${activo.restaurante.telefono}`)
                    : undefined
              }
            />
            <BotonRedondo
              glifo="mensaje"
              nombre={td.mensaje}
              alTocar={() => setMostrarChat((x) => !x)}
            />
          </View>
          <Progreso idioma={idioma} paso={pasoActivo} />
        </View>
        <View style={{ padding: 16 }}>
          {mensajes}
          <>
            <View style={e.tarjeta}>
              <Text style={{ fontWeight: '800', fontSize: 18 }}>
                {t.pedido} #{activo.id.slice(0, 4).toUpperCase()} ·{' '}
                {formatearMonto(activo.pagoRepartidor, activo.moneda, idioma)}
              </Text>
              {activo.lineas.map((l) => (
                <Text key={l.platoId}>
                  {l.cantidad} × {textoLinea(l, idioma)}
                </Text>
              ))}
              {activo.estado !== 'en_camino' && !activo.llegoRestaurante ? (
                <Boton texto={tg.pedido.llegue} alTocar={() => void llegue(activo.id)} exito />
              ) : null}
              {activo.estado === 'aceptado' && activo.llegoRestaurante ? (
                <Boton
                  texto={tg.pedido.noListo}
                  alTocar={() =>
                    void api
                      .pedir('POST', `/datos/repartidor/pedidos/${activo.id}/no-esta-listo`, {})
                      .then(() => setAviso(tg.pedido.noListoOk))
                      .catch((x: unknown) =>
                        setError(x instanceof ErrorApi ? x.message : String(x)),
                      )
                  }
                  secundario
                />
              ) : null}
              {ayudaAbierta ? (
                <AyudaPedido
                  api={api}
                  idioma={idioma}
                  pedidoId={activo.id}
                  alCerrar={() => setAyudaAbierta(false)}
                />
              ) : (
                <Boton texto={tg.pedido.ayuda} alTocar={() => setAyudaAbierta(true)} secundario />
              )}
              {activo.estado !== 'en_camino' ? (
                <>
                  <Text style={{ marginTop: 10, fontWeight: '700' }}>
                    {t.recoger}: {activo.restaurante.nombre}
                  </Text>
                  <Text>{activo.restaurante.direccion}</Text>
                  <Boton
                    texto={t.comoLlegar}
                    alTocar={() =>
                      abrirMapa(
                        activo.restaurante.lat,
                        activo.restaurante.lng,
                        activo.restaurante.direccion,
                      )
                    }
                    secundario
                  />
                  {activo.restaurante.telefono ? (
                    <Boton
                      texto={t.llamar}
                      alTocar={() => void Linking.openURL(`tel:${activo.restaurante.telefono}`)}
                      secundario
                    />
                  ) : null}
                  {activo.metodoPago &&
                  activo.metodoPago !== 'tarjeta' &&
                  (activo.estado === 'aceptado' || activo.estado === 'listo') ? (
                    <PagoEnLocal
                      api={api}
                      idioma={idioma}
                      pedidoId={activo.id}
                      alRegistrar={() => void cargar()}
                      fotoTicket={() =>
                        tomarFoto(`/datos/repartidor/pedidos/${activo.id}/foto-ticket`)
                      }
                    />
                  ) : null}
                  {activo.estado === 'listo' && activo.fotoRecogida ? (
                    <>
                      {bloqueCodigo}
                      <Text
                        style={{ marginTop: 10, color: C.exito, fontWeight: '700' }}
                        accessibilityRole="alert"
                      >
                        {activo.verificado ? t.verificadoOk : t.esperaConfirmacion}
                      </Text>
                      <Boton
                        texto={subiendo ? t.subiendo : t.repetirFoto}
                        alTocar={() =>
                          void tomarFoto(`/datos/repartidor/pedidos/${activo.id}/foto-recogida`)
                        }
                        cargando={subiendo}
                        secundario
                      />
                    </>
                  ) : activo.estado === 'listo' ? (
                    <>
                      {bloqueCodigo}
                      <Boton
                        texto={subiendo ? t.subiendo : t.fotoRecogida}
                        alTocar={() =>
                          void tomarFoto(`/datos/repartidor/pedidos/${activo.id}/foto-recogida`)
                        }
                        cargando={subiendo}
                        exito={!!activo.verificado}
                        secundario={!activo.verificado}
                      />
                      <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.fotoRecogidaAyuda}</Text>
                    </>
                  ) : (
                    <Text style={{ marginTop: 8, color: '#5E5E5E' }}>
                      {t.esperando}
                      {activo.minutosParaListo
                        ? ` ${t.listoEn} ${activo.minutosParaListo} min.`
                        : ''}
                    </Text>
                  )}
                  {/* Soltar antes de recoger: vuelve a la fila de ofertas, sin castigo. */}
                  <View
                    style={{
                      marginTop: 14,
                      borderTopWidth: 1,
                      borderTopColor: '#E6E6E6',
                      paddingTop: 8,
                    }}
                  >
                    <Text style={{ fontWeight: '700' }}>{t.noPuedo}</Text>
                    <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.motivo}</Text>
                    <TextInput
                      value={motivo}
                      onChangeText={setMotivo}
                      placeholder={t.motivo}
                      accessibilityLabel={t.motivo}
                      style={[e.input, { marginTop: 6 }]}
                    />
                    {motivo.trim() ? (
                      <Boton
                        texto={t.soltar}
                        alTocar={() =>
                          void accion(`/datos/repartidor/pedidos/${activo.id}/soltar`, {
                            motivo: motivo.trim(),
                          }).then(() => setMotivo(''))
                        }
                        secundario
                      />
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <Text style={{ marginTop: 10, fontWeight: '700' }}>{t.entregar}:</Text>
                  <Text>{activo.direccion}</Text>
                  {activo.notas ? (
                    <Text style={{ color: '#5E5E5E' }}>
                      {t.notas}: {activo.notas}
                    </Text>
                  ) : null}
                  <Text style={{ fontWeight: '700', marginTop: 4 }}>
                    {t.pidio[activo.entrega ?? 'puerta']}
                  </Text>
                  {(() => {
                    const casa =
                      activo.lat != null && activo.lng != null
                        ? { lat: activo.lat, lng: activo.lng }
                        : null;
                    // Al llegar a la puerta se quita «Cómo llegar» y aparece la foto de la entrega.
                    // Lo decide el servidor (dos lecturas precisas del GPS) o soporte con la excepción.
                    const enPuerta =
                      Boolean(activo.llegoCliente) || activo.excepcionUbicacion === 'autorizada';
                    if (!enPuerta) {
                      const m = aqui && casa ? metrosEntre(aqui, casa) : null;
                      const cerca = llego(aqui, casa);
                      const falta =
                        m == null
                          ? ''
                          : idioma === 'en'
                            ? `${(m / 1609.34).toFixed(1)} mi`
                            : m < 1000
                              ? `${m} m`
                              : `${(m / 1000).toFixed(1)} km`;
                      return (
                        <>
                          <Boton
                            texto={t.comoLlegar}
                            alTocar={() => abrirMapa(activo.lat, activo.lng, activo.direccion)}
                            exito
                          />
                          {cerca ? (
                            <Text style={{ color: '#0D7A3A', fontWeight: '700', fontSize: 13 }}>
                              {t.confirmandoGps}
                              {precision != null && precision > PRECISION_MAXIMA_M
                                ? ` ${t.gpsImpreciso} (±${Math.round(precision)} m).`
                                : ''}
                            </Text>
                          ) : (
                            <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
                              {falta ? `${t.teFaltan} ${falta}. ` : ''}
                              {t.alLlegar}
                            </Text>
                          )}
                          {activo.excepcionUbicacion === 'pedida' ? (
                            <Text style={{ color: '#B26A00', fontWeight: '700', marginTop: 8 }}>
                              {t.esperandoSoporte}
                            </Text>
                          ) : (
                            <View style={{ marginTop: 10 }}>
                              <Text style={{ fontWeight: '700' }}>{t.sinGps}</Text>
                              <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
                                {t.sinGpsAyuda}
                              </Text>
                              <TextInput
                                value={motivoGps}
                                onChangeText={setMotivoGps}
                                placeholder={t.sinGpsAyuda}
                                accessibilityLabel={t.sinGpsAyuda}
                                style={[e.input, { marginTop: 6 }]}
                              />
                              {motivoGps.trim().length >= 5 ? (
                                <Boton
                                  texto={t.pedirExcepcion}
                                  alTocar={() =>
                                    void accion(
                                      `/datos/repartidor/pedidos/${activo.id}/no-puedo-confirmar`,
                                      { motivo: motivoGps.trim() },
                                    ).then(() => setMotivoGps(''))
                                  }
                                  secundario
                                />
                              ) : null}
                            </View>
                          )}
                        </>
                      );
                    }
                    // En la puerta. En mano: el cliente lo recibe (sin foto). En la puerta: foto.
                    const enMano = activo.entrega === 'mano';
                    const avisoMs = activo.noApareceEn
                      ? Date.parse(`${activo.noApareceEn.replace(' ', 'T')}Z`)
                      : null;
                    const faltanSeg =
                      avisoMs == null
                        ? null
                        : Math.max(0, Math.ceil((avisoMs + 5 * 60_000 - tic) / 1000));
                    return (
                      <>
                        {activo.excepcionUbicacion === 'autorizada' && !activo.llegoCliente ? (
                          <Text style={{ color: '#0D7A3A', fontWeight: '700', fontSize: 13 }}>
                            {t.autorizado}
                          </Text>
                        ) : null}
                        {activo.metodoPago && activo.metodoPago !== 'tarjeta' ? (
                          <View
                            style={{
                              borderWidth: 1,
                              borderColor: '#2a2a2a',
                              borderRadius: 12,
                              padding: 12,
                              gap: 8,
                              backgroundColor: '#fff',
                            }}
                            testID="cobro-directo"
                          >
                            <Text style={{ fontWeight: '900', color: C.secundario }}>
                              {tg.pedido.cobrar}
                            </Text>
                            {activo.cobroEstado && activo.cobroEstado !== 'pendiente' ? (
                              <Text style={{ color: '#0D7A3A', fontWeight: '700' }}>
                                {tg.pedido.cobroOk}
                              </Text>
                            ) : (
                              <>
                                <Text style={{ color: '#5E5E5E' }}>
                                  {activo.metodoPago === 'efectivo'
                                    ? tg.pedido.cobrarEfectivo
                                    : tg.pedido.cobrarTransfer}{' '}
                                  <Text style={{ fontWeight: '900', color: C.secundario }}>
                                    {formatearMonto(
                                      (activo.total ?? 0) - activo.propina,
                                      activo.moneda,
                                      idioma,
                                    )}
                                  </Text>
                                </Text>
                                <Text style={{ color: '#5E5E5E', fontSize: 12 }}>
                                  {tg.pedido.propinaAparte}
                                </Text>
                                <TextInput
                                  value={montoCobro}
                                  onChangeText={setMontoCobro}
                                  placeholder={tg.pedido.recibi}
                                  accessibilityLabel={tg.pedido.recibi}
                                  keyboardType="decimal-pad"
                                  style={e.input}
                                />
                                <Boton
                                  texto={tg.pedido.cobre}
                                  alTocar={() => void cobre(activo.id)}
                                  exito
                                />
                                {activo.metodoPago === 'transferencia_repartidor' ? (
                                  <Boton
                                    texto={tg.pedido.transferPendiente}
                                    alTocar={() =>
                                      void accion(
                                        `/datos/repartidor/pedidos/${activo.id}/transferencia-pendiente`,
                                        { nota: '' },
                                      ).then(() => setAviso(tg.pedido.transferPendienteOk))
                                    }
                                    secundario
                                  />
                                ) : null}
                                <Boton
                                  texto={tg.pedido.noPago}
                                  alTocar={() => void noPago(activo.id)}
                                  secundario
                                />
                              </>
                            )}
                          </View>
                        ) : null}
                        <Boton
                          texto={subiendo ? t.subiendo : t.fotoEntrega}
                          alTocar={() =>
                            void tomarFoto(`/datos/repartidor/pedidos/${activo.id}/entregado`)
                          }
                          cargando={subiendo}
                          exito={!enMano}
                          secundario={enMano}
                        />
                        <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.sinCaras}</Text>
                        {activo.pinRequerido ? (
                          <TextInput
                            value={pinEntrega}
                            onChangeText={(x) => setPinEntrega(x.replace(/\D/g, '').slice(0, 4))}
                            placeholder={t.pinPedir}
                            accessibilityLabel={t.pinPedir}
                            keyboardType="number-pad"
                            style={[e.input, { marginTop: 6, letterSpacing: 6 }]}
                          />
                        ) : null}
                        {activo.requiereEdad ? (
                          <Pressable
                            onPress={() => setMayorEdad((v) => !v)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: mayorEdad }}
                            accessibilityLabel={t.mayorEdad}
                            style={{
                              flexDirection: 'row',
                              gap: 8,
                              alignItems: 'center',
                              marginTop: 8,
                            }}
                          >
                            <Switch
                              value={mayorEdad}
                              onValueChange={setMayorEdad}
                              accessibilityLabel={t.mayorEdad}
                            />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontWeight: '700' }}>{t.mayorEdad}</Text>
                              <Text style={{ color: '#5E5E5E', fontSize: 12 }}>
                                {t.mayorEdadAyuda}
                              </Text>
                            </View>
                          </Pressable>
                        ) : null}
                        {activo.requiereEdad && mayorEdad ? (
                          <View style={{ gap: 6, marginTop: 6 }} testID="documento-edad">
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                              {(['licencia', 'pasaporte', 'otro'] as const).map((d) => (
                                <Pressable
                                  key={d}
                                  onPress={() => setDocumento(d)}
                                  accessibilityRole="radio"
                                  accessibilityState={{ checked: documento === d }}
                                  style={{
                                    paddingHorizontal: 12,
                                    paddingVertical: 8,
                                    borderRadius: 999,
                                    borderWidth: 1,
                                    borderColor: documento === d ? C.primario : '#DADADA',
                                    backgroundColor: documento === d ? C.primario : '#fff',
                                  }}
                                >
                                  <Text
                                    style={{
                                      color: documento === d ? '#fff' : C.secundario,
                                      fontWeight: '700',
                                    }}
                                  >
                                    {new Map(Object.entries(tg.edad.documentos)).get(d)}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                            <TextInput
                              value={ultimos4}
                              onChangeText={(x) => setUltimos4(x.replace(/\D/g, '').slice(0, 4))}
                              placeholder={tg.edad.ultimos4}
                              accessibilityLabel={tg.edad.ultimos4}
                              keyboardType="number-pad"
                              style={e.input}
                            />
                            <TextInput
                              value={nombreRecibe}
                              onChangeText={(x) => setNombreRecibe(x.slice(0, 80))}
                              placeholder={tg.edad.nombre}
                              accessibilityLabel={tg.edad.nombre}
                              style={e.input}
                            />
                            <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{tg.edad.ayuda}</Text>
                          </View>
                        ) : null}
                        <Boton
                          texto={t.enMano}
                          alTocar={() => void entregarEnMano()}
                          cargando={subiendo}
                          exito={enMano}
                          secundario={!enMano}
                        />
                        {faltanSeg == null ? (
                          <Boton
                            texto={t.noAparece}
                            alTocar={() =>
                              void accion(`/datos/repartidor/pedidos/${activo.id}/no-aparece`)
                            }
                            secundario
                          />
                        ) : faltanSeg > 0 ? (
                          <Text style={{ color: '#B26A00', fontWeight: '700', marginTop: 6 }}>
                            {t.esperando5} {Math.floor(faltanSeg / 60)}:
                            {String(faltanSeg % 60).padStart(2, '0')}
                          </Text>
                        ) : activo.metodoPago && activo.metodoPago !== 'tarjeta' ? (
                          // C-COBRO-DIRECTO: se cobra en mano; no hay «lugar seguro».
                          <Text
                            style={{ color: '#5E5E5E', marginTop: 6 }}
                            testID="sin-lugar-seguro"
                          >
                            {tg.pedido.sinLugarSeguro}
                          </Text>
                        ) : (
                          <>
                            <TextInput
                              value={nota}
                              onChangeText={setNota}
                              placeholder={t.dondeLoDejas}
                              accessibilityLabel={t.dondeLoDejas}
                              style={[e.input, { marginTop: 6 }]}
                            />
                            {nota.trim() ? (
                              <Boton
                                texto={subiendo ? t.subiendo : t.dejarSeguro}
                                alTocar={() =>
                                  void tomarFoto(
                                    `/datos/repartidor/pedidos/${activo.id}/entregado?modo=seguro&nota=${encodeURIComponent(nota.trim())}`,
                                  )
                                }
                                cargando={subiendo}
                                exito
                              />
                            ) : null}
                          </>
                        )}
                      </>
                    );
                  })()}
                </>
              )}
              {activo.estado === 'en_camino' || activo.estado === 'listo' ? (
                <Boton
                  texto={t.llamarCliente}
                  alTocar={() =>
                    void api
                      .pedir('POST', `/datos/pedidos/${activo.id}/llamar`, {})
                      .then(() => setAviso(t.llamandoCliente))
                      .catch((x: unknown) =>
                        setError(x instanceof ErrorApi ? x.message : String(x)),
                      )
                  }
                  secundario
                />
              ) : null}
              {mostrarChat ? <ChatPedido pedidoId={activo.id} /> : null}
            </View>
            {(estado?.agrupados ?? []).map((g) => {
              const casaG = g.lat != null && g.lng != null ? { lat: g.lat, lng: g.lng } : null;
              const enPuertaG = Boolean(g.llegoCliente) || g.excepcionUbicacion === 'autorizada';
              return (
                <View key={g.id} style={[e.tarjeta, { borderWidth: 1, borderColor: '#2A2A2A' }]}>
                  <Text style={{ fontWeight: '800', color: C.primario }}>{t.agrupado}</Text>
                  <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.agrupadoAyuda}</Text>
                  <Text style={{ fontWeight: '800', fontSize: 16, marginTop: 4 }}>
                    {t.pedido} #{g.id.slice(0, 4).toUpperCase()} ·{' '}
                    {formatearMonto(g.pagoRepartidor, g.moneda, idioma)}
                  </Text>
                  {g.lineas.map((l) => (
                    <Text key={l.platoId}>
                      {l.cantidad} × {textoLinea(l, idioma)}
                    </Text>
                  ))}
                  <Text style={{ marginTop: 6, fontWeight: '700' }}>{t.entregar}:</Text>
                  <Text>{g.direccion}</Text>
                  {g.estado === 'en_camino' ? (
                    enPuertaG ? (
                      <>
                        <Boton
                          texto={subiendo ? t.subiendo : t.fotoEntrega}
                          alTocar={() =>
                            void tomarFoto(`/datos/repartidor/pedidos/${g.id}/entregado`)
                          }
                          cargando={subiendo}
                          exito
                        />
                        <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.sinCaras}</Text>
                      </>
                    ) : (
                      <>
                        <Boton
                          texto={t.comoLlegar}
                          alTocar={() => abrirMapa(g.lat, g.lng, g.direccion)}
                          exito
                        />
                        <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
                          {aqui && casaG ? `${t.teFaltan} ${metrosEntre(aqui, casaG)} m. ` : ''}
                          {t.alLlegar}
                        </Text>
                      </>
                    )
                  ) : (
                    <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.esperando}</Text>
                  )}
                  <ChatPedido pedidoId={g.id} />
                </View>
              );
            })}
          </>
        </View>
      </View>,
    );
  }

  return lienzo(
    'inicio',
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, zIndex: 2 }}>
        <ResumenDia
          idioma={idioma}
          ganancias={gananciasHoy}
          enMano={enManoHoy}
          entregas={entregasHoy}
          segundosConectado={segundosConectado}
        />
        {estado?.conectado ? (
          <View
            style={{
              alignSelf: 'center',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: '#E6F4EC',
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 6,
              marginTop: 10,
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.exito }} />
            <Text style={{ fontWeight: '700', color: C.secundario }}>{td.disponiblePedidos}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: -10 }}>
        <Mapa
          yo={aqui}
          marcadores={marcadoresOfertas}
          alto={alturaMapa}
          etiquetas={etiquetasMapa}
        />
        {aqui ? (
          <View
            style={{
              position: 'absolute',
              top: 24,
              left: 16,
              backgroundColor: '#fff',
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.primario }} />
            <Text style={{ fontWeight: '700', fontSize: 12 }}>{td.tuUbicacion}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 16, gap: 10, marginTop: -24, backgroundColor: 'transparent' }}>
        {mensajes}
        {estado?.conectado ? (
          <Text style={e.tarjeta}>{estado.pausado ? tg.pausa.enPausa : t.buscando}</Text>
        ) : null}
        {ofertasViaje[0] && !ofertas[0] ? (
          <OfertaViajeModal
            oferta={ofertasViaje[0]}
            idioma={idioma}
            alAceptar={() =>
              void accionViaje(
                `/datos/conductor/operaciones/${ofertasViaje[0]!.operacionId}/aceptar`,
              )
            }
            alRechazar={() =>
              void accionViaje(
                `/datos/conductor/operaciones/${ofertasViaje[0]!.operacionId}/rechazar`,
              )
            }
          />
        ) : null}
        {ofertas[0] ? (
          <Oferta
            oferta={ofertas[0]}
            idioma={idioma}
            alAceptar={() => void accion(`/datos/repartidor/ofertas/${ofertas[0]!.id}/aceptar`)}
            alRechazar={() => void accion(`/datos/repartidor/ofertas/${ofertas[0]!.id}/rechazar`)}
          />
        ) : null}
        {estado && (
          <Pressable
            onPress={() => void alternar()}
            accessibilityRole="switch"
            accessibilityState={{ checked: estado.conectado }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: estado.conectado ? C.exito : '#6B6B6B',
              borderRadius: 999,
              padding: 8,
              paddingRight: 20,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff' }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17 }}>
                {estado.conectado ? t.conectado : t.desconectado}
              </Text>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                {cambiando
                  ? t.buscandoUbicacion
                  : estado.conectado
                    ? t.desconectar
                    : td.tocaDisponible}
              </Text>
            </View>
          </Pressable>
        )}
        {estado?.conectado && !activo ? (
          <Boton
            texto={estado.pausado ? tg.pausa.reanudar : tg.pausa.pausar}
            alTocar={() => void accion('/datos/repartidor/pausar', { pausado: !estado.pausado })}
            secundario
          />
        ) : null}
        {estado && (
          <View style={e.tarjeta}>
            <Text style={{ fontWeight: '800' }}>
              {t.nivel}: {enIdioma({ es: estado.nivel.es, en: estado.nivel.en }, idioma)} ·{' '}
              {estado.puntos} {t.puntos}
            </Text>
            {estado.nivel.siguiente ? (
              <Text style={{ color: '#5E5E5E' }}>
                {t.faltan} {estado.nivel.siguiente.faltan} {t.puntos} {t.para}{' '}
                {enIdioma({ es: estado.nivel.siguiente.es, en: estado.nivel.siguiente.en }, idioma)}
              </Text>
            ) : null}
            {/* Barra de avance al siguiente nivel, en verde: cada entrega es un paso hacia adelante. */}
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(estado.nivel.avance * 100) }}
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: '#ECECEC',
                marginTop: 8,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.max(2, Math.round(estado.nivel.avance * 100))}%`,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: C.exito,
                }}
              />
            </View>
          </View>
        )}
        {billetera && (
          <Pressable
            onPress={() => setVista('billetera')}
            accessibilityRole="link"
            style={[e.tarjeta, { backgroundColor: C.secundario }]}
          >
            <Text style={{ color: '#BDBDBD', fontWeight: '600' }}>{t.saldo}</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800' }}>
              {formatearMonto(billetera.saldo, 'USD', idioma)}
            </Text>
            <Text style={{ color: '#FFFFFF', textDecorationLine: 'underline', marginTop: 4 }}>
              {t.verBilletera}
            </Text>
          </Pressable>
        )}
      </View>
    </View>,
  );
}
