import { Text, View } from 'react-native';
import { type Idioma, formatearMonto } from '@tumbite/compartido';
import { C } from '@tumbite/movil';
import { textosDriver } from './textos';

/** Tarjeta «Hoy»: ganancias y entregas reales de hoy, y el tiempo conectado en esta sesión. */
export function ResumenDia({
  idioma,
  ganancias,
  entregas,
  segundosConectado,
}: {
  idioma: Idioma;
  ganancias: number;
  entregas: number;
  segundosConectado: number;
}) {
  const t = textosDriver(idioma);
  const h = Math.floor(segundosConectado / 3600);
  const m = Math.floor((segundosConectado % 3600) / 60);
  const celda = (valor: string, nombre: string) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: C.secundario }}>{valor}</Text>
      <Text style={{ fontSize: 12, color: '#5E5E5E' }}>{nombre}</Text>
    </View>
  );
  return (
    <View
      style={{
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 12,
        shadowColor: '#191919',
        shadowOpacity: 0.1,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 3,
      }}
    >
      <Text style={{ fontWeight: '800', fontSize: 13, color: C.secundario, marginBottom: 4 }}>
        {t.hoy}
      </Text>
      <View style={{ flexDirection: 'row' }}>
        {/* Movimientos de la billetera de Stripe: solo tarjeta, en USD. */}
        {celda(formatearMonto(ganancias, 'USD', idioma), t.ganancias)}
        <View style={{ width: 1, backgroundColor: '#EEF0F3' }} />
        {celda(String(entregas), t.entregas)}
        <View style={{ width: 1, backgroundColor: '#EEF0F3' }} />
        {celda(`${h}h ${m}m`, t.conectadoTiempo)}
      </View>
    </View>
  );
}
