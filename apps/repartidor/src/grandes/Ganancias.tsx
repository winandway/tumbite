import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { type Api, type Idioma, formatearDolares } from '@tumbite/compartido';
import { C, e } from '@tumbite/movil';
import { textosGrandes } from './textos';

type PedidoGanado = {
  pedidoId: string;
  codigo: string;
  restaurante: string;
  entregadoEn: string;
  base: number;
  bono: number;
  propina: number;
  propinaPosterior: number;
  total: number;
};
type Datos = {
  pedidos: PedidoGanado[];
  totales: { entregas: number; base: number; bonos: number; propinas: number; total: number };
};

const fechaIso = (d: Date) => d.toLocaleDateString('en-CA');

/** Pestaña Earnings de Dasher: desglose base + bonos + propinas por periodo y por pedido. */
export function Ganancias({
  api,
  idioma,
  periodo,
}: {
  api: Api;
  idioma: Idioma;
  periodo: 'hoy' | 'semana' | 'mes';
}) {
  const t = textosGrandes(idioma).gan;
  const [d, setD] = useState<Datos | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const ahora = new Date();
  const inicioSemana = new Date(ahora);
  inicioSemana.setDate(ahora.getDate() - ((ahora.getDay() + 6) % 7));
  const desde =
    periodo === 'hoy'
      ? fechaIso(ahora)
      : periodo === 'semana'
        ? fechaIso(inicioSemana)
        : fechaIso(new Date(ahora.getFullYear(), ahora.getMonth(), 1));
  useEffect(() => {
    let vivo = true;
    void api
      .pedir<Datos>('GET', `/datos/repartidor/ganancias?desde=${desde}`)
      .then((r) => {
        if (vivo) setD(r);
      })
      .catch((x: unknown) => console.warn('ganancias', x));
    return () => {
      vivo = false;
    };
  }, [api, desde]);
  if (!d) return null;
  const linea = (nombre: string, valor: number, fuerte = false) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
      <Text
        style={{ color: fuerte ? C.secundario : '#5E5E5E', fontWeight: fuerte ? '800' : '500' }}
      >
        {nombre}
      </Text>
      <Text style={{ color: C.secundario, fontWeight: fuerte ? '900' : '700' }}>
        {formatearDolares(valor, idioma)}
      </Text>
    </View>
  );
  return (
    <View style={{ gap: 12 }} testID="ganancias-desglose">
      <View style={e.tarjeta}>
        {linea(t.base, d.totales.base)}
        {d.totales.bonos ? linea(t.bonos, d.totales.bonos) : null}
        {linea(t.propinas, d.totales.propinas)}
        {linea(`${t.total} · ${d.totales.entregas} ${t.entregas}`, d.totales.total, true)}
        <Text style={{ color: '#8A8A8A', fontSize: 12, marginTop: 6 }}>{t.garantia}</Text>
      </View>
      {d.pedidos.length === 0 ? (
        <Text style={{ color: '#5E5E5E' }}>{t.sin}</Text>
      ) : (
        d.pedidos.map((p) => (
          <Pressable
            key={p.pedidoId}
            onPress={() => setAbierto((a) => (a === p.pedidoId ? null : p.pedidoId))}
            accessibilityRole="button"
            accessibilityLabel={`#${p.codigo} ${p.restaurante}`}
            style={e.tarjeta}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: C.secundario }}>
                  #{p.codigo} · {p.restaurante}
                </Text>
                <Text style={{ color: '#5E5E5E', fontSize: 12 }}>
                  {new Date(`${p.entregadoEn.replace(' ', 'T')}Z`).toLocaleString(
                    idioma === 'en' ? 'en-US' : 'es-US',
                    { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
                  )}
                </Text>
              </View>
              <Text style={{ fontWeight: '900', color: C.secundario }}>
                {formatearDolares(p.total, idioma)}
              </Text>
            </View>
            {abierto === p.pedidoId ? (
              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#EEF0F3' }}>
                {linea(t.base, p.base)}
                {p.bono ? linea(t.bonos, p.bono) : null}
                {linea(t.propinas, p.propina)}
                {p.propinaPosterior ? linea(`+ ${t.propinaPosterior}`, p.propinaPosterior) : null}
              </View>
            ) : (
              <Text style={{ color: C.primario, fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                {t.detalle}
              </Text>
            )}
          </Pressable>
        ))
      )}
    </View>
  );
}
