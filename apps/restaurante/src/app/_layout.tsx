import { type ErrorBoundaryProps, Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider, PantallaConFallo } from '@tumbite/movil';

/**
 * C-APP-SIN-CIERRES: si una pantalla falla, la app no se cierra; se ve el aviso con «Volver» (vuelve
 * atrás o al inicio) y el fallo llega al registro de errores del servidor.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <PantallaConFallo
      app="restaurante"
      error={error}
      volver={() => {
        try {
          if (router.canGoBack()) router.back();
          else router.replace('/');
        } catch {
          // Sin navegación disponible: se vuelve a pintar la pantalla de inicio.
        }
        void retry();
      }}
    />
  );
}

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <SesionProvider roles={['restaurante']}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </SesionProvider>
    </SafeAreaProvider>
  );
}
