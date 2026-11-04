import { ActivityIndicator, View } from 'react-native';
import { C, SesionSinConfirmar, useSesion } from '@tumbite/movil';
import { Inicio } from '../Inicio';

export default function Entrada() {
  const { cargando, usuario, sinConfirmar } = useSesion();
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
  // C-SESION-CON-LIMITE: con una sesión guardada que no se pudo confirmar, se reintenta (no se
  // muestra como invitado a quien sí tiene cuenta). Sin sesión, se mira sin cuenta (C-MIRAR-SIN-CUENTA).
  if (!usuario && sinConfirmar) return <SesionSinConfirmar />;
  return <Inicio />;
}
