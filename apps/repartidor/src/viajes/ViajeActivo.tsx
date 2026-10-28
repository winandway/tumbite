import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Switch, Text, TextInput, View } from 'react-native';
import { ErrorApi, type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { Boton, C } from '@tumbite/movil';
import { TEXTOS_VIAJE } from './textos';

type Api = {
  pedir<T>(
    metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    ruta: string,
    cuerpo?: unknown,
    extra?: { cabeceras?: Record<string, string> },
  ): Promise<T>;
};

/** Lo que manda GET /datos/conductor/operaciones/actual. */
export type ViajeConductor = {
  id: string;
  estado: 'asignado' | 'conductor_llego' | 'en_curso' | string;
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
  total: number | null;
  moneda: string | null;
  pasajero: string;
};

/** Una clave nueva por acción: el servidor no repite nada si la app reintenta. */
const clave = () => `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

function abrirMapa(lat: number, lng: number) {
  const destino = `${lat},${lng}`;
  void Linking.openURL(
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${destino}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destino}`,
  );
}

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
}: {
  api: Api;
  idioma: Idioma;
  viaje: ViajeConductor;
  alCambiar: () => void;
}) {
  const t = enIdioma(TEXTOS_VIAJE, idioma).activo;
  const [pin, setPin] = useState('');
  const [casco, setCasco] = useState(false);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cierre, setCierre] = useState<'terminado' | 'no_show' | null>(null);
  // M7: lo que cobra al terminar (precio fijo + espera + lo que el pasajero debía), del servidor.
  const [totalFinal, setTotalFinal] = useState<number | null>(null);
  const [estrellas, setEstrellas] = useState(0);
  /** M8: el conductor califica al pasajero (una vez); después vuelve al inicio. */
  async function calificarYSalir() {
    if (estrellas)
      await api
        .pedir('POST', `/datos/conductor/operaciones/${viaje.id}/calificar`, { estrellas })
        .catch(() => undefined);
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
      try {
        const r = await api.pedir<{ totalFinal?: number | null }>(
          'POST',
          `/datos/conductor/operaciones/${viaje.id}/${nombrePaso}`,
          cuerpo,
          { cabeceras: { 'idempotency-key': clave() } },
        );
        if (r?.totalFinal != null) setTotalFinal(r.totalFinal);
        if (final) setCierre(final);
        else alCambiar();
      } catch (x) {
        setError(x instanceof ErrorApi ? x.message : String(x));
      } finally {
        setEnviando(false);
      }
    },
    [api, viaje.id, alCambiar],
  );

  if (cierre)
    return (
      <View testID="viaje-cerrado" style={{ padding: 20, gap: 14 }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: C.secundario }}>
          {cierre === 'terminado' ? t.terminado : t.noShow}
        </Text>
        {cierre === 'terminado' &&
        viaje.metodo_pago === 'efectivo' &&
        (totalFinal ?? viaje.total) != null ? (
          <View
            testID="viaje-cobra-efectivo"
            style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 14 }}
          >
            <Text style={{ color: '#5E5E5E' }}>{t.cobra}</Text>
            <Text style={{ fontSize: 34, fontWeight: '900', color: C.exito }}>
              {formatearMonto(totalFinal ?? viaje.total ?? 0, viaje.moneda ?? 'USD', idioma)}
            </Text>
          </View>
        ) : null}
        {cierre === 'terminado' ? (
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

  const titulo =
    viaje.estado === 'asignado'
      ? `${t.irARecoger} ${nombre}`
      : viaje.estado === 'conductor_llego'
        ? `${t.esperando} ${nombre}`
        : `${t.llevando} ${nombre}`;
  const direccion = viaje.estado === 'en_curso' ? viaje.destino_direccion : viaje.origen_direccion;
  const punto =
    viaje.estado === 'en_curso'
      ? { lat: viaje.destino_lat, lng: viaje.destino_lng }
      : { lat: viaje.origen_lat, lng: viaje.origen_lng };

  return (
    <View testID="viaje-activo" style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: C.secundario }}>{titulo}</Text>
      <View style={{ borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, padding: 12 }}>
        <Text style={{ fontWeight: '800', color: C.secundario }}>{direccion}</Text>
        {viaje.metodo_pago === 'efectivo' && viaje.total != null ? (
          <Text style={{ color: '#5E5E5E', marginTop: 4 }}>
            {t.cobra}: {formatearMonto(viaje.total, viaje.moneda ?? 'USD', idioma)}
          </Text>
        ) : null}
      </View>
      {viaje.estado !== 'conductor_llego' ? (
        <Boton texto={t.navegar} alTocar={() => abrirMapa(punto.lat, punto.lng)} secundario />
      ) : null}

      {viaje.estado === 'asignado' ? (
        <>
          <Boton texto={t.llegue} alTocar={() => void paso('llegue')} cargando={enviando} exito />
          <Pressable
            onPress={() => void paso('liberar', { motivo: 'conductor_suelta' })}
            accessibilityRole="button"
          >
            <Text style={{ textAlign: 'center', color: '#5E5E5E', fontWeight: '700', padding: 8 }}>
              {t.soltar}
            </Text>
          </Pressable>
        </>
      ) : null}

      {viaje.estado === 'conductor_llego' ? (
        <>
          <View
            testID="viaje-espera"
            style={{ backgroundColor: '#F4F6F9', borderRadius: 12, padding: 12 }}
          >
            <Text style={{ color: '#5E5E5E' }}>
              {quedaGratis > 0 ? t.esperaGratis : t.esperaTerminada}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '900', color: C.secundario }}>
              {quedaGratis > 0 ? reloj(quedaGratis) : reloj(esperando)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Switch
              value={casco}
              onValueChange={setCasco}
              accessibilityLabel={t.casco}
              testID="viaje-casco"
            />
            <Text style={{ flex: 1, color: C.secundario, fontWeight: '700' }}>{t.casco}</Text>
          </View>
          <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.cascoAviso}</Text>
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
          <Text style={{ color: '#5E5E5E', fontSize: 12 }}>
            {t.codigoAyuda} ({viaje.intentos_pin_quedan} {t.intentos})
          </Text>
          {casco && pin.length === 4 ? (
            <Boton
              texto={t.iniciar}
              alTocar={() => void paso('iniciar', { pin })}
              cargando={enviando}
              exito
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

      {viaje.estado === 'en_curso' ? (
        <Boton
          texto={t.terminar}
          alTocar={() => void paso('terminar', {}, 'terminado')}
          cargando={enviando}
          exito
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
      <Text style={{ color: '#8A8A8A', fontSize: 12 }}>{t.soporte}</Text>
    </View>
  );
}
