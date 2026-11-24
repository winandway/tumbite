import { useEffect, useState } from 'react';
import { Animated, Easing, Image, type ImageSourcePropType, View } from 'react-native';
import { MARCA } from '@tumbite/compartido';

/**
 * C-ARRANQUE-CON-MARCA (24 nov 2026, Richard: en teléfonos reales, al abrir en frío salía la imagen
 * de plantilla de Expo, «círculos con rayas en cruz») — todos los países. Después de la pantalla de
 * arranque del sistema (el logo de Divoox sobre el color de la app, `expo-splash-screen` en app.json)
 * viene ESTA, igual a ella, mientras se lee la sesión guardada: el mismo logo, el mismo fondo y una
 * barra fina en verde que avanza. Dura lo que tarde la sesión, nada más.
 *
 * Cada app dice su fondo y su logo una vez, en su `_layout` (`fijarPantallaCarga`); la usan su
 * entrada y `ConSesion`.
 */
type Config = { fondo: string; logo: ImageSourcePropType | null };
let config: Config = { fondo: MARCA.colores.primario, logo: null };

export function fijarPantallaCarga(c: Config) {
  config = c;
}

/** El ancho del logo: el mismo que la pantalla de arranque del sistema (imageWidth de app.json). */
export const ANCHO_LOGO_ARRANQUE = 240;
const ANCHO_BARRA = 160;

export function PantallaCarga() {
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const vuelta = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );
    vuelta.start();
    return () => vuelta.stop();
  }, [x]);
  return (
    <View
      testID="pantalla-carga"
      accessibilityLabel="Divoox"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: config.fondo,
      }}
    >
      {config.logo ? (
        <Image
          source={config.logo}
          resizeMode="contain"
          style={{ width: ANCHO_LOGO_ARRANQUE, height: ANCHO_LOGO_ARRANQUE / 3 }}
        />
      ) : null}
      <View
        testID="pantalla-carga-barra"
        style={{
          marginTop: 28,
          width: ANCHO_BARRA,
          height: 4,
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: 'rgba(255,255,255,0.25)',
        }}
      >
        <Animated.View
          style={{
            width: ANCHO_BARRA / 3,
            height: 4,
            borderRadius: 2,
            backgroundColor: MARCA.colores.exito,
            transform: [
              {
                translateX: x.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-ANCHO_BARRA / 3, ANCHO_BARRA],
                }),
              },
            ],
          }}
        />
      </View>
    </View>
  );
}
