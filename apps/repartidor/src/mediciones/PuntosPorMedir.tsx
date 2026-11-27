import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import {
  type Api,
  ErrorApi,
  FOTOS_MEDICION,
  type Idioma,
  PRECISION_MEDICION_M,
  RADIO_ESTOY_AQUI_M,
  type TipoFotoMedicion,
  distanciaLegible,
  enIdioma,
  nombreFotoMedicion,
} from '@tumbite/compartido';
import {
  Boton,
  C,
  CASILLA_EN_FILA,
  FilaConBoton,
  Text,
  achicarFotoEvidencia,
  e,
} from '@tumbite/movil';
import { AccionFija } from '../piezas/AccionFija';
import { Mapa } from '../piezas/Mapa';
import { type LecturaGps, estadoGps } from './estoyAquiLogica';

/**
 * C-ESTOY-AQUI (27 nov 2026) — todas las ciudades. «Puntos por medir»: los lugares que el equipo le
 * asignó al conductor. A menos de 300 m del punto y con 15 m de precisión o mejor toca «Estoy aquí»
 * (C-ESTOY-AQUI-300: antes, el botón queda gris y dice cuánto falta); se guardan su GPS y la
 * precisión. Después toma las TRES fotos obligatorias con la cámara (C-TRES-FOTOS: entrada o
 * fachada, letrero o algo reconocible, vista desde la calle), cada una con su GPS y su hora. La
 * medición la revisa el equipo; el lugar no cambia hasta que la aprueban.
 */
const T = {
  es: {
    titulo: 'Puntos por medir',
    ayuda:
      'Ve a cada lugar y, cuando estés en el punto exacto donde se deja al pasajero, toca «Estoy aquí» y toma las tres fotos. El equipo revisa cada medición antes de cambiar el mapa.',
    vacio: 'No tienes puntos por medir ahora.',
    estados: {
      sin: 'Por medir',
      pendiente: 'Enviada',
      aprobada: 'Aprobada',
      rechazada: 'Medir otra vez',
      fotos: 'Faltan fotos',
    },
    volver: 'Volver a la lista',
    yo: 'Tú',
    punto: 'Punto guardado',
    sinPermiso:
      'Divoox necesita tu ubicación para medir. Actívala en los ajustes del teléfono y vuelve.',
    permitir: 'Permitir ubicación',
    buscando: 'Buscando tu ubicación…',
    esperar: (p: number) =>
      `Precisión: ${p >= 999 ? 'sin dato' : `${p} m`}. Espera unos segundos al aire libre o acércate al lugar, hasta ${PRECISION_MEDICION_M} m o menos.`,
    lejos: `«Estoy aquí» se activa a ${RADIO_ESTOY_AQUI_M} m o menos del punto. Ve al lugar.`,
    acercate: (d: string) => `Acércate al punto (faltan ${d})`,
    esperando: (p: number) => `Esperando precisión (${p >= 999 ? 'sin dato' : `${p} m`})`,
    listo: (p: number, d: string) => `Precisión: ${p} m · a ${d} del punto guardado`,
    estoyAqui: 'Estoy aquí',
    fotosTitulo: 'Ahora, las tres fotos del lugar',
    fotosAyuda:
      'Son obligatorias y se toman con la cámara aquí mismo. Sin las tres, el equipo no puede aprobar la medición.',
    tomar: 'Tomar foto',
    otraVez2: 'Tomar otra',
    lista: 'Lista',
    sinUbicacion: 'Espera a que el teléfono tenga tu ubicación y toma la foto otra vez.',
    enviada: 'Medición y tres fotos enviadas. El equipo la revisa antes de cambiar el mapa.',
    permisoCamara: 'Activa la cámara en los ajustes del teléfono para tomar la foto.',
    motivo: (m: string) => `El equipo pidió medirlo otra vez: ${m}`,
    otraVez: 'El equipo pidió medirlo otra vez.',
  },
  en: {
    titulo: 'Points to measure',
    ayuda:
      'Go to each place and, when you are at the exact spot where riders get dropped off, tap «I’m here» and take the three photos. The team reviews every measurement before changing the map.',
    vacio: 'You have no points to measure right now.',
    estados: {
      sin: 'To measure',
      pendiente: 'Sent',
      aprobada: 'Approved',
      rechazada: 'Measure again',
      fotos: 'Photos missing',
    },
    volver: 'Back to the list',
    yo: 'You',
    punto: 'Saved point',
    sinPermiso:
      'Divoox needs your location to measure. Turn it on in your phone settings and come back.',
    permitir: 'Allow location',
    buscando: 'Finding your location…',
    esperar: (p: number) =>
      `Accuracy: ${p >= 999 ? 'no data' : `${p} m`}. Wait a few seconds outdoors or move closer, to ${PRECISION_MEDICION_M} m or less.`,
    lejos: `«I’m here» turns on within ${RADIO_ESTOY_AQUI_M} m of the point. Go to the place.`,
    acercate: (d: string) => `Get closer to the point (${d} to go)`,
    esperando: (p: number) => `Waiting for accuracy (${p >= 999 ? 'no data' : `${p} m`})`,
    listo: (p: number, d: string) => `Accuracy: ${p} m · ${d} from the saved point`,
    estoyAqui: 'I’m here',
    fotosTitulo: 'Now, the three photos of the place',
    fotosAyuda:
      'They are required and taken with the camera right here. Without all three, the team can’t approve the measurement.',
    tomar: 'Take photo',
    otraVez2: 'Retake',
    lista: 'Done',
    sinUbicacion: 'Wait until your phone has your location and take the photo again.',
    enviada: 'Measurement and three photos sent. The team reviews it before changing the map.',
    permisoCamara: 'Turn on the camera in your phone settings to take the photo.',
    motivo: (m: string) => `The team asked to measure it again: ${m}`,
    otraVez: 'The team asked to measure it again.',
  },
};

type Medicion = {
  id: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  motivo: string | null;
  /** C-TRES-FOTOS: las que todavía faltan (en una pendiente). */
  faltanFotos?: TipoFotoMedicion[];
};

/** El estado que se ve en la lista: una enviada sin sus tres fotos dice «Faltan fotos». */
const estadoVisible = (m: Medicion | null) =>
  !m ? 'sin' : m.estado === 'pendiente' && m.faltanFotos?.length ? 'fotos' : m.estado;
type Lugar = { id: string; nombre: string; lat: number; lng: number; medicion: Medicion | null };
type Tarea = { id: string; titulo: string; nota: string; ciudad: string; lugares: Lugar[] };

/** El texto de cada estado (sin índice libre: solo los cuatro conocidos). */
function textoEstado(
  x: { sin: string; pendiente: string; aprobada: string; rechazada: string; fotos: string },
  estado: 'sin' | 'pendiente' | 'aprobada' | 'rechazada' | 'fotos',
) {
  switch (estado) {
    case 'fotos':
      return x.fotos;
    case 'pendiente':
      return x.pendiente;
    case 'aprobada':
      return x.aprobada;
    case 'rechazada':
      return x.rechazada;
    default:
      return x.sin;
  }
}

const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

/** Cuántos lugares asignados quedan por medir (para el renglón del perfil). */
export const porMedir = (tareas: Tarea[]) =>
  tareas.reduce(
    (s, t) =>
      s +
      t.lugares.filter((l) => ['sin', 'rechazada', 'fotos'].includes(estadoVisible(l.medicion)))
        .length,
    0,
  );

export function PuntosPorMedir({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [tareas, setTareas] = useState<Tarea[] | null>(null);
  const [error, setError] = useState('');
  const [elegido, setElegido] = useState<{ tarea: Tarea; lugar: Lugar } | null>(null);

  const cargar = useCallback(() => {
    api
      .pedir<{ tareas: Tarea[] }>('GET', '/datos/conductor/mediciones')
      .then((r) => setTareas(Array.isArray(r?.tareas) ? r.tareas : []))
      .catch((x: unknown) => setError(mensaje(x)));
  }, [api]);
  useEffect(cargar, [cargar]);

  if (elegido)
    return (
      <Medir
        api={api}
        idioma={idioma}
        tarea={elegido.tarea}
        lugar={elegido.lugar}
        volver={() => {
          setElegido(null);
          cargar();
        }}
      />
    );

  return (
    <View style={{ gap: 12, padding: 16 }} testID="puntos-por-medir">
      <Text style={[e.titulo]}>{t.titulo}</Text>
      <Text style={{ color: C.secundario }}>{t.ayuda}</Text>
      {error ? <Text style={{ color: C.primario }}>{error}</Text> : null}
      {tareas && !tareas.length ? <Text>{t.vacio}</Text> : null}
      {(tareas ?? []).map((ta) => (
        <View key={ta.id} style={{ gap: 8 }}>
          <Text style={{ fontWeight: '700', fontSize: 17 }}>{ta.titulo}</Text>
          {ta.nota ? <Text style={{ color: C.secundario }}>{ta.nota}</Text> : null}
          {ta.lugares.map((l) => {
            const estado = estadoVisible(l.medicion);
            const verde = estado === 'aprobada' || estado === 'pendiente';
            return (
              <Pressable
                key={l.id}
                testID={`medir-${l.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${l.nombre}, ${textoEstado(t.estados, estado)}`}
                onPress={() => setElegido({ tarea: ta, lugar: l })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: '#D6D8DC',
                  backgroundColor: '#fff',
                }}
              >
                <Text style={{ flex: 1, fontWeight: '700' }}>{l.nombre}</Text>
                <Text
                  style={{
                    fontWeight: '700',
                    color: verde
                      ? '#1E7B34'
                      : estado === 'rechazada' || estado === 'fotos'
                        ? C.primario
                        : C.secundario,
                  }}
                >
                  {textoEstado(t.estados, estado)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function Medir({
  api,
  idioma,
  tarea,
  lugar,
  volver,
}: {
  api: Api;
  idioma: Idioma;
  tarea: Tarea;
  lugar: Lugar;
  volver: () => void;
}) {
  const t = enIdioma(T, idioma);
  const [permiso, setPermiso] = useState<boolean | null>(null);
  const [lectura, setLectura] = useState<LecturaGps | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  // Una medición enviada antes que todavía no tiene sus tres fotos se retoma aquí mismo.
  const [hecha, setHecha] = useState<string | null>(
    lugar.medicion?.estado === 'pendiente' && lugar.medicion.faltanFotos?.length
      ? lugar.medicion.id
      : null,
  );
  const [faltan, setFaltan] = useState<TipoFotoMedicion[]>(
    lugar.medicion?.faltanFotos?.length ? lugar.medicion.faltanFotos : [...FOTOS_MEDICION],
  );
  const [subiendo, setSubiendo] = useState<TipoFotoMedicion | null>(null);
  const vigia = useRef<Location.LocationSubscription | null>(null);
  const relectura = useRef<ReturnType<typeof setInterval> | null>(null);

  const empezar = useCallback(async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    setPermiso(p.granted);
    if (!p.granted) return;
    // Como el resto de Driver (C-LATIDO-UBICACION): cada lectura se marca con el reloj del teléfono al
    // recibirla; la hora que trae el GPS puede venir corrida y dejaría la lectura por «vieja».
    const anotar = (pos: Location.LocationObject) =>
      setLectura({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        precisionM: pos.coords.accuracy,
        hora: Date.now(),
      });
    const leer = () =>
      void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest })
        .then(anotar)
        .catch(() => undefined);
    leer();
    // Quieto en el punto, el GPS puede no avisar nada nuevo: se vuelve a leer cada 5 s.
    if (relectura.current) clearInterval(relectura.current);
    relectura.current = setInterval(leer, 5000);
    vigia.current?.remove();
    vigia.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      anotar,
    );
  }, []);
  useEffect(() => {
    // Al abrir, se pide la ubicación (y empieza a seguirla) fuera del dibujo.
    const primero = setTimeout(() => void empezar(), 0);
    const reloj = setInterval(() => setAhora(Date.now()), 1000);
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
      vigia.current?.remove();
      if (relectura.current) clearInterval(relectura.current);
    };
  }, [empezar]);

  const estado =
    permiso == null ? { tipo: 'buscando' as const } : estadoGps(lectura, lugar, permiso, ahora);
  const yo = lectura ? { lat: lectura.lat, lng: lectura.lng } : null;

  async function enviar() {
    if (estado.tipo !== 'listo' || !lectura) return;
    setEnviando(true);
    setError('');
    try {
      const r = await api.pedir<{ medicion: { id: string } }>(
        'POST',
        `/datos/conductor/mediciones/${tarea.id}/lugares/${lugar.id}`,
        {
          lat: lectura.lat,
          lng: lectura.lng,
          precisionM: lectura.precisionM,
          tomadaEn: Math.round(lectura.hora),
        },
      );
      setHecha(r.medicion.id);
      setFaltan([...FOTOS_MEDICION]);
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }

  /** C-TRES-FOTOS: una foto con la cámara (nunca de la galería), con el GPS y la hora de ahora. */
  async function foto(tipo: TipoFotoMedicion) {
    if (!hecha) return;
    setError('');
    try {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return setError(t.permisoCamara);
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
      const a = r.canceled ? null : r.assets[0];
      if (!a) return;
      // La ubicación de ESTE momento (la que sigue la pantalla, si es reciente).
      const aqui =
        lectura && ahora - lectura.hora < 60_000
          ? lectura
          : await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
              .then((pos) => ({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                precisionM: pos.coords.accuracy,
                hora: Date.now(),
              }))
              .catch(() => null);
      if (!aqui) return setError(t.sinUbicacion);
      setSubiendo(tipo);
      const uri = await achicarFotoEvidencia(a, manipulateAsync, SaveFormat.JPEG);
      const blob = await (await fetch(uri)).blob();
      const resp = (await api.subirFotoCon<{ faltan?: TipoFotoMedicion[] }>(
        blob,
        `/datos/conductor/mediciones/medicion/${hecha}/fotos/${tipo}`,
        {
          'x-foto-lat': String(aqui.lat),
          'x-foto-lng': String(aqui.lng),
          ...(aqui.precisionM ? { 'x-foto-precision': String(Math.round(aqui.precisionM)) } : {}),
          'x-foto-hora': String(Math.round(aqui.hora)),
        },
      )) ?? { faltan: undefined };
      setFaltan(Array.isArray(resp.faltan) ? resp.faltan : faltan.filter((x) => x !== tipo));
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setSubiendo(null);
    }
  }

  const rechazo =
    lugar.medicion?.estado === 'rechazada'
      ? lugar.medicion.motivo
        ? t.motivo(lugar.medicion.motivo)
        : t.otraVez
      : '';

  return (
    <View style={{ gap: 12, padding: 16 }} testID="medir-lugar">
      <Text style={[e.titulo]}>{lugar.nombre}</Text>
      <Text style={{ color: C.secundario }}>{tarea.titulo}</Text>
      {rechazo && !hecha ? <Text style={{ color: C.primario }}>{rechazo}</Text> : null}
      <Mapa
        yo={yo}
        casa={{ lat: lugar.lat, lng: lugar.lng }}
        alto={280}
        etiquetas={{ yo: t.yo, restaurante: '', casa: t.punto }}
        direccionDestino={lugar.nombre}
      />
      {hecha ? (
        faltan.length ? (
          <View style={{ gap: 10 }} testID="tres-fotos">
            <Text style={{ fontWeight: '700', fontSize: 17 }}>{t.fotosTitulo}</Text>
            <Text style={{ color: C.secundario }}>{t.fotosAyuda}</Text>
            {FOTOS_MEDICION.map((tipo, i) => {
              const lista = !faltan.includes(tipo);
              return (
                <View
                  key={tipo}
                  testID={`foto-${tipo}`}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#D6D8DC',
                    backgroundColor: '#fff',
                  }}
                >
                  <FilaConBoton>
                    <Text style={[CASILLA_EN_FILA, { fontWeight: '700' }]}>
                      {`${i + 1}. ${nombreFotoMedicion(tipo, idioma === 'en' ? 'en' : 'es')}${lista ? ` · ${t.lista}` : ''}`}
                    </Text>
                    <Boton
                      texto={lista ? t.otraVez2 : t.tomar}
                      enFila
                      secundario={lista}
                      exito={!lista}
                      cargando={subiendo === tipo}
                      alTocar={() => void foto(tipo)}
                    />
                  </FilaConBoton>
                </View>
              );
            })}
          </View>
        ) : (
          <Text testID="medicion-enviada" style={{ color: '#1E7B34', fontWeight: '700' }}>
            {t.enviada}
          </Text>
        )
      ) : estado.tipo === 'sin-permiso' ? (
        <>
          <Text>{t.sinPermiso}</Text>
          <Boton texto={t.permitir} secundario alTocar={() => void empezar()} />
        </>
      ) : estado.tipo === 'buscando' ? (
        <Text testID="gps-buscando">{t.buscando}</Text>
      ) : estado.tipo === 'esperar' ? (
        <>
          <Text testID="gps-esperar">{t.esperar(estado.precisionM)}</Text>
          <AccionFija testID="accion-fija-estoy-aqui">
            <BotonGris texto={t.esperando(estado.precisionM)} testID="estoy-aqui-esperando" />
          </AccionFija>
        </>
      ) : estado.tipo === 'lejos' ? (
        <>
          <Text testID="gps-lejos">{t.lejos}</Text>
          <AccionFija testID="accion-fija-estoy-aqui">
            <BotonGris
              texto={t.acercate(distanciaLegible(estado.metros, idioma))}
              testID="estoy-aqui-lejos"
            />
          </AccionFija>
        </>
      ) : (
        <>
          <Text testID="gps-listo" style={{ color: '#1E7B34', fontWeight: '700' }}>
            {t.listo(estado.precisionM, distanciaLegible(estado.metros, idioma))}
          </Text>
          {/* C-BOTON-SOBRE-BARRA: «Estoy aquí» va fijo sobre la barra de abajo. */}
          <AccionFija testID="accion-fija-estoy-aqui">
            <Boton
              texto={t.estoyAqui}
              testID="estoy-aqui"
              exito
              cargando={enviando}
              alTocar={() => void enviar()}
            />
          </AccionFija>
        </>
      )}
      {error ? <Text style={{ color: C.primario }}>{error}</Text> : null}
      <Boton texto={t.volver} secundario alTocar={volver} />
    </View>
  );
}

/**
 * C-ESTOY-AQUI-300: «Estoy aquí» apagado, en gris, y su propio texto dice qué falta («Acércate al
 * punto (faltan 420 m)»). Nunca un botón apagado mudo.
 */
function BotonGris({ texto, testID }: { texto: string; testID: string }) {
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="button"
      accessibilityState={{ disabled: true }}
      accessibilityLabel={texto}
      style={{
        minHeight: 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#E4E6EA',
      }}
    >
      <Text style={{ color: '#5B6069', fontWeight: '700', fontSize: 16, textAlign: 'center' }}>
        {texto}
      </Text>
    </View>
  );
}
