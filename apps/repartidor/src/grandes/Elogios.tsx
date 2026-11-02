import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { type Api, type Idioma } from '@tumbite/compartido';
import { C, e } from '@tumbite/movil';

export type Elogio = { etiqueta: string; n: number; es: string; en: string };

const T = {
  es: {
    titulo: 'Tus elogios',
    ayuda: 'Lo que los clientes destacaron al darte 5 estrellas.',
    vacio: 'Todavía no tienes elogios. Llegan con las entregas de 5 estrellas.',
  },
  en: {
    titulo: 'Your compliments',
    ayuda: 'What customers highlighted when they gave you 5 stars.',
    vacio: 'No compliments yet. They come with your 5-star deliveries.',
  },
};

/**
 * C-ELOGIOS-MOTIVOS (BRE-3): el conteo de los elogios del repartidor, del más elegido al menos,
 * como el perfil de Uber Eats. Los motivos de las malas notas no se muestran aquí (solo al equipo).
 * Si no recibe la lista, la pide al servidor (así la usa «Mi nivel»).
 */
export function Elogios({
  api,
  elogios,
  idioma,
}: {
  api?: Api;
  elogios?: Elogio[];
  idioma: Idioma;
}) {
  const t = idioma === 'en' ? T.en : T.es;
  const [pedida, setPedida] = useState<Elogio[] | null>(null);
  useEffect(() => {
    if (elogios || !api) return;
    let vivo = true;
    void api
      .pedir<{ elogios?: Elogio[] }>('GET', '/datos/repartidor/calificaciones')
      .then((r) => {
        if (vivo) setPedida(r.elogios ?? []);
      })
      .catch((x: unknown) => console.warn('elogios', x));
    return () => {
      vivo = false;
    };
  }, [api, elogios]);
  const lista = elogios ?? pedida;
  if (!lista) return null;
  return (
    <View style={[e.tarjeta, { gap: 8 }]} testID="elogios">
      <Text style={{ fontWeight: '800', fontSize: 17, color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{lista.length ? t.ayuda : t.vacio}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {lista.map((x) => (
          <View
            key={x.etiqueta}
            style={{
              flexDirection: 'row',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#D9D9D9',
            }}
          >
            <Text style={{ color: C.secundario, fontWeight: '700' }}>
              {idioma === 'en' ? x.en : x.es}
            </Text>
            <Text style={{ color: C.exito, fontWeight: '800' }}>{x.n}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
