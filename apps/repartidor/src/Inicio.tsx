import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { useKeepAwake } from 'expo-keep-awake';
import { ErrorApi, type Nivel, enIdioma, formatearDolares, nombrePlato } from '@tumbite/compartido';
import { Boton, C, MenuCuenta, Pantalla, TEXTOS_MOVIL, e, useSesion } from '@tumbite/movil';

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
type Billetera = { saldo: number; cuentaConectada: boolean; pagosActivos: boolean };

const T = {
  es: {
    conectado: 'Conectado: recibiendo pedidos',
    desconectado: 'Desconectado',
    conectar: 'Conectarme',
    desconectar: 'Desconectarme',
    sinUbicacion: 'Para recibir pedidos necesitamos tu ubicación mientras usas la app.',
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
      setError('');
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
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

  async function alternar() {
    setError('');
    if (estado?.conectado) {
      await api.pedir('POST', '/datos/repartidor/conectar', { conectado: false });
      return cargar();
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return setError(t.sinUbicacion);
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    await api.pedir('POST', '/datos/repartidor/conectar', {
      conectado: true,
      lat: p.coords.latitude,
      lng: p.coords.longitude,
    });
    await cargar();
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
  return (
    <Pantalla>
      {estado && (
        <Pressable
          onPress={() => void alternar()}
          accessibilityRole="switch"
          accessibilityState={{ checked: estado.conectado }}
          style={[e.tarjeta, { backgroundColor: estado.conectado ? '#0d7a3a' : C.secundario }]}
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
            {estado.conectado ? t.desconectar : t.conectar}
          </Text>
        </Pressable>
      )}
      {error ? <Text style={[e.error, { marginBottom: 8 }]}>{error}</Text> : null}
      {aviso ? (
        <Text style={{ color: '#0d7a3a', fontWeight: '700', marginBottom: 8 }}>{aviso}</Text>
      ) : null}

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
        </View>
      )}
      {billetera && (
        <View style={e.tarjeta}>
          <Text style={{ fontWeight: '800' }}>
            {t.saldo}: {formatearDolares(billetera.saldo, idioma)}
          </Text>
          {billetera.pagosActivos ? (
            billetera.saldo >= 100 ? (
              <Boton texto={t.retirarPanel} alTocar={() => void retirar()} />
            ) : null
          ) : (
            <Boton texto={t.conectarBanco} alTocar={() => void banco()} secundario />
          )}
        </View>
      )}
      <Boton texto={tm.salir} alTocar={() => void salir()} secundario />
      <MenuCuenta />
    </Pantalla>
  );
}
