import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, Text, View } from 'react-native';
import {
  type Api,
  ErrorApi,
  type Idioma,
  TURNO,
  deSqlUtc,
  enIdioma,
  inicioDelDia,
} from '@tumbite/compartido';
import { Boton, C, e } from '@tumbite/movil';

/**
 * C-TURNOS-REPARTIDOR (29 oct 2026), como el «Schedule» de DoorDash: reservas tus horas hasta 7
 * días adelante. Durante tu turno, conectado, recibes ofertas antes que los demás a igual
 * distancia. Si no te conectas en la primera media hora, el turno se pierde.
 */
type Turno = { id: string; inicio: string; fin: string; estado: string };

const T = {
  es: {
    titulo: 'Mis turnos',
    ayuda:
      'Reserva tus horas hasta 7 días adelante. Durante tu turno, conectado, recibes las ofertas antes que quien no tiene turno. Si no te conectas en la primera media hora, el turno se pierde.',
    nuevo: 'Reservar un turno',
    dia: 'Día',
    empieza: 'Empieza',
    dura: 'Dura',
    horas: (n: number) => `${n} h`,
    reservar: 'Reservar',
    reservado: 'Turno reservado.',
    vacio: 'Todavía no tienes turnos.',
    cancelar: 'Cancelar turno',
    seguro: '¿Cancelar este turno?',
    si: 'Sí, cancelar',
    no: 'No',
    estados: {
      programado: 'Reservado',
      activo: 'En curso',
      cumplido: 'Cumplido',
      perdido: 'Perdido',
      cancelado: 'Cancelado',
    } as Record<string, string>,
    hoy: 'Hoy',
    manana: 'Mañana',
  },
  en: {
    titulo: 'My shifts',
    ayuda:
      'Book your hours up to 7 days ahead. During your shift, while online, you get offers before drivers without a shift. If you don’t go online in the first half hour, the shift is lost.',
    nuevo: 'Book a shift',
    dia: 'Day',
    empieza: 'Starts',
    dura: 'Length',
    horas: (n: number) => `${n} h`,
    reservar: 'Book',
    reservado: 'Shift booked.',
    vacio: 'You don’t have shifts yet.',
    cancelar: 'Cancel shift',
    seguro: 'Cancel this shift?',
    si: 'Yes, cancel',
    no: 'No',
    estados: {
      programado: 'Booked',
      activo: 'In progress',
      cumplido: 'Done',
      perdido: 'Missed',
      cancelado: 'Canceled',
    } as Record<string, string>,
    hoy: 'Today',
    manana: 'Tomorrow',
  },
};

const DURACIONES = [1, 2, 3, 4, 6, 8];

function confirmar(mensaje: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(mensaje));
  return new Promise((r) =>
    Alert.alert('', mensaje, [
      { text: no, style: 'cancel', onPress: () => r(false) },
      { text: si, style: 'destructive', onPress: () => r(true) },
    ]),
  );
}

function Chip({ texto, activo, alTocar }: { texto: string; activo: boolean; alTocar: () => void }) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="radio"
      accessibilityState={{ checked: activo }}
      accessibilityLabel={texto}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: activo ? 2 : 1,
        borderColor: activo ? C.primario : '#DADADA',
        backgroundColor: '#fff',
      }}
    >
      <Text style={{ fontWeight: '700', color: activo ? C.primario : C.secundario }}>{texto}</Text>
    </Pressable>
  );
}

export function Turnos({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const loc = idioma === 'en' ? 'en-US' : 'es-US';
  const [lista, setLista] = useState<Turno[] | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [dia, setDia] = useState(0);
  const [inicio, setInicio] = useState<number | null>(null);
  const [horas, setHoras] = useState(4);
  // La hora se toma una vez al abrir la pantalla (no en cada dibujo).
  const [ahora] = useState(() => Date.now());
  const cargar = useCallback(() => {
    api
      .pedir<{ turnos: Turno[] }>('GET', '/datos/repartidor/turnos')
      .then((r) => setLista(r.turnos))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api]);
  useEffect(cargar, [cargar]);

  // Horas de inicio del día elegido, cada 30 minutos (hoy, desde la media hora en curso).
  const paso = TURNO.pasoMin * 60_000;
  // Por calendario, no sumando 24 horas (C-TURNOS-HORARIO: el cambio de hora repetía un día).
  const diaInicio = inicioDelDia(ahora, dia);
  const diaFin = inicioDelDia(ahora, dia + 1);
  const desde = Math.max(diaInicio, Math.floor(ahora / paso) * paso);
  const opciones: number[] = [];
  for (let x = desde; x < diaFin; x += paso) opciones.push(x);
  const hora = (ms: number) =>
    new Date(ms).toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' });
  const nombreDia = (n: number) =>
    n === 0
      ? t.hoy
      : n === 1
        ? t.manana
        : new Date(inicioDelDia(ahora, n)).toLocaleDateString(loc, {
            weekday: 'short',
            day: 'numeric',
          });

  async function reservar() {
    if (inicio == null) return;
    setError('');
    setOk('');
    try {
      await api.pedir('POST', '/datos/repartidor/turnos', {
        inicio: new Date(inicio).toISOString(),
        fin: new Date(inicio + horas * 3_600_000).toISOString(),
      });
      setOk(t.reservado);
      setInicio(null);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  async function cancelar(id: string) {
    if (!(await confirmar(t.seguro, t.si, t.no))) return;
    try {
      await api.pedir('DELETE', `/datos/repartidor/turnos/${id}`);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const proximos = (lista ?? []).filter((x) => x.estado === 'programado' || x.estado === 'activo');
  const pasados = (lista ?? []).filter((x) => !proximos.includes(x));
  const rango = (x: Turno) => {
    const a = deSqlUtc(x.inicio);
    const b = deSqlUtc(x.fin);
    return `${a.toLocaleDateString(loc, { weekday: 'short', day: 'numeric', month: 'short' })}, ${a.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })}–${b.toLocaleTimeString(loc, { hour: 'numeric', minute: '2-digit' })}`;
  };

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '900', color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#5E5E5E' }}>{t.ayuda}</Text>
      {error ? <Text style={e.error}>{error}</Text> : null}
      {ok ? <Text style={{ color: C.exito, fontWeight: '700' }}>{ok}</Text> : null}
      {lista && !lista.length ? <Text style={{ color: '#5E5E5E' }}>{t.vacio}</Text> : null}
      {[...proximos, ...pasados].map((x) => (
        <View key={x.id} style={[e.tarjeta, { gap: 4 }]}>
          <Text style={{ fontWeight: '800', color: C.secundario }}>{rango(x)}</Text>
          <Text
            style={{
              color:
                x.estado === 'perdido'
                  ? C.primario
                  : x.estado === 'cumplido' || x.estado === 'activo'
                    ? C.exito
                    : '#5E5E5E',
            }}
          >
            {t.estados[x.estado] ?? x.estado}
          </Text>
          {x.estado === 'programado' ? (
            <Text style={e.enlace} onPress={() => void cancelar(x.id)} accessibilityRole="button">
              {t.cancelar}
            </Text>
          ) : null}
        </View>
      ))}
      <View style={[e.tarjeta, { gap: 10 }]}>
        <Text style={{ fontWeight: '900', fontSize: 17, color: C.secundario }}>{t.nuevo}</Text>
        <Text style={{ color: '#5E5E5E' }}>{t.dia}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from({ length: TURNO.dias }, (_, n) => (
            <Chip
              key={n}
              texto={nombreDia(n)}
              activo={dia === n}
              alTocar={() => {
                setDia(n);
                setInicio(null);
              }}
            />
          ))}
        </View>
        <Text style={{ color: '#5E5E5E' }}>{t.empieza}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {opciones.map((ms) => (
            <Chip key={ms} texto={hora(ms)} activo={inicio === ms} alTocar={() => setInicio(ms)} />
          ))}
        </View>
        <Text style={{ color: '#5E5E5E' }}>{t.dura}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DURACIONES.map((h) => (
            <Chip key={h} texto={t.horas(h)} activo={horas === h} alTocar={() => setHoras(h)} />
          ))}
        </View>
        {inicio != null ? <Boton texto={t.reservar} alTocar={() => void reservar()} /> : null}
      </View>
    </View>
  );
}
