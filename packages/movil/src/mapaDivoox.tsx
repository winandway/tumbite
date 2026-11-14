import { useEffect, useMemo } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  Text,
  View,
  useColorScheme,
} from 'react-native';
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
      },
    }),
    [tema],
  );
}

/** Lado, en puntos, del disco de la marca (el mismo de la web). */
const LADO = 44;

/**
 * La marca del repartidor o conductor: el isotipo de Divoox sobre un disco blanco con borde negro,
 * que se lee igual sobre el mapa de día y sobre el de noche. `fuente` es la imagen del isotipo que
 * genera `scripts/marca/generar-identidad.mjs` desde el vector aprobado (700 × 463, con el isotipo
 * centrado): se encaja entera, sin estirarla. `apagado` cuando no hay señal reciente.
 */
export function MarcaIsotipo({
  fuente,
  apagado = false,
}: {
  fuente: ImageSourcePropType;
  apagado?: boolean;
}) {
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
        style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 10 }}
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
      <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.ayuda}</Text>
    </View>
  );
}
