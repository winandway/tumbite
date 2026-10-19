import { useEffect, useState } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { ErrorApi, formatearMonto, nombrePlato } from '@tumbite/compartido';
import { C, e, useSesion } from '@tumbite/movil';
import { Pildora, Tarjeta } from './piezas/ui';
import { textosRest } from './piezas/textos';

type Periodo = { pedidos: number; ventas: number; neto: number; ticketPromedio: number };
type Tablero = {
  /** C-MONEDA-RECORRIDO: la moneda del restaurante (todas las cifras van en ella). */
  moneda?: string;
  semana: Periodo;
  mes: Periodo;
  topPlatos: { nombreEs: string; nombreEn: string; cantidad: number }[];
  minutosCocina: number | null;
  minutosPrometidos: number | null;
  calificacion: number | null;
  calificaciones: number;
};
type Resumen = { entregados: number; ventas: number; neto: number };

/**
 * Estadísticas (diseño aprobado, pantalla 8): Hoy, Semana y Mes con ventas, pedidos, ticket
 * promedio y lo que le queda al restaurante. Son los mismos datos del tablero del panel web.
 * La gráfica por hora no se dibuja: el servidor todavía no la entrega.
 */
export function Estadisticas() {
  const { api, idioma } = useSesion();
  const t = textosRest(idioma);
  const ancho = useWindowDimensions().width;
  const [periodo, setPeriodo] = useState<'hoy' | 'semana' | 'mes'>('hoy');
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [hoy, setHoy] = useState<Resumen | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.pedir<{ tablero: Tablero }>('GET', '/datos/restaurante/tablero'),
      api.pedir<{ resumen: Resumen }>('GET', '/datos/restaurante/resumen'),
    ])
      .then(([a, b]) => {
        setTablero(a.tablero);
        setHoy(b.resumen);
      })
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api]);

  const d = (c: number) => formatearMonto(c, tablero?.moneda ?? 'USD', idioma);
  const datos: Periodo | null =
    periodo === 'hoy'
      ? hoy
        ? {
            pedidos: hoy.entregados,
            ventas: hoy.ventas,
            neto: hoy.neto,
            ticketPromedio: hoy.entregados ? Math.round(hoy.ventas / hoy.entregados) : 0,
          }
        : null
      : periodo === 'semana'
        ? (tablero?.semana ?? null)
        : (tablero?.mes ?? null);
  const cifras: [string, string][] = datos
    ? [
        [t.ventas, d(datos.ventas)],
        [t.pedidos, String(datos.pedidos)],
        [t.ticket, d(datos.ticketPromedio)],
        [t.neto, d(datos.neto)],
      ]
    : [];
  const columnas = ancho >= 700 ? 4 : 2;

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {(
          [
            ['hoy', t.hoy],
            ['semana', t.semana],
            ['mes', t.mes],
          ] as const
        ).map(([p, nombre]) => (
          <View key={p} style={{ flex: 1 }}>
            <Pildora texto={nombre} activa={periodo === p} alTocar={() => setPeriodo(p)} />
          </View>
        ))}
      </View>
      {error ? <Text style={e.error}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {cifras.map(([nombre, valor]) => (
          <View key={nombre} style={{ width: `${100 / columnas - 3}%` }}>
            <Tarjeta style={{ marginBottom: 0 }}>
              <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{nombre}</Text>
              <Text style={{ fontSize: 26, fontWeight: '900', color: C.secundario, marginTop: 4 }}>
                {valor}
              </Text>
            </Tarjeta>
          </View>
        ))}
      </View>
      {tablero ? (
        <View style={{ marginTop: 14 }}>
          {tablero.topPlatos.length ? (
            <Tarjeta>
              <Text
                style={{ fontWeight: '900', fontSize: 16, color: C.secundario, marginBottom: 8 }}
              >
                {t.topPlatos}
              </Text>
              {tablero.topPlatos.map((p, i) => {
                const max = tablero.topPlatos[0]?.cantidad || 1;
                return (
                  <View key={`${p.nombreEs}-${i}`} style={{ marginVertical: 5 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: C.secundario }}>{nombrePlato(p, idioma)}</Text>
                      <Text style={{ fontWeight: '800', color: C.secundario }}>{p.cantidad}</Text>
                    </View>
                    <View
                      style={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: '#F2F3F5',
                        marginTop: 4,
                      }}
                    >
                      <View
                        style={{
                          width: `${Math.round((p.cantidad / max) * 100)}%`,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: C.primario,
                        }}
                      />
                    </View>
                  </View>
                );
              })}
            </Tarjeta>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {tablero.calificacion != null ? (
              <Tarjeta style={{ flex: 1 }}>
                <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.calificacion}</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: C.secundario }}>
                  {tablero.calificacion} ★
                </Text>
                <Text style={{ color: '#5E5E5E', fontSize: 12 }}>
                  {tablero.calificaciones} {t.opiniones}
                </Text>
              </Tarjeta>
            ) : null}
            {tablero.minutosCocina != null ? (
              <Tarjeta style={{ flex: 1 }}>
                <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.cocinaReal}</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: C.secundario }}>
                  {tablero.minutosCocina} min
                </Text>
                {tablero.minutosPrometidos != null ? (
                  <Text style={{ color: '#5E5E5E', fontSize: 12 }}>
                    {tablero.minutosPrometidos} min {t.prometido}
                  </Text>
                ) : null}
              </Tarjeta>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}
