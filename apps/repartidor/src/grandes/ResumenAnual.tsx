import { useEffect, useState } from 'react';
import { Share, Text, View } from 'react-native';
import {
  type Api,
  type Idioma,
  type MesResumen,
  csvResumenAnual,
  enIdioma,
  formatearMonto,
} from '@tumbite/compartido';
import { Boton, C, e } from '@tumbite/movil';

const T = {
  es: {
    titulo: 'Tu año',
    ayuda:
      'Entregas, distancia y lo que ganaste por mes. La distancia es una estimación: del restaurante a la dirección del cliente, en línea recta. Para tus impuestos, lleva también tu propio registro de millas.',
    entrega: 'entrega',
    entregas: 'entregas',
    millas: 'millas',
    compartir: 'Compartir para mi contador (CSV)',
    sin: 'Todavía no hay entregas este año.',
  },
  en: {
    titulo: 'Your year',
    ayuda:
      'Deliveries, distance and what you earned each month. The distance is an estimate: from the restaurant to the customer’s address, in a straight line. For taxes, keep your own mileage log too.',
    entrega: 'delivery',
    entregas: 'deliveries',
    millas: 'miles',
    compartir: 'Share with my accountant (CSV)',
    sin: 'No deliveries this year yet.',
  },
};

/** C-RESUMEN-ANUAL: el resumen del año, como el de Dasher, con el CSV para el contador. */
export function ResumenAnual({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [d, setD] = useState<{
    anio: number;
    meses: MesResumen[];
    total: { entregas: number; millas: number };
  } | null>(null);
  useEffect(() => {
    let vivo = true;
    void api
      .pedir<NonNullable<typeof d>>('GET', '/datos/repartidor/resumen-anual')
      .then((r) => {
        if (vivo) setD(r);
      })
      .catch((x: unknown) => console.warn('resumen anual', x));
    return () => {
      vivo = false;
    };
  }, [api]);
  if (!d) return null;
  const mesNombre = (m: string) =>
    new Date(`${m}-15T12:00:00Z`).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-US', {
      month: 'long',
    });
  return (
    <View style={e.tarjeta} testID="resumen-anual">
      <Text style={{ fontWeight: '800', fontSize: 17 }}>
        {t.titulo} {d.anio}
      </Text>
      <Text style={{ color: '#5E5E5E', marginVertical: 6 }}>{t.ayuda}</Text>
      {d.meses.length === 0 ? <Text style={{ color: '#5E5E5E' }}>{t.sin}</Text> : null}
      {d.meses.map((m) => (
        <View
          key={m.mes}
          style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}
        >
          <Text style={{ fontWeight: '700', textTransform: 'capitalize' }}>{mesNombre(m.mes)}</Text>
          <Text style={{ color: '#5E5E5E' }}>
            {m.entregas} {m.entregas === 1 ? t.entrega : t.entregas} · {m.millas} {t.millas}
          </Text>
          <Text style={{ fontWeight: '700', color: C.secundario }}>
            {m.ganado.map((g) => formatearMonto(g.total, g.moneda, idioma)).join(' · ')}
          </Text>
        </View>
      ))}
      {d.meses.length ? (
        <Boton
          texto={t.compartir}
          secundario
          alTocar={() =>
            void Share.share({ message: csvResumenAnual(d.meses, idioma) }).catch(() => undefined)
          }
        />
      ) : null}
    </View>
  );
}
