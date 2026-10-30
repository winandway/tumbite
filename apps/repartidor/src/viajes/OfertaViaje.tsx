import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, Vibration, View } from 'react-native';
import { type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { Boton, C } from '@tumbite/movil';
import { TEXTOS_VIAJE } from './textos';

/** Lo que manda GET /datos/conductor/operaciones/ofertas (C-OFERTA-COMPLETA). */
export type OfertaViaje = {
  operacionId: string;
  gananciaCentavos: number;
  moneda: string | null;
  expiraEn: string;
  origen: string;
  destino: string;
  recogidaM: number | null;
  viajeM: number | null;
  viajeS: number | null;
  metodoPago: string;
  /** C-CARRO-PRUEBAS: «moto» o «carro». */
  servicioId?: string;
};

const distancia = (m: number, i: Idioma) =>
  i === 'en' ? `${((m / 1000) * 0.621371).toFixed(1)} mi` : `${(m / 1000).toFixed(1)} km`;

/**
 * La oferta de un viaje de Moto, igual que la de Comida y que la de Uber Moto: ganancia grande,
 * distancia a la recogida, distancia y minutos del viaje, cómo paga el pasajero, a dónde va, y la
 * cuenta regresiva real del servidor. Vencer o rechazar pasa el viaje al siguiente conductor.
 */
export function OfertaViajeModal({
  oferta,
  idioma,
  alAceptar,
  alRechazar,
}: {
  oferta: OfertaViaje;
  idioma: Idioma;
  alAceptar: () => void;
  alRechazar: () => void;
}) {
  const t = enIdioma(TEXTOS_VIAJE, idioma).oferta;
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    Vibration.vibrate([0, 400, 200, 400]);
    const reloj = setInterval(() => setAhora(Date.now()), 500);
    return () => {
      clearInterval(reloj);
      Vibration.cancel();
    };
  }, [oferta.operacionId]);
  const vence = new Date(`${oferta.expiraEn.replace(' ', 'T')}Z`).getTime();
  const quedan = Math.max(0, Math.ceil((vence - ahora) / 1000));
  const total = 30;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={alRechazar}>
      <View style={{ flex: 1, backgroundColor: 'rgba(25,25,25,0.55)', justifyContent: 'flex-end' }}>
        <View
          testID="oferta-viaje"
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
            <Text style={{ color: C.primario, fontWeight: '800', fontSize: 16 }}>
              {oferta.servicioId === 'carro' ? t.tituloCarro : t.titulo}
            </Text>
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
                width: `${Math.min(100, Math.round((quedan / total) * 100))}%`,
                height: 4,
                backgroundColor: quedan <= 10 ? C.primario : '#B9BFC9',
              }}
            />
          </View>
          {oferta.metodoPago === 'efectivo' ? (
            <View
              testID="oferta-viaje-efectivo"
              style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10 }}
            >
              <Text style={{ fontWeight: '900', color: C.secundario }}>{t.enEfectivo}</Text>
            </View>
          ) : null}
          <Text style={{ color: '#5E5E5E', fontWeight: '600' }}>{t.ganas}</Text>
          <Text style={{ fontSize: 40, fontWeight: '900', color: C.secundario, lineHeight: 44 }}>
            {formatearMonto(oferta.gananciaCentavos, oferta.moneda ?? 'USD', idioma)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            {oferta.recogidaM != null ? (
              <Dato valor={distancia(oferta.recogidaM, idioma)} nombre={t.recogida} />
            ) : null}
            {oferta.viajeM != null ? (
              <Dato valor={distancia(oferta.viajeM, idioma)} nombre={t.viaje} />
            ) : null}
            {oferta.viajeS != null ? (
              <Dato valor={`${Math.max(1, Math.round(oferta.viajeS / 60))}`} nombre={t.minutos} />
            ) : null}
          </View>
          <View style={{ marginTop: 6 }}>
            <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.recoger}</Text>
            <Text style={{ fontWeight: '800', color: C.secundario }} numberOfLines={2}>
              {oferta.origen}
            </Text>
          </View>
          <View>
            <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.llevar}</Text>
            <Text style={{ fontWeight: '800', color: C.secundario }} numberOfLines={2}>
              {oferta.destino}
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
            {t.sinCastigo}
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
    <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{nombre}</Text>
  </View>
);
