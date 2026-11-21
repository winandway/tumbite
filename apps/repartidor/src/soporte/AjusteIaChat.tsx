import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { ErrorApi } from '@tumbite/compartido';
import { Boton, C, Text, e, useSesion } from '@tumbite/movil';
import { plataformaAviso } from '../papeles/textosAvisoIa';

const T = {
  es: {
    ajuste: 'Revisión con inteligencia artificial',
    ayuda:
      'Google (Gemini) analiza las fotos de tus documentos y tus mensajes del chat de ayuda. La decisión siempre la toma una persona de nuestro equipo. Si lo retiras, una persona revisa todo.',
    permitido: 'Permitida',
    noPermitido: 'Solo revisión por una persona',
    sinContestar: 'Sin contestar',
    retirar: 'Retirar el permiso',
    permitir: 'Dar el permiso',
    error: 'No pudimos guardar el cambio. Inténtalo otra vez.',
  },
  en: {
    ajuste: 'Review with artificial intelligence',
    ayuda:
      'Google (Gemini) analyzes your document photos and your help chat messages. A person on our team always makes the decision. If you withdraw it, a person reviews everything.',
    permitido: 'Allowed',
    noPermitido: 'Review by a person only',
    sinContestar: 'Not answered',
    retirar: 'Withdraw permission',
    permitir: 'Give permission',
    error: 'We couldn’t save the change. Please try again.',
  },
} as const;

/**
 * C-AVISO-IA-UNICO (21 nov 2026) — todos los países. En el perfil: el mismo permiso del aviso de IA
 * (fotos de verificación y chat de ayuda) se puede retirar o volver a dar cuando se quiera, en
 * cualquier plataforma (Apple 5.1.1(ii)). Retirarlo corta el envío al momento (lo hace cumplir el
 * servidor); darlo lo reanuda y lo pendiente pasa por la revisión automática.
 */
export function AjusteIaChat() {
  const { api, idioma } = useSesion();
  const t = idioma === 'en' ? T.en : T.es;
  const [permiso, setPermiso] = useState<boolean | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ permisoIa?: boolean | null }>('GET', '/datos/conductor/verificacion')
      .then((v) => vivo && setPermiso(v.permisoIa ?? null))
      // Sin señal no se inventa un estado: el ajuste no se dibuja hasta saberlo.
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);
  if (permiso === undefined) return null;
  const cambiar = async (acepto: boolean) => {
    setOcupado(true);
    setError('');
    try {
      const r = await api.pedir<{ permisoIa: boolean }>('POST', '/datos/conductor/aviso-ia', {
        acepto,
        plataforma: plataformaAviso(Platform.OS),
        desde: 'perfil',
      });
      setPermiso(r.permisoIa);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : t.error);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <View testID="ajuste-ia-chat" style={[e.tarjeta, { gap: 8 }]}>
      <Text style={{ fontWeight: '700', fontSize: 15 }}>{t.ajuste}</Text>
      <Text
        testID="ajuste-ia-chat-estado"
        style={{
          fontWeight: '700',
          // Verde solo cuando hay un permiso dado; lo demás, neutro (no es un problema).
          color: permiso ? C.exito : C.secundario,
        }}
      >
        {permiso === null ? t.sinContestar : permiso ? t.permitido : t.noPermitido}
      </Text>
      <Text style={{ color: '#666B73', fontSize: 13, lineHeight: 18 }}>{t.ayuda}</Text>
      <Boton
        texto={permiso ? t.retirar : t.permitir}
        secundario
        alTocar={() => void cambiar(!permiso)}
        cargando={ocupado}
        testID="ajuste-ia-chat-cambiar"
      />
      {error ? (
        <Text style={e.error} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
