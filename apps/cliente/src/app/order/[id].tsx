import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorApi, enIdioma, formatearDolares, nombrePlato } from '@tumbite/compartido';
import { Boton, C, FotoPedido, Pantalla, ReportarProblema, e, useSesion } from '@tumbite/movil';
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
  lineas: {
    platoId: string;
    nombreEs: string;
    nombreEn: string;
    cantidad: number;
    precioCentavos: number;
  }[];
  repartidor?: {
    nombre: string;
    lat: number | null;
    lng: number | null;
    actualizado: string | null;
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
  const [estRest, setEstRest] = useState(0);
  const [estRep, setEstRep] = useState(0);
  const [culpa, setCulpa] = useState(false);
  const [calificado, setCalificado] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  // Mientras el restaurante no acepte, el cliente puede arrepentirse y el dinero vuelve solo.
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
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.secundario, marginBottom: 8 }}>
              {t.llega} {p.minutosEstimados} {t.minutos}
            </Text>
          )}
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
          {p.estado === 'entregado' && p.fotoEntrega && (
            <View style={e.tarjeta}>
              <FotoPedido
                pedidoId={p.id}
                tipo="entrega"
                version={p.fotoEntrega.tomadaEn}
                pie={t.fotoEntregado}
              />
            </View>
          )}
          <View style={e.tarjeta}>
            {p.lineas.map((l) => (
              <Text key={l.platoId}>
                {l.cantidad} × {nombrePlato(l, idioma)}
              </Text>
            ))}
            <Text style={{ fontWeight: '800', marginTop: 8 }}>
              {t.total}: {formatearDolares(p.total, idioma)}
            </Text>
            <Text style={{ color: '#5E5E5E', marginTop: 4 }}>{p.direccion}</Text>
          </View>
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
