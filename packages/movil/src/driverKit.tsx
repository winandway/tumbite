import { useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Icono, Text, type NombreIcono } from './diseno';
import { useReducirMovimiento } from './movimiento';
import { FUENTE } from './tokens';

/**
 * C-REDISENO-DRIVER (24 nov 2026, borrador aprobado por Richard; todos los países). Las piezas ÚNICAS
 * del rediseño de Divoox Driver, calcadas del borrador (progreso/rediseno-driver): el mapa a pantalla
 * completa con una hoja blanca abajo, botones redondos que flotan sobre el mapa, la píldora negra de
 * lo ganado hoy, la oferta con su etiqueta de servicio (envíos en azul petróleo), la barra de tres
 * pasos del viaje, las filas de la cuenta y la barra de abajo de cuatro lugares.
 *
 * Colores Divoox (rojo #F20D20, acento #C20A1A, negro #101010, gris #666B73) y el verde de lo ganado.
 * Poppins en titulares y cifras, Montserrat en el texto. Sin franjas de color, sin degradados, sin
 * emojis. En tableta el contenido no se estira: `AnchoDriver` lo deja en una columna de 600 px.
 */
export const DK = {
  rojo: '#F20D20',
  rojoOscuro: '#C20A1A',
  negro: '#101010',
  gris: '#666B73',
  gris2: '#9A9EA5',
  borde: '#E2E4E8',
  bordeOscuro: '#2A2A2A',
  fondo: '#F6F6F6',
  verde: '#0D7A3A',
  verdeSuave: '#E6F2EA',
  ambar: '#8A5A00',
  ambarSuave: '#FFF4DC',
  petroleo: '#1F4D69',
  petroleoSuave: '#E5EEF3',
  petroleoBorde: '#C5D6E0',
  blanco: '#FFFFFF',
} as const;

/** Ancho máximo del contenido en tableta (nada estirado de borde a borde). */
export const ANCHO_MAXIMO_DRIVER = 600;

const titulo = (tamano: number, peso: '600' | '700' = '600') => ({
  fontFamily: peso === '700' ? FUENTE.titulo : FUENTE.tituloMedio,
  fontSize: tamano,
  color: DK.negro,
});

/** Columna centrada: en el celular ocupa todo; en tableta se queda en 600 px. */
export function AnchoDriver({
  children,
  estilo,
}: {
  children: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ width: '100%', maxWidth: ANCHO_MAXIMO_DRIVER, alignSelf: 'center' }, estilo]}>
      {children}
    </View>
  );
}

/**
 * La hoja blanca de abajo, sobre el mapa: esquinas de 20, sombra suave, la rayita para arrastrar y lo
 * de adentro desplazable si no cabe. En tableta, centrada y con su ancho máximo.
 */
export function HojaDriver({
  children,
  testID,
  altoMaximo = '62%',
}: {
  children: ReactNode;
  testID?: string;
  altoMaximo?: `${number}%` | number;
}) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: DK.blanco,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        width: '100%',
        maxWidth: ANCHO_MAXIMO_DRIVER,
        alignSelf: 'center',
        maxHeight: altoMaximo,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: -4 },
        elevation: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 4,
          borderRadius: 4,
          backgroundColor: '#D5D8DC',
          alignSelf: 'center',
          marginTop: 10,
          marginBottom: 8,
        }}
      />
      <ScrollView
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 18, gap: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Botón redondo blanco de 44 que flota sobre el mapa (escudo, modo destino, navegar). */
export function BotonRedondoDriver({
  icono,
  etiqueta,
  alTocar,
  testID,
}: {
  icono: NombreIcono;
  etiqueta: string;
  alTocar: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: DK.blanco,
        borderWidth: 1,
        borderColor: DK.borde,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Icono nombre={icono} tamano={22} color={DK.negro} />
    </Pressable>
  );
}

/** La píldora negra de lo ganado hoy, arriba al centro del mapa. Un toque lleva a Ganancias. */
export function PildoraGanancias({
  monto,
  hoy,
  alTocar,
  testID = 'pildora-ganancias',
}: {
  monto: string;
  hoy: string;
  alTocar: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={`${monto} ${hoy}`}
      testID={testID}
      style={{
        backgroundColor: DK.negro,
        borderRadius: 999,
        paddingHorizontal: 18,
        paddingVertical: 9,
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
        flexShrink: 1,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      <Text style={{ ...titulo(17), color: DK.blanco }}>{monto}</Text>
      <Text style={{ fontFamily: FUENTE.textoMedio, fontSize: 12, color: '#C9CBCF' }}>{hoy}</Text>
    </Pressable>
  );
}

/** Fila flotante de arriba: izquierda, centro y derecha, respetando la isla y los bordes curvos. */
export function FlotanteDriver({
  izquierda,
  centro,
  derecha,
}: {
  izquierda?: ReactNode;
  centro?: ReactNode;
  derecha?: ReactNode;
}) {
  return (
    <View
      pointerEvents="box-none"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingTop: 14,
        width: '100%',
        maxWidth: ANCHO_MAXIMO_DRIVER,
        alignSelf: 'center',
      }}
    >
      <View style={{ width: 44 }}>{izquierda}</View>
      <View style={{ flex: 1, alignItems: 'center' }} pointerEvents="box-none">
        {centro}
      </View>
      <View style={{ width: 44 }}>{derecha}</View>
    </View>
  );
}

export type VarianteBotonDriver = 'rojo' | 'negro' | 'petroleo' | 'borde' | 'texto';

/** Botón del rediseño: 52 de alto, esquina 12, Poppins 600. «rojo» solo para conectarse. */
export function BotonDriver({
  texto,
  alTocar,
  variante = 'negro',
  icono,
  deshabilitado,
  testID,
}: {
  texto: string;
  alTocar: () => void;
  variante?: VarianteBotonDriver;
  icono?: NombreIcono;
  deshabilitado?: boolean;
  testID?: string;
}) {
  const fondo = deshabilitado
    ? '#E4E6E9'
    : variante === 'rojo'
      ? DK.rojo
      : variante === 'negro'
        ? DK.negro
        : variante === 'petroleo'
          ? DK.petroleo
          : DK.blanco;
  const tinta = deshabilitado
    ? '#8A8E94'
    : variante === 'borde'
      ? DK.negro
      : variante === 'texto'
        ? DK.gris
        : DK.blanco;
  return (
    <Pressable
      onPress={alTocar}
      disabled={deshabilitado}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: Boolean(deshabilitado) }}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: variante === 'texto' ? 40 : 52,
        borderRadius: 12,
        backgroundColor:
          pressed && variante === 'rojo' ? DK.rojoOscuro : variante === 'texto' ? undefined : fondo,
        borderWidth: variante === 'borde' ? 1 : 0,
        borderColor: DK.bordeOscuro,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
        opacity: pressed && variante !== 'rojo' ? 0.85 : 1,
      })}
    >
      {icono ? <Icono nombre={icono} tamano={18} color={tinta} /> : null}
      <Text
        style={{
          fontFamily: FUENTE.tituloMedio,
          fontSize: variante === 'texto' ? 14.5 : 16.5,
          color: tinta,
          textAlign: 'center',
        }}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

/** El punto del estado: gris desconectado; verde que late conectado. */
function PuntoEstado({ vivo }: { vivo: boolean }) {
  const reducir = useReducirMovimiento();
  const [pulso] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!vivo || reducir) return;
    const bucle = Animated.loop(
      Animated.timing(pulso, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    bucle.start();
    return () => bucle.stop();
  }, [vivo, reducir, pulso]);
  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      {vivo && !reducir ? (
        <Animated.View
          style={{
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: DK.verde,
            opacity: pulso.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [
              { scale: pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 2.8] }) },
            ],
          }}
        />
      ) : null}
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: vivo ? DK.verde : DK.gris2,
        }}
      />
    </View>
  );
}

/** La línea verde que barre mientras busca ofertas. */
function BarraBuscando() {
  const reducir = useReducirMovimiento();
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reducir) return;
    const bucle = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }),
    );
    bucle.start();
    return () => bucle.stop();
  }, [reducir, x]);
  return (
    <View
      testID="driver-buscando"
      accessibilityElementsHidden
      style={{ height: 3, borderRadius: 3, backgroundColor: DK.verdeSuave, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: '35%',
          borderRadius: 3,
          backgroundColor: DK.verde,
          left: reducir
            ? '32%'
            : x.interpolate({ inputRange: [0, 1], outputRange: ['-35%', '100%'] }),
        }}
      />
    </View>
  );
}

/** El estado arriba de la hoja: «Estás desconectado» o «Conectado · buscando ofertas». */
export function EstadoConexionDriver({
  conectado,
  buscando,
  titulo: tituloEstado,
  detalle,
}: {
  conectado: boolean;
  buscando?: boolean;
  titulo: string;
  detalle?: string;
}) {
  return (
    <View testID={conectado ? 'driver-estado-conectado' : 'driver-estado-desconectado'}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <PuntoEstado vivo={conectado} />
        <Text accessibilityRole="header" style={{ ...titulo(18), flexShrink: 1 }}>
          {tituloEstado}
        </Text>
      </View>
      {conectado && buscando ? (
        <View style={{ marginTop: 12 }}>
          <BarraBuscando />
        </View>
      ) : null}
      {detalle ? (
        <Text style={{ color: DK.gris, fontSize: 13.5, lineHeight: 20, marginTop: 6 }}>
          {detalle}
        </Text>
      ) : null}
    </View>
  );
}

/** Chip con borde oscuro (modo destino, qué ofertas recibo). */
export function ChipDriver({
  texto,
  icono,
  alTocar,
  testID,
}: {
  texto: string;
  icono?: NombreIcono;
  alTocar: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={texto}
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: DK.bordeOscuro,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: DK.blanco,
      }}
    >
      {icono ? <Icono nombre={icono} tamano={17} color={DK.negro} /> : null}
      <Text style={{ fontFamily: FUENTE.textoFuerte, fontSize: 13, color: DK.negro }}>{texto}</Text>
    </Pressable>
  );
}

/**
 * La barra de activación del registro, sobre el mapa: «Activa tu cuenta», cuántos pasos van listos,
 * la barra verde y lo que falta. Un toque lleva a los papeles.
 */
export function BarraActivacionDriver({
  titulo: tituloBarra,
  cuenta,
  avance,
  falta,
  alTocar,
}: {
  titulo: string;
  cuenta?: string;
  /** De 0 a 1. */
  avance: number;
  falta: string;
  alTocar: () => void;
}) {
  const ancho = `${Math.round(Math.max(0.04, Math.min(1, avance)) * 100)}%` as const;
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={`${tituloBarra}. ${cuenta ?? ''} ${falta}`}
      testID="barra-activacion"
      style={{
        backgroundColor: DK.blanco,
        borderWidth: 1,
        borderColor: DK.bordeOscuro,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 3 },
        elevation: 5,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Text style={{ ...titulo(15), flexShrink: 1 }}>{tituloBarra}</Text>
        {cuenta ? (
          <Text style={{ fontFamily: FUENTE.textoNegrita, fontSize: 12.5, color: DK.verde }}>
            {cuenta}
          </Text>
        ) : null}
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(avance * 100) }}
        style={{
          height: 6,
          borderRadius: 6,
          backgroundColor: '#E8EAED',
          marginTop: 9,
          marginBottom: 7,
          overflow: 'hidden',
        }}
      >
        <View style={{ width: ancho, height: 6, borderRadius: 6, backgroundColor: DK.verde }} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: DK.gris, fontSize: 12.5, flex: 1 }}>{falta}</Text>
        <Icono nombre="chevron-forward" tamano={18} color={DK.gris} />
      </View>
    </Pressable>
  );
}

export type TipoServicioDriver = 'viaje' | 'envio' | 'comida' | 'fijo' | 'flex';

const ICONO_TIPO = new Map<TipoServicioDriver, NombreIcono>([
  ['viaje', 'car-outline'],
  ['envio', 'cube-outline'],
  ['comida', 'bag-handle-outline'],
  ['fijo', 'repeat-outline'],
  ['flex', 'cube-outline'],
]);

/** La etiqueta del servicio en la oferta y en el viaje: envíos y Flex en azul petróleo. */
export function EtiquetaServicioDriver({
  tipo,
  texto,
  icono,
  sobreMapa,
  testID = 'etiqueta-servicio',
}: {
  tipo: TipoServicioDriver;
  texto: string;
  icono?: NombreIcono;
  sobreMapa?: boolean;
  testID?: string;
}) {
  const petroleo = tipo === 'envio' || tipo === 'flex';
  const fijo = tipo === 'fijo';
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        flexShrink: 1,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        backgroundColor: petroleo ? DK.petroleoSuave : fijo || sobreMapa ? DK.blanco : DK.fondo,
        borderColor: petroleo ? DK.petroleoBorde : fijo ? DK.bordeOscuro : DK.borde,
      }}
    >
      <Icono
        nombre={icono ?? ICONO_TIPO.get(tipo) ?? 'car-outline'}
        tamano={17}
        color={petroleo ? DK.petroleo : DK.negro}
      />
      <Text
        style={{
          fontFamily: FUENTE.textoNegrita,
          fontSize: 13,
          color: petroleo ? DK.petroleo : DK.negro,
          flexShrink: 1,
        }}
      >
        {texto}
      </Text>
    </View>
  );
}

/** El reloj de la oferta («30 s») y la barra que se vacía. En los últimos 10 s, en rojo. */
export function RelojOfertaDriver({ quedan, segundos }: { quedan: number; segundos: string }) {
  const urgente = quedan <= 10;
  return (
    <View
      accessibilityRole="timer"
      accessibilityLabel={`${quedan} ${segundos}`}
      style={{
        backgroundColor: urgente ? DK.rojo : DK.fondo,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
      }}
    >
      <Text
        style={{
          fontFamily: FUENTE.textoNegrita,
          fontSize: 14,
          color: urgente ? DK.blanco : DK.negro,
          fontVariant: ['tabular-nums'],
        }}
      >
        {`${quedan}${segundos}`}
      </Text>
    </View>
  );
}

export function CuentaAtrasDriver({ quedan, total }: { quedan: number; total: number }) {
  return (
    <View
      testID="cuenta-atras"
      style={{ height: 4, borderRadius: 4, backgroundColor: '#E8EAED', overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${Math.min(100, Math.max(0, Math.round((quedan / Math.max(1, total)) * 100)))}%`,
          height: 4,
          backgroundColor: quedan <= 10 ? DK.rojo : DK.negro,
        }}
      />
    </View>
  );
}

/** Tres datos en cajitas grises: hasta recoger, de recorrido y en total. */
export function DatosTresDriver({ datos }: { datos: { valor: string; nombre: string }[] }) {
  return (
    <View testID="datos-tres" style={{ flexDirection: 'row', gap: 8 }}>
      {datos.map((d) => (
        <View
          key={d.nombre}
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: DK.fondo,
            borderRadius: 10,
            paddingVertical: 9,
            paddingHorizontal: 4,
            alignItems: 'center',
          }}
        >
          <Text style={{ ...titulo(15.5) }}>{d.valor}</Text>
          <Text style={{ fontSize: 11.5, color: DK.gris, textAlign: 'center' }}>{d.nombre}</Text>
        </View>
      ))}
    </View>
  );
}

/** Recoger → llevar, con el punto, la línea y el cuadrito del destino (y las paradas en medio). */
export function RutaDriver({
  puntos,
}: {
  puntos: { etiqueta: string; lugar: string; testID?: string }[];
}) {
  return (
    <View testID="ruta-driver">
      {puntos.map((p, i) => {
        const ultimo = i === puntos.length - 1;
        return (
          <View key={`${p.etiqueta}-${i}`} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ width: 18, alignItems: 'center', paddingTop: 5 }}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: ultimo ? 2 : 5,
                  backgroundColor: DK.negro,
                }}
              />
              {ultimo ? null : (
                <View
                  style={{
                    flex: 1,
                    width: 2,
                    minHeight: 22,
                    backgroundColor: '#CFD3D8',
                    marginVertical: 3,
                  }}
                />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, paddingBottom: ultimo ? 0 : 10 }}>
              <Text style={{ fontSize: 12, color: DK.gris }}>{p.etiqueta}</Text>
              <Text
                testID={p.testID}
                style={{ fontFamily: FUENTE.textoFuerte, fontSize: 14.5, color: DK.negro }}
              >
                {p.lugar}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Una línea con ícono gris (quién es, calificación, bolsa térmica, cliente de confianza). */
export function LineaInfoDriver({
  icono,
  texto,
  testID,
}: {
  icono: NombreIcono;
  texto: string;
  testID?: string;
}) {
  return (
    <View testID={testID} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icono nombre={icono} tamano={18} color={DK.gris} />
      <Text style={{ fontSize: 13.5, color: '#33363B', flex: 1 }}>{texto}</Text>
    </View>
  );
}

/** «Rechazar» con su equis, gris y centrado. */
export function RechazarDriver({
  texto,
  alTocar,
  testID,
}: {
  texto: string;
  alTocar: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={texto}
      testID={testID}
      style={{
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Icono nombre="close" tamano={18} color={DK.gris} />
      <Text style={{ fontFamily: FUENTE.textoFuerte, fontSize: 14, color: DK.gris }}>{texto}</Text>
    </Pressable>
  );
}

/** La barra de tres pasos del viaje: hechos en verde, el de ahora en negro, lo que falta en gris. */
export function BarraPasosDriver({ paso, total = 3 }: { paso: number; total?: number }) {
  return (
    <View
      testID="barra-pasos"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: paso + 1 }}
      style={{ flexDirection: 'row', gap: 6 }}
    >
      {Array.from({ length: total }, (_, k) => (
        <View
          key={k}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 4,
            backgroundColor: k < paso ? DK.verde : k === paso ? DK.negro : '#E3E5E8',
          }}
        />
      ))}
    </View>
  );
}

/** Navegar, Llamar y Mensaje: tres botones con borde fino. */
export function AccionesViajeDriver({
  acciones,
}: {
  acciones: { icono: NombreIcono; texto: string; alTocar: () => void; testID?: string }[];
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {acciones.map((a) => (
        <Pressable
          key={a.texto}
          onPress={a.alTocar}
          accessibilityRole="button"
          accessibilityLabel={a.texto}
          testID={a.testID}
          style={{
            flex: 1,
            minWidth: 0,
            borderWidth: 1,
            borderColor: DK.borde,
            borderRadius: 12,
            paddingVertical: 10,
            paddingHorizontal: 4,
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Icono nombre={a.icono} tamano={22} color={DK.negro} />
          <Text style={{ fontFamily: FUENTE.textoFuerte, fontSize: 12, color: DK.negro }}>
            {a.texto}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Título de un paso del viaje (Poppins 19). */
export function TituloPasoDriver({ texto, testID }: { texto: string; testID?: string }) {
  return (
    <Text testID={testID} accessibilityRole="header" style={{ ...titulo(19), lineHeight: 24 }}>
      {texto}
    </Text>
  );
}

/** Cabecera blanca de las pantallas con barra (Ganancias, Avisos, Cuenta…): título y volver. */
export function CabeceraDriverPantalla({
  titulo: tituloPantalla,
  volver,
  textoVolver,
  derecha,
}: {
  titulo: string;
  volver?: () => void;
  textoVolver?: string;
  derecha?: ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: DK.blanco,
        borderBottomWidth: 1,
        borderBottomColor: DK.borde,
      }}
    >
      <AnchoDriver
        estilo={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 12,
        }}
      >
        {volver ? (
          <Pressable
            onPress={volver}
            accessibilityRole="button"
            accessibilityLabel={textoVolver ?? 'Volver'}
            testID="cabecera-volver"
            hitSlop={8}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: -8,
            }}
          >
            <Icono nombre="chevron-back" tamano={22} color={DK.negro} />
          </Pressable>
        ) : null}
        <Text
          accessibilityRole="header"
          testID="cabecera-titulo"
          style={{ ...titulo(21, '700'), flex: 1 }}
        >
          {tituloPantalla}
        </Text>
        {derecha}
      </AnchoDriver>
    </View>
  );
}

/** Dos pestañas grises (Ganancias | Billetera). */
export function SegmentadoDriver<T extends string>({
  opciones,
  activa,
  alElegir,
}: {
  opciones: { clave: T; texto: string }[];
  activa: T;
  alElegir: (c: T) => void;
}) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: '#E8EAED', borderRadius: 10, padding: 3 }}
    >
      {opciones.map((o) => {
        const esta = o.clave === activa;
        return (
          <Pressable
            key={o.clave}
            onPress={() => alElegir(o.clave)}
            accessibilityRole="tab"
            accessibilityState={{ selected: esta }}
            testID={`segmento-${o.clave}`}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 8,
              alignItems: 'center',
              backgroundColor: esta ? DK.blanco : undefined,
              shadowColor: '#000',
              shadowOpacity: esta ? 0.1 : 0,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: esta ? 1 : 0,
            }}
          >
            <Text
              style={{
                fontFamily: FUENTE.textoFuerte,
                fontSize: 14,
                color: esta ? DK.negro : DK.gris,
              }}
            >
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bloque blanco con borde claro y esquina 14 (sin sombra ni franjas). */
export function BloqueDriver({
  children,
  titulo: tituloBloque,
  testID,
  estilo,
}: {
  children: ReactNode;
  titulo?: string;
  testID?: string;
  estilo?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: DK.blanco,
          borderWidth: 1,
          borderColor: DK.borde,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
        estilo,
      ]}
    >
      {tituloBloque ? (
        <Text style={{ fontFamily: FUENTE.textoFuerte, fontSize: 12.5, color: DK.gris }}>
          {tituloBloque}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

/** Fila de la cuenta: ícono en círculo gris, título, detalle y lo de la derecha (o la flechita). */
export function FilaDriver({
  icono,
  titulo: tituloFila,
  detalle,
  derecha,
  alTocar,
  primera,
  colorIcono,
  testID,
}: {
  icono: NombreIcono;
  titulo: string;
  detalle?: string;
  derecha?: ReactNode;
  alTocar?: () => void;
  primera?: boolean;
  colorIcono?: string;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      disabled={!alTocar}
      accessibilityRole={alTocar ? 'button' : undefined}
      accessibilityLabel={detalle ? `${tituloFila}. ${detalle}` : tituloFila}
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderTopWidth: primera ? 0 : 1,
        borderTopColor: '#EEF0F2',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: DK.fondo,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icono nombre={icono} tamano={20} color={colorIcono ?? DK.negro} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: FUENTE.textoFuerte, fontSize: 14.5, color: DK.negro }}>
          {tituloFila}
        </Text>
        {detalle ? <Text style={{ color: DK.gris, fontSize: 12.5 }}>{detalle}</Text> : null}
      </View>
      {derecha ??
        (alTocar ? <Icono nombre="chevron-forward" tamano={18} color={DK.gris2} /> : null)}
    </Pressable>
  );
}

/** Lista blanca de filas (la cuenta). */
export function ListaDriver({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View
      testID={testID}
      style={{
        backgroundColor: DK.blanco,
        borderWidth: 1,
        borderColor: DK.borde,
        borderRadius: 14,
        paddingHorizontal: 14,
      }}
    >
      {children}
    </View>
  );
}

/** Estado de un papel: aprobado (verde), vence pronto (ámbar), en revisión (gris), subir (borde). */
export function EstadoPapelDriver({
  texto,
  tono,
}: {
  texto: string;
  tono: 'ok' | 'ambar' | 'gris' | 'falta';
}) {
  const fondo =
    tono === 'ok'
      ? DK.verdeSuave
      : tono === 'ambar'
        ? DK.ambarSuave
        : tono === 'gris'
          ? '#ECEEF1'
          : DK.blanco;
  const tinta =
    tono === 'ok' ? DK.verde : tono === 'ambar' ? DK.ambar : tono === 'gris' ? DK.gris : DK.negro;
  return (
    <View
      style={{
        backgroundColor: fondo,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: tono === 'falta' ? 1 : 0,
        borderColor: DK.bordeOscuro,
      }}
    >
      <Text style={{ fontFamily: FUENTE.textoNegrita, fontSize: 12, color: tinta }}>{texto}</Text>
    </View>
  );
}

/** La cabecera de la cuenta: avatar gris, nombre y su calificación, nivel y aceptación. */
export function PerfilCabeceraDriver({
  nombre,
  datos,
}: {
  nombre: string;
  datos: { fuerte: string; texto?: string }[];
}) {
  return (
    <View style={{ backgroundColor: DK.blanco, borderBottomWidth: 1, borderBottomColor: DK.borde }}>
      <AnchoDriver
        estilo={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: 16,
        }}
      >
        <View
          style={{
            width: 62,
            height: 62,
            borderRadius: 31,
            backgroundColor: '#E3E5E8',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre="person-outline" tamano={34} color={DK.gris} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text accessibilityRole="header" style={{ ...titulo(20, '700') }}>
            {nombre}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
            {datos.map((d) => (
              <Text key={`${d.fuerte}${d.texto ?? ''}`} style={{ fontSize: 13, color: DK.gris }}>
                <Text style={{ fontFamily: FUENTE.textoNegrita, fontSize: 13, color: DK.negro }}>
                  {d.fuerte}
                </Text>
                {d.texto ? ` ${d.texto}` : ''}
              </Text>
            ))}
          </View>
        </View>
      </AnchoDriver>
    </View>
  );
}

/** La cifra grande del rediseño (verde para lo ganado). */
export function CifraDriver({
  texto,
  verde,
  tamano = 32,
  testID,
}: {
  texto: string;
  verde?: boolean;
  tamano?: number;
  testID?: string;
}) {
  return (
    <Text
      testID={testID}
      style={{
        fontFamily: FUENTE.titulo,
        fontSize: tamano,
        lineHeight: Math.round(tamano * 1.15),
        color: verde ? DK.verde : DK.negro,
      }}
    >
      {texto}
    </Text>
  );
}

/** ¿Pantalla ancha (tableta)? Para pasar a dos columnas donde conviene. */
export function useEsTableta(): boolean {
  const { width } = useWindowDimensions();
  return width >= 768;
}
