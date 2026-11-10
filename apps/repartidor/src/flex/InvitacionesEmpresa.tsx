import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ErrorApi, enIdioma } from '@tumbite/compartido';
import { Boton, C, e, useSesion } from '@tumbite/movil';

/**
 * C-FLEX-INVITAR-CONDUCTOR (1 nov 2026, como Onfleet y Spoke): la empresa invitó a este conductor
 * por su celular o su correo; aquí la ve y la acepta. Desde ese momento, las rutas de esa empresa
 * le llegan a «Mi ruta (paquetes)».
 */
const T = {
  es: {
    titulo: (empresa: string) => `${empresa} te invitó a repartir sus paquetes`,
    ayuda: 'Al aceptar, las rutas de esta empresa te llegan a «Mi ruta (paquetes)».',
    aceptar: 'Aceptar',
    rechazar: 'Ahora no',
    listo: (empresa: string) => `Listo: ya trabajas con ${empresa}.`,
    tengoEnlace: '¿Una empresa o un restaurante te invitó? Pega su enlace',
    enlace: 'Enlace de la invitación',
    usarEnlace: 'Aceptar con este enlace',
  },
  en: {
    titulo: (empresa: string) => `${empresa} invited you to deliver its packages`,
    ayuda: 'Once you accept, this company’s routes arrive in “My route (packages).”',
    aceptar: 'Accept',
    rechazar: 'Not now',
    listo: (empresa: string) => `Done: you now work with ${empresa}.`,
    tengoEnlace: 'Did a company or a restaurant invite you? Paste its link',
    enlace: 'Invitation link',
    usarEnlace: 'Accept with this link',
  },
};

type Invitacion = { id: string; empresa: string };

export function InvitacionesEmpresa({ alAceptar }: { alAceptar: (aviso: string) => void }) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [lista, setLista] = useState<Invitacion[]>([]);
  const [error, setError] = useState('');
  const [conEnlace, setConEnlace] = useState(false);
  const [enlace, setEnlace] = useState('');
  const cargar = useCallback(() => {
    api
      .pedir<{ invitaciones: Invitacion[] }>('GET', '/datos/v1/flex/conductor/invitaciones')
      .then((r) => setLista(r.invitaciones))
      .catch(() => undefined);
  }, [api]);
  useEffect(cargar, [cargar]);

  async function responder(i: Invitacion, respuesta: 'aceptar' | 'rechazar') {
    setError('');
    try {
      await api.pedir('POST', `/datos/v1/flex/conductor/invitaciones/${i.id}/${respuesta}`, {});
      if (respuesta === 'aceptar') alAceptar(t.listo(i.empresa));
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  // Si su cuenta de Driver tiene otro celular o correo (en Divoox una cuenta tiene un solo papel),
  // acepta con el enlace que le mandó la empresa.
  async function aceptarConEnlace() {
    setError('');
    // C-FLOTA-PROPIA: el mismo recuadro sirve para el enlace de un restaurante (/driver/fleet/…).
    const deFlota = /\/driver\/fleet\/([A-Za-z0-9_-]{30,60})/.exec(enlace)?.[1];
    const token = /\/driver\/join\/([A-Za-z0-9_-]{30,60})/.exec(enlace)?.[1] ?? enlace.trim();
    try {
      const r = deFlota
        ? await api
            .pedir<{ restaurante: string }>(
              'POST',
              `/datos/repartidor/flota/enlace/${encodeURIComponent(deFlota)}/aceptar`,
              {},
            )
            .then((x) => ({ empresa: x.restaurante }))
        : await api.pedir<{ empresa: string }>(
            'POST',
            `/datos/v1/flex/conductor/invitacion-enlace/${encodeURIComponent(token)}/aceptar`,
            {},
          );
      setEnlace('');
      setConEnlace(false);
      alAceptar(t.listo(r.empresa));
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <View testID="invitaciones-empresa" style={{ gap: 8 }}>
      {!lista.length ? (
        conEnlace ? (
          <View style={[e.tarjeta, { gap: 8 }]}>
            <TextInput
              value={enlace}
              onChangeText={setEnlace}
              placeholder="https://divoox.com/driver/join/…"
              autoCapitalize="none"
              autoCorrect={false}
              style={e.input}
              accessibilityLabel={t.enlace}
            />
            <Boton texto={t.usarEnlace} logistica alTocar={() => void aceptarConEnlace()} />
          </View>
        ) : (
          // Con aire arriba: debajo va el mapa del inicio y antes quedaba montado sobre su borde.
          <Pressable
            accessibilityRole="button"
            onPress={() => setConEnlace(true)}
            hitSlop={8}
            style={{ marginTop: 16, paddingVertical: 4 }}
          >
            <Text style={{ color: '#5E5E5E', fontWeight: '600', textDecorationLine: 'underline' }}>
              {t.tengoEnlace}
            </Text>
          </Pressable>
        )
      ) : null}
      {lista.map((i) => (
        <View key={i.id} style={[e.tarjeta, { borderWidth: 2, borderColor: C.logistica }]}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{t.titulo(i.empresa)}</Text>
          <Text style={{ color: '#5E5E5E', fontSize: 13, marginVertical: 6 }}>{t.ayuda}</Text>
          <View style={{ gap: 8 }}>
            <Boton texto={t.aceptar} logistica alTocar={() => void responder(i, 'aceptar')} />
            <Boton texto={t.rechazar} secundario alTocar={() => void responder(i, 'rechazar')} />
          </View>
        </View>
      ))}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '600' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
