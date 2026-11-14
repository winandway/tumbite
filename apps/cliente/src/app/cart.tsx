import { useEffect, useState } from 'react';
import { anuncioPara } from '../comida/anuncioTocado';
import type React from 'react';
import { Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CONFIG_DINERO_INICIAL,
  ErrorApi,
  type ConfigDinero,
  type Desglose,
  type TasaDelDia,
  referenciaConTasa,
  textoReferencia,
  type PromocionRestaurante,
  calcularConPromocion,
  calcularPedido,
  insigniaPromocion,
  mejorPromocion,
  cuponConPlus,
  descuentoPlus,
  saldoAplicable,
  distanciaKm,
  enIdioma,
  explicarTarifas,
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
import { ElegirReemplazo } from '../tiendas/ElegirReemplazo';
import {
  SUSTITUCIONES,
  armarCuerpoPedido,
  huellaPedido,
  margenPesables,
} from '@tumbite/compartido';
import { useCarrito } from '../carrito';
import { TEXTOS } from '../textos';
import { type Punto, miUbicacion } from '../ubicacion';
import { ElegirEnMapa } from '../ElegirEnMapa';
import { guardarUbicacion } from '../comida/useRestaurantes';
import { PagoTarjeta } from '../PagoTarjeta';
import type { Cobro } from '../pagoTipos';
import { conCuenta } from '../ConCuenta';

const TE = {
  es: {
    cuando: '¿Cuándo lo quieres?',
    ahora: 'Lo antes posible',
    ahoraAyuda: 'Sale en cuanto el restaurante lo prepare.',
    programar: 'Programar',
    programarAyuda: 'Elige día y hora, hasta 6 días adelante.',
    sinFranjas: 'Este comercio no tiene horas disponibles para programar en los próximos días.',
    elegirFranja: 'Elige una hora para programar tu pedido.',
    como: '¿Cómo quieres recibirlo?',
    puerta: 'En la puerta',
    puertaAyuda: 'Sin contacto. El repartidor lo deja y te manda la foto.',
    mano: 'En mano',
    manoAyuda: 'Te lo entrega a ti. Sal a recibirlo cuando te avise.',
    recoger: 'Recojo en el local',
    recogerAyuda: 'Sin costo de envío. Pasas a buscarlo cuando esté listo.',
    edadAviso:
      'Tu pedido lleva alcohol o tabaco: se entrega en mano a un mayor de 21 años, con su identificación.',
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
    cuponConPlus: 'Ya tienes el envío gratis con Divoox Plus: este cupón no suma más.',
    descuento: 'Cupón',
  },
  en: {
    cuando: 'When do you want it?',
    ahora: 'As soon as possible',
    ahoraAyuda: 'Goes out as soon as the restaurant prepares it.',
    programar: 'Schedule',
    programarAyuda: 'Pick a day and time, up to 6 days ahead.',
    sinFranjas: 'This store has no times available to schedule in the next few days.',
    elegirFranja: 'Pick a time to schedule your order.',
    como: 'How do you want to receive it?',
    puerta: 'Leave at my door',
    puertaAyuda: 'Contactless. The driver leaves it and sends you a photo.',
    mano: 'Hand it to me',
    manoAyuda: 'The driver hands it to you. Come out when they let you know.',
    recoger: 'I’ll pick it up',
    recogerAyuda: 'No delivery fee. You pick it up when it’s ready.',
    edadAviso:
      'Your order has alcohol or tobacco: it’s handed to someone 21 or older, who shows their ID.',
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
    cuponConPlus:
      'You already get free delivery with Divoox Plus, so this coupon doesn’t add more.',
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

function PantallaCarrito() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS, idioma);
  const te = idioma === 'en' ? TE.en : TE.es;
  const tc = textosComida(idioma);
  const { carrito, cambiarCantidad, cambiarSustitucion, vaciar, recoger, marcarRecoger } =
    useCarrito();
  const tt = textosTiendas(idioma);
  const nombreSustitucion = (op: string) => new Map(Object.entries(tt.sustituciones)).get(op) ?? op;
  // C-MONEDA-RECORRIDO: las tarifas y la moneda del país del restaurante (las mismas del servidor).
  // Se guardan con el restaurante para el que se pidieron: si cambia el carrito, no se mezclan.
  // C-TARIFAS-EXPLICADAS: «¿Qué son estas tarifas?» abre la explicación de cada cargo.
  const [verTarifas, setVerTarifas] = useState(false);
  const [tarifas, setTarifas] = useState<{
    rid: string | null;
    config: ConfigDinero;
    moneda: string | null;
    error: string;
    // C-COMIDA-VENEZUELA: propinas sugeridas del país y la tasa del día (equivalente en bolívares).
    propinasPb?: number[];
    tasaReferencia?: TasaDelDia | null;
  } | null>(null);
  // Fase 2: qué formas de pago permite el país de la zona (efectivo, transferencia). Vacío = solo tarjeta.
  const [pais, setPais] = useState<{
    moneda?: string;
    efectivoActivo: boolean;
    transferenciaRepartidorActiva: boolean;
    tarjetaActiva?: boolean;
  } | null>(null);
  // C-PAIS-DEL-RESTAURANTE: las formas de pago son las del país del RESTAURANTE del carrito (antes,
  // las de la ciudad guardada del cliente: uno nuevo caía en Miami y no veía el efectivo de su país).
  const ridPais = carrito.restauranteId;
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{
        moneda?: string;
        efectivoActivo: boolean;
        transferenciaRepartidorActiva: boolean;
        tarjetaActiva?: boolean;
      }>(
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
  const [propinaEntregaPb, setPropinaEntregaPb] = useState<number | 'otra'>(2000);
  // BRE-7b: como el «Pickup» de DoorDash y Uber Eats, en la recogida la propina va al restaurante,
  // es opcional y arranca en 0 %; cada forma de recibir recuerda la suya.
  const [propinaRecogerPb, setPropinaRecogerPb] = useState<number | 'otra'>(0);
  const [error, setError] = useState('');
  const [pagando, setPagando] = useState(false);
  const [regalos, setRegalos] = useState<Regalo[]>([]);
  const [regaloElegido, setRegaloElegido] = useState<Regalo['tipo'] | null>(null);
  // El pedido ya creado y esperando la tarjeta. El formulario de pago aparece aquí mismo.
  const [cobroGuardado, setCobro] = useState<(Cobro & { total: number; huella: string }) | null>(
    null,
  );
  // C-TOTAL-CORREGIDO: el desglose que mandó el servidor para estos datos (huella) tras un 409.
  const [corregido, setCorregido] = useState<{ huella: string; desglose: Desglose } | null>(null);
  const b = useBorrador({
    formulario: 'entrega',
    cuenta: usuario?.id,
    inicial: {
      direccion: '',
      apto: '',
      notas: '',
      alergias: '',
      // C-REGALAR-PEDIDO: enviar como regalo a otra persona.
      esRegalo: 'no',
      paraNombre: '',
      paraTelefono: '',
      paraMensaje: '',
      propinaOtra: '',
      entrega: 'puerta',
      pin: 'si',
      metodoPago: 'tarjeta',
      guardarDireccion: 'no',
      etiquetaDireccion: '',
      cupon: '',
      // C-PEDIDO-PROGRAMADO: «» = lo antes posible; «elegir» = programar sin hora aún; o la hora ISO.
      programado: '',
    },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const comoRegalo = b.valores.esRegalo === 'si' && b.valores.entrega !== 'recoger';
  // C-RECOGER-MAPA: si eligió el local desde «Recoger», el carrito arranca en recoger (una vez).
  const { cambiar: cambiarEntrega } = b;
  useEffect(() => {
    if (!recoger) return;
    cambiarEntrega('entrega', 'recoger');
    marcarRecoger(false);
  }, [recoger, cambiarEntrega, marcarRecoger]);

  // C-PROMO-RESTAURANTE (BRE-5): las promociones vigentes del restaurante; se aplican igual que
  // en el servidor (la que más ahorra, solo con tarjeta) para que el total visto sea el cobrado.
  const [promociones, setPromociones] = useState<PromocionRestaurante[]>([]);
  useEffect(() => {
    if (!carrito.restauranteId) return;
    api
      .pedir<{ promociones?: PromocionRestaurante[] }>(
        'GET',
        `/datos/restaurantes/${carrito.restauranteId}`,
      )
      .then((r) => setPromociones(r.promociones ?? []))
      .catch((e: unknown) => {
        // BRE-R2: sin promociones el carrito sigue (el servidor devuelve el total correcto), pero
        // el fallo queda anotado en vez de callarse.
        console.warn('carrito: no se pudieron leer las promociones del restaurante', e);
        setPromociones([]);
      });
  }, [api, carrito.restauranteId]);

  // C-PEDIDO-PROGRAMADO: las franjas las da el servidor (horario y festivos del comercio).
  const [franjas, setFranjas] = useState<{ inicio: string; es: string; en: string }[]>([]);
  useEffect(() => {
    if (!carrito.restauranteId) return;
    api
      .pedir<{ franjas: { inicio: string; es: string; en: string }[] }>(
        'GET',
        `/datos/restaurantes/${carrito.restauranteId}/franjas`,
      )
      .then((r) => setFranjas(r.franjas))
      .catch(() => setFranjas([]));
  }, [api, carrito.restauranteId]);
  const programado = b.valores.programado;
  const franjaElegida = franjas.find((f) => f.inicio === programado) ?? null;
  const diaDe = (f: { es: string; en: string }) => (idioma === 'en' ? f.en : f.es).split(',')[0]!;
  const dias = [...new Set(franjas.map(diaDe))];
  const [diaVisto, setDiaVisto] = useState<string | null>(null);
  const diaActivo = diaVisto ?? (franjaElegida ? diaDe(franjaElegida) : (dias[0] ?? null));

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
      .pedir<{
        config: ConfigDinero;
        moneda?: string;
        propinasPb?: number[];
        tasaReferencia?: TasaDelDia | null;
      }>(
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
            propinasPb: r.propinasPb,
            tasaReferencia: r.tasaReferencia ?? null,
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
  // C-COMIDA-VENEZUELA: si el país sugiere otras propinas (Venezuela: 0, 5, 10 y 15 %), la que
  // venía marcada de fábrica (20 %) cuenta como la del medio de su lista; la elegida se respeta.
  const propinasPais = tarifasListas?.propinasPb;
  const propinaEntregaVigente =
    propinaEntregaPb === 'otra' || !propinasPais?.length || propinasPais.includes(propinaEntregaPb)
      ? propinaEntregaPb
      : (propinasPais.at(Math.min(2, propinasPais.length - 1)) ?? 0);
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
    apto?: string;
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
    b.cambiar('apto', dir.apto ?? '');
    if (dir.instrucciones) b.cambiar('notas', dir.instrucciones);
    b.cambiar('entrega', dir.entrega);
    if (dir.lat != null && dir.lng != null) {
      setPunto({ lat: dir.lat, lng: dir.lng });
      void guardarUbicacion({ lat: dir.lat, lng: dir.lng });
    }
  }

  // Cupón (punto 15): se valida en el servidor al aplicarlo y otra vez al pedir.
  const [cupon, setCupon] = useState<{ codigo: string; descuento: number; tipo?: string } | null>(
    null,
  );
  // C-TARJETAS-REGALO: el saldo de regalo del cliente y si lo quiere usar en este pedido.
  const [saldoRegaloCli, setSaldoRegaloCli] = useState(0);
  const [usarRegalo, setUsarRegalo] = useState(true);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ activas: boolean; saldo: number }>('GET', '/datos/tarjetas-regalo')
      .then((r) => {
        if (vivo && r.activas) setSaldoRegaloCli(r.saldo);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);
  // C-PLUS: si el cliente tiene Divoox Plus vigente, sus ajustes (para descontar igual que el servidor).
  const [plusVigente, setPlusVigente] = useState<{
    minimoSubtotal: number;
    servicioDescuentoPct: number;
  } | null>(null);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ activo: boolean; minimoSubtotal: number; servicioDescuentoPct: number }>(
        'GET',
        '/datos/plus',
      )
      .then((r) => {
        if (vivo && r.activo) setPlusVigente(r);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);
  const [cuponError, setCuponError] = useState('');
  async function aplicarCupon() {
    setCuponError('');
    if (!carrito.restauranteId) return;
    try {
      const r = await api.pedir<{ codigo: string; descuento: number; tipo?: string }>(
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
  const propinaPb = b.valores.entrega === 'recoger' ? propinaRecogerPb : propinaEntregaVigente;
  const setPropinaPb = b.valores.entrega === 'recoger' ? setPropinaRecogerPb : setPropinaEntregaPb;
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
  // Sin useMemo: el cálculo es barato y así el compilador de React no tiene que adivinar dependencias.
  const base = {
    lineas: carrito.lineas,
    plan: carrito.plan,
    propina,
    distanciaKm: km,
    config,
    regalo,
  };
  const conTarjeta = (b.valores.metodoPago || 'tarjeta') === 'tarjeta';
  const previo = carrito.lineas.length
    ? calcularPedido({ ...base, recogida: recogidaElegida })
    : null;
  // C-PLUS-SOLO-EEUU (14 nov 2026): Plus y el saldo de regalo valen solo en Estados Unidos, igual
  // que el servidor (enEeuu). Venezuela también cobra en dólares: la moneda no basta. Un servidor
  // viejo sin `tarjetaActiva`: la regla de antes (dólares).
  const enEeuu = pais?.tarjetaActiva ?? moneda === 'USD';
  // C-PLUS: la misma cuenta que el servidor (envío gratis y servicio rebajado, solo en EE. UU.).
  const plusAplica = Boolean(
    previo && plusVigente && enEeuu && !recogidaElegida && descuentoPlus(previo, plusVigente) > 0,
  );
  // BRE-R2: el envío que ya cubren Plus o un cupón de envío gratis no lo vuelve a pagar la
  // promoción «envío gratis» del restaurante (la misma regla que el servidor).
  const envioCubierto = previo && (plusAplica || cupon?.tipo === 'envio_gratis') ? previo.envio : 0;
  // C-ENVIO-UNA-VEZ (BRE-R3b): con Plus el envío ya va gratis; el cupón de envío gratis no suma
  // (aunque se haya validado antes de llegar al mínimo de Plus). La misma regla que el servidor.
  const cuponSinEfecto = plusAplica && cupon?.tipo === 'envio_gratis';
  const cuponAplicado = cuponConPlus(cupon, plusAplica);
  const promo =
    previo && conTarjeta ? mejorPromocion(promociones, previo, { regalo, envioCubierto }) : null;
  const sinPlus = carrito.lineas.length
    ? calcularConPromocion(
        { ...base, recogida: recogidaElegida, descuento: cuponAplicado },
        promo,
        { envioCubierto },
      )
    : null;
  const descPlus = sinPlus && plusVigente && plusAplica ? descuentoPlus(sinPlus, plusVigente) : 0;
  const conPlus =
    sinPlus && descPlus
      ? calcularConPromocion(
          { ...base, recogida: recogidaElegida, descuento: cuponAplicado + descPlus },
          promo,
          { envioCubierto },
        )
      : sinPlus;
  // C-TARJETAS-REGALO: la misma cuenta que el servidor (solo con tarjeta y en dólares).
  const regaloConTarjeta = conTarjeta;
  const usoRegalo =
    conPlus && usarRegalo && saldoRegaloCli > 0 && enEeuu && regaloConTarjeta
      ? saldoAplicable(conPlus, saldoRegaloCli)
      : 0;
  const conEdad = carrito.lineas.some((l) => l.requiereEdad);
  const modoElegido = b.valores.entrega || 'puerta';
  const modoActual = conEdad && modoElegido === 'puerta' ? 'mano' : modoElegido;
  const directoPermitido =
    modoActual !== 'recoger' && (pais?.efectivoActivo || pais?.transferenciaRepartidorActiva);
  // C-TARIFAS-PAIS y C-COMIDA-VENEZUELA: la tarjeta solo en Estados Unidos (Venezuela cobra en
  // dólares, pero en mano). Un servidor viejo sin `tarjetaActiva`: la regla de antes (dólares).
  const tarjetaPermitida = pais?.tarjetaActiva ?? (pais?.moneda ?? 'USD') === 'USD';
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

  // C-COBRO-MISMOS-DATOS: el cuerpo del pedido tal como se manda (sin el total) y su huella. El
  // cobro ya creado solo se reutiliza si TODOS estos datos siguen iguales.
  const cuerpoPedido = armarCuerpoPedido({
    restauranteId: carrito.restauranteId,
    esTienda: carrito.esTienda,
    lineas: carrito.lineas,
    propinaCentavos: propina,
    anuncioId: anuncioPara(carrito.restauranteId),
    usarSaldoRegalo: usoRegalo > 0,
    valores: b.valores,
    comoRegalo,
    metodoPago,
    cupon: cupon?.codigo,
    punto,
    regalo: regalo > 0 ? regaloElegido : null,
    programadoPara: franjaElegida?.inicio,
  });
  const huella = huellaPedido(cuerpoPedido);
  const dLocal =
    conPlus && usoRegalo
      ? calcularConPromocion(
          {
            ...base,
            recogida: recogidaElegida,
            descuento: cuponAplicado + descPlus + usoRegalo,
          },
          promo,
          { envioCubierto },
        )
      : conPlus;
  // C-TOTAL-CORREGIDO: si el servidor dijo «El total cambió» con estos mismos datos, se muestra y
  // se paga su desglose (antes cada reintento mandaba el total viejo y daba el mismo 409).
  const d =
    dLocal && corregido && corregido.huella === huella
      ? { ...dLocal, ...corregido.desglose }
      : dLocal;

  async function pagar() {
    if (!d || !carrito.restauranteId) return;
    if (sinTarifas) return setError(sinTarifas);
    if (
      comoRegalo &&
      (!b.valores.paraNombre.trim() || b.valores.paraTelefono.replace(/\D/g, '').length < 10)
    )
      return setError(t.regaloFalta);
    if (programado && !franjaElegida) return setError(te.elegirFranja);
    // ETP-4: «Elegir uno» sin elegir el reemplazo no se manda (el servidor lo rechazaría).
    const sinReemplazo = carrito.esTienda
      ? carrito.lineas.find((l) => l.sustitucion === 'especifico' && !l.reemplazo)
      : undefined;
    if (sinReemplazo)
      return setError(
        tt.faltaReemplazo.replace(
          '{nombre}',
          idioma === 'en' ? sinReemplazo.nombreEn || sinReemplazo.nombreEs : sinReemplazo.nombreEs,
        ),
      );
    setError('');
    setPagando(true);
    // C-PENDIENTE-ABANDONADO: al pedir de nuevo, el servidor anula el cobro del pedido anterior.
    setCobro(null);
    try {
      const r = await api.pedir<Cobro>('POST', '/datos/pedidos', {
        ...cuerpoPedido,
        // El servidor compara este total con el suyo y no cobra si no coinciden.
        totalEsperado: d.totalCliente,
      });
      // Guardar la dirección para la próxima (si lo pidió), sin frenar el pago si falla.
      if (b.valores.guardarDireccion === 'si' && b.valores.entrega !== 'recoger')
        void api
          .pedir('POST', '/datos/mis-direcciones', {
            etiqueta: b.valores.etiquetaDireccion,
            direccion: b.valores.direccion,
            apto: b.valores.apto,
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
      setCobro({ ...r, total: r.desglose?.totalCliente ?? d.totalCliente, huella });
    } catch (x) {
      const desgloseServidor =
        x instanceof ErrorApi && x.campo === 'total'
          ? (x.datos as { desglose?: Desglose } | undefined)?.desglose
          : undefined;
      if (desgloseServidor) setCorregido({ huella, desglose: desgloseServidor });
      setError(x instanceof Error ? x.message : String(x));
    } finally {
      setPagando(false);
    }
  }

  // Si el total o cualquier dato del pedido cambió después de crear el cobro, ese cobro ya no
  // sirve: se crea el pedido de nuevo (C-COBRO-MISMOS-DATOS).
  const cobro =
    cobroGuardado && d && cobroGuardado.huella === huella && cobroGuardado.total === d.totalCliente
      ? cobroGuardado
      : null;

  const volver = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const marco = (cuerpo: React.ReactNode) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F8FA' }} edges={['top', 'left', 'right']}>
      <Encabezado titulo={tc.tuCarrito} alVolver={volver} etiquetaVolver={tc.volver} />
      <ScrollView
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
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
      // Carrito vacío como los grandes: un mensaje claro y el botón para ir a buscar comida.
      <Tarjeta style={{ alignItems: 'center', paddingVertical: 28, gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.secundario }}>{t.vacio}</Text>
        <Text style={{ color: '#5E5E5E', textAlign: 'center' }}>
          {idioma === 'en'
            ? 'Add something from a restaurant or store and it shows up here.'
            : 'Agrega algo de un restaurante o una tienda y aparece aquí.'}
        </Text>
        <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
          <Boton
            texto={idioma === 'en' ? 'Find food' : 'Buscar comida'}
            alTocar={() => router.replace('/restaurants')}
          />
        </View>
      </Tarjeta>,
    );
  }

  const fila = (texto: string, monto: number, fuerte = false) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 3 }}>
      <Text
        style={
          fuerte ? { fontWeight: '700', fontSize: 19, color: C.secundario } : { color: '#5E5E5E' }
        }
      >
        {texto}
      </Text>
      <Text
        style={
          fuerte
            ? { fontWeight: '700', fontSize: 19, color: C.secundario }
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
        fontWeight: '700',
        fontSize: 16,
        color: C.secundario,
        marginTop: 8,
        marginBottom: 8,
      }}
    >
      {texto}
    </Text>
  );
  // C-EDAD-EN-MANO: con alcohol o tabaco no se deja en la puerta (el servidor también lo cambia).
  return marco(
    <>
      <Text style={{ fontWeight: '700', fontSize: 15, color: '#5E5E5E', marginBottom: 8 }}>
        {carrito.restauranteNombre}
      </Text>
      {carrito.lineas.map((l) => {
        const foto = urlFoto(l.imagen, 'miniatura');
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
                <Text style={{ fontWeight: '700', color: C.secundario }}>
                  {textoLinea(l, idioma)}
                </Text>
                <Text style={{ fontWeight: '700', color: C.secundario, marginTop: 4 }}>
                  {formatearMonto(l.precioCentavos * l.cantidad, moneda, idioma)}
                </Text>
              </View>
              <BotonRedondo
                texto="−"
                lleno={false}
                alTocar={() => cambiarCantidad(l.clave ?? l.platoId, l.cantidad - 1)}
                etiqueta={t.menos}
              />
              <Text style={{ fontWeight: '700', minWidth: 20, textAlign: 'center' }}>
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
                        aria-checked={activo}
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
                {l.sustitucion === 'especifico' && carrito.restauranteId ? (
                  <ElegirReemplazo
                    tiendaId={carrito.restauranteId}
                    platoId={l.platoId}
                    elegido={l.reemplazo}
                    idioma={idioma}
                    elegir={(r) => cambiarSustitucion(l.clave ?? l.platoId, 'especifico', r)}
                  />
                ) : null}
              </View>
            ) : null}
          </Tarjeta>
        );
      })}

      {/* C-PEDIDO-PROGRAMADO: lo antes posible o programar día y franja, como DoorDash y Uber Eats. */}
      {titulo(te.cuando)}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {(['ahora', 'programar'] as const).map((modo) => {
          const activo = modo === 'ahora' ? !programado : Boolean(programado);
          return (
            <Pressable
              key={modo}
              onPress={() => b.cambiar('programado', modo === 'ahora' ? '' : 'elegir')}
              accessibilityRole="radio"
              accessibilityState={{ checked: activo }}
              aria-checked={activo}
              accessibilityLabel={modo === 'ahora' ? te.ahora : te.programar}
              style={{
                flex: 1,
                padding: 12,
                borderRadius: 14,
                borderWidth: activo ? 2 : 1,
                borderColor: activo ? C.primario : '#DADADA',
                backgroundColor: '#fff',
              }}
            >
              <Text style={{ fontWeight: '700', color: activo ? C.acento : C.secundario }}>
                {modo === 'ahora'
                  ? te.ahora
                  : franjaElegida
                    ? idioma === 'en'
                      ? franjaElegida.en
                      : franjaElegida.es
                    : te.programar}
              </Text>
              <Text style={{ color: '#5E5E5E', fontSize: 12, marginTop: 2 }}>
                {modo === 'ahora' ? te.ahoraAyuda : te.programarAyuda}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {programado ? (
        franjas.length ? (
          <View style={{ marginBottom: 12, gap: 8 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {dias.map((dia) => (
                <Pressable
                  key={dia}
                  onPress={() => setDiaVisto(dia)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: dia === diaActivo }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: dia === diaActivo ? C.secundario : '#fff',
                    borderWidth: 1,
                    borderColor: dia === diaActivo ? C.secundario : '#DADADA',
                  }}
                >
                  <Text
                    style={{ fontWeight: '700', color: dia === diaActivo ? '#fff' : C.secundario }}
                  >
                    {dia}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {franjas
                .filter((f) => diaDe(f) === diaActivo)
                .map((f) => {
                  const hora = (idioma === 'en' ? f.en : f.es).split(', ').slice(1).join(', ');
                  const activa = f.inicio === programado;
                  return (
                    <Pressable
                      key={f.inicio}
                      onPress={() => b.cambiar('programado', f.inicio)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: activa }}
                      aria-checked={activa}
                      accessibilityLabel={idioma === 'en' ? f.en : f.es}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: activa ? 2 : 1,
                        borderColor: activa ? C.primario : '#DADADA',
                        backgroundColor: '#fff',
                      }}
                    >
                      <Text
                        style={{ fontWeight: '700', color: activa ? C.primario : C.secundario }}
                      >
                        {hora}
                      </Text>
                    </Pressable>
                  );
                })}
            </View>
          </View>
        ) : (
          <Text style={{ color: '#5E5E5E', fontSize: 13, marginBottom: 12 }}>{te.sinFranjas}</Text>
        )
      ) : null}

      {/* Cómo recibir: en la puerta (el repartidor deja foto), en mano o recoger en el local. */}
      {titulo(te.como)}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        {(['puerta', 'mano', 'recoger'] as const).map((modo) => {
          const activo = modoActual === modo;
          const apagado = conEdad && modo === 'puerta';
          return (
            <Pressable
              key={modo}
              onPress={() => b.cambiar('entrega', modo)}
              disabled={apagado}
              accessibilityRole="radio"
              accessibilityState={{ checked: activo, disabled: apagado }}
              aria-checked={activo}
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
                opacity: apagado ? 0.45 : 1,
              }}
            >
              <Text style={{ fontWeight: '700', color: activo ? C.acento : C.secundario }}>
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
      {conEdad ? (
        <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: -4, marginBottom: 12 }}>
          {te.edadAviso}
        </Text>
      ) : null}
      {modoActual === 'mano' ? (
        <Tarjeta style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>{te.pinTitulo}</Text>
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

      {saldoRegaloCli > 0 && enEeuu ? (
        <Tarjeta style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700' }}>
              {idioma === 'en' ? 'Use my gift card balance' : 'Usar mi saldo de regalo'}
            </Text>
            <Text style={{ color: '#5E5E5E', fontSize: 13 }}>
              {formatearMonto(saldoRegaloCli, 'USD', idioma)}
            </Text>
          </View>
          <Switch
            testID="usar-saldo-regalo"
            value={usarRegalo}
            onValueChange={setUsarRegalo}
            accessibilityLabel={
              idioma === 'en' ? 'Use my gift card balance' : 'Usar mi saldo de regalo'
            }
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
                    aria-checked={activo}
                    accessibilityLabel={etiqueta}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      borderWidth: activo ? 2 : 1,
                      borderColor: activo ? C.primario : '#DADADA',
                      backgroundColor: '#fff',
                    }}
                  >
                    <Text style={{ fontWeight: '700', color: activo ? C.acento : C.secundario }}>
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
                      style={{ color: activa ? '#fff' : C.secundario, fontWeight: '700' }}
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
            direccionVacia={!b.valores.direccion.trim()}
            textos={{ ayuda: t.mapaAyuda, buscando: t.mapaBuscando, pin: t.mapaPin }}
          />
          {/* C-DIRECCION-SUGERENCIAS: direcciones reales mientras se escribe; al elegir, el pin va ahí.
              C-CARRITO-UNA-DIRECCION: la casilla no repite el título de la sección. */}
          <CampoDireccion
            etiqueta={t.direccionCampo}
            valor={b.valores.direccion}
            cambiar={(x) => b.cambiar('direccion', x)}
            alElegir={(d) => {
              setPunto(d.punto);
              void guardarUbicacion(d.punto);
            }}
            cerca={
              punto ??
              (carrito.restLat != null && carrito.restLng != null
                ? { lat: carrito.restLat, lng: carrito.restLng }
                : null)
            }
            placeholder={t.direccionAyuda}
            testID="carrito-direccion"
          />
          {/* C-DIRECCION-APTO: apartamento, piso o edificio en su propia casilla, como DoorDash. */}
          <Campo
            etiqueta={t.apto}
            value={b.valores.apto}
            onChangeText={(x) => b.cambiar('apto', x)}
            placeholder={t.aptoAyuda}
            maxLength={60}
            testID="carrito-apto"
          />
          <Tarjeta style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ flex: 1, fontWeight: '700' }}>{te.guardar}</Text>
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
        etiqueta={recogidaElegida ? t.notasRecoger : t.notas}
        value={b.valores.notas}
        onChangeText={(x) => b.cambiar('notas', x)}
        placeholder={recogidaElegida ? t.notasRecoger : t.notas}
      />
      {/* C-REGALAR-PEDIDO: como «Send as a gift» de DoorDash y Uber Eats (no en «Recoger»). */}
      {b.valores.entrega !== 'recoger' ? (
        <Tarjeta>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700' }}>{t.regaloTitulo}</Text>
              <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.regaloAyuda}</Text>
            </View>
            <Switch
              value={comoRegalo}
              onValueChange={(v) => b.cambiar('esRegalo', v ? 'si' : 'no')}
              accessibilityLabel={t.regaloTitulo}
              trackColor={{ true: C.exito, false: '#D6D6D6' }}
              testID="carrito-regalo"
            />
          </View>
          {comoRegalo ? (
            <View style={{ marginTop: 10 }}>
              <Campo
                etiqueta={t.regaloNombre}
                value={b.valores.paraNombre}
                onChangeText={(x) => b.cambiar('paraNombre', x)}
                placeholder={t.regaloNombre}
                maxLength={60}
                autoComplete="off"
              />
              <Campo
                etiqueta={t.regaloTelefono}
                value={b.valores.paraTelefono}
                onChangeText={(x) => b.cambiar('paraTelefono', x)}
                placeholder="(555) 555-0100"
                keyboardType="phone-pad"
                maxLength={20}
              />
              <Campo
                etiqueta={t.regaloMensaje}
                value={b.valores.paraMensaje}
                onChangeText={(x) => b.cambiar('paraMensaje', x)}
                placeholder={t.regaloMensajeAyuda}
                maxLength={200}
              />
            </View>
          ) : null}
        </Tarjeta>
      ) : null}
      {/* C-ALERGIAS: casilla aparte de las indicaciones, como «Allergy requests» de Uber Eats. */}
      <Campo
        etiqueta={t.alergias}
        value={b.valores.alergias}
        onChangeText={(x) => b.cambiar('alergias', x)}
        placeholder={t.alergiasAyuda}
        maxLength={200}
        testID="carrito-alergias"
      />
      {b.valores.alergias.trim() ? (
        <Text style={{ color: '#5E5E5E', fontSize: 13, marginTop: -4, marginBottom: 8 }}>
          {t.alergiasNota}
        </Text>
      ) : null}

      {titulo(recogidaElegida ? t.propinaRecoger : t.propina)}
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        {[...(tarifasListas?.propinasPb ?? PROPINAS), 'otra' as const].map((pb) => (
          <Pressable
            key={String(pb)}
            onPress={() => setPropinaPb(pb)}
            accessibilityRole="button"
            accessibilityLabel={`${recogidaElegida ? t.propinaRecoger : t.propina}: ${pb === 'otra' ? t.otra : `${pb / 100}%`}`}
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
            <Text style={{ color: propinaPb === pb ? '#fff' : C.texto, fontWeight: '700' }}>
              {pb === 'otra' ? t.otra : `${pb / 100}%`}
            </Text>
          </Pressable>
        ))}
      </View>
      {propinaPb === 'otra' && (
        <Campo
          etiqueta={recogidaElegida ? t.propinaRecoger : t.propina}
          value={b.valores.propinaOtra}
          onChangeText={(x) => b.cambiar('propinaOtra', x)}
          keyboardType="decimal-pad"
          placeholder={montoATexto(0, moneda)}
        />
      )}
      <Text style={{ color: '#5E5E5E', fontSize: 13, marginBottom: 12 }}>
        {recogidaElegida ? t.propinaNotaRecoger : t.propinaNota}
      </Text>

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
          <Text style={{ fontWeight: '700' }}>{enIdioma(NOMBRE_REGALO, idioma)[r.tipo]}</Text>
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
          <Text style={{ color: cupon ? C.secundario : '#fff', fontWeight: '700' }}>
            {cupon ? te.quitarCupon : te.aplicar}
          </Text>
        </Pressable>
      </View>
      {cupon ? (
        <Text
          style={{ color: C.exito, fontWeight: '700', marginBottom: 8 }}
          accessibilityLiveRegion="polite"
        >
          {cuponSinEfecto
            ? te.cuponConPlus
            : te.cuponOk.replace('{monto}', formatearMonto(cupon.descuento, moneda, idioma))}
        </Text>
      ) : null}
      {cuponError ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {cuponError}
        </Text>
      ) : null}
      {desgloseFiable ? (
        <Tarjeta>
          {fila(carrito.esTienda ? t.subtotalTienda : t.subtotal, d.subtotal)}
          {regalo > 0 && fila(idioma === 'en' ? 'Gift' : 'Regalo', -regalo)}
          {d.descuento - descPlus - usoRegalo > 0 &&
            fila(te.descuento, -(d.descuento - descPlus - usoRegalo))}
          {/* C-PROMO-RESTAURANTE: la paga el restaurante; se ve con su insignia. */}
          {promo &&
            d.descuentoRestaurante > 0 &&
            fila(insigniaPromocion(promo, moneda, idioma), -d.descuentoRestaurante)}
          {descPlus > 0 && fila('Divoox Plus', -descPlus)}
          {usoRegalo > 0 && fila(idioma === 'en' ? 'Gift card' : 'Tarjeta de regalo', -usoRegalo)}
          {fila(t.envio, d.envio)}
          {fila(t.servicio, d.servicio)}
          {d.cargoPedidoPequeno > 0 && fila(t.pequeno, d.cargoPedidoPequeno)}
          {d.impuesto > 0 && fila(t.impuesto, d.impuesto)}
          {fila(recogidaElegida ? t.propinaRecoger : t.propina, d.propina)}
          <View style={{ borderTopWidth: 1, borderTopColor: '#eee', marginTop: 6, paddingTop: 8 }}>
            {fila(t.total, d.totalCliente, true)}
            {referenciaConTasa(d.totalCliente, tarifasListas?.tasaReferencia) ? (
              <Text testID="carrito-total-bs" style={{ color: '#5E5E5E', fontSize: 13 }}>
                {textoReferencia(
                  referenciaConTasa(d.totalCliente, tarifasListas?.tasaReferencia),
                  idioma,
                )}
              </Text>
            ) : null}
          </View>
          {/* C-TIENDAS-PESO-REAL: con productos por peso se retiene un poco más, como Instacart. */}
          {carrito.esTienda &&
          metodoPago === 'tarjeta' &&
          margenPesables(carrito.lineas, d.totalCliente, d.subtotal) > 0 ? (
            <Text style={{ color: '#5E5E5E', fontSize: 12, marginTop: 6 }}>
              {tt.retencion.replace(
                '{monto}',
                formatearMonto(
                  d.totalCliente + margenPesables(carrito.lineas, d.totalCliente, d.subtotal),
                  moneda,
                  idioma,
                ),
              )}
            </Text>
          ) : null}
          <Pressable
            onPress={() => setVerTarifas(!verTarifas)}
            accessibilityRole="button"
            accessibilityState={{ expanded: verTarifas }}
            hitSlop={8}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}
          >
            <Text
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 1,
                borderColor: '#5E5E5E',
                textAlign: 'center',
                fontSize: 12,
                lineHeight: 16,
                color: '#5E5E5E',
              }}
            >
              i
            </Text>
            <Text
              style={{ color: C.secundario, fontWeight: '600', textDecorationLine: 'underline' }}
            >
              {idioma === 'en' ? 'What are these fees?' : '¿Qué son estas tarifas?'}
            </Text>
          </Pressable>
          {verTarifas ? (
            <View style={{ marginTop: 8, gap: 8 }} accessibilityLiveRegion="polite">
              {explicarTarifas(config, moneda, idioma).map((x) => (
                <Text key={x.clave} style={{ color: '#5E5E5E', fontSize: 13, lineHeight: 19 }}>
                  {x.texto}
                </Text>
              ))}
            </View>
          ) : null}
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
          <Text style={{ fontWeight: '700', fontSize: 17, marginBottom: 8 }}>{t.tarjeta}</Text>
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

export default conCuenta(PantallaCarrito);
