import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, Vibration, View } from 'react-native';
import { type Idioma, formatearMonto } from '@tumbite/compartido';
import { Boton, C } from '@tumbite/movil';
import { textosGrandes } from './textos';

export type OfertaCompleta = {
  id: string;
  pagoRepartidor: number;
  propina: number;
  bono?: number;
  direccion: string;
  restaurante: { nombre: string; direccion: string };
  distanciaKm: number | null;
  distanciaAlLocalKm?: number | null;
  distanciaTotalKm?: number | null;
  minutosEstimados?: number | null;
  articulos?: number;
  minutosParaListo?: number;
  segundos?: number;
  ofertaEn?: string;
  /** Cobro en mano: cómo paga el cliente, en qué moneda y cuánto adelanta el repartidor en el local. */
  metodoPago?: string;
  moneda?: string;
  adelantoLocal?: number;
};

const km = (v: number, i: Idioma) =>
  i === 'en' ? `${(v * 0.621371).toFixed(1)} mi` : `${v.toFixed(1)} km`;

/**
 * La oferta como la de Dasher y Uber: pantalla completa, ganancia garantizada grande, viaje
 * completo (hasta el local y total), minutos, artículos, cuenta regresiva real del servidor y
 * vibración al llegar. Vencer cuenta como rechazo (el servidor lo registra).
 */
export function Oferta({
  oferta,
  idioma,
  alAceptar,
  alRechazar,
}: {
  oferta: OfertaCompleta;
  idioma: Idioma;
  alAceptar: () => void;
  alRechazar: () => void;
}) {
  const t = textosGrandes(idioma).oferta;
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    Vibration.vibrate([0, 400, 200, 400]);
    const reloj = setInterval(() => setAhora(Date.now()), 500);
    return () => {
      clearInterval(reloj);
      Vibration.cancel();
    };
  }, [oferta.id]);
  const desde = oferta.ofertaEn
    ? new Date(`${oferta.ofertaEn.replace(' ', 'T')}Z`).getTime()
    : null;
  const total = oferta.segundos ?? 45;
  const quedan = desde != null ? Math.max(0, total - Math.floor((ahora - desde) / 1000)) : total;
  const n = oferta.articulos ?? 0;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={alRechazar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(25,25,25,0.55)', justifyContent: 'flex-end' }}>
        <View
          testID="oferta-completa"
          style={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 20,
            gap: 10,
          }}
        >
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: C.primario, fontWeight: '800', fontSize: 16 }}>{t.titulo}</Text>
            <View
              accessibilityRole="timer"
              accessibilityLabel={`${quedan} ${t.segundos}`}
              style={{
                backgroundColor: quedan <= 10 ? C.primario : '#F2F3F5',
                borderRadius: 999,
                paddingHorizontal: 12,
                paddingVertical: 4,
              }}
            >
              <Text style={{ fontWeight: '800', color: quedan <= 10 ? '#fff' : C.secundario }}>
                {quedan}
                {t.segundos}
              </Text>
            </View>
          </View>
          <View
            style={{ height: 4, borderRadius: 2, backgroundColor: '#ECECEC', overflow: 'hidden' }}
          >
            <View
              style={{
                width: `${Math.round((quedan / total) * 100)}%`,
                height: 4,
                backgroundColor: quedan <= 10 ? C.primario : '#B9BFC9',
              }}
            />
          </View>
          {oferta.metodoPago && oferta.metodoPago !== 'tarjeta' ? (
            <View
              testID="oferta-cobro-en-mano"
              style={{
                borderWidth: 1,
                borderColor: '#2a2a2a',
                borderRadius: 10,
                padding: 10,
                gap: 2,
              }}
            >
              <Text style={{ fontWeight: '900', color: C.secundario }}>
                {oferta.metodoPago === 'efectivo' ? t.enEfectivo : t.porTransferencia}
              </Text>
              {oferta.adelantoLocal ? (
                <Text style={{ color: '#5E5E5E' }}>
                  {t.adelantas.replace(
                    '{monto}',
                    formatearMonto(oferta.adelantoLocal, oferta.moneda, idioma),
                  )}
                </Text>
              ) : null}
            </View>
          ) : null}
          <Text style={{ color: '#5E5E5E', fontWeight: '600' }}>{t.garantizado}</Text>
          <Text style={{ fontSize: 40, fontWeight: '900', color: C.secundario, lineHeight: 44 }}>
            {formatearMonto(oferta.pagoRepartidor, oferta.moneda, idioma)}
          </Text>
          {oferta.propina > 0 ? (
            <Text style={{ color: '#5E5E5E' }}>
              {t.conPropina} {formatearMonto(oferta.propina, oferta.moneda, idioma)}
            </Text>
          ) : null}
          {oferta.bono ? (
            <Text style={{ color: C.exito, fontWeight: '700' }}>
              {t.bono} {formatearMonto(oferta.bono, oferta.moneda, idioma)}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            {oferta.distanciaAlLocalKm != null ? (
              <Dato valor={km(oferta.distanciaAlLocalKm, idioma)} nombre={t.alLocal} />
            ) : null}
            {oferta.distanciaTotalKm != null ? (
              <Dato valor={km(oferta.distanciaTotalKm, idioma)} nombre={t.total} />
            ) : null}
            {oferta.minutosEstimados != null ? (
              <Dato valor={`${oferta.minutosEstimados}`} nombre={t.minutos} />
            ) : null}
            {n ? <Dato valor={`${n}`} nombre={n === 1 ? t.articulo : t.articulos} /> : null}
          </View>
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.recoger}</Text>
            <Text style={{ fontWeight: '800', color: C.secundario }}>
              {oferta.restaurante.nombre}
              {oferta.minutosParaListo
                ? ` · ${t.listoEn} ${oferta.minutosParaListo} min`
                : ` · ${t.listoYa}`}
            </Text>
            <Text style={{ color: '#5E5E5E' }} numberOfLines={1}>
              {oferta.restaurante.direccion}
            </Text>
          </View>
          <View>
            <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.entregar}</Text>
            <Text style={{ fontWeight: '800', color: C.secundario }} numberOfLines={2}>
              {oferta.direccion}
            </Text>
          </View>
          <Boton texto={t.aceptar} alTocar={alAceptar} exito />
          <Pressable
            onPress={alRechazar}
            accessibilityRole="button"
            accessibilityLabel={t.rechazar}
          >
            <Text style={{ textAlign: 'center', color: '#5E5E5E', fontWeight: '700', padding: 8 }}>
              {t.rechazar}
            </Text>
          </Pressable>
          <Text style={{ color: '#8A8A8A', fontSize: 12, textAlign: 'center' }}>
            {t.vence} {t.sinCastigo}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const Dato = ({ valor, nombre }: { valor: string; nombre: string }) => (
  <View
    style={{
      flex: 1,
      backgroundColor: '#F4F6F9',
      borderRadius: 12,
      paddingVertical: 8,
      alignItems: 'center',
    }}
  >
    <Text style={{ fontWeight: '900', color: C.secundario, fontSize: 16 }}>{valor}</Text>
    <Text style={{ color: '#5E5E5E', fontSize: 11 }}>{nombre}</Text>
  </View>
);
