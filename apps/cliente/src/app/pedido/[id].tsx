import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorApi, enIdioma, formatearDolares, nombrePlato } from '@tumbite/compartido';
import { Boton, C, Pantalla, ReportarProblema, e, useSesion } from '@tumbite/movil';
import { useCarrito } from '../../carrito';
import { MapaEntrega } from '../../MapaEntrega';

type Pedido = {
  id: string;
  estado: string;
  restauranteNombre?: string;
  total: number;
  direccion: string;
  lat: number | null;
  lng: number | null;
  restaurante: { lat: number; lng: number } | null;
  minutosEstimados: number | null;
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
      cancelado: 'Pedido cancelado.',
    } as Record<string, string>,
    repartidor: 'Tu repartidor',
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
      cancelado: 'Order canceled.',
    } as Record<string, string>,
    repartidor: 'Your driver',
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
  },
};

function Estrellas({
  valor,
  cambiar,
  etiqueta,
}: {
  valor: number;
  cambiar: (n: number) => void;
  etiqueta: string;
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
            accessibilityLabel={`${n} / 5`}
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
              {t.estados[p.estado] ?? p.estado}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
              {PASOS.map((s, i) => (
                <View
                  key={s}
                  style={{
                    flex: 1,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: i <= paso ? C.primario : 'rgba(255,255,255,0.25)',
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
                  {t.ubicacion}: {new Date(`${p.repartidor.actualizado}Z`).toLocaleTimeString()}
                </Text>
              ) : null}
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
                  <Estrellas valor={estRest} cambiar={setEstRest} etiqueta={t.restaurante} />
                  {p.repartidor && (
                    <Estrellas
                      valor={estRep}
                      cambiar={setEstRep}
                      etiqueta={`${t.repartidor}: ${p.repartidor.nombre}`}
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
          {/* Abre un ticket atado a este pedido (antes era un correo a una cuenta personal). */}
          <ReportarProblema pedidoId={p.id} textoBoton={t.ayuda} />
        </>
      )}
    </Pantalla>
  );
}
