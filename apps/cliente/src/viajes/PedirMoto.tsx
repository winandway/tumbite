import { estadoBotonPedir } from './botonPedir';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type ReactNode } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  type CategoriaViaje,
  type CotizacionViaje,
  ErrorApi,
  PAQUETE_MAX_KG,
  TAMANOS_PAQUETE,
  type TamanoPaquete,
  type Idioma,
  enIdioma,
  formatearMonto,
  pagaEnMano,
  textoReferencia,
  textoAMonto,
  textoFijarEnMapa,
  textoMultiplicador,
  textosPuntoExacto,
  useBorrador,
} from '@tumbite/compartido';
import { MapaEntrega } from '../MapaEntrega';
import {
  AvisoBorrador,
  C,
  Campo,
  Modal,
  MontoEnMano,
  alSalirTelefono,
  almacenTelefono,
  useSesion,
  Text,
  COLOR,
  Icono,
} from '@tumbite/movil';
import { PuntoExacto } from '../PuntoExacto';
import { Pildora, Tarjeta } from '../comida/piezas';
import { PagoTarjeta } from '../PagoTarjeta';
import type { Cobro } from '../pagoTipos';
import { type Punto, calleDelPunto, miUbicacion, ultimaUbicacionConocida } from '../ubicacion';
import { TEXTOS_MOTO } from './textos';
import { AgregarCodigoRegalo, LineaRegalo, TEXTOS_REGALO } from '../RegaloDivoox';
import { PedirPrimeroA } from './ConductoresConfianza';
import { tomarRelleno } from './relleno';
import { ElegirCuando, MisProgramados, Segmentos, horaCorta } from './Programar';
import { IMG_NUEVO } from '../inicio/recursosNuevo';
import { BotonGrande } from './BotonGrande';
import { BuscarDestino } from './BuscarDestino';
import { LugaresFila } from './LugaresFila';
import { useLugares } from './useLugares';
import {
  EditorParadas,
  PARADAS_SIN_SABER,
  type ParadaEscrita,
  leerParadasEscritas,
  paradasListas,
} from './Paradas';

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
  extras,
}: {
  /** Lo que va debajo del formulario (viajes anteriores…), dentro del mismo scroll. */
  extras?: ReactNode;
  /** C-CARRO-PRUEBAS / C-ENVIOS: el mismo formulario pide Moto, Carro o un Envío. */
  servicio?: 'moto' | 'carro' | 'envios';
  deudaPendiente: { monto: number; moneda: string | null } | null;
  alPedir: (viajeId: string) => void;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS_MOTO, idioma);
  const textosRegalo = enIdioma(TEXTOS_REGALO, idioma);
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
      // C-PUNTO-EXACTO: punto de referencia del punto de encuentro y del destino (opcionales).
      recogidaRef: '',
      destinoRef: '',
      destinoApto: '',
      // C-VIAJE-TARJETA: cómo paga el viaje.
      metodo: 'efectivo',
      // C-CARRO-CATEGORIAS: en Carro, económico, Comfort, Premium o XL (lo que ofrezca la ciudad).
      categoria: 'estandar',
      // C-VIAJE-PARADAS: las paradas intermedias escritas (lista en texto, para el borrador).
      paradas: '[]',
      // C-ENVIOS: qué se envía y quién lo recibe.
      paqueteDescripcion: '',
      // C-ENVIO-TAMANO: sobre, pequeño, mediano o grande.
      paqueteTamano: 'pequeno',
      paqueteValor: '',
      destinatarioNombre: '',
      destinatarioTelefono: '',
      sinProhibidos: false,
      // C-VIAJE-PROGRAMADO: '' = ahora; si no, la hora reservada (ISO).
      cuando: '',
      // C-CONDUCTOR-CONFIANZA: '' = que elija el servidor; 'ninguno' = cualquier conductor; o un id.
      confianza: '',
    },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const { valores: v, cambiar } = b;
  // C-PUNTO-EXACTO: qué punto se está marcando en el mapa con el pin fijo.
  const [marcando, setMarcando] = useState<'recogida' | 'destino' | null>(null);
  // C-MISMA-RUTA: lo escrito vino de «Cambiar algo» en un viaje anterior (no es un borrador perdido).
  const [rellenado] = useState(() => tomarRelleno(servicio));
  // C-ENVIO-TAMANO: «Mediano · 15 kg» (en libras en inglés).
  const textoTamano = (x: TamanoPaquete) => {
    const kg = new Map(Object.entries(PAQUETE_MAX_KG)).get(x) ?? 0;
    const nombre = new Map(Object.entries(t.tamanos)).get(x) ?? x;
    return `${nombre} · ${idioma === 'en' ? `${Math.round(kg * 2.2)} lb` : `${kg} kg`}`;
  };
  // C-CARRO-VIAJE-PASAJERO: cada servicio dice lo suyo en el botón.
  const categoria = (
    ['comfort', 'premium', 'xl'].includes(v.categoria) ? v.categoria : 'estandar'
  ) as CategoriaViaje;
  const textoPedirViaje =
    servicio === 'carro'
      ? (new Map(Object.entries(t.pedirCategoria)).get(categoria) ?? t.pedirCarro)
      : t.pedirMoto;
  // C-VIAJE-PARADAS: las paradas escritas (Moto y Carro; un envío va de un punto a otro).
  const paradas = useMemo(() => leerParadasEscritas(v.paradas), [v.paradas]);
  const ponerParadas = (nuevas: ParadaEscrita[]) => {
    cambiar('paradas', JSON.stringify(nuevas));
    setCotizacion(null);
  };
  const [cotizacion, setCotizacion] = useState<CotizacionViaje | null>(null);
  const [error, setError] = useState('');
  // C-SERVICIO-SIN-TARIFA: la ruta para la que el servidor dijo «no está / no tiene precio aquí».
  const [sinServicioEn, setSinServicioEn] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  // C-VIAJE-TARJETA: con tarjeta, el cobro abierto y la hoja de pago de siempre (la de Comida).
  const [cobro, setCobro] = useState<(Cobro & { viajeId: string }) | null>(null);
  const tarjeta = v.metodo === 'tarjeta';
  // C-VIAJE-PROGRAMADO: la reserva hecha (para el aviso verde) y la lista que se refresca.
  const [reservado, setReservado] = useState<string | null>(null);
  const [vueltaLista, setVueltaLista] = useState(0);
  const cuando = v.cuando;

  // La recogida arranca en la ubicación de ahora (se puede mover en el mapa de recogida).
  useEffect(() => {
    // Con un viaje anterior escrito, la recogida es la de ese viaje: no se pisa con la de ahora.
    if (v.recogidaLat || rellenado) return;
    // C-PEDIR-OTRA-VEZ: al instante la última ubicación conocida; después, la lectura nueva.
    let afinada = false;
    void ultimaUbicacionConocida().then((p) => {
      if (!p || afinada) return;
      cambiar('recogidaLat', String(p.lat));
      cambiar('recogidaLng', String(p.lng));
    });
    void miUbicacion().then((p) => {
      if (!p) return;
      afinada = true;
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
  // C-AVISO-BORRADOR-JUSTO (18 nov 2026): el aviso «Recuperamos lo que estabas escribiendo» mira
  // si AL ABRIR había un destino guardado; un destino elegido ahora no lo hace aparecer.
  const [destinoRecuperado, setDestinoRecuperado] = useState<boolean | null>(null);
  const [recuperadoAntes, setRecuperadoAntes] = useState(b.recuperado);
  if (b.recuperado !== recuperadoAntes) {
    // Se ajusta al cambiar «recuperado» (al abrir o al empezar de nuevo), no con cada letra.
    setRecuperadoAntes(b.recuperado);
    setDestinoRecuperado(b.recuperado ? v.destino.trim().length > 0 : null);
  }

  // C-RECOGIDA-REAL (18 nov 2026): la recogida con el GPS no tiene texto; se lee su calle para que el
  // viaje la lleve (el conductor, «Buscando tu moto» y «Mis viajes» ven la calle, no «Punto de
  // recogida»). Mientras se lee, no se cotiza; si no se puede leer, viaja «Tu ubicación actual».
  const claveRecogida = recogida && !v.recogida.trim() ? `${recogida.lat},${recogida.lng}` : '';
  const [calleActual, setCalleActual] = useState<{ clave: string; calle: string } | null>(null);
  useEffect(() => {
    if (!claveRecogida || !recogida) return;
    let vigente = true;
    // C-CALLE-CON-LIMITE: con tope de tiempo; si no llega, viaja «Tu ubicación actual».
    void calleDelPunto(recogida).then((calle) => {
      if (vigente) setCalleActual({ clave: claveRecogida, calle });
    });
    return () => {
      vigente = false;
    };
    // Solo cuando cambia el punto de la recogida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveRecogida]);
  const calleRecogida = calleActual && calleActual.clave === claveRecogida ? calleActual.calle : '';
  const leyendoCalle = Boolean(claveRecogida) && calleActual?.clave !== claveRecogida;
  const textoRecogida =
    v.recogida.trim() || calleRecogida || textosPedirNuevo(idioma, servicio).ubicacionActual;

  // C-FIJAR-EN-MAPA: la casilla ya tiene su punto en el mapa y su dirección.
  const recogidaFijada = recogida != null && v.recogida.trim().length > 0;
  const destinoFijado = destino != null && v.destino.trim().length > 0;

  const claveRutaRef = useRef('');
  const cotizar = useCallback(
    async (otraCategoria?: CategoriaViaje) => {
      setError('');
      if (!recogida) return setError(t.faltaOrigen);
      if (!destino || v.destino.trim().length < 3) return setError(t.faltaDestino);
      const intermedias = servicio === 'envios' ? [] : paradasListas(paradas);
      if (!intermedias) return setError(t.faltaParada);
      setTrabajando(true);
      try {
        const r = await api.pedir<{ cotizacion: CotizacionViaje }>(
          'POST',
          '/datos/viajes/cotizar',
          {
            servicio,
            categoria: servicio === 'carro' ? (otraCategoria ?? categoria) : 'estandar',
            origen: {
              ...recogida,
              direccion: textoRecogida,
              referencia: v.recogidaRef,
            },
            ...(intermedias.length ? { paradas: intermedias } : {}),
            destino: {
              ...destino,
              direccion: v.destino.trim(),
              referencia: [v.destinoApto, v.destinoRef].filter((x) => x.trim()).join(' · '),
            },
          },
        );
        setCotizacion(r.cotizacion);
      } catch (x) {
        setCotizacion(null);
        // Una categoría recuperada del borrador que esta ciudad no ofrece vuelve al carro de siempre.
        if (x instanceof ErrorApi && x.campo === 'categoria') cambiar('categoria', 'estandar');
        if (x instanceof ErrorApi && x.campo === 'servicio') setSinServicioEn(claveRutaRef.current);
        setError(x instanceof ErrorApi ? x.message : String(x));
      } finally {
        setTrabajando(false);
      }
    },
    [
      api,
      recogida,
      destino,
      textoRecogida,
      v.recogidaRef,
      v.destino,
      v.destinoApto,
      v.destinoRef,
      t,
      servicio,
      categoria,
      paradas,
      cambiar,
    ],
  );

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
    // C-ENVIO-SIN-SILENCIO (31 oct 2026, Richard en TestFlight): «Enviar» no hacía nada porque la
    // casilla de prohibidos no estaba marcada y el aviso salía arriba, fuera de la vista. Se avisa
    // aquí, junto al botón, antes de mandar nada.
    if (servicio === 'envios') {
      if (
        !v.paqueteDescripcion.trim() ||
        !v.destinatarioNombre.trim() ||
        v.destinatarioTelefono.replace(/\D/g, '').length < 7
      )
        return setError(t.faltaDatosEnvio);
      if (!v.sinProhibidos) return setError(t.faltaProhibidos);
    }
    // Una hora recuperada del borrador que ya quedó muy cerca se vuelve a elegir.
    if (cuando && Date.parse(cuando) < Date.now() + 30 * 60_000) {
      cambiar('cuando', '');
      return setError(t.eligeHora);
    }
    setTrabajando(true);
    try {
      const r = await api.pedir<{
        viaje: { id: string; programadoPara?: string };
        pago?: Omit<Cobro, 'pedidoId'>;
        programado?: boolean;
      }>('POST', '/datos/viajes', {
        cotizacionId: cotizacion.id,
        // Un método recuperado del borrador que esta ciudad no tiene vuelve a efectivo.
        metodoPago: (cotizacion.metodosPago ?? ['efectivo', 'tarjeta']).some((m) => m === v.metodo)
          ? v.metodo
          : 'efectivo',
        ...(servicio === 'envios'
          ? {
              paquete: {
                descripcion: v.paqueteDescripcion,
                tamano: v.paqueteTamano || 'pequeno',
                valorDeclarado: textoAMonto(v.paqueteValor || '0', cotizacion.moneda),
                destinatario: { nombre: v.destinatarioNombre, telefono: v.destinatarioTelefono },
                sinProhibidos: v.sinProhibidos,
              },
            }
          : {}),
        ...(cuando ? { programadoPara: cuando } : {}),
        // C-CONDUCTOR-CONFIANZA: solo si la persona eligió («Pedir primero a»).
        ...(v.confianza ? { confianza: v.confianza } : {}),
        // C-CUPON-DIVOOX: el regalo que vio; si ya no está, el servidor avisa en vez de pedir a ciegas.
        ...(cotizacion.regalo && !tarjeta ? { regalo: cotizacion.regalo.codigo } : {}),
      });
      if (r.programado) {
        await b.limpiar();
        setCotizacion(null);
        setReservado(r.viaje.programadoPara ?? cuando);
        setVueltaLista((n) => n + 1);
        return;
      }
      if (r.pago) {
        setCobro({ ...r.pago, pedidoId: r.viaje.id, viajeId: r.viaje.id });
        return;
      }
      await b.limpiar();
      alPedir(r.viaje.id);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      // C-CONDUCTOR-CONFIANZA: si lo quitó en otra pantalla, vuelve a «que elija el servidor».
      if (x instanceof ErrorApi && x.campo === 'confianza') cambiar('confianza', '');
      // Si el precio venció entre medio, se trae uno nuevo.
      void cotizar();
    } finally {
      setTrabajando(false);
    }
  }

  // C-INICIO-NUEVO (borrador aprobado): «¿A dónde vas?» en su pantalla, lugares guardados en la fila
  // y el precio se pide solo apenas hay destino (Moto en 3 toques: Moto → Casa → Solicitar).
  const tn = textosPedirNuevo(idioma, servicio);
  const lugares = useLugares(api, Boolean(usuario));
  const [buscando, setBuscando] = useState<'destino' | 'recogida' | null>(null);
  const [claveDestino, setClaveDestino] = useState<string | null>(null);
  const ponerPunto = (de: 'recogida' | 'destino', p: Punto, direccion: string) => {
    cambiar(`${de}Lat`, String(p.lat));
    cambiar(`${de}Lng`, String(p.lng));
    cambiar(de, direccion);
    if (de === 'destino') {
      cambiar('destinoRef', '');
      cambiar('destinoApto', '');
    } else cambiar('recogidaRef', '');
    setCotizacion(null);
    setError('');
  };
  const intentado = useRef('');
  const claveRuta = `${v.recogidaLat},${v.recogidaLng}>${v.destinoLat},${v.destinoLng}|${v.paradas}|${categoria}`;
  useEffect(() => {
    claveRutaRef.current = claveRuta;
  }, [claveRuta]);
  useEffect(() => {
    if (!recogida || !destino || cotizacion || trabajando || cobro || leyendoCalle) return;
    if (intentado.current === claveRuta) return;
    intentado.current = claveRuta;
    void cotizar();
  }, [recogida, destino, cotizacion, trabajando, cobro, cotizar, claveRuta, leyendoCalle]);
  const imagenServicio =
    servicio === 'envios'
      ? (IMG_NUEVO.servicios.envios ?? 0)
      : servicio === 'carro'
        ? (new Map(Object.entries(IMG_NUEVO.carros)).get(categoria) ??
          IMG_NUEVO.carros.estandar ??
          0)
        : (IMG_NUEVO.servicios.moto ?? 0);
  const sinDestino = !destinoFijado;
  const estadoBoton = estadoBotonPedir({
    sinDestino,
    conCotizacion: Boolean(cotizacion),
    sinServicio: sinServicioEn !== '' && sinServicioEn === claveRuta,
  });
  const textoBoton = sinDestino
    ? tn.eligeDestino
    : cuando
      ? t.reservar
      : servicio === 'envios'
        ? tn.solicitarEnvio
        : servicio === 'carro'
          ? textoPedirViaje
          : tn.solicitar(categoria);
  const alBoton = () => {
    if (estadoBoton === 'elegir_destino') return setBuscando('destino');
    if (estadoBoton === 'apagado') return;
    if (estadoBoton === 'cotizar') return void cotizar();
    void pedir();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          width: '100%',
          maxWidth: 640,
          alignSelf: 'center',
          gap: 12,
        }}
        testID="pedir-viaje"
      >
        <AvisoBorrador
          // Solo si lo recuperado es algo que la persona escribió (un destino); la recogida sola es
          // la ubicación de siempre y no se avisa.
          visible={b.recuperado && !rellenado && destinoRecuperado === true}
          idioma={idioma}
          empezar={() => {
            // «Empezar de nuevo»: sin el aviso viejo y con la recogida otra vez en la ubicación de ahora.
            setError('');
            setCotizacion(null);
            setClaveDestino(null);
            void b.empezarDeNuevo().then(() => {
              // C-PEDIR-OTRA-VEZ: la recogida se llena AL INSTANTE con la última ubicación conocida
              // y después se afina con la lectura nueva (antes tardaba unos 5 s).
              let afinada = false;
              void ultimaUbicacionConocida().then((p) => {
                if (p && !afinada) ponerPunto('recogida', p, '');
              });
              void miUbicacion().then((p) => {
                if (!p) return;
                afinada = true;
                ponerPunto('recogida', p, '');
              });
            });
          }}
        />
        {/* El encabezado del servicio: dibujo, titular y una frase. */}
        <View
          style={{
            backgroundColor: COLOR.superficie,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            padding: 16,
            minHeight: 120,
          }}
          testID="pedir-heroe"
        >
          <Image
            source={imagenServicio}
            style={{ width: 120, height: 96 }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text
              accessibilityRole="header"
              style={{ fontSize: 22, fontWeight: '700', color: C.secundario, textAlign: 'right' }}
            >
              {tn.heroe}
            </Text>
            <Text style={{ color: COLOR.textoSuave, textAlign: 'right', marginTop: 2 }}>
              {tn.heroeTexto}
            </Text>
          </View>
        </View>
        {servicio === 'envios' ? (
          // C-ENVIOS-DOS-TIPOS: A → B (Express) aquí mismo; Multipaquete (Flex) es para empresas
          // (C-BLOQUE-EN-LA-APP: se explica y se registra dentro de la app).
          <Segmentos
            opciones={[
              { clave: 'express', texto: tn.express },
              { clave: 'flex', texto: tn.flex },
            ]}
            activa="express"
            cambiar={(k) => {
              if (k === 'flex') router.push('/business');
            }}
            testID="envios-tipos"
          />
        ) : null}
        <ElegirCuando valor={cuando} cambiar={(iso) => cambiar('cuando', iso)} />
        {reservado ? (
          <Tarjeta>
            <View testID="viaje-reservado" style={{ gap: 4 }}>
              <Text style={{ color: C.exito, fontWeight: '700', fontSize: 18 }}>
                {servicio === 'envios' ? t.reservadoEnvio : t.reservado}
              </Text>
              <Text style={{ color: C.secundario }}>{t.reservadoAyuda}</Text>
              <Text style={{ color: '#666B73' }}>
                {t.cancelaGratis}{' '}
                {horaCorta(new Date(Date.parse(reservado) - 60 * 60_000).toISOString(), idioma)}
              </Text>
            </View>
          </Tarjeta>
        ) : null}
        {/* La ruta: recogida (con «centrar» en la ubicación de ahora) y «¿A dónde vas?». */}
        <View
          style={{
            borderWidth: 1,
            borderColor: COLOR.borde,
            borderRadius: 16,
            backgroundColor: '#FFFFFF',
          }}
          testID="pedir-ruta"
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}>
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                borderWidth: 4,
                borderColor: C.secundario,
              }}
            />
            <Pressable
              style={{ flex: 1 }}
              onPress={() => setBuscando('recogida')}
              accessibilityRole="button"
              testID="moto-recogida"
            >
              {/* C-RECOGIDA-REAL: «Tu ubicación actual» con la calle debajo, como en el borrador. */}
              <Text style={{ fontSize: 13, color: COLOR.textoSuave, fontWeight: '600' }}>
                {!v.recogida.trim() && calleRecogida ? tn.ubicacionActual : tn.recogerEn}
              </Text>
              <Text
                numberOfLines={1}
                testID={!v.recogida.trim() && calleRecogida ? 'moto-recogida-calle' : undefined}
                style={{ fontSize: 16, fontWeight: '700', color: C.secundario }}
              >
                {v.recogida.trim() ||
                  calleRecogida ||
                  (recogida ? tn.ubicacionActual : tn.eligeRecogida)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                void miUbicacion({ aMano: true }).then((p) => {
                  if (p) ponerPunto('recogida', p, '');
                })
              }
              accessibilityRole="button"
              accessibilityLabel={tn.centrar}
              testID="moto-centrar"
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: COLOR.superficie,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icono nombre="locate-outline" tamano={20} color={C.secundario} />
            </Pressable>
          </View>
          <View style={{ height: 1, backgroundColor: COLOR.borde }} />
          <Pressable
            onPress={() => setBuscando('destino')}
            accessibilityRole="button"
            testID="moto-destino"
            style={{ flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 }}
          >
            <View style={{ width: 16, height: 16, borderRadius: 4, backgroundColor: C.primario }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, color: COLOR.textoSuave, fontWeight: '600' }}>
                {servicio === 'envios' ? tn.entregarEn : t.destino}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 16,
                  fontWeight: destinoFijado ? '700' : '400',
                  color: destinoFijado ? C.secundario : COLOR.textoSuave,
                }}
              >
                {destinoFijado ? v.destino : tn.buscarDestino}
              </Text>
            </View>
          </Pressable>
        </View>
        {/* C-FIJAR-EN-MAPA: «Fijar … en el mapa» de cada punto, con su propio texto. */}
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => setMarcando('recogida')}
            accessibilityRole="button"
            testID="moto-fijar-recogida"
            hitSlop={6}
          >
            <Text style={{ color: recogidaFijada ? C.exito : C.acento, fontWeight: '700' }}>
              {textoFijarEnMapa(idioma, 'recogida', recogidaFijada)}
            </Text>
          </Pressable>
          {destinoFijado ? (
            <Pressable
              onPress={() => setMarcando('destino')}
              accessibilityRole="button"
              testID="moto-fijar-destino"
              hitSlop={6}
            >
              <Text style={{ color: C.exito, fontWeight: '700' }}>
                {textoFijarEnMapa(idioma, 'destino', true)} · {textosPuntoExacto(idioma).ajustar}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <LugaresFila
          lista={lugares.lista}
          elegido={claveDestino}
          alElegir={(l, f) => {
            if (l.lat == null || l.lng == null) return;
            ponerPunto('destino', { lat: l.lat, lng: l.lng }, l.direccion);
            if (l.referencia) cambiar('destinoRef', l.referencia);
            if (l.apto) cambiar('destinoApto', l.apto);
            setClaveDestino(f.clave);
          }}
          guardar={lugares.guardar}
          borrar={lugares.borrar}
          cerca={recogida}
        />
        {/* C-VIAJE-PARADAS: paradas intermedias, antes de ver el precio (Moto y Carro). */}
        {servicio !== 'envios' && destinoFijado ? (
          <EditorParadas
            paradas={paradas}
            cambiar={ponerParadas}
            maximo={cotizacion?.paradasMaximas ?? PARADAS_SIN_SABER}
            cerca={recogida}
          />
        ) : null}
        <Modal
          visible={buscando != null}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setBuscando(null)}
          testID="moto-buscar-destino"
        >
          {buscando ? (
            <BuscarDestino
              modo={buscando}
              cerca={recogida}
              lugares={lugares.lista}
              guardar={lugares.guardar}
              borrar={lugares.borrar}
              volver={() => setBuscando(null)}
              elegir={(d) => {
                ponerPunto(buscando, d.punto, d.direccion);
                if (buscando === 'destino') setClaveDestino(d.clave ?? null);
                setBuscando(null);
              }}
              enMapa={() => {
                const de = buscando;
                setBuscando(null);
                setMarcando(de);
              }}
            />
          ) : null}
        </Modal>
        <Modal
          visible={marcando != null}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setMarcando(null)}
          testID="moto-punto-exacto"
        >
          {marcando ? (
            <PuntoExacto
              key={marcando}
              tipo={
                marcando === 'destino' ? 'destino' : servicio === 'envios' ? 'envio' : 'encuentro'
              }
              conApto={marcando === 'destino' && servicio === 'envios'}
              inicial={
                marcando === 'recogida'
                  ? { punto: recogida, direccion: v.recogida, referencia: v.recogidaRef }
                  : {
                      punto: destino,
                      direccion: v.destino,
                      referencia: v.destinoRef,
                      apto: v.destinoApto,
                    }
              }
              cerca={recogida}
              volver={() => setMarcando(null)}
              confirmar={(p) => {
                const de = marcando;
                cambiar(`${de}Lat`, String(p.punto.lat));
                cambiar(`${de}Lng`, String(p.punto.lng));
                if (p.direccion) cambiar(de, p.direccion);
                cambiar(de === 'recogida' ? 'recogidaRef' : 'destinoRef', p.referencia);
                if (de === 'destino') cambiar('destinoApto', p.apto);
                setCotizacion(null);
                setMarcando(null);
              }}
            />
          ) : null}
        </Modal>

        {/* «Tipo de viaje»: Moto, o las categorías de Carro que ofrece la ciudad con su precio
            (C-CARRO-CATEGORIAS); en Envíos, el tamaño del paquete (C-ENVIO-TAMANO). */}
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.secundario, marginTop: 4 }}>
          {servicio === 'carro'
            ? tn.tipoCarro
            : servicio === 'envios'
              ? tn.tipoEnvio
              : tn.tipoViaje}
        </Text>
        {servicio === 'carro' && cotizacion && (cotizacion.opciones?.length ?? 0) > 1 ? (
          <View style={{ gap: 8 }} accessibilityRole="radiogroup" testID="carro-categorias">
            {(cotizacion.opciones ?? []).map((o) => {
              const elegida = (cotizacion.categoria ?? 'estandar') === o.categoria;
              return (
                <TarjetaTipo
                  key={o.categoria}
                  imagen={
                    new Map(Object.entries(IMG_NUEVO.carros)).get(o.categoria) ?? imagenServicio
                  }
                  titulo={t.categorias[o.categoria]}
                  detalle={t.categoriasAyuda[o.categoria]}
                  precio={formatearMonto(o.total, cotizacion.moneda, idioma)}
                  elegida={elegida}
                  alTocar={() => {
                    if (elegida) return;
                    cambiar('categoria', o.categoria);
                    void cotizar(o.categoria);
                  }}
                  testID={`carro-categoria-${o.categoria}`}
                />
              );
            })}
          </View>
        ) : servicio === 'envios' ? (
          <View style={{ gap: 6 }}>
            <View
              style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
              accessibilityRole="radiogroup"
              testID="envio-tamano"
            >
              {TAMANOS_PAQUETE.map((x) => (
                <Pildora
                  key={x}
                  texto={textoTamano(x)}
                  activa={(v.paqueteTamano || 'pequeno') === x}
                  alTocar={() => cambiar('paqueteTamano', x)}
                  rol="radio"
                />
              ))}
            </View>
            <Text style={{ color: '#666B73', fontSize: 13 }}>
              {new Map(Object.entries(t.tamanoAyuda)).get(v.paqueteTamano || 'pequeno') ?? ''}
            </Text>
          </View>
        ) : (
          <TarjetaTipo
            imagen={imagenServicio}
            titulo={
              servicio === 'carro'
                ? (new Map(Object.entries(t.categorias)).get(categoria) ?? t.tituloCarro)
                : t.titulo
            }
            detalle={
              servicio === 'carro'
                ? (new Map(Object.entries(t.categoriasAyuda)).get(categoria) ?? '')
                : tn.motoDetalle
            }
            precio={cotizacion ? formatearMonto(cotizacion.total, cotizacion.moneda, idioma) : ''}
            elegida
            alTocar={() => undefined}
            testID="tipo-viaje"
          />
        )}

        {cotizacion && recogida && destino ? (
          // C-MAPA-PRECIO-PEDIR: como Uber, DiDi e inDrive, el recorrido en un mapa pequeño junto al
          // precio. El precio no lo espera: el mapa se dibuja solo, aparte.
          <View testID="moto-precio-mapa">
            <MapaEntrega
              restaurante={recogida}
              casa={destino}
              repartidor={null}
              etiquetas={{
                restaurante: t.etiquetaRecogida,
                casa: t.etiquetaDestino,
                repartidor: t.etiquetaRecogida,
              }}
              alto={160}
              bajoDemanda
              vistaPrevia
            />
          </View>
        ) : null}
        {cotizacion ? (
          <View
            testID="moto-precio"
            style={{ backgroundColor: COLOR.superficie, borderRadius: 16, padding: 16, gap: 4 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ flex: 1, color: '#666B73', fontWeight: '700' }}>
                {cotizacion.dePrueba ? t.precioPrueba : t.precioFijo}
              </Text>
              <View style={{ alignItems: 'flex-end' }}>
                {/* C-CUPON-DIVOOX: con regalo y pago en mano, el precio de siempre tachado. */}
                {cotizacion.regalo && !tarjeta ? (
                  <Text
                    style={{ color: '#666B73', fontSize: 15, textDecorationLine: 'line-through' }}
                  >
                    {formatearMonto(cotizacion.total, cotizacion.moneda, idioma)}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 26, fontWeight: '700', color: C.secundario }}>
                  {formatearMonto(
                    cotizacion.regalo && !tarjeta
                      ? pagaEnMano(cotizacion.total, cotizacion.regalo)
                      : cotizacion.total,
                    cotizacion.moneda,
                    idioma,
                  )}
                </Text>
              </View>
            </View>
            {cotizacion.regalo && !tarjeta ? (
              <LineaRegalo
                regalo={cotizacion.regalo}
                total={cotizacion.total}
                moneda={cotizacion.moneda}
                idioma={idioma}
              />
            ) : null}
            {cotizacion.regalo && tarjeta ? (
              <Text style={{ color: '#666B73', fontSize: 13 }}>{textosRegalo.soloEnMano}</Text>
            ) : null}
            {(cotizacion.multiplicadorPb ?? 10_000) > 10_000 ? (
              // C-CARRO-DINAMICA: se dice antes de pedir, con el multiplicador, como el mercado.
              <View testID="moto-dinamica" style={{ gap: 2, marginVertical: 4 }}>
                <Text style={{ color: C.secundario, fontWeight: '700' }}>
                  {t.dinamicaTitulo} ·{' '}
                  {textoMultiplicador(cotizacion.multiplicadorPb ?? 10_000, idioma)}
                </Text>
                <Text style={{ color: '#666B73', fontSize: 13 }}>{t.dinamicaAyuda}</Text>
              </View>
            ) : null}
            {cotizacion.precioCambio && cotizacion.totalAnterior != null ? (
              // C-RUTA-POR-CALLES: una línea discreta, antes de pedir, si el precio cambió.
              <Text testID="moto-precio-cambio" style={{ color: '#666B73', fontSize: 13 }}>
                {t.precioActualizado}{' '}
                {formatearMonto(cotizacion.totalAnterior, cotizacion.moneda, idioma)}
              </Text>
            ) : null}
            {/* C-BS-EN-MANO: lo que paga en mano en bolívares con la tasa fijada (y la tasa usada). */}
            {cotizacion.enMano && !tarjeta ? (
              <MontoEnMano
                testID="moto-precio-bs"
                monto={cotizacion.enMano}
                idioma={idioma === 'en' ? 'en' : 'es'}
                quien="pasajero"
                soloLocal
              />
            ) : cotizacion.referencia ? (
              <Text testID="moto-precio-bs" style={{ color: '#666B73', fontWeight: '700' }}>
                {textoReferencia(cotizacion.referencia, idioma)}
              </Text>
            ) : null}
            <Text style={{ color: '#666B73' }}>
              {distancia(cotizacion.distanciaM, idioma)} ·{' '}
              {Math.max(1, Math.round(cotizacion.duracionS / 60))} {t.min}
            </Text>
            <View
              style={{ flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' }}
              accessibilityRole="radiogroup"
            >
              {/* C-PAGO-MOVIL-VIAJE: solo los métodos del país de la ciudad (Venezuela: pago móvil). */}
              {(cotizacion.metodosPago ?? ['efectivo', 'tarjeta']).map((m) => (
                <Pildora
                  key={m}
                  texto={
                    m === 'tarjeta'
                      ? t.pagoTarjeta
                      : m === 'pago_movil'
                        ? t.pagoMovil
                        : t.pagoEfectivo
                  }
                  activa={v.metodo === m}
                  alTocar={() => cambiar('metodo', m)}
                  rol="radio"
                />
              ))}
            </View>
            <Text style={{ color: C.secundario, fontWeight: '700' }}>
              {tarjeta ? t.tarjetaAyuda : v.metodo === 'pago_movil' ? t.pagoMovilAyuda : t.efectivo}
            </Text>
            {deudaPendiente ? (
              <Text style={{ color: '#666B73' }}>
                {t.deuda}{' '}
                {formatearMonto(deudaPendiente.monto, deudaPendiente.moneda ?? 'USD', idioma)}
              </Text>
            ) : null}
            {/* C-CUPON-DIVOOX: el código se agrega a la cuenta y el precio se vuelve a calcular. */}
            {cotizacion.regalo ? null : <AgregarCodigoRegalo alAgregar={() => void cotizar()} />}
          </View>
        ) : null}

        {/* C-TEXTOS-POR-SERVICIO: cada servicio dice lo suyo. */}
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Icono nombre="information-circle-outline" tamano={18} color={COLOR.textoSuave} />
          <Text style={{ color: '#666B73', flex: 1 }}>
            {servicio === 'carro' ? t.avisoCarro : servicio === 'envios' ? t.avisoEnvio : t.casco}
          </Text>
        </View>

        {servicio === 'envios' ? (
          <View style={{ gap: 4 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: C.secundario, marginTop: 4 }}>
              {tn.detalles}
            </Text>
            <Campo
              etiqueta={t.paqueteQue}
              value={v.paqueteDescripcion}
              onChangeText={(x) => cambiar('paqueteDescripcion', x)}
              returnKeyType="done"
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
              returnKeyType="done"
              autoComplete="name"
            />
            <Campo
              etiqueta={t.destinatarioTelefono}
              value={v.destinatarioTelefono}
              onChangeText={(x) => cambiar('destinatarioTelefono', x)}
              keyboardType="phone-pad"
              placeholder={idioma === 'en' ? 'Mobile number' : 'Número de celular'}
            />
            <Pressable
              onPress={() => cambiar('sinProhibidos', !v.sinProhibidos)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: v.sinProhibidos }}
              style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 8 }}
              testID="envio-prohibidos"
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  borderWidth: 2,
                  borderColor: v.sinProhibidos ? C.exito : '#6B7078',
                  backgroundColor: v.sinProhibidos ? C.exito : '#fff',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {v.sinProhibidos ? (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>✓</Text>
                ) : null}
              </View>
              <Text style={{ flex: 1, color: C.secundario }}>{t.sinProhibidos}</Text>
            </Pressable>
            {/* C-FLEX-RASTREAR: quien espera una caja la sigue con su número de seguimiento. */}
            <Pressable
              onPress={() => router.push('/packages')}
              accessibilityRole="button"
              testID="envios-rastrear"
            >
              <Text style={{ color: C.acento, fontWeight: '700', paddingVertical: 8 }}>
                {tn.rastrear}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <PedirPrimeroA
          servicio={servicio}
          valor={v.confianza}
          cambiar={(x) => cambiar('confianza', x)}
          reserva={Boolean(cuando)}
        />
        <MisProgramados recargar={vueltaLista} />
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
        ) : null}
        {extras}
      </ScrollView>
      {cobro?.clavePublica ? null : (
        <SafeAreaView
          edges={['bottom']}
          style={{ borderTopWidth: 1, borderColor: COLOR.borde, backgroundColor: '#FFFFFF' }}
        >
          <View
            style={{
              padding: 16,
              paddingBottom: 8,
              width: '100%',
              maxWidth: 640,
              alignSelf: 'center',
              gap: 8,
            }}
          >
            {error ? (
              <Text accessibilityRole="alert" style={{ color: C.acento, fontWeight: '700' }}>
                {error}
              </Text>
            ) : null}
            <BotonGrande
              texto={textoBoton}
              alTocar={alBoton}
              apagado={estadoBoton === 'apagado'}
              cargando={trabajando}
              testID="pedir-boton"
            />
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

/** Tarjeta de «Tipo de viaje»: dibujo, nombre, detalle y precio; la elegida con borde rojo. */
function TarjetaTipo({
  imagen,
  titulo,
  detalle,
  precio,
  elegida,
  alTocar,
  testID,
}: {
  imagen: number;
  titulo: string;
  detalle: string;
  precio: string;
  elegida: boolean;
  alTocar: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="radio"
      accessibilityState={{ checked: elegida }}
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 16,
        borderWidth: elegida ? 2 : 1,
        borderColor: elegida ? C.primario : COLOR.borde,
        backgroundColor: '#FFFFFF',
        minHeight: 72,
      }}
    >
      <Image
        source={imagen}
        style={{ width: 64, height: 48 }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: C.secundario }}>{titulo}</Text>
        <Text style={{ color: '#666B73', fontSize: 13 }}>{detalle}</Text>
      </View>
      {precio ? (
        <Text style={{ fontWeight: '700', fontSize: 16, color: C.secundario }}>{precio}</Text>
      ) : null}
    </Pressable>
  );
}

/** C-INICIO-NUEVO: textos del borrador aprobado para Moto, Carro y Envíos. */
function textosPedirNuevo(idioma: Idioma, servicio: 'moto' | 'carro' | 'envios') {
  const en = idioma === 'en';
  const heroes = new Map(
    Object.entries({
      moto: en
        ? ['Ride by moto', 'Fast, safe and affordable']
        : ['Viaja en moto', 'Rápido, seguro y económico'],
      carro: en
        ? ['Ride by car', 'Comfortable and safe for you and your family']
        : ['Viaja en carro', 'Cómodo y seguro para ti y tu familia'],
      envios: en
        ? ['Send or receive what you need', 'Fast, safe and tracked']
        : ['Envía o recibe lo que necesites', 'Rápido, seguro y con seguimiento'],
    }),
  );
  const heroe = heroes.get(servicio) ?? [];
  return {
    heroe: heroe[0] ?? '',
    heroeTexto: heroe[1] ?? '',
    express: 'A → B (Express)',
    flex: en ? 'Multi-package (Flex)' : 'Multipaquete (Flex)',
    recogerEn: en ? 'Pick up at' : 'Recoger en',
    entregarEn: en ? 'Deliver to' : 'Entregar en',
    ubicacionActual: en ? 'Your current location' : 'Tu ubicación actual',
    eligeRecogida: en ? 'Choose the pickup' : 'Elige dónde te recogemos',
    buscarDestino: en ? 'Search address or place' : 'Buscar dirección o lugar',
    centrar: en ? 'Use my current location' : 'Usar mi ubicación actual',
    tipoViaje: en ? 'Ride type' : 'Tipo de viaje',
    tipoCarro: en ? 'Car type' : 'Tipo de carro',
    tipoEnvio: en ? 'Package type' : 'Tipo de envío',
    motoDetalle: en ? '1 rider · helmet included' : '1 pasajero · casco incluido',
    detalles: en ? 'Package details' : 'Detalles del paquete',
    rastrear: en ? 'Track a package' : 'Rastrear un paquete',
    eligeDestino: en ? 'Choose your destination' : 'Elige tu destino',
    solicitarEnvio: en ? 'Request delivery' : 'Solicitar envío',
    solicitar: (c: CategoriaViaje) =>
      servicio === 'carro'
        ? c === 'xl'
          ? en
            ? 'Request Car XL'
            : 'Solicitar carro XL'
          : en
            ? 'Request car'
            : 'Solicitar carro'
        : en
          ? 'Request moto'
          : 'Solicitar moto',
  };
}
