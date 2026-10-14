import { useEffect, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ErrorApi,
  type GrupoOpciones,
  type OpcionElegida,
  type Plato,
  type Restaurante,
  descripcion,
  proximaApertura,
  textoApertura,
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
  // El plato que está eligiendo opciones (tamaño, extras…) antes de ir al carrito.
  const [eligiendo, setEligiendo] = useState<Plato | null>(null);
  const [elegidas, setElegidas] = useState<Record<string, string[]>>({});
  const TO =
    idioma === 'en'
      ? {
          elegir: 'Choose',
          requerido: 'required',
          hasta: 'up to',
          agregar: 'Add to cart',
          cerrar: 'Cancel',
        }
      : {
          elegir: 'Elige',
          requerido: 'obligatorio',
          hasta: 'hasta',
          agregar: 'Agregar al carrito',
          cerrar: 'Cancelar',
        };

  useEffect(() => {
    api
      .pedir<{ restaurante: Restaurante; platos: Plato[] }>('GET', `/datos/restaurantes/${id}`)
      .then(setDatos)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api, id]);

  async function alAgregar(p: Plato, opciones: OpcionElegida[] = []) {
    if (!datos) return;
    // Con grupos de opciones, primero se eligen (tamaño, extras…).
    if (!opciones.length && (p.grupos?.length ?? 0) > 0) {
      setElegidas({});
      setEligiendo(p);
      return;
    }
    const r = datos.restaurante;
    const rest = { id: r.id, nombre: r.nombre, plan: r.plan, lat: r.lat, lng: r.lng };
    if (
      agregar(rest, p, opciones) === 'otro-restaurante' &&
      (await confirmar(t.otroRestaurante, t.siEmpezar, t.no))
    ) {
      vaciar();
      setTimeout(() => agregar(rest, p, opciones), 0);
    }
  }
  const grupoCompleto = (g: GrupoOpciones) => {
    const n = (elegidas[g.id] ?? []).length;
    return n >= g.minimo && n <= g.maximo;
  };
  function alternarOpcion(g: GrupoOpciones, id: string) {
    setElegidas((e) => {
      const actual = e[g.id] ?? [];
      if (actual.includes(id)) return { ...e, [g.id]: actual.filter((x) => x !== id) };
      if (g.maximo === 1) return { ...e, [g.id]: [id] };
      if (actual.length >= g.maximo) return e;
      return { ...e, [g.id]: [...actual, id] };
    });
  }
  function confirmarOpciones() {
    if (!eligiendo) return;
    const grupos = eligiendo.grupos ?? [];
    if (!grupos.every(grupoCompleto)) return;
    const opciones: OpcionElegida[] = grupos.flatMap((g) =>
      g.opciones
        .filter((o) => (elegidas[g.id] ?? []).includes(o.id))
        .map((o) => ({
          id: o.id,
          nombreEs: o.nombreEs,
          nombreEn: o.nombreEn,
          precioCentavos: o.precioCentavos,
        })),
    );
    const p = eligiendo;
    setEligiendo(null);
    void alAgregar(p, opciones);
  }
  const abierto = datos?.restaurante.abiertoAhora ?? datos?.restaurante.abierto ?? false;

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
      {datos && !abierto && (
        <Text style={[e.aviso]}>
          {t.cerradoAhora}
          {datos.restaurante.abierto && datos.restaurante.horarios?.length
            ? ` ${textoApertura(proximaApertura(datos.restaurante.horarios, datos.restaurante.zonaHoraria ?? 'America/New_York'), idioma)}.`
            : ''}
        </Text>
      )}
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
                    disabled={!abierto}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.agregar} ${nombrePlato(p, idioma)}`}
                    style={{
                      // Ya en el carrito = salió bien: verde (C-VERDE-EXITO). Agregar sigue en el color de la marca.
                      backgroundColor: !abierto ? '#ccc' : enCarrito ? C.exito : C.primario,
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
      <Modal visible={!!eligiendo} animationType="slide" onRequestClose={() => setEligiendo(null)}>
        <ScrollView
          style={{ flex: 1, backgroundColor: '#fff' }}
          contentContainerStyle={{ padding: 20 }}
        >
          {eligiendo ? (
            <>
              <Text style={{ fontSize: 22, fontWeight: '800', marginBottom: 12 }}>
                {nombrePlato(eligiendo, idioma)}
              </Text>
              {(eligiendo.grupos ?? []).map((g) => (
                <View key={g.id} style={{ marginBottom: 16 }}>
                  <Text style={{ fontWeight: '800', fontSize: 16 }}>
                    {nombrePlato(g, idioma)}{' '}
                    <Text style={{ color: '#5E5E5E', fontWeight: '400', fontSize: 13 }}>
                      {g.minimo > 0 ? `· ${TO.requerido}` : ''}
                      {g.maximo > 1 ? ` · ${TO.hasta} ${g.maximo}` : ''}
                    </Text>
                  </Text>
                  {g.opciones
                    .filter((o) => o.disponible)
                    .map((o) => {
                      const marcada = (elegidas[g.id] ?? []).includes(o.id);
                      return (
                        <Pressable
                          key={o.id}
                          onPress={() => alternarOpcion(g, o.id)}
                          accessibilityRole={g.maximo === 1 ? 'radio' : 'checkbox'}
                          accessibilityState={{ checked: marcada }}
                          accessibilityLabel={nombrePlato(o, idioma)}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            marginTop: 6,
                            borderRadius: 10,
                            borderWidth: marcada ? 2 : 1,
                            borderColor: marcada ? C.exito : '#D6D6D6',
                            backgroundColor: marcada ? '#E8F5EE' : '#fff',
                          }}
                        >
                          <Text style={{ fontWeight: marcada ? '800' : '500' }}>
                            {nombrePlato(o, idioma)}
                          </Text>
                          <Text style={{ color: '#5E5E5E' }}>
                            {o.precioCentavos
                              ? `+ ${formatearDolares(o.precioCentavos, idioma)}`
                              : ''}
                          </Text>
                        </Pressable>
                      );
                    })}
                </View>
              ))}
              <Boton
                texto={TO.agregar}
                alTocar={confirmarOpciones}
                exito={(eligiendo.grupos ?? []).every(grupoCompleto)}
                secundario={!(eligiendo.grupos ?? []).every(grupoCompleto)}
              />
              <Boton texto={TO.cerrar} alTocar={() => setEligiendo(null)} secundario />
            </>
          ) : null}
        </ScrollView>
      </Modal>
    </Pantalla>
  );
}
