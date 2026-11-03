import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { type Idioma, enIdioma, textoPesoReal } from '@tumbite/compartido';
import { Boton } from '@tumbite/movil';

const T = {
  es: {
    ayuda: 'Pésalo y escribe el peso real: se cobra eso, hasta un 15 % más de lo estimado.',
    peso: 'Peso real',
    guardar: 'Guardar peso',
  },
  en: {
    ayuda:
      'Weigh it and enter the actual weight: that’s what’s charged, up to 15% over the estimate.',
    peso: 'Actual weight',
    guardar: 'Save weight',
  },
};

export type LineaConPeso = {
  platoId: string;
  cantidad: number;
  pesable?: boolean;
  unidadPeso?: string | null;
  pesoEstimado?: number | null;
  pesoReal?: number;
};

/**
 * C-TIENDAS-PESO-REAL (SIG-3, 2 nov 2026) en la app: la tienda escribe el peso real de un producto
 * por peso mientras prepara (pagado o aceptado). Se cobra ese peso, con el tope del 15 %.
 */
export function PesoReal({
  idioma,
  linea,
  editable,
  guardar,
}: {
  idioma: Idioma;
  linea: LineaConPeso;
  editable: boolean;
  guardar: (peso: number) => void;
}) {
  const t = enIdioma(T, idioma);
  const [texto, setTexto] = useState('');
  if (!linea.pesable || !linea.pesoEstimado) return null;
  const peso = Number(texto.replace(',', '.'));
  const unidad = linea.unidadPeso ?? 'kg';
  return (
    <View style={{ gap: 6, marginTop: 4 }}>
      <Text style={{ fontSize: 13, color: '#5E5E5E' }}>
        {linea.pesoReal != null ? textoPesoReal(linea, idioma === 'en' ? 'en' : 'es') : t.ayuda}
      </Text>
      {editable ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            keyboardType="decimal-pad"
            placeholder={`${t.peso} (${unidad})`}
            accessibilityLabel={`${t.peso} (${unidad})`}
            style={{
              borderWidth: 1,
              borderColor: '#D6D6D6',
              borderRadius: 8,
              padding: 8,
              minWidth: 120,
            }}
          />
          <Boton
            texto={t.guardar}
            secundario
            alTocar={() => {
              if (peso > 0) guardar(peso);
            }}
          />
        </View>
      ) : null}
    </View>
  );
}
