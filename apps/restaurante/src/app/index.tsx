import { Image, View } from 'react-native';
import { Acceso, C, PantallaCarga, useSesion, Text } from '@tumbite/movil';
import { Inicio } from '../Inicio';
import { IMG } from '../piezas/recursos';
import { textosRest } from '../piezas/textos';

/**
 * Portada del acceso con el diseño aprobado: logotipo «Restaurante». El título («Entrar» o «Crear
 * cuenta») lo pone la pantalla de acceso (C-RESTAURANTE-DESDE-EL-TELEFONO).
 */
function Portada() {
  const { idioma } = useSesion();
  const t = textosRest(idioma);
  return (
    <View style={{ alignItems: 'center', marginBottom: 20 }}>
      <Image
        source={IMG.logo}
        style={{ width: 220, height: 64 }}
        resizeMode="contain"
        accessibilityLabel="Divoox"
      />
      <Text style={{ fontWeight: '800', fontSize: 20, color: C.secundario, marginTop: -6 }}>
        {t.restaurante}
      </Text>
    </View>
  );
}

export default function Entrada() {
  const { cargando, usuario } = useSesion();
  // C-ARRANQUE-CON-MARCA: la pantalla de carga con la marca de la app mientras se lee la sesión.
  if (cargando) return <PantallaCarga />;
  return usuario ? <Inicio /> : <Acceso rolRegistro="restaurante" portada={<Portada />} />;
}
