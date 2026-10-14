import { Image, Pressable, Text, View } from 'react-native';
import { type Idioma, formatearDolares } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { IMG } from './recursos';
import { textosInicio } from './textos';

/**
 * Aviso de pago pendiente: SOLO cuando hay un monto real, es decir, un carrito armado y sin pagar.
 * Lleva directo al carrito para terminar el pedido.
 */
export function AvisoPago({
  idioma,
  centavos,
  alPagar,
}: {
  idioma: Idioma;
  centavos: number;
  alPagar: () => void;
}) {
  const t = textosInicio(idioma);
  if (centavos <= 0) return null;
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 14,
        backgroundColor: '#FFF4D6',
        borderRadius: 18,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
      accessibilityRole="summary"
    >
      <Image
        source={IMG.iconoBilletera}
        style={{ width: 44, height: 40 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '800', color: C.secundario }}>
          {t.pendienteTitulo.replace('{monto}', formatearDolares(centavos, idioma))}
        </Text>
        <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.pendienteTexto}</Text>
      </View>
      <Pressable
        onPress={alPagar}
        accessibilityRole="button"
        accessibilityLabel={t.pagar}
        style={{
          backgroundColor: C.primario,
          borderRadius: 999,
          paddingHorizontal: 22,
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '800' }}>{t.pagar}</Text>
      </Pressable>
    </View>
  );
}
