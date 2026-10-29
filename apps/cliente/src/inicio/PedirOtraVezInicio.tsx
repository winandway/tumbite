import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { C, useSesion } from '@tumbite/movil';
import { usePedirOtraVez } from '../pedirOtraVez';

/**
 * C-PEDIR-OTRA-VEZ en el inicio (29 oct 2026), como «Order again» de DoorDash: los últimos
 * comercios donde la persona recibió un pedido, uno por comercio. Tocar repite ese pedido con el
 * precio de hoy. Sin pedidos entregados, no se muestra.
 */
type Pedido = {
  id: string;
  estado: string;
  restauranteId: string;
  restauranteNombre?: string;
  total: number;
  moneda?: string;
  lineas: { nombreEs: string; nombreEn: string; cantidad: number }[];
};

const T = {
  es: { titulo: 'Pedir otra vez', verTodos: 'Ver pedidos' },
  en: { titulo: 'Order again', verTodos: 'See orders' },
};

export function PedirOtraVezInicio({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const { api, usuario } = useSesion();
  const { pedirOtraVez } = usePedirOtraVez(idioma);
  const [lista, setLista] = useState<Pedido[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!usuario) return;
    api
      .pedir<{ pedidos: Pedido[] }>('GET', '/datos/mis-pedidos')
      .then((r) => {
        const vistos = new Set<string>();
        setLista(
          r.pedidos
            .filter((p) => p.estado === 'entregado')
            .filter((p) => !vistos.has(p.restauranteId) && Boolean(vistos.add(p.restauranteId)))
            .slice(0, 6),
        );
      })
      .catch(() => setLista([]));
  }, [api, usuario]);
  if (!lista.length) return null;
  return (
    <View style={{ marginTop: 18 }} testID="pedir-otra-vez">
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginHorizontal: 16,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>{t.titulo}</Text>
        <Pressable onPress={() => router.push('/orders')} accessibilityRole="button">
          <Text style={{ color: '#5E5E5E', fontWeight: '600' }}>{t.verTodos} ›</Text>
        </Pressable>
      </View>
      {error ? <Text style={{ color: C.primario, marginHorizontal: 16 }}>{error}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingTop: 10 }}
      >
        {lista.map((p) => {
          const resumen = p.lineas
            .map(
              (l) => `${l.cantidad} × ${idioma === 'en' ? l.nombreEn || l.nombreEs : l.nombreEs}`,
            )
            .join(', ');
          return (
            <Pressable
              key={p.id}
              onPress={() =>
                void pedirOtraVez(p.id).catch((x: unknown) =>
                  setError(x instanceof Error ? x.message : String(x)),
                )
              }
              accessibilityRole="button"
              accessibilityLabel={`${t.titulo}: ${p.restauranteNombre ?? ''}`}
              style={{
                width: 220,
                backgroundColor: '#fff',
                borderRadius: 18,
                padding: 14,
                borderWidth: 1,
                borderColor: '#E6E7EA',
              }}
            >
              <Text style={{ fontWeight: '900', color: C.secundario }} numberOfLines={1}>
                {p.restauranteNombre}
              </Text>
              <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                {resumen}
              </Text>
              <Text style={{ fontWeight: '800', color: C.secundario, marginTop: 8 }}>
                {formatearMonto(p.total, p.moneda ?? 'USD', idioma)} · {t.titulo} ›
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
