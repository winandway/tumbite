import type { ReactNode } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Deslizador, ALTO_TARJETA } from './Deslizador';
import { Icono, Text, type NombreIcono } from './diseno';
import { faseDe, useReducirMovimiento, useRelojBucle } from './movimiento';
import {
  MOVIMIENTO,
  accionDeTarjeta,
  estiloPapel,
  estiloTarjeta,
  TEXTO_MOTIVO,
  type EstadoPapel,
  type EstadoServicio,
} from './serviciosLogica';
import { COLOR, FUENTE, RADIO } from './tokens';

/**
 * C-SERVICIOS-CONECTADOS (DRIVER.md §3): la tarjeta de un servicio del Driver en sus estados:
 * conectado (verde, con luz viva y flechas, se desliza para desconectar), en pausa, haciendo,
 * desconectado (se desliza para conectar: C-CONECTAR-DESLIZANDO), bloqueado por Flex, en revisión
 * («Ver») y agregar (punteada).
 * 68 de alto, esquina 16; pulgar de 56 × 56 con esquina 12.
 */
export type TextosTarjeta = {
  /** «Desliza → para conectar» (C-CONECTAR-DESLIZANDO: conectar nunca es un toque). */
  deslizarConectar: string;
  /** «Suelta para conectar». */
  soltarConectar: string;
  /** «Conectar Comida» (lector de pantalla). */
  conectarLector: (nombre: string) => string;
  /** «¿Conectar Comida?» (confirmación del lector de pantalla). */
  confirmarConectar: (nombre: string) => string;
  siConectar: string;
  ver: string;
  soltar: string;
  /** «Desconectar Comida» (lector de pantalla). */
  desconectar: (nombre: string) => string;
  /** «¿Desconectar Comida?» (confirmación del lector de pantalla). */
  confirmar: (nombre: string) => string;
  si: string;
  no: string;
};

const PULGAR = 56;

/** Punto verde de 9 con un anillo que crece de 0,5 a 1,5 y se apaga (1,6 s, sin fin). */
export function LuzViva({ tamano = 9 }: { tamano?: number }) {
  const reducir = useReducirMovimiento();
  const reloj = useRelojBucle(!reducir);
  const f = faseDe(reloj, MOVIMIENTO.luzViva, 0, 0, 1);
  const lado = tamano * 2.4;
  return (
    <View
      style={{ width: lado, height: lado, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {!reducir ? (
        <Animated.View
          style={{
            position: 'absolute',
            width: lado,
            height: lado,
            borderRadius: lado / 2,
            backgroundColor: COLOR.exitoVivo,
            opacity: f.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
            transform: [{ scale: f.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.5] }) }],
          }}
        />
      ) : null}
      <View
        style={{
          width: tamano,
          height: tamano,
          borderRadius: tamano / 2,
          backgroundColor: COLOR.exitoVivo,
        }}
      />
    </View>
  );
}

/** Tres flechas «›››» que se encienden una tras otra: dicen hacia dónde deslizar (1,2 s). */
export function Flechas({ color = COLOR.exito }: { color?: string }) {
  const reducir = useReducirMovimiento();
  const reloj = useRelojBucle(!reducir);
  return (
    <View
      style={{ flexDirection: 'row', marginLeft: 4 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {MOVIMIENTO.flechasRetrasos.map((retraso, i) => {
        const f = faseDe(reloj, MOVIMIENTO.flechas, retraso, 0, 1);
        return (
          <Animated.View
            key={i}
            style={{
              marginLeft: i ? -12 : 0,
              opacity: reducir
                ? 1
                : f.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1, 0.3] }),
            }}
          >
            <Icono nombre="chevron-forward" tamano={24} color={color} />
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Botón chico de la tarjeta (40 de alto, esquina 12): negro «Conectar» o gris «Ver». */
function BotonChico({
  texto,
  oscuro,
  alTocar,
  etiqueta,
  cargando,
  testID,
}: {
  texto: string;
  oscuro?: boolean;
  alTocar?: () => void;
  etiqueta: string;
  cargando?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      disabled={cargando}
      accessibilityRole="button"
      accessibilityLabel={etiqueta}
      accessibilityState={{ busy: Boolean(cargando) }}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => ({
        height: 40,
        minWidth: 64,
        paddingHorizontal: 16,
        borderRadius: RADIO.m,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: oscuro
          ? pressed
            ? '#2A2A2A'
            : COLOR.negro
          : pressed
            ? '#E3E3E3'
            : COLOR.superficie,
        opacity: cargando ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: FUENTE.tituloMedio,
          fontSize: 15,
          lineHeight: 20,
          color: oscuro ? COLOR.blanco : COLOR.texto,
        }}
      >
        {texto}
      </Text>
    </Pressable>
  );
}

function Nombre({ texto }: { texto: string }) {
  return (
    <Text
      numberOfLines={2}
      style={{ fontFamily: FUENTE.tituloMedio, fontSize: 15, lineHeight: 20, color: COLOR.texto }}
    >
      {texto}
    </Text>
  );
}

function Detalle({ texto, color, antes }: { texto: string; color: string; antes?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {antes}
      <Text
        numberOfLines={2}
        style={{
          flexShrink: 1,
          fontFamily: FUENTE.textoFuerte,
          fontSize: 12.5,
          lineHeight: 17,
          color,
        }}
      >
        {texto}
      </Text>
    </View>
  );
}

export function TarjetaServicio({
  estado,
  nombre,
  detalle,
  icono,
  dibujo,
  indice = 0,
  textos,
  alConectar,
  alVer,
  alAgregar,
  alDesconectar,
  cargando,
  testID,
}: {
  estado: EstadoServicio;
  nombre: string;
  /** El texto de estado de la segunda línea («Esperando pedidos», «Desconectado»…). */
  detalle: string;
  icono: NombreIcono;
  /** C-ICONOS-SERVICIO: el dibujo del servicio (el mismo del cliente); si viene, va en vez del ícono. */
  dibujo?: ReactNode;
  /** Posición en la lista: el barrido de cada tarjeta va desfasado 0,8 s. */
  indice?: number;
  textos: TextosTarjeta;
  alConectar?: () => unknown;
  alVer?: () => void;
  alAgregar?: () => void;
  alDesconectar?: () => unknown;
  cargando?: boolean;
  testID?: string;
}) {
  const est = estiloTarjeta(estado);
  const accion = accionDeTarjeta(estado);

  if (accion === 'deslizar' && alDesconectar)
    return (
      <Deslizador
        variante="tarjeta"
        testID={testID}
        fondo={est.fondo}
        borde={est.borde}
        barrido={{ indice }}
        accionLector={textos.desconectar(nombre)}
        confirmar={{ pregunta: textos.confirmar(nombre), si: textos.si, no: textos.no }}
        alConfirmar={alDesconectar}
        pulgar={dibujo ?? <Icono nombre={icono} tamano={24} color={est.icono} />}
        contenido={(arrastrando) => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Nombre texto={nombre} />
              {arrastrando ? (
                <Detalle texto={textos.soltar} color={COLOR.textoSuave} />
              ) : (
                <Detalle texto={detalle} color={est.textoEstado} antes={<LuzViva />} />
              )}
            </View>
            {!arrastrando ? <Flechas /> : null}
          </View>
        )}
      />
    );

  if (accion === 'conectar' && alConectar)
    return (
      <Deslizador
        variante="tarjeta"
        sentido="conectar"
        testID={testID}
        fondo={est.fondo}
        borde={est.borde}
        habilitado={!cargando}
        accionLector={textos.conectarLector(nombre)}
        confirmar={{
          pregunta: textos.confirmarConectar(nombre),
          si: textos.siConectar,
          no: textos.no,
        }}
        alConfirmar={alConectar}
        pulgar={dibujo ?? <Icono nombre={icono} tamano={24} color={est.icono} />}
        contenido={(arrastrando) => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Nombre texto={nombre} />
              <Detalle
                texto={arrastrando ? textos.soltarConectar : textos.deslizarConectar}
                color={arrastrando ? COLOR.exito : est.textoEstado}
              />
            </View>
            {!arrastrando ? <Flechas color={COLOR.texto} /> : null}
          </View>
        )}
      />
    );

  const pulgar = (
    <View
      style={{
        width: PULGAR,
        height: PULGAR,
        borderRadius: RADIO.m,
        backgroundColor: est.pulgar,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {estado === 'agregar' || !dibujo ? (
        <Icono nombre={estado === 'agregar' ? 'add' : icono} tamano={24} color={est.icono} />
      ) : (
        dibujo
      )}
    </View>
  );
  const antes =
    estado === 'en_pausa' ? (
      <Icono nombre="pause" tamano={13} color={COLOR.textoSuave} />
    ) : estado === 'bloqueado_flex' ? (
      <Icono nombre="lock-closed" tamano={13} color={COLOR.textoSuave} />
    ) : undefined;
  const cuerpo = (
    <>
      {pulgar}
      <View style={{ flex: 1, gap: 2 }}>
        <Nombre texto={nombre} />
        <Detalle texto={detalle} color={est.textoEstado} antes={antes} />
      </View>
      {accion === 'ver' ? (
        <BotonChico texto={textos.ver} alTocar={alVer} etiqueta={`${textos.ver} ${nombre}`} />
      ) : accion === 'agregar' ? (
        <Icono nombre="chevron-forward" tamano={22} color={COLOR.texto} />
      ) : null}
    </>
  );
  const caja = {
    minHeight: ALTO_TARJETA,
    borderRadius: RADIO.l,
    backgroundColor: est.fondo,
    borderWidth: est.anchoBorde,
    borderColor: est.borde,
    borderStyle: est.punteado ? ('dashed' as const) : ('solid' as const),
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingLeft: 5,
    paddingRight: 12,
  };
  if (accion === 'agregar')
    return (
      <Pressable
        onPress={alAgregar}
        accessibilityRole="button"
        accessibilityLabel={`${nombre}. ${detalle}`}
        testID={testID}
        style={({ pressed }) => [caja, pressed && { opacity: 0.85 }]}
      >
        {cuerpo}
      </Pressable>
    );
  return (
    <View
      style={caja}
      testID={testID}
      accessibilityLabel={accion ? undefined : `${nombre}. ${detalle}`}
    >
      {cuerpo}
    </View>
  );
}

/** Píldora de estado de un papel (sección 5): Montserrat 700 11,5 en una píldora de 24 de alto. */
export function PildoraPapel({
  estado,
  texto,
  testID,
}: {
  estado: EstadoPapel;
  texto: string;
  testID?: string;
}) {
  const p = estiloPapel(estado);
  return (
    <View
      testID={testID}
      style={{
        height: 24,
        paddingHorizontal: 10,
        borderRadius: RADIO.pildora,
        backgroundColor: p.fondo,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
      }}
    >
      <Icono nombre={p.icono} tamano={13} color={p.texto} />
      <Text
        numberOfLines={2}
        style={{ fontFamily: FUENTE.textoNegrita, fontSize: 11.5, lineHeight: 15, color: p.texto }}
      >
        {texto}
      </Text>
    </View>
  );
}

/** La caja del motivo de un rechazo, escrito como instrucción (sección 5). */
export function MotivoRechazo({ etiqueta, texto }: { etiqueta: string; texto: string }) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: COLOR.errorSuave,
        borderRadius: RADIO.m,
        padding: 12,
        flexDirection: 'row',
        gap: 8,
      }}
    >
      <Icono nombre="alert-circle-outline" tamano={18} color={COLOR.error} />
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: TEXTO_MOTIVO }}>
        <Text style={{ fontFamily: FUENTE.textoNegrita, color: COLOR.error }}>{etiqueta}: </Text>
        {texto}
      </Text>
    </View>
  );
}
