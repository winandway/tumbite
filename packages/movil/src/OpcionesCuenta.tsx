import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { enIdioma } from '@tumbite/compartido';
import { useSesion } from './sesion';
import { Boton, C, e } from './ui';

const T = {
  es: {
    titulo: 'Tu cuenta',
    mas: 'Más opciones de la cuenta',
    salir: 'Cerrar sesión',
    borrar: 'Borrar la cuenta',
    explicacion:
      'Se borran tu cuenta y tus datos personales. Los importes de pedidos ya hechos se guardan sin tu nombre, porque la ley lo exige. No se puede deshacer.',
    escribe: 'Escribe BORRAR para confirmar',
    palabra: 'BORRAR',
    confirmar: 'Borrar mi cuenta',
    cancelar: 'Cancelar',
  },
  en: {
    titulo: 'Your account',
    mas: 'More account options',
    salir: 'Sign out',
    borrar: 'Delete account',
    explicacion:
      'Your account and personal data are deleted. Amounts of past orders are kept without your name, as the law requires. This can’t be undone.',
    escribe: 'Type DELETE to confirm',
    palabra: 'DELETE',
    confirmar: 'Delete my account',
    cancelar: 'Cancel',
  },
};

/**
 * C-CUENTA-EN-LA-APP (31 oct 2026, Richard grabando el video para Apple): cerrar sesión y borrar la
 * cuenta DENTRO de la app, sin mandar a la web (Apple 5.1.1 v). Borrar va escondido en los tres
 * puntos (regla de Richard) y pide escribir la palabra de confirmación.
 */
export function OpcionesCuenta() {
  const { api, idioma, salir } = useSesion();
  const t = enIdioma(T, idioma);
  const [menu, setMenu] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [escrito, setEscrito] = useState('');
  const [error, setError] = useState('');
  const [borrando, setBorrando] = useState(false);

  async function borrar() {
    setError('');
    setBorrando(true);
    try {
      await api.pedir('DELETE', '/datos/cuentas/yo');
      setConfirmando(false);
      await salir();
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
    } finally {
      setBorrando(false);
    }
  }

  return (
    <View style={[e.tarjeta, { gap: 10 }]} testID="opciones-cuenta">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>{t.titulo}</Text>
        <Pressable
          onPress={() => setMenu((m) => !m)}
          accessibilityRole="button"
          accessibilityLabel={t.mas}
          hitSlop={10}
          style={{ paddingHorizontal: 10, paddingVertical: 4 }}
          testID="cuenta-tres-puntos"
        >
          <Text style={{ fontSize: 22, fontWeight: '700' }}>⋮</Text>
        </Pressable>
      </View>
      {menu ? (
        <Pressable
          onPress={() => {
            setMenu(false);
            setEscrito('');
            setError('');
            setConfirmando(true);
          }}
          accessibilityRole="button"
          style={{ paddingVertical: 8 }}
          testID="borrar-cuenta"
        >
          <Text style={{ color: C.acento, fontWeight: '700' }}>{t.borrar}</Text>
        </Pressable>
      ) : null}
      <Boton texto={t.salir} secundario alTocar={() => void salir()} />
      <Modal
        visible={confirmando}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmando(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View style={[e.tarjeta, { gap: 12 }]}>
            <Text style={{ fontWeight: '700', fontSize: 18 }}>{t.borrar}</Text>
            <Text style={{ color: C.gris }}>{t.explicacion}</Text>
            <TextInput
              value={escrito}
              onChangeText={setEscrito}
              placeholder={t.escribe}
              autoCapitalize="characters"
              autoCorrect={false}
              style={e.input}
              accessibilityLabel={t.escribe}
            />
            {error ? (
              <Text style={e.error} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
            {escrito.trim().toUpperCase() === t.palabra ? (
              <Boton texto={t.confirmar} cargando={borrando} alTocar={() => void borrar()} />
            ) : null}
            <Boton texto={t.cancelar} secundario alTocar={() => setConfirmando(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
