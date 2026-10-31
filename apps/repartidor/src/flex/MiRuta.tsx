/* eslint-disable security/detect-object-injection -- índices sobre los textos fijos de la pantalla */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type AccionFlex,
  ErrorApi,
  type Idioma,
  METODOS_COBRO,
  METODOS_CON_REFERENCIA,
  MOTIVOS_INCIDENCIA,
  type MetodoCobro,
  PROXIMAS_ACCIONES,
  crearColaFlex,
  distanciaKm,
  efectivoEnMano,
  enIdioma,
  formatearMonto,
  leerCodigoEscaneado,
  pruebasFaltantes,
  sePuedeReintentar,
  validarCobro,
  cumpleFiltro,
} from '@tumbite/compartido';
import { Boton, C, e } from '@tumbite/movil';
import type { Punto } from '../piezas/mapaWeb';
import { Firma } from './Firma';
import { MapaRuta, type PuntoRuta } from './MapaRuta';
import {
  Atras,
  Banner,
  Barra,
  BORDE,
  Caja,
  Camara,
  Fila,
  GRIS,
  Listo,
  Numero,
  Pastilla,
  Pestanas,
  RESALTE,
  SUAVE,
  type TonoParada,
  tarjeta,
  tonoPaquete,
  tonoRuta,
} from './piezas';
import { TEXTOS_RUTA } from './textos';

type Api = {
  pedir<T>(
    metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    ruta: string,
    cuerpo?: unknown,
    extra?: { cabeceras?: Record<string, string> },
  ): Promise<T>;
  subirArchivo<T>(archivo: Blob, ruta: string, cabeceras?: Record<string, string>): Promise<T>;
};

type Paquete = {
  id: string;
  codigoSeguimiento: string;
  codigoEtiqueta: string;
  estado: string;
  descripcion?: string | null;
  cargado: boolean;
  excluido: boolean;
  entregadoAlCentro: boolean;
};
type Parada = {
  id: string;
  orden: number;
  estado: string;
  llegadaEn?: string | null;
  resueltaEn?: string | null;
  direccion: string;
  instrucciones: string;
  lat: number | null;
  lng: number | null;
  sinCoordenadas: boolean;
  destinatarioNombre: string | null;
  destinatarioTelefono: string | null;
  ventanaDesde: string | null;
  ventanaHasta: string | null;
  referenciaExterna: string | null;
  pruebas: {
    foto: boolean;
    pin: boolean;
    firma: boolean;
    sinContacto: boolean;
    reintentoEnRuta: boolean;
  };
  /** Fase 6 (C-FLEX-COBRO): cobro contra entrega de esta parada (Venezuela). */
  cobro?: {
    monto: number;
    moneda: string;
    estado: string;
    metodo: string | null;
    montoRecibido?: number | null;
    monedaRecibida?: string | null;
  } | null;
  paquetes: Paquete[];
};
type Ruta = {
  id: string;
  nombre: string;
  estado: string;
  empresa: string;
  ofertaVenceEn: string | null;
  iniciadaEn: string | null;
  cerradaEn: string | null;
  centro: { nombre: string; direccion: string; lat: number | null; lng: number | null } | null;
  resumen: Record<string, number | string | null> | null;
  progreso: {
    total: number;
    cargados: number;
    entregados: number;
    excluidos: number;
    paradas?: number;
    paradasResueltas?: number;
  };
  paradas: Parada[];
};
type Fila = {
  id: string;
  nombre: string;
  empresa: string;
  estado: string;
  ofertaVenceEn: string | null;
  bloqueDesde?: string | null;
  bloqueHasta?: string | null;
  cerradaEn?: string | null;
  paradas: number;
  paquetes: number;
};
type Textos = (typeof TEXTOS_RUTA)['es'];
type Encolar = (a: Omit<AccionFlex, 'id' | 'capturadoEn' | 'estado' | 'intentos'>) => Promise<void>;

const B = '/datos/v1/flex/conductor/rutas';
/** Pestañas de «Mis rutas»: solo con lo que devuelve el servidor (activas y cerradas en 7 días). */
const ACTUAL = ['aceptada', 'en_carga', 'en_curso'];
const PROXIMAS = ['ofrecida', 'asignada'];
const PARADA_RESUELTA = ['entregada', 'fallida', 'omitida'];
const nuevoId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;

async function ubicacion(): Promise<{ lat: number; lng: number } | null> {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (!permiso.granted) return null;
    const tope = new Promise<null>((ok) => setTimeout(() => ok(null), 10000));
    const p = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      tope,
    ]);
    const q = p ?? (await Location.getLastKnownPositionAsync());
    return q ? { lat: q.coords.latitude, lng: q.coords.longitude } : null;
  } catch {
    return null;
  }
}

function navegar(lat: number | null, lng: number | null, direccion: string, t?: Textos) {
  const destino = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(direccion);
  const apps = [
    ...(Platform.OS === 'ios'
      ? [{ text: 'Apple Maps', url: `http://maps.apple.com/?daddr=${destino}` }]
      : []),
    { text: 'Google Maps', url: `https://www.google.com/maps/dir/?api=1&destination=${destino}` },
    {
      text: 'Waze',
      url: `https://waze.com/ul?${lat != null && lng != null ? `ll=${destino}` : `q=${destino}`}&navigate=yes`,
    },
  ];
  // C-FLEX-MAPAS (como Amazon Flex): el repartidor elige su app de mapas. En la web, Google Maps.
  if (!t || Platform.OS === 'web') {
    void Linking.openURL(apps.find((a) => a.text === 'Google Maps')!.url);
    return;
  }
  Alert.alert(t.elegirMapa, undefined, [
    ...apps.map((a) => ({ text: a.text, onPress: () => void Linking.openURL(a.url) })),
    { text: t.cancelar, style: 'cancel' as const },
  ]);
}

const fecha = (f: string) => new Date(`${f.replace(' ', 'T')}${f.includes('Z') ? '' : 'Z'}`);
const hora = (f: string | null | undefined, idioma: Idioma) =>
  f
    ? fecha(f).toLocaleString(idioma === 'en' ? 'en-US' : 'es-US', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : '—';
const horaSola = (f: string | null | undefined, idioma: Idioma) =>
  f
    ? fecha(f).toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es-US', { timeStyle: 'short' })
    : '—';

/** Punto de una parada o del centro (solo si tiene coordenadas). */
const coord = (x: { lat: number | null; lng: number | null } | null | undefined): Punto | null =>
  x && x.lat != null && x.lng != null ? { lat: x.lat, lng: x.lng } : null;

/** Distancia en línea recta, dicha como aproximada (no tenemos tiempos ni distancias por calles). */
function km(a: Punto | null, b: Punto | null, t: Textos, idioma: Idioma): string | null {
  if (!a || !b) return null;
  const d = distanciaKm(a, b);
  return `${d.toLocaleString(idioma === 'en' ? 'en-US' : 'es-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} km ${t.aprox}`;
}

const nombreParada = (p: Parada) => p.destinatarioNombre || p.direccion;
const paquetesActivos = (p: Parada) => p.paquetes.filter((q) => !q.excluido);
const siguienteDe = (r: Ruta) =>
  r.paradas.find((p) => ['pendiente', 'llegada'].includes(p.estado)) ?? null;
function tonoParada(p: Parada, siguienteId: string | null): TonoParada {
  if (p.estado === 'entregada') return 'hecho';
  if (p.estado === 'fallida') return 'fallida';
  if (p.id === siguienteId) return 'actual';
  return 'pendiente';
}
const resueltas = (r: Ruta) =>
  r.progreso.paradasResueltas ?? r.paradas.filter((p) => PARADA_RESUELTA.includes(p.estado)).length;

/**
 * «Mi ruta» de Divoox Flex dentro de Divoox Driver: las rutas de paquetes que le asignan u ofrecen
 * las empresas, la carga con escáner (QR y Code 128), las paradas en orden con navegación, la
 * entrega con las pruebas que pide la empresa, las incidencias, las devoluciones y el cierre.
 * Lo que se hace sin señal queda en la cola del celular y se manda solo, sin duplicar.
 */
function MiRutaContenido({
  api,
  idioma,
  abrirRutaId = null,
}: {
  api: Api;
  idioma: Idioma;
  /** Fase 3: la ruta del aviso que tocó el conductor (se abre directo). */
  abrirRutaId?: string | null;
}) {
  const t = enIdioma(TEXTOS_RUTA, idioma);
  const [lista, setLista] = useState<Fila[] | null>(null);
  const [pestana, setPestana] = useState<'actual' | 'proximas' | 'historial' | null>(null);
  // La ruta en curso de la lista, para mostrar su avance en la tarjeta.
  const [activa, setActiva] = useState<Ruta | null>(null);
  // La ruta del aviso abre directo; si llega otro aviso, Inicio vuelve a montar esta pantalla (key).
  const [rutaId, setRutaId] = useState<string | null>(abrirRutaId);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [paradaId, setParadaId] = useState<string | null>(null);
  const [paqueteVer, setPaqueteVer] = useState<string | null>(null);
  const [vistaRuta, setVistaRuta] = useState<'mapa' | 'lista' | 'linea' | 'resumen'>('mapa');
  const [yo, setYo] = useState<Punto | null>(null);
  const [devoluciones, setDevoluciones] = useState<
    | {
        paqueteId: string;
        codigoSeguimiento: string;
        codigoEtiqueta: string;
        entregadoAlCentro: boolean;
      }[]
    | null
  >(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [cola, setCola] = useState<AccionFlex[]>([]);
  const [escaneando, setEscaneando] = useState<null | 'carga' | 'devolucion'>(null);
  const [escaneo, setEscaneo] = useState<{ texto: string; modo: 'carga' | 'devolucion' } | null>(
    null,
  );
  const [permisoCamara, pedirPermiso] = useCameraPermissions();
  const [codigo, setCodigo] = useState('');

  const colaFlex = useMemo(
    () =>
      crearColaFlex(
        {
          leer: () => AsyncStorage.getItem('divoox.cola-flex'),
          escribir: (v) => AsyncStorage.setItem('divoox.cola-flex', v),
        },
        nuevoId,
      ),
    [],
  );

  const cargarLista = useCallback(
    () =>
      api
        .pedir<{ rutas: Fila[] }>('GET', B)
        .then((r) => setLista(r.rutas))
        .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x))),
    [api],
  );
  const cargarRuta = useCallback(
    () =>
      rutaId
        ? api
            .pedir<{ ruta: Ruta }>('GET', `${B}/${rutaId}`)
            .then((r) => setRuta(r.ruta))
            .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)))
        : Promise.resolve(),
    [api, rutaId],
  );

  /** Manda una acción de la cola: primero sus fotos o firma (cada una con su clave), luego la acción. */
  const enviar = useCallback(
    async (a: AccionFlex) => {
      try {
        const cuerpo: Record<string, unknown> = { ...a.cuerpo, capturadoEn: a.capturadoEn };
        const prueba = async (dato: string, tipo: string) => {
          const blob = await (await fetch(dato)).blob();
          const r = await api.subirArchivo<{ pruebaId: string }>(
            blob,
            `${B}/${a.rutaId}/paradas/${a.paradaId}/prueba?tipo=${tipo}${typeof a.cuerpo.lat === 'number' ? `&lat=${a.cuerpo.lat}&lng=${a.cuerpo.lng}` : ''}`,
            { 'idempotency-key': `${a.id}:${tipo}` },
          );
          return r.pruebaId;
        };
        if (a.adjuntos?.foto)
          cuerpo[a.tipo === 'incidencia' ? 'pruebaId' : 'fotoId'] = await prueba(
            a.adjuntos.foto,
            a.tipo === 'incidencia' ? 'incidencia' : 'foto',
          );
        if (a.adjuntos?.firma) cuerpo.firmaId = await prueba(a.adjuntos.firma, 'firma');
        await api.pedir('POST', a.ruta, cuerpo, { cabeceras: { 'idempotency-key': a.id } });
        return { ok: true } as const;
      } catch (x) {
        // C-COLA-ERROR-PASAJERO: sin red o con un error pasajero del servidor, la acción se queda.
        const sinRed = sePuedeReintentar(x);
        return { ok: false, sinRed, error: x instanceof Error ? x.message : String(x) } as const;
      }
    },
    [api],
  );
  const sincronizar = useCallback(async () => {
    const r = await colaFlex.sincronizar(enviar);
    setCola(await colaFlex.listar());
    if (r.confirmadas.length || r.rechazadas.length) await cargarRuta();
  }, [colaFlex, enviar, cargarRuta]);

  useEffect(() => {
    void cargarLista();
    void colaFlex.listar().then(setCola);
  }, [cargarLista, colaFlex]);
  useEffect(() => {
    void cargarRuta();
  }, [cargarRuta]);
  // La cola se reintenta sola cada 10 s; la ubicación se manda cada 30 s mientras la ruta está activa.
  useEffect(() => {
    const reloj = setInterval(() => void sincronizar(), 10_000);
    return () => clearInterval(reloj);
  }, [sincronizar]);
  useEffect(() => {
    if (!ruta || !['aceptada', 'en_carga', 'en_curso'].includes(ruta.estado)) return;
    const reloj = setInterval(() => {
      void ubicacion().then((p) => {
        if (p) setYo(p);
        return p
          ? api.pedir('POST', `${B}/${ruta.id}/ubicacion`, p).catch(() => undefined)
          : undefined;
      });
    }, 30_000);
    return () => clearInterval(reloj);
  }, [api, ruta]);
  // En ruta, la posición del celular (sin mandarla) para la distancia aproximada a cada parada.
  const enCurso = ruta?.estado === 'en_curso';
  useEffect(() => {
    if (!enCurso) return;
    let vivo = true;
    void ubicacion().then((p) => {
      if (vivo && p) setYo(p);
    });
    return () => {
      vivo = false;
    };
  }, [enCurso]);

  // El avance de la ruta en curso, para su tarjeta en «Mis rutas» (el mismo detalle de siempre).
  const idActiva = !rutaId ? (lista?.find((r) => ACTUAL.includes(r.estado))?.id ?? null) : null;
  useEffect(() => {
    if (!idActiva) return;
    let vivo = true;
    api
      .pedir<{ ruta: Ruta }>('GET', `${B}/${idActiva}`)
      .then((r) => vivo && setActiva(r.ruta))
      // Sin el detalle, la tarjeta sale sin barra; el error real se ve al abrir la ruta.
      .catch(() => vivo && setActiva(null));
    return () => {
      vivo = false;
    };
  }, [api, idActiva]);

  /** Acción directa (sin cola): aceptar, llegar al centro, salir, devolución, cerrar. */
  async function accion(sub: string, cuerpo: Record<string, unknown> = {}) {
    if (!ruta) return;
    setError('');
    setTrabajando(true);
    try {
      const r = await api.pedir<{
        ruta?: Ruta;
        devoluciones?: typeof devoluciones;
        resumen?: Ruta['resumen'];
        estado?: string;
      }>('POST', `${B}/${ruta.id}/${sub}`, cuerpo, { cabeceras: { 'idempotency-key': nuevoId() } });
      if (r.ruta) setRuta(r.ruta);
      if (r.devoluciones) setDevoluciones(r.devoluciones);
      if (sub === 'cerrar' || sub === 'rechazar') {
        await cargarRuta().catch(() => undefined);
        await cargarLista();
        if (sub === 'rechazar') setRutaId(null);
      }
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setTrabajando(false);
    }
  }

  /** Acción que pasa por la cola (sirve sin señal y no se duplica). */
  const encolar: Encolar = async (a) => {
    setError('');
    await colaFlex.agregar(a);
    setCola(await colaFlex.listar());
    await sincronizar();
  };

  async function escaneado(texto: string) {
    if (!ruta) return;
    const modo = escaneando === 'devolucion' || ruta.estado === 'en_curso' ? 'devolucion' : 'carga';
    const p = await ubicacion();
    if (modo === 'devolucion') {
      await encolar({
        tipo: 'devolucion',
        rutaId: ruta.id,
        ruta: `${B}/${ruta.id}/devolucion/entregar`,
        cuerpo: { codigo: texto, ...(p ?? {}) },
      });
      setDevoluciones(
        (d) =>
          d?.map((x) =>
            x.codigoEtiqueta === texto.replace(/^dvx:/i, '').toUpperCase()
              ? { ...x, entregadoAlCentro: true }
              : x,
          ) ?? d,
      );
    } else
      await encolar({
        tipo: 'escaneo',
        rutaId: ruta.id,
        ruta: `${B}/${ruta.id}/escanear`,
        cuerpo: { codigo: texto, ...(p ?? {}) },
      });
    setEscaneo({ texto, modo });
  }

  async function abrirEscaner(modo: 'carga' | 'devolucion') {
    if (!permisoCamara?.granted && !(await pedirPermiso()).granted)
      return setError(t.permisoCamara);
    setEscaneo(null);
    setEscaneando(modo);
  }

  const salirDeRuta = () => {
    setRutaId(null);
    setRuta(null);
    setParadaId(null);
    setPaqueteVer(null);
    setEscaneo(null);
    setDevoluciones(null);
    void cargarLista();
  };

  const avisoCola = cola.length ? (
    <View style={[tarjeta, { gap: 6 }]}>
      {cola.some((a) => a.estado === 'pendiente') ? (
        <Text style={{ color: GRIS }}>
          {cola.filter((a) => a.estado === 'pendiente').length} {t.pendientesSync}
        </Text>
      ) : null}
      {cola
        .filter((a) => a.estado === 'error')
        .map((a) => (
          <View key={a.id} style={{ gap: 4 }}>
            <Text style={{ color: C.acento }}>
              {t.errorSync}: {a.error}
            </Text>
            <Text
              style={e.enlace}
              onPress={() =>
                void colaFlex.descartar(a.id).then(() => colaFlex.listar().then(setCola))
              }
            >
              {t.descartar}
            </Text>
          </View>
        ))}
      <Text style={e.enlace} onPress={() => void sincronizar()}>
        {t.reintentarSync}
      </Text>
    </View>
  ) : null;
  const avisoError = error ? (
    <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
      {error}
    </Text>
  ) : null;

  // ───────────────── Mis rutas ─────────────────
  if (!rutaId || !ruta) {
    const grupos = {
      actual: (lista ?? []).filter((r) => ACTUAL.includes(r.estado)),
      proximas: (lista ?? []).filter((r) => PROXIMAS.includes(r.estado)),
      historial: (lista ?? []).filter(
        (r) => !ACTUAL.includes(r.estado) && !PROXIMAS.includes(r.estado),
      ),
    };
    const elegida =
      pestana ?? (grupos.actual.length ? 'actual' : grupos.proximas.length ? 'proximas' : 'actual');
    const filas = grupos[elegida];
    const abrir = (id: string) => {
      setRuta(null);
      setParadaId(null);
      setPaqueteVer(null);
      setEscaneo(null);
      setDevoluciones(null);
      setRutaId(id);
    };
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <View style={{ gap: 2 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: C.secundario }}>
            {t.tituloLista}
          </Text>
          <Text style={{ color: GRIS }}>{t.subtituloLista}</Text>
        </View>
        <Pestanas
          opciones={[
            { id: 'actual', texto: `${t.pestanasLista.actual} (${grupos.actual.length})` },
            { id: 'proximas', texto: `${t.pestanasLista.proximas} (${grupos.proximas.length})` },
            { id: 'historial', texto: t.pestanasLista.historial },
          ]}
          activa={elegida}
          alCambiar={setPestana}
        />
        {avisoError}
        {avisoCola}
        {elegida === 'historial' ? <Text style={{ color: GRIS }}>{t.historialAyuda}</Text> : null}
        {lista === null ? null : filas.length === 0 ? (
          <Text style={{ color: GRIS }}>
            {elegida === 'actual'
              ? lista.length
                ? t.sinActual
                : t.sinRutas
              : elegida === 'proximas'
                ? t.sinProximas
                : t.sinHistorial}
          </Text>
        ) : (
          filas.map((r) => (
            <TarjetaRuta
              key={r.id}
              {...{ t, idioma, r }}
              avance={activa && activa.id === r.id ? activa : null}
              alAbrir={() => abrir(r.id)}
            />
          ))
        )}
        <Boton texto={t.actualizar} secundario alTocar={() => void cargarLista()} />
      </View>
    );
  }

  const parada = ruta.paradas.find((p) => p.id === paradaId) ?? null;
  const todos = ruta.paradas.flatMap((p) => p.paquetes);
  const siguiente = siguienteDe(ruta);

  const escaner = (
    <Modal
      visible={escaneando !== null}
      animationType="slide"
      onRequestClose={() => setEscaneando(null)}
    >
      <View style={{ flex: 1, backgroundColor: '#101010' }}>
        <View style={{ paddingTop: 48, paddingHorizontal: 16, paddingBottom: 12 }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18, textAlign: 'center' }}>
            {t.escanearTitulo}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }}
            onBarcodeScanned={({ data }) => {
              setEscaneando(null);
              void escaneado(data);
            }}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              { alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
            ]}
          >
            <Recuadro />
          </View>
        </View>
        <Text style={{ color: '#FFFFFF', textAlign: 'center', padding: 16, fontSize: 15 }}>
          {t.recuadro}
        </Text>
        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <Boton texto={t.cerrarCamara} alTocar={() => setEscaneando(null)} secundario />
        </View>
      </View>
    </Modal>
  );
  const entradaManual = (alEnviar: (c: string) => void) => (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
      <TextInput
        value={codigo}
        onChangeText={setCodigo}
        placeholder={t.escribirCodigo}
        autoCapitalize="characters"
        style={[e.input, { flex: 1 }]}
        accessibilityLabel={t.escribirCodigo}
      />
      <Pressable
        onPress={() => {
          if (codigo.trim()) alEnviar(codigo.trim());
          setCodigo('');
        }}
        style={{ padding: 14, backgroundColor: C.secundario, borderRadius: 12 }}
        accessibilityRole="button"
        accessibilityLabel={t.cargar}
      >
        <Text style={{ color: '#fff', fontWeight: '800' }}>{t.cargar}</Text>
      </Pressable>
    </View>
  );

  // ───────────────── Detalle de un paquete ─────────────────
  if (paqueteVer)
    return (
      <DetallePaquete {...{ t, ruta }} paqueteId={paqueteVer} volver={() => setPaqueteVer(null)} />
    );

  // ───────────────── Paquete escaneado ─────────────────
  if (escaneo)
    return (
      <View style={{ padding: 16, gap: 12 }}>
        {escaner}
        <Atras texto={t.volverRuta} alTocar={() => setEscaneo(null)} />
        {avisoError}
        <ResultadoEscaneo
          {...{ t, ruta, cola, devoluciones }}
          texto={escaneo.texto}
          modo={escaneo.modo}
          verPaquete={setPaqueteVer}
        />
        <Boton texto={t.escanearSiguiente} alTocar={() => void abrirEscaner(escaneo.modo)} />
        {avisoCola}
      </View>
    );

  // ───────────────── Parada ─────────────────
  if (parada)
    return (
      <DetalleParada
        key={parada.id}
        {...{ t, idioma, ruta, parada, encolar, yo }}
        error={avisoError}
        cola={avisoCola}
        colaLista={cola}
        volver={() => setParadaId(null)}
        irA={setParadaId}
        abrirPaquete={setPaqueteVer}
      />
    );

  const cabecera = (
    <View style={{ gap: 4 }}>
      <Atras texto={t.tituloLista} alTocar={salirDeRuta} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ flex: 1, fontSize: 24, fontWeight: '900', color: C.secundario }}>
          {ruta.nombre || ruta.empresa}
        </Text>
        <Pastilla texto={t.estados[ruta.estado] ?? ruta.estado} tono={tonoRuta(ruta.estado)} />
      </View>
      <Text style={{ color: C.secundario, fontWeight: '600' }}>{ruta.empresa}</Text>
      <Text style={{ color: GRIS }}>
        {t.resumenCorto(ruta.progreso.total, ruta.paradas.length)}
      </Text>
    </View>
  );
  const tarjetaCentro = (conNavegar: boolean) =>
    ruta.centro ? (
      <View style={[tarjeta, { gap: 6 }]}>
        <Text style={{ color: GRIS, fontSize: 12, fontWeight: '700' }}>{t.centroDistribucion}</Text>
        <Text style={{ fontWeight: '800', color: C.secundario }}>{ruta.centro.nombre}</Text>
        <Text style={{ color: GRIS }}>{ruta.centro.direccion}</Text>
        {conNavegar ? (
          <Boton
            texto={t.navegar}
            secundario
            alTocar={() =>
              navegar(
                ruta.centro?.lat ?? null,
                ruta.centro?.lng ?? null,
                ruta.centro?.direccion ?? '',
                t,
              )
            }
          />
        ) : null}
      </View>
    ) : null;

  // ───────────────── Ruta según su estado ─────────────────
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {cabecera}
      {avisoError}
      {avisoCola}
      {escaner}
      {['ofrecida', 'asignada'].includes(ruta.estado) ? (
        <>
          {ruta.estado === 'ofrecida' && ruta.ofertaVenceEn ? (
            <Text style={{ color: C.logistica, fontWeight: '700' }}>
              {t.venceA}: {hora(ruta.ofertaVenceEn, idioma)}
            </Text>
          ) : null}
          {tarjetaCentro(false)}
          <View style={[tarjeta, { gap: 10 }]}>
            {ruta.paradas.map((p) => (
              <View key={p.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Numero n={p.orden} tono="pendiente" tamano={28} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.secundario, fontWeight: '600' }}>{p.direccion}</Text>
                  <Text style={{ color: GRIS, fontSize: 13 }}>
                    {t.nPaquetes(p.paquetes.length)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Boton
            texto={t.aceptar}
            exito
            cargando={trabajando}
            alTocar={() => void accion('aceptar')}
          />
          <Boton
            texto={t.rechazar}
            secundario
            alTocar={() =>
              Platform.OS === 'web'
                ? void accion('rechazar')
                : Alert.alert(t.confirmarRechazo, '', [
                    { text: t.no, style: 'cancel' },
                    { text: t.si, onPress: () => void accion('rechazar') },
                  ])
            }
          />
        </>
      ) : null}
      {ruta.estado === 'aceptada' ? (
        <>
          {tarjetaCentro(true)}
          <Boton
            texto={t.llegueCentro}
            cargando={trabajando}
            alTocar={() => void ubicacion().then((p) => accion('llegada-centro', p ?? {}))}
          />
          <Boton texto={t.rechazar} secundario alTocar={() => void accion('rechazar')} />
        </>
      ) : null}
      {ruta.estado === 'en_carga' ? (
        <>
          <View style={[tarjeta, { gap: 8 }]}>
            <Text style={{ fontWeight: '800', color: C.secundario }}>
              {t.paquetesCargados(ruta.progreso.cargados, ruta.progreso.total)}
            </Text>
            <Barra
              valor={ruta.progreso.total ? ruta.progreso.cargados / ruta.progreso.total : 0}
              etiqueta={t.paquetesCargados(ruta.progreso.cargados, ruta.progreso.total)}
            />
          </View>
          <Boton texto={t.escanear} alTocar={() => void abrirEscaner('carga')} />
          {entradaManual((c) => void escaneado(c))}
          <View style={[tarjeta, { paddingVertical: 4 }]}>
            {todos
              .filter((p) => !p.excluido)
              .map((p, i) => (
                <View
                  key={p.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingVertical: 10,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: BORDE,
                  }}
                >
                  <Caja />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Pressable
                      style={{ gap: 4 }}
                      onPress={() => setPaqueteVer(p.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`${t.detallesPaquete} ${p.codigoSeguimiento}`}
                    >
                      <Text style={{ fontWeight: '800', color: C.secundario }}>
                        {p.codigoSeguimiento}
                      </Text>
                      <Pastilla
                        texto={t.estadosPaquete[p.estado] ?? p.estado}
                        tono={tonoPaquete(p.estado)}
                      />
                    </Pressable>
                    {!p.cargado ? (
                      <Text
                        style={[e.enlaceLinea, { fontSize: 13, alignSelf: 'flex-start' }]}
                        onPress={() => void accion('faltante', { paqueteId: p.id })}
                        accessibilityRole="button"
                      >
                        {t.faltante}
                      </Text>
                    ) : null}
                  </View>
                  <Listo marcado={p.cargado} />
                </View>
              ))}
          </View>
          <Text style={{ color: GRIS }}>{t.cargaCompleta}</Text>
          <Boton
            texto={t.salir}
            exito
            cargando={trabajando}
            alTocar={() => void ubicacion().then((p) => accion('iniciar', p ?? {}))}
          />
        </>
      ) : null}
      {ruta.estado === 'en_curso' && !devoluciones ? (
        <>
          <View style={[tarjeta, { gap: 8 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.secundario, fontWeight: '600' }}>
                {t.paradasCompletadas(resueltas(ruta), ruta.paradas.length)}
              </Text>
              <Text style={{ color: C.exito, fontWeight: '800' }}>
                {ruta.paradas.length
                  ? Math.round((resueltas(ruta) / ruta.paradas.length) * 100)
                  : 0}
                %
              </Text>
            </View>
            <Barra
              valor={ruta.paradas.length ? resueltas(ruta) / ruta.paradas.length : 0}
              etiqueta={t.paradasCompletadas(resueltas(ruta), ruta.paradas.length)}
            />
          </View>
          <Pestanas
            opciones={[
              { id: 'mapa', texto: t.vistas.mapa },
              { id: 'lista', texto: t.vistas.lista },
              { id: 'linea', texto: t.vistas.linea },
              { id: 'resumen', texto: t.vistas.resumen },
            ]}
            activa={vistaRuta}
            alCambiar={setVistaRuta}
          />
          <EfectivoEnMano {...{ t, idioma, ruta }} />
          {vistaRuta === 'mapa' ? (
            <VistaMapa {...{ t, idioma, ruta, siguiente, yo }} abrir={setParadaId} />
          ) : vistaRuta === 'linea' ? (
            <LineaRuta {...{ t, idioma, ruta, siguiente }} abrir={setParadaId} />
          ) : vistaRuta === 'resumen' ? (
            <TrabajoRestante t={t} ruta={ruta} />
          ) : (
            ruta.paradas.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setParadaId(p.id)}
                accessibilityRole="button"
                accessibilityLabel={`${p.orden}. ${p.direccion}`}
                style={[
                  tarjeta,
                  { gap: 6 },
                  p.id === siguiente?.id && { backgroundColor: RESALTE, borderColor: C.logistica },
                ]}
              >
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  <Numero n={p.orden} tono={tonoParada(p, siguiente?.id ?? null)} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '800', color: C.secundario }}>
                      {nombreParada(p)}
                    </Text>
                    {p.destinatarioNombre ? (
                      <Text style={{ color: GRIS }}>{p.direccion}</Text>
                    ) : null}
                  </View>
                  <Listo marcado={p.estado === 'entregada'} />
                </View>
                {p.estado === 'entregada' && p.resueltaEn ? (
                  <Text style={{ color: C.exito, fontWeight: '600' }}>
                    {t.entregadaA(horaLocal(p.resueltaEn, idioma))}
                  </Text>
                ) : null}
                <Text style={{ color: p.estado === 'fallida' ? C.acento : GRIS }}>
                  {t.estadosParada[p.estado] ?? p.estado} · {t.nPaquetes(paquetesActivos(p).length)}
                </Text>
                {p.ventanaDesde ? (
                  <Text style={{ color: GRIS }}>
                    {t.ventana}: {p.ventanaDesde.slice(11, 16)}–
                    {(p.ventanaHasta ?? '').slice(11, 16)}
                  </Text>
                ) : null}
                {p.instrucciones ? <Text style={{ color: GRIS }}>{p.instrucciones}</Text> : null}
                <Text
                  style={[e.enlaceLinea, { alignSelf: 'flex-start' }]}
                  onPress={() => navegar(p.lat, p.lng, p.direccion, t)}
                  accessibilityRole="button"
                >
                  {t.navegar}
                </Text>
              </Pressable>
            ))
          )}
          <Boton
            texto={t.devolucion}
            secundario
            cargando={trabajando}
            alTocar={() => void accion('devolucion')}
          />
        </>
      ) : null}
      {ruta.estado === 'en_curso' && devoluciones ? (
        <>
          <Text style={{ fontSize: 20, fontWeight: '900', color: C.secundario }}>
            {t.devolucionTitulo}
          </Text>
          <Text style={{ color: GRIS }}>{t.devolucionAyuda}</Text>
          <View style={[tarjeta, { paddingVertical: 4 }]}>
            {devoluciones.map((d, i) => (
              <View
                key={d.paqueteId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: BORDE,
                }}
              >
                <Caja />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800', color: C.secundario }}>
                    {d.codigoSeguimiento}
                  </Text>
                  <Text style={{ color: d.entregadoAlCentro ? C.exito : GRIS }}>
                    {d.entregadoAlCentro ? t.entregadoCentro : t.porEntregar}
                  </Text>
                </View>
                <Listo marcado={d.entregadoAlCentro} />
              </View>
            ))}
          </View>
          {devoluciones.length ? (
            <>
              <Boton texto={t.escanear} alTocar={() => void abrirEscaner('devolucion')} />
              {entradaManual((c) => void escaneado(c))}
            </>
          ) : null}
          <Boton
            texto={t.cerrar}
            exito
            cargando={trabajando}
            alTocar={() => void accion('cerrar')}
          />
          <Atras texto={t.listaParadas} alTocar={() => setDevoluciones(null)} />
        </>
      ) : null}
      {['completada', 'con_incidencias'].includes(ruta.estado) ? (
        <>
          <ResumenRuta {...{ t, idioma, ruta }} />
          <EfectivoEnMano {...{ t, idioma, ruta }} />
        </>
      ) : null}
    </View>
  );
}

/** Esquinas del recuadro del escáner (dibujadas). */
function Recuadro() {
  const lado = 240;
  const largo = 36;
  const grosor = 4;
  const esquina = (pos: object, bordes: object) => (
    <View
      style={[
        { position: 'absolute', width: largo, height: largo, borderColor: '#FFFFFF' },
        pos,
        bordes,
      ]}
    />
  );
  return (
    <View style={{ width: lado, height: lado }}>
      {esquina(
        { top: 0, left: 0 },
        { borderTopWidth: grosor, borderLeftWidth: grosor, borderTopLeftRadius: 12 },
      )}
      {esquina(
        { top: 0, right: 0 },
        { borderTopWidth: grosor, borderRightWidth: grosor, borderTopRightRadius: 12 },
      )}
      {esquina(
        { bottom: 0, left: 0 },
        { borderBottomWidth: grosor, borderLeftWidth: grosor, borderBottomLeftRadius: 12 },
      )}
      {esquina(
        { bottom: 0, right: 0 },
        { borderBottomWidth: grosor, borderRightWidth: grosor, borderBottomRightRadius: 12 },
      )}
    </View>
  );
}

/** Tarjeta de una ruta en «Mis rutas». */
function TarjetaRuta({
  t,
  idioma,
  r,
  avance,
  alAbrir,
}: {
  t: Textos;
  idioma: Idioma;
  r: Fila;
  avance: Ruta | null;
  alAbrir: () => void;
}) {
  const enMarcha = ACTUAL.includes(r.estado);
  const hechas = avance ? resueltas(avance) : 0;
  const total = avance ? avance.paradas.length : r.paradas;
  return (
    <View style={[tarjeta, { gap: 10 }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text style={{ flex: 1, fontWeight: '900', fontSize: 18, color: C.secundario }}>
          {r.nombre || r.empresa}
        </Text>
        <Pastilla texto={t.estados[r.estado] ?? r.estado} tono={tonoRuta(r.estado)} />
      </View>
      <View style={{ gap: 2 }}>
        <Text style={{ fontWeight: '700', color: C.secundario }}>{r.empresa}</Text>
        <Text style={{ color: GRIS }}>{t.resumenCorto(r.paquetes, r.paradas)}</Text>
      </View>
      {r.bloqueDesde ? (
        <View style={{ gap: 2 }}>
          <Text style={{ color: GRIS, fontSize: 12, fontWeight: '700' }}>{t.horario}</Text>
          <Text style={{ color: C.secundario, fontWeight: '600' }}>
            {hora(r.bloqueDesde, idioma)}
            {r.bloqueHasta ? ` – ${horaSola(r.bloqueHasta, idioma)}` : ''}
          </Text>
        </View>
      ) : null}
      {r.estado === 'ofrecida' && r.ofertaVenceEn ? (
        <Text style={{ color: C.logistica, fontWeight: '700' }}>
          {t.venceA}: {hora(r.ofertaVenceEn, idioma)}
        </Text>
      ) : null}
      {r.cerradaEn && !enMarcha ? (
        <Text style={{ color: GRIS }}>
          {t.cerradaEl}: {hora(r.cerradaEn, idioma)}
        </Text>
      ) : null}
      {avance && avance.estado === 'en_curso' ? (
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.secundario }}>{t.paradasCompletadas(hechas, total)}</Text>
            <Text style={{ color: C.exito, fontWeight: '800' }}>
              {total ? Math.round((hechas / total) * 100) : 0}%
            </Text>
          </View>
          <Barra
            valor={total ? hechas / total : 0}
            etiqueta={t.paradasCompletadas(hechas, total)}
          />
        </View>
      ) : avance && avance.estado === 'en_carga' ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: C.secundario }}>
            {t.paquetesCargados(avance.progreso.cargados, avance.progreso.total)}
          </Text>
          <Barra
            valor={avance.progreso.total ? avance.progreso.cargados / avance.progreso.total : 0}
            etiqueta={t.paquetesCargados(avance.progreso.cargados, avance.progreso.total)}
          />
        </View>
      ) : null}
      {enMarcha ? (
        <Boton logistica texto={`${t.continuar}  →`} alTocar={alAbrir} />
      ) : (
        <Boton texto={t.verDetalles} secundario alTocar={alAbrir} />
      )}
    </View>
  );
}

/** Puntos del mapa: el centro y las paradas con coordenadas, en orden. */
function puntosDe(ruta: Ruta, siguienteId: string | null, t: Textos): PuntoRuta[] {
  const centro = coord(ruta.centro);
  return [
    ...(centro
      ? [
          {
            id: 'centro',
            punto: centro,
            numero: '',
            tono: 'centro' as const,
            nombre: ruta.centro?.nombre ?? t.centroDistribucion,
          },
        ]
      : []),
    ...ruta.paradas.flatMap((p) => {
      const q = coord(p);
      return q
        ? [
            {
              id: p.id,
              punto: q,
              numero: String(p.orden),
              tono: tonoParada(p, siguienteId),
              nombre: `${p.orden}. ${p.direccion}`,
            },
          ]
        : [];
    }),
  ];
}

/** Pestaña «Mapa»: las paradas numeradas y la siguiente parada con su navegación. */
function VistaMapa({
  t,
  idioma,
  ruta,
  siguiente,
  yo,
  abrir,
}: {
  t: Textos;
  idioma: Idioma;
  ruta: Ruta;
  siguiente: Parada | null;
  yo: Punto | null;
  abrir: (id: string) => void;
}) {
  // C-FLEX-FILTROS (como Amazon Flex): todas, solo apartamentos o solo las que tienen hora límite.
  const [filtro, setFiltro] = useState<'todos' | 'apartamentos' | 'prioridad'>('todos');
  const paradasFiltradas =
    filtro === 'todos' ? ruta.paradas : ruta.paradas.filter((p) => cumpleFiltro(p, filtro));
  const puntos = puntosDe({ ...ruta, paradas: paradasFiltradas }, siguiente?.id ?? null, t);
  const distancia = siguiente ? km(yo, coord(siguiente), t, idioma) : null;
  return (
    <>
      <Pestanas
        opciones={(['todos', 'apartamentos', 'prioridad'] as const).map((id) => ({
          id,
          texto: t.filtrosMapa[id],
        }))}
        activa={filtro}
        alCambiar={setFiltro}
      />
      {puntos.length ? (
        <MapaRuta puntos={puntos} yo={yo} etiqueta={t.vistas.mapa} />
      ) : (
        <Text style={{ color: GRIS }}>{t.sinCoordenadasMapa}</Text>
      )}
      {siguiente ? (
        <>
          <Pressable
            onPress={() => abrir(siguiente.id)}
            accessibilityRole="button"
            accessibilityLabel={`${t.siguienteParada}: ${nombreParada(siguiente)}`}
            style={[tarjeta, { gap: 8 }]}
          >
            <Text style={{ color: GRIS, fontWeight: '700' }}>{t.siguienteParada}</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Numero n={siguiente.orden} tono="actual" tamano={36} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '900', fontSize: 16, color: C.secundario }}>
                  {nombreParada(siguiente)}
                </Text>
                {siguiente.destinatarioNombre ? (
                  <Text style={{ color: GRIS }}>{siguiente.direccion}</Text>
                ) : null}
              </View>
              {distancia ? <Text style={{ color: GRIS, fontSize: 13 }}>{distancia}</Text> : null}
            </View>
          </Pressable>
          <Boton
            texto={t.iniciarNavegacion}
            alTocar={() => navegar(siguiente.lat, siguiente.lng, siguiente.direccion, t)}
          />
          {distancia ? <Text style={{ color: GRIS, fontSize: 12 }}>{t.distanciaAyuda}</Text> : null}
        </>
      ) : (
        <Text style={{ color: GRIS }}>{t.sinSiguiente}</Text>
      )}
    </>
  );
}

/** Distancia en línea recta desde el punto anterior con coordenadas (el centro para la primera). */
function distanciasEntreParadas(ruta: Ruta, t: Textos, idioma: Idioma): (string | null)[] {
  let anterior = coord(ruta.centro);
  return ruta.paradas.map((p) => {
    const q = coord(p);
    const d = km(anterior, q, t, idioma);
    if (q) anterior = q;
    return d;
  });
}

/** Pestaña «Línea de ruta»: el centro y las paradas en orden, con la actual resaltada. */
function LineaRuta({
  t,
  idioma,
  ruta,
  siguiente,
  abrir,
}: {
  t: Textos;
  idioma: Idioma;
  ruta: Ruta;
  siguiente: Parada | null;
  abrir: (id: string) => void;
}) {
  const distancias = distanciasEntreParadas(ruta, t, idioma);
  const hayDistancias = distancias.some(Boolean);
  const filas: {
    id: string;
    numero: number;
    tono: TonoParada;
    titulo: string;
    sub: string;
    detalle: string | null;
    listo: boolean;
    distancia: string | null;
    actual: boolean;
    alTocar?: () => void;
  }[] = [
    ...(ruta.centro
      ? [
          {
            id: 'centro',
            numero: 0,
            tono: 'hecho' as const,
            titulo: ruta.centro.nombre || t.centroDistribucion,
            sub: ruta.centro.direccion,
            detalle: t.nPaquetes(ruta.progreso.total),
            listo: true,
            distancia: null,
            actual: false,
          },
        ]
      : []),
    ...ruta.paradas.map((p, i) => ({
      id: p.id,
      numero: p.orden,
      tono: tonoParada(p, siguiente?.id ?? null),
      titulo: nombreParada(p),
      sub: p.destinatarioNombre ? p.direccion : (t.estadosParada[p.estado] ?? p.estado),
      detalle: t.nPaquetes(paquetesActivos(p).length),
      listo: p.estado === 'entregada',
      distancia: distancias[i] ?? null,
      actual: p.id === siguiente?.id,
      alTocar: () => abrir(p.id),
    })),
  ];
  return (
    <View style={[tarjeta, { paddingHorizontal: 0, paddingVertical: 6 }]}>
      {filas.map((f, i) => (
        <Pressable
          key={f.id}
          onPress={f.alTocar}
          disabled={!f.alTocar}
          accessibilityRole={f.alTocar ? 'button' : undefined}
          accessibilityLabel={`${f.titulo}. ${f.sub}`}
          style={{
            flexDirection: 'row',
            gap: 12,
            paddingHorizontal: 14,
            backgroundColor: f.actual ? RESALTE : 'transparent',
          }}
        >
          <View style={{ alignItems: 'center', width: 32 }}>
            <View
              style={{
                width: 2,
                height: 12,
                backgroundColor: i === 0 ? 'transparent' : f.tono === 'hecho' ? C.exito : BORDE,
              }}
            />
            {f.id === 'centro' ? (
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: C.secundario,
                  borderWidth: 2,
                  borderColor: '#FFFFFF',
                }}
              />
            ) : (
              <Numero n={f.numero} tono={f.tono} />
            )}
            <View
              style={{
                width: 2,
                flex: 1,
                minHeight: 12,
                backgroundColor: i === filas.length - 1 ? 'transparent' : f.listo ? C.exito : BORDE,
              }}
            />
          </View>
          <View style={{ flex: 1, paddingVertical: 12, gap: 2 }}>
            <Text style={{ fontWeight: '800', color: C.secundario }}>{f.titulo}</Text>
            <Text style={{ color: GRIS, fontSize: 13 }}>{f.sub}</Text>
            {f.detalle ? <Text style={{ color: GRIS, fontSize: 13 }}>{f.detalle}</Text> : null}
          </View>
          <View
            style={{
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: 6,
              paddingVertical: 12,
            }}
          >
            {f.listo ? <Listo marcado /> : null}
            {f.distancia ? <Text style={{ color: GRIS, fontSize: 12 }}>{f.distancia}</Text> : null}
          </View>
        </Pressable>
      ))}
      {hayDistancias ? (
        <Text style={{ color: GRIS, fontSize: 12, paddingHorizontal: 14, paddingVertical: 8 }}>
          {t.distanciaAyuda}
        </Text>
      ) : null}
    </View>
  );
}

/** Lo que pasó con el último código escaneado (sin decir «cargado» hasta que el servidor lo confirme). */
function ResultadoEscaneo({
  t,
  ruta,
  cola,
  devoluciones,
  texto,
  modo,
  verPaquete,
}: {
  t: Textos;
  ruta: Ruta;
  cola: AccionFlex[];
  devoluciones:
    { codigoSeguimiento: string; codigoEtiqueta: string; entregadoAlCentro: boolean }[] | null;
  texto: string;
  modo: 'carga' | 'devolucion';
  verPaquete: (id: string) => void;
}) {
  const leido = leerCodigoEscaneado(texto);
  const coincide = (x: { codigoEtiqueta: string; codigoSeguimiento: string }) =>
    leido
      ? leido.tipo === 'etiqueta'
        ? x.codigoEtiqueta === leido.codigo
        : x.codigoSeguimiento === leido.codigo
      : false;
  const paradaDe = ruta.paradas.find((p) => p.paquetes.some(coincide)) ?? null;
  const paq = paradaDe?.paquetes.find(coincide) ?? null;
  const dev = devoluciones?.find(coincide) ?? null;
  const enCola = cola.find(
    (a) => (a.tipo === 'escaneo' || a.tipo === 'devolucion') && a.cuerpo.codigo === texto,
  );
  const listo =
    !enCola && (modo === 'carga' ? Boolean(paq?.cargado) : Boolean(dev?.entregadoAlCentro));
  const ajeno = !enCola && !paq && !dev;
  const titulo = listo
    ? modo === 'carga'
      ? t.paqueteCargado
      : t.devolucionRegistrada
    : enCola?.estado === 'pendiente'
      ? t.escaneoGuardado
      : enCola?.estado === 'error'
        ? t.errorSync
        : ajeno
          ? t.noEsDeRuta
          : t.codigoLeido;
  return (
    <View style={{ gap: 12 }}>
      <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
        <Listo marcado={listo} tamano={64} />
        <Text
          style={{ fontSize: 20, fontWeight: '900', color: C.secundario, textAlign: 'center' }}
          accessibilityRole="header"
        >
          {titulo}
        </Text>
        {enCola?.estado === 'pendiente' ? (
          <Text style={{ color: GRIS, textAlign: 'center' }}>{t.escaneoGuardadoAyuda}</Text>
        ) : null}
        {enCola?.estado === 'error' && enCola.error ? (
          <Text style={{ color: C.acento, textAlign: 'center' }}>{enCola.error}</Text>
        ) : null}
        <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}>
          {paq?.codigoSeguimiento ?? dev?.codigoSeguimiento ?? leido?.codigo ?? texto}
        </Text>
        {paradaDe ? (
          <View style={{ alignItems: 'center' }}>
            {paradaDe.destinatarioNombre ? (
              <Text style={{ fontWeight: '700', color: C.secundario }}>
                {paradaDe.destinatarioNombre}
              </Text>
            ) : null}
            <Text style={{ color: GRIS, textAlign: 'center' }}>{paradaDe.direccion}</Text>
          </View>
        ) : null}
      </View>
      {modo === 'carga' ? (
        <View style={[tarjeta, { flexDirection: 'row', gap: 12, alignItems: 'center' }]}>
          <Caja />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontWeight: '800', color: C.secundario }}>
              {t.paquetesCargados(ruta.progreso.cargados, ruta.progreso.total)}
            </Text>
            <Barra
              valor={ruta.progreso.total ? ruta.progreso.cargados / ruta.progreso.total : 0}
              etiqueta={t.paquetesCargados(ruta.progreso.cargados, ruta.progreso.total)}
            />
          </View>
        </View>
      ) : null}
      {paq ? <Boton texto={t.verDetalles} secundario alTocar={() => verPaquete(paq.id)} /> : null}
    </View>
  );
}

/** Detalles de un paquete: solo lo que el servidor nos da (sin peso ni medidas inventados). */
function DetallePaquete({
  t,
  ruta,
  paqueteId,
  volver,
}: {
  t: Textos;
  ruta: Ruta;
  paqueteId: string;
  volver: () => void;
}) {
  const parada = ruta.paradas.find((p) => p.paquetes.some((q) => q.id === paqueteId)) ?? null;
  const paq = parada?.paquetes.find((q) => q.id === paqueteId) ?? null;
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Atras texto={t.volverRuta} alTocar={volver} />
      <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>
        {t.detallesPaquete}
      </Text>
      {paq && parada ? (
        <View style={[tarjeta, { gap: 4 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 6 }}>
            <Caja />
            <Text style={{ flex: 1, fontWeight: '900', fontSize: 16, color: C.secundario }}>
              {paq.codigoSeguimiento}
            </Text>
            <Pastilla
              texto={t.estadosPaquete[paq.estado] ?? paq.estado}
              tono={tonoPaquete(paq.estado)}
            />
          </View>
          {parada.destinatarioNombre ? (
            <Dato etiqueta={t.recibe} valor={parada.destinatarioNombre} />
          ) : null}
          <Dato etiqueta={t.direccion} valor={parada.direccion} />
          {parada.referenciaExterna ? (
            <Dato etiqueta={t.referencia} valor={parada.referenciaExterna} />
          ) : null}
          {paq.descripcion ? <Dato etiqueta={t.descripcion} valor={paq.descripcion} /> : null}
          <Dato etiqueta={t.parada} valor={`${parada.orden} / ${ruta.paradas.length}`} />
        </View>
      ) : (
        <Text style={{ color: GRIS }}>{t.noEsDeRuta}</Text>
      )}
    </View>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: BORDE, gap: 2 }}>
      <Text style={{ color: GRIS, fontSize: 12 }}>{etiqueta}</Text>
      <Text style={{ color: C.secundario, fontWeight: '600' }}>{valor}</Text>
    </View>
  );
}

/** Resumen de la ruta cerrada: totales reales del cierre, horas y las últimas paradas. */
/** Fase 6 (C-FLEX-COBRO): el efectivo cobrado en esta ruta, que se entrega en el centro. */
function EfectivoEnMano({ t, idioma, ruta }: { t: Textos; idioma: Idioma; ruta: Ruta }) {
  const mano = efectivoEnMano(
    ruta.paradas
      .filter((p) => p.cobro && p.cobro.estado !== 'pendiente')
      .map((p) => ({
        metodo: p.cobro?.metodo ?? '',
        monto: p.cobro?.montoRecibido ?? 0,
        moneda: p.cobro?.monedaRecibida ?? p.cobro?.moneda ?? 'USD',
        liquidado: p.cobro?.estado === 'liquidado',
      })),
  );
  const monedas = Object.entries(mano);
  if (!monedas.length) return null;
  return (
    <View style={[tarjeta, { gap: 4 }]} testID="efectivo-en-mano">
      <Text style={{ fontSize: 18, fontWeight: '900', color: C.secundario }}>
        {t.efectivoEnMano}
      </Text>
      {monedas.map(([moneda, monto]) => (
        <Text key={moneda} style={{ fontSize: 22, fontWeight: '900' }}>
          {formatearMonto(monto, moneda, idioma)}
        </Text>
      ))}
      <Text style={{ color: GRIS, fontSize: 13 }}>{t.efectivoAyuda}</Text>
    </View>
  );
}

function ResumenRuta({ t, idioma, ruta }: { t: Textos; idioma: Idioma; ruta: Ruta }) {
  const bien = ruta.estado === 'completada';
  const inicio = ruta.iniciadaEn ? fecha(ruta.iniciadaEn).getTime() : NaN;
  const fin = ruta.cerradaEn ? fecha(ruta.cerradaEn).getTime() : NaN;
  const minutos =
    Number.isFinite(inicio) && Number.isFinite(fin)
      ? Math.max(0, Math.round((fin - inicio) / 60000))
      : null;
  const ultimas = ruta.paradas
    .filter((p) => p.resueltaEn)
    .sort((a, b) => String(b.resueltaEn).localeCompare(String(a.resueltaEn)))
    .slice(0, 5);
  return (
    <>
      <Banner
        bien={bien}
        titulo={bien ? t.rutaCompletada : t.rutaConIncidencias}
        ayuda={bien ? t.rutaCompletadaAyuda : t.rutaConIncidenciasAyuda}
      />
      <View style={[tarjeta, { gap: 0 }]}>
        <Text style={{ fontSize: 18, fontWeight: '900', color: C.secundario, marginBottom: 6 }}>
          {t.resumen}
        </Text>
        <Fila
          etiqueta={t.paradasTotales}
          valor={String(ruta.resumen?.paradas ?? ruta.paradas.length)}
        />
        {Object.entries(t.resumenCampos).map(([k, texto]) => (
          <Fila
            key={k}
            etiqueta={texto}
            valor={String(ruta.resumen?.[k] ?? 0)}
            color={k === 'entregados' ? C.exito : undefined}
          />
        ))}
        <View style={{ height: 1, backgroundColor: BORDE, marginVertical: 6 }} />
        <Fila etiqueta={t.horaInicio} valor={hora(ruta.iniciadaEn, idioma)} />
        <Fila etiqueta={t.horaFin} valor={hora(ruta.cerradaEn, idioma)} />
        {minutos != null ? (
          <Fila
            etiqueta={t.tiempoTotal}
            valor={t.duracion(Math.floor(minutos / 60), minutos % 60)}
          />
        ) : null}
      </View>
      {ultimas.length ? (
        <View style={[tarjeta, { gap: 0 }]}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.secundario, marginBottom: 6 }}>
            {t.ultimasParadas}
          </Text>
          {ultimas.map((p, i) => (
            <View
              key={p.id}
              style={{
                flexDirection: 'row',
                gap: 10,
                alignItems: 'center',
                paddingVertical: 10,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: BORDE,
              }}
            >
              <Listo marcado={p.estado === 'entregada'} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: C.secundario }}>
                  {t.parada} {p.orden} ·{' '}
                  <Text style={{ color: p.estado === 'entregada' ? C.exito : C.acento }}>
                    {t.estadosParada[p.estado] ?? p.estado}
                  </Text>
                </Text>
                <Text style={{ color: GRIS, fontSize: 13 }}>{p.direccion}</Text>
              </View>
              <Text style={{ color: GRIS, fontSize: 13 }}>{horaSola(p.resueltaEn, idioma)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

/** Detalle de una parada: paquetes, datos, cliente, entrega con pruebas e incidencias. */
function DetalleParada({
  t,
  idioma,
  ruta,
  parada,
  encolar,
  yo,
  error,
  cola,
  colaLista,
  volver,
  irA,
  abrirPaquete,
}: {
  t: Textos;
  idioma: Idioma;
  ruta: Ruta;
  parada: Parada;
  encolar: Encolar;
  yo: Punto | null;
  error: React.ReactNode;
  cola: React.ReactNode;
  colaLista: AccionFlex[];
  volver: () => void;
  irA: (id: string) => void;
  abrirPaquete: (id: string) => void;
}) {
  const [modo, setModo] = useState<'ver' | 'incidencia'>('ver');
  const [pestana, setPestana] = useState<'paquetes' | 'detalles' | 'cliente'>('paquetes');
  const [prueba, setPrueba] = useState<'foto' | 'pin' | 'firma' | 'sinContacto'>('foto');
  const [foto, setFoto] = useState<string | null>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const [pidiendoFirma, setPidiendoFirma] = useState(false);
  const [pin, setPin] = useState('');
  const [sinContacto, setSinContacto] = useState(false);
  const [recibio, setRecibio] = useState('');
  // Fase 6: el cobro contra entrega.
  const cobroPendiente = parada.cobro?.estado === 'pendiente' ? parada.cobro : null;
  const [metodo, setMetodo] = useState<MetodoCobro>(
    cobroPendiente?.moneda === 'VES' ? 'pago_movil' : 'efectivo_usd',
  );
  const [montoTexto, setMontoTexto] = useState(
    cobroPendiente ? (cobroPendiente.monto / 100).toFixed(2) : '',
  );
  const [referenciaPago, setReferenciaPago] = useState('');
  const [cedula, setCedula] = useState('');
  const [relacion, setRelacion] = useState<'titular' | 'familiar' | 'vecino' | 'portero'>(
    'titular',
  );
  const [motivo, setMotivo] = useState<(typeof MOTIVOS_INCIDENCIA)[number]>('ausente');
  const [obs, setObs] = useState('');
  const [proxima, setProxima] = useState<(typeof PROXIMAS_ACCIONES)[number]>('reintentar');
  const [aviso, setAviso] = useState('');
  const [hecha, setHecha] = useState<{ en: Date; foto: boolean; firma: boolean } | null>(null);
  const base = `${B}/${ruta.id}/paradas/${parada.id}`;
  const activos = paquetesActivos(parada);
  const enCamino = parada.paquetes.filter((p) => p.estado === 'en_transito');
  const fallidos = parada.paquetes.filter((p) => p.estado === 'entrega_fallida');
  const exige = (['foto', 'pin', 'firma'] as const).filter((k) => parada.pruebas[k]);
  const i = ruta.paradas.findIndex((p) => p.id === parada.id);
  const previa = i > 0 ? ruta.paradas[i - 1] : undefined;
  const proximaParada = ruta.paradas[i + 1];
  const siguienteId = siguienteDe(ruta)?.id ?? null;
  const distancia = km(yo, coord(parada), t, idioma);
  const pestanasPrueba = (
    [
      'foto',
      ...(parada.pruebas.pin ? (['pin'] as const) : []),
      ...(parada.pruebas.firma ? (['firma'] as const) : []),
      // Con dinero de por medio nunca se deja sin contacto (el servidor también lo impide).
      ...(parada.pruebas.sinContacto && !cobroPendiente ? (['sinContacto'] as const) : []),
    ] as const
  ).map((id) => ({ id, texto: t.pestanasPrueba[id] }));

  async function tomarFoto() {
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) return;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
    });
    const a = r.canceled ? null : r.assets[0];
    if (a) setFoto(a.base64 ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.base64}` : a.uri);
  }
  async function entregar() {
    // Las mismas reglas que exige el servidor, para no guardar en el celular una entrega que rechazaría.
    const faltan = pruebasFaltantes(parada.pruebas, {
      foto: Boolean(foto),
      pin: Boolean(pin),
      firma: Boolean(firma),
      sinContacto,
    });
    if (faltan.length)
      return setAviso(`${t.falta}: ${faltan.map((k) => t.pruebas[k]).join(', ')}.`);
    const cobro = cobroPendiente ? cobroDelFormulario() : null;
    if (cobroPendiente) {
      if (!cobro) return;
      if (!recibio.trim()) return setAviso(`${t.falta}: ${t.quienPaga}.`);
      if (cedula.replace(/[\s.-]/g, '').length < 7) return setAviso(t.faltaCedula);
    }
    setAviso('');
    const p = await ubicacion();
    await encolar({
      tipo: 'entrega',
      rutaId: ruta.id,
      paradaId: parada.id,
      ruta: `${base}/entregar`,
      cuerpo: {
        sinContacto,
        recibio,
        ...(pin ? { pin } : {}),
        ...(cobro ? { cobro, recibioDocumento: cedula.trim(), recibioRelacion: relacion } : {}),
        ...(p ?? {}),
      },
      adjuntos: { ...(foto ? { foto } : {}), ...(firma ? { firma } : {}) },
    });
    setHecha({ en: new Date(), foto: Boolean(foto), firma: Boolean(firma) });
    setModo('ver');
  }
  /** El cobro escrito, con las mismas reglas que el servidor (o null y el aviso de qué falta). */
  function cobroDelFormulario() {
    if (!cobroPendiente) return null;
    const monto = Math.round(Number(montoTexto.replace(',', '.')) * 100);
    const moneda =
      metodo === 'punto_venta'
        ? cobroPendiente.moneda
        : metodo === 'efectivo_usd' || metodo === 'zelle'
          ? 'USD'
          : 'VES';
    if (!Number.isFinite(monto) || monto <= 0) {
      setAviso(t.errorCobro.monto_incompleto);
      return null;
    }
    const c = { metodo, monto, moneda: moneda as 'USD' | 'VES', referencia: referenciaPago.trim() };
    const v = validarCobro(cobroPendiente, c);
    if (!v.ok) {
      setAviso(t.errorCobro[v.error]);
      return null;
    }
    return c;
  }
  async function incidencia() {
    const p = await ubicacion();
    await encolar({
      tipo: 'incidencia',
      rutaId: ruta.id,
      paradaId: parada.id,
      ruta: `${base}/incidencia`,
      cuerpo: { motivo, observaciones: obs, proximaAccion: proxima, ...(p ?? {}) },
      adjuntos: foto ? { foto } : undefined,
    });
    setModo('ver');
  }

  // ───── Entrega hecha: «completada» solo cuando el servidor la confirmó ─────
  if (hecha) {
    const pendiente = colaLista.find((a) => a.tipo === 'entrega' && a.paradaId === parada.id);
    const confirmada = !pendiente && parada.estado === 'entregada';
    const otra =
      ruta.paradas.find((p) => p.id !== parada.id && ['pendiente', 'llegada'].includes(p.estado)) ??
      null;
    const entregados = activos.filter((p) => p.estado === 'entregado').length;
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Atras texto={t.volverRuta} alTocar={volver} />
        {error}
        <View style={{ alignItems: 'center', gap: 8, paddingVertical: 8 }}>
          <Listo marcado={confirmada} tamano={64} />
          <Text
            style={{ fontSize: 22, fontWeight: '900', color: C.secundario, textAlign: 'center' }}
            accessibilityRole="header"
          >
            {confirmada
              ? t.entregaCompleta
              : pendiente?.estado === 'error'
                ? t.errorSync
                : t.entregaGuardada}
          </Text>
          {pendiente?.estado === 'pendiente' ? (
            <Text style={{ color: GRIS, textAlign: 'center' }}>{t.entregaGuardadaAyuda}</Text>
          ) : null}
          {pendiente?.estado === 'error' && pendiente.error ? (
            <Text style={{ color: C.acento, textAlign: 'center' }}>{pendiente.error}</Text>
          ) : null}
          <Text style={{ fontWeight: '800', color: C.secundario }}>{nombreParada(parada)}</Text>
          {parada.destinatarioNombre ? (
            <Text style={{ color: GRIS, textAlign: 'center' }}>{parada.direccion}</Text>
          ) : null}
        </View>
        <View style={[tarjeta, { gap: 0, backgroundColor: confirmada ? '#F1F8F3' : '#FFFFFF' }]}>
          <Fila
            etiqueta={t.hora}
            valor={hecha.en.toLocaleTimeString(idioma === 'en' ? 'en-US' : 'es-US', {
              timeStyle: 'short',
            })}
          />
          {hecha.foto ? <Fila etiqueta={t.fotoGuardada} valor="✓" color={C.exito} /> : null}
          {hecha.firma ? <Fila etiqueta={t.firmaGuardada} valor="✓" color={C.exito} /> : null}
          <Fila
            etiqueta={t.paradaDe(i + 1, ruta.paradas.length)}
            valor={t.paquetesEntregados(entregados)}
            color={entregados ? C.exito : undefined}
          />
        </View>
        {cola}
        {pendiente?.estado === 'error' ? (
          <Boton texto={t.volverRuta} secundario alTocar={() => setHecha(null)} />
        ) : otra ? (
          <Boton texto={t.siguienteParadaBoton} alTocar={() => irA(otra.id)} />
        ) : (
          <Boton logistica texto={t.volverRuta} alTocar={volver} />
        )}
      </View>
    );
  }

  const flecha = (destino: Parada | undefined, texto: string, signo: string) => (
    <Pressable
      onPress={() => destino && irA(destino.id)}
      disabled={!destino}
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ disabled: !destino }}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: BORDE,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: destino ? 1 : 0.35,
      }}
    >
      <Text style={{ fontSize: 22, fontWeight: '700', color: C.secundario, marginTop: -2 }}>
        {signo}
      </Text>
    </Pressable>
  );

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Atras texto={t.volverRuta} alTocar={volver} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {flecha(previa, t.paradaAnterior, '‹')}
        <Text style={{ fontWeight: '800', fontSize: 16, color: C.secundario }}>
          {t.paradaDe(i + 1, ruta.paradas.length)}
        </Text>
        {flecha(proximaParada, t.paradaSiguiente, '›')}
      </View>
      <View style={[tarjeta, { flexDirection: 'row', gap: 12, alignItems: 'center' }]}>
        <Numero n={parada.orden} tono={tonoParada(parada, siguienteId)} tamano={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: '900', fontSize: 17, color: C.secundario }}>
            {nombreParada(parada)}
          </Text>
          {parada.destinatarioNombre ? (
            <Text style={{ color: GRIS }}>{parada.direccion}</Text>
          ) : null}
          <Text style={{ color: parada.estado === 'fallida' ? C.acento : GRIS, fontSize: 13 }}>
            {t.estadosParada[parada.estado] ?? parada.estado}
          </Text>
        </View>
        {distancia ? <Text style={{ color: GRIS, fontSize: 12 }}>{distancia}</Text> : null}
      </View>
      {error}
      {cola}
      <Pestanas
        opciones={[
          { id: 'paquetes', texto: `${t.pestanasParada.paquetes} (${activos.length})` },
          { id: 'detalles', texto: t.pestanasParada.detalles },
          { id: 'cliente', texto: t.pestanasParada.cliente },
        ]}
        activa={pestana}
        alCambiar={setPestana}
      />
      {pestana === 'paquetes' ? (
        <View style={[tarjeta, { paddingVertical: 4 }]}>
          {activos.map((p, n) => (
            <Pressable
              key={p.id}
              onPress={() => abrirPaquete(p.id)}
              accessibilityRole="button"
              accessibilityLabel={`${t.detallesPaquete} ${p.codigoSeguimiento}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingVertical: 10,
                borderTopWidth: n ? 1 : 0,
                borderTopColor: BORDE,
              }}
            >
              <Caja />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontWeight: '800', color: C.secundario }}>
                  {p.codigoSeguimiento}
                </Text>
                {p.descripcion ? (
                  <Text style={{ color: GRIS, fontSize: 13 }}>{p.descripcion}</Text>
                ) : null}
              </View>
              <Pastilla
                texto={t.estadosPaquete[p.estado] ?? p.estado}
                tono={tonoPaquete(p.estado)}
              />
              <Listo marcado={p.estado === 'entregado'} />
            </Pressable>
          ))}
        </View>
      ) : null}
      {pestana === 'detalles' ? (
        <View style={[tarjeta, { gap: 0 }]}>
          <Dato etiqueta={t.direccion} valor={parada.direccion} />
          {parada.instrucciones ? (
            <Dato etiqueta={t.instrucciones} valor={parada.instrucciones} />
          ) : null}
          {parada.ventanaDesde ? (
            <Dato
              etiqueta={t.ventana}
              valor={`${hora(parada.ventanaDesde, idioma)} – ${hora(parada.ventanaHasta, idioma)}`}
            />
          ) : null}
          {parada.referenciaExterna ? (
            <Dato etiqueta={t.referencia} valor={parada.referenciaExterna} />
          ) : null}
          {parada.sinCoordenadas ? (
            <Text style={{ color: C.acento, paddingVertical: 8 }}>{t.sinCoordenadas}</Text>
          ) : null}
          <Boton
            texto={t.navegar}
            secundario
            alTocar={() => navegar(parada.lat, parada.lng, parada.direccion, t)}
          />
        </View>
      ) : null}
      {pestana === 'cliente' ? (
        <View style={[tarjeta, { gap: 8 }]}>
          {parada.destinatarioNombre ? (
            <Dato etiqueta={t.recibe} valor={parada.destinatarioNombre} />
          ) : null}
          {parada.destinatarioTelefono ? (
            <Boton
              texto={t.llamar}
              secundario
              alTocar={() => void Linking.openURL(`tel:${parada.destinatarioTelefono}`)}
            />
          ) : null}
          {!parada.destinatarioNombre && !parada.destinatarioTelefono ? (
            <Text style={{ color: GRIS }}>{t.sinDatosCliente}</Text>
          ) : null}
        </View>
      ) : null}
      {modo === 'ver' && enCamino.length ? (
        <>
          {parada.estado === 'pendiente' ? (
            <Boton
              texto={t.llegue}
              secundario
              alTocar={() =>
                void ubicacion().then((q) =>
                  encolar({
                    tipo: 'llegada',
                    rutaId: ruta.id,
                    paradaId: parada.id,
                    ruta: `${base}/llegada`,
                    cuerpo: q ?? {},
                  }),
                )
              }
            />
          ) : null}
          <View style={[tarjeta, { gap: 10 }]}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.secundario }}>
              {t.confirmarEntrega}
            </Text>
            {exige.length ? (
              <Text style={{ color: GRIS }}>
                {t.exige}: {exige.map((k) => t.pruebas[k]).join(', ')}
              </Text>
            ) : null}
            {pestanasPrueba.length > 1 ? (
              <Pestanas opciones={pestanasPrueba} activa={prueba} alCambiar={setPrueba} />
            ) : null}
            {prueba === 'foto' ? (
              <View style={{ gap: 6 }}>
                <Pressable
                  onPress={() => void tomarFoto()}
                  accessibilityRole="button"
                  accessibilityLabel={foto ? t.tomarOtra : t.tomarFoto}
                  style={{
                    height: 190,
                    borderRadius: 14,
                    overflow: 'hidden',
                    backgroundColor: SUAVE,
                    borderWidth: 1,
                    borderColor: BORDE,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {foto ? (
                    <Image
                      source={{ uri: foto }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="cover"
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <Text style={{ color: GRIS, paddingHorizontal: 24, textAlign: 'center' }}>
                      {t.fotoAyuda}
                    </Text>
                  )}
                  <View
                    style={{
                      position: 'absolute',
                      right: 12,
                      bottom: 12,
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      backgroundColor: 'rgba(16,16,16,0.85)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Camara />
                  </View>
                </Pressable>
                {foto ? (
                  <Text style={{ color: C.exito, fontWeight: '700' }}>{t.fotoLista}</Text>
                ) : null}
              </View>
            ) : null}
            {prueba === 'pin' ? (
              sinContacto ? (
                <Text style={{ color: GRIS }}>{t.sinContactoAyuda}</Text>
              ) : (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: GRIS }}>{t.pinAyuda}</Text>
                  <TextInput
                    value={pin}
                    onChangeText={(x) => setPin(x.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    placeholder="0000"
                    style={[e.input, { fontSize: 22, letterSpacing: 8, textAlign: 'center' }]}
                    accessibilityLabel={t.pin}
                  />
                </View>
              )
            ) : null}
            {prueba === 'firma' ? (
              sinContacto ? (
                <Text style={{ color: GRIS }}>{t.sinContactoAyuda}</Text>
              ) : pidiendoFirma ? (
                <Firma
                  textos={t}
                  alGuardar={(d) => {
                    setFirma(d);
                    setPidiendoFirma(false);
                  }}
                />
              ) : (
                <Boton
                  texto={firma ? t.firmaLista : t.firmar}
                  secundario={!firma}
                  alTocar={() => setPidiendoFirma(true)}
                />
              )
            ) : null}
            {prueba === 'sinContacto' ? (
              <View style={{ gap: 6 }}>
                <Pressable
                  onPress={() => setSinContacto(!sinContacto)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: sinContacto }}
                  style={{ flexDirection: 'row', gap: 8 }}
                >
                  <Marca marcada={sinContacto} cuadrada />
                  <Text style={{ flex: 1 }}>{t.sinContacto}</Text>
                </Pressable>
                <Text style={{ color: GRIS, fontSize: 13 }}>{t.sinContactoAyuda}</Text>
              </View>
            ) : null}
            <TextInput
              value={recibio}
              onChangeText={setRecibio}
              placeholder={cobroPendiente ? t.quienPaga : t.quienRecibio}
              style={e.input}
              accessibilityLabel={cobroPendiente ? t.quienPaga : t.quienRecibio}
            />
            {cobroPendiente ? (
              <View style={{ gap: 8 }} testID="cobro-entrega">
                <Text style={{ fontSize: 18, fontWeight: '900', color: C.secundario }}>
                  {t.cobrar}: {formatearMonto(cobroPendiente.monto, cobroPendiente.moneda, idioma)}
                </Text>
                <Text style={{ color: GRIS, fontSize: 13 }}>{t.cobrarAyuda}</Text>
                <Text style={{ fontWeight: '800' }}>{t.metodoCobro}</Text>
                {METODOS_COBRO.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMetodo(m)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: metodo === m }}
                    style={{ flexDirection: 'row', gap: 8 }}
                  >
                    <Marca marcada={metodo === m} />
                    <Text>{t.metodosCobro[m]}</Text>
                  </Pressable>
                ))}
                <Text style={{ fontWeight: '800' }}>{t.montoCobrado}</Text>
                <TextInput
                  value={montoTexto}
                  onChangeText={setMontoTexto}
                  placeholder={t.montoCobrado}
                  keyboardType="decimal-pad"
                  style={e.input}
                  accessibilityLabel={t.montoCobrado}
                />
                {(METODOS_CON_REFERENCIA as readonly string[]).includes(metodo) ? (
                  <TextInput
                    value={referenciaPago}
                    onChangeText={setReferenciaPago}
                    placeholder={t.referenciaPago}
                    keyboardType="number-pad"
                    style={e.input}
                    accessibilityLabel={t.referenciaPago}
                  />
                ) : null}
                <Text style={{ fontWeight: '800' }}>{t.cedulaRecibe}</Text>
                <TextInput
                  value={cedula}
                  onChangeText={setCedula}
                  placeholder="V-12345678"
                  autoCapitalize="characters"
                  style={e.input}
                  accessibilityLabel={t.cedulaRecibe}
                />
                <Text style={{ fontWeight: '800' }}>{t.relacionRecibe}</Text>
                {(['titular', 'familiar', 'vecino', 'portero'] as const).map((r) => (
                  <Pressable
                    key={r}
                    onPress={() => setRelacion(r)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: relacion === r }}
                    style={{ flexDirection: 'row', gap: 8 }}
                  >
                    <Marca marcada={relacion === r} />
                    <Text>{t.relaciones[r]}</Text>
                  </Pressable>
                ))}
              </View>
            ) : parada.cobro?.estado === 'cobrado' ? (
              <Text style={{ color: C.exito, fontWeight: '700' }}>{t.cobrado}</Text>
            ) : null}
            {aviso ? (
              <Text style={e.error} accessibilityRole="alert">
                {aviso}
              </Text>
            ) : null}
            <Boton texto={t.marcarEntregado} alTocar={() => void entregar()} />
            <Boton
              texto={t.registrarIncidenciaBoton}
              secundario
              alTocar={() => setModo('incidencia')}
            />
          </View>
        </>
      ) : null}
      {modo === 'ver' && fallidos.length
        ? fallidos.map((p) => (
            <Boton
              key={p.id}
              texto={`${t.reintentar} · ${p.codigoSeguimiento}`}
              secundario
              alTocar={() =>
                void encolar({
                  tipo: 'reintento',
                  rutaId: ruta.id,
                  paqueteId: p.id,
                  ruta: `${B}/${ruta.id}/paquetes/${p.id}/reintentar`,
                  cuerpo: {},
                })
              }
            />
          ))
        : null}
      {modo === 'incidencia' ? (
        <View style={[tarjeta, { gap: 10 }]}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: C.secundario }}>
            {t.registrarIncidenciaBoton}
          </Text>
          <Text style={{ fontWeight: '800' }}>{t.motivo}</Text>
          {MOTIVOS_INCIDENCIA.map((m) => (
            <Pressable
              key={m}
              onPress={() => setMotivo(m)}
              accessibilityRole="radio"
              accessibilityState={{ checked: motivo === m }}
              style={{ flexDirection: 'row', gap: 8 }}
            >
              <Marca marcada={motivo === m} />
              <Text>{t.motivos[m]}</Text>
            </Pressable>
          ))}
          <TextInput
            value={obs}
            onChangeText={setObs}
            placeholder={t.observaciones}
            style={e.input}
            multiline
            accessibilityLabel={t.observaciones}
          />
          <Boton
            texto={foto ? t.fotoLista : t.fotoOpcional}
            secundario
            alTocar={() => void tomarFoto()}
          />
          <Text style={{ fontWeight: '800' }}>{t.proxima}</Text>
          {PROXIMAS_ACCIONES.filter(
            (a) => a !== 'reintentar' || parada.pruebas.reintentoEnRuta,
          ).map((a) => (
            <Pressable
              key={a}
              onPress={() => setProxima(a)}
              accessibilityRole="radio"
              accessibilityState={{ checked: proxima === a }}
              style={{ flexDirection: 'row', gap: 8 }}
            >
              <Marca marcada={proxima === a} />
              <Text>{t.acciones[a]}</Text>
            </Pressable>
          ))}
          <Boton texto={t.registrarIncidencia} alTocar={() => void incidencia()} />
          <Atras texto={t.confirmarEntrega} alTocar={() => setModo('ver')} />
        </View>
      ) : null}
    </View>
  );
}

/** Casilla o círculo de selección dibujados (sin emojis ni símbolos: candado C-SIN-EMOJIS). */
function Marca({ marcada, cuadrada }: { marcada: boolean; cuadrada?: boolean }) {
  return (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: cuadrada ? 4 : 10,
        borderWidth: 2,
        borderColor: marcada ? C.logistica : '#8A8A8A',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {marcada ? (
        <View
          style={{
            width: 10,
            height: 10,
            borderRadius: cuadrada ? 2 : 5,
            backgroundColor: C.logistica,
          }}
        />
      ) : null}
    </View>
  );
}

/**
 * C-COLOR-LOGISTICA: «Mi ruta» lleva arriba la franja de Divoox Flex en el color de logística, para
 * reconocer de un vistazo una captura de logística frente a una de comida.
 */
export function MiRuta(props: Parameters<typeof MiRutaContenido>[0]) {
  return (
    <View style={{ flex: 1 }}>
      <View
        testID="franja-logistica"
        style={{ backgroundColor: C.logistica, paddingVertical: 8, paddingHorizontal: 16 }}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.5 }}>DIVOOX FLEX</Text>
      </View>
      <MiRutaContenido {...props} />
    </View>
  );
}

/** Hora local corta de una fecha de la base («2026-10-30 18:18:00» en UTC). */
function horaLocal(f: string, idioma: Idioma) {
  return new Date(`${f.replace(' ', 'T')}Z`).toLocaleTimeString(
    idioma === 'en' ? 'en-US' : 'es-US',
    {
      hour: 'numeric',
      minute: '2-digit',
    },
  );
}

/**
 * C-FLEX-RESUMEN (30 oct 2026, como «Resumen de itinerario» de Amazon Flex): lo que falta con su
 * barra y las paradas Pendientes, Correcto y Problemas.
 */
function TrabajoRestante({ t, ruta }: { t: Textos; ruta: Ruta }) {
  const total = ruta.paradas.length;
  const correcto = ruta.paradas.filter((p) => p.estado === 'entregada').length;
  const problemas = ruta.paradas.filter((p) => p.estado === 'fallida').length;
  const pendientes = total - correcto - problemas;
  const paquetes = ruta.paradas.flatMap((p) => p.paquetes).filter((q) => !q.excluido);
  const paquetesHechos = paquetes.filter((q) => q.estado === 'entregado').length;
  return (
    <View testID="resumen-ruta" style={[tarjeta, { gap: 12 }]}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: C.secundario }}>
        {t.trabajoRestante}
      </Text>
      <Barra
        valor={total ? (total - pendientes) / total : 0}
        etiqueta={`${pendientes} ${t.restantes.paradas}`}
      />
      <Barra
        valor={paquetes.length ? paquetesHechos / paquetes.length : 0}
        etiqueta={`${paquetes.length - paquetesHechos} ${t.restantes.paquetes}`}
      />
      {(
        [
          [t.estadoParadas.pendientes, pendientes, GRIS],
          [t.estadoParadas.correcto, correcto, C.exito],
          [t.estadoParadas.problemas, problemas, problemas ? C.acento : GRIS],
        ] as const
      ).map(([nombre, n, color]) => (
        <View
          key={nombre}
          style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}
        >
          <Text style={{ fontSize: 16, color: C.secundario }}>{nombre}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color }}>{n}</Text>
        </View>
      ))}
    </View>
  );
}
