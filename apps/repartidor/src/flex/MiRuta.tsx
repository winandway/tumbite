/* eslint-disable security/detect-object-injection -- índices sobre los textos fijos de la pantalla */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type AccionFlex,
  ErrorApi,
  type Idioma,
  MOTIVOS_INCIDENCIA,
  PROXIMAS_ACCIONES,
  crearColaFlex,
  enIdioma,
} from '@tumbite/compartido';
import { Boton, C, e } from '@tumbite/movil';
import { Mapa } from '../piezas/Mapa';
import { Firma } from './Firma';
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
  cargado: boolean;
  excluido: boolean;
  entregadoAlCentro: boolean;
};
type Parada = {
  id: string;
  orden: number;
  estado: string;
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
  progreso: { total: number; cargados: number; entregados: number; excluidos: number };
  paradas: Parada[];
};
type Fila = {
  id: string;
  nombre: string;
  empresa: string;
  estado: string;
  ofertaVenceEn: string | null;
  paradas: number;
  paquetes: number;
};

const B = '/datos/v1/flex/conductor/rutas';
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

function navegar(lat: number | null, lng: number | null, direccion: string) {
  const destino = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(direccion);
  void Linking.openURL(
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${destino}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destino}`,
  );
}

const hora = (f: string | null, idioma: Idioma) =>
  f
    ? new Date(`${f.replace(' ', 'T')}${f.includes('Z') ? '' : 'Z'}`).toLocaleString(
        idioma === 'en' ? 'en-US' : 'es-US',
        { dateStyle: 'short', timeStyle: 'short' },
      )
    : '—';

/**
 * «Mi ruta» de Divoox Flex dentro de Divoox Driver: las rutas de paquetes que le asignan u ofrecen
 * las empresas, la carga con escáner (QR y Code 128), las paradas en orden con navegación, la
 * entrega con las pruebas que pide la empresa, las incidencias, las devoluciones y el cierre.
 * Lo que se hace sin señal queda en la cola del celular y se manda solo, sin duplicar.
 */
export function MiRuta({
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
  // La ruta del aviso abre directo; si llega otro aviso, Inicio vuelve a montar esta pantalla (key).
  const [rutaId, setRutaId] = useState<string | null>(abrirRutaId);
  const [ruta, setRuta] = useState<Ruta | null>(null);
  const [paradaId, setParadaId] = useState<string | null>(null);
  const [vistaRuta, setVistaRuta] = useState<'paradas' | 'mapa'>('paradas');
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
        const sinRed = x instanceof ErrorApi && x.estado === 0;
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
      void ubicacion().then((p) =>
        p ? api.pedir('POST', `${B}/${ruta.id}/ubicacion`, p).catch(() => undefined) : undefined,
      );
    }, 30_000);
    return () => clearInterval(reloj);
  }, [api, ruta]);

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
  async function encolar(a: Omit<AccionFlex, 'id' | 'capturadoEn' | 'estado' | 'intentos'>) {
    setError('');
    await colaFlex.agregar(a);
    setCola(await colaFlex.listar());
    await sincronizar();
  }

  async function escaneado(texto: string) {
    if (!ruta) return;
    const p = await ubicacion();
    if (escaneando === 'devolucion' || ruta.estado === 'en_curso') {
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
  }

  async function abrirEscaner(modo: 'carga' | 'devolucion') {
    if (!permisoCamara?.granted && !(await pedirPermiso()).granted)
      return setError(t.permisoCamara);
    setEscaneando(modo);
  }

  const avisoCola = cola.length ? (
    <View style={[e.tarjeta, { gap: 6 }]}>
      {cola.some((a) => a.estado === 'pendiente') ? (
        <Text style={{ color: '#5E5E5E' }}>
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

  // ───────────────── Lista ─────────────────
  if (!rutaId || !ruta) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>{t.titulo}</Text>
        <Text style={{ color: '#5E5E5E' }}>{t.subtitulo}</Text>
        {avisoError}
        {avisoCola}
        {lista === null ? null : lista.length === 0 ? (
          <Text style={{ color: '#5E5E5E' }}>{t.sinRutas}</Text>
        ) : (
          lista.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => {
                setRuta(null);
                setParadaId(null);
                setDevoluciones(null);
                setRutaId(r.id);
              }}
              accessibilityRole="button"
              style={[e.tarjeta, { gap: 4 }]}
            >
              <Text style={{ fontWeight: '900', color: C.secundario }}>
                {r.nombre || r.empresa}
              </Text>
              <Text style={{ color: '#5E5E5E' }}>
                {r.empresa} · {t.estados[r.estado] ?? r.estado}
              </Text>
              <Text style={{ color: '#5E5E5E' }}>
                {r.paradas} {t.paradas} · {r.paquetes} {t.paquetes}
              </Text>
              {r.estado === 'ofrecida' && r.ofertaVenceEn ? (
                <Text style={{ color: C.primario, fontWeight: '700' }}>
                  {t.venceA}: {hora(r.ofertaVenceEn, idioma)}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
        <Boton texto={t.actualizar} secundario alTocar={() => void cargarLista()} />
      </View>
    );
  }

  const parada = ruta.paradas.find((p) => p.id === paradaId) ?? null;
  const volver = (
    <Text
      style={[e.enlace, { textAlign: 'left' }]}
      onPress={() => {
        if (parada) setParadaId(null);
        else {
          setRutaId(null);
          setRuta(null);
          void cargarLista();
        }
      }}
      accessibilityRole="button"
    >
      {parada ? `← ${t.listaParadas}` : t.volver}
    </Text>
  );
  const cabecera = (
    <View style={{ gap: 4 }}>
      {volver}
      <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>
        {ruta.nombre || ruta.empresa}
      </Text>
      <Text style={{ color: '#5E5E5E' }}>
        {t.empresa}: {ruta.empresa} · {t.estados[ruta.estado] ?? ruta.estado}
      </Text>
      <Text style={{ color: '#5E5E5E' }}>
        {ruta.progreso.entregados}/{ruta.progreso.total} · {ruta.paradas.length} {t.paradas}
      </Text>
    </View>
  );
  const escaner = (
    <Modal
      visible={escaneando !== null}
      animationType="slide"
      onRequestClose={() => setEscaneando(null)}
    >
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }}
          onBarcodeScanned={({ data }) => {
            setEscaneando(null);
            void escaneado(data);
          }}
        />
        <View style={{ padding: 16 }}>
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
        style={{ padding: 12, backgroundColor: C.secundario, borderRadius: 10 }}
        accessibilityRole="button"
      >
        <Text style={{ color: '#fff', fontWeight: '800' }}>{t.cargar}</Text>
      </Pressable>
    </View>
  );

  // ───────────────── Parada ─────────────────
  if (parada)
    return (
      <DetalleParada
        {...{ t, idioma, ruta, parada, encolar, error: avisoError, cola: avisoCola, volver }}
      />
    );

  // ───────────────── Ruta según su estado ─────────────────
  const todos = ruta.paradas.flatMap((p) => p.paquetes);
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {cabecera}
      {avisoError}
      {avisoCola}
      {escaner}
      {['ofrecida', 'asignada'].includes(ruta.estado) ? (
        <>
          {ruta.centro ? (
            <Text style={{ color: '#5E5E5E' }}>
              {t.centro}: {ruta.centro.nombre} · {ruta.centro.direccion}
            </Text>
          ) : null}
          {ruta.paradas.map((p) => (
            <Text key={p.id} style={{ color: C.secundario }}>
              {p.orden}. {p.direccion} ({p.paquetes.length} {t.paquetes})
            </Text>
          ))}
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
          {ruta.centro ? (
            <View style={[e.tarjeta, { gap: 6 }]}>
              <Text style={{ fontWeight: '800' }}>
                {t.centro}: {ruta.centro.nombre}
              </Text>
              <Text>{ruta.centro.direccion}</Text>
              <Boton
                texto={t.navegar}
                secundario
                alTocar={() =>
                  navegar(
                    ruta.centro?.lat ?? null,
                    ruta.centro?.lng ?? null,
                    ruta.centro?.direccion ?? '',
                  )
                }
              />
            </View>
          ) : null}
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
          <Boton texto={t.escanear} alTocar={() => void abrirEscaner('carga')} />
          {entradaManual((c) => void escaneado(c))}
          <Text style={{ fontWeight: '800' }}>
            {t.cargados}: {ruta.progreso.cargados}/{ruta.progreso.total}
          </Text>
          {todos
            .filter((p) => !p.excluido)
            .map((p) => (
              <View
                key={p.id}
                style={[
                  e.tarjeta,
                  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '800' }}>{p.codigoSeguimiento}</Text>
                  <Text style={{ color: p.cargado ? C.exito : '#5E5E5E' }}>
                    {t.estadosPaquete[p.estado] ?? p.estado}
                  </Text>
                </View>
                {!p.cargado ? (
                  <Text
                    style={e.enlace}
                    onPress={() => void accion('faltante', { paqueteId: p.id })}
                  >
                    {t.faltante}
                  </Text>
                ) : null}
              </View>
            ))}
          <Text style={{ color: '#5E5E5E' }}>{t.cargaCompleta}</Text>
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['paradas', 'mapa'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setVistaRuta(v)}
                accessibilityRole="tab"
                accessibilityState={{ selected: vistaRuta === v }}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 10,
                  backgroundColor: vistaRuta === v ? C.secundario : '#fff',
                  borderWidth: 1,
                  borderColor: '#2a2a2a',
                }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    fontWeight: '800',
                    color: vistaRuta === v ? '#fff' : C.secundario,
                  }}
                >
                  {v === 'paradas' ? t.listaParadas : t.mapa}
                </Text>
              </Pressable>
            ))}
          </View>
          {vistaRuta === 'mapa' ? (
            <Mapa
              yo={null}
              restaurante={
                ruta.centro?.lat != null && ruta.centro.lng != null
                  ? { lat: ruta.centro.lat, lng: ruta.centro.lng }
                  : null
              }
              casa={(() => {
                const sig = ruta.paradas.find(
                  (p) => ['pendiente', 'llegada'].includes(p.estado) && p.lat != null,
                );
                return sig && sig.lat != null && sig.lng != null
                  ? { lat: sig.lat, lng: sig.lng }
                  : null;
              })()}
              marcadores={ruta.paradas
                .filter((p) => p.lat != null && p.lng != null)
                .map((p) => ({
                  id: p.id,
                  punto: { lat: p.lat as number, lng: p.lng as number },
                  nombre: `${p.orden}. ${p.direccion}`,
                }))}
              etiquetas={{ yo: '', restaurante: t.centro, casa: t.listaParadas }}
              alto={360}
            />
          ) : (
            ruta.paradas.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => setParadaId(p.id)}
                accessibilityRole="button"
                style={[e.tarjeta, { gap: 4 }]}
              >
                <Text style={{ fontWeight: '900', color: C.secundario }}>
                  {p.orden}. {p.direccion}
                </Text>
                <Text
                  style={{
                    color:
                      p.estado === 'entregada'
                        ? C.exito
                        : p.estado === 'fallida'
                          ? C.acento
                          : '#5E5E5E',
                  }}
                >
                  {t.estadosParada[p.estado] ?? p.estado} ·{' '}
                  {p.paquetes.filter((q) => !q.excluido).length} {t.paquetes}
                </Text>
                {p.ventanaDesde ? (
                  <Text style={{ color: '#5E5E5E' }}>
                    {t.ventana}: {p.ventanaDesde.slice(11, 16)}–
                    {(p.ventanaHasta ?? '').slice(11, 16)}
                  </Text>
                ) : null}
                {p.instrucciones ? (
                  <Text style={{ color: '#5E5E5E' }}>{p.instrucciones}</Text>
                ) : null}
                <Text style={e.enlace} onPress={() => navegar(p.lat, p.lng, p.direccion)}>
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
          <Text style={{ fontSize: 18, fontWeight: '900' }}>{t.devolucionTitulo}</Text>
          <Text style={{ color: '#5E5E5E' }}>{t.devolucionAyuda}</Text>
          {devoluciones.map((d) => (
            <View key={d.paqueteId} style={e.tarjeta}>
              <Text style={{ fontWeight: '800' }}>{d.codigoSeguimiento}</Text>
              <Text style={{ color: d.entregadoAlCentro ? C.exito : '#5E5E5E' }}>
                {d.entregadoAlCentro ? t.entregadoCentro : t.porEntregar}
              </Text>
            </View>
          ))}
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
          <Text style={e.enlace} onPress={() => setDevoluciones(null)}>
            ← {t.listaParadas}
          </Text>
        </>
      ) : null}
      {['completada', 'con_incidencias'].includes(ruta.estado) ? (
        <View style={[e.tarjeta, { gap: 6 }]}>
          <Text style={{ fontSize: 18, fontWeight: '900' }}>{t.resumen}</Text>
          {Object.entries(t.resumenCampos).map(([k, texto]) => (
            <Text key={k}>
              {texto}: <Text style={{ fontWeight: '800' }}>{String(ruta.resumen?.[k] ?? 0)}</Text>
            </Text>
          ))}
          <Text>
            {t.inicio}: {hora(ruta.iniciadaEn, idioma)} · {t.fin}: {hora(ruta.cerradaEn, idioma)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Detalle de una parada: llegada, navegación, entrega con pruebas e incidencias. */
function DetalleParada({
  t,
  idioma,
  ruta,
  parada,
  encolar,
  error,
  cola,
  volver,
}: {
  t: (typeof TEXTOS_RUTA)['es'];
  idioma: Idioma;
  ruta: Ruta;
  parada: Parada;
  encolar: (a: Omit<AccionFlex, 'id' | 'capturadoEn' | 'estado' | 'intentos'>) => Promise<void>;
  error: React.ReactNode;
  cola: React.ReactNode;
  volver: React.ReactNode;
}) {
  const [modo, setModo] = useState<'ver' | 'entregar' | 'incidencia'>('ver');
  const [foto, setFoto] = useState<string | null>(null);
  const [firma, setFirma] = useState<string | null>(null);
  const [pidiendoFirma, setPidiendoFirma] = useState(false);
  const [pin, setPin] = useState('');
  const [sinContacto, setSinContacto] = useState(false);
  const [recibio, setRecibio] = useState('');
  const [motivo, setMotivo] = useState<(typeof MOTIVOS_INCIDENCIA)[number]>('ausente');
  const [obs, setObs] = useState('');
  const [proxima, setProxima] = useState<(typeof PROXIMAS_ACCIONES)[number]>('reintentar');
  const base = `${B}/${ruta.id}/paradas/${parada.id}`;
  const enCamino = parada.paquetes.filter((p) => p.estado === 'en_transito');
  const fallidos = parada.paquetes.filter((p) => p.estado === 'entrega_fallida');
  const exige = (['foto', 'pin', 'firma'] as const).filter((k) => parada.pruebas[k]);

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
    const p = await ubicacion();
    await encolar({
      tipo: 'entrega',
      rutaId: ruta.id,
      paradaId: parada.id,
      ruta: `${base}/entregar`,
      cuerpo: { sinContacto, recibio, ...(pin ? { pin } : {}), ...(p ?? {}) },
      adjuntos: { ...(foto ? { foto } : {}), ...(firma ? { firma } : {}) },
    });
    setModo('ver');
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

  return (
    <View style={{ padding: 16, gap: 12 }}>
      {volver}
      <Text style={{ fontSize: 20, fontWeight: '900', color: C.secundario }}>
        {parada.orden}. {parada.direccion}
      </Text>
      <Text style={{ color: '#5E5E5E' }}>
        {t.estadosParada[parada.estado] ?? parada.estado} ·{' '}
        {parada.paquetes.filter((q) => !q.excluido).length} {t.paquetes}
      </Text>
      {error}
      {cola}
      {parada.destinatarioNombre ? (
        <Text>
          {t.recibe}: <Text style={{ fontWeight: '800' }}>{parada.destinatarioNombre}</Text>
        </Text>
      ) : null}
      {parada.destinatarioTelefono ? (
        <Text
          style={e.enlace}
          onPress={() => void Linking.openURL(`tel:${parada.destinatarioTelefono}`)}
        >
          {t.llamar}
        </Text>
      ) : null}
      {parada.instrucciones ? (
        <Text>
          {t.instrucciones}: {parada.instrucciones}
        </Text>
      ) : null}
      {parada.ventanaDesde ? (
        <Text>
          {t.ventana}: {hora(parada.ventanaDesde, idioma)} – {hora(parada.ventanaHasta, idioma)}
        </Text>
      ) : null}
      {parada.sinCoordenadas ? <Text style={{ color: C.acento }}>{t.sinCoordenadas}</Text> : null}
      <Boton
        texto={t.navegar}
        secundario
        alTocar={() => navegar(parada.lat, parada.lng, parada.direccion)}
      />
      {parada.paquetes
        .filter((p) => !p.excluido)
        .map((p) => (
          <View
            key={p.id}
            style={[e.tarjeta, { flexDirection: 'row', justifyContent: 'space-between' }]}
          >
            <Text style={{ fontWeight: '700' }}>{p.codigoSeguimiento}</Text>
            <Text
              style={{
                color:
                  p.estado === 'entregado'
                    ? C.exito
                    : p.estado === 'entrega_fallida'
                      ? C.acento
                      : '#5E5E5E',
              }}
            >
              {t.estadosPaquete[p.estado] ?? p.estado}
            </Text>
          </View>
        ))}
      {modo === 'ver' && enCamino.length ? (
        <>
          {parada.estado === 'pendiente' ? (
            <Boton
              texto={t.llegue}
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
          <Boton texto={t.entregar} exito alTocar={() => setModo('entregar')} />
          <Boton texto={t.noEntregado} secundario alTocar={() => setModo('incidencia')} />
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
      {modo === 'entregar' ? (
        <View style={[e.tarjeta, { gap: 10 }]}>
          {exige.length ? (
            <Text style={{ color: '#5E5E5E' }}>
              {t.exige}: {exige.map((k) => t.pruebas[k]).join(', ')}
            </Text>
          ) : null}
          <Boton
            texto={foto ? t.fotoLista : t.tomarFoto}
            secundario={!foto}
            alTocar={() => void tomarFoto()}
          />
          {parada.pruebas.firma && !sinContacto ? (
            pidiendoFirma ? (
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
          {parada.pruebas.pin && !sinContacto ? (
            <TextInput
              value={pin}
              onChangeText={(x) => setPin(x.replace(/\D/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="0000"
              style={e.input}
              accessibilityLabel={t.pin}
            />
          ) : null}
          {parada.pruebas.sinContacto ? (
            <Pressable
              onPress={() => setSinContacto(!sinContacto)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: sinContacto }}
              style={{ flexDirection: 'row', gap: 8 }}
            >
              <Marca marcada={sinContacto} cuadrada />
              <Text style={{ flex: 1 }}>{t.sinContacto}</Text>
            </Pressable>
          ) : null}
          <TextInput
            value={recibio}
            onChangeText={setRecibio}
            placeholder={t.quienRecibio}
            style={e.input}
            accessibilityLabel={t.quienRecibio}
          />
          <Boton texto={t.confirmarEntrega} exito alTocar={() => void entregar()} />
          <Text style={e.enlace} onPress={() => setModo('ver')}>
            ←
          </Text>
        </View>
      ) : null}
      {modo === 'incidencia' ? (
        <View style={[e.tarjeta, { gap: 10 }]}>
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
          <Text style={e.enlace} onPress={() => setModo('ver')}>
            ←
          </Text>
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
        borderColor: marcada ? C.primario : '#8A8A8A',
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
            backgroundColor: C.primario,
          }}
        />
      ) : null}
    </View>
  );
}
