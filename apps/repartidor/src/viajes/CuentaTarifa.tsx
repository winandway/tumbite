import { View } from 'react-native';
import { Text } from '@tumbite/movil';
import { formatearMonto } from '@tumbite/compartido';
import { TEXTOS_TARIFA_SERVICIO } from './textos';

/**
 * C-QUIEN-PAGA-VIAJES (23 nov 2026): «Cobras 2,20 · 2,00 son tuyos · 0,20 son de Divoox», y debajo
 * de dónde sale cada parte. Solo cuando el pasajero paga una tarifa de servicio; si no, no dibuja nada
 * (el viaje es como siempre).
 */
export function CuentaTarifa(p: {
  /** Lo que paga el pasajero (precio del viaje + tarifa de servicio). */
  total: number;
  /** La comisión entera de Divoox (sale del saldo al terminar). */
  deDivoox: number;
  tarifaServicio: number;
  /** Con regalo, Divoox paga parte en mano: se dice «El viaje vale» en vez de «Cobras». */
  conRegalo?: boolean;
  moneda: string;
  idioma: string;
  testID?: string;
}) {
  if (p.tarifaServicio <= 0) return null;
  const t = p.idioma === 'en' ? TEXTOS_TARIFA_SERVICIO.en : TEXTOS_TARIFA_SERVICIO.es;
  const m = (n: number) => formatearMonto(n, p.moneda, p.idioma === 'en' ? 'en' : 'es');
  const deDivoox = Math.min(p.total, Math.max(p.deDivoox, p.tarifaServicio));
  const resto = deDivoox - p.tarifaServicio;
  return (
    <View testID={p.testID ?? 'cuenta-tarifa'} style={{ gap: 4 }}>
      <Text style={{ fontWeight: '800', color: '#101010' }}>
        {p.conRegalo ? t.elViajeVale : t.cobras} {m(p.total)} · {m(p.total - deDivoox)} {t.tuyos} ·{' '}
        {m(deDivoox)} {t.deDivoox}
      </Text>
      <Text style={{ color: '#666B73', fontSize: 13 }}>
        {resto > 0 ? t.mitad(m(p.tarifaServicio), m(resto)) : t.cliente(m(p.tarifaServicio))}
      </Text>
    </View>
  );
}
