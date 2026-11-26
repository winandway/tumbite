import { useEffect, useMemo } from 'react';
import { BackHandler, PanResponder, Platform, Pressable } from 'react-native';
import { Text } from './diseno';
import { COLOR } from './tokens';

/**
 * C-SIN-CALLEJON (19 nov 2026, orden de Richard) — todos los países. En Driver, desde «Crear cuenta»
 * no había forma de volver a «Entrar»: el único enlace quedaba al final de un formulario largo,
 * debajo del teclado. Una sola pieza para toda pantalla de antes de iniciar sesión, en las tres
 * apps: la flecha de volver arriba y el gesto del sistema (el botón atrás de Android y deslizar
 * desde el borde izquierdo en iPhone).
 */
export function EncabezadoVolver({
  texto,
  alVolver,
  claro,
}: {
  texto: string;
  alVolver: () => void;
  /** Sobre la franja de color de la app (C-ACCESO-CON-CABECERA): flecha y texto en blanco. */
  claro?: boolean;
}) {
  const color = claro ? '#FFFFFF' : COLOR.negro;
  return (
    <Pressable
      testID="volver-a-entrar"
      onPress={alVolver}
      accessibilityRole="button"
      accessibilityLabel={texto}
      hitSlop={12}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingVertical: 8,
        marginBottom: 4,
      }}
    >
      <Text style={{ fontSize: 22, lineHeight: 24, color }}>←</Text>
      <Text style={{ fontSize: 15, fontWeight: '700', color }}>{texto}</Text>
    </Pressable>
  );
}

/**
 * El gesto de volver del sistema mientras `activo`: el botón atrás de Android, y en iPhone deslizar
 * desde el borde izquierdo (los manejadores se ponen en la vista que envuelve la pantalla).
 */
export function useVolverDelSistema(activo: boolean, alVolver: () => void) {
  useEffect(() => {
    if (!activo) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      alVolver();
      return true;
    });
    return () => sub.remove();
  }, [activo, alVolver]);
  return useMemo(
    () =>
      Platform.OS === 'ios' && activo
        ? PanResponder.create({
            // Solo un arrastre que nace pegado al borde izquierdo y va hacia la derecha.
            onMoveShouldSetPanResponder: (ev, g) =>
              ev.nativeEvent.pageX - g.dx < 28 && g.dx > 14 && Math.abs(g.dy) < 24,
            onPanResponderRelease: (_ev, g) => {
              if (g.dx > 70) alVolver();
            },
          }).panHandlers
        : {},
    [activo, alVolver],
  );
}
