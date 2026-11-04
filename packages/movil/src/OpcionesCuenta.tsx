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
    borrada: 'Tu cuenta quedó borrada',
    borradaDetalle: 'Borramos tu cuenta y tus datos personales. Gracias por haber usado Divoox.',
    entendido: 'Entendido',
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
    borrada: 'Your account was deleted',
    borradaDetalle: 'We deleted your account and your personal data. Thanks for using Divoox.',
    entendido: 'OK',
  },
};

/**
 * C-CUENTA-EN-LA-APP (31 oct 2026, Richard grabando el video para Apple): cerrar sesión y borrar la
 * cuenta DENTRO de la app, sin mandar a la web (Apple 5.1.1 v). Borrar va escondido en los tres
 * puntos (regla de Richard) y pide escribir la palabra de confirmación.
 */
export function OpcionesCuenta() {
  const { idioma, salir } = useSesion();
  const t = enIdioma(T, idioma);
  const [menu, setMenu] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

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
      <ConfirmarBorrado visible={confirmando} alCerrar={() => setConfirmando(false)} />
    </View>
  );
}

/**
 * C-BORRAR-EN-LA-APP (4 nov 2026, Richard): la ventanita de borrar la cuenta, la misma en las tres
 * apps. Se escribe DELETE (o BORRAR), se borra sin salir de la app, se dice que quedó borrada y, al
 * tocar «Entendido», se vuelve a la pantalla de entrar.
 */
export function ConfirmarBorrado({
  visible,
  alCerrar,
}: {
  visible: boolean;
  alCerrar: () => void;
}) {
  const { api, idioma, salir } = useSesion();
  const t = enIdioma(T, idioma);
  const [escrito, setEscrito] = useState('');
  const [error, setError] = useState('');
  const [borrando, setBorrando] = useState(false);
  const [borrada, setBorrada] = useState(false);

  // Al cerrar se limpia lo escrito: la próxima vez se vuelve a escribir la palabra.
  function cerrar() {
    setEscrito('');
    setError('');
    alCerrar();
  }

  async function borrar() {
    setError('');
    setBorrando(true);
    try {
      await api.pedir('DELETE', '/datos/cuentas/yo');
      setBorrada(true);
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
    } finally {
      setBorrando(false);
    }
  }

  return (
    <Modal
      visible={visible || borrada}
      transparent
      animationType="fade"
      onRequestClose={borrada ? () => void salir() : cerrar}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        {borrada ? (
          <View style={[e.tarjeta, { gap: 12 }]} testID="cuenta-borrada">
            <Text style={{ fontWeight: '700', fontSize: 18 }} accessibilityRole="header">
              {t.borrada}
            </Text>
            <Text style={{ color: C.gris }}>{t.borradaDetalle}</Text>
            <Boton texto={t.entendido} alTocar={() => void salir()} />
          </View>
        ) : (
          <View style={[e.tarjeta, { gap: 12 }]} testID="confirmar-borrado">
            <Text style={{ fontWeight: '700', fontSize: 18 }} accessibilityRole="header">
              {t.borrar}
            </Text>
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
            <Boton texto={t.cancelar} secundario alTocar={cerrar} />
          </View>
        )}
      </View>
    </Modal>
  );
}
