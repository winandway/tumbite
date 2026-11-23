import { AjusteIaChat } from './soporte/AjusteIaChat';
import { CuentaCobro } from './cobros/CuentaCobro';
import { RecargaTarjeta } from './cobros/RecargaTarjeta';
import { ubicacionParaConectar } from './ubicacionParaConectar';
import { comoLlegar } from './comoLlegar';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { detenerUbicacionFondo, fijarModoRastreo, iniciarUbicacionFondo } from './ubicacionFondo';
import * as ImagePicker from 'expo-image-picker';
import { AsistentePapeles } from './papeles/AsistentePapeles';
import { QueTeFalta } from './piezas/QueTeFalta';
import { type AccionFalta, type FaltaServidor } from './piezas/queTeFaltaLogica';
import { AltaPasajeros } from './viajes/AltaPasajeros';
import { accionDeMotivo, faltaCaraParaEmpezar } from './papeles/logica';
import { AvisoIa } from './papeles/AvisoIa';
import { hayQueMostrarAvisoIa } from './papeles/textosAvisoIa';
import { PapelesSinCargar, TusPapeles, usePapeles } from './papeles/TusPapeles';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import {
  ErrorApi,
  type Idioma,
  type Nivel,
  enIdioma,
  formatearMonto,
  textoLocal,
  paisDelCodigoZona,
  textoAMonto,
  PRECISION_MAXIMA_M,
  llego,
  metrosEntre,
  textoLinea,
  type OpcionElegida,
  type Pendiente,
  crearCola,
  sePuedeReintentar,
  usaMillas,
  LATIDO_UBICACION_MS,
  cuerpoUbicacion,
  marcarRecibida,
  paraEnviarUbicacion,
  modoRastreo,
  tocaMandarSegunModo,
  type MontoEnMano as MontoEnManoTipo,
  type Referencia,
  ESPERA_MAXIMA_CRITICA_MS,
  type VistaPagoComida,
} from '@tumbite/compartido';
import { BilleteraRepartidor, type DatosBilletera } from './Billetera';
import { Turnos } from './grandes/Turnos';
import { ResumenAnual } from './grandes/ResumenAnual';
import { MiNivel } from './grandes/MiNivel';
import { Seguridad } from './grandes/Seguridad';
import { cargarAccesibilidad } from './grandes/accesibilidad';
import { CalificarCliente } from './grandes/CalificarCliente';
import { MisViajesConductor } from './viajes/MisViajesConductor';
import { type CierreViaje, cierreVigente, pantallaViaje } from './viajes/cierreViaje';
import { ClientesFijos } from './viajes/ClientesFijos';
import { ConfirmarTelefono } from './ConfirmarTelefono';
import { InvitacionesEmpresa } from './flex/InvitacionesEmpresa';
import { InvitacionesFlota } from './InvitacionesFlota';
import { UnidadDistancia, useUnidadDistancia } from './piezas/UnidadDistancia';
import { ModoPago } from './piezas/ModoPago';
import { ModoDestino } from './piezas/ModoDestino';
import { DeslizarParaCompletar } from './piezas/DeslizarParaCompletar';
import { BarraInferior, type Pestana } from './piezas/BarraInferior';
import { BotonRedondo } from './piezas/BotonRedondo';
import { CabeceraDriver } from './piezas/CabeceraDriver';
import { Mapa } from './piezas/Mapa';
import type { ZonaDemanda } from './piezas/mapaWeb';
import { Progreso } from './piezas/Progreso';
import { MiniaturaPuerta } from './piezas/FotosPuerta';
import { ResumenDia } from './piezas/ResumenDia';
import { palabraDeHoy } from './piezas/resumenDiaLogica';
import { SaldoInicio } from './piezas/SaldoInicio';
import { IMG } from './piezas/recursos';
import { textosDriver } from './piezas/textos';
import { Oferta } from './grandes/Oferta';
import { Calificaciones } from './grandes/Calificaciones';
import { MiEquipo } from './grandes/MiEquipo';
import { MiLinea } from './grandes/MiLinea';
import { AsiTeVen } from './grandes/AsiTeVen';
import { CobrarEfectivo } from './grandes/CobrarEfectivo';
import { Ganancias } from './grandes/Ganancias';
import {
  type CobroEnMano,
  cobrosDelPeriodo,
  resumenConEnMano,
  textoTrabajos,
} from './grandes/resumenPeriodo';
import { Avisos } from './grandes/Avisos';
import { AyudaPedido } from './grandes/Ayuda';
import { AyudaDriver } from './soporte/AyudaDriver';
import { textosSoporte } from './soporte/textos';
import { PagoEnLocal } from './grandes/PagoEnLocal';
import { SalidaPagoComida } from './grandes/SalidaPagoComida';
import { Alta } from './grandes/Alta';
import { textosGrandes } from './grandes/textos';
import {
  AvisoLlevando,
  FranjaPausa,
  PanelServiciosInicio,
  ServiciosBloqueados,
  usePanelServicios,
} from './servicios/PanelServicios';
import { nombreServicio, textoBloque, type ServicioPanel } from './servicios/logica';
import { textosServicios } from './servicios/textos';
import { AgregarServicio } from './servicios/AgregarServicio';
import { PerfilAcordeon } from './servicios/PerfilAcordeon';
import { MiRuta } from './flex/MiRuta';
import { FONDO as FONDO_FLEX } from './flex/piezas';

/** Lo mínimo de una ruta Flex para la tarjeta del inicio. */
type RutaFlexInicio = {
  id: string;
  nombre: string;
  estado: string;
  paradas: number;
  bloqueDesde?: string | null;
  bloqueHasta?: string | null;
};
const RUTA_FLEX_ACTIVA = ['ofrecida', 'asignada', 'aceptada', 'en_carga', 'en_curso'];
import { type OfertaViaje, OfertaViajeModal } from './viajes/OfertaViaje';
import { claveOferta, ofertaParaMostrar } from './viajes/ofertaTiempo';
import { pararAlarmaOferta } from './sonidoOferta';
import { type RespuestaCierre, type ViajeConductor, ViajeActivo } from './viajes/ViajeActivo';
import {
  abrirPagina,
  abrirPanel,
  AvisoDeshacer,
  Boton,
  CASILLA_EN_FILA,
  FilaConBoton,
  C,
  ChatPedido,
  MenuCuenta,
  OpcionesCuenta,
  PersonasBloqueadas,
  AjusteMapa,
  VersionInstalada,
  MisCasos,
  selectorDeCapturas,
  ReportarProblema,
  TarjetaAvisosWeb,
  e,
  useSesion,
  useSondeo,
  useToqueAviso,
  URL_SERVIDOR,
  capturasConCamara,
  achicarFotoEvidencia,
  Text,
  Modal,
  Deslizador,
  MontoEnMano,
} from '@tumbite/movil';

/** C-CAMARA-EN-TODA-SUBIDA: la cámara del teléfono, para la pieza común «Tomar foto». */
const CAMARA = {
  pedirPermiso: () => ImagePicker.requestCameraPermissionsAsync(),
  tomar: () => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 }),
};

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
  /** C-DISTANCIA-POR-PAIS: país del pedido (millas en EE. UU.). */
  pais?: string | null;
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
  /** C-DESLIZAR-ENTREGA: la foto de la puerta ya está en el servidor; falta deslizar. */
  fotoEntregaLista?: boolean;
  distanciaAlLocalKm?: number | null;
  distanciaTotalKm?: number | null;
  minutosEstimados?: number | null;
  articulos?: number;
  noApareceEn?: string | null;
  /** C-CLIENTE-AUSENTE: minutos de espera en la puerta tras avisar (configuración del servidor). */
  esperaAusenteMin?: number;
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
  /** C-COMIDA-VENEZUELA: lo que cobra en mano, en bolívares de referencia (tasa del día). */
  referenciaCobro?: Referencia | null;
  /** C-BS-EN-MANO: lo que cobra en mano (sin propina), con «sinTasa»; igual al que ve el cliente. */
  enManoCobro?: MontoEnManoTipo | null;
  /** C-COMIDA-PAGO-RESTAURANTE: la comida la paga el cliente directo al restaurante. */
  pagoComida?: VistaPagoComida | null;
  /** C-CUPON-DIVOOX: lo que paga Divoox por el regalo del cliente (0 sin regalo). */
  regaloDivoox?: number;
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
  /** C-REWARDS-PILOTO: el nivel de reputación (0 a 100), si Rewards está activo para este repartidor. */
  reputacion?: {
    puntaje: number;
    nivel: 'inicial' | 'plata' | 'oro' | 'diamante';
    provisional: boolean;
    siguiente: { nivel: 'inicial' | 'plata' | 'oro' | 'diamante'; faltan: number } | null;
  };
  activo: Pedido | null;
  selfieControlPendiente?: boolean;
  zonaId?: string | null;
  ganarPorTiempo?: { activo: boolean; centavosHora: number; modo: 'oferta' | 'tiempo' };
  /** C-TELEFONO-VUELTA: últimos 4 del teléfono a confirmar por SMS al volver. */
  telefonoPorVerificar?: string | null;
  /** C-TERMINOS-ACTUALIZADOS: versión de los términos que le falta aceptar. */
  terminosPorAceptar?: string | null;
  /** Días sin conectarse cuando son 14 o más (bienvenida de vuelta). */
  vuelveTrasDias?: number | null;
  /** C-PRUEBA-DE-VIDA: cuál de las dos fotos falta. */
  selfieControlFalta?: 'frente' | 'giro' | null;
  /** Otros pedidos del mismo restaurante que lleva en este viaje. */
  agrupados?: Pedido[];
  /** C-OCUPADO-VISIBLE (BRF-1): una ruta Flex o un viaje lo ocupa; no le llegan pedidos de comida. */
  ocupadoEn?: 'ruta_flex' | 'operacion' | null;
  /** C-FLEX-EXCLUSIVO: el bloque de Flex que lo ocupa; todo lo demás está desconectado. */
  bloqueFlex?: {
    rutaId: string;
    nombre: string;
    estado: string;
    empresa: string;
    bloqueDesde: string | null;
    bloqueHasta: string | null;
  } | null;
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
  if (p) return p;
  // C-UBICACION-AL-CONECTAR: la última conocida también con tope (en Android puede colgarse).
  return Promise.race([
    Location.getLastKnownPositionAsync().catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), 3000)),
  ]);
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
    buscandoAyuda:
      'Es más probable que recibas ofertas en las zonas en rojo del mapa, sobre todo a la hora del almuerzo y de la cena.',
    rutaEnCurso: 'Tienes una ruta de paquetes en curso',
    ocupadoRuta:
      'Mientras tengas la ruta de paquetes no te llegan pedidos de comida. Termínala para volver a recibirlos.',
    ocupadoViaje:
      'Mientras tengas un viaje en curso no te llegan pedidos de comida. Termínalo para volver a recibirlos.',
    rutaPorAceptar: 'Tienes una ruta de paquetes por aceptar',
    rutaParadas: (n: number) => `${n} ${n === 1 ? 'parada' : 'paradas'}`,
    continuarRuta: 'Continuar ruta',
    verRuta: 'Ver la ruta',
    bienvenida: (n: string) => `¡Qué bueno verte de nuevo, ${n}!`,
    bienvenidaNivel: 'El tiempo que estuviste fuera no cambió tu nivel. Conéctate cuando quieras.',
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
    gpsSimulado:
      'Tu celular está usando una ubicación simulada. Apaga la app que la cambia para poder entregar.',
    sinGps: '¿El GPS no te marca en la puerta?',
    sinGpsAyuda:
      'Cuéntanos qué pasa (edificio, garaje, celular sin señal). Soporte lo revisa y te autoriza entregar.',
    pedirExcepcion: 'No puedo confirmar mi ubicación',
    esperandoSoporte:
      'Soporte está revisando tu caso. Mientras tanto, si el GPS te confirma, el botón aparece solo.',
    autorizado: 'Soporte autorizó la entrega sin la confirmación del GPS.',
    fotoEntrega: 'Tomar foto de la entrega',
    fotoLista: 'Foto de la entrega lista',
    otraFoto: 'Tomar otra foto',
    bono: 'Incluye un bono de',
    llamarCliente: 'Llamar al cliente (número oculto)',
    selfieControl: 'Foto de control: confirma que eres tú',
    selfieCasco: 'Selfie con el casco puesto',
    selfieCascoAyuda:
      'En esta ciudad, antes de aceptar viajes en moto, te tomas una foto con el casco puesto. Vale 12 horas.',
    selfieCascoLista: 'Foto enviada. Ya puedes aceptar el viaje.',
    agrupado: 'Pedido agrupado (mismo restaurante, mismo viaje)',
    agrupadoAyuda: 'Lo recoges junto con el principal y lo entregas en su propia dirección.',
    mayorEdad: 'Revisé el documento: quien recibe es mayor de 21',
    mayorEdadAyuda: 'Este pedido tiene productos para mayores de 21: solo en mano y con documento.',
    selfieControlAyuda:
      'De vez en cuando, antes de conectarte, te pedimos una foto de tu cara. Nuestro equipo la compara con la de tu registro. De frente y con buena luz.',
    tomarSelfie: 'Tomarme la foto ahora',
    selfieLista: 'Foto enviada. Ya puedes conectarte.',
    pasoFrente: 'Paso 1 de 2: mira de frente a la cámara.',
    terminosTitulo: 'Actualizamos los términos para conductores',
    terminosAyuda:
      'Antes de conectarte, léelos y acéptalos. Explican cómo funcionan tus ganancias, la seguridad y cómo se resuelven los desacuerdos.',
    terminosLeer: 'Leer los términos',
    terminosAcepto: 'He leído, comprendo y acepto los términos para conductores',
    terminosDeAcuerdo: 'De acuerdo',
    pasoGiro: 'Paso 2 de 2: gira la cabeza ligeramente a la derecha y toma la foto.',
    tomarGiro: 'Tomar la foto mirando a la derecha',
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
    conPinSinFoto:
      'Este pedido se entrega en mano con el PIN del cliente: pídeselo y escríbelo. No se puede dejar con foto.',
    escanear: 'Escanear el código del restaurante',
    escribirCodigo: 'O escribe el número del pedido (4 letras o números)',
    verificar: 'Verificar',
    verificadoOk:
      'Código verificado: es tu pedido. Ahora toma la foto de la bolsa y sales de una, sin esperar al restaurante.',
    cerrar: 'Cerrar',
    noPuedo: 'No puedo seguir con este pedido',
    motivo: 'Cuéntanos por qué. Se le ofrece a otro conductor y no te baja de nivel.',
    soltar: 'Soltar el pedido',
    pidio: {
      puerta: 'El cliente pidió: dejar en la puerta',
      mano: 'El cliente pidió: entregar en mano',
    } as Record<string, string>,
    enMano: 'Entregado en mano',
    deslizarEnMano: 'Desliza: entregado en mano',
    confirmarEnMano: {
      pregunta: '¿Entregaste el pedido en mano?',
      si: 'Entregado',
      no: 'Cancelar',
    },
    pinPedir: 'PIN de 4 dígitos (lo tiene quien recibe, en su app)',
    noAparece: 'El cliente no aparece',
    esperando5: 'Avisamos al cliente. Escríbele por el chat y espera',
    dejarSeguro: 'Dejar en lugar seguro (con foto)',
    clienteAusente: 'Cliente no apareció: cerrar con foto',
    clienteAusenteAyuda:
      'Con PIN la comida no se deja. Toma una foto de la puerta o del lugar como constancia: el pedido se cierra, tú cobras lo tuyo y soporte queda avisado.',
    dondeLoDejas: 'Escribe dónde lo dejas (con el portero, detrás de la maceta…)',
    permisoCamara: 'Para tomar la foto necesitamos permiso para usar la cámara.',
    esperando: 'El restaurante lo está terminando…',
    listoEn: 'Listo en',
    listoYa: 'Ya está listo para recoger.',
    nivel: 'Tu nivel',
    puntos: 'puntos',
    faltan: 'Te faltan',
    deCien: 'de 100',
    provisional: 'Provisional: se afina con tus próximas entregas.',
    niveles: { inicial: 'Inicial', plata: 'Plata', oro: 'Oro', diamante: 'Diamante' },
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
    buscandoAyuda:
      'You’re more likely to get offers in the red areas on the map, especially around lunch and dinner.',
    rutaEnCurso: 'You have a package route in progress',
    ocupadoRuta:
      'While you have a package route, you won’t get food orders. Finish it to start getting them again.',
    ocupadoViaje:
      'While you have a trip in progress, you won’t get food orders. Finish it to start getting them again.',
    rutaPorAceptar: 'You have a package route to accept',
    rutaParadas: (n: number) => `${n} ${n === 1 ? 'stop' : 'stops'}`,
    continuarRuta: 'Continue route',
    verRuta: 'View route',
    bienvenida: (n: string) => `Good to see you again, ${n}!`,
    bienvenidaNivel: 'Your time away didn’t change your level. Go online whenever you like.',
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
    gpsSimulado:
      'Your phone is using a mock location. Turn off the app that changes it so you can deliver.',
    sinGps: 'GPS not placing you at the door?',
    sinGpsAyuda:
      'Tell us what’s going on (tall building, garage, no signal). Support reviews it and authorizes the delivery.',
    pedirExcepcion: 'I can’t confirm my location',
    esperandoSoporte:
      'Support is reviewing your case. Meanwhile, if GPS confirms you, the button appears on its own.',
    autorizado: 'Support authorized the delivery without GPS confirmation.',
    fotoEntrega: 'Take the delivery photo',
    fotoLista: 'Delivery photo ready',
    otraFoto: 'Retake photo',
    bono: 'Includes a bonus of',
    llamarCliente: 'Call the customer (masked number)',
    selfieControl: 'Identity check photo: confirm it’s you',
    selfieCasco: 'Selfie with your helmet on',
    selfieCascoAyuda:
      'In this city, before accepting motorcycle rides, you take a photo with your helmet on. It’s valid for 12 hours.',
    selfieCascoLista: 'Photo sent. You can accept the ride now.',
    agrupado: 'Grouped order (same restaurant, same trip)',
    agrupadoAyuda: 'You pick it up with the main one and deliver it to its own address.',
    mayorEdad: 'I checked the ID: the recipient is 21 or older',
    mayorEdadAyuda: 'This order has 21+ items: hand delivery only, with an ID check.',
    selfieControlAyuda:
      'Every so often, before you go online, we ask for a photo of your face. Our team compares it with the one on file. Face the camera in good light.',
    tomarSelfie: 'Take my photo now',
    selfieLista: 'Photo sent. You can go online now.',
    pasoFrente: 'Step 1 of 2: look straight at the camera.',
    terminosTitulo: 'We updated the terms for drivers',
    terminosAyuda:
      'Before you go online, read and accept them. They explain how your earnings work, safety, and how disagreements are resolved.',
    terminosLeer: 'Read the terms',
    terminosAcepto: 'I have read, understand, and accept the driver terms',
    terminosDeAcuerdo: 'I agree',
    pasoGiro: 'Step 2 of 2: turn your head slightly to the right and take the photo.',
    tomarGiro: 'Take the photo looking right',
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
    conPinSinFoto:
      'This order is handed over in person with the PIN: ask the customer for it and enter it. It can’t be left with a photo.',
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
    deslizarEnMano: 'Slide: handed to the customer',
    confirmarEnMano: { pregunta: 'Did you hand the order over?', si: 'Delivered', no: 'Cancel' },
    pinPedir: '4-digit PIN (the person receiving has it in their app)',
    noAparece: 'Customer isn’t here',
    esperando5: 'We told the customer. Message them in the chat and wait',
    dejarSeguro: 'Leave in a safe spot (with photo)',
    clienteAusente: 'Customer didn’t show: close with photo',
    clienteAusenteAyuda:
      'With a PIN the food isn’t left behind. Take a photo of the door or the spot as proof: the order is closed, you get paid and support is notified.',
    dondeLoDejas: 'Where are you leaving it (with the doorman, behind the planter…)',
    permisoCamara: 'To take the photo, we need permission to use the camera.',
    esperando: 'The restaurant is finishing it…',
    listoEn: 'Ready in',
    listoYa: 'Ready for pickup now.',
    nivel: 'Your level',
    puntos: 'points',
    faltan: 'You need',
    deCien: 'out of 100',
    provisional: 'Provisional: it gets sharper with your next deliveries.',
    niveles: { inicial: 'Starter', plata: 'Silver', oro: 'Gold', diamante: 'Diamond' },
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

export function Inicio() {
  // C-UNIDAD-ELEGIDA: millas o kilómetros, lo que el repartidor eligió (vale para toda la app).
  const unidadDistancia = useUnidadDistancia();
  useKeepAwake();
  const { api, idioma, cambiarIdioma: cambiarIdiomaSesion, usuario } = useSesion();
  // C-ELEGIR-MAPAS: «Cómo llegar» deja elegir la app de mapas, igual que en Flex.
  const abrirMapa = (lat: number | null, lng: number | null, direccion: string) =>
    comoLlegar({ lat, lng, direccion }, idioma);
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
  const altoVentana = useWindowDimensions().height;
  const alturaMapa = Math.max(240, Math.round(altoVentana * 0.42));
  // C-FOTO-CARA-A-LA-VISTA: cuánto se deslizó el inicio, para llevar el motivo de «no te puedes
  // conectar» a la vista si quedó tapado por la barra de abajo o por la cabecera.
  const desplazado = useRef(0);
  const motivoRef = useRef<View>(null);
  const t = enIdioma(T, idioma);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [ofertas, setOfertas] = useState<Pedido[]>([]);
  // Divoox Moto (M4): la oferta de un viaje y el viaje en curso (otra operación, no un pedido).
  const [ofertasViaje, setOfertasViaje] = useState<OfertaViaje[]>([]);
  const [viajeActivo, setViajeActivo] = useState<ViajeConductor | null>(null);
  // C-CIERRE-VIAJE-QUEDA: el cierre del viaje («Viaje terminado» / «Envío entregado»: cobro y
  // calificación). Se guarda ANTES de mandar el paso final y se sigue pintando hasta «Listo» aunque el
  // sondeo ya no vea el viaje; vive solo en memoria (si la app se reinicia, nadie queda atrapado).
  const [cierreViaje, setCierreViaje] = useState<CierreViaje<
    ViajeConductor,
    RespuestaCierre
  > | null>(null);
  const pantallaDelViaje = pantallaViaje(viajeActivo, cierreViaje);
  const viajeMostrado = pantallaDelViaje?.viaje ?? null;
  // Mientras se ve el cierre (el servidor ya no lo cuenta ocupado), las ofertas nuevas van encima.
  const ofertasSobreCierre = pantallaDelViaje?.modo === 'cierre';
  const scrollLienzo = useRef<ScrollView>(null);
  // El cierre (cobro en efectivo y calificación) aparece desde arriba, no donde quedó el deslizador.
  const cierreRespondido = Boolean(cierreViaje?.respondido);
  useEffect(() => {
    if (cierreRespondido) scrollLienzo.current?.scrollTo({ y: 0, animated: false });
  }, [cierreRespondido]);
  const [billetera, setBilletera] = useState<Billetera | null>(null);
  const [error, setError] = useState('');
  // C-MOTO-CIUDAD: la ciudad pide la selfie con casco antes de aceptar viajes en moto.
  const [pideCasco, setPideCasco] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const [rutaFlex, setRutaFlex] = useState<RutaFlexInicio | null>(null);
  // C-FLEX-PARADA-ACTUAL: el botón fijo «Parada actual» de «Mi ruta», fuera de lo que se desplaza.
  const [pieFlex, setPieFlex] = useState<ReactNode>(null);
  const [vista, setVista] = useState<
    | 'inicio'
    | 'billetera'
    | 'datos'
    | 'pedidos'
    | 'calificaciones'
    | 'avisos'
    | 'alta'
    | 'miRuta'
    | 'turnos'
    | 'seguridad'
    | 'agregar'
    | 'clientesFijos'
    | 'miEquipo'
    | 'miLinea'
    | 'asiTeVen'
    | 'ayuda'
    | 'papeles'
    | 'vehiculo'
  >('inicio');
  // C-ASISTENTE-DRIVER: los papeles del conductor (asistente de verificación y «Tus papeles»).
  const papeles = usePapeles(api);
  const recargarPapeles = papeles.recargar;
  // A dónde vuelve el asistente al salir: al inicio o al perfil, según desde dónde se abrió.
  const [vueltaPapeles, setVueltaPapeles] = useState<'inicio' | 'datos'>('inicio');
  const abrirPapeles = (desde: 'inicio' | 'datos') => {
    setVueltaPapeles(desde);
    // Sin «Tus papeles» leídos todavía, se leen primero (antes el botón no abría nada).
    if (!papeles.v) void recargarPapeles();
    setVista('papeles');
  };
  // C-QUE-TE-FALTA: lo que le falta para recibir carreras, calculado por el servidor con la regla
  // del reparto. Se lee al entrar al inicio, al volver a él y después de conectarse o de un «no».
  const [faltas, setFaltas] = useState<FaltaServidor[] | null>(null);
  const cargarFaltas = useCallback(async () => {
    try {
      const r = await api.pedir<{ faltas: FaltaServidor[] }>(
        'GET',
        '/datos/conductor/que-te-falta',
      );
      setFaltas(r.faltas);
    } catch (x) {
      // Sin señal se queda lo último que se vio; la próxima vuelta al inicio lo vuelve a pedir.
      console.warn('que te falta', x);
    }
  }, [api]);
  useEffect(() => {
    if (vista !== 'inicio') return;
    const primero = setTimeout(() => void cargarFaltas(), 0);
    return () => clearTimeout(primero);
  }, [vista, cargarFaltas]);
  // C-QUE-TE-FALTA: el vehículo que se completa o corrige desde el bloque de arriba.
  const [tipoVehiculo, setTipoVehiculo] = useState<'moto' | 'carro'>('moto');
  // C-FOTO-CARA-A-LA-VISTA: por qué el servidor no lo dejó conectarse; va pegado a la barra.
  const [motivoConexion, setMotivoConexion] = useState<{
    texto: string;
    campo?: string;
    servicio?: string;
  } | null>(null);
  useEffect(() => {
    if (!motivoConexion) return;
    const reloj = setTimeout(() => {
      motivoRef.current?.measureInWindow((_x, y, _ancho, alto) => {
        // Lo visible: debajo de la cabecera y encima de la barra de pestañas.
        const arriba = 96;
        const abajo = altoVentana - 96;
        const sobra = y + alto - abajo;
        const falta = arriba - y;
        if (sobra > 0)
          scrollLienzo.current?.scrollTo({ y: desplazado.current + sobra + 12, animated: true });
        else if (falta > 0)
          scrollLienzo.current?.scrollTo({
            y: Math.max(0, desplazado.current - falta - 12),
            animated: true,
          });
      });
    }, 80);
    return () => clearTimeout(reloj);
  }, [motivoConexion, altoVentana]);
  // C-SERVICIOS-CONECTADOS: el panel de servicios (varios conectados a la vez, pausa al llevar uno).
  const servicios = usePanelServicios(api, 0);
  const ts = textosServicios(idioma);
  const [cambiandoServicio, setCambiandoServicio] = useState<string | null>(null);
  const [desconectado, setDesconectado] = useState<{
    id: string;
    nombre: string;
    texto: string;
  } | null>(null);
  const [servicioAgregar, setServicioAgregar] = useState<ServicioPanel | null>(null);
  const [cuentaArriba, setCuentaArriba] = useState(false);
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
  // C-CAMILA-CHAT: «Habla con soporte» del perfil abre Ayuda directo en el chat.
  const [ayudaEnChat, setAyudaEnChat] = useState(false);
  const tg = textosGrandes(idioma);
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [seccionPerfil, setSeccionPerfil] = useState<
    'vehiculo' | 'documentos' | 'moto' | 'carro' | 'viajes' | 'soporte' | null
  >(null);
  const [mostrarChat, setMostrarChat] = useState(true);
  // Desde cuándo está conectado en esta sesión (el servidor no lo guarda).
  const [conectadoDesde, setConectadoDesde] = useState<number | null>(null);
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
  // C-LATIDO-UBICACION: la última lectura del GPS, para el latido de cada 2 minutos.
  const ultimaLectura = useRef<Location.LocationObject | null>(null);
  // Dónde está ahora (para saber si ya llegó a la puerta y mostrar el botón de entregar).
  const [aqui, setAqui] = useState<{ lat: number; lng: number } | null>(null);
  const [aceptoTerminos, setAceptoTerminos] = useState(false);
  // Precisión del GPS en metros (la reporta el celular); se manda con cada ubicación.
  const [precision, setPrecision] = useState<number | null>(null);
  // G2: el celular dice que la ubicación es simulada (Android); no cuenta para llegar.
  const [gpsSimulado, setGpsSimulado] = useState(false);
  const [motivoGps, setMotivoGps] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  // C-DESLIZAR-ENTREGA: la foto de la puerta tomada en este celular (aunque espere señal para subir).
  const [fotoTomada, setFotoTomada] = useState<Record<string, string>>({});
  // Verificar el pedido en el restaurante (QR o número), soltarlo, y la entrega en la puerta.
  const [escaneando, setEscaneando] = useState(false);
  // C-QR-UNA-VEZ: la cámara dispara la lectura varias veces seguidas; se verifica una sola.
  const qrLeido = useRef(false);
  // C-FOTO-PUERTA: la fila de la tarjeta del pedido (la hoja de las fotos se abre debajo de ella).
  const filaPedido = useRef<View>(null);
  const [permisoCamara, pedirCamara] = useCameraPermissions();
  const [codigo, setCodigo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [pinEntrega, setPinEntrega] = useState('');
  const [mayorEdad, setMayorEdad] = useState(false);
  const [tic, setTic] = useState(() => Date.now());
  // C-SESION-TERMINADA (18 nov 2026): este reloj vuelve a pintar TODO el inicio. Cada segundo solo
  // cuando hay una cuenta atrás en segundos («el cliente no aparece»); si no, cada 30 s (el tiempo
  // conectado se muestra en horas y minutos). Antes pintaba la pantalla entera cada segundo siempre.
  const relojSegundos = Boolean(estado?.activo?.noApareceEn);
  useEffect(() => {
    const reloj = setInterval(() => setTic(Date.now()), relojSegundos ? 1000 : 30_000);
    return () => clearInterval(reloj);
  }, [relojSegundos]);
  // C-AUDITIVA-REPARTIDOR: la oferta vibra más fuerte si lo marcó en Seguridad.
  useEffect(() => {
    cargarAccesibilidad(api).catch((x: unknown) => console.warn('accesibilidad', x));
  }, [api]);

  const recargarPanel = servicios.cargar;
  const cargar = useCallback(async () => {
    // C-SERVICIOS-CONECTADOS: el panel de servicios se lee junto con el estado (cada 5 s y tras
    // conectar, aceptar o terminar algo).
    void recargarPanel();
    try {
      // C-FLEX-RUTA-EN-INICIO: la ruta de paquetes activa se ve en el inicio, como en Amazon Flex.
      api
        .pedir<{ rutas: RutaFlexInicio[] }>('GET', '/datos/v1/flex/conductor/rutas')
        .then((r) => setRutaFlex(r.rutas.find((x) => RUTA_FLEX_ACTIVA.includes(x.estado)) ?? null))
        .catch(() => undefined);
      const s = await api.pedir<Estado>('GET', '/datos/repartidor/estado');
      setEstado(s);
      // C-FLEX-EXCLUSIVO: con un bloque de Flex, el inicio y «Pedidos» pasan a la ruta y se quedan
      // ahí también al cerrarlo, hasta que el conductor toque «Volver al inicio» (así ve su pago).
      if (s.bloqueFlex) setVista((v) => (v === 'inicio' || v === 'pedidos' ? 'miRuta' : v));
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
      // C-CIERRE-VIAJE-QUEDA: un viaje NUEVO en curso, o un pedido de comida aceptado, suelta el
      // cierre del anterior.
      setCierreViaje((c) => cierreVigente(c, v.operacion, Boolean(s.activo)));
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
      setErrorCarga('');
    } catch (x) {
      setErrorCarga(x instanceof ErrorApi ? x.message : String(x));
      return false;
    }
  }, [api, recargarPanel]);

  // C-SESION-TERMINADA: el estado cada 5 s; si falla, cada vez más espaciado (antes cada 5 s pasara
  // lo que pasara, también con la sesión vencida).
  // Estado y ofertas no pueden llegar tarde: con fallos, como mucho cada 20 s.
  useSondeo(cargar, 5000, true, true, { topeMs: ESPERA_MAXIMA_CRITICA_MS });
  // C-OFERTA-VENCIDA-SE-CIERRA (robot, 18 nov 2026): al volver la app al frente (el conductor estaba
  // en otra app) se pregunta YA: una oferta no puede aparecer con la cuenta atrás ya gastada.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (e) => {
      if (e === 'active') void cargar();
    });
    return () => sub.remove();
  }, [cargar]);
  // Las ofertas que este teléfono vio llegar a 0 s: la tarjeta se cierra sola y no vuelve a salir
  // (la reoferta del mismo viaje trae otro vencimiento: es otra tarjeta).
  // C-ZONA-CONDUCTOR-NUEVO (robot, 18 nov 2026): el conductor nuevo que todavía no se conectó ni
  // eligió ciudad quedaba en Miami; su primera ubicación del mapa fija su ciudad (una vez por sesión).
  const zonaPedida = useRef(false);
  // C-OFERTA-SUENA-EN-BUCLE: al cerrar sesión (el inicio se desmonta) nunca queda sonando.
  useEffect(() => () => pararAlarmaOferta('sesion'), []);
  useEffect(() => {
    if (!aqui || zonaPedida.current) return;
    zonaPedida.current = true;
    void api
      .pedir<{ cambio: boolean }>('POST', '/datos/conductor/zona-por-ubicacion', aqui)
      .then((r) => {
        if (r.cambio) {
          void recargarPanel();
          void cargar();
          // C-PAPELES-TRAS-CIUDAD: con la ciudad ya real, sus papeles son los de su país.
          void recargarPapeles();
        }
      })
      .catch((e: unknown) => console.warn('zona por ubicación', e));
  }, [aqui, api, cargar, recargarPanel, recargarPapeles]);
  const [vencidasAqui, setVencidasAqui] = useState<ReadonlySet<string>>(() => new Set());
  const vencer = (clave: string) =>
    setVencidasAqui((v) => (v.has(clave) ? v : new Set([...v, clave].slice(-50))));
  const ofertaViaje = ofertaParaMostrar(ofertasViaje, vencidasAqui);
  // Revisor (18 nov 2026): si la primera venció aquí, pasa a la siguiente.
  const ofertaComida = ofertas.find((o) => !vencidasAqui.has(`comida@${o.id}`)) ?? null;

  // C-FLEX-EXCLUSIVO (Richard, 16 nov 2026): con un bloque de Flex, el inicio cambia entero al modo
  // bloque (la ruta, con la banda «todo lo demás está desconectado»). Comida, envíos y viajes no se
  // ven ni se pueden conectar hasta terminar el bloque.
  const enBloque = Boolean(estado?.bloqueFlex);

  // C-MAPA-DEMANDA: las zonas con más pedidos de la última hora, cada minuto (como el «Dash Now»).
  const [zonasDemanda, setZonasDemanda] = useState<ZonaDemanda[]>([]);
  const [monedaDemanda, setMonedaDemanda] = useState('USD');
  const latAqui = aqui ? Math.round(aqui.lat * 100) / 100 : null;
  const lngAqui = aqui ? Math.round(aqui.lng * 100) / 100 : null;
  const leerDemanda = useCallback(async () => {
    if (latAqui == null || lngAqui == null) return;
    const r = await api.pedir<{ zonas: ZonaDemanda[]; moneda?: string }>(
      'GET',
      `/datos/repartidor/demanda?lat=${latAqui}&lng=${lngAqui}`,
    );
    setZonasDemanda(r.zonas);
    if (r.moneda) setMonedaDemanda(r.moneda);
  }, [api, latAqui, lngAqui]);
  useSondeo(leerDemanda, 60_000, latAqui != null && lngAqui != null);

  // Lo pendiente se reintenta cada 10 segundos; lo que el servidor rechaza se muestra y se descarta.
  const textoEnviado = t.pendienteEnviado;
  const reintentarCola = useCallback(async () => {
    {
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
      // Quedan pendientes sin poder mandarse: la próxima vuelta espera más.
      return r.enviados.length > 0 || (await cola.listar()).length === 0;
    }
  }, [api, cargar, cola, textoEnviado]);
  useEffect(() => {
    void cola.listar().then(setPendientes);
  }, [cola]);
  useSondeo(reintentarCola, 10_000, true, false);

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
  // C-SESION-TERMINADA: también cuando la sesión vence (la app vuelve a entrar y el inicio se
  // desmonta): el modo queda «apagado» para que la tarea no se vuelva a armar sola.
  useEffect(
    () => () => {
      fijarModoRastreo('apagado');
      void detenerUbicacionFondo();
    },
    [],
  );

  // C-GPS-PANTALLA-APAGADA: se rastrea conectado o con un pedido, viaje o ruta en curso; nunca
  // desconectado sin trabajo. Activo manda cada 25 m; libre cada 250 m; quieto, el latido de 2 min.
  const modoGps = modoRastreo({
    conectado: !!estado?.conectado,
    pedidoActivo: !!estado?.activo,
    viajeActivo: !!viajeActivo,
    // Ruta de paquetes ya en marcha (cargando o repartiendo), no solo ofrecida.
    rutaFlexActiva: rutaFlex?.estado === 'en_carga' || rutaFlex?.estado === 'en_curso',
  });
  useEffect(() => {
    fijarModoRastreo(modoGps);
    if (modoGps === 'apagado') {
      vigilante.current?.remove();
      vigilante.current = null;
      void detenerUbicacionFondo();
      return;
    }
    let vivo = true;
    let ultimoEnvio: { lat: number; lng: number; en: number } | null = null;
    const mandar = (p: Location.LocationObject, forzar = false) => {
      const cuerpo = cuerpoUbicacion(p);
      if (!forzar && !tocaMandarSegunModo(modoGps, ultimoEnvio, cuerpo)) return;
      ultimoEnvio = { lat: cuerpo.lat, lng: cuerpo.lng, en: Date.now() };
      // C-LATIDO-UBICACION: viaja con la hora de la lectura y la del envío; el servidor no cuenta
      // como señal nueva una lectura vieja.
      return api
        .pedir('POST', '/datos/repartidor/ubicacion', paraEnviarUbicacion(cuerpo))
        .catch(() => undefined);
    };
    // GPS en segundo plano (punto 23): sigue mandando posición con la pantalla apagada o detrás del
    // mapa. La primera vez, una explicación antes del cuadro del sistema (como Dasher).
    void iniciarUbicacionFondo({
      titulo: tg.fondo.titulo,
      cuerpo: tg.fondo.cuerpo,
      explicacion: tg.fondo.explicacion,
    });
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 30, timeInterval: 10_000 },
      (p) => {
        // Revisión 2 (C-LATIDO-UBICACION): marcada con el reloj del celular al recibirla.
        ultimaLectura.current = marcarRecibida(p);
        setAqui({ lat: p.coords.latitude, lng: p.coords.longitude });
        setPrecision(p.coords.accuracy ?? null);
        setGpsSimulado(p.mocked === true);
        void mandar(ultimaLectura.current);
      },
    ).then((s) => {
      if (vivo) vigilante.current = s;
      else s.remove();
    });
    // C-LATIDO-UBICACION: quieto, el GPS no avisa nada (solo cada 30 m). Cada 2 minutos se manda
    // la última posición conocida para que el servidor lo siga contando como disponible y no le
    // quite un pedido aceptado. El servidor escribe como mucho una vez por latido.
    const latido = setInterval(() => {
      void (async () => {
        // Se pide una lectura NUEVA (quieto, el GPS no avisa nada). Si el GPS no da, se manda la
        // última con su hora real y el servidor no la toma por señal viva (C-LATIDO-UBICACION).
        const p =
          (await ubicacionConLimite().then((x) => x && marcarRecibida(x))) ??
          ultimaLectura.current ??
          (await Location.getLastKnownPositionAsync().catch(() => null));
        if (!vivo || !p) return;
        ultimaLectura.current = p;
        await mandar(p, true);
      })();
    }, LATIDO_UBICACION_MS);
    return () => {
      vivo = false;
      clearInterval(latido);
      vigilante.current?.remove();
      vigilante.current = null;
    };
  }, [modoGps, api, tg.fondo]);

  // C-ZONAS-ANTES-DE-CONECTAR: desconectado también se ve el mapa de zonas con más pedidos (como
  // Dasher): es cuando el repartidor decide adónde ir. Se lee la ubicación UNA vez y solo si ya dio
  // el permiso (aquí nunca se le vuelve a pedir).
  useEffect(() => {
    if (estado?.conectado || aqui) return;
    let vivo = true;
    void (async () => {
      const permiso = await Location.getForegroundPermissionsAsync().catch(() => null);
      if (!permiso?.granted) return;
      const p = await ubicacionConLimite();
      if (vivo && p) setAqui({ lat: p.coords.latitude, lng: p.coords.longitude });
    })();
    return () => {
      vivo = false;
    };
  }, [estado?.conectado, aqui]);

  // En camino: la ubicación se revisa cada 5 segundos para saber si ya llegó a la puerta.
  const enCamino = estado?.activo?.estado === 'en_camino';
  const leerEnCamino = useCallback(async () => {
    const p = await ubicacionConLimite();
    if (!p) return;
    setAqui({ lat: p.coords.latitude, lng: p.coords.longitude });
    setPrecision(p.coords.accuracy ?? null);
    setGpsSimulado(p.mocked === true);
    // C-SESION-TERMINADA: si el envío falla, la próxima lectura espera más.
    return api
      .pedir('POST', '/datos/repartidor/ubicacion', {
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        precision: p.coords.accuracy ?? null,
        simulada: p.mocked === true,
      })
      .then(() => true)
      .catch(() => false);
  }, [api]);
  useSondeo(leerEnCamino, 5000, enCamino);

  /** C-CHAT-FOTOS: foto para el chat del pedido (mostrar un reemplazo o dónde dejar el pedido). */
  async function fotoParaChat(): Promise<Blob | null> {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      setError(t.permisoCamara);
      return null;
    }
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
    const a = r.canceled ? null : r.assets[0];
    // C-FOTO-EVIDENCIA-LIVIANA: achicada en el teléfono antes de subir.
    return a
      ? (await fetch(await achicarFotoEvidencia(a, manipulateAsync, SaveFormat.JPEG))).blob()
      : null;
  }

  /**
   * Foto con la cámara + la ubicación de ese momento: así se prueba dónde y qué se entregó.
   * Devuelve la foto si quedó subida (o guardada para subir apenas haya señal).
   */
  async function tomarFoto(ruta: string, frontal = false): Promise<string | null> {
    if (subiendo) return null;
    setError('');
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) {
        setError(t.permisoCamara);
        return null;
      }
      // C-FOTO-EVIDENCIA-LIVIANA: la ubicación se pide mientras la cámara está abierta (no después),
      // y la foto se achica en el teléfono (1280 px, JPEG 0,6) antes de subir.
      const ubicacion = ubicacionConLimite();
      const r = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        ...(frontal ? { cameraType: ImagePicker.CameraType.front } : {}),
      });
      const foto = r.canceled ? null : r.assets[0];
      if (!foto) return null;
      setSubiendo(true);
      const [p, uriChica] = await Promise.all([
        ubicacion,
        achicarFotoEvidencia(foto, manipulateAsync, SaveFormat.JPEG),
      ]);
      if (!p) {
        setError(t.ubicacionTarda);
        return null;
      }
      setAqui({ lat: p.coords.latitude, lng: p.coords.longitude });
      const blob = await (await fetch(uriChica)).blob();
      const rutaCompleta = `${ruta}${ruta.includes('?') ? '&' : '?'}lat=${p.coords.latitude}&lng=${p.coords.longitude}`;
      try {
        await api.subirFoto(blob, rutaCompleta);
      } catch (x) {
        // Sin señal (o con un error pasajero) la foto de la recogida y la de la entrega se guardan
        // en el celular y se reintentan solas cada 10 segundos (C-FOTO-EVIDENCIA-LIVIANA).
        const seReintenta =
          ruta.includes('/entregado') ||
          ruta.includes('/foto-entrega') ||
          ruta.includes('/foto-recogida');
        if (
          !seReintenta ||
          !(await guardarSiSinSenal(x, {
            ruta: rutaCompleta,
            tipo: 'foto',
            cuerpo: await comoDataUrl(blob),
          }))
        )
          throw x;
      }
      await cargar();
      return foto.uri;
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      await cargar();
      return null;
    } finally {
      setSubiendo(false);
    }
  }

  /** C-DESLIZAR-ENTREGA: la foto de la puerta se sube sola, como evidencia; no cierra el pedido. */
  async function tomarFotoEntrega(pedidoId: string) {
    const uri = await tomarFoto(`/datos/repartidor/pedidos/${pedidoId}/foto-entrega`);
    if (uri) setFotoTomada((m) => ({ ...m, [pedidoId]: uri }));
  }

  /**
   * C-DESLIZAR-ENTREGA: el deslizador cierra la entrega en la puerta con la foto ya tomada. El
   * servidor confirma la foto y que el GPS esté en la dirección. Sin señal, queda en la cola
   * detrás de la foto (la cola manda en orden) y se reintenta sola.
   */
  async function completarEnPuerta(pedidoId: string) {
    setError('');
    try {
      const p = await ubicacionConLimite();
      if (!p) return setError(t.ubicacionTarda);
      setAqui({ lat: p.coords.latitude, lng: p.coords.longitude });
      const ruta = `/datos/repartidor/pedidos/${pedidoId}/entregado`;
      const cuerpo = { lat: p.coords.latitude, lng: p.coords.longitude, modo: 'puerta' };
      try {
        await api.pedir('POST', ruta, cuerpo);
      } catch (x) {
        if (!(await guardarSiSinSenal(x, { ruta, tipo: 'json', cuerpo: JSON.stringify(cuerpo) })))
          throw x;
      }
      setFotoTomada((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== pedidoId)));
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  /** La foto de la puerta y el deslizador (el pedido principal y los agrupados). */
  function cierrePuerta(p: Pedido, conFotoPrincipal: boolean) {
    const local = fotoTomada[p.id];
    const lista = Boolean(p.fotoEntregaLista) || Boolean(local);
    return (
      <View style={{ gap: 6 }} testID="cierre-puerta">
        {lista ? (
          <View
            testID="foto-entrega-lista"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderWidth: 1,
              borderColor: '#2a2a2a',
              borderRadius: 12,
              padding: 10,
              backgroundColor: '#fff',
            }}
          >
            {local ? (
              <Image
                source={{ uri: local }}
                style={{ width: 64, height: 64, borderRadius: 8 }}
                accessibilityLabel={t.fotoLista}
              />
            ) : null}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontWeight: '800', color: C.exito }}>{t.fotoLista}</Text>
              <Pressable
                onPress={() => void tomarFotoEntrega(p.id)}
                accessibilityRole="button"
                accessibilityLabel={t.otraFoto}
                hitSlop={8}
              >
                <Text style={{ fontWeight: '700', textDecorationLine: 'underline' }}>
                  {subiendo ? t.subiendo : t.otraFoto}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Boton
            texto={subiendo ? t.subiendo : t.fotoEntrega}
            alTocar={() => void tomarFotoEntrega(p.id)}
            cargando={subiendo}
            exito={conFotoPrincipal}
            secundario={!conFotoPrincipal}
          />
        )}
        <Text style={{ color: '#666B73', fontSize: 12 }}>{t.sinCaras}</Text>
        {conFotoPrincipal || lista ? (
          <DeslizarParaCompletar
            idioma={idioma}
            listo={lista}
            ocupado={subiendo}
            alCompletar={() => completarEnPuerta(p.id)}
          />
        ) : null}
      </View>
    );
  }

  // Nunca en silencio: mientras busca la ubicación lo dice, y si algo falla se ve en pantalla.
  // C-UBICACION-AL-CONECTAR: conectar usa la lectura reciente si la hay y nunca espera al GPS más de
  // unos segundos (después, la última conocida). El permiso se mira antes de pedirlo.
  async function ubicacionAlConectar() {
    const p = await ubicacionParaConectar({
      reciente: ultimaLectura.current,
      ahora: Date.now(),
      leer: () =>
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(() =>
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        ),
      ultimaConocida: () => Location.getLastKnownPositionAsync(),
    });
    if (p) setAqui(p);
    return p;
  }
  async function permisoUbicacion() {
    const ya = await Location.getForegroundPermissionsAsync().catch(() => null);
    if (ya?.granted) return true;
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  async function alternar() {
    if (cambiando) return;
    setError('');
    setAviso('');
    setMotivoConexion(null);
    setCambiando(true);
    const conectando = !estado?.conectado;
    // C-FOTO-CARA-A-LA-VISTA: el motivo de no poder conectarse va pegado a la barra, a la vista.
    const motivo = (texto: string, campo?: string) =>
      conectando ? setMotivoConexion({ texto, campo }) : setError(texto);
    try {
      if (estado?.conectado) {
        await api.pedir('POST', '/datos/repartidor/conectar', { conectado: false });
        return await cargar();
      }
      if (!(await permisoUbicacion())) return motivo(t.sinUbicacion, 'ubicacion');
      const p = await ubicacionAlConectar();
      if (!p) return motivo(t.ubicacionTarda, 'ubicacion');
      const r = await api.pedir<{ conectado: boolean; cobertura?: string; avisoComida?: string }>(
        'POST',
        '/datos/repartidor/conectar',
        { conectado: true, lat: p.lat, lng: p.lng },
      );
      if (r.cobertura && r.cobertura !== 'dentro') setAviso(tg.pausa.fueraZona);
      // C-DESPACHO-CATALOGO (NXT-6y): conectado para otros servicios, pero sin Comida: el porqué.
      else if (r.avisoComida) setAviso(r.avisoComida);
      await cargar();
    } catch (x) {
      if (x instanceof ErrorApi) motivo(x.message, x.campo);
      else motivo(t.ubicacionTarda);
    } finally {
      setCambiando(false);
      void cargarFaltas();
      void recargarPapeles();
    }
  }

  // C-SERVICIOS-CONECTADOS: conectar UN servicio (se desliza, C-CONECTAR-DESLIZANDO; pide la ubicación, como el encendido
  // general, y pasa por las mismas puertas: identidad, papeles, términos, teléfono, foto de control).
  async function conectarServicio(id: string): Promise<boolean> {
    if (cambiandoServicio || cambiando) return false;
    setError('');
    setAviso('');
    setMotivoConexion(null);
    setCambiandoServicio(id);
    try {
      if (!(await permisoUbicacion())) {
        setMotivoConexion({ texto: t.sinUbicacion, campo: 'ubicacion', servicio: id });
        return false;
      }
      const p = await ubicacionAlConectar();
      if (!p) {
        setMotivoConexion({ texto: t.ubicacionTarda, campo: 'ubicacion', servicio: id });
        return false;
      }
      const r = await api.pedir<{ cobertura?: string; avisoComida?: string }>(
        'POST',
        `/datos/conductor/servicios/${id}/conexion`,
        { conectado: true, lat: p.lat, lng: p.lng },
      );
      if (r.cobertura && r.cobertura !== 'dentro') setAviso(tg.pausa.fueraZona);
      return true;
    } catch (x) {
      setMotivoConexion({
        texto: x instanceof ErrorApi ? x.message : t.ubicacionTarda,
        campo: x instanceof ErrorApi ? x.campo : undefined,
        servicio: id,
      });
      return false;
    } finally {
      setCambiandoServicio(null);
      await cargar();
      void cargarFaltas();
    }
  }

  // Desconectar UN servicio (después de deslizar). Los demás siguen conectados.
  async function desconectarServicio(id: string): Promise<boolean> {
    setError('');
    try {
      await api.pedir('POST', `/datos/conductor/servicios/${id}/conexion`, { conectado: false });
      return true;
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      return false;
    } finally {
      await cargar();
    }
  }

  /**
   * C-QUE-TE-FALTA: el botón de lo que le falta lleva DIRECTO a hacerlo. Devuelve el error, si lo
   * hubo, para decirlo junto al botón.
   */
  async function accionFalta(accion: AccionFalta, f: FaltaServidor): Promise<string | void> {
    const fallo = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));
    switch (accion) {
      case 'cara':
        return abrirPapeles('inicio');
      case 'vehiculo_nuevo':
        setSeccionPerfil('vehiculo');
        return setVista('datos');
      case 'vehiculo':
        if (f.vehiculoTipo === 'moto' || f.vehiculoTipo === 'carro') {
          setTipoVehiculo(f.vehiculoTipo);
          return setVista('vehiculo');
        }
        setSeccionPerfil('vehiculo');
        return setVista('datos');
      case 'activar_vehiculo':
        try {
          await api.pedir('PUT', '/datos/conductor/vehiculo-activo', { vehiculoId: f.vehiculoId });
          await Promise.all([cargarFaltas(), recargarPanel()]);
          return;
        } catch (x) {
          return fallo(x);
        }
      case 'encender': {
        const s = servicios.panel?.servicios.find((x) => x.estado === 'desconectado');
        if (!s)
          return idioma === 'en'
            ? 'No approved service yet.'
            : 'Todavía no tienes un servicio aprobado.';
        await conectarServicio(s.servicioId);
        return;
      }
      case 'recargar':
      case 'pago_movil':
        return setVista('billetera');
      case 'ubicacion': {
        if (!(await permisoUbicacion())) return t.sinUbicacion;
        const p = await ubicacionAlConectar();
        if (!p) return t.ubicacionTarda;
        try {
          await api.pedir('POST', '/datos/repartidor/ubicacion', { lat: p.lat, lng: p.lng });
          await cargarFaltas();
          return;
        } catch (x) {
          return fallo(x);
        }
      }
      default:
        return;
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
    qrLeido.current = false;
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
    /** C-RECARGA-TARJETA-ALOJADA: la recarga con tarjeta del país, con su mínimo y su máximo. */
    recargasStripe?: boolean;
    recargaTarjetaMin?: number;
    recargaTarjetaMax?: number;
    /** C-CUENTA-COBRO-CONDUCTOR: billeteras a celular del país (pago móvil; Yape y Plin). */
    cuentasACelular?: string[];
    /** C-SALDO-CARRERAS: comisión de un viaje típico y carreras que alcanzan (aproximado). */
    comisionTipica?: number;
    carrerasAlcanzan?: number | null;
    saldoBajo?: boolean;
    sinSaldo?: boolean;
    /** C-COMIDA-VE-CIRCUITO: comisión de un pedido típico de comida y pedidos que alcanzan. */
    comisionTipicaComida?: number;
    pedidosAlcanzan?: number | null;
    sinSaldoComida?: boolean;
    /** C-SALDO-CONDUCTOR: lo que Divoox le debe por regalos y las cargas de saldo. */
    regalosPorCobrar?: number;
    /** C-REGALO-VIAJE-REAL: regalos de viajes que Divoox todavía está revisando. */
    regalosEnRevision?: { monto: number; viajes: number };
    cargas?: { id: string; monto: number; tipo: string; motivo: string; creadoEn: string }[];
  } | null>(null);
  const [regalosMensaje, setRegalosMensaje] = useState('');
  // C-GANANCIAS-EN-MANO: pedidos y viajes cobrados en mano del mes (y de la semana en curso). No pasan
  // por la billetera, así que «Hoy» y el total de Ganancias los suman desde aquí. Se pide siempre:
  // un viaje en efectivo existe también donde el saldo prepago no rige (una lectura, ninguna escritura).
  const [cobrosEnMano, setCobrosEnMano] = useState<CobroEnMano[]>([]);
  const movimientosVistos = billetera?.movimientos?.length ?? 0;
  const entregaActiva = estado?.activo?.id ?? null;
  const viajeActivoId = viajeActivo?.id ?? null;
  useEffect(() => {
    let vivo = true;
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioSemana = new Date(ahora);
    inicioSemana.setDate(ahora.getDate() - ((ahora.getDay() + 6) % 7));
    // Un día de margen: el servidor filtra en UTC y aquí se filtra con la fecha local.
    const desde = new Date(Math.min(inicioMes.getTime(), inicioSemana.getTime()) - 86_400_000);
    api
      .pedir<{
        pedidos: {
          pedidoId: string;
          entregadoEn: string;
          total: number;
          moneda: string;
          cobradoEnMano?: boolean;
        }[];
        viajesEnMano?: {
          viajeId: string;
          terminadoEn: string;
          monto: number;
          moneda: string;
          montoLocal: number | null;
        }[];
      }>('GET', `/datos/repartidor/ganancias?desde=${desde.toISOString().slice(0, 10)}`)
      .then((g) => {
        if (!vivo) return;
        setCobrosEnMano([
          ...g.pedidos
            .filter((p) => p.cobradoEnMano)
            .map((p) => ({
              id: `p:${p.pedidoId}`,
              tipo: 'entrega' as const,
              fecha: p.entregadoEn,
              monto: p.total,
              moneda: p.moneda,
            })),
          ...(g.viajesEnMano ?? []).map((v) => ({
            id: `v:${v.viajeId}`,
            tipo: 'carrera' as const,
            fecha: v.terminadoEn,
            monto: v.monto,
            moneda: v.moneda,
            montoLocal: v.montoLocal,
          })),
        ]);
      })
      .catch((x: unknown) => console.warn('cobros en mano', x));
    return () => {
      vivo = false;
    };
  }, [api, movimientosVistos, entregaActiva, viajeActivoId]);
  const cargarPrepago = useCallback(async () => {
    try {
      setPrepago(await api.pedir('GET', '/datos/repartidor/saldo-prepago'));
    } catch {
      setPrepago(null);
    }
  }, [api]);
  // C-SALDO-EN-INICIO: el saldo a la vista en el inicio (solo LEE: mirar el inicio no escribe en la
  // base). Se vuelve a leer al volver al inicio y cuando termina o empieza un trabajo.
  useEffect(() => {
    if (vista !== 'inicio') return;
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
  }, [api, vista, entregaActiva]);
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
      if (x instanceof ErrorApi && x.campo === 'selfie_casco') setPideCasco(true);
    }
    await cargar();
  }

  async function accion(ruta: string, cuerpo: unknown = {}): Promise<boolean> {
    setError('');
    try {
      await api.pedir('POST', ruta, cuerpo);
      await cargar();
      return true;
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      await cargar();
      return false;
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
      // C-ALTA-COBROS-DENTRO: el alta se hace dentro de Divoox, en el panel con la sesión iniciada.
      await abrirPanel(api, URL_SERVIDOR, '/panel/earnings');
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
          <Text style={{ color: '#666B73', fontSize: 13, marginTop: 6 }}>{t.escribirCodigo}</Text>
          <FilaConBoton>
            <TextInput
              value={codigo}
              onChangeText={(x) => setCodigo(x.toUpperCase().slice(0, 4))}
              placeholder="A1B2"
              accessibilityLabel={t.escribirCodigo}
              autoCapitalize="characters"
              style={[e.input, CASILLA_EN_FILA, { letterSpacing: 4 }]}
            />
            {/* C-BOTON-EN-FILA: sin caja de ancho fijo; la palabra nunca se parte. */}
            <Boton texto={t.verificar} alTocar={() => void verificar(codigo)} secundario enFila />
          </FilaConBoton>
        </>
      )
    ) : null;
  // C-FOTO-CARA-A-LA-VISTA: las «puertas» para conectarse (foto con casco, términos, celular y foto
  // de control). En el inicio van ARRIBA, junto a lo que le falta; en las demás pantallas, como siempre.
  const lineaError =
    error || errorCarga ? (
      <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
        {error || errorCarga}
      </Text>
    ) : null;
  const tarjetaTelefono = estado?.telefonoPorVerificar ? (
    <ConfirmarTelefono
      ultimos={estado.telefonoPorVerificar}
      alListo={(texto) => {
        setAviso(texto);
        void cargar();
        void cargarFaltas();
      }}
    />
  ) : null;
  const puertas = (sinTelefono = false) => (
    <>
      {pideCasco ? (
        <View style={[e.tarjeta, { borderWidth: 2, borderColor: C.secundario }]}>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>{t.selfieCasco}</Text>
          <Text style={{ color: '#666B73', fontSize: 13, marginBottom: 6 }}>
            {t.selfieCascoAyuda}
          </Text>
          <Boton
            texto={subiendo ? t.subiendo : t.tomarSelfie}
            alTocar={() =>
              void tomarFoto('/datos/conductor/selfie-casco', true).then(() => {
                setPideCasco(false);
                setError('');
                setAviso(t.selfieCascoLista);
              })
            }
            cargando={subiendo}
          />
        </View>
      ) : null}
      {estado?.terminosPorAceptar ? (
        // C-TERMINOS-ACTUALIZADOS (31 oct 2026, como DoorDash): leer, marcar y aceptar.
        <View style={[e.tarjeta, { borderWidth: 2, borderColor: C.secundario }]} testID="terminos">
          <Text style={{ fontWeight: '800', fontSize: 16 }}>{t.terminosTitulo}</Text>
          <Text style={{ color: '#666B73', fontSize: 13, marginBottom: 6 }}>{t.terminosAyuda}</Text>
          <Text
            accessibilityRole="link"
            style={{ color: C.secundario, textDecorationLine: 'underline', marginBottom: 10 }}
            onPress={() =>
              abrirPagina(`https://divoox.com${idioma === 'es' ? '/es' : ''}/driver-terms`)
            }
          >
            {t.terminosLeer}
          </Text>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: aceptoTerminos }}
            onPress={() => setAceptoTerminos((x) => !x)}
            style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 }}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: aceptoTerminos ? C.primario : '#6B7078',
                backgroundColor: aceptoTerminos ? C.primario : '#fff',
              }}
            />
            <Text style={{ flex: 1 }}>{t.terminosAcepto}</Text>
          </Pressable>
          <Boton
            texto={t.terminosDeAcuerdo}
            alTocar={() => {
              if (!aceptoTerminos || !estado?.terminosPorAceptar) return;
              void api
                .pedir('POST', '/datos/repartidor/terminos', { version: estado.terminosPorAceptar })
                .then(() => cargar())
                .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
            }}
            secundario={!aceptoTerminos}
          />
        </View>
      ) : null}
      {sinTelefono ? null : tarjetaTelefono}
      {estado?.selfieControlPendiente ? (
        <View style={[e.tarjeta, { borderWidth: 2, borderColor: C.secundario }]}>
          <Text style={{ fontWeight: '800', fontSize: 16 }}>{t.selfieControl}</Text>
          <Text style={{ color: '#666B73', fontSize: 13, marginBottom: 6 }}>
            {t.selfieControlAyuda}
          </Text>
          {/* C-PRUEBA-DE-VIDA (como DoorDash): de frente y después mirando a la derecha. */}
          <Text style={{ fontWeight: '700', marginBottom: 6 }}>
            {estado.selfieControlFalta === 'giro' ? t.pasoGiro : t.pasoFrente}
          </Text>
          <Boton
            texto={
              subiendo
                ? t.subiendo
                : estado.selfieControlFalta === 'giro'
                  ? t.tomarGiro
                  : t.tomarSelfie
            }
            alTocar={() =>
              estado.selfieControlFalta === 'giro'
                ? void tomarFoto('/datos/kyc/selfie-control?pose=giro', true).then(() =>
                    setAviso(t.selfieLista),
                  )
                : void tomarFoto('/datos/kyc/selfie-control?pose=frente', true)
            }
            cargando={subiendo}
          />
        </View>
      ) : null}
    </>
  );
  const mensajesResto = (
    <>
      {estado?.ganarPorTiempo ? (
        <ModoPago
          datos={estado.ganarPorTiempo}
          conectado={Boolean(estado.conectado)}
          alCambiar={() => void cargar()}
        />
      ) : null}
      {/* C-FLOTA-PROPIA: el restaurante que lo invitó a su equipo, y para quién reparte. */}
      <InvitacionesFlota
        alAceptar={(texto) => {
          setAviso(texto);
          void cargar();
        }}
      />
      {/* C-FLEX-INVITAR-CONDUCTOR: la empresa que lo invitó, para aceptar ahí mismo. */}
      <InvitacionesEmpresa
        alAceptar={(texto) => {
          setAviso(texto);
          void cargar();
        }}
      />
      {pendientes.length ? (
        <View style={[e.tarjeta, { borderColor: '#8A5300' }]}>
          <Text style={{ color: '#8A5300', fontWeight: '800' }}>
            {t.pendientes}: {pendientes.length}
          </Text>
          <Text style={{ color: '#666B73', fontSize: 13 }}>{t.pendienteConfirmar}</Text>
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
  const mensajes = (
    <>
      {lineaError}
      {puertas()}
      {mensajesResto}
    </>
  );

  // ───────── Diseño nuevo (14 oct 2026): datos reales de hoy, tiempo conectado en esta sesión ─────────
  const hoyLocal = new Date().toLocaleDateString('en-CA');
  const deHoy = (billetera?.movimientos ?? []).filter(
    (m) => new Date(`${m.fecha.replace(' ', 'T')}Z`).toLocaleDateString('en-CA') === hoyLocal,
  );
  // C-GANANCIAS-CARRERAS y C-GANANCIAS-EN-MANO: billetera y cobrado en mano, cada moneda aparte.
  const hoyConEnMano = resumenConEnMano(deHoy, cobrosDelPeriodo(cobrosEnMano, 'hoy', new Date()));
  const entregasHoy = hoyConEnMano.entregas + hoyConEnMano.carreras;
  const palabraHoy = palabraDeHoy(hoyConEnMano.entregas, hoyConEnMano.carreras);
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
      : usaMillas(activo?.pais, idioma)
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
  // Fase cero (C-SERVICIOS-CONECTADOS): el inicio, el perfil y «Agregar un servicio» van en fondo
  // blanco, como el diseño aprobado; las demás pantallas siguen en el gris de siempre.
  const lienzo = (pestana: Pestana, cuerpo: ReactNode, sinScroll = false, blanco = false) => (
    <SafeAreaView
      style={[e.fondo, { backgroundColor: blanco ? '#FFFFFF' : '#F6F6F6' }]}
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
              ['turnos', idioma === 'en' ? 'My shifts' : 'Mis turnos'],
              // C-VIAJES-FIJOS: la agenda de sus clientes fijos.
              ['clientesFijos', idioma === 'en' ? 'Regular riders' : 'Clientes fijos'],
              ['seguridad', idioma === 'en' ? 'Safety' : 'Seguridad'],
              // C-CAMILA-CHAT: Ayuda (Habla con soporte, Mi equipo para los líderes, casos y guías).
              ['ayuda', textosSoporte(idioma).ayuda],
              ['billetera', t.vistaBilletera],
              ['datos', t.vistaDatos],
            ] as const
          ).map(([v, texto]) => (
            <Text
              key={v}
              style={{ paddingVertical: 10, fontWeight: vista === v ? '800' : '600' }}
              onPress={() => {
                setAyudaEnChat(false);
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
      <View style={{ flex: 1 }}>
        {sinScroll ? (
          <View style={{ flex: 1 }}>{cuerpo}</View>
        ) : (
          <ScrollView
            ref={scrollLienzo}
            onScroll={(ev) => {
              desplazado.current = ev.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={64}
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {cuerpo}
          </ScrollView>
        )}
        {/* C-SERVICIOS-CONECTADOS y C-CONECTAR-DESLIZANDO: el aviso solo informa; ningún toque
            reconecta (para volver, se desliza la tarjeta). */}
        <AvisoDeshacer
          visible={Boolean(desconectado)}
          titulo={desconectado ? ts.avisoTitulo(desconectado.nombre, desconectado.id) : ''}
          texto={`${desconectado?.texto ?? ts.avisoTexto} ${ts.avisoVolver}`}
          alCerrar={() => setDesconectado(null)}
        />
      </View>
      <BarraInferior
        idioma={idioma}
        activa={pestana}
        alTocar={(p) => setVista(p === 'ganancias' ? 'billetera' : p === 'perfil' ? 'datos' : p)}
      />
      <Modal
        presentationStyle="pageSheet"
        visible={escaneando}
        animationType="slide"
        onRequestClose={() => setEscaneando(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (qrLeido.current) return;
              qrLeido.current = true;
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

  // C-AVISO-IA-UNICO: la cuenta que no contestó el aviso de IA lo ve una vez al entrar, en su propia
  // pantalla. Nunca en medio de un pedido o de un viaje, ni encima de la ayuda.
  if (
    hayQueMostrarAvisoIa(papeles.v) &&
    !estado?.activo &&
    !viajeActivo &&
    vista !== 'ayuda' &&
    vista !== 'papeles'
  )
    return (
      <AvisoIa
        api={api}
        idioma={idioma}
        alListo={async (acepto) => {
          // C-FOTO-CARA-A-LA-VISTA: la respuesta ya quedó guardada; el aviso no vuelve a salir aunque
          // la relectura falle (si falla, el inicio lo dice con «Reintentar»).
          papeles.marcar({ avisoIaPendiente: false, permisoIa: acepto });
          await papeles.recargar();
          return true;
        }}
      />
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
    // C-GANANCIAS-COHERENTES: un regalo de Divoox suma al total, no es una entrega.
    const { partes, enMano, bolivares, entregas, carreras, regalos } = resumenConEnMano(
      enPeriodo,
      cobrosDelPeriodo(cobrosEnMano, periodo, ahora),
    );
    return lienzo(
      'ganancias',
      <View style={{ padding: 16, gap: 12 }}>
        {mensajes}
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.secundario }}>{td.ganancias}</Text>
        {/* C-AGENTE-DIVOOX: cobrar las ganancias en efectivo con un Agente Divoox (si la ciudad lo tiene). */}
        <CobrarEfectivo
          api={api}
          idioma={idioma}
          cuenta={usuario?.id}
          alCambiar={() => void cargarPrepago()}
        />
        {prepago &&
        (prepago.efectivoActivo ||
          prepago.transferenciaActiva ||
          prepago.recargasPuntoVenta ||
          prepago.recargasStripe ||
          (prepago.comisionTipica ?? 0) > 0 ||
          // C-SALDO-CONDUCTOR: con regalos por cobrar o cargas de saldo, también se ve.
          (prepago.regalosPorCobrar ?? 0) > 0 ||
          (prepago.regalosEnRevision?.monto ?? 0) > 0 ||
          (prepago.cargas?.length ?? 0) > 0) ? (
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
            <Text style={{ fontWeight: '800', color: C.secundario }}>{tg.prepago.titulo}</Text>
            <Text style={{ color: '#666B73', fontSize: 12 }}>{tg.prepago.ayuda}</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.secundario }}>{tg.prepago.disponible}</Text>
              <Text
                style={{
                  fontWeight: '800',
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
            {prepago.carrerasAlcanzan != null && prepago.comisionTipica ? (
              <View testID="carreras-alcanzan">
                <Text
                  style={{
                    fontWeight: '800',
                    color: prepago.saldoBajo ? C.primario : '#0D7A3A',
                  }}
                >
                  {tg.prepago.carreras(prepago.carrerasAlcanzan)}
                </Text>
                <Text style={{ color: '#666B73', fontSize: 12 }}>
                  {tg.prepago.carrerasAyuda(
                    formatearMonto(prepago.comisionTipica, prepago.moneda, idioma),
                  )}
                </Text>
              </View>
            ) : null}
            {prepago.pedidosAlcanzan != null && prepago.comisionTipicaComida ? (
              <View testID="pedidos-alcanzan">
                <Text
                  style={{
                    fontWeight: '800',
                    color: prepago.pedidosAlcanzan < 3 ? C.primario : '#0D7A3A',
                  }}
                >
                  {tg.prepago.pedidos(prepago.pedidosAlcanzan)}
                </Text>
                <Text style={{ color: '#666B73', fontSize: 12 }}>
                  {tg.prepago.pedidosAyuda(
                    formatearMonto(prepago.comisionTipicaComida, prepago.moneda, idioma),
                  )}
                </Text>
              </View>
            ) : null}
            {prepago.sinSaldoComida ? (
              <Text style={{ color: C.primario, fontSize: 12 }}>{tg.prepago.sinSaldoPedidos}</Text>
            ) : null}
            {prepago.sinSaldo ? (
              <Text style={{ color: C.primario, fontSize: 12 }}>{tg.prepago.sinSaldoViajes}</Text>
            ) : prepago.saldoBajo ? (
              <Text style={{ color: C.primario, fontSize: 12 }}>{tg.prepago.saldoBajo}</Text>
            ) : prepago.disponible <= 0 ? (
              <Text style={{ color: C.primario, fontSize: 12 }}>{tg.prepago.sinSaldo}</Text>
            ) : null}
            {(prepago.regalosPorCobrar ?? 0) > 0 ? (
              <View testID="regalos-por-cobrar" style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.secundario }}>{tg.prepago.regalosPorCobrar}</Text>
                  <Text style={{ fontWeight: '800', color: '#0D7A3A' }}>
                    {formatearMonto(prepago.regalosPorCobrar ?? 0, prepago.moneda, idioma)}
                  </Text>
                </View>
                <Text style={{ color: '#666B73', fontSize: 12 }}>{tg.prepago.regalosAyuda}</Text>
                <Boton
                  texto={tg.prepago.regalosASaldo}
                  exito
                  alTocar={() =>
                    void (async () => {
                      try {
                        const r = await api.pedir<{ monto: number }>(
                          'POST',
                          '/datos/repartidor/regalos/a-saldo',
                          {},
                        );
                        setRegalosMensaje(
                          tg.prepago.regalosPasados(
                            formatearMonto(r.monto, prepago.moneda, idioma),
                          ),
                        );
                        await cargarPrepago();
                      } catch (x) {
                        setError(x instanceof Error ? x.message : String(x));
                      }
                    })()
                  }
                />
              </View>
            ) : null}
            {(prepago.regalosEnRevision?.monto ?? 0) > 0 ? (
              <View testID="regalos-en-revision" style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: C.secundario, flex: 1 }}>
                    {tg.prepago.regalosEnRevision}
                  </Text>
                  <Text style={{ fontWeight: '800', color: '#666B73' }}>
                    {formatearMonto(prepago.regalosEnRevision?.monto ?? 0, prepago.moneda, idioma)}
                  </Text>
                </View>
                <Text style={{ color: '#666B73', fontSize: 12 }}>
                  {tg.prepago.regalosEnRevisionAyuda}
                </Text>
              </View>
            ) : null}
            {regalosMensaje ? (
              <Text accessibilityRole="alert" style={{ color: '#0D7A3A', fontWeight: '700' }}>
                {regalosMensaje}
              </Text>
            ) : null}
            {prepago.cargas?.length ? (
              <View testID="cargas-saldo" style={{ gap: 4 }}>
                <Text style={{ fontWeight: '800', color: C.secundario }}>
                  {tg.prepago.cargasTitulo}
                </Text>
                {prepago.cargas.slice(0, 5).map((k) => (
                  <View
                    key={k.id}
                    style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
                  >
                    <Text style={{ color: '#666B73', flex: 1 }}>
                      {new Map(Object.entries(tg.prepago.tipoCarga)).get(k.tipo) ?? k.motivo}
                    </Text>
                    <Text style={{ fontWeight: '700', color: '#0D7A3A' }}>
                      +{formatearMonto(k.monto, prepago.moneda, idioma)}
                    </Text>
                  </View>
                ))}
              </View>
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
            {prepago.recargasStripe && (prepago.recargaTarjetaMin ?? 0) > 0 ? (
              <RecargaTarjeta
                moneda={prepago.moneda ?? 'USD'}
                min={prepago.recargaTarjetaMin ?? 0}
                max={prepago.recargaTarjetaMax ?? 0}
                idioma={idioma}
                alVolver={cargarPrepago}
              />
            ) : null}
          </View>
        ) : null}
        {prepago?.cuentasACelular?.length ? (
          <CuentaCobro tipos={prepago.cuentasACelular} idioma={idioma} />
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
                backgroundColor: periodo === pz ? C.secundario : '#fff',
              }}
            >
              <Text style={{ fontWeight: '700', color: periodo === pz ? '#fff' : C.secundario }}>
                {pz === 'hoy' ? td.hoy : pz === 'semana' ? td.semana : td.mes}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={e.tarjeta}>
          <Text style={{ color: '#666B73', fontWeight: '600' }}>
            {periodo === 'hoy'
              ? td.totalDe.hoy
              : periodo === 'semana'
                ? td.totalDe.semana
                : td.totalDe.mes}
          </Text>
          <Text
            testID="ganancias-total"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{ fontSize: 34, fontWeight: '800', color: C.secundario }}
          >
            {/* C-GANANCIAS-EN-MANO: billetera (dólares) y cobrado en mano, cada moneda aparte. */}
            {partes.map((x) => formatearMonto(x.monto, x.moneda, idioma)).join(' + ')}
          </Text>
          {enMano.length ? (
            <Text style={{ color: '#666B73' }} testID="ganancias-incluye-en-mano">
              {td.incluyeEnMano.replace(
                '{monto}',
                enMano.map((x) => formatearMonto(x.monto, x.moneda, idioma)).join(' + '),
              )}
              {bolivares > 0
                ? ` ${td.enBolivares.replace('{monto}', textoLocal({ moneda: 'VES', monto: bolivares, tasa: 0, fecha: '' }, idioma))}`
                : ''}
            </Text>
          ) : null}
          <Text style={{ color: '#666B73' }}>
            {/* C-PLURAL y C-GANANCIAS-CARRERAS: «1 entrega», «2 carreras» o las dos. */}
            {textoTrabajos(entregas, carreras, idioma)}
            {periodo === 'hoy' && segundosConectado
              ? ` · ${Math.floor(segundosConectado / 3600)}h ${Math.floor((segundosConectado % 3600) / 60)}m`
              : ''}
          </Text>
          {regalos > 0 ? (
            <Text style={{ color: '#666B73' }} testID="ganancias-incluye-regalos">
              {td.incluyeRegalos.replace('{monto}', formatearMonto(regalos, 'USD', idioma))}
            </Text>
          ) : null}
        </View>
        <Ganancias api={api} idioma={idioma} periodo={periodo} />
        <ResumenAnual api={api} idioma={idioma} />
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
  // C-REFERIDOS-EQUIPOS: su código, sus invitados y, si es líder, su equipo.
  if (vista === 'miEquipo')
    return lienzo(
      'perfil',
      <MiEquipo api={api} idioma={idioma} moneda={prepago?.moneda ?? 'USD'} />,
    );
  // C-LINEAS-TAXI: su línea de taxi o mototaxi, las solicitudes y su equipo.
  if (vista === 'miLinea') return lienzo('perfil', <MiLinea api={api} idioma={idioma} />);
  // C-PERFIL-CONDUCTOR: «Así te ven los pasajeros» y «Completar mi perfil».
  if (vista === 'asiTeVen')
    return lienzo('perfil', <AsiTeVen api={api} idioma={idioma} />, false, true);
  // C-TURNOS-REPARTIDOR: reservar horas, como el «Schedule» de DoorDash.
  if (vista === 'turnos') return lienzo('inicio', <Turnos api={api} idioma={idioma} />);
  // C-CONDUCTOR-CONFIANZA y C-VIAJES-FIJOS: la agenda de sus clientes fijos y «No puedo».
  if (vista === 'clientesFijos')
    return lienzo('inicio', <ClientesFijos api={api} idioma={idioma} />);
  // C-SEGURIDAD-REPARTIDOR: emergencia, recorrido compartido e incidentes.
  if (vista === 'seguridad') return lienzo('inicio', <Seguridad api={api} idioma={idioma} />);
  if (vista === 'ayuda')
    return lienzo(
      'inicio',
      <AyudaDriver
        key={ayudaEnChat ? 'chat' : 'menu'}
        inicial={ayudaEnChat ? 'chat' : 'menu'}
        alCasos={() => {
          setSeccionPerfil('soporte');
          setVista('datos');
        }}
      />,
    );
  // Divoox Flex: las rutas de paquetes de las empresas (una ruta = un solo trabajo activo).
  // C-FLEX-PANTALLA-COMPLETA (como Amazon Flex): dentro de la ruta no va la cabecera con el logo; la
  // pantalla entera es para el trabajo, en fondo oscuro, con la franja de Divoox Flex arriba.
  if (vista === 'miRuta')
    return (
      <SafeAreaView
        style={[e.fondo, { backgroundColor: C.logistica }]}
        edges={['top', 'left', 'right']}
        testID="mi-ruta-completa"
      >
        <ScrollView
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          style={{ backgroundColor: FONDO_FLEX }}
          contentContainerStyle={{ paddingBottom: 16, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <MiRuta
            key={rutaDelAviso ?? 'lista'}
            api={api}
            idioma={idioma}
            abrirRutaId={rutaDelAviso ?? estado?.bloqueFlex?.rutaId ?? null}
            alSeguridad={() => setVista('seguridad')}
            alVolver={enBloque ? undefined : () => setVista('inicio')}
            alInicio={() => setVista('inicio')}
            bloque={estado?.bloqueFlex ?? null}
            bloqueados={<ServiciosBloqueados panel={servicios.panel} idioma={idioma} oscuro />}
            ponerPie={setPieFlex}
          />
        </ScrollView>
        {pieFlex}
        <BarraInferior
          idioma={idioma}
          activa="pedidos"
          alTocar={(p) => setVista(p === 'ganancias' ? 'billetera' : p === 'perfil' ? 'datos' : p)}
        />
      </SafeAreaView>
    );
  // C-ASISTENTE-DRIVER: el asistente ocupa toda la pantalla (un paso por foto, como el borrador).
  if (vista === 'papeles' && papeles.v)
    return (
      <AsistentePapeles
        v={papeles.v}
        recargar={papeles.recargar}
        alSalir={() => {
          void papeles.recargar();
          void cargarFaltas();
          setVista(vueltaPapeles);
        }}
        alAyuda={() => setVista('ayuda')}
        alSubida={papeles.fotoSubida}
        alConsentir={() => papeles.marcar({ consentimiento: true })}
      />
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

  // C-QUE-TE-FALTA: completar o corregir la moto o el carro directo desde lo que le falta.
  if (vista === 'vehiculo')
    return lienzo(
      'perfil',
      <View style={{ padding: 16, gap: 8 }}>
        <Pressable
          onPress={() => setVista('inicio')}
          accessibilityRole="button"
          testID="vehiculo-volver"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 }}
        >
          <Text style={{ fontSize: 18 }}>‹</Text>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>
            {idioma === 'en' ? 'Home' : 'Inicio'}
          </Text>
        </Pressable>
        <AltaPasajeros servicio={tipoVehiculo} />
      </View>,
    );
  // C-SERVICIOS-CONECTADOS (pantalla 05): agregar un servicio sin repetir lo ya verificado.
  if (vista === 'agregar' && servicioAgregar)
    return lienzo(
      'inicio',
      <AgregarServicio
        key={servicioAgregar.servicioId}
        servicio={
          servicios.panel?.servicios.find((x) => x.servicioId === servicioAgregar.servicioId) ??
          servicioAgregar
        }
        aprobados={(servicios.panel?.servicios ?? [])
          .filter((x) => ['conectado', 'desconectado', 'en_pausa', 'haciendo'].includes(x.estado))
          .map((x) => nombreServicio(x, idioma))}
        alVolver={() => setVista('inicio')}
        alCambiar={() => void cargar()}
      />,
      false,
      true,
    );

  // ───────── Pedidos: el historial real de entregas ─────────
  if (vista === 'pedidos') {
    const entregas = (billetera?.movimientos ?? []).filter((m) => m.concepto === 'entrega');
    return lienzo(
      'pedidos',
      <View style={{ padding: 16, gap: 12 }}>
        {mensajes}
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.secundario }}>
          {td.nav.pedidos}
        </Text>
        <CalificarCliente api={api} idioma={idioma} />
        <Pressable
          onPress={() => setVista('miRuta')}
          accessibilityRole="button"
          style={[e.tarjeta, { borderWidth: 1, borderColor: '#2a2a2a' }]}
        >
          <Text style={{ fontWeight: '800', color: C.secundario }}>{t.vistaMiRuta}</Text>
          <Text style={{ color: '#666B73' }}>{t.miRutaAyuda}</Text>
        </Pressable>
        {entregas.length === 0 ? (
          <Text style={{ color: '#666B73' }}>{td.sinPedidos}</Text>
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
                <Text style={{ color: '#666B73', fontSize: 12 }}>
                  {new Date(`${m.fecha.replace(' ', 'T')}Z`).toLocaleString(
                    idioma === 'en' ? 'en-US' : 'es-US',
                    { dateStyle: 'medium', timeStyle: 'short' },
                  )}
                </Text>
              </View>
              <Text style={{ fontWeight: '800', color: C.secundario }}>
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
          borderBottomColor: '#E6E7EA',
        }}
      >
        <View>
          <Text style={{ fontWeight: '700', color: C.secundario }}>{nombre}</Text>
          {detalle ? <Text style={{ color: '#666B73', fontSize: 12 }}>{detalle}</Text> : null}
        </View>
        <Text style={{ color: '#6B7078', fontSize: 18 }}>{abierto ? '˅' : '›'}</Text>
      </Pressable>
    );
    return lienzo(
      'perfil',
      <View style={{ padding: 16, gap: 12 }}>
        {mensajes}
        {/* C-ASISTENTE-DRIVER: «Tus papeles» también en el perfil (donde el país usa el asistente). */}
        <TusPapeles api={api} v={papeles.v} idioma={idioma} alAbrir={() => abrirPapeles('datos')} />
        {/* C-SERVICIOS-CONECTADOS (pantallas 06 y 07): el perfil en acordeón (Mi vehículo y
            Documentos); los tres puntos de la cabecera abren cerrar sesión y borrar la cuenta. */}
        <PerfilAcordeon
          servicios={servicios.panel?.servicios ?? []}
          alAbrirAsistente={papeles.v?.asistente ? () => abrirPapeles('datos') : undefined}
          alCambiarVehiculo={() => void recargarPanel()}
          menuCuenta={cuentaArriba ? <OpcionesCuenta /> : null}
          alMenu={() => setCuentaArriba((x) => !x)}
          inicial={
            seccionPerfil === 'vehiculo' || seccionPerfil === 'documentos' ? seccionPerfil : null
          }
        />
        <View style={[e.tarjeta, { paddingVertical: 2 }]}>
          {/* C-PERFIL-CONDUCTOR: su perfil tal como lo ven los pasajeros. */}
          {fila(
            idioma === 'en' ? 'How riders see you' : 'Así te ven los pasajeros',
            () => setVista('asiTeVen'),
            false,
            idioma === 'en'
              ? 'Your profile, languages and something about you'
              : 'Tu perfil, los idiomas que hablas y un dato tuyo',
          )}
          {fila(
            td.misViajes,
            () => setSeccionPerfil((x) => (x === 'viajes' ? null : 'viajes')),
            seccionPerfil === 'viajes',
            td.misViajesDetalle,
          )}
          {seccionPerfil === 'viajes' ? <MisViajesConductor /> : null}
          {fila(
            idioma === 'en' ? 'Regular riders' : 'Clientes fijos',
            () => setVista('clientesFijos'),
            false,
            idioma === 'en'
              ? 'Riders who picked you and your next regular rides'
              : 'Quién te eligió de confianza y tus próximos viajes fijos',
          )}
          {fila(
            idioma === 'en' ? 'My team and invitations' : 'Mi equipo e invitaciones',
            () => setVista('miEquipo'),
            false,
            idioma === 'en'
              ? 'Invite drivers with your code and earn balance'
              : 'Invita conductores con tu código y gana saldo',
          )}
          {fila(
            idioma === 'en' ? 'My line' : 'Mi línea',
            () => setVista('miLinea'),
            false,
            idioma === 'en'
              ? 'Your taxi or mototaxi line, its requests and your team'
              : 'Tu línea de taxi o mototaxi, sus solicitudes y tu equipo',
          )}
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
            <View style={{ paddingVertical: 8, gap: 8 }}>
              {/* C-CAMILA-CHAT: el chat con soporte también desde aquí. */}
              <Boton
                texto={textosSoporte(idioma).hablar}
                alTocar={() => {
                  setAyudaEnChat(true);
                  setVista('ayuda');
                }}
                secundario
              />
              <ReportarProblema pedidoId={estado?.activo?.id} />
              <MisCasos
                elegirCapturas={capturasConCamara(
                  selectorDeCapturas(
                    ImagePicker.launchImageLibraryAsync,
                    ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
                  ),
                  CAMARA,
                  idioma,
                )}
              />
              <MenuCuenta />
            </View>
          ) : null}
        </View>
        <UnidadDistancia
          unidad={unidadDistancia.unidad}
          porPais={usaMillas(paisDelCodigoZona(estado?.zonaId), idioma) ? 'mi' : 'km'}
          cambiar={unidadDistancia.cambiar}
        />
        {/* C-MAPA-DIA-NOCHE: colores del mapa (automático, claro u oscuro). */}
        <AjusteMapa />
        {/* C-AVISO-IA-UNICO: dar o retirar el permiso de IA (fotos y chat de ayuda). */}
        <AjusteIaChat />
        {/* C-MODERACION: a quién bloqueó y «Desbloquear». */}
        <PersonasBloqueadas />
        {/* C-CUENTA-EN-LA-APP: cerrar sesión y borrar la cuenta dentro de la app, a la vista (si
            ya se abrió arriba con los tres puntos, no se repite aquí). */}
        {cuentaArriba ? null : <OpcionesCuenta />}
        {/* C-VERSION-VISIBLE: versión y compilación instaladas, para soporte. */}
        <VersionInstalada />
      </View>,
      false,
      true,
    );
  }

  // Las hojas de oferta (viaje y comida): en el inicio y, encima de «Viaje terminado», también ahí.
  // Aceptar NO suelta el cierre al tocar (la hoja se mudaría de sitio y la alarma volvería a sonar):
  // lo suelta el trabajo nuevo cuando el sondeo lo trae (`cierreVigente`).
  const hojasDeOferta = (
    <>
      {ofertaViaje && !ofertaComida ? (
        <OfertaViajeModal
          // Una oferta nueva (o la reoferta del mismo viaje, con otro vencimiento) arranca su
          // cuenta atrás y su sonido desde cero (C-OFERTA-TIEMPO-REAL, C-OFERTA-VENCIDA-SE-CIERRA).
          key={claveOferta(ofertaViaje)}
          oferta={ofertaViaje}
          idioma={idioma}
          yo={aqui}
          alAceptar={() =>
            void accionViaje(`/datos/conductor/operaciones/${ofertaViaje.operacionId}/aceptar`)
          }
          alRechazar={() =>
            void accionViaje(`/datos/conductor/operaciones/${ofertaViaje.operacionId}/rechazar`)
          }
          alVencer={() => vencer(claveOferta(ofertaViaje))}
        />
      ) : null}
      {ofertaComida ? (
        <Oferta
          key={ofertaComida.id}
          oferta={ofertaComida}
          idioma={idioma}
          alAceptar={() => void accion(`/datos/repartidor/ofertas/${ofertaComida.id}/aceptar`)}
          alRechazar={() => void accion(`/datos/repartidor/ofertas/${ofertaComida.id}/rechazar`)}
          alVencer={() => vencer(`comida@${ofertaComida.id}`)}
        />
      ) : null}
    </>
  );

  // ───────── Divoox Moto (M4): el viaje en curso ocupa el inicio, como Uber Driver ─────────
  if (viajeMostrado && vista === 'inicio')
    return lienzo(
      'inicio',
      <View>
        {/* C-SERVICIOS-CONECTADOS (pantalla 02): lleva un envío o un pasajero; lo demás en pausa. */}
        {servicios.panel?.lleva ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 10 }}>
            <AvisoLlevando
              tipo={servicios.panel.lleva.tipo}
              servicioId={servicios.panel.lleva.servicioId}
              idioma={idioma}
            />
            <FranjaPausa panel={servicios.panel} idioma={idioma} />
          </View>
        ) : null}
        <ViajeActivo
          key={viajeMostrado.id}
          api={{
            // C-ENVIOS: la foto del paquete al recogerlo.
            subirFoto: (foto, ruta) => api.subirFoto(foto, ruta),
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
                      simulada: p.mocked === true,
                    })
                    .catch(() => undefined);
              }
              return api.pedir(metodo, ruta, cuerpo, extra);
            },
          }}
          idioma={idioma}
          viaje={viajeMostrado}
          yo={aqui}
          alCambiar={() => void cargar()}
          cierre={cierreViaje}
          alCierre={setCierreViaje}
        />
        {/* C-CIERRE-VIAJE-QUEDA: sobre «Viaje terminado», la oferta nueva con su sonido (como Uber). */}
        {ofertasSobreCierre ? hojasDeOferta : null}
      </View>,
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
        <View style={{ backgroundColor: C.secundario, paddingHorizontal: 16, paddingVertical: 14 }}>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800' }}>
            {distanciaTexto || (activo.estado === 'en_camino' ? td.entregaEn : td.recogeEn)}
          </Text>
          <Text style={{ color: '#fff', fontWeight: '700' }} numberOfLines={1}>
            {activo.estado === 'en_camino' ? activo.direccion : activo.restaurante.direccion}
          </Text>
        </View>
        {/* C-SERVICIOS-CONECTADOS (pantalla 02): sobre el mapa, «Estás llevando una comida». */}
        <View>
          <Mapa
            yo={aqui}
            restaurante={restActivo}
            casa={activo.estado === 'en_camino' ? casaActivo : null}
            direccionDestino={
              activo.estado === 'en_camino' ? activo.direccion : activo.restaurante.direccion
            }
            alto={220}
            etiquetas={etiquetasMapa}
          />
          <AvisoLlevando tipo="comida" servicioId="comida" idioma={idioma} flotante />
        </View>
        <View
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            marginTop: -18,
          }}
        >
          <View
            ref={filaPedido}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 }}
          >
            {/* C-FOTO-PUERTA: en camino y con fotos, la miniatura de la puerta reemplaza la comida. */}
            <MiniaturaPuerta
              tarjeta={filaPedido}
              pedidoId={activo.id}
              estado={activo.estado}
              notas={activo.notas || ''}
              idioma={idioma}
              respaldo={
                <Image
                  source={IMG.comida}
                  style={{ width: 54, height: 54, borderRadius: 12, backgroundColor: '#F6F6F6' }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              }
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#666B73', fontSize: 12 }}>
                {activo.estado === 'en_camino' ? td.entregaEn : td.recogeEn}
              </Text>
              <Text
                style={{ fontWeight: '800', fontSize: 17, color: C.secundario }}
                numberOfLines={1}
              >
                {activo.estado === 'en_camino' ? activo.direccion : activo.restaurante.nombre}
              </Text>
              {/* C-FOTO-PUERTA: las notas de entrega ya no se cortan a una línea (hasta tres). */}
              <Text
                style={{ color: '#666B73', fontSize: 12 }}
                numberOfLines={activo.estado === 'en_camino' ? 3 : 1}
              >
                {activo.estado === 'en_camino' ? activo.notas || '' : activo.restaurante.direccion}
              </Text>
            </View>
          </View>
          {servicios.panel ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
              <FranjaPausa panel={servicios.panel} idioma={idioma} />
            </View>
          ) : null}
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
                // C-PASOS-DESLIZANDO: llegar al restaurante se desliza (como DoorDash Dasher).
                <Deslizador
                  variante="accion"
                  tono="exito"
                  testID="pedido-llegue"
                  texto={tg.pedido.deslizarLlegue}
                  accionLector={tg.pedido.llegue}
                  confirmar={tg.pedido.confirmarLlegue}
                  alConfirmar={() => llegue(activo.id)}
                />
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
                  {activo.pagoComida &&
                  (activo.estado === 'aceptado' || activo.estado === 'listo') ? (
                    <SalidaPagoComida pago={activo.pagoComida} idioma={idioma} />
                  ) : null}
                  {!activo.pagoComida &&
                  activo.metodoPago &&
                  activo.metodoPago !== 'tarjeta' &&
                  (activo.estado === 'aceptado' || activo.estado === 'listo') ? (
                    <PagoEnLocal
                      api={api}
                      idioma={idioma}
                      pedidoId={activo.id}
                      alRegistrar={() => void cargar()}
                      fotoTicket={async () => {
                        await tomarFoto(`/datos/repartidor/pedidos/${activo.id}/foto-ticket`);
                      }}
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
                      <Text style={{ color: '#666B73', fontSize: 13 }}>{t.fotoRecogidaAyuda}</Text>
                    </>
                  ) : (
                    <Text style={{ marginTop: 8, color: '#666B73' }}>
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
                      borderTopColor: '#E6E7EA',
                      paddingTop: 8,
                    }}
                  >
                    <Text style={{ fontWeight: '700' }}>{t.noPuedo}</Text>
                    <Text style={{ color: '#666B73', fontSize: 13 }}>{t.motivo}</Text>
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
                    <Text style={{ color: '#666B73' }}>
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
                          : usaMillas(activo?.pais, idioma)
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
                              {gpsSimulado ? t.gpsSimulado : t.confirmandoGps}
                              {!gpsSimulado && precision != null && precision > PRECISION_MAXIMA_M
                                ? ` ${t.gpsImpreciso} (±${Math.round(precision)} m).`
                                : ''}
                            </Text>
                          ) : (
                            <Text style={{ color: '#666B73', fontSize: 13 }}>
                              {falta ? `${t.teFaltan} ${falta}. ` : ''}
                              {t.alLlegar}
                            </Text>
                          )}
                          {activo.excepcionUbicacion === 'pedida' ? (
                            <Text style={{ color: '#8A5300', fontWeight: '700', marginTop: 8 }}>
                              {t.esperandoSoporte}
                            </Text>
                          ) : (
                            <View style={{ marginTop: 10 }}>
                              <Text style={{ fontWeight: '700' }}>{t.sinGps}</Text>
                              <Text style={{ color: '#666B73', fontSize: 13 }}>
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
                    const pagoMovilActivo =
                      activo.metodoPago === 'transferencia_repartidor' &&
                      Boolean(activo.pais) &&
                      activo.pais !== 'US';
                    const avisoMs = activo.noApareceEn
                      ? Date.parse(`${activo.noApareceEn.replace(' ', 'T')}Z`)
                      : null;
                    const faltanSeg =
                      avisoMs == null
                        ? null
                        : Math.max(
                            0,
                            Math.ceil(
                              (avisoMs + (activo.esperaAusenteMin ?? 5) * 60_000 - tic) / 1000,
                            ),
                          );
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
                            <Text style={{ fontWeight: '800', color: C.secundario }}>
                              {tg.pedido.cobrar}
                            </Text>
                            {activo.cobroEstado && activo.cobroEstado !== 'pendiente' ? (
                              <Text style={{ color: '#0D7A3A', fontWeight: '700' }}>
                                {tg.pedido.cobroOk}
                              </Text>
                            ) : (
                              <>
                                {/* C-PRECIO-PROTAGONISTA y C-BS-EN-MANO: lo que cobra en mano,
                                    grande, en negrita y en verde, con los bolívares (donde aplica)
                                    con la tasa fijada con el pedido. */}
                                <MontoEnMano
                                  testID="cobro-directo-bs"
                                  monto={
                                    activo.enManoCobro ?? {
                                      monto: (activo.total ?? 0) - activo.propina,
                                      moneda: activo.moneda ?? 'USD',
                                      local: activo.referenciaCobro ?? null,
                                      sinTasa: false,
                                    }
                                  }
                                  idioma={idioma === 'en' ? 'en' : 'es'}
                                  quien="conductor"
                                  etiqueta={
                                    activo.metodoPago === 'efectivo'
                                      ? tg.pedido.cobrarEfectivo
                                      : tg.pedido.cobrarTransfer
                                  }
                                  color={C.exito}
                                  tamano="grande"
                                />
                                {(activo.regaloDivoox ?? 0) > 0 ? (
                                  <Text
                                    testID="cobro-divoox-paga"
                                    style={{ color: C.exito, fontWeight: '700' }}
                                  >
                                    {tg.pedido.divooxTePaga.replace(
                                      '{monto}',
                                      formatearMonto(
                                        activo.regaloDivoox ?? 0,
                                        activo.moneda,
                                        idioma,
                                      ),
                                    )}
                                  </Text>
                                ) : null}
                                <Text style={{ color: '#666B73', fontSize: 12 }}>
                                  {tg.pedido.propinaAparte}
                                </Text>
                                {/* C-PAGO-MOVIL-UNA-CORRECCION: con pago móvil solo va su
                                    confirmación (sí o no); «Cobré» y el monto son del efectivo. */}
                                {!pagoMovilActivo ? (
                                  <>
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
                                  </>
                                ) : null}
                                {pagoMovilActivo ? (
                                  <>
                                    <Boton
                                      texto={tg.pedido.pagoMovilSi}
                                      alTocar={() =>
                                        void accion(
                                          `/datos/repartidor/pedidos/${activo.id}/pago-movil`,
                                          { recibido: true },
                                        ).then((ok) => ok && setAviso(tg.pedido.cobroOk))
                                      }
                                      exito
                                    />
                                    <Boton
                                      texto={tg.pedido.pagoMovilNo}
                                      alTocar={() =>
                                        void accion(
                                          `/datos/repartidor/pedidos/${activo.id}/pago-movil`,
                                          { recibido: false },
                                        ).then((ok) => ok && setAviso(tg.pedido.pagoMovilNoOk))
                                      }
                                      secundario
                                    />
                                  </>
                                ) : null}
                                {activo.metodoPago === 'transferencia_repartidor' &&
                                !pagoMovilActivo ? (
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
                        {/* C-PIN-SIN-FOTO: con PIN, la foto no salta el PIN; se entrega en mano. */}
                        {!activo.pinRequerido && !activo.requiereEdad ? (
                          cierrePuerta(activo, !enMano)
                        ) : activo.pinRequerido ? (
                          <Text
                            style={{ color: '#666B73', fontSize: 12 }}
                            testID="con-pin-sin-foto"
                          >
                            {t.conPinSinFoto}
                          </Text>
                        ) : null}
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
                              <Text style={{ color: '#666B73', fontSize: 12 }}>
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
                                    borderColor: documento === d ? C.secundario : '#D6D8DC',
                                    backgroundColor: documento === d ? C.secundario : '#fff',
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
                            <Text style={{ color: '#666B73', fontSize: 12 }}>{tg.edad.ayuda}</Text>
                          </View>
                        ) : null}
                        {/* C-PASOS-DESLIZANDO: entregar en mano cierra el pedido: se desliza. */}
                        <Deslizador
                          variante="accion"
                          tono="exito"
                          testID="entregar-en-mano"
                          texto={t.deslizarEnMano}
                          accionLector={t.enMano}
                          ocupado={subiendo}
                          confirmar={t.confirmarEnMano}
                          alConfirmar={() => entregarEnMano()}
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
                          <Text style={{ color: '#8A5300', fontWeight: '700', marginTop: 6 }}>
                            {t.esperando5} {Math.floor(faltanSeg / 60)}:
                            {String(faltanSeg % 60).padStart(2, '0')}
                          </Text>
                        ) : activo.metodoPago && activo.metodoPago !== 'tarjeta' ? (
                          // C-COBRO-DIRECTO: se cobra en mano; no hay «lugar seguro».
                          <Text
                            style={{ color: '#666B73', marginTop: 6 }}
                            testID="sin-lugar-seguro"
                          >
                            {tg.pedido.sinLugarSeguro}
                          </Text>
                        ) : activo.pinRequerido || activo.requiereEdad ? (
                          // C-CLIENTE-AUSENTE: con PIN (o con edad) no hay «lugar seguro»: pasada la
                          // espera se cierra como «cliente no apareció» con foto del lugar.
                          <View style={{ gap: 6, marginTop: 6 }} testID="cliente-ausente">
                            <Text style={{ color: '#666B73', fontSize: 12 }}>
                              {t.clienteAusenteAyuda}
                            </Text>
                            <Boton
                              texto={subiendo ? t.subiendo : t.clienteAusente}
                              alTocar={() =>
                                void tomarFoto(
                                  `/datos/repartidor/pedidos/${activo.id}/entregado?modo=ausente`,
                                )
                              }
                              cargando={subiendo}
                              secundario
                            />
                          </View>
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
              {mostrarChat ? <ChatPedido pedidoId={activo.id} elegirFoto={fotoParaChat} /> : null}
            </View>
            {(estado?.agrupados ?? []).map((g) => {
              const casaG = g.lat != null && g.lng != null ? { lat: g.lat, lng: g.lng } : null;
              const enPuertaG = Boolean(g.llegoCliente) || g.excepcionUbicacion === 'autorizada';
              return (
                <View key={g.id} style={[e.tarjeta, { borderWidth: 1, borderColor: '#2A2A2A' }]}>
                  <Text style={{ fontWeight: '800', color: C.primario }}>{t.agrupado}</Text>
                  <Text style={{ color: '#666B73', fontSize: 12 }}>{t.agrupadoAyuda}</Text>
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
                      cierrePuerta(g, true)
                    ) : (
                      <>
                        <Boton
                          texto={t.comoLlegar}
                          alTocar={() => abrirMapa(g.lat, g.lng, g.direccion)}
                          exito
                        />
                        <Text style={{ color: '#666B73', fontSize: 13 }}>
                          {aqui && casaG ? `${t.teFaltan} ${metrosEntre(aqui, casaG)} m. ` : ''}
                          {t.alLlegar}
                        </Text>
                      </>
                    )
                  ) : (
                    <Text style={{ color: '#666B73', fontSize: 13 }}>{t.esperando}</Text>
                  )}
                  <ChatPedido pedidoId={g.id} elegirFoto={fotoParaChat} />
                </View>
              );
            })}
          </>
        </View>
      </View>,
    );
  }

  // C-SERVICIOS-CONECTADOS (pantallas 01 y 04 de DRIVER.md): arriba la tarjeta tinta con el radar,
  // el resumen de hoy y la lista de servicios al momento; debajo, Divoox Flex y el mapa de demanda.
  // C-MODO-DESTINO (BRE-6): solo pedidos que lo acercan a su destino, dos veces al día. Va SOLO en
  // el inicio, como el «destino» de Uber Driver y DoorDash (robot, 18 nov: salía también en Perfil y
  // en Ganancias, porque iba dentro de `mensajes`). Con un pedido en curso no se muestra
  // (C-DESLIZAR-ENTREGA): como Uber, se elige entre pedidos.
  // C-QUE-TE-FALTA y C-FOTO-CARA-A-LA-VISTA: arriba de todo, UN bloque con lo primero que le falta
  // (la foto de la cara es una de esas cosas) y debajo las puertas para conectarse. Si el servidor no
  // contestó todavía, la cara se decide con «Tus papeles» (lo mismo que pide el servidor).
  const caraLocal = faltaCaraParaEmpezar(papeles.v);
  const faltasVista: FaltaServidor[] | null =
    caraLocal && !faltas?.some((f) => f.clave === 'cara')
      ? [{ clave: 'cara', quien: 'conductor' }, ...(faltas ?? [])]
      : faltas;
  const primeraClave = faltasVista?.find((f) => f.clave !== 'desconectado')?.clave;
  const telefonoEnBloque = primeraClave === 'telefono' && Boolean(tarjetaTelefono);
  const caraArriba = primeraClave === 'cara' || (!faltas && caraLocal);
  const arribaInicio = !estado?.activo ? (
    <View style={{ gap: 10 }}>
      <QueTeFalta
        api={api}
        idioma={idioma}
        faltas={faltasVista}
        alAccion={accionFalta}
        cuerpos={{
          telefono: tarjetaTelefono,
          sin_pago_movil: prepago?.cuentasACelular?.length ? (
            <CuentaCobro tipos={prepago.cuentasACelular} idioma={idioma} />
          ) : undefined,
        }}
      />
      {puertas(telefonoEnBloque)}
      {papeles.error && !papeles.v ? (
        <PapelesSinCargar
          idioma={idioma}
          cargando={papeles.cargando}
          alReintentar={() => void recargarPapeles()}
        />
      ) : null}
    </View>
  ) : null;
  // C-FOTO-CARA-A-LA-VISTA: el motivo de no poder conectarse, pegado a la barra, con su botón.
  const accionMotivo = accionDeMotivo(motivoConexion?.campo);
  const motivoInicio = motivoConexion ? (
    <View
      ref={motivoRef}
      testID="motivo-conectar"
      accessibilityRole="alert"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E3E6EB',
        padding: 12,
        gap: 10,
      }}
    >
      <Text style={[e.error, { marginBottom: 0 }]}>{motivoConexion.texto}</Text>
      {accionMotivo === 'cara' ? (
        <Boton
          texto={idioma === 'en' ? 'Take my photo' : 'Tomar mi foto'}
          icono="camera-outline"
          alTocar={() => abrirPapeles('inicio')}
          testID="motivo-tomar-foto"
        />
      ) : accionMotivo === 'datos' ? (
        <Boton
          texto={idioma === 'en' ? 'Go to My info and vehicle' : 'Ir a Mis datos y vehículo'}
          alTocar={() => {
            setSeccionPerfil('vehiculo');
            setVista('datos');
          }}
          secundario
          testID="motivo-mis-datos"
        />
      ) : null}
    </View>
  ) : null;
  const mensajesInicio = (
    <>
      {estado?.activo ? lineaError : null}
      {estado?.activo ? puertas() : lineaError}
      {/* C-ASISTENTE-DRIVER: «Tus papeles», con los días que le quedan. Con la cara pendiente va
          arriba (en el bloque de lo que le falta); con un pedido en curso no estorba. */}
      {!estado?.activo && !caraArriba ? (
        <TusPapeles
          api={api}
          v={papeles.v}
          idioma={idioma}
          alAbrir={() => abrirPapeles('inicio')}
        />
      ) : null}
      {/* C-SALDO-EN-INICIO: el saldo prepago (donde el país lo usa), con aviso si se acaba. */}
      {!estado?.activo ? (
        <SaldoInicio saldo={prepago} idioma={idioma} alRecargar={() => setVista('billetera')} />
      ) : null}
      {mensajesResto}
      {!estado?.activo ? <ModoDestino cerca={aqui} /> : null}
    </>
  );
  const panelInicio = servicios.panel ? (
    <PanelServiciosInicio
      panel={servicios.panel}
      idioma={idioma}
      resumen={
        <ResumenDia
          idioma={idioma}
          partes={hoyConEnMano.partes}
          entregas={entregasHoy}
          palabra={palabraHoy}
          segundosConectado={segundosConectado}
        />
      }
      rutaFlex={rutaFlex}
      textoBloqueFlex={
        rutaFlex?.bloqueDesde && rutaFlex.bloqueHasta ? textoBloque(rutaFlex, idioma) : null
      }
      pausado={Boolean(estado?.pausado)}
      textoPausado={tg.pausa.enPausa}
      cambiando={cambiando ? 'todo' : cambiandoServicio}
      alConectarServicio={conectarServicio}
      alDesconectarServicio={desconectarServicio}
      alConectarTodo={() => alternar()}
      alDesconectarTodo={() => alternar()}
      alVerServicio={(sv) => {
        setServicioAgregar(sv);
        setVista('agregar');
      }}
      alAbrirFlex={() => setVista('miRuta')}
      alDesconectado={(id, nombre, texto) => setDesconectado({ id, nombre, texto })}
      debajo={mensajesInicio}
      arriba={arribaInicio}
      motivo={motivoInicio}
      motivoServicio={motivoConexion?.servicio}
    />
  ) : (
    <>
      {arribaInicio}
      {motivoInicio}
      <ResumenDia
        idioma={idioma}
        partes={hoyConEnMano.partes}
        entregas={entregasHoy}
        palabra={palabraHoy}
        segundosConectado={segundosConectado}
      />
      {mensajesInicio}
    </>
  );

  return lienzo(
    'inicio',
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, zIndex: 2 }}>
        {panelInicio}
      </View>
      <View>
        <Mapa
          yo={aqui}
          marcadores={marcadoresOfertas}
          zonasDemanda={zonasDemanda}
          etiquetaZona={(n, pico) =>
            pico
              ? td.pagoPico.replace('{monto}', formatearMonto(pico, monedaDemanda, idioma))
              : td.zonaOcupada.replace('{n}', String(n))
          }
          alto={alturaMapa}
          etiquetas={etiquetasMapa}
        />
        {estado?.conectado ? (
          // C-SEGURIDAD-A-LA-VISTA (31 oct 2026, como el escudo de SafeDash en el mapa de DoorDash):
          // mientras trabaja, la seguridad está a un toque, sin buscarla en el menú.
          <Pressable
            onPress={() => setVista('seguridad')}
            accessibilityRole="button"
            accessibilityLabel={idioma === 'en' ? 'Safety' : 'Seguridad'}
            testID="escudo-seguridad"
            style={{
              position: 'absolute',
              top: 24,
              right: 16,
              zIndex: 3,
              backgroundColor: '#fff',
              borderRadius: 999,
              paddingHorizontal: 12,
              paddingVertical: 6,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderWidth: 1,
              borderColor: '#E3E6EB',
            }}
          >
            <View
              style={{
                width: 12,
                height: 14,
                borderTopLeftRadius: 3,
                borderTopRightRadius: 3,
                borderBottomLeftRadius: 7,
                borderBottomRightRadius: 7,
                backgroundColor: C.primario,
              }}
            />
            <Text style={{ fontWeight: '800', fontSize: 12, color: C.secundario }}>
              {idioma === 'en' ? 'Safety' : 'Seguridad'}
            </Text>
          </Pressable>
        ) : null}
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
        {zonasDemanda.length ? (
          <View
            accessibilityRole="text"
            style={{
              position: 'absolute',
              top: 56,
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
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: 'rgba(242,13,32,0.35)',
                borderWidth: 1,
                borderColor: C.primario,
              }}
            />
            <Text style={{ fontWeight: '700', fontSize: 12 }}>{td.zonasOcupadas}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ padding: 16, gap: 10, backgroundColor: 'transparent' }}>
        {/* C-AVISOS-WEB: en la versión web, la explicación del permiso al conectarse. */}
        <TarjetaAvisosWeb visible={Boolean(estado?.conectado)} />
        {estado?.conectado && estado.ocupadoEn ? (
          // C-OCUPADO-VISIBLE (BRF-1): ocupado en una ruta o un viaje, nunca «Buscando pedidos».
          <View style={e.tarjeta} testID="ocupado-en-otra">
            <Text style={{ color: '#666B73' }}>
              {estado.ocupadoEn === 'ruta_flex' ? t.ocupadoRuta : t.ocupadoViaje}
            </Text>
          </View>
        ) : estado?.vuelveTrasDias ? (
          // Como «¡Qué bueno verte de nuevo!» de DoorDash al volver después de un tiempo.
          <View style={e.tarjeta} testID="bienvenida">
            <Text style={{ fontWeight: '800', fontSize: 16 }}>
              {t.bienvenida(usuario?.nombre.split(' ')[0] ?? '')}
            </Text>
            <Text style={{ color: '#666B73', marginTop: 4 }}>{t.bienvenidaNivel}</Text>
          </View>
        ) : null}
        {hojasDeOferta}
        {/* C-CONECTAR-DESLIZANDO: volver de la pausa trae ofertas: se desliza, nunca se toca.
            Pausar (dejar de recibir) sigue siendo un botón. */}
        {estado?.conectado && !activo && estado.pausado ? (
          <Deslizador
            variante="accion"
            tono="exito"
            texto={tg.pausa.deslizarReanudar}
            accionLector={tg.pausa.reanudar}
            confirmar={{ pregunta: tg.pausa.confirmarReanudar, si: tg.pausa.reanudar, no: ts.no }}
            alConfirmar={() => accion('/datos/repartidor/pausar', { pausado: false })}
            testID="reanudar-ofertas"
          />
        ) : estado?.conectado && !activo ? (
          <Boton
            texto={tg.pausa.pausar}
            alTocar={() => void accion('/datos/repartidor/pausar', { pausado: true })}
            secundario
          />
        ) : null}
        {estado?.reputacion ? (
          <View style={e.tarjeta} testID="nivel-reputacion">
            <Text style={{ fontWeight: '800' }}>
              {t.nivel}: {new Map(Object.entries(t.niveles)).get(estado.reputacion.nivel)} ·{' '}
              {estado.reputacion.puntaje.toFixed(1)} {t.deCien}
            </Text>
            {estado.reputacion.siguiente ? (
              <Text style={{ color: '#666B73' }}>
                {t.faltan} {estado.reputacion.siguiente.faltan} {t.puntos} {t.para}{' '}
                {new Map(Object.entries(t.niveles)).get(estado.reputacion.siguiente.nivel)}
              </Text>
            ) : null}
            {estado.reputacion.provisional ? (
              <Text style={{ color: '#666B73' }}>{t.provisional}</Text>
            ) : null}
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: Math.round(estado.reputacion.puntaje) }}
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: '#E6E7EA',
                marginTop: 8,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.max(2, Math.round(estado.reputacion.puntaje))}%`,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: C.exito,
                }}
              />
            </View>
          </View>
        ) : null}
        {estado?.reputacion ? <MiNivel api={api} idioma={idioma} /> : null}
        {estado && !estado.reputacion && (
          <View style={e.tarjeta}>
            <Text style={{ fontWeight: '800' }}>
              {t.nivel}: {enIdioma({ es: estado.nivel.es, en: estado.nivel.en }, idioma)} ·{' '}
              {estado.puntos} {t.puntos}
            </Text>
            {estado.nivel.siguiente ? (
              <Text style={{ color: '#666B73' }}>
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
                backgroundColor: '#E6E7EA',
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
    false,
    true,
  );
}
