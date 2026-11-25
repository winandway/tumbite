import { View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { BarraPasosDriver, DK, EtiquetaServicioDriver, Text } from '@tumbite/movil';
import { textosDriver } from './textos';

/**
 * C-REDISENO-DRIVER: Recoger → Entregar → Completar del pedido de comida, con la barra de tres pasos
 * del borrador (lo hecho en verde, el paso de ahora en negro, lo que falta en gris), la etiqueta de
 * Comida y el nombre del paso de ahora.
 */
export function Progreso({ idioma, paso }: { idioma: Idioma; paso: 0 | 1 | 2 }) {
  const t = textosDriver(idioma);
  const nombres = [t.pasos.recoger, t.pasos.entregar, t.pasos.completar];
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 10 }} testID="progreso-pedido">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <EtiquetaServicioDriver tipo="comida" texto={idioma === 'en' ? 'Food' : 'Comida'} />
        <Text style={{ fontSize: 13, fontWeight: '600', color: DK.gris, flexShrink: 1 }}>
          {`${paso + 1}/3 · ${nombres.at(paso) ?? ''}`}
        </Text>
      </View>
      <BarraPasosDriver paso={paso} />
    </View>
  );
}
