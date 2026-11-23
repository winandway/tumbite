import { Pressable, View } from 'react-native';
import { type Idioma, formatearMonto } from '@tumbite/compartido';
import { C, FUENTE, Text } from '@tumbite/movil';
import { textosGrandes } from '../grandes/textos';
import { type SaldoPrepagoInicio, tarjetaSaldoInicio } from './saldoInicioLogica';

/**
 * C-SALDO-EN-INICIO (19 nov 2026): el saldo prepago del conductor a la vista en el inicio de Driver,
 * donde el país cobra la comisión de ese saldo (Venezuela). Con saldo de sobra la cifra va en verde;
 * cuando se acaba, en rojo con el aviso. Tocarla lleva a Ganancias, donde se recarga. En EE. UU. no
 * sale (la pieza no dibuja nada).
 */
export function SaldoInicio({
  saldo,
  idioma,
  alRecargar,
}: {
  saldo: SaldoPrepagoInicio | null;
  idioma: Idioma;
  alRecargar: () => void;
}) {
  const tarjeta = tarjetaSaldoInicio(saldo);
  if (!saldo || !tarjeta) return null;
  const t = textosGrandes(idioma).prepago;
  const problema = tarjeta.nivel !== 'ok';
  const color = problema ? C.primario : C.exito;
  const alcanza = tarjeta.alcanza
    ? tarjeta.alcanza.tipo === 'carreras'
      ? t.carreras(tarjeta.alcanza.n)
      : t.pedidos(tarjeta.alcanza.n)
    : null;
  const aviso =
    tarjeta.nivel === 'sin'
      ? tarjeta.soloCarreras
        ? t.inicioSinCarreras
        : t.inicioSin
      : tarjeta.nivel === 'bajo'
        ? t.inicioBajo
        : null;
  const monto = formatearMonto(saldo.disponible, saldo.moneda ?? 'USD', idioma);
  const accion = problema ? t.inicioRecargar : t.inicioVer;
  return (
    <Pressable
      testID="saldo-inicio"
      onPress={alRecargar}
      accessibilityRole="button"
      accessibilityLabel={`${t.inicioTitulo}: ${monto}. ${aviso ?? alcanza ?? ''} ${accion}`}
      style={{
        backgroundColor: '#fff',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: problema ? C.primario : '#E6E7EA',
        padding: 14,
        gap: 4,
        marginTop: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, color: '#666B73', fontSize: 13, fontWeight: '600' }}>
          {t.inicioTitulo}
        </Text>
        <Text
          testID="saldo-inicio-accion"
          style={{ color: problema ? C.primario : C.secundario, fontWeight: '800', fontSize: 13 }}
        >
          {accion} →
        </Text>
      </View>
      <Text
        testID="saldo-inicio-monto"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ fontFamily: FUENTE.titulo, fontSize: 26, lineHeight: 32, color }}
      >
        {monto}
      </Text>
      {alcanza ? (
        <Text style={{ color: problema ? C.primario : C.exito, fontWeight: '700', fontSize: 13 }}>
          {alcanza}
        </Text>
      ) : null}
      {aviso ? (
        <Text accessibilityRole="alert" style={{ color: C.primario, fontSize: 13 }}>
          {aviso}
        </Text>
      ) : null}
    </Pressable>
  );
}
