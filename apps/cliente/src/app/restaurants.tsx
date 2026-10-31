import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { type Restaurante, filtrarRestaurantes, textoNoDisponible } from '@tumbite/compartido';
import { C, urlFoto, useSesion } from '@tumbite/movil';
import { distanciaTexto } from '../textos';
import { useRestaurantes } from '../comida/useRestaurantes';
import { EstadoCatalogo } from '../comida/EstadoCatalogo';
import { BarraInferior, type Pestana } from '../inicio/BarraInferior';
import { IMG, fotoDeRelleno } from '../inicio/recursos';
import { ANCHO_MAX, Estado, Flecha, Pildora, sombra } from '../comida/piezas';
import { textosComida } from '../comida/textos';
import { MapaLocales } from '../comida/MapaLocales';
import { useCarrito } from '../carrito';
import { Calificacion } from '../comida/Calificacion';

/**
 * Restaurantes de Comida (diseño aprobado, pantalla 2, mejorada el 18 oct 2026 «como los grandes»):
 * título grande con cuántos están abiertos, buscador, categorías reales, filtros rápidos (solo
 * abiertos, más cerca, más rápido) y tarjetas con foto, tipo de comida, distancia, tiempo y estado. El corazón guarda el restaurante en Favoritos.
 */
export default function Restaurantes() {
  const { api, idioma } = useSesion();
  const t = textosComida(idioma);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<string | null>(null);
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [orden, setOrden] = useState<'cerca' | 'rapido' | null>(null);
  // C-RECOGER-MAPA: «Entrega | Recoger» arriba, como Uber Eats; en Recoger, mapa y lo más cerca primero.
  const { marcarRecoger } = useCarrito();
  const [recoger, setRecoger] = useState(false);
  const abrirLocal = useCallback(
    (id: string) => {
      marcarRecoger(recoger);
      router.push(`/restaurant/${id}`);
    },
    [marcarRecoger, recoger],
  );
  // Favoritos reales (auditoría final, punto 13): los ids vienen del servidor; el corazón los alterna.
  const [favoritos, setFavoritos] = useState<Set<string>>(new Set());
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ ids: string[] }>('GET', '/datos/favoritos')
      .then((r) => {
        if (vivo) setFavoritos(new Set(r.ids));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);
  async function alternarFavorito(id: string) {
    const era = favoritos.has(id);
    setFavoritos((f) => {
      const n = new Set(f);
      if (era) n.delete(id);
      else n.add(id);
      return n;
    });
    try {
      await api.pedir(era ? 'DELETE' : 'PUT', `/datos/favoritos/${id}`);
    } catch {
      setFavoritos((f) => {
        const n = new Set(f);
        if (era) n.add(id);
        else n.delete(id);
        return n;
      });
    }
  }

  // C-CATALOGO-ESTABLE: la misma lista que el inicio (comida/useRestaurantes): no se vuelve a
  // pedir al entrar desde el inicio y una respuesta vieja nunca borra la nueva.
  const catalogo = useRestaurantes(api, null);
  const lista =
    catalogo.estado === 'cargando' && !catalogo.restaurantes.length ? null : catalogo.restaurantes;

  const categorias = useMemo(
    () => [...new Set((lista ?? []).map((r) => r.categoria).filter(Boolean))],
    [lista],
  );
  // Filtros rápidos como los de los grandes (lógica compartida y probada: filtrarRestaurantes).
  const filtrados = useMemo(
    () =>
      filtrarRestaurantes(lista ?? [], {
        busqueda,
        categoria,
        soloAbiertos,
        orden: recoger ? (orden ?? 'cerca') : orden,
      }),
    [lista, busqueda, categoria, soloAbiertos, orden, recoger],
  );
  const locales = useMemo(
    () =>
      filtrados
        .filter((r) => r.lat != null && r.lng != null && (r.abiertoAhora ?? r.abierto))
        .map((r) => ({
          id: r.id,
          nombre: r.nombre,
          lat: r.lat!,
          lng: r.lng!,
          detalle: t.listoEn.replace('{n}', String(r.tiempoPrepMin)),
        })),
    [filtrados, t.listoEn],
  );
  const abiertos = useMemo(
    () => (lista ?? []).filter((r) => r.abiertoAhora ?? r.abierto).length,
    [lista],
  );

  const abierto = (r: Restaurante) => r.abiertoAhora ?? r.abierto;
  const pestana = (p: Pestana) => {
    if (p === 'inicio') return router.replace('/');
    if (p === 'favoritos') return router.push('/favorites');
    if (p === 'pedidos') return router.push('/orders');
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
      <View style={{ marginTop: 14 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 28, fontWeight: '900', color: C.secundario }}
        >
          {t.restaurantes}
        </Text>
        <Text style={{ color: '#5E5E5E', fontSize: 14, marginTop: 2 }}>
          {t.cercaDeTi}
          {lista ? ` · ${t.abiertosAhora.replace('{n}', String(abiertos))}` : ''}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }} accessibilityRole="radiogroup">
        <Pildora
          texto={t.entrega}
          activa={!recoger}
          alTocar={() => setRecoger(false)}
          rol="radio"
        />
        <Pildora texto={t.recoger} activa={recoger} alTocar={() => setRecoger(true)} rol="radio" />
      </View>
      {recoger ? (
        <>
          <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: 8 }}>{t.recogerAyuda}</Text>
          <View style={{ marginTop: 10 }}>
            <MapaLocales locales={locales} alElegir={abrirLocal} />
          </View>
        </>
      ) : null}
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
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
        <Pildora
          texto={t.soloAbiertos}
          activa={soloAbiertos}
          alTocar={() => setSoloAbiertos((v) => !v)}
          rol="radio"
        />
        <Pildora
          texto={t.masCerca}
          activa={orden === 'cerca'}
          alTocar={() => setOrden((o) => (o === 'cerca' ? null : 'cerca'))}
          rol="radio"
        />
        <Pildora
          texto={t.masRapido}
          activa={orden === 'rapido'}
          alTocar={() => setOrden((o) => (o === 'rapido' ? null : 'rapido'))}
          rol="radio"
        />
      </View>
      <EstadoCatalogo idioma={idioma} catalogo={catalogo} />
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
          lista && lista.length && (busqueda || categoria || soloAbiertos) ? (
            <Text style={{ color: '#5E5E5E', marginTop: 12 }}>{t.sinResultados}</Text>
          ) : null
        }
        renderItem={({ item: r, index }) => (
          <Pressable
            onPress={() => abrirLocal(r.id)}
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
                  onPress={() => void alternarFavorito(r.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${favoritos.has(r.id) ? t.quitarFavorito : t.favorito}: ${r.nombre}`}
                  accessibilityState={{ selected: favoritos.has(r.id) }}
                  hitSlop={8}
                >
                  <Image
                    source={IMG.iconoCorazon}
                    style={{ width: 20, height: 20, opacity: favoritos.has(r.id) ? 1 : 0.35 }}
                    tintColor={favoritos.has(r.id) ? C.primario : undefined}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Calificacion c={r.calificacion} idioma={idioma} />
                <Text style={{ color: '#5E5E5E', fontSize: 13, flexShrink: 1 }} numberOfLines={1}>
                  · {r.categoria}
                </Text>
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  // El estado («No recibe pedidos ahora», «Abre mañana…») baja de línea en vez de cortarse.
                  flexWrap: 'wrap',
                  rowGap: 4,
                }}
              >
                <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
                  {r.distanciaKm != null ? `${distanciaTexto(r.distanciaKm, idioma)} · ` : ''}
                  {recoger
                    ? t.listoEn.replace('{n}', String(r.tiempoPrepMin))
                    : `${r.tiempoPrepMin + 10}–${r.tiempoPrepMin + 20} min`}
                </Text>
                <Estado
                  abierto={abierto(r)}
                  texto={abierto(r) ? t.abierto : (textoNoDisponible(r, idioma) ?? t.cerrado)}
                />
              </View>
            </View>
          </Pressable>
        )}
      />
      <BarraInferior idioma={idioma} activa="inicio" alTocar={pestana} />
    </SafeAreaView>
  );
}
