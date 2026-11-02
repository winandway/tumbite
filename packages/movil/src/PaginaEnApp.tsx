import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { C } from './ui';

/**
 * C-PAGINA-EN-APP (2 nov 2026, reporte de un restaurante por el gerente de correo): los términos, la
 * privacidad y las guías se abren DENTRO de la app, con un botón para volver, como DoorDash y Uber
 * Eats (navegador dentro de la app). Antes la app mandaba a la persona al navegador y la sacaba.
 * Una sola pieza: `abrirPagina(url)` en cualquier pantalla y `<VisorPaginas />` montado una vez en la
 * sesión. En la web (o sin visor montado) abre la dirección como siempre.
 */
type Oyente = (url: string) => void;
let oyente: Oyente | null = null;

export function abrirPagina(url: string): void {
  if (oyente && Platform.OS !== 'web') oyente(url);
  else void Linking.openURL(url);
}

const T = {
  es: { listo: 'Listo', navegador: 'Abrir en el navegador' },
  en: { listo: 'Done', navegador: 'Open in browser' },
};

export function VisorPaginas({ idioma }: { idioma: 'es' | 'en' }) {
  const [url, setUrl] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    oyente = (u) => {
      setCargando(true);
      setUrl(u);
    };
    return () => {
      oyente = null;
    };
  }, []);
  const t = idioma === 'en' ? T.en : T.es;
  const cerrar = () => setUrl(null);
  return (
    <Modal
      visible={url !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={cerrar}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'bottom']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderBottomWidth: 1,
            borderBottomColor: '#E5E7EB',
          }}
        >
          <Pressable
            onPress={() => url && void Linking.openURL(url)}
            accessibilityRole="link"
            hitSlop={8}
          >
            <Text style={{ color: '#666B73', fontSize: 14 }}>{t.navegador}</Text>
          </Pressable>
          <Pressable onPress={cerrar} accessibilityRole="button" hitSlop={8}>
            <Text style={{ color: C.primario, fontWeight: '700', fontSize: 16 }}>{t.listo}</Text>
          </Pressable>
        </View>
        {url ? (
          <WebView
            source={{ uri: url }}
            style={{ flex: 1 }}
            onLoadEnd={() => setCargando(false)}
            startInLoadingState={false}
          />
        ) : null}
        {cargando && url ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 120,
              left: 0,
              right: 0,
              alignItems: 'center',
            }}
          >
            <ActivityIndicator color={C.primario} />
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
