import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { type Api, ErrorApi, type Idioma } from '@tumbite/compartido';
import { Boton, C, Campo, e } from '@tumbite/movil';
import { textosGrandes } from './textos';

/**
 * Ayuda dentro del pedido, como en Dasher y Uber: motivos predefinidos que abren un ticket con el
 * pedido, y el botón de emergencia (911) con registro para el equipo.
 */
export function AyudaPedido({
  api,
  idioma,
  pedidoId,
  alCerrar,
}: {
  api: Api;
  idioma: Idioma;
  pedidoId: string;
  alCerrar: () => void;
}) {
  const t = textosGrandes(idioma).ayuda;
  const tp = textosGrandes(idioma).pedido;
  const [motivo, setMotivo] = useState<string | null>(null);
  const [detalle, setDetalle] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const motivos = new Map(Object.entries(t.motivos));
  async function enviar() {
    if (!motivo) return;
    setEnviando(true);
    try {
      await api.pedir('POST', '/datos/quejas', {
        tipo: 'soporte',
        pedidoId,
        texto: `[${motivos.get(motivo) ?? motivo}] ${detalle.trim()}`.trim(),
      });
      setMensaje(t.listo);
    } catch (x) {
      setMensaje(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }
  async function emergencia() {
    void api
      .pedir('POST', '/datos/quejas', {
        tipo: 'soporte',
        pedidoId,
        texto: '[EMERGENCIA] El repartidor llamó al 911 desde la app.',
      })
      .catch(() => undefined);
    await Linking.openURL('tel:911');
  }
  return (
    <View style={[e.tarjeta, { gap: 8 }]} testID="ayuda-pedido">
      <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}>{t.titulo}</Text>
      {[...motivos.entries()].map(([k, texto]) => (
        <Pressable
          key={k}
          onPress={() => setMotivo(k)}
          accessibilityRole="radio"
          accessibilityState={{ checked: motivo === k }}
          style={{
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: motivo === k ? C.primario : '#E3E6EB',
            backgroundColor: motivo === k ? '#FFF1EE' : '#fff',
          }}
        >
          <Text style={{ color: C.secundario, fontWeight: motivo === k ? '800' : '600' }}>
            {texto}
          </Text>
        </Pressable>
      ))}
      {motivo ? (
        <Campo etiqueta={t.detalle} value={detalle} onChangeText={setDetalle} multiline />
      ) : null}
      {mensaje ? <Text style={{ color: C.secundario }}>{mensaje}</Text> : null}
      <Boton texto={t.enviar} alTocar={() => void enviar()} cargando={enviando} />
      <Boton texto={t.cancelar} alTocar={alCerrar} secundario />
      <Pressable
        onPress={() => void emergencia()}
        accessibilityRole="button"
        accessibilityLabel={tp.emergencia}
        style={{ alignItems: 'center', paddingVertical: 8 }}
      >
        <Text style={{ color: C.primario, fontWeight: '800' }}>{tp.emergencia} · 911</Text>
        <Text style={{ color: '#8A8A8A', fontSize: 12 }}>{tp.emergenciaAyuda}</Text>
      </Pressable>
    </View>
  );
}
