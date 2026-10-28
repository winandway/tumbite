import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ErrorApi, enIdioma } from '@tumbite/compartido';
import { Boton, C, Campo, CampoDireccion, useSesion } from '@tumbite/movil';
import { ANCHO_MAX, Encabezado, Tarjeta } from '../comida/piezas';
import { textosComida } from '../comida/textos';
import { ElegirEnMapa } from '../ElegirEnMapa';
import type { Punto } from '../ubicacion';

const T = {
  es: {
    titulo: 'Mis paquetes',
    intro:
      'Lo que te envían las empresas con Divoox Flex. Confirma dónde lo recibes y el conductor llega directo a tu puerta.',
    vacio:
      'No tienes paquetes por ahora. Cuando una empresa te envíe algo con tu teléfono o tu correo, aparece aquí.',
    de: 'De',
    seguimiento: 'Seguimiento',
    confirmada: 'Ubicación confirmada',
    pendiente: 'Confirma dónde lo recibes',
    sinCoordenadas: 'Solo con la dirección escrita',
    confirmar: 'Confirmar ubicación',
    cambiar: 'Cambiar la ubicación',
    usarGuardada: 'Usar esta dirección',
    oMarca: 'O marca el punto exacto en el mapa:',
    ayuda: 'Toca el mapa justo en la puerta donde lo recibes.',
    buscando: 'Buscando la dirección…',
    pin: 'Punto de entrega',
    referencias: 'Punto de referencia',
    referenciasEj: 'Casa azul frente a la panadería',
    guardar: 'Guardar ubicación',
    guardado: 'Listo: el conductor llega a ese punto.',
    yaSalio: 'Ya va en camino: la ubicación ya no se cambia.',
    casaTitulo: 'Marca la ubicación de tu casa',
    casaAyuda:
      'Hazlo una sola vez: cada paquete que te envíen las empresas llegará directo a ese punto.',
    casaDireccion: 'Dirección de tu casa',
    casaGuardar: 'Guardar mi casa',
    casaGuardada: 'Tu casa quedó guardada. Tus paquetes llegarán a ese punto.',
    estados: {
      creado: 'Preparando el envío',
      en_proceso: 'En camino',
      entregado: 'Entregado',
      parcial: 'Entregado en parte',
      fallido: 'No se pudo entregar',
      devuelto: 'Devuelto',
      cancelado: 'Cancelado',
    } as Record<string, string>,
  },
  en: {
    titulo: 'My packages',
    intro:
      'What companies send you with Divoox Flex. Confirm where you receive it and the driver comes straight to your door.',
    vacio:
      'You have no packages right now. When a company sends you something with your phone or email, it shows up here.',
    de: 'From',
    seguimiento: 'Tracking',
    confirmada: 'Location confirmed',
    pendiente: 'Confirm where you receive it',
    sinCoordenadas: 'Written address only',
    confirmar: 'Confirm location',
    cambiar: 'Change location',
    usarGuardada: 'Use this address',
    oMarca: 'Or mark the exact spot on the map:',
    ayuda: 'Tap the map right at the door where you receive it.',
    buscando: 'Finding the address…',
    pin: 'Delivery spot',
    referencias: 'Landmark',
    referenciasEj: 'Blue house across from the bakery',
    guardar: 'Save location',
    guardado: 'Done: the driver will come to that spot.',
    yaSalio: 'It’s on its way: the location can no longer change.',
    casaTitulo: 'Mark your home location',
    casaAyuda: 'Do it once: every package companies send you will come straight to that spot.',
    casaDireccion: 'Your home address',
    casaGuardar: 'Save my home',
    casaGuardada: 'Your home is saved. Your packages will come to that spot.',
    estados: {
      creado: 'Preparing the shipment',
      en_proceso: 'On its way',
      entregado: 'Delivered',
      parcial: 'Partly delivered',
      fallido: 'Delivery failed',
      devuelto: 'Returned',
      cancelado: 'Canceled',
    } as Record<string, string>,
  },
};

type Paquete = {
  envioId: string;
  empresa: string;
  codigo: string | null;
  estado: string;
  direccion: string;
  referencias: string;
  punto: Punto | null;
  ubicacion: string;
  puedeCambiar: boolean;
  referenciasObligatorias: boolean;
};
type Direccion = {
  id: string;
  etiqueta: string;
  direccion: string;
  lat: number | null;
  lng: number | null;
  instrucciones: string;
};

/**
 * Divoox Flex · «Mis paquetes» del destinatario (C-FLEX-UBICACION). En Venezuela el destinatario
 * tiene que estar en la app: así cada paquete que le mandan llega con su ubicación exacta. Aquí ve
 * lo que le envían y confirma el punto con una dirección guardada o con el pin en el mapa.
 */
export default function MisPaquetes() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const tc = textosComida(idioma);
  const estados = new Map(Object.entries(t.estados));
  const [paquetes, setPaquetes] = useState<Paquete[] | null>(null);
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [punto, setPunto] = useState<Punto | null>(null);
  const [referencias, setReferencias] = useState('');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [casa, setCasa] = useState<Punto | null>(null);
  const [casaDir, setCasaDir] = useState('');
  const [casaRefs, setCasaRefs] = useState('');

  const cargar = useCallback(() => {
    api
      .pedir<{ paquetes: Paquete[] }>('GET', '/datos/v1/flex/mis-paquetes')
      .then((r) => setPaquetes(r.paquetes))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
    api
      .pedir<{ direcciones: Direccion[] }>('GET', '/datos/mis-direcciones')
      .then((r) => setDirecciones(r.direcciones.filter((d) => d.lat != null && d.lng != null)))
      .catch(() => setDirecciones([]));
  }, [api]);
  useEffect(() => {
    const r = setTimeout(cargar, 0);
    return () => clearTimeout(r);
  }, [cargar]);

  /** La casa con pin, una sola vez: a partir de ahí los envíos llegan ya ubicados. */
  async function guardarCasa() {
    if (!casa) return;
    setError('');
    try {
      await api.pedir('POST', '/datos/mis-direcciones', {
        etiqueta: idioma === 'en' ? 'Home' : 'Casa',
        direccion: casaDir.trim() || (idioma === 'en' ? 'My home' : 'Mi casa'),
        lat: casa.lat,
        lng: casa.lng,
        instrucciones: casaRefs.trim(),
      });
      setAviso(t.casaGuardada);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function guardar(p: Paquete, punto: Punto, refs: string, direccion?: string) {
    setError('');
    setAviso('');
    try {
      await api.pedir('POST', `/datos/v1/flex/mis-paquetes/${p.envioId}/ubicacion`, {
        ...punto,
        referencias: refs,
        ...(direccion ? { direccion } : {}),
      });
      setAbierto(null);
      setAviso(t.guardado);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      <Encabezado
        titulo={t.titulo}
        alVolver={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        etiquetaVolver={tc.volver}
      />
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 32,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
          gap: 12,
        }}
      >
        <Text style={{ color: '#5E5E5E' }}>{t.intro}</Text>
        {aviso ? <Text style={{ color: C.exito, fontWeight: '700' }}>{aviso}</Text> : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
            {error}
          </Text>
        ) : null}
        {paquetes && direcciones.length === 0 ? (
          <Tarjeta>
            <View testID="marcar-casa" style={{ gap: 8 }}>
              <Text style={{ fontWeight: '900', fontSize: 17, color: C.secundario }}>
                {t.casaTitulo}
              </Text>
              <Text style={{ color: '#5E5E5E' }}>{t.casaAyuda}</Text>
              <ElegirEnMapa
                punto={casa}
                cambiarPunto={setCasa}
                cambiarDireccion={(d) => {
                  if (!casaDir.trim()) setCasaDir(d);
                }}
                textos={{ ayuda: t.ayuda, buscando: t.buscando, pin: t.pin }}
              />
              {/* C-DIRECCION-SUGERENCIAS: al elegir una dirección real, el pin va a ese punto. */}
              <CampoDireccion
                etiqueta={t.casaDireccion}
                valor={casaDir}
                cambiar={setCasaDir}
                alElegir={(d) => setCasa(d.punto)}
                cerca={casa}
              />
              <Campo
                etiqueta={t.referencias}
                placeholder={t.referenciasEj}
                value={casaRefs}
                onChangeText={setCasaRefs}
              />
              {casa ? (
                <Boton texto={t.casaGuardar} alTocar={() => void guardarCasa()} exito />
              ) : null}
            </View>
          </Tarjeta>
        ) : null}
        {paquetes?.length === 0 ? (
          <Tarjeta>
            <Text>{t.vacio}</Text>
          </Tarjeta>
        ) : null}
        {paquetes?.map((p) => (
          <Tarjeta key={p.envioId}>
            <View testID={`paquete-${p.envioId}`} style={{ gap: 4 }}>
              <Text style={{ fontWeight: '900', fontSize: 17, color: C.secundario }}>
                {t.de} {p.empresa}
              </Text>
              <Text
                style={{ color: p.estado === 'entregado' ? C.exito : '#5E5E5E', fontWeight: '700' }}
              >
                {estados.get(p.estado) ?? p.estado}
              </Text>
              {p.codigo ? (
                <Text style={{ color: '#5E5E5E' }}>
                  {t.seguimiento}: {p.codigo}
                </Text>
              ) : null}
              <Text style={{ color: C.secundario }}>{p.direccion}</Text>
              {p.referencias ? <Text style={{ color: '#5E5E5E' }}>{p.referencias}</Text> : null}
              <Text
                style={{
                  fontWeight: '800',
                  color: p.ubicacion === 'confirmada' ? C.exito : C.secundario,
                }}
              >
                {p.ubicacion === 'confirmada'
                  ? t.confirmada
                  : p.ubicacion === 'pendiente'
                    ? t.pendiente
                    : t.sinCoordenadas}
              </Text>
              {p.puedeCambiar ? (
                <Pressable
                  onPress={() => {
                    setAbierto(abierto === p.envioId ? null : p.envioId);
                    setPunto(p.punto);
                    setReferencias(p.referencias);
                  }}
                  accessibilityRole="button"
                >
                  <Text style={{ color: C.primario, fontWeight: '800', paddingVertical: 6 }}>
                    {p.ubicacion === 'confirmada' ? t.cambiar : t.confirmar}
                  </Text>
                </Pressable>
              ) : (
                <Text style={{ color: '#5E5E5E' }}>{t.yaSalio}</Text>
              )}
              {abierto === p.envioId ? (
                <View style={{ gap: 8 }}>
                  {direcciones.map((d) => (
                    <Pressable
                      key={d.id}
                      onPress={() =>
                        void guardar(
                          p,
                          { lat: d.lat ?? 0, lng: d.lng ?? 0 },
                          d.instrucciones || referencias || d.etiqueta,
                          d.direccion,
                        )
                      }
                      accessibilityRole="button"
                      style={{
                        borderWidth: 1,
                        borderColor: '#2a2a2a',
                        borderRadius: 10,
                        padding: 10,
                      }}
                    >
                      <Text style={{ fontWeight: '800' }}>{d.etiqueta || d.direccion}</Text>
                      <Text style={{ color: '#5E5E5E' }}>{d.direccion}</Text>
                      <Text style={{ color: C.primario, fontWeight: '700' }}>{t.usarGuardada}</Text>
                    </Pressable>
                  ))}
                  <Text style={{ color: '#5E5E5E' }}>{t.oMarca}</Text>
                  <ElegirEnMapa
                    punto={punto}
                    cambiarPunto={setPunto}
                    cambiarDireccion={() => undefined}
                    textos={{ ayuda: t.ayuda, buscando: t.buscando, pin: t.pin }}
                  />
                  <Campo
                    etiqueta={t.referencias}
                    placeholder={t.referenciasEj}
                    value={referencias}
                    onChangeText={setReferencias}
                  />
                  {punto ? (
                    <Boton
                      texto={t.guardar}
                      alTocar={() => void guardar(p, punto, referencias)}
                      exito
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          </Tarjeta>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
