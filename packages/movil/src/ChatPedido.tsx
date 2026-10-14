import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { ErrorApi, enIdioma } from '@tumbite/compartido';
import { Boton, C, e } from './ui';
import { useSesion } from './sesion';

type Mensaje = { id: number; nombre: string; texto: string; en: string; mio: boolean };

const T = {
  es: {
    titulo: 'Chat del pedido',
    escribe: 'Escribe un mensaje…',
    enviar: 'Enviar',
    cerrado: 'El chat se cerró: el pedido ya terminó.',
    vacio: 'Sin mensajes todavía. Aquí puedes escribirle sin compartir tu número.',
  },
  en: {
    titulo: 'Order chat',
    escribe: 'Write a message…',
    enviar: 'Send',
    cerrado: 'The chat is closed: this order is finished.',
    vacio: 'No messages yet. You can write here without sharing your phone number.',
  },
};

/**
 * Chat entre el cliente y el repartidor de un pedido, dentro de la app: sin números de teléfono,
 * queda registrado y se cierra solo cuando el pedido termina. Se consulta cada 4 segundos.
 */
export function ChatPedido({ pedidoId }: { pedidoId: string }) {
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
              <Text style={{ color: item.mio ? '#fff' : C.secundario }}>{item.texto}</Text>
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
