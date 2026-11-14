import * as ImagePicker from 'expo-image-picker';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import {
  ErrorApi,
  enIdioma,
  deSqlUtc,
  entregaMostrada,
  textoFranja,
  formatearMonto,
  textoLinea,
  type OpcionElegida,
  type RangoLlegada,
  senalPerdida,
  textoActualizado,
  textoAtrasado,
  textoRango,
  listaEtiquetas,
  type ParaEtiqueta,
  tipoEtiquetas,
  tituloEtiquetas,
  textoPesoReal,
  type Referencia,
  textoReferencia,
  nombreFormaPago,
} from '@tumbite/compartido';
import {
  Boton,
  C,
  TarjetaAvisosWeb,
  CampoDireccion,
  ChatPedido,
  FotoPedido,
  ReportarProblema,
  e,
  urlFoto,
  useSesion,
  fotoConCamara,
} from '@tumbite/movil';
import { useCarrito } from '../../carrito';
import { usePedirOtraVez } from '../../pedirOtraVez';
import { MapaEntrega } from '../../MapaEntrega';
import { FotoRepartidor } from '../../FotoRepartidor';
import { ANCHO_MAX, BotonAncho, Encabezado, Tarjeta } from '../../comida/piezas';
import { IMG_COMIDA } from '../../comida/recursos';
import { textosComida } from '../../comida/textos';
import { conCuenta } from '../../ConCuenta';

type Pedido = {
  id: string;
  estado: string;
  motivoCancelacion?: 'cliente' | 'restaurante' | 'sin_respuesta' | null;
  restauranteNombre?: string;
  total: number;
  /** C-MONEDA-RECORRIDO: la moneda del pedido (los viejos no la traen: dólares). */
  moneda?: string;
  /** C-COMIDA-VENEZUELA: equivalente en bolívares con la tasa del día (solo informativo). */
  referencia?: Referencia | null;
  direccion: string;
  lat: number | null;
  lng: number | null;
  restaurante: { lat: number; lng: number } | null;
  minutosEstimados: number | null;
  fotoRecogida?: { tomadaEn: string; confirmadaEn: string | null } | null;
  fotoEntrega?: { tomadaEn: string } | null;
  entrega?: 'puerta' | 'mano' | 'recoger';
  propina?: number;
  subtotal?: number;
  envio?: number;
  servicio?: number;
  cargoPedidoPequeno?: number;
  impuesto?: number;
  regalo?: number;
  propinaExtra?: number | null;
  requiereEdad?: boolean;
  entregadoComo?: 'puerta' | 'mano' | 'seguro' | 'ausente' | null;
  /** C-PEDIDO-PROGRAMADO: inicio de la franja (UTC «AAAA-MM-DD HH:MM:SS») o null. */
  programadoPara?: string | null;
  notaEntrega?: string;
  llegaAMasTardar?: string | null;
  /** C-SEGUIMIENTO-HONESTO: la llegada como rango («12:40–12:50»). */
  llegadaRango?: RangoLlegada | null;
  pin?: string | null;
  pinRequerido?: boolean;
  /** Fase 2 · cobro directo. */
  metodoPago?: 'tarjeta' | 'efectivo' | 'transferencia_repartidor';
  cobroEstado?: string;
  cuentaCobro?: {
    tipo: string;
    banco: string;
    titular: string;
    identificador: string;
    verificacion: string;
  } | null;
  ajuste?: {
    platoId: string;
    nombreEs: string;
    nombreEn: string;
    estado: 'pendiente' | 'quitado' | 'cancelado';
    devolucion: number | null;
    creadoEn: string;
    /** C-TIENDAS-REEMPLAZOS: lo que propone la tienda (precio que pagarías, nunca más) y lo elegido. */
    propuestas?: {
      platoId: string;
      nombreEs: string;
      nombreEn: string;
      precioCentavos: number;
      imagen?: string | null;
    }[];
    reemplazoId?: string | null;
  } | null;
  lineas: {
    platoId: string;
    nombreEs: string;
    nombreEn: string;
    cantidad: number;
    precioCentavos: number;
    opciones?: OpcionElegida[];
    sustitucion?: string;
    pesable?: boolean;
    unidadPeso?: string | null;
    pesoEstimado?: number | null;
    pesoReal?: number;
  }[];
  repartidor?: {
    nombre: string;
    lat: number | null;
    lng: number | null;
    actualizado: string | null;
    /** C-SEGUIMIENTO-HONESTO: segundos desde su última ubicación y si se perdió la señal. */
    haceSegundos?: number | null;
    senalPerdida?: boolean;
    llegaEn5?: boolean;
    casiLlega?: boolean;
    llego?: boolean;
    /** C-FOTO-VERIFICADA: la ruta privada de su foto aprobada, si la tiene. */
    foto?: string | null;
    /** C-AUDITIVA-REPARTIDOR: escribirle por el chat en vez de llamarlo. */
    dificultadAuditiva?: boolean;
  } | null;
};

/** C-CAMARA-EN-TODA-SUBIDA: la cámara del teléfono, para la pieza común «Tomar foto». */
const CAMARA = {
  pedirPermiso: () => ImagePicker.requestCameraPermissionsAsync(),
  tomar: () => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 }),
};

/**
 * C-AYUDA-PEDIDO: la foto del plato equivocado o dañado, tomada con la cámara o elegida de los
 * archivos (reducida para subir rápido).
 */
const elegirFotoQueja = (idioma: 'es' | 'en') => async (): Promise<Blob | null> => {
  const a = await fotoConCamara(idioma, CAMARA, async () => {
    // NXT-4z: en el iPhone, la versión «compatible» (JPEG): el servidor no guarda HEIC.
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    return r.canceled ? null : (r.assets[0] ?? null);
  });
  return a ? (await fetch(a.uri)).blob() : null;
};

const T = {
  es: {
    titulo: 'Tu pedido',
    volver: '← Inicio',
    total: 'Total',
    recibo: 'Recibo',
    comida: 'Comida',
    envio: 'Envío',
    servicio: 'Servicio',
    pequeno: 'Pedido pequeño',
    impuesto: 'Impuesto',
    regalo: 'Regalo',
    propina: 'Propina',
    comentario: 'Cuéntanos más (opcional): qué estuvo bien o qué mejorar',
    pagoAlRecibir: 'Pagas al recibir',
    enEfectivo: 'En efectivo, al repartidor: {monto} (sin contar la propina).',
    transfiereA: 'Transfiere al repartidor {monto} (sin contar la propina) a:',
    cuentaPendiente:
      'El repartidor todavía no tiene una cuenta publicada. Paga en efectivo o espera a que la vea aquí.',
    cobroConfirmado: 'El repartidor confirmó tu pago.',
    problemaCobro: 'Tengo un problema con el cobro',
    problemaMotivo: 'El cliente reporta un problema con el cobro desde la app.',
    problemaEnviado: 'Soporte recibió tu reclamo y te responde por correo.',
    ayuda: '¿Problemas con tu pedido? Cuéntanos',
    noEntregadoAusente: 'No pudimos entregar tu pedido.',
    estados: {
      pago_pendiente: 'Esperando el pago…',
      pagado: 'Pago recibido. Esperando que el restaurante lo acepte.',
      aceptado: 'El restaurante está preparando tu comida.',
      listo: 'Tu comida está lista. Buscando repartidor…',
      en_camino: 'Tu repartidor va en camino.',
      entregado: '¡Entregado! Buen provecho.',
      cancelado: 'Pedido cancelado. Si ya habías pagado, te devolvimos todo el dinero.',
    } as Record<string, string>,
    repartidor: 'Tu repartidor',
    fotoSellado:
      'Tu pedido salió del restaurante cerrado y en buen estado. El restaurante confirmó que se lo entregó a tu repartidor.',
    fotoEntregado: 'Así quedó tu pedido al entregarlo.',
    fotoAusente: 'El lugar donde te esperó tu repartidor.',
    ubicacion: 'Ubicación actualizada',
    llega: 'Llega en unos',
    minutos: 'min',
    aMasTardar: 'A más tardar a las',
    llegaEntre: 'Llega entre',
    sinSenal:
      'Perdimos la señal de tu repartidor. En el mapa ves su última ubicación conocida; sigue en camino y la hora puede cambiar.',
    tuPin: 'Tu PIN para recibir',
    tuPinAyuda:
      'Díselo solo a quien reciba el pedido. El repartidor lo necesita para entregarlo en mano.',
    // BRE-7: en la recogida no hay repartidor; el PIN se muestra en el mostrador.
    tuPinRecoger: 'Muéstralo en el mostrador cuando recojas tu pedido.',
    faltaTitulo: 'El restaurante no tiene «{plato}»',
    // C-TIENDAS-COMPRA: en una tienda se habla de la tienda y de tus productos, no de comida.
    estadosTienda: {
      pagado: 'Pago recibido. Esperando que la tienda lo acepte.',
      aceptado: 'La tienda está preparando tus productos.',
      listo: 'Tus productos están listos. Buscando repartidor…',
      entregado: '¡Entregado!',
    } as Record<string, string>,
    faltaTituloTienda: 'La tienda no tiene «{plato}»',
    faltaTexto:
      'Elige qué hacer. Si no respondes en 5 minutos, lo quitamos y te devolvemos su parte.',
    quitar: 'Quitarlo y seguir (te devolvemos {monto})',
    reemplazos: 'La tienda te propone a cambio (nunca pagas de más):',
    elegir: 'Cambiar por {producto}',
    reemplazadoOk: 'Cambiamos «{plato}» por {producto}. El resto sigue.',
    cancelarTodo: 'Cancelar todo el pedido',
    quitadoOk: 'Quitamos «{plato}» y te devolvimos {monto}. El resto sigue.',
    enPuerta: 'Tu repartidor está en tu puerta.',
    casiLlega: 'Tu repartidor está a un minuto.',
    llegaEn5: 'Tu repartidor llega en unos 5 minutos.',
    cambiarDireccion: 'Cambiar la dirección de entrega',
    cambiarDireccionAyuda:
      'Hasta que el repartidor salga del restaurante. Si el envío cambia, te mostramos el nuevo total antes de aplicarlo.',
    nuevaDireccion: 'Nueva dirección',
    usarUbicacion: 'Usar mi ubicación actual',
    aplicarDireccion: 'Cambiar la dirección',
    nuevoTotal: 'El total pasa de {antes} a {despues}. ¿Lo aceptas?',
    aceptarTotal: 'Sí, acepto el nuevo total',
    direccionCambiada: 'Dirección cambiada.',
    propinaDespues: '¿Te gustó el servicio? Deja una propina extra al repartidor',
    propinaDespuesAyuda: 'Se cobra con tu tarjeta guardada y va entera al repartidor.',
    propinaGracias: 'Propina enviada. ¡Gracias!',
    recogerEnLocal: 'Recoges en el local',
    recogerListo: 'Tu pedido está listo: pasa a buscarlo y muestra tu PIN.',
    // BRE-7b: en la recogida no hay repartidor, como el «Pickup» de DoorDash y Uber Eats.
    estadosRecoger: {
      listo: 'Tu pedido está listo. Pasa a recogerlo al local.',
      entregado: '¡Recogido! Buen provecho.',
    } as Record<string, string>,
    listoEn: 'Listo en unos',
    pasosRecoger: ['Confirmado', 'En preparación', 'Listo para recoger', 'Recogido'],
    llamar: 'Llamar al repartidor (número oculto)',
    llamando:
      'Te estamos llamando. Contesta y te conectamos con tu repartidor; ninguno ve el número del otro.',
    pediste: {
      puerta: 'Pediste: en la puerta',
      mano: 'Pediste: en mano',
      recoger: 'Recoges en el local',
    } as Record<string, string>,
    entregadoComo: {
      puerta: 'Lo dejaron en tu puerta.',
      mano: 'Te lo entregaron en mano.',
      seguro: 'No te encontraron y lo dejaron en un lugar seguro:',
      ausente:
        'No pudimos entregarlo: tu repartidor esperó en tu puerta y no logró comunicarse contigo. Si algo salió mal, escríbenos desde este pedido.',
    } as Record<string, string>,
    tuCasa: 'Tu dirección',
    programado: 'Programado para',
    compartir: 'Compartir el seguimiento',
    compartirMensaje: (url: string) => `Sigue mi pedido de Divoox aquí: ${url}`,
    copiado: 'Enlace copiado. Pégalo donde quieras compartirlo.',
    programadoAyuda:
      'El restaurante empieza a prepararlo antes de esa hora para que llegue a tiempo.',
    elRestaurante: 'El restaurante',
    calificar: '¿Qué tal todo?',
    restaurante: 'La comida',
    culpa: 'El problema fue de la comida o la demora del restaurante',
    platosTitulo: '¿Qué tal cada plato?',
    auditiva: (n: string) =>
      `${n} tiene sordera o dificultad auditiva. Escríbele por el chat en vez de llamar.`,
    meGusto: 'Me gustó',
    noMeGusto: 'No me gustó',
    enviar: 'Enviar calificación',
    gracias: '¡Gracias por tu calificación!',
    motivos: {
      cliente: 'Cancelaste este pedido. Te devolvimos todo el dinero a tu tarjeta.',
      restaurante:
        'El restaurante no pudo atender tu pedido. Te devolvimos todo el dinero a tu tarjeta.',
      sin_respuesta:
        'El restaurante no confirmó a tiempo, así que lo cancelamos. Te devolvimos todo el dinero a tu tarjeta.',
    } as Record<string, string>,
    cancelar: 'Cancelar el pedido',
    seguro: 'Te devolvemos todo el dinero a tu tarjeta. ¿Cancelamos?',
    siCancelar: 'Sí, cancelar',
    noCancelar: 'No, seguir esperando',
  },
  en: {
    titulo: 'Your order',
    volver: '← Home',
    total: 'Total',
    recibo: 'Receipt',
    comida: 'Food',
    envio: 'Delivery',
    servicio: 'Service',
    pequeno: 'Small order',
    impuesto: 'Tax',
    regalo: 'Gift',
    propina: 'Tip',
    comentario: 'Tell us more (optional): what was good or what to improve',
    pagoAlRecibir: 'You pay on delivery',
    enEfectivo: 'In cash, to the driver: {monto} (tip not included).',
    transfiereA: 'Transfer {monto} (tip not included) to the driver at:',
    cuentaPendiente:
      'The driver hasn’t published an account yet. Pay in cash or wait until it shows here.',
    cobroConfirmado: 'The driver confirmed your payment.',
    problemaCobro: 'I have a problem with the payment',
    problemaMotivo: 'The customer reports a payment problem from the app.',
    problemaEnviado: 'Support received your report and will reply by email.',
    ayuda: 'Problems with your order? Tell us',
    noEntregadoAusente: 'We couldn’t deliver your order.',
    estados: {
      pago_pendiente: 'Waiting for payment…',
      pagado: 'Payment received. Waiting for the restaurant to accept.',
      aceptado: 'The restaurant is preparing your food.',
      listo: 'Your food is ready. Finding a driver…',
      en_camino: 'Your driver is on the way.',
      entregado: 'Delivered! Enjoy your meal.',
      cancelado: 'Order canceled. If you had paid, we refunded all your money.',
    } as Record<string, string>,
    repartidor: 'Your driver',
    fotoSellado:
      'Your order left the restaurant closed and in good shape. The restaurant confirmed it handed it to your driver.',
    fotoEntregado: 'How your order was left at delivery.',
    fotoAusente: 'Where your courier waited for you.',
    ubicacion: 'Location updated',
    llega: 'Arriving in about',
    minutos: 'min',
    aMasTardar: 'Latest arrival by',
    llegaEntre: 'Arrives between',
    sinSenal:
      'We lost your driver’s signal. The map shows their last known location; they’re still on the way and the time may change.',
    tuPin: 'Your PIN to receive',
    tuPinAyuda:
      'Share it only with whoever receives the order. The driver needs it to hand it over.',
    tuPinRecoger: 'Show it at the counter when you pick up your order.',
    faltaTitulo: 'The restaurant is out of “{plato}”',
    estadosTienda: {
      pagado: 'Payment received. Waiting for the store to accept.',
      aceptado: 'The store is getting your items ready.',
      listo: 'Your items are ready. Finding a driver…',
      entregado: 'Delivered!',
    } as Record<string, string>,
    faltaTituloTienda: 'The store is out of “{plato}”',
    faltaTexto:
      'Choose what to do. If you don’t answer in 5 minutes, we remove it and refund that part.',
    quitar: 'Remove it and continue (we refund {monto})',
    reemplazos: 'The store suggests instead (you never pay more):',
    elegir: 'Swap for {producto}',
    reemplazadoOk: 'We swapped “{plato}” for {producto}. The rest continues.',
    cancelarTodo: 'Cancel the whole order',
    quitadoOk: 'We removed “{plato}” and refunded {monto}. The rest continues.',
    enPuerta: 'Your driver is at your door.',
    casiLlega: 'Your driver is a minute away.',
    llegaEn5: 'Your driver arrives in about 5 minutes.',
    cambiarDireccion: 'Change the delivery address',
    cambiarDireccionAyuda:
      'Until the driver leaves the restaurant. If the delivery fee changes, we show you the new total before applying it.',
    nuevaDireccion: 'New address',
    usarUbicacion: 'Use my current location',
    aplicarDireccion: 'Change the address',
    nuevoTotal: 'The total goes from {antes} to {despues}. Do you accept?',
    aceptarTotal: 'Yes, I accept the new total',
    direccionCambiada: 'Address changed.',
    propinaDespues: 'Enjoyed the service? Leave the driver an extra tip',
    propinaDespuesAyuda: 'Charged to your saved card and paid in full to the driver.',
    propinaGracias: 'Tip sent. Thank you!',
    recogerEnLocal: 'You’re picking it up',
    recogerListo: 'Your order is ready: come pick it up and show your PIN.',
    estadosRecoger: {
      listo: 'Your order is ready. Come pick it up at the store.',
      entregado: 'Picked up! Enjoy your meal.',
    } as Record<string, string>,
    listoEn: 'Ready in about',
    pasosRecoger: ['Confirmed', 'Preparing', 'Ready for pickup', 'Picked up'],
    llamar: 'Call the driver (masked number)',
    llamando:
      'We’re calling you now. Answer and we’ll connect you with your driver; neither of you sees the other’s number.',
    pediste: {
      puerta: 'You chose: leave at door',
      mano: 'You chose: hand it to me',
      recoger: 'You’re picking it up',
    } as Record<string, string>,
    entregadoComo: {
      puerta: 'It was left at your door.',
      mano: 'It was handed to you.',
      seguro: 'They couldn’t find you and left it in a safe spot:',
      ausente:
        'We couldn’t deliver it: your driver waited at your door and couldn’t reach you. If something went wrong, contact us from this order.',
    } as Record<string, string>,
    tuCasa: 'Your address',
    programado: 'Scheduled for',
    compartir: 'Share tracking',
    compartirMensaje: (url: string) => `Follow my Divoox order here: ${url}`,
    copiado: 'Link copied. Paste it wherever you want to share it.',
    programadoAyuda: 'The restaurant starts preparing it before that time so it arrives on time.',
    elRestaurante: 'The restaurant',
    calificar: 'How was everything?',
    restaurante: 'The food',
    culpa: 'The problem was the food or the restaurant’s delay',
    platosTitulo: 'How was each item?',
    auditiva: (n: string) =>
      `${n} is deaf or hard of hearing. Text them in the chat instead of calling.`,
    meGusto: 'Liked it',
    noMeGusto: 'Didn’t like it',
    enviar: 'Send rating',
    gracias: 'Thanks for your rating!',
    motivos: {
      cliente: 'You canceled this order. We refunded all your money to your card.',
      restaurante:
        'The restaurant couldn’t take your order. We refunded all your money to your card.',
      sin_respuesta:
        'The restaurant didn’t confirm in time, so we canceled it. We refunded all your money to your card.',
    } as Record<string, string>,
    cancelar: 'Cancel order',
    seguro: 'We’ll refund all your money to your card. Cancel it?',
    siCancelar: 'Yes, cancel',
    noCancelar: 'No, keep waiting',
  },
};

function Estrellas({
  valor,
  cambiar,
  etiqueta,
  idioma,
}: {
  valor: number;
  cambiar: (n: number) => void;
  etiqueta: string;
  idioma: 'es' | 'en';
}) {
  return (
    <View style={{ marginVertical: 6 }}>
      <Text style={{ fontWeight: '700' }}>{etiqueta}</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => cambiar(n)}
            accessibilityRole="button"
            // Para quien usa lector de pantalla: «La comida: 4 de 5 estrellas».
            accessibilityLabel={
              idioma === 'en' ? `${etiqueta}: ${n} of 5 stars` : `${etiqueta}: ${n} de 5 estrellas`
            }
            hitSlop={6}
          >
            <Text style={{ fontSize: 30, color: n <= valor ? '#F20D20' : '#D6D6D6' }}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * C-ELOGIOS-MOTIVOS (BRE-3): con 5 estrellas, elogios ya escritos; con 3 o menos, «¿Qué salió mal?»
 * con motivos (como Uber Eats y DoorDash). Con 4 no se abre nada.
 */
function Etiquetas({
  para,
  estrellas,
  elegidas,
  cambiar,
  idioma,
}: {
  para: ParaEtiqueta;
  estrellas: number;
  elegidas: string[];
  cambiar: (x: string[]) => void;
  idioma: 'es' | 'en';
}) {
  const tipo = tipoEtiquetas(estrellas);
  if (!tipo) return null;
  const lista = listaEtiquetas(para, tipo);
  return (
    <View style={{ marginBottom: 6 }} testID={`etiquetas-${para}`}>
      <Text style={{ fontWeight: '700', color: '#101010', marginBottom: 6 }}>
        {tituloEtiquetas(tipo, idioma)}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {lista.map(([codigo, texto]) => {
          const si = elegidas.includes(codigo);
          return (
            <Pressable
              key={codigo}
              onPress={() =>
                cambiar(si ? elegidas.filter((x) => x !== codigo) : [...elegidas, codigo])
              }
              accessibilityRole="button"
              accessibilityState={{ selected: si }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: si ? '#101010' : '#D9D9D9',
                backgroundColor: si ? '#101010' : '#FFFFFF',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: si ? '#FFFFFF' : '#101010' }}>
                {idioma === 'en' ? texto.en : texto.es}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Estado del pedido → paso del diseño (Confirmado, En preparación, En camino, Entregado). */
const PASOS_DISENO = new Map<string, number>([
  ['pagado', 0],
  ['aceptado', 1],
  ['listo', 1],
  ['en_camino', 2],
  ['entregado', 3],
]);

function SeguirPedido() {
  const { id, nuevo } = useLocalSearchParams<{ id: string; nuevo?: string }>();
  const { api, idioma } = useSesion();
  const [reclamoCobro, setReclamoCobro] = useState('');
  async function disputarCobro() {
    try {
      await api.pedir('POST', `/datos/pedidos/${String(id)}/disputa-cobro`, {
        motivo: t.problemaMotivo,
      });
      setReclamoCobro(t.problemaEnviado);
    } catch (x) {
      setReclamoCobro(x instanceof Error ? x.message : String(x));
    }
  }
  const t = enIdioma(T, idioma);
  const tc = textosComida(idioma);
  const otraVez = usePedirOtraVez(idioma);
  const [copiado, setCopiado] = useState(false);
  const [verSeguimiento, setVerSeguimiento] = useState(false);
  const desplazar = useRef<ScrollView>(null);
  const posChat = useRef(0);
  const { vaciar } = useCarrito();
  const [p, setP] = useState<Pedido | null>(null);
  // C-SEGUIMIENTO-HONESTO: «Actualizado hace X s» sigue contando entre consulta y consulta.
  const [recibido, setRecibido] = useState(() => Date.now());
  const [ahora, setAhora] = useState(() => Date.now());
  const enCaminoAhora = p?.estado === 'en_camino';
  useEffect(() => {
    if (!enCaminoAhora) return;
    const r = setInterval(() => setAhora(Date.now()), 1_000);
    return () => clearInterval(r);
  }, [enCaminoAhora]);
  const moneda = p?.moneda ?? 'USD';
  const [error, setError] = useState('');
  const [avisoLlamada, setAvisoLlamada] = useState('');
  const [estRest, setEstRest] = useState(0);
  const [estRep, setEstRep] = useState(0);
  const [culpa, setCulpa] = useState(false);
  const [calificado, setCalificado] = useState(false);
  // C-GUSTO-PLATOS: pulgar arriba o abajo por plato, como DoorDash (opcional).
  const [gustos, setGustos] = useState<Record<string, boolean>>({});
  // C-ELOGIOS-MOTIVOS: las etiquetas elegidas; al cambiar las estrellas se vacían.
  const [etqRest, setEtqRest] = useState<string[]>([]);
  const [etqRep, setEtqRep] = useState<string[]>([]);
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [nuevoPunto, setNuevoPunto] = useState<{ lat: number; lng: number } | null>(null);
  const [propuesta, setPropuesta] = useState<{ antes: number; despues: number } | null>(null);
  const [avisoCambio, setAvisoCambio] = useState('');
  const [propinaEnviada, setPropinaEnviada] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  // Mientras el restaurante no acepte, el cliente puede arrepentirse y el dinero vuelve solo.
  const [decidiendo, setDecidiendo] = useState(false);
  async function decidirAjuste(decision: 'quitar' | 'cancelar' | 'reemplazar', platoId?: string) {
    if (decidiendo) return;
    setDecidiendo(true);
    setError('');
    try {
      await api.pedir('POST', `/datos/pedidos/${id}/ajuste`, { decision, platoId });
      const r = await api.pedir<{ pedido: Pedido }>('GET', `/datos/pedidos/${id}/seguimiento`);
      setP(r.pedido);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setDecidiendo(false);
    }
  }

  async function cancelar() {
    setCancelando(true);
    try {
      await api.pedir('POST', `/datos/pedidos/${id}/cancelar`, {});
      // Al momento: cancelado, por el cliente y sin hora de llegada (no esperar a la próxima consulta).
      setP((x) =>
        x ? { ...x, estado: 'cancelado', motivoCancelacion: 'cliente', minutosEstimados: null } : x,
      );
      setConfirmar(false);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setCancelando(false);
    }
  }

  async function cambiarDireccion(aceptarTotal = false) {
    setError('');
    try {
      await api.pedir('PATCH', `/datos/pedidos/${id}/direccion`, {
        direccion: nuevaDireccion.trim(),
        lat: nuevoPunto?.lat ?? null,
        lng: nuevoPunto?.lng ?? null,
        aceptarTotal,
      });
      setPropuesta(null);
      setAvisoCambio(t.direccionCambiada);
      setNuevaDireccion('');
      const r = await api.pedir<{ pedido: Pedido }>('GET', `/datos/pedidos/${id}/seguimiento`);
      setP(r.pedido);
    } catch (x) {
      const info =
        x instanceof ErrorApi
          ? (x.datos as { totalActual?: number; nuevoTotal?: number } | undefined)
          : undefined;
      if (x instanceof ErrorApi && x.campo === 'total' && info?.nuevoTotal != null)
        setPropuesta({ antes: info.totalActual ?? 0, despues: info.nuevoTotal });
      else setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function usarUbicacion() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      setNuevoPunto({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      const [dir] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }).catch(() => []);
      if (dir)
        setNuevaDireccion(
          [dir.streetNumber, dir.street, dir.city].filter(Boolean).join(' ').trim() ||
            nuevaDireccion,
        );
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function propinaExtra(centavos: number) {
    setError('');
    try {
      await api.pedir('POST', `/datos/pedidos/${id}/propina`, { centavos });
      setPropinaEnviada(true);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const [comentario, setComentario] = useState('');
  async function calificar() {
    try {
      await api.pedir('POST', `/datos/pedidos/${id}/calificar`, {
        estrellasRestaurante: estRest,
        estrellasRepartidor: estRep || null,
        culpaRestaurante: culpa,
        comentario,
        platos: Object.entries(gustos).map(([platoId, gusta]) => ({ platoId, gusta })),
        etiquetasRestaurante: etqRest,
        etiquetasRepartidor: estRep ? etqRep : [],
      });
      setCalificado(true);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  // C-CARRITO-NO-SE-BORRA-SOLO (31 oct 2026, visto en el simulador de iPhone): el seguimiento pregunta
  // cada 5 segundos y vaciaba el carrito en CADA vuelta; con esta pantalla abierta detrás, «Pedir otra
  // vez» o un carrito nuevo se borraban solos. Se vacía UNA vez, y solo al llegar recién pagado.
  const carritoVaciado = useRef(false);
  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      api
        .pedir<{ pedido: Pedido }>('GET', `/datos/pedidos/${id}/seguimiento`)
        .then((r) => {
          if (!vivo) return;
          setP(r.pedido);
          setRecibido(Date.now());
          setError('');
          if (nuevo && !carritoVaciado.current && r.pedido.estado !== 'pago_pendiente') {
            carritoVaciado.current = true;
            vaciar();
          }
        })
        .catch((x: unknown) => vivo && setError(x instanceof ErrorApi ? x.message : String(x)));
    void cargar();
    // Seguimiento: se pregunta cada 5 segundos mientras la pantalla está abierta.
    const reloj = setInterval(() => void cargar(), 5000);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [api, id, nuevo, vaciar]);

  // Cuatro pasos como en el diseño: Confirmado, En preparación, En camino, Entregado.
  const recoge = p?.entrega === 'recoger';
  // En la recogida «listo» ya es el tercer paso: no hay «En camino».
  const paso = p ? (recoge && p.estado === 'listo' ? 2 : (PASOS_DISENO.get(p.estado) ?? -1)) : -1;
  const activo = p ? !['entregado', 'cancelado'].includes(p.estado) : false;
  const haceRep =
    p?.estado === 'en_camino' && p.repartidor?.haceSegundos != null
      ? p.repartidor.haceSegundos + Math.max(0, Math.floor((ahora - recibido) / 1000))
      : null;
  const sinSenal = Boolean(p?.repartidor?.senalPerdida) || senalPerdida(haceRep);
  const numero = `#${String(id).slice(0, 4).toUpperCase()}`;
  const esTienda = Boolean(p?.lineas.some((l) => l.sustitucion));
  const estadoTexto = p
    ? ((p.estado === 'cancelado' && p.motivoCancelacion ? t.motivos[p.motivoCancelacion] : null) ??
      // C-CLIENTE-AUSENTE: cerrado sin entregar porque no estabas; no se dice «entregado».
      (p.estado === 'entregado' && p.entregadoComo === 'ausente' ? t.noEntregadoAusente : null) ??
      (recoge ? t.estadosRecoger[p.estado] : undefined) ??
      (esTienda ? t.estadosTienda[p.estado] : undefined) ??
      t.estados[p.estado] ??
      p.estado)
    : '';
  const irInicio = () => router.replace('/');
  // C-VOLVER-AL-ORIGEN: la flecha vuelve a donde estaba la persona (Mi cuenta, Mis pedidos…). Solo
  // un pedido recién hecho (o un enlace abierto de afuera) vuelve al inicio, como en DoorDash.
  const volver = () => (!nuevo && router.canGoBack() ? router.back() : irInicio());
  const marco = (cuerpo: React.ReactNode, conEncabezado = true) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8FA' }} edges={['top', 'left', 'right']}>
      {conEncabezado ? (
        <Encabezado
          titulo={t.titulo}
          alVolver={volver}
          etiquetaVolver={t.volver}
          derecha={
            <Text
              style={{ color: C.secundario, fontWeight: '700', paddingHorizontal: 8 }}
              onPress={() => desplazar.current?.scrollToEnd({ animated: true })}
              accessibilityRole="button"
            >
              {tc.ayuda}
            </Text>
          }
        />
      ) : null}
      <ScrollView
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        ref={desplazar}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <Text style={e.error}>{error}</Text> : null}
        {/* C-AVISOS-WEB: en la versión web, la explicación del permiso después de pedir. */}
        <TarjetaAvisosWeb />
        {cuerpo}
      </ScrollView>
    </SafeAreaView>
  );

  // Recién pagado: la confirmación «¡Pedido realizado!» antes del seguimiento.
  if (
    p &&
    nuevo &&
    !verSeguimiento &&
    ['pago_pendiente', 'pagado', 'aceptado'].includes(p.estado)
  ) {
    return marco(
      <View style={{ alignItems: 'center', paddingTop: 24 }}>
        <Image
          source={IMG_COMIDA.mascota}
          style={{ width: 150, height: 150 }}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: C.exito,
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: -28,
            marginLeft: 90,
            borderWidth: 4,
            borderColor: '#fff',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>✓</Text>
        </View>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 26, fontWeight: '700', color: C.secundario, marginTop: 12 }}
        >
          {tc.pedidoRealizado}
        </Text>
        <Text style={{ color: '#5E5E5E', fontSize: 15, marginTop: 6, textAlign: 'center' }}>
          {tc.enviadoA.replace('{restaurante}', p.restauranteNombre ?? '')}
        </Text>
        <Tarjeta style={{ alignSelf: 'stretch', alignItems: 'center', marginTop: 20 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: C.secundario }}>{numero}</Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: C.secundario, marginTop: 4 }}>
            {t.total}: {formatearMonto(p.total, moneda, idioma)}
          </Text>
          <Text
            style={{ color: '#5E5E5E', marginTop: 8, textAlign: 'center' }}
            accessibilityLiveRegion="polite"
          >
            {estadoTexto}
          </Text>
        </Tarjeta>
        <View style={{ alignSelf: 'stretch' }}>
          <BotonAncho texto={tc.verSeguimiento} alTocar={() => setVerSeguimiento(true)} />
          <BotonAncho texto={tc.volverInicio} alTocar={irInicio} secundario />
        </View>
      </View>,
      false,
    );
  }

  return marco(
    p ? (
      <>
        {p.estado === 'entregado' ? (
          // Pedido entregado: la foto real de la entrega (si la hay) y la calificación.
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: C.exito,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 8,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>✓</Text>
            </View>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 24, fontWeight: '700', color: C.secundario, marginTop: 10 }}
            >
              {tc.pedidoEntregado}
            </Text>
            <Text
              style={{ color: '#5E5E5E', fontSize: 15, marginTop: 4 }}
              accessibilityLiveRegion="polite"
            >
              {estadoTexto}
            </Text>
          </View>
        ) : (
          <Tarjeta>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 19, color: C.secundario }}>
                  {p.restauranteNombre}
                </Text>
                <Text style={{ color: '#5E5E5E', marginTop: 2 }}>
                  {numero} · {formatearMonto(p.total, moneda, idioma)}
                </Text>
              </View>
              {p.minutosEstimados != null && !(recoge && p.estado === 'listo') ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: C.secundario }}>
                    {recoge ? t.listoEn : t.llega} {p.minutosEstimados} {t.minutos}
                  </Text>
                </View>
              ) : null}
            </View>
            {p.subtotal != null ? (
              <View style={{ marginTop: 10 }} testID="recibo">
                <Text style={{ fontWeight: '700', color: C.secundario }}>{t.recibo}</Text>
                {p.estado === 'entregado' && p.entregadoComo === 'ausente' ? (
                  <Text
                    style={{ color: C.primario, fontWeight: '700' }}
                    testID="recibo-no-entregado"
                  >
                    {t.noEntregadoAusente}
                  </Text>
                ) : null}
                {/* C-TIENDAS-PESO-REAL: lo pesado se cobra por su peso real, como en Instacart. */}
                {p.lineas
                  .filter((l) => l.pesoReal != null)
                  .map((l) => (
                    <View
                      key={`peso-${l.platoId}`}
                      style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
                      testID="peso-real"
                    >
                      <Text style={{ color: '#5E5E5E', flex: 1, fontSize: 13 }}>
                        {idioma === 'en' ? l.nombreEn || l.nombreEs : l.nombreEs}
                        {'\n'}
                        {textoPesoReal(l, idioma === 'en' ? 'en' : 'es')}
                      </Text>
                      <Text style={{ color: C.secundario, fontSize: 13 }}>
                        {formatearMonto(l.precioCentavos * l.cantidad, moneda, idioma)}
                      </Text>
                    </View>
                  ))}
                {(
                  [
                    [t.comida, p.subtotal],
                    [t.regalo, -(p.regalo ?? 0)],
                    [t.envio, p.envio ?? 0],
                    [t.servicio, p.servicio ?? 0],
                    [t.pequeno, p.cargoPedidoPequeno ?? 0],
                    [t.impuesto, p.impuesto ?? 0],
                    [t.propina, p.propina ?? 0],
                  ] as const
                )
                  .filter(([, monto]) => monto !== 0)
                  .map(([etiqueta, monto]) => (
                    <View
                      key={etiqueta}
                      style={{ flexDirection: 'row', justifyContent: 'space-between' }}
                    >
                      <Text style={{ color: '#5E5E5E' }}>{etiqueta}</Text>
                      <Text style={{ color: C.secundario }}>
                        {formatearMonto(monto, moneda, idioma)}
                      </Text>
                    </View>
                  ))}
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}
                >
                  <Text style={{ fontWeight: '700', color: C.secundario }}>{t.total}</Text>
                  <Text style={{ fontWeight: '700', color: C.secundario }}>
                    {formatearMonto(p.total, moneda, idioma)}
                  </Text>
                </View>
                {p.referencia ? (
                  <Text
                    testID="pedido-total-bs"
                    style={{ color: '#5E5E5E', fontSize: 13, textAlign: 'right' }}
                  >
                    {textoReferencia(p.referencia, idioma)}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {p.metodoPago && p.metodoPago !== 'tarjeta' && p.estado !== 'cancelado' ? (
              <View
                style={{
                  marginTop: 10,
                  padding: 12,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#2a2a2a',
                  backgroundColor: '#fff',
                }}
                testID="pago-al-recibir"
              >
                <Text style={{ fontWeight: '700', color: C.secundario }}>{t.pagoAlRecibir}</Text>
                {p.cobroEstado === 'confirmado' || p.cobroEstado === 'parcial' ? (
                  <Text style={{ color: C.exito, fontWeight: '700', marginTop: 4 }}>
                    {t.cobroConfirmado}
                  </Text>
                ) : p.metodoPago === 'efectivo' ? (
                  <Text style={{ color: '#5E5E5E', marginTop: 4 }}>
                    {t.enEfectivo.replace(
                      '{monto}',
                      formatearMonto(p.total - (p.propina ?? 0), moneda, idioma),
                    )}
                  </Text>
                ) : p.cuentaCobro ? (
                  <>
                    <Text style={{ color: '#5E5E5E', marginTop: 4 }}>
                      {t.transfiereA.replace(
                        '{monto}',
                        formatearMonto(p.total - (p.propina ?? 0), moneda, idioma),
                      )}
                    </Text>
                    <Text
                      style={{ fontWeight: '700', marginTop: 4, color: C.secundario }}
                      selectable
                    >
                      {p.cuentaCobro.titular}
                    </Text>
                    <Text style={{ color: C.secundario }} selectable>
                      {nombreFormaPago(p.cuentaCobro.tipo, idioma)}
                      {p.cuentaCobro.banco ? ` · ${p.cuentaCobro.banco}` : ''} ·{' '}
                      {p.cuentaCobro.identificador}
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: '#5E5E5E', marginTop: 4 }}>{t.cuentaPendiente}</Text>
                )}
                {p.estado === 'entregado' || p.estado === 'en_camino' ? (
                  <Pressable
                    onPress={() => void disputarCobro()}
                    accessibilityRole="button"
                    style={{ marginTop: 8 }}
                  >
                    <Text style={e.enlaceLinea}>{reclamoCobro || t.problemaCobro}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <Text
              style={{ color: C.secundario, fontSize: 15, marginTop: 10 }}
              accessibilityLiveRegion="polite"
            >
              {estadoTexto}
            </Text>
            {p.estado !== 'cancelado' ? (
              <View
                style={{ flexDirection: 'row', marginTop: 14 }}
                accessibilityRole="progressbar"
                accessibilityLabel={estadoTexto}
                aria-label={estadoTexto}
              >
                {(recoge ? t.pasosRecoger : tc.pasos).map((nombre, i) => (
                  <View key={nombre} style={{ flex: 1, alignItems: 'center' }}>
                    {i > 0 ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 13,
                          right: '50%',
                          width: '100%',
                          height: 3,
                          // Lo que ya pasó va en verde: es un avance, no una alarma.
                          backgroundColor: i <= paso ? C.exito : '#E5E5E5',
                        }}
                      />
                    ) : null}
                    <View
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 14,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: i <= paso ? C.exito : '#E5E5E5',
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                        {i <= paso ? '✓' : ''}
                      </Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 11,
                        marginTop: 4,
                        textAlign: 'center',
                        color: i === paso ? C.secundario : '#5E5E5E',
                        fontWeight: i === paso ? '800' : '500',
                      }}
                    >
                      {nombre}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {p.llegadaRango && activo && !recoge ? (
              <Text style={{ color: C.secundario, fontWeight: '700', marginTop: 10 }}>
                {p.llegadaRango.atrasado ? `${textoAtrasado(idioma)} · ` : ''}
                {t.llegaEntre} {textoRango(p.llegadaRango, idioma)}
              </Text>
            ) : null}
            {/* BRE-R (4): atrasado, el «a más tardar» ya pasó: no se muestra una hora que contradice. */}
            {p.llegaAMasTardar && activo && !recoge && !p.llegadaRango?.atrasado ? (
              <Text style={{ color: '#5E5E5E', marginTop: 10 }}>
                {t.aMasTardar}{' '}
                {new Date(p.llegaAMasTardar).toLocaleTimeString(
                  idioma === 'en' ? 'en-US' : 'es-US',
                  {
                    hour: 'numeric',
                    minute: '2-digit',
                  },
                )}
                {p.entrega ? ` · ${t.pediste[p.entrega]}` : ''}
              </Text>
            ) : null}
          </Tarjeta>
        )}

        {p.ajuste &&
        (p.ajuste.estado === 'pendiente' || p.estado === 'pagado' || p.estado === 'aceptado') ? (
          <Tarjeta style={{ borderWidth: 2, borderColor: '#E0A000' }}>
            {p.ajuste.estado === 'pendiente' ? (
              <>
                <Text style={{ fontWeight: '700', fontSize: 17 }}>
                  {(esTienda ? t.faltaTituloTienda : t.faltaTitulo).replace(
                    '{plato}',
                    idioma === 'en' ? p.ajuste.nombreEn || p.ajuste.nombreEs : p.ajuste.nombreEs,
                  )}
                </Text>
                <Text style={{ color: '#5E5E5E', marginVertical: 6 }}>{t.faltaTexto}</Text>
                {p.ajuste.propuestas?.length ? (
                  <>
                    <Text style={{ fontWeight: '700', marginBottom: 4 }}>{t.reemplazos}</Text>
                    {p.ajuste.propuestas.map((x) => {
                      // La foto del producto propuesto (de la tienda o de Open Food Facts).
                      const foto = x.imagen?.startsWith('https://')
                        ? x.imagen
                        : urlFoto(x.imagen, 'miniatura');
                      return (
                        <View
                          key={x.platoId}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                        >
                          {foto ? (
                            <Image
                              source={{ uri: foto }}
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 8,
                                backgroundColor: '#f1f1f1',
                              }}
                              accessibilityIgnoresInvertColors
                            />
                          ) : null}
                          <View style={{ flex: 1 }}>
                            <Boton
                              texto={t.elegir.replace(
                                '{producto}',
                                `${idioma === 'en' ? x.nombreEn || x.nombreEs : x.nombreEs} · ${formatearMonto(x.precioCentavos, moneda, idioma)}`,
                              )}
                              alTocar={() => void decidirAjuste('reemplazar', x.platoId)}
                              cargando={decidiendo}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </>
                ) : null}
                <Boton
                  texto={t.quitar.replace(
                    '{monto}',
                    formatearMonto(p.ajuste.devolucion ?? 0, moneda, idioma),
                  )}
                  alTocar={() => void decidirAjuste('quitar')}
                  cargando={decidiendo}
                  exito
                />
                <Boton
                  texto={t.cancelarTodo}
                  alTocar={() => void decidirAjuste('cancelar')}
                  cargando={decidiendo}
                  secundario
                />
              </>
            ) : p.ajuste.estado === 'quitado' && p.ajuste.reemplazoId ? (
              <Text style={{ fontWeight: '700' }}>
                {t.reemplazadoOk
                  .replace(
                    '{plato}',
                    idioma === 'en' ? p.ajuste.nombreEn || p.ajuste.nombreEs : p.ajuste.nombreEs,
                  )
                  .replace(
                    '{producto}',
                    (() => {
                      const r = p.ajuste.propuestas?.find(
                        (x) => x.platoId === p.ajuste?.reemplazoId,
                      );
                      return r ? (idioma === 'en' ? r.nombreEn || r.nombreEs : r.nombreEs) : '';
                    })(),
                  )}
              </Text>
            ) : p.ajuste.estado === 'quitado' ? (
              <Text style={{ fontWeight: '700' }}>
                {t.quitadoOk
                  .replace(
                    '{plato}',
                    idioma === 'en' ? p.ajuste.nombreEn || p.ajuste.nombreEs : p.ajuste.nombreEs,
                  )
                  .replace('{monto}', formatearMonto(p.ajuste.devolucion ?? 0, moneda, idioma))}
              </Text>
            ) : null}
          </Tarjeta>
        ) : null}
        {p.pin && activo ? (
          <Tarjeta style={{ borderWidth: 2, borderColor: C.exito }}>
            <Text style={{ fontWeight: '700' }}>{t.tuPin}</Text>
            <Text style={{ fontSize: 34, fontWeight: '700', letterSpacing: 6 }}>{p.pin}</Text>
            <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
              {p.entrega === 'recoger' ? t.tuPinRecoger : t.tuPinAyuda}
            </Text>
          </Tarjeta>
        ) : null}
        {p.estado === 'en_camino' &&
        (p.repartidor?.llego || p.repartidor?.casiLlega || p.repartidor?.llegaEn5) ? (
          <Text
            style={{ color: C.exito, fontWeight: '700', fontSize: 17, marginBottom: 8 }}
            accessibilityRole="alert"
          >
            {p.repartidor?.llego ? t.enPuerta : p.repartidor?.casiLlega ? t.casiLlega : t.llegaEn5}
          </Text>
        ) : null}
        {activo && (
          <View style={{ borderRadius: 18, overflow: 'hidden', marginBottom: 12 }}>
            <MapaEntrega
              restaurante={p.restaurante}
              casa={p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null}
              repartidor={
                p.repartidor?.lat != null && p.repartidor.lng != null
                  ? { lat: p.repartidor.lat, lng: p.repartidor.lng }
                  : null
              }
              nombreRepartidor={p.repartidor?.nombre}
              etiquetas={{ restaurante: t.elRestaurante, casa: t.tuCasa, repartidor: t.repartidor }}
              sinSenal={sinSenal}
            />
            {haceRep != null ? (
              <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
                {textoActualizado(haceRep, idioma)}
              </Text>
            ) : null}
            {sinSenal ? (
              <Text
                accessibilityRole="alert"
                style={{ color: C.secundario, fontWeight: '700', marginTop: 6 }}
              >
                {t.sinSenal}
              </Text>
            ) : null}
          </View>
        )}
        {p.repartidor && activo ? (
          <Tarjeta>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <FotoRepartidor ruta={p.repartidor.foto} nombre={p.repartidor.nombre} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 17, color: C.secundario }}>
                  {p.repartidor.nombre}
                </Text>
                <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
                  {p.estado === 'en_camino' ? tc.enCaminoATi : t.repartidor}
                  {p.repartidor.actualizado
                    ? ` · ${t.ubicacion}: ${new Date(
                        `${p.repartidor.actualizado}Z`,
                      ).toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}`
                    : ''}
                </Text>
              </View>
              {['aceptado', 'listo', 'en_camino'].includes(p.estado) ? (
                <>
                  <Circulo
                    icono={IMG_COMIDA.iconoLlamar}
                    etiqueta={t.llamar}
                    alTocar={() =>
                      void api
                        .pedir('POST', `/datos/pedidos/${p.id}/llamar`, {})
                        .then(() => setAvisoLlamada(t.llamando))
                        .catch((x: unknown) =>
                          setError(x instanceof ErrorApi ? x.message : String(x)),
                        )
                    }
                  />
                  <Circulo
                    icono={IMG_COMIDA.iconoMensaje}
                    etiqueta={tc.mensaje}
                    alTocar={() =>
                      desplazar.current?.scrollTo({ y: posChat.current, animated: true })
                    }
                  />
                </>
              ) : null}
            </View>
            {p.repartidor.dificultadAuditiva ? (
              <Text style={{ color: C.secundario, fontSize: 13, marginTop: 8 }}>
                {t.auditiva(p.repartidor.nombre)}
              </Text>
            ) : null}
            {avisoLlamada ? (
              <Text
                style={{ color: C.exito, fontWeight: '700', marginTop: 8 }}
                accessibilityRole="alert"
              >
                {avisoLlamada}
              </Text>
            ) : null}
          </Tarjeta>
        ) : null}
        {p.estado === 'en_camino' && p.fotoRecogida?.confirmadaEn && (
          <Tarjeta>
            <FotoPedido
              pedidoId={p.id}
              tipo="recogida"
              version={p.fotoRecogida.tomadaEn}
              pie={t.fotoSellado}
            />
          </Tarjeta>
        )}
        {/* BRE-7b: en la recogida no hay foto ni «cómo te lo dejaron»: sin tarjeta vacía. */}
        {p.estado === 'entregado' && !recoge && (p.fotoEntrega || p.entregadoComo) && (
          <Tarjeta>
            {p.entregadoComo ? (
              <Text style={{ fontWeight: '700' }}>
                {t.entregadoComo[p.entregadoComo]}
                {p.entregadoComo === 'seguro' && p.notaEntrega ? ` ${p.notaEntrega}` : ''}
              </Text>
            ) : null}
            {p.fotoEntrega ? (
              <FotoPedido
                pedidoId={p.id}
                tipo="entrega"
                version={p.fotoEntrega.tomadaEn}
                pie={p.entregadoComo === 'ausente' ? t.fotoAusente : t.fotoEntregado}
              />
            ) : null}
          </Tarjeta>
        )}
        {p.estado === 'entregado' && (
          <Tarjeta>
            {calificado ? (
              <Text style={{ fontWeight: '700', color: C.exito }}>{t.gracias}</Text>
            ) : (
              <>
                <Text style={{ fontWeight: '700', fontSize: 17, color: C.secundario }}>
                  {t.calificar}
                </Text>
                <Estrellas
                  valor={estRest}
                  cambiar={(n) => {
                    setEstRest(n);
                    setEtqRest([]);
                  }}
                  etiqueta={t.restaurante}
                  idioma={idioma}
                />
                <Etiquetas
                  para="restaurante"
                  estrellas={estRest}
                  elegidas={etqRest}
                  cambiar={setEtqRest}
                  idioma={idioma}
                />
                {estRest > 0 && p.lineas.length ? (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    <Text style={{ fontWeight: '700', color: C.secundario }}>{t.platosTitulo}</Text>
                    {[...new Map(p.lineas.map((l) => [l.platoId, l])).values()].map((l) => (
                      <View
                        key={l.platoId}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                      >
                        <Text style={{ flex: 1, color: C.secundario }} numberOfLines={2}>
                          {idioma === 'en' ? l.nombreEn || l.nombreEs : l.nombreEs}
                        </Text>
                        {([true, false] as const).map((gusta) => {
                          const elegido = gustos[l.platoId] === gusta;
                          return (
                            <Pressable
                              key={String(gusta)}
                              onPress={() => setGustos((g) => ({ ...g, [l.platoId]: gusta }))}
                              accessibilityRole="button"
                              accessibilityState={{ selected: elegido }}
                              accessibilityLabel={`${gusta ? t.meGusto : t.noMeGusto}: ${l.nombreEs}`}
                              style={{
                                paddingHorizontal: 12,
                                paddingVertical: 8,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: elegido ? (gusta ? C.exito : C.secundario) : '#D9D9D9',
                                backgroundColor: elegido
                                  ? gusta
                                    ? C.exito
                                    : C.secundario
                                  : '#FFFFFF',
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: '700',
                                  color: elegido ? '#FFFFFF' : C.secundario,
                                }}
                              >
                                {gusta ? t.meGusto : t.noMeGusto}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                ) : null}
                {p.repartidor && (
                  <>
                    <Estrellas
                      valor={estRep}
                      cambiar={(n) => {
                        setEstRep(n);
                        setEtqRep([]);
                      }}
                      etiqueta={`${t.repartidor}: ${p.repartidor.nombre}`}
                      idioma={idioma}
                    />
                    <Etiquetas
                      para="repartidor"
                      estrellas={estRep}
                      elegidas={etqRep}
                      cambiar={setEtqRep}
                      idioma={idioma}
                    />
                  </>
                )}
                {estRep > 0 && estRep < 4 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Switch value={culpa} onValueChange={setCulpa} accessibilityLabel={t.culpa} />
                    <Text style={{ flex: 1 }}>{t.culpa}</Text>
                  </View>
                )}
                {estRest > 0 ? (
                  <TextInput
                    value={comentario}
                    onChangeText={(x) => setComentario(x.slice(0, 500))}
                    placeholder={t.comentario}
                    accessibilityLabel={t.comentario}
                    multiline
                    numberOfLines={3}
                    style={[e.input, { marginTop: 8, minHeight: 72 }]}
                  />
                ) : null}
                {estRest > 0 && <BotonAncho texto={t.enviar} alTocar={() => void calificar()} />}
              </>
            )}
          </Tarjeta>
        )}
        {/* La propina posterior se cobra con la tarjeta guardada: solo en pedidos pagados con tarjeta
            (en un pedido cobrado en mano la propina se da en mano). */}
        {p.estado === 'entregado' &&
        p.repartidor &&
        (p.metodoPago ?? 'tarjeta') === 'tarjeta' &&
        !p.propinaExtra &&
        !propinaEnviada ? (
          <Tarjeta>
            <Text style={{ fontWeight: '700' }}>{t.propinaDespues}</Text>
            <Text style={{ color: '#5E5E5E', fontSize: 13, marginBottom: 6 }}>
              {t.propinaDespuesAyuda}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[100, 200, 500].map((c) => (
                <Pressable
                  key={c}
                  onPress={() => void propinaExtra(c)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.propinaDespues} ${formatearMonto(c, moneda, idioma)}`}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: C.exito,
                    borderRadius: 12,
                    paddingVertical: 10,
                  }}
                >
                  <Text style={{ fontWeight: '700', color: C.exito }}>
                    {formatearMonto(c, moneda, idioma)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Tarjeta>
        ) : null}
        {propinaEnviada ? (
          <Text
            style={{ color: C.exito, fontWeight: '700', marginBottom: 8 }}
            accessibilityRole="alert"
          >
            {t.propinaGracias}
          </Text>
        ) : null}
        {p.entrega === 'recoger' && ['pagado', 'aceptado', 'listo'].includes(p.estado) ? (
          <Tarjeta style={{ borderWidth: 2, borderColor: C.exito }}>
            <Text style={{ fontWeight: '700' }}>{t.recogerEnLocal}</Text>
            {p.estado === 'listo' ? (
              <Text style={{ color: C.exito, fontWeight: '700' }}>{t.recogerListo}</Text>
            ) : null}
          </Tarjeta>
        ) : null}
        {p.entrega !== 'recoger' && ['pagado', 'aceptado', 'listo'].includes(p.estado) ? (
          <Tarjeta>
            <Text style={{ fontWeight: '700' }}>{t.cambiarDireccion}</Text>
            <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.cambiarDireccionAyuda}</Text>
            {/* C-DIRECCION-SUGERENCIAS: la dirección nueva con su punto exacto. */}
            <CampoDireccion
              etiqueta={t.nuevaDireccion}
              valor={nuevaDireccion}
              cambiar={setNuevaDireccion}
              alElegir={(d) => setNuevoPunto(d.punto)}
              placeholder={t.nuevaDireccion}
            />
            <Boton texto={t.usarUbicacion} alTocar={() => void usarUbicacion()} secundario />
            {propuesta ? (
              <>
                <Text style={{ fontWeight: '700', marginTop: 6 }}>
                  {t.nuevoTotal
                    .replace('{antes}', formatearMonto(propuesta.antes, moneda, idioma))
                    .replace('{despues}', formatearMonto(propuesta.despues, moneda, idioma))}
                </Text>
                <Boton texto={t.aceptarTotal} alTocar={() => void cambiarDireccion(true)} exito />
              </>
            ) : nuevaDireccion.trim().length >= 5 ? (
              <Boton texto={t.aplicarDireccion} alTocar={() => void cambiarDireccion(false)} />
            ) : null}
            {avisoCambio ? (
              <Text style={{ color: C.exito, fontWeight: '700' }} accessibilityRole="alert">
                {avisoCambio}
              </Text>
            ) : null}
          </Tarjeta>
        ) : null}
        {p.repartidor && ['aceptado', 'listo', 'en_camino'].includes(p.estado) ? (
          <View onLayout={(ev) => (posChat.current = ev.nativeEvent.layout.y)}>
            <ChatPedido pedidoId={p.id} elegirFoto={elegirFotoQueja(idioma)} />
          </View>
        ) : null}

        {/* Detalle del pedido: lo que pediste, el total, a dónde y cómo se entrega. */}
        <Tarjeta>
          <Text style={{ fontWeight: '700', fontSize: 16, color: C.secundario, marginBottom: 8 }}>
            {tc.detalle} · {numero}
          </Text>
          {p.lineas.map((l) => (
            <View
              key={`${l.platoId}-${textoLinea(l, idioma)}`}
              style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}
            >
              <Text style={{ flex: 1, color: C.secundario }}>
                {l.cantidad} × {textoLinea(l, idioma)}
              </Text>
              <Text style={{ color: C.secundario }}>
                {formatearMonto(l.precioCentavos * l.cantidad, moneda, idioma)}
              </Text>
            </View>
          ))}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              borderTopWidth: 1,
              borderTopColor: '#eee',
              marginTop: 8,
              paddingTop: 8,
            }}
          >
            <Text style={{ fontWeight: '700', fontSize: 17 }}>{t.total}</Text>
            <Text style={{ fontWeight: '700', fontSize: 17 }}>
              {formatearMonto(p.total, moneda, idioma)}
            </Text>
          </View>
          {p.entrega !== 'recoger' && p.direccion ? (
            <>
              <Text style={{ fontWeight: '700', marginTop: 12, color: C.secundario }}>
                {t.tuCasa}
              </Text>
              <Text style={{ color: '#5E5E5E' }}>{p.direccion}</Text>
            </>
          ) : null}
          {entregaMostrada(p.entrega, p.entregadoComo) ? (
            <>
              <Text style={{ fontWeight: '700', marginTop: 10, color: C.secundario }}>
                {tc.tipoEntrega}
              </Text>
              <Text style={{ color: '#5E5E5E' }}>
                {tc.tipoEntregaPedido[entregaMostrada(p.entrega, p.entregadoComo) ?? '']}
              </Text>
            </>
          ) : null}
        </Tarjeta>

        {/* C-SEGUIMIENTO-COMPARTIDO: como Uber Eats, compartir el estado con otra persona. */}
        {!['entregado', 'cancelado', 'pago_pendiente'].includes(p.estado) ? (
          <Text
            style={[e.enlace, { marginBottom: 8 }]}
            accessibilityRole="button"
            onPress={() =>
              void api
                .pedir<{ url: string }>('POST', `/datos/pedidos/${p.id}/compartir`, {})
                .then(async (r) => {
                  const mensaje = t.compartirMensaje(r.url);
                  if (Platform.OS === 'web' && navigator.clipboard) {
                    await navigator.clipboard.writeText(mensaje);
                    setCopiado(true);
                  } else await Share.share({ message: mensaje });
                })
                .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)))
            }
          >
            {copiado ? t.copiado : t.compartir}
          </Text>
        ) : null}

        {p.programadoPara && !['entregado', 'cancelado'].includes(p.estado) ? (
          <Tarjeta style={{ borderWidth: 1, borderColor: '#2A2A2A' }}>
            <Text style={{ fontWeight: '700', color: C.secundario }}>{t.programado}</Text>
            <Text style={{ fontWeight: '700', fontSize: 17, marginTop: 2 }}>
              {textoFranja(
                deSqlUtc(p.programadoPara),
                Intl.DateTimeFormat().resolvedOptions().timeZone,
                idioma,
              )}
            </Text>
            <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: 4 }}>
              {t.programadoAyuda}
            </Text>
          </Tarjeta>
        ) : null}

        {(p.estado === 'pagado' || p.estado === 'pago_pendiente') &&
          (confirmar ? (
            <Tarjeta style={{ borderWidth: 1, borderColor: '#2A2A2A' }}>
              <Text style={{ fontWeight: '700', marginBottom: 8 }}>{t.seguro}</Text>
              <Boton texto={t.siCancelar} alTocar={() => void cancelar()} cargando={cancelando} />
              <Boton texto={t.noCancelar} alTocar={() => setConfirmar(false)} secundario />
            </Tarjeta>
          ) : (
            <Text
              style={[e.enlace, { marginBottom: 8 }]}
              onPress={() => setConfirmar(true)}
              accessibilityRole="button"
            >
              {t.cancelar}
            </Text>
          ))}
        {p.estado === 'entregado' || p.estado === 'cancelado' ? (
          <BotonAncho
            exito
            texto={otraVez.texto}
            alTocar={() =>
              void otraVez
                .pedirOtraVez(p.id)
                .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)))
            }
          />
        ) : null}
        {p.estado === 'entregado' ? (
          <BotonAncho texto={tc.volverInicio} alTocar={irInicio} secundario />
        ) : null}
        {/* Abre un ticket atado a este pedido (antes era un correo a una cuenta personal). */}
        <ReportarProblema
          pedidoId={p.id}
          textoBoton={t.ayuda}
          elegirFoto={elegirFotoQueja(idioma)}
        />
      </>
    ) : null,
  );
}

/** Botón redondo con ícono (llamar, mensaje) de la tarjeta del repartidor. */
function Circulo({
  icono,
  etiqueta,
  alTocar,
}: {
  icono: number;
  etiqueta: string;
  alTocar: () => void;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={6}
      style={{
        width: 46,
        height: 46,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* El ícono ya trae su círculo gris (el mismo de la app del repartidor). */}
      <Image
        source={icono}
        style={{ width: 46, height: 46 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </Pressable>
  );
}

export default conCuenta(SeguirPedido);
