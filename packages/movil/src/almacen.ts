import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Almacen } from '@tumbite/compartido';

/** Almacén del teléfono para borradores e idioma (no para la sesión: esa va en el llavero seguro). */
export const almacenTelefono: Almacen & { llaves: () => Promise<string[]> } = {
  leer: (k) => AsyncStorage.getItem(k),
  guardar: (k, v) => AsyncStorage.setItem(k, v),
  borrar: (k) => AsyncStorage.removeItem(k),
  llaves: async () => [...(await AsyncStorage.getAllKeys())],
};
