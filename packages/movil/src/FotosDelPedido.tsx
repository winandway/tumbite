import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { enIdioma } from '@tumbite/compartido';
import { Text } from './diseno';
import { useSesion } from './sesion';

/**
 * C-FOTOS-AL-COMERCIO (15 nov 2026, pedido de Richard tras la prueba en Novi): el restaurante ve
 * las DOS fotos de prueba del pedido, como la prueba de entrega que muestran DoorDash Merchant y
 * Uber Eats Manager para atender un reclamo: «Al recoger» (la bolsa cerrada en el local) y
 * «Al entregar» (la comida en la puerta). Es la misma foto guardada una sola vez en el almacén,
 * pedida con la sesión de quien mira; no se copia. Al tocar una miniatura se abre en grande.
 */
const T = {
  es: {
    titulo: 'Fotos del pedido',
    recogida: 'Al recoger',
    entrega: 'Al entregar',
    pendiente: 'Todavía no',
    enMano: 'En mano: sin foto',
    ver: (q: string) => `Ver en grande la foto ${q.toLowerCase()}`,
    cerrar: 'Cerrar',
  },
  en: {
    titulo: 'Order photos',
    recogida: 'At pickup',
    entrega: 'At drop-off',
    pendiente: 'Not yet',
    enMano: 'Handed over: no photo',
    ver: (q: string) => `See the photo ${q.toLowerCase()} full size`,
    cerrar: 'Close',
  },
};

type Foto = { tomadaEn: string } | null | undefined;

function useFoto(pedidoId: string, tipo: 'recogida' | 'entrega', foto: Foto) {
  const { api } = useSesion();
  const [uri, setUri] = useState<string | null>(null);
  const version = foto?.tomadaEn ?? '';
  useEffect(() => {
    if (!version) return;
    let vivo = true;
    api
      .verFoto(`/datos/pedidos/${pedidoId}/evidencia/${tipo}?v=${encodeURIComponent(version)}`)
      .then((u) => vivo && setUri(u))
      .catch((e: unknown) => console.warn('foto del pedido: no cargó', tipo, e));
    return () => {
      vivo = false;
    };
  }, [api, pedidoId, tipo, version]);
  return version ? uri : null;
}

export function FotosDelPedido({
  pedidoId,
  recogida,
  entrega,
  entregadoSinFoto = false,
}: {
  pedidoId: string;
  recogida: Foto;
  entrega: Foto;
  /** El pedido ya se entregó en mano (no lleva foto de entrega). */
  entregadoSinFoto?: boolean;
}) {
  const { idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const uriRecogida = useFoto(pedidoId, 'recogida', recogida);
  const uriEntrega = useFoto(pedidoId, 'entrega', entrega);
  const [grande, setGrande] = useState<{ uri: string; titulo: string } | null>(null);
  if (!recogida && !entrega) return null;

  const miniatura = (titulo: string, uri: string | null, vacio: string, testID: string) => (
    <View style={{ flex: 1, gap: 6 }} testID={testID}>
      {uri ? (
        <Pressable
          onPress={() => setGrande({ uri, titulo })}
          accessibilityRole="imagebutton"
          accessibilityLabel={t.ver(titulo)}
        >
          <Image
            source={{ uri }}
            accessibilityLabel={titulo}
            style={{
              width: '100%',
              aspectRatio: 1,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: '#2a2a2a',
              backgroundColor: '#F2F2F2',
            }}
            resizeMode="cover"
          />
        </Pressable>
      ) : (
        <View
          style={{
            width: '100%',
            aspectRatio: 1,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#D6D8DC',
            backgroundColor: '#F6F6F6',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 8,
          }}
        >
          <Text style={{ color: '#666B73', fontSize: 13, textAlign: 'center' }}>{vacio}</Text>
        </View>
      )}
      <Text style={{ fontWeight: '700', textAlign: 'center' }}>{titulo}</Text>
    </View>
  );

  return (
    <View style={{ marginTop: 4, marginBottom: 12 }} testID="fotos-del-pedido">
      <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 8 }}>{t.titulo}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {miniatura(t.recogida, uriRecogida, t.pendiente, 'foto-al-recoger')}
        {miniatura(
          t.entrega,
          uriEntrega,
          entregadoSinFoto ? t.enMano : t.pendiente,
          'foto-al-entregar',
        )}
      </View>
      <Modal
        visible={grande != null}
        transparent
        animationType="fade"
        onRequestClose={() => setGrande(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', padding: 16 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 32,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 17 }}>
              {grande?.titulo}
            </Text>
            <Pressable
              onPress={() => setGrande(null)}
              accessibilityRole="button"
              accessibilityLabel={t.cerrar}
              hitSlop={12}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ fontWeight: '700' }}>{t.cerrar}</Text>
            </Pressable>
          </View>
          {grande ? (
            <Image
              source={{ uri: grande.uri }}
              style={{ flex: 1, width: '100%' }}
              resizeMode="contain"
              accessibilityLabel={grande.titulo}
            />
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
