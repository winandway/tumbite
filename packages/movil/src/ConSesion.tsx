import type { ReactNode } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Acceso } from './Acceso';
import { useSesion } from './sesion';
import { Boton, C } from './ui';
import { TEXTOS_MOVIL } from './textos';
import { enIdioma } from '@tumbite/compartido';

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
  const { cargando, usuario, sinConfirmar } = useSesion();
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
  // C-SESION-CON-LIMITE: no se pudo confirmar la sesión guardada. Nada protegido se muestra; se
  // ofrece reintentar (la sesión sigue guardada) o entrar con otra cuenta.
  if (!usuario && sinConfirmar) return <SesionSinConfirmar />;
  if (!usuario) return <Acceso rolRegistro={rolRegistro} pideCumple={pideCumple} />;
  return <>{children}</>;
}

function SesionSinConfirmar() {
  const { idioma, reintentarSesion, usarOtraCuenta } = useSesion();
  const t = enIdioma(TEXTOS_MOVIL, idioma);
  return (
    <View
      testID="sesion-sin-confirmar"
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        gap: 12,
        backgroundColor: '#FFFFFF',
      }}
    >
      <Text
        style={{ fontSize: 20, fontWeight: '700', color: C.secundario }}
        accessibilityRole="header"
      >
        {t.sesionSinConfirmar}
      </Text>
      <Text style={{ fontSize: 15, color: '#5E5E5E' }}>{t.sesionSinConfirmarDetalle}</Text>
      <Boton texto={t.reintentarSesion} alTocar={() => void reintentarSesion()} />
      <Boton texto={t.otraCuenta} alTocar={usarOtraCuenta} secundario />
    </View>
  );
}
