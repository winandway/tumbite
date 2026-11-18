import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import {
  ErrorApi,
  type HiloCamila,
  type MensajeCamila,
  type RespuestaCamila,
  TEXTOS_CHAT_SOPORTE,
  enIdioma,
  nombreAutorCamila,
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
  useSesion,
} from '@tumbite/movil';

/**
 * C-CAMILA-CHAT en Divoox Driver (17 nov 2026) — todos los países. «Habla con soporte», dentro de
 * Ayuda: la misma conversación de la web y del correo, con la cuenta del conductor (canal «app»).
 * Lo escrito se guarda solo y vuelve si la app se cierra; se borra al enviarse bien. Si una persona
 * del equipo tomó la conversación, se dice en pantalla y Camila no contesta.
 */
const ESPERA_RECARGA_MS = 8_000;

export function ChatSoporteApp() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS_CHAT_SOPORTE, idioma);
  const [hilo, setHilo] = useState<HiloCamila | null>(null);
  const [pendiente, setPendiente] = useState<MensajeCamila | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const lista = useRef<ScrollView>(null);
  const b = useBorrador({
    formulario: 'chat-soporte-app',
    cuenta: usuario?.id,
    inicial: { texto: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });

  const vencida = useRef(false);
  const cargar = useCallback(async () => {
    if (vencida.current) return;
    try {
      setHilo(await api.pedir<HiloCamila>('GET', '/datos/camila/hilo'));
      setError('');
    } catch (x) {
      // C-CAMILA-SONDEO: con la sesión vencida (401 o 403) el sondeo se DETIENE; no sigue pidiendo
      // cada pocos segundos. El mensaje queda en pantalla y la persona vuelve a entrar.
      if (x instanceof ErrorApi && (x.estado === 401 || x.estado === 403)) vencida.current = true;
      setError(x instanceof ErrorApi ? x.message : t.sinRed);
    }
  }, [api, t.sinRed]);

  useEffect(() => {
    const primero = setTimeout(() => void cargar(), 0);
    const reloj = setInterval(() => {
      if (vencida.current) clearInterval(reloj);
      else void cargar();
    }, ESPERA_RECARGA_MS);
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
    };
  }, [cargar]);

  async function enviar() {
    const texto = b.valores.texto.trim();
    if (!texto || enviando) return;
    setError('');
    setEnviando(true);
    setPendiente({ id: 'pendiente', autor: 'persona', texto, creado_en: new Date().toISOString() });
    try {
      const r = await api.pedir<RespuestaCamila>('POST', '/datos/camila/mensaje', {
        texto,
        canal: 'app',
      });
      setHilo({
        verificada: r.verificada,
        equipoAtendiendo: r.equipoAtendiendo,
        mensajes: r.mensajes,
      });
      await b.limpiar();
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
        {burbuja({ id: 'saludo', autor: 'camila', texto: t.saludo })}
        {mensajes.map(burbuja)}
        {enviando && !hilo?.equipoAtendiendo ? (
          <Text style={{ color: '#666B73', fontStyle: 'italic', marginTop: 4 }}>
            {t.escribiendo}
          </Text>
        ) : null}
        {hilo === null && !error ? (
          <Text style={{ color: '#666B73', marginTop: 4 }}>{t.cargando}</Text>
        ) : null}
      </ScrollView>
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
