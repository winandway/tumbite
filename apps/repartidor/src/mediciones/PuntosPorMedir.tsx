import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { SaveFormat, manipulateAsync } from 'expo-image-manipulator';
import {
  type Api,
  ErrorApi,
  type Idioma,
  PRECISION_MEDICION_M,
  distanciaLegible,
  enIdioma,
} from '@tumbite/compartido';
import { Boton, C, Text, achicarFotoEvidencia, e } from '@tumbite/movil';
import { Mapa } from '../piezas/Mapa';
import { type LecturaGps, estadoGps } from './estoyAquiLogica';

/**
 * C-ESTOY-AQUI (27 nov 2026) — todas las ciudades. «Puntos por medir»: los lugares que el equipo le
 * asignó al conductor. Al llegar a cada uno toca «Estoy aquí»: se guardan su GPS y la precisión
 * (nunca peor que 15 m: si no, la pantalla le pide esperar o acercarse) y, si quiere, una foto del
 * lugar. La medición la revisa el equipo; el lugar no cambia hasta que la aprueban.
 */
const T = {
  es: {
    titulo: 'Puntos por medir',
    ayuda:
      'Ve a cada lugar y, cuando estés en el punto exacto donde se deja al pasajero, toca «Estoy aquí». El equipo revisa cada medición antes de cambiar el mapa.',
    vacio: 'No tienes puntos por medir ahora.',
    estados: {
      sin: 'Por medir',
      pendiente: 'Enviada',
      aprobada: 'Aprobada',
      rechazada: 'Medir otra vez',
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
    lejos: (d: string) => `Estás a ${d} del punto. Ve al lugar para medirlo.`,
    listo: (p: number, d: string) => `Precisión: ${p} m · a ${d} del punto guardado`,
    estoyAqui: 'Estoy aquí',
    enviada: 'Medición enviada. El equipo la revisa antes de cambiar el mapa.',
    foto: 'Tomar foto del lugar (opcional)',
    fotoAyuda: 'La entrada, el letrero o la parada: ayuda al equipo a aprobarla.',
    fotoLista: 'Foto enviada.',
    permisoCamara: 'Activa la cámara en los ajustes del teléfono para tomar la foto.',
    motivo: (m: string) => `El equipo pidió medirlo otra vez: ${m}`,
    otraVez: 'El equipo pidió medirlo otra vez.',
  },
  en: {
    titulo: 'Points to measure',
    ayuda:
      'Go to each place and, when you are at the exact spot where riders get dropped off, tap «I’m here». The team reviews every measurement before changing the map.',
    vacio: 'You have no points to measure right now.',
    estados: {
      sin: 'To measure',
      pendiente: 'Sent',
      aprobada: 'Approved',
      rechazada: 'Measure again',
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
    lejos: (d: string) => `You’re ${d} from the point. Go to the place to measure it.`,
    listo: (p: number, d: string) => `Accuracy: ${p} m · ${d} from the saved point`,
    estoyAqui: 'I’m here',
    enviada: 'Measurement sent. The team reviews it before changing the map.',
    foto: 'Take a photo of the place (optional)',
    fotoAyuda: 'The entrance, the sign or the stop: it helps the team approve it.',
    fotoLista: 'Photo sent.',
    permisoCamara: 'Turn on the camera in your phone settings to take the photo.',
    motivo: (m: string) => `The team asked to measure it again: ${m}`,
    otraVez: 'The team asked to measure it again.',
  },
};

type Medicion = {
  id: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  motivo: string | null;
};
type Lugar = { id: string; nombre: string; lat: number; lng: number; medicion: Medicion | null };
type Tarea = { id: string; titulo: string; nota: string; ciudad: string; lugares: Lugar[] };

/** El texto de cada estado (sin índice libre: solo los cuatro conocidos). */
function textoEstado(
  x: { sin: string; pendiente: string; aprobada: string; rechazada: string },
  estado: 'sin' | 'pendiente' | 'aprobada' | 'rechazada',
) {
  switch (estado) {
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
    (s, t) => s + t.lugares.filter((l) => !l.medicion || l.medicion.estado === 'rechazada').length,
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
            const estado = l.medicion?.estado ?? 'sin';
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
                    color: verde ? '#1E7B34' : estado === 'rechazada' ? C.primario : C.secundario,
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
  const [hecha, setHecha] = useState<string | null>(null);
  const [fotoLista, setFotoLista] = useState(false);
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
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setEnviando(false);
    }
  }

  async function foto() {
    if (!hecha) return;
    setError('');
    try {
      const p = await ImagePicker.requestCameraPermissionsAsync();
      if (!p.granted) return setError(t.permisoCamara);
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.5 });
      const a = r.canceled ? null : r.assets[0];
      if (!a) return;
      setEnviando(true);
      const uri = await achicarFotoEvidencia(a, manipulateAsync, SaveFormat.JPEG);
      const blob = await (await fetch(uri)).blob();
      await api.subirFoto(blob, `/datos/conductor/mediciones/medicion/${hecha}/foto`);
      setFotoLista(true);
    } catch (x) {
      setError(mensaje(x));
    } finally {
      setEnviando(false);
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
        <>
          <Text style={{ color: '#1E7B34', fontWeight: '700' }}>{t.enviada}</Text>
          {fotoLista ? (
            <Text style={{ color: '#1E7B34' }}>{t.fotoLista}</Text>
          ) : (
            <>
              <Text style={{ color: C.secundario }}>{t.fotoAyuda}</Text>
              <Boton texto={t.foto} secundario cargando={enviando} alTocar={() => void foto()} />
            </>
          )}
        </>
      ) : estado.tipo === 'sin-permiso' ? (
        <>
          <Text>{t.sinPermiso}</Text>
          <Boton texto={t.permitir} secundario alTocar={() => void empezar()} />
        </>
      ) : estado.tipo === 'buscando' ? (
        <Text testID="gps-buscando">{t.buscando}</Text>
      ) : estado.tipo === 'esperar' ? (
        <Text testID="gps-esperar" style={{ fontWeight: '700' }}>
          {t.esperar(estado.precisionM)}
        </Text>
      ) : estado.tipo === 'lejos' ? (
        <Text testID="gps-lejos" style={{ fontWeight: '700' }}>
          {t.lejos(distanciaLegible(estado.metros, idioma))}
        </Text>
      ) : (
        <>
          <Text testID="gps-listo" style={{ color: '#1E7B34', fontWeight: '700' }}>
            {t.listo(estado.precisionM, distanciaLegible(estado.metros, idioma))}
          </Text>
          <Boton
            texto={t.estoyAqui}
            testID="estoy-aqui"
            exito
            cargando={enviando}
            alTocar={() => void enviar()}
          />
        </>
      )}
      {error ? <Text style={{ color: C.primario }}>{error}</Text> : null}
      <Boton texto={t.volver} secundario alTocar={volver} />
    </View>
  );
}
