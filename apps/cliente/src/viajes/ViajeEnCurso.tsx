import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Image, Linking, Platform, Pressable, Share, View } from 'react-native';
import {
  ErrorApi,
  type LlegadaEnVivo,
  type MontoEnMano as MontoEnManoTipo,
  type Referencia,
  minutosDeLlegada,
  type PerfilConductorPublico,
  TEXTOS_PERFIL_CONDUCTOR,
  textoHoraLlegada,
  enIdioma,
  esPagoACelular,
  formatearMonto,
  nombreFormaPago,
  textoReferencia,
} from '@tumbite/compartido';
import {
  Boton,
  C,
  Campo,
  ChatPedido,
  TarjetaChatViaje,
  type UltimoMensajeViaje,
  MontoEnMano,
  useFotoPrivada,
  useSesion,
  Text,
  COLOR,
  Icono,
  InicialConductor,
  LETRA,
  PerfilConductor,
} from '@tumbite/movil';
import { MapaEntrega } from '../MapaEntrega';
import { Tarjeta } from '../comida/piezas';
import { miUbicacion } from '../ubicacion';
import { TEXTOS_MOTO } from './textos';
import { type ParadaDelViaje, ParadasDelViaje } from './Paradas';
import { BuscandoConductor, useReducirMovimiento } from './BuscandoConductor';
import { TIEMPOS, vehiculoDeEspera } from './escenaBuscando';
import { TEXTOS_ESPERA } from './textosEspera';
import { GuardarPuntoDeRecogida } from './FotoEntradaViaje';
import { PrecioCompacto, PrecioDelViaje, type RegaloDelViaje } from './PrecioDelViaje';

/** Lo que manda GET /datos/viajes/actual y /datos/viajes/:id. */
export type ViajePasajero = {
  id: string;
  /** C-CHAT-VIAJE-LLEGA: lo que no ha visto del chat y el último mensaje (de la ficha del viaje). */
  mensajesSinLeer?: number;
  ultimoMensaje?: UltimoMensajeViaje | null;
  /** C-CARRO-VIAJE-PASAJERO: moto, carro o envios, y en Carro si es XL. */
  servicio?: string;
  categoria?: string;
  estado: string;
  pin: string | null;
  metodoPago: string;
  origen: { direccion: string; lat: number; lng: number };
  /** C-FOTO-RECOGIDA: false = salió de un punto suelto (no de una dirección guardada). */
  recogidaGuardada?: boolean;
  destino: { direccion: string; lat: number; lng: number };
  total: number | null;
  /** C-QUIEN-PAGA-VIAJES: la tarifa de servicio de Divoox (ya sumada en `total`). */
  tarifaServicio?: number;
  moneda: string | null;
  /** C-CUPON-DIVOOX: lo que paga Divoox con el regalo (el pasajero paga en mano el resto). */
  regalo?: RegaloDelViaje | null;
  conductor: {
    nombre: string;
    ubicacion: { lat: number; lng: number } | null;
    vehiculo: {
      tipo?: string | null;
      marca: string | null;
      modelo: string | null;
      color: string | null;
      placa: string | null;
      plazas?: number | null;
    };
    /** Minutos estimados hasta la recogida (viene en camino) o hasta el destino (en curso). */
    llegadaMin?: number | null;
    /** Hay foto verificada del conductor (su selfie aprobada). */
    foto?: boolean;
  } | null;
  cancelacion: { cargo: number; gratisPorS: number | null } | null;
  /** C-PAGO-MOVIL-VIAJE: a quién pagar y si el conductor ya confirmó que le llegó. */
  pagoMovil?: {
    datos: {
      /** La billetera o cuenta del conductor (yape, plin, pago_movil). */
      tipo?: string | null;
      banco: string | null;
      titular: string | null;
      identificador: string;
    } | null;
    confirmado: 'recibido' | 'no_recibido' | null;
  } | null;
  /** C-BS-REFERENCIA: el equivalente en bolívares (solo informativo). */
  referencia?: Referencia | null;
  /** C-BS-EN-MANO: lo que paga en mano al conductor, en dólares y en bolívares (tasa fijada). */
  enMano?: MontoEnManoTipo | null;
  /** C-VIAJE-PARADAS: las paradas del viaje, en orden, y cuántas admite la ciudad. */
  paradas?: ParadaDelViaje[];
  /** C-HORA-LLEGADA: la hora calculada con tráfico en el servidor (recogida o destino). */
  llegadaEnVivo?: LlegadaEnVivo | null;
  paradasMaximas?: number;
  /** C-CARRO-DINAMICA: el multiplicador con que se cotizó (10 000 = precio normal). */
  multiplicadorPb?: number;
};

/** C-ENVIOS: lo que manda el servidor del paquete de un envío. */
export type PaqueteCliente = {
  descripcion: string;
  valorDeclarado: number;
  destinatario: string;
  pinEntrega: string | null;
  recogido: boolean;
  entregado: boolean;
  /** C-ESPERA-VEHICULO: sobre, pequeño, mediano o grande (decide el vehículo de la espera). */
  tamano?: string;
};

const FINALES = new Set(['terminado', 'cancelado', 'sin_conductor', 'no_show']);
const BUSCANDO = new Set(['buscando', 'pago_pendiente']);

/** La barra de «buscando»: un tramo rojo del 36 % recorre la barra (quieta con «reducir movimiento»). */
function BarraBuscando() {
  const [ancho, setAncho] = useState(0);
  const [valor] = useState(() => new Animated.Value(0));
  const reducir = useReducirMovimiento();
  useEffect(() => {
    if (reducir) {
      // Quieta y visible: el tramo rojo queda en el medio de la barra.
      valor.setValue(0.5);
      return;
    }
    const anim = Animated.loop(
      Animated.timing(valor, {
        toValue: 1,
        duration: TIEMPOS.barra,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
        // En la web no hay motor nativo y el bucle se cortaría tras la primera vuelta.
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [valor, reducir]);
  const x = valor.interpolate({ inputRange: [0, 1], outputRange: [-0.36 * ancho, ancho] });
  return (
    <View
      onLayout={(ev) => setAncho(ev.nativeEvent.layout.width)}
      style={{
        height: 4,
        borderRadius: 2,
        backgroundColor: COLOR.superficieFuerte,
        overflow: 'hidden',
        marginTop: 14,
      }}
    >
      <Animated.View
        style={{
          width: '36%',
          height: 4,
          borderRadius: 2,
          backgroundColor: COLOR.marca,
          transform: [{ translateX: x }],
        }}
      />
    </View>
  );
}

/**
 * C-ESPERA-FUNDIDO (fase cero): cuando aparece el conductor, la escena se cambia por el mapa con un
 * fundido de 300 ms. Solo si venía de la espera, y nunca con «reducir movimiento».
 */
function Fundido({ activo, children }: { activo: boolean; children: ReactNode }) {
  const reducir = useReducirMovimiento();
  const [opacidad] = useState(() => new Animated.Value(activo ? 0 : 1));
  useEffect(() => {
    if (!activo || reducir) {
      opacidad.setValue(1);
      return;
    }
    const a = Animated.timing(opacidad, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: Platform.OS !== 'web',
    });
    a.start();
    return () => a.stop();
  }, [activo, reducir, opacidad]);
  return (
    <Animated.View style={{ opacity: opacidad }} testID="viaje-fundido">
      {children}
    </Animated.View>
  );
}

/**
 * C-CARRO-VIAJE-PASAJERO: la foto del conductor (privada, con la sesión). Sin foto o si no carga, la
 * inicial de su nombre en un círculo, como Uber.
 */
function FotoConductor({
  viajeId,
  nombre,
  hay,
  enPerfil,
}: {
  viajeId: string;
  nombre: string;
  hay: boolean;
  /** C-PERFIL-CONDUCTOR: dentro del perfil oscuro, la foto llena su círculo (lado = alto del aro). */
  enPerfil?: number;
}) {
  // C-FOTO-CONDUCTOR-SE-VE: con la sesión por api.verFoto (nunca <Image headers>, que dejaba la inicial).
  const uri = useFotoPrivada(hay ? `/datos/viajes/${viajeId}/conductor/foto` : null);
  const lado = 56;
  if (enPerfil && !uri) return <InicialConductor nombre={nombre} tamano={enPerfil - 16} />;
  if (!uri)
    return (
      <View
        style={{
          width: lado,
          height: lado,
          borderRadius: lado / 2,
          backgroundColor: '#E6E7EA',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontWeight: '700', fontSize: 22, color: C.secundario }}>
          {nombre.slice(0, 1).toUpperCase()}
        </Text>
      </View>
    );
  return (
    <Image
      accessibilityIgnoresInvertColors
      source={{ uri }}
      style={
        enPerfil
          ? { width: '100%', height: '100%' }
          : { width: lado, height: lado, borderRadius: lado / 2 }
      }
    />
  );
}

/** C-PERFIL-CONDUCTOR: alto del aro de la foto en la tarjeta del conductor del viaje. */
const FOTO_PERFIL_VIAJE = 104;

/**
 * C-PERFIL-CONDUCTOR: el perfil del conductor de ESTE viaje (cifras, sellos, línea, idiomas y su
 * dato). Se pide una vez al aparecer el conductor (no en cada refresco del viaje); si no llega, la
 * tarjeta sigue con lo básico del viaje.
 */
function usePerfilConductor(viajeId: string, conConductor: boolean) {
  const { api } = useSesion();
  // El perfil queda atado a su viaje: el de un viaje anterior nunca se muestra en otro.
  const [leido, setLeido] = useState<{ viajeId: string; perfil: PerfilConductorPublico } | null>(
    null,
  );
  useEffect(() => {
    if (!conConductor) return;
    let vivo = true;
    api
      .pedir<{ perfil: PerfilConductorPublico }>('GET', `/datos/viajes/${viajeId}/conductor/perfil`)
      .then((r) => {
        if (vivo) setLeido({ viajeId, perfil: r.perfil });
      })
      .catch((e: unknown) => console.warn('perfil del conductor: no se pudo leer', e));
    return () => {
      vivo = false;
    };
  }, [api, viajeId, conConductor]);
  return conConductor && leido?.viajeId === viajeId ? leido.perfil : null;
}

/**
 * El viaje del pasajero mientras pasa (M5), como Uber Moto: buscando conductor; conductor
 * asignado con su nombre, su moto y su placa; el código para empezar; el mapa con el conductor;
 * en camino; y al llegar, cuánto pagar en efectivo. Cancelar dice antes cuánto cuesta.
 */
export function ViajeEnCurso({
  viaje,
  paquete = null,
  alCambiar,
  alTerminar,
  chatAbierto = false,
}: {
  /** C-CHAT-VIAJE-LLEGA: se abrió desde un aviso de mensaje: el chat empieza abierto. */
  chatAbierto?: boolean;
  viaje: ViajePasajero;
  paquete?: PaqueteCliente | null;
  alCambiar: () => void;
  alTerminar: () => void;
}) {
  const { api, idioma } = useSesion();
  const base = enIdioma(TEXTOS_MOTO, idioma);
  // C-ENVIO-TEXTOS: un envío no es un viaje de pasajero; cada pantalla habla del paquete.
  const t = viaje.servicio === 'envios' ? { ...base, ...base.envio } : base;
  // C-PAGO-A-CELULAR (Perú): «Yape» o «Plin»; con pago móvil (Venezuela) siguen sus textos de siempre.
  const medioCelular =
    esPagoACelular(viaje.metodoPago) && viaje.metodoPago !== 'pago_movil'
      ? nombreFormaPago(viaje.metodoPago, idioma)
      : null;
  const [error, setError] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [cargoCobrado, setCargoCobrado] = useState<number | null>(null);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [calificado, setCalificado] = useState(false);
  // C-CHAT-VIAJE: mensajes con el conductor mientras el viaje está activo (sin teléfonos).
  const [verChat, setVerChat] = useState(chatAbierto);
  // Un aviso de mensaje tocado con esta pantalla ya abierta también abre el chat.
  const [abrirVisto, setAbrirVisto] = useState(chatAbierto);
  if (chatAbierto !== abrirVisto) {
    setAbrirVisto(chatAbierto);
    if (chatAbierto) setVerChat(true);
  }
  // C-ESPERA-ADELANTE: ancho de la escena animada mientras se busca conductor.
  const [anchoEscena, setAnchoEscena] = useState(0);
  const te = enIdioma(TEXTOS_ESPERA, idioma);
  const buscando = BUSCANDO.has(viaje.estado);
  // C-ESPERA-VEHICULO: cada servicio espera con su vehículo (y el envío, según el tamaño del paquete).
  const vehiculoEspera = vehiculoDeEspera(viaje.servicio, paquete?.tamano);
  const esEnvio = viaje.servicio === 'envios';
  // «Parada» y «Qué envías» abren lo suyo debajo, sin salir de la espera.
  const [abrirParadas, setAbrirParadas] = useState(0);
  const [verPaquete, setVerPaquete] = useState(false);
  // C-ESPERA-FUNDIDO: cuando aparece el conductor, el mapa entra con un fundido de 300 ms.
  const [vioBuscar, setVioBuscar] = useState(buscando);
  if (buscando && !vioBuscar) setVioBuscar(true);
  // C-VIAJE-PROPINA: propina después del viaje, con la tarjeta con la que pagó.
  const [propina, setPropina] = useState<number | null>(null);
  async function darPropina(centavos: number) {
    setError('');
    try {
      await api.pedir('POST', `/datos/viajes/${viaje.id}/propina`, { centavos });
      setPropina(centavos);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function calificar() {
    setError('');
    try {
      await api.pedir('POST', `/datos/viajes/${viaje.id}/calificar`, { estrellas, comentario });
      setCalificado(true);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  const titulo = new Map([
    ['buscando', t.buscando],
    ['pago_pendiente', t.buscando],
    ['asignado', t.asignado],
    ['conductor_llego', t.llego],
    ['en_curso', t.enCurso],
    ['terminado', t.terminado],
    ['cancelado', t.cancelado],
    ['sin_conductor', t.sinConductor],
    ['no_show', t.noShow],
  ]).get(viaje.estado);
  const monto = (m: number) => formatearMonto(m, viaje.moneda ?? 'USD', idioma);
  const moto = viaje.conductor?.vehiculo;
  // C-CARRO-VIAJE-PASAJERO: cada servicio rotula su vehículo (Moto, Carro, Carro XL, Envío).
  const nombreVehiculo =
    viaje.servicio === 'carro'
      ? // C-CARRO-CATEGORIAS: Carro, Carro Comfort, Carro Premium o Carro XL.
        (new Map(Object.entries(t.vehiculoCategoria)).get(viaje.categoria ?? 'estandar') ??
        t.vehiculoCarro)
      : viaje.servicio === 'envios'
        ? t.vehiculoEnvio
        : t.moto;
  const llegada = viaje.conductor?.llegadaMin;

  async function cancelar() {
    setCancelando(true);
    setError('');
    try {
      const r = await api.pedir<{ cargo: number }>(
        'POST',
        `/datos/viajes/${viaje.id}/cancelar`,
        {},
        {
          cabeceras: {
            'idempotency-key': `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
          },
        },
      );
      if (r.cargo > 0) setCargoCobrado(r.cargo);
      alCambiar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setCancelando(false);
    }
  }

  async function compartir() {
    setError('');
    try {
      const r = await api.pedir<{ url: string }>('POST', `/datos/viajes/${viaje.id}/compartir`);
      await Share.share({ message: `${t.compartirMensaje} ${r.url}` });
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  /** Emergencia: primero la llamada (aunque falle el aviso), después el aviso al equipo. */
  async function emergencia() {
    const p = await miUbicacion({ aMano: true }).catch(() => null);
    const r = await api
      .pedir<{ numero: string }>('POST', `/datos/viajes/${viaje.id}/emergencia`, p ?? {})
      .catch(() => ({ numero: '911' }));
    void Linking.openURL(`tel:${r.numero}`);
  }
  const conConductor = ['asignado', 'conductor_llego', 'en_curso'].includes(viaje.estado);
  const perfilConductor = usePerfilConductor(viaje.id, conConductor && Boolean(viaje.conductor));
  const tp = enIdioma(TEXTOS_PERFIL_CONDUCTOR, idioma);
  // La hora de llegada, la misma en la tarjeta básica y en el perfil.
  const lineaLlegada = (enOscuro: boolean) =>
    viaje.llegadaEnVivo && (viaje.estado === 'asignado' || viaje.estado === 'en_curso') ? (
      <Text
        testID="viaje-llegada"
        style={{ fontWeight: '700', color: enOscuro ? COLOR.enLinea : C.exito }}
      >
        {(viaje.estado === 'asignado' ? t.llegaALas : t.destinoALas)(
          textoHoraLlegada(viaje.llegadaEnVivo.llegaEn, idioma),
          minutosDeLlegada(viaje.llegadaEnVivo.faltanS),
        )}
      </Text>
    ) : llegada && (viaje.estado === 'asignado' || viaje.estado === 'en_curso') ? (
      <Text
        testID="viaje-llegada"
        style={{ fontWeight: '700', color: enOscuro ? COLOR.enLinea : C.exito }}
      >
        {viaje.estado === 'asignado' ? t.llegaEn(llegada) : t.destinoEn(llegada)}
      </Text>
    ) : null;

  return (
    <View testID="viaje-pasajero" style={{ gap: 12 }}>
      {['asignado', 'conductor_llego', 'en_curso'].includes(viaje.estado) ? (
        <>
          {/* C-CHAT-VIAJE-LLEGA: el último mensaje y lo no leído, a la vista; tocar abre el chat. */}
          <TarjetaChatViaje
            idioma={idioma}
            sinLeer={viaje.mensajesSinLeer ?? 0}
            ultimo={viaje.ultimoMensaje ?? null}
            abierto={verChat}
            alTocar={() => setVerChat((x) => !x)}
          />
          {verChat ? <ChatPedido pedidoId={viaje.id} ruta={`/datos/viajes/${viaje.id}`} /> : null}
        </>
      ) : null}
      {buscando ? (
        // C-ESPERA-ADELANTE (fase cero): la escena animada, el título, la calma y la barra roja.
        <View onLayout={(ev) => setAnchoEscena(ev.nativeEvent.layout.width)}>
          {anchoEscena > 0 ? (
            <BuscandoConductor ancho={anchoEscena} vehiculo={vehiculoEspera} />
          ) : null}
          <Text
            accessibilityRole="header"
            testID={`viaje-estado-${viaje.estado}`}
            style={[LETRA.titulo, { fontSize: 26, lineHeight: 32, marginTop: 16 }]}
          >
            {new Map(Object.entries(te.titulo)).get(vehiculoEspera)}
          </Text>
          <Text style={[LETRA.secundario, { marginTop: 6 }]}>
            {new Map(Object.entries(te.calma)).get(vehiculoEspera)}
          </Text>
          <BarraBuscando />
          <View testID="buscando-lista" style={es.lista}>
            <View style={es.fila}>
              <View style={es.recogida} />
              <Text style={es.filaTexto} numberOfLines={1}>
                {esEnvio ? `${te.recoger} · ${viaje.origen.direccion}` : viaje.origen.direccion}
              </Text>
            </View>
            <View style={es.fila}>
              <View style={es.destino} />
              <Text style={es.filaTexto} numberOfLines={1}>
                {esEnvio ? `${te.entregar} · ${viaje.destino.direccion}` : viaje.destino.direccion}
              </Text>
            </View>
            <View style={[es.fila, { borderBottomWidth: 0 }]}>
              <Icono nombre="card-outline" tamano={18} />
              <Text style={es.filaTexto} numberOfLines={1}>
                {esEnvio
                  ? `${vehiculoEspera === 'carro-envio' ? te.envioEn.carro : te.envioEn.moto}${
                      paquete?.tamano
                        ? ` · ${(new Map(Object.entries(base.tamanos)).get(paquete.tamano) ?? '').toLowerCase()}`
                        : ''
                    }`
                  : nombreVehiculo}
              </Text>
              {/* C-PRECIO-CON-REGALO: con regalo, el precio tachado y lo que se paga («Gratis»). */}
              <PrecioCompacto
                total={viaje.total}
                regalo={viaje.regalo}
                moneda={viaje.moneda ?? 'USD'}
                idioma={idioma}
                estilo={[LETRA.tarjeta, { fontFamily: 'Poppins_700Bold' }]}
              />
            </View>
          </View>
          {viaje.total != null && !esEnvio ? (
            <View
              testID="buscando-precio-fijo"
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}
            >
              <Icono nombre="checkmark" tamano={18} color={C.exito} />
              <Text style={{ color: C.exito, fontWeight: '700' }}>{te.precioFijo}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <Text
          accessibilityRole="header"
          testID={`viaje-estado-${viaje.estado}`}
          style={{ fontSize: 24, fontWeight: '700', color: C.secundario }}
        >
          {titulo}
        </Text>
      )}

      {!FINALES.has(viaje.estado) && !buscando ? (
        <Fundido activo={vioBuscar}>
          <MapaEntrega
            restaurante={{ lat: viaje.origen.lat, lng: viaje.origen.lng }}
            casa={{ lat: viaje.destino.lat, lng: viaje.destino.lng }}
            repartidor={viaje.conductor?.ubicacion ?? null}
            nombreRepartidor={viaje.conductor?.nombre}
            // C-MAPA-LLEGADA: mientras viene a buscarte el mapa se acerca a la recogida; ya en viaje, al destino.
            meta={
              viaje.estado === 'asignado' || viaje.estado === 'conductor_llego'
                ? 'restaurante'
                : 'casa'
            }
            direccion={
              viaje.estado === 'asignado' || viaje.estado === 'conductor_llego'
                ? viaje.origen.direccion
                : viaje.destino.direccion
            }
            etiquetas={{
              restaurante: t.etiquetaRecogida,
              casa: t.etiquetaDestino,
              repartidor: t.etiquetaConductor,
            }}
            // C-VIAJE-PARADAS: las paradas que faltan o en las que está, numeradas en el mapa.
            paradas={(viaje.paradas ?? []).map((p, i) => ({
              lat: p.lat,
              lng: p.lng,
              etiqueta: `${base.parada(i + 1)} · ${p.direccion}`,
            }))}
          />
        </Fundido>
      ) : null}

      {/* C-VIAJE-PARADAS: las paradas del viaje y, mientras no termine, cambiarlas viendo el precio. */}
      {viaje.servicio !== 'envios' && !FINALES.has(viaje.estado) ? (
        <ParadasDelViaje
          viajeId={viaje.id}
          paradas={viaje.paradas ?? []}
          maximo={viaje.paradasMaximas ?? 0}
          puedeCambiar={
            (viaje.paradasMaximas ?? 0) > 0 &&
            ['buscando', 'asignado', 'conductor_llego', 'en_curso'].includes(viaje.estado)
          }
          cerca={{ lat: viaje.origen.lat, lng: viaje.origen.lng }}
          alCambiar={alCambiar}
          // Mientras busca, el «+ Agregar parada» vive en el botón «Parada» de la espera.
          sinBoton={buscando}
          abrirCon={abrirParadas}
        />
      ) : null}

      {/* C-PERFIL-CONDUCTOR: la tarjeta del conductor ampliada con su perfil (variante oscura del
          borrador aprobado): foto, nombre de pila, vehículo y placa, cifras o «Nuevo en Divoox»,
          sellos solo si está verificado, línea, idiomas y su dato. Mientras llega, lo básico. */}
      {viaje.conductor && perfilConductor ? (
        <View
          testID="viaje-conductor"
          style={{
            borderRadius: 16,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: COLOR.borde,
          }}
        >
          <PerfilConductor
            testID="viaje-perfil-conductor"
            perfil={perfilConductor}
            idioma={idioma}
            propio={false}
            cabecera={tp.tuConductor}
            tamanoFoto={FOTO_PERFIL_VIAJE}
            foto={
              <FotoConductor
                viajeId={viaje.id}
                nombre={perfilConductor.nombre || viaje.conductor.nombre}
                hay={Boolean(viaje.conductor.foto)}
                enPerfil={FOTO_PERFIL_VIAJE}
              />
            }
            debajoDelNombre={
              <View style={{ alignItems: 'center', marginTop: 2 }}>
                {lineaLlegada(true)}
                {viaje.servicio === 'carro' && moto?.plazas ? (
                  <Text style={{ color: '#FFFFFF', opacity: 0.78, fontSize: 13 }}>
                    {nombreVehiculo} · {t.plazas(moto.plazas)}
                  </Text>
                ) : null}
              </View>
            }
          />
        </View>
      ) : viaje.conductor ? (
        <Tarjeta>
          <View testID="viaje-conductor" style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <FotoConductor
                viajeId={viaje.id}
                nombre={viaje.conductor.nombre}
                hay={Boolean(viaje.conductor.foto)}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 18, color: C.secundario }}>
                  {viaje.conductor.nombre}
                </Text>
                {lineaLlegada(false)}
              </View>
            </View>
            <Text style={{ color: '#666B73' }}>
              {nombreVehiculo}:{' '}
              {[moto?.marca, moto?.modelo, moto?.color].filter(Boolean).join(' · ')}
              {viaje.servicio === 'carro' && moto?.plazas ? ` · ${t.plazas(moto.plazas)}` : ''}
            </Text>
            {moto?.placa ? (
              <Text style={{ fontWeight: '700', color: C.secundario, letterSpacing: 1 }}>
                {t.placa}: {moto.placa}
              </Text>
            ) : null}
          </View>
        </Tarjeta>
      ) : null}

      {/* C-ENVIOS: la tarjeta del paquete con el PIN para quien recibe se ve SIEMPRE, también mientras
          busca (quien envía se lo pasa a quien recibe). «Qué envías» le suma el tamaño y el valor. */}
      {paquete ? (
        <Tarjeta>
          <Text style={{ fontWeight: '700', color: C.secundario }}>
            {paquete.descripcion} · {t.paraQuien} {paquete.destinatario}
          </Text>
          {verPaquete ? (
            <View testID="envio-detalle" style={{ marginTop: 6, gap: 2 }}>
              {paquete.tamano ? (
                <Text style={{ color: '#666B73' }}>
                  {base.paqueteTamano}:{' '}
                  {new Map(Object.entries(base.tamanos)).get(paquete.tamano) ?? paquete.tamano}
                </Text>
              ) : null}
              <Text style={{ color: '#666B73' }}>
                {base.paqueteValor}: {monto(paquete.valorDeclarado)}
              </Text>
            </View>
          ) : null}
          {paquete.pinEntrega ? (
            <>
              <Text style={{ marginTop: 6, color: '#666B73' }}>{t.pinEntrega}</Text>
              <Text
                testID="envio-pin"
                style={{ fontSize: 30, fontWeight: '700', letterSpacing: 8, color: C.secundario }}
              >
                {paquete.pinEntrega}
              </Text>
              <Text style={{ color: '#666B73', fontSize: 12 }}>{t.pinEntregaAyuda}</Text>
            </>
          ) : null}
        </Tarjeta>
      ) : null}
      {viaje.pin && viaje.estado !== 'buscando' ? (
        <Tarjeta>
          <View testID="viaje-codigo" style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#666B73', fontWeight: '700' }}>{t.codigo}</Text>
            <Text
              style={{ fontSize: 40, fontWeight: '700', letterSpacing: 10, color: C.secundario }}
            >
              {viaje.pin}
            </Text>
            <Text style={{ color: '#666B73', textAlign: 'center' }}>{t.codigoAyuda}</Text>
          </View>
        </Tarjeta>
      ) : null}

      {viaje.pagoMovil?.datos ? (
        <Tarjeta>
          <View testID="viaje-pago-movil" style={{ gap: 2 }}>
            <Text style={{ color: '#666B73', fontWeight: '700' }}>
              {medioCelular ? t.celularDatos(medioCelular) : t.pagoMovilDatos}
            </Text>
            {viaje.pagoMovil.datos.banco ? (
              <Text style={{ color: C.secundario }}>{viaje.pagoMovil.datos.banco}</Text>
            ) : null}
            {viaje.pagoMovil.datos.titular ? (
              <Text style={{ color: C.secundario }}>{viaje.pagoMovil.datos.titular}</Text>
            ) : null}
            <Text selectable style={{ fontWeight: '700', color: C.secundario }}>
              {viaje.pagoMovil.datos.identificador}
            </Text>
            {medioCelular &&
            viaje.pagoMovil.datos.tipo &&
            viaje.pagoMovil.datos.tipo !== viaje.metodoPago ? (
              <Text testID="viaje-otra-billetera" style={{ color: '#666B73', fontSize: 12 }}>
                {t.celularOtraBilletera(
                  nombreFormaPago(viaje.pagoMovil.datos.tipo, idioma),
                  medioCelular,
                )}
              </Text>
            ) : null}
            {viaje.pagoMovil.confirmado === 'recibido' ? (
              <Text style={{ color: '#0D7A3A', fontWeight: '700' }}>{t.pagoMovilConfirmado}</Text>
            ) : viaje.pagoMovil.confirmado === 'no_recibido' ? (
              <Text style={{ color: C.primario }}>{t.pagoMovilNoLlego}</Text>
            ) : (
              <Text style={{ color: '#666B73', fontSize: 12 }}>
                {medioCelular ? t.celularEnviar : t.pagoMovilEnviar}
              </Text>
            )}
          </View>
        </Tarjeta>
      ) : null}

      {buscando ? (
        // Fase cero: «Parada» (o «Qué envías» en un envío) y «Compartir», lado a lado.
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {esEnvio ? (
            <View style={{ flex: 1 }}>
              <Boton
                tipo="terciario"
                icono="cube-outline"
                texto={te.queEnvias}
                alTocar={() => setVerPaquete((x) => !x)}
                testID="buscando-que-envias"
              />
            </View>
          ) : viaje.estado === 'buscando' && (viaje.paradasMaximas ?? 0) > 0 ? (
            <View style={{ flex: 1 }}>
              <Boton
                tipo="terciario"
                icono="add"
                texto={te.parada}
                alTocar={() => setAbrirParadas((n) => n + 1)}
                testID="buscando-parada"
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Boton
              tipo="terciario"
              icono="share-social-outline"
              texto={te.compartir}
              alTocar={() => void compartir()}
              testID="buscando-compartir"
            />
          </View>
        </View>
      ) : (
        <Tarjeta>
          <Text style={{ color: '#666B73', fontSize: 12 }}>{t.etiquetaRecogida}</Text>
          <Text style={{ fontWeight: '700', color: C.secundario }}>{viaje.origen.direccion}</Text>
          <Text style={{ color: '#666B73', fontSize: 12, marginTop: 8 }}>{t.etiquetaDestino}</Text>
          <Text style={{ fontWeight: '700', color: C.secundario }}>{viaje.destino.direccion}</Text>
          {/* C-PRECIO-CON-REGALO: el precio tachado, el regalo en verde y lo que se paga de verdad. */}
          <PrecioDelViaje
            etiqueta={
              viaje.estado === 'terminado'
                ? viaje.metodoPago === 'tarjeta'
                  ? t.pagadoTarjeta
                  : viaje.metodoPago === 'pago_movil'
                    ? t.pagoMovil
                    : medioCelular
                      ? t.celularPagado(medioCelular)
                      : t.pagaEfectivo
                : t.precioFijo
            }
            total={viaje.total}
            regalo={viaje.regalo}
            moneda={viaje.moneda ?? 'USD'}
            idioma={idioma}
          />
          {(viaje.tarifaServicio ?? 0) > 0 ? (
            // C-QUIEN-PAGA-VIAJES: la tarifa de servicio de Divoox, a la vista (ya va en el total).
            <Text testID="viaje-tarifa-servicio" style={{ color: '#666B73', fontSize: 13 }}>
              {t.tarifaServicio}: {monto(viaje.tarifaServicio ?? 0)}
            </Text>
          ) : null}
          {viaje.enMano ? (
            <MontoEnMano
              testID="viaje-precio-bs"
              monto={viaje.enMano}
              idioma={idioma === 'en' ? 'en' : 'es'}
              quien="pasajero"
              etiqueta={viaje.estado === 'terminado' ? t.pagasteEnMano : t.pagasEnMano}
              copiable={esPagoACelular(viaje.metodoPago) && viaje.estado !== 'terminado'}
            />
          ) : viaje.referencia ? (
            <Text testID="viaje-precio-bs" style={{ color: '#666B73' }}>
              {textoReferencia(viaje.referencia, idioma)}
            </Text>
          ) : null}
        </Tarjeta>
      )}

      {conConductor ? (
        <View style={{ gap: 8 }}>
          <Boton texto={t.compartir} alTocar={() => void compartir()} secundario />
          <Boton texto={t.emergencia} alTocar={() => void emergencia()} />
          <Text style={{ color: '#666B73', fontSize: 12, textAlign: 'center' }}>
            {t.emergenciaAyuda}
          </Text>
        </View>
      ) : null}
      {cargoCobrado ? (
        <Text style={{ color: '#666B73' }}>
          {t.cargoCobrado} {monto(cargoCobrado)}
        </Text>
      ) : null}
      {viaje.cancelacion ? (
        <>
          <Boton
            texto={paquete ? t.cancelarEnvio : t.cancelar}
            alTocar={() => void cancelar()}
            cargando={cancelando}
            tipo="borde"
          />
          {/* Fase cero: la nota va debajo del botón, chica y en gris. */}
          <Text style={[LETRA.pequeno, { textAlign: 'center', marginTop: -4 }]}>
            {viaje.cancelacion.cargo === 0
              ? buscando
                ? te.cancelarNota
                : t.cancelarGratis
              : `${t.cancelarCargo} ${monto(viaje.cancelacion.cargo)}`}
          </Text>
        </>
      ) : null}
      {viaje.estado === 'terminado' && !calificado ? (
        <Tarjeta>
          <View testID="viaje-calificar" style={{ gap: 8 }}>
            <Text style={{ fontWeight: '700', fontSize: 18, color: C.secundario }}>
              {t.calificar}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setEstrellas(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${n} ${t.estrella}`}
                  accessibilityState={{ selected: estrellas === n }}
                  testID={`estrella-${n}`}
                >
                  <Text style={{ fontSize: 34, color: n <= estrellas ? C.exito : '#C9CED6' }}>
                    ★
                  </Text>
                </Pressable>
              ))}
            </View>
            <Campo etiqueta={t.comentario} value={comentario} onChangeText={setComentario} />
            {estrellas ? (
              <Boton texto={t.enviarCalificacion} alTocar={() => void calificar()} exito />
            ) : null}
          </View>
        </Tarjeta>
      ) : null}
      {calificado ? <Text style={{ color: C.exito, fontWeight: '700' }}>{t.gracias}</Text> : null}
      {viaje.estado === 'terminado' && viaje.metodoPago === 'tarjeta' ? (
        <Tarjeta>
          {propina ? (
            <Text style={{ color: C.exito, fontWeight: '700' }}>
              {t.propinaGracias} {monto(propina)}
            </Text>
          ) : (
            <View testID="viaje-propina" style={{ gap: 8 }}>
              <Text style={{ fontWeight: '700', color: C.secundario }}>{t.propinaTitulo}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[100, 200, 500].map((c) => (
                  <View key={c} style={{ flex: 1 }}>
                    <Boton texto={monto(c)} alTocar={() => void darPropina(c)} secundario />
                  </View>
                ))}
              </View>
            </View>
          )}
        </Tarjeta>
      ) : null}
      {/* C-VIAJE-PROPINA-MANO: con efectivo o pago móvil la propina se da en mano (inDrive, Ridery);
          la app no la cobra, pero lo dice en vez de callarse. */}
      {viaje.estado === 'terminado' && viaje.metodoPago !== 'tarjeta' ? (
        <Text testID="viaje-propina-mano" style={{ color: '#666B73' }}>
          {t.propinaEnMano}
        </Text>
      ) : null}
      {/* C-FOTO-RECOGIDA: salió de un punto suelto; se le ofrece guardarlo como dirección. */}
      <GuardarPuntoDeRecogida viaje={viaje} />
      {FINALES.has(viaje.estado) ? (
        <Boton texto={t.otraVez} alTocar={alTerminar} exito={viaje.estado === 'terminado'} />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const es = {
  lista: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLOR.borde,
    borderRadius: 12,
  },
  fila: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 14,
    minHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.borde,
  },
  filaTexto: { flex: 1, fontSize: 14.5, fontFamily: 'Montserrat_500Medium', color: COLOR.texto },
  recogida: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: COLOR.negro,
    backgroundColor: COLOR.blanco,
  },
  destino: { width: 14, height: 14, borderRadius: 3, backgroundColor: COLOR.marca },
};
