import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { type Idioma, formatearMonto } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { IMG } from './recursos';
import { textosInicio } from './textos';

/** Cupón destacado de verdad (del superadmin), tal como lo manda GET /datos/cupones/destacados. */
export type PromoReal = {
  codigo: string;
  tipo: 'monto' | 'porcentaje' | 'envio_gratis';
  valor: number;
  descripcionEs: string;
  descripcionEn: string;
  minimoSubtotal: number;
  venceEn: string | null;
  /** C-MONEDA-RECORRIDO: moneda del cupón (de su zona o de su restaurante). */
  moneda?: string;
};

/**
 * POR-1 (2 nov 2026): «Ofertas del día» como banner que se desliza, igual que el carrusel de
 * promociones de DoorDash y Uber Eats. Solo cupones reales: si no hay ninguno, no se muestra nada
 * (ya no hay ofertas de muestra en la portada).
 */
export function Ofertas({
  idioma,
  reales,
  alTocarReal,
  alCupon,
}: {
  idioma: Idioma;
  reales: PromoReal[];
  alTocarReal: (codigo: string) => void;
  alCupon: () => void;
}) {
  const t = textosInicio(idioma);
  const ancho = Math.min(useWindowDimensions().width, 640) - 32 - (reales.length > 1 ? 28 : 0);
  if (!reales.length) return null;
  const grande = (p: PromoReal) =>
    p.tipo === 'envio_gratis'
      ? t.envioGratis
      : p.tipo === 'porcentaje'
        ? `−${p.valor / 100}%`
        : `−${formatearMonto(p.valor, p.moneda ?? 'USD', idioma)}`;
  const descripcion = (p: PromoReal) =>
    idioma === 'en' ? p.descripcionEn || p.descripcionEs : p.descripcionEs;
  return (
    <View style={{ marginTop: 18 }} testID="promos-reales">
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginHorizontal: 16,
        }}
      >
        <Text style={{ fontSize: 20, fontWeight: '700', color: C.secundario }}>{t.ofertas}</Text>
        <Pressable onPress={alCupon} accessibilityRole="link" hitSlop={8}>
          <Text style={{ color: '#666B73', fontWeight: '600' }}>{t.verTodas} ›</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={ancho + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 12 }}
      >
        {reales.map((p) => (
          <Pressable
            key={p.codigo}
            onPress={() => alTocarReal(p.codigo)}
            accessibilityRole="button"
            accessibilityLabel={`${p.codigo}: ${descripcion(p)}`}
            style={({ pressed }) => ({
              width: ancho,
              height: 120,
              borderRadius: 16,
              backgroundColor: '#FFFFFF',
              borderWidth: 1,
              borderColor: '#E3E5E8',
              flexDirection: 'row',
              overflow: 'hidden',
              shadowColor: '#101010',
              shadowOpacity: 0.06,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <View style={{ flex: 1, padding: 14, justifyContent: 'center' }}>
              <Text style={{ fontSize: 24, fontWeight: '700', color: C.primario }}>
                {grande(p)}
              </Text>
              <Text
                style={{ fontWeight: '700', color: C.secundario, marginTop: 2 }}
                numberOfLines={2}
              >
                {descripcion(p)}
              </Text>
              <Text style={{ color: '#666B73', fontSize: 12, marginTop: 4 }} numberOfLines={1}>
                {idioma === 'en' ? 'Code' : 'Código'}:{' '}
                <Text style={{ fontWeight: '700', color: C.secundario }}>{p.codigo}</Text>
                {p.minimoSubtotal > 0
                  ? ` · ${idioma === 'en' ? 'min.' : 'mín.'} ${formatearMonto(p.minimoSubtotal, p.moneda ?? 'USD', idioma)}`
                  : ''}
              </Text>
            </View>
            <Image
              source={IMG.relleno.pizza}
              style={{ width: Math.round(ancho * 0.34), height: 120 }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
