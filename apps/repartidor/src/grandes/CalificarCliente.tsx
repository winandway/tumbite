import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type Api, ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { C, e } from '@tumbite/movil';

/**
 * C-CALIFICA-CLIENTE (29 oct 2026), como Uber: el repartidor califica al cliente de sus entregas
 * de hoy. Es opcional, solo lo ve soporte y no bloquea a nadie.
 */
type Pendiente = { pedidoId: string; cliente: string; entregadoEn: string };

const T = {
  es: {
    titulo: 'Califica a tus clientes de hoy',
    ayuda: 'Es opcional y solo lo ve nuestro equipo de soporte.',
    motivo: '¿Qué pasó?',
    motivos: {
      no_salio: 'No salió a recibir',
      direccion: 'Dirección equivocada',
      trato: 'Mal trato',
      espera: 'Me hizo esperar',
    } as Record<string, string>,
    enviar: 'Enviar',
    gracias: '¡Gracias!',
  },
  en: {
    titulo: 'Rate today’s customers',
    ayuda: 'It’s optional and only our support team sees it.',
    motivo: 'What happened?',
    motivos: {
      no_salio: 'Didn’t come out',
      direccion: 'Wrong address',
      trato: 'Rude',
      espera: 'Made me wait',
    } as Record<string, string>,
    enviar: 'Send',
    gracias: 'Thanks!',
  },
};

function Una({
  p,
  api,
  idioma,
  alListo,
}: {
  p: Pendiente;
  api: Api;
  idioma: Idioma;
  alListo: () => void;
}) {
  const t = enIdioma(T, idioma);
  const [estrellas, setEstrellas] = useState(0);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  async function enviar() {
    setError('');
    try {
      await api.pedir('POST', `/datos/repartidor/pedidos/${p.pedidoId}/calificar-cliente`, {
        estrellas,
        motivo: estrellas >= 4 ? '' : motivo,
      });
      alListo();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <View style={[e.tarjeta, { gap: 8 }]}>
      <Text style={{ fontWeight: '800', color: C.secundario }}>
        {p.cliente} · #{p.pedidoId.slice(0, 4).toUpperCase()}
      </Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setEstrellas(n)}
            accessibilityRole="button"
            accessibilityLabel={`${n} ★`}
            accessibilityState={{ selected: estrellas >= n }}
          >
            <Text style={{ fontSize: 28, color: estrellas >= n ? '#F5A623' : '#D6D6D6' }}>★</Text>
          </Pressable>
        ))}
      </View>
      {estrellas > 0 && estrellas < 4 ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: '#5E5E5E' }}>{t.motivo}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {Object.entries(t.motivos).map(([k, texto]) => (
              <Pressable
                key={k}
                onPress={() => setMotivo(k)}
                accessibilityRole="radio"
                accessibilityState={{ checked: motivo === k }}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 12,
                  borderWidth: motivo === k ? 2 : 1,
                  borderColor: motivo === k ? C.primario : '#DADADA',
                }}
              >
                <Text
                  style={{ color: motivo === k ? C.primario : C.secundario, fontWeight: '700' }}
                >
                  {texto}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      {error ? <Text style={e.error}>{error}</Text> : null}
      {estrellas > 0 ? (
        <Text style={e.enlace} onPress={() => void enviar()} accessibilityRole="button">
          {t.enviar}
        </Text>
      ) : null}
    </View>
  );
}

export function CalificarCliente({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [lista, setLista] = useState<Pendiente[]>([]);
  const [gracias, setGracias] = useState(false);
  const cargar = useCallback(() => {
    api
      .pedir<{ pedidos: Pendiente[] }>('GET', '/datos/repartidor/por-calificar')
      .then((r) => setLista(r.pedidos ?? []))
      .catch(() => setLista([]));
  }, [api]);
  useEffect(cargar, [cargar]);
  if (!lista.length)
    return gracias ? <Text style={{ color: C.exito, fontWeight: '700' }}>{t.gracias}</Text> : null;
  return (
    <View style={{ gap: 8 }} testID="calificar-cliente">
      <Text style={{ fontWeight: '900', fontSize: 17, color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.ayuda}</Text>
      {lista.map((p) => (
        <Una
          key={p.pedidoId}
          p={p}
          api={api}
          idioma={idioma}
          alListo={() => {
            setGracias(true);
            cargar();
          }}
        />
      ))}
    </View>
  );
}
