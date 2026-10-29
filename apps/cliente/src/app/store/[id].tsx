import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Image, Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { type Plato, formatearMonto } from '@tumbite/compartido';
import { C, useSesion } from '@tumbite/movil';
import { useCarrito } from '../../carrito';
import {
  ANCHO_MAX,
  BotonAncho,
  BotonRedondo,
  Estado,
  Flecha,
  Pildora,
  sombra,
} from '../../comida/piezas';
import { textosComida } from '../../comida/textos';
import { IMG } from '../../inicio/recursos';
import { textosTiendas } from '../../tiendas/textos';
import {
  type FichaTienda,
  type ProductoTienda,
  detalleProducto,
  fotoProducto,
} from '../../tiendas/tipos';

function confirmar(mensaje: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(mensaje));
  return new Promise((r) =>
    Alert.alert('', mensaje, [
      { text: no, style: 'cancel', onPress: () => r(false) },
      { text: si, onPress: () => r(true) },
    ]),
  );
}

/**
 * C-TIENDAS-VITRINA · una tienda por dentro, como en DoorDash: nombre y estado, buscador de la
 * tienda, pasillos en píldoras y los productos en cuadrícula con foto, precio (y el de antes si está
 * rebajado) y el botón «+». Se cargan de 50 en 50: una tienda puede tener miles.
 */
export default function Tienda() {
  const { id, q: qInicial } = useLocalSearchParams<{ id: string; q?: string }>();
  const { api, idioma } = useSesion();
  const t = textosTiendas(idioma);
  const tc = textosComida(idioma);
  const { agregar, vaciar, cantidadTotal, carrito } = useCarrito();
  const [ficha, setFicha] = useState<FichaTienda | null>(null);
  const [pasillos, setPasillos] = useState<{ nombre: string; n: number }[]>([]);
  const [pasillo, setPasillo] = useState<string | null>(null);
  const [q, setQ] = useState(qInicial ?? '');
  const [productos, setProductos] = useState<ProductoTienda[] | null>(null);
  const [pagina, setPagina] = useState(1);
  const [hayMas, setHayMas] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ tienda: FichaTienda; pasillos: { nombre: string; n: number }[] }>(
        'GET',
        `/datos/tiendas/${id}`,
      )
      .then((r) => {
        if (!vivo) return;
        setFicha(r.tienda);
        setPasillos(r.pasillos);
      })
      .catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : t.error));
    return () => {
      vivo = false;
    };
  }, [api, id, t.error]);

  const cargar = useCallback(
    (p: number, vivo: () => boolean) => {
      const params = new URLSearchParams({ pagina: String(p) });
      if (q.trim().length >= 2) params.set('q', q.trim());
      if (pasillo) params.set('categoria', pasillo);
      return api
        .pedir<{ productos: ProductoTienda[]; hayMas: boolean }>(
          'GET',
          `/datos/tiendas/${id}/productos?${params.toString()}`,
        )
        .then((r) => {
          if (!vivo()) return;
          setProductos((antes) => (p === 1 ? r.productos : [...(antes ?? []), ...r.productos]));
          setHayMas(r.hayMas);
          setPagina(p);
        })
        .catch(() => vivo() && setProductos((antes) => antes ?? []));
    },
    [api, id, q, pasillo],
  );
  useEffect(() => {
    let vivo = true;
    const espera = setTimeout(() => void cargar(1, () => vivo), q ? 300 : 0);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [cargar, q]);

  const enCarrito = (pid: string) =>
    carrito.restauranteId === id
      ? carrito.lineas.filter((l) => l.platoId === pid).reduce((s, l) => s + l.cantidad, 0)
      : 0;

  async function alMas(p: ProductoTienda) {
    if (!ficha) return;
    const rest = {
      id: ficha.id,
      nombre: ficha.nombre,
      plan: ficha.plan,
      lat: ficha.lat,
      lng: ficha.lng,
      moneda: ficha.moneda,
      esTienda: true,
    };
    const plato = {
      id: p.id,
      nombreEs: p.nombreEs,
      nombreEn: p.nombreEn,
      precioCentavos: p.precioEstimado,
      imagen: p.imagen,
      pesable: p.vendidoPor === 'weight',
      requiereEdad: p.restriccion === 'alcohol' || p.restriccion === 'tobacco',
    } as Plato & { pesable: boolean };
    if (agregar(rest, plato) === 'otro-restaurante') {
      if (!(await confirmar(t.otraTienda, t.vaciarYAgregar, tc.volver))) return;
      vaciar();
      setTimeout(() => agregar(rest, plato), 0);
    }
  }

  const moneda = ficha?.moneda ?? 'USD';
  const cabecera = (
    <View>
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
            placeholder={t.buscarEnTienda}
            accessibilityLabel={t.buscarEnTienda}
            placeholderTextColor="#8A8A8A"
            style={{ flex: 1, paddingVertical: 11, fontSize: 15, color: C.secundario }}
          />
        </View>
      </View>
      {ficha ? (
        <View style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 26, fontWeight: '900', color: C.secundario, flex: 1 }}
            >
              {ficha.nombre}
            </Text>
            <Estado abierto={ficha.abierto} texto={ficha.abierto ? t.abierta : t.cerrada} />
          </View>
          <Text style={{ color: '#5E5E5E', fontSize: 14, marginTop: 2 }}>{ficha.direccion}</Text>
        </View>
      ) : error ? (
        <Text style={{ color: C.secundario, marginTop: 20 }}>{error}</Text>
      ) : null}
      <FlatList
        horizontal
        data={[null, ...pasillos.map((p) => p.nombre)]}
        keyExtractor={(c) => c ?? '_todo'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 14 }}
        renderItem={({ item }) => (
          <Pildora
            texto={item ?? t.todo}
            activa={pasillo === item}
            alTocar={() => setPasillo(item)}
            rol="tab"
          />
        )}
      />
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      <FlatList
        data={productos ?? []}
        keyExtractor={(p) => p.id}
        numColumns={2}
        ListHeaderComponent={cabecera}
        ListEmptyComponent={
          productos ? (
            <Text style={{ color: '#5E5E5E', textAlign: 'center', marginTop: 24 }}>
              {t.sinResultados}
            </Text>
          ) : null
        }
        ListFooterComponent={
          hayMas ? (
            <View style={{ marginTop: 12 }}>
              <BotonAncho texto={t.cargarMas} alTocar={() => void cargar(pagina + 1, () => true)} />
            </View>
          ) : null
        }
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: cantidadTotal ? 96 : 32,
          gap: 10,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
        renderItem={({ item: p }) => {
          const foto = fotoProducto(p.imagen);
          const n = enCarrito(p.id);
          return (
            <View
              // Siempre media fila: un producto solo no se estira a todo el ancho.
              style={[
                {
                  flex: 1,
                  maxWidth: '49%',
                  backgroundColor: '#fff',
                  borderRadius: 16,
                  padding: 10,
                },
                sombra,
              ]}
            >
              <View
                style={{
                  height: 110,
                  borderRadius: 12,
                  backgroundColor: '#F2F3F5',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {foto ? (
                  <Image
                    source={{ uri: foto }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                ) : null}
                <View style={{ position: 'absolute', right: 6, bottom: 6 }}>
                  <BotonRedondo
                    texto="+"
                    alTocar={() => void alMas(p)}
                    desactivado={!ficha?.abierto}
                    etiqueta={`${t.agregar} ${p.nombre}`}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                <Text style={{ fontWeight: '900', fontSize: 16, color: C.secundario }}>
                  {formatearMonto(p.precio, moneda, idioma)}
                  {p.vendidoPor === 'weight' && p.unidadPeso ? `/${p.unidadPeso}` : ''}
                </Text>
                {p.precioAntes ? (
                  <Text
                    accessibilityLabel={`${t.antes} ${formatearMonto(p.precioAntes, moneda, idioma)}`}
                    style={{ color: '#8A8A8A', fontSize: 13, textDecorationLine: 'line-through' }}
                  >
                    {formatearMonto(p.precioAntes, moneda, idioma)}
                  </Text>
                ) : null}
              </View>
              <Text
                style={{ color: C.secundario, fontWeight: '700', marginTop: 2 }}
                numberOfLines={2}
              >
                {p.nombre}
              </Text>
              {detalleProducto(p, idioma) ? (
                <Text style={{ color: '#5E5E5E', fontSize: 12 }} numberOfLines={1}>
                  {detalleProducto(p, idioma)}
                </Text>
              ) : null}
              {p.restriccion === 'alcohol' || p.restriccion === 'tobacco' ? (
                <Text style={{ color: '#5E5E5E', fontSize: 11, marginTop: 2 }}>{t.edad}</Text>
              ) : null}
              {n > 0 ? (
                // Ya en el carrito = salió bien: verde (C-VERDE-EXITO).
                <Text style={{ color: C.exito, fontWeight: '800', fontSize: 12, marginTop: 4 }}>
                  {t.agregado} · {n}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
      {cantidadTotal && carrito.restauranteId === id ? (
        <View
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 20,
            maxWidth: ANCHO_MAX,
            alignSelf: 'center',
          }}
        >
          <BotonAncho
            texto={`${t.verCarrito} · ${cantidadTotal}`}
            alTocar={() => router.push('/cart')}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
