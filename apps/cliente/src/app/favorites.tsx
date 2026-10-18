import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { type Restaurante, enIdioma } from '@tumbite/compartido';
import { C, urlFoto, useSesion } from '@tumbite/movil';
import { useRestaurantes } from '../comida/useRestaurantes';
import { ANCHO_MAX, Encabezado, sombra } from '../comida/piezas';
import { BarraInferior, type Pestana } from '../inicio/BarraInferior';
import { IMG, fotoDeRelleno } from '../inicio/recursos';

const T = {
  es: {
    titulo: 'Favoritos',
    volver: 'Volver',
    vacio: 'Todavía no tienes favoritos. Toca el corazón de un restaurante para guardarlo aquí.',
    quitar: 'Quitar de favoritos',
    abierto: 'Abierto',
    cerrado: 'Cerrado ahora',
  },
  en: {
    titulo: 'Favorites',
    volver: 'Back',
    vacio: 'No favorites yet. Tap a restaurant’s heart to save it here.',
    quitar: 'Remove from favorites',
    abierto: 'Open',
    cerrado: 'Closed now',
  },
};

/** Pestaña Favoritos (auditoría final, punto 13): los restaurantes guardados con el corazón. */
export default function Favoritos() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const catalogo = useRestaurantes(api, null);
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ ids: string[] }>('GET', '/datos/favoritos')
      .then((r) => {
        if (vivo) setIds(r.ids);
      })
      .catch(() => {
        if (vivo) setIds([]);
      });
    return () => {
      vivo = false;
    };
  }, [api]);
  const lista = useMemo(() => {
    if (!ids) return null;
    const porId = new Map(catalogo.restaurantes.map((r) => [r.id, r]));
    return ids.map((id) => porId.get(id)).filter((r): r is Restaurante => Boolean(r));
  }, [ids, catalogo.restaurantes]);

  async function quitar(id: string) {
    setIds((x) => (x ?? []).filter((y) => y !== id));
    await api.pedir('DELETE', `/datos/favoritos/${id}`).catch(() => undefined);
  }
  const pestana = (p: Pestana) => {
    if (p === 'inicio') return router.replace('/');
    if (p === 'pedidos') return router.push('/orders');
    if (p === 'cuenta') return router.push('/account');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      <Encabezado
        titulo={t.titulo}
        alVolver={() => router.replace('/')}
        etiquetaVolver={t.volver}
      />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
      >
        {lista && !lista.length ? <Text style={{ color: '#5E5E5E' }}>{t.vacio}</Text> : null}
        {lista?.map((r, index) => (
          <Pressable
            key={r.id}
            onPress={() => router.push(`/restaurant/${r.id}`)}
            accessibilityRole="button"
            accessibilityLabel={r.nombre}
            style={[
              {
                flexDirection: 'row',
                backgroundColor: '#fff',
                borderRadius: 18,
                padding: 10,
                gap: 12,
                marginBottom: 12,
              },
              sombra,
            ]}
          >
            <Image
              source={
                urlFoto(r.imagen)
                  ? { uri: urlFoto(r.imagen) ?? undefined }
                  : fotoDeRelleno(r.categoria, index)
              }
              style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: '#f1f1f1' }}
              accessibilityIgnoresInvertColors
            />
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text
                style={{ fontWeight: '800', fontSize: 17, color: C.secundario }}
                numberOfLines={1}
              >
                {r.nombre}
              </Text>
              <Text style={{ color: '#5E5E5E', marginTop: 2 }}>
                {r.categoria ? `${r.categoria} · ` : ''}
                <Text
                  style={
                    (r.abiertoAhora ?? r.abierto) ? { color: C.exito, fontWeight: '700' } : null
                  }
                >
                  {(r.abiertoAhora ?? r.abierto) ? t.abierto : t.cerrado}
                </Text>
              </Text>
            </View>
            <Pressable
              onPress={() => void quitar(r.id)}
              accessibilityRole="button"
              accessibilityLabel={`${t.quitar}: ${r.nombre}`}
              hitSlop={8}
              style={{ justifyContent: 'center' }}
            >
              <Image
                source={IMG.iconoCorazon}
                style={{ width: 22, height: 22 }}
                tintColor={C.primario}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
      <BarraInferior idioma={idioma} activa="favoritos" alTocar={pestana} />
    </SafeAreaView>
  );
}
