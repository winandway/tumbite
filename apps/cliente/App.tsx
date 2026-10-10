import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { IDIOMAS, MARCA, type Idioma, t } from '@tumbite/compartido';

/** Pantalla de bienvenida. Las pantallas reales llegan en los pasos siguientes del plan. */
export default function App() {
  const [idioma, setIdioma] = useState<Idioma>('es');

  return (
    <View style={estilos.fondo}>
      <StatusBar style="light" />
      <View style={estilos.idiomas}>
        {IDIOMAS.map((i) => (
          <Pressable
            key={i.codigo}
            onPress={() => setIdioma(i.codigo)}
            accessibilityRole="button"
            accessibilityLabel={i.nombre}
            accessibilityState={{ selected: idioma === i.codigo }}
            style={[estilos.bandera, idioma === i.codigo && estilos.banderaActiva]}
          >
            <Text style={estilos.banderaTexto}>{i.bandera}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={estilos.marca}>{MARCA.nombre}</Text>
      <Text style={estilos.subtitulo}>{t(idioma, 'app.cliente')}</Text>
      <Text style={estilos.lema}>{t(idioma, 'bienvenida')}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: MARCA.colores.secundario,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  idiomas: { position: 'absolute', top: 60, right: 20, flexDirection: 'row', gap: 8 },
  bandera: { borderWidth: 2, borderColor: 'transparent', borderRadius: 8, padding: 4 },
  banderaActiva: { borderColor: MARCA.colores.acento },
  banderaTexto: { fontSize: 24 },
  marca: { color: MARCA.colores.primario, fontSize: 48, fontWeight: '800' },
  subtitulo: { color: MARCA.colores.acento, fontSize: 20, fontWeight: '700', marginTop: 8 },
  lema: { color: MARCA.colores.fondo, fontSize: 16, marginTop: 16, textAlign: 'center' },
});
