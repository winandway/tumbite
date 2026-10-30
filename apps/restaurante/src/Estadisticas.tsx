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
  /** C-RENDIMIENTO-REST (últimos 30 días, en la hora del restaurante). */
  porHora?: { pedidos: number; ventas: number }[];
  porDia?: { pedidos: number; ventas: number }[];
  clientes?: { nuevos: number; recurrentes: number; nuevosQueVolvieron: number };
  canceladosMes?: number;
  /** C-PRECISION-PEDIDOS: quejas de plato faltante, equivocado o dañado y lo devuelto (30 días). */
  pedidosConProblemasMes?: number;
  precisionPct?: number | null;
  reembolsosMes?: { cantidad: number; monto: number };
};
type Resumen = { entregados: number; ventas: number; neto: number };

const TR = {
  es: {
    porHora: 'Pedidos por hora (últimos 30 días)',
    porDia: 'Pedidos por día (últimos 30 días)',
    dias: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
    clientes: 'Clientes (últimos 30 días)',
    nuevos: 'Nuevos',
    repiten: 'Repiten',
    cancelados: 'Cancelados',
    precision: 'Pedidos sin problemas',
    conProblemas: 'Con problemas',
    reembolsos: 'Reembolsado',
  },
  en: {
    porHora: 'Orders by hour (last 30 days)',
    porDia: 'Orders by day (last 30 days)',
    dias: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    clientes: 'Customers (last 30 days)',
    nuevos: 'New',
    repiten: 'Returning',
    cancelados: 'Canceled',
    precision: 'Orders without issues',
    conProblemas: 'With issues',
    reembolsos: 'Refunded',
  },
};

/** Barras simples en vista nativa (sin librerías): la más alta llena el alto. */
function Barras({ valores, etiquetas }: { valores: number[]; etiquetas: string[] }) {
  const max = Math.max(1, ...valores);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 110 }}>
      {valores.map((v, i) => (
        <View key={etiquetas.at(i) ?? String(i)} style={{ flex: 1, alignItems: 'center' }}>
          <View
            accessibilityLabel={`${etiquetas.at(i) ?? String(i)}: ${v}`}
            style={{
              width: '100%',
              height: Math.max(2, Math.round((v / max) * 86)),
              borderRadius: 3,
              backgroundColor: v ? C.secundario : '#E6E7EA',
            }}
          />
          <Text style={{ fontSize: 10, color: '#5E5E5E', marginTop: 3 }}>
            {etiquetas.at(i) ?? String(i)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Estadísticas (diseño aprobado, pantalla 8): Hoy, Semana y Mes con ventas, pedidos, ticket
 * promedio y lo que le queda al restaurante. Son los mismos datos del tablero del panel web.
 * C-RENDIMIENTO-REST (29 oct 2026): horas y días fuertes, clientes nuevos y que repiten, y
 * cancelados, como el «Performance» de DoorDash Merchant.
 */
export function Estadisticas() {
  const { api, idioma } = useSesion();
  const t = textosRest(idioma);
  const tr = idioma === 'en' ? TR.en : TR.es;
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
          {tablero.porHora && tablero.porHora.some((h) => h.pedidos) ? (
            <Tarjeta>
              <Text
                style={{ fontWeight: '900', fontSize: 16, color: C.secundario, marginBottom: 8 }}
              >
                {tr.porHora}
              </Text>
              {(() => {
                const conPedidos = tablero.porHora
                  .map((h, i) => (h.pedidos ? i : -1))
                  .filter((i) => i >= 0);
                const desde = Math.min(...conPedidos);
                const hasta = Math.max(...conPedidos);
                const horas = tablero.porHora.slice(desde, hasta + 1);
                return (
                  <Barras
                    valores={horas.map((h) => h.pedidos)}
                    etiquetas={horas.map((_, i) => String(desde + i))}
                  />
                );
              })()}
            </Tarjeta>
          ) : null}
          {tablero.porDia && tablero.porDia.some((h) => h.pedidos) ? (
            <Tarjeta>
              <Text
                style={{ fontWeight: '900', fontSize: 16, color: C.secundario, marginBottom: 8 }}
              >
                {tr.porDia}
              </Text>
              <Barras valores={tablero.porDia.map((d) => d.pedidos)} etiquetas={tr.dias} />
            </Tarjeta>
          ) : null}
          {tablero.clientes ? (
            <Tarjeta>
              <Text
                style={{ fontWeight: '900', fontSize: 16, color: C.secundario, marginBottom: 8 }}
              >
                {tr.clientes}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {(
                  [
                    [tr.nuevos, tablero.clientes.nuevos],
                    [
                      tr.repiten,
                      tablero.clientes.recurrentes + tablero.clientes.nuevosQueVolvieron,
                    ],
                    [tr.cancelados, tablero.canceladosMes ?? 0],
                    [tr.conProblemas, tablero.pedidosConProblemasMes ?? 0],
                  ] as const
                ).map(([nombre, n]) => (
                  <View key={nombre} style={{ flex: 1 }}>
                    <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{nombre}</Text>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>
                      {n}
                    </Text>
                  </View>
                ))}
              </View>
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
