import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ErrorApi,
  type HiloCamila,
  type MensajeCamila,
  type RespuestaCamila,
  TEXTOS_CHAT_SOPORTE,
  enIdioma,
  nombreAutorCamila,
  cronometroDeEscritura,
  problemaDeCaptura,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  CASILLA_EN_FILA,
  FilaConBoton,
  Text,
  alSalirTelefono,
  almacenTelefono,
  e,
  fotoConOrigen,
  useSesion,
  useSondeo,
} from '@tumbite/movil';

/**
 * C-CAMILA-CHAT en Divoox Driver (17 nov 2026) — todos los países. «Habla con soporte», dentro de
 * Ayuda: la misma conversación de la web y del correo, con la cuenta del conductor (canal «app»).
 * Lo escrito se guarda solo y vuelve si la app se cierra; se borra al enviarse bien. Si una persona
 * del equipo tomó la conversación, se dice en pantalla y Camila no contesta.
 *
 * C-CAMILA-FALLOS: cuando Camila pide la captura de un reporte de fallo, aparece su bloque con
 * «Subir desde archivos» y «Tomar foto» (la pieza única de la cámara) y «No tengo captura».
 */
const ESPERA_RECARGA_MS = 8_000;

const CAMARA = {
  pedirPermiso: () => ImagePicker.requestCameraPermissionsAsync(),
  tomar: () => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 }),
};
const deArchivos = async () => {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // En el iPhone, la versión compatible (JPEG).
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    quality: 0.7,
  });
  return r.canceled ? null : (r.assets[0] ?? null);
};

export function ChatSoporteApp() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS_CHAT_SOPORTE, idioma);
  const [hilo, setHilo] = useState<HiloCamila | null>(null);
  const [pendiente, setPendiente] = useState<MensajeCamila | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const lista = useRef<ScrollView>(null);
  // Los tres puntitos de «Camila está escribiendo», uno tras otro.
  const [puntos, setPuntos] = useState(1);
  useEffect(() => {
    if (!enviando) return;
    const reloj = setInterval(() => setPuntos((n) => (n % 3) + 1), 400);
    return () => clearInterval(reloj);
  }, [enviando]);
  const b = useBorrador({
    formulario: 'chat-soporte-app',
    cuenta: usuario?.id,
    inicial: { texto: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });

  const cargar = useCallback(async () => {
    try {
      setHilo(await api.pedir<HiloCamila>('GET', '/datos/camila/hilo'));
      setError('');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : t.sinRed);
      return false;
    }
  }, [api, t.sinRed]);

  // C-SESION-TERMINADA: cada 8 s; si falla, espera cada vez más.
  useSondeo(cargar, ESPERA_RECARGA_MS);

  /** Manda lo escrito, o un texto fijo (por ejemplo «sin captura») sin tocar lo escrito. */
  async function enviar(fijo?: string) {
    const texto = (fijo ?? b.valores.texto).trim();
    if (!texto || enviando) return;
    setError('');
    setEnviando(true);
    setPendiente({ id: 'pendiente', autor: 'persona', texto, creado_en: new Date().toISOString() });
    const esperar = cronometroDeEscritura();
    try {
      const r = await api.pedir<RespuestaCamila>('POST', '/datos/camila/mensaje', {
        texto,
        canal: 'app',
      });
      // El mensaje ya llegó: la casilla se vacía AHORA, antes de la espera. Lo que la persona escriba
      // mientras Camila «escribe» es su siguiente mensaje y no se borra.
      if (fijo === undefined) await b.limpiar();
      // C-CAMILA-TONO: «Camila está escribiendo…» de 2 a 4 segundos según el largo de la respuesta.
      await esperar(r.respuesta);
      setHilo({
        pideCaptura: r.pideCaptura,
        verificada: r.verificada,
        equipoAtendiendo: r.equipoAtendiendo,
        mensajes: r.mensajes,
      });
    } catch (x) {
      // Lo escrito se queda en la casilla para reintentar.
      setError(x instanceof ErrorApi ? x.message : t.sinRed);
    } finally {
      setPendiente(null);
      setEnviando(false);
    }
  }

  const mensajes = [...(hilo?.mensajes ?? []), ...(pendiente ? [pendiente] : [])];
  /** C-CAMILA-REPORTAR: reportar una respuesta de Camila sin salir de la app. */
  async function reportar(id: string) {
    try {
      await api.pedir('POST', `/datos/camila/mensajes/${id}/reportar`, {});
      setHilo((h) =>
        h
          ? { ...h, mensajes: h.mensajes.map((m) => (m.id === id ? { ...m, reportado: true } : m)) }
          : h,
      );
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : t.sinRed);
    }
  }

  const burbuja = (m: Pick<MensajeCamila, 'id' | 'autor' | 'texto' | 'reportado'>) => {
    const mio = m.autor === 'persona';
    return (
      <View
        key={m.id}
        testID={`chat-mensaje-${m.autor}`}
        style={{
          alignSelf: mio ? 'flex-end' : 'flex-start',
          backgroundColor: mio ? C.secundario : '#FFFFFF',
          borderWidth: 1,
          borderColor: mio ? C.secundario : m.autor === 'equipo' ? C.secundario : '#E3E6EB',
          borderRadius: 14,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginVertical: 4,
          maxWidth: '86%',
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: mio ? '#D0D2D6' : '#666B73' }}>
          {nombreAutorCamila(m.autor, idioma)}
        </Text>
        <Text style={{ color: mio ? '#FFFFFF' : C.secundario, fontSize: 15, lineHeight: 21 }}>
          {m.texto}
        </Text>
        {m.autor === 'camila' && m.id !== 'saludo' ? (
          m.reportado ? (
            <Text testID="chat-reportada" style={{ color: '#666B73', fontSize: 12, marginTop: 4 }}>
              {t.reportada}
            </Text>
          ) : (
            <Pressable
              testID="chat-reportar"
              accessibilityRole="button"
              accessibilityLabel={t.reportar}
              onPress={() => void reportar(m.id)}
              hitSlop={10}
              style={{ alignSelf: 'flex-start', marginTop: 4, paddingVertical: 4 }}
            >
              <Text style={{ color: '#666B73', fontSize: 12, textDecorationLine: 'underline' }}>
                {t.reportar}
              </Text>
            </Pressable>
          )
        ) : null}
      </View>
    );
  };
  return (
    <View style={{ padding: 16, gap: 10 }} testID="chat-soporte-app">
      <View style={e.tarjeta}>
        <Text
          accessibilityRole="header"
          style={{ fontWeight: '800', fontSize: 18, color: C.secundario }}
        >
          {t.titulo}
        </Text>
        <Text style={{ color: '#666B73', fontSize: 13 }}>{t.camila}</Text>
      </View>
      <ScrollView
        ref={lista}
        style={{ backgroundColor: '#F6F6F6', borderRadius: 14, maxHeight: 460 }}
        contentContainerStyle={{ padding: 10 }}
        onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}
        accessibilityLiveRegion="polite"
        nestedScrollEnabled
      >
        {/* Un solo saludo, corto, y solo si la conversación está vacía. */}
        {hilo !== null && mensajes.length === 0
          ? burbuja({ id: 'saludo', autor: 'camila', texto: t.saludo })
          : null}
        {mensajes.map(burbuja)}
        {enviando && !hilo?.equipoAtendiendo ? (
          <Text
            testID="chat-escribiendo"
            accessibilityLiveRegion="polite"
            style={{ color: '#666B73', fontStyle: 'italic', marginTop: 4 }}
          >
            {t.escribiendo}
            {'.'.repeat(puntos)}
          </Text>
        ) : null}
        {hilo === null && !error ? (
          <Text style={{ color: '#666B73', marginTop: 4 }}>{t.cargando}</Text>
        ) : null}
      </ScrollView>
      {hilo?.pideCaptura ? (
        <BloqueCapturaApp
          ocupado={enviando}
          alSubir={cargar}
          alNoTener={() => void enviar(t.mensajeSinCaptura)}
        />
      ) : null}
      {hilo?.equipoAtendiendo ? (
        <Text
          testID="chat-equipo-atiende"
          accessibilityRole="alert"
          style={{ color: C.secundario, fontWeight: '700' }}
        >
          {t.equipoAtiende}
        </Text>
      ) : null}
      {error ? (
        <Text style={e.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      <FilaConBoton>
        <TextInput
          value={b.valores.texto}
          onChangeText={(x) => b.cambiar('texto', x)}
          placeholder={t.escribe}
          accessibilityLabel={t.escribe}
          multiline
          maxLength={2000}
          style={[e.input, CASILLA_EN_FILA, { minHeight: 48, maxHeight: 120 }]}
          testID="chat-soporte-casilla"
        />
        <Boton texto={t.enviar} alTocar={() => void enviar()} cargando={enviando} enFila />
      </FilaConBoton>
    </View>
  );
}

type FotoElegida = { uri: string; mimeType?: string | null; fileSize?: number | null };

/**
 * C-CAMILA-FALLOS: el bloque de la captura en Driver. Los dos botones a la vista (regla de la
 * cámara), el aviso de tapar contraseñas y tarjetas, y «No tengo captura». Sin cámara o sin permiso,
 * se dice en palabras y queda «Subir desde archivos». Si la subida falla, se puede volver a intentar.
 */
function BloqueCapturaApp({
  ocupado,
  alSubir,
  alNoTener,
}: {
  ocupado: boolean;
  alSubir: () => Promise<void>;
  alNoTener: () => void;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS_CHAT_SOPORTE, idioma);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [fallida, setFallida] = useState<FotoElegida | null>(null);
  async function subir(foto: FotoElegida) {
    setError('');
    setSubiendo(true);
    try {
      const blob = await (await fetch(foto.uri)).blob();
      const problema = problemaDeCaptura(
        { size: foto.fileSize ?? blob.size, type: foto.mimeType ?? blob.type },
        idioma,
      );
      if (problema) {
        setError(problema);
        return;
      }
      await api.subirFoto(blob, '/datos/camila/fallos/captura');
      setFallida(null);
      await alSubir();
    } catch (x) {
      setFallida(foto);
      setError(x instanceof ErrorApi ? x.message : t.sinRed);
    } finally {
      setSubiendo(false);
    }
  }
  async function elegir(origen: 'camara' | 'archivos') {
    setError('');
    try {
      const f = await fotoConOrigen(idioma, CAMARA, deArchivos, origen);
      if (f) await subir(f);
    } catch (x) {
      // Sin cámara o sin permiso: el motivo en palabras; «Subir desde archivos» sigue ahí.
      setFallida(null);
      setError(x instanceof Error ? x.message : String(x));
    }
  }
  const quieto = subiendo || ocupado;
  return (
    <View style={[e.tarjeta, { gap: 8 }]} testID="chat-captura">
      <Text style={{ fontWeight: '800', color: C.secundario }}>{t.capturaTitulo}</Text>
      <Text style={{ color: C.secundario, fontWeight: '600', fontSize: 13 }}>{t.capturaAviso}</Text>
      <Boton
        texto={t.subirArchivos}
        alTocar={() => void elegir('archivos')}
        secundario
        cargando={quieto}
        testID="captura-archivos"
      />
      <Boton
        texto={t.tomarFoto}
        alTocar={() => void elegir('camara')}
        secundario
        cargando={quieto}
        testID="captura-camara"
      />
      {subiendo ? (
        <Text accessibilityRole="alert" style={{ color: '#666B73' }}>
          {t.subiendo}
        </Text>
      ) : null}
      {error ? (
        <Text style={e.error} accessibilityRole="alert" testID="captura-error">
          {error}
        </Text>
      ) : null}
      {error && fallida ? (
        <Boton texto={t.reintentarCaptura} alTocar={() => void subir(fallida)} secundario />
      ) : null}
      <Pressable
        onPress={alNoTener}
        disabled={quieto}
        accessibilityRole="button"
        testID="captura-no-tengo"
        hitSlop={8}
        style={{ alignSelf: 'flex-start', paddingVertical: 6 }}
      >
        <Text style={{ color: C.secundario, fontWeight: '700', textDecorationLine: 'underline' }}>
          {t.sinCaptura}
        </Text>
      </Pressable>
      <Text style={{ color: '#666B73', fontSize: 12 }}>{t.capturaPrivada}</Text>
    </View>
  );
}
