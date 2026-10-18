import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { type Api, type Idioma, formatearDolares } from '@tumbite/compartido';
import { C, e } from '@tumbite/movil';
import { textosGrandes } from './textos';

export type AvisoRep = {
  tipo: string;
  pedidoId: string | null;
  codigo: string | null;
  restaurante: string | null;
  detalle: string;
  centavos: number | null;
  en: string;
};
export type RespuestaAvisosRep = { avisos: AvisoRep[]; pendientes: number };

/** La campana del repartidor: avisos reales de los últimos siete días, calculados al momento. */
export function Avisos({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = textosGrandes(idioma).avisos;
  const [d, setD] = useState<RespuestaAvisosRep | null>(null);
  useEffect(() => {
    let vivo = true;
    void api
      .pedir<RespuestaAvisosRep>('GET', '/datos/repartidor/avisos')
      .then((r) => {
        if (vivo) setD(r);
      })
      .catch((x: unknown) => console.warn('avisos', x));
    return () => {
      vivo = false;
    };
  }, [api]);
  const titulos = new Map<string, string>(Object.entries(t));
  return (
    <View style={{ padding: 16, gap: 12 }} testID="avisos-repartidor">
      <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>{t.titulo}</Text>
      {d && d.avisos.length === 0 ? <Text style={{ color: '#5E5E5E' }}>{t.sin}</Text> : null}
      {(d?.avisos ?? []).map((a, i) => (
        <View key={`${a.tipo}-${a.pedidoId ?? i}-${a.en}`} style={e.tarjeta}>
          <Text style={{ fontWeight: '800', color: C.secundario }}>
            {titulos.get(a.tipo) ?? a.tipo}
            {a.codigo ? ` · #${a.codigo}` : ''}
          </Text>
          <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: 2 }}>
            {a.restaurante ?? ''}
            {a.tipo === 'direccion_cambiada' && a.detalle ? ` · ${a.detalle}` : ''}
            {a.tipo === 'ofertas_vencidas' ? ` ${a.detalle}` : ''}
            {a.centavos != null ? ` · +${formatearDolares(a.centavos, idioma)}` : ''}
            {a.tipo === 'cancelado_por_restaurante' || a.tipo === 'cancelado_por_cliente'
              ? ` · ${t.quedasLibre}`
              : ''}
          </Text>
          <Text style={{ color: '#8A8A8A', fontSize: 11, marginTop: 2 }}>
            {new Date(`${a.en.replace(' ', 'T')}Z`).toLocaleString(
              idioma === 'en' ? 'en-US' : 'es-US',
              { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' },
            )}
          </Text>
        </View>
      ))}
    </View>
  );
}
