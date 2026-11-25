import { useEffect, useState } from 'react';
import { View } from 'react-native';
import {
  type Idioma,
  type MontoEnMano as Monto,
  formatearMonto,
  textoDistancia,
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
import { textosGrandes } from './textos';
import { useAlarmaOferta } from '../sonidoOferta';

export type OfertaCompleta = {
  id: string;
  pagoRepartidor: number;
  propina: number;
  bono?: number;
  /** C-PAGO-PICO: «hora_pico» u «oferta_abierta». */
  bonoMotivo?: string | null;
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
  /** C-PRECIO-PROTAGONISTA: lo que cobra en mano (sin propina), con los bolívares donde aplica. */
  enManoCobro?: Monto | null;
  total?: number;
  /** C-DISTANCIA-POR-PAIS: país del pedido (millas en EE. UU.). */
  pais?: string | null;
};

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
  alVencer,
}: {
  oferta: OfertaCompleta;
  idioma: Idioma;
  alAceptar: () => void;
  alRechazar: () => void;
  /** C-OFERTA-VENCIDA-SE-CIERRA: en 0 s la tarjeta se cierra sola. */
  alVencer?: () => void;
}) {
  const t = textosGrandes(idioma).oferta;
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), 500);
    return () => clearInterval(reloj);
  }, [oferta.id]);
  const desde = oferta.ofertaEn
    ? new Date(`${oferta.ofertaEn.replace(' ', 'T')}Z`).getTime()
    : null;
  const total = oferta.segundos ?? 45;
  // C-OFERTA-SUENA-EN-BUCLE: tono en bucle y vibración repetida hasta responder o vencer.
  const [vence] = useState(() => (desde ?? Date.now()) + total * 1000);
  const callar = useAlarmaOferta(oferta.id, vence);
  const aceptar = () => {
    callar('aceptada');
    alAceptar();
  };
  const rechazar = () => {
    callar('rechazada');
    alRechazar();
  };
  // Revisor (18 nov 2026): sin `ofertaEn`, cuenta desde que llegó (antes nunca llegaba a 0).
  const quedan = Math.max(0, Math.ceil((vence - ahora) / 1000));
  useEffect(() => {
    if (quedan === 0) alVencer?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quedan]);
  const n = oferta.articulos ?? 0;
  // C-PRECIO-PROTAGONISTA: lo que cobra en mano lo manda el servidor (con la tasa del pedido); un
  // servidor viejo sin ese dato deja el total sin la propina, solo en su moneda.
  const cobro: Monto | null =
    oferta.enManoCobro ??
    (oferta.total != null
      ? {
          monto: oferta.total - oferta.propina,
          moneda: oferta.moneda ?? 'USD',
          local: null,
          sinTasa: false,
        }
      : null);
  return (
    // C-HOJA-OFERTA: arriba (título, cuenta atrás y lo que gana) y abajo (Aceptar y Rechazar) siempre
    // a la vista; el medio se desplaza si no cabe. Nunca encima de la barra de estado.
    <HojaOferta
      testID="oferta-completa"
      alCerrar={rechazar}
      arriba={
        <>
          {/* C-REDISENO-DRIVER: la etiqueta de Comida, el reloj y la barra que se vacía. */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <EtiquetaServicioDriver tipo="comida" texto={t.titulo} />
            <RelojOfertaDriver quedan={quedan} segundos={t.segundos} />
          </View>
          <CuentaAtrasDriver quedan={quedan} total={total} />
          {/* C-PRECIO-PROTAGONISTA: lo que gana, grande, en negrita y en verde, arriba de todo. */}
          <MontoEnMano
            testID="oferta-ganancia"
            monto={{
              monto: oferta.pagoRepartidor,
              moneda: oferta.moneda ?? 'USD',
              local: null,
              sinTasa: false,
            }}
            idioma={idioma === 'en' ? 'en' : 'es'}
            quien="conductor"
            etiqueta={t.garantizado}
            color={C.exito}
            tamano="grande"
          />
          {oferta.metodoPago && oferta.metodoPago !== 'tarjeta' && cobro ? (
            // C-PRECIO-PROTAGONISTA y C-BS-EN-MANO: cuánto cobra en mano, tan grande como lo que gana,
            // con los bolívares debajo donde el país los usa (en EE. UU., solo dólares).
            <View
              testID="oferta-cobro-en-mano"
              style={{
                borderWidth: 1,
                borderColor: '#2a2a2a',
                borderRadius: 12,
                padding: 12,
                gap: 4,
              }}
            >
              <MontoEnMano
                testID="oferta-cobro-monto"
                monto={cobro}
                idioma={idioma === 'en' ? 'en' : 'es'}
                quien="conductor"
                etiqueta={oferta.metodoPago === 'efectivo' ? t.enEfectivo : t.porTransferencia}
                color={C.exito}
                tamano="grande"
              />
              <Text style={{ color: '#666B73', fontSize: 13 }}>{t.propinaAparte}</Text>
              {oferta.adelantoLocal ? (
                <Text style={{ color: '#666B73' }}>
                  {t.adelantas.replace(
                    '{monto}',
                    formatearMonto(oferta.adelantoLocal, oferta.moneda, idioma),
                  )}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      }
      abajo={
        <>
          <BotonDriver
            texto={t.aceptar}
            alTocar={aceptar}
            variante="negro"
            testID="oferta-aceptar"
          />
          <RechazarDriver texto={t.rechazar} alTocar={rechazar} testID="oferta-rechazar" />
          <Text style={{ color: '#6B7078', fontSize: 12, textAlign: 'center' }}>
            {t.vence} {t.sinCastigo}
          </Text>
        </>
      }
    >
      {oferta.propina > 0 ? (
        <Text style={{ color: '#666B73' }}>
          {t.conPropina} {formatearMonto(oferta.propina, oferta.moneda, idioma)}
        </Text>
      ) : null}
      {oferta.bono ? (
        <Text style={{ color: C.exito, fontWeight: '700' }}>
          {oferta.bonoMotivo === 'hora_pico' ? t.bonoPico : t.bono}{' '}
          {formatearMonto(oferta.bono, oferta.moneda, idioma)}
        </Text>
      ) : null}
      {/* C-REDISENO-DRIVER: los datos en cajitas y la ruta local → cliente. */}
      <DatosTresDriver
        datos={[
          ...(oferta.distanciaAlLocalKm != null
            ? [
                {
                  valor: textoDistancia(oferta.distanciaAlLocalKm, idioma, oferta.pais),
                  nombre: t.alLocal,
                },
              ]
            : []),
          ...(oferta.distanciaTotalKm != null
            ? [
                {
                  valor: textoDistancia(oferta.distanciaTotalKm, idioma, oferta.pais),
                  nombre: t.total,
                },
              ]
            : []),
          ...(oferta.minutosEstimados != null
            ? [{ valor: `${oferta.minutosEstimados}`, nombre: t.minutos }]
            : []),
        ]}
      />
      <RutaDriver
        puntos={[
          {
            etiqueta: t.recoger,
            lugar: `${oferta.restaurante.nombre}${
              oferta.minutosParaListo
                ? ` · ${t.listoEn} ${oferta.minutosParaListo} min`
                : ` · ${t.listoYa}`
            }`,
          },
          { etiqueta: t.entregar, lugar: oferta.direccion },
        ]}
      />
      <Text style={{ color: DK.gris, fontSize: 12.5 }} numberOfLines={2}>
        {oferta.restaurante.direccion}
      </Text>
      {n ? (
        <LineaInfoDriver
          icono="bag-handle-outline"
          texto={`${n} ${n === 1 ? t.articulo : t.articulos}`}
          testID="oferta-articulos"
        />
      ) : null}
    </HojaOferta>
  );
}
