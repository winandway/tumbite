import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import type { Api, Idioma } from '@tumbite/compartido';
import { C, e } from '@tumbite/movil';
import { textosGrandes } from './textos';

type Datos = {
  clientes: { promedio: number | null; cuantas: number; minimo: number };
  aceptacion: { porcentaje: number | null; de: number };
  finalizacion: { porcentaje: number | null; de: number; minimo: number };
  puntualidad: { porcentaje: number | null; de: number };
  entregas30Dias: number;
  entregasTotales: number;
};

/** Pestaña Ratings de Dasher: lo que el cliente califica, ahora visible para el repartidor. */
export function Calificaciones({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = textosGrandes(idioma).calif;
  const [d, setD] = useState<Datos | null>(null);
  useEffect(() => {
    let vivo = true;
    void api
      .pedir<Datos>('GET', '/datos/repartidor/calificaciones')
      .then((r) => {
        if (vivo) setD(r);
      })
      .catch((x: unknown) => console.warn('calificaciones', x));
    return () => {
      vivo = false;
    };
  }, [api]);
  const fila = (
    nombre: string,
    valor: string,
    ayuda: string,
    referencia: string,
    bien: boolean | null,
  ) => (
    <View key={nombre} style={e.tarjeta}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '800', color: C.secundario, fontSize: 16 }}>{nombre}</Text>
        <Text
          style={{
            fontWeight: '900',
            fontSize: 22,
            color: bien == null ? C.secundario : bien ? C.exito : C.primario,
          }}
        >
          {valor}
        </Text>
      </View>
      <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: 4 }}>{ayuda}</Text>
      <Text style={{ color: '#8A8A8A', fontSize: 12, marginTop: 2 }}>
        {t.referencia}: {referencia}
      </Text>
    </View>
  );
  return (
    <View style={{ padding: 16, gap: 12 }} testID="calificaciones">
      <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>{t.titulo}</Text>
      {!d ? null : d.entregasTotales === 0 && d.aceptacion.de === 0 ? (
        <Text style={{ color: '#5E5E5E' }}>{t.sinDatos}</Text>
      ) : (
        <>
          {fila(
            t.clientes,
            d.clientes.promedio == null ? '—' : `${d.clientes.promedio.toFixed(1)} ★`,
            `${t.clientesAyuda} (${d.clientes.cuantas} ${t.calificadas})`,
            t.minimoEstrellas,
            d.clientes.promedio == null ? null : d.clientes.promedio >= d.clientes.minimo,
          )}
          {fila(
            t.aceptacion,
            d.aceptacion.porcentaje == null ? '—' : `${d.aceptacion.porcentaje} %`,
            `${t.aceptacionAyuda} (${d.aceptacion.de})`,
            t.sinMinimo,
            null,
          )}
          {fila(
            t.finalizacion,
            d.finalizacion.porcentaje == null ? '—' : `${d.finalizacion.porcentaje} %`,
            `${t.finalizacionAyuda} (${d.finalizacion.de})`,
            t.minimoFinalizacion,
            d.finalizacion.porcentaje == null
              ? null
              : d.finalizacion.porcentaje >= d.finalizacion.minimo,
          )}
          {fila(
            t.puntualidad,
            d.puntualidad.porcentaje == null ? '—' : `${d.puntualidad.porcentaje} %`,
            `${t.puntualidadAyuda} (${d.puntualidad.de})`,
            t.sinMinimo,
            null,
          )}
          <View style={[e.tarjeta, { flexDirection: 'row' }]}>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontWeight: '900', fontSize: 22, color: C.secundario }}>
                {d.entregas30Dias}
              </Text>
              <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.treinta}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontWeight: '900', fontSize: 22, color: C.secundario }}>
                {d.entregasTotales}
              </Text>
              <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.totales}</Text>
            </View>
          </View>
        </>
      )}
    </View>
  );
}
