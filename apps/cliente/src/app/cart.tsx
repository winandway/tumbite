import { useEffect, useState } from 'react';
import type React from 'react';
import { Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CONFIG_DINERO_INICIAL,
  ErrorApi,
  type ConfigDinero,
  calcularPedido,
  distanciaKm,
  enIdioma,
  formatearMonto,
  montoATexto,
  montoEscrito,
  porcentajeDe,
  useBorrador,
  textoLinea,
} from '@tumbite/compartido';
import {
  Boton,
  C,
  Campo,
  alSalirTelefono,
  almacenTelefono,
  e,
  urlFoto,
  useSesion,
  CampoDireccion,
} from '@tumbite/movil';
import { ANCHO_MAX, BotonRedondo, Encabezado, Tarjeta } from '../comida/piezas';
import { textosComida } from '../comida/textos';
import { textosTiendas } from '../tiendas/textos';
import { SUSTITUCIONES } from '@tumbite/compartido';
import { useCarrito } from '../carrito';
import { TEXTOS } from '../textos';
import { type Punto, miUbicacion } from '../ubicacion';
import { ElegirEnMapa } from '../ElegirEnMapa';
import { guardarUbicacion } from '../comida/useRestaurantes';
import { PagoTarjeta } from '../PagoTarjeta';
import type { Cobro } from '../pagoTipos';

const TE = {
  es: {
    como: '¿Cómo quieres recibirlo?',
    puerta: 'En la puerta',
    puertaAyuda: 'Sin contacto. El repartidor lo deja y te manda la foto.',
    mano: 'En mano',
    manoAyuda: 'Te lo entrega a ti. Sal a recibirlo cuando te avise.',
    recoger: 'Recojo en el local',
    recogerAyuda: 'Sin costo de envío. Pasas a buscarlo cuando esté listo.',
    pinTitulo: 'Pedir un PIN de 4 dígitos al entregar',
    pinAyuda:
      'El PIN aparece en tu pedido y quien reciba se lo dice al repartidor. Apágalo si va a recibir otra persona y no quieres pasarle el PIN.',
    pagoTitulo: '¿Cómo pagas?',
    pagoTarjeta: 'Tarjeta',
    pagoTarjetaAyuda: 'Se autoriza ahora y se cobra al entregar.',
    pagoEfectivo: 'Efectivo al recibir',
    pagoEfectivoAyuda: 'Le pagas al repartidor cuando llegue.',
    pagoTransfer: 'Transferencia al repartidor',
    pagoTransferAyuda: 'Verás el nombre y la cuenta del repartidor en el seguimiento.',
    pedirDirecto: 'Pedir y pagar al recibir',
    guardadas: 'Tus direcciones',
    guardar: 'Guardar esta dirección para la próxima',
    etiqueta: 'Nombre (Casa, Trabajo…)',
    cupon: 'Cupón o código promocional',
    aplicar: 'Aplicar',
    quitarCupon: 'Quitar',
    cuponOk: 'Cupón aplicado: −{monto}',
    descuento: 'Cupón',
  },
  en: {
    como: 'How do you want to receive it?',
    puerta: 'Leave at my door',
    puertaAyuda: 'Contactless. The driver leaves it and sends you a photo.',
    mano: 'Hand it to me',
    manoAyuda: 'The driver hands it to you. Come out when they let you know.',
    recoger: 'I’ll pick it up',
    recogerAyuda: 'No delivery fee. You pick it up when it’s ready.',
    pinTitulo: 'Ask for a 4-digit PIN at delivery',
    pinAyuda:
      'The PIN shows in your order and whoever receives it tells the driver. Turn it off if someone else will receive it and you don’t want to pass the PIN along.',
    pagoTitulo: 'How do you pay?',
    pagoTarjeta: 'Card',
    pagoTarjetaAyuda: 'Authorized now, charged on delivery.',
    pagoEfectivo: 'Cash on delivery',
    pagoEfectivoAyuda: 'You pay the driver when they arrive.',
    pagoTransfer: 'Transfer to the driver',
    pagoTransferAyuda: 'You’ll see the driver’s name and account in the tracking screen.',
    pedirDirecto: 'Order and pay on delivery',
    guardadas: 'Your addresses',
    guardar: 'Save this address for next time',
    etiqueta: 'Name (Home, Work…)',
    cupon: 'Coupon or promo code',
    aplicar: 'Apply',
    quitarCupon: 'Remove',
    cuponOk: 'Coupon applied: −{monto}',
    descuento: 'Coupon',
  },
} as const;

const PROPINAS = [0, 1500, 2000, 2500]; // puntos básicos: 0 %, 15 %, 20 %, 25 %

type Regalo = { tipo: 'cumpleanos' | 'sellos' | 'vuelve'; valorCentavos: number };
const NOMBRE_REGALO = {
  es: {
    cumpleanos: 'Regalo de cumpleaños',
    sellos: 'Tu tarjeta de sellos está completa',
    vuelve: '¡Qué bueno verte de nuevo!',
  },
  en: {
    cumpleanos: 'Birthday gift',
    sellos: 'Your punch card is complete',
    vuelve: 'Great to see you again!',
  },
};

export default function PantallaCarrito() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS, idioma);
  const te = idioma === 'en' ? TE.en : TE.es;
  const tc = textosComida(idioma);
  const { carrito, cambiarCantidad, cambiarSustitucion, vaciar } = useCarrito();
  const tt = textosTiendas(idioma);
  const nombreSustitucion = (op: string) => new Map(Object.entries(tt.sustituciones)).get(op) ?? op;
  // C-MONEDA-RECORRIDO: las tarifas y la moneda del país del restaurante (las mismas del servidor).
  // Se guardan con el restaurante para el que se pidieron: si cambia el carrito, no se mezclan.
  const [tarifas, setTarifas] = useState<{
    rid: string | null;
    config: ConfigDinero;
    moneda: string | null;
    error: string;
  } | null>(null);
  // Fase 2: qué formas de pago permite el país de la zona (efectivo, transferencia). Vacío = solo tarjeta.
  const [pais, setPais] = useState<{
    moneda?: string;
    efectivoActivo: boolean;
    transferenciaRepartidorActiva: boolean;
  } | null>(null);
  // C-PAIS-DEL-RESTAURANTE: las formas de pago son las del país del RESTAURANTE del carrito (antes,
  // las de la ciudad guardada del cliente: uno nuevo caía en Miami y no veía el efectivo de su país).
  const ridPais = carrito.restauranteId;
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ moneda?: string; efectivoActivo: boolean; transferenciaRepartidorActiva: boolean }>(
        'GET',
        ridPais ? `/datos/pais?restauranteId=${encodeURIComponent(ridPais)}` : '/datos/pais',
      )
      .then((p) => {
        if (vivo) setPais(p);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, ridPais]);
  const [punto, setPunto] = useState<Punto | null>(null);
  const [propinaPb, setPropinaPb] = useState<number | 'otra'>(2000);
  const [error, setError] = useState('');
  const [pagando, setPagando] = useState(false);
  const [regalos, setRegalos] = useState<Regalo[]>([]);
  const [regaloElegido, setRegaloElegido] = useState<Regalo['tipo'] | null>(null);
  // El pedido ya creado y esperando la tarjeta. El formulario de pago aparece aquí mismo.
  const [cobroGuardado, setCobro] = useState<(Cobro & { total: number }) | null>(null);
  const b = useBorrador({
    formulario: 'entrega',
    cuenta: usuario?.id,
    inicial: {
      direccion: '',
      notas: '',
      propinaOtra: '',
      entrega: 'puerta',
      pin: 'si',
      metodoPago: 'tarjeta',
      guardarDireccion: 'no',
      etiquetaDireccion: '',
      cupon: '',
    },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });

  // Si la persona escribió su dirección en la portada de tumbite.com, llega por la URL.
  const { direccion: direccionUrl } = useLocalSearchParams<{ direccion?: string }>();
  const { cambiar: cambiarBorrador } = b;
  useEffect(() => {
    if (direccionUrl && !b.valores.direccion) cambiarBorrador('direccion', String(direccionUrl));
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direccionUrl]);

  useEffect(() => {
    void miUbicacion().then(setPunto);
  }, []);
  const restauranteCarrito = carrito.restauranteId;
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ config: ConfigDinero; moneda?: string }>(
        'GET',
        restauranteCarrito
          ? `/datos/config-dinero?restauranteId=${encodeURIComponent(restauranteCarrito)}`
          : '/datos/config-dinero',
      )
      .then((r) => {
        if (vivo)
          setTarifas({
            rid: restauranteCarrito,
            config: r.config,
            moneda: r.moneda ?? null,
            error: '',
          });
      })
      .catch((x: unknown) => {
        // 409: el país del restaurante todavía no recibe pedidos (sin tarifas). Se dice y no se pide.
        if (vivo && x instanceof ErrorApi && x.estado === 409)
          setTarifas({
            rid: restauranteCarrito,
            config: CONFIG_DINERO_INICIAL,
            moneda: null,
            error: x.message,
          });
        // Si no responde, se muestra con los valores de siempre; el servidor recalcula al pagar.
      });
    return () => {
      vivo = false;
    };
  }, [api, restauranteCarrito]);
  const tarifasListas = tarifas?.rid === restauranteCarrito ? tarifas : null;
  const config = tarifasListas?.config ?? CONFIG_DINERO_INICIAL;
  const sinTarifas = tarifasListas?.error ?? '';
  const moneda = tarifasListas?.moneda ?? carrito.moneda ?? 'USD';
  // Fuera del dólar, el desglose solo se muestra con las tarifas de SU país ya cargadas: nunca se
  // pintan las cifras de EE. UU. con el símbolo de otra moneda.
  const desgloseFiable = !sinTarifas && (moneda === 'USD' || Boolean(tarifasListas?.moneda));

  // ¿Le toca algún regalo de este restaurante con este carrito?
  const llaveCarrito = carrito.lineas.map((l) => `${l.platoId}:${l.cantidad}`).join(',');
  useEffect(() => {
    if (!carrito.restauranteId || !llaveCarrito) return;
    api
      .pedir<{ regalos: Regalo[] }>(
        'POST',
        `/datos/restaurantes/${carrito.restauranteId}/mis-regalos`,
        { lineas: carrito.lineas.map((l) => ({ platoId: l.platoId, cantidad: l.cantidad })) },
      )
      .then((r) => {
        setRegalos(r.regalos);
        setRegaloElegido((actual) =>
          r.regalos.some((x) => x.tipo === actual) ? actual : (r.regalos[0]?.tipo ?? null),
        );
      })
      .catch(() => setRegalos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, carrito.restauranteId, llaveCarrito]);
  const regalo = regalos.find((r) => r.tipo === regaloElegido)?.valorCentavos ?? 0;

  // Direcciones guardadas (punto 14): chips arriba del mapa; «guardar» al pedir.
  type Direccion = {
    id: string;
    etiqueta: string;
    direccion: string;
    lat: number | null;
    lng: number | null;
    instrucciones: string;
    entrega: 'puerta' | 'mano';
  };
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ direcciones: Direccion[] }>('GET', '/datos/mis-direcciones')
      .then((r) => {
        if (vivo) setDirecciones(r.direcciones);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);
  function usarDireccion(dir: Direccion) {
    b.cambiar('direccion', dir.direccion);
    if (dir.instrucciones) b.cambiar('notas', dir.instrucciones);
    b.cambiar('entrega', dir.entrega);
    if (dir.lat != null && dir.lng != null) {
      setPunto({ lat: dir.lat, lng: dir.lng });
      void guardarUbicacion({ lat: dir.lat, lng: dir.lng });
    }
  }

  // Cupón (punto 15): se valida en el servidor al aplicarlo y otra vez al pedir.
  const [cupon, setCupon] = useState<{ codigo: string; descuento: number } | null>(null);
  const [cuponError, setCuponError] = useState('');
  async function aplicarCupon() {
    setCuponError('');
    if (!carrito.restauranteId) return;
    try {
      const r = await api.pedir<{ codigo: string; descuento: number }>(
        'POST',
        '/datos/cupones/validar',
        {
          codigo: b.valores.cupon,
          restauranteId: carrito.restauranteId,
          subtotal,
          envio: d?.envio ?? 0,
        },
      );
      setCupon(r);
    } catch (x) {
      setCupon(null);
      setCuponError(x instanceof Error ? x.message : String(x));
    }
  }

  const subtotal = carrito.lineas.reduce((s, l) => s + l.precioCentavos * l.cantidad, 0);
  const propina =
    propinaPb === 'otra'
      ? (montoEscrito(b.valores.propinaOtra, moneda) ?? 0)
      : porcentajeDe(subtotal, propinaPb);
  const km =
    punto && carrito.restLat != null && carrito.restLng != null
      ? distanciaKm(punto, { lat: carrito.restLat, lng: carrito.restLng })
      : null;
  // C-FALLOS-DINERO (F6): recoger en el local no lleva envío; se calcula igual que el servidor.
  const recogidaElegida = b.valores.entrega === 'recoger';
  const descuentoCupon = cupon?.descuento ?? 0;
  // Sin useMemo: el cálculo es barato y así el compilador de React no tiene que adivinar dependencias.
  const d = carrito.lineas.length
    ? calcularPedido({
        lineas: carrito.lineas,
        plan: carrito.plan,
        propina,
        distanciaKm: km,
        config,
        regalo,
        recogida: recogidaElegida,
        descuento: descuentoCupon,
      })
    : null;

  async function pagar() {
    if (!d || !carrito.restauranteId) return;
    if (sinTarifas) return setError(sinTarifas);
    setError('');
    setPagando(true);
    try {
      const r = await api.pedir<Cobro>('POST', '/datos/pedidos', {
        restauranteId: carrito.restauranteId,
        lineas: carrito.lineas.map((l) => ({
          platoId: l.platoId,
          cantidad: l.cantidad,
          opciones: (l.opciones ?? []).map((o) => o.id),
          ...(carrito.esTienda ? { sustitucion: l.sustitucion ?? 'reembolsar' } : {}),
        })),
        propinaCentavos: propina,
        // El servidor compara este total con el suyo y no cobra si no coinciden.
        totalEsperado: d.totalCliente,
        direccion: b.valores.direccion,
        notas: b.valores.notas,
        entrega:
          b.valores.entrega === 'recoger'
            ? 'recoger'
            : b.valores.entrega === 'mano'
              ? 'mano'
              : 'puerta',
        pin: b.valores.pin !== 'no',
        metodoPago,
        cupon: cupon?.codigo,
        lat: punto?.lat ?? null,
        lng: punto?.lng ?? null,
        regalo: regalo > 0 ? regaloElegido : null,
      });
      // Guardar la dirección para la próxima (si lo pidió), sin frenar el pago si falla.
      if (b.valores.guardarDireccion === 'si' && b.valores.entrega !== 'recoger')
        void api
          .pedir('POST', '/datos/mis-direcciones', {
            etiqueta: b.valores.etiquetaDireccion,
            direccion: b.valores.direccion,
            lat: punto?.lat ?? null,
            lng: punto?.lng ?? null,
            instrucciones: b.valores.notas,
            entrega: b.valores.entrega === 'mano' ? 'mano' : 'puerta',
          })
          .catch(() => undefined);
      // Cobro directo: no hay tarjeta; el pedido ya quedó confirmado y se paga al recibir.
      if (r.directo) {
        await b.limpiar();
        vaciar();
        router.replace(`/order/${r.pedidoId}?nuevo=1`);
        return;
      }
      // La tarjeta se pide aquí mismo, sin salir de la app.
      if (!r.clavePublica) throw new Error(t.pagoNoDisponible);
      setCobro({ ...r, total: r.desglose?.totalCliente ?? d.totalCliente });
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
    } finally {
      setPagando(false);
    }
  }

  // Si el total cambió después de crear el cobro, ese cobro ya no sirve: se crea otro.
  const cobro = cobroGuardado && d && cobroGuardado.total === d.totalCliente ? cobroGuardado : null;

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const marco = (cuerpo: React.ReactNode) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8FA' }} edges={['top', 'left', 'right']}>
      <Encabezado titulo={tc.tuCarrito} alVolver={volver} etiquetaVolver={tc.volver} />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
      >
        {cuerpo}
      </ScrollView>
    </SafeAreaView>
  );

  if (!d) {
    return marco(
      <Tarjeta>
        <Text>{t.vacio}</Text>
      </Tarjeta>,
    );
  }

  const fila = (texto: string, monto: number, fuerte = false) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 }}>
      <Text
        style={
          fuerte ? { fontWeight: '900', fontSize: 19, color: C.secundario } : { color: '#5E5E5E' }
        }
      >
        {texto}
      </Text>
      <Text
        style={
          fuerte
            ? { fontWeight: '900', fontSize: 19, color: C.secundario }
            : { color: C.secundario }
        }
      >
        {formatearMonto(monto, moneda, idioma)}
      </Text>
    </View>
  );
  const titulo = (texto: string) => (
    <Text
      style={{
        fontWeight: '800',
        fontSize: 16,
        color: C.secundario,
        marginTop: 8,
        marginBottom: 8,
      }}
    >
      {texto}
    </Text>
  );
  const modoActual = b.valores.entrega || 'puerta';
  const directoPermitido =
    modoActual !== 'recoger' && (pais?.efectivoActivo || pais?.transferenciaRepartidorActiva);
  // C-TARIFAS-PAIS: la tarjeta solo cobra en dólares; en otra moneda no se ofrece.
  const tarjetaPermitida = (pais?.moneda ?? 'USD') === 'USD';
  const primeroDirecto = pais?.efectivoActivo ? 'efectivo' : 'transferencia_repartidor';
  const metodoPago = (
    directoPermitido
      ? b.valores.metodoPago && (b.valores.metodoPago !== 'tarjeta' || tarjetaPermitida)
        ? b.valores.metodoPago
        : tarjetaPermitida
          ? 'tarjeta'
          : primeroDirecto
      : 'tarjeta'
  ) as 'tarjeta' | 'efectivo' | 'transferencia_repartidor';

  return marco(
    <>
      <Text style={{ fontWeight: '800', fontSize: 15, color: '#5E5E5E', marginBottom: 8 }}>
        {carrito.restauranteNombre}
      </Text>
      {carrito.lineas.map((l) => {
        const foto = urlFoto(l.imagen);
        return (
          <Tarjeta key={l.clave ?? l.platoId} style={{ padding: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {foto ? (
                <Image
                  source={{ uri: foto }}
                  style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: '#f1f1f1' }}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: C.secundario }}>
                  {textoLinea(l, idioma)}
                </Text>
                <Text style={{ fontWeight: '800', color: C.secundario, marginTop: 4 }}>
                  {formatearMonto(l.precioCentavos * l.cantidad, moneda, idioma)}
                </Text>
              </View>
              <BotonRedondo
                texto="−"
                lleno={false}
                alTocar={() => cambiarCantidad(l.clave ?? l.platoId, l.cantidad - 1)}
                etiqueta={t.menos}
              />
              <Text style={{ fontWeight: '800', minWidth: 20, textAlign: 'center' }}>
                {l.cantidad}
              </Text>
              <BotonRedondo
                texto="+"
                lleno={false}
                alTocar={() => cambiarCantidad(l.clave ?? l.platoId, Math.min(99, l.cantidad + 1))}
                etiqueta={t.mas}
              />
            </View>
            {/* C-TIENDAS-COMPRA: qué hacer si la tienda no tiene este producto (como los grandes). */}
            {carrito.esTienda ? (
              <View style={{ marginTop: 8 }}>
                {l.pesable ? (
                  <Text style={{ color: '#5E5E5E', fontSize: 12, marginBottom: 6 }}>
                    {tt.porPeso}
                  </Text>
                ) : null}
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}
                >
                  <Text style={{ color: '#5E5E5E', fontSize: 13, fontWeight: '700' }}>
                    {tt.siNoHay}
                  </Text>
                  {SUSTITUCIONES.map((op) => {
                    const activo = (l.sustitucion ?? 'reembolsar') === op;
                    return (
                      <Pressable
                        key={op}
                        onPress={() => cambiarSustitucion(l.clave ?? l.platoId, op)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: activo }}
                        accessibilityLabel={`${tt.siNoHay} ${nombreSustitucion(op)}`}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: activo ? C.secundario : '#D6D6D6',
                          backgroundColor: activo ? C.secundario : '#fff',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: activo ? '#fff' : C.secundario,
                          }}
                        >
                          {nombreSustitucion(op)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </Tarjeta>
        );
      })}

      {/* Cómo recibir: en la puerta (el repartidor deja foto), en mano o recoger en el local. */}
      {titulo(te.como)}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {(['puerta', 'mano', 'recoger'] as const).map((modo) => {
          const activo = modoActual === modo;
          return (
            <Pressable
              key={modo}
              onPress={() => b.cambiar('entrega', modo)}
              accessibilityRole="radio"
              accessibilityState={{ checked: activo }}
              accessibilityLabel={
                modo === 'recoger' ? te.recoger : modo === 'mano' ? te.mano : te.puerta
              }
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 14,
                borderWidth: activo ? 2 : 1,
                borderColor: activo ? C.primario : '#DADADA',
                backgroundColor: '#fff',
              }}
            >
              <Text style={{ fontWeight: '800', color: activo ? C.primario : C.secundario }}>
                {modo === 'recoger' ? te.recoger : modo === 'mano' ? te.mano : te.puerta}
              </Text>
              <Text style={{ color: '#5E5E5E', fontSize: 12, marginTop: 2 }}>
                {modo === 'recoger'
                  ? te.recogerAyuda
                  : modo === 'mano'
                    ? te.manoAyuda
                    : te.puertaAyuda}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {modoActual === 'mano' ? (
        <Tarjeta style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800' }}>{te.pinTitulo}</Text>
            <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{te.pinAyuda}</Text>
          </View>
          <Switch
            value={b.valores.pin !== 'no'}
            onValueChange={(v) => b.cambiar('pin', v ? 'si' : 'no')}
            accessibilityLabel={te.pinTitulo}
            trackColor={{ true: C.exito, false: '#D6D6D6' }}
          />
        </Tarjeta>
      ) : null}

      {directoPermitido ? (
        <>
          {titulo(te.pagoTitulo)}
          <View style={{ gap: 8, marginBottom: 12 }}>
            {(
              [
                ['tarjeta', te.pagoTarjeta, te.pagoTarjetaAyuda, tarjetaPermitida],
                ['efectivo', te.pagoEfectivo, te.pagoEfectivoAyuda, pais?.efectivoActivo],
                [
                  'transferencia_repartidor',
                  te.pagoTransfer,
                  te.pagoTransferAyuda,
                  pais?.transferenciaRepartidorActiva,
                ],
              ] as const
            )
              .filter(([, , , visible]) => visible)
              .map(([valor, etiqueta, ayuda]) => {
                const activo = metodoPago === valor;
                return (
                  <Pressable
                    key={valor}
                    onPress={() => b.cambiar('metodoPago', valor)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: activo }}
                    accessibilityLabel={etiqueta}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: activo ? 2 : 1,
                      borderColor: activo ? C.primario : '#DADADA',
                      backgroundColor: '#fff',
                    }}
                  >
                    <Text style={{ fontWeight: '800', color: activo ? C.primario : C.secundario }}>
                      {etiqueta}
                    </Text>
                    <Text style={{ color: '#5E5E5E', fontSize: 12, marginTop: 2 }}>{ayuda}</Text>
                  </Pressable>
                );
              })}
          </View>
        </>
      ) : null}
      {modoActual !== 'recoger' ? (
        <>
          {titulo(t.direccion)}
          {direcciones.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {direcciones.map((dir) => {
                const activa = dir.direccion === b.valores.direccion;
                return (
                  <Pressable
                    key={dir.id}
                    onPress={() => usarDireccion(dir)}
                    accessibilityRole="button"
                    accessibilityLabel={`${te.guardadas}: ${dir.etiqueta || dir.direccion}`}
                    accessibilityState={{ selected: activa }}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: activa ? C.primario : '#DADADA',
                      backgroundColor: activa ? C.primario : '#fff',
                      maxWidth: '100%',
                    }}
                  >
                    <Text
                      style={{ color: activa ? '#fff' : C.secundario, fontWeight: '800' }}
                      numberOfLines={1}
                    >
                      {dir.etiqueta ? `${dir.etiqueta} · ` : ''}
                      {dir.direccion}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <ElegirEnMapa
            punto={punto}
            cambiarPunto={(p) => {
              setPunto(p);
              // Hito 1: la dirección elegida también ordena la lista de restaurantes al volver.
              if (p) void guardarUbicacion(p);
            }}
            cambiarDireccion={(x) => b.cambiar('direccion', x)}
            textos={{ ayuda: t.mapaAyuda, buscando: t.mapaBuscando, pin: t.mapaPin }}
          />
          {/* C-DIRECCION-SUGERENCIAS: direcciones reales mientras se escribe; al elegir, el pin va ahí. */}
          <CampoDireccion
            etiqueta={t.direccion}
            valor={b.valores.direccion}
            cambiar={(x) => b.cambiar('direccion', x)}
            alElegir={(d) => {
              setPunto(d.punto);
              void guardarUbicacion(d.punto);
            }}
            cerca={punto}
            placeholder={t.direccionAyuda}
            testID="carrito-direccion"
          />
          <Tarjeta style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ flex: 1, fontWeight: '800' }}>{te.guardar}</Text>
            <Switch
              value={b.valores.guardarDireccion === 'si'}
              onValueChange={(v) => b.cambiar('guardarDireccion', v ? 'si' : 'no')}
              accessibilityLabel={te.guardar}
              trackColor={{ true: C.exito, false: '#D6D6D6' }}
            />
          </Tarjeta>
          {b.valores.guardarDireccion === 'si' ? (
            <Campo
              etiqueta={te.etiqueta}
              value={b.valores.etiquetaDireccion}
              onChangeText={(x) => b.cambiar('etiquetaDireccion', x)}
              placeholder={te.etiqueta}
            />
          ) : null}
        </>
      ) : null}
      <Campo
        etiqueta={t.notas}
        value={b.valores.notas}
        onChangeText={(x) => b.cambiar('notas', x)}
        placeholder={t.notas}
      />

      {titulo(t.propina)}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        {[...PROPINAS, 'otra' as const].map((pb) => (
          <Pressable
            key={String(pb)}
            onPress={() => setPropinaPb(pb)}
            accessibilityRole="button"
            accessibilityLabel={`${t.propina}: ${pb === 'otra' ? t.otra : `${pb / 100}%`}`}
            accessibilityState={{ selected: propinaPb === pb }}
            style={{
              flexGrow: 1,
              alignItems: 'center',
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: propinaPb === pb ? C.primario : '#DADADA',
              backgroundColor: propinaPb === pb ? C.primario : '#fff',
            }}
          >
            <Text style={{ color: propinaPb === pb ? '#fff' : C.texto, fontWeight: '800' }}>
              {pb === 'otra' ? t.otra : `${pb / 100}%`}
            </Text>
          </Pressable>
        ))}
      </View>
      {propinaPb === 'otra' && (
        <Campo
          etiqueta={t.propina}
          value={b.valores.propinaOtra}
          onChangeText={(x) => b.cambiar('propinaOtra', x)}
          keyboardType="decimal-pad"
          placeholder={montoATexto(0, moneda)}
        />
      )}
      <Text style={{ color: '#5E5E5E', fontSize: 13, marginBottom: 12 }}>{t.propinaNota}</Text>

      {regalos.map((r) => (
        <Pressable
          key={r.tipo}
          onPress={() => setRegaloElegido(regaloElegido === r.tipo ? null : r.tipo)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: regaloElegido === r.tipo }}
          style={[
            e.tarjeta,
            {
              borderWidth: 2,
              // Regalo aplicado = salió bien: verde (C-VERDE-EXITO).
              borderColor: regaloElegido === r.tipo ? C.exito : '#2a2a2a',
              backgroundColor: regaloElegido === r.tipo ? '#E8F5EC' : '#fff',
            },
          ]}
        >
          <Text style={{ fontWeight: '800' }}>{enIdioma(NOMBRE_REGALO, idioma)[r.tipo]}</Text>
          <Text
            style={{ color: regaloElegido === r.tipo ? C.exito : undefined, fontWeight: '700' }}
          >
            −{formatearMonto(r.valorCentavos, moneda, idioma)} {regaloElegido === r.tipo ? '✓' : ''}
          </Text>
        </Pressable>
      ))}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Campo
            etiqueta={te.cupon}
            value={b.valores.cupon}
            onChangeText={(x) => {
              b.cambiar('cupon', x.toUpperCase());
              if (cupon) setCupon(null);
            }}
            placeholder={te.cupon}
            autoCapitalize="characters"
          />
        </View>
        <Pressable
          onPress={() => {
            if (cupon) {
              setCupon(null);
              b.cambiar('cupon', '');
            } else void aplicarCupon();
          }}
          accessibilityRole="button"
          accessibilityLabel={cupon ? te.quitarCupon : te.aplicar}
          style={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: cupon ? '#fff' : C.secundario,
            borderWidth: 1,
            borderColor: C.secundario,
            marginBottom: 12,
          }}
        >
          <Text style={{ color: cupon ? C.secundario : '#fff', fontWeight: '800' }}>
            {cupon ? te.quitarCupon : te.aplicar}
          </Text>
        </Pressable>
      </View>
      {cupon ? (
        <Text
          style={{ color: C.exito, fontWeight: '700', marginBottom: 8 }}
          accessibilityLiveRegion="polite"
        >
          {te.cuponOk.replace('{monto}', formatearMonto(cupon.descuento, moneda, idioma))}
        </Text>
      ) : null}
      {cuponError ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {cuponError}
        </Text>
      ) : null}
      {desgloseFiable ? (
        <Tarjeta>
          {fila(t.subtotal, d.subtotal)}
          {regalo > 0 && fila(idioma === 'en' ? 'Gift' : 'Regalo', -regalo)}
          {d.descuento > 0 && fila(te.descuento, -d.descuento)}
          {fila(t.envio, d.envio)}
          {fila(t.servicio, d.servicio)}
          {d.cargoPedidoPequeno > 0 && fila(t.pequeno, d.cargoPedidoPequeno)}
          {d.impuesto > 0 && fila(t.impuesto, d.impuesto)}
          {fila(t.propina, d.propina)}
          <View style={{ borderTopWidth: 1, borderTopColor: '#eee', marginTop: 6, paddingTop: 8 }}>
            {fila(t.total, d.totalCliente, true)}
          </View>
        </Tarjeta>
      ) : null}
      {error ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error}
        </Text>
      ) : sinTarifas ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {sinTarifas}
        </Text>
      ) : null}
      {cobro?.clavePublica ? (
        <>
          <Text style={{ fontWeight: '800', fontSize: 17, marginBottom: 8 }}>{t.tarjeta}</Text>
          <PagoTarjeta
            cobro={cobro}
            clavePublica={cobro.clavePublica}
            idioma={idioma}
            textos={{
              pagar: `${t.pagar} ${formatearMonto(d.totalCliente, moneda, idioma)}`,
              cargando: t.cargandoTarjeta,
              sinFormulario: t.pagoNoDisponible,
              reintentar: t.reintentarPago,
            }}
            alPagar={() => {
              void b.limpiar();
              vaciar();
              // Llega al pedido con la confirmación «¡Pedido realizado!».
              router.replace(`/order/${cobro.pedidoId}?nuevo=1`);
            }}
          />
        </>
      ) : (
        <Boton
          texto={`${metodoPago === 'tarjeta' ? t.continuarPago : te.pedirDirecto}${desgloseFiable ? ` · ${formatearMonto(d.totalCliente, moneda, idioma)}` : ''}`}
          alTocar={() => void pagar()}
          cargando={pagando}
        />
      )}
    </>,
  );
}
