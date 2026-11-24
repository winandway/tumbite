import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutRectangle,
  Linking,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import type { Idioma, PasoVerificacion } from '@tumbite/compartido';
import { Boton, FUENTE, Icono, Text, avisarFalloApp } from '@tumbite/movil';
import { DibujoHorma } from './Horma';
import {
  dibujoDePaso,
  esRedonda,
  proporcionDeHorma,
  recorteAlMarco,
  textosDelPaso,
} from './logica';

const T = {
  es: {
    volver: 'Volver',
    tomar: 'Tomar la foto',
    permiso: 'Para tomar la foto, Divoox Driver necesita usar la cámara.',
    permitir: 'Permitir la cámara',
    bloqueada:
      'La cámara está bloqueada para Divoox Driver. Abre los ajustes del teléfono, entra en Divoox Driver, activa «Cámara» y vuelve aquí. Las fotos de verificación solo se toman con la cámara.',
    bloqueadaWeb:
      'La cámara está bloqueada en este navegador. Toca el candado junto a la dirección, permite la cámara y vuelve a abrir este paso. Las fotos de verificación solo se toman con la cámara.',
    ajustes: 'Abrir los ajustes',
    sinCamara:
      'No pudimos abrir la cámara. Cierra las otras apps que la estén usando y vuelve a intentar. Las fotos de verificación solo se toman con la cámara.',
    fallo: 'No se pudo tomar la foto. Intenta otra vez.',
    noArranca:
      'La cámara no arrancó. Toca Reintentar. Si sigue igual, revisa que Divoox Driver tenga permiso para usar la cámara.',
    noArrancaWeb:
      'La cámara no arrancó. Toca Reintentar. Si sigue igual, revisa que este navegador tenga permiso para usar la cámara.',
    reintentar: 'Reintentar',
    revisarPermiso: 'Revisar el permiso',
  },
  en: {
    volver: 'Back',
    tomar: 'Take the photo',
    permiso: 'To take the photo, Divoox Driver needs to use the camera.',
    permitir: 'Allow camera',
    bloqueada:
      'The camera is blocked for Divoox Driver. Open your phone’s settings, go to Divoox Driver, turn on “Camera” and come back here. Verification photos can only be taken with the camera.',
    bloqueadaWeb:
      'The camera is blocked in this browser. Tap the lock next to the address, allow the camera and open this step again. Verification photos can only be taken with the camera.',
    ajustes: 'Open settings',
    sinCamara:
      'We couldn’t open the camera. Close any other app using it and try again. Verification photos can only be taken with the camera.',
    fallo: 'The photo couldn’t be taken. Try again.',
    noArranca:
      'The camera didn’t start. Tap Retry. If it still doesn’t, check that Divoox Driver is allowed to use the camera.',
    noArrancaWeb:
      'The camera didn’t start. Tap Retry. If it still doesn’t, check that this browser is allowed to use the camera.',
    reintentar: 'Retry',
    revisarPermiso: 'Check the permission',
  },
};

const LADO_MAXIMO = 1400;
/** C-FOTO-CARA-A-LA-VISTA: si la cámara no avisa que está lista en este tiempo, se dice y se reintenta. */
export const ESPERA_CAMARA_MS = 8_000;
const SOMBRA = 1200;

/**
 * C-ASISTENTE-DRIVER: la cámara con guía, dentro de la app (no la cámara suelta del sistema).
 * Arriba, bien grande, qué lado toca (FRENTE, REVERSO); en el centro, el marco con la forma de lo
 * que se pide (tarjeta, póliza u óvalo de la cara) y lo de afuera oscurecido; abajo, el disparador.
 * La foto se recorta al marco y se achica antes de devolverla. La cara usa la cámara de adelante.
 */
export function CamaraConMarco({
  paso,
  pais,
  idioma,
  alTomar,
  alCerrar,
  alFallo,
}: {
  paso: PasoVerificacion;
  pais: string | null;
  idioma: Idioma;
  alTomar: (foto: { uri: string }) => void;
  alCerrar: () => void;
  /** C-FOTO-CARA-A-LA-VISTA: para el embudo (la cámara no arrancó, no abrió o no tomó la foto). */
  alFallo?: (motivo: 'no_arranca' | 'montaje' | 'disparo' | 'permiso') => void;
}) {
  const t = idioma === 'en' ? T.en : T.es;
  const tx = textosDelPaso(paso, pais, idioma);
  const [permiso, pedirPermiso] = useCameraPermissions();
  const camara = useRef<CameraView>(null);
  const [vista, setVista] = useState<LayoutRectangle | null>(null);
  const marco = useRef<View>(null);
  const [lista, setLista] = useState(false);
  const [tomando, setTomando] = useState(false);
  const [error, setError] = useState('');
  // C-FOTO-CARA-A-LA-VISTA: la cámara que no arranca no deja el disparador apagado para siempre.
  const [noArranca, setNoArranca] = useState(false);
  const [intento, setIntento] = useState(0);
  const avisado = useRef(false);
  useEffect(() => {
    if (!permiso?.granted || lista) return;
    const reloj = setTimeout(() => {
      setNoArranca(true);
      if (!avisado.current) {
        avisado.current = true;
        alFallo?.('no_arranca');
      }
    }, ESPERA_CAMARA_MS);
    return () => clearTimeout(reloj);
  }, [permiso?.granted, lista, intento, alFallo]);
  const permisoAvisado = useRef(false);
  useEffect(() => {
    if (permiso && !permiso.granted && permiso.canAskAgain === false && !permisoAvisado.current) {
      permisoAvisado.current = true;
      alFallo?.('permiso');
    }
  }, [permiso, alFallo]);
  const reintentar = () => {
    setNoArranca(false);
    setError('');
    setLista(false);
    setIntento((n) => n + 1);
  };
  // C-PAPELES-SOLO-CAMARA: sin permiso o sin cámara se explica cómo darlo; nunca se ofrecen archivos.
  const bloqueada = Boolean(permiso && !permiso.granted && permiso.canAskAgain === false);
  const redonda = esRedonda(paso);
  const proporcion = proporcionDeHorma(paso);

  async function disparar() {
    if (tomando || !camara.current) return;
    setTomando(true);
    setError('');
    try {
      const foto = await camara.current.takePictureAsync({ quality: 0.8, skipProcessing: false });
      if (!foto?.uri) throw new Error('sin foto');
      // Dónde quedó el marco en la pantalla (la ventana de la cámara ocupa toda la pantalla).
      const m = await new Promise<{ x: number; y: number; width: number; height: number } | null>(
        (ok) => {
          if (!marco.current) return ok(null);
          marco.current.measureInWindow((x, y, width, height) => ok({ x, y, width, height }));
        },
      );
      const recorte =
        vista && m && m.width > 0 ? recorteAlMarco(foto, vista, m, redonda ? 0.3 : 0.08) : null;
      const ancho = recorte?.width ?? foto.width;
      const r = await manipulateAsync(
        foto.uri,
        [
          ...(recorte ? [{ crop: recorte }] : []),
          ...(ancho > LADO_MAXIMO ? [{ resize: { width: LADO_MAXIMO } }] : []),
        ],
        { compress: 0.72, format: SaveFormat.JPEG },
      );
      alTomar({ uri: r.uri });
    } catch (x) {
      // Nunca en silencio: queda en el reporte de errores de la app y en el embudo.
      avisarFalloApp(
        'repartidor',
        x instanceof Error ? x : new Error(String(x)),
        `papeles:camara:${paso}`,
      );
      alFallo?.('disparo');
      setError(t.fallo);
    } finally {
      setTomando(false);
    }
  }

  return (
    // C-NUNCA-EN-BLANCO: sin Modal. El asistente ya ocupa toda la pantalla; la cámara va encima.
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50 }}>
      <View
        testID="camara-con-marco"
        style={{ flex: 1, backgroundColor: '#17181B' }}
        onLayout={(ev) => setVista(ev.nativeEvent.layout)}
      >
        {permiso?.granted ? (
          <CameraView
            key={intento}
            ref={camara}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            facing={redonda ? 'front' : 'back'}
            onCameraReady={() => {
              setLista(true);
              setNoArranca(false);
            }}
            onMountError={(ev) => {
              avisarFalloApp(
                'repartidor',
                new Error(`la cámara no abrió: ${ev?.message ?? ''}`),
                `papeles:camara:${paso}`,
              );
              alFallo?.('montaje');
              setError(t.sinCamara);
            }}
          />
        ) : null}
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingTop: 4, zIndex: 3 }}>
            <Pressable
              testID="camara-cerrar"
              onPress={alCerrar}
              accessibilityRole="button"
              accessibilityLabel={t.volver}
              hitSlop={12}
              style={{ padding: 8 }}
            >
              <Icono nombre="chevron-back" tamano={28} color="#FFFFFF" />
            </Pressable>
          </View>
          <View style={{ alignItems: 'center', paddingHorizontal: 24, zIndex: 2 }}>
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: FUENTE.titulo,
                fontSize: tx.lado ? 32 : 24,
                letterSpacing: tx.lado ? 4 : 0,
                marginTop: 10,
                zIndex: 2,
                textAlign: 'center',
                textShadowColor: 'rgba(0,0,0,0.6)',
                textShadowRadius: 6,
              }}
            >
              {tx.lado ?? tx.titulo}
            </Text>
            {tx.lado ? (
              <Text
                style={{
                  color: '#FFFFFF',
                  fontFamily: FUENTE.textoMedio,
                  fontSize: 15,
                  marginTop: 2,
                  zIndex: 2,
                  textShadowColor: 'rgba(0,0,0,0.6)',
                  textShadowRadius: 6,
                }}
              >
                {tx.nombre}
              </Text>
            ) : null}
            <View
              ref={marco}
              testID="camara-marco"
              collapsable={false}
              style={{
                marginTop: 30,
                width: redonda ? '62%' : '92%',
                maxWidth: redonda ? 250 : 380,
                aspectRatio: proporcion,
                zIndex: 1,
              }}
            >
              {/* Lo de afuera del marco, oscurecido: un borde enorme alrededor de la figura. */}
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: -SOMBRA,
                  left: -SOMBRA,
                  right: -SOMBRA,
                  bottom: -SOMBRA,
                  borderWidth: SOMBRA,
                  borderColor: 'rgba(0,0,0,0.6)',
                  // El óvalo de la cara: «50%» da esquinas elípticas, y el hueco de adentro (este
                  // radio menos el borde) queda justo del tamaño del marco. 999 lo volvía píldora.
                  borderRadius: redonda ? '50%' : SOMBRA + 16,
                }}
              />
              <View
                style={{
                  flex: 1,
                  borderWidth: 3,
                  borderColor: '#FFFFFF',
                  borderRadius: redonda ? '50%' : 16,
                  overflow: 'hidden',
                }}
              >
                {/* Con la cámara encendida, el dibujo no tapa lo que se fotografía: en la cara
                    sobra (el óvalo ya guía) y en los papeles queda tenue. */}
                {redonda && lista ? null : (
                  <View style={{ flex: 1, opacity: lista ? 0.3 : 0.8 }}>
                    <DibujoHorma clase={dibujoDePaso(paso)} blanco />
                  </View>
                )}
              </View>
            </View>
            <Text
              style={{
                color: '#FFFFFF',
                fontFamily: FUENTE.textoMedio,
                fontSize: 16,
                lineHeight: 22,
                textAlign: 'center',
                marginTop: 24,
                zIndex: 2,
                textShadowColor: 'rgba(0,0,0,0.7)',
                textShadowRadius: 6,
              }}
            >
              {tx.marco}
            </Text>
          </View>
          <View style={{ flex: 1 }} />
          {/* C-FOTO-CARA-A-LA-VISTA: el error y la cámara que no arranca, junto al disparador. */}
          {error || noArranca ? (
            <View style={{ paddingHorizontal: 20, gap: 10, zIndex: 3 }}>
              <Text
                accessibilityRole="alert"
                testID={noArranca && !error ? 'camara-no-arranca' : 'camara-error'}
                style={{
                  color: '#FFFFFF',
                  textAlign: 'center',
                  fontWeight: '700',
                  fontSize: 15,
                  lineHeight: 21,
                  textShadowColor: 'rgba(0,0,0,0.7)',
                  textShadowRadius: 6,
                }}
              >
                {error || (Platform.OS === 'web' ? t.noArrancaWeb : t.noArranca)}
              </Text>
              {noArranca || error === t.sinCamara ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Boton texto={t.reintentar} alTocar={reintentar} testID="camara-reintentar" />
                  </View>
                  {Platform.OS === 'web' ? null : (
                    <View style={{ flex: 1 }}>
                      <Boton
                        texto={t.revisarPermiso}
                        alTocar={() =>
                          void Linking.openSettings().catch((x: unknown) =>
                            console.warn('papeles: no se abrieron los ajustes', x),
                          )
                        }
                        secundario
                        oscuro
                        testID="camara-revisar-permiso"
                      />
                    </View>
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
          {permiso && !permiso.granted ? (
            <View style={{ padding: 20, gap: 10, zIndex: 3 }}>
              <Text
                testID={bloqueada ? 'camara-bloqueada' : 'camara-permiso'}
                style={{ color: '#FFFFFF', textAlign: 'center', fontSize: 15, lineHeight: 21 }}
              >
                {bloqueada ? (Platform.OS === 'web' ? t.bloqueadaWeb : t.bloqueada) : t.permiso}
              </Text>
              {bloqueada ? (
                Platform.OS === 'web' ? null : (
                  <Boton
                    texto={t.ajustes}
                    icono="settings-outline"
                    alTocar={() =>
                      void Linking.openSettings().catch((x: unknown) =>
                        console.warn('papeles: no se abrieron los ajustes', x),
                      )
                    }
                    testID="camara-ajustes"
                  />
                )
              ) : (
                <Boton texto={t.permitir} alTocar={() => void pedirPermiso()} />
              )}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingBottom: 28, zIndex: 3 }}>
              <Pressable
                testID="camara-disparo"
                onPress={() => void disparar()}
                disabled={!lista || tomando}
                accessibilityRole="button"
                accessibilityLabel={t.tomar}
                style={{
                  width: 78,
                  height: 78,
                  borderRadius: 39,
                  borderWidth: 5,
                  borderColor: 'rgba(255,255,255,0.5)',
                  backgroundColor: '#FFFFFF',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: lista ? 1 : 0.5,
                }}
              >
                {tomando ? <ActivityIndicator color="#17181B" /> : null}
              </Pressable>
            </View>
          )}
        </SafeAreaView>
      </View>
    </View>
  );
}
