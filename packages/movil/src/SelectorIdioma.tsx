import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IDIOMAS, type Idioma } from '@tumbite/compartido';

/**
 * Selector de idioma estilo Amazon (regla global de Richard): botón «🇪🇸 ES ▾» y una
 * ventanita con «Cambiar idioma» y opciones con círculo, separadas por una línea.
 */
const TITULO = { es: 'Cambiar idioma', en: 'Change language' } as const;

export function SelectorIdioma({
  idioma,
  cambiar,
}: {
  idioma: Idioma;
  cambiar: (i: Idioma) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const actual = IDIOMAS.find((i) => i.codigo === idioma) ?? IDIOMAS[0];
  const titulo = idioma === 'en' ? TITULO.en : TITULO.es;
  const margen = useSafeAreaInsets();
  return (
    <View style={{ position: 'relative', zIndex: 20 }}>
      <Pressable
        onPress={() => setAbierto((a) => !a)}
        accessibilityRole="button"
        accessibilityLabel={titulo}
        accessibilityState={{ expanded: abierto }}
        hitSlop={8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 8,
          paddingVertical: 6,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: abierto ? '#fff' : 'transparent',
        }}
      >
        <Text style={{ fontSize: 18 }}>{actual.bandera}</Text>
        <Text style={{ color: '#fff', fontWeight: '800' }}>{actual.codigo.toUpperCase()}</Text>
        <Text style={{ color: '#fff', fontSize: 11 }}>▾</Text>
      </Pressable>
      <Modal
        visible={abierto}
        transparent
        animationType="fade"
        onRequestClose={() => setAbierto(false)}
      >
        {/* Tocar fuera cierra la ventanita, como en Amazon. */}
        <Pressable
          style={{ flex: 1 }}
          onPress={() => setAbierto(false)}
          accessibilityLabel={titulo}
        >
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={titulo}
            style={{
              position: 'absolute',
              right: 12,
              top: margen.top + 52,
              width: 230,
              backgroundColor: '#fff',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#d5d9d9',
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 6,
              shadowColor: '#000',
              shadowOpacity: 0.18,
              shadowRadius: 12,
              elevation: 8,
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: -8,
                right: 22,
                width: 14,
                height: 14,
                backgroundColor: '#fff',
                borderLeftWidth: 1,
                borderTopWidth: 1,
                borderColor: '#d5d9d9',
                transform: [{ rotate: '45deg' }],
              }}
            />
            <Text style={{ marginBottom: 6, color: '#101010' }}>{titulo}</Text>
            {[...IDIOMAS].reverse().map((i, n) => {
              const elegido = idioma === i.codigo;
              return (
                <Pressable
                  key={i.codigo}
                  onPress={() => {
                    cambiar(i.codigo);
                    setAbierto(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: elegido }}
                  accessibilityLabel={`${i.codigo === 'en' ? 'English' : 'español'} - ${i.codigo.toUpperCase()}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 10,
                    borderTopWidth: n > 0 ? 1 : 0,
                    borderTopColor: '#e7e7e7',
                  }}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: elegido ? '#C20A1A' : '#8d9096',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {elegido ? (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: '#C20A1A',
                        }}
                      />
                    ) : null}
                  </View>
                  <Text style={{ fontSize: 16 }}>{i.bandera}</Text>
                  <Text style={{ fontSize: 16, color: '#101010' }}>
                    {i.codigo === 'en' ? 'English' : 'español'} - {i.codigo.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
