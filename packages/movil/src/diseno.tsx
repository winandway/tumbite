/**
 * C-APPS-DISENO (15 nov 2026): las piezas reutilizables de las tres apps del celular. Toda pantalla
 * nueva se arma con estas piezas y los tokens de ./tokens; nada de colores ni tamaños sueltos.
 */
import { createContext, forwardRef, useContext, type ComponentProps, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text as TextoNativo,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFonts } from 'expo-font';
import {
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import {
  ALTO,
  COLOR,
  ESPACIO,
  LETRA,
  RADIO,
  SOMBRA,
  TACTIL,
  TONO,
  familiaPara,
  type Tono,
} from './tokens';

/** Carga Poppins, Montserrat y los íconos. Va UNA vez en la raíz de cada app. */
export function useFuentesDivoox(): boolean {
  const [listas, fallo] = useFonts({
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    ...Ionicons.font,
  });
  // Si las fuentes fallan, la app sigue con las del sistema: nunca se queda en blanco.
  return listas || Boolean(fallo);
}

/**
 * El texto de las apps. Toma el peso y el tamaño del estilo y elige Poppins (titulares) o
 * Montserrat (texto). Todas las pantallas importan `Text` de @tumbite/movil, no de react-native.
 */
/** Un texto dentro de otro hereda la letra del de afuera si no pide un peso o tamaño propio. */
const DentroDeTexto = createContext(false);

export const Text = forwardRef<TextoNativo, TextProps>(function Texto({ style, ...props }, ref) {
  const anidado = useContext(DentroDeTexto);
  const plano = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  const propio = plano.fontFamily != null || plano.fontWeight != null || plano.fontSize != null;
  const familia = plano.fontFamily ?? familiaPara(plano.fontWeight, plano.fontSize);
  const letra =
    anidado && !propio
      ? null
      : // En Android el peso de una fuente propia lo da el archivo, no fontWeight.
        { fontFamily: familia, fontWeight: plano.fontFamily ? plano.fontWeight : undefined };
  return (
    <DentroDeTexto.Provider value>
      <TextoNativo
        ref={ref}
        maxFontSizeMultiplier={1.6}
        {...props}
        style={letra ? [style, letra] : style}
      />
    </DentroDeTexto.Provider>
  );
});

export type NombreIcono = ComponentProps<typeof Ionicons>['name'];

/** Íconos de línea (Ionicons), un solo juego para las tres apps. */
export function Icono({
  nombre,
  tamano = ALTO.icono,
  color = COLOR.texto,
  testID,
}: {
  nombre: NombreIcono;
  tamano?: number;
  color?: string;
  testID?: string;
}) {
  return (
    <Ionicons
      name={nombre}
      size={tamano}
      color={color}
      accessibilityElementsHidden
      testID={testID}
    />
  );
}

/** Tarjeta: fondo blanco, borde fino y sombra suave. Sin franjas de color (regla de Richard). */
export function Tarjeta({
  children,
  alTocar,
  oscura,
  estilo,
  etiqueta,
  testID,
}: {
  children: ReactNode;
  alTocar?: () => void;
  oscura?: boolean;
  estilo?: StyleProp<ViewStyle>;
  etiqueta?: string;
  testID?: string;
}) {
  const base = [d.tarjeta, oscura && d.tarjetaOscura, estilo];
  if (!alTocar)
    return (
      <View style={base} testID={testID}>
        {children}
      </View>
    );
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      testID={testID}
      style={({ pressed }) => [...base, pressed && { opacity: 0.9 }]}
    >
      {children}
    </Pressable>
  );
}

/** Píldora: chip de filtro (con alTocar) o etiqueta de estado (solo tono). */
export function Pildora({
  texto,
  tono = 'neutro',
  activa,
  icono,
  alTocar,
  testID,
}: {
  texto: string;
  tono?: Tono;
  activa?: boolean;
  icono?: NombreIcono;
  alTocar?: () => void;
  testID?: string;
}) {
  const t = activa ? TONO.oscuro : (new Map(Object.entries(TONO)).get(tono) ?? TONO.neutro);
  const cuerpo = (
    <>
      {icono ? <Icono nombre={icono} tamano={14} color={t.texto} /> : null}
      <Text style={[d.pildoraTexto, { color: t.texto }]} numberOfLines={1}>
        {texto}
      </Text>
    </>
  );
  if (!alTocar)
    return (
      <View style={[d.pildora, d.pildoraEstado, { backgroundColor: t.fondo }]} testID={testID}>
        {cuerpo}
      </View>
    );
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(activa) }}
      testID={testID}
      hitSlop={6}
      style={[d.pildora, { backgroundColor: t.fondo }]}
    >
      {cuerpo}
    </Pressable>
  );
}

/** Fila de lista: ícono, título, detalle y flechita, con su línea fina abajo. */
export function FilaLista({
  titulo,
  detalle,
  icono,
  derecha,
  alTocar,
  peligro,
  ultima,
  testID,
}: {
  titulo: string;
  detalle?: string;
  icono?: NombreIcono;
  derecha?: ReactNode;
  alTocar?: () => void;
  peligro?: boolean;
  ultima?: boolean;
  testID?: string;
}) {
  const color = peligro ? COLOR.error : COLOR.texto;
  return (
    <Pressable
      onPress={alTocar}
      disabled={!alTocar}
      accessibilityRole={alTocar ? 'button' : undefined}
      accessibilityLabel={detalle ? `${titulo}. ${detalle}` : titulo}
      testID={testID}
      style={({ pressed }) => [
        d.fila,
        !ultima && d.filaLinea,
        pressed && { backgroundColor: COLOR.superficie },
      ]}
    >
      {icono ? (
        <View style={d.filaIcono}>
          <Icono nombre={icono} tamano={20} color={color} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[LETRA.cuerpoFuerte, { color, fontSize: 15 }]}>{titulo}</Text>
        {detalle ? <Text style={[LETRA.secundario, { marginTop: 2 }]}>{detalle}</Text> : null}
      </View>
      {derecha ??
        (alTocar ? <Icono nombre="chevron-forward" tamano={18} color={COLOR.textoTenue} /> : null)}
    </Pressable>
  );
}

/** Encabezado de pantalla: flecha de volver, título y acción a la derecha. Blanco y con línea fina. */
export function Encabezado({
  titulo,
  volver,
  derecha,
  textoVolver = 'Volver',
}: {
  titulo?: string;
  volver?: () => void;
  derecha?: ReactNode;
  textoVolver?: string;
}) {
  return (
    <View style={d.encabezado}>
      {volver ? (
        <Pressable
          onPress={volver}
          accessibilityRole="button"
          accessibilityLabel={textoVolver}
          testID="cabecera-volver"
          hitSlop={8}
          style={d.botonRedondo}
        >
          <Icono nombre="chevron-back" tamano={22} />
        </Pressable>
      ) : null}
      <Text style={[LETRA.subtitulo, { flex: 1 }]} numberOfLines={1} accessibilityRole="header">
        {titulo ?? ''}
      </Text>
      {derecha}
    </View>
  );
}

export type PestanaBarra = {
  clave: string;
  texto: string;
  icono: NombreIcono;
  iconoActivo: NombreIcono;
  punto?: boolean;
  insignia?: number;
};

/** Barra inferior con íconos de línea (rellenos cuando están elegidos), como los grandes. */
export function BarraPestanas({
  pestanas,
  activa,
  alTocar,
  colorActivo = COLOR.marcaOscuro,
}: {
  pestanas: PestanaBarra[];
  activa: string;
  alTocar: (clave: string) => void;
  colorActivo?: string;
}) {
  return (
    <View style={d.barra} accessibilityRole="tablist">
      {pestanas.map((p) => {
        const esta = p.clave === activa;
        const color = esta ? colorActivo : COLOR.textoTenue;
        return (
          <Pressable
            key={p.clave}
            onPress={() => alTocar(p.clave)}
            accessibilityRole="tab"
            accessibilityState={{ selected: esta }}
            accessibilityLabel={p.texto}
            testID={`pestana-${p.clave}`}
            style={d.barraPestana}
          >
            <View>
              <Icono
                nombre={esta ? p.iconoActivo : p.icono}
                tamano={24}
                color={color}
                testID={`nav-${p.clave}`}
              />
              {p.insignia ? (
                <View style={d.insignia}>
                  <Text style={d.insigniaTexto}>{p.insignia > 99 ? '99+' : p.insignia}</Text>
                </View>
              ) : p.punto ? (
                <View style={d.punto} />
              ) : null}
            </View>
            <Text style={[d.barraTexto, { color }, esta && { fontWeight: '700' }]}>{p.texto}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Estado vacío: ícono en círculo gris, título, explicación y, si hay, la acción para salir de ahí. */
export function EstadoVacio({
  icono,
  titulo,
  texto,
  accion,
}: {
  icono: NombreIcono;
  titulo: string;
  texto?: string;
  accion?: ReactNode;
}) {
  return (
    <View style={d.vacio}>
      <View style={d.vacioIcono}>
        <Icono nombre={icono} tamano={32} color={COLOR.textoSuave} />
      </View>
      <Text style={[LETRA.subtitulo, { textAlign: 'center' }]}>{titulo}</Text>
      {texto ? (
        <Text style={[LETRA.secundario, { textAlign: 'center', maxWidth: 300 }]}>{texto}</Text>
      ) : null}
      {accion ? <View style={{ alignSelf: 'stretch', marginTop: ESPACIO.s }}>{accion}</View> : null}
    </View>
  );
}

/** Título de sección dentro de una pantalla («Cerca de ti», «Entrega»). */
export function TituloSeccion({ texto, accion }: { texto: string; accion?: ReactNode }) {
  return (
    <View style={d.seccion}>
      <Text style={[LETRA.subtitulo, { flex: 1 }]} accessibilityRole="header">
        {texto}
      </Text>
      {accion}
    </View>
  );
}

export const d = StyleSheet.create({
  tarjeta: {
    backgroundColor: COLOR.blanco,
    borderRadius: RADIO.m,
    borderWidth: 1,
    borderColor: COLOR.borde,
    padding: ESPACIO.l,
    marginBottom: ESPACIO.m,
    ...SOMBRA.tarjeta,
  },
  tarjetaOscura: { backgroundColor: '#161616', borderColor: COLOR.bordeOscuro },
  pildora: {
    minHeight: ALTO.pildora,
    borderRadius: RADIO.pildora,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
  },
  pildoraEstado: { minHeight: 26, paddingHorizontal: 10 },
  pildoraTexto: { fontSize: 13, fontWeight: '600' },
  fila: {
    minHeight: TACTIL + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.m,
    paddingVertical: ESPACIO.m,
  },
  filaLinea: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLOR.bordeFuerte },
  filaIcono: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLOR.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  encabezado: {
    minHeight: ALTO.encabezado,
    flexDirection: 'row',
    alignItems: 'center',
    gap: ESPACIO.s,
    paddingHorizontal: ESPACIO.l,
    backgroundColor: COLOR.blanco,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.bordeFuerte,
  },
  botonRedondo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLOR.superficie,
  },
  barra: {
    flexDirection: 'row',
    minHeight: ALTO.barraInferior,
    backgroundColor: COLOR.blanco,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLOR.bordeFuerte,
    paddingTop: 8,
    paddingBottom: 6,
  },
  barraPestana: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: TACTIL,
  },
  barraTexto: { fontSize: 11, fontWeight: '500' },
  punto: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: COLOR.marca,
    borderWidth: 1.5,
    borderColor: COLOR.blanco,
  },
  insignia: {
    position: 'absolute',
    top: -5,
    right: -12,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: COLOR.marca,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLOR.blanco,
  },
  insigniaTexto: { color: COLOR.blanco, fontSize: 10, fontWeight: '700', lineHeight: 12 },
  vacio: {
    alignItems: 'center',
    gap: ESPACIO.s,
    paddingVertical: ESPACIO.xxxl,
    paddingHorizontal: ESPACIO.l,
  },
  vacioIcono: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLOR.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: ESPACIO.s,
  },
  seccion: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: ESPACIO.xxl,
    marginBottom: ESPACIO.m,
  },
});
