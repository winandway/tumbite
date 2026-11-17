import { Pressable, View } from 'react-native';
import { textosPuntoExacto } from '@tumbite/compartido';
import { C, Icono, Text, useSesion } from '@tumbite/movil';
import type { Punto } from './ubicacion';

/**
 * C-PUNTO-EXACTO: la tarjeta del punto exacto en el carrito, el viaje y los envíos. Dice si la puerta
 * ya está marcada en el mapa, con su referencia, y abre la pantalla del pin fijo («Ajustar el punto»).
 */
export function ResumenPunto({
  punto,
  direccion,
  referencia,
  abrir,
  testID = 'resumen-punto',
}: {
  punto: Punto | null;
  direccion: string;
  referencia?: string;
  abrir: () => void;
  testID?: string;
}) {
  const { idioma } = useSesion();
  const t = textosPuntoExacto(idioma);
  const listo = punto != null && direccion.trim().length > 0;
  return (
    <Pressable
      onPress={abrir}
      accessibilityRole="button"
      // Sin nombre propio: el lector lee lo que se ve (título, dirección y «Ajustar el punto»),
      // así el nombre del botón siempre contiene su texto visible (WCAG 2.5.3, la prueba de accesibilidad).
      testID={testID}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: '#2a2a2a',
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: listo ? '#E6F2EA' : '#FDECEE',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icono nombre="location" tamano={22} color={listo ? C.exito : C.primario} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: '700', color: C.secundario }}>
          {listo ? t.puntoMarcado : t.marcar}
        </Text>
        <Text style={{ color: '#666B73', fontSize: 13 }} numberOfLines={2}>
          {listo ? [direccion, referencia].filter(Boolean).join(' · ') : t.sinMarcar}
        </Text>
      </View>
      <Text style={{ fontWeight: '700', color: C.primario }}>{listo ? t.ajustar : ''}</Text>
    </Pressable>
  );
}
