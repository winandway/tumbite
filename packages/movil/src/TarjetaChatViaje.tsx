import { Pressable, View } from 'react-native';
import type { Idioma } from '@tumbite/compartido';
import { Icono, Text } from './diseno';
import { COLOR, FUENTE } from './tokens';

export type UltimoMensajeViaje = { texto: string; mio: boolean; nombre: string; en: string };

const T = {
  es: {
    titulo: 'Mensajes',
    vacio: 'Escríbele sin compartir tu número.',
    tu: 'Tú',
    nuevos: (n: number) => (n === 1 ? '1 mensaje nuevo' : `${n} mensajes nuevos`),
    abrir: 'Abrir el chat',
    cerrar: 'Ocultar el chat',
  },
  en: {
    titulo: 'Messages',
    vacio: 'Write without sharing your number.',
    tu: 'You',
    nuevos: (n: number) => (n === 1 ? '1 new message' : `${n} new messages`),
    abrir: 'Open the chat',
    cerrar: 'Hide the chat',
  },
};

/**
 * C-CHAT-VIAJE-LLEGA (24 nov 2026, prueba real: el pasajero no vio los mensajes del conductor; todos
 * los países). Arriba del viaje, en la app de clientes y en Driver: el último mensaje (de quién y la
 * hora) y el número rojo de lo que no ha visto. Sale de la ficha del viaje que la app ya consulta
 * (no abre ninguna conexión aparte). Tocarla abre el chat; abrirlo deja el número en cero.
 */
export function TarjetaChatViaje({
  idioma,
  sinLeer,
  ultimo,
  abierto,
  alTocar,
}: {
  idioma: Idioma;
  sinLeer: number;
  ultimo: UltimoMensajeViaje | null;
  abierto: boolean;
  alTocar: () => void;
}) {
  const t = idioma === 'en' ? T.en : T.es;
  const hora = ultimo
    ? new Date(`${ultimo.en.replace(' ', 'T')}Z`).toLocaleTimeString(
        idioma === 'en' ? 'en-US' : 'es-US',
        { hour: 'numeric', minute: '2-digit' },
      )
    : '';
  const hayNuevos = sinLeer > 0 && !abierto;
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={`${t.titulo}. ${hayNuevos ? t.nuevos(sinLeer) : ''} ${abierto ? t.cerrar : t.abrir}`}
      accessibilityState={{ expanded: abierto }}
      testID="tarjeta-chat-viaje"
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: hayNuevos ? COLOR.negro : COLOR.borde,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: COLOR.blanco,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: COLOR.superficie,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icono nombre="chatbubble-ellipses-outline" tamano={22} color={COLOR.negro} />
        {hayNuevos ? (
          <View
            testID="chat-viaje-sin-leer"
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              minWidth: 20,
              height: 20,
              borderRadius: 10,
              paddingHorizontal: 5,
              backgroundColor: COLOR.marca,
              borderWidth: 2,
              borderColor: COLOR.blanco,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: COLOR.blanco, fontFamily: FUENTE.textoNegrita, fontSize: 11 }}>
              {sinLeer > 9 ? '9+' : String(sinLeer)}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text
            style={{ fontFamily: FUENTE.textoNegrita, fontSize: 14.5, color: COLOR.texto, flex: 1 }}
          >
            {hayNuevos ? t.nuevos(sinLeer) : t.titulo}
          </Text>
          {hora ? <Text style={{ fontSize: 12, color: COLOR.textoSuave }}>{hora}</Text> : null}
        </View>
        <Text
          testID="chat-viaje-ultimo"
          numberOfLines={2}
          style={{
            fontSize: 13.5,
            lineHeight: 19,
            color: hayNuevos ? COLOR.texto : COLOR.textoSuave,
            fontFamily: hayNuevos ? FUENTE.textoFuerte : FUENTE.texto,
          }}
        >
          {ultimo ? `${ultimo.mio ? t.tu : ultimo.nombre}: ${ultimo.texto}` : t.vacio}
        </Text>
      </View>
      <Icono
        nombre={abierto ? 'chevron-up' : 'chevron-down'}
        tamano={18}
        color={COLOR.textoTenue}
      />
    </Pressable>
  );
}
