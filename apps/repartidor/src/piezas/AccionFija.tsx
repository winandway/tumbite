import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnchoDriver, DK } from '@tumbite/movil';
import { colocarAccionFija } from './accionFijaLogica';

/**
 * C-BOTON-SOBRE-BARRA (27 nov 2026) — todos los países. La pieza ÚNICA de la acción principal fija
 * de las hojas de trabajo de Driver (comida, viajes de Moto y Carro, envíos, Flex y «Estoy aquí»).
 *
 * Cada pantalla deja su acción donde siempre, envuelta en `<AccionFija>`; la pantalla de afuera (el
 * lienzo de Inicio o «Mi ruta») la pinta en `<AnclaAccionFija>`, fija arriba de la barra de abajo y
 * del área segura (cuentas en accionFijaLogica.ts), y `<EspacioAccionFija>` deja al final del
 * contenido el alto de la acción para que nada quede escondido detrás. Fuera de una zona (sin
 * registro) la acción se pinta en su lugar, como antes.
 */
type Registro = {
  nodos: Map<string, ReactNode>;
  alto: number;
  version: number;
  oyentes: Set<() => void>;
};

export type RegistroAccionFija = Registro & {
  poner: (id: string, nodo: ReactNode) => void;
  quitar: (id: string) => void;
  fijarAlto: (alto: number) => void;
  suscribir: (oyente: () => void) => () => void;
};

export function crearRegistroAccionFija(): RegistroAccionFija {
  const r: Registro = { nodos: new Map(), alto: 0, version: 0, oyentes: new Set() };
  const avisar = () => {
    r.version += 1;
    for (const o of r.oyentes) o();
  };
  return Object.assign(r, {
    poner: (id: string, nodo: ReactNode) => {
      r.nodos.set(id, nodo);
      avisar();
    },
    quitar: (id: string) => {
      if (!r.nodos.delete(id)) return;
      if (!r.nodos.size) r.alto = 0;
      avisar();
    },
    fijarAlto: (alto: number) => {
      const redondo = Math.round(alto);
      if (redondo === r.alto) return;
      r.alto = redondo;
      avisar();
    },
    suscribir: (oyente: () => void) => {
      r.oyentes.add(oyente);
      return () => {
        r.oyentes.delete(oyente);
      };
    },
  });
}

/** El registro de la pantalla de afuera, estable entre pintadas. */
export function useRegistroAccionFija(): RegistroAccionFija {
  const [registro] = useState(crearRegistroAccionFija);
  return registro;
}

const Contexto = createContext<RegistroAccionFija | null>(null);

export function ZonaAccionFija({
  registro,
  children,
}: {
  registro: RegistroAccionFija;
  children: ReactNode;
}) {
  return <Contexto.Provider value={registro}>{children}</Contexto.Provider>;
}

const useVersion = (r: RegistroAccionFija) =>
  useSyncExternalStore(
    r.suscribir,
    () => r.version,
    () => r.version,
  );

/** La acción principal de la hoja: se pinta fija sobre la barra de abajo (no en su lugar). */
export function AccionFija({ children, testID }: { children: ReactNode; testID?: string }) {
  const registro = useContext(Contexto);
  const id = useId();
  // En cada pintada se entrega la acción de ahora (sus manejadores frescos); al salir, se quita.
  useLayoutEffect(() => {
    registro?.poner(
      id,
      <View key={id} testID={testID}>
        {children}
      </View>,
    );
  });
  useLayoutEffect(() => () => registro?.quitar(id), [registro, id]);
  if (!registro) return <>{children}</>;
  return null;
}

/**
 * Donde se pinta la acción: fija, a `abajo` del borde de la pantalla de la app (barra + área
 * segura). Va como hija directa de la pantalla entera (no del desplazable).
 */
export function AnclaAccionFija({
  registro,
  altoBarra,
  fondo = DK.blanco,
}: {
  registro: RegistroAccionFija;
  /** Alto medido de la barra de abajo (BarraInferior → alMedir). */
  altoBarra: number;
  fondo?: string;
}) {
  useVersion(registro);
  const abajoSeguro = useSafeAreaInsets().bottom;
  const nodos = [...registro.nodos.values()];
  if (!nodos.length) return null;
  const { abajo } = colocarAccionFija({ altoBarra, areaSeguraAbajo: abajoSeguro });
  return (
    <View
      testID="accion-fija"
      pointerEvents="box-none"
      onLayout={(ev) => registro.fijarAlto(ev.nativeEvent.layout.height)}
      style={[
        e.ancla,
        {
          bottom: abajo,
          backgroundColor: fondo,
          borderTopColor: fondo === DK.blanco ? DK.borde : 'rgba(255,255,255,0.12)',
        },
      ]}
    >
      <AnchoDriver estilo={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        {nodos}
      </AnchoDriver>
    </View>
  );
}

/** Al final del contenido desplazable: el alto de la acción fija y su aire (sin acción, nada). */
export function EspacioAccionFija({ registro }: { registro: RegistroAccionFija }) {
  useVersion(registro);
  const { rellenoContenido } = colocarAccionFija({
    altoBarra: 0,
    areaSeguraAbajo: 0,
    altoAccion: registro.nodos.size ? registro.alto : 0,
  });
  return rellenoContenido ? <View style={{ height: rellenoContenido }} /> : null;
}

const e = StyleSheet.create({
  ancla: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 10,
  },
});
