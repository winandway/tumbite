import { type ErrorBoundaryProps, Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  SesionProvider,
  SobreLosBotones,
  PantallaConFallo,
  useFuentesDivoox,
} from '@tumbite/movil';

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
  // C-APPS-DISENO: Poppins, Montserrat y los íconos se cargan antes de pintar (la pantalla de arranque espera).
  const fuentes = useFuentesDivoox();
  if (!fuentes) return null;
  return (
    <SafeAreaProvider>
      <SesionProvider roles={['restaurante']}>
        <StatusBar style="dark" />
        {/* C-SOBRE-LOS-BOTONES: nada queda debajo de los botones del teléfono (Android). */}
        <SobreLosBotones>
          <Stack screenOptions={{ headerShown: false }} />
        </SobreLosBotones>
      </SesionProvider>
    </SafeAreaProvider>
  );
}
