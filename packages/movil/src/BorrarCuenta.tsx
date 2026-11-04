import { abrirPagina, abrirPanel } from './PaginaEnApp';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { enIdioma, enIdiomaDireccion, textoVersion } from '@tumbite/compartido';
import { URL_SERVIDOR, useSesion } from './sesion';
import { C } from './ui';
import { useSoporte } from './soporte';
import { TEXTOS_MOVIL } from './textos';
import { VERSION_APP } from './version';
import { ConfirmarBorrado } from './OpcionesCuenta';

const T = {
  es: {
    mas: 'Más opciones de la cuenta',
  },
  en: {
    mas: 'More account options',
  },
};

/** Menú de la cuenta (3 puntos): guías, soporte, términos y privacidad, Configuración, borrar la cuenta (dentro de la app) y la versión instalada. */
export function MenuCuenta() {
  const { api, idioma } = useSesion();
  const { whatsapp, abrirWhatsapp } = useSoporte(api);
  const t = enIdioma(T, idioma);
  const tm = enIdioma(TEXTOS_MOVIL, idioma);
  const [abierto, setAbierto] = useState(false);
  const [borrando, setBorrando] = useState(false);

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
            abrirPagina(`${URL_SERVIDOR}${enIdiomaDireccion('/docs', idioma)}`);
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
        <Pressable
          onPress={() => {
            setAbierto(false);
            abrirPagina(`${URL_SERVIDOR}${enIdiomaDireccion('/privacy', idioma)}`);
          }}
          accessibilityRole="link"
          style={{ padding: 10 }}
        >
          <Text style={{ fontWeight: '700' }}>{tm.legales}</Text>
        </Pressable>
      )}
      {abierto && (
        // Datos, contraseña, correo y borrar la cuenta viven en Configuración, con confirmación escrita.
        <Pressable
          onPress={() => {
            setAbierto(false);
            void abrirPanel(api, URL_SERVIDOR, '/panel/settings');
          }}
          accessibilityRole="link"
          style={{ padding: 10 }}
        >
          <Text style={{ fontWeight: '700' }}>{tm.configuracion}</Text>
        </Pressable>
      )}
      {abierto && (
        // Escondido en los tres puntos (regla de Richard). C-BORRAR-EN-LA-APP: se borra aquí mismo,
        // escribiendo DELETE, sin abrir la web (Apple 5.1.1 v).
        <Pressable
          onPress={() => {
            setAbierto(false);
            setBorrando(true);
          }}
          accessibilityRole="button"
          style={{ padding: 10 }}
          testID="menu-borrar-cuenta"
        >
          <Text style={{ fontWeight: '700', color: C.primario }}>{tm.borrarCuenta}</Text>
        </Pressable>
      )}
      {abierto && (
        // La versión instalada, discreta, para saber en el teléfono qué se está probando.
        <Text testID="version-app" style={{ padding: 10, fontSize: 11, color: '#9a9a9a' }}>
          {textoVersion(VERSION_APP, idioma)}
        </Text>
      )}
      <ConfirmarBorrado visible={borrando} alCerrar={() => setBorrando(false)} />
    </View>
  );
}
