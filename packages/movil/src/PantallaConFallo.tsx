import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { URL_SERVIDOR } from './sesion';
import { C } from './ui';
import { VERSION_APP } from './version';

/**
 * C-APP-SIN-CIERRES (2 nov 2026, reporte de Richard con el iPhone: «Equipo» cerraba la app de
 * restaurantes). Si una pantalla falla, la app NO se cierra: esta pantalla la reemplaza con un aviso
 * y «Volver», y el fallo llega al registro de errores del servidor con la app y la pantalla.
 * Cada app la conecta en su `_layout.tsx` como `ErrorBoundary` de Expo Router.
 */
export type AppDivoox = 'cliente' | 'repartidor' | 'restaurante';

const T = {
  es: {
    titulo: 'Algo falló en esta pantalla',
    texto: 'Ya nos llegó el aviso y lo estamos revisando. Tus datos están a salvo.',
    volver: 'Volver',
  },
  en: {
    titulo: 'Something went wrong on this screen',
    texto: 'We already got the report and we’re looking into it. Your data is safe.',
    volver: 'Go back',
  },
};

function idioma(): 'es' | 'en' {
  try {
    return (Intl.DateTimeFormat().resolvedOptions().locale ?? '').toLowerCase().startsWith('es')
      ? 'es'
      : 'en';
  } catch {
    return 'en';
  }
}

/** Avisa al servidor; si no hay señal, no pasa nada (la pantalla sigue funcionando). */
export function avisarFalloApp(app: AppDivoox, error: Error, pantalla = '') {
  void fetch(`${URL_SERVIDOR}/datos/app/error`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      app,
      pantalla: pantalla.slice(0, 120),
      mensaje: (error.message || String(error)).slice(0, 500),
      pila: (error.stack ?? '').slice(0, 1500),
      version: `${VERSION_APP.version} ${VERSION_APP.commit}`.slice(0, 40),
    }),
  }).catch(() => undefined);
}

export function PantallaConFallo({
  app,
  error,
  pantalla,
  volver,
}: {
  app: AppDivoox;
  error: Error;
  pantalla?: string;
  volver: () => void;
}) {
  useEffect(() => {
    avisarFalloApp(app, error, pantalla);
  }, [app, error, pantalla]);
  const t = idioma() === 'es' ? T.es : T.en;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }} testID="pantalla-con-fallo">
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.secundario, marginBottom: 8 }}>
          {t.titulo}
        </Text>
        <Text style={{ fontSize: 16, color: '#5E5E5E', marginBottom: 24 }}>{t.texto}</Text>
        <Pressable
          onPress={volver}
          accessibilityRole="button"
          style={{
            backgroundColor: C.primario,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16 }}>{t.volver}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
