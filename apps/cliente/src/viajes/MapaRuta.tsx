import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { useModoColor } from '@tumbite/movil';
import { type PuntoMapa, proyectarRuta } from './mismaRuta';

/**
 * C-MISMA-RUTA (15 nov 2026) — todos los países. El mapita de la ruta de un viaje (sistema de diseño,
 * secciones 7 y 9): los puntos REALES (recogida, paradas y destino) proyectados al recuadro, sobre el
 * suelo gris claro del mapa de día (de noche, el del mapa oscuro). Ruta en tinta de 5, recogida círculo
 * blanco con borde tinta, destino cuadrado rojo de la marca. Sin calles ni nombres inventados: el
 * fondo es un cuadriculado neutro de manzanas, solo de adorno.
 */
const DIA = { suelo: '#EEF0F3', manzana: '#E3E6EA', ruta: '#101010', blanco: '#FFFFFF' };
const NOCHE = { suelo: '#141416', manzana: '#1B1B1E', ruta: '#FFFFFF', blanco: '#0F0F10' };
const ROJO = '#F20D20';
const MANZANA = 34;
const CALLE = 6;

export function MapaRuta({
  puntos,
  alto = 96,
  esquinas = 0,
  testID,
  children,
}: {
  /** Recogida, paradas en orden y destino (coordenadas reales). */
  puntos: readonly PuntoMapa[];
  alto?: number;
  esquinas?: number;
  testID?: string;
  /** Lo que va encima del mapita (por ejemplo, la etiqueta del vehículo). */
  children?: React.ReactNode;
}) {
  const [ancho, setAncho] = useState(0);
  const c = useModoColor() === 'oscuro' ? NOCHE : DIA;
  const xy = ancho > 0 ? proyectarRuta(puntos, ancho, alto, 18) : [];
  const origen = xy.at(0);
  const destino = xy.length > 1 ? xy.at(-1) : undefined;
  const paradas = xy.slice(1, -1);
  const manzanas: { x: number; y: number }[] = [];
  for (let x = -10; x < ancho; x += MANZANA + CALLE)
    for (let y = -12; y < alto; y += MANZANA + CALLE) manzanas.push({ x, y });
  return (
    <View
      onLayout={(e) => setAncho(Math.round(e.nativeEvent.layout.width))}
      style={{
        height: alto,
        backgroundColor: c.suelo,
        borderRadius: esquinas,
        overflow: 'hidden',
      }}
      testID={testID}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {ancho > 0 ? (
        <Svg width={ancho} height={alto}>
          {manzanas.map((m) => (
            <Rect
              key={`${m.x}-${m.y}`}
              x={m.x}
              y={m.y}
              width={MANZANA}
              height={MANZANA}
              rx={4}
              fill={c.manzana}
            />
          ))}
          {xy.length > 1 ? (
            <Polyline
              points={xy.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={c.ruta}
              strokeWidth={5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : null}
          {paradas.map((p, i) => (
            <Circle
              key={`parada-${i}`}
              cx={p.x}
              cy={p.y}
              r={5}
              fill={c.blanco}
              stroke={c.ruta}
              strokeWidth={3}
            />
          ))}
          {origen ? (
            <Circle
              cx={origen.x}
              cy={origen.y}
              r={7}
              fill={c.blanco}
              stroke={c.ruta}
              strokeWidth={3}
            />
          ) : null}
          {destino ? (
            <Rect
              x={destino.x - 8}
              y={destino.y - 8}
              width={16}
              height={16}
              rx={2}
              fill={ROJO}
              stroke={c.ruta}
              strokeWidth={3}
            />
          ) : null}
        </Svg>
      ) : null}
      {children}
    </View>
  );
}
