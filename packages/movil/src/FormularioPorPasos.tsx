import type { ReactNode } from 'react';
import { View } from 'react-native';
import {
  fraccionDeAvance,
  indiceDePaso,
  pasoAnterior,
  pasoSiguiente,
  textosPasos,
  type Idioma,
} from '@tumbite/compartido';
import { Text } from './diseno';
import { Boton, e } from './ui';
import { COLOR, FUENTE } from './tokens';

/**
 * C-FORMULARIO-POR-PASOS (24 nov 2026, orden de Richard) — todos los países. La pieza ÚNICA de los
 * formularios largos de las tres apps, como Uber, DoorDash y Rappi: un paso corto por pantalla, la
 * barra de avance arriba en verde («Paso 2 de 4»), «Atrás» y «Siguiente» grandes abajo, el error al
 * lado de la casilla que falla (lo pone cada casilla con su `error`) y, junto al botón, por qué no
 * avanza (`porQue`). El paso vigente lo guarda quien la usa en su borrador (useBorrador), así vuelve
 * al reabrir en el mismo paso. Lógica pura en `@tumbite/compartido` (formularioPorPasos.ts).
 */
export type PasoVisible = {
  clave: string;
  /** Las casillas del paso: con ellas se sabe a qué paso llevar un error del servidor. */
  casillas: readonly string[];
  titulo: string;
  /** Una línea debajo del título, si ayuda. */
  ayuda?: string;
  contenido: ReactNode;
};

/** La barra de avance: «Paso 2 de 4» y la barra verde (éxito = verde, regla de Richard). */
export function BarraDePasos({
  indice,
  total,
  idioma,
  testID = 'pasos-barra',
}: {
  indice: number;
  total: number;
  idioma: Idioma;
  testID?: string;
}) {
  const t = textosPasos(idioma);
  const lleno = fraccionDeAvance(indice, total);
  return (
    <View style={{ marginBottom: 12, gap: 6 }} testID={testID}>
      <Text style={{ color: COLOR.textoSuave, fontSize: 13, fontWeight: '600' }}>
        {t.paso(indice + 1, total)}
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t.paso(indice + 1, total)}
        accessibilityValue={{ min: 1, max: total, now: indice + 1 }}
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: COLOR.superficieFuerte,
          overflow: 'hidden',
        }}
      >
        <View
          testID={`${testID}-lleno`}
          style={{
            width: `${Math.round(lleno * 100)}%`,
            height: 6,
            borderRadius: 3,
            backgroundColor: COLOR.exito,
          }}
        />
      </View>
    </View>
  );
}

/**
 * «Atrás» y «Siguiente» (o el texto del último paso), lado a lado y grandes. Encima, por qué no
 * avanza, pegado al botón para que nunca parezca que no responde.
 */
export function BotonesDePasos({
  idioma,
  porQue,
  testIDPorQue = 'pasos-por-que',
  alAtras,
  alSiguiente,
  textoSiguiente,
  testIDSiguiente = 'pasos-siguiente',
  cargando,
  siguiente,
  logistica,
}: {
  idioma: Idioma;
  porQue?: string | null;
  testIDPorQue?: string;
  /** Sin esto no hay «Atrás» (primer paso sin salida propia). */
  alAtras?: () => void;
  alSiguiente?: () => void;
  textoSiguiente?: string;
  testIDSiguiente?: string;
  cargando?: boolean;
  /** Un botón propio en lugar de «Siguiente» (el de pedir del último paso). */
  siguiente?: ReactNode;
  /** C-COLOR-LOGISTICA: en Flex y Envíos, el botón con el color de logística. */
  logistica?: boolean;
}) {
  const t = textosPasos(idioma);
  return (
    <View style={{ gap: 4 }}>
      {porQue ? (
        <Text
          style={[e.error, { marginBottom: 4 }]}
          accessibilityRole="alert"
          testID={testIDPorQue}
        >
          {porQue}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        {alAtras ? (
          <View style={{ flex: 1, minWidth: 0 }}>
            <Boton texto={t.atras} alTocar={alAtras} tipo="borde" testID="pasos-atras" />
          </View>
        ) : null}
        <View style={{ flex: 2, minWidth: 0 }}>
          {siguiente ?? (
            <Boton
              texto={textoSiguiente ?? t.siguiente}
              alTocar={alSiguiente ?? (() => undefined)}
              cargando={cargando}
              logistica={logistica}
              testID={testIDSiguiente}
            />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * El formulario completo: barra, título del paso, sus casillas y los botones. `alSiguiente` valida el
 * paso (pone los errores a cada casilla y el `porQue`) y devuelve si se puede seguir; en el último
 * paso, si se puede, llama `alTerminar`. Desde el primer paso, «Atrás» solo sale con `alSalir`.
 */
export function FormularioPorPasos({
  pasos,
  paso,
  alCambiarPaso,
  alSiguiente,
  alTerminar,
  alSalir,
  textoTerminar,
  testIDTerminar,
  porQue,
  testIDPorQue,
  cargando,
  idioma,
  testID = 'formulario-por-pasos',
  logistica,
}: {
  pasos: readonly PasoVisible[];
  paso: string;
  alCambiarPaso: (clave: string) => void;
  alSiguiente: (clave: string) => boolean;
  alTerminar: () => void;
  alSalir?: () => void;
  textoTerminar: string;
  testIDTerminar?: string;
  porQue?: string | null;
  testIDPorQue?: string;
  cargando?: boolean;
  idioma: Idioma;
  testID?: string;
  logistica?: boolean;
}) {
  const indice = indiceDePaso(pasos, paso);
  const actual = pasos.at(indice) ?? pasos.at(0);
  if (!actual) return null;
  const sigue = pasoSiguiente(pasos, actual.clave);
  const antes = pasoAnterior(pasos, actual.clave);
  return (
    <View testID={testID}>
      <BarraDePasos indice={indice} total={pasos.length} idioma={idioma} />
      <View testID={`pasos-paso-${actual.clave}`}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: FUENTE.titulo,
            fontSize: 22,
            lineHeight: 28,
            color: COLOR.texto,
            marginBottom: actual.ayuda ? 4 : 12,
          }}
        >
          {actual.titulo}
        </Text>
        {actual.ayuda ? (
          <Text style={{ color: COLOR.textoSuave, fontSize: 15, marginBottom: 12 }}>
            {actual.ayuda}
          </Text>
        ) : null}
        {actual.contenido}
      </View>
      <BotonesDePasos
        idioma={idioma}
        porQue={porQue}
        testIDPorQue={testIDPorQue}
        cargando={cargando}
        logistica={logistica}
        alAtras={antes ? () => alCambiarPaso(antes) : alSalir}
        textoSiguiente={sigue ? undefined : textoTerminar}
        testIDSiguiente={sigue ? 'pasos-siguiente' : (testIDTerminar ?? 'pasos-terminar')}
        alSiguiente={() => {
          if (!alSiguiente(actual.clave)) return;
          if (sigue) alCambiarPaso(sigue);
          else alTerminar();
        }}
      />
    </View>
  );
}
