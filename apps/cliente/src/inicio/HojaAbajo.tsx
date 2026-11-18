import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, Modal, Text, useSesion } from '@tumbite/movil';

/**
 * C-INICIO-NUEVO: hoja que sube desde abajo con su asa, como el borrador («Más servicios», «Nuevo
 * lugar», opciones de un lugar). Se cierra tocando afuera o con «atrás». Nunca tapa toda la pantalla.
 */
export function HojaAbajo({
  visible,
  alCerrar,
  titulo,
  testID,
  children,
}: {
  visible: boolean;
  alCerrar: () => void;
  titulo?: string;
  testID?: string;
  children: ReactNode;
}) {
  const borde = useSafeAreaInsets().bottom;
  const { idioma } = useSesion();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={alCerrar}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={alCerrar}
          accessibilityRole="button"
          accessibilityLabel={idioma === 'en' ? 'Close' : 'Cerrar'}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(16,16,16,0.45)',
          }}
        />
        <View
          style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingHorizontal: 16,
            paddingTop: 10,
            paddingBottom: 16 + borde,
            maxHeight: '88%',
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
          }}
        >
          <View
            style={{
              alignSelf: 'center',
              width: 40,
              height: 5,
              borderRadius: 3,
              backgroundColor: '#D6D8DC',
              marginBottom: 12,
            }}
          />
          {titulo ? (
            <Text
              accessibilityRole="header"
              style={{ fontSize: 22, fontWeight: '700', color: C.secundario, marginBottom: 12 }}
            >
              {titulo}
            </Text>
          ) : null}
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
