import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MARCA, enIdioma } from '@tumbite/compartido';
import { SelectorIdioma } from './SelectorIdioma';
import { useSesion } from './sesion';
import { TEXTOS_MOVIL } from './textos';

export const C = MARCA.colores;

export function Pantalla({
  titulo,
  children,
  scroll = true,
}: {
  titulo?: string;
  children: ReactNode;
  scroll?: boolean;
}) {
  const { idioma, cambiarIdioma } = useSesion();
  const cuerpo = (
    <>
      {titulo && <Text style={e.titulo}>{titulo}</Text>}
      {children}
    </>
  );
  return (
    <SafeAreaView style={e.fondo} edges={['top', 'left', 'right']}>
      <View style={e.cabecera}>
        <Text style={e.marca}>{MARCA.nombre}</Text>
        <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} />
      </View>
      {scroll ? (
        <ScrollView contentContainerStyle={e.contenido} keyboardShouldPersistTaps="handled">
          {cuerpo}
        </ScrollView>
      ) : (
        <View style={[e.contenido, { flex: 1 }]}>{cuerpo}</View>
      )}
    </SafeAreaView>
  );
}

export function Campo({
  etiqueta,
  error,
  ...props
}: TextInputProps & { etiqueta: string; error?: string }) {
  return (
    <View style={e.campo}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <TextInput
        {...props}
        accessibilityLabel={etiqueta}
        style={[e.input, error ? e.inputError : null]}
        placeholderTextColor="#9A9A9A"
      />
      {error ? <Text style={e.error}>{error}</Text> : null}
    </View>
  );
}

/** Contraseña con ojito. Arranca oculta. Todas las pantallas usan esta. */
export function CampoClave({
  etiqueta,
  error,
  valor,
  cambiar,
  nueva,
}: {
  etiqueta: string;
  error?: string;
  valor: string;
  cambiar: (v: string) => void;
  nueva?: boolean;
}) {
  const { idioma } = useSesion();
  const t = enIdioma(TEXTOS_MOVIL, idioma);
  const [visible, setVisible] = useState(false);
  return (
    <View style={e.campo}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <View>
        <TextInput
          value={valor}
          onChangeText={cambiar}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoComplete={nueva ? 'new-password' : 'current-password'}
          textContentType={nueva ? 'newPassword' : 'password'}
          accessibilityLabel={etiqueta}
          style={[e.input, { paddingRight: 52 }, error ? e.inputError : null]}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? t.ocultarClave : t.verClave}
          style={e.ojito}
          hitSlop={8}
        >
          <Text style={{ fontSize: 20 }}>{visible ? '🙈' : '👁'}</Text>
        </Pressable>
      </View>
      {error ? <Text style={e.error}>{error}</Text> : null}
    </View>
  );
}

export function Boton({
  texto,
  alTocar,
  cargando,
  secundario,
}: {
  texto: string;
  alTocar: () => void;
  cargando?: boolean;
  secundario?: boolean;
}) {
  return (
    <Pressable
      onPress={alTocar}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => [
        e.boton,
        secundario && e.botonSecundario,
        pressed && { opacity: 0.85 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[e.botonTexto, secundario && { color: C.secundario }]}>{texto}</Text>
      )}
    </Pressable>
  );
}

export const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: C.fondo },
  cabecera: {
    backgroundColor: C.primario,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  marca: { color: '#fff', fontSize: 22, fontWeight: '800' },
  banderas: { flexDirection: 'row', gap: 6 },
  bandera: { borderWidth: 2, borderColor: 'transparent', borderRadius: 8, paddingHorizontal: 4 },
  banderaActiva: { borderColor: '#FFFFFF' },
  contenido: { padding: 16, gap: 4 },
  titulo: { fontSize: 26, fontWeight: '800', color: C.secundario, marginBottom: 12 },
  campo: { marginBottom: 14 },
  etiqueta: { fontWeight: '600', marginBottom: 6, color: C.texto },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D6D6D6',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: C.texto,
  },
  inputError: { borderColor: '#c4001d' },
  error: { color: '#c4001d', marginTop: 4 },
  ojito: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  boton: {
    backgroundColor: C.primario,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginVertical: 6,
  },
  botonSecundario: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#D6D6D6' },
  botonTexto: { color: '#fff', fontWeight: '700', fontSize: 16 },
  aviso: {
    backgroundColor: '#FFF1EE',
    borderLeftWidth: 4,
    borderLeftColor: C.acento,
    padding: 10,
    marginBottom: 12,
  },
  enlace: {
    color: C.secundario,
    textDecorationLine: 'underline',
    paddingVertical: 10,
    textAlign: 'center',
  },
  tarjeta: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#191919',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
});
