import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { type Api, type Idioma, formatearMonto, marcarCampanaVista } from '@tumbite/compartido';
import { C, e, Text } from '@tumbite/movil';
import { textosGrandes } from './textos';

export type AvisoRep = {
  tipo: string;
  pedidoId: string | null;
  codigo: string | null;
  restaurante: string | null;
  detalle: string;
  centavos: number | null;
  /** C-MONEDA-RECORRIDO: la moneda del pedido de esa propina. */
  moneda?: string;
  en: string;
  /** C-CAMPANA-SE-VACIA: si ya lo vio (los servidores viejos no lo traen). */
  leido?: boolean;
};
export type RespuestaAvisosRep = { avisos: AvisoRep[]; pendientes: number; sinLeer?: number };

/**
 * La campana del repartidor: avisos reales de los últimos siete días, calculados al momento.
 * C-CAMPANA-SE-VACIA (23 nov 2026): abrirla deja el punto en cero y lo guarda en el servidor por
 * cuenta (una escritura como mucho). Lo nuevo lleva su punto rojo; lo leído queda apagado.
 */
export function Avisos({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = textosGrandes(idioma).avisos;
  const [d, setD] = useState<RespuestaAvisosRep | null>(null);
  useEffect(() => {
    let vivo = true;
    void api
      .pedir<RespuestaAvisosRep>('GET', '/datos/repartidor/avisos')
      .then((r) => {
        if (!vivo) return;
        setD(r);
        // El gesto de abrir la campana: «visto hasta» el aviso más nuevo (nada si no había nada nuevo).
        void marcarCampanaVista(api, 'repartidor', r.avisos);
      })
      .catch((x: unknown) => console.warn('avisos', x));
    return () => {
      vivo = false;
    };
  }, [api]);
  const titulos = new Map<string, string>(Object.entries(t));
  return (
    <View style={{ padding: 16, gap: 12 }} testID="avisos-repartidor">
      <Text style={{ fontSize: 22, fontWeight: '800', color: C.secundario }}>{t.titulo}</Text>
      {d && d.avisos.length === 0 ? <Text style={{ color: '#666B73' }}>{t.sin}</Text> : null}
      {(d?.avisos ?? []).map((a, i) => (
        <View key={`${a.tipo}-${a.pedidoId ?? i}-${a.en}`} style={e.tarjeta}>
          <Text
            style={{ fontWeight: a.leido === false ? '800' : '600', color: C.secundario }}
            testID={a.leido === false ? 'aviso-nuevo' : undefined}
          >
            {a.leido === false ? <Text style={{ color: C.primario }}>● </Text> : null}
            {titulos.get(a.tipo) ?? a.tipo}
            {a.codigo ? ` · #${a.codigo}` : ''}
          </Text>
          <Text style={{ color: '#666B73', fontSize: 13, marginTop: 2 }}>
            {a.restaurante ?? ''}
            {a.tipo === 'direccion_cambiada' && a.detalle ? ` · ${a.detalle}` : ''}
            {a.tipo === 'ofertas_vencidas' ? ` ${a.detalle}` : ''}
            {a.centavos != null ? ` · +${formatearMonto(a.centavos, a.moneda, idioma)}` : ''}
            {a.tipo === 'cancelado_por_restaurante' || a.tipo === 'cancelado_por_cliente'
              ? ` · ${t.quedasLibre}`
              : ''}
          </Text>
          <Text style={{ color: '#6B7078', fontSize: 11, marginTop: 2 }}>
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
