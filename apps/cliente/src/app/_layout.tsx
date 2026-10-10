import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider } from '@tumbite/movil';
import { CarritoProvider } from '../carrito';

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <SesionProvider roles={['cliente']}>
        <CarritoProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }} />
        </CarritoProvider>
      </SesionProvider>
    </SafeAreaProvider>
  );
}
