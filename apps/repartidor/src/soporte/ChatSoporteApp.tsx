import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  ErrorApi,
  type HiloCamila,
  type MensajeCamila,
  type RespuestaCamila,
  TEXTOS_CHAT_SOPORTE,
  enIdioma,
  esMarcaDeCaptura,
  nombreAutorCamila,
  trozosDeMensaje,
  cronometroDeEscritura,
  problemaDeCaptura,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  abrirPagina,
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
 * C-CAMILA-REPORTE-CONVERSADO (19 nov 2026): «Adjuntar captura» abre «Subir desde archivos» y «Tomar
 * foto» (la pieza única de la cámara). La captura NO se envía sola: queda en el borrador del mensaje,
 * como una miniatura con su equis, y viaja con lo que la persona escriba al tocar Enviar. Si la app se
 * cierra, la captura del borrador vuelve al abrir el chat (la guarda el servidor). Igual que la web.
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
  // El mensaje ya llegó y corre la espera de «Camila está escribiendo»: el botón dice «Un momento…».
  const [respondiendo, setRespondiendo] = useState(false);
  // La persona abrió el bloque para elegir la captura con el botón fijo del chat.
  const [adjuntar, setAdjuntar] = useState(false);
  // La captura del borrador: su id en el servidor y, si se acaba de elegir, su imagen local.
  const [adjunto, setAdjunto] = useState<{ id: string; local?: string } | null>(null);
  // Las que la persona quitó con la equis: aunque el servidor todavía las nombre, no vuelven.
  const quitadas = useRef(new Set<string>());
  // La imagen local de cada captura elegida aquí: el hilo la muestra sin volver a bajarla.
  const [locales, setLocales] = useState<ReadonlyMap<string, string>>(() => new Map());
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
      const h = await api.pedir<HiloCamila>('GET', '/datos/camila/hilo');
      setHilo(h);
      // La captura que quedó en el borrador vuelve con el hilo (si no se quitó aquí).
      const pendienteDelHilo = h.adjuntoPendiente;
      if (pendienteDelHilo && !quitadas.current.has(pendienteDelHilo))
        setAdjunto((a) => (a?.id === pendienteDelHilo ? a : { id: pendienteDelHilo }));
      setError('');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : t.sinRed);
      return false;
    }
  }, [api, t.sinRed]);

  // C-SESION-TERMINADA: cada 8 s; si falla, espera cada vez más.
  useSondeo(cargar, ESPERA_RECARGA_MS);

  /** Manda lo escrito y la captura del borrador, juntos. */
  async function enviar() {
    const texto = b.valores.texto.trim();
    const conAdjunto = adjunto;
    if ((!texto && !conAdjunto) || enviando) return;
    setError('');
    setEnviando(true);
    setPendiente({
      id: 'pendiente',
      autor: 'persona',
      texto,
      creado_en: new Date().toISOString(),
      adjunto: conAdjunto?.id ?? null,
    });
    const esperar = cronometroDeEscritura();
    try {
      const r = await api.pedir<RespuestaCamila>('POST', '/datos/camila/mensaje', {
        texto,
        canal: 'app',
        ...(conAdjunto ? { adjunto: conAdjunto.id } : {}),
      });
      // El mensaje ya llegó: la casilla y la captura se vacían AHORA, antes de la espera. Lo que la
      // persona escriba mientras Camila «escribe» es su siguiente mensaje y no se borra.
      await b.limpiar();
      if (conAdjunto) quitadas.current.add(conAdjunto.id);
      setAdjunto(null);
      setRespondiendo(true);
      // C-CAMILA-TONO: «Camila está escribiendo…» de 2 a 4 segundos según el largo de la respuesta.
      await esperar(r.respuesta);
      setHilo((h) => ({
        adjuntoPendiente: r.adjuntoPendiente,
        verificada: r.verificada,
        equipoAtendiendo: r.equipoAtendiendo,
        // C-PERMISO-IA-CHAT: lo que la persona contestó no se pierde al refrescar el hilo.
        permisoIa: r.permisoIa ?? h?.permisoIa ?? null,
        mensajes: r.mensajes,
      }));
    } catch (x) {
      // Lo escrito y la captura se quedan en el borrador para reintentar.
      setError(x instanceof ErrorApi ? x.message : t.sinRed);
    } finally {
      setPendiente(null);
      setEnviando(false);
      setRespondiendo(false);
    }
  }

  /** La equis de la miniatura: la captura sale del borrador (aquí y en el servidor). */
  async function quitarAdjunto() {
    const a = adjunto;
    if (!a) return;
    quitadas.current.add(a.id);
    setAdjunto(null);
    await api.pedir('DELETE', `/datos/camila/adjunto/${a.id}`).catch(() => undefined);
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

  const burbuja = (m: Pick<MensajeCamila, 'id' | 'autor' | 'texto' | 'reportado' | 'adjunto'>) => {
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
        {m.adjunto ? (
          <MiniaturaApp id={m.adjunto} local={locales.get(m.adjunto)} lado={150} />
        ) : null}
        {(m.adjunto && esMarcaDeCaptura(m.texto) ? [] : trozosDeMensaje(m.texto)).map((trozo, i) =>
          'url' in trozo ? (
            <Pressable
              key={i}
              testID="chat-enlace-guia"
              accessibilityRole="link"
              onPress={() => abrirPagina(trozo.url)}
              style={{ paddingVertical: 6 }}
            >
              <Text
                style={{
                  color: '#C20A1A',
                  fontSize: 15,
                  fontWeight: '700',
                  textDecorationLine: 'underline',
                }}
              >
                {trozo.etiqueta}
              </Text>
            </Pressable>
          ) : (
            <Text
              key={i}
              style={{ color: mio ? '#FFFFFF' : C.secundario, fontSize: 15, lineHeight: 21 }}
            >
              {trozo.texto}
            </Text>
          ),
        )}
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
        automaticallyAdjustKeyboardInsets
        ref={lista}
        style={{ backgroundColor: '#F6F6F6', borderRadius: 14, maxHeight: 460 }}
        contentContainerStyle={{ padding: 10 }}
        onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}
        accessibilityLiveRegion="polite"
        nestedScrollEnabled
      >
        {/* Un solo saludo, corto, y solo si la conversación está vacía. */}
        {/* Sin señal también saluda: el aviso de «sin conexión» va abajo, no en vez del saludo. */}
        {(hilo !== null || error) && mensajes.length === 0
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
      {/* C-AVISO-IA-UNICO: el conductor da (o no) su permiso de IA una sola vez, en el aviso del
          registro; el chat ya no le hace otra pregunta. Sin permiso, le responde una persona. */}
      <>
        {adjuntar ? (
          <BloqueCapturaApp
            ocupado={enviando}
            alSubir={(id, local) => {
              setAdjuntar(false);
              setLocales((m) => new Map(m).set(id, local));
              setAdjunto({ id, local });
            }}
            alCerrar={() => setAdjuntar(false)}
          />
        ) : adjunto ? (
          <View
            testID="chat-captura-lista"
            style={[e.tarjeta, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}
          >
            <MiniaturaApp id={adjunto.id} local={adjunto.local} lado={56} />
            <Text style={{ flex: 1, color: C.secundario, fontSize: 13 }}>{t.capturaLista}</Text>
            <Pressable
              onPress={() => void quitarAdjunto()}
              disabled={enviando}
              accessibilityRole="button"
              accessibilityLabel={t.quitarCaptura}
              testID="chat-captura-quitar"
              hitSlop={10}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                borderWidth: 1,
                borderColor: C.secundario,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ color: C.secundario, fontSize: 18, fontWeight: '700' }}>×</Text>
            </Pressable>
          </View>
        ) : hilo?.equipoAtendiendo ? null : (
          <Pressable
            onPress={() => setAdjuntar(true)}
            accessibilityRole="button"
            testID="chat-adjuntar"
            hitSlop={8}
            style={{ alignSelf: 'flex-start', paddingVertical: 6 }}
          >
            <Text
              style={{ color: C.secundario, fontWeight: '700', textDecorationLine: 'underline' }}
            >
              {t.adjuntar}
            </Text>
          </Pressable>
        )}
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
            placeholder={adjunto ? t.escribeConCaptura : t.escribe}
            accessibilityLabel={t.escribe}
            multiline
            maxLength={2000}
            style={[e.input, CASILLA_EN_FILA, { minHeight: 48, maxHeight: 120 }]}
            testID="chat-soporte-casilla"
          />
          <Boton
            texto={respondiendo ? t.unMomento : t.enviar}
            alTocar={() => void enviar()}
            cargando={enviando && !respondiendo}
            testID="chat-soporte-enviar"
            enFila
          />
        </FilaConBoton>
      </>
    </View>
  );
}

type FotoElegida = { uri: string; mimeType?: string | null; fileSize?: number | null };

/** La captura, pedida con la sesión de la persona (nunca una dirección pública). */
function MiniaturaApp({ id, local, lado }: { id: string; local?: string; lado: number }) {
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS_CHAT_SOPORTE, idioma);
  const [bajada, setBajada] = useState('');
  useEffect(() => {
    if (local) return;
    let vivo = true;
    api
      .verFoto(`/datos/camila/adjunto/${encodeURIComponent(id)}`)
      .then((u) => vivo && setBajada(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, id, local]);
  const uri = local ?? bajada;
  const forma = {
    width: lado,
    height: lado,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D5D9E0',
    backgroundColor: '#F1F3F6',
  };
  return uri ? (
    <Image
      source={{ uri }}
      style={forma}
      resizeMode="cover"
      accessibilityLabel={t.capturaAlt}
      testID="chat-miniatura"
    />
  ) : (
    <View style={forma} accessibilityLabel={t.capturaAlt} />
  );
}

/**
 * C-CAMILA-REPORTE-CONVERSADO: elegir la captura en Driver. Los dos botones a la vista (regla de la
 * cámara) y el aviso de tapar contraseñas y tarjetas. La imagen se sube y queda en el BORRADOR del
 * mensaje: no se envía sola. Sin cámara o sin permiso, se dice en palabras y queda «Subir desde
 * archivos». Si la subida falla, se puede volver a intentar.
 */
function BloqueCapturaApp({
  ocupado,
  alSubir,
  alCerrar,
}: {
  ocupado: boolean;
  /** La captura ya está guardada: su id y su imagen local para la miniatura. */
  alSubir: (id: string, local: string) => void;
  alCerrar: () => void;
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
      const r = await api.subirFoto(blob, '/datos/camila/adjunto');
      if (!r.adjunto) throw new ErrorApi(t.sinRed, 0);
      setFallida(null);
      alSubir(r.adjunto, foto.uri);
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
        onPress={alCerrar}
        disabled={quieto}
        accessibilityRole="button"
        testID="captura-cancelar"
        hitSlop={8}
        style={{ alignSelf: 'flex-start', paddingVertical: 6 }}
      >
        <Text style={{ color: C.secundario, fontWeight: '700', textDecorationLine: 'underline' }}>
          {t.cancelarCaptura}
        </Text>
      </Pressable>
      <Text style={{ color: '#666B73', fontSize: 12 }}>{t.capturaPrivada}</Text>
    </View>
  );
}
