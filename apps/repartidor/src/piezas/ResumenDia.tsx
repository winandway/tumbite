import { View } from 'react-native';
import { type Idioma, formatearMonto } from '@tumbite/compartido';
import { C, FUENTE, Text } from '@tumbite/movil';
import { textosDriver } from './textos';

/** Tarjeta «Hoy»: ganancias y entregas reales de hoy, y el tiempo conectado en esta sesión. */
export function ResumenDia({
  idioma,
  ganancias,
  enMano,
  entregas,
  segundosConectado,
}: {
  idioma: Idioma;
  ganancias: number;
  /** Lo ganado hoy en pedidos cobrados en mano, en la moneda del país (no pasa por Stripe). */
  enMano?: { total: number; moneda: string };
  entregas: number;
  segundosConectado: number;
}) {
  const t = textosDriver(idioma);
  const h = Math.floor(segundosConectado / 3600);
  const m = Math.floor((segundosConectado % 3600) / 60);
  const celda = (valor: string, nombre: string) => (
    <View style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14 }}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontFamily: FUENTE.titulo, fontSize: 19, lineHeight: 24, color: C.secundario }}
      >
        {valor}
      </Text>
      <Text style={{ fontSize: 13, lineHeight: 18, color: '#666B73' }}>{nombre}</Text>
    </View>
  );
  // Fase cero (pantalla 01 de DRIVER.md): borde fino de 1, sin sombra; «Hoy», entregas y en línea.
  return (
    <View
      testID="resumen-dia"
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E6E7EA',
        flexDirection: 'row',
      }}
    >
      {/* Tarjeta (billetera de Stripe, USD) y cobro en mano (su moneda), nunca sumados entre monedas. */}
      {celda(
        enMano?.total && enMano.moneda !== 'USD'
          ? ganancias
            ? `${formatearMonto(ganancias, 'USD', idioma)} + ${formatearMonto(enMano.total, enMano.moneda, idioma)}`
            : formatearMonto(enMano.total, enMano.moneda, idioma)
          : formatearMonto(ganancias + (enMano?.total ?? 0), 'USD', idioma),
        t.hoy,
      )}
      <View style={{ width: 1, backgroundColor: '#E6E7EA' }} />
      {celda(String(entregas), t.entregas)}
      <View style={{ width: 1, backgroundColor: '#E6E7EA' }} />
      {celda(`${h}h ${m}m`, t.conectadoTiempo)}
    </View>
  );
}
