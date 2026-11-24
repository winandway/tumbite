import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icono, Text } from './diseno';
import { Modal } from './Hoja';
import { COLOR, FUENTE } from './tokens';
import { Boton } from './ui';

/**
 * Tramo 1 (registro real de un mototaxista en Android, 23 nov 2026): la pregunta «Tomar foto / Subir
 * desde archivos» es una hoja PROPIA de Divoox (antes era la ventana gris del sistema, con letras
 * verdes sueltas). Lleva un consejo corto para fotografiar un documento. Una sola pieza para las tres
 * apps: cada una monta `<HojaFoto />` una vez en su raíz; si no está montada, se usa la del sistema.
 */
type Boton_ = { text: string; style?: 'cancel'; onPress: () => void };
type Pedido = {
  titulo: string;
  mensaje?: string;
  botones: Boton_[];
  alCerrar: () => void;
};

let mostrar: ((p: Pedido | null) => void) | null = null;

/** Misma firma que `Alert.alert`: la usa la pieza de la cámara (`preguntarOrigen`). */
export function alertaDivoox(
  titulo: string,
  mensaje: string | undefined,
  botones: Boton_[],
  opciones: { cancelable: boolean; onDismiss: () => void },
) {
  if (!mostrar) {
    Alert.alert(titulo, mensaje, botones, opciones);
    return;
  }
  mostrar({ titulo, mensaje, botones, alCerrar: opciones.onDismiss });
}

export function HojaFoto() {
  const [p, setP] = useState<Pedido | null>(null);
  useEffect(() => {
    mostrar = setP;
    return () => {
      if (mostrar === setP) mostrar = null;
    };
  }, []);
  if (!p) return null;
  const elegir = (b: Boton_) => {
    setP(null);
    b.onPress();
  };
  const cerrar = () => {
    setP(null);
    p.alCerrar();
  };
  const acciones = p.botones.filter((b) => b.style !== 'cancel');
  const cancelar = p.botones.find((b) => b.style === 'cancel');
  return (
    <Modal
      transparent
      visible
      animationType="slide"
      onRequestClose={cerrar}
      testID="hoja-foto-ventana"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={cancelar?.text}
        onPress={cerrar}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
      />
      <SafeAreaView
        edges={['bottom']}
        testID="hoja-foto"
        style={{
          backgroundColor: '#FFFFFF',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 12,
          gap: 12,
        }}
      >
        <Text accessibilityRole="header" style={{ fontFamily: FUENTE.titulo, fontSize: 20 }}>
          {p.titulo}
        </Text>
        {p.mensaje ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icono nombre="bulb-outline" tamano={20} color={COLOR.textoSuave} />
            <Text style={{ flex: 1, color: COLOR.textoSuave, fontSize: 14, lineHeight: 20 }}>
              {p.mensaje}
            </Text>
          </View>
        ) : null}
        {acciones.map((b, i) => (
          <Boton
            key={b.text}
            texto={b.text}
            icono={i === 0 ? 'camera-outline' : 'folder-open-outline'}
            secundario={i > 0}
            alTocar={() => elegir(b)}
            testID={i === 0 ? 'hoja-foto-camara' : 'hoja-foto-archivos'}
          />
        ))}
        {cancelar ? (
          <Pressable
            onPress={() => elegir(cancelar)}
            accessibilityRole="button"
            style={{ alignSelf: 'center', padding: 8 }}
          >
            <Text style={{ fontFamily: FUENTE.textoFuerte, textDecorationLine: 'underline' }}>
              {cancelar.text}
            </Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
