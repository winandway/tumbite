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
  // C-CORREO-SIN-AUTOCORRECTOR (31 oct 2026, visto en el simulador de iPhone): un correo no se
  // corrige ni se subraya; el iPhone cambiaba lo escrito. Vale para toda casilla de correo.
  const correo = props.keyboardType === 'email-address';
  return (
    <View style={e.campo}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <TextInput
        {...(correo
          ? {
              autoCorrect: false,
              spellCheck: false,
              autoCapitalize: 'none' as const,
              textContentType: 'emailAddress' as const,
            }
          : {})}
        {...props}
        accessibilityLabel={etiqueta}
        style={[e.input, error ? e.inputError : null]}
        placeholderTextColor="#9A9A9A"
      />
      {error ? <Text style={e.error}>{error}</Text> : null}
    </View>
  );
}

/** Ojo de línea dibujado con vistas (sin emojis ni librerías nativas). Tachado = ocultar. */
function Ojo({ tachado }: { tachado: boolean }) {
  return (
    <View style={e.ojo}>
      <View style={e.ojoPupila} />
      {tachado ? <View style={e.ojoRaya} /> : null}
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
  alEnviar,
}: {
  etiqueta: string;
  error?: string;
  valor: string;
  cambiar: (v: string) => void;
  nueva?: boolean;
  /** La tecla «Ir»/Enter del teclado envía el formulario (como en cualquier app). */
  alEnviar?: () => void;
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
          onSubmitEditing={alEnviar}
          returnKeyType={alEnviar ? 'go' : undefined}
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
          <Ojo tachado={visible} />
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
  exito,
  logistica,
}: {
  texto: string;
  alTocar: () => void;
  cargando?: boolean;
  secundario?: boolean;
  /** Verde: aceptar, avanzar, terminar bien (regla «lo que sale bien va en verde»). */
  exito?: boolean;
  /** C-COLOR-LOGISTICA: botón de Flex y Envíos, con el color propio de logística. */
  logistica?: boolean;
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
        exito && !secundario && { backgroundColor: C.exito },
        logistica && !secundario && !exito && { backgroundColor: C.logisticaAccion },
        pressed && { opacity: 0.85 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text
          style={[
            e.botonTexto,
            secundario && { color: C.secundario },
            logistica && !secundario && !exito && { color: C.logisticaTexto },
          ]}
        >
          {texto}
        </Text>
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
  ojo: {
    width: 22,
    height: 14,
    borderWidth: 2,
    borderColor: '#5e5e5e',
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ojoPupila: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#5e5e5e' },
  ojoRaya: {
    position: 'absolute',
    width: 26,
    height: 2,
    backgroundColor: '#5e5e5e',
    transform: [{ rotate: '-35deg' }],
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
  // Sin franja gruesa al costado (regla de diseño de Richard, 12 oct 2026): borde fino y esquinas suaves.
  aviso: {
    backgroundColor: '#FFF1EE',
    borderWidth: 1,
    borderColor: '#F3CBC4',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  enlace: {
    color: C.secundario,
    textDecorationLine: 'underline',
    paddingVertical: 10,
    textAlign: 'center',
  },
  // Enlace dentro de una frase (sin márgenes propios).
  enlaceLinea: {
    color: C.secundario,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  tarjeta: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#101010',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
});
