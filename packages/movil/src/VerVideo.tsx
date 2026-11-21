import { createElement, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  type ClaveVideoAyuda,
  TEXTOS_VER_VIDEO,
  type VideosAyuda,
  videoAyudaPara,
} from '@tumbite/compartido';
import { Modal } from './Hoja';
import { Icono, Text } from './diseno';
import { useSesion } from './sesion';
import { URL_SERVIDOR } from './servidor';
import { C } from './ui';

/**
 * C-VER-VIDEO (21 nov 2026, pedido de Richard) — todos los países. «Ver video»: un enlace con ícono
 * de reproducir que abre una ventanita con un video VERTICAL de ayuda. Pieza única y reutilizable:
 * cada pantalla la usa con su clave (`<VerVideo clave="fotos-entrada" />`).
 *
 * - Apagada por ajuste: mientras el servidor no tenga un video para esa pantalla EN ESE IDIOMA, no
 *   se dibuja nada (ni el enlace). Encenderla no pide compilar la app.
 * - El video vive en el almacén del sitio y se pide por partes: no pesa en el paquete de la app.
 * - Nunca empieza solo ni con sonido: la persona toca reproducir. Cerrar está a la vista.
 */
let leidos: Promise<VideosAyuda> | null = null;
let leidosEn = 0;
const VIGENCIA_MS = 5 * 60_000;

/** Los videos encendidos, leídos una vez cada cinco minutos para toda la app. */
function useVideosAyuda(): VideosAyuda | null {
  const { api } = useSesion();
  const [videos, setVideos] = useState<VideosAyuda | null>(null);
  useEffect(() => {
    let vivo = true;
    if (!leidos || Date.now() - leidosEn > VIGENCIA_MS) {
      leidosEn = Date.now();
      leidos = api
        .pedir<{ videos: VideosAyuda }>('GET', '/datos/videos-ayuda')
        .then((r) => r.videos ?? {})
        .catch((e: unknown) => {
          // Sin señal no hay enlace (se vuelve a intentar al abrir otra vez); queda en el registro.
          console.warn('ver video: no se pudo leer el ajuste', e);
          leidos = null;
          return {};
        });
    }
    void leidos.then((v) => vivo && setVideos(v));
    return () => {
      vivo = false;
    };
  }, [api]);
  return videos;
}

/** La página mínima que reproduce el video dentro de la ventanita (teléfonos). Sin reproducción sola. */
const paginaDeVideo = (url: string) =>
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<style>html,body{margin:0;height:100%;background:#000}video{width:100%;height:100%;object-fit:contain;background:#000}</style></head>` +
  `<body><video src="${url.replace(/"/g, '&quot;')}" controls playsinline webkit-playsinline preload="metadata" controlslist="nodownload"></video></body></html>`;

export function VerVideo({
  clave,
  testID = 'ver-video',
}: {
  clave: ClaveVideoAyuda;
  testID?: string;
}) {
  const { idioma } = useSesion();
  const t = idioma === 'en' ? TEXTOS_VER_VIDEO.en : TEXTOS_VER_VIDEO.es;
  const ruta = videoAyudaPara(useVideosAyuda(), clave, idioma);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [fallo, setFallo] = useState(false);
  const { width, height } = useWindowDimensions();
  if (!ruta) return null;
  const url = `${URL_SERVIDOR}${ruta}`;
  // Vertical (9:16), tan grande como quepa dejando ver el fondo: es una ventanita, no otra pantalla.
  const ancho = Math.min(width - 48, Math.round(((height - 190) * 9) / 16), 420);
  const alto = Math.round((ancho * 16) / 9);
  const cerrar = () => {
    setAbierto(false);
    setCargando(true);
    setFallo(false);
  };
  return (
    <>
      <Pressable
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={t.ver}
        testID={testID}
        hitSlop={8}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          paddingVertical: 6,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icono nombre="play-circle" tamano={22} color={C.primario} />
        <Text style={{ fontWeight: '700', color: C.secundario, textDecorationLine: 'underline' }}>
          {t.ver}
        </Text>
      </Pressable>
      {abierto ? (
        <Modal transparent visible animationType="fade" onRequestClose={cerrar}>
          <View
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Tocar fuera cierra. */}
            <Pressable
              onPress={cerrar}
              accessibilityLabel={t.cerrar}
              testID="ver-video-fondo"
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
            />
            <View
              testID="ver-video-ventana"
              accessibilityViewIsModal
              style={{
                width: ancho,
                backgroundColor: '#fff',
                borderRadius: 16,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingLeft: 14,
                  paddingRight: 6,
                  minHeight: 48,
                }}
              >
                <Text style={{ fontWeight: '800', color: C.secundario }}>{t.titulo}</Text>
                <Pressable
                  onPress={cerrar}
                  accessibilityRole="button"
                  accessibilityLabel={t.cerrar}
                  testID="ver-video-cerrar"
                  hitSlop={8}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 10,
                    minHeight: 44,
                  }}
                >
                  <Text style={{ fontWeight: '700', color: C.secundario }}>{t.cerrar}</Text>
                  <Icono nombre="close" tamano={22} color={C.secundario} />
                </Pressable>
              </View>
              <View style={{ width: ancho, height: alto, backgroundColor: '#000' }}>
                {Platform.OS === 'web' ? (
                  // En la web, el reproductor del navegador: sin reproducción sola, con sus controles.
                  createElement('video', {
                    src: url,
                    controls: true,
                    playsInline: true,
                    preload: 'metadata',
                    controlsList: 'nodownload',
                    'data-testid': 'ver-video-reproductor',
                    onLoadedMetadata: () => setCargando(false),
                    onError: () => {
                      setCargando(false);
                      setFallo(true);
                    },
                    style: {
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      background: '#000',
                    },
                  })
                ) : (
                  <WebView
                    testID="ver-video-reproductor"
                    source={{ html: paginaDeVideo(url), baseUrl: URL_SERVIDOR }}
                    originWhitelist={['*']}
                    allowsInlineMediaPlayback
                    // La persona toca reproducir: nunca empieza solo ni con sonido.
                    mediaPlaybackRequiresUserAction
                    allowsFullscreenVideo
                    scrollEnabled={false}
                    onLoadEnd={() => setCargando(false)}
                    onError={() => {
                      setCargando(false);
                      setFallo(true);
                    }}
                    style={{ flex: 1, backgroundColor: '#000' }}
                  />
                )}
                {cargando && !fallo ? (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ActivityIndicator color="#fff" />
                  </View>
                ) : null}
                {fallo ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      bottom: 0,
                      left: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 20,
                      backgroundColor: '#000',
                    }}
                  >
                    <Text
                      accessibilityRole="alert"
                      style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}
                    >
                      {t.sinSenal}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
