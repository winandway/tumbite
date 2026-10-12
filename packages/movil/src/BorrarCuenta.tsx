import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { enIdioma } from '@tumbite/compartido';
import { URL_SERVIDOR, useSesion } from './sesion';
import { useSoporte } from './soporte';
import { TEXTOS_MOVIL } from './textos';

const T = {
  es: {
    mas: 'Más opciones de la cuenta',
  },
  en: {
    mas: 'More account options',
  },
};

/** Menú de la cuenta (3 puntos): guías, soporte y Configuración, donde vive borrar la cuenta. */
export function MenuCuenta() {
  const { api, idioma } = useSesion();
  const { whatsapp, abrirWhatsapp } = useSoporte(api);
  const t = enIdioma(T, idioma);
  const tm = enIdioma(TEXTOS_MOVIL, idioma);
  const [abierto, setAbierto] = useState(false);

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
      {abierto ? (
        <Pressable
          onPress={() => {
            setAbierto(false);
            void Linking.openURL(`${URL_SERVIDOR}/docs`);
          }}
          accessibilityRole="link"
          style={{ padding: 10 }}
        >
          <Text style={{ fontWeight: '700' }}>{tm.guias}</Text>
        </Pressable>
      ) : null}
      {abierto && whatsapp ? (
        <Pressable
          onPress={() => {
            setAbierto(false);
            void abrirWhatsapp();
          }}
          accessibilityRole="link"
          style={{ padding: 10 }}
        >
          <Text style={{ fontWeight: '700' }}>{tm.soporteWhatsapp}</Text>
        </Pressable>
      ) : null}
      {abierto && (
        // Datos, contraseña, correo y borrar la cuenta viven en Configuración, con confirmación escrita.
        <Pressable
          onPress={() => {
            setAbierto(false);
            void Linking.openURL(`${URL_SERVIDOR}/panel/configuracion`);
          }}
          accessibilityRole="link"
          style={{ padding: 10 }}
        >
          <Text style={{ fontWeight: '700' }}>{tm.configuracion}</Text>
        </Pressable>
      )}
    </View>
  );
}
