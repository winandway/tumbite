import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, Share, Text, View } from 'react-native';
import {
  ErrorApi,
  type Referencia,
  enIdioma,
  formatearMonto,
  textoReferencia,
} from '@tumbite/compartido';
import { Boton, C, Campo, URL_SERVIDOR, leerTokenGuardado, useSesion } from '@tumbite/movil';
import { MapaEntrega } from '../MapaEntrega';
import { Tarjeta } from '../comida/piezas';
import { miUbicacion } from '../ubicacion';
import { TEXTOS_MOTO } from './textos';

/** Lo que manda GET /datos/viajes/actual y /datos/viajes/:id. */
export type ViajePasajero = {
  id: string;
  /** C-CARRO-VIAJE-PASAJERO: moto, carro o envios, y en Carro si es XL. */
  servicio?: string;
  categoria?: string;
  estado: string;
  pin: string | null;
  metodoPago: string;
  origen: { direccion: string; lat: number; lng: number };
  destino: { direccion: string; lat: number; lng: number };
  total: number | null;
  moneda: string | null;
  conductor: {
    nombre: string;
    ubicacion: { lat: number; lng: number } | null;
    vehiculo: {
      tipo?: string | null;
      marca: string | null;
      modelo: string | null;
      color: string | null;
      placa: string | null;
      plazas?: number | null;
    };
    /** Minutos estimados hasta la recogida (viene en camino) o hasta el destino (en curso). */
    llegadaMin?: number | null;
    /** Hay foto verificada del conductor (su selfie aprobada). */
    foto?: boolean;
  } | null;
  cancelacion: { cargo: number; gratisPorS: number | null } | null;
  /** C-PAGO-MOVIL-VIAJE: a quién pagar y si el conductor ya confirmó que le llegó. */
  pagoMovil?: {
    datos: { banco: string | null; titular: string | null; identificador: string } | null;
    confirmado: 'recibido' | 'no_recibido' | null;
  } | null;
  /** C-BS-REFERENCIA: el equivalente en bolívares (solo informativo). */
  referencia?: Referencia | null;
};

/** C-ENVIOS: lo que manda el servidor del paquete de un envío. */
export type PaqueteCliente = {
  descripcion: string;
  valorDeclarado: number;
  destinatario: string;
  pinEntrega: string | null;
  recogido: boolean;
  entregado: boolean;
};

const FINALES = new Set(['terminado', 'cancelado', 'sin_conductor', 'no_show']);

/**
 * C-CARRO-VIAJE-PASAJERO: la foto del conductor (privada, con la sesión). Sin foto o si no carga, la
 * inicial de su nombre en un círculo, como Uber.
 */
function FotoConductor({
  viajeId,
  nombre,
  hay,
}: {
  viajeId: string;
  nombre: string;
  hay: boolean;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  useEffect(() => {
    if (hay) void leerTokenGuardado().then(setToken);
  }, [hay]);
  const lado = 56;
  if (!hay || fallo || !token)
    return (
      <View
        style={{
          width: lado,
          height: lado,
          borderRadius: lado / 2,
          backgroundColor: '#EEF0F3',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontWeight: '700', fontSize: 22, color: C.secundario }}>
          {nombre.slice(0, 1).toUpperCase()}
        </Text>
      </View>
    );
  return (
    <Image
      accessibilityIgnoresInvertColors
      onError={() => setFallo(true)}
      source={{
        uri: `${URL_SERVIDOR}/datos/viajes/${viajeId}/conductor/foto`,
        headers: { authorization: `Bearer ${token}` },
      }}
      style={{ width: lado, height: lado, borderRadius: lado / 2 }}
    />
  );
}

/**
 * El viaje del pasajero mientras pasa (M5), como Uber Moto: buscando conductor; conductor
 * asignado con su nombre, su moto y su placa; el código para empezar; el mapa con el conductor;
 * en camino; y al llegar, cuánto pagar en efectivo. Cancelar dice antes cuánto cuesta.
 */
export function ViajeEnCurso({
  viaje,
  paquete = null,
  alCambiar,
  alTerminar,
}: {
  viaje: ViajePasajero;
  paquete?: PaqueteCliente | null;
  alCambiar: () => void;
  alTerminar: () => void;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS_MOTO, idioma);
  const [error, setError] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [cargoCobrado, setCargoCobrado] = useState<number | null>(null);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [calificado, setCalificado] = useState(false);
  // C-VIAJE-PROPINA: propina después del viaje, con la tarjeta con la que pagó.
  const [propina, setPropina] = useState<number | null>(null);
  async function darPropina(centavos: number) {
    setError('');
    try {
      await api.pedir('POST', `/datos/viajes/${viaje.id}/propina`, { centavos });
      setPropina(centavos);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function calificar() {
    setError('');
    try {
      await api.pedir('POST', `/datos/viajes/${viaje.id}/calificar`, { estrellas, comentario });
      setCalificado(true);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  const titulo = new Map([
    ['buscando', t.buscando],
    ['pago_pendiente', t.buscando],
    ['asignado', t.asignado],
    ['conductor_llego', t.llego],
    ['en_curso', t.enCurso],
    ['terminado', t.terminado],
    ['cancelado', t.cancelado],
    ['sin_conductor', t.sinConductor],
    ['no_show', t.noShow],
  ]).get(viaje.estado);
  const monto = (m: number) => formatearMonto(m, viaje.moneda ?? 'USD', idioma);
  const moto = viaje.conductor?.vehiculo;
  // C-CARRO-VIAJE-PASAJERO: cada servicio rotula su vehículo (Moto, Carro, Carro XL, Envío).
  const nombreVehiculo =
    viaje.servicio === 'carro'
      ? viaje.categoria === 'xl'
        ? t.vehiculoCarroXl
        : t.vehiculoCarro
      : viaje.servicio === 'envios'
        ? t.vehiculoEnvio
        : t.moto;
  const llegada = viaje.conductor?.llegadaMin;

  async function cancelar() {
    setCancelando(true);
    setError('');
    try {
      const r = await api.pedir<{ cargo: number }>(
        'POST',
        `/datos/viajes/${viaje.id}/cancelar`,
        {},
        {
          cabeceras: {
            'idempotency-key': `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`,
          },
        },
      );
      if (r.cargo > 0) setCargoCobrado(r.cargo);
      alCambiar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setCancelando(false);
    }
  }

  async function compartir() {
    setError('');
    try {
      const r = await api.pedir<{ url: string }>('POST', `/datos/viajes/${viaje.id}/compartir`);
      await Share.share({ message: `${t.compartirMensaje} ${r.url}` });
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  /** Emergencia: primero la llamada (aunque falle el aviso), después el aviso al equipo. */
  async function emergencia() {
    const p = await miUbicacion().catch(() => null);
    const r = await api
      .pedir<{ numero: string }>('POST', `/datos/viajes/${viaje.id}/emergencia`, p ?? {})
      .catch(() => ({ numero: '911' }));
    void Linking.openURL(`tel:${r.numero}`);
  }
  const conConductor = ['asignado', 'conductor_llego', 'en_curso'].includes(viaje.estado);

  return (
    <View testID="viaje-pasajero" style={{ gap: 12 }}>
      <Text
        accessibilityRole="header"
        testID={`viaje-estado-${viaje.estado}`}
        style={{ fontSize: 24, fontWeight: '700', color: C.secundario }}
      >
        {titulo}
      </Text>

      {!FINALES.has(viaje.estado) ? (
        <MapaEntrega
          restaurante={{ lat: viaje.origen.lat, lng: viaje.origen.lng }}
          casa={{ lat: viaje.destino.lat, lng: viaje.destino.lng }}
          repartidor={viaje.conductor?.ubicacion ?? null}
          nombreRepartidor={viaje.conductor?.nombre}
          etiquetas={{
            restaurante: t.etiquetaRecogida,
            casa: t.etiquetaDestino,
            repartidor: t.etiquetaConductor,
          }}
        />
      ) : null}

      {viaje.conductor ? (
        <Tarjeta>
          <View testID="viaje-conductor" style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <FotoConductor
                viajeId={viaje.id}
                nombre={viaje.conductor.nombre}
                hay={Boolean(viaje.conductor.foto)}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', fontSize: 18, color: C.secundario }}>
                  {viaje.conductor.nombre}
                </Text>
                {llegada && (viaje.estado === 'asignado' || viaje.estado === 'en_curso') ? (
                  <Text testID="viaje-llegada" style={{ fontWeight: '700', color: C.exito }}>
                    {viaje.estado === 'asignado' ? t.llegaEn(llegada) : t.destinoEn(llegada)}
                  </Text>
                ) : null}
              </View>
            </View>
            <Text style={{ color: '#5E5E5E' }}>
              {nombreVehiculo}:{' '}
              {[moto?.marca, moto?.modelo, moto?.color].filter(Boolean).join(' · ')}
              {viaje.servicio === 'carro' && moto?.plazas ? ` · ${t.plazas(moto.plazas)}` : ''}
            </Text>
            {moto?.placa ? (
              <Text style={{ fontWeight: '700', color: C.secundario, letterSpacing: 1 }}>
                {t.placa}: {moto.placa}
              </Text>
            ) : null}
          </View>
        </Tarjeta>
      ) : null}

      {paquete ? (
        <Tarjeta>
          <Text style={{ fontWeight: '700', color: C.secundario }}>
            {paquete.descripcion} · {t.paraQuien} {paquete.destinatario}
          </Text>
          {paquete.pinEntrega ? (
            <>
              <Text style={{ marginTop: 6, color: '#5E5E5E' }}>{t.pinEntrega}</Text>
              <Text
                testID="envio-pin"
                style={{ fontSize: 30, fontWeight: '700', letterSpacing: 8, color: C.secundario }}
              >
                {paquete.pinEntrega}
              </Text>
              <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.pinEntregaAyuda}</Text>
            </>
          ) : null}
        </Tarjeta>
      ) : null}
      {viaje.pin && viaje.estado !== 'buscando' ? (
        <Tarjeta>
          <View testID="viaje-codigo" style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#5E5E5E', fontWeight: '700' }}>{t.codigo}</Text>
            <Text
              style={{ fontSize: 40, fontWeight: '700', letterSpacing: 10, color: C.secundario }}
            >
              {viaje.pin}
            </Text>
            <Text style={{ color: '#5E5E5E', textAlign: 'center' }}>{t.codigoAyuda}</Text>
          </View>
        </Tarjeta>
      ) : null}

      {viaje.pagoMovil?.datos ? (
        <Tarjeta>
          <View testID="viaje-pago-movil" style={{ gap: 2 }}>
            <Text style={{ color: '#5E5E5E', fontWeight: '700' }}>{t.pagoMovilDatos}</Text>
            {viaje.pagoMovil.datos.banco ? (
              <Text style={{ color: C.secundario }}>{viaje.pagoMovil.datos.banco}</Text>
            ) : null}
            {viaje.pagoMovil.datos.titular ? (
              <Text style={{ color: C.secundario }}>{viaje.pagoMovil.datos.titular}</Text>
            ) : null}
            <Text selectable style={{ fontWeight: '700', color: C.secundario }}>
              {viaje.pagoMovil.datos.identificador}
            </Text>
            {viaje.pagoMovil.confirmado === 'recibido' ? (
              <Text style={{ color: '#0D7A3A', fontWeight: '700' }}>{t.pagoMovilConfirmado}</Text>
            ) : viaje.pagoMovil.confirmado === 'no_recibido' ? (
              <Text style={{ color: C.primario }}>{t.pagoMovilNoLlego}</Text>
            ) : (
              <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.pagoMovilAyuda}</Text>
            )}
          </View>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.etiquetaRecogida}</Text>
        <Text style={{ fontWeight: '700', color: C.secundario }}>{viaje.origen.direccion}</Text>
        <Text style={{ color: '#5E5E5E', fontSize: 12, marginTop: 8 }}>{t.etiquetaDestino}</Text>
        <Text style={{ fontWeight: '700', color: C.secundario }}>{viaje.destino.direccion}</Text>
        {viaje.total != null ? (
          <Text style={{ marginTop: 8, fontWeight: '700', color: C.secundario }}>
            {viaje.estado === 'terminado'
              ? viaje.metodoPago === 'tarjeta'
                ? t.pagadoTarjeta
                : viaje.metodoPago === 'pago_movil'
                  ? t.pagoMovil
                  : t.pagaEfectivo
              : t.precioFijo}
            : {monto(viaje.total)}
          </Text>
        ) : null}
        {viaje.referencia ? (
          <Text testID="viaje-precio-bs" style={{ color: '#5E5E5E' }}>
            {textoReferencia(viaje.referencia, idioma)}
          </Text>
        ) : null}
      </Tarjeta>

      {conConductor ? (
        <View style={{ gap: 8 }}>
          <Boton texto={t.compartir} alTocar={() => void compartir()} secundario />
          <Boton texto={t.emergencia} alTocar={() => void emergencia()} />
          <Text style={{ color: '#5E5E5E', fontSize: 12, textAlign: 'center' }}>
            {t.emergenciaAyuda}
          </Text>
        </View>
      ) : null}
      {cargoCobrado ? (
        <Text style={{ color: '#5E5E5E' }}>
          {t.cargoCobrado} {monto(cargoCobrado)}
        </Text>
      ) : null}
      {viaje.cancelacion ? (
        <>
          <Text style={{ color: '#5E5E5E', textAlign: 'center' }}>
            {viaje.cancelacion.cargo === 0
              ? t.cancelarGratis
              : `${t.cancelarCargo} ${monto(viaje.cancelacion.cargo)}`}
          </Text>
          <Boton
            texto={paquete ? t.cancelarEnvio : t.cancelar}
            alTocar={() => void cancelar()}
            cargando={cancelando}
            secundario
          />
        </>
      ) : null}
      {viaje.estado === 'terminado' && !calificado ? (
        <Tarjeta>
          <View testID="viaje-calificar" style={{ gap: 8 }}>
            <Text style={{ fontWeight: '700', fontSize: 18, color: C.secundario }}>
              {t.calificar}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setEstrellas(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${n} ${t.estrella}`}
                  accessibilityState={{ selected: estrellas === n }}
                  testID={`estrella-${n}`}
                >
                  <Text style={{ fontSize: 34, color: n <= estrellas ? C.exito : '#C9CED6' }}>
                    ★
                  </Text>
                </Pressable>
              ))}
            </View>
            <Campo etiqueta={t.comentario} value={comentario} onChangeText={setComentario} />
            {estrellas ? (
              <Boton texto={t.enviarCalificacion} alTocar={() => void calificar()} exito />
            ) : null}
          </View>
        </Tarjeta>
      ) : null}
      {calificado ? <Text style={{ color: C.exito, fontWeight: '700' }}>{t.gracias}</Text> : null}
      {viaje.estado === 'terminado' && viaje.metodoPago === 'tarjeta' ? (
        <Tarjeta>
          {propina ? (
            <Text style={{ color: C.exito, fontWeight: '700' }}>
              {t.propinaGracias} {monto(propina)}
            </Text>
          ) : (
            <View testID="viaje-propina" style={{ gap: 8 }}>
              <Text style={{ fontWeight: '700', color: C.secundario }}>{t.propinaTitulo}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[100, 200, 500].map((c) => (
                  <View key={c} style={{ flex: 1 }}>
                    <Boton texto={monto(c)} alTocar={() => void darPropina(c)} secundario />
                  </View>
                ))}
              </View>
            </View>
          )}
        </Tarjeta>
      ) : null}
      {FINALES.has(viaje.estado) ? (
        <Boton texto={t.otraVez} alTocar={alTerminar} exito={viaje.estado === 'terminado'} />
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
