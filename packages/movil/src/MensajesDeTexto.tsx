import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ErrorApi, TEXTO_CONSENTIMIENTO_SMS, enIdioma } from '@tumbite/compartido';
import { CasillaSms } from './Acceso';
import { useSesion } from './sesion';
import { e } from './ui';

const T = {
  es: {
    titulo: 'Mensajes de texto',
    sinCelular: 'Agrega tu celular en tu cuenta para recibir los avisos por mensaje de texto.',
  },
  en: {
    titulo: 'Text messages',
    sinCelular: 'Add your mobile number to your account to get updates by text message.',
  },
};

/**
 * C-SMS-CONSENTIMIENTO (9 nov 2026, EE. UU.): en «Tu cuenta», la misma casilla del registro para
 * encender o apagar los SMS de pedidos y entregas. Apagarla es igual que responder STOP.
 */
export function MensajesDeTexto() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [estado, setEstado] = useState<{ tieneCelular: boolean; acepta: boolean } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ tieneCelular: boolean; acepta: boolean }>('GET', '/datos/cuentas/sms')
      .then((r) => vivo && setEstado(r))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);

  if (!estado) return null;
  if (!estado.tieneCelular)
    return (
      <View style={e.tarjeta} testID="sms-sin-celular">
        <Text style={{ fontWeight: '700', marginBottom: 4 }}>{t.titulo}</Text>
        <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.sinCelular}</Text>
      </View>
    );

  async function cambiar(acepta: boolean) {
    setError('');
    const antes = estado;
    setEstado((s) => (s ? { ...s, acepta } : s));
    try {
      await api.pedir('PUT', '/datos/cuentas/sms', { acepta });
    } catch (x) {
      setEstado(antes);
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <View style={e.tarjeta} testID="sms-cuenta">
      <Text style={{ fontWeight: '700', marginBottom: 8 }}>{t.titulo}</Text>
      <CasillaSms
        marcada={estado.acepta}
        alCambiar={(v) => void cambiar(v)}
        texto={enIdioma(TEXTO_CONSENTIMIENTO_SMS, idioma)}
      />
      {error ? <Text style={e.error}>{error}</Text> : null}
    </View>
  );
}
