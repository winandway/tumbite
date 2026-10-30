import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import {
  type CalificacionPublica,
  type Idioma,
  deSqlUtc,
  textoCalificacion,
} from '@tumbite/compartido';
import { C, useSesion } from '@tumbite/movil';

/**
 * C-CALIFICACION-PUBLICA: «★ 4.7 (120)» o «Nuevo» en las tarjetas y la ficha del restaurante, como
 * DoorDash y Uber Eats. `claro` es para escribir sobre la foto.
 */
export function Calificacion({
  c,
  idioma,
  claro,
}: {
  c: CalificacionPublica | null | undefined;
  idioma: Idioma;
  claro?: boolean;
}) {
  const color = claro ? '#fff' : C.secundario;
  return (
    <Text
      testID="calificacion-restaurante"
      accessibilityLabel={
        c
          ? idioma === 'en'
            ? `Rated ${c.promedio.toFixed(1)} out of 5, ${c.total} ratings`
            : `Calificación ${c.promedio.toFixed(1)} de 5, ${c.total} opiniones`
          : textoCalificacion(null, idioma)
      }
      style={{ fontSize: 13, fontWeight: '700', color }}
      numberOfLines={1}
    >
      {c ? <Text style={{ color: claro ? '#fff' : C.primario }}>★ </Text> : null}
      {textoCalificacion(c, idioma)}
    </Text>
  );
}

type Resena = {
  cliente: string;
  estrellas: number;
  comentario: string;
  respuesta: string | null;
  fecha: string;
};

/** Las reseñas en la ficha (solo si el restaurante tiene 10 opiniones o más). */
export function ResenasRestaurante({ restauranteId }: { restauranteId: string }) {
  const { api, idioma } = useSesion();
  const [datos, setDatos] = useState<{
    calificacion: CalificacionPublica | null;
    resenas: Resena[];
  } | null>(null);
  useEffect(() => {
    api
      .pedir<{ calificacion: CalificacionPublica | null; resenas: Resena[] }>(
        'GET',
        `/datos/restaurantes/${restauranteId}/resenas`,
      )
      .then(setDatos)
      .catch(() => setDatos(null));
  }, [api, restauranteId]);
  if (!datos?.calificacion || !datos.resenas.length) return null;
  const fecha = (s: string) =>
    deSqlUtc(s).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-ES', {
      day: 'numeric',
      month: 'short',
    });
  return (
    <View testID="resenas-restaurante" style={{ marginTop: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text
          accessibilityRole="header"
          style={{ fontSize: 20, fontWeight: '900', color: C.secundario }}
        >
          {idioma === 'en' ? 'Ratings & reviews' : 'Calificaciones y reseñas'}
        </Text>
        <Calificacion c={datos.calificacion} idioma={idioma} />
      </View>
      {datos.resenas.slice(0, 5).map((r, i) => (
        <View
          key={`${r.fecha}-${i}`}
          style={{
            marginTop: 10,
            padding: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#e6e6e6',
            backgroundColor: '#fff',
          }}
        >
          <Text style={{ fontWeight: '800', color: C.secundario }}>
            {r.cliente} <Text style={{ color: C.primario }}>{'★'.repeat(r.estrellas)}</Text>
            <Text style={{ color: '#9a9a9a', fontWeight: '400' }}> · {fecha(r.fecha)}</Text>
          </Text>
          <Text style={{ color: '#333', marginTop: 4 }}>{r.comentario}</Text>
          {r.respuesta ? (
            <Text style={{ color: '#5E5E5E', marginTop: 6, fontSize: 13 }}>
              <Text style={{ fontWeight: '800' }}>
                {idioma === 'en' ? 'Restaurant reply: ' : 'Respuesta del restaurante: '}
              </Text>
              {r.respuesta}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
