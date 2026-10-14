import { useMemo } from 'react';
import { Text, View } from 'react-native';
import QRCode from 'qrcode';

/**
 * Un código QR dibujado con cuadritos (sin librerías de gráficos): el restaurante lo muestra en la
 * tableta junto al pedido listo y el repartidor lo escanea desde su app. Debajo va el número
 * corto del pedido, por si el escaneo falla y hay que escribirlo.
 */
export function CodigoQR({
  texto,
  numero,
  tamano = 160,
}: {
  texto: string;
  numero: string;
  tamano?: number;
}) {
  const modulos = useMemo(() => {
    const q = QRCode.create(texto, { errorCorrectionLevel: 'M' });
    const n = q.modules.size;
    const filas: boolean[][] = [];
    for (let y = 0; y < n; y++) {
      const fila: boolean[] = [];
      for (let x = 0; x < n; x++) fila.push(q.modules.get(y, x) === 1);
      filas.push(fila);
    }
    return filas;
  }, [texto]);
  const lado = tamano / modulos.length;
  return (
    <View style={{ alignItems: 'center', marginTop: 8 }} accessibilityLabel={`QR ${numero}`}>
      <View style={{ backgroundColor: '#fff', padding: 8, borderRadius: 8 }}>
        {modulos.map((fila, y) => (
          <View key={y} style={{ flexDirection: 'row' }}>
            {fila.map((negro, x) => (
              <View
                key={x}
                style={{ width: lado, height: lado, backgroundColor: negro ? '#191919' : '#fff' }}
              />
            ))}
          </View>
        ))}
      </View>
      <Text style={{ fontWeight: '800', fontSize: 22, letterSpacing: 2, marginTop: 4 }}>
        {numero}
      </Text>
    </View>
  );
}
