import { useEffect, useState } from 'react';
import { FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { formatearMonto } from '@tumbite/compartido';
import { C, useSesion } from '@tumbite/movil';
import { ANCHO_MAX, Estado, Flecha, Tarjeta, sombra } from '../comida/piezas';
import { textosComida } from '../comida/textos';
import { puntoGps, puntoGuardado } from '../comida/useRestaurantes';
import { distanciaTexto } from '../textos';
import { textosInicio } from '../inicio/textos';
import { IMG } from '../inicio/recursos';
import { textosTiendas } from '../tiendas/textos';
import {
  type ResultadoBusqueda,
  type TiendaCerca,
  detalleProducto,
  fotoProducto,
} from '../tiendas/tipos';

/**
 * C-TIENDAS-VITRINA · las tiendas cerca de ti de un servicio (Mercado, Farmacia, Licores, Más),
 * como en DoorDash: las abiertas y más cercanas primero, y un buscador que busca el producto en
 * todas las tiendas a la vez y dice dónde está.
 */
export default function Tiendas() {
  const { servicio = 'mercado' } = useLocalSearchParams<{ servicio: string }>();
  const { api, idioma } = useSesion();
  const t = textosTiendas(idioma);
  const tc = textosComida(idioma);
  const ti = textosInicio(idioma);
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null | undefined>(undefined);
  const [tiendas, setTiendas] = useState<TiendaCerca[] | null>(null);
  const [fuera, setFuera] = useState(false);
  const [error, setError] = useState(false);
  const [q, setQ] = useState('');
  const [encontrados, setResultados] = useState<ResultadoBusqueda[] | null>(null);
  // Con menos de dos letras se ve la lista de tiendas, no la última búsqueda.
  const resultados = q.trim().length >= 2 ? encontrados : null;
  const [moneda, setMoneda] = useState('USD');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      const guardado = await puntoGuardado();
      if (vivo) setPunto(guardado);
      const gps = await puntoGps();
      if (vivo && gps && !guardado) setPunto(gps);
    })();
    return () => {
      vivo = false;
    };
  }, []);
  const donde = punto ? `&lat=${punto.lat}&lng=${punto.lng}` : '';

  useEffect(() => {
    if (punto === undefined) return;
    let vivo = true;
    api
      .pedir<{ tiendas: TiendaCerca[]; fueraDeZona: boolean }>(
        'GET',
        `/datos/tiendas?servicio=${encodeURIComponent(servicio)}${donde}`,
      )
      .then((r) => {
        if (!vivo) return;
        setError(false);
        setTiendas(r.tiendas);
        setFuera(r.fueraDeZona);
      })
      .catch(() => vivo && setError(true));
    return () => {
      vivo = false;
    };
  }, [api, servicio, donde, punto, intento]);

  // Búsqueda entre tiendas con un respiro para no consultar a cada letra.
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) return;
    let vivo = true;
    const espera = setTimeout(() => {
      api
        .pedir<{ resultados: ResultadoBusqueda[]; moneda: string }>(
          'GET',
          `/datos/tiendas-buscar?servicio=${encodeURIComponent(servicio)}&q=${encodeURIComponent(texto)}${donde}`,
        )
        .then((r) => {
          if (!vivo) return;
          setResultados(r.resultados);
          setMoneda(r.moneda);
        })
        .catch(() => vivo && setResultados([]));
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [api, q, servicio, donde]);

  const nombreServicio = new Map(Object.entries(ti.servicios)).get(servicio) ?? '';
  const cabecera = (
    <View style={{ paddingTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
            placeholder={t.buscarProducto}
            accessibilityLabel={t.buscarProducto}
            placeholderTextColor="#8A8A8A"
            style={{ flex: 1, paddingVertical: 11, fontSize: 15, color: C.secundario }}
          />
        </View>
      </View>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 28, fontWeight: '900', color: C.secundario, marginTop: 14 }}
      >
        {nombreServicio}
      </Text>
      <Text style={{ color: '#5E5E5E', fontSize: 14, marginTop: 2, marginBottom: 12 }}>
        {resultados ? '' : t.tiendasCerca}
      </Text>
    </View>
  );

  const vacio = error ? (
    <Pressable onPress={() => setIntento((n) => n + 1)} accessibilityRole="button">
      <Text style={{ color: C.secundario, textAlign: 'center', marginTop: 24 }}>
        {t.error} · {t.reintentar}
      </Text>
    </Pressable>
  ) : tiendas ? (
    <Text style={{ color: '#5E5E5E', textAlign: 'center', marginTop: 24 }}>
      {fuera ? t.fueraDeZona : t.sinTiendas}
    </Text>
  ) : (
    <Text style={{ color: '#8A8A8A', textAlign: 'center', marginTop: 24 }}>…</Text>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      {resultados ? (
        <FlatList
          data={resultados}
          keyExtractor={(r) => `${r.tiendaId}:${r.id}`}
          ListHeaderComponent={cabecera}
          ListEmptyComponent={
            <Text style={{ color: '#5E5E5E', textAlign: 'center', marginTop: 24 }}>
              {t.sinResultados}
            </Text>
          }
          contentContainerStyle={{
            padding: 16,
            gap: 10,
            width: '100%',
            maxWidth: ANCHO_MAX,
            alignSelf: 'center',
          }}
          renderItem={({ item: r }) => {
            const foto = fotoProducto(r.imagen);
            return (
              <Pressable
                onPress={() =>
                  router.push({ pathname: '/store/[id]', params: { id: r.tiendaId, q: r.nombre } })
                }
                accessibilityRole="button"
                accessibilityLabel={`${r.nombre}, ${t.enTienda.replace('{tienda}', r.tienda)}`}
              >
                <Tarjeta
                  style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10 }}
                >
                  {foto ? (
                    <Image
                      source={{ uri: foto }}
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: 10,
                        backgroundColor: '#f1f1f1',
                      }}
                      accessibilityIgnoresInvertColors
                    />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: C.secundario }}>{r.nombre}</Text>
                    {detalleProducto(r, idioma) ? (
                      <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
                        {detalleProducto(r, idioma)}
                      </Text>
                    ) : null}
                    <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: 2 }}>
                      {t.enTienda.replace('{tienda}', r.tienda)}
                      {r.distanciaKm != null ? ` · ${distanciaTexto(r.distanciaKm, idioma)}` : ''}
                    </Text>
                  </View>
                  <Text style={{ fontWeight: '800', color: C.secundario }}>
                    {formatearMonto(r.precio, moneda, idioma)}
                  </Text>
                </Tarjeta>
              </Pressable>
            );
          }}
        />
      ) : (
        <FlatList
          data={tiendas ?? []}
          keyExtractor={(x) => x.id}
          ListHeaderComponent={cabecera}
          ListEmptyComponent={vacio}
          contentContainerStyle={{
            padding: 16,
            gap: 12,
            width: '100%',
            maxWidth: ANCHO_MAX,
            alignSelf: 'center',
          }}
          renderItem={({ item: s }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/store/[id]', params: { id: s.id } })}
              accessibilityRole="button"
              accessibilityLabel={s.nombre}
            >
              <Tarjeta style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ fontWeight: '900', fontSize: 17, color: C.secundario, flex: 1 }}>
                    {s.nombre}
                  </Text>
                  <Estado abierto={s.abierto} texto={s.abierto ? t.abierta : t.cerrada} />
                </View>
                <Text style={{ color: '#5E5E5E', fontSize: 14, marginTop: 4 }}>
                  {[
                    t.productos.replace('{n}', String(s.productos)),
                    s.distanciaKm != null ? distanciaTexto(s.distanciaKm, idioma) : null,
                    `${s.minutos} min`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Tarjeta>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}
