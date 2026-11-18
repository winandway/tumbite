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
}: {
  total: number | null | undefined;
  regalo: RegaloDelViaje | null | undefined;
  moneda: string;
  idioma: Idioma;
  /** El estilo del número de siempre (cada pantalla tiene el suyo). */
  estilo?: StyleProp<TextStyle>;
}) {
  const p = precioConRegalo(total, regalo);
  if (!p) return null;
  const t = enIdioma(TEXTOS_REGALO, idioma);
  const monto = (n: number) => formatearMonto(n, moneda, idioma);
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
}: {
  etiqueta: string;
  total: number | null | undefined;
  regalo: RegaloDelViaje | null | undefined;
  moneda: string;
  idioma: Idioma;
}) {
  const p = precioConRegalo(total, regalo);
  if (!p) return null;
  const t = enIdioma(TEXTOS_REGALO, idioma);
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
      {p.tachado && regalo?.devuelto ? (
        <Text testID="regalo-devuelto" style={{ color: GRIS, fontSize: 13 }}>
          {t.devuelto}
        </Text>
      ) : null}
    </View>
  );
}
