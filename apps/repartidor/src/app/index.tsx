import { Image, View } from 'react-native';
import {
  Acceso,
  C,
  PantallaCarga,
  PreguntaLugar,
  PuertaTelefono,
  useSesion,
  Text,
} from '@tumbite/movil';
import { Inicio } from '../Inicio';
import { IMG } from '../piezas/recursos';

/** El azul petróleo de la pantalla de arranque (app.json, expo-splash-screen). */
const COLOR_ARRANQUE_DRIVER = '#1F4D69';

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
        source={IMG.logoOscuro}
        style={{ width: 220, height: 64 }}
        resizeMode="contain"
        accessibilityLabel="Divoox Driver"
      />
      <View
        style={{
          backgroundColor: C.primario,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 6,
          marginTop: 6,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14, letterSpacing: 1 }}>
          {idioma === 'en' ? 'For drivers' : 'Para conductores'}
        </Text>
      </View>
    </View>
  );
}

export default function Entrada() {
  const { cargando, usuario } = useSesion();
  // C-ARRANQUE-CON-MARCA: la pantalla de carga con la marca de la app mientras se lee la sesión.
  if (cargando) return <PantallaCarga />;
  // C-TELEFONO-AL-REGISTRARSE: la cuenta nueva confirma su celular por SMS antes de entrar.
  return usuario ? (
    <PuertaTelefono key={usuario.id}>
      <Inicio />
      {/* C-REGISTRO-TODO-EL-PAIS: la cuenta vieja sin ciudad la elige una vez, sin perder nada. */}
      <PreguntaLugar rol="repartidor" />
    </PuertaTelefono>
  ) : (
    // C-ACCESO-CON-CABECERA (26 nov 2026, Richard): «Entrar» sigue en el azul petróleo del arranque.
    <Acceso rolRegistro="repartidor" portada={<Portada />} cabecera={COLOR_ARRANQUE_DRIVER} />
  );
}
