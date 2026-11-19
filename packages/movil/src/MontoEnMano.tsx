import { View } from 'react-native';
import {
  type MontoEnMano as Monto,
  formatearMonto,
  textoLocal,
  textoSinTasa,
  textoTasaUsada,
} from '@tumbite/compartido';
import { Text } from './diseno';
import { COLOR } from './tokens';

/**
 * C-BS-EN-MANO (18 nov 2026, Venezuela; en Estados Unidos solo se ve el monto en dólares): la pieza
 * ÚNICA que muestra lo que se cobra o se paga en mano. Arriba el monto en dólares; debajo, en
 * bolívares con la tasa fijada del viaje o del pedido, y la tasa usada con su fecha (para pagar por
 * pago móvil el monto exacto). Sin tasa vigente lo dice en palabras: nunca un número inventado.
 *
 * `tamano="grande"`: la cifra protagonista de la tarjeta del viaje de Driver (cabe en 360 de ancho y
 * con letra grande del sistema: se achica sola en una línea antes de partirse).
 */
export function MontoEnMano({
  monto,
  idioma,
  quien,
  etiqueta,
  tamano = 'normal',
  color,
  soloLocal = false,
  testID,
}: {
  monto: Monto | null | undefined;
  idioma: 'es' | 'en';
  quien: 'conductor' | 'pasajero';
  etiqueta?: string;
  tamano?: 'normal' | 'grande';
  color?: string;
  /** Donde el monto en dólares ya se ve al lado: solo los bolívares, la tasa o el aviso sin tasa. */
  soloLocal?: boolean;
  testID?: string;
}) {
  if (!monto || (soloLocal && !monto.local && !monto.sinTasa)) return null;
  const grande = tamano === 'grande';
  return (
    <View testID={testID} accessible accessibilityRole="text" style={{ gap: 2 }}>
      {etiqueta ? (
        <Text style={{ color: COLOR.textoSuave, fontWeight: '700' }}>{etiqueta}</Text>
      ) : null}
      {soloLocal ? null : (
        <Text
          testID={testID ? `${testID}-usd` : undefined}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{
            fontSize: grande ? 44 : 22,
            lineHeight: grande ? 52 : 28,
            fontWeight: '700',
            color: color ?? COLOR.texto,
          }}
        >
          {formatearMonto(monto.monto, monto.moneda, idioma)}
        </Text>
      )}
      {monto.local ? (
        <>
          <Text
            testID={testID ? `${testID}-bs` : undefined}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            style={{
              fontSize: grande ? 24 : 17,
              lineHeight: grande ? 30 : 22,
              fontWeight: '700',
              color: COLOR.texto,
            }}
          >
            {textoLocal(monto.local, idioma)}
          </Text>
          <Text
            testID={testID ? `${testID}-tasa` : undefined}
            style={{ color: COLOR.textoSuave, fontSize: 13 }}
          >
            {textoTasaUsada(monto.local, idioma)}
          </Text>
        </>
      ) : null}
      {monto.sinTasa ? (
        <Text
          testID={testID ? `${testID}-sin-tasa` : undefined}
          style={{ color: COLOR.aviso, fontSize: 13, fontWeight: '700' }}
        >
          {textoSinTasa(idioma, quien)}
        </Text>
      ) : null}
    </View>
  );
}
