import { Pressable, Text, View, type TextInputProps } from 'react-native';
import { type DireccionElegida, useSugerenciasDireccion } from '@tumbite/compartido';
import { useSesion } from './sesion';
import { Campo } from './ui';

/**
 * C-DIRECCION-SUGERENCIAS en las apps: la casilla de dirección de TODAS las pantallas (comida, Moto
 * recogida y destino, envíos, direcciones guardadas). Mientras se escribe salen direcciones reales;
 * al tocar una llega con sus coordenadas exactas. La lista va debajo de la casilla, sin ventanas.
 */
export function CampoDireccion({
  etiqueta,
  valor,
  cambiar,
  alElegir,
  pais,
  cerca,
  error,
  ...props
}: Omit<TextInputProps, 'value' | 'onChangeText'> & {
  etiqueta: string;
  valor: string;
  cambiar: (texto: string) => void;
  alElegir: (d: DireccionElegida) => void;
  pais?: string | null;
  cerca?: { lat: number; lng: number } | null;
  error?: string;
}) {
  const { api } = useSesion();
  const s = useSugerenciasDireccion({ pedir: api.pedir.bind(api) as never, pais, cerca });

  async function elegir(id: string, texto: string) {
    cambiar(texto);
    const d = await s.elegir(id);
    if (d) {
      cambiar(d.direccion || texto);
      alElegir(d);
    }
  }

  return (
    <View>
      <Campo
        {...props}
        etiqueta={etiqueta}
        error={error}
        value={valor}
        autoCorrect={false}
        onChangeText={(x) => {
          cambiar(x);
          s.buscar(x);
        }}
      />
      {s.sugerencias.length ? (
        <View
          accessibilityRole="list"
          style={{
            borderWidth: 1,
            borderColor: '#2a2a2a',
            borderRadius: 10,
            backgroundColor: '#fff',
            marginTop: -6,
            overflow: 'hidden',
          }}
        >
          {s.sugerencias.map((x, i) => (
            <Pressable
              key={x.id}
              onPress={() => void elegir(x.id, x.texto)}
              accessibilityRole="button"
              accessibilityLabel={x.texto}
              testID={`sugerencia-direccion-${i}`}
              style={({ pressed }) => ({
                paddingVertical: 12,
                paddingHorizontal: 14,
                backgroundColor: pressed ? '#f1f1f1' : '#fff',
                borderTopWidth: i ? 1 : 0,
                borderTopColor: '#eee',
              })}
            >
              <Text style={{ color: '#101010' }}>{x.texto}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
