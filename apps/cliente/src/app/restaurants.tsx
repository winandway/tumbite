import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ErrorApi, type Restaurante, proximaApertura, textoApertura } from '@tumbite/compartido';
import { C, e, urlFoto, useSesion } from '@tumbite/movil';
import { distanciaTexto } from '../textos';
import { miUbicacion } from '../ubicacion';
import { BarraInferior, type Pestana } from '../inicio/BarraInferior';
import { ModalMuyPronto } from '../inicio/ModalMuyPronto';
import { IMG, fotoDeRelleno } from '../inicio/recursos';
import { ANCHO_MAX, Estado, Flecha, Pildora, sombra } from '../comida/piezas';
import { textosComida } from '../comida/textos';

/**
 * Restaurantes de Comida (diseño aprobado, pantalla 2): buscador, botones de categoría sacados
 * de los restaurantes reales y tarjetas con foto, tipo de comida, distancia, tiempo y si está
 * abierto. El corazón abre «Muy pronto» porque los favoritos todavía no existen.
 */
export default function Restaurantes() {
  const { api, idioma } = useSesion();
  const t = textosComida(idioma);
  const [lista, setLista] = useState<Restaurante[] | null>(null);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  const cargar = useCallback(
    async (p: { lat: number; lng: number } | null) => {
      try {
        const q = p ? `?lat=${p.lat}&lng=${p.lng}` : '';
        const r = await api.pedir<{ restaurantes: Restaurante[] }>(
          'GET',
          `/datos/restaurantes${q}`,
        );
        setError('');
        setLista(r.restaurantes);
      } catch (x) {
        setError(x instanceof ErrorApi ? x.message : String(x));
      }
    },
    [api],
  );
  useEffect(() => {
    void (async () => {
      const primera = cargar(null);
      const p = await miUbicacion();
      await primera;
      if (p) await cargar(p);
    })();
  }, [cargar]);

  const categorias = useMemo(
    () => [...new Set((lista ?? []).map((r) => r.categoria).filter(Boolean))],
    [lista],
  );
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (lista ?? []).filter(
      (r) =>
        (!q || `${r.nombre} ${r.categoria}`.toLowerCase().includes(q)) &&
        (!categoria || r.categoria === categoria),
    );
  }, [lista, busqueda, categoria]);

  const abierto = (r: Restaurante) => r.abiertoAhora ?? r.abierto;
  const pestana = (p: Pestana) => {
    if (p === 'inicio') return router.replace('/');
    if (p === 'favoritos') return setPronto(true);
    router.push('/account');
  };

  const cabecera = (
    <View style={{ paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Flecha
          alTocar={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          etiqueta={t.volver}
        />
        <View
          style={[
            {
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#fff',
              borderRadius: 999,
              paddingHorizontal: 14,
              gap: 8,
            },
            sombra,
          ]}
        >
          <Image
            source={IMG.iconoLupa}
            style={{ width: 18, height: 18 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder={t.buscar}
            accessibilityLabel={t.buscar}
            placeholderTextColor="#8A8A8A"
            style={{ flex: 1, paddingVertical: 11, fontSize: 15, color: C.secundario }}
          />
        </View>
      </View>
      <FlatList
        horizontal
        data={[null, ...categorias]}
        keyExtractor={(c) => c ?? '_todos'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 14 }}
        renderItem={({ item }) => (
          <Pildora
            texto={item ?? t.todos}
            activa={categoria === item}
            alTocar={() => setCategoria(item)}
          />
        )}
      />
      {error ? <Text style={e.error}>{error}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      <FlatList
        data={filtrados}
        keyExtractor={(r) => r.id}
        ListHeaderComponent={cabecera}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 24,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          lista ? (
            <Text style={{ color: '#5E5E5E', marginTop: 12 }}>
              {busqueda || categoria ? t.sinResultados : t.sinRestaurantes}
            </Text>
          ) : null
        }
        renderItem={({ item: r, index }) => (
          <Pressable
            onPress={() => router.push(`/restaurant/${r.id}`)}
            accessibilityRole="button"
            accessibilityLabel={r.nombre}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                backgroundColor: '#fff',
                borderRadius: 18,
                padding: 10,
                gap: 12,
                marginBottom: 12,
                opacity: pressed ? 0.85 : abierto(r) ? 1 : 0.65,
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
              style={{ width: 96, height: 96, borderRadius: 14, backgroundColor: '#f1f1f1' }}
              accessibilityIgnoresInvertColors
            />
            <View style={{ flex: 1, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                <Text
                  style={{ flex: 1, fontWeight: '800', fontSize: 17, color: C.secundario }}
                  numberOfLines={1}
                >
                  {r.nombre}
                </Text>
                <Pressable
                  onPress={() => setPronto(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.favorito}: ${r.nombre}`}
                  hitSlop={8}
                >
                  <Image
                    source={IMG.iconoCorazon}
                    style={{ width: 20, height: 20 }}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                </Pressable>
              </View>
              <Text style={{ color: '#5E5E5E', fontSize: 13 }} numberOfLines={1}>
                {r.categoria}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
                  {r.distanciaKm != null ? `${distanciaTexto(r.distanciaKm, idioma)} · ` : ''}
                  {r.tiempoPrepMin + 10}–{r.tiempoPrepMin + 20} min
                </Text>
                <Estado
                  abierto={abierto(r)}
                  texto={
                    abierto(r)
                      ? t.abierto
                      : r.abierto && r.horarios?.length
                        ? textoApertura(
                            proximaApertura(r.horarios, r.zonaHoraria ?? 'America/New_York'),
                            idioma,
                          )
                        : t.cerrado
                  }
                />
              </View>
            </View>
          </Pressable>
        )}
      />
      <BarraInferior idioma={idioma} activa="inicio" alTocar={pestana} />
      <ModalMuyPronto visible={pronto} cerrar={() => setPronto(false)} idioma={idioma} />
    </SafeAreaView>
  );
}
