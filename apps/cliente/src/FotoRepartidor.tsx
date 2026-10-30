import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { C, useSesion } from '@tumbite/movil';

/**
 * C-FOTO-VERIFICADA (29 oct 2026), como Uber y DoorDash: la foto del repartidor aprobada contra su
 * documento. Es privada: se pide con la sesión del cliente del pedido. Mientras no hay foto, la inicial.
 */
export function FotoRepartidor({
  ruta,
  nombre,
}: {
  ruta: string | null | undefined;
  nombre: string;
}) {
  const { api } = useSesion();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    if (!ruta) return;
    let vivo = true;
    api
      .verFoto(ruta)
      .then((u) => vivo && setUri(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, ruta]);
  if (uri)
    return (
      <Image
        source={{ uri }}
        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#f1f1f1' }}
        accessibilityLabel={nombre}
        accessibilityIgnoresInvertColors
      />
    );
  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: C.secundario,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>
        {nombre.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}
