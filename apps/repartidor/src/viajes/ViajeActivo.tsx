import { comoLlegar } from '../comoLlegar';
import { type CierreViaje, cierreConRespuesta, empezarCierre } from './cierreViaje';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Switch, TextInput, View } from 'react-native';
import {
  ErrorApi,
  type Idioma,
  type MontoEnMano as Monto,
  type Referencia,
  enIdioma,
  esPagoACelular,
  formatearMonto,
  nombreFormaPago,
} from '@tumbite/compartido';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import {
  Boton,
  C,
  ChatPedido,
  COLOR,
  Deslizador,
  MontoEnMano,
  achicarFotoEvidencia,
  fotoConCamara,
  Text,
} from '@tumbite/movil';

/** C-ENVIO-FOTO-ENTREGA: la cámara y los archivos para la pieza común de fotos. */
const CAMARA_ENTREGA = {
  pedirPermiso: () => ImagePicker.requestCameraPermissionsAsync(),
  tomar: () => ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 }),
};
const deArchivosEntrega = async () => {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    quality: 0.5,
  });
  return r.canceled ? null : (r.assets[0] ?? null);
};
import { TEXTOS_VIAJE } from './textos';
import { Mapa } from '../piezas/Mapa';
import { textoOfertaConfianza } from './agendaFijos';

type Api = {
  pedir<T>(
    metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    ruta: string,
    cuerpo?: unknown,
    extra?: { cabeceras?: Record<string, string> },
  ): Promise<T>;
  subirFoto(foto: Blob, ruta?: string): Promise<{ url: string }>;
};

/** Lo que manda GET /datos/conductor/operaciones/actual. */
export type ViajeConductor = {
  id: string;
  estado: 'asignado' | 'conductor_llego' | 'en_curso' | string;
  /** «moto», «carro» o «envios»: el casco solo se confirma en Moto. */
  servicio_id?: string;
  /** C-ENVIOS: el paquete de un envío (qué es y para quién) y si ya tiene su foto. */
  paquete_descripcion?: string | null;
  paquete_destinatario?: string | null;
  paquete_foto?: number | null;
  origen_direccion: string;
  destino_direccion: string;
  origen_lat: number;
  origen_lng: number;
  destino_lat: number;
  destino_lng: number;
  metodo_pago: string;
  segundos_esperando: number | null;
  /** Cuándo llegó el conductor (hora del servidor, UTC). */
  llego_en: string | null;
  espera_gratis_s: number;
  intentos_pin_quedan: number;
  /** C-MOTO-CIUDAD: 0 si en esta ciudad (u hora) el viaje empieza sin código. */
  pin_requerido?: number;
  total: number | null;
  moneda: string | null;
  pasajero: string;
  /** C-CUPON-DIVOOX: lo que cobra en mano y lo que le paga Divoox por el regalo del pasajero. */
  cobrar_en_mano?: number | null;
  regalo_divoox?: number;
  /** C-BS-REFERENCIA: el equivalente en bolívares (solo informativo). */
  referencia?: Referencia | null;
  /** C-BS-EN-MANO: lo que cobra en mano en dólares y en bolívares con la tasa fijada del viaje. */
  en_mano?: Monto | null;
  /** C-VIAJE-PARADAS: las paradas del viaje, en orden, con su estado y su espera. */
  paradas?: {
    orden: number;
    lat: number;
    lng: number;
    direccion: string;
    estado: 'pendiente' | 'en_parada' | 'visitada';
    esperaS: number | null;
    /** Cuándo llegó a la parada (hora del servidor, UTC). */
    llegoEn?: string | null;
  }[];
  espera_parada_gratis_s?: number;
  /** C-VIAJES-FIJOS: el nombre del menor que se recoge (pide su PIN) y si sale de un viaje fijo. */
  menor_nombre?: string | null;
  viaje_fijo?: number | boolean | null;
};

/** Lo que devuelve el servidor al cerrar un viaje (el cobro final). */
export type RespuestaCierre = {
  totalFinal?: number | null;
  cobrarEnMano?: number | null;
  regaloDivoox?: number;
  referencia?: Referencia | null;
  enMano?: Monto | null;
};

/** Una clave nueva por acción: el servidor no repite nada si la app reintenta. */
const clave = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const reloj = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;

/**
 * El viaje de Moto en curso del conductor (M4), paso a paso como Uber Driver: ir a recoger con
 * navegación y «Llegué»; esperar con la cuenta de la espera gratis, casco confirmado y el código
 * del pasajero para iniciar; llevarlo y terminar; y al final cuánto cobra en efectivo. Cada
 * regla la hace cumplir el servidor (C-VIAJE-PASOS-REALES): aquí se muestra su respuesta.
 */
export function ViajeActivo({
  api,
  idioma,
  viaje,
  alCambiar,
  cierre = null,
  alCierre = () => undefined,
  yo = null,
}: {
  api: Api;
  idioma: Idioma;
  viaje: ViajeConductor;
  alCambiar: () => void;
  /**
   * C-CIERRE-VIAJE-QUEDA: el cierre de este viaje («Viaje terminado» / «Envío entregado»). Vive en
   * el inicio para sobrevivir a que el sondeo deje de ver el viaje o a que esta pantalla se vuelva a
   * montar (ver `cierreViaje.ts`). `alCierre` lo guarda, lo completa o lo suelta (`null`).
   */
  cierre?: CierreViaje<ViajeConductor, RespuestaCierre> | null;
  alCierre?: (c: CierreViaje<ViajeConductor, RespuestaCierre> | null) => void;
  /** C-MAPA-VIAJE-DRIVER: dónde está el conductor (para dibujarlo en el mapa del viaje). */
  yo?: { lat: number; lng: number } | null;
}) {
  const textos = enIdioma(TEXTOS_VIAJE, idioma);
  // C-ENVIO-TEXTOS: en un envío cada botón habla del paquete y de quien envía.
  const t =
    viaje.servicio_id === 'envios' ? { ...textos.activo, ...textos.activoEnvio } : textos.activo;
  const [pin, setPin] = useState('');
  const [cascoMarcado, setCasco] = useState(false);
  // C-CARRO-PRUEBAS / C-ENVIOS: el casco del pasajero solo se confirma en Moto.
  const enMoto = viaje.servicio_id === 'moto' || !viaje.servicio_id;
  const esEnvio = viaje.servicio_id === 'envios';
  const [pinEntrega, setPinEntrega] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  /** C-ENVIOS: la foto del paquete al recogerlo, antes de salir. */
  async function fotoPaquete() {
    setError('');
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return setError(t.permisoCamara);
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
    const foto = r.canceled ? null : r.assets[0];
    if (!foto) return;
    setSubiendoFoto(true);
    try {
      // C-FOTO-EVIDENCIA-LIVIANA: achicada en el teléfono antes de subir.
      const blob = await (
        await fetch(await achicarFotoEvidencia(foto, manipulateAsync, SaveFormat.JPEG))
      ).blob();
      await api.subirFoto(blob, `/datos/conductor/operaciones/${viaje.id}/foto-paquete`);
      alCambiar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setSubiendoFoto(false);
    }
  }
  /**
   * C-ENVIO-FOTO-ENTREGA: la foto OPCIONAL al entregar, además del PIN, por la pieza común que pregunta
   * «Tomar foto» o «Subir desde archivos» (C-CAMARA-EN-TODA-SUBIDA).
   */
  const [fotoEntregaLista, setFotoEntregaLista] = useState(false);
  // C-CHAT-VIAJE: mensajes con el pasajero mientras el viaje está activo (sin teléfonos).
  const [verChat, setVerChat] = useState(false);
  async function fotoEntrega() {
    setError('');
    const foto = await fotoConCamara(idioma, CAMARA_ENTREGA, deArchivosEntrega);
    if (!foto) return;
    setSubiendoFoto(true);
    try {
      // C-FOTO-EVIDENCIA-LIVIANA: achicada en el teléfono antes de subir.
      const blob = await (
        await fetch(await achicarFotoEvidencia(foto, manipulateAsync, SaveFormat.JPEG))
      ).blob();
      await api.subirFoto(
        blob,
        `/datos/conductor/operaciones/${viaje.id}/foto-paquete?momento=entrega`,
      );
      setFotoEntregaLista(true);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setSubiendoFoto(false);
    }
  }
  const casco = cascoMarcado || !enMoto;
  // C-MOTO-CIUDAD: en las ciudades (u horas) sin código, no se pide.
  const conCodigo = viaje.pin_requerido !== 0;
  const [error, setError] = useState('');
  // C-VIAJE-PARADAS: «Saltar parada» pide un segundo toque.
  const [saltar, setSaltar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  // M7 y C-CIERRE-VIAJE-QUEDA: lo que cobra al terminar (precio fijo + espera + lo que el pasajero
  // debía), tal como lo devolvió el servidor al cerrar; vive en el cierre del inicio.
  const respuesta = cierre?.viaje.id === viaje.id ? cierre.respuesta : null;
  const totalFinal =
    respuesta?.totalFinal != null ? (respuesta.cobrarEnMano ?? respuesta.totalFinal) : null;
  const regaloFinal = respuesta?.regaloDivoox ?? null;
  // C-CUPON-DIVOOX: «Cobra X · Divoox te paga Y». Sin regalo, X es el precio de siempre.
  const enMano = viaje.cobrar_en_mano ?? viaje.total;
  const regaloDivoox = regaloFinal ?? viaje.regalo_divoox ?? 0;
  // C-PRECIO-PROTAGONISTA: lo que paga Divoox por el regalo, aparte y en verde (nunca mezclado con
  // lo que cobra en mano).
  const lineaRegalo =
    regaloDivoox > 0 ? (
      <View
        testID="viaje-divoox-paga"
        accessible
        style={{ backgroundColor: COLOR.exitoSuave, borderRadius: 10, padding: 10, gap: 2 }}
      >
        <Text style={{ color: C.exito, fontWeight: '800', fontSize: 17 }}>
          {t.divooxPagaCorto.replace(
            '{monto}',
            formatearMonto(regaloDivoox, viaje.moneda ?? 'USD', idioma),
          )}
        </Text>
        <Text style={{ color: C.exito, fontSize: 13 }}>{t.divooxPagaAyuda}</Text>
      </View>
    ) : null;
  // C-PAGO-A-CELULAR: pago móvil (Venezuela), Yape y Plin (Perú) llegan al celular del conductor y
  // él confirma a mano. `medioCelular` es el nombre que se pinta cuando no es pago móvil.
  const aCelular = esPagoACelular(viaje.metodo_pago);
  const medioCelular =
    aCelular && viaje.metodo_pago !== 'pago_movil'
      ? nombreFormaPago(viaje.metodo_pago, idioma)
      : null;
  /** La etiqueta de lo que cobra en mano: con regalo, «Cobra al pasajero» (la diferencia). */
  const etiquetaCobro =
    regaloDivoox > 0
      ? t.cobraAlPasajero
      : medioCelular
        ? t.cobraCelular(medioCelular)
        : viaje.metodo_pago === 'pago_movil'
          ? t.cobraPagoMovil
          : t.cobra;
  const referenciaFinal = respuesta?.referencia ?? null;
  const enManoFinal = respuesta?.enMano ?? null;
  // C-BS-EN-MANO: lo que cobra en mano (con regalo, la diferencia) en dólares y en bolívares. Una app
  // con un servidor viejo (sin `en_mano`) arma el monto en dólares con el equivalente de siempre.
  const idiomaCorto = idioma === 'en' ? 'en' : 'es';
  const cobroEnMano = (final: boolean): Monto | null => {
    const deServidor = final ? (enManoFinal ?? viaje.en_mano) : viaje.en_mano;
    if (deServidor) return deServidor;
    const monto = final ? (totalFinal ?? enMano) : enMano;
    if (monto == null) return null;
    const local = final ? (referenciaFinal ?? viaje.referencia) : viaje.referencia;
    return { monto, moneda: viaje.moneda ?? 'USD', local: local ?? null, sinTasa: false };
  };
  const estrellas = cierre?.estrellas ?? 0;
  const setEstrellas = (n: number) => {
    if (cierre) alCierre({ ...cierre, estrellas: n });
  };
  /** M8: el conductor califica al pasajero (una vez); después vuelve al inicio. */
  async function calificarYSalir() {
    if (estrellas)
      await api
        .pedir('POST', `/datos/conductor/operaciones/${viaje.id}/calificar`, { estrellas })
        .catch(() => undefined);
    alCierre(null);
    alCambiar();
  }
  // La espera corre en la pantalla desde la hora de llegada que guardó el servidor.
  const [tic, setTic] = useState(() => Date.now());
  useEffect(() => {
    const r = setInterval(() => setTic(Date.now()), 1000);
    return () => clearInterval(r);
  }, []);
  const llegada = viaje.llego_en ? Date.parse(`${viaje.llego_en.replace(' ', 'T')}Z`) : null;
  const esperando =
    llegada == null
      ? (viaje.segundos_esperando ?? 0)
      : Math.max(0, Math.floor((tic - llegada) / 1000));
  const quedaGratis = viaje.espera_gratis_s - esperando;
  const nombre = viaje.pasajero || t.pasajero;

  const paso = useCallback(
    async (nombrePaso: string, cuerpo: unknown = {}, final?: 'terminado' | 'no_show') => {
      setEnviando(true);
      setError('');
      // C-CIERRE-VIAJE-QUEDA: el cierre se guarda en el inicio ANTES de mandar el paso final; si el
      // sondeo deja de ver el viaje antes de la respuesta, el inicio no lo suelta.
      const enCierre = final ? empezarCierre<ViajeConductor, RespuestaCierre>(viaje, final) : null;
      if (enCierre) alCierre(enCierre);
      try {
        const r = await api.pedir<RespuestaCierre>(
          'POST',
          `/datos/conductor/operaciones/${viaje.id}/${nombrePaso}`,
          cuerpo,
          { cabeceras: { 'idempotency-key': clave() } },
        );
        // C-CUPON-DIVOOX: lo que cobra en mano ya descuenta el regalo que paga Divoox.
        if (enCierre) alCierre(cierreConRespuesta(enCierre, r ?? {}));
        else alCambiar();
      } catch (x) {
        // El paso no se hizo: el cierre se suelta y vuelve el viaje en curso (o el inicio).
        if (final) alCierre(null);
        setError(x instanceof ErrorApi ? x.message : String(x));
      } finally {
        setEnviando(false);
      }
    },
    [api, viaje, alCambiar, alCierre],
  );

  // C-PAGO-MOVIL-VIAJE: lo que el conductor ya confirmó del pago móvil (en esta pantalla).
  const [pagoMovil, setPagoMovil] = useState<'recibido' | 'no_recibido' | null>(null);
  async function confirmarPagoMovil(recibido: boolean) {
    setError('');
    try {
      const r = await api.pedir<{ estado: 'recibido' | 'no_recibido' | null }>(
        'POST',
        `/datos/conductor/operaciones/${viaje.id}/pago-movil`,
        { recibido },
      );
      setPagoMovil(r.estado);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  // C-CIERRE-VIAJE-QUEDA: con el cierre de este viaje ya respondido, la pantalla arranca en él (aunque
  // se haya vuelto a montar).
  if (cierre?.respondido && cierre.viaje.id === viaje.id)
    return (
      <View testID="viaje-cerrado" style={{ padding: 20, gap: 14 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: C.secundario }}>
          {cierre.final === 'terminado' ? t.terminado : t.noShow}
        </Text>
        {cierre.final === 'terminado' &&
        (viaje.metodo_pago === 'efectivo' || aCelular) &&
        (totalFinal ?? enMano) != null ? (
          <View
            testID="viaje-cobra-efectivo"
            style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14 }}
          >
            {(cobroEnMano(true)?.monto ?? 0) > 0 ? (
              <MontoEnMano
                testID="viaje-cobra-monto"
                monto={cobroEnMano(true)}
                idioma={idiomaCorto}
                quien="conductor"
                etiqueta={etiquetaCobro}
                color={C.exito}
                tamano="grande"
                copiable={aCelular}
              />
            ) : (
              // C-OFERTA-SIN-COBRO: el regalo cubrió todo; se dice en palabras, sin un cero grande.
              <Text
                testID="viaje-cobra-sin-cobro"
                style={{ fontSize: 16, fontWeight: '800', color: C.exito }}
              >
                {t.sinCobroEnMano}
              </Text>
            )}
            {lineaRegalo}
          </View>
        ) : null}
        {cierre.final === 'terminado' ? (
          <View testID="viaje-calificar-pasajero" style={{ gap: 6 }}>
            <Text style={{ fontWeight: '800', color: C.secundario }}>{t.califica}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setEstrellas(n)}
                  accessibilityRole="button"
                  accessibilityLabel={`${n} ${t.estrellas}`}
                  accessibilityState={{ selected: estrellas === n }}
                >
                  <Text style={{ fontSize: 32, color: n <= estrellas ? C.exito : '#C9CED6' }}>
                    ★
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        <Boton texto={t.listo} alTocar={() => void calificarYSalir()} exito />
      </View>
    );

  // C-VIAJE-PARADAS: con el viaje en curso, la parada que toca (en la que está o la que sigue).
  const paradas = viaje.paradas ?? [];
  const indiceParada =
    viaje.estado === 'en_curso' ? paradas.findIndex((p) => p.estado !== 'visitada') : -1;
  const parada = indiceParada >= 0 ? paradas.at(indiceParada) : undefined;
  const enParada = parada?.estado === 'en_parada';
  // La espera de la parada corre desde la hora de llegada que guardó el servidor.
  const llegadaParada =
    enParada && parada?.llegoEn ? Date.parse(`${parada.llegoEn.replace(' ', 'T')}Z`) : null;
  const esperaParada = !enParada
    ? 0
    : llegadaParada == null
      ? (parada?.esperaS ?? 0)
      : Math.max(0, Math.floor((tic - llegadaParada) / 1000));
  const quedaParada = (viaje.espera_parada_gratis_s ?? 120) - esperaParada;
  const titulo =
    viaje.estado === 'asignado'
      ? `${t.irARecoger} ${nombre}`
      : viaje.estado === 'conductor_llego'
        ? `${t.esperando} ${nombre}`
        : parada
          ? enParada
            ? t.enParada(indiceParada + 1)
            : t.irAParada(indiceParada + 1, paradas.length)
          : esEnvio
            ? `${t.llevandoPaquete} ${viaje.paquete_destinatario ?? ''}`.trim()
            : `${t.llevando} ${nombre}`;
  const direccion = parada
    ? parada.direccion
    : viaje.estado === 'en_curso'
      ? viaje.destino_direccion
      : viaje.origen_direccion;
  const punto = parada
    ? { lat: parada.lat, lng: parada.lng }
    : viaje.estado === 'en_curso'
      ? { lat: viaje.destino_lat, lng: viaje.destino_lng }
      : { lat: viaje.origen_lat, lng: viaje.origen_lng };

  return (
    <View testID="viaje-activo" style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: C.secundario }}>{titulo}</Text>
      {viaje.menor_nombre || viaje.viaje_fijo ? (
        // C-VIAJES-FIJOS: el viaje de un menor se recuerda en todo el viaje (y su PIN, al recogerlo).
        <View
          testID="viaje-menor"
          style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 12, gap: 4 }}
        >
          {textoOfertaConfianza(
            { viajeFijo: Boolean(viaje.viaje_fijo), menor: viaje.menor_nombre ?? null },
            idioma === 'en' ? 'en' : 'es',
          ).map((l) => (
            <Text key={l} style={{ fontWeight: '800', color: C.secundario }}>
              {l}
            </Text>
          ))}
        </View>
      ) : null}
      {/* C-PRECIO-PROTAGONISTA: el precio, grande, en negrita y en verde, arriba en todos los pasos
          del viaje y del envío (ir a recoger, esperando, en curso y en cada parada). */}
      <View
        testID="viaje-precio"
        style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 16, padding: 16, gap: 10 }}
      >
        {(viaje.metodo_pago === 'efectivo' || aCelular) && enMano != null ? (
          (cobroEnMano(false)?.monto ?? 0) > 0 ? (
            <MontoEnMano
              testID="viaje-bs"
              monto={cobroEnMano(false)}
              idioma={idiomaCorto}
              quien="conductor"
              etiqueta={etiquetaCobro}
              color={C.exito}
              tamano="grande"
            />
          ) : (
            // C-OFERTA-SIN-COBRO: el regalo cubre todo; se dice en palabras, sin un cero grande.
            <Text
              testID="viaje-sin-cobro"
              style={{ fontSize: 16, fontWeight: '800', color: C.exito }}
            >
              {t.sinCobroEnMano}
            </Text>
          )
        ) : viaje.total != null ? (
          // Con tarjeta no se cobra nada en mano: el precio va grande pero en el color de texto (el
          // verde es solo para lo que el conductor cobra en mano o gana), con el aviso bien visible.
          <View testID="viaje-tarjeta-bloque" style={{ gap: 2 }}>
            <Text
              testID="viaje-tarjeta-aviso"
              style={{ fontSize: 16, fontWeight: '800', color: C.secundario }}
            >
              {t.pagaConTarjeta}
            </Text>
            <MontoEnMano
              testID="viaje-tarjeta"
              monto={{
                monto: viaje.total,
                moneda: viaje.moneda ?? 'USD',
                local: null,
                sinTasa: false,
              }}
              idioma={idiomaCorto}
              quien="conductor"
              color={COLOR.texto}
              tamano="grande"
            />
          </View>
        ) : null}
        {lineaRegalo}
      </View>
      {/* C-MAPA-VIAJE-DRIVER: el mapa con la recogida, el destino y el conductor, debajo del precio
          (el precio sigue siendo lo primero). La cámara se mueve solo cuando cambia un punto. */}
      {/* C-MAPA-VISTA-PREVIA: como Uber Driver, el mapa pequeño no se arrastra (el dedo desplaza la
          pantalla hasta el deslizador) y tocarlo abre la navegación. */}
      <Pressable
        testID="viaje-mapa"
        onPress={() => comoLlegar({ lat: punto.lat, lng: punto.lng }, idioma)}
        accessibilityRole="button"
        accessibilityLabel={t.navegar}
        style={{ borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#2a2a2a' }}
      >
        <Mapa
          yo={yo}
          restaurante={{ lat: viaje.origen_lat, lng: viaje.origen_lng }}
          casa={{ lat: viaje.destino_lat, lng: viaje.destino_lng }}
          direccionDestino={direccion}
          alto={200}
          etiquetas={{ yo: t.mapaYo, restaurante: t.mapaRecogida, casa: t.mapaDestino }}
          vistaPrevia
        />
      </Pressable>
      <View style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 12 }}>
        <Text style={{ fontWeight: '800', color: C.secundario }}>{direccion}</Text>
      </View>
      {parada ? (
        // C-VIAJE-PARADAS: qué sigue después de esta parada (las demás paradas y el destino).
        <View testID="viaje-paradas" style={{ gap: 2 }}>
          <Text style={{ color: '#666B73', fontSize: 12 }}>{t.despues}</Text>
          {paradas.slice(indiceParada + 1).map((p, i) => (
            <Text key={p.orden} style={{ color: C.secundario }} numberOfLines={1}>
              {indiceParada + 2 + i}. {p.direccion}
            </Text>
          ))}
          <Text style={{ color: C.secundario }} numberOfLines={1}>
            {t.destinoFinal}: {viaje.destino_direccion}
          </Text>
        </View>
      ) : null}
      {viaje.estado !== 'conductor_llego' && !enParada ? (
        <Boton
          texto={t.navegar}
          alTocar={() => comoLlegar({ lat: punto.lat, lng: punto.lng }, idioma)}
          secundario
        />
      ) : null}

      {viaje.estado === 'asignado' ? (
        <>
          {/* C-PASOS-DESLIZANDO: «Llegué» se desliza (como Uber Driver): un toque no lo marca. */}
          <Deslizador
            variante="accion"
            tono="exito"
            testID="viaje-llegue"
            texto={t.deslizarLlegue}
            accionLector={t.llegue}
            ocupado={enviando}
            confirmar={t.confirmarLlegue}
            alConfirmar={() => paso('llegue')}
          />
          <Pressable
            onPress={() => void paso('liberar', { motivo: 'conductor_suelta' })}
            accessibilityRole="button"
          >
            <Text style={{ textAlign: 'center', color: '#666B73', fontWeight: '700', padding: 8 }}>
              {t.soltar}
            </Text>
          </Pressable>
        </>
      ) : null}

      {viaje.estado === 'conductor_llego' ? (
        <>
          <View
            testID="viaje-espera"
            style={{ backgroundColor: '#F6F6F6', borderRadius: 12, padding: 12 }}
          >
            <Text style={{ color: '#666B73' }}>
              {quedaGratis > 0 ? t.esperaGratis : t.esperaTerminada}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: C.secundario }}>
              {quedaGratis > 0 ? reloj(quedaGratis) : reloj(esperando)}
            </Text>
          </View>
          {enMoto ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Switch
                  value={cascoMarcado}
                  onValueChange={setCasco}
                  accessibilityLabel={t.casco}
                  testID="viaje-casco"
                />
                <Text style={{ flex: 1, color: C.secundario, fontWeight: '700' }}>{t.casco}</Text>
              </View>
              <Text style={{ color: '#666B73', fontSize: 12 }}>{t.cascoAviso}</Text>
            </>
          ) : null}
          {conCodigo ? (
            <>
              <Text style={{ fontWeight: '800', color: C.secundario }}>{t.codigo}</Text>
              <TextInput
                testID="viaje-pin"
                value={pin}
                onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                accessibilityLabel={t.codigo}
                style={{
                  borderWidth: 1,
                  borderColor: '#2a2a2a',
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 24,
                  letterSpacing: 8,
                  textAlign: 'center',
                }}
              />
              <Text style={{ color: '#666B73', fontSize: 12 }}>
                {t.codigoAyuda} ({viaje.intentos_pin_quedan} {t.intentos})
              </Text>
            </>
          ) : null}
          {casco && (!conCodigo || pin.length === 4) ? (
            // C-PASOS-DESLIZANDO: iniciar el viaje (o «recogí el paquete») se desliza.
            <Deslizador
              variante="accion"
              tono="exito"
              testID="viaje-iniciar"
              texto={t.deslizarIniciar}
              accionLector={t.iniciar}
              ocupado={enviando}
              confirmar={t.confirmarIniciar}
              alConfirmar={() => paso('iniciar', conCodigo ? { pin } : {})}
            />
          ) : null}
          {quedaGratis <= 0 ? (
            <Boton
              texto={t.noSePresento}
              alTocar={() => void paso('no-se-presento', {}, 'no_show')}
              cargando={enviando}
              secundario
            />
          ) : null}
        </>
      ) : null}

      {esEnvio && viaje.paquete_descripcion ? (
        <Text style={{ color: C.secundario, fontWeight: '700' }}>
          {viaje.paquete_descripcion} · {t.para} {viaje.paquete_destinatario}
        </Text>
      ) : null}
      {esEnvio && viaje.estado === 'conductor_llego' ? (
        <Boton
          texto={viaje.paquete_foto ? t.fotoPaqueteLista : t.fotoPaquete}
          alTocar={() => void fotoPaquete()}
          cargando={subiendoFoto}
          secundario={Boolean(viaje.paquete_foto)}
        />
      ) : null}
      {viaje.estado === 'en_curso' && esEnvio ? (
        <>
          <Text style={{ fontWeight: '800', color: C.secundario }}>{t.pinEntrega}</Text>
          <TextInput
            testID="envio-pin-entrega"
            value={pinEntrega}
            onChangeText={(v) => setPinEntrega(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
            accessibilityLabel={t.pinEntrega}
            style={{
              borderWidth: 1,
              borderColor: '#2a2a2a',
              borderRadius: 10,
              padding: 12,
              fontSize: 24,
              letterSpacing: 8,
              textAlign: 'center',
            }}
          />
          <Text style={{ color: '#666B73', fontSize: 12 }}>{t.pinEntregaAyuda}</Text>
          <Text style={{ fontWeight: '700', color: C.secundario }}>
            {fotoEntregaLista ? t.fotoEntregaLista : t.fotoEntrega}
          </Text>
          <Boton
            texto={fotoEntregaLista ? t.fotoEntregaOtra : t.fotoEntregaBoton}
            alTocar={() => void fotoEntrega()}
            cargando={subiendoFoto}
            secundario
          />
        </>
      ) : null}
      {['asignado', 'conductor_llego', 'en_curso'].includes(viaje.estado) ? (
        <>
          <Boton
            texto={verChat ? t.ocultarMensajes : t.mensajesPasajero}
            alTocar={() => setVerChat((x) => !x)}
            secundario
          />
          {verChat ? <ChatPedido pedidoId={viaje.id} ruta={`/datos/viajes/${viaje.id}`} /> : null}
        </>
      ) : null}
      {/* C-PAGO-MOVIL-VIAJE: confirmación MANUAL de que el pago móvil llegó (nunca «del banco»). */}
      {viaje.estado === 'en_curso' && aCelular ? (
        <View
          testID="viaje-pago-movil"
          style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 12, gap: 8 }}
        >
          {pagoMovil ? (
            <>
              <Text
                style={{
                  fontWeight: '800',
                  color: pagoMovil === 'recibido' ? C.exito : C.primario,
                }}
              >
                {pagoMovil === 'recibido'
                  ? medioCelular
                    ? t.celularRecibido(medioCelular)
                    : t.pagoMovilRecibido
                  : t.pagoMovilAviso}
              </Text>
              {/* C-PAGO-MOVIL-CORREGIR: si marcó «no me llegó» por error, lo corrige una vez. */}
              {pagoMovil === 'no_recibido' ? (
                <Boton
                  texto={t.pagoMovilCorregir}
                  secundario
                  alTocar={() => void confirmarPagoMovil(true)}
                />
              ) : null}
            </>
          ) : (
            <>
              <Text style={{ color: C.secundario }}>
                {medioCelular ? t.celularPregunta(medioCelular) : t.pagoMovilPregunta}
              </Text>
              {/* C-BS-EN-MANO: el monto exacto del pago móvil, grande, en dólares y en bolívares. */}
              <MontoEnMano
                testID="viaje-pago-movil-monto"
                monto={cobroEnMano(true)}
                idioma={idiomaCorto}
                quien="conductor"
                color={C.exito}
                tamano="grande"
                copiable
              />
              <Boton
                texto={t.pagoMovilSi}
                exito
                cargando={enviando}
                alTocar={() => void confirmarPagoMovil(true)}
              />
              <Boton
                texto={t.pagoMovilNo}
                secundario
                alTocar={() => void confirmarPagoMovil(false)}
              />
            </>
          )}
        </View>
      ) : null}
      {parada && !enParada ? (
        <>
          {/* C-PASOS-DESLIZANDO: llegar a la parada se desliza. */}
          <Deslizador
            variante="accion"
            tono="exito"
            testID="viaje-parada-llegue"
            texto={t.deslizarLlegueParada}
            accionLector={t.llegueParada}
            ocupado={enviando}
            confirmar={t.confirmarLlegueParada}
            alConfirmar={() => paso(`paradas/${parada.orden}/llegue`)}
          />
          <Pressable
            onPress={() => {
              if (!saltar) return setSaltar(true);
              setSaltar(false);
              void paso(`paradas/${parada.orden}/saltar`);
            }}
            accessibilityRole="button"
            testID="viaje-parada-saltar"
          >
            <Text style={{ textAlign: 'center', color: '#666B73', fontWeight: '700', padding: 8 }}>
              {saltar ? t.saltarConfirmar : t.saltarParada}
            </Text>
          </Pressable>
        </>
      ) : null}
      {parada && enParada ? (
        <>
          <View
            testID="viaje-parada-espera"
            style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 12 }}
          >
            <Text style={{ color: '#666B73' }}>
              {quedaParada > 0 ? t.esperaParada : t.esperaParadaTerminada}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: C.secundario }}>
              {reloj(quedaParada > 0 ? quedaParada : esperaParada)}
            </Text>
          </View>
          {/* C-PASOS-DESLIZANDO: seguir después de la parada se desliza. */}
          <Deslizador
            variante="accion"
            tono="exito"
            testID="viaje-parada-seguir"
            texto={t.deslizarSeguir}
            accionLector={t.seguir}
            ocupado={enviando}
            confirmar={t.confirmarSeguir}
            alConfirmar={() => paso(`paradas/${parada.orden}/seguir`)}
          />
        </>
      ) : null}
      {viaje.estado === 'en_curso' && !parada && (!esEnvio || pinEntrega.length === 4) ? (
        // C-CERRAR-DESLIZANDO (robot, 18 nov 2026): entregar un envío o terminar un viaje se
        // desliza, como el cierre de la entrega de comida: un toque accidental no lo cierra.
        <Deslizador
          variante="accion"
          tono="exito"
          testID="viaje-terminar"
          texto={esEnvio ? t.entregar : t.terminar}
          accionLector={esEnvio ? t.entregar : t.terminar}
          ocupado={enviando}
          // Revisor (18 nov 2026): con lector de pantalla, cerrar pregunta antes.
          confirmar={esEnvio ? t.confirmarEntregar : t.confirmarTerminar}
          alConfirmar={() => paso('terminar', esEnvio ? { pinEntrega } : {}, 'terminado')}
        />
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
          {error}
        </Text>
      ) : null}
      {/* M6: emergencia. Primero la llamada (aunque falle el aviso al equipo). */}
      <Boton
        texto={t.emergencia}
        alTocar={() =>
          void api
            .pedir<{ numero: string }>(
              'POST',
              `/datos/conductor/operaciones/${viaje.id}/emergencia`,
            )
            .catch(() => ({ numero: '911' }))
            .then((r) => Linking.openURL(`tel:${r.numero}`))
        }
      />
      <Text style={{ color: '#6B7078', fontSize: 12 }}>{t.soporte}</Text>
    </View>
  );
}
