import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { ErrorApi, type HiloCamila, textosPermisoIaChat } from '@tumbite/compartido';
import { Boton, C, Text, e, useSesion } from '@tumbite/movil';

/**
 * C-PERMISO-IA-CHAT (21 nov 2026, Apple 5.1.2(i)) — todos los países. En Ajustes: el permiso para que
 * el chat de ayuda se procese con inteligencia artificial se puede dar o retirar cuando se quiera.
 * Retirarlo corta el envío al momento (lo hace cumplir el servidor); darlo lo reanuda.
 */
export function AjusteIaChat() {
  const { api, idioma } = useSesion();
  const t = textosPermisoIaChat(idioma);
  const [permiso, setPermiso] = useState<boolean | null | undefined>(undefined);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    api
      .pedir<HiloCamila>('GET', '/datos/camila/hilo')
      .then((h) => vivo && setPermiso(h.permisoIa ?? null))
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
      const r = await api.pedir<{ permisoIa: boolean }>('POST', '/datos/camila/permiso-ia', {
        acepto,
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
      <Text style={{ color: '#666B73', fontSize: 13, lineHeight: 18 }}>{t.ajusteAyuda}</Text>
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
