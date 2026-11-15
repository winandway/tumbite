import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * C-SOBRE-LOS-BOTONES (14 nov 2026, Richard, en un Xiaomi con Android 14) — todos los países.
 * En Android la app se dibuja de borde a borde, también DEBAJO de los botones del teléfono (atrás,
 * inicio y recientes) o de la barra de gestos. El menú de abajo quedaba tapado y no recibía el
 * toque. Esta pieza envuelve todas las pantallas de cada app y deja libre ese alto, pintado de
 * blanco: nada de la app queda debajo de los botones, en ninguna pantalla.
 *
 * Las pantallas de adentro ya no tienen que contar ese margen: se les entrega en cero, para que
 * ninguna lo sume dos veces. En iPhone no cambia nada (cada pantalla sigue como estaba).
 */
export function SobreLosBotones({ children }: { children: ReactNode }) {
  const bordes = useSafeAreaInsets();
  // El mismo árbol siempre en Android (aunque el alto llegue un instante después): así las
  // pantallas no se vuelven a montar.
  const android = Platform.OS === 'android';
  if (!android) return <>{children}</>;
  const abajo = bordes.bottom;
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingBottom: abajo }}>
      <SafeAreaInsetsContext.Provider value={{ ...bordes, bottom: 0 }}>
        {children}
      </SafeAreaInsetsContext.Provider>
    </View>
  );
}
