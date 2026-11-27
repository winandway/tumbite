import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Idioma, type TipoFotoMedicion, nombreFotoMedicion } from '@tumbite/compartido';
import { Modal } from './Hoja';
import { useSesion } from './sesion';
import { C } from './ui';
import { Text } from './diseno';

/**
 * C-FOTOS-PUBLICAS (Richard, 27 nov 2026) — todas las ciudades. «Así se ve el lugar»: las fotos
 * aprobadas de un lugar propio de la ciudad (la entrada, el letrero y la vista desde la calle que tomó
 * un conductor de confianza al medirlo), en la app de clientes y en Driver cuando ese lugar es la
 * recogida o el destino del viaje. Solo las aprobadas por el equipo; si el punto no es un lugar
 * propio con fotos, no se dibuja nada. Tocar una la abre grande.
 */
const T = {
  es: { titulo: 'Así se ve el lugar', cerrar: 'Cerrar', ver: 'Ver la foto' },
  en: { titulo: 'What the place looks like', cerrar: 'Close', ver: 'See the photo' },
};

type FotoLugar = { id: string; tipo: TipoFotoMedicion; uri: string };

export function AsiSeVeElLugar({
  punto,
  idioma,
  testID = 'asi-se-ve',
}: {
  punto: { lat: number; lng: number } | null;
  idioma: Idioma;
  testID?: string;
}) {
  const { api } = useSesion();
  const t = idioma === 'en' ? T.en : T.es;
  const nombre = (x: TipoFotoMedicion) => nombreFotoMedicion(x, idioma === 'en' ? 'en' : 'es');
  // Lo leído se guarda con el punto al que pertenece: si el punto cambia, lo viejo deja de verse.
  const [leido, setLeido] = useState<{ clave: string; lugar: string; fotos: FotoLugar[] } | null>(
    null,
  );
  const [grande, setGrande] = useState<FotoLugar | null>(null);
  const lat = punto?.lat;
  const lng = punto?.lng;
  const clave =
    typeof lat === 'number' && typeof lng === 'number' ? `${lat.toFixed(6)},${lng.toFixed(6)}` : '';

  useEffect(() => {
    let vivo = true;
    if (!clave) return;
    void (async () => {
      try {
        const r = await api.pedir<{
          lugar: { nombre: string } | null;
          fotos: { id: string; tipo: TipoFotoMedicion; url: string }[];
        }>('GET', `/datos/lugares/asi-se-ve?lat=${clave.split(',')[0]}&lng=${clave.split(',')[1]}`);
        if (!vivo || !r?.lugar || !Array.isArray(r.fotos) || !r.fotos.length) return;
        const listas = await Promise.all(
          r.fotos.map(async (f) => {
            try {
              return { id: f.id, tipo: f.tipo, uri: await api.verFoto(f.url) };
            } catch {
              // Una foto que el equipo acaba de quitar ya no se sirve: simplemente no se muestra.
              return null;
            }
          }),
        );
        if (!vivo) return;
        setLeido({
          clave,
          lugar: r.lugar.nombre,
          fotos: listas.filter((x): x is FotoLugar => !!x),
        });
      } catch (e) {
        // Sin fotos no se muestra nada: el viaje sigue igual. Se anota para el registro.
        console.warn('asi-se-ve: no se pudieron leer las fotos', String(e));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [api, clave]);

  const fotos = leido && leido.clave === clave ? leido.fotos : [];
  const lugar = leido?.lugar ?? '';
  if (!fotos.length) return null;
  return (
    <View testID={testID} style={{ gap: 6 }}>
      <Text style={{ color: '#666B73', fontSize: 12 }}>
        {lugar ? `${t.titulo} · ${lugar}` : t.titulo}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {fotos.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => setGrande(f)}
              accessibilityRole="button"
              accessibilityLabel={`${t.ver}: ${nombre(f.tipo)}`}
              style={({ pressed }) => ({ width: 96, opacity: pressed ? 0.85 : 1 })}
            >
              <Image
                source={{ uri: f.uri }}
                style={{ width: 96, height: 72, borderRadius: 10, backgroundColor: '#F4F5F7' }}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
              <Text style={{ fontSize: 11, color: C.secundario }} numberOfLines={2}>
                {nombre(f.tipo)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <Modal
        visible={!!grande}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setGrande(null)}
        testID={`${testID}-grande`}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#101010' }}>
          <View style={{ flex: 1, justifyContent: 'center', padding: 12, gap: 12 }}>
            {grande ? (
              <>
                <Image
                  source={{ uri: grande.uri }}
                  style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12 }}
                  resizeMode="contain"
                  accessibilityIgnoresInvertColors
                />
                <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
                  {lugar ? `${lugar} · ${nombre(grande.tipo)}` : nombre(grande.tipo)}
                </Text>
              </>
            ) : null}
            <Pressable
              onPress={() => setGrande(null)}
              accessibilityRole="button"
              accessibilityLabel={t.cerrar}
              style={{
                alignSelf: 'center',
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: '#fff',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t.cerrar}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}
