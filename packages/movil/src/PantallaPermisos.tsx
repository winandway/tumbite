import { Modal, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { Boton, C } from './ui';

/**
 * C-PERMISOS-EXPLICADOS (31 oct 2026, como «Otorga permisos» de DoorDash): antes de las ventanas del
 * sistema, una pantalla dice para qué es cada permiso. Al tocar «Estoy listo» se piden.
 */
export type Permiso = { titulo: string; porque: string };

const T = {
  es: {
    titulo: 'Otorga permisos para trabajar sin problemas',
    sub: 'Necesitamos tu ayuda para habilitar lo siguiente. Después tu teléfono te los pide uno por uno.',
    listo: 'Estoy listo',
  },
  en: {
    titulo: 'Allow permissions to work smoothly',
    sub: 'We need your help to turn on the following. Your phone will ask for each one next.',
    listo: 'I’m ready',
  },
};

export function PantallaPermisos({
  visible,
  idioma,
  permisos,
  alAceptar,
}: {
  visible: boolean;
  idioma: Idioma;
  permisos: Permiso[];
  alAceptar: () => void;
}) {
  const t = enIdioma(T, idioma);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={alAceptar}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
          <Text
            accessibilityRole="header"
            style={{ fontSize: 26, fontWeight: '900', color: C.secundario }}
          >
            {t.titulo}
          </Text>
          <Text style={{ color: '#5E5E5E' }}>{t.sub}</Text>
          {permisos.map((p) => (
            <View
              key={p.titulo}
              style={{ borderBottomWidth: 1, borderBottomColor: '#ECECEC', paddingVertical: 10 }}
            >
              <Text style={{ fontWeight: '800', color: C.secundario }}>{p.titulo}</Text>
              <Text style={{ color: '#5E5E5E', marginTop: 2 }}>{p.porque}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={{ padding: 20 }}>
          <Boton texto={t.listo} alTocar={alAceptar} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
