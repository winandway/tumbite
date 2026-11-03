import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { type Idioma, formatearMonto } from '@tumbite/compartido';
import { useSesion } from '@tumbite/movil';
import { textosTiendas } from './textos';
import type { ProductoTienda } from './tipos';

export type ReemplazoElegido = { platoId: string; nombreEs: string; nombreEn: string };

/**
 * ETP-4 (C-TIENDAS-REEMPLAZO-ELEGIDO): en el carrito, el cliente busca en la MISMA tienda el producto
 * que quiere si el suyo no está, como «Choose a specific replacement» de Instacart y DoorDash [DOC].
 * Busca mientras escribe (desde dos letras) y deja elegir uno distinto del que falta.
 */
export function ElegirReemplazo({
  tiendaId,
  platoId,
  elegido,
  idioma,
  elegir,
}: {
  tiendaId: string;
  platoId: string;
  elegido: ReemplazoElegido | undefined;
  idioma: Idioma;
  elegir: (r: ReemplazoElegido) => void;
}) {
  const { api } = useSesion();
  const tt = textosTiendas(idioma);
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<ProductoTienda[]>([]);
  const [abierto, setAbierto] = useState(!elegido);
  // Con menos de dos letras (o cerrado) no se busca; la lista vieja no se muestra.
  const buscar = abierto && q.trim().length >= 2;
  useEffect(() => {
    if (!buscar) return;
    let vivo = true;
    const t = setTimeout(() => {
      api
        .pedir<{ productos: ProductoTienda[] }>(
          'GET',
          `/datos/tiendas/${tiendaId}/productos?${new URLSearchParams({ q: q.trim(), pagina: '1' }).toString()}`,
        )
        .then((r) => vivo && setLista(r.productos.filter((p) => p.id !== platoId).slice(0, 5)))
        .catch(() => vivo && setLista([]));
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [api, buscar, q, tiendaId, platoId]);

  const nombre = (r: { nombreEs: string; nombreEn: string }) =>
    idioma === 'en' ? r.nombreEn || r.nombreEs : r.nombreEs || r.nombreEn;
  return (
    <View style={{ marginTop: 8, gap: 6 }} testID={`reemplazo-${platoId}`}>
      {elegido && !abierto ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Text style={{ color: '#101010', fontSize: 13 }}>
            {tt.reemplazoElegido.replace('{nombre}', nombre(elegido))}
          </Text>
          <Pressable onPress={() => setAbierto(true)} accessibilityRole="button">
            <Text style={{ color: '#101010', fontSize: 13, fontWeight: '700' }}>
              {tt.cambiarReemplazo}
            </Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={tt.buscarReemplazo}
            accessibilityLabel={tt.buscarReemplazo}
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: '#D6D6D6',
              borderRadius: 10,
              paddingHorizontal: 10,
              paddingVertical: 8,
              fontSize: 14,
            }}
          />
          {(buscar ? lista : []).map((p) => (
            <Pressable
              key={p.id}
              onPress={() => {
                elegir({ platoId: p.id, nombreEs: p.nombreEs, nombreEn: p.nombreEn });
                setAbierto(false);
                setQ('');
              }}
              accessibilityRole="button"
              accessibilityLabel={`${tt.elegirEste} ${nombre(p)}`}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: '#EEEEEE',
              }}
            >
              <Text style={{ fontSize: 14, color: '#101010', flex: 1 }}>{nombre(p)}</Text>
              <Text style={{ fontSize: 13, color: '#5E5E5E' }}>
                {formatearMonto(p.precioEstimado ?? p.precio, 'USD', idioma)}
              </Text>
            </Pressable>
          ))}
          <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{tt.reemplazoTecho}</Text>
        </>
      )}
    </View>
  );
}
