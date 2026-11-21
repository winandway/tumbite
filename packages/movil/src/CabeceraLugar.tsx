import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';
import { Icono, type NombreIcono, Text } from './diseno';
import { C } from './ui';

/**
 * C-EDITAR-ES-EDITAR (21 nov 2026) — todos los países. La cabecera de las hojas de una dirección
 * (editar la dirección y las fotos de la entrada): fondo rojo de la marca, título y una línea de
 * ayuda en blanco, y a un lado el pin del mapa en su círculo blanco con un pulso suave y un camino
 * de puntos que llega hasta él. Sin degradados ni emojis (sistema de diseño de Divoox).
 */
export function CabeceraLugar({
  titulo,
  subtitulo,
  cerrar,
  etiquetaCerrar,
  volver,
  etiquetaVolver,
  icono = 'location',
  testID,
}: {
  titulo: string;
  subtitulo?: string;
  cerrar?: () => void;
  etiquetaCerrar?: string;
  volver?: () => void;
  etiquetaVolver?: string;
  icono?: NombreIcono;
  testID?: string;
}) {
  const [pulso] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const vuelta = Animated.loop(
      Animated.timing(pulso, {
        toValue: 1,
        duration: 1600,
        useNativeDriver: Platform.OS !== 'web',
      }),
    );
    vuelta.start();
    return () => vuelta.stop();
  }, [pulso]);

  const boton = (alTocar: () => void, etiqueta: string, nombre: NombreIcono, id: string) => (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      hitSlop={10}
      testID={id}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)',
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      <Icono nombre={nombre} tamano={20} color="#FFFFFF" />
    </Pressable>
  );

  return (
    <View
      testID={testID}
      style={{
        backgroundColor: C.primario,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 18,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 36 }}>
        {volver ? (
          boton(volver, etiquetaVolver ?? '', 'chevron-back', `${testID ?? 'cabecera'}-volver`)
        ) : (
          <View />
        )}
        {cerrar
          ? boton(cerrar, etiquetaCerrar ?? '', 'close', `${testID ?? 'cabecera'}-cerrar`)
          : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 24, lineHeight: 30, fontWeight: '700', color: '#FFFFFF' }}
          >
            {titulo}
          </Text>
          {subtitulo ? (
            <Text style={{ fontSize: 14, lineHeight: 20, color: '#FFFFFF', opacity: 0.92 }}>
              {subtitulo}
            </Text>
          ) : null}
        </View>
        {/* El camino de puntos que llega al pin (los «punticos»). */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
        >
          {[0.35, 0.55, 0.8].map((o) => (
            <View
              key={o}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#FFFFFF',
                opacity: o,
              }}
            />
          ))}
          <View style={{ width: 68, height: 68, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View
              style={{
                position: 'absolute',
                width: 68,
                height: 68,
                borderRadius: 34,
                backgroundColor: '#FFFFFF',
                opacity: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                transform: [
                  { scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.1] }) },
                ],
              }}
            />
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: '#FFFFFF',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOpacity: 0.18,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 4,
              }}
            >
              <Icono nombre={icono} tamano={30} color={C.primario} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
