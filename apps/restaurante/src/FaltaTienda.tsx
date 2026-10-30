import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { type Api, type Idioma, enIdioma, textoLinea } from '@tumbite/compartido';
import { Boton, C } from '@tumbite/movil';

const T = {
  es: {
    cual: '¿Qué producto falta?',
    reemplazos: 'Propón hasta 3 reemplazos (el cliente nunca paga más que el original):',
    buscar: 'Buscar un producto',
    avisar: 'Avisar al cliente',
  },
  en: {
    cual: 'Which item is missing?',
    reemplazos: 'Suggest up to 3 replacements (the customer never pays more than the original):',
    buscar: 'Search a product',
    avisar: 'Notify the customer',
  },
};

type Linea = Parameters<typeof textoLinea>[0] & { platoId: string };

/**
 * C-TIENDAS-REEMPLAZOS (29 oct 2026) en la app: en una tienda, el producto que falta y hasta tres
 * reemplazos de su catálogo, como el escaneo de Instacart. El cliente elige con un toque.
 */
export function FaltaTienda({
  api,
  idioma,
  lineas,
  avisar,
}: {
  api: Api;
  idioma: Idioma;
  lineas: Linea[];
  avisar: (platoId: string, propuestas: string[]) => void;
}) {
  const t = enIdioma(T, idioma);
  const [falta, setFalta] = useState('');
  const [busca, setBusca] = useState('');
  const [encontrados, setEncontrados] = useState<
    { id: string; nombreEs: string; nombreEn: string; disponible: boolean }[]
  >([]);
  const [propuestas, setPropuestas] = useState<string[]>([]);
  useEffect(() => {
    if (busca.trim().length < 2) return;
    const reloj = setTimeout(() => {
      api
        .pedir<{ productos: typeof encontrados }>(
          'GET',
          `/datos/mi-restaurante/productos?q=${encodeURIComponent(busca.trim())}`,
        )
        .then((r) => setEncontrados(r.productos.filter((x) => x.disponible).slice(0, 8)))
        .catch(() => setEncontrados([]));
    }, 300);
    return () => clearTimeout(reloj);
  }, [api, busca]);
  const ficha = (activa: boolean) => ({
    borderWidth: 1,
    borderColor: activa ? C.primario : '#D6D6D6',
    backgroundColor: activa ? '#FFF1F2' : '#fff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  });
  return (
    <View style={{ gap: 6, marginTop: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '700' }}>{t.cual}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {lineas.map((l) => (
          <Pressable
            key={l.platoId}
            onPress={() => setFalta(l.platoId)}
            accessibilityRole="radio"
            accessibilityState={{ checked: falta === l.platoId }}
            style={ficha(falta === l.platoId)}
          >
            <Text style={{ fontSize: 13 }}>{textoLinea(l, idioma)}</Text>
          </Pressable>
        ))}
      </View>
      {falta ? (
        <>
          <Text style={{ fontSize: 13, color: '#5E5E5E' }}>{t.reemplazos}</Text>
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder={t.buscar}
            accessibilityLabel={t.buscar}
            style={{ borderWidth: 1, borderColor: '#D6D6D6', borderRadius: 8, padding: 8 }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {encontrados.map((x) => {
              const marcado = propuestas.includes(x.id);
              return (
                <Pressable
                  key={x.id}
                  disabled={!marcado && propuestas.length >= 3}
                  onPress={() =>
                    setPropuestas((ps) => (marcado ? ps.filter((y) => y !== x.id) : [...ps, x.id]))
                  }
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: marcado }}
                  style={ficha(marcado)}
                >
                  <Text style={{ fontSize: 13 }}>
                    {idioma === 'en' ? x.nombreEn || x.nombreEs : x.nombreEs || x.nombreEn}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Boton texto={t.avisar} alTocar={() => avisar(falta, propuestas)} />
        </>
      ) : null}
    </View>
  );
}
