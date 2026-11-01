import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { ErrorApi, enIdioma } from '@tumbite/compartido';
import { Boton, C, e, useSesion } from '@tumbite/movil';

/**
 * C-TELEFONO-VUELTA (D8, 1 nov 2026, como DoorDash al volver a la app): tras 14 días sin
 * conectarse, el repartidor confirma su teléfono con un código de seis cifras por SMS.
 */
const T = {
  es: {
    titulo: 'Confirma tu teléfono',
    ayuda: 'Bienvenido de vuelta. Te mandamos un código por SMS al número que termina en',
    enviar: 'Enviar el código',
    reenviar: 'Enviar otro código',
    enviado: 'Código enviado. Llega en unos segundos.',
    codigo: 'Código de 6 números',
    confirmar: 'Confirmar',
    listo: 'Teléfono confirmado. Ya puedes conectarte.',
  },
  en: {
    titulo: 'Confirm your phone',
    ayuda: 'Welcome back. We’ll text a code to the number ending in',
    enviar: 'Send the code',
    reenviar: 'Send another code',
    enviado: 'Code sent. It arrives in a few seconds.',
    codigo: '6-digit code',
    confirmar: 'Confirm',
    listo: 'Phone confirmed. You can go online now.',
  },
};

export function ConfirmarTelefono({
  ultimos,
  alListo,
}: {
  ultimos: string;
  alListo: (aviso: string) => void;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [codigo, setCodigo] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);

  async function llamar(ruta: string, cuerpo: object, despues: () => void) {
    setError('');
    setTrabajando(true);
    try {
      await api.pedir('POST', ruta, cuerpo);
      despues();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <View
      testID="confirmar-telefono"
      style={[e.tarjeta, { borderWidth: 2, borderColor: C.primario }]}
    >
      <Text style={{ fontWeight: '700', fontSize: 16 }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E', fontSize: 13, marginBottom: 8 }}>
        {t.ayuda} {ultimos}.
      </Text>
      {enviado ? (
        <>
          <Text style={{ color: C.exito, fontWeight: '600', marginBottom: 6 }}>{t.enviado}</Text>
          <TextInput
            value={codigo}
            onChangeText={(x) => setCodigo(x.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
            style={e.input}
            accessibilityLabel={t.codigo}
          />
        </>
      ) : null}
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{ color: C.primario, fontWeight: '600', marginTop: 6 }}
        >
          {error}
        </Text>
      ) : null}
      <View style={{ gap: 8, marginTop: 8 }}>
        {enviado ? (
          <Boton
            texto={t.confirmar}
            cargando={trabajando}
            alTocar={() =>
              void llamar('/datos/repartidor/telefono/verificar', { codigo }, () =>
                alListo(t.listo),
              )
            }
          />
        ) : null}
        <Boton
          texto={enviado ? t.reenviar : t.enviar}
          secundario={enviado}
          cargando={trabajando && !enviado}
          alTocar={() =>
            void llamar('/datos/repartidor/telefono/codigo', {}, () => {
              setEnviado(true);
              setCodigo('');
            })
          }
        />
      </View>
    </View>
  );
}
