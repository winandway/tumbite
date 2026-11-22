import { View } from 'react-native';
import {
  TEXTOS_PAGO_COMIDA_CONDUCTOR,
  type Idioma,
  type VistaPagoComida,
  enIdioma,
} from '@tumbite/compartido';
import { C, Text } from '@tumbite/movil';

/**
 * C-COMIDA-PAGO-RESTAURANTE: en los países donde el cliente le paga la comida directo al
 * restaurante, el conductor no adelanta nada. Mientras el restaurante no confirme «Me llegó», espera;
 * con la confirmación, sale a recoger. Al entregar cobra solo el envío.
 */
export function SalidaPagoComida({ pago, idioma }: { pago: VistaPagoComida; idioma: Idioma }) {
  const t = enIdioma(TEXTOS_PAGO_COMIDA_CONDUCTOR, idioma === 'en' ? 'en' : 'es');
  const listo = pago.listoParaIr;
  return (
    <View
      testID={listo ? 'pago-comida-salida' : 'pago-comida-espera'}
      accessibilityLiveRegion="polite"
      style={{
        marginTop: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2a2a2a',
        backgroundColor: '#fff',
        gap: 4,
      }}
    >
      <Text style={{ fontWeight: '800', fontSize: 17, color: listo ? C.exito : C.secundario }}>
        {listo ? t.salida : t.espera}
      </Text>
      <Text style={{ color: C.secundario }}>{listo ? t.salidaDetalle : t.esperaDetalle}</Text>
      <Text style={{ color: '#666B73', fontSize: 13 }}>{t.cobras}</Text>
    </View>
  );
}
