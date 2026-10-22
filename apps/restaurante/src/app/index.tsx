import { ActivityIndicator, Image, Text, View } from 'react-native';
import { Acceso, C, useSesion } from '@tumbite/movil';
import { Inicio } from '../Inicio';
import { IMG } from '../piezas/recursos';
import { textosRest } from '../piezas/textos';

/** Portada del acceso con el diseño aprobado: logotipo «Restaurante», «Inicia sesión». */
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
      <Text style={{ fontWeight: '900', fontSize: 20, color: C.secundario, marginTop: -6 }}>
        {t.restaurante}
      </Text>
      <Text
        accessibilityRole="header"
        style={{ fontWeight: '900', fontSize: 26, color: C.secundario, marginTop: 22 }}
      >
        {t.iniciaSesion}
      </Text>
      <Text style={{ color: '#5E5E5E', fontSize: 15, marginTop: 4 }}>{t.accede}</Text>
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
          backgroundColor: C.primario,
        }}
      >
        <ActivityIndicator color="#FFFFFF" size="large" />
      </View>
    );
  }
  return usuario ? <Inicio /> : <Acceso portada={<Portada />} />;
}
