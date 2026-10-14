import { Image, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { type Idioma, formatearDolares } from '@tumbite/compartido';
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
export function Ofertas({
  idioma,
  alTocarEjemplo,
}: {
  idioma: Idioma;
  alTocarEjemplo: () => void;
}) {
  const t = textosInicio(idioma);
  // Anchos en números: en la web, el ancho en porcentaje no sirve para calcular la foto.
  const anchoCombo = Math.round((useWindowDimensions().width - 32 - 10) * 0.46);
  const tarjeta = {
    backgroundColor: '#fff',
    borderRadius: 18,
    shadowColor: '#191919',
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
                  {formatearDolares(o.precio, idioma)}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    style={{ color: '#8A8A8A', textDecorationLine: 'line-through', fontSize: 12 }}
                  >
                    {formatearDolares(o.antes, idioma)}
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
