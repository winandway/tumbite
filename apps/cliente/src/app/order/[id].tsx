import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import {
  ErrorApi,
  enIdioma,
  formatearDolares,
  textoLinea,
  type OpcionElegida,
} from '@tumbite/compartido';
import {
  Boton,
  C,
  ChatPedido,
  FotoPedido,
  Pantalla,
  ReportarProblema,
  e,
  useSesion,
} from '@tumbite/movil';
import { useCarrito } from '../../carrito';
import { MapaEntrega } from '../../MapaEntrega';

type Pedido = {
  id: string;
  estado: string;
  motivoCancelacion?: 'cliente' | 'restaurante' | 'sin_respuesta' | null;
  restauranteNombre?: string;
  total: number;
  direccion: string;
  lat: number | null;
  lng: number | null;
  restaurante: { lat: number; lng: number } | null;
  minutosEstimados: number | null;
  fotoRecogida?: { tomadaEn: string; confirmadaEn: string | null } | null;
  fotoEntrega?: { tomadaEn: string } | null;
  entrega?: 'puerta' | 'mano' | 'recoger';
  propinaExtra?: number | null;
  requiereEdad?: boolean;
  entregadoComo?: 'puerta' | 'mano' | 'seguro' | null;
  notaEntrega?: string;
  llegaAMasTardar?: string | null;
  pin?: string | null;
  pinRequerido?: boolean;
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
    precioCentavos: number;
    opciones?: OpcionElegida[];
  }[];
  repartidor?: {
    nombre: string;
    lat: number | null;
    lng: number | null;
    actualizado: string | null;
    llegaEn5?: boolean;
    casiLlega?: boolean;
    llego?: boolean;
  } | null;
};

const T = {
  es: {
    titulo: 'Tu pedido',
    volver: '← Inicio',
    total: 'Total',
    ayuda: '¿Problemas con tu pedido? Cuéntanos',
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
    ubicacion: 'Ubicación actualizada',
    llega: 'Llega en unos',
    minutos: 'min',
    aMasTardar: 'A más tardar a las',
    tuPin: 'Tu PIN para recibir',
    tuPinAyuda:
      'Díselo solo a quien reciba el pedido. El repartidor lo necesita para entregarlo en mano.',
    faltaTitulo: 'El restaurante no tiene «{plato}»',
    faltaTexto:
      'Elige qué hacer. Si no respondes en 5 minutos, lo quitamos y te devolvemos su parte.',
    quitar: 'Quitarlo y seguir (te devolvemos {monto})',
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
    llamar: 'Llamar al repartidor (número oculto)',
    llamando:
      'Te estamos llamando. Contesta y te conectamos con tu repartidor; ninguno ve el número del otro.',
    pediste: { puerta: 'Pediste: en la puerta', mano: 'Pediste: en mano' } as Record<
      string,
      string
    >,
    entregadoComo: {
      puerta: 'Lo dejaron en tu puerta.',
      mano: 'Te lo entregaron en mano.',
      seguro: 'No te encontraron y lo dejaron en un lugar seguro:',
    } as Record<string, string>,
    tuCasa: 'Tu dirección',
    elRestaurante: 'El restaurante',
    calificar: '¿Qué tal todo?',
    restaurante: 'La comida',
    culpa: 'El problema fue de la comida o la demora del restaurante',
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
    ayuda: 'Problems with your order? Tell us',
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
    ubicacion: 'Location updated',
    llega: 'Arriving in about',
    minutos: 'min',
    aMasTardar: 'Latest arrival by',
    tuPin: 'Your PIN to receive',
    tuPinAyuda:
      'Share it only with whoever receives the order. The driver needs it to hand it over.',
    faltaTitulo: 'The restaurant is out of “{plato}”',
    faltaTexto:
      'Choose what to do. If you don’t answer in 5 minutes, we remove it and refund that part.',
    quitar: 'Remove it and continue (we refund {monto})',
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
    llamar: 'Call the driver (masked number)',
    llamando:
      'We’re calling you now. Answer and we’ll connect you with your driver; neither of you sees the other’s number.',
    pediste: { puerta: 'You chose: leave at door', mano: 'You chose: hand it to me' } as Record<
      string,
      string
    >,
    entregadoComo: {
      puerta: 'It was left at your door.',
      mano: 'It was handed to you.',
      seguro: 'They couldn’t find you and left it in a safe spot:',
    } as Record<string, string>,
    tuCasa: 'Your address',
    elRestaurante: 'The restaurant',
    calificar: 'How was everything?',
    restaurante: 'The food',
    culpa: 'The problem was the food or the restaurant’s delay',
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
            <Text style={{ fontSize: 30, color: n <= valor ? '#FF3008' : '#D6D6D6' }}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const PASOS = ['pagado', 'aceptado', 'listo', 'en_camino', 'entregado'];

export default function SeguirPedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const { vaciar } = useCarrito();
  const [p, setP] = useState<Pedido | null>(null);
  const [error, setError] = useState('');
  const [avisoLlamada, setAvisoLlamada] = useState('');
  const [estRest, setEstRest] = useState(0);
  const [estRep, setEstRep] = useState(0);
  const [culpa, setCulpa] = useState(false);
  const [calificado, setCalificado] = useState(false);
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [nuevoPunto, setNuevoPunto] = useState<{ lat: number; lng: number } | null>(null);
  const [propuesta, setPropuesta] = useState<{ antes: number; despues: number } | null>(null);
  const [avisoCambio, setAvisoCambio] = useState('');
  const [propinaEnviada, setPropinaEnviada] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  // Mientras el restaurante no acepte, el cliente puede arrepentirse y el dinero vuelve solo.
  const [decidiendo, setDecidiendo] = useState(false);
  async function decidirAjuste(decision: 'quitar' | 'cancelar') {
    if (decidiendo) return;
    setDecidiendo(true);
    setError('');
    try {
      await api.pedir('POST', `/datos/pedidos/${id}/ajuste`, { decision });
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

  async function calificar() {
    try {
      await api.pedir('POST', `/datos/pedidos/${id}/calificar`, {
        estrellasRestaurante: estRest,
        estrellasRepartidor: estRep || null,
        culpaRestaurante: culpa,
      });
      setCalificado(true);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  useEffect(() => {
    let vivo = true;
    const cargar = () =>
      api
        .pedir<{ pedido: Pedido }>('GET', `/datos/pedidos/${id}/seguimiento`)
        .then((r) => {
          if (!vivo) return;
          setP(r.pedido);
          setError('');
          if (r.pedido.estado !== 'pago_pendiente') vaciar();
        })
        .catch((x: unknown) => vivo && setError(x instanceof ErrorApi ? x.message : String(x)));
    void cargar();
    // Seguimiento: se pregunta cada 5 segundos mientras la pantalla está abierta.
    const reloj = setInterval(() => void cargar(), 5000);
    return () => {
      vivo = false;
      clearInterval(reloj);
    };
  }, [api, id, vaciar]);

  const paso = p ? PASOS.indexOf(p.estado) : -1;
  return (
    <Pantalla titulo={t.titulo}>
      <Text style={e.enlace} onPress={() => router.replace('/')} accessibilityRole="button">
        {t.volver}
      </Text>
      {error ? <Text style={e.error}>{error}</Text> : null}
      {p && (
        <>
          <View style={[e.tarjeta, { backgroundColor: C.secundario }]}>
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18 }}>
              {p.restauranteNombre}
            </Text>
            <Text
              style={{ color: '#fff', fontSize: 17, marginTop: 6 }}
              accessibilityLiveRegion="polite"
            >
              {(p.estado === 'cancelado' && p.motivoCancelacion
                ? t.motivos[p.motivoCancelacion]
                : null) ??
                t.estados[p.estado] ??
                p.estado}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
              {PASOS.map((s, i) => (
                <View
                  key={s}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    // Lo que ya pasó va en verde: es un avance, no una alarma.
                    backgroundColor: i <= paso ? C.exito : 'rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </View>
          </View>
          {p.minutosEstimados != null && (
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.secundario, marginBottom: 2 }}>
              {t.llega} {p.minutosEstimados} {t.minutos}
            </Text>
          )}
          {p.llegaAMasTardar && p.estado !== 'entregado' && p.estado !== 'cancelado' ? (
            <Text style={{ color: '#5E5E5E', marginBottom: 8 }}>
              {t.aMasTardar}{' '}
              {new Date(p.llegaAMasTardar).toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es-US', {
                hour: 'numeric',
                minute: '2-digit',
              })}
              {p.entrega ? ` · ${t.pediste[p.entrega]}` : ''}
            </Text>
          ) : null}
          {p.ajuste &&
          (p.ajuste.estado === 'pendiente' || p.estado === 'pagado' || p.estado === 'aceptado') ? (
            <View style={[e.tarjeta, { borderWidth: 3, borderColor: '#E0A000' }]}>
              {p.ajuste.estado === 'pendiente' ? (
                <>
                  <Text style={{ fontWeight: '800', fontSize: 17 }}>
                    {t.faltaTitulo.replace(
                      '{plato}',
                      idioma === 'en' ? p.ajuste.nombreEn || p.ajuste.nombreEs : p.ajuste.nombreEs,
                    )}
                  </Text>
                  <Text style={{ color: '#5E5E5E', marginVertical: 6 }}>{t.faltaTexto}</Text>
                  <Boton
                    texto={t.quitar.replace(
                      '{monto}',
                      formatearDolares(p.ajuste.devolucion ?? 0, idioma),
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
              ) : p.ajuste.estado === 'quitado' ? (
                <Text style={{ fontWeight: '700' }}>
                  {t.quitadoOk
                    .replace(
                      '{plato}',
                      idioma === 'en' ? p.ajuste.nombreEn || p.ajuste.nombreEs : p.ajuste.nombreEs,
                    )
                    .replace('{monto}', formatearDolares(p.ajuste.devolucion ?? 0, idioma))}
                </Text>
              ) : null}
            </View>
          ) : null}
          {p.pin && p.estado !== 'entregado' && p.estado !== 'cancelado' ? (
            <View style={[e.tarjeta, { borderWidth: 2, borderColor: C.exito }]}>
              <Text style={{ fontWeight: '700' }}>{t.tuPin}</Text>
              <Text style={{ fontSize: 34, fontWeight: '800', letterSpacing: 6 }}>{p.pin}</Text>
              <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.tuPinAyuda}</Text>
            </View>
          ) : null}
          {p.estado === 'en_camino' &&
          (p.repartidor?.llego || p.repartidor?.casiLlega || p.repartidor?.llegaEn5) ? (
            <Text
              style={{ color: C.exito, fontWeight: '800', fontSize: 17, marginBottom: 8 }}
              accessibilityRole="alert"
            >
              {p.repartidor?.llego
                ? t.enPuerta
                : p.repartidor?.casiLlega
                  ? t.casiLlega
                  : t.llegaEn5}
            </Text>
          ) : null}
          {p.estado !== 'entregado' && p.estado !== 'cancelado' && (
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
            />
          )}
          {p.repartidor && (
            <View style={e.tarjeta}>
              <Text style={{ fontWeight: '800' }}>
                {t.repartidor}: {p.repartidor.nombre}
              </Text>
              {p.repartidor.actualizado ? (
                <Text style={{ color: '#5E5E5E' }}>
                  {t.ubicacion}:{' '}
                  {new Date(`${p.repartidor.actualizado}Z`).toLocaleTimeString(
                    idioma === 'en' ? 'en-US' : 'es-US',
                    { hour: 'numeric', minute: '2-digit' },
                  )}
                </Text>
              ) : null}
            </View>
          )}
          {p.estado === 'en_camino' && p.fotoRecogida?.confirmadaEn && (
            <View style={e.tarjeta}>
              <FotoPedido
                pedidoId={p.id}
                tipo="recogida"
                version={p.fotoRecogida.tomadaEn}
                pie={t.fotoSellado}
              />
            </View>
          )}
          {p.estado === 'entregado' && (p.fotoEntrega || p.entregadoComo) && (
            <View style={e.tarjeta}>
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
                  pie={t.fotoEntregado}
                />
              ) : null}
            </View>
          )}
          {p.entrega === 'recoger' && ['pagado', 'aceptado', 'listo'].includes(p.estado) ? (
            <View style={[e.tarjeta, { borderWidth: 2, borderColor: C.exito }]}>
              <Text style={{ fontWeight: '800' }}>{t.recogerEnLocal}</Text>
              {p.estado === 'listo' ? (
                <Text style={{ color: C.exito, fontWeight: '700' }}>{t.recogerListo}</Text>
              ) : null}
            </View>
          ) : null}
          {p.entrega !== 'recoger' && ['pagado', 'aceptado', 'listo'].includes(p.estado) ? (
            <View style={e.tarjeta}>
              <Text style={{ fontWeight: '800' }}>{t.cambiarDireccion}</Text>
              <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.cambiarDireccionAyuda}</Text>
              <TextInput
                value={nuevaDireccion}
                onChangeText={setNuevaDireccion}
                placeholder={t.nuevaDireccion}
                accessibilityLabel={t.nuevaDireccion}
                style={[e.input, { marginTop: 6 }]}
              />
              <Boton texto={t.usarUbicacion} alTocar={() => void usarUbicacion()} secundario />
              {propuesta ? (
                <>
                  <Text style={{ fontWeight: '700', marginTop: 6 }}>
                    {t.nuevoTotal
                      .replace('{antes}', formatearDolares(propuesta.antes, idioma))
                      .replace('{despues}', formatearDolares(propuesta.despues, idioma))}
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
            </View>
          ) : null}
          {p.repartidor && ['aceptado', 'listo', 'en_camino'].includes(p.estado) ? (
            <>
              {avisoLlamada ? (
                <Text
                  style={{ color: C.exito, fontWeight: '700', marginBottom: 6 }}
                  accessibilityRole="alert"
                >
                  {avisoLlamada}
                </Text>
              ) : null}
              <Boton
                texto={t.llamar}
                alTocar={() =>
                  void api
                    .pedir('POST', `/datos/pedidos/${p.id}/llamar`, {})
                    .then(() => setAvisoLlamada(t.llamando))
                    .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)))
                }
                secundario
              />
              <ChatPedido pedidoId={p.id} />
            </>
          ) : null}
          <View style={e.tarjeta}>
            {p.lineas.map((l) => (
              <Text key={l.platoId}>
                {l.cantidad} × {textoLinea(l, idioma)}
              </Text>
            ))}
            <Text style={{ fontWeight: '800', marginTop: 8 }}>
              {t.total}: {formatearDolares(p.total, idioma)}
            </Text>
            <Text style={{ color: '#5E5E5E', marginTop: 4 }}>{p.direccion}</Text>
          </View>
          {p.estado === 'entregado' && p.repartidor && !p.propinaExtra && !propinaEnviada ? (
            <View style={e.tarjeta}>
              <Text style={{ fontWeight: '800' }}>{t.propinaDespues}</Text>
              <Text style={{ color: '#5E5E5E', fontSize: 13, marginBottom: 6 }}>
                {t.propinaDespuesAyuda}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[100, 200, 500].map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => void propinaExtra(c)}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.propinaDespues} ${formatearDolares(c, idioma)}`}
                    style={{
                      borderWidth: 1,
                      borderColor: C.exito,
                      borderRadius: 999,
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ fontWeight: '800', color: C.exito }}>
                      {formatearDolares(c, idioma)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {propinaEnviada ? (
            <Text
              style={{ color: C.exito, fontWeight: '700', marginBottom: 8 }}
              accessibilityRole="alert"
            >
              {t.propinaGracias}
            </Text>
          ) : null}
          {p.estado === 'entregado' && (
            <View style={e.tarjeta}>
              {calificado ? (
                <Text style={{ fontWeight: '700' }}>{t.gracias}</Text>
              ) : (
                <>
                  <Text style={{ fontWeight: '800', fontSize: 17 }}>{t.calificar}</Text>
                  <Estrellas
                    valor={estRest}
                    cambiar={setEstRest}
                    etiqueta={t.restaurante}
                    idioma={idioma}
                  />
                  {p.repartidor && (
                    <Estrellas
                      valor={estRep}
                      cambiar={setEstRep}
                      etiqueta={`${t.repartidor}: ${p.repartidor.nombre}`}
                      idioma={idioma}
                    />
                  )}
                  {estRep > 0 && estRep < 4 && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Switch value={culpa} onValueChange={setCulpa} accessibilityLabel={t.culpa} />
                      <Text style={{ flex: 1 }}>{t.culpa}</Text>
                    </View>
                  )}
                  {estRest > 0 && <Boton texto={t.enviar} alTocar={() => void calificar()} />}
                </>
              )}
            </View>
          )}
          {(p.estado === 'pagado' || p.estado === 'pago_pendiente') &&
            (confirmar ? (
              <View style={[e.tarjeta, { borderWidth: 1, borderColor: '#2A2A2A' }]}>
                <Text style={{ fontWeight: '700', marginBottom: 8 }}>{t.seguro}</Text>
                <Boton texto={t.siCancelar} alTocar={() => void cancelar()} cargando={cancelando} />
                <Boton texto={t.noCancelar} alTocar={() => setConfirmar(false)} secundario />
              </View>
            ) : (
              <Text
                style={[e.enlace, { marginBottom: 8 }]}
                onPress={() => setConfirmar(true)}
                accessibilityRole="button"
              >
                {t.cancelar}
              </Text>
            ))}
          {/* Abre un ticket atado a este pedido (antes era un correo a una cuenta personal). */}
          <ReportarProblema pedidoId={p.id} textoBoton={t.ayuda} />
        </>
      )}
    </Pantalla>
  );
}
