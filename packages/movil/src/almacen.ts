import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Almacen } from '@tumbite/compartido';

/** Almacén del teléfono para borradores e idioma (no para la sesión: esa va en el llavero seguro). */
export const almacenTelefono: Almacen & { llaves: () => Promise<string[]> } = {
  leer: (k) => AsyncStorage.getItem(k),
  guardar: (k, v) => AsyncStorage.setItem(k, v),
  borrar: (k) => AsyncStorage.removeItem(k),
  llaves: async () => [...(await AsyncStorage.getAllKeys())],
};

/** En el celular: si la app se va a segundo plano o se cierra, el borrador se guarda ya. */
export function alSalirTelefono(guardarYa: () => void): () => void {
  const sub = AppState.addEventListener('change', (estado) => {
    if (estado !== 'active') guardarYa();
  });
  return () => sub.remove();
}
