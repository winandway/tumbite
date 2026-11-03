import { Pressable, Text, View } from 'react-native';
import { type OpcionMas, opcionesMasRestaurante } from '@tumbite/compartido';
import {
  C,
  OpcionesCuenta,
  URL_SERVIDOR,
  VersionInstalada,
  useSesion,
  useSoporte,
  abrirPanel,
} from '@tumbite/movil';
import { Tarjeta } from './piezas/ui';

/**
 * Pestaña «Más» (C-MAS-RESTAURANTE): la lista de DoorDash Merchant con lo del local y la ayuda.
 * Lo que vive en el panel web se abre ahí; soporte va por WhatsApp. Cerrar sesión al final.
 */
export function Mas({
  titulo,
  abrirPantalla,
}: {
  titulo: string;
  /** C-APP-RESTAURANTE-PAR: reseñas y horario se abren dentro de la app. */
  abrirPantalla: (p: NonNullable<OpcionMas['pantalla']>) => void;
}) {
  const { api, idioma } = useSesion();
  const { whatsapp, abrirWhatsapp } = useSoporte(api);
  const abrir = (o: { destino?: string; pantalla?: OpcionMas['pantalla'] }) =>
    o.pantalla
      ? abrirPantalla(o.pantalla)
      : o.destino
        ? void abrirPanel(api, URL_SERVIDOR, o.destino)
        : void abrirWhatsapp();

  return (
    <View>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 22, fontWeight: '800', color: C.secundario, marginBottom: 12 }}
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
              .filter((o) => o.destino || o.pantalla || whatsapp)
              .map((o, i) => (
                <Pressable
                  key={o.id}
                  testID={`mas-${o.id}`}
                  accessibilityRole="link"
                  accessibilityLabel={o.titulo}
                  onPress={() => abrir(o)}
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
      {/* C-CUENTA-EN-LA-APP: cerrar sesión y borrar la cuenta dentro de la app. */}
      <OpcionesCuenta />
      {/* C-VERSION-VISIBLE: versión y compilación instaladas, para soporte. */}
      <VersionInstalada />
    </View>
  );
}
