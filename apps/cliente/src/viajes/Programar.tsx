import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  ErrorApi,
  type Idioma,
  enIdioma,
  formatearMonto,
  horasParaProgramar,
} from '@tumbite/compartido';
import { Boton, C, Pildora as Etiqueta, useSesion, Text } from '@tumbite/movil';
import { Pildora, Tarjeta } from '../comida/piezas';
import { TEXTOS_MOTO } from './textos';
import { TEXTOS_FIJOS } from './textosFijos';

/**
 * C-VIAJE-PROGRAMADO (14 nov 2026, todos los países): elegir «Ahora» o «Programar» con día y hora
 * (desde 30 minutos hasta 7 días, cada 15 minutos), como Uber Reserve, y la lista «Mis viajes
 * programados» con su cancelación (gratis hasta 60 minutos antes; el servidor decide el cargo).
 */
const local = (i: Idioma) => (i === 'en' ? 'en-US' : 'es');
export const horaCorta = (iso: string, i: Idioma) =>
  new Date(iso).toLocaleTimeString(local(i), { hour: 'numeric', minute: '2-digit' });
export const diaYHora = (iso: string, i: Idioma) =>
  `${new Date(iso).toLocaleDateString(local(i), { weekday: 'short', day: 'numeric', month: 'short' })} · ${horaCorta(iso, i)}`;
const claveDia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function ElegirCuando({
  valor,
  cambiar,
}: {
  /** '' = ahora; si no, la hora elegida en ISO. */
  valor: string;
  cambiar: (iso: string) => void;
}) {
  const { idioma } = useSesion();
  const t = enIdioma(TEXTOS_MOTO, idioma);
  const [programar, setProgramar] = useState(Boolean(valor));
  // La lista de horas se arma una vez al abrir (con la hora de ese momento).
  const [{ horas, hoy, manana }] = useState(() => {
    const ahora = new Date();
    return {
      horas: horasParaProgramar(ahora),
      hoy: claveDia(ahora),
      manana: claveDia(new Date(ahora.getTime() + 86_400_000)),
    };
  });
  const dias = useMemo(() => {
    const vistos = new Map<string, Date>();
    for (const h of horas) if (!vistos.has(claveDia(h))) vistos.set(claveDia(h), h);
    return [...vistos.entries()];
  }, [horas]);
  const elegida = valor ? new Date(valor) : null;
  const [dia, setDia] = useState(elegida ? claveDia(elegida) : (dias[0]?.[0] ?? ''));
  const nombreDia = (k: string, d: Date) =>
    k === hoy
      ? t.hoy
      : k === manana
        ? t.manana
        : d.toLocaleDateString(local(idioma), { weekday: 'short', day: 'numeric' });
  return (
    <View style={{ gap: 8 }} testID="viaje-cuando">
      {/* C-INICIO-NUEVO (borrador aprobado): «Ahora | Programar» como control de dos partes. */}
      <Segmentos
        opciones={[
          { clave: 'ahora', texto: t.ahora },
          { clave: 'programar', texto: t.programar },
        ]}
        activa={programar ? 'programar' : 'ahora'}
        cambiar={(k) => {
          if (k === 'programar') return setProgramar(true);
          setProgramar(false);
          cambiar('');
        }}
        etiqueta={t.cuando}
      />
      {programar ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
              {dias.map(([k, d]) => (
                <Pildora
                  key={k}
                  texto={nombreDia(k, d)}
                  activa={dia === k}
                  alTocar={() => setDia(k)}
                  rol="radio"
                />
              ))}
            </View>
          </ScrollView>
          <Text style={{ color: '#666B73' }}>{t.eligeHora}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
              {horas
                .filter((h) => claveDia(h) === dia)
                .map((h) => (
                  <Pildora
                    key={h.toISOString()}
                    texto={horaCorta(h.toISOString(), idioma)}
                    activa={valor === h.toISOString()}
                    alTocar={() => cambiar(h.toISOString())}
                    rol="radio"
                  />
                ))}
            </View>
          </ScrollView>
        </>
      ) : null}
    </View>
  );
}

type Programado = {
  id: string;
  servicio: string;
  programadoPara: string;
  cancelacionGratisHasta: string;
  total: number;
  moneda: string;
  origen: string;
  destino: string;
  /** C-VIAJES-FIJOS: el viaje fijo del que nace y el menor que lleva. */
  rutina?: { id: string; nombre: string } | null;
  menor?: string | null;
};

/** «Mis viajes programados»: solo aparece si hay alguno. */
export function MisProgramados({ recargar }: { recargar?: number }) {
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS_MOTO, idioma);
  const tf = enIdioma(TEXTOS_FIJOS, idioma);
  const [lista, setLista] = useState<Programado[]>([]);
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ programados: Programado[] }>('GET', '/datos/viajes/programados')
      .then((r) => {
        if (vivo) setLista(r.programados);
      })
      // Sin red, la lista se queda como estaba; la pantalla de pedir sigue funcionando.
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, recargar, vuelta]);
  async function cancelar(p: Programado) {
    if (confirmar !== p.id) return setConfirmar(p.id);
    setConfirmar(null);
    try {
      const r = await api.pedir<{ ok: boolean; cargo: number }>(
        'POST',
        `/datos/viajes/programados/${p.id}/cancelar`,
        {},
      );
      setAviso(
        r.cargo > 0
          ? `${t.canceladaCargo} ${formatearMonto(r.cargo, p.moneda, idioma)}`
          : t.cancelada,
      );
      setVuelta((n) => n + 1);
    } catch (x) {
      setAviso(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  if (!lista.length && !aviso) return null;
  return (
    <View style={{ gap: 8 }} testID="mis-programados">
      {lista.length ? (
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.secundario }}>
          {t.misProgramados}
        </Text>
      ) : null}
      {aviso ? (
        <Text accessibilityRole="alert" style={{ color: C.exito, fontWeight: '700' }}>
          {aviso}
        </Text>
      ) : null}
      {lista.map((p) => (
        <Tarjeta key={p.id}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontWeight: '700', color: C.secundario }}>
              {diaYHora(p.programadoPara, idioma)}
            </Text>
            {p.rutina || p.menor ? (
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}
                testID={`programado-etiquetas-${p.id}`}
              >
                {p.rutina ? (
                  <Etiqueta texto={`${tf.viajeFijo}: ${p.rutina.nombre}`} icono="repeat-outline" />
                ) : null}
                {p.menor ? <Etiqueta texto={tf.menor(p.menor)} icono="happy-outline" /> : null}
              </View>
            ) : null}
            <Text style={{ color: '#666B73' }} numberOfLines={1}>
              {p.origen} → {p.destino}
            </Text>
            <Text style={{ color: C.secundario }}>
              {t.precioReservado}: {formatearMonto(p.total, p.moneda, idioma)}
            </Text>
            <Text style={{ color: '#666B73' }}>
              {t.cancelaGratis} {horaCorta(p.cancelacionGratisHasta, idioma)}
            </Text>
            <Boton
              texto={confirmar === p.id ? t.confirmarCancelar : t.cancelarReserva}
              alTocar={() => void cancelar(p)}
              secundario
            />
          </View>
        </Tarjeta>
      ))}
    </View>
  );
}

/** Control de dos (o más) partes del borrador: la elegida en rojo con letra blanca. */
export function Segmentos<K extends string>({
  opciones,
  activa,
  cambiar,
  etiqueta,
  testID,
}: {
  opciones: { clave: K; texto: string }[];
  activa: K;
  cambiar: (k: K) => void;
  etiqueta?: string;
  testID?: string;
}) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={etiqueta}
      testID={testID}
      style={{ flexDirection: 'row', backgroundColor: '#F6F6F6', borderRadius: 14, padding: 4 }}
    >
      {opciones.map((o) => {
        const si = o.clave === activa;
        return (
          <Pressable
            key={o.clave}
            onPress={() => cambiar(o.clave)}
            accessibilityRole="radio"
            accessibilityState={{ checked: si }}
            testID={testID ? `${testID}-${o.clave}` : undefined}
            style={{
              flex: 1,
              minHeight: 44,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: si ? C.primario : 'transparent',
              paddingHorizontal: 6,
            }}
          >
            {/* C-DESBORDES-360: a 360 px «Multipaquete (Flex)» no cabe en un renglón; baja entero al
                segundo (nunca cortado con «…» ni partido a la mitad de una palabra). */}
            <Text
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{
                fontWeight: '700',
                fontSize: 16,
                textAlign: 'center',
                color: si ? '#FFFFFF' : '#666B73',
              }}
            >
              {o.texto}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
