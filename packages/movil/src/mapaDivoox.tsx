import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text } from './diseno';
import {
  Image,
  type ImageSourcePropType,
  PixelRatio,
  Platform,
  Pressable,
  View,
  useColorScheme,
} from 'react-native';
import { type Redibujable, crearRedibujador } from './redibujarMarcadores';
import { estiloMapaDe } from '@tumbite/compartido/src/estiloMapaDivoox';
import {
  AJUSTES_TEMA_MAPA,
  TEXTOS_TEMA_MAPA,
  type TemaMapa,
  cambiarAjusteTemaMapa,
  cargarAjusteTemaMapa,
  nombreAjusteTemaMapa,
  useAjusteTemaMapa,
  useTemaMapa,
} from '@tumbite/compartido/src/temaMapa';
import { almacenTelefono } from './almacen';
import { useSesion } from './sesion';
import { C, e } from './ui';

/**
 * C-MAPA-DIA-NOCHE y C-MAPA-ISOTIPO (14 nov 2026, decisión de Richard) — todos los países. La pieza
 * única de los mapas nativos de las apps (cliente, conductor y ruta Flex): los colores de día o de
 * noche, la marca del repartidor o conductor y el ajuste de tres posiciones de la cuenta.
 *
 * Lo que permite cada plataforma (documentación de react-native-maps 1.27):
 * - Android (mapa de Google): `customMapStyle` con el estilo de Divoox de día o de noche, el mismo de
 *   la web.
 * - iPhone (mapa de Apple): Apple no admite un estilo propio; se le pide su modo claro u oscuro con
 *   `userInterfaceStyle` y se le quitan los puntos de interés. Cambia a la misma hora que los demás.
 */
type Punto = { lat: number; lng: number };

/** Las propiedades de color que se le ponen a cada `<MapView>`: `{...coloresMapa}`. */
export function usePropsMapaDivoox(punto?: Punto | null): {
  tema: TemaMapa;
  coloresMapa: {
    customMapStyle: ReturnType<typeof estiloMapaDe>;
    userInterfaceStyle: 'light' | 'dark';
    showsPointsOfInterests: false;
    showsBuildings: false;
    showsIndoors: false;
  };
} {
  const sistema = useColorScheme();
  // El ajuste guardado en el teléfono se lee una vez al abrir el primer mapa.
  useEffect(() => {
    void cargarAjusteTemaMapa(almacenTelefono);
  }, []);
  const tema = useTemaMapa(punto, sistema === 'dark');
  return useMemo(
    () => ({
      tema,
      coloresMapa: {
        customMapStyle: estiloMapaDe(tema),
        userInterfaceStyle: tema === 'noche' ? 'dark' : 'light',
        showsPointsOfInterests: false,
        // C-MAPA-SIEMPRE-CLARO (paquete 13): de cerca, Google levantaba los edificios en 3D y
        // oscurecía las manzanas a un gris medio que no es de la paleta. Ni relieve ni interiores.
        showsBuildings: false,
        showsIndoors: false,
      },
    }),
    [tema],
  );
}

/**
 * C-MARCADOR-ANDROID (18 nov 2026): en Android cada marcador con vista propia se pinta como una FOTO
 * de esa vista. Si la foto se congela (`tracksViewChanges={false}`) antes de que el texto se acomode o
 * la imagen cargue, sale una píldora vacía o un círculo blanco. Esta pieza deja la foto viva un
 * momento al aparecer o al cambiar `clave`, y otra vez cuando la imagen avisa que cargó (`listo`);
 * después la congela, así el mapa no repinta los marcadores todo el tiempo. En iPhone no cambia nada
 * (el mapa de Apple dibuja la vista en vivo).
 */
export const MS_CAPTURA_MARCADOR = 1200;
/**
 * Segunda vuelta (19 nov 2026, paquete 13): `tracksViewChanges` solo no basta en Android (ver
 * `redibujarMarcadores.ts`: el seguidor toma una sola foto y se apaga antes de que cargue la imagen).
 * Cada `<Marker>` con vista propia lleva `ref={vista.marcador}` y la pieza le pide `redraw()` al
 * aparecer, al cambiar `clave`, cuando el mapa termina de cargar y cuando la imagen carga
 * (`vista.listo()` en `onMapReady` y en `alCargar`).
 */
export function useCapturaMarcador(clave: unknown): {
  seguir: boolean;
  listo: () => void;
  marcador: (m: Redibujable | null) => (() => void) | undefined;
} {
  // Cada vez que la vista se vuelve a tomar: `vuelta` sube y la foto queda viva `ms` milisegundos.
  const [estado, setEstado] = useState({ clave, vuelta: 0, ms: MS_CAPTURA_MARCADOR, viva: true });
  if (!Object.is(estado.clave, clave))
    setEstado({ clave, vuelta: estado.vuelta + 1, ms: MS_CAPTURA_MARCADOR, viva: true });
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!estado.viva) return;
    reloj.current = setTimeout(() => setEstado((e) => ({ ...e, viva: false })), estado.ms);
    return () => {
      if (reloj.current) clearTimeout(reloj.current);
    };
  }, [estado.vuelta, estado.ms, estado.viva]);
  // El redibujador vive lo que vive el mapa (en iPhone el mapa de Apple dibuja en vivo: no hace falta).
  const [redibujador] = useState(() => crearRedibujador());
  useEffect(() => () => redibujador.limpiar(), [redibujador]);
  useEffect(() => {
    if (Platform.OS === 'android') redibujador.programar();
  }, [estado.vuelta, redibujador]);
  const listo = useCallback(
    () => setEstado((e) => ({ ...e, vuelta: e.vuelta + 1, ms: 400, viva: true })),
    [],
  );
  const marcador = useCallback(
    (m: Redibujable | null) => {
      const soltar = redibujador.registrar(m);
      if (m && Platform.OS === 'android') redibujador.programar();
      return soltar;
    },
    [redibujador],
  );
  return { seguir: estado.viva, listo, marcador };
}

type Margen = { top: number; right: number; bottom: number; left: number };
/**
 * C-MAPA-VISTA-PREVIA: el margen del encuadre. En el mapa pequeño (150 a 200 de alto) el margen de
 * siempre se comía casi todo el alto y el recorrido salía diminuto: ahí va un margen chico, en puntos
 * de pantalla (en Android `fitToCoordinates` lo pide en píxeles). Los mapas grandes no cambian.
 */
export function margenEncuadre(vistaPrevia: boolean, normal: Margen): Margen {
  if (!vistaPrevia) return normal;
  const u = Platform.OS === 'android' ? PixelRatio.get() : 1;
  return { top: 30 * u, right: 36 * u, bottom: 22 * u, left: 36 * u };
}

/** Lado, en puntos, del disco de la marca (el mismo de la web). */
const LADO = 44;
/** En Android la imagen es el disco (ver abajo): un poco mayor para que el isotipo se lea igual. */
const LADO_ANDROID = 48;

/**
 * La marca del repartidor o conductor: el isotipo de Divoox sobre un disco blanco con borde negro,
 * que se lee igual sobre el mapa de día y sobre el de noche. `fuente` es la imagen del isotipo que
 * genera `scripts/marca/generar-identidad.mjs` desde el vector aprobado (700 × 463, con el isotipo
 * centrado): se encaja entera, sin estirarla. `apagado` cuando no hay señal reciente.
 */
export function MarcaIsotipo({
  fuente,
  apagado = false,
  alCargar,
}: {
  fuente: ImageSourcePropType;
  apagado?: boolean;
  /** C-MARCADOR-ANDROID: la imagen ya cargó (el mapa vuelve a tomar la foto del marcador). */
  alCargar?: () => void;
}) {
  if (Platform.OS === 'android')
    // C-MARCADOR-ANDROID (paquete 13): en Android la IMAGEN es el hijo directo del marcador y ella
    // misma pinta el disco (fondo blanco, borde negro, redonda). react-native-maps 1.27.2 solo engancha
    // la carga de una imagen que cuelga DIRECTO del marcador (`hackToHandleDraweeLifecycle`: la da por
    // puesta en pantalla y, al cargar, vuelve a tomar la foto). Dentro de otra vista (como antes) la
    // imagen nunca llegaba a la foto y el marcador salía como un círculo blanco vacío. Un poco más
    // grande (48) para que el isotipo encajado entero se vea del mismo tamaño que en iPhone.
    return (
      <Image
        testID="mapa-marca-isotipo"
        source={fuente}
        style={{
          width: LADO_ANDROID,
          height: LADO_ANDROID,
          borderRadius: LADO_ANDROID / 2,
          backgroundColor: '#FFFFFF',
          borderWidth: 2,
          borderColor: '#101010',
          opacity: apagado ? 0.55 : 1,
        }}
        resizeMode="contain"
        fadeDuration={0}
        onLoad={alCargar}
        accessibilityIgnoresInvertColors
      />
    );
  return (
    <View
      testID="mapa-marca-isotipo"
      style={{
        width: LADO,
        height: LADO,
        borderRadius: LADO / 2,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#101010',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: apagado ? 0.55 : 1,
        shadowColor: '#000000',
        shadowOpacity: 0.35,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      <Image
        source={fuente}
        style={{ width: 50, height: 33 }}
        resizeMode="contain"
        // C-MARCADOR-ANDROID: sin el fundido de 300 ms de Android, la foto nunca sale a medio pintar.
        fadeDuration={0}
        onLoad={alCargar}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/**
 * El ajuste «Colores del mapa» de la cuenta: automático, claro u oscuro. Se guarda en el teléfono y
 * lo siguen al momento todos los mapas abiertos.
 */
export function AjusteMapa() {
  const { idioma } = useSesion();
  const t = TEXTOS_TEMA_MAPA[idioma === 'es' ? 'es' : 'en'];
  const ajuste = useAjusteTemaMapa();
  useEffect(() => {
    void cargarAjusteTemaMapa(almacenTelefono);
  }, []);
  return (
    <View testID="ajuste-mapa" style={[e.tarjeta, { gap: 8 }]}>
      <Text style={{ fontWeight: '700', fontSize: 15 }}>{t.titulo}</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t.titulo}
        style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#D6D8DC', borderRadius: 10 }}
      >
        {AJUSTES_TEMA_MAPA.map((a) => {
          const activa = ajuste === a;
          return (
            <Pressable
              key={a}
              testID={`ajuste-mapa-${a}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa, checked: activa }}
              onPress={() => void cambiarAjusteTemaMapa(a, almacenTelefono)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: 9,
                backgroundColor: activa ? C.secundario : 'transparent',
              }}
            >
              <Text style={{ fontWeight: '700', color: activa ? '#FFFFFF' : C.secundario }}>
                {nombreAjusteTemaMapa(idioma, a)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: '#666B73', fontSize: 13 }}>{t.ayuda}</Text>
    </View>
  );
}
