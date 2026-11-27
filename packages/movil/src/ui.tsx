import { createContext, useContext, useState, type ComponentProps, type ReactNode } from 'react';
import { Text } from './diseno';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MARCA,
  alEscribir,
  enIdioma,
  errorCasilla,
  tecladoDe,
  type TipoCasilla,
} from '@tumbite/compartido';
import { SelectorIdioma } from './SelectorIdioma';
import { useSesion, useSesionOpcional } from './sesion';
import { TEXTOS_MOVIL } from './textos';
import { Icono, type NombreIcono } from './diseno';
import { ALTO, COLOR, ESPACIO, FUENTE, RADIO, estiloBoton, type TipoBoton } from './tokens';
import { COLOR_TEXTO_DE_FONDO } from './tokens';

export const C = MARCA.colores;

/**
 * C-APPS-DISENO + fase cero (16 nov 2026): el color de acción. Las tres apps van con el rojo de la
 * marca (C-UN-SOLO-ROJO); 'logistica' existe solo para envolver pantallas de Flex y Envíos.
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

/**
 * C-CASILLA-CON-SU-TIPO (27 nov 2026): el ícono pequeño de cada tipo de casilla, dentro de ella a la
 * izquierda, todos del mismo juego de línea, para entender la casilla de un vistazo.
 */
export const ICONO_CASILLA: Readonly<Record<TipoCasilla, NombreIcono>> = {
  nombre: 'person-outline',
  nombreCompleto: 'person-outline',
  celular: 'call-outline',
  correo: 'mail-outline',
  documento: 'id-card-outline',
  placa: 'car-outline',
  anioVehiculo: 'calendar-outline',
  monto: 'cash-outline',
  direccion: 'location-outline',
};

export function Campo({
  etiqueta,
  error,
  nombreAccesible,
  tipo,
  pais,
  obligatorio,
  icono,
  ...props
}: TextInputProps & {
  etiqueta: string;
  error?: string;
  nombreAccesible?: string;
  /**
   * C-CASILLA-CON-SU-TIPO: qué dato lleva la casilla. Con él vienen su teclado (numérico para el
   * celular y el año, de correo para el correo, mayúsculas para la placa), su ícono, lo que nunca
   * entra al escribir (letras en el celular) y el aviso debajo, en palabras, al salir de la casilla.
   * Lo escrito nunca se borra.
   */
  tipo?: TipoCasilla;
  /** País para el celular, el documento y la placa. */
  pais?: string | null;
  /** Vacío también se avisa al salir. */
  obligatorio?: boolean;
  /** Un ícono propio (o `null` para ninguno) en lugar del del tipo. */
  icono?: NombreIcono | null;
}) {
  const sesion = useSesionOpcional();
  const [tocado, setTocado] = useState(false);
  // C-CORREO-SIN-AUTOCORRECTOR (31 oct 2026, visto en el simulador de iPhone): un correo no se
  // corrige ni se subraya; el iPhone cambiaba lo escrito. Vale para toda casilla de correo.
  const correo = tipo === 'correo' || props.keyboardType === 'email-address';
  const teclado = tipo ? tecladoDe(tipo) : null;
  const nombreIcono =
    icono === undefined
      ? tipo
        ? (new Map(Object.entries(ICONO_CASILLA)).get(tipo) ?? null)
        : null
      : icono;
  // El aviso propio de la casilla, al salir de ella; el que llega de afuera (servidor, «Siguiente»)
  // manda siempre.
  const propio =
    tipo && tocado && typeof props.value === 'string'
      ? errorCasilla(tipo, props.value, {
          idioma: sesion?.idioma ?? 'es',
          pais,
          obligatorio: Boolean(obligatorio),
        })
      : null;
  const aviso = error ?? propio ?? undefined;
  const alCambiar = props.onChangeText;
  return (
    <View style={e.campo}>
      <Text style={e.etiqueta}>{etiqueta}</Text>
      <View>
        <TextInput
          {...(teclado
            ? {
                keyboardType: teclado.keyboardType,
                autoCapitalize: teclado.autoCapitalize,
                autoCorrect: teclado.autoCorrect,
                maxLength: teclado.maxLength,
                ...(teclado.autoComplete ? { autoComplete: teclado.autoComplete } : {}),
              }
            : {})}
          {...(correo
            ? {
                autoCorrect: false,
                spellCheck: false,
                autoCapitalize: 'none' as const,
                textContentType: 'emailAddress' as const,
              }
            : {})}
          {...props}
          onChangeText={
            alCambiar ? (x: string) => alCambiar(tipo ? alEscribir(tipo, x) : x) : undefined
          }
          onBlur={(ev) => {
            // C-CASILLA-CON-SU-TIPO: el aviso propio sale un instante DESPUÉS de salir de la casilla. Si
            // saliera de inmediato, empujaría hacia abajo el botón que se está tocando («Siguiente») y
            // ese toque se perdería (visto en el recorrido del 27 nov 2026).
            setTimeout(() => setTocado(true), 250);
            props.onBlur?.(ev);
          }}
          // Lo que se lee en voz alta puede llevar más contexto que la etiqueta visible
          // («Abre · Lunes»), sin repetirlo en pantalla.
          accessibilityLabel={nombreAccesible ?? etiqueta}
          style={[
            e.input,
            nombreIcono ? { paddingLeft: 44 } : null,
            aviso ? e.inputError : null,
            props.style,
          ]}
          placeholderTextColor={COLOR.textoTenue}
        />
        {nombreIcono ? (
          <View style={e.iconoCasilla} testID={`icono-${tipo ?? 'casilla'}`}>
            <Icono
              nombre={nombreIcono}
              tamano={20}
              color={aviso ? COLOR.error : COLOR.textoSuave}
            />
          </View>
        ) : null}
      </View>
      {aviso ? (
        <Text style={e.error} accessibilityRole="alert">
          {aviso}
        </Text>
      ) : null}
    </View>
  );
}

/** Ojo de línea dibujado con vistas (sin emojis ni librerías nativas). Tachado = ocultar. */
function Ojo({ tachado }: { tachado: boolean }) {
  return <Icono nombre={tachado ? 'eye-off-outline' : 'eye-outline'} color={COLOR.textoSuave} />;
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
          placeholderTextColor={COLOR_TEXTO_DE_FONDO}
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

/**
 * C-BOTON-EN-FILA: una casilla con su botón al lado (y, si hace falta, algo más en medio). La
 * casilla es la que cede (`CASILLA_EN_FILA`: crece y puede encogerse hasta cero); el botón va con
 * `enFila` y nunca se encoge ni parte su palabra. Sin `minWidth: 0`, en el teléfono la casilla
 * pedía su ancho natural y empujaba el botón fuera de la tarjeta («Enviar» del chat, 16 nov 2026).
 */
export const CASILLA_EN_FILA = { flex: 1, minWidth: 0 } as const;
export function FilaConBoton({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', minWidth: 0 },
        style,
      ]}
    >
      {children}
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
  tipo,
  icono,
  testID,
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
  /**
   * Fase cero (sección 5 del sistema de diseño): 'principal' rojo (uno por pantalla), 'fuerte' tinta
   * («Pedir la misma ruta», «Repetir»), 'terciario' gris («Agregar parada», «Cambiar algo») y 'borde'
   * para las salidas («Cancelar el viaje»). `secundario` equivale a 'borde'.
   */
  tipo?: TipoBoton;
  /** Ícono de línea a la izquierda del texto. */
  icono?: ComponentProps<typeof Icono>['nombre'];
  testID?: string;
}) {
  const acento = useAcentoApp();
  const clase: TipoBoton = tipo ?? (secundario ? 'borde' : 'principal');
  const est = estiloBoton(clase);
  const plano = clase === 'principal' && !exito && !logistica;
  const azul = acento === 'logistica' && plano;
  return (
    <Pressable
      onPress={alTocar}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={texto}
      testID={testID}
      style={({ pressed }) => [
        e.boton,
        enFila && e.botonEnFila,
        clase !== 'principal' && {
          backgroundColor: est.fondo,
          borderWidth: est.borde ? 1.5 : 0,
          borderColor: est.borde,
        },
        pressed && { backgroundColor: azul ? COLOR.logistica : est.apretado },
        exito && clase === 'principal' && { backgroundColor: C.exito },
        logistica && clase === 'principal' && !exito && { backgroundColor: C.logisticaAccion },
        azul && { backgroundColor: COLOR.logistica },
        oscuro &&
          clase === 'borde' && {
            backgroundColor: 'transparent',
            borderColor: C.logisticaAccion,
            borderWidth: 1.5,
          },
        pressed && (!plano || azul) && { opacity: 0.92 },
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={est.texto} />
      ) : (
        <View style={e.botonFila}>
          {icono ? <Icono nombre={icono} tamano={20} color={est.texto} /> : null}
          <Text
            // En fila: una sola línea, con el ancho que pida la palabra (también en inglés y con
            // letra grande del sistema); la casilla de al lado es la que cede.
            numberOfLines={enFila ? 1 : undefined}
            style={[
              e.botonTexto,
              { color: est.texto },
              oscuro && clase === 'borde' && { color: C.logisticaAccion },
              logistica && clase === 'principal' && !exito && { color: C.logisticaTexto },
            ]}
          >
            {texto}
          </Text>
        </View>
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
  iconoCasilla: {
    position: 'absolute',
    pointerEvents: 'none',
    left: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
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
  // Fase cero: botón de 52 de alto, esquina 12 y letra Poppins 600 de 16.
  boton: {
    backgroundColor: COLOR.marca,
    borderRadius: RADIO.m,
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
  botonFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
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
  },
});
