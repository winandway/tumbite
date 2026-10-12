import { Text, View } from 'react-native';
import { type Idioma, enIdioma, formatearDolares } from '@tumbite/compartido';
import { Boton, C, e } from '@tumbite/movil';

export type Movimiento = {
  id: string;
  pedidoId: string | null;
  monto: number;
  concepto: 'venta' | 'entrega' | 'propina' | 'retiro' | 'ajuste' | 'regalo';
  fecha: string;
};
export type DatosBilletera = {
  saldo: number;
  cuentaConectada: boolean;
  pagosActivos: boolean;
  movimientos?: Movimiento[];
};

const T = {
  es: {
    disponible: 'Disponible para retirar',
    ganadoMes: 'Ganado este mes',
    propinasMes: 'Propinas este mes',
    retirado: 'Retirado este mes',
    retirar: 'Retirar a mi banco',
    minimo: 'Puedes retirar desde 1 dólar.',
    conectar: 'Conectar mi cuenta bancaria',
    conectarAyuda: 'Tus datos bancarios los escribes en Stripe. Tumbite nunca los ve.',
    movimientos: 'Movimientos',
    sinMovimientos: 'Aquí verás cada entrega, propina y retiro.',
    conceptos: {
      venta: 'Venta',
      entrega: 'Entrega',
      propina: 'Propina',
      retiro: 'Retiro a tu banco',
      ajuste: 'Ajuste',
      regalo: 'Regalo',
    },
    pedido: 'Pedido',
  },
  en: {
    disponible: 'Available to withdraw',
    ganadoMes: 'Earned this month',
    propinasMes: 'Tips this month',
    retirado: 'Withdrawn this month',
    retirar: 'Withdraw to my bank',
    minimo: 'You can withdraw from $1.',
    conectar: 'Connect my bank account',
    conectarAyuda: 'You enter your bank details on Stripe. Tumbite never sees them.',
    movimientos: 'Activity',
    sinMovimientos: 'Every delivery, tip, and withdrawal will show up here.',
    conceptos: {
      venta: 'Sale',
      entrega: 'Delivery',
      propina: 'Tip',
      retiro: 'Withdrawal to your bank',
      ajuste: 'Adjustment',
      regalo: 'Gift',
    },
    pedido: 'Order',
  },
};

/**
 * La billetera del repartidor, como la de una app de banco: el saldo grande arriba, lo ganado,
 * las propinas y lo retirado del mes, y cada movimiento con su fecha. Candado C-BILLETERA-REP.
 */
export function BilleteraRepartidor({
  datos,
  idioma,
  retirar,
  conectar,
}: {
  datos: DatosBilletera;
  idioma: Idioma;
  retirar: () => void;
  conectar: () => void;
}) {
  const t = enIdioma(T, idioma);
  const movs = datos.movimientos ?? [];
  const mes = new Date().toISOString().slice(0, 7);
  const delMes = movs.filter((m) => m.fecha.slice(0, 7) === mes);
  const suma = (f: (m: Movimiento) => boolean) => delMes.filter(f).reduce((s, m) => s + m.monto, 0);
  const ganado = suma((m) => m.monto > 0);
  const propinas = suma((m) => m.concepto === 'propina');
  const retirado = Math.max(0, -suma((m) => m.concepto === 'retiro'));
  const dinero = (c: number) => formatearDolares(c, idioma);
  const fecha = (f: string) =>
    new Date(`${f.replace(' ', 'T')}Z`).toLocaleString(idioma, {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <View>
      <View
        style={{
          backgroundColor: C.secundario,
          borderRadius: 20,
          padding: 20,
          marginBottom: 12,
        }}
        accessibilityRole="summary"
      >
        <Text style={{ color: '#BDBDBD', fontWeight: '600' }}>{t.disponible}</Text>
        <Text style={{ color: '#FFFFFF', fontSize: 40, fontWeight: '800', marginVertical: 6 }}>
          {dinero(datos.saldo)}
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 6 }}>
          {[
            [t.ganadoMes, ganado],
            [t.propinasMes, propinas],
            [t.retirado, retirado],
          ].map(([titulo, monto]) => (
            <View key={String(titulo)} style={{ flex: 1 }}>
              <Text style={{ color: '#BDBDBD', fontSize: 12 }}>{titulo}</Text>
              <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{dinero(Number(monto))}</Text>
            </View>
          ))}
        </View>
      </View>
      {datos.pagosActivos ? (
        datos.saldo >= 100 ? (
          <Boton texto={t.retirar} alTocar={retirar} />
        ) : (
          <Text style={{ color: '#5E5E5E', marginBottom: 12 }}>{t.minimo}</Text>
        )
      ) : (
        <View style={{ marginBottom: 8 }}>
          <Boton texto={t.conectar} alTocar={conectar} secundario />
          <Text style={{ color: '#5E5E5E', marginTop: -4, marginBottom: 8 }}>
            {t.conectarAyuda}
          </Text>
        </View>
      )}
      <Text style={{ fontSize: 18, fontWeight: '800', color: C.secundario, marginVertical: 8 }}>
        {t.movimientos}
      </Text>
      {movs.length === 0 ? <Text style={e.tarjeta}>{t.sinMovimientos}</Text> : null}
      {movs.length > 0 ? (
        <View style={e.tarjeta}>
          {movs.map((m, i) => (
            <View
              key={m.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: '#EEEEEE',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700' }}>{t.conceptos[m.concepto] ?? m.concepto}</Text>
                <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
                  {fecha(m.fecha)}
                  {m.pedidoId ? ` · ${t.pedido} #${m.pedidoId.slice(0, 4).toUpperCase()}` : ''}
                </Text>
              </View>
              <Text style={{ fontWeight: '800', color: m.monto < 0 ? C.secundario : '#0D7A3A' }}>
                {m.monto > 0 ? '+' : ''}
                {dinero(m.monto)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
