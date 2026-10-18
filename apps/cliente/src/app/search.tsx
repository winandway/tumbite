import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { type Restaurante, formatearDolares } from '@tumbite/compartido';
import { C, urlFoto, useSesion } from '@tumbite/movil';
import { ANCHO_MAX, Estado, Flecha, Pildora, sombra } from '../comida/piezas';
import { textosComida } from '../comida/textos';
import { useRestaurantes } from '../comida/useRestaurantes';
import { IMG, fotoDeRelleno } from '../inicio/recursos';
import { textosInicio } from '../inicio/textos';

type Plato = {
  id: string;
  nombre: string;
  precioCentavos: number;
  imagen: string | null;
  restauranteId: string;
  restauranteNombre: string;
  abiertoAhora: boolean;
};
type Resultado = {
  zona: { id: string; nombre: string } | null;
  restaurantes: Restaurante[];
  platos: Plato[];
};
/** Espera antes de preguntar al servidor mientras la persona escribe. */
export const ESPERA_BUSQUEDA_MS = 300;

/**
 * Buscador real (como en los grandes): pantalla propia, se escribe arriba y los resultados llegan
 * mientras se escribe, en dos pestañas: Restaurantes y Platos. Todo sale del servidor
 * (GET /datos/buscar) y solo de la ciudad de la persona.
 */
export default function Buscar() {
  const { api, idioma } = useSesion();
  const t = textosInicio(idioma);
  const tc = textosComida(idioma);
  const [q, setQ] = useState('');
  const [pestana, setPestana] = useState<'restaurantes' | 'platos'>('restaurantes');
  const [res, setRes] = useState<Resultado | null>(null);
  const [buscando, setBuscando] = useState(false);
  const catalogo = useRestaurantes(api, null);
  const punto = catalogo.punto;
  const ultimo = useRef(0);

  const texto = q.trim();
  const activa = texto.length >= 2;
  useEffect(() => {
    if (!activa) return;
    const n = ++ultimo.current;
    const id = setTimeout(() => {
      setBuscando(true);
      const ubi = punto ? `&lat=${punto.lat}&lng=${punto.lng}` : '';
      void api
        .pedir<Resultado>('GET', `/datos/buscar?q=${encodeURIComponent(texto)}${ubi}`)
        .then((r) => {
          // Solo la última búsqueda manda: una respuesta vieja nunca pisa a la nueva.
          if (n !== ultimo.current) return;
          setRes(r);
          if (!r.restaurantes.length && r.platos.length) setPestana('platos');
        })
        .catch((e: unknown) => console.warn('buscar: falló', e))
        .finally(() => {
          if (n === ultimo.current) setBuscando(false);
        });
    }, ESPERA_BUSQUEDA_MS);
    return () => clearTimeout(id);
  }, [texto, activa, api, punto]);
  // Con menos de dos letras no hay búsqueda: lo que había se deja de mostrar.
  const resultado = activa ? res : null;

  const abierto = (r: Restaurante) => r.abiertoAhora ?? r.abierto;
  const cabecera = (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 }}>
        <Flecha
          alTocar={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          etiqueta={tc.volver}
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
            value={q}
            onChangeText={setQ}
            autoFocus
            placeholder={t.buscarPista}
            accessibilityLabel={t.buscarTitulo}
            placeholderTextColor="#8A8A8A"
            returnKeyType="search"
            style={{ flex: 1, paddingVertical: 11, fontSize: 15, color: C.secundario }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} accessibilityRole="button" accessibilityLabel="×">
              <Text style={{ fontSize: 18, color: '#8A8A8A' }}>×</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 14 }}>
        <Pildora
          texto={`${t.pestanaRestaurantes}${resultado ? ` (${resultado.restaurantes.length})` : ''}`}
          activa={pestana === 'restaurantes'}
          alTocar={() => setPestana('restaurantes')}
          rol="tab"
        />
        <Pildora
          texto={`${t.pestanaPlatos}${resultado ? ` (${resultado.platos.length})` : ''}`}
          activa={pestana === 'platos'}
          alTocar={() => setPestana('platos')}
          rol="tab"
        />
      </View>
      {buscando && activa ? (
        <Text style={{ color: '#5E5E5E', marginBottom: 8 }}>{t.buscando}</Text>
      ) : null}
      {texto.length > 0 && !activa ? (
        <Text style={{ color: '#5E5E5E' }}>{t.escribeMas}</Text>
      ) : null}
      {resultado && !resultado.zona ? (
        <Text style={{ color: '#5E5E5E' }}>{t.fueraCiudadBusqueda}</Text>
      ) : null}
    </View>
  );
  const vacio =
    resultado &&
    resultado.zona &&
    !buscando &&
    !(pestana === 'restaurantes' ? resultado.restaurantes : resultado.platos).length ? (
      <Text style={{ color: '#5E5E5E', marginTop: 12 }}>
        {t.sinResultadosBusqueda.replace('{q}', texto)}
      </Text>
    ) : null;

  const tarjeta = (pressed: boolean, apagado: boolean) => [
    {
      flexDirection: 'row' as const,
      backgroundColor: '#fff',
      borderRadius: 18,
      padding: 10,
      gap: 12,
      marginBottom: 12,
      opacity: pressed ? 0.85 : apagado ? 0.65 : 1,
    },
    sombra,
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      {pestana === 'restaurantes' ? (
        <FlatList
          data={resultado?.restaurantes ?? []}
          keyExtractor={(r) => r.id}
          ListHeaderComponent={cabecera}
          ListEmptyComponent={vacio}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            width: '100%',
            maxWidth: ANCHO_MAX,
            alignSelf: 'center',
          }}
          renderItem={({ item: r, index }) => (
            <Pressable
              onPress={() => router.push(`/restaurant/${r.id}`)}
              accessibilityRole="button"
              accessibilityLabel={r.nombre}
              style={({ pressed }) => tarjeta(pressed, !abierto(r))}
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
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <Text
                  style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}
                  numberOfLines={1}
                >
                  {r.nombre}
                </Text>
                <Text style={{ color: '#5E5E5E', fontSize: 13 }} numberOfLines={1}>
                  {r.categoria}
                </Text>
                <Estado abierto={abierto(r)} texto={abierto(r) ? tc.abierto : tc.cerrado} />
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={resultado?.platos ?? []}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={cabecera}
          ListEmptyComponent={vacio}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 24,
            width: '100%',
            maxWidth: ANCHO_MAX,
            alignSelf: 'center',
          }}
          renderItem={({ item: p, index }) => (
            <Pressable
              onPress={() => router.push(`/restaurant/${p.restauranteId}`)}
              accessibilityRole="button"
              accessibilityLabel={`${p.nombre} · ${p.restauranteNombre}`}
              style={({ pressed }) => tarjeta(pressed, !p.abiertoAhora)}
            >
              <Image
                source={
                  urlFoto(p.imagen)
                    ? { uri: urlFoto(p.imagen) ?? undefined }
                    : fotoDeRelleno('', index)
                }
                style={{ width: 72, height: 72, borderRadius: 14, backgroundColor: '#f1f1f1' }}
                accessibilityIgnoresInvertColors
              />
              <View style={{ flex: 1, justifyContent: 'space-between' }}>
                <Text
                  style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}
                  numberOfLines={1}
                >
                  {p.nombre}
                </Text>
                <Text style={{ color: '#5E5E5E', fontSize: 13 }} numberOfLines={1}>
                  {p.restauranteNombre}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '700', color: C.secundario }}>
                    {formatearDolares(p.precioCentavos, idioma)}
                  </Text>
                  <Estado
                    abierto={p.abiertoAhora}
                    texto={p.abiertoAhora ? tc.abierto : tc.cerrado}
                  />
                </View>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
