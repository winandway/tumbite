import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { type Idioma, enIdioma } from '@tumbite/compartido';
import { C } from '@tumbite/movil';

const T = {
  es: {
    titulo: 'Entra para pedir',
    detalle: 'Mira restaurantes y menús sin cuenta. Para pagar, entra o crea tu cuenta.',
    entrar: 'Entrar',
    crear: '¿Eres nuevo? Crea tu cuenta',
  },
  en: {
    titulo: 'Sign in to order',
    detalle: 'Browse restaurants and menus without an account. To pay, sign in or create one.',
    entrar: 'Sign in',
    crear: 'New here? Create your account',
  },
};

/**
 * C-MIRAR-SIN-CUENTA: en la portada, quien mira sin cuenta tiene a mano «Entrar» y «¿Eres nuevo?
 * Crea tu cuenta» (como DoorDash). Al entrar vuelve a la portada.
 */
export function EntrarInvitado({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  return (
    <View
      testID="entrar-invitado"
      style={{
        marginHorizontal: 16,
        marginVertical: 8,
        padding: 14,
        gap: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#2a2a2a',
        backgroundColor: '#fff',
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 16, color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E' }}>{t.detalle}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/sign-in')}
          style={{
            backgroundColor: C.primario,
            borderRadius: 10,
            paddingVertical: 10,
            paddingHorizontal: 18,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>{t.entrar}</Text>
        </Pressable>
        <Text
          accessibilityRole="link"
          onPress={() => router.push('/sign-in?crear=1')}
          style={{ color: C.secundario, fontWeight: '700', textDecorationLine: 'underline' }}
        >
          {t.crear}
        </Text>
      </View>
    </View>
  );
}
