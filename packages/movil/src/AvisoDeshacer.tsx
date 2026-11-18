import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Icono, Text } from './diseno';
import { faseDe, useReducirMovimiento, useRelojBucle } from './movimiento';
import { MOVIMIENTO } from './serviciosLogica';
import { COLOR, FUENTE, RADIO, SOMBRA } from './tokens';

/**
 * C-SERVICIOS-CONECTADOS (DRIVER.md §3): el aviso tinta de abajo al desconectar un servicio. Sin
 * tapar nada, por 5 s, y se anuncia al lector de pantalla.
 * C-CONECTAR-DESLIZANDO (revisor, 18 nov 2026): en Driver es SOLO informativo («Comida desconectada.
 * Lo demás sigue conectado. Para volver, desliza su tarjeta.»): un «Deshacer» de un toque reconectaba
 * con el celular en el bolsillo. El botón existe solo si quien lo usa pasa `alDeshacer`.
 */
export function AvisoDeshacer({
  visible,
  titulo,
  texto,
  deshacer,
  alDeshacer,
  alCerrar,
  testID = 'aviso-deshacer',
}: {
  visible: boolean;
  /** «Comida desconectada.» (en negrita). */
  titulo: string;
  /** «Lo demás sigue conectado.» */
  texto: string;
  deshacer?: string;
  alDeshacer?: () => void;
  alCerrar: () => void;
  testID?: string;
}) {
  const cerrar = useRef(alCerrar);
  useEffect(() => {
    cerrar.current = alCerrar;
  });
  useEffect(() => {
    if (!visible) return;
    const reloj = setTimeout(() => cerrar.current(), MOVIMIENTO.avisoDeshacer);
    return () => clearTimeout(reloj);
  }, [visible, titulo]);
  if (!visible) return null;
  return (
    <View
      testID={testID}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16,
          zIndex: 20,
          backgroundColor: COLOR.negro,
          borderRadius: RADIO.l,
          paddingVertical: 14,
          paddingHorizontal: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        },
        SOMBRA.flotante,
      ]}
    >
      <Icono nombre="checkmark" tamano={20} color={COLOR.enLinea} />
      <Text style={{ flex: 1, color: COLOR.blanco, fontSize: 14, lineHeight: 20 }}>
        <Text style={{ fontFamily: FUENTE.textoNegrita, color: COLOR.blanco }}>{titulo}</Text>{' '}
        {texto}
      </Text>
      {alDeshacer && deshacer ? (
        <Pressable
          onPress={alDeshacer}
          accessibilityRole="button"
          accessibilityLabel={deshacer}
          hitSlop={10}
          testID={`${testID}-boton`}
        >
          <Text
            style={{
              fontFamily: FUENTE.tituloMedio,
              fontSize: 15,
              color: COLOR.blanco,
              textDecorationLine: 'underline',
            }}
          >
            {deshacer}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Radar de arriba: tres anillos verdes que salen del punto (2,4 s, desfases −1,6 y −0,8). */
export function Radar({ tamano = 64 }: { tamano?: number }) {
  const reducir = useReducirMovimiento();
  const reloj = useRelojBucle(!reducir);
  const punto = tamano * 0.34;
  return (
    <View
      style={{ width: tamano, height: tamano, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* Aro fijo, para que el radar se lea quieto con «reducir movimiento». */}
      <View
        style={{
          position: 'absolute',
          width: tamano * 0.66,
          height: tamano * 0.66,
          borderRadius: tamano,
          borderWidth: 2,
          borderColor: 'rgba(29,185,84,0.45)',
        }}
      />
      {!reducir
        ? MOVIMIENTO.radarRetrasos.map((retraso) => {
            const f = faseDe(reloj, MOVIMIENTO.radar, retraso, 0, 1);
            return (
              <Animated.View
                key={retraso}
                style={{
                  position: 'absolute',
                  width: tamano,
                  height: tamano,
                  borderRadius: tamano,
                  borderWidth: 2,
                  borderColor: COLOR.exitoVivo,
                  opacity: f.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                  transform: [
                    { scale: f.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) },
                  ],
                }}
              />
            );
          })
        : null}
      <View
        style={{
          width: punto,
          height: punto,
          borderRadius: punto,
          backgroundColor: COLOR.exitoVivo,
        }}
      />
    </View>
  );
}
