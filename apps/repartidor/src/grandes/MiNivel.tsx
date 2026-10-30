import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { type Api, type Idioma, enIdioma } from '@tumbite/compartido';
import { C, e } from '@tumbite/movil';

/**
 * C-REWARDS-MI-NIVEL (30 oct 2026, R2): el puntaje explicado, como «Ratings» de Dasher: cada parte
 * con lo que suma, la experiencia por servicio y el avance al próximo premio.
 */
const T = {
  es: {
    titulo: 'Cómo se forma tu puntaje',
    componentes: {
      finalizacion: ['Entregas completadas', 'Las que terminas de las que aceptas.'],
      puntualidad: ['Puntualidad', 'Las que llegan a tiempo.'],
      calidad: ['Pedidos sin problemas', 'Sin faltantes, daños ni errores tuyos.'],
      satisfaccion: ['Calificación de clientes', 'Tus estrellas de las últimas entregas.'],
      aceptacion: ['Ofertas aceptadas', 'Las ofertas que tomas (las excusadas no cuentan).'],
    },
    experiencia: 'Tu experiencia',
    servicios: {
      comida: 'Comida',
      tiendas: 'Tiendas',
      express: 'Viajes y envíos',
      flexPaquetes: 'Paquetes Flex',
    },
    hito: (a: number, b: number) => `Próximo premio: ${a} de ${b} entregas que cuentan`,
    riesgo: 'Cuidado: tu finalización o tus estrellas están por debajo del mínimo.',
  },
  en: {
    titulo: 'How your score is built',
    componentes: {
      finalizacion: ['Completed deliveries', 'The ones you finish out of those you accept.'],
      puntualidad: ['On time', 'The ones that arrive on time.'],
      calidad: ['Problem-free orders', 'No missing items, damage or mistakes on your side.'],
      satisfaccion: ['Customer rating', 'Your stars from your latest deliveries.'],
      aceptacion: ['Offers accepted', 'The offers you take (excused ones don’t count).'],
    },
    experiencia: 'Your experience',
    servicios: {
      comida: 'Food',
      tiendas: 'Stores',
      express: 'Rides and sends',
      flexPaquetes: 'Flex packages',
    },
    hito: (a: number, b: number) => `Next reward: ${a} of ${b} deliveries that count`,
    riesgo: 'Careful: your completion or your stars are below the minimum.',
  },
};

type Detalle = {
  elegibilidad: string;
  componentes: Record<string, { puntos: number; maximo: number }>;
  experiencia: Record<string, number>;
  hito: { meta: number; contadas: number } | null;
};

export function MiNivel({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<Detalle | null>(null);
  useEffect(() => {
    let vivo = true;
    void api
      .pedir<Detalle>('GET', '/datos/repartidor/mi-nivel')
      .then((r) => {
        if (vivo) setD(r);
      })
      .catch((x: unknown) => console.warn('mi nivel', x));
    return () => {
      vivo = false;
    };
  }, [api]);
  if (!d) return null;
  const nombres = new Map(Object.entries(t.componentes));
  const servicios = new Map(Object.entries(t.servicios));
  return (
    <View style={e.tarjeta} testID="mi-nivel">
      <Text style={{ fontWeight: '800', marginBottom: 6 }}>{t.titulo}</Text>
      {d.elegibilidad === 'en_riesgo' ? (
        <Text style={{ color: C.primario, marginBottom: 6 }}>{t.riesgo}</Text>
      ) : null}
      {Object.entries(d.componentes).map(([k, c]) => {
        const [nombre, ayuda] = nombres.get(k) ?? [k, ''];
        return (
          <View key={k} style={{ marginBottom: 8 }}>
            <Text style={{ fontWeight: '600' }}>
              {nombre}: {c.puntos.toFixed(1)} / {c.maximo}
            </Text>
            <Text style={{ color: '#5E5E5E' }}>{ayuda}</Text>
          </View>
        );
      })}
      <Text style={{ fontWeight: '800', marginTop: 4 }}>{t.experiencia}</Text>
      {Object.entries(d.experiencia)
        .filter(([k, n]) => servicios.has(k) && n > 0)
        .map(([k, n]) => (
          <Text key={k}>
            {servicios.get(k)}: {n}
          </Text>
        ))}
      {d.hito ? (
        <Text style={{ marginTop: 8, color: C.exito, fontWeight: '600' }}>
          {t.hito(d.hito.contadas, d.hito.meta)}
        </Text>
      ) : null}
    </View>
  );
}
