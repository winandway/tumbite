import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConSesion, SesionProvider } from '@tumbite/movil';
import { CarritoProvider } from '../carrito';

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <SesionProvider roles={['cliente']}>
        <CarritoProvider>
          <StatusBar style="light" />
          <ConSesion rolRegistro="cliente" pideCumple>
            <Stack screenOptions={{ headerShown: false }} />
          </ConSesion>
        </CarritoProvider>
      </SesionProvider>
    </SafeAreaProvider>
  );
}
