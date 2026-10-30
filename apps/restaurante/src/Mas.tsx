import { Linking, Pressable, Text, View } from 'react-native';
import { opcionesMasRestaurante, textoVersion } from '@tumbite/compartido';
import { C, URL_SERVIDOR, VERSION_APP, useSesion, useSoporte } from '@tumbite/movil';
import { BotonGrande, Tarjeta } from './piezas/ui';

/**
 * Pestaña «Más» (C-MAS-RESTAURANTE): la lista de DoorDash Merchant con lo del local y la ayuda.
 * Lo que vive en el panel web se abre ahí; soporte va por WhatsApp. Cerrar sesión al final.
 */
export function Mas({
  titulo,
  textoSalir,
  salir,
}: {
  titulo: string;
  textoSalir: string;
  salir: () => void;
}) {
  const { api, idioma } = useSesion();
  const { whatsapp, abrirWhatsapp } = useSoporte(api);
  const abrir = (destino?: string) =>
    destino ? void Linking.openURL(`${URL_SERVIDOR}${destino}`) : void abrirWhatsapp();

  return (
    <View>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 22, fontWeight: '900', color: C.secundario, marginBottom: 12 }}
      >
        {titulo}
      </Text>
      {opcionesMasRestaurante(idioma).map((g) => (
        <View key={g.titulo} style={{ marginBottom: 6 }}>
          <Text style={{ fontWeight: '800', color: '#5E5E5E', fontSize: 13, marginBottom: 6 }}>
            {g.titulo}
          </Text>
          <Tarjeta style={{ padding: 0 }}>
            {g.opciones
              .filter((o) => o.destino || whatsapp)
              .map((o, i) => (
                <Pressable
                  key={o.id}
                  testID={`mas-${o.id}`}
                  accessibilityRole="link"
                  accessibilityLabel={o.titulo}
                  onPress={() => abrir(o.destino)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: '#ECECEC',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}>
                      {o.titulo}
                    </Text>
                    <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: 2 }}>{o.ayuda}</Text>
                  </View>
                  <Text style={{ fontSize: 22, color: '#9a9a9a' }}>›</Text>
                </Pressable>
              ))}
          </Tarjeta>
        </View>
      ))}
      <BotonGrande texto={textoSalir} tipo="claro" alTocar={salir} />
      <Text
        testID="version-app"
        style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: '#9a9a9a' }}
      >
        {textoVersion(VERSION_APP, idioma)}
      </Text>
    </View>
  );
}
