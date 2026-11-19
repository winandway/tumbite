import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  type Idioma,
  type MontoEnMano as Monto,
  formatearMonto,
  textoDistancia,
} from '@tumbite/compartido';
import { Boton, C, HojaOferta, MontoEnMano, Text } from '@tumbite/movil';
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
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Text style={{ color: C.primario, fontWeight: '800', fontSize: 16 }}>{t.titulo}</Text>
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
                width: `${Math.round((quedan / total) * 100)}%`,
                height: 4,
                backgroundColor: quedan <= 10 ? C.primario : '#B9BFC9',
              }}
            />
          </View>
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
          <Boton texto={t.aceptar} alTocar={aceptar} exito />
          <Pressable onPress={rechazar} accessibilityRole="button" accessibilityLabel={t.rechazar}>
            <Text style={{ textAlign: 'center', color: '#666B73', fontWeight: '700', padding: 8 }}>
              {t.rechazar}
            </Text>
          </Pressable>
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
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
        {oferta.distanciaAlLocalKm != null ? (
          <Dato
            valor={textoDistancia(oferta.distanciaAlLocalKm, idioma, oferta.pais)}
            nombre={t.alLocal}
          />
        ) : null}
        {oferta.distanciaTotalKm != null ? (
          <Dato
            valor={textoDistancia(oferta.distanciaTotalKm, idioma, oferta.pais)}
            nombre={t.total}
          />
        ) : null}
        {oferta.minutosEstimados != null ? (
          <Dato valor={`${oferta.minutosEstimados}`} nombre={t.minutos} />
        ) : null}
        {n ? <Dato valor={`${n}`} nombre={n === 1 ? t.articulo : t.articulos} /> : null}
      </View>
      <View style={{ marginTop: 6 }}>
        <Text style={{ color: '#666B73', fontSize: 12 }}>{t.recoger}</Text>
        <Text style={{ fontWeight: '800', color: C.secundario }}>
          {oferta.restaurante.nombre}
          {oferta.minutosParaListo
            ? ` · ${t.listoEn} ${oferta.minutosParaListo} min`
            : ` · ${t.listoYa}`}
        </Text>
        <Text style={{ color: '#666B73' }} numberOfLines={1}>
          {oferta.restaurante.direccion}
        </Text>
      </View>
      <View>
        <Text style={{ color: '#666B73', fontSize: 12 }}>{t.entregar}</Text>
        <Text style={{ fontWeight: '800', color: C.secundario }} numberOfLines={2}>
          {oferta.direccion}
        </Text>
      </View>
    </HojaOferta>
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
    <Text style={{ color: '#666B73', fontSize: 11 }}>{nombre}</Text>
  </View>
);
