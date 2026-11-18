import { useEffect } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import { vibracionOferta } from './grandes/accesibilidad';
import { crearAlarmaOferta, type MotivoParada, type MotorAlarma } from './alarmaOferta';
import tonoBucle from '../assets/sonidos/oferta_bucle.wav';

/**
 * C-OFERTA-SUENA (8 nov 2026) y C-OFERTA-SUENA-EN-BUCLE (18 nov 2026, Richard; todos los países):
 * la oferta suena fuerte y en bucle, con vibración repetida, todo el tiempo que está en pantalla.
 * En el celular, expo-audio con el tono propio de 2 s en bucle; en la web, el mismo tono con Audio.
 * La lógica de cuándo se calla vive en alarmaOferta.ts (con sus pruebas); aquí solo el motor.
 */

type Reproductor = {
  loop: boolean;
  volume: number;
  play(): void;
  pause(): void;
  seekTo(s: number): Promise<void>;
};
let reproductor: Reproductor | null = null;
let preparando: Promise<Reproductor | null> | null = null;
let quiereSonar = false;

function prepararNativo(): Promise<Reproductor | null> {
  if (reproductor) return Promise.resolve(reproductor);
  preparando ??= (async () => {
    try {
      const audio = await import('expo-audio');
      // Suena aunque el teléfono esté en silencio (como la alarma del restaurante). En Android
      // no se llama: cambiaría el modo de audio, que pide un permiso que Driver no lleva.
      if (Platform.OS === 'ios') await audio.setAudioModeAsync({ playsInSilentMode: true });
      const p = audio.createAudioPlayer(tonoBucle) as unknown as Reproductor;
      p.loop = true;
      p.volume = 1;
      reproductor = p;
      return p;
    } catch (e) {
      console.warn('alarma de oferta: sin audio en este teléfono', e);
      return null;
    } finally {
      preparando = null;
    }
  })();
  return preparando;
}

type AudioWeb = { loop: boolean; currentTime: number; play(): Promise<void>; pause(): void };
let audioWeb: AudioWeb | null = null;

function sonarWeb() {
  const Audio = (globalThis as { Audio?: new (src: string) => AudioWeb }).Audio;
  if (!Audio) return;
  try {
    // El mismo tono, servido en la raíz del sitio (apps/panel/public), como la alarma del restaurante.
    audioWeb ??= new Audio('/oferta_bucle.wav');
    audioWeb.loop = true;
    audioWeb.currentTime = 0;
    void audioWeb.play().catch(() => undefined);
  } catch {
    /* sin audio en este navegador: queda la oferta en pantalla y la vibración */
  }
}

async function quitarAvisosDeOferta() {
  if (Platform.OS === 'web') return;
  const N = await import('expo-notifications');
  const avisos = await N.getPresentedNotificationsAsync();
  for (const a of avisos) {
    const tipo = (a.request.content.data as { tipo?: unknown } | null)?.tipo;
    if (typeof tipo === 'string' && tipo.startsWith('oferta'))
      await N.dismissNotificationAsync(a.request.identifier);
  }
}

export const motorReal: MotorAlarma = {
  sonar() {
    quiereSonar = true;
    if (Platform.OS === 'web') return sonarWeb();
    void prepararNativo().then((p) => {
      if (!p || !quiereSonar) return;
      void p.seekTo(0).then(() => {
        if (quiereSonar) p.play();
      });
    });
  },
  callar() {
    quiereSonar = false;
    audioWeb?.pause();
    reproductor?.pause();
  },
  vibrar() {
    // C-AUDITIVA-REPARTIDOR: el patrón más largo si marcó dificultad auditiva; aquí se repite.
    Vibration.vibrate(vibracionOferta(), true);
  },
  dejarDeVibrar() {
    Vibration.cancel();
  },
  quitarAviso() {
    void quitarAvisosDeOferta().catch((e) =>
      console.warn('alarma de oferta: no se pudo quitar el aviso de la bandeja', e),
    );
  },
};

/** La única alarma de oferta de Driver. */
export const alarmaOferta = crearAlarmaOferta(motorReal);

/** Para cerrar sesión o cualquier salida que no pase por la pantalla de la oferta. */
export function pararAlarmaOferta(motivo: MotivoParada = 'sesion') {
  alarmaOferta.parar(motivo);
}

/**
 * Suena mientras la oferta `id` está en pantalla, hasta `venceEn`. Se calla al desmontar (aceptar,
 * rechazar, vencer o retirarse la oferta la quitan de la pantalla) y si la app se va al fondo.
 */
export function useAlarmaOferta(id: string, venceEn: number) {
  useEffect(() => {
    alarmaOferta.empezar(id, venceEn);
    const sub = AppState.addEventListener('change', (e) => {
      if (e !== 'active') alarmaOferta.parar('fondo', id);
    });
    return () => {
      sub.remove();
      alarmaOferta.parar('salio', id);
    };
    // venceEn se fija al llegar la oferta; si cambia, es la misma oferta renovada y sigue sonando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // Al tocar aceptar o rechazar se calla en el acto, sin esperar la respuesta del servidor.
  return (motivo: 'aceptada' | 'rechazada') => alarmaOferta.parar(motivo, id);
}
