import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Acceso } from './Acceso';
import { useSesion } from './sesion';
import { C } from './ui';

/**
 * Ninguna pantalla de la app funciona sin sesión: si no hay (o caducó), se pide entrar ahí mismo
 * y, al entrar, la persona sigue en la pantalla que había abierto (por ejemplo su pedido).
 * Antes, una pantalla interna seguía sola y mostraba «Ese pedido no existe».
 */
export function ConSesion({
  children,
  rolRegistro,
  pideCumple,
}: {
  children: ReactNode;
  rolRegistro?: 'cliente' | 'repartidor';
  pideCumple?: boolean;
}) {
  const { cargando, usuario } = useSesion();
  if (cargando)
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
  if (!usuario) return <Acceso rolRegistro={rolRegistro} pideCumple={pideCumple} />;
  return <>{children}</>;
}
