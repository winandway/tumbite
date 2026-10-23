import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { type Idioma, formatearMonto } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { IMG } from './recursos';
import { textosInicio } from './textos';

const Etiqueta = ({ texto }: { texto: string }) => (
  <View
    style={{
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'rgba(25,25,25,0.75)',
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 2,
    }}
  >
    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{texto}</Text>
  </View>
);

/**
 * Ofertas del día. Mientras los restaurantes no carguen promociones reales, se muestran las de
 * muestra del diseño (marcadas «Ejemplo»); tocarlas abre «Muy pronto». Nunca se cobran.
 */
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

export function Ofertas({
  idioma,
  alTocarEjemplo,
  reales,
  alTocarReal,
}: {
  idioma: Idioma;
  alTocarEjemplo: () => void;
  /** Cupones destacados de verdad (del superadmin). Si hay, se muestran ellos y no los de muestra. */
  reales?: PromoReal[];
  alTocarReal?: (codigo: string) => void;
}) {
  const t = textosInicio(idioma);
  // Anchos en números: en la web, el ancho en porcentaje no sirve para calcular la foto.
  const anchoCombo = Math.round((useWindowDimensions().width - 32 - 10) * 0.46);
  if (reales?.length) {
    const texto = (p: PromoReal) =>
      p.tipo === 'envio_gratis'
        ? idioma === 'en'
          ? 'Free delivery'
          : 'Envío gratis'
        : p.tipo === 'porcentaje'
          ? `−${p.valor / 100}%`
          : `−${formatearMonto(p.valor, p.moneda ?? 'USD', idioma)}`;
    return (
      <View style={{ marginTop: 18 }} testID="promos-reales">
        <Text
          style={{ fontSize: 22, fontWeight: '900', color: C.secundario, marginHorizontal: 16 }}
        >
          {t.ofertas}
        </Text>
        <View style={{ marginHorizontal: 16, marginTop: 10, gap: 10 }}>
          {reales.map((p) => (
            <Pressable
              key={p.codigo}
              onPress={() => alTocarReal?.(p.codigo)}
              accessibilityRole="button"
              accessibilityLabel={`${p.codigo}: ${idioma === 'en' ? p.descripcionEn || p.descripcionEs : p.descripcionEs}`}
              style={{
                backgroundColor: '#fff',
                borderRadius: 18,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: '#2a2a2a',
              }}
            >
              <View
                style={{
                  backgroundColor: C.primario,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{texto(p)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: C.secundario }} numberOfLines={2}>
                  {idioma === 'en' ? p.descripcionEn || p.descripcionEs : p.descripcionEs}
                </Text>
                <Text style={{ color: '#5E5E5E', fontSize: 12, marginTop: 2 }}>
                  {idioma === 'en' ? 'Code' : 'Código'}:{' '}
                  <Text style={{ fontWeight: '900' }}>{p.codigo}</Text>
                  {p.minimoSubtotal > 0
                    ? ` · ${idioma === 'en' ? 'min.' : 'mín.'} ${formatearMonto(p.minimoSubtotal, p.moneda ?? 'USD', idioma)}`
                    : ''}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  const tarjeta = {
    backgroundColor: '#fff',
    borderRadius: 18,
    shadowColor: '#101010',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  } as const;
  return (
    <View style={{ marginTop: 18 }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginHorizontal: 16,
        }}
      >
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>{t.ofertas}</Text>
        <Pressable
          onPress={alTocarEjemplo}
          accessibilityRole="button"
          accessibilityLabel={t.verTodas}
        >
          <Text style={{ color: '#5E5E5E', fontWeight: '600' }}>{t.verTodas} ›</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', marginHorizontal: 16, marginTop: 10, gap: 10 }}>
        <View style={{ flex: 1, gap: 10 }}>
          {t.relleno.ofertas.map((o, i) => (
            <Pressable
              key={o.nombre}
              onPress={alTocarEjemplo}
              accessibilityRole="button"
              accessibilityLabel={`${t.ejemplo}: ${o.nombre}`}
              style={[tarjeta, { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 10 }]}
            >
              <View>
                <Image
                  source={IMG.relleno.ofertas.at(i)}
                  style={{ width: 78, height: 70, borderRadius: 12 }}
                  accessibilityIgnoresInvertColors
                />
                <Etiqueta texto={t.ejemplo} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: C.secundario }} numberOfLines={2}>
                  {o.nombre}
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: C.primario }}>
                  {formatearMonto(o.precio, 'USD', idioma)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{ color: '#8A8A8A', textDecorationLine: 'line-through', fontSize: 12 }}
                  >
                    {formatearMonto(o.antes, 'USD', idioma)}
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#FFE27A',
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '800', color: C.secundario }}>
                      {o.descuento}
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={alTocarEjemplo}
          accessibilityRole="button"
          accessibilityLabel={`${t.ejemplo}: ${t.relleno.combo.titulo}`}
          style={[tarjeta, { width: anchoCombo, overflow: 'hidden', justifyContent: 'center' }]}
        >
          <Image
            source={IMG.relleno.combo}
            style={{
              width: anchoCombo,
              height: Math.round((anchoCombo * 708) / 754),
              borderRadius: 18,
            }}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
          <Etiqueta texto={t.ejemplo} />
        </Pressable>
      </View>
    </View>
  );
}
