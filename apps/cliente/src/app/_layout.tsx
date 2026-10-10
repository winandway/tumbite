import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SesionProvider } from '@tumbite/movil';

export default function Raiz() {
  return (
    <SafeAreaProvider>
      <SesionProvider roles={['cliente']}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </SesionProvider>
    </SafeAreaProvider>
  );
}
