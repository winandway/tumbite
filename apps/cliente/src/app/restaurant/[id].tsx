import { useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ErrorApi,
  type Plato,
  type Restaurante,
  descripcion,
  enIdioma,
  formatearDolares,
  nombrePlato,
  categoriaPlato,
} from '@tumbite/compartido';
import { Boton, C, Pantalla, e, urlFoto, useSesion } from '@tumbite/movil';
import { useCarrito } from '../../carrito';
import { TEXTOS } from '../../textos';

function confirmar(mensaje: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(mensaje));
  return new Promise((r) =>
    Alert.alert('', mensaje, [
      { text: no, style: 'cancel', onPress: () => r(false) },
      { text: si, onPress: () => r(true) },
    ]),
  );
}

export default function MenuRestaurante() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS, idioma);
  const { agregar, vaciar, cantidadTotal, carrito } = useCarrito();
  const [datos, setDatos] = useState<{ restaurante: Restaurante; platos: Plato[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .pedir<{ restaurante: Restaurante; platos: Plato[] }>('GET', `/datos/restaurantes/${id}`)
      .then(setDatos)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api, id]);

  async function alAgregar(p: Plato) {
    if (!datos) return;
    const r = datos.restaurante;
    const rest = { id: r.id, nombre: r.nombre, plan: r.plan, lat: r.lat, lng: r.lng };
    if (
      agregar(rest, p) === 'otro-restaurante' &&
      (await confirmar(t.otroRestaurante, t.siEmpezar, t.no))
    ) {
      vaciar();
      setTimeout(() => agregar(rest, p), 0);
    }
  }

  const categorias = [...new Set(datos?.platos.map((p) => p.categoria) ?? [])];
  return (
    <Pantalla titulo={datos?.restaurante.nombre}>
      <Text style={e.enlace} onPress={() => router.back()} accessibilityRole="button">
        {t.volver}
      </Text>
      {error ? <Text style={e.error}>{error}</Text> : null}
      {urlFoto(datos?.restaurante.imagen) ? (
        <Image
          source={{ uri: urlFoto(datos?.restaurante.imagen) ?? undefined }}
          accessibilityIgnoresInvertColors
          style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 14, marginBottom: 12 }}
        />
      ) : null}
      {datos && !datos.restaurante.abierto && <Text style={[e.aviso]}>{t.cerradoAhora}</Text>}
      {categorias.map((cat) => (
        <View key={cat || 'general'}>
          {cat ? (
            <Text
              style={{ fontSize: 18, fontWeight: '800', color: C.secundario, marginVertical: 8 }}
            >
              {categoriaPlato(
                datos?.platos.find((p) => p.categoria === cat) ?? {
                  categoria: cat,
                  categoriaEn: '',
                },
                idioma,
              )}
            </Text>
          ) : null}
          {datos?.platos
            .filter((p) => p.categoria === cat)
            .map((p) => {
              const enCarrito =
                carrito.restauranteId === datos.restaurante.id
                  ? carrito.lineas.find((l) => l.platoId === p.id)?.cantidad
                  : undefined;
              return (
                <View
                  key={p.id}
                  style={[e.tarjeta, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
                >
                  {urlFoto(p.imagen) ? (
                    <Image
                      source={{ uri: urlFoto(p.imagen) ?? undefined }}
                      accessibilityIgnoresInvertColors
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: 12,
                        backgroundColor: '#f1f1f1',
                      }}
                    />
                  ) : null}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', fontSize: 16 }}>
                      {nombrePlato(p, idioma)}
                    </Text>
                    {descripcion(p, idioma) ? (
                      <Text style={{ color: '#5E5E5E' }}>{descripcion(p, idioma)}</Text>
                    ) : null}
                    <Text style={{ marginTop: 4, fontWeight: '700' }}>
                      {formatearDolares(p.precioCentavos, idioma)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => void alAgregar(p)}
                    disabled={!datos.restaurante.abierto}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.agregar} ${nombrePlato(p, idioma)}`}
                    style={{
                      backgroundColor: datos.restaurante.abierto ? C.primario : '#ccc',
                      borderRadius: 999,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>
                      {enCarrito ? `${enCarrito} ✓` : `+ ${t.agregar}`}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
        </View>
      ))}
      {cantidadTotal > 0 && (
        <Boton texto={`${t.verCarrito} (${cantidadTotal})`} alTocar={() => router.push('/cart')} />
      )}
    </Pantalla>
  );
}
