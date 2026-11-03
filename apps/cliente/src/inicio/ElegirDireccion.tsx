import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Idioma } from '@tumbite/compartido';
import { C, CampoDireccion, useSesion } from '@tumbite/movil';
import type { DireccionEntrega } from '../comida/useRestaurantes';
import { textosInicio } from './textos';

type Guardada = {
  id: string;
  etiqueta: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
};

/**
 * POR-1 (2 nov 2026): «Entregar en ▾» del inicio, como DoorDash y Uber Eats. Una hoja con la
 * casilla de dirección de siempre (CampoDireccion, C-DIRECCION-SUGERENCIAS), las direcciones
 * guardadas de la persona y «Usar mi ubicación actual». Al elegir, la portada se ordena desde ahí.
 */
export function ElegirDireccion({
  visible,
  idioma,
  cerca,
  cerrar,
  elegir,
}: {
  visible: boolean;
  idioma: Idioma;
  cerca: { lat: number; lng: number } | null;
  cerrar: () => void;
  elegir: (d: DireccionEntrega | null) => void;
}) {
  const { api, usuario } = useSesion();
  const t = textosInicio(idioma);
  const [texto, setTexto] = useState('');
  const [guardadas, setGuardadas] = useState<Guardada[]>([]);
  useEffect(() => {
    if (!visible || !usuario) return;
    let vivo = true;
    api
      .pedir<{ direcciones: Guardada[] }>('GET', '/datos/mis-direcciones')
      .then((r) => {
        if (vivo) setGuardadas(r.direcciones.filter((d) => d.lat != null && d.lng != null));
      })
      .catch((e: unknown) => console.warn('direcciones guardadas: no se pudieron cargar', e));
    return () => {
      vivo = false;
    };
  }, [api, usuario, visible]);

  const listo = (d: DireccionEntrega | null) => {
    elegir(d);
    setTexto('');
    cerrar();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cerrar}>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: '#ECEDEF',
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ fontSize: 20, fontWeight: '700', color: C.secundario }}
          >
            {t.direccionTitulo}
          </Text>
          <Pressable
            onPress={cerrar}
            accessibilityRole="button"
            accessibilityLabel={t.cerrar}
            hitSlop={10}
          >
            <Text style={{ fontSize: 22, color: C.secundario }}>✕</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          <CampoDireccion
            etiqueta={t.direccionCasilla}
            valor={texto}
            cambiar={setTexto}
            cerca={cerca}
            alElegir={(d) => listo({ texto: d.direccion, punto: d.punto })}
            testID="inicio-direccion-casilla"
            autoFocus
          />
          <Pressable
            onPress={() => listo(null)}
            accessibilityRole="button"
            style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Text style={{ fontSize: 18, color: C.primario }}>◎</Text>
            <Text style={{ fontWeight: '700', color: C.secundario }}>{t.usarUbicacion}</Text>
          </Pressable>
          {guardadas.length ? (
            <View style={{ gap: 4 }}>
              <Text style={{ fontWeight: '700', color: '#666B73', marginTop: 4 }}>
                {t.direccionesGuardadas}
              </Text>
              {guardadas.map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() =>
                    listo({ texto: d.direccion, punto: { lat: d.lat ?? 0, lng: d.lng ?? 0 } })
                  }
                  accessibilityRole="button"
                  style={{
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: '#ECEDEF',
                  }}
                >
                  {d.etiqueta ? (
                    <Text style={{ fontWeight: '700', color: C.secundario }}>{d.etiqueta}</Text>
                  ) : null}
                  <Text style={{ color: '#666B73' }} numberOfLines={2}>
                    {d.direccion}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
