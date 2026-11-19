import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useLocalSearchParams } from 'expo-router';
import {
  type BannerInicio,
  type Restaurante,
  type ServicioCatalogo,
  accionDeServicio,
  destinoDeBanner,
  enIdioma,
  formatearMonto,
  leerBanner,
  ordenarPorUso,
  portadaRespaldo,
  rutaBanners,
  recomendarRestaurantes,
  serviciosAbiertos,
  serviciosDelInicio,
} from '@tumbite/compartido';
import { AvisoCorreo, C, almacenTelefono, useSesion, Text } from '@tumbite/movil';
import { EntrarInvitado } from './inicio/EntrarInvitado';
import { useCarrito } from './carrito';
import { TEXTOS } from './textos';
import { useRestaurantes } from './comida/useRestaurantes';
import { adelantarFichas } from './comida/fichaRestaurante';
import { recordarAnuncio } from './comida/anuncioTocado';
import { AvisoPago } from './inicio/AvisoPago';
import { BarraInferior, type Pestana } from './inicio/BarraInferior';
import { Buscador } from './inicio/Buscador';
import { ElegirDireccion } from './inicio/ElegirDireccion';
import type { PromoReal } from './inicio/Ofertas';
import { useServicios } from './inicio/useServicios';
import { useAvisos } from './inicio/useAvisos';
import { useFavoritos } from './inicio/useFavoritos';
import { EstadoCatalogo } from './comida/EstadoCatalogo';
import { FilaRestaurantes, ListaRestaurantes } from './inicio/Restaurantes';
import { textosInicio } from './inicio/textos';
import {
  CarruselPromos,
  CuadriculaServicios,
  HojaAunNoHay,
  HojaMasServicios,
  PortadaRotativa,
  RestaurantesCerca,
  TarjetaEntregarEn,
} from './inicio/PiezasInicio';
import { textosInicioNuevo } from './inicio/textosNuevo';
import { useVolverAlViaje } from './viajes/useVolverAlViaje';

const ANCHO_PORTADA = 640;
/** Cuántos restaurantes salen por tanda en «Todos los restaurantes». */
const TANDA = 25;
const LLAVE_USOS = 'inicio-usos-servicios';
const LLAVE_PORTADA = 'inicio-ultima-portada';

/** Un cupón destacado real convertido en promoción del carrusel. */
function promoDeCupon(p: PromoReal, idioma: 'es' | 'en'): BannerInicio {
  const valor =
    p.tipo === 'porcentaje'
      ? `${p.valor} %`
      : p.tipo === 'envio_gratis'
        ? ''
        : formatearMonto(p.valor, p.moneda ?? 'USD', idioma);
  const descripcion = idioma === 'en' ? p.descripcionEn || p.descripcionEs : p.descripcionEs;
  return {
    id: `cupon-${p.codigo}`,
    titulo: descripcion || (valor ? `-${valor}` : p.codigo),
    texto: '',
    imagen: '',
    destino: { tipo: 'cupon', valor: p.codigo },
    codigo: p.codigo,
  };
}

/**
 * C-INICIO-NUEVO (17 nov 2026, borrador aprobado por Richard): el inicio en cuatro cuerpos. Portada
 * rotativa (administrador de banners) con «Entregar en» montada encima y el buscador; SIEMPRE los
 * ocho servicios en cuatro columnas (C-OCHO-ICONOS-SIEMPRE: el que no abre en la zona abre la hoja
 * «aún no hay» con «Avísame cuando llegue»; la portada y las promociones, solo lo abierto); el carrusel de
 * promociones reales; y los restaurantes cerca. Abajo: Inicio, Pedidos, Favoritos, Wallet y Mi
 * cuenta. Cada servicio abre su pantalla directa (sin pantallas intermedias con «Abrir»).
 */
export function Inicio() {
  const { api, idioma, usuario, cambiarIdioma } = useSesion();
  const t = enIdioma(TEXTOS, idioma);
  const ti = textosInicioNuevo(idioma);
  const { carrito, cantidadTotal } = useCarrito();
  const [cambiandoDireccion, setCambiandoDireccion] = useState(false);
  const [mas, setMas] = useState(false);
  const [aunNoHay, setAunNoHay] = useState<string | null>(null);
  // C-VOLVER-AL-VIAJE: con un viaje en curso, al abrir la app se vuelve a ese viaje.
  useVolverAlViaje(api, Boolean(usuario));

  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const deUrl = useMemo(
    () =>
      params.lat && params.lng && Number.isFinite(Number(params.lat))
        ? { lat: Number(params.lat), lng: Number(params.lng) }
        : null,
    [params.lat, params.lng],
  );
  const catalogo = useRestaurantes(api, deUrl);
  const punto = catalogo.punto;
  const servicios = useServicios(api, punto);
  const zona = servicios?.zona?.id ?? null;
  const avisos = useAvisos(api, punto, Boolean(usuario)).datos;

  // «Ordenado por lo que más usas» (pantalla 2 del borrador): cuántas veces tocó cada servicio.
  const [usos, setUsos] = useState<Record<string, number>>({});
  useEffect(() => {
    void Promise.resolve(almacenTelefono.leer(LLAVE_USOS))
      .then((x) => x && setUsos(JSON.parse(x) as Record<string, number>))
      .catch(() => undefined);
  }, []);
  const visibles = useMemo(() => serviciosDelInicio(servicios?.servicios ?? null), [servicios]);
  const { lista: grilla, ordenado } = useMemo(
    () => ordenarPorUso(visibles, usos),
    [visibles, usos],
  );
  // Lo que de verdad abre en la zona (la cuadrícula pinta los ocho igual). Comida sigue siendo la
  // puerta de entrada de la portada y de las listas de restaurantes, como antes.
  const abiertos = useMemo(() => serviciosAbiertos(servicios?.servicios ?? null), [servicios]);
  const disponible = (id: string) => id === 'comida' || abiertos.has(id);

  // La portada: la del administrador de banners; si no hay, la de respaldo (una distinta cada vez).
  const [vez, setVez] = useState(0);
  const vezAbierta = useRef<number | null>(null);
  const [portada, setPortada] = useState<BannerInicio | null>(null);
  // Una sola vez por ciudad: se espera a saber la ciudad (catálogo de servicios) antes de pedirla,
  // así no cambia un segundo después de abrir (revisión del 18 nov).
  useEffect(() => {
    if (!servicios) return;
    let vivo = true;
    void (async () => {
      const ultima = await Promise.resolve(almacenTelefono.leer(LLAVE_PORTADA)).catch(() => null);
      // La vuelta de la portada se cuenta UNA vez por apertura: si la ciudad cambia después (la
      // ubicación llega más tarde), se pide de nuevo pero no salta a la siguiente.
      const n = vezAbierta.current ?? Number((ultima ?? '').split('|')[1] ?? 0) + 1;
      vezAbierta.current = n;
      if (vivo) setVez(n);
      const r = await api
        .pedir<{ banner: unknown }>(
          'GET',
          rutaBanners('cabecera', { ciudad: zona, idioma, excluir: (ultima ?? '').split('|')[0] }),
        )
        .catch(() => null);
      const b = leerBanner(r?.banner);
      if (!vivo) return;
      setPortada(b);
      void Promise.resolve(almacenTelefono.guardar(LLAVE_PORTADA, `${b?.id ?? ''}|${n}`)).catch(
        () => undefined,
      );
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo hace falta saber que ya cargó
  }, [api, zona, idioma, Boolean(servicios)]);
  const cabecera = portada ?? portadaRespaldo(idioma, vez, disponible);

  // Las promociones: las del administrador de banners; si no hay, los cupones destacados reales.
  const [promos, setPromos] = useState<BannerInicio[]>([]);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      const r = await api
        .pedir<{ banners: unknown[] }>('GET', rutaBanners('promociones', { ciudad: zona, idioma }))
        .catch(() => null);
      const lista = (r?.banners ?? []).map(leerBanner).filter((x): x is BannerInicio => !!x);
      if (lista.length) return vivo && setPromos(lista);
      const c = await api
        .pedir<{ cupones: PromoReal[] }>('GET', '/datos/cupones/destacados')
        .catch(() => null);
      if (vivo) setPromos((c?.cupones ?? []).map((p) => promoDeCupon(p, idioma)));
    })();
    return () => {
      vivo = false;
    };
  }, [api, zona, idioma]);

  // Restaurantes cerca: abiertos y por cercanía.
  const cerca = useMemo(
    () =>
      [...catalogo.restaurantes]
        .filter((r) => r.abiertoAhora ?? r.abierto)
        .sort((a, b) => (a.distanciaKm ?? 1e9) - (b.distanciaKm ?? 1e9)),
    [catalogo.restaurantes],
  );
  useEffect(() => {
    adelantarFichas(
      api,
      cerca.slice(0, 4).map((r) => r.id),
    );
  }, [api, cerca]);

  // Debajo de lo del borrador, como los grandes al bajar: «Te puede gustar» (C-TE-PUEDE-GUSTAR, por lo
  // que ya pidió) y «Todos los restaurantes» por tandas.
  const favoritos = useFavoritos(api, Boolean(usuario));
  const [cuantos, setCuantos] = useState(TANDA);
  const [yaPedidos, setYaPedidos] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!usuario) return;
    let vivo = true;
    api
      .pedir<{ pedidos: { estado: string; restauranteId: string }[] }>('GET', '/datos/mis-pedidos')
      .then(
        (r) =>
          vivo &&
          setYaPedidos(
            new Set(r.pedidos.filter((p) => p.estado === 'entregado').map((p) => p.restauranteId)),
          ),
      )
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api, usuario]);
  const recomendados = useMemo(
    () => recomendarRestaurantes(catalogo.restaurantes, yaPedidos),
    [catalogo.restaurantes, yaPedidos],
  );

  const carritoCentavos = carrito.lineas.reduce((s, l) => s + l.precioCentavos * l.cantidad, 0);

  const abrirServicio = (s: ServicioCatalogo) => {
    const accion = accionDeServicio(s.id, servicios?.servicios ?? null);
    if (accion.tipo === 'mas') return setMas(true);
    // C-OCHO-ICONOS-SIEMPRE: cerrado en la zona → la hoja amable, sin navegar ni contar el uso.
    if (accion.tipo === 'aun_no_hay') return setAunNoHay(accion.servicio);
    const nuevos = { ...usos, [s.id]: (usos[s.id] ?? 0) + 1 };
    setUsos(nuevos);
    void Promise.resolve(almacenTelefono.guardar(LLAVE_USOS, JSON.stringify(nuevos))).catch(
      () => undefined,
    );
    router.push(accion.ruta as never);
  };
  // «Avísame cuando llegue»: se escribe SOLO al tocar el botón, con la zona del punto elegido.
  const avisarCuandoLlegue = (servicio: string) =>
    api.pedir('POST', '/datos/servicios/avisame', {
      servicio,
      ...(punto ? { lat: punto.lat, lng: punto.lng } : {}),
    });
  const abrirBanner = (b: BannerInicio) => {
    const ruta = destinoDeBanner(b);
    if (ruta) router.push(ruta as never);
  };
  const pestana = (p: Pestana) => {
    if (p === 'inicio') return;
    if (p === 'favoritos') return router.push('/favorites');
    if (p === 'pedidos') return router.push('/orders');
    if (p === 'wallet') return router.push('/gift-cards');
    router.push('/account');
  };
  const abrirRestaurante = (r: Restaurante) => {
    recordarAnuncio(api, r);
    router.push(`/restaurant/${r.id}`);
  };
  const direccion = catalogo.direccion
    ? (catalogo.direccion.texto.split(',')[0] ?? catalogo.direccion.texto)
    : punto
      ? ti.ubicacionActual
      : ti.elegirDireccion;
  const ancho = { width: '100%', maxWidth: ANCHO_PORTADA, alignSelf: 'center' } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['left', 'right']}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: cantidadTotal > 0 ? 96 : 28 }}
        keyboardShouldPersistTaps="handled"
        testID="portada-cliente"
      >
        <View style={{ backgroundColor: '#1A0607' }}>
          <SafeAreaView edges={['top']} style={{ backgroundColor: '#3A0A0E' }} />
          <View style={ancho}>
            <PortadaRotativa
              idioma={idioma}
              cambiarIdioma={cambiarIdioma}
              banner={cabecera}
              pendientes={avisos?.pendientes ?? 0}
              alCampana={() => router.push('/notifications')}
              alTocar={abrirBanner}
            />
          </View>
        </View>
        <View style={ancho}>
          <TarjetaEntregarEn
            idioma={idioma}
            direccion={direccion}
            alTocar={() => setCambiandoDireccion(true)}
          />
          <View style={{ marginTop: 12 }}>
            <Buscador idioma={idioma} alTocar={() => router.push('/search')} />
          </View>
          {usuario ? <AvisoCorreo /> : <EntrarInvitado idioma={idioma} />}
          <CuadriculaServicios
            idioma={idioma}
            lista={grilla}
            ordenado={ordenado}
            alTocar={abrirServicio}
          />
          <AvisoPago
            idioma={idioma}
            centavos={carritoCentavos}
            moneda={carrito.moneda ?? 'USD'}
            alPagar={() => router.push('/cart')}
          />
          <CarruselPromos idioma={idioma} promos={promos} alTocar={abrirBanner} />
          {disponible('comida') ? (
            <RestaurantesCerca
              idioma={idioma}
              lista={cerca}
              alTocar={abrirRestaurante}
              verTodos={() => router.push('/restaurants')}
            />
          ) : null}
          {disponible('comida') ? (
            <>
              <FilaRestaurantes
                idioma={idioma}
                lista={recomendados}
                titulo={idioma === 'en' ? 'You might like' : 'Te puede gustar'}
                testID="te-puede-gustar"
                favoritos={favoritos}
                alTocar={abrirRestaurante}
              />
              <EstadoCatalogo idioma={idioma} catalogo={catalogo} />
              {/* «Todos los restaurantes» solo cuando hay alguno (sin título suelto en una zona vacía). */}
              {catalogo.restaurantes.length ? (
                <ListaRestaurantes
                  idioma={idioma}
                  lista={catalogo.restaurantes}
                  cuantos={cuantos}
                  verMas={() => setCuantos((n) => n + TANDA)}
                  cargando={catalogo.estado === 'cargando' && !catalogo.restaurantes.length}
                  favoritos={favoritos}
                  alTocar={abrirRestaurante}
                  vacio={catalogo.restaurantes.length ? textosInicio(idioma).sinFiltro : undefined}
                />
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
      {cantidadTotal > 0 ? (
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
            borderRadius: 12,
            minHeight: 56,
            justifyContent: 'center',
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
      <HojaAunNoHay
        key={aunNoHay ?? 'ninguno'}
        idioma={idioma}
        servicio={aunNoHay}
        cerrar={() => setAunNoHay(null)}
        avisar={avisarCuandoLlegue}
        conCuenta={Boolean(usuario)}
        crearCuenta={() => {
          setAunNoHay(null);
          router.push('/account');
        }}
      />
      <HojaMasServicios
        idioma={idioma}
        visible={mas}
        cerrar={() => setMas(false)}
        items={[
          {
            clave: 'regalos',
            texto: ti.masItems.regalos,
            icono: 'gift-outline',
            alTocar: () => router.push({ pathname: '/notifications', params: { tab: 'regalos' } }),
          },
          ...(disponible('moto') || disponible('carro')
            ? [
                {
                  clave: 'fijos',
                  texto: ti.masItems.fijos,
                  icono: 'repeat-outline' as const,
                  alTocar: () => router.push('/fixed-rides'),
                },
                {
                  clave: 'confianza',
                  texto: ti.masItems.confianza,
                  icono: 'shield-checkmark-outline' as const,
                  alTocar: () => router.push('/trusted-drivers'),
                },
              ]
            : []),
          {
            clave: 'paquetes',
            texto: ti.masItems.paquetes,
            icono: 'cube-outline',
            alTocar: () => router.push('/packages'),
          },
          {
            clave: 'empresas',
            texto: ti.masItems.empresas,
            icono: 'business-outline',
            alTocar: () => router.push('/business'),
          },
        ]}
      />
    </SafeAreaView>
  );
}
