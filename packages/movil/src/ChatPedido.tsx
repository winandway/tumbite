import { useCallback, useEffect, useRef, useState } from 'react';
import { Text } from './diseno';
import { FlatList, Image, Pressable, TextInput, View } from 'react-native';
import { ErrorApi, enIdioma, unirMensajes } from '@tumbite/compartido';
import { Boton, C, CASILLA_EN_FILA, FilaConBoton, e } from './ui';
import { useSesion } from './sesion';
import { BotonReportar, MenuBloquear } from './Moderacion';
import { useSondeo } from './useSondeo';
import { COLOR_TEXTO_DE_FONDO } from './tokens';

type Mensaje = {
  id: number;
  nombre: string;
  texto: string;
  en: string;
  mio: boolean;
  /** C-CHAT-FOTOS: el mensaje es una foto (privada; se pide con la sesión). */
  foto?: boolean;
};

/** La foto de un mensaje del chat, pedida con la sesión de quien la mira. */
function FotoMensaje({
  pedidoId,
  id,
  etiqueta,
}: {
  pedidoId: string;
  id: number;
  etiqueta: string;
}) {
  const { api } = useSesion();
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    api
      .verFoto(`/datos/pedidos/${pedidoId}/mensajes/${id}/foto`)
      .then((u) => vivo && setUri(u))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, pedidoId, id]);
  if (!uri) return <Text style={{ color: '#9a9a9a' }}>…</Text>;
  return (
    <Image
      source={{ uri }}
      accessibilityLabel={etiqueta}
      style={{ width: 200, height: 200, borderRadius: 10, backgroundColor: '#f2f2f2' }}
      resizeMode="cover"
    />
  );
}

const T = {
  es: {
    titulo: 'Chat del pedido',
    escribe: 'Escribe un mensaje…',
    enviar: 'Enviar',
    foto: 'Foto',
    mandarFoto: 'Adjuntar una foto',
    fotoDe: 'Foto de',
    cerrado: 'El chat se cerró: el pedido ya terminó.',
    vacio: 'Sin mensajes todavía. Aquí puedes escribirle sin compartir tu número.',
  },
  en: {
    titulo: 'Order chat',
    escribe: 'Write a message…',
    enviar: 'Send',
    foto: 'Photo',
    mandarFoto: 'Attach a photo',
    fotoDe: 'Photo from',
    cerrado: 'The chat is closed: this order is finished.',
    vacio: 'No messages yet. You can write here without sharing your phone number.',
  },
};

/**
 * Chat entre el cliente y el repartidor de un pedido, dentro de la app: sin números de teléfono,
 * queda registrado y se cierra solo cuando el pedido termina. Se consulta cada 4 segundos.
 */
export function ChatPedido({
  pedidoId,
  elegirFoto,
  ruta,
  nombreOtro,
}: {
  pedidoId: string;
  /**
   * C-CHAT-VIAJE: el chat de un viaje usa la misma pieza con su ruta (`/datos/viajes/<id>`). Sin
   * ella, la del pedido de Comida.
   */
  ruta?: string;
  /** C-CHAT-FOTOS: la app pasa cómo elegir una foto (cámara o galería). Sin ella, solo texto. */
  elegirFoto?: () => Promise<Blob | null>;
  /** C-MODERACION: el nombre de pila de la otra persona (para «Bloquear a…»). */
  nombreOtro?: string;
}) {
  const { api, idioma } = useSesion();
  const raiz = ruta ?? `/datos/pedidos/${pedidoId}`;
  const t = enIdioma(T, idioma);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [abierto, setAbierto] = useState(true);
  // C-MODERACION: si quien mira bloqueó a la otra persona (sus mensajes ya no llegan).
  const [bloqueaste, setBloqueaste] = useState(false);
  const esViaje = Boolean(ruta?.startsWith('/datos/viajes/'));
  const tipoMensaje = esViaje ? 'mensaje_viaje' : 'mensaje_pedido';
  const viajeId = esViaje ? ruta?.split('/')[3] : undefined;
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ultimo = useRef(0);
  // C-CHAT-VISTO-REINTENTA: si marcar «visto» falla, se repite en la siguiente consulta (4 s) hasta
  // que el servidor lo confirme; el número de mensajes sin leer nunca se queda pegado en silencio.
  const vistoPendiente = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api.pedir<{ abierto: boolean; bloqueaste?: boolean; mensajes: Mensaje[] }>(
        'GET',
        `${raiz}/mensajes?desde=${ultimo.current}`,
      );
      setAbierto(r.abierto);
      setBloqueaste(Boolean(r.bloqueaste));
      if (r.mensajes.length) {
        ultimo.current = Math.max(ultimo.current, r.mensajes[r.mensajes.length - 1]!.id);
        // C-CHAT-SIN-DOBLES: dos consultas cruzadas pueden traer el mismo mensaje.
        setMensajes((m) => unirMensajes(m, r.mensajes));
        // C-CHAT-VIAJE-LLEGA: con el chat del viaje abierto, lo que llegó ya está visto (una escritura
        // en el servidor, y solo si avanza). La ficha del viaje deja el número en cero.
        if (esViaje && r.mensajes.some((x) => !x.mio)) vistoPendiente.current = true;
      }
      if (esViaje && vistoPendiente.current) {
        vistoPendiente.current = false;
        void api.pedir('POST', `${raiz}/mensajes/visto`, {}).catch((e: unknown) => {
          vistoPendiente.current = true;
          console.warn('[chat] no se pudo marcar visto; se repite en la próxima consulta', e);
        });
      }
    } catch {
      /* la siguiente consulta lo intenta otra vez (cada vez más espaciada) */
      return false;
    }
  }, [api, raiz, esViaje]);

  // C-SESION-TERMINADA: cada 4 s; si falla, espera cada vez más.
  useSondeo(cargar, 4000);

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    setError('');
    try {
      await api.pedir('POST', `${raiz}/mensajes`, { texto: limpio });
      setTexto('');
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  async function mandarFoto() {
    if (!elegirFoto || enviando) return;
    setError('');
    try {
      const f = await elegirFoto();
      if (!f) return;
      setEnviando(true);
      await api.subirFoto(f, `${raiz}/mensajes/foto`);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={e.tarjeta} accessibilityLabel={t.titulo}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <Text style={{ fontWeight: '700' }}>{t.titulo}</Text>
        {abierto && !bloqueaste ? (
          <MenuBloquear
            pedidoId={esViaje ? undefined : pedidoId}
            viajeId={viajeId}
            nombre={nombreOtro ?? mensajes.find((m) => !m.mio)?.nombre ?? ''}
            bloqueaste={false}
            alBloquear={() => {
              setBloqueaste(true);
              setMensajes((m) => m.filter((x) => x.mio));
            }}
          />
        ) : null}
      </View>
      {bloqueaste ? (
        <MenuBloquear nombre={nombreOtro ?? ''} bloqueaste alBloquear={() => undefined} />
      ) : null}
      {mensajes.length === 0 ? (
        <Text style={{ color: '#666B73' }}>{abierto ? t.vacio : t.cerrado}</Text>
      ) : (
        <FlatList
          data={mensajes}
          keyExtractor={(m) => String(m.id)}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View
              style={{
                alignSelf: item.mio ? 'flex-end' : 'flex-start',
                backgroundColor: item.mio ? C.secundario : '#F2F2F2',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginVertical: 3,
                maxWidth: '85%',
              }}
            >
              {!item.mio ? (
                <Text style={{ fontSize: 12, color: '#666B73', fontWeight: '700' }}>
                  {item.nombre}
                </Text>
              ) : null}
              {item.foto ? (
                <FotoMensaje
                  pedidoId={pedidoId}
                  id={item.id}
                  etiqueta={`${t.fotoDe} ${item.nombre}`}
                />
              ) : (
                <Text style={{ color: item.mio ? '#fff' : C.secundario }}>{item.texto}</Text>
              )}
              {/* C-MODERACION: cada mensaje de la otra persona se puede reportar. */}
              {!item.mio ? <BotonReportar tipo={tipoMensaje} id={item.id} /> : null}
            </View>
          )}
        />
      )}
      {error ? <Text style={e.error}>{error}</Text> : null}
      {abierto ? (
        <FilaConBoton style={{ marginTop: 8 }}>
          <TextInput
            placeholderTextColor={COLOR_TEXTO_DE_FONDO}
            value={texto}
            onChangeText={setTexto}
            placeholder={t.escribe}
            accessibilityLabel={t.escribe}
            style={[e.input, CASILLA_EN_FILA]}
            onSubmitEditing={() => void enviar()}
          />
          {elegirFoto ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.mandarFoto}
              onPress={() => void mandarFoto()}
              style={{ paddingHorizontal: 10, paddingVertical: 12 }}
            >
              <Text style={{ fontWeight: '700', color: C.secundario }}>{t.foto}</Text>
            </Pressable>
          ) : null}
          <Boton texto={t.enviar} alTocar={() => void enviar()} cargando={enviando} exito enFila />
        </FilaConBoton>
      ) : mensajes.length ? (
        <Text style={{ color: '#666B73', marginTop: 6 }}>{t.cerrado}</Text>
      ) : null}
    </View>
  );
}
