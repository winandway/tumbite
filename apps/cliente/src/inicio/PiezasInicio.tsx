import { useEffect, useRef, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  type BannerInicio,
  ErrorApi,
  type Idioma,
  type Restaurante,
  type ServicioCatalogo,
} from '@tumbite/compartido';
import { C, COLOR, Icono, type NombreIcono, SelectorIdioma, Text } from '@tumbite/movil';
import { HojaAbajo } from './HojaAbajo';
import { IMG_NUEVO } from './recursosNuevo';
import { fotoDeRelleno } from './recursos';
import { textosInicioNuevo } from './textosNuevo';

const SOMBRA = {
  shadowColor: '#101010',
  shadowOpacity: 0.1,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 3,
} as const;

/**
 * C-INICIO-NUEVO (borrador aprobado, 17 nov 2026): la portada de arriba. Fondo oscuro degradado,
 * logo para fondo oscuro, campana, selector de idioma estilo Amazon, titular e imagen. El banner sale
 * del administrador de banners (o del respaldo local) y cambia cada vez que se abre la app.
 */
export function PortadaRotativa({
  idioma,
  cambiarIdioma,
  banner,
  pendientes,
  alCampana,
  alTocar,
}: {
  idioma: Idioma;
  cambiarIdioma: (i: Idioma) => void;
  banner: BannerInicio;
  pendientes: number;
  alCampana: () => void;
  alTocar: (b: BannerInicio) => void;
}) {
  const t = textosInicioNuevo(idioma);
  const fuente = banner.imagen
    ? { uri: banner.imagen }
    : (IMG_NUEVO.heroes[banner.local ?? 'heroe-comida'] ?? IMG_NUEVO.heroes['heroe-comida']);
  return (
    <View style={p.portada} testID="inicio-portada">
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor="#3A0A0E" />
            <Stop offset="0.55" stopColor="#1A0607" />
            <Stop offset="1" stopColor="#101010" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#g)" />
      </Svg>
      {/* C-PORTADA-FUNDIDA (18 nov 2026): la imagen ocupa la mitad derecha a sangre, de arriba abajo,
          y se desvanece hacia la izquierda en el degradado, como la tarjeta de promociones. Así
          también una foto del administrador de banners con su propio fondo se integra. */}
      <View style={p.imagenPortada} pointerEvents="none" testID="portada-imagen">
        <Image
          source={fuente}
          style={banner.imagen ? p.fotoPortada : p.dibujoPortada}
          resizeMode={banner.imagen ? 'cover' : 'contain'}
          accessibilityIgnoresInvertColors
        />
        <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="fundido" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#1C0708" stopOpacity={1} />
              <Stop offset="0.3" stopColor="#1C0708" stopOpacity={banner.imagen ? 0.85 : 0} />
              <Stop offset="0.65" stopColor="#1C0708" stopOpacity={banner.imagen ? 0.35 : 0} />
              <Stop offset="1" stopColor="#1C0708" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="fundidoAbajo" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#120506" stopOpacity={banner.imagen ? 0.7 : 0} />
              <Stop offset="0.3" stopColor="#120506" stopOpacity={0} />
              <Stop offset="0.7" stopColor="#120506" stopOpacity={0} />
              <Stop offset="1" stopColor="#120506" stopOpacity={banner.imagen ? 0.85 : 0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#fundido)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#fundidoAbajo)" />
        </Svg>
      </View>
      <View style={p.cabeza}>
        <Image
          source={IMG_NUEVO.logoOscuro}
          style={{ width: 122, height: 30 }}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Divoox"
          testID="inicio-logo"
        />
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={alCampana}
          accessibilityRole="button"
          accessibilityLabel={pendientes ? `${t.campana} (${pendientes})` : t.campana}
          hitSlop={6}
          style={p.campana}
        >
          <Icono nombre="notifications-outline" tamano={20} color="#FFFFFF" />
          {pendientes > 0 ? <View testID="campana-punto" style={p.punto} /> : null}
        </Pressable>
        <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} />
      </View>
      <Pressable
        onPress={() => alTocar(banner)}
        accessibilityRole="button"
        accessibilityLabel={banner.titulo}
        testID={`portada-${banner.id}`}
        style={p.cuerpo}
      >
        {/* C-BANNER-SIN-CORTES: el titular nunca se corta; ocupa los renglones que necesite. */}
        <Text style={p.titular} maxFontSizeMultiplier={1.2}>
          {banner.titulo}
        </Text>
      </Pressable>
    </View>
  );
}

/** «Entregar en / Ubicación actual», montada sobre la portada (sombra suave). */
export function TarjetaEntregarEn({
  idioma,
  direccion,
  alTocar,
}: {
  idioma: Idioma;
  direccion: string;
  alTocar: () => void;
}) {
  const t = textosInicioNuevo(idioma);
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={`${t.entregarEn}: ${direccion}`}
      testID="inicio-direccion"
      style={[p.entregar, SOMBRA]}
    >
      <Icono nombre="location-outline" tamano={22} color={C.acento} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 12, color: COLOR.textoSuave, fontWeight: '600' }}>
          {t.entregarEn}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text
            numberOfLines={1}
            style={{ fontSize: 16, fontWeight: '700', color: C.secundario, flexShrink: 1 }}
          >
            {direccion}
          </Text>
          <Icono nombre="chevron-down" tamano={14} color={C.secundario} />
        </View>
      </View>
    </Pressable>
  );
}

/** Ocho servicios en cuatro columnas, tarjetas pequeñas con sombra suave. */
export function CuadriculaServicios({
  idioma,
  lista,
  ordenado,
  alTocar,
}: {
  idioma: Idioma;
  lista: ServicioCatalogo[];
  ordenado: boolean;
  alTocar: (s: ServicioCatalogo) => void;
}) {
  const t = textosInicioNuevo(idioma);
  return (
    <View testID="servicios-inicio" style={{ paddingHorizontal: 16, paddingTop: 14 }}>
      {ordenado ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Icono nombre="swap-horizontal" tamano={16} color={COLOR.textoSuave} />
          <Text style={{ color: COLOR.textoSuave, fontSize: 13 }} testID="orden-uso">
            {t.ordenUso}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {lista.map((s) => {
          const [nombre, sub] = t.servicios[s.id] ?? [s.nombre, ''];
          return (
            <Pressable
              key={s.id}
              onPress={() => alTocar(s)}
              accessibilityRole="button"
              accessibilityLabel={sub ? `${nombre} ${sub}` : nombre}
              testID={`servicio-${s.id}`}
              style={({ pressed }) => [p.serv, SOMBRA, pressed && { transform: [{ scale: 0.96 }] }]}
            >
              {s.id === 'mas' ? (
                <View style={p.mas}>
                  {['#F20D20', '#101010', '#D6D8DC', '#C20A1A'].map((c) => (
                    <View key={c} style={[p.masCuadro, { backgroundColor: c }]} />
                  ))}
                </View>
              ) : (
                <Image
                  source={IMG_NUEVO.servicios[s.id] ?? IMG_NUEVO.servicios.comida}
                  style={{ height: 40, width: 58 }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
              )}
              {/* C-OCHO-ICONOS-SIEMPRE: los ocho nombres en UN renglón, como el borrador, también con
                  la letra grande del sistema en un teléfono de 360: el teléfono achica la letra para
                  que quepa (nunca puntos suspensivos). La web no sabe achicarla: ahí, antes que
                  cortar, deja un segundo renglón. */}
              <Text
                numberOfLines={Platform.OS === 'web' ? 2 : 1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                maxFontSizeMultiplier={1.15}
                style={p.servNombre}
              >
                {nombre}
              </Text>
              {sub ? (
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                  maxFontSizeMultiplier={1.15}
                  style={p.servSub}
                >
                  {sub}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Carrusel de promociones que pasa solo (cada 4 segundos), con sus puntos. */
export function CarruselPromos({
  idioma,
  promos,
  alTocar,
}: {
  idioma: Idioma;
  promos: BannerInicio[];
  alTocar: (b: BannerInicio) => void;
}) {
  const t = textosInicioNuevo(idioma);
  const ancho = Math.min(useWindowDimensions().width, 640) - 32;
  const [actual, setActual] = useState(0);
  const lista = useRef<ScrollView>(null);
  const tocando = useRef(false);
  useEffect(() => {
    if (promos.length < 2) return;
    const r = setInterval(() => {
      if (tocando.current) return;
      setActual((a) => {
        const n = (a + 1) % promos.length;
        lista.current?.scrollTo({ x: n * ancho, animated: true });
        return n;
      });
    }, 4_000);
    return () => clearInterval(r);
  }, [promos.length, ancho]);
  if (!promos.length) return null;
  const alSoltar = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    tocando.current = false;
    setActual(Math.round(e.nativeEvent.contentOffset.x / ancho));
  };
  return (
    <View style={{ marginTop: 16 }} testID="inicio-promos">
      <ScrollView
        ref={lista}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => (tocando.current = true)}
        onMomentumScrollEnd={alSoltar}
        style={{ marginHorizontal: 16, borderRadius: 16 }}
      >
        {promos.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => alTocar(b)}
            accessibilityRole="button"
            accessibilityLabel={[b.texto, b.titulo, b.codigo].filter(Boolean).join('. ')}
            style={[p.promo, { width: ancho }]}
          >
            <Image
              source={b.imagen ? { uri: b.imagen } : IMG_NUEVO.ofertaPizza}
              style={p.promoFoto}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <View style={p.promoVelo} />
            {/* C-BANNER-SIN-CORTES: título y texto completos; la tarjeta crece si hace falta. */}
            <Text style={p.promoEtiqueta} maxFontSizeMultiplier={1.2}>
              {b.texto || t.ofertaDelDia}
            </Text>
            <Text style={p.promoTitulo} maxFontSizeMultiplier={1.2}>
              {b.titulo}
            </Text>
            {b.codigo ? (
              <View style={p.promoCodigo}>
                <Text style={{ fontWeight: '700', fontSize: 12, color: C.secundario }}>
                  {`${t.codigo}: ${b.codigo}`}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
      {promos.length > 1 ? (
        <View style={p.puntos}>
          {promos.map((b, i) => (
            <View
              key={b.id}
              style={[p.puntoPromo, i === actual && { width: 16, backgroundColor: C.secundario }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** «Restaurantes cerca de ti» con nota y tiempo, y «Ver todos». */
export function RestaurantesCerca({
  idioma,
  lista,
  alTocar,
  verTodos,
}: {
  idioma: Idioma;
  lista: Restaurante[];
  alTocar: (r: Restaurante) => void;
  verTodos: () => void;
}) {
  const t = textosInicioNuevo(idioma);
  if (!lista.length) return null;
  return (
    <View style={{ marginTop: 22 }} testID="restaurantes-cerca">
      <View style={p.tituloFila}>
        <Text accessibilityRole="header" style={p.titulo}>
          {t.cerca}
        </Text>
        <Pressable onPress={verTodos} accessibilityRole="button" hitSlop={8} testID="ver-todos">
          <Text style={{ fontWeight: '700', color: C.secundario }}>{t.verTodos}</Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingTop: 10 }}
      >
        {lista.slice(0, 10).map((r) => {
          const nota = r.calificacion?.total ? r.calificacion.promedio : null;
          const min = r.tiempoPrepMin + Math.round((r.distanciaKm ?? 3) * 3);
          return (
            <Pressable
              key={r.id}
              onPress={() => alTocar(r)}
              accessibilityRole="button"
              accessibilityLabel={r.nombre}
              style={p.rest}
            >
              <Image
                source={r.imagen ? { uri: r.imagen } : fotoDeRelleno(r.categoria)}
                style={{ width: '100%', height: 92 }}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
              <View style={{ padding: 10, paddingTop: 8 }}>
                {/* C-TEXTO-ENTERO (auditor de tiendas): el nombre y el tiempo no se cortan
                    («Bella I…», «15–25 m…»): hasta dos renglones. */}
                <Text
                  numberOfLines={2}
                  textBreakStrategy="simple"
                  style={{ fontWeight: '700', fontSize: 14 }}
                >
                  {r.nombre}
                </Text>
                <Text
                  numberOfLines={2}
                  textBreakStrategy="simple"
                  style={{ color: COLOR.textoSuave, fontSize: 12 }}
                >
                  {nota != null
                    ? `★ ${nota.toFixed(1).replace('.', idioma === 'en' ? '.' : ',')} · `
                    : ''}
                  {`${min}–${min + 10} min`}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * C-OCHO-ICONOS-SIEMPRE (18 nov 2026): tocar un servicio que todavía no abre en la zona no lleva a
 * una pantalla vacía ni a un error: abre esta hoja amable con «Avísame cuando llegue» y «Volver». El
 * interés se guarda SOLO al tocar el botón; después la hoja confirma en verde.
 */
export function HojaAunNoHay({
  idioma,
  servicio,
  cerrar,
  avisar,
  conCuenta,
  crearCuenta,
}: {
  idioma: Idioma;
  servicio: string | null;
  cerrar: () => void;
  avisar: (servicio: string) => Promise<unknown>;
  /** «Avísame» solo existe con la cuenta iniciada; sin cuenta se ofrece crearla. */
  conCuenta: boolean;
  crearCuenta: () => void;
}) {
  const t = textosInicioNuevo(idioma);
  const [paso, setPaso] = useState<'listo' | 'enviando' | 'hecho' | 'error' | 'sin_boton'>('listo');
  // El paso vuelve a empezar con cada servicio: Inicio monta la hoja con `key` del servicio.
  const nombre = servicio
    ? (new Map(Object.entries(t.aunNoHay.nombres)).get(servicio) ?? servicio)
    : '';
  const tocar = () => {
    if (!servicio || paso === 'enviando') return;
    setPaso('enviando');
    avisar(servicio).then(
      () => setPaso('hecho'),
      (e: unknown) => {
        console.warn('avísame: no se pudo guardar', e);
        // El servidor todavía no trae esta pieza (404): el botón se retira sin mostrar un error;
        // la hoja y el aviso «aún no hay» siguen igual.
        setPaso(e instanceof ErrorApi && e.estado === 404 ? 'sin_boton' : 'error');
      },
    );
  };
  return (
    <HojaAbajo
      visible={Boolean(servicio)}
      alCerrar={cerrar}
      titulo={nombre}
      testID="hoja-aun-no-hay"
    >
      <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }}>
        <Text
          style={{ fontSize: 16, lineHeight: 22, color: C.secundario }}
          testID="aun-no-hay-texto"
        >
          {t.aunNoHay.frase(nombre)}
        </Text>
        {paso === 'hecho' ? (
          <View
            testID="aun-no-hay-listo"
            accessibilityLiveRegion="polite"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              backgroundColor: COLOR.exitoSuave,
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Icono nombre="checkmark-circle" tamano={20} color={COLOR.exito} />
            <Text style={{ flex: 1, color: COLOR.exito, fontWeight: '700', fontSize: 15 }}>
              {t.aunNoHay.listo}
            </Text>
          </View>
        ) : paso === 'sin_boton' ? null : !conCuenta ? (
          <Pressable
            onPress={crearCuenta}
            accessibilityRole="button"
            testID="aun-no-hay-crear-cuenta"
            style={({ pressed }) => [p.botonAviso, pressed && { opacity: 0.85 }]}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
              {t.aunNoHay.crearCuenta}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={tocar}
            accessibilityRole="button"
            accessibilityState={{ busy: paso === 'enviando' }}
            testID="aun-no-hay-avisame"
            style={({ pressed }) => [p.botonAviso, pressed && { opacity: 0.85 }]}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>
              {paso === 'enviando' ? t.aunNoHay.enviando : t.aunNoHay.avisame}
            </Text>
          </Pressable>
        )}
        {paso === 'error' ? (
          <Text style={{ color: COLOR.error, fontSize: 14 }} testID="aun-no-hay-error">
            {t.aunNoHay.error}
          </Text>
        ) : null}
        <Pressable
          onPress={cerrar}
          accessibilityRole="button"
          testID="aun-no-hay-volver"
          style={({ pressed }) => [p.botonVolver, pressed && { opacity: 0.7 }]}
        >
          <Text style={{ color: C.secundario, fontWeight: '700', fontSize: 16 }}>
            {t.aunNoHay.volver}
          </Text>
        </Pressable>
      </View>
    </HojaAbajo>
  );
}

export type ItemMas = { clave: string; texto: string; icono: NombreIcono; alTocar: () => void };

/** «Más servicios»: solo lo secundario (no repite los servicios de la cuadrícula). */
export function HojaMasServicios({
  idioma,
  visible,
  cerrar,
  items,
}: {
  idioma: Idioma;
  visible: boolean;
  cerrar: () => void;
  items: ItemMas[];
}) {
  const t = textosInicioNuevo(idioma);
  return (
    <HojaAbajo visible={visible} alCerrar={cerrar} titulo={t.masTitulo} testID="hoja-mas">
      <View>
        {items.map((x, i) => (
          <Pressable
            key={x.clave}
            onPress={() => {
              cerrar();
              x.alTocar();
            }}
            accessibilityRole="button"
            testID={`mas-${x.clave}`}
            style={[p.filaMas, i === 0 && { borderTopWidth: 1 }]}
          >
            <View style={p.icoMas}>
              <Icono nombre={x.icono} tamano={20} color={C.secundario} />
            </View>
            <Text style={{ flex: 1, fontSize: 16, color: C.secundario }}>{x.texto}</Text>
            <Icono nombre="chevron-forward" tamano={18} color={COLOR.textoSuave} />
          </Pressable>
        ))}
      </View>
    </HojaAbajo>
  );
}

const p = StyleSheet.create({
  botonAviso: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: C.primario,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  botonVolver: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLOR.bordeFuerte,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  portada: { paddingBottom: 40, overflow: 'hidden' },
  cabeza: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  campana: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  punto: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#F20D20',
    borderWidth: 2,
    borderColor: '#3A0A0E',
  },
  cuerpo: {
    justifyContent: 'center',
    paddingLeft: 18,
    paddingRight: 12,
    paddingTop: 6,
    minHeight: 132,
  },
  titular: {
    maxWidth: '56%',
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '700',
    fontFamily: 'Poppins_700Bold',
  },
  imagenPortada: { position: 'absolute', top: 0, right: 0, bottom: 0, width: '58%' },
  fotoPortada: { width: '100%', height: '100%' },
  dibujoPortada: { position: 'absolute', right: 10, bottom: 36, width: '88%', height: '62%' },
  entregar: {
    marginTop: -28,
    marginHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  serv: {
    flexBasis: '22%',
    flexGrow: 1,
    maxWidth: '24%',
    minHeight: 88,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  servNombre: {
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: '700',
    color: C.secundario,
    textAlign: 'center',
  },
  servSub: {
    fontSize: 10,
    fontWeight: '600',
    color: COLOR.textoSuave,
    textAlign: 'center',
  },
  mas: { width: 36, height: 36, flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginBottom: 2 },
  masCuadro: { width: 16.5, height: 16.5, borderRadius: 5 },
  promo: {
    minHeight: 108,
    paddingVertical: 12,
    backgroundColor: '#F20D20',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  promoFoto: { position: 'absolute', right: -20, top: 0, bottom: 0, width: '62%' },
  promoVelo: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: 'rgba(242,13,32,0.55)',
  },
  promoEtiqueta: { color: '#FFFFFF', fontWeight: '700', fontSize: 13, maxWidth: '60%' },
  promoTitulo: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 19,
    lineHeight: 24,
    maxWidth: '62%',
  },
  promoCodigo: {
    marginTop: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  puntos: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingTop: 8 },
  puntoPromo: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D6D8DC' },
  tituloFila: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  titulo: { fontSize: 20, fontWeight: '700', color: C.secundario, flex: 1 },
  rest: {
    width: 156,
    borderWidth: 1,
    borderColor: COLOR.borde,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  filaMas: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: COLOR.borde,
  },
  icoMas: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLOR.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
