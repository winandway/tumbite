import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C, Icono, Modal, Text, useSesion } from '@tumbite/movil';

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
  // Un solo botón para cerrar, con nombre propio de esta hoja (no choca con otros «Cerrar»).
  const etiquetaCerrar =
    idioma === 'en'
      ? titulo
        ? `Close ${titulo}`
        : 'Close options'
      : titulo
        ? `Cerrar ${titulo}`
        : 'Cerrar las opciones';
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
          // El fondo oscuro cierra al tocarlo, pero no es un botón para el lector de pantalla (se
          // cierra con «atrás»): así no hay dos «Cerrar» con el mismo nombre en la pantalla.
          accessible={false}
          importantForAccessibility="no-hide-descendants"
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
          // VoiceOver: el gesto de «escape» (dos dedos en Z) cierra la hoja; el foco queda dentro.
          onAccessibilityEscape={alCerrar}
          accessibilityViewIsModal
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
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ flex: 1 }}>
              {titulo ? (
                <Text
                  accessibilityRole="header"
                  style={{ fontSize: 22, fontWeight: '700', color: C.secundario, marginBottom: 12 }}
                >
                  {titulo}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={alCerrar}
              accessibilityRole="button"
              accessibilityLabel={etiquetaCerrar}
              hitSlop={8}
              testID="hoja-cerrar"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: '#F6F6F6',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icono nombre="close" tamano={20} color={C.secundario} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
