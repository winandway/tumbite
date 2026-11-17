import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { type Api, ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import {
  Boton,
  COLOR,
  ESPACIO,
  EstadoVacio,
  FilaLista,
  Icono,
  LETRA,
  Pildora,
  RADIO,
  SOMBRA,
  Text, Modal } from '@tumbite/movil';
import {
  type ClientesFijos as Datos,
  type RutinaConductor,
  type SalidaAgenda,
  agruparPorDia,
  puedeDecirNoPuedo,
} from './agendaFijos';

const T = {
  es: {
    titulo: 'Clientes fijos',
    ayuda:
      'Clientes que te eligieron de confianza: sus viajes te llegan primero a ti por 1 minuto. Te avisamos 30 minutos antes de cada viaje fijo; conéctate para recibirlo.',
    agenda: 'Próximos 7 días',
    agendaVacia: 'No tienes viajes fijos en los próximos 7 días.',
    vacio:
      'Todavía ningún cliente te eligió de confianza. Cuando un pasajero lo haga al terminar un viaje contigo, aparecerá aquí.',
    hoy: 'Hoy',
    manana: 'Mañana',
    ida: 'Ida',
    vuelta: 'Vuelta',
    menor: (n: string) => `Menor: ${n}`,
    pagos: { efectivo: 'Efectivo', tarjeta: 'Tarjeta', pago_movil: 'Pago móvil' } as Record<
      string,
      string
    >,
    servicios: { moto: 'Moto', carro: 'Carro', envios: 'Envío' } as Record<string, string>,
    noPuedo: 'No puedo',
    noPuedoMarcado: 'Avisaste que no puedes: va a otro conductor',
    confirmarNoPuedo: '¿Seguro que no puedes ir?',
    confirmarNoPuedoAyuda:
      'El viaje pasa a otros conductores y le avisamos al cliente. Usa esto solo si de verdad no llegas.',
    siNoPuedo: 'Sí, no puedo',
    cancelar: 'Cancelar',
    noPuedoOk: 'Listo: le avisamos al cliente y el viaje pasa a otros conductores.',
    misFijos: 'Tus viajes fijos',
    clientes: 'Tus clientes de confianza',
    fijosDe: (n: number) => (n === 1 ? '1 viaje fijo' : `${n} viajes fijos`),
    pausado: 'En pausa',
    masOpciones: (n: string) => `Más opciones del viaje fijo de ${n}`,
    dejar: 'Dejar este viaje fijo',
    confirmarDejar: (n: string) => `¿Dejar el viaje fijo de ${n}?`,
    confirmarDejarAyuda:
      'Desde ahora sus salidas van a cualquier conductor y le avisamos. Sigues siendo su conductor de confianza para los viajes que pida.',
    siDejar: 'Sí, dejarlo',
    dejadoOk: 'Dejaste ese viaje fijo. Le avisamos al cliente.',
    cerrar: 'Cerrar',
    dias: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'],
  },
  en: {
    titulo: 'Regular riders',
    ayuda:
      'Riders who picked you as their trusted driver: their rides come to you first for 1 minute. We remind you 30 minutes before each regular ride; go online to get it.',
    agenda: 'Next 7 days',
    agendaVacia: 'You don’t have regular rides in the next 7 days.',
    vacio:
      'No rider has picked you as their trusted driver yet. When a rider does it after a ride with you, they’ll show up here.',
    hoy: 'Today',
    manana: 'Tomorrow',
    ida: 'There',
    vuelta: 'Back',
    menor: (n: string) => `Minor: ${n}`,
    pagos: { efectivo: 'Cash', tarjeta: 'Card', pago_movil: 'Mobile payment' } as Record<
      string,
      string
    >,
    servicios: { moto: 'Moto', carro: 'Car', envios: 'Delivery' } as Record<string, string>,
    noPuedo: 'Can’t make it',
    noPuedoMarcado: 'You said you can’t make it: it goes to another driver',
    confirmarNoPuedo: 'Are you sure you can’t make it?',
    confirmarNoPuedoAyuda:
      'The ride goes to other drivers and we let the rider know. Use this only if you really can’t get there.',
    siNoPuedo: 'Yes, I can’t make it',
    cancelar: 'Cancel',
    noPuedoOk: 'Done: we let the rider know and the ride goes to other drivers.',
    misFijos: 'Your regular rides',
    clientes: 'Your trusted riders',
    fijosDe: (n: number) => (n === 1 ? '1 regular ride' : `${n} regular rides`),
    pausado: 'Paused',
    masOpciones: (n: string) => `More options for ${n}’s regular ride`,
    dejar: 'Leave this regular ride',
    confirmarDejar: (n: string) => `Leave ${n}’s regular ride?`,
    confirmarDejarAyuda:
      'From now on its trips go to any driver and we let the rider know. You’re still their trusted driver for rides they request.',
    siDejar: 'Yes, leave it',
    dejadoOk: 'You left that regular ride. We let the rider know.',
    cerrar: 'Close',
    dias: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  },
};

const de = (m: Record<string, string>, k: string) => new Map(Object.entries(m)).get(k) ?? k;

function hora(s: { hora: string; zonaHoraria: string }, idioma: Idioma) {
  try {
    return new Intl.DateTimeFormat(idioma === 'en' ? 'en-US' : 'es', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: s.zonaHoraria,
    }).format(new Date(s.hora));
  } catch {
    return s.hora.slice(11, 16);
  }
}

function tituloDia(
  fecha: string,
  hoy: string,
  manana: string,
  idioma: Idioma,
  t: (typeof T)['es'],
) {
  if (fecha === hoy) return t.hoy;
  if (fecha === manana) return t.manana;
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).toLocaleDateString(
    idioma === 'en' ? 'en-US' : 'es',
    { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' },
  );
}

function Hoja({
  abierta,
  alCerrar,
  etiqueta,
  children,
  testID,
}: {
  abierta: boolean;
  alCerrar: () => void;
  etiqueta: string;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Modal visible={abierta} transparent animationType="fade" onRequestClose={alCerrar}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(16,16,16,0.45)' }}
        onPress={alCerrar}
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
      />
      <View
        testID={testID}
        style={[
          {
            backgroundColor: COLOR.fondo,
            borderTopLeftRadius: RADIO.hoja,
            borderTopRightRadius: RADIO.hoja,
            paddingVertical: ESPACIO.s,
            paddingBottom: ESPACIO.xxxl,
            width: '100%',
            maxWidth: 640,
            alignSelf: 'center',
          },
          SOMBRA.flotante,
        ]}
      >
        {children}
      </View>
    </Modal>
  );
}

function FilaSalida({
  s,
  idioma,
  alNoPuedo,
}: {
  s: SalidaAgenda;
  idioma: Idioma;
  alNoPuedo: (() => void) | null;
}) {
  const t = enIdioma(T, idioma);
  return (
    <View
      testID={`agenda-${s.rutinaId}-${s.fecha}-${s.sentido}`}
      style={{
        flexDirection: 'row',
        gap: ESPACIO.m,
        paddingVertical: ESPACIO.m,
        borderTopWidth: 1,
        borderTopColor: COLOR.borde,
      }}
    >
      <View style={{ width: 76 }}>
        <Text style={[LETRA.cuerpoFuerte, { color: COLOR.texto }]}>{hora(s, idioma)}</Text>
        <Text style={[LETRA.pequeno]}>{s.sentido === 'vuelta' ? t.vuelta : t.ida}</Text>
      </View>
      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
        <Text style={[LETRA.tarjeta, { color: COLOR.texto }]} numberOfLines={1}>
          {s.menor ? t.menor(s.menor) : s.cliente}
        </Text>
        <Text style={LETRA.secundario} numberOfLines={2}>
          {s.origen} → {s.destino}
        </Text>
        <Text style={LETRA.pequeno}>
          {de(t.servicios, s.servicio)} · {de(t.pagos, s.metodoPago)}
        </Text>
        {s.noPuedo ? (
          <Text style={[LETRA.pequeno, { color: COLOR.aviso, fontWeight: '700' }]}>
            {t.noPuedoMarcado}
          </Text>
        ) : null}
      </View>
      {alNoPuedo ? (
        <Pressable
          onPress={alNoPuedo}
          accessibilityRole="button"
          accessibilityLabel={t.noPuedo}
          testID={`no-puedo-${s.rutinaId}-${s.fecha}-${s.sentido}`}
          style={({ pressed }) => ({
            alignSelf: 'center',
            minHeight: 44,
            paddingHorizontal: ESPACIO.m,
            borderRadius: RADIO.m,
            borderWidth: 1.5,
            borderColor: COLOR.bordeFuerte,
            justifyContent: 'center',
            backgroundColor: pressed ? COLOR.superficie : COLOR.fondo,
          })}
        >
          <Text style={[LETRA.secundario, { color: COLOR.texto, fontWeight: '700' }]}>
            {t.noPuedo}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * C-CONDUCTOR-CONFIANZA y C-VIAJES-FIJOS (16 nov 2026) — todos los países. «Clientes fijos» del
 * conductor: la agenda de los próximos 7 días por día (hora, cliente o menor, de dónde a dónde y
 * cómo paga), «No puedo» en las de hoy y mañana (con confirmación), sus viajes fijos con «Dejar este
 * viaje fijo» en los tres puntos, y sus clientes de confianza.
 */
export function ClientesFijos({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [noPuedo, setNoPuedo] = useState<SalidaAgenda | null>(null);
  const [menu, setMenu] = useState<RutinaConductor | null>(null);
  const [dejar, setDejar] = useState<RutinaConductor | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    let vivo = true;
    api
      .pedir<Datos>('GET', '/datos/conductor/clientes-fijos')
      .then((r) => vivo && setDatos(r))
      .catch((x: unknown) => vivo && setError(x instanceof ErrorApi ? x.message : String(x)));
    return () => {
      vivo = false;
    };
  }, [api, vuelta]);

  async function hacer(ruta: string, cuerpo: unknown, aviso: string) {
    setTrabajando(true);
    setError('');
    setOk('');
    try {
      await api.pedir('POST', ruta, cuerpo);
      setOk(aviso);
      setVuelta((n) => n + 1);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setNoPuedo(null);
      setDejar(null);
      setTrabajando(false);
    }
  }

  const ahora = new Date();
  const tz = datos?.agenda[0]?.zonaHoraria ?? 'UTC';
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(ahora);
  const manana = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(
    new Date(ahora.getTime() + 86_400_000),
  );
  const sinNada = datos && !datos.clientes.length && !datos.rutinas.length;

  return (
    <View style={{ padding: 16, gap: ESPACIO.l }} testID="clientes-fijos">
      <Text style={[LETRA.titulo, { color: COLOR.texto }]} accessibilityRole="header">
        {t.titulo}
      </Text>
      <Text style={LETRA.secundario}>{t.ayuda}</Text>
      {error ? (
        <Text accessibilityRole="alert" style={[LETRA.secundario, { color: COLOR.error }]}>
          {error}
        </Text>
      ) : null}
      {ok ? (
        <Text style={[LETRA.secundario, { color: COLOR.exito, fontWeight: '700' }]}>{ok}</Text>
      ) : null}
      {sinNada ? <EstadoVacio icono="people-outline" titulo={t.titulo} texto={t.vacio} /> : null}

      {datos && !sinNada ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: COLOR.borde,
            borderRadius: RADIO.l,
            padding: ESPACIO.l,
            backgroundColor: COLOR.fondo,
            gap: ESPACIO.s,
          }}
        >
          <Text style={[LETRA.subtitulo, { color: COLOR.texto }]}>{t.agenda}</Text>
          {datos.agenda.length === 0 ? <Text style={LETRA.secundario}>{t.agendaVacia}</Text> : null}
          {agruparPorDia(datos.agenda).map((d) => (
            <View key={d.fecha}>
              <Text
                style={[
                  LETRA.cuerpoFuerte,
                  { color: COLOR.textoSuave, marginTop: ESPACIO.s, textTransform: 'capitalize' },
                ]}
              >
                {tituloDia(d.fecha, hoy, manana, idioma, t)}
              </Text>
              {d.salidas.map((s) => (
                <FilaSalida
                  key={`${s.rutinaId}-${s.sentido}`}
                  s={s}
                  idioma={idioma}
                  alNoPuedo={puedeDecirNoPuedo(s, ahora) ? () => setNoPuedo(s) : null}
                />
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {datos?.rutinas.length ? (
        <View style={{ gap: ESPACIO.s }}>
          <Text style={[LETRA.subtitulo, { color: COLOR.texto }]}>{t.misFijos}</Text>
          {datos.rutinas.map((r) => (
            <View
              key={r.id}
              testID={`rutina-${r.id}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: ESPACIO.m,
                borderWidth: 1,
                borderColor: COLOR.borde,
                borderRadius: RADIO.l,
                padding: ESPACIO.l,
                backgroundColor: COLOR.fondo,
              }}
            >
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Text style={[LETRA.tarjeta, { color: COLOR.texto }]} numberOfLines={1}>
                  {r.menor ? `${r.cliente} · ${t.menor(r.menor)}` : r.cliente}
                </Text>
                <Text style={LETRA.secundario}>
                  {r.dias.map((x) => t.dias.at(x - 1)).join(', ')} · {r.horaIda}
                  {r.horaVuelta ? ` / ${r.horaVuelta}` : ''}
                </Text>
                <Text style={LETRA.pequeno} numberOfLines={1}>
                  {r.origen} → {r.destino}
                </Text>
                {r.estado === 'pausada' ? (
                  <View style={{ flexDirection: 'row' }}>
                    <Pildora tono="aviso" texto={t.pausado} icono="pause-circle-outline" />
                  </View>
                ) : null}
              </View>
              <Pressable
                onPress={() => setMenu(r)}
                accessibilityRole="button"
                accessibilityLabel={t.masOpciones(r.cliente)}
                testID={`rutina-opciones-${r.id}`}
                hitSlop={8}
                style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icono nombre="ellipsis-vertical" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {datos?.clientes.length ? (
        <View style={{ gap: ESPACIO.s }}>
          <Text style={[LETRA.subtitulo, { color: COLOR.texto }]}>{t.clientes}</Text>
          <View
            style={{
              borderWidth: 1,
              borderColor: COLOR.borde,
              borderRadius: RADIO.l,
              backgroundColor: COLOR.fondo,
              overflow: 'hidden',
            }}
          >
            {datos.clientes.map((c, i) => (
              <FilaLista
                key={`${c.nombre}-${c.desde}`}
                titulo={c.nombre}
                detalle={c.fijos ? t.fijosDe(c.fijos) : undefined}
                icono="person-outline"
                ultima={i === datos.clientes.length - 1}
              />
            ))}
          </View>
        </View>
      ) : null}

      <Hoja
        abierta={noPuedo != null}
        alCerrar={() => setNoPuedo(null)}
        etiqueta={t.cancelar}
        testID="confirmar-no-puedo"
      >
        <View style={{ padding: ESPACIO.xl, gap: ESPACIO.m }}>
          <Text style={[LETRA.subtitulo, { color: COLOR.texto }]}>{t.confirmarNoPuedo}</Text>
          {noPuedo ? (
            <Text style={[LETRA.cuerpoFuerte, { color: COLOR.texto }]}>
              {hora(noPuedo, idioma)} · {noPuedo.menor ? t.menor(noPuedo.menor) : noPuedo.cliente}
            </Text>
          ) : null}
          <Text style={LETRA.secundario}>{t.confirmarNoPuedoAyuda}</Text>
          <Boton
            texto={t.siNoPuedo}
            cargando={trabajando}
            alTocar={() =>
              noPuedo &&
              void hacer(
                `/datos/conductor/rutinas/${noPuedo.rutinaId}/no-puedo`,
                { fecha: noPuedo.fecha, sentido: noPuedo.sentido },
                t.noPuedoOk,
              )
            }
            testID="si-no-puedo"
          />
          <Boton tipo="borde" texto={t.cancelar} alTocar={() => setNoPuedo(null)} />
        </View>
      </Hoja>

      <Hoja
        abierta={menu != null}
        alCerrar={() => setMenu(null)}
        etiqueta={t.cerrar}
        testID="rutina-menu"
      >
        <FilaLista
          titulo={t.dejar}
          icono="exit-outline"
          peligro
          alTocar={() => {
            setDejar(menu);
            setMenu(null);
          }}
          testID="rutina-dejar"
        />
        <FilaLista titulo={t.cerrar} icono="close" alTocar={() => setMenu(null)} ultima />
      </Hoja>

      <Hoja
        abierta={dejar != null}
        alCerrar={() => setDejar(null)}
        etiqueta={t.cancelar}
        testID="confirmar-dejar"
      >
        <View style={{ padding: ESPACIO.xl, gap: ESPACIO.m }}>
          <Text style={[LETRA.subtitulo, { color: COLOR.texto }]}>
            {dejar ? t.confirmarDejar(dejar.cliente) : ''}
          </Text>
          <Text style={LETRA.secundario}>{t.confirmarDejarAyuda}</Text>
          <Boton
            texto={t.siDejar}
            cargando={trabajando}
            alTocar={() =>
              dejar && void hacer(`/datos/conductor/rutinas/${dejar.id}/dejar`, {}, t.dejadoOk)
            }
            testID="si-dejar"
          />
          <Boton tipo="borde" texto={t.cancelar} alTocar={() => setDejar(null)} />
        </View>
      </Hoja>
    </View>
  );
}
