import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Pressable, Text, TextInput, View } from 'react-native';
import { ErrorApi, enIdioma } from '@tumbite/compartido';
import { Boton, C, e } from './ui';
import { useSesion } from './sesion';

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
    mandarFoto: 'Mandar una foto',
    fotoDe: 'Foto de',
    cerrado: 'El chat se cerró: el pedido ya terminó.',
    vacio: 'Sin mensajes todavía. Aquí puedes escribirle sin compartir tu número.',
  },
  en: {
    titulo: 'Order chat',
    escribe: 'Write a message…',
    enviar: 'Send',
    foto: 'Photo',
    mandarFoto: 'Send a photo',
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
}: {
  pedidoId: string;
  /** C-CHAT-FOTOS: la app pasa cómo elegir una foto (cámara o galería). Sin ella, solo texto. */
  elegirFoto?: () => Promise<Blob | null>;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [abierto, setAbierto] = useState(true);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const ultimo = useRef(0);

  const cargar = useCallback(async () => {
    try {
      const r = await api.pedir<{ abierto: boolean; mensajes: Mensaje[] }>(
        'GET',
        `/datos/pedidos/${pedidoId}/mensajes?desde=${ultimo.current}`,
      );
      setAbierto(r.abierto);
      if (r.mensajes.length) {
        ultimo.current = r.mensajes[r.mensajes.length - 1]!.id;
        setMensajes((m) => [...m, ...r.mensajes]);
      }
    } catch {
      /* la siguiente consulta lo intenta otra vez */
    }
  }, [api, pedidoId]);

  useEffect(() => {
    const primero = setTimeout(() => void cargar(), 0);
    const reloj = setInterval(() => void cargar(), 4000);
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
    };
  }, [cargar]);

  async function enviar() {
    const limpio = texto.trim();
    if (!limpio || enviando) return;
    setEnviando(true);
    setError('');
    try {
      await api.pedir('POST', `/datos/pedidos/${pedidoId}/mensajes`, { texto: limpio });
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
      await api.subirFoto(f, `/datos/pedidos/${pedidoId}/mensajes/foto`);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View style={e.tarjeta} accessibilityLabel={t.titulo}>
      <Text style={{ fontWeight: '800', marginBottom: 6 }}>{t.titulo}</Text>
      {mensajes.length === 0 ? (
        <Text style={{ color: '#5E5E5E' }}>{abierto ? t.vacio : t.cerrado}</Text>
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
                <Text style={{ fontSize: 12, color: '#5E5E5E', fontWeight: '700' }}>
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
            </View>
          )}
        />
      )}
      {error ? <Text style={e.error}>{error}</Text> : null}
      {abierto ? (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder={t.escribe}
            accessibilityLabel={t.escribe}
            style={[e.input, { flex: 1 }]}
            onSubmitEditing={() => void enviar()}
          />
          {elegirFoto ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.mandarFoto}
              onPress={() => void mandarFoto()}
              style={{ paddingHorizontal: 10, paddingVertical: 12 }}
            >
              <Text style={{ fontWeight: '800', color: C.secundario }}>{t.foto}</Text>
            </Pressable>
          ) : null}
          <View style={{ width: 110 }}>
            <Boton texto={t.enviar} alTocar={() => void enviar()} cargando={enviando} exito />
          </View>
        </View>
      ) : mensajes.length ? (
        <Text style={{ color: '#5E5E5E', marginTop: 6 }}>{t.cerrado}</Text>
      ) : null}
    </View>
  );
}
