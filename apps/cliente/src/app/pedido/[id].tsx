import { useEffect, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorApi, enIdioma, formatearDolares, nombrePlato } from '@tumbite/compartido';
import { Boton, C, Pantalla, e, useSesion } from '@tumbite/movil';
import { useCarrito } from '../../carrito';

type Pedido = {
  id: string;
  estado: string;
  restauranteNombre?: string;
  total: number;
  direccion: string;
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
    ayuda: '¿Problemas con tu pedido? Escríbenos',
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
  },
  en: {
    titulo: 'Your order',
    volver: '← Home',
    total: 'Total',
    ayuda: 'Problems with your order? Email us',
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
  },
};

const PASOS = ['pagado', 'aceptado', 'listo', 'en_camino', 'entregado'];

export default function SeguirPedido() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const { vaciar } = useCarrito();
  const [p, setP] = useState<Pedido | null>(null);
  const [error, setError] = useState('');

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
            <Text style={{ color: C.acento, fontWeight: '800', fontSize: 18 }}>
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
          {p.repartidor && (
            <View style={e.tarjeta}>
              <Text style={{ fontWeight: '800' }}>
                {t.repartidor}: {p.repartidor.nombre}
              </Text>
              {p.repartidor.actualizado ? (
                <Text style={{ color: '#6b6178' }}>
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
            <Text style={{ color: '#6b6178', marginTop: 4 }}>{p.direccion}</Text>
          </View>
          <Boton
            texto={t.ayuda}
            alTocar={() =>
              void Linking.openURL(
                `mailto:tumbite.com@gmail.com?subject=Pedido%20${p.id.slice(0, 8)}`,
              )
            }
            secundario
          />
        </>
      )}
    </Pantalla>
  );
}
