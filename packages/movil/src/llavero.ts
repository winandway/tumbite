import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * La sesión va en el llavero seguro del teléfono (Keychain en iPhone, Keystore en Android).
 * La vista web (solo para pruebas en la computadora) no tiene llavero: usa el almacén normal.
 */
export const llavero = {
  leer: (k: string) =>
    Platform.OS === 'web' ? AsyncStorage.getItem(k) : SecureStore.getItemAsync(k),
  guardar: (k: string, v: string) =>
    Platform.OS === 'web' ? AsyncStorage.setItem(k, v) : SecureStore.setItemAsync(k, v),
  borrar: (k: string) =>
    Platform.OS === 'web' ? AsyncStorage.removeItem(k) : SecureStore.deleteItemAsync(k),
};
