import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
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
  },
  en: {
    titulo: (empresa: string) => `${empresa} invited you to deliver its packages`,
    ayuda: 'Once you accept, this company’s routes arrive in “My route (packages).”',
    aceptar: 'Accept',
    rechazar: 'Not now',
    listo: (empresa: string) => `Done: you now work with ${empresa}.`,
  },
};

type Invitacion = { id: string; empresa: string };

export function InvitacionesEmpresa({ alAceptar }: { alAceptar: (aviso: string) => void }) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [lista, setLista] = useState<Invitacion[]>([]);
  const [error, setError] = useState('');
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

  if (!lista.length) return null;
  return (
    <View testID="invitaciones-empresa" style={{ gap: 8 }}>
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
