import { ActivityIndicator, Image, Text, View } from 'react-native';
import { Acceso, C, useSesion } from '@tumbite/movil';
import { Inicio } from '../Inicio';
import { IMG } from '../piezas/recursos';

/**
 * C-ICONOS-POR-APP (3 nov 2026, lámina aprobada por Richard): Driver entra con su propia portada en
 * el azul de logística, que dice para quién es, y no con la cabecera roja del cliente. Apple leyó
 * las tres apps como copias (4.3) en parte porque la primera pantalla era igual.
 */
function Portada() {
  const { idioma } = useSesion();
  return (
    <View style={{ alignItems: 'center', marginBottom: 20 }}>
      <Image
        source={IMG.logo}
        style={{ width: 220, height: 64 }}
        resizeMode="contain"
        accessibilityLabel="Divoox Driver"
      />
      <View
        style={{
          backgroundColor: C.logistica,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 6,
          marginTop: 6,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 1 }}>
          {idioma === 'en' ? 'For drivers' : 'Para repartidores'}
        </Text>
      </View>
    </View>
  );
}

export default function Entrada() {
  const { cargando, usuario } = useSesion();
  if (cargando) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: C.logistica,
        }}
      >
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }
  return usuario ? <Inicio /> : <Acceso rolRegistro="repartidor" portada={<Portada />} />;
}
