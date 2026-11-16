import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import {
  type CotizacionViaje,
  ErrorApi,
  enIdioma,
  formatearMonto,
  llaveBorrador,
} from '@tumbite/compartido';
import {
  Boton,
  COLOR,
  ESPACIO,
  Icono,
  LETRA,
  MARGEN,
  RADIO,
  SOMBRA,
  Text,
  almacenTelefono,
  useColores,
  useSesion,
} from '@tumbite/movil';
import { PagoTarjeta } from '../PagoTarjeta';
import type { Cobro } from '../pagoTipos';
import { MapaRuta } from './MapaRuta';
import {
  type ViajeHistorial,
  categoriaDe,
  cuerpoCotizarMismaRuta,
  pedidoMismaRuta,
  puntosEnOrden,
  rellenoPedirViaje,
  resumenConfirmacion,
} from './mismaRuta';
import { marcarRelleno } from './relleno';
import { TEXTOS_MIS_VIAJES, TEXTOS_MOTO } from './textos';

/**
 * C-MISMA-RUTA (15 nov 2026) — todos los países. La hoja «De X a Y, ¿confirmas?» (pantalla 8 del
 * sistema de diseño). Al abrirse cotiza OTRA VEZ en el servidor con los mismos puntos, servicio y
 * categoría (la misma ruta de cotizar que usa Pedir viaje): el precio que se ve y se cobra es el de
 * ahora, nunca el del historial. «Sí, pedir ahora» crea el viaje con esa cotización y la misma forma
 * de pago, y la app cae en la pantalla de espera de siempre. «Cambiar algo» abre Pedir viaje ya
 * lleno. Si el servicio está apagado o la cotización falla, se dice en palabras y no se pide nada.
 */
export function ConfirmarMismaRuta({
  viaje,
  alCerrar,
  alPedir,
  alCambiar,
}: {
  /** El viaje a repetir; null = hoja cerrada. */
  viaje: ViajeHistorial | null;
  alCerrar: () => void;
  /** El viaje nuevo ya existe: ir a la pantalla de espera. */
  alPedir: (viajeId: string, servicio: string) => void;
  /** Pedir viaje ya quedó escrito con estos datos: abrirlo. */
  alCambiar: (servicio: string) => void;
}) {
  const { idioma } = useSesion();
  const t = enIdioma(TEXTOS_MIS_VIAJES, idioma);
  const col = useColores();
  return (
    <Modal
      visible={viaje != null}
      transparent
      animationType="slide"
      onRequestClose={alCerrar}
      statusBarTranslucent
    >
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(16,16,16,0.45)' }}
        onPress={alCerrar}
        accessibilityRole="button"
        accessibilityLabel={t.cerrar}
      />
      <View
        testID="misma-ruta-hoja"
        style={[
          {
            maxHeight: '88%',
            backgroundColor: col.fondo,
            borderTopLeftRadius: RADIO.hoja,
            borderTopRightRadius: RADIO.hoja,
          },
          SOMBRA.flotante,
        ]}
      >
        <View
          style={{
            alignSelf: 'center',
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: col.bordeFuerte,
            marginTop: ESPACIO.s,
          }}
        />
        {/* Cada viaje abre su hoja desde cero (precio, error y pago nuevos). */}
        {viaje ? (
          <Contenido key={viaje.id} viaje={viaje} alPedir={alPedir} alCambiar={alCambiar} />
        ) : null}
      </View>
    </Modal>
  );
}

function Contenido({
  viaje,
  alPedir,
  alCambiar,
}: {
  viaje: ViajeHistorial;
  alPedir: (viajeId: string, servicio: string) => void;
  alCambiar: (servicio: string) => void;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS_MIS_VIAJES, idioma);
  const tm = enIdioma(TEXTOS_MOTO, idioma);
  const col = useColores();
  const [cot, setCot] = useState<CotizacionViaje | null>(null);
  const [error, setError] = useState('');
  const [cotizando, setCotizando] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);
  const [cobro, setCobro] = useState<(Cobro & { viajeId: string }) | null>(null);

  const cotizar = useCallback(async () => {
    setError('');
    const cuerpo = cuerpoCotizarMismaRuta(viaje);
    if (!cuerpo) {
      setCot(null);
      setError(t.noRepetible);
      return;
    }
    setCotizando(true);
    try {
      const r = await api.pedir<{ cotizacion: CotizacionViaje }>(
        'POST',
        '/datos/viajes/cotizar',
        cuerpo,
      );
      setCot(r.cotizacion);
    } catch (x) {
      setCot(null);
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setCotizando(false);
    }
  }, [api, viaje, t.noRepetible]);

  // Al abrirse, precio nuevo.
  useEffect(() => {
    const r = setTimeout(() => void cotizar(), 0);
    return () => clearTimeout(r);
  }, [cotizar]);

  // Como en Pedir viaje: se vuelve a cotizar sola 20 segundos antes de que venza el precio.
  const cotizarRef = useRef(cotizar);
  useEffect(() => {
    cotizarRef.current = cotizar;
  }, [cotizar]);
  useEffect(() => {
    if (!cot) return;
    const vence = Date.parse(`${cot.venceEn.replace(' ', 'T')}Z`);
    const r = setTimeout(
      () => void cotizarRef.current(),
      Math.max(5_000, vence - Date.now() - 20_000),
    );
    return () => clearTimeout(r);
  }, [cot]);

  async function pedir() {
    if (!cot) return;
    const pedido = pedidoMismaRuta(viaje, cot);
    if (!pedido) return void cotizar();
    setError('');
    setPidiendo(true);
    try {
      const r = await api.pedir<{ viaje: { id: string }; pago?: Omit<Cobro, 'pedidoId'> }>(
        'POST',
        '/datos/viajes',
        pedido.cuerpo,
      );
      if (r.pago) {
        setCobro({ ...r.pago, pedidoId: r.viaje.id, viajeId: r.viaje.id });
        return;
      }
      alPedir(r.viaje.id, viaje.servicio);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      // Si el precio venció entre medio, se trae uno nuevo.
      void cotizar();
    } finally {
      setPidiendo(false);
    }
  }

  async function cambiar() {
    const relleno = rellenoPedirViaje(viaje);
    if (relleno) {
      // Se escribe en el borrador de Pedir viaje (la misma llave que usa ese formulario).
      await Promise.resolve(
        almacenTelefono.guardar(
          llaveBorrador(viaje.servicio, usuario?.id),
          JSON.stringify(relleno),
        ),
      ).catch((e: unknown) => console.warn('misma ruta: no se pudo dejar escrito', e));
      marcarRelleno(viaje.servicio);
    }
    alCambiar(viaje.servicio);
  }

  const r = cot ? resumenConfirmacion(viaje, cot) : null;
  const pago = cot ? pedidoMismaRuta(viaje, cot) : null;
  const vehiculo =
    new Map(Object.entries(t.vehiculo)).get(
      viaje.servicio === 'moto' ? 'moto' : categoriaDe(viaje),
    ) ?? viaje.servicio;
  const paradas = viaje.puntos?.paradas ?? [];
  const monto = (n: number) => formatearMonto(n, cot?.moneda ?? viaje.moneda ?? 'USD', idioma);

  return (
    <ScrollView
      contentContainerStyle={{
        padding: MARGEN.hoja,
        paddingBottom: ESPACIO.xxxl,
        gap: ESPACIO.l,
        width: '100%',
        maxWidth: 640,
        alignSelf: 'center',
      }}
    >
      <>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: RADIO.m,
            backgroundColor: col.marcaSuave,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre="repeat-outline" color={COLOR.marca} />
        </View>
        <Text style={[LETRA.titulo, { color: col.texto }]} accessibilityRole="header">
          {t.confirmarTitulo(viaje.origen, viaje.destino)}
        </Text>
        {paradas.length ? (
          <Text style={[LETRA.secundario, { color: col.textoSuave }]}>
            {t.conParadas(paradas.length)} {paradas.map((p) => p.direccion).join(' · ')}
          </Text>
        ) : null}
        <MapaRuta puntos={puntosEnOrden(viaje)} alto={140} esquinas={RADIO.l} />
        <View style={{ gap: ESPACIO.s }}>
          <PuntoFila tipo="origen" etiqueta={t.recogida} texto={viaje.origen} />
          {paradas.map((p, i) => (
            <PuntoFila
              key={`p-${i}`}
              tipo="parada"
              etiqueta={`${t.parada} ${i + 1}`}
              texto={p.direccion}
            />
          ))}
          <PuntoFila tipo="destino" etiqueta={t.destino} texto={viaje.destino} />
        </View>
        <View
          style={{
            flexDirection: 'row',
            borderWidth: 1,
            borderColor: col.borde,
            borderRadius: RADIO.m,
          }}
          testID="misma-ruta-cajas"
        >
          <Caja etiqueta={t.cajaVehiculo} valor={vehiculo} />
          <Caja etiqueta={t.cajaDuracion} valor={r ? `${r.minutos} ${tm.min}` : '—'} linea />
          <Caja
            etiqueta={t.cajaPrecio}
            valor={r ? monto(r.precio) : '—'}
            linea
            testID="misma-ruta-precio"
          />
        </View>
        {cotizando && !cot ? (
          <Text style={[LETRA.secundario, { color: col.textoSuave }]}>{t.calculando}</Text>
        ) : null}
        {r ? (
          <Text style={[LETRA.secundario, { color: col.textoSuave }]} testID="misma-ruta-nota">
            {t.notaPrecio}
            {r.precioAntes != null ? ` ${t.notaPrecioAntes(monto(r.precioAntes))}` : ''}
          </Text>
        ) : null}
        {pago?.cambioPago ? (
          <Text style={[LETRA.secundario, { color: col.texto }]}>
            {t.notaPagoCambio(
              new Map(Object.entries(t.pagos)).get(pago.cuerpo.metodoPago) ??
                pago.cuerpo.metodoPago,
            )}
          </Text>
        ) : null}
        {error ? (
          <View
            accessibilityRole="alert"
            testID="misma-ruta-error"
            style={{
              flexDirection: 'row',
              gap: ESPACIO.s,
              padding: ESPACIO.m,
              borderRadius: RADIO.m,
              backgroundColor: COLOR.errorSuave,
            }}
          >
            <Icono nombre="alert-circle-outline" color={COLOR.error} tamano={20} />
            <Text style={[LETRA.secundario, { color: COLOR.error, flex: 1 }]}>{error}</Text>
          </View>
        ) : null}
        {cobro?.clavePublica ? (
          <PagoTarjeta
            cobro={cobro}
            clavePublica={cobro.clavePublica}
            idioma={idioma}
            textos={{
              pagar: `${tm.pagarViaje} ${r ? monto(r.precio) : ''}`,
              cargando: tm.cargandoTarjeta,
              sinFormulario: tm.pagoNoDisponible,
              reintentar: tm.reintentarPago,
            }}
            alPagar={() => alPedir(cobro.viajeId, viaje.servicio)}
          />
        ) : cot ? (
          <Boton
            tipo="principal"
            texto={t.pedirAhora}
            alTocar={() => void pedir()}
            cargando={pidiendo}
            testID="misma-ruta-confirmar"
          />
        ) : error && !cotizando ? (
          <Boton
            tipo="borde"
            texto={t.reintentar}
            alTocar={() => void cotizar()}
            testID="misma-ruta-reintentar"
          />
        ) : null}
        {!cobro && sePuedeCambiar(viaje) ? (
          <Boton
            tipo="terciario"
            texto={t.cambiarAlgo}
            alTocar={() => void cambiar()}
            testID="misma-ruta-cambiar"
          />
        ) : null}
      </>
    </ScrollView>
  );
}

const sePuedeCambiar = (v: ViajeHistorial) => rellenoPedirViaje(v) != null;

function PuntoFila({
  tipo,
  etiqueta,
  texto,
}: {
  tipo: 'origen' | 'parada' | 'destino';
  etiqueta: string;
  texto: string;
}) {
  const col = useColores();
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACIO.m }}
      accessible
      accessibilityLabel={`${etiqueta}: ${texto}`}
    >
      <View
        style={{
          width: 14,
          height: 14,
          borderRadius: tipo === 'destino' ? 2 : 7,
          borderWidth: 3,
          borderColor: col.texto,
          backgroundColor: tipo === 'destino' ? COLOR.marca : col.fondo,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text style={[LETRA.pequeno, { color: col.textoSuave }]}>{etiqueta}</Text>
        <Text style={[LETRA.tarjeta, { color: col.texto }]} numberOfLines={2}>
          {texto}
        </Text>
      </View>
    </View>
  );
}

function Caja({
  etiqueta,
  valor,
  linea,
  testID,
}: {
  etiqueta: string;
  valor: string;
  linea?: boolean;
  testID?: string;
}) {
  const col = useColores();
  return (
    <View
      style={{
        flex: 1,
        padding: ESPACIO.m,
        borderLeftWidth: linea ? 1 : 0,
        borderLeftColor: col.borde,
      }}
      testID={testID}
    >
      <Text style={[LETRA.pequeno, { color: col.textoSuave }]} numberOfLines={1}>
        {etiqueta}
      </Text>
      <Text
        style={[LETRA.tarjeta, { color: col.texto, fontSize: 16 }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {valor}
      </Text>
    </View>
  );
}
