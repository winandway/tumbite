import { type ErrorBoundaryProps, Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PantallaPermisos, SesionProvider, useSesion, PantallaConFallo } from '@tumbite/movil';

/**
 * C-PERMISOS-EXPLICADOS (31 oct 2026, como DoorDash): la primera vez que entra, el repartidor ve para
 * qué pedimos cada permiso; al tocar «Estoy listo» el teléfono pide la ubicación y después los avisos.
 */
const PERMISOS = {
  es: [
    {
      titulo: 'Ubicación',
      porque:
        'Para ofrecerte pedidos cerca de ti, guiarte al restaurante y que el cliente vea que vas en camino.',
    },
    {
      titulo: 'Avisos',
      porque: 'Para que te suenen las ofertas nuevas, los mensajes y los cambios de cada entrega.',
    },
    {
      titulo: 'Cámara (cuando haga falta)',
      porque: 'Para las fotos de recogida y entrega y para confirmar que eres tú.',
    },
  ],
  en: [
    {
      titulo: 'Location',
      porque:
        'To offer you nearby orders, guide you to the restaurant, and let the customer see you’re on the way.',
    },
    {
      titulo: 'Notifications',
      porque: 'So new offers, messages, and delivery updates ring on your phone.',
    },
    {
      titulo: 'Camera (when needed)',
      porque: 'For pickup and delivery photos and to confirm it’s you.',
    },
  ],
};

function Permisos() {
  const { permisosPorExplicar, aceptarPermisos, idioma } = useSesion();
  return (
    <PantallaPermisos
      visible={permisosPorExplicar}
      idioma={idioma}
      permisos={PERMISOS[idioma === 'en' ? 'en' : 'es']}
      alAceptar={() => {
        // Primero la ubicación; al marcar la pantalla como vista, la sesión pide los avisos.
        void Location.requestForegroundPermissionsAsync()
          .catch(() => undefined)
          .finally(aceptarPermisos);
      }}
    />
  );
}

/**
 * C-APP-SIN-CIERRES: si una pantalla falla, la app no se cierra; se ve el aviso con «Volver» (vuelve
 * atrás o al inicio) y el fallo llega al registro de errores del servidor.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <PantallaConFallo
      app="repartidor"
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
      <SesionProvider roles={['repartidor']} explicarPermisos>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
        <Permisos />
      </SesionProvider>
    </SafeAreaProvider>
  );
}
