import { useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Portapapeles from 'expo-clipboard';
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
 * `tamano="grande"`: la cifra protagonista de Driver (C-PRECIO-PROTAGONISTA: negrita, al menos del
 * tamaño del PIN; cabe en 360 de ancho y con letra grande del sistema: se achica sola en una línea
 * antes de partirse). En Driver va siempre con `color` verde de éxito.
 *
 * `copiable`: un botón «Copiar monto» copia los bolívares exactos (sin «Bs.»), para pegarlos en el
 * pago móvil del banco (revisión del 18 nov 2026).
 */
const TEXTOS_COPIAR = {
  es: { copiar: 'Copiar monto en bolívares', copiado: 'Monto copiado' },
  en: { copiar: 'Copy amount in bolívares', copiado: 'Amount copied' },
} as const;

/** Los bolívares tal como se escriben en el pago móvil: «205,72» (español) o «205.72» (inglés). */
export function montoParaCopiar(monto: Monto, idioma: 'es' | 'en'): string {
  return monto.local ? textoLocal(monto.local, idioma).replace(/^Bs\.\s*/, '') : '';
}

export function MontoEnMano({
  monto,
  idioma,
  quien,
  etiqueta,
  tamano = 'normal',
  color,
  soloLocal = false,
  copiable = false,
  centrado = false,
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
  /** Con un botón para copiar los bolívares exactos (pago móvil). */
  copiable?: boolean;
  /** Centrado bajo una cifra centrada (la pantalla «Método de pago»). */
  centrado?: boolean;
  testID?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  if (!monto || (soloLocal && !monto.local && !monto.sinTasa)) return null;
  const grande = tamano === 'grande';
  const t = idioma === 'en' ? TEXTOS_COPIAR.en : TEXTOS_COPIAR.es;
  const conBoton = copiable && Boolean(monto.local);
  return (
    <View
      testID={testID}
      accessible={!conBoton}
      accessibilityRole="text"
      style={{ gap: 2, ...(centrado ? { alignItems: 'center' as const } : {}) }}
    >
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
            // C-PRECIO-PROTAGONISTA: en grande, negrita (la cifra que el conductor busca de un vistazo).
            fontWeight: grande ? '800' : '700',
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
            style={{
              color: COLOR.textoSuave,
              fontSize: 13,
              ...(centrado ? { textAlign: 'center' as const } : {}),
            }}
          >
            {textoTasaUsada(monto.local, idioma)}
          </Text>
          {conBoton ? (
            <Pressable
              testID={testID ? `${testID}-copiar` : undefined}
              accessibilityRole="button"
              accessibilityLabel={copiado ? t.copiado : t.copiar}
              hitSlop={8}
              onPress={() => {
                void Portapapeles.setStringAsync(montoParaCopiar(monto, idioma))
                  .then(() => setCopiado(true))
                  .catch(() => setCopiado(false));
              }}
              style={{
                alignSelf: 'flex-start',
                marginTop: 6,
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: COLOR.bordeFuerte,
              }}
            >
              <Text style={{ fontWeight: '700', color: copiado ? COLOR.exito : COLOR.texto }}>
                {copiado ? t.copiado : t.copiar}
              </Text>
            </Pressable>
          ) : null}
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
