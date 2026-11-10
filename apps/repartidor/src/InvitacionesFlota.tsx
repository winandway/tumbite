import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ErrorApi, enIdioma } from '@tumbite/compartido';
import { Boton, C, e, useSesion } from '@tumbite/movil';

/**
 * C-FLOTA-PROPIA (10 nov 2026) — Chile y todos los países. El restaurante invitó a este repartidor
 * a su equipo: aquí lo ve y lo acepta. Desde ese momento recibe solo los pedidos de ese restaurante
 * (mientras el restaurante trabaje con sus propios repartidores).
 */
const T = {
  es: {
    titulo: (r: string) => `${r} te invitó a su equipo de reparto`,
    ayuda: 'Al aceptar, te llegan solo los pedidos de este restaurante.',
    aceptar: 'Aceptar',
    rechazar: 'Ahora no',
    listo: (r: string) => `Listo: ya repartes para ${r}.`,
    miFlota: (r: string) => `Repartes para ${r}`,
    exclusiva: 'Te llegan solo los pedidos de este restaurante.',
    salir: 'Salir de este equipo',
  },
  en: {
    titulo: (r: string) => `${r} invited you to its delivery team`,
    ayuda: 'Once you accept, you only get this restaurant’s orders.',
    aceptar: 'Accept',
    rechazar: 'Not now',
    listo: (r: string) => `Done: you now deliver for ${r}.`,
    miFlota: (r: string) => `You deliver for ${r}`,
    exclusiva: 'You only get this restaurant’s orders.',
    salir: 'Leave this team',
  },
};

type Invitacion = { id: string; restaurante: string };
type MiFlota = { restaurante: string; exclusiva: boolean } | null;

export function InvitacionesFlota({ alAceptar }: { alAceptar: (aviso: string) => void }) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [lista, setLista] = useState<Invitacion[]>([]);
  const [flota, setFlota] = useState<MiFlota>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    api
      .pedir<{ flota: MiFlota; invitaciones: Invitacion[] }>('GET', '/datos/repartidor/flota')
      .then((r) => {
        setLista(r.invitaciones ?? []);
        setFlota(r.flota ?? null);
      })
      .catch(() => undefined);
  }, [api]);
  useEffect(cargar, [cargar]);

  async function responder(i: Invitacion, respuesta: 'aceptar' | 'rechazar') {
    setError('');
    try {
      await api.pedir('POST', `/datos/repartidor/flota/invitaciones/${i.id}/${respuesta}`, {});
      if (respuesta === 'aceptar') alAceptar(t.listo(i.restaurante));
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (!lista.length && !flota && !error) return null;
  return (
    <View testID="invitaciones-flota" style={{ gap: 8 }}>
      {flota ? (
        <View style={e.tarjeta} testID="mi-flota">
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{t.miFlota(flota.restaurante)}</Text>
          {flota.exclusiva ? (
            <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: 4 }}>{t.exclusiva}</Text>
          ) : null}
        </View>
      ) : null}
      {lista.map((i) => (
        <View key={i.id} style={[e.tarjeta, { borderWidth: 1, borderColor: '#2a2a2a' }]}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{t.titulo(i.restaurante)}</Text>
          <Text style={{ color: '#5E5E5E', fontSize: 13, marginVertical: 6 }}>{t.ayuda}</Text>
          <View style={{ gap: 8 }}>
            <Boton texto={t.aceptar} exito alTocar={() => void responder(i, 'aceptar')} />
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
