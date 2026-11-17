import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import * as Location from 'expo-location';
import MapView, { type Region } from 'react-native-maps';
import {
  type PuntoConfirmado,
  type TipoPunto,
  direccionDelSitio,
  limpiarDetalles,
  seMovio,
  textosPuntoExacto,
  tituloPuntoExacto,
} from '@tumbite/compartido';
import { Boton, C, Campo, Icono, Text, usePropsMapaDivoox, useSesion } from '@tumbite/movil';
import { useCentroParaElegir } from './centroMapa';
import { miUbicacion, type Punto } from './ubicacion';

/**
 * C-PUNTO-EXACTO (16 nov 2026) — todos los países. La pieza ÚNICA para marcar el punto exacto
 * (entrega de comida, punto de encuentro del taxi y la moto, destino y envíos), como Uber, DiDi y
 * Rappi: el pin queda FIJO en el centro y la persona mueve el mapa hasta su puerta; arriba se ve la
 * dirección que sale del punto (la lee el teléfono, sin costo de Google) y abajo, el punto de
 * referencia y la casa o apartamento (opcionales) y el botón grande «Confirmar este punto».
 * «Estoy aquí» es un botón grande sobre el mapa. Sin permiso, se dice en palabras y el mapa se
 * sigue moviendo a mano. No es una ventana: va dentro de la hoja o la pantalla que la usa
 * (C-NUNCA-EN-BLANCO: nunca una ventana encima de otra).
 */
export function PuntoExacto({
  tipo,
  inicial,
  cerca,
  conDetalles = true,
  conApto = true,
  confirmar,
  volver,
}: {
  tipo: TipoPunto;
  inicial: { punto: Punto | null; direccion?: string; referencia?: string; apto?: string };
  /** La zona de lo que se pide (el local, la recogida): último recurso para abrir el mapa. */
  cerca?: Punto | null;
  conDetalles?: boolean;
  /** «Casa o apartamento»: sí en la entrega y en los envíos; no en el punto de encuentro. */
  conApto?: boolean;
  confirmar: (p: PuntoConfirmado) => void;
  volver: () => void;
}) {
  const { idioma } = useSesion();
  const t = textosPuntoExacto(idioma);
  const { vista } = useCentroParaElegir(inicial.punto, cerca);
  const mapa = useRef<MapView>(null);
  const [centro, setCentro] = useState<Punto | null>(inicial.punto);
  const [direccion, setDireccion] = useState(inicial.direccion ?? '');
  const [leyendo, setLeyendo] = useState(false);
  const [referencia, setReferencia] = useState(inicial.referencia ?? '');
  const [apto, setApto] = useState(inicial.apto ?? '');
  const [aviso, setAviso] = useState('');
  const [buscandome, setBuscandome] = useState(false);
  const leido = useRef<Punto | null>(inicial.punto);
  const pedido = useRef(0);
  const { coloresMapa } = usePropsMapaDivoox(centro ?? vista?.centro);

  async function leerCalle(p: Punto) {
    const n = ++pedido.current;
    setLeyendo(true);
    try {
      const [sitio] = await Location.reverseGeocodeAsync({ latitude: p.lat, longitude: p.lng });
      if (n !== pedido.current) return;
      setDireccion(direccionDelSitio(sitio) || t.sinCalle);
    } catch (e) {
      console.warn('punto exacto: no se pudo leer la calle del punto', e);
      if (n === pedido.current) setDireccion((d) => d || t.sinCalle);
    } finally {
      if (n === pedido.current) setLeyendo(false);
    }
  }

  // Se abre sobre un punto sin su calle («Estoy aquí» de la hoja, un punto guardado sin texto): se
  // lee de una vez, sin esperar a que la persona mueva el mapa.
  useEffect(() => {
    if (!inicial.punto || inicial.direccion?.trim()) return;
    const r = setTimeout(() => void leerCalle(inicial.punto as Punto), 0);
    return () => clearTimeout(r);
    // Solo al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alMover = (r: Region) => {
    const p = { lat: r.latitude, lng: r.longitude };
    setCentro(p);
    if (!seMovio(leido.current, p)) return;
    leido.current = p;
    void leerCalle(p);
  };

  async function estoyAqui() {
    setAviso('');
    setBuscandome(true);
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      if (permiso.status !== 'granted') return setAviso(t.sinPermiso);
      const p = await miUbicacion();
      if (!p) return setAviso(t.sinSenal);
      mapa.current?.animateToRegion(
        { latitude: p.lat, longitude: p.lng, latitudeDelta: 0.002, longitudeDelta: 0.002 },
        400,
      );
    } catch (e) {
      console.warn('punto exacto: «Estoy aquí» falló', e);
      setAviso(t.sinSenal);
    } finally {
      setBuscandome(false);
    }
  }

  const abre = inicial.punto ?? vista?.centro ?? null;
  const textoArriba = leyendo ? t.buscandoCalle : direccion || t.sinCalle;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#fff' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      testID="punto-exacto"
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#ECEDEF',
        }}
      >
        <Pressable
          onPress={volver}
          accessibilityRole="button"
          accessibilityLabel={t.volver}
          hitSlop={12}
          testID="punto-exacto-volver"
        >
          <Icono nombre="arrow-back" tamano={24} color={C.secundario} />
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, fontSize: 18, fontWeight: '700', color: C.secundario }}
        >
          {tituloPuntoExacto(idioma, tipo)}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 2 }}>
        <Text style={{ color: '#666B73', fontSize: 13 }}>{t.estaDireccion}</Text>
        <Text
          testID="punto-exacto-direccion"
          numberOfLines={2}
          style={{ fontWeight: '700', fontSize: 16, color: C.secundario }}
        >
          {textoArriba}
        </Text>
      </View>
      <View style={{ flex: 1, minHeight: 220 }}>
        {abre ? (
          <MapView
            ref={mapa}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: abre.lat,
              longitude: abre.lng,
              latitudeDelta: inicial.punto ? 0.003 : 0.02,
              longitudeDelta: inicial.punto ? 0.003 : 0.02,
            }}
            onRegionChangeComplete={alMover}
            // Sin punto inicial, la calle del centro donde abrió (GPS con permiso, la dirección de
            // entrega, la última guardada o la zona) se lee apenas el mapa está listo.
            onMapReady={() => alMover({ latitude: abre.lat, longitude: abre.lng } as Region)}
            showsUserLocation
            toolbarEnabled={false}
            rotateEnabled={false}
            accessibilityLabel={t.mapa}
            {...coloresMapa}
          />
        ) : (
          <View style={{ flex: 1, backgroundColor: '#F2F3F5' }} />
        )}
        {/* El pin fijo: su punta queda justo en el centro del mapa. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ alignItems: 'center', marginBottom: 46 }} testID="punto-exacto-pin">
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: C.primario,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 3,
                borderColor: '#fff',
              }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} />
            </View>
            <View style={{ width: 3, height: 12, backgroundColor: C.secundario }} />
          </View>
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 10,
            left: 16,
            right: 16,
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              backgroundColor: 'rgba(16,16,16,0.82)',
              color: '#fff',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              fontSize: 13,
              overflow: 'hidden',
              textAlign: 'center',
            }}
          >
            {tipo === 'encuentro' ? t.ayudaEncuentro : t.ayuda}
          </Text>
        </View>
        <Pressable
          onPress={() => void estoyAqui()}
          disabled={buscandome}
          accessibilityRole="button"
          accessibilityLabel={t.estoyAqui}
          testID="punto-exacto-estoy-aqui"
          style={({ pressed }) => ({
            position: 'absolute',
            right: 16,
            bottom: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: '#fff',
            borderRadius: 999,
            borderWidth: 1,
            borderColor: '#2a2a2a',
            paddingHorizontal: 18,
            paddingVertical: 12,
            opacity: pressed || buscandome ? 0.7 : 1,
            shadowColor: '#000',
            shadowOpacity: 0.15,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 2 },
            elevation: 4,
          })}
        >
          <Icono nombre="navigate" tamano={20} color={C.primario} />
          <Text style={{ fontWeight: '700', fontSize: 16, color: C.secundario }}>
            {buscandome ? t.buscandote : t.estoyAqui}
          </Text>
        </Pressable>
      </View>
      <View style={{ padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: '#ECEDEF' }}>
        {aviso ? (
          <Text testID="punto-exacto-aviso" style={{ color: '#5E5E5E', fontSize: 13 }}>
            {aviso}
          </Text>
        ) : null}
        {conDetalles ? (
          <>
            <Campo
              etiqueta={t.referencia}
              value={referencia}
              onChangeText={setReferencia}
              placeholder={t.referenciaEjemplo}
              maxLength={160}
              testID="punto-exacto-referencia"
            />
            {conApto ? (
              <Campo
                etiqueta={t.apto}
                value={apto}
                onChangeText={setApto}
                placeholder={t.aptoEjemplo}
                maxLength={60}
                testID="punto-exacto-apto"
              />
            ) : null}
          </>
        ) : null}
        <Boton
          texto={t.confirmar}
          testID="punto-exacto-confirmar"
          alTocar={() => {
            const p = centro ?? abre;
            if (!p) return setAviso(t.sinSenal);
            confirmar({
              punto: p,
              direccion:
                direccion && direccion !== t.sinCalle ? direccion : (inicial.direccion ?? ''),
              ...limpiarDetalles({ referencia, apto }),
            });
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
