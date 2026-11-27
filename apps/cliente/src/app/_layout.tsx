import { type ErrorBoundaryProps, Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import logoArranque from '../../assets/splash-logo.png';
import {
  fijarPantallaCarga,
  SesionProvider,
  SobreLosBotones,
  PantallaConFallo,
  registrarAtrapaFallos,
  useFuentesDivoox,
  HojaFoto,
  PreguntaLugar,
} from '@tumbite/movil';
import { AbrirAvisos } from '../AbrirAvisos';
import { CarritoProvider } from '../carrito';

// C-ARRANQUE-CON-MARCA: la pantalla de carga (después del arranque del sistema) con el color y el
// logo de esta app, iguales a los de expo-splash-screen en app.json.
fijarPantallaCarga({ fondo: '#F20D20', logo: logoArranque });

// C-NUNCA-EN-BLANCO: todo error de la app llega al registro, con la app y la versión.
registrarAtrapaFallos('cliente');

/**
 * C-APP-SIN-CIERRES: si una pantalla falla, la app no se cierra; se ve el aviso con «Volver» (vuelve
 * atrás o al inicio) y el fallo llega al registro de errores del servidor.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <PantallaConFallo
      app="cliente"
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
      <SesionProvider roles={['cliente']}>
        <CarritoProvider>
          <StatusBar style="dark" />
          {/* C-MIRAR-SIN-CUENTA: sin cuenta se mira; cada pantalla de la cuenta la pide (ConCuenta). */}
          <AbrirAvisos />
          {/* C-REGISTRO-TODO-EL-PAIS: la cuenta vieja sin ciudad la elige una vez. */}
          <PreguntaLugar rol="cliente" />
          {/* C-SOBRE-LOS-BOTONES: nada queda debajo de los botones del teléfono (Android). */}
          <SobreLosBotones>
            <Stack screenOptions={{ headerShown: false }} />
            {/* Tramo 1: la hoja propia de «Tomar foto / Subir desde archivos». */}
            <HojaFoto />
          </SobreLosBotones>
        </CarritoProvider>
      </SesionProvider>
    </SafeAreaProvider>
  );
}
