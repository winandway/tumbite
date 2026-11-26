import { useEffect, useState } from 'react';
import { avisoViajeLargo } from './viajeLargo';
import { View } from 'react-native';
import {
  type Idioma,
  type MontoEnMano as Monto,
  enIdioma,
  formatearMonto,
  textoMultiplicador,
} from '@tumbite/compartido';
import {
  BotonDriver,
  C,
  CuentaAtrasDriver,
  DK,
  DatosTresDriver,
  EtiquetaServicioDriver,
  HojaOferta,
  LineaInfoDriver,
  MontoEnMano,
  RechazarDriver,
  RelojOfertaDriver,
  RutaDriver,
  Text,
} from '@tumbite/movil';
import { TEXTOS_VIAJE } from './textos';
import { Mapa } from '../piezas/Mapa';
import { rotuloClienteFijo, textoOfertaConfianza } from './agendaFijos';
import { useAlarmaOferta } from '../sonidoOferta';
import { venceOferta } from './ofertaTiempo';
import { CuentaTarifa } from './CuentaTarifa';

/** Lo que manda GET /datos/conductor/operaciones/ofertas (C-OFERTA-COMPLETA). */
export type OfertaViaje = {
  operacionId: string;
  gananciaCentavos: number;
  /** C-QUIEN-PAGA-VIAJES: la tarifa de servicio del pasajero y la comisión entera de Divoox. */
  tarifaServicio?: number;
  comisionDivoox?: number;
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
  /** C-MAPA-VIAJE-DRIVER: los puntos de recogida y destino (los manda el servidor). */
  origenPunto?: { lat: number; lng: number };
  destinoPunto?: { lat: number; lng: number };
  /** C-CUPON-DIVOOX: lo que paga Divoox por el regalo del pasajero (0 sin regalo). */
  regaloDivoox?: number;
  /** C-SALDO-CLIENTE: lo que el pasajero paga con su Saldo Divoox (Divoox te lo paga). */
  saldoDivoox?: number;
  /** C-BS-EN-MANO: lo que cobra en mano, en dólares y en bolívares con la tasa fijada del viaje. */
  enMano?: Monto | null;
  /** C-CARRO-PRUEBAS: «moto» o «carro». */
  servicioId?: string;
  /** C-VIAJE-PROGRAMADO: si es una reserva, para cuándo (ISO). */
  programadoPara?: string | null;
  /** C-CARRO-CATEGORIAS: estandar, comfort, premium o xl. */
  categoria?: string;
  /** C-CARRO-DINAMICA: el multiplicador del viaje (10 000 = precio normal). */
  multiplicadorPb?: number;
  /** C-PRECIO-ZONA: el viaje va con el precio fijo de la zona; y si es de ida y vuelta. */
  precioZona?: boolean;
  idaVuelta?: boolean;
  /** C-VIAJE-PARADAS: las direcciones de las paradas intermedias, en orden. */
  paradas?: string[];
  /** C-CONDUCTOR-CONFIANZA: el cliente lo eligió de confianza (solo para él, por un minuto). */
  deConfianza?: boolean;
  /** C-CLIENTE-FIJO-ROTULO: el primer nombre de su cliente fijo (solo en la oferta exclusiva). */
  clienteNombre?: string | null;
  /** C-VIAJES-FIJOS: sale de un viaje fijo, y el nombre del menor si lleva a uno. */
  viajeFijo?: boolean;
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
  alVencer,
  yo = null,
}: {
  oferta: OfertaViaje;
  idioma: Idioma;
  /** C-MAPA-VIAJE-DRIVER: dónde está el conductor, para el mapa de la oferta. */
  yo?: { lat: number; lng: number } | null;
  alAceptar: () => void;
  alRechazar: () => void;
  /** C-OFERTA-VENCIDA-SE-CIERRA: en 0 s la tarjeta se cierra sola. */
  alVencer: () => void;
}) {
  const textos = enIdioma(TEXTOS_VIAJE, idioma);
  // C-OFERTA-SIN-COBRO: el regalo cubre todo el viaje (nada que cobrar en mano).
  const sinCobro = oferta.metodoPago !== 'tarjeta' && oferta.enMano?.monto === 0;
  // C-SALDO-CLIENTE: «Divoox te paga» suma el regalo y el Saldo Divoox del pasajero.
  const divooxPaga = (oferta.regaloDivoox ?? 0) + (oferta.saldoDivoox ?? 0);
  const conSaldo = (oferta.saldoDivoox ?? 0) > 0;
  // C-ENVIO-TEXTOS: la oferta de un envío dice «envío de paquete», no «viaje».
  const t =
    oferta.servicioId === 'envios' ? { ...textos.oferta, ...textos.ofertaEnvio } : textos.oferta;
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(reloj);
  }, [oferta.operacionId]);
  // C-OFERTA-TIEMPO-REAL: el vencimiento se cuenta desde que llegó la oferta con los segundos que
  // dio el servidor; el reloj del teléfono (a veces corrido) no la da por vencida antes de tiempo.
  const [vence] = useState(() => venceOferta(oferta, Date.now()));
  // C-OFERTA-SUENA-EN-BUCLE: tono en bucle y vibración repetida hasta responder o vencer.
  const callar = useAlarmaOferta(oferta.operacionId, vence);
  const aceptar = () => {
    callar('aceptada');
    alAceptar();
  };
  const rechazar = () => {
    callar('rechazada');
    alRechazar();
  };
  const quedan = Math.max(0, Math.ceil((vence - ahora) / 1000));
  useEffect(() => {
    if (quedan === 0) alVencer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quedan]);
  // C-CONDUCTOR-CONFIANZA: la oferta exclusiva al conductor de confianza dura un minuto.
  const total = oferta.deConfianza ? 60 : 30;
  const lineas = textoOfertaConfianza(oferta, idioma === 'en' ? 'en' : 'es');
  const rotulo = rotuloClienteFijo(oferta, idioma === 'en' ? 'en' : 'es');
  return (
    // C-HOJA-OFERTA: arriba (título, cuenta atrás y lo que gana) y abajo (Aceptar y Rechazar) siempre
    // a la vista; el medio se desplaza si no cabe. Nunca encima de la barra de estado.
    <HojaOferta
      testID="oferta-viaje"
      alCerrar={rechazar}
      arriba={
        <>
          {rotulo ? (
            // C-CLIENTE-FIJO-ROTULO: «Cliente fijo: Marta», grande y arriba de todo.
            <Text
              testID="oferta-cliente-fijo"
              accessibilityRole="header"
              style={{ fontSize: 24, fontWeight: '900', color: C.secundario }}
            >
              {rotulo}
            </Text>
          ) : null}
          {/* C-REDISENO-DRIVER: la etiqueta del servicio (envíos en azul petróleo), el reloj y la
              barra que se vacía; en los últimos 10 s, en rojo. */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <EtiquetaServicioDriver
              tipo={
                oferta.servicioId === 'envios'
                  ? 'envio'
                  : rotulo || oferta.viajeFijo
                    ? 'fijo'
                    : 'viaje'
              }
              icono={
                oferta.servicioId === 'moto'
                  ? 'bicycle-outline'
                  : oferta.servicioId === 'envios'
                    ? 'cube-outline'
                    : undefined
              }
              texto={
                oferta.servicioId === 'carro'
                  ? (new Map(Object.entries(textos.oferta.tituloCategoria)).get(
                      oferta.categoria ?? 'estandar',
                    ) ?? t.tituloCarro)
                  : t.titulo
              }
            />
            <RelojOfertaDriver quedan={quedan} segundos={t.segundos} />
          </View>
          <CuentaAtrasDriver quedan={quedan} total={total} />
          {/* C-PRECIO-PROTAGONISTA: lo que gana, grande, en negrita y en verde, arriba de todo. */}
          <MontoEnMano
            testID="oferta-viaje-ganancia"
            monto={{
              monto: oferta.gananciaCentavos,
              moneda: oferta.moneda ?? 'USD',
              local: null,
              sinTasa: false,
            }}
            idioma={idioma === 'en' ? 'en' : 'es'}
            quien="conductor"
            etiqueta={t.ganas}
            color={C.exito}
            tamano="grande"
          />
          {(() => {
            // C-VIAJE-LARGO-A-LA-VISTA: un viaje largo se avisa en grande antes de aceptar.
            const largo = avisoViajeLargo(
              oferta.viajeM,
              oferta.destino,
              idioma === 'en' ? 'en' : 'es',
            );
            return largo ? (
              <View
                testID="oferta-viaje-largo"
                accessibilityRole="alert"
                style={{
                  borderWidth: 1,
                  borderColor: '#2a2a2a',
                  borderRadius: 12,
                  padding: 12,
                  gap: 4,
                }}
              >
                <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>
                  {largo.titulo}
                </Text>
                {largo.hasta ? (
                  <Text
                    numberOfLines={2}
                    style={{ fontSize: 16, fontWeight: '700', color: C.secundario }}
                  >
                    {largo.hasta}
                  </Text>
                ) : null}
              </View>
            ) : null;
          })()}
          {oferta.metodoPago !== 'tarjeta' && oferta.enMano ? (
            oferta.enMano.monto > 0 ? (
              // C-PRECIO-PROTAGONISTA y C-BS-EN-MANO: lo que cobra en mano, tan grande como lo que gana,
              // con los bolívares debajo donde el país los usa (en EE. UU., solo dólares).
              <View
                testID="oferta-viaje-en-mano"
                style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 12 }}
              >
                <MontoEnMano
                  testID="oferta-en-mano"
                  monto={oferta.enMano}
                  idioma={idioma === 'en' ? 'en' : 'es'}
                  quien="conductor"
                  etiqueta={oferta.metodoPago === 'efectivo' ? t.enEfectivo : t.cobraEnMano}
                  color={C.exito}
                  tamano="grande"
                />
                <CuentaTarifa
                  testID="oferta-cuenta-tarifa"
                  total={oferta.gananciaCentavos + (oferta.comisionDivoox ?? 0)}
                  deDivoox={oferta.comisionDivoox ?? 0}
                  tarifaServicio={oferta.tarifaServicio ?? 0}
                  conRegalo={(oferta.regaloDivoox ?? 0) > 0}
                  moneda={oferta.moneda ?? 'USD'}
                  idioma={idioma}
                />
              </View>
            ) : (
              // C-OFERTA-SIN-COBRO: el regalo cubre todo; se dice en palabras, sin un cero grande.
              <View
                testID="oferta-viaje-sin-cobro"
                style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10 }}
              >
                <Text style={{ fontWeight: '800', color: C.exito }}>{t.noCobrasEnMano}</Text>
              </View>
            )
          ) : oferta.metodoPago === 'efectivo' ? (
            <View
              testID="oferta-viaje-efectivo"
              style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10 }}
            >
              <Text style={{ fontWeight: '800', color: C.secundario }}>{t.enEfectivo}</Text>
            </View>
          ) : null}
        </>
      }
      abajo={
        <>
          <BotonDriver
            texto={t.aceptar}
            alTocar={aceptar}
            variante={oferta.servicioId === 'envios' ? 'petroleo' : 'negro'}
            testID="oferta-aceptar"
          />
          <RechazarDriver texto={t.rechazar} alTocar={rechazar} testID="oferta-rechazar" />
          <Text style={{ color: '#6B7078', fontSize: 12, textAlign: 'center' }}>
            {t.sinCastigo}
          </Text>
        </>
      }
    >
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
      {divooxPaga > 0 ? (
        <View
          testID="oferta-viaje-regalo"
          style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10 }}
        >
          <Text style={{ fontWeight: '800', color: C.exito }}>
            {(conSaldo
              ? sinCobro
                ? textos.oferta.saldoOfertaTodo
                : textos.oferta.saldoOferta
              : sinCobro
                ? t.regaloOfertaTodo
                : t.regaloOferta
            ).replace('{monto}', formatearMonto(divooxPaga, oferta.moneda ?? 'USD', idioma))}
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
            {textos.oferta.dinamica} {textoMultiplicador(oferta.multiplicadorPb ?? 10_000, idioma)}
          </Text>
          <Text style={{ color: '#666B73', fontSize: 12 }}>{textos.oferta.dinamicaAyuda}</Text>
        </View>
      ) : null}
      {oferta.precioZona ? (
        // C-PRECIO-ZONA: el conductor sabe que es el precio fijo de la zona (y si es ida y vuelta).
        <View
          testID="oferta-viaje-precio-zona"
          style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 10, padding: 10 }}
        >
          <Text style={{ fontWeight: '800', color: C.secundario }}>{textos.oferta.precioZona}</Text>
          <Text style={{ color: '#666B73', fontSize: 12 }}>
            {oferta.idaVuelta ? textos.oferta.idaVuelta : textos.oferta.precioZonaAyuda}
          </Text>
        </View>
      ) : null}
      {oferta.origenPunto && oferta.destinoPunto ? (
        // C-MAPA-VIAJE-DRIVER: como las apps de conductores, el recorrido a la vista antes de
        // aceptar (pequeño: lo que gana sigue siendo lo primero).
        <View
          testID="oferta-viaje-mapa"
          style={{ borderRadius: 12, overflow: 'hidden', marginTop: 6 }}
        >
          <Mapa
            yo={yo}
            restaurante={oferta.origenPunto}
            casa={oferta.destinoPunto}
            vistaPrevia
            alto={150}
            etiquetas={{
              yo: textos.activo.mapaYo,
              restaurante: textos.activo.mapaRecogida,
              casa: textos.activo.mapaDestino,
            }}
          />
        </View>
      ) : null}
      {/* C-REDISENO-DRIVER: tres datos en cajitas y la ruta recoger → paradas → llevar. */}
      <DatosTresDriver
        datos={[
          ...(oferta.recogidaM != null
            ? [{ valor: distancia(oferta.recogidaM, idioma), nombre: t.recogida }]
            : []),
          ...(oferta.viajeM != null
            ? [{ valor: distancia(oferta.viajeM, idioma), nombre: t.viaje }]
            : []),
          ...(oferta.viajeS != null
            ? [{ valor: `${Math.max(1, Math.round(oferta.viajeS / 60))}`, nombre: t.minutos }]
            : []),
        ]}
      />
      <View testID="oferta-viaje-paradas-y-ruta">
        {oferta.paradas?.length ? (
          // C-VIAJE-PARADAS: por dónde para el viaje antes del destino.
          <View testID="oferta-viaje-paradas" style={{ marginBottom: 4 }}>
            <Text style={{ color: DK.gris, fontSize: 12 }}>
              {textos.oferta.conParadas(oferta.paradas.length)}
            </Text>
          </View>
        ) : null}
        <RutaDriver
          puntos={[
            { etiqueta: t.recoger, lugar: oferta.origen },
            ...(oferta.paradas ?? []).map((d, i) => ({ etiqueta: `${i + 1}.`, lugar: d })),
            { etiqueta: t.llevar, lugar: oferta.destino },
          ]}
        />
      </View>
      {oferta.metodoPago === 'tarjeta' ? (
        <LineaInfoDriver
          icono="card-outline"
          texto={idioma === 'en' ? 'Paid by card in the app' : 'Pago con tarjeta en la app'}
        />
      ) : null}
    </HojaOferta>
  );
}
