import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { useSesion } from './sesion';

/**
 * La foto de la recogida o de la entrega de un pedido. Es privada: se pide con la sesión de quien
 * la mira (cliente, restaurante o repartidor). Si todavía no carga, no ocupa lugar.
 */
export function FotoPedido({
  pedidoId,
  tipo,
  version,
  pie,
}: {
  pedidoId: string;
  tipo: 'recogida' | 'entrega';
  /** Cambia cuando se toma una foto nueva (por ejemplo, la fecha en que se tomó). */
  version: string;
  pie?: string;
}) {
  const { api } = useSesion();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    api
      .verFoto(`/datos/pedidos/${pedidoId}/evidencia/${tipo}?v=${encodeURIComponent(version)}`)
      .then((u) => vivo && setUri(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, pedidoId, tipo, version]);
  if (!uri) return null;
  return (
    <View style={{ marginTop: 10 }}>
      <Image
        source={{ uri }}
        accessibilityLabel={pie}
        style={{
          // Completa en cualquier pantalla: en la tableta no se estira ni se corta.
          width: '100%',
          maxWidth: 360,
          aspectRatio: 1,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: '#2a2a2a',
          backgroundColor: '#f2f2f2',
        }}
        resizeMode="cover"
      />
      {pie ? <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: 4 }}>{pie}</Text> : null}
    </View>
  );
}
