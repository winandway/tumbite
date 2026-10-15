import { Modal, Pressable, Text, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { Boton, C } from '@tumbite/movil';
import { textosDriver } from './textos';

/** «Muy pronto»: para lo que todavía no existe (mis lugares, preferencias, avisos). Nada falso. */
export function ModalMuyPronto({
  visible,
  cerrar,
  idioma,
}: {
  visible: boolean;
  cerrar: () => void;
  idioma: Idioma;
}) {
  const t = textosDriver(idioma);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrar}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(25,25,25,0.45)',
          justifyContent: 'center',
          padding: 24,
        }}
        onPress={cerrar}
        accessibilityLabel={t.entendido}
      >
        <Pressable
          onPress={() => undefined}
          style={{ backgroundColor: '#fff', borderRadius: 20, padding: 22, alignItems: 'center' }}
          accessibilityViewIsModal
        >
          <Text
            style={{ fontSize: 20, fontWeight: '800', color: C.secundario, textAlign: 'center' }}
          >
            {t.prontoTitulo}
          </Text>
          <Text style={{ color: '#5E5E5E', marginTop: 8, textAlign: 'center' }}>
            {t.prontoTexto}
          </Text>
          <View style={{ alignSelf: 'stretch', marginTop: 14 }}>
            <Boton texto={t.entendido} alTocar={cerrar} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
