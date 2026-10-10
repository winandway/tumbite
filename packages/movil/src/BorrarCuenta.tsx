import { useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import { ErrorApi, enIdioma } from '@tumbite/compartido';
import { useSesion } from './sesion';
import { e } from './ui';

const T = {
  es: {
    mas: 'Más opciones de la cuenta',
    borrar: 'Borrar mi cuenta',
    confirmar: '¿Borrar tu cuenta? Se borran tus datos personales y no se puede deshacer.',
    si: 'Sí, borrar',
    no: 'No',
  },
  en: {
    mas: 'More account options',
    borrar: 'Delete my account',
    confirmar: 'Delete your account? Your personal data is removed and this can’t be undone.',
    si: 'Yes, delete',
    no: 'No',
  },
};

function confirmar(mensaje: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(mensaje));
  return new Promise((r) =>
    Alert.alert('', mensaje, [
      { text: no, style: 'cancel', onPress: () => r(false) },
      { text: si, style: 'destructive', onPress: () => r(true) },
    ]),
  );
}

/** Borrar la cuenta vive escondida en los 3 puntos, con confirmación. */
export function MenuCuenta() {
  const { api, idioma, salir } = useSesion();
  const t = enIdioma(T, idioma);
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState('');

  async function borrar() {
    setAbierto(false);
    if (!(await confirmar(t.confirmar, t.si, t.no))) return;
    try {
      await api.borrarCuenta();
      await salir();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Pressable
        onPress={() => setAbierto((a) => !a)}
        accessibilityRole="button"
        accessibilityLabel={t.mas}
        hitSlop={8}
        style={{ padding: 8 }}
      >
        <Text style={{ fontSize: 22 }}>⋮</Text>
      </Pressable>
      {abierto && (
        <Pressable onPress={() => void borrar()} accessibilityRole="button" style={{ padding: 10 }}>
          <Text style={{ color: '#c4001d', fontWeight: '700' }}>{t.borrar}</Text>
        </Pressable>
      )}
      {error ? <Text style={e.error}>{error}</Text> : null}
    </View>
  );
}
