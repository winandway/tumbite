import { Platform, Text, View } from 'react-native';
import { enIdioma, esAppDePruebas } from '@tumbite/compartido';
import { URL_SERVIDOR, useSesion } from './sesion';
import { TEXTOS_MOVIL } from './textos';

/**
 * C-APP-DE-PRUEBAS-VISIBLE (15 nov 2026) — todos los países. ¿Esta app instalada habla con un
 * servidor que no es el real? Solo en el teléfono: en la web, la dirección del navegador ya lo
 * dice, y las capturas de las guías se toman ahí.
 */
export const APP_DE_PRUEBAS = Platform.OS !== 'web' && esAppDePruebas(URL_SERVIDOR);

/**
 * La franja «PRUEBAS»: discreta, una línea, sin botón y sin tapar nada. Va en la pantalla de
 * entrar y en el menú de las tres apps. En la app de la tienda no pinta nada.
 */
export function FranjaPruebas({ visible = APP_DE_PRUEBAS }: { visible?: boolean }) {
  const { idioma } = useSesion();
  if (!visible) return null;
  const t = enIdioma(TEXTOS_MOVIL, idioma);
  return (
    <View
      testID="franja-pruebas"
      accessibilityRole="text"
      accessibilityLabel={`${t.franjaPruebas}. ${t.franjaPruebasDetalle}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'center',
        gap: 8,
        marginVertical: 8,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#B7791F',
        backgroundColor: '#FFF8E1',
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 12, letterSpacing: 1, color: '#7A4B00' }}>
        {t.franjaPruebas}
      </Text>
      <Text style={{ fontSize: 12, color: '#7A4B00', flexShrink: 1 }}>
        {t.franjaPruebasDetalle}
      </Text>
    </View>
  );
}
