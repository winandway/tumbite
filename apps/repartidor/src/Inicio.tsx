import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKeepAwake } from 'expo-keep-awake';
import {
  ErrorApi,
  type Nivel,
  enIdioma,
  formatearDolares,
  PRECISION_MAXIMA_M,
  llego,
  metrosEntre,
  textoLinea,
  type OpcionElegida,
  type Pendiente,
  crearCola,
  esFalloDeRed,
} from '@tumbite/compartido';
import { BilleteraRepartidor, type DatosBilletera } from './Billetera';
import { MisDatos } from './MisDatos';
import { Verificacion } from './Verificacion';
import {
  Boton,
  C,
  ChatPedido,
  MenuCuenta,
  Pantalla,
  ReportarProblema,
  TEXTOS_MOVIL,
  e,
  useSesion,
} from '@tumbite/movil';

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
  llegoCliente?: boolean;
  noApareceEn?: string | null;
  excepcionUbicacion?: 'pedida' | 'autorizada' | null;
  entrega?: 'puerta' | 'mano';
  pinRequerido?: boolean;
  lineas: {
    platoId: string;
    nombreEs: string;
    nombreEn: string;
    cantidad: number;
    opciones?: OpcionElegida[];
  }[];
};
type Estado = { conectado: boolean; puntos: number; nivel: Nivel; activo: Pedido | null };
type Billetera = DatosBilletera;

/** La ubicación con un tope de 15 segundos: si el GPS no responde, se usa la última conocida. */
async function ubicacionConLimite(): Promise<Location.LocationObject | null> {
  const tope = new Promise<null>((r) => setTimeout(() => r(null), 15000));
  const actual = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(
    () => null,
  );
  const p = await Promise.race([actual, tope]);
  return p ?? (await Location.getLastKnownPositionAsync().catch(() => null));
}

const T = {
  es: {
    conectado: 'Conectado: recibiendo pedidos',
    desconectado: 'Desconectado',
    conectar: 'Conectarme',
    desconectar: 'Desconectarme',
    sinUbicacion: 'Para recibir pedidos necesitamos tu ubicación mientras usas la app.',
    buscandoUbicacion: 'Buscando tu ubicación…',
    ubicacionTarda:
      'No pudimos leer tu ubicación. Revisa que el GPS esté encendido y que el navegador tenga permiso, y vuelve a intentar.',
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
    pedido: 'Pedido',
  },
  en: {
    conectado: 'Online: receiving orders',
    desconectado: 'Offline',
    conectar: 'Go online',
    desconectar: 'Go offline',
    sinUbicacion: 'To receive orders we need your location while you use the app.',
    buscandoUbicacion: 'Finding your location…',
    ubicacionTarda:
      'We couldn’t read your location. Make sure GPS is on and your browser has permission, then try again.',
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
  const { api, idioma, salir } = useSesion();
  const t = enIdioma(T, idioma);
  const tm = enIdioma(TEXTOS_MOVIL, idioma);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [ofertas, setOfertas] = useState<Pedido[]>([]);
  const [billetera, setBilletera] = useState<Billetera | null>(null);
  const [error, setError] = useState('');
  const [cambiando, setCambiando] = useState(false);
  const [vista, setVista] = useState<'inicio' | 'billetera' | 'datos'>('inicio');
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
  const [tic, setTic] = useState(() => Date.now());
  useEffect(() => {
    const reloj = setInterval(() => setTic(Date.now()), 1000);
    return () => clearInterval(reloj);
  }, []);

  const cargar = useCallback(async () => {
    try {
      const s = await api.pedir<Estado>('GET', '/datos/repartidor/estado');
      setEstado(s);
      if (s.conectado && !s.activo)
        setOfertas(
          (await api.pedir<{ ofertas: Pedido[] }>('GET', '/datos/repartidor/ofertas')).ofertas,
        );
      else setOfertas([]);
      setBilletera(await api.pedir<Billetera>('GET', '/datos/billetera'));
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
  const reintentar = useCallback(async () => {
    const r = await cola.reintentar(async (p) => {
      if (p.tipo === 'foto') {
        const blob = await (await fetch(p.cuerpo)).blob();
        await api.subirFoto(blob, p.ruta);
      } else await api.pedir('POST', p.ruta, JSON.parse(p.cuerpo) as unknown);
    });
    setPendientes(await cola.listar());
    if (r.enviados.length) {
      setAviso(t.pendienteEnviado);
      await cargar();
    }
    if (r.rechazados.length) setError(r.rechazados.map((x) => x.error).join(' '));
  }, [api, cargar, cola, t.pendienteEnviado]);
  useEffect(() => {
    void cola.listar().then(setPendientes);
    const reloj = setInterval(() => void reintentar(), 10_000);
    return () => clearInterval(reloj);
  }, [cola, reintentar]);

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

  /** Si no hay señal, la entrega se guarda en la cola y se avisa; si es otro error, se muestra. */
  async function guardarSiSinSenal(x: unknown, p: Omit<Pendiente, 'id' | 'creadoEn'>) {
    if (!esFalloDeRed(x)) return false;
    await cola.agregar(p);
    setPendientes(await cola.listar()); // la tarjeta «Pendiente de confirmar» lo explica
    return true;
  }

  // Mientras está conectado, la ubicación se manda cada vez que se mueve (solo con la app abierta).
  useEffect(() => {
    if (!estado?.conectado) {
      vigilante.current?.remove();
      vigilante.current = null;
      return;
    }
    let vivo = true;
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
  }, [estado?.conectado, api]);

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
  async function tomarFoto(ruta: string) {
    if (subiendo) return;
    setError('');
    try {
      const permiso = await ImagePicker.requestCameraPermissionsAsync();
      if (!permiso.granted) return setError(t.permisoCamara);
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
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
      await api.pedir('POST', '/datos/repartidor/conectar', {
        conectado: true,
        lat: p.coords.latitude,
        lng: p.coords.longitude,
      });
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
      await api.pedir('POST', '/datos/billetera/retirar', { montoCentavos: billetera.saldo });
      setAviso(t.retirado);
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
  // Menú de tres rayas: la billetera completa vive en su propia vista, como en una app de banco.
  const menuCabecera = (
    <View style={{ marginBottom: 8 }}>
      <Pressable
        onPress={() => setMenuAbierto((x) => !x)}
        accessibilityRole="button"
        accessibilityLabel={t.menu}
        hitSlop={8}
        style={{ alignSelf: 'flex-start', padding: 6 }}
      >
        {/* Tres rayas dibujadas (sin emojis ni símbolos raros). */}
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              width: 24,
              height: 3,
              borderRadius: 2,
              backgroundColor: C.secundario,
              marginVertical: 2.5,
            }}
          />
        ))}
      </Pressable>
      {menuAbierto ? (
        <View style={e.tarjeta}>
          {(
            [
              ['inicio', t.vistaInicio],
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
    </View>
  );
  // El resultado de un botón (retirar, conectar el banco) se ve en la pantalla donde se tocó,
  // también en la billetera: antes ahí no salía ni el «Retiro en camino» ni el error.
  const mensajes = (
    <>
      {error || errorCarga ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error || errorCarga}
        </Text>
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
  if (vista === 'billetera' && billetera)
    return (
      <Pantalla titulo={t.vistaBilletera}>
        {menuCabecera}
        {mensajes}
        <BilleteraRepartidor
          datos={billetera}
          idioma={idioma}
          retirar={() => void retirar()}
          conectar={() => void banco()}
        />
        <Text style={e.enlace} onPress={() => setVista('inicio')} accessibilityRole="button">
          {t.volverInicio}
        </Text>
      </Pantalla>
    );
  if (vista === 'datos')
    return (
      <Pantalla titulo={t.vistaDatos}>
        {menuCabecera}
        <Verificacion />
        <MisDatos />
        <Text style={e.enlace} onPress={() => setVista('inicio')} accessibilityRole="button">
          {t.volverInicio}
        </Text>
      </Pantalla>
    );
  return (
    <Pantalla>
      {menuCabecera}
      {estado && (
        <Pressable
          onPress={() => void alternar()}
          accessibilityRole="switch"
          accessibilityState={{ checked: estado.conectado }}
          style={[e.tarjeta, { backgroundColor: estado.conectado ? C.exito : C.secundario }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
            {estado.conectado ? t.conectado : t.desconectado}
          </Text>
          <Text
            style={{
              // Blanco subrayado sobre verde; el rojo no se leía. Sobre gris oscuro sí va el escarlata.
              color: estado.conectado ? '#fff' : C.acento,
              textDecorationLine: estado.conectado ? 'underline' : 'none',
              fontWeight: '700',
              marginTop: 4,
            }}
          >
            {cambiando ? t.buscandoUbicacion : estado.conectado ? t.desconectar : t.conectar}
          </Text>
        </Pressable>
      )}
      {mensajes}

      {activo ? (
        <View style={e.tarjeta}>
          <Text style={{ fontWeight: '800', fontSize: 18 }}>
            {t.pedido} #{activo.id.slice(0, 4).toUpperCase()} ·{' '}
            {formatearDolares(activo.pagoRepartidor, idioma)}
          </Text>
          {activo.lineas.map((l) => (
            <Text key={l.platoId}>
              {l.cantidad} × {textoLinea(l, idioma)}
            </Text>
          ))}
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
                  {activo.minutosParaListo ? ` ${t.listoEn} ${activo.minutosParaListo} min.` : ''}
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
                          <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.sinGpsAyuda}</Text>
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
                  .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)))
              }
              secundario
            />
          ) : null}
          <ChatPedido pedidoId={activo.id} />
        </View>
      ) : estado?.conectado ? (
        ofertas.length === 0 ? (
          <Text style={e.tarjeta}>{t.buscando}</Text>
        ) : (
          ofertas.map((o) => (
            <View key={o.id} style={[e.tarjeta, { borderWidth: 3, borderColor: C.primario }]}>
              <Text style={{ color: C.primario, fontWeight: '800' }}>{t.oferta}</Text>
              <Text style={{ fontSize: 28, fontWeight: '800', marginVertical: 4 }}>
                {t.ganas} {formatearDolares(o.pagoRepartidor, idioma)}
              </Text>
              {o.propina > 0 ? (
                <Text style={{ color: '#5E5E5E' }}>
                  {t.propinaIncluida} {formatearDolares(o.propina, idioma)}
                </Text>
              ) : null}
              {o.bono ? (
                <Text style={{ color: '#0D7A3A', fontWeight: '700' }}>
                  {t.bono} {formatearDolares(o.bono, idioma)} {t.bonoPorque}
                </Text>
              ) : null}
              <Text style={{ marginTop: 6 }}>
                {t.recoger}: {o.restaurante.nombre}
                {o.minutosParaListo
                  ? ` · ${t.listoEn} ${o.minutosParaListo} min`
                  : ` · ${t.listoYa}`}
              </Text>
              <Text>
                {t.entregar}: {o.direccion}
                {o.distanciaKm != null
                  ? ` · ${(idioma === 'en' ? o.distanciaKm * 0.621371 : o.distanciaKm).toFixed(1)} ${idioma === 'en' ? 'mi' : 'km'}`
                  : ''}
              </Text>
              <Boton
                texto={t.aceptar}
                alTocar={() => void accion(`/datos/repartidor/ofertas/${o.id}/aceptar`)}
                exito
              />
              <Boton
                texto={t.rechazar}
                alTocar={() => void accion(`/datos/repartidor/ofertas/${o.id}/rechazar`)}
                secundario
              />
              <Text style={{ color: '#5E5E5E', textAlign: 'center' }}>{t.sinCastigo}</Text>
            </View>
          ))
        )
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
            {formatearDolares(billetera.saldo, idioma)}
          </Text>
          <Text style={{ color: '#FFFFFF', textDecorationLine: 'underline', marginTop: 4 }}>
            {t.verBilletera}
          </Text>
        </Pressable>
      )}
      {/* Quejas y ayuda: si hay una entrega activa, el ticket va atado a ese pedido. */}
      <ReportarProblema pedidoId={estado?.activo?.id} />
      <Boton texto={tm.salir} alTocar={() => void salir()} secundario />
      <MenuCuenta />
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
    </Pantalla>
  );
}
