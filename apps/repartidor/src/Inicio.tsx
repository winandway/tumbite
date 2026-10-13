import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { ErrorApi, type Nivel, enIdioma, formatearDolares, nombrePlato } from '@tumbite/compartido';
import { BilleteraRepartidor, type DatosBilletera } from './Billetera';
import { MisDatos } from './MisDatos';
import { Verificacion } from './Verificacion';
import {
  Boton,
  C,
  MenuCuenta,
  Pantalla,
  ReportarProblema,
  TEXTOS_MOVIL,
  e,
  useSesion,
} from '@tumbite/movil';

type Lugar = {
  nombre: string;
  direccion: string;
  telefono: string;
  lat: number | null;
  lng: number | null;
};
type Pedido = {
  id: string;
  estado: string;
  direccion: string;
  notas: string;
  lat: number | null;
  lng: number | null;
  propina: number;
  pagoRepartidor: number;
  distanciaKm: number | null;
  restaurante: Lugar;
  segundos?: number;
  ofertaEn?: string;
  lineas: { platoId: string; nombreEs: string; nombreEn: string; cantidad: number }[];
};
type Estado = { conectado: boolean; puntos: number; nivel: Nivel; activo: Pedido | null };
type Billetera = DatosBilletera;

/** La ubicación con un tope de 15 segundos: si el GPS no responde, se usa la última conocida. */
async function ubicacionConLimite(): Promise<Location.LocationObject | null> {
  const tope = new Promise<null>((r) => setTimeout(() => r(null), 15000));
  const actual = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).catch(
    () => null,
  );
  const p = await Promise.race([actual, tope]);
  return p ?? (await Location.getLastKnownPositionAsync().catch(() => null));
}

const T = {
  es: {
    conectado: 'Conectado: recibiendo pedidos',
    desconectado: 'Desconectado',
    conectar: 'Conectarme',
    desconectar: 'Desconectarme',
    sinUbicacion: 'Para recibir pedidos necesitamos tu ubicación mientras usas la app.',
    buscandoUbicacion: 'Buscando tu ubicación…',
    ubicacionTarda:
      'No pudimos leer tu ubicación. Revisa que el GPS esté encendido y que el navegador tenga permiso, y vuelve a intentar.',
    buscando: 'Buscando pedidos cerca de ti…',
    oferta: 'Nueva oferta',
    ganas: 'Ganas',
    propinaIncluida: 'incluye propina de',
    aceptar: 'Aceptar',
    rechazar: 'No, gracias',
    sinCastigo: 'Rechazar no te baja de nivel.',
    recoger: 'Recoge en',
    entregar: 'Entrega en',
    comoLlegar: 'Cómo llegar',
    recogido: 'Ya lo recogí',
    entregado: 'Entregado',
    esperando: 'El restaurante lo está terminando…',
    nivel: 'Tu nivel',
    puntos: 'puntos',
    faltan: 'Te faltan',
    para: 'para',
    saldo: 'Tu saldo',
    menu: 'Menú',
    vistaInicio: 'Inicio',
    vistaBilletera: 'Mi billetera',
    vistaDatos: 'Mis datos y vehículo',
    verBilletera: 'Ver mi billetera y movimientos →',
    volverInicio: '← Volver al inicio',
    conectarBanco: 'Conectar mi cuenta bancaria',
    retirarPanel: 'Retirar todo',
    llamar: 'Llamar al restaurante',
    notas: 'Indicaciones',
    retirado: 'Retiro en camino a tu banco.',
    pedido: 'Pedido',
  },
  en: {
    conectado: 'Online: receiving orders',
    desconectado: 'Offline',
    conectar: 'Go online',
    desconectar: 'Go offline',
    sinUbicacion: 'To receive orders we need your location while you use the app.',
    buscandoUbicacion: 'Finding your location…',
    ubicacionTarda:
      'We couldn’t read your location. Make sure GPS is on and your browser has permission, then try again.',
    buscando: 'Looking for orders near you…',
    oferta: 'New offer',
    ganas: 'You earn',
    propinaIncluida: 'includes a tip of',
    aceptar: 'Accept',
    rechazar: 'No, thanks',
    sinCastigo: 'Declining never lowers your level.',
    recoger: 'Pick up at',
    entregar: 'Deliver to',
    comoLlegar: 'Directions',
    recogido: 'Picked up',
    entregado: 'Delivered',
    esperando: 'The restaurant is finishing it…',
    nivel: 'Your level',
    puntos: 'points',
    faltan: 'You need',
    para: 'to reach',
    saldo: 'Your balance',
    menu: 'Menu',
    vistaInicio: 'Home',
    vistaBilletera: 'My wallet',
    vistaDatos: 'My details and vehicle',
    verBilletera: 'See my wallet and activity →',
    volverInicio: '← Back to home',
    conectarBanco: 'Connect my bank account',
    retirarPanel: 'Cash out all',
    llamar: 'Call the restaurant',
    notas: 'Instructions',
    retirado: 'Cash-out on its way to your bank.',
    pedido: 'Order',
  },
};

function abrirMapa(lat: number | null, lng: number | null, direccion: string) {
  const destino = lat != null && lng != null ? `${lat},${lng}` : encodeURIComponent(direccion);
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?daddr=${destino}`
      : `https://www.google.com/maps/dir/?api=1&destination=${destino}`;
  void Linking.openURL(url);
}

export function Inicio() {
  useKeepAwake();
  const { api, idioma, salir } = useSesion();
  const t = enIdioma(T, idioma);
  const tm = enIdioma(TEXTOS_MOVIL, idioma);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [ofertas, setOfertas] = useState<Pedido[]>([]);
  const [billetera, setBilletera] = useState<Billetera | null>(null);
  const [error, setError] = useState('');
  const [cambiando, setCambiando] = useState(false);
  const [vista, setVista] = useState<'inicio' | 'billetera' | 'datos'>('inicio');
  const [menuAbierto, setMenuAbierto] = useState(false);
  // El error de la recarga automática va aparte: si no, cada recarga borraba el aviso de un botón.
  const [errorCarga, setErrorCarga] = useState('');
  const [aviso, setAviso] = useState('');
  const vigilante = useRef<Location.LocationSubscription | null>(null);

  const cargar = useCallback(async () => {
    try {
      const s = await api.pedir<Estado>('GET', '/datos/repartidor/estado');
      setEstado(s);
      if (s.conectado && !s.activo)
        setOfertas(
          (await api.pedir<{ ofertas: Pedido[] }>('GET', '/datos/repartidor/ofertas')).ofertas,
        );
      else setOfertas([]);
      setBilletera(await api.pedir<Billetera>('GET', '/datos/billetera'));
      setErrorCarga('');
    } catch (x) {
      setErrorCarga(x instanceof ErrorApi ? x.message : String(x));
    }
  }, [api]);

  useEffect(() => {
    const primero = setTimeout(() => void cargar(), 0);
    const reloj = setInterval(() => void cargar(), 5000);
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
    };
  }, [cargar]);

  // Mientras está conectado, la ubicación se manda cada vez que se mueve (solo con la app abierta).
  useEffect(() => {
    if (!estado?.conectado) {
      vigilante.current?.remove();
      vigilante.current = null;
      return;
    }
    let vivo = true;
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 30, timeInterval: 10_000 },
      (p) => {
        void api
          .pedir('POST', '/datos/repartidor/ubicacion', {
            lat: p.coords.latitude,
            lng: p.coords.longitude,
          })
          .catch(() => undefined);
      },
    ).then((s) => {
      if (vivo) vigilante.current = s;
      else s.remove();
    });
    return () => {
      vivo = false;
      vigilante.current?.remove();
      vigilante.current = null;
    };
  }, [estado?.conectado, api]);

  // Nunca en silencio: mientras busca la ubicación lo dice, y si algo falla se ve en pantalla.
  async function alternar() {
    if (cambiando) return;
    setError('');
    setCambiando(true);
    try {
      if (estado?.conectado) {
        await api.pedir('POST', '/datos/repartidor/conectar', { conectado: false });
        return await cargar();
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return setError(t.sinUbicacion);
      const p = await ubicacionConLimite();
      if (!p) return setError(t.ubicacionTarda);
      await api.pedir('POST', '/datos/repartidor/conectar', {
        conectado: true,
        lat: p.coords.latitude,
        lng: p.coords.longitude,
      });
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : t.ubicacionTarda);
    } finally {
      setCambiando(false);
    }
  }

  async function accion(ruta: string) {
    setError('');
    try {
      await api.pedir('POST', ruta, {});
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
      await cargar();
    }
  }

  async function banco() {
    try {
      const r = await api.pedir<{ url: string }>('POST', '/datos/billetera/conectar', {});
      await Linking.openURL(r.url);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function retirar() {
    if (!billetera) return;
    try {
      await api.pedir('POST', '/datos/billetera/retirar', { montoCentavos: billetera.saldo });
      setAviso(t.retirado);
      await cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const activo = estado?.activo;
  // Menú de tres rayas: la billetera completa vive en su propia vista, como en una app de banco.
  const menuCabecera = (
    <View style={{ marginBottom: 8 }}>
      <Pressable
        onPress={() => setMenuAbierto((x) => !x)}
        accessibilityRole="button"
        accessibilityLabel={t.menu}
        hitSlop={8}
        style={{ alignSelf: 'flex-start', padding: 6 }}
      >
        {/* Tres rayas dibujadas (sin emojis ni símbolos raros). */}
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              width: 24,
              height: 3,
              borderRadius: 2,
              backgroundColor: C.secundario,
              marginVertical: 2.5,
            }}
          />
        ))}
      </Pressable>
      {menuAbierto ? (
        <View style={e.tarjeta}>
          {(
            [
              ['inicio', t.vistaInicio],
              ['billetera', t.vistaBilletera],
              ['datos', t.vistaDatos],
            ] as const
          ).map(([v, texto]) => (
            <Text
              key={v}
              style={{ paddingVertical: 10, fontWeight: vista === v ? '800' : '600' }}
              onPress={() => {
                setVista(v);
                setMenuAbierto(false);
              }}
              accessibilityRole="button"
            >
              {texto}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
  // El resultado de un botón (retirar, conectar el banco) se ve en la pantalla donde se tocó,
  // también en la billetera: antes ahí no salía ni el «Retiro en camino» ni el error.
  const mensajes = (
    <>
      {error || errorCarga ? (
        <Text style={[e.error, { marginBottom: 8 }]} accessibilityRole="alert">
          {error || errorCarga}
        </Text>
      ) : null}
      {aviso ? (
        <Text
          style={{ color: '#0d7a3a', fontWeight: '700', marginBottom: 8 }}
          accessibilityRole="alert"
        >
          {aviso}
        </Text>
      ) : null}
    </>
  );
  if (vista === 'billetera' && billetera)
    return (
      <Pantalla titulo={t.vistaBilletera}>
        {menuCabecera}
        {mensajes}
        <BilleteraRepartidor
          datos={billetera}
          idioma={idioma}
          retirar={() => void retirar()}
          conectar={() => void banco()}
        />
        <Text style={e.enlace} onPress={() => setVista('inicio')} accessibilityRole="button">
          {t.volverInicio}
        </Text>
      </Pantalla>
    );
  if (vista === 'datos')
    return (
      <Pantalla titulo={t.vistaDatos}>
        {menuCabecera}
        <Verificacion />
        <MisDatos />
        <Text style={e.enlace} onPress={() => setVista('inicio')} accessibilityRole="button">
          {t.volverInicio}
        </Text>
      </Pantalla>
    );
  return (
    <Pantalla>
      {menuCabecera}
      {estado && (
        <Pressable
          onPress={() => void alternar()}
          accessibilityRole="switch"
          accessibilityState={{ checked: estado.conectado }}
          style={[e.tarjeta, { backgroundColor: estado.conectado ? C.exito : C.secundario }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>
            {estado.conectado ? t.conectado : t.desconectado}
          </Text>
          <Text
            style={{
              // Blanco subrayado sobre verde; el rojo no se leía. Sobre gris oscuro sí va el escarlata.
              color: estado.conectado ? '#fff' : C.acento,
              textDecorationLine: estado.conectado ? 'underline' : 'none',
              fontWeight: '700',
              marginTop: 4,
            }}
          >
            {cambiando ? t.buscandoUbicacion : estado.conectado ? t.desconectar : t.conectar}
          </Text>
        </Pressable>
      )}
      {mensajes}

      {activo ? (
        <View style={e.tarjeta}>
          <Text style={{ fontWeight: '800', fontSize: 18 }}>
            {t.pedido} #{activo.id.slice(0, 4).toUpperCase()} ·{' '}
            {formatearDolares(activo.pagoRepartidor, idioma)}
          </Text>
          {activo.lineas.map((l) => (
            <Text key={l.platoId}>
              {l.cantidad} × {nombrePlato(l, idioma)}
            </Text>
          ))}
          {activo.estado !== 'en_camino' ? (
            <>
              <Text style={{ marginTop: 10, fontWeight: '700' }}>
                {t.recoger}: {activo.restaurante.nombre}
              </Text>
              <Text>{activo.restaurante.direccion}</Text>
              <Boton
                texto={t.comoLlegar}
                alTocar={() =>
                  abrirMapa(
                    activo.restaurante.lat,
                    activo.restaurante.lng,
                    activo.restaurante.direccion,
                  )
                }
                secundario
              />
              {activo.restaurante.telefono ? (
                <Boton
                  texto={t.llamar}
                  alTocar={() => void Linking.openURL(`tel:${activo.restaurante.telefono}`)}
                  secundario
                />
              ) : null}
              {activo.estado === 'listo' ? (
                <Boton
                  texto={t.recogido}
                  alTocar={() => void accion(`/datos/repartidor/pedidos/${activo.id}/recogido`)}
                />
              ) : (
                <Text style={{ marginTop: 8, color: '#5E5E5E' }}>{t.esperando}</Text>
              )}
            </>
          ) : (
            <>
              <Text style={{ marginTop: 10, fontWeight: '700' }}>{t.entregar}:</Text>
              <Text>{activo.direccion}</Text>
              {activo.notas ? (
                <Text style={{ color: '#5E5E5E' }}>
                  {t.notas}: {activo.notas}
                </Text>
              ) : null}
              <Boton
                texto={t.comoLlegar}
                alTocar={() => abrirMapa(activo.lat, activo.lng, activo.direccion)}
                secundario
              />
              <Boton
                texto={t.entregado}
                alTocar={() => void accion(`/datos/repartidor/pedidos/${activo.id}/entregado`)}
              />
            </>
          )}
        </View>
      ) : estado?.conectado ? (
        ofertas.length === 0 ? (
          <Text style={e.tarjeta}>{t.buscando}</Text>
        ) : (
          ofertas.map((o) => (
            <View key={o.id} style={[e.tarjeta, { borderWidth: 3, borderColor: C.primario }]}>
              <Text style={{ color: C.primario, fontWeight: '800' }}>{t.oferta}</Text>
              <Text style={{ fontSize: 28, fontWeight: '800', marginVertical: 4 }}>
                {t.ganas} {formatearDolares(o.pagoRepartidor, idioma)}
              </Text>
              {o.propina > 0 ? (
                <Text style={{ color: '#5E5E5E' }}>
                  {t.propinaIncluida} {formatearDolares(o.propina, idioma)}
                </Text>
              ) : null}
              <Text style={{ marginTop: 6 }}>
                {t.recoger}: {o.restaurante.nombre}
              </Text>
              <Text>
                {t.entregar}: {o.direccion}
                {o.distanciaKm != null
                  ? ` · ${(idioma === 'en' ? o.distanciaKm * 0.621371 : o.distanciaKm).toFixed(1)} ${idioma === 'en' ? 'mi' : 'km'}`
                  : ''}
              </Text>
              <Boton
                texto={t.aceptar}
                alTocar={() => void accion(`/datos/repartidor/ofertas/${o.id}/aceptar`)}
              />
              <Boton
                texto={t.rechazar}
                alTocar={() => void accion(`/datos/repartidor/ofertas/${o.id}/rechazar`)}
                secundario
              />
              <Text style={{ color: '#5E5E5E', textAlign: 'center' }}>{t.sinCastigo}</Text>
            </View>
          ))
        )
      ) : null}

      {estado && (
        <View style={e.tarjeta}>
          <Text style={{ fontWeight: '800' }}>
            {t.nivel}: {enIdioma({ es: estado.nivel.es, en: estado.nivel.en }, idioma)} ·{' '}
            {estado.puntos} {t.puntos}
          </Text>
          {estado.nivel.siguiente ? (
            <Text style={{ color: '#5E5E5E' }}>
              {t.faltan} {estado.nivel.siguiente.faltan} {t.puntos} {t.para}{' '}
              {enIdioma({ es: estado.nivel.siguiente.es, en: estado.nivel.siguiente.en }, idioma)}
            </Text>
          ) : null}
          {/* Barra de avance al siguiente nivel, en verde: cada entrega es un paso hacia adelante. */}
          <View
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(estado.nivel.avance * 100) }}
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: '#ECECEC',
              marginTop: 8,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${Math.max(2, Math.round(estado.nivel.avance * 100))}%`,
                height: 8,
                borderRadius: 4,
                backgroundColor: C.exito,
              }}
            />
          </View>
        </View>
      )}
      {billetera && (
        <Pressable
          onPress={() => setVista('billetera')}
          accessibilityRole="link"
          style={[e.tarjeta, { backgroundColor: C.secundario }]}
        >
          <Text style={{ color: '#BDBDBD', fontWeight: '600' }}>{t.saldo}</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800' }}>
            {formatearDolares(billetera.saldo, idioma)}
          </Text>
          <Text style={{ color: '#FFFFFF', textDecorationLine: 'underline', marginTop: 4 }}>
            {t.verBilletera}
          </Text>
        </Pressable>
      )}
      {/* Quejas y ayuda: si hay una entrega activa, el ticket va atado a ese pedido. */}
      <ReportarProblema pedidoId={estado?.activo?.id} />
      <Boton texto={tm.salir} alTocar={() => void salir()} secundario />
      <MenuCuenta />
    </Pantalla>
  );
}
