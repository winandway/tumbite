import { useEffect, useMemo, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  type Restaurante,
  type ServicioCatalogo,
  enIdioma,
  recomendarRestaurantes,
} from '@tumbite/compartido';
import { C, useSesion } from '@tumbite/movil';
import { useCarrito } from './carrito';
import { TEXTOS } from './textos';
import { useRestaurantes } from './comida/useRestaurantes';
import { recordarAnuncio } from './comida/anuncioTocado';
import { EstadoCatalogo } from './comida/EstadoCatalogo';
import { AvisoPago } from './inicio/AvisoPago';
import { BarraInferior, type Pestana } from './inicio/BarraInferior';
import { Buscador } from './inicio/Buscador';
import { Cabecera } from './inicio/Cabecera';
import { Categorias } from './inicio/Categorias';
import { ElegirDireccion } from './inicio/ElegirDireccion';
import { Filtros, type FiltrosInicio } from './inicio/Filtros';
import { Ofertas, type PromoReal } from './inicio/Ofertas';
import { FilaRestaurantes, ListaRestaurantes } from './inicio/Restaurantes';
import { Servicios } from './inicio/Servicios';
import { useServicios } from './inicio/useServicios';
import { useAvisos } from './inicio/useAvisos';
import { useFavoritos } from './inicio/useFavoritos';
import { RegalosEnMarcha } from './inicio/RegalosEnMarcha';
import { textosInicio } from './inicio/textos';
import { PedirOtraVezInicio } from './inicio/PedirOtraVezInicio';

/** Cuántos restaurantes salen por tanda en «Todos los restaurantes». */
const TANDA = 25;
const ANCHO_PORTADA = 640;

/**
 * POR-1 (2 nov 2026): la portada del cliente como DoorDash y Uber Eats, en UN solo scroll:
 * «Entregar en ▾» con la dirección, campana e idioma; buscador y filtros (quedan pegados arriba al
 * bajar); servicios disponibles en chips (lo que viene vive en «Más»); banner de cupones reales;
 * categorías reales en círculos; «Más rápidos cerca de ti»; y «Todos los restaurantes» en lista
 * vertical, por tandas. Sin «Cerrar sesión» aquí: vive en Mi cuenta. Todos los datos son reales.
 */
export function Inicio() {
  const { api, idioma, usuario, cambiarIdioma } = useSesion();
  const t = enIdioma(TEXTOS, idioma);
  const ti = textosInicio(idioma);
  const { carrito, cantidadTotal, marcarRecoger } = useCarrito();
  const [filtros, setFiltros] = useState<FiltrosInicio>({
    recoger: false,
    ofertas: false,
    abiertos: false,
  });
  const [cuantos, setCuantos] = useState(TANDA);
  const [cambiandoDireccion, setCambiandoDireccion] = useState(false);
  // Promociones reales destacadas (cupones del superadmin) para el banner.
  const [promos, setPromos] = useState<PromoReal[]>([]);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<{ cupones: PromoReal[] }>('GET', '/datos/cupones/destacados')
      .then((r) => {
        if (vivo) setPromos(r.cupones);
      })
      .catch((e: unknown) => console.warn('inicio: no se pudieron cargar los cupones', e));
    return () => {
      vivo = false;
    };
  }, [api]);
  // La portada de divoox.com puede mandar la ubicación por la dirección (?lat=&lng=).
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const deUrl = useMemo(
    () =>
      params.lat && params.lng && Number.isFinite(Number(params.lat))
        ? { lat: Number(params.lat), lng: Number(params.lng) }
        : null,
    [params.lat, params.lng],
  );
  // C-CATALOGO-ESTABLE: una sola lista compartida con «Comida»; ni respuestas viejas que pisan a
  // las nuevas ni consultas repetidas (comida/useRestaurantes).
  const catalogo = useRestaurantes(api, deUrl);
  const lista =
    catalogo.estado === 'cargando' && !catalogo.restaurantes.length ? null : catalogo.restaurantes;
  const punto = catalogo.punto;
  const favoritos = useFavoritos(api, Boolean(usuario));

  // Filtros rápidos (Entrega/Recoger, Ofertas, Abiertos) sobre la lista real.
  const abierto = (r: Restaurante) => r.abiertoAhora ?? r.abierto;
  const filtrados = useMemo(() => {
    const l = (lista ?? []).filter(
      (r) => (!filtros.abiertos || abierto(r)) && (!filtros.ofertas || Boolean(r.promocion)),
    );
    // En «Recoger», lo más cerca primero (como Uber Eats).
    return filtros.recoger
      ? [...l].sort((a, b) => (a.distanciaKm ?? 1e9) - (b.distanciaKm ?? 1e9))
      : l;
  }, [lista, filtros]);
  // «Más rápidos cerca de ti»: abiertos, por tiempo de preparación más el camino.
  const masRapidos = useMemo(
    () =>
      filtrados
        .filter(abierto)
        .map((r) => ({ r, min: r.tiempoPrepMin + (r.distanciaKm ?? 3) * 3 }))
        .sort((a, b) => a.min - b.min)
        .slice(0, 8)
        .map((x) => x.r),
    [filtrados],
  );

  // C-TE-PUEDE-GUSTAR: lo que ya pidió decide qué tipo de comida recomendar.
  const [yaPedidos, setYaPedidos] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!usuario) return;
    api
      .pedir<{ pedidos: { estado: string; restauranteId: string }[] }>('GET', '/datos/mis-pedidos')
      .then((r) =>
        setYaPedidos(
          new Set(r.pedidos.filter((p) => p.estado === 'entregado').map((p) => p.restauranteId)),
        ),
      )
      .catch(() => setYaPedidos(new Set()));
  }, [api, usuario]);
  const recomendados = useMemo(
    () => recomendarRestaurantes(lista ?? [], yaPedidos),
    [lista, yaPedidos],
  );

  // Lo único que es un monto real pendiente: el carrito armado y sin pagar.
  const carritoCentavos = carrito.lineas.reduce((s, l) => s + l.precioCentavos * l.cantidad, 0);

  // Catálogo de servicios de la ciudad (orden fijo, estado del servidor) y los avisos reales.
  const servicios = useServicios(api, punto);
  const avisos = useAvisos(api, punto).datos;
  const regalos = (avisos?.avisos ?? []).filter((a) => a.tipo === 'regalo');
  const servicio = (s: ServicioCatalogo) => {
    // «Comida» disponible abre los restaurantes; todo lo demás abre la pantalla del servicio,
    // con su franja de estado (nunca una ventana encima).
    if (s.id === 'comida' && (s.accion === 'abrir' || !servicios))
      return router.push('/restaurants');
    router.push(`/service/${s.id}`);
  };
  const pestana = (p: Pestana) => {
    if (p === 'inicio') return;
    if (p === 'favoritos') return router.push('/favorites');
    if (p === 'pedidos') return router.push('/orders');
    router.push('/account');
  };
  const abrirRestaurante = (r: Restaurante) => {
    recordarAnuncio(api, r);
    marcarRecoger(filtros.recoger);
    router.push(`/restaurant/${r.id}`);
  };
  // La dirección de arriba: la elegida a mano (primera parte), o la ubicación actual.
  const direccion = catalogo.direccion
    ? (catalogo.direccion.texto.split(',')[0] ?? catalogo.direccion.texto)
    : punto
      ? ti.ubicacionActual
      : ti.elegirDireccion;
  // Carga al bajar: cerca del final se suma otra tanda de restaurantes.
  const alBajar = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = ev.nativeEvent;
    if (
      filtrados.length > cuantos &&
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 800
    )
      setCuantos((c) => c + TANDA);
  };
  const ancho = { width: '100%', maxWidth: ANCHO_PORTADA, alignSelf: 'center' } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right']}>
      <Cabecera
        idioma={idioma}
        cambiarIdioma={cambiarIdioma}
        direccion={direccion}
        alDireccion={() => setCambiandoDireccion(true)}
        alCampana={() => router.push('/notifications')}
        pendientes={avisos?.pendientes ?? 0}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: cantidadTotal > 0 ? 96 : 28 }}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[0]}
        onScroll={alBajar}
        scrollEventThrottle={200}
        testID="portada-cliente"
      >
        {/* Pegado arriba al bajar: el buscador y los filtros, como DoorDash. */}
        <View
          style={{
            backgroundColor: '#FFFFFF',
            paddingTop: 6,
            borderBottomWidth: 1,
            borderBottomColor: '#ECEDEF',
          }}
        >
          <View style={ancho}>
            <Buscador idioma={idioma} alTocar={() => router.push('/search')} />
            <Filtros idioma={idioma} valor={filtros} cambiar={setFiltros} />
          </View>
        </View>
        <View style={[ancho, { paddingTop: 12 }]}>
          <Servicios idioma={idioma} catalogo={servicios?.servicios ?? null} alTocar={servicio} />
          <AvisoPago
            idioma={idioma}
            centavos={carritoCentavos}
            moneda={carrito.moneda ?? 'USD'}
            alPagar={() => router.push('/cart')}
          />
          <Ofertas
            idioma={idioma}
            reales={promos}
            alTocarReal={() => router.push('/restaurants')}
            alCupon={() => router.push('/notifications?tab=regalos')}
          />
          {regalos.length ? (
            <RegalosEnMarcha
              idioma={idioma}
              regalos={regalos}
              alVer={() => router.push('/notifications?tab=regalos')}
            />
          ) : null}
          {!punto && (
            <Text style={{ color: '#666B73', marginHorizontal: 16, marginTop: 14 }}>
              {ti.sinUbicacion}
            </Text>
          )}
          <PedirOtraVezInicio idioma={idioma} />
          <Categorias
            idioma={idioma}
            lista={lista ?? []}
            alTocar={(c) => router.push({ pathname: '/restaurants', params: { categoria: c } })}
          />
          <FilaRestaurantes
            idioma={idioma}
            lista={masRapidos}
            titulo={ti.masRapidos}
            testID="mas-rapidos"
            favoritos={favoritos}
            alTocar={abrirRestaurante}
          />
          <FilaRestaurantes
            idioma={idioma}
            lista={recomendados}
            titulo={idioma === 'en' ? 'You might like' : 'Te puede gustar'}
            testID="te-puede-gustar"
            favoritos={favoritos}
            alTocar={abrirRestaurante}
          />
          <EstadoCatalogo idioma={idioma} catalogo={catalogo} />
          <ListaRestaurantes
            idioma={idioma}
            lista={filtrados}
            cuantos={cuantos}
            verMas={() => setCuantos((c) => c + TANDA)}
            cargando={lista === null}
            favoritos={favoritos}
            alTocar={abrirRestaurante}
            vacio={lista?.length ? ti.sinFiltro : undefined}
          />
        </View>
      </ScrollView>
      {cantidadTotal > 0 ? (
        // El carrito flota sobre la barra de abajo, como en los grandes.
        <Pressable
          onPress={() => router.push('/cart')}
          accessibilityRole="button"
          accessibilityLabel={`${t.verCarrito} (${cantidadTotal})`}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 86,
            backgroundColor: C.primario,
            borderRadius: 999,
            paddingVertical: 14,
            alignItems: 'center',
            shadowColor: '#101010',
            shadowOpacity: 0.18,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
            elevation: 6,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {`${t.verCarrito} (${cantidadTotal})`}
          </Text>
        </Pressable>
      ) : null}
      <BarraInferior idioma={idioma} activa="inicio" alTocar={pestana} />
      <ElegirDireccion
        visible={cambiandoDireccion}
        idioma={idioma}
        cerca={punto}
        cerrar={() => setCambiandoDireccion(false)}
        elegir={(d) => void catalogo.elegirDireccion(d)}
      />
    </SafeAreaView>
  );
}
