import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import {
  type CotizacionViaje,
  ErrorApi,
  type Idioma,
  enIdioma,
  formatearMonto,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  Campo,
  CampoDireccion,
  alSalirTelefono,
  almacenTelefono,
  useSesion,
} from '@tumbite/movil';
import { ElegirEnMapa } from '../ElegirEnMapa';
import { Pildora, Tarjeta } from '../comida/piezas';
import { PagoTarjeta } from '../PagoTarjeta';
import type { Cobro } from '../pagoTipos';
import { type Punto, miUbicacion } from '../ubicacion';
import { TEXTOS_MOTO } from './textos';

const distancia = (m: number, i: Idioma) =>
  i === 'en' ? `${((m / 1000) * 0.621371).toFixed(1)} mi` : `${(m / 1000).toFixed(1)} km`;

/**
 * Pedir Moto como en Uber Moto (M5): recogida en tu ubicación, «¿A dónde vas?», precio fijo antes de
 * pedir, nota del casco y un pasajero. El precio lo calcula y lo guarda el servidor; la app solo
 * manda el id de la cotización. Antes de que venza, se vuelve a cotizar sola (visto con REA en
 * Locomotion). Lo escrito no se pierde (borrador).
 */
export function PedirMoto({
  deudaPendiente,
  alPedir,
  servicio = 'moto',
}: {
  /** C-CARRO-PRUEBAS / C-ENVIOS: el mismo formulario pide Moto, Carro o un Envío. */
  servicio?: 'moto' | 'carro' | 'envios';
  deudaPendiente: { monto: number; moneda: string | null } | null;
  alPedir: (viajeId: string) => void;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS_MOTO, idioma);
  const b = useBorrador({
    formulario: servicio,
    cuenta: usuario?.id,
    inicial: {
      recogida: '',
      destino: '',
      destinoLat: '',
      destinoLng: '',
      recogidaLat: '',
      recogidaLng: '',
      // C-VIAJE-TARJETA: cómo paga el viaje.
      metodo: 'efectivo',
      // C-CARRO-XL: en Carro, normal o grande (6 plazas o más).
      categoria: 'estandar',
      // C-ENVIOS: qué se envía y quién lo recibe.
      paqueteDescripcion: '',
      paqueteValor: '',
      destinatarioNombre: '',
      destinatarioTelefono: '',
      sinProhibidos: false,
    },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const { valores: v, cambiar } = b;
  const [cotizacion, setCotizacion] = useState<CotizacionViaje | null>(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  // C-VIAJE-TARJETA: con tarjeta, el cobro abierto y la hoja de pago de siempre (la de Comida).
  const [cobro, setCobro] = useState<(Cobro & { viajeId: string }) | null>(null);
  const tarjeta = v.metodo === 'tarjeta';

  // La recogida arranca en la ubicación de ahora (se puede mover en el mapa de recogida).
  useEffect(() => {
    if (v.recogidaLat) return;
    void miUbicacion().then((p) => {
      if (!p) return;
      cambiar('recogidaLat', String(p.lat));
      cambiar('recogidaLng', String(p.lng));
    });
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recogida = useMemo<Punto | null>(
    () => (v.recogidaLat ? { lat: Number(v.recogidaLat), lng: Number(v.recogidaLng) } : null),
    [v.recogidaLat, v.recogidaLng],
  );
  const destino = useMemo<Punto | null>(
    () => (v.destinoLat ? { lat: Number(v.destinoLat), lng: Number(v.destinoLng) } : null),
    [v.destinoLat, v.destinoLng],
  );

  const cotizar = useCallback(async () => {
    setError('');
    if (!recogida) return setError(t.faltaOrigen);
    if (!destino || v.destino.trim().length < 3) return setError(t.faltaDestino);
    setTrabajando(true);
    try {
      const r = await api.pedir<{ cotizacion: CotizacionViaje }>('POST', '/datos/viajes/cotizar', {
        servicio,
        categoria: servicio === 'carro' && v.categoria === 'xl' ? 'xl' : 'estandar',
        origen: { ...recogida, direccion: v.recogida.trim() || t.recogida },
        destino: { ...destino, direccion: v.destino.trim() },
      });
      setCotizacion(r.cotizacion);
    } catch (x) {
      setCotizacion(null);
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setTrabajando(false);
    }
  }, [api, recogida, destino, v.recogida, v.destino, t, servicio, v.categoria]);

  // Volver a cotizar sola 20 segundos antes de que venza el precio.
  const cotizarRef = useRef(cotizar);
  useEffect(() => {
    cotizarRef.current = cotizar;
  }, [cotizar]);
  useEffect(() => {
    if (!cotizacion) return;
    const vence = Date.parse(`${cotizacion.venceEn.replace(' ', 'T')}Z`);
    const espera = Math.max(5_000, vence - Date.now() - 20_000);
    const r = setTimeout(() => void cotizarRef.current(), espera);
    return () => clearTimeout(r);
  }, [cotizacion]);

  async function pedir() {
    if (!cotizacion) return;
    setError('');
    setTrabajando(true);
    try {
      const r = await api.pedir<{ viaje: { id: string }; pago?: Omit<Cobro, 'pedidoId'> }>(
        'POST',
        '/datos/viajes',
        {
          cotizacionId: cotizacion.id,
          metodoPago: tarjeta ? 'tarjeta' : 'efectivo',
          ...(servicio === 'envios'
            ? {
                paquete: {
                  descripcion: v.paqueteDescripcion,
                  valorDeclarado: textoAMonto(v.paqueteValor || '0', cotizacion.moneda),
                  destinatario: { nombre: v.destinatarioNombre, telefono: v.destinatarioTelefono },
                  sinProhibidos: v.sinProhibidos,
                },
              }
            : {}),
        },
      );
      if (r.pago) {
        setCobro({ ...r.pago, pedidoId: r.viaje.id, viajeId: r.viaje.id });
        return;
      }
      await b.limpiar();
      alPedir(r.viaje.id);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      // Si el precio venció entre medio, se trae uno nuevo.
      void cotizar();
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <AvisoBorrador visible={b.recuperado} idioma={idioma} empezar={b.empezarDeNuevo} />
      {/* C-DIRECCION-SUGERENCIAS: recogida y destino con direcciones reales y su punto exacto. */}
      <CampoDireccion
        etiqueta={t.recogida}
        placeholder={servicio === 'envios' ? t.recogidaEnvio : t.recogidaAyuda}
        valor={v.recogida}
        cambiar={(x) => {
          cambiar('recogida', x);
          setCotizacion(null);
        }}
        alElegir={(d) => {
          cambiar('recogidaLat', String(d.punto.lat));
          cambiar('recogidaLng', String(d.punto.lng));
          setCotizacion(null);
        }}
        cerca={recogida}
        testID="moto-recogida"
      />
      <CampoDireccion
        etiqueta={servicio === 'envios' ? t.destinoEnvio : t.destino}
        placeholder={servicio === 'envios' ? t.destinoEnvio : t.destino}
        valor={v.destino}
        cambiar={(x) => {
          cambiar('destino', x);
          setCotizacion(null);
        }}
        alElegir={(d) => {
          cambiar('destinoLat', String(d.punto.lat));
          cambiar('destinoLng', String(d.punto.lng));
          setCotizacion(null);
        }}
        cerca={recogida}
        testID="moto-destino"
      />
      <ElegirEnMapa
        punto={destino}
        cambiarPunto={(p) => {
          cambiar('destinoLat', String(p.lat));
          cambiar('destinoLng', String(p.lng));
          setCotizacion(null);
        }}
        cambiarDireccion={(d) => {
          if (!v.destino.trim()) cambiar('destino', d);
        }}
        textos={{ ayuda: t.destinoAyuda, buscando: t.buscandoCalle, pin: t.pinDestino }}
      />
      {/* C-TEXTOS-POR-SERVICIO: cada servicio dice lo suyo. */}
      <Text style={{ color: '#5E5E5E' }}>
        {servicio === 'carro' ? t.avisoCarro : servicio === 'envios' ? t.avisoEnvio : t.casco}
      </Text>
      {servicio === 'moto' ? <Text style={{ color: '#5E5E5E' }}>{t.unPasajero}</Text> : null}

      {servicio === 'carro' ? (
        <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
          <Pildora
            texto={t.carroNormal}
            activa={v.categoria !== 'xl'}
            alTocar={() => {
              cambiar('categoria', 'estandar');
              setCotizacion(null);
            }}
            rol="radio"
          />
          <Pildora
            texto={t.carroXl}
            activa={v.categoria === 'xl'}
            alTocar={() => {
              cambiar('categoria', 'xl');
              setCotizacion(null);
            }}
            rol="radio"
          />
        </View>
      ) : null}
      {cotizacion ? (
        <Tarjeta>
          <View testID="moto-precio" style={{ gap: 4 }}>
            <Text style={{ color: '#5E5E5E', fontWeight: '700' }}>
              {cotizacion.dePrueba ? t.precioPrueba : t.precioFijo}
            </Text>
            <Text style={{ fontSize: 34, fontWeight: '900', color: C.secundario }}>
              {formatearMonto(cotizacion.total, cotizacion.moneda, idioma)}
            </Text>
            <Text style={{ color: '#5E5E5E' }}>
              {distancia(cotizacion.distanciaM, idioma)} ·{' '}
              {Math.max(1, Math.round(cotizacion.duracionS / 60))} {t.min}
            </Text>
            <View
              style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}
              accessibilityRole="radiogroup"
            >
              <Pildora
                texto={t.pagoEfectivo}
                activa={!tarjeta}
                alTocar={() => cambiar('metodo', 'efectivo')}
                rol="radio"
              />
              <Pildora
                texto={t.pagoTarjeta}
                activa={tarjeta}
                alTocar={() => cambiar('metodo', 'tarjeta')}
                rol="radio"
              />
            </View>
            <Text style={{ color: C.secundario, fontWeight: '700' }}>
              {tarjeta ? t.tarjetaAyuda : t.efectivo}
            </Text>
            {deudaPendiente ? (
              <Text style={{ color: '#5E5E5E' }}>
                {t.deuda}{' '}
                {formatearMonto(deudaPendiente.monto, deudaPendiente.moneda ?? 'USD', idioma)}
              </Text>
            ) : null}
          </View>
        </Tarjeta>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
          {error}
        </Text>
      ) : null}
      {cobro?.clavePublica ? (
        <PagoTarjeta
          cobro={cobro}
          clavePublica={cobro.clavePublica}
          idioma={idioma}
          textos={{
            pagar: `${t.pagarViaje} ${cotizacion ? formatearMonto(cotizacion.total, cotizacion.moneda, idioma) : ''}`,
            cargando: t.cargandoTarjeta,
            sinFormulario: t.pagoNoDisponible,
            reintentar: t.reintentarPago,
          }}
          alPagar={() => {
            void b.limpiar();
            alPedir(cobro.viajeId);
          }}
        />
      ) : cotizacion ? (
        <>
          {servicio === 'envios' ? (
            <View style={{ gap: 4 }}>
              <Campo
                etiqueta={t.paqueteQue}
                value={v.paqueteDescripcion}
                onChangeText={(x) => cambiar('paqueteDescripcion', x)}
                placeholder={t.paqueteQueEjemplo}
              />
              <Campo
                etiqueta={t.paqueteValor}
                value={v.paqueteValor}
                onChangeText={(x) => cambiar('paqueteValor', x)}
                keyboardType="decimal-pad"
              />
              <Campo
                etiqueta={t.destinatarioNombre}
                value={v.destinatarioNombre}
                onChangeText={(x) => cambiar('destinatarioNombre', x)}
              />
              <Campo
                etiqueta={t.destinatarioTelefono}
                value={v.destinatarioTelefono}
                onChangeText={(x) => cambiar('destinatarioTelefono', x)}
                keyboardType="phone-pad"
                placeholder="(305) 000-0000"
              />
              <Pildora
                texto={t.sinProhibidos}
                activa={v.sinProhibidos}
                alTocar={() => cambiar('sinProhibidos', !v.sinProhibidos)}
                rol="checkbox"
              />
            </View>
          ) : null}
          <Boton
            texto={servicio === 'envios' ? t.pedirEnvio : t.pedirMoto}
            alTocar={() => void pedir()}
            cargando={trabajando}
            exito
          />
        </>
      ) : (
        <Boton texto={t.verPrecio} alTocar={() => void cotizar()} cargando={trabajando} />
      )}
    </View>
  );
}
