import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import {
  type Idioma,
  TEXTO_CONSENTIMIENTO_SMS,
  enIdioma,
  enIdiomaDireccion,
  textoConsentimientoSms,
} from '@tumbite/compartido';
import { abrirPagina } from './PaginaEnApp';
import { URL_SERVIDOR, useSesion } from './sesion';
import { C, e } from './ui';

/**
 * C-SMS-CONSENTIMIENTO: la casilla de mensajes de texto, la ÚNICA pieza de las apps. Va aparte de
 * la de términos (Twilio lo exige), arranca sin marcar y no es obligatoria para registrarse.
 * Solo el cuadrito es la casilla: el texto lleva enlaces y un toque ahí abre la página.
 */
export function CasillaSms({
  idioma,
  marcada,
  cambiar,
}: {
  idioma: Idioma;
  marcada: boolean;
  cambiar: (v: boolean) => void;
}) {
  const t = enIdioma(TEXTO_CONSENTIMIENTO_SMS, idioma);
  const abrir = (ruta: string) => abrirPagina(`${URL_SERVIDOR}${enIdiomaDireccion(ruta, idioma)}`);
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}
      testID="casilla-sms"
    >
      <Pressable
        onPress={() => cambiar(!marcada)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: marcada }}
        accessibilityLabel={textoConsentimientoSms(idioma)}
        hitSlop={10}
        testID="casilla-sms-cuadro"
        style={{
          width: 22,
          height: 22,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: marcada ? C.primario : '#8A8A8A',
          backgroundColor: marcada ? C.primario : '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {marcada ? (
          <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>✓</Text>
        ) : null}
      </Pressable>
      <Text style={{ color: '#5E5E5E', fontSize: 13, flex: 1 }}>
        <Text style={{ fontWeight: '700', color: '#333333' }}>{t.titulo}. </Text>
        {t.antes}{' '}
        <Text style={e.enlaceLinea} onPress={() => abrir('/privacy')} accessibilityRole="link">
          {t.privacidad}
        </Text>{' '}
        {t.y}{' '}
        <Text style={e.enlaceLinea} onPress={() => abrir('/terms')} accessibilityRole="link">
          {t.terminos}
        </Text>
        .
      </Text>
    </View>
  );
}

const T = {
  es: { error: 'No pudimos guardar tu preferencia de SMS. Inténtalo otra vez.' },
  en: { error: 'We couldn’t save your text message preference. Please try again.' },
};

/**
 * La misma casilla en la cuenta, para aceptar o retirar los SMS después de registrarse. Cada toque
 * se guarda en el servidor (fecha, versión del texto y canal «app»).
 */
export function PreferenciaSms() {
  const { api, idioma } = useSesion();
  const [marcada, setMarcada] = useState<boolean | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ perfil: { smsConsentimiento?: boolean } }>('GET', '/datos/cuentas/perfil')
      .then((r) => {
        if (vivo) setMarcada(Boolean(r.perfil.smsConsentimiento));
      })
      .catch(() => {
        if (vivo) setMarcada(false);
      });
    return () => {
      vivo = false;
    };
  }, [api]);
  if (marcada === null) return null;
  const cambiar = (v: boolean) => {
    const antes = marcada;
    setMarcada(v);
    setError(false);
    api.pedir('PUT', '/datos/cuentas/sms', { acepta: v, canal: 'app' }).catch(() => {
      setMarcada(antes);
      setError(true);
    });
  };
  return (
    <View>
      <CasillaSms idioma={idioma} marcada={marcada} cambiar={cambiar} />
      {error ? (
        <Text style={e.error} accessibilityRole="alert">
          {enIdioma(T, idioma).error}
        </Text>
      ) : null}
    </View>
  );
}
