import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import type { Idioma, Restaurante } from '@tumbite/compartido';
import { C, urlFoto } from '@tumbite/movil';
import { fotoDeRelleno } from './recursos';
import { textosInicio } from './textos';

/**
 * POR-1 (2 nov 2026): categorías en círculos que se deslizan, como la fila de cocinas de DoorDash
 * y Uber Eats. Salen SOLO de las categorías reales de los restaurantes de la zona (si hay pocas,
 * las que haya); cada círculo lleva la foto de un restaurante de esa categoría. Al tocarla se abre
 * la lista de Comida ya filtrada.
 */
export function Categorias({
  idioma,
  lista,
  alTocar,
}: {
  idioma: Idioma;
  lista: Restaurante[];
  alTocar: (categoria: string) => void;
}) {
  const t = textosInicio(idioma);
  const vistas = new Map<string, Restaurante>();
  for (const r of lista) {
    const c = r.categoria.trim();
    if (c && !vistas.has(c)) vistas.set(c, r);
  }
  const categorias = [...vistas.entries()];
  if (!categorias.length) return null;
  return (
    <View style={{ marginTop: 18 }} testID="categorias-inicio">
      <Text style={{ fontSize: 20, fontWeight: '700', color: C.secundario, marginHorizontal: 16 }}>
        {t.categorias}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 16 }}
      >
        {categorias.map(([c, r], i) => (
          <Pressable
            key={c}
            onPress={() => alTocar(c)}
            accessibilityRole="button"
            accessibilityLabel={`${t.categorias}: ${c}`}
            style={({ pressed }) => ({
              width: 68,
              alignItems: 'center',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Image
              source={
                urlFoto(r.imagen) ? { uri: urlFoto(r.imagen) ?? undefined } : fotoDeRelleno(c, i)
              }
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: '#F2F3F5',
                borderWidth: 1,
                borderColor: '#E3E5E8',
              }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <Text
              numberOfLines={1}
              style={{ marginTop: 6, fontSize: 13, fontWeight: '600', color: C.secundario }}
            >
              {c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
