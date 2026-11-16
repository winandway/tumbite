import { createContext, useContext, useState, type ReactNode } from 'react';
import { Text } from './diseno';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MARCA, enIdioma } from '@tumbite/compartido';
import { SelectorIdioma } from './SelectorIdioma';
import { useSesion } from './sesion';
import { TEXTOS_MOVIL } from './textos';
import { Icono } from './diseno';
import { ALTO, COLOR, ESPACIO, FUENTE, RADIO, SOMBRA } from './tokens';

export const C = MARCA.colores;

/**
 * C-APPS-DISENO: el color de acción de cada app. El Driver va con el azul de logística (su color);
 * el cliente y Restaurants, con el rojo de la marca. Lo pone la raíz de cada app.
 */
const AcentoApp = createContext<'marca' | 'logistica'>('marca');
export function TemaApp({
  acento,
  children,
}: {
  acento: 'marca' | 'logistica';
  children: ReactNode;
}) {
  return <AcentoApp.Provider value={acento}>{children}</AcentoApp.Provider>;
}
export const useAcentoApp = () => useContext(AcentoApp);

export function Pantalla({
  titulo,
  children,
  scroll = true,
  volver,
}: {
  titulo?: string;
  children: ReactNode;
  scroll?: boolean;
  /** C-ENTRAR-CON-SALIDA: con esto, la cabecera lleva la flecha «Volver» a la izquierda. */
  volver?: () => void;
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {volver ? (
            <Pressable
              testID="cabecera-volver"
              onPress={volver}
              accessibilityRole="button"
              accessibilityLabel={enIdioma(TEXTOS_MOVIL, idioma).volver}
              hitSlop={12}
              style={{ paddingRight: 6 }}
            >
              <View style={e.volver}>
                <Icono nombre="chevron-back" tamano={22} />
              </View>
            </Pressable>
          ) : null}
          <Text style={e.marca}>{MARCA.nombre}</Text>
        </View>
        <SelectorIdioma idioma={idioma} cambiar={cambiarIdioma} sobreClaro />
      </View>
      {scroll ? (
        <ScrollView
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={e.contenido}
          keyboardShouldPersistTaps="handled"
        >
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
  nombreAccesible,
  ...props
}: TextInputProps & { etiqueta: string; error?: string; nombreAccesible?: string }) {
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
        // Lo que se lee en voz alta puede llevar más contexto que la etiqueta visible
        // («Abre · Lunes»), sin repetirlo en pantalla.
        accessibilityLabel={nombreAccesible ?? etiqueta}
        style={[e.input, error ? e.inputError : null]}
        placeholderTextColor={COLOR.textoTenue}
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
  oscuro,
  enFila,
}: {
  texto: string;
  alTocar: () => void;
  cargando?: boolean;
  secundario?: boolean;
  /** Verde: aceptar, avanzar, terminar bien (regla «lo que sale bien va en verde»). */
  exito?: boolean;
  /** C-COLOR-LOGISTICA: botón de Flex y Envíos, con el color propio de logística. */
  logistica?: boolean;
  /** C-FLEX-OSCURO: sobre fondo oscuro, el secundario va con borde azul claro, sin fondo blanco. */
  oscuro?: boolean;
  /**
   * C-BOTON-EN-FILA (15 nov 2026): el botón que va al lado de una casilla («Verificar», «Enviar»).
   * Toma el ancho de su palabra y nunca la parte en dos renglones (en el iPhone «Verificar» salía
   * como «Verifica» y «r»). PROHIBIDO meter un Boton en una caja de ancho fijo: se usa esto.
   */
  enFila?: boolean;
}) {
  const acento = useAcentoApp();
  const azul = acento === 'logistica' && !exito && !logistica && !secundario;
  return (
    <Pressable
      onPress={alTocar}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={texto}
      style={({ pressed }) => [
        e.boton,
        enFila && e.botonEnFila,
        secundario && e.botonSecundario,
        exito && !secundario && { backgroundColor: C.exito },
        logistica && !secundario && !exito && { backgroundColor: C.logisticaAccion },
        azul && { backgroundColor: COLOR.logistica },
        oscuro &&
          secundario && {
            backgroundColor: 'transparent',
            borderColor: C.logisticaAccion,
            borderWidth: 1.5,
          },
        pressed && { opacity: 0.85 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={secundario ? COLOR.texto : '#fff'} />
      ) : (
        <Text
          // En fila: una sola línea, con el ancho que pida la palabra (también en inglés y con
          // letra grande del sistema); la casilla de al lado es la que cede.
          numberOfLines={enFila ? 1 : undefined}
          style={[
            e.botonTexto,
            secundario && { color: C.secundario },
            oscuro && secundario && { color: C.logisticaAccion },
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
  fondo: { flex: 1, backgroundColor: COLOR.fondo },
  // C-APPS-DISENO: cabecera blanca con línea fina (dirección «A · Clara»), como Uber Eats y DoorDash.
  cabecera: {
    backgroundColor: COLOR.blanco,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ESPACIO.l,
    minHeight: ALTO.encabezado,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.bordeFuerte,
  },
  volver: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLOR.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marca: { color: COLOR.marca, fontSize: 22, fontFamily: FUENTE.titulo, letterSpacing: -0.3 },
  banderas: { flexDirection: 'row', gap: 6 },
  bandera: { borderWidth: 2, borderColor: 'transparent', borderRadius: 8, paddingHorizontal: 4 },
  banderaActiva: { borderColor: '#FFFFFF' },
  contenido: { padding: ESPACIO.l, gap: 4 },
  titulo: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: FUENTE.titulo,
    color: COLOR.texto,
    marginBottom: ESPACIO.m,
  },
  campo: { marginBottom: ESPACIO.l },
  etiqueta: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: COLOR.texto },
  input: {
    backgroundColor: COLOR.blanco,
    borderWidth: 1,
    borderColor: COLOR.bordeFuerte,
    borderRadius: RADIO.m,
    minHeight: ALTO.campo,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: FUENTE.texto,
    color: COLOR.texto,
  },
  inputError: { borderColor: COLOR.error },
  error: { color: COLOR.error, marginTop: 4, fontSize: 13 },
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
    borderColor: COLOR.textoSuave,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ojoPupila: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLOR.textoSuave },
  ojoRaya: {
    position: 'absolute',
    width: 26,
    height: 2,
    backgroundColor: COLOR.textoSuave,
    transform: [{ rotate: '-35deg' }],
  },
  // Botón píldora de 52 de alto con letra Poppins, como el de Uber Eats y DoorDash.
  boton: {
    backgroundColor: COLOR.marca,
    borderRadius: RADIO.pildora,
    minHeight: ALTO.boton,
    paddingHorizontal: ESPACIO.xl,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 6,
  },
  botonEnFila: { flexShrink: 0, flexGrow: 0, minWidth: 96, paddingHorizontal: 18 },
  botonSecundario: {
    backgroundColor: COLOR.blanco,
    borderWidth: 1,
    borderColor: COLOR.bordeFuerte,
  },
  botonTexto: { color: COLOR.blanco, fontFamily: FUENTE.tituloMedio, fontSize: 16, lineHeight: 20 },
  // Sin franja gruesa al costado (regla de diseño de Richard, 12 oct 2026): borde fino y esquinas suaves.
  aviso: {
    backgroundColor: COLOR.marcaSuave,
    borderWidth: 1,
    borderColor: '#F6C7CC',
    borderRadius: RADIO.m,
    padding: ESPACIO.m,
    marginBottom: ESPACIO.m,
  },
  enlace: {
    color: COLOR.texto,
    textDecorationLine: 'underline',
    fontWeight: '600',
    paddingVertical: 12,
    textAlign: 'center',
  },
  // Enlace dentro de una frase (sin márgenes propios).
  enlaceLinea: {
    color: COLOR.texto,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  tarjeta: {
    backgroundColor: COLOR.blanco,
    borderRadius: RADIO.m,
    borderWidth: 1,
    borderColor: COLOR.borde,
    padding: ESPACIO.l,
    marginBottom: ESPACIO.m,
    ...SOMBRA.tarjeta,
  },
});
