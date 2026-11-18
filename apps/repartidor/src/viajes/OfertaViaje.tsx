import { useEffect, useState } from 'react';
import { Pressable, Vibration, View } from 'react-native';
import { type Idioma, enIdioma, formatearMonto, textoMultiplicador } from '@tumbite/compartido';
import { vibracionOferta } from '../grandes/accesibilidad';
import { Boton, C, Text, Modal } from '@tumbite/movil';
import { TEXTOS_VIAJE } from './textos';
import { textoOfertaConfianza } from './agendaFijos';
import { sonarOferta } from '../sonidoOferta';
import { venceOferta } from './ofertaTiempo';

/** Lo que manda GET /datos/conductor/operaciones/ofertas (C-OFERTA-COMPLETA). */
export type OfertaViaje = {
  operacionId: string;
  gananciaCentavos: number;
  moneda: string | null;
  expiraEn: string;
  /** C-OFERTA-TIEMPO-REAL: los segundos que le quedan, contados por el servidor. */
  segundosRestantes?: number;
  origen: string;
  destino: string;
  recogidaM: number | null;
  viajeM: number | null;
  viajeS: number | null;
  metodoPago: string;
  /** C-CUPON-DIVOOX: lo que paga Divoox por el regalo del pasajero (0 sin regalo). */
  regaloDivoox?: number;
  /** C-CARRO-PRUEBAS: «moto» o «carro». */
  servicioId?: string;
  /** C-VIAJE-PROGRAMADO: si es una reserva, para cuándo (ISO). */
  programadoPara?: string | null;
  /** C-CARRO-CATEGORIAS: estandar, comfort, premium o xl. */
  categoria?: string;
  /** C-CARRO-DINAMICA: el multiplicador del viaje (10 000 = precio normal). */
  multiplicadorPb?: number;
  /** C-VIAJE-PARADAS: las direcciones de las paradas intermedias, en orden. */
  paradas?: string[];
  /** C-CONDUCTOR-CONFIANZA: el cliente lo eligió de confianza (solo para él, por un minuto). */
  deConfianza?: boolean;
  /** C-VIAJES-FIJOS: sale de un viaje fijo, y el nombre del menor si lleva a uno. */
  viajeFijo?: boolean;
  /** C-SUBIR-TARIFA: el pasajero subió la tarifa («Tarifa subida por el pasajero»). */
  tarifaSubida?: boolean;
  menor?: string | null;
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
  const textos = enIdioma(TEXTOS_VIAJE, idioma);
  // C-ENVIO-TEXTOS: la oferta de un envío dice «envío de paquete», no «viaje».
  const t =
    oferta.servicioId === 'envios' ? { ...textos.oferta, ...textos.ofertaEnvio } : textos.oferta;
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    // C-AUDITIVA-REPARTIDOR: más larga y repetida si el repartidor marcó dificultad auditiva.
    Vibration.vibrate(vibracionOferta());
    sonarOferta();
    const reloj = setInterval(() => setAhora(Date.now()), 500);
    return () => {
      clearInterval(reloj);
      Vibration.cancel();
    };
  }, [oferta.operacionId]);
  // C-OFERTA-TIEMPO-REAL: el vencimiento se cuenta desde que llegó la oferta con los segundos que
  // dio el servidor; el reloj del teléfono (a veces corrido) no la da por vencida antes de tiempo.
  const [vence] = useState(() => venceOferta(oferta, Date.now()));
  const quedan = Math.max(0, Math.ceil((vence - ahora) / 1000));
  // C-CONDUCTOR-CONFIANZA: la oferta exclusiva al conductor de confianza dura un minuto.
  const total = oferta.deConfianza ? 60 : 30;
  const lineas = textoOfertaConfianza(oferta, idioma === 'en' ? 'en' : 'es');
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
              {oferta.servicioId === 'carro'
                ? (new Map(Object.entries(textos.oferta.tituloCategoria)).get(
                    oferta.categoria ?? 'estandar',
                  ) ?? t.tituloCarro)
                : t.titulo}
            </Text>
            <View
              accessibilityRole="timer"
              accessibilityLabel={`${quedan} ${t.segundos}`}
              style={{
                backgroundColor: quedan <= 10 ? C.primario : '#F6F6F6',
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
            style={{ height: 4, borderRadius: 2, backgroundColor: '#E6E7EA', overflow: 'hidden' }}
          >
            <View
              style={{
                width: `${Math.min(100, Math.round((quedan / total) * 100))}%`,
                height: 4,
                backgroundColor: quedan <= 10 ? C.primario : '#B9BFC9',
              }}
            />
          </View>
          {lineas.length ? (
            // C-CONDUCTOR-CONFIANZA y C-VIAJES-FIJOS: confianza, viaje fijo y menor, arriba de todo.
            <View
              testID="oferta-viaje-confianza"
              style={{
                borderWidth: 1,
                borderColor: '#2a2a2a',
                borderRadius: 10,
                padding: 10,
                gap: 4,
              }}
            >
              {lineas.map((l) => (
                <Text key={l} style={{ fontWeight: '800', color: C.secundario }}>
                  {l}
                </Text>
              ))}
            </View>
          ) : null}
          {oferta.programadoPara ? (
            <View
              testID="oferta-viaje-programado"
              style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10 }}
            >
              <Text style={{ fontWeight: '800', color: C.secundario }}>
                {t.programado}{' '}
                {new Date(oferta.programadoPara).toLocaleString(idioma === 'en' ? 'en-US' : 'es', {
                  weekday: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          ) : null}
          {oferta.metodoPago === 'efectivo' ? (
            <View
              testID="oferta-viaje-efectivo"
              style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10 }}
            >
              <Text style={{ fontWeight: '800', color: C.secundario }}>{t.enEfectivo}</Text>
            </View>
          ) : null}
          {(oferta.regaloDivoox ?? 0) > 0 ? (
            <View
              testID="oferta-viaje-regalo"
              style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10 }}
            >
              <Text style={{ fontWeight: '800', color: C.exito }}>
                {t.regaloOferta.replace(
                  '{monto}',
                  formatearMonto(oferta.regaloDivoox ?? 0, oferta.moneda ?? 'USD', idioma),
                )}
              </Text>
            </View>
          ) : null}
          {(oferta.multiplicadorPb ?? 10_000) > 10_000 ? (
            // C-CARRO-DINAMICA: el conductor ve que el viaje lleva tarifa dinámica y de cuánto.
            <View
              testID="oferta-viaje-dinamica"
              style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10 }}
            >
              <Text style={{ fontWeight: '800', color: C.secundario }}>
                {textos.oferta.dinamica}{' '}
                {textoMultiplicador(oferta.multiplicadorPb ?? 10_000, idioma)}
              </Text>
              <Text style={{ color: '#666B73', fontSize: 12 }}>{textos.oferta.dinamicaAyuda}</Text>
            </View>
          ) : null}
          <Text style={{ color: '#666B73', fontWeight: '600' }}>{t.ganas}</Text>
          <Text style={{ fontSize: 40, fontWeight: '800', color: C.secundario, lineHeight: 44 }}>
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
            <Text style={{ color: '#666B73', fontSize: 12 }}>{t.recoger}</Text>
            <Text style={{ fontWeight: '800', color: C.secundario }} numberOfLines={2}>
              {oferta.origen}
            </Text>
          </View>
          {oferta.paradas?.length ? (
            // C-VIAJE-PARADAS: por dónde para el viaje antes del destino.
            <View testID="oferta-viaje-paradas">
              <Text style={{ color: '#666B73', fontSize: 12 }}>
                {textos.oferta.conParadas(oferta.paradas.length)}
              </Text>
              {oferta.paradas.map((d, i) => (
                <Text key={i} style={{ fontWeight: '700', color: C.secundario }} numberOfLines={1}>
                  {i + 1}. {d}
                </Text>
              ))}
            </View>
          ) : null}
          <View>
            <Text style={{ color: '#666B73', fontSize: 12 }}>{t.llevar}</Text>
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
            <Text style={{ textAlign: 'center', color: '#666B73', fontWeight: '700', padding: 8 }}>
              {t.rechazar}
            </Text>
          </Pressable>
          <Text style={{ color: '#6B7078', fontSize: 12, textAlign: 'center' }}>
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
      backgroundColor: '#F6F6F6',
      borderRadius: 12,
      paddingVertical: 8,
      alignItems: 'center',
    }}
  >
    <Text style={{ fontWeight: '800', color: C.secundario, fontSize: 16 }}>{valor}</Text>
    <Text style={{ color: '#666B73', fontSize: 12 }}>{nombre}</Text>
  </View>
);
