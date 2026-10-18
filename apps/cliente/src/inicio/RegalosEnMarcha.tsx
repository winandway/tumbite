import { Pressable, Text, View } from 'react-native';
import { type Idioma, MARCA } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import type { Aviso } from './useAvisos';
import { textosInicio } from './textos';

/**
 * Regalos reales en marcha (tarjetas de sellos y descuentos por volver), en vez de las ofertas de
 * muestra. Tocar abre la pestaña de regalos de los avisos. Lo cumplido va en verde.
 */
export function RegalosEnMarcha({
  idioma,
  regalos,
  alVer,
}: {
  idioma: Idioma;
  regalos: Aviso[];
  alVer: () => void;
}) {
  const t = textosInicio(idioma);
  const lista = regalos.filter((r) => r.tipo === 'regalo').slice(0, 3);
  return (
    <View style={{ marginTop: 18, marginHorizontal: 16 }} testID="regalos-en-marcha">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>{t.tusRegalos}</Text>
        <Pressable onPress={alVer} accessibilityRole="button" accessibilityLabel={t.verRegalos}>
          <Text style={{ color: '#5E5E5E', fontWeight: '600' }}>{t.verRegalos} ›</Text>
        </Pressable>
      </View>
      {lista.map((r) =>
        r.tipo !== 'regalo' ? null : (
          <Pressable
            key={`${r.restauranteId}-${r.regalo}`}
            onPress={alVer}
            accessibilityRole="button"
            accessibilityLabel={r.restauranteNombre}
            style={{
              backgroundColor: '#fff',
              borderRadius: 18,
              padding: 14,
              marginTop: 10,
              shadowColor: '#191919',
              shadowOpacity: 0.08,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 15, color: C.secundario }}>
              {(r.regalo === 'sellos' ? t.avisoSellos : t.avisoVuelve).replace(
                '{restaurante}',
                r.restauranteNombre,
              )}
            </Text>
            {r.regalo === 'sellos' ? (
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#E9ECF1',
                  marginTop: 10,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${Math.round((r.progreso / r.meta) * 100)}%`,
                    height: 6,
                    backgroundColor: MARCA.colores.exito,
                  }}
                />
              </View>
            ) : null}
          </Pressable>
        ),
      )}
    </View>
  );
}
