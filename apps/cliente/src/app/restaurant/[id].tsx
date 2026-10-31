import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ErrorApi,
  type GrupoOpciones,
  type OpcionElegida,
  type Plato,
  type Restaurante,
  descripcion,
  enIdioma,
  formatearMonto,
  nombrePlato,
  categoriaPlato,
  nombreEtiquetaDieta,
  NOTA_PLATO_MAX,
  gruposActivos,
  abiertoPorHorario,
  textoNoDisponible,
} from '@tumbite/compartido';
import { C, e, urlFoto, useSesion } from '@tumbite/movil';
import { useCarrito } from '../../carrito';
import { TEXTOS, distanciaTexto } from '../../textos';
import { fotoDeRelleno } from '../../inicio/recursos';
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
import { Calificacion, ResenasRestaurante } from '../../comida/Calificacion';

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
 * Menú del restaurante con el diseño aprobado (pantallas 3 y 4): foto grande, nombre, distancia,
 * tiempo y «Abierto»; pestañas Menú e Información (datos reales); botones de categoría; platos con
 * el botón + redondo; y el detalle del producto a pantalla completa con tamaños, extras y cantidad.
 */
export default function MenuRestaurante() {
  // C-PEDIDO-GRUPO: con ?grupo=<código>, lo que se agrega va al pedido en grupo, no al carrito.
  const { id, grupo } = useLocalSearchParams<{ id: string; grupo?: string }>();
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS, idioma);
  const tc = textosComida(idioma);
  const { agregar, vaciar, cantidadTotal, carrito } = useCarrito();
  const bordes = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [datos, setDatos] = useState<{
    restaurante: Restaurante;
    platos: Plato[];
    /** C-MENU-HORARIO: categorías que ahora no se sirven, con su franja. */
    fueraDeHorario?: { categoria: string; abre: string; cierra: string }[];
  } | null>(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<'menu' | 'info'>('menu');
  const [categoria, setCategoria] = useState<string | null>(null);
  // El plato abierto en el detalle (tamaño, extras, cantidad) antes de ir al carrito.
  const [eligiendo, setEligiendo] = useState<Plato | null>(null);
  const [elegidas, setElegidas] = useState<Record<string, string[]>>({});
  const [cantidad, setCantidad] = useState(1);
  // C-NOTA-PLATO: «sin cebolla» para el plato que se está eligiendo.
  const [notaPlato, setNotaPlato] = useState('');
  // C-MONEDA-RECORRIDO: los precios del menú en la moneda del restaurante.
  const moneda = datos?.restaurante.moneda ?? 'USD';

  useEffect(() => {
    api
      .pedir<{ restaurante: Restaurante; platos: Plato[] }>('GET', `/datos/restaurantes/${id}`)
      .then(setDatos)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api, id]);

  /** Mete el plato n veces; si el carrito es de otro restaurante, pregunta antes de vaciarlo. */
  const [avisoGrupo, setAvisoGrupo] = useState('');
  async function alGrupo(p: Plato, opciones: OpcionElegida[], n: number) {
    try {
      await api.pedir('POST', `/datos/grupos/${String(grupo)}/items`, {
        platoId: p.id,
        cantidad: n,
        opciones: opciones.map((o) => o.id),
      });
      setAvisoGrupo(idioma === 'en' ? 'Added to the group order.' : 'Agregado al pedido en grupo.');
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
    }
  }
  async function crearGrupo() {
    try {
      const r = await api.pedir<{ codigo: string }>('POST', '/datos/grupos', { restauranteId: id });
      router.push(`/group/${r.codigo}`);
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
    }
  }
  async function meter(p: Plato, opciones: OpcionElegida[], n: number, nota = '') {
    if (!datos) return;
    if (grupo) return alGrupo(p, opciones, n);
    const r = datos.restaurante;
    const rest = {
      id: r.id,
      nombre: r.nombre,
      plan: r.plan,
      lat: r.lat,
      lng: r.lng,
      moneda: r.moneda,
    };
    if (agregar(rest, p, opciones, nota) === 'otro-restaurante') {
      if (!(await confirmar(t.otroRestaurante, t.siEmpezar, t.no))) return;
      vaciar();
      setTimeout(() => {
        for (let i = 0; i < n; i++) agregar(rest, p, opciones, nota);
      }, 0);
      return;
    }
    for (let i = 1; i < n; i++) agregar(rest, p, opciones, nota);
  }
  function abrirDetalle(p: Plato) {
    setElegidas({});
    setCantidad(1);
    setNotaPlato('');
    setEligiendo(p);
  }
  /** El + del plato: con opciones abre el detalle; sin opciones lo agrega de una. */
  function alMas(p: Plato) {
    if ((p.grupos?.length ?? 0) > 0) return abrirDetalle(p);
    void meter(p, [], 1);
  }
  const grupoCompleto = (g: GrupoOpciones) => {
    const n = (elegidas[g.id] ?? []).length;
    return n >= g.minimo && n <= g.maximo;
  };
  function alternarOpcion(g: GrupoOpciones, oid: string) {
    setElegidas((x) => {
      const actual = x[g.id] ?? [];
      if (actual.includes(oid)) return { ...x, [g.id]: actual.filter((y) => y !== oid) };
      if (g.maximo === 1) return { ...x, [g.id]: [oid] };
      if (actual.length >= g.maximo) return x;
      return { ...x, [g.id]: [...actual, oid] };
    });
  }
  // C-OPCIONES-ANIDADAS: los grupos de primer nivel y los que abren las opciones elegidas.
  const activos = (p: Plato) => gruposActivos(p.grupos ?? [], Object.values(elegidas).flat());
  const opcionesElegidas = (p: Plato): OpcionElegida[] =>
    activos(p).flatMap((g) =>
      g.opciones
        .filter((o) => (elegidas[g.id] ?? []).includes(o.id))
        .map((o) => ({
          id: o.id,
          nombreEs: o.nombreEs,
          nombreEn: o.nombreEn,
          precioCentavos: o.precioCentavos,
        })),
    );
  function confirmarDetalle() {
    if (!eligiendo) return;
    if (!activos(eligiendo).every(grupoCompleto)) return;
    const p = eligiendo;
    const opciones = opcionesElegidas(p);
    setEligiendo(null);
    void meter(p, opciones, cantidad, notaPlato);
  }

  const r = datos?.restaurante;
  const abierto = r?.abiertoAhora ?? r?.abierto ?? false;
  const categorias = useMemo(
    () => [...new Set(datos?.platos.map((p) => p.categoria) ?? [])],
    [datos],
  );
  const visibles = categorias.filter((c) => categoria === null || c === categoria);
  const nombreCategoria = (cat: string) =>
    categoriaPlato(
      datos?.platos.find((p) => p.categoria === cat) ?? { categoria: cat, categoriaEn: '' },
      idioma,
    );
  const fotoRest = urlFoto(r?.imagen);
  const altoFoto = Math.min(260, Math.round(Math.min(width, ANCHO_MAX) * 0.62));

  const detalle = eligiendo;
  const completo = detalle ? activos(detalle).every(grupoCompleto) : true;
  const precioDetalle = detalle
    ? (detalle.precioCentavos +
        opcionesElegidas(detalle).reduce((s, o) => s + o.precioCentavos, 0)) *
      cantidad
    : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 110,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
      >
        <View>
          <Image
            source={fotoRest ? { uri: fotoRest } : fotoDeRelleno(r?.categoria ?? '', 2)}
            style={{ width: '100%', height: altoFoto, backgroundColor: '#f1f1f1' }}
            accessibilityIgnoresInvertColors
          />
          <View style={{ position: 'absolute', top: 10, left: 10 }}>
            <Flecha
              alTocar={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              etiqueta={tc.volver}
              sobreFoto
            />
          </View>
          {r ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: 16,
                backgroundColor: 'rgba(25,25,25,0.55)',
              }}
            >
              <Text
                style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}
                accessibilityRole="header"
              >
                {r.nombre}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <Text style={{ color: '#fff', fontSize: 14 }}>
                  {r.distanciaKm != null
                    ? `${distanciaTexto(r.distanciaKm, idioma, r.pais)} · `
                    : ''}
                  {r.tiempoPrepMin + 10}–{r.tiempoPrepMin + 20} min
                </Text>
                <Estado abierto={abierto} texto={abierto ? tc.abierto : tc.cerrado} />
              </View>
              <View style={{ marginTop: 4 }}>
                <Calificacion c={r.calificacion} idioma={idioma} claro />
              </View>
            </View>
          ) : null}
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          {error ? <Text style={[e.error, { marginTop: 12 }]}>{error}</Text> : null}
          {r && !abierto ? (
            <Text style={[e.aviso, { marginTop: 12 }]}>
              {/* C-NO-RECIBE-AHORA: en horario pero sin recibir no se inventa la próxima apertura. */}
              {r.abierto &&
              r.horarios?.length &&
              abiertoPorHorario(r.horarios, r.zonaHoraria ?? 'America/New_York')
                ? `${textoNoDisponible(r, idioma) ?? ''}.`
                : `${t.cerradoAhora}${textoNoDisponible(r, idioma) ? ` ${textoNoDisponible(r, idioma)}.` : ''}`}
            </Text>
          ) : null}

          {/* C-CALIFICACION-PUBLICA: las reseñas arriba del menú, como DoorDash. */}
          {r ? <ResenasRestaurante restauranteId={r.id} /> : null}
          {/* C-MENU-HORARIO: lo que se sirve en otra franja (desayuno de 07:00 a 11:00). */}
          {(datos?.fueraDeHorario ?? []).map((v) => (
            <Text
              key={v.categoria}
              testID="fuera-de-horario"
              style={{ color: '#5E5E5E', marginTop: 10, fontSize: 13 }}
            >
              {tc.fueraDeHorario
                .replace('{categoria}', v.categoria)
                .replace('{abre}', v.abre)
                .replace('{cierra}', v.cierra)}
            </Text>
          ))}

          {/* C-PEDIDO-GRUPO: como DoorDash, el pedido en grupo se arma desde el menú. */}
          {grupo ? (
            <View style={{ marginTop: 12, gap: 6 }}>
              <Text style={{ fontWeight: '800', color: C.secundario }}>
                {idioma === 'en'
                  ? 'You’re adding to a group order.'
                  : 'Estás agregando a un pedido en grupo.'}
              </Text>
              {avisoGrupo ? (
                <Text style={{ color: C.exito, fontWeight: '700' }}>{avisoGrupo}</Text>
              ) : null}
              <Text
                style={e.enlace}
                onPress={() => router.push(`/group/${String(grupo)}`)}
                accessibilityRole="button"
              >
                {idioma === 'en' ? 'Back to the group order →' : 'Volver al pedido en grupo →'}
              </Text>
            </View>
          ) : (
            <Text
              style={[e.enlace, { marginTop: 12 }]}
              onPress={() => void crearGrupo()}
              accessibilityRole="button"
            >
              {idioma === 'en' ? 'Start a group order' : 'Hacer un pedido en grupo'}
            </Text>
          )}

          {/* Pestañas: Menú e Información. Opiniones llegará cuando el servidor las publique. */}
          <View
            style={{
              flexDirection: 'row',
              borderBottomWidth: 1,
              borderBottomColor: '#EFEFEF',
              marginTop: 8,
            }}
            accessibilityRole="tablist"
          >
            {(['menu', 'info'] as const).map((k) => {
              const activa = pestana === k;
              return (
                <Pressable
                  key={k}
                  onPress={() => setPestana(k)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activa }}
                  style={{
                    paddingVertical: 12,
                    marginRight: 24,
                    borderBottomWidth: 3,
                    borderBottomColor: activa ? C.primario : 'transparent',
                  }}
                >
                  <Text
                    style={{
                      fontWeight: '800',
                      fontSize: 15,
                      color: activa ? C.primario : '#5E5E5E',
                    }}
                  >
                    {k === 'menu' ? tc.menu : tc.informacion}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {pestana === 'info' && r ? (
            <View style={{ paddingVertical: 12, gap: 14 }}>
              {descripcion(r, idioma) ? (
                <Text style={{ color: C.secundario, fontSize: 15 }}>{descripcion(r, idioma)}</Text>
              ) : null}
              {r.direccion ? (
                <View>
                  <Text style={{ fontWeight: '800', color: C.secundario }}>{tc.direccion}</Text>
                  <Text style={{ color: '#5E5E5E' }}>{r.direccion}</Text>
                </View>
              ) : null}
              {r.telefono ? (
                <View>
                  <Text style={{ fontWeight: '800', color: C.secundario }}>{tc.telefono}</Text>
                  <Text style={{ color: '#5E5E5E' }}>{r.telefono}</Text>
                </View>
              ) : null}
              <View>
                <Text style={{ fontWeight: '800', color: C.secundario }}>{tc.horario}</Text>
                {r.horarios?.length ? (
                  tc.dias.map((dia, i) => {
                    const turnos = (r.horarios ?? []).filter((h) => h.dia === i);
                    if (!turnos.length) return null;
                    return (
                      <Text key={dia} style={{ color: '#5E5E5E' }}>
                        {dia}: {turnos.map((h) => `${h.abre}–${h.cierra}`).join(', ')}
                      </Text>
                    );
                  })
                ) : (
                  <Text style={{ color: '#5E5E5E' }}>{tc.sinHorario}</Text>
                )}
              </View>
            </View>
          ) : null}

          {pestana === 'menu' ? (
            <>
              {categorias.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
                >
                  <Pildora
                    texto={tc.todos}
                    activa={categoria === null}
                    alTocar={() => setCategoria(null)}
                  />
                  {categorias.map((cat) => (
                    <Pildora
                      key={cat || 'general'}
                      texto={nombreCategoria(cat) || tc.menu}
                      activa={categoria === cat}
                      alTocar={() => setCategoria(cat)}
                    />
                  ))}
                </ScrollView>
              ) : null}
              {visibles.map((cat) => (
                <View key={cat || 'general'}>
                  {cat ? (
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '800',
                        color: C.secundario,
                        marginTop: 10,
                        marginBottom: 4,
                      }}
                    >
                      {nombreCategoria(cat)}
                    </Text>
                  ) : null}
                  {datos?.platos
                    .filter((p) => p.categoria === cat)
                    .map((p) => {
                      const enCarrito =
                        carrito.restauranteId === datos.restaurante.id
                          ? carrito.lineas
                              .filter((l) => l.platoId === p.id)
                              .reduce((s, l) => s + l.cantidad, 0)
                          : 0;
                      const foto = urlFoto(p.imagen);
                      return (
                        <Pressable
                          key={p.id}
                          onPress={() => abrirDetalle(p)}
                          accessibilityRole="button"
                          accessibilityLabel={nombrePlato(p, idioma)}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 12,
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: '#F2F2F2',
                          }}
                        >
                          {foto ? (
                            <Image
                              source={{ uri: foto }}
                              accessibilityIgnoresInvertColors
                              style={{
                                width: 84,
                                height: 84,
                                borderRadius: 14,
                                backgroundColor: '#f1f1f1',
                              }}
                            />
                          ) : null}
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}>
                              {nombrePlato(p, idioma)}
                            </Text>
                            {descripcion(p, idioma) ? (
                              <Text style={{ color: '#5E5E5E', fontSize: 13 }} numberOfLines={2}>
                                {descripcion(p, idioma)}
                              </Text>
                            ) : null}
                            {p.etiquetas?.length ? (
                              <Text style={{ color: C.exito, fontSize: 12, fontWeight: '700' }}>
                                {p.etiquetas.map((m) => nombreEtiquetaDieta(m, idioma)).join(' · ')}
                              </Text>
                            ) : null}
                            <Text style={{ marginTop: 4, fontWeight: '800', color: C.secundario }}>
                              {formatearMonto(p.precioCentavos, moneda, idioma)}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'center', gap: 4 }}>
                            <BotonRedondo
                              texto="+"
                              alTocar={() => alMas(p)}
                              desactivado={!abierto}
                              etiqueta={`${t.agregar} ${nombrePlato(p, idioma)}`}
                            />
                            {enCarrito > 0 ? (
                              // Ya en el carrito = salió bien: verde (C-VERDE-EXITO).
                              <Text
                                style={{
                                  color: enCarrito ? C.exito : C.secundario,
                                  fontWeight: '800',
                                  fontSize: 12,
                                }}
                              >
                                {enCarrito} ✓
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                </View>
              ))}
            </>
          ) : null}
        </View>
      </ScrollView>

      {cantidadTotal > 0 ? (
        <View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              paddingHorizontal: 16,
              // Por encima de la barra de gestos del teléfono (en Android quedaba debajo).
              paddingBottom: Math.max(16, bordes.bottom + 8),
              paddingTop: 4,
              backgroundColor: '#fff',
            },
            sombra,
          ]}
        >
          <View style={{ width: '100%', maxWidth: ANCHO_MAX, alignSelf: 'center' }}>
            <BotonAncho
              texto={`${t.verCarrito} (${cantidadTotal})`}
              alTocar={() => router.push('/cart')}
            />
          </View>
        </View>
      ) : null}

      <Modal visible={!!detalle} animationType="slide" onRequestClose={() => setEligiendo(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          {detalle ? (
            <>
              <ScrollView
                contentContainerStyle={{
                  paddingBottom: 24,
                  width: '100%',
                  maxWidth: ANCHO_MAX,
                  alignSelf: 'center',
                }}
              >
                <View>
                  {urlFoto(detalle.imagen) ? (
                    <Image
                      source={{ uri: urlFoto(detalle.imagen) ?? undefined }}
                      style={{ width: '100%', height: altoFoto, backgroundColor: '#f1f1f1' }}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View style={{ height: 64 }} />
                  )}
                  <View style={{ position: 'absolute', top: 10, left: 10 }}>
                    <Flecha
                      alTocar={() => setEligiendo(null)}
                      etiqueta={tc.cerrar}
                      sobreFoto={!!urlFoto(detalle.imagen)}
                    />
                  </View>
                </View>
                <View
                  style={{
                    backgroundColor: '#fff',
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    marginTop: urlFoto(detalle.imagen) ? -24 : 0,
                    padding: 20,
                  }}
                >
                  <Text style={{ fontSize: 24, fontWeight: '900', color: C.secundario }}>
                    {nombrePlato(detalle, idioma)}
                  </Text>
                  {descripcion(detalle, idioma) ? (
                    <Text style={{ color: '#5E5E5E', marginTop: 4 }}>
                      {descripcion(detalle, idioma)}
                    </Text>
                  ) : null}
                  {detalle.etiquetas?.length ? (
                    <Text style={{ color: C.exito, marginTop: 4, fontWeight: '700' }}>
                      {detalle.etiquetas.map((m) => nombreEtiquetaDieta(m, idioma)).join(' · ')}
                    </Text>
                  ) : null}
                  <Text
                    style={{ fontSize: 24, fontWeight: '900', color: C.primario, marginTop: 8 }}
                  >
                    {formatearMonto(detalle.precioCentavos, moneda, idioma)}
                  </Text>

                  {activos(detalle).map((g) => (
                    <View
                      key={g.id}
                      style={[
                        { marginTop: 18 },
                        // El grupo anidado se ve dentro de la opción que lo abrió.
                        g.anidado && {
                          marginLeft: 12,
                          paddingLeft: 12,
                          borderLeftWidth: 1,
                          borderLeftColor: '#D6D6D6',
                        },
                      ]}
                    >
                      <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}>
                        {nombrePlato(g, idioma)}
                        <Text
                          style={{
                            color: g.minimo > 0 ? C.primario : '#5E5E5E',
                            fontWeight: '600',
                            fontSize: 13,
                          }}
                        >
                          {g.minimo > 0 ? ` · ${tc.requerido}` : ''}
                          {g.maximo > 1 ? ` · ${tc.hasta} ${g.maximo}` : ''}
                        </Text>
                      </Text>
                      {g.maximo === 1 ? (
                        <View
                          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}
                        >
                          {g.opciones
                            .filter((o) => o.disponible)
                            .map((o) => {
                              const marcada = (elegidas[g.id] ?? []).includes(o.id);
                              return (
                                <Pressable
                                  key={o.id}
                                  onPress={() => alternarOpcion(g, o.id)}
                                  accessibilityRole="radio"
                                  accessibilityState={{ checked: marcada }}
                                  accessibilityLabel={nombrePlato(o, idioma)}
                                  style={{
                                    flexGrow: 1,
                                    flexBasis: '30%',
                                    alignItems: 'center',
                                    paddingVertical: 12,
                                    borderRadius: 14,
                                    borderWidth: marcada ? 2 : 1,
                                    borderColor: marcada ? C.primario : '#D6D6D6',
                                  }}
                                >
                                  <Text style={{ fontWeight: '800', color: C.secundario }}>
                                    {nombrePlato(o, idioma)}
                                  </Text>
                                  {o.precioCentavos ? (
                                    <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
                                      + {formatearMonto(o.precioCentavos, moneda, idioma)}
                                    </Text>
                                  ) : null}
                                </Pressable>
                              );
                            })}
                        </View>
                      ) : (
                        <View
                          style={{
                            borderWidth: 1,
                            borderColor: '#EFEFEF',
                            borderRadius: 14,
                            marginTop: 8,
                          }}
                        >
                          {g.opciones
                            .filter((o) => o.disponible)
                            .map((o, i) => {
                              const marcada = (elegidas[g.id] ?? []).includes(o.id);
                              return (
                                <Pressable
                                  key={o.id}
                                  onPress={() => alternarOpcion(g, o.id)}
                                  accessibilityRole="checkbox"
                                  accessibilityState={{ checked: marcada }}
                                  accessibilityLabel={nombrePlato(o, idioma)}
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 12,
                                    paddingVertical: 12,
                                    paddingHorizontal: 12,
                                    borderTopWidth: i ? 1 : 0,
                                    borderTopColor: '#EFEFEF',
                                  }}
                                >
                                  <View
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: 5,
                                      borderWidth: 2,
                                      borderColor: marcada ? C.primario : '#BDBDBD',
                                      backgroundColor: marcada ? C.primario : '#fff',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}
                                  >
                                    {marcada ? (
                                      <Text
                                        style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}
                                      >
                                        ✓
                                      </Text>
                                    ) : null}
                                  </View>
                                  <Text style={{ flex: 1, color: C.secundario }}>
                                    {nombrePlato(o, idioma)}
                                  </Text>
                                  <Text style={{ color: '#5E5E5E' }}>
                                    {o.precioCentavos
                                      ? `+ ${formatearMonto(o.precioCentavos, moneda, idioma)}`
                                      : ''}
                                  </Text>
                                </Pressable>
                              );
                            })}
                        </View>
                      )}
                    </View>
                  ))}

                  {grupo ? null : (
                    <View style={{ marginTop: 18 }}>
                      <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}>
                        {tc.notaPlato}
                      </Text>
                      <TextInput
                        testID="nota-plato"
                        accessibilityLabel={tc.notaPlato}
                        value={notaPlato}
                        onChangeText={setNotaPlato}
                        placeholder={tc.notaPlatoEjemplo}
                        placeholderTextColor="#9a9a9a"
                        maxLength={NOTA_PLATO_MAX}
                        multiline
                        style={{
                          marginTop: 8,
                          borderWidth: 1,
                          borderColor: '#D6D6D6',
                          borderRadius: 10,
                          padding: 12,
                          minHeight: 64,
                          color: C.secundario,
                          textAlignVertical: 'top',
                        }}
                      />
                    </View>
                  )}
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 18,
                      marginTop: 22,
                    }}
                    accessibilityLabel={`${tc.cantidad}: ${cantidad}`}
                  >
                    <BotonRedondo
                      texto="−"
                      lleno={false}
                      alTocar={() => setCantidad((n) => Math.max(1, n - 1))}
                      etiqueta={t.menos}
                    />
                    <Text
                      style={{ fontSize: 18, fontWeight: '800', minWidth: 24, textAlign: 'center' }}
                    >
                      {cantidad}
                    </Text>
                    <BotonRedondo
                      texto="+"
                      alTocar={() => setCantidad((n) => Math.min(99, n + 1))}
                      etiqueta={t.mas}
                    />
                  </View>
                </View>
              </ScrollView>
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingBottom: 16,
                  width: '100%',
                  maxWidth: ANCHO_MAX,
                  alignSelf: 'center',
                }}
              >
                <BotonAncho
                  texto={`${tc.agregarAlCarrito} · ${formatearMonto(precioDetalle, moneda, idioma)}`}
                  alTocar={confirmarDetalle}
                  desactivado={!completo || !abierto}
                />
              </View>
            </>
          ) : null}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
