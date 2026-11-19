import { useEffect, useState } from 'react';
import { Share, View } from 'react-native';
import { type Api, ErrorApi, type Idioma, enIdioma, useBorrador } from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  C,
  Campo,
  CodigoQR,
  MenuTresPuntos,
  Text,
  alSalirTelefono,
  almacenTelefono,
  useSesion,
} from '@tumbite/movil';

/**
 * C-LINEAS-TAXI (19 nov 2026): «Mi línea» en Divoox Driver. Sin línea: pedir entrada con el código o
 * eligiendo la línea de la lista de su ciudad (buscador; nunca texto libre). Con solicitud pendiente: espera
 * al líder. Miembro: su línea y su líder. Líder: código, compartir, QR, solicitudes (aceptar o rechazar con un
 * toque) y «Mi equipo»; sacar a un conductor va dentro de los tres puntos. Aparte de los referidos.
 */
const T = {
  es: {
    titulo: 'Mi línea',
    ayuda:
      'Una línea es tu grupo de taxis o mototaxis. Tu líder acepta tu solicitud y, si pides ayuda, le llega tu ubicación.',
    cargando: 'Cargando…',
    entrar: 'Entrar a una línea',
    codigo: 'Código de la línea',
    pedir: 'Pedir entrada',
    pedida: (n: string) => `Pediste entrar a ${n}. Tu líder te acepta con un toque.`,
    elegir: 'O elige tu línea',
    buscar: 'Buscar tu línea',
    sinLineas: 'No hay líneas en tu ciudad todavía.',
    lider: (n: string) => `Líder: ${n}`,
    miembros: (n: number) => (n === 1 ? '1 miembro' : `${n} miembros`),
    pendiente: 'Esperando que el líder te acepte',
    estas: 'Estás en la línea',
    emergencia:
      'Si tocas el botón de emergencia, tu líder y su segundo contacto reciben tu ubicación.',
    codigoLinea: 'Código de tu línea',
    compartir: 'Compartir el enlace de mi línea',
    mensaje: (enlace: string, codigo: string) =>
      `Únete a mi línea en Divoox. Baja Divoox Driver y al registrarte escribe el código ${codigo}: ${enlace}`,
    solicitudes: 'Solicitudes',
    sinSolicitudes: 'No hay solicitudes pendientes.',
    aceptar: 'Aceptar',
    rechazar: 'Rechazar',
    equipo: 'Mi equipo',
    sinEquipo: 'Todavía no hay conductores en tu línea.',
    aprobado: 'Aprobado',
    activo: 'Activo',
    opciones: (n: string) => `Opciones de ${n}`,
    sacar: 'Sacar de la línea',
    seguro: (n: string) => `¿Sacar a ${n} de tu línea?`,
    si: 'Sí, sacar',
    no: 'No',
    tipos: { taxi: 'Taxi', mototaxi: 'Mototaxi', ambos: 'Taxi y mototaxi' } as Record<
      string,
      string
    >,
  },
  en: {
    titulo: 'My line',
    ayuda:
      'A line is your group of taxis or mototaxis. Your leader accepts your request and, if you ask for help, gets your location.',
    cargando: 'Loading…',
    entrar: 'Join a line',
    codigo: 'Line code',
    pedir: 'Ask to join',
    pedida: (n: string) => `You asked to join ${n}. Your leader accepts you with one tap.`,
    elegir: 'Or choose your line',
    buscar: 'Search for your line',
    sinLineas: 'There are no lines in your city yet.',
    lider: (n: string) => `Leader: ${n}`,
    miembros: (n: number) => (n === 1 ? '1 member' : `${n} members`),
    pendiente: 'Waiting for the leader to accept you',
    estas: 'You are in the line',
    emergencia:
      'If you tap the emergency button, your leader and their second contact get your location.',
    codigoLinea: 'Your line’s code',
    compartir: 'Share my line’s link',
    mensaje: (enlace: string, codigo: string) =>
      `Join my line on Divoox. Get Divoox Driver and enter the code ${codigo} when you sign up: ${enlace}`,
    solicitudes: 'Requests',
    sinSolicitudes: 'There are no pending requests.',
    aceptar: 'Accept',
    rechazar: 'Decline',
    equipo: 'My team',
    sinEquipo: 'There are no drivers in your line yet.',
    aprobado: 'Approved',
    activo: 'Active',
    opciones: (n: string) => `Options for ${n}`,
    sacar: 'Remove from the line',
    seguro: (n: string) => `Remove ${n} from your line?`,
    si: 'Yes, remove',
    no: 'No',
    tipos: { taxi: 'Taxi', mototaxi: 'Mototaxi', ambos: 'Taxi and mototaxi' } as Record<
      string,
      string
    >,
  },
};

type Vista =
  | { linea: null }
  | {
      linea:
        | {
            rol: 'pendiente' | 'miembro';
            id: string;
            nombre: string;
            tipo: string;
            ciudad: string;
            lider?: string;
          }
        | {
            rol: 'lider';
            id: string;
            nombre: string;
            tipo: string;
            ciudad: string;
            codigo: string;
            enlace: string;
            solicitudes: { id: string; nombre: string; telefono: string; desde: string }[];
            miembros: { id: string; nombre: string; aprobado: boolean; activo: boolean }[];
          };
    };
type Opcion = { id: string; nombre: string; tipo: string; lider: string; miembros: number };

const tarjeta = {
  borderWidth: 1,
  borderColor: '#2a2a2a',
  borderRadius: 12,
  padding: 12,
  gap: 8,
  backgroundColor: '#fff',
} as const;

export function MiLinea({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const { usuario } = useSesion();
  const [datos, setDatos] = useState<Vista | null>(null);
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const [buscar, setBuscar] = useState('');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [confirmar, setConfirmar] = useState<{ id: string; nombre: string } | null>(null);
  const b = useBorrador({
    formulario: 'driver-mi-linea',
    cuenta: usuario?.id,
    inicial: { codigo: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const [vuelta, setVuelta] = useState(0);
  const cargar = () => {
    setVuelta((n) => n + 1);
  };
  useEffect(() => {
    let vivo = true;
    api
      .pedir<Vista>('GET', '/datos/repartidor/mi-linea')
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((x: unknown) => {
        if (vivo) setError(x instanceof ErrorApi ? x.message : String(x));
      });
    return () => {
      vivo = false;
    };
  }, [api, vuelta]);
  const sinLinea = datos !== null && datos.linea === null;
  useEffect(() => {
    if (!sinLinea) return;
    let vivo = true;
    const espera = setTimeout(() => {
      api
        .pedir<{ lineas: Opcion[] }>(
          'GET',
          `/datos/repartidor/lineas?q=${encodeURIComponent(buscar)}`,
        )
        .then((r) => vivo && setOpciones(r.lineas))
        .catch(() => undefined);
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [api, sinLinea, buscar]);

  async function pedir(cuerpo: { codigo?: string; lineaId?: string }) {
    setError('');
    try {
      const r = await api.pedir<{ linea: string }>('POST', '/datos/repartidor/linea/pedir', cuerpo);
      await b.limpiar();
      setAviso(t.pedida(r.linea));
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  async function resolver(id: string, aceptar: boolean) {
    setError('');
    try {
      await api.pedir('POST', `/datos/repartidor/linea/solicitudes/${id}`, { aceptar });
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  async function sacar(id: string) {
    setError('');
    try {
      await api.pedir('POST', `/datos/repartidor/linea/miembros/${id}/sacar`, {});
      setConfirmar(null);
      cargar();
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
  const l = datos.linea;
  const mensajeError = error ? (
    <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
      {error}
    </Text>
  ) : null;
  return (
    <View style={{ padding: 16, gap: 12 }} testID="mi-linea">
      <Text style={{ fontSize: 22, fontWeight: '800', color: C.secundario }}>{t.titulo}</Text>
      <Text style={{ color: '#666B73' }}>{t.ayuda}</Text>
      {aviso ? <Text style={{ color: C.exito, fontWeight: '700' }}>{aviso}</Text> : null}

      {l === null ? (
        <View style={{ gap: 12 }}>
          <View style={tarjeta} testID="linea-entrar">
            <Text style={{ fontWeight: '800', color: C.secundario }}>{t.entrar}</Text>
            <AvisoBorrador
              visible={b.recuperado}
              idioma={idioma}
              empezar={() => void b.empezarDeNuevo()}
            />
            <Campo
              etiqueta={t.codigo}
              value={b.valores.codigo}
              onChangeText={(x) => b.cambiar('codigo', x.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <Boton
              texto={t.pedir}
              alTocar={() => void pedir({ codigo: b.valores.codigo.trim().toUpperCase() })}
            />
          </View>
          <View style={tarjeta} testID="linea-lista">
            <Text style={{ fontWeight: '800', color: C.secundario }}>{t.elegir}</Text>
            <Campo
              etiqueta={t.buscar}
              value={buscar}
              onChangeText={setBuscar}
              autoCorrect={false}
            />
            {opciones.length === 0 ? <Text style={{ color: '#666B73' }}>{t.sinLineas}</Text> : null}
            {opciones.map((o) => (
              <View key={o.id} style={{ gap: 4 }}>
                <Text style={{ fontWeight: '700', color: C.secundario }}>{o.nombre}</Text>
                <Text style={{ color: '#666B73' }}>
                  {t.tipos[o.tipo] ?? o.tipo} · {t.lider(o.lider)} · {t.miembros(o.miembros)}
                </Text>
                <Boton texto={t.pedir} alTocar={() => void pedir({ lineaId: o.id })} secundario />
              </View>
            ))}
          </View>
          {mensajeError}
        </View>
      ) : l.rol === 'lider' ? (
        <View style={{ gap: 12 }} testID="linea-lider">
          <View style={[tarjeta, { alignItems: 'center' }]}>
            <Text style={{ fontWeight: '800', fontSize: 18, color: C.secundario }}>{l.nombre}</Text>
            <Text style={{ color: '#666B73' }}>
              {t.tipos[l.tipo] ?? l.tipo} · {l.ciudad}
            </Text>
            <Text style={{ color: '#666B73' }}>{t.codigoLinea}</Text>
            <CodigoQR texto={l.enlace} numero={l.codigo} tamano={180} />
            <Boton
              texto={t.compartir}
              alTocar={() => void Share.share({ message: t.mensaje(l.enlace, l.codigo) })}
            />
          </View>
          <View style={tarjeta} testID="linea-solicitudes">
            <Text style={{ fontWeight: '800', color: C.secundario }}>{t.solicitudes}</Text>
            {l.solicitudes.length === 0 ? (
              <Text style={{ color: '#666B73' }}>{t.sinSolicitudes}</Text>
            ) : null}
            {l.solicitudes.map((s) => (
              <View key={s.id} style={{ gap: 6 }}>
                <Text style={{ fontWeight: '700', color: C.secundario }}>{s.nombre}</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Boton texto={t.aceptar} alTocar={() => void resolver(s.id, true)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Boton
                      texto={t.rechazar}
                      alTocar={() => void resolver(s.id, false)}
                      secundario
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
          <View style={tarjeta} testID="linea-equipo">
            <Text style={{ fontWeight: '800', color: C.secundario }}>
              {t.equipo} · {t.miembros(l.miembros.length)}
            </Text>
            {l.miembros.length === 0 ? (
              <Text style={{ color: '#666B73' }}>{t.sinEquipo}</Text>
            ) : null}
            {l.miembros.map((m) => (
              <View key={m.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.secundario, fontWeight: '700' }}>{m.nombre}</Text>
                    <Text style={{ color: m.activo ? C.exito : '#666B73' }}>
                      {m.aprobado ? t.aprobado : ''}
                      {m.aprobado && m.activo ? ' · ' : ''}
                      {m.activo ? t.activo : ''}
                    </Text>
                  </View>
                  <MenuTresPuntos
                    etiqueta={t.opciones(m.nombre)}
                    testID={`linea-miembro-menu-${m.id}`}
                    opciones={[
                      {
                        texto: t.sacar,
                        alTocar: () => setConfirmar({ id: m.id, nombre: m.nombre }),
                        peligro: true,
                        testID: `linea-sacar-${m.id}`,
                      },
                    ]}
                  />
                </View>
                {confirmar?.id === m.id ? (
                  <View style={{ gap: 6 }}>
                    <Text style={{ color: C.secundario }}>{t.seguro(m.nombre)}</Text>
                    <Boton texto={t.si} alTocar={() => void sacar(m.id)} />
                    <Boton texto={t.no} alTocar={() => setConfirmar(null)} secundario />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
          {mensajeError}
        </View>
      ) : (
        <View style={tarjeta} testID={`linea-${l.rol}`}>
          <Text style={{ color: '#666B73' }}>{l.rol === 'pendiente' ? t.pendiente : t.estas}</Text>
          <Text style={{ fontWeight: '800', fontSize: 18, color: C.secundario }}>{l.nombre}</Text>
          <Text style={{ color: '#666B73' }}>
            {t.tipos[l.tipo] ?? l.tipo} · {l.ciudad}
            {l.lider ? ` · ${t.lider(l.lider)}` : ''}
          </Text>
          {l.rol === 'miembro' ? <Text style={{ color: '#666B73' }}>{t.emergencia}</Text> : null}
          {mensajeError}
        </View>
      )}
    </View>
  );
}
