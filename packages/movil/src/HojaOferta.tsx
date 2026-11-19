import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal } from './Hoja';

/**
 * C-HOJA-OFERTA (paquete 13, 19 nov 2026) — todos los países. La hoja de una oferta para el
 * conductor (viaje en moto o carro, envío, pedido de comida), como en Uber Driver y DoorDash Dasher:
 *
 * - `arriba`, siempre a la vista: el título, la cuenta atrás y lo que gana (C-PRECIO-PROTAGONISTA);
 * - `children`, en el medio: lo demás (cobro en mano, regalo, mapa, distancias, direcciones). Si no
 *   cabe (pantalla baja, letra grande del sistema), se desplaza POR DENTRO;
 * - `abajo`, siempre a la vista: Aceptar y Rechazar.
 *
 * En Android la ventana del Modal se dibuja de borde a borde: la hoja deja libre el alto de la barra
 * de estado y el de los botones del teléfono. La ventana del Modal mide aparte, por eso lleva su propio
 * `SafeAreaProvider` (así lo indica react-native-safe-area-context para los Modal de Android).
 */
export function HojaOferta({
  testID,
  alCerrar,
  arriba,
  abajo,
  children,
}: {
  testID: string;
  /** El botón «atrás» de Android: rechaza la oferta. */
  alCerrar: () => void;
  arriba: ReactNode;
  abajo: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={alCerrar}
    >
      <SafeAreaProvider>
        <Contenido testID={testID} arriba={arriba} abajo={abajo}>
          {children}
        </Contenido>
      </SafeAreaProvider>
    </Modal>
  );
}

function Contenido({
  testID,
  arriba,
  abajo,
  children,
}: {
  testID: string;
  arriba: ReactNode;
  abajo: ReactNode;
  children?: ReactNode;
}) {
  const bordes = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'rgba(25,25,25,0.55)',
        justifyContent: 'flex-end',
        // Nunca encima del reloj ni de la batería: deja la barra de estado y un respiro.
        paddingTop: bordes.top + 12,
      }}
    >
      <View
        testID={testID}
        style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          paddingTop: 20,
          paddingHorizontal: 20,
          paddingBottom: 12 + bordes.bottom,
          maxHeight: '100%',
        }}
      >
        <View style={{ gap: 10, paddingBottom: 10 }}>{arriba}</View>
        <ScrollView
          testID={`${testID}-medio`}
          style={{ flexGrow: 0, flexShrink: 1 }}
          contentContainerStyle={{ gap: 10, paddingBottom: 4 }}
          showsVerticalScrollIndicator
        >
          {children}
        </ScrollView>
        <View style={{ gap: 6, paddingTop: 10 }}>{abajo}</View>
      </View>
    </View>
  );
}
