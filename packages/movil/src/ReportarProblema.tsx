import { useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { ErrorApi, enIdioma, useBorrador } from '@tumbite/compartido';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { URL_SERVIDOR, useSesion } from './sesion';
import { AvisoBorrador } from './AvisoBorrador';
import { Boton, Campo, e } from './ui';

const T = {
  es: {
    abrir: 'Tengo un problema',
    titulo: 'Cuéntanos qué pasó',
    ayuda: 'Lo lee una persona del equipo. Te respondemos por correo y en tu conversación.',
    texto: '¿Qué pasó?',
    enviar: 'Enviar',
    cancelar: 'Cancelar',
    listo: 'Recibimos tu mensaje. Te respondemos por correo.',
    ver: 'Ver mi conversación',
  },
  en: {
    abrir: 'I have a problem',
    titulo: 'Tell us what happened',
    ayuda: 'A real person on our team reads it. We’ll reply by email and in your conversation.',
    texto: 'What happened?',
    enviar: 'Send',
    cancelar: 'Cancel',
    listo: 'We got your message. We’ll reply by email.',
    ver: 'See my conversation',
  },
};

/**
 * Quejas y pedidos de ayuda desde las tres apps: abre un ticket (con el pedido, si hay) y la
 * persona recibe su enlace privado. Lo ven el superadmin y el franquiciado de esa ciudad.
 * Nunca pierde lo escrito. Candado C-QUEJAS.
 */
export function ReportarProblema({
  pedidoId,
  textoBoton,
}: {
  pedidoId?: string;
  textoBoton?: string;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enlace, setEnlace] = useState('');
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: `queja-${pedidoId ?? 'general'}`,
    cuenta: usuario?.id,
    inicial: { texto: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });

  async function enviar() {
    setError('');
    setEnviando(true);
    try {
      const r = await api.pedir<{ enlace: string }>('POST', '/datos/quejas', {
        tipo: 'queja',
        pedidoId: pedidoId ?? null,
        texto: b.valores.texto,
      });
      await b.limpiar();
      setEnlace(r.enlace);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  if (enlace)
    return (
      <View style={e.tarjeta} accessibilityRole="summary">
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>{t.listo}</Text>
        <Boton
          texto={t.ver}
          alTocar={() => void Linking.openURL(`${URL_SERVIDOR}${enlace}`)}
          secundario
        />
      </View>
    );
  if (!abierto && !b.valores.texto)
    return <Boton texto={textoBoton ?? t.abrir} alTocar={() => setAbierto(true)} secundario />;
  return (
    <View style={e.tarjeta}>
      <Text style={{ fontWeight: '800', fontSize: 17, marginBottom: 4 }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E', marginBottom: 8 }}>{t.ayuda}</Text>
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      <Campo
        etiqueta={t.texto}
        value={b.valores.texto}
        onChangeText={(x) => b.cambiar('texto', x)}
        multiline
        numberOfLines={4}
      />
      {error ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
      <Boton texto={t.enviar} alTocar={() => void enviar()} cargando={enviando} />
      <Text
        style={e.enlace}
        onPress={() => {
          setAbierto(false);
          void b.limpiar();
        }}
        accessibilityRole="button"
      >
        {t.cancelar}
      </Text>
    </View>
  );
}
