import { Icono, Text } from './diseno';
import { Pressable, View, type TextInputProps } from 'react-native';
import { type DireccionElegida, useSugerenciasDireccion } from '@tumbite/compartido';
import { useSesion } from './sesion';
import { C, Campo } from './ui';

/**
 * C-DIRECCION-SUGERENCIAS en las apps: la casilla de dirección de TODAS las pantallas (comida, Moto
 * recogida y destino, envíos, direcciones guardadas). Mientras se escribe salen direcciones reales;
 * al tocar una llega con sus coordenadas exactas. La lista va debajo de la casilla, sin ventanas.
 *
 * C-FIJAR-EN-MAPA: con `enMapa`, la casilla trae debajo su propia fila «Fijar … en el mapa» (como
 * Uber y DiDi), pegada a ella y con el texto de ESA casilla. Ya marcado, sale en verde con «Ajustar».
 */
export function CampoDireccion({
  etiqueta,
  valor,
  cambiar,
  alElegir,
  pais,
  cerca,
  error,
  enMapa,
  ...props
}: Omit<TextInputProps, 'value' | 'onChangeText'> & {
  etiqueta: string;
  valor: string;
  cambiar: (texto: string) => void;
  alElegir: (d: DireccionElegida) => void;
  pais?: string | null;
  cerca?: { lat: number; lng: number } | null;
  error?: string;
  /** C-FIJAR-EN-MAPA: la fila para fijar el punto de esta casilla en el mapa. */
  enMapa?: {
    texto: string;
    marcado: boolean;
    /** Ya marcado: la referencia que se ve debajo (opcional). */
    detalle?: string;
    ajustar: string;
    abrir: () => void;
    testID?: string;
  };
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
                backgroundColor: pressed ? '#EEEFF1' : '#fff',
                borderTopWidth: i ? 1 : 0,
                borderTopColor: '#eee',
              })}
            >
              <Text style={{ color: '#101010' }}>{x.texto}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {enMapa ? (
        <Pressable
          onPress={enMapa.abrir}
          accessibilityRole="button"
          testID={enMapa.testID ?? 'fijar-en-mapa'}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            minHeight: 44,
            paddingVertical: 8,
            paddingHorizontal: 4,
            marginTop: s.sugerencias.length ? 2 : -6,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icono
            nombre={enMapa.marcado ? 'checkmark-circle' : 'location-outline'}
            tamano={20}
            color={enMapa.marcado ? C.exito : C.primario}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{ fontWeight: '700', color: enMapa.marcado ? C.exito : C.primario }}
              numberOfLines={1}
            >
              {enMapa.texto}
            </Text>
            {enMapa.marcado && enMapa.detalle ? (
              <Text style={{ color: '#666B73', fontSize: 13 }} numberOfLines={1}>
                {enMapa.detalle}
              </Text>
            ) : null}
          </View>
          {enMapa.marcado ? (
            <Text style={{ fontWeight: '700', color: C.secundario }}>{enMapa.ajustar}</Text>
          ) : (
            <Icono nombre="chevron-forward" tamano={18} color="#666B73" />
          )}
        </Pressable>
      ) : null}
    </View>
  );
}
