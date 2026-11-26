import { type StyleProp, type TextStyle, View } from 'react-native';
import {
  type Idioma,
  type RegaloDelViaje,
  enIdioma,
  formatearMonto,
  precioConRegalo,
} from '@tumbite/compartido';
import { C, Text } from '@tumbite/movil';
import { LineaRegalo, TEXTOS_REGALO } from '../RegaloDivoox';

/** C-SALDO-CLIENTE: las líneas del Saldo Divoox en el precio del viaje. */
const TEXTOS_SALDO = {
  es: {
    saldo: 'Saldo Divoox',
    pagadoConSaldo: 'Pagado con saldo',
    devuelto: (m: string) => `Tu Saldo Divoox (${m}) volvió a tu cuenta.`,
  },
  en: {
    saldo: 'Divoox Balance',
    pagadoConSaldo: 'Paid with balance',
    devuelto: (m: string) => `Your Divoox Balance (${m}) went back to your account.`,
  },
};

/**
 * C-PRECIO-CON-REGALO (18 nov 2026) — todos los países. El precio de un viaje en TODAS sus pantallas
 * (buscando, en camino, terminado, cancelado, «Mis viajes» y el recibo) se muestra como la tarjeta del
 * precio: con regalo de Divoox, el precio de siempre tachado, el regalo en verde y lo que se paga de
 * verdad («Gratis» si lo cubre todo). Nunca «Precio fijo $1,42» a secas cuando el viaje tenía regalo.
 *
 * Uso: `<PrecioDelViaje etiqueta="Precio fijo" total={…} regalo={…} moneda="USD" idioma="es" />` en
 * una tarjeta; `<PrecioCompacto …/>` al lado derecho de una fila.
 */
export type { RegaloDelViaje };

const GRIS = '#666B73';

/** El precio a la derecha de una fila: tachado y lo que se paga, o el precio tal cual. */
export function PrecioCompacto({
  total,
  regalo,
  moneda,
  idioma,
  estilo,
  saldo = 0,
}: {
  total: number | null | undefined;
  regalo: RegaloDelViaje | null | undefined;
  moneda: string;
  idioma: Idioma;
  /** El estilo del número de siempre (cada pantalla tiene el suyo). */
  estilo?: StyleProp<TextStyle>;
  /** C-SALDO-CLIENTE: lo que cubrió el Saldo Divoox. */
  saldo?: number;
}) {
  const p = precioConRegalo(total, regalo, saldo);
  if (!p) return null;
  const t = enIdioma(TEXTOS_REGALO, idioma);
  const monto = (n: number) => formatearMonto(n, moneda, idioma);
  if (p.devuelto)
    // No hubo viaje: el precio normal y que el regalo volvió a la cuenta (nunca «Gratis»).
    return (
      <View testID="precio-viaje" style={{ alignItems: 'flex-end' }}>
        <Text style={estilo}>{monto(p.total)}</Text>
        <Text testID="regalo-devuelto" style={{ color: GRIS, fontSize: 12 }}>
          {t.devueltoCorto}
        </Text>
      </View>
    );
  if (!p.tachado && p.saldo > 0)
    // C-SALDO-CLIENTE: el precio y, debajo, lo que se pagó con saldo.
    return (
      <View testID="precio-viaje" style={{ alignItems: 'flex-end' }}>
        <Text style={estilo}>{monto(p.total)}</Text>
        <Text testID="precio-viaje-saldo" style={{ color: C.exito, fontSize: 12 }}>
          {enIdioma(TEXTOS_SALDO, idioma).saldo} −{monto(p.saldo)}
        </Text>
      </View>
    );
  if (!p.tachado)
    return (
      <Text testID="precio-viaje" style={estilo}>
        {monto(p.total)}
      </Text>
    );
  return (
    <View testID="precio-viaje" style={{ alignItems: 'flex-end' }}>
      <Text
        testID="precio-viaje-tachado"
        style={{ color: GRIS, fontSize: 13, textDecorationLine: 'line-through' }}
      >
        {monto(p.total)}
      </Text>
      <Text testID="precio-viaje-a-pagar" style={estilo}>
        {p.gratis ? t.gratis : monto(p.aPagar)}
      </Text>
    </View>
  );
}

/** El precio completo en una tarjeta: la etiqueta con el precio, el regalo y lo que se paga. */
export function PrecioDelViaje({
  etiqueta,
  total,
  regalo,
  moneda,
  idioma,
  saldo = 0,
  saldoDevuelto = null,
}: {
  etiqueta: string;
  total: number | null | undefined;
  regalo: RegaloDelViaje | null | undefined;
  moneda: string;
  idioma: Idioma;
  /** C-SALDO-CLIENTE: lo que cubre el Saldo Divoox y lo que volvió si el viaje no se hizo. */
  saldo?: number;
  saldoDevuelto?: number | null;
}) {
  const p = precioConRegalo(total, regalo, saldo);
  if (!p) return null;
  const t = enIdioma(TEXTOS_REGALO, idioma);
  const ts = enIdioma(TEXTOS_SALDO, idioma);
  return (
    <View testID="precio-del-viaje" style={{ marginTop: 8, gap: 2 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontWeight: '700', color: C.secundario, flex: 1 }}>{etiqueta}</Text>
        <Text
          testID={p.tachado ? 'precio-viaje-tachado' : 'precio-viaje'}
          style={
            p.tachado
              ? { color: GRIS, textDecorationLine: 'line-through' }
              : { fontWeight: '700', color: C.secundario }
          }
        >
          {formatearMonto(p.total, moneda, idioma)}
        </Text>
      </View>
      {p.tachado && regalo ? (
        <LineaRegalo
          regalo={{
            codigo: regalo.codigo,
            nombreEs: regalo.nombreEs ?? '',
            nombreEn: regalo.nombreEn ?? '',
            monto: p.regalo,
          }}
          total={p.total}
          moneda={moneda}
          idioma={idioma}
        />
      ) : null}
      {p.devuelto ? (
        <Text testID="regalo-devuelto" style={{ color: GRIS, fontSize: 13 }}>
          {t.devuelto}
        </Text>
      ) : null}
      {p.saldo > 0 ? (
        <View testID="precio-viaje-saldo" style={{ flexDirection: 'row', gap: 8 }}>
          <Text style={{ color: C.exito, fontWeight: '700', flex: 1 }}>
            {p.aPagar === 0 ? ts.pagadoConSaldo : ts.saldo}
          </Text>
          <Text style={{ color: C.exito, fontWeight: '700' }}>
            −{formatearMonto(p.saldo, moneda, idioma)}
          </Text>
        </View>
      ) : null}
      {saldoDevuelto ? (
        <Text testID="saldo-devuelto" style={{ color: GRIS, fontSize: 13 }}>
          {ts.devuelto(formatearMonto(saldoDevuelto, moneda, idioma))}
        </Text>
      ) : null}
    </View>
  );
}
