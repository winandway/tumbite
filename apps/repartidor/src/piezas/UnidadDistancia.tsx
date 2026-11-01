import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { elegirUnidadDistancia, enIdioma } from '@tumbite/compartido';
import { C, e, useSesion } from '@tumbite/movil';

/**
 * C-UNIDAD-ELEGIDA (1 nov 2026, pedido de Richard): el repartidor elige con un toque si ve las
 * distancias en millas o en kilómetros. Se guarda en el celular y vale para toda la app (ofertas,
 * Mi ruta, avisos). Sin elección, manda el país del servicio.
 */
const CLAVE = 'divoox.unidad-distancia';

export function useUnidadDistancia() {
  const [unidad, setUnidad] = useState<'mi' | 'km' | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(CLAVE)
      .then((v) => {
        const u = v === 'mi' || v === 'km' ? v : null;
        elegirUnidadDistancia(u);
        setUnidad(u);
      })
      .catch(() => undefined);
  }, []);
  const cambiar = useCallback((u: 'mi' | 'km') => {
    elegirUnidadDistancia(u);
    setUnidad(u);
    AsyncStorage.setItem(CLAVE, u).catch(() => undefined);
  }, []);
  return { unidad, cambiar };
}

const T = {
  es: { titulo: 'Distancias en', mi: 'Millas', km: 'Kilómetros' },
  en: { titulo: 'Distances in', mi: 'Miles', km: 'Kilometers' },
};

export function UnidadDistancia({
  unidad,
  porPais,
  cambiar,
}: {
  unidad: 'mi' | 'km' | null;
  /** Lo que se usa sin elección (según el país). */
  porPais: 'mi' | 'km';
  cambiar: (u: 'mi' | 'km') => void;
}) {
  const { idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const actual = unidad ?? porPais;
  return (
    <View testID="unidad-distancia" style={[e.tarjeta, { gap: 8 }]}>
      <Text style={{ fontWeight: '700', fontSize: 15 }}>{t.titulo}</Text>
      <View
        accessibilityRole="radiogroup"
        style={{ flexDirection: 'row', borderWidth: 1, borderColor: '#D0D0D0', borderRadius: 10 }}
      >
        {(['mi', 'km'] as const).map((u) => {
          const activa = actual === u;
          return (
            <Pressable
              key={u}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
              onPress={() => cambiar(u)}
              style={{
                flex: 1,
                paddingVertical: 10,
                alignItems: 'center',
                borderRadius: 9,
                backgroundColor: activa ? C.secundario : 'transparent',
              }}
            >
              <Text style={{ fontWeight: '700', color: activa ? '#FFFFFF' : C.secundario }}>
                {u === 'mi' ? t.mi : t.km}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
