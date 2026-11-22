import { View } from 'react-native';
import { type Idioma, formatearMonto } from '@tumbite/compartido';
import { C, FUENTE, Text } from '@tumbite/movil';
import { textosDriver } from './textos';

/** Tarjeta «Hoy»: ganancias y entregas reales de hoy, y el tiempo conectado en esta sesión. */
export function ResumenDia({
  idioma,
  partes,
  entregas,
  palabra = 'entregas',
  segundosConectado,
}: {
  idioma: Idioma;
  /** Lo ganado hoy: billetera (dólares) más lo cobrado en mano, un total por moneda. */
  partes: { monto: number; moneda: string }[];
  entregas: number;
  /** C-HOY-VIAJES: «Viajes» cuando lo de hoy fueron solo viajes de pasajeros. */
  palabra?: 'entregas' | 'viajes';
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
      {/* C-GANANCIAS-EN-MANO: un total por moneda, nunca sumados entre monedas. */}
      {celda(partes.map((x) => formatearMonto(x.monto, x.moneda, idioma)).join(' + '), t.hoy)}
      <View style={{ width: 1, backgroundColor: '#E6E7EA' }} />
      {celda(String(entregas), palabra === 'viajes' ? t.viajes : t.entregas)}
      <View style={{ width: 1, backgroundColor: '#E6E7EA' }} />
      {celda(`${h}h ${m}m`, t.conectadoTiempo)}
    </View>
  );
}
