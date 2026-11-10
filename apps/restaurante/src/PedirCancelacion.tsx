import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  ErrorApi,
  type Idioma,
  MOTIVOS_CANCELACION,
  TEXTO_PAGA_COMIDA,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  alSalirTelefono,
  almacenTelefono,
  e,
  useSesion,
} from '@tumbite/movil';

/**
 * C-CANCELAR-LISTO (10 nov 2026) — todos los países. Un pedido ya listo no se cancela con un
 * toque: el restaurante se lo pide a soporte con un motivo de la lista (como DoorDash y Uber Eats)
 * y ve quién asume la comida preparada antes de enviar.
 */
const T = {
  es: {
    titulo: 'Pedir a soporte la cancelación',
    intro:
      'Este pedido ya está listo. Dinos por qué hay que cancelarlo y nuestro equipo lo resuelve en minutos. Mientras tanto el pedido sigue en curso.',
    detalle: 'Cuéntanos qué pasó',
    enviar: 'Enviar a soporte',
    enviando: 'Enviando…',
    volver: 'Volver',
    listo: 'Recibido. Soporte revisa la cancelación y te avisa aquí mismo.',
    cerrar: 'Cerrar',
  },
  en: {
    titulo: 'Ask support to cancel',
    intro:
      'This order is already ready. Tell us why it has to be canceled and our team will sort it out in minutes. Meanwhile the order stays in progress.',
    detalle: 'Tell us what happened',
    enviar: 'Send to support',
    enviando: 'Sending…',
    volver: 'Back',
    listo: 'Got it. Support is reviewing the cancellation and will let you know right here.',
    cerrar: 'Close',
  },
};

export function PedirCancelacion({
  pedidoId,
  idioma,
  alCerrar,
  alEnviar,
}: {
  pedidoId: string;
  idioma: Idioma;
  alCerrar: () => void;
  alEnviar: () => void;
}) {
  const t = idioma === 'en' ? T.en : T.es;
  const { api, usuario } = useSesion();
  const b = useBorrador({
    formulario: `pedir-cancelacion-${pedidoId.slice(0, 12)}`,
    cuenta: usuario?.id,
    inicial: { motivo: '', detalle: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const v = b.valores;
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState(false);
  const elegido = MOTIVOS_CANCELACION.find((m) => m.id === v.motivo);

  async function enviar() {
    setError('');
    setEnviando(true);
    try {
      await api.pedir('POST', `/datos/restaurante/pedidos/${pedidoId}/pedir-cancelacion`, {
        motivo: v.motivo,
        detalle: v.detalle,
      });
      await b.limpiar();
      setHecho(true);
      alEnviar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={alCerrar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <View
          testID="pedir-cancelacion"
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            padding: 18,
            maxHeight: '88%',
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 10 }}>
            <Text style={{ fontSize: 19, fontWeight: '800' }} accessibilityRole="header">
              {t.titulo}
            </Text>
            {hecho ? (
              <>
                <Text
                  testID="cancelacion-enviada"
                  style={{ color: C.exito, fontWeight: '700', fontSize: 15 }}
                >
                  {t.listo}
                </Text>
                <Boton texto={t.cerrar} alTocar={alCerrar} secundario />
              </>
            ) : (
              <>
                <Text style={{ color: '#5E5E5E', fontSize: 14 }}>{t.intro}</Text>
                <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
                {MOTIVOS_CANCELACION.map((m) => {
                  const activo = v.motivo === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => b.cambiar('motivo', m.id)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: activo }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                        borderWidth: 1,
                        borderColor: activo ? '#101010' : '#D0D0D0',
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          borderWidth: 2,
                          borderColor: activo ? '#101010' : '#9A9A9A',
                          backgroundColor: activo ? '#101010' : '#fff',
                        }}
                      />
                      <Text style={{ flex: 1, fontSize: 15, fontWeight: activo ? '700' : '500' }}>
                        {idioma === 'en' ? m.texto.en : m.texto.es}
                      </Text>
                    </Pressable>
                  );
                })}
                {elegido ? (
                  <Text testID="quien-paga" style={{ color: '#5E5E5E', fontSize: 14 }}>
                    {idioma === 'en'
                      ? TEXTO_PAGA_COMIDA[elegido.paga].en
                      : TEXTO_PAGA_COMIDA[elegido.paga].es}
                  </Text>
                ) : null}
                <TextInput
                  value={v.detalle}
                  onChangeText={(x) => b.cambiar('detalle', x)}
                  placeholder={t.detalle}
                  accessibilityLabel={t.detalle}
                  placeholderTextColor="#9A9A9A"
                  multiline
                  maxLength={300}
                  style={[e.input, { minHeight: 70, textAlignVertical: 'top' }]}
                />
                {error ? (
                  <Text accessibilityRole="alert" style={e.error}>
                    {error}
                  </Text>
                ) : null}
                <Boton
                  texto={enviando ? t.enviando : t.enviar}
                  alTocar={() => void enviar()}
                  cargando={enviando}
                />
                <Boton texto={t.volver} alTocar={alCerrar} secundario />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
