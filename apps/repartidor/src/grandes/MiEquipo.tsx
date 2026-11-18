import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { type Api, ErrorApi, type Idioma, enIdioma, formatearMonto } from '@tumbite/compartido';
import { Boton, C, Campo, CodigoQR, Text } from '@tumbite/movil';

/**
 * C-REFERIDOS-EQUIPOS (17 nov 2026): «Mi equipo e invitaciones» en Divoox Driver, como «Invita a
 * conductores» de Uber y DiDi. Su código, su enlace y su QR para invitar; a quién invitó y cuántas
 * carreras le faltan; y, si es líder de un equipo, el equipo con el mismo conteo que ve el superadmin.
 */
const T = {
  es: {
    titulo: 'Mi equipo e invitaciones',
    ayuda:
      'Invita a otros conductores con tu código o tu enlace. Cuando tu invitado completa sus carreras, ganas saldo.',
    codigo: 'Tu código',
    compartir: 'Compartir mi enlace',
    mensaje: (enlace: string, codigo: string) =>
      `Maneja con Divoox. Baja Divoox Driver y al registrarte escribe mi código ${codigo}: ${enlace}`,
    ganado: 'Ganado por invitar',
    invitados: 'Tus invitados',
    sinInvitados: 'Todavía no invitaste a nadie.',
    carreras: (n: number) => (n === 1 ? '1 carrera' : `${n} carreras`),
    estados: {
      pendiente: 'En camino',
      premiado: 'Ganaste tu premio',
      vencido: 'Se venció el plazo',
      rechazado: 'No cuenta',
    } as Record<string, string>,
    equipo: 'Tu equipo',
    registrados: 'Registrados',
    aprobados: 'Aprobados',
    activos: 'Activos (7 días)',
    carrerasEquipo: 'Carreras',
    miembros: 'Miembros',
    meInvitaron: '¿Te invitaron?',
    meInvitaronAyuda: 'Escribe el código de quien te invitó antes de tu primera carrera.',
    usar: 'Usar el código',
    listo: (n: string) => `Listo: quedaste registrado como invitado de ${n}.`,
    cargando: 'Cargando…',
    perteneces: 'Perteneces al equipo',
    lider: (n: string) => `Líder: ${n}`,
  },
  en: {
    titulo: 'My team and invitations',
    ayuda:
      'Invite other drivers with your code or link. When your invitee completes their trips, you earn balance.',
    codigo: 'Your code',
    compartir: 'Share my link',
    mensaje: (enlace: string, codigo: string) =>
      `Drive with Divoox. Get Divoox Driver and enter my code ${codigo} when you sign up: ${enlace}`,
    ganado: 'Earned by inviting',
    invitados: 'Your invitees',
    sinInvitados: 'You haven’t invited anyone yet.',
    carreras: (n: number) => (n === 1 ? '1 trip' : `${n} trips`),
    estados: {
      pendiente: 'In progress',
      premiado: 'You got your reward',
      vencido: 'Time ran out',
      rechazado: 'Doesn’t count',
    } as Record<string, string>,
    equipo: 'Your team',
    registrados: 'Signed up',
    aprobados: 'Approved',
    activos: 'Active (7 days)',
    carrerasEquipo: 'Trips',
    miembros: 'Members',
    meInvitaron: 'Were you invited?',
    meInvitaronAyuda: 'Enter the code of who invited you before your first trip.',
    usar: 'Use the code',
    listo: (n: string) => `Done: you’re signed up as ${n}’s invitee.`,
    cargando: 'Loading…',
    perteneces: 'You’re on the team',
    lider: (n: string) => `Leader: ${n}`,
  },
};

type Datos = {
  /** Robot (18 nov 2026): el equipo al que pertenece (si entró con el código de un equipo). */
  miEquipo?: { nombre: string; lider: string } | null;
  /** Ya quedó registrado como invitado: no se le vuelve a pedir el código. */
  yaInvitado?: boolean;
  codigo: string;
  enlace: string;
  ganado: number;
  invitados: { nombre: string; estado: string; carreras: number; desde: string }[];
  equipo: {
    nombre: string;
    codigo: string;
    enlace: string;
    registrados: number;
    aprobados: number;
    activos: number;
    carreras: number;
    miembros: { id: string; nombre: string; desde: string; carreras: number; aprobado: boolean }[];
  } | null;
};

const estiloTarjeta = {
  borderWidth: 1,
  borderColor: '#2a2a2a',
  borderRadius: 12,
  padding: 12,
  gap: 8,
  backgroundColor: '#fff',
} as const;

export function MiEquipo({
  api,
  idioma,
  moneda = 'USD',
}: {
  api: Api;
  idioma: Idioma;
  moneda?: string;
}) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [codigoInvito, setCodigoInvito] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let vivo = true;
    api
      .pedir<Datos>('GET', '/datos/repartidor/invitaciones')
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((x: unknown) => {
        if (vivo) setError(x instanceof ErrorApi ? x.message : String(x));
      });
    return () => {
      vivo = false;
    };
  }, [api]);
  async function usar() {
    setError('');
    try {
      const r = await api.pedir<{ nombre: string }>('POST', '/datos/repartidor/invitacion', {
        codigo: codigoInvito.trim().toUpperCase(),
      });
      setMensaje(t.listo(r.nombre));
      setCodigoInvito('');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  if (!datos)
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: error ? C.primario : '#666B73' }}>{error || t.cargando}</Text>
      </View>
    );
  const cifra = (etiqueta: string, n: number) => (
    <View style={{ flex: 1, minWidth: 120, ...estiloTarjeta }}>
      <Text style={{ color: '#666B73', fontSize: 12 }}>{etiqueta}</Text>
      <Text style={{ fontSize: 22, fontWeight: '800', color: C.secundario }}>{n}</Text>
    </View>
  );
  return (
    <View style={{ padding: 16, gap: 12 }} testID="mi-equipo">
      <Text style={{ fontSize: 22, fontWeight: '800', color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#666B73' }}>{t.ayuda}</Text>
      {datos.miEquipo ? (
        <View style={estiloTarjeta} testID="mi-equipo-miembro">
          <Text style={{ color: '#666B73' }}>{t.perteneces}</Text>
          <Text style={{ fontWeight: '800', fontSize: 18, color: C.secundario }}>
            {datos.miEquipo.nombre}
          </Text>
          {datos.miEquipo.lider ? (
            <Text style={{ color: '#666B73' }}>{t.lider(datos.miEquipo.lider)}</Text>
          ) : null}
        </View>
      ) : null}
      {datos.equipo ? (
        <View style={estiloTarjeta} testID="mi-equipo-lider">
          <Text style={{ fontWeight: '800', color: C.secundario }}>
            {t.equipo}: {datos.equipo.nombre}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {cifra(t.registrados, datos.equipo.registrados)}
            {cifra(t.aprobados, datos.equipo.aprobados)}
            {cifra(t.activos, datos.equipo.activos)}
            {cifra(t.carrerasEquipo, datos.equipo.carreras)}
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <CodigoQR texto={datos.equipo.enlace} numero={datos.equipo.codigo} tamano={180} />
          </View>
          <Boton
            texto={t.compartir}
            alTocar={() =>
              void Share.share({ message: t.mensaje(datos.equipo!.enlace, datos.equipo!.codigo) })
            }
          />
          <Text style={{ fontWeight: '800', color: C.secundario }}>{t.miembros}</Text>
          {datos.equipo.miembros.map((m) => (
            <View
              key={m.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
            >
              <Text style={{ color: C.secundario, flex: 1 }}>{m.nombre}</Text>
              <Text style={{ color: '#666B73' }}>{t.carreras(m.carreras)}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={[estiloTarjeta, { alignItems: 'center' }]} testID="mi-codigo">
          <Text style={{ color: '#666B73' }}>{t.codigo}</Text>
          <CodigoQR texto={datos.enlace} numero={datos.codigo} tamano={180} />
          <Boton
            texto={t.compartir}
            alTocar={() => void Share.share({ message: t.mensaje(datos.enlace, datos.codigo) })}
          />
        </View>
      )}
      <View style={estiloTarjeta}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: C.secundario }}>{t.ganado}</Text>
          <Text style={{ fontWeight: '800', color: C.exito }}>
            {formatearMonto(datos.ganado, moneda, idioma)}
          </Text>
        </View>
        <Text style={{ fontWeight: '800', color: C.secundario }}>{t.invitados}</Text>
        {datos.invitados.length === 0 ? (
          <Text style={{ color: '#666B73' }}>{t.sinInvitados}</Text>
        ) : null}
        {datos.invitados.map((i, k) => (
          <View
            key={`${i.nombre}-${k}`}
            style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
          >
            <Text style={{ color: C.secundario, flex: 1 }}>{i.nombre}</Text>
            <Text style={{ color: i.estado === 'premiado' ? C.exito : '#666B73' }}>
              {new Map(Object.entries(t.estados)).get(i.estado) ?? i.estado} ·{' '}
              {t.carreras(i.carreras)}
            </Text>
          </View>
        ))}
      </View>
      {datos.yaInvitado ? null : (
        <View style={estiloTarjeta}>
          <Text style={{ fontWeight: '800', color: C.secundario }}>{t.meInvitaron}</Text>
          <Text style={{ color: '#666B73', fontSize: 12 }}>{t.meInvitaronAyuda}</Text>
          <Campo
            etiqueta={t.codigo}
            value={codigoInvito}
            onChangeText={(x) => setCodigoInvito(x.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Boton texto={t.usar} alTocar={() => void usar()} secundario />
          {mensaje ? <Text style={{ color: C.exito, fontWeight: '700' }}>{mensaje}</Text> : null}
          {error ? (
            <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
              {error}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}
