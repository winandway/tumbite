import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { type ServicioCatalogo, enIdioma } from '@tumbite/compartido';
import { Boton, MenuCuenta, TEXTOS_MOVIL, e, useSesion } from '@tumbite/movil';
import { useCarrito } from './carrito';
import { TEXTOS } from './textos';
import { useRestaurantes } from './comida/useRestaurantes';
import { EstadoCatalogo } from './comida/EstadoCatalogo';
import { AvisoPago } from './inicio/AvisoPago';
import { BarraInferior, type Pestana } from './inicio/BarraInferior';
import { Buscador } from './inicio/Buscador';
import { Cabecera } from './inicio/Cabecera';
import { ModalMuyPronto } from './inicio/ModalMuyPronto';
import { Ofertas } from './inicio/Ofertas';
import { Restaurantes } from './inicio/Restaurantes';
import { Servicios } from './inicio/Servicios';
import { useServicios } from './inicio/useServicios';
import { useAvisos } from './inicio/useAvisos';
import { RegalosEnMarcha } from './inicio/RegalosEnMarcha';
import { textosInicio } from './inicio/textos';

/**
 * Inicio del cliente con el diseño aprobado (14 oct 2026): cabecera con logotipo y hamburguesa,
 * saludo, buscador, ocho servicios en el orden de Richard con su estado real, aviso de pago solo si hay un carrito
 * sin pagar, regalos reales en marcha (o las ofertas de muestra si no hay), restaurantes cercanos
 * y barra inferior. Buscador y campana abren sus pantallas reales (/search, /notifications).
 * Los datos son reales: restaurantes, carrito y sesión. Nada falso se puede comprar.
 */
export function Inicio() {
  const { api, idioma, usuario, salir, cambiarIdioma } = useSesion();
  const t = enIdioma(TEXTOS, idioma);
  const ti = textosInicio(idioma);
  const tm = enIdioma(TEXTOS_MOVIL, idioma);
  const { carrito, cantidadTotal } = useCarrito();
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [pronto, setPronto] = useState(false);
  // La portada de tumbite.com puede mandar la ubicación por la dirección (?lat=&lng=).
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

  // «Solo abiertos» filtra la lista real del inicio; la búsqueda vive en su propia pantalla.
  const filtrados = useMemo(
    () => (lista ?? []).filter((r) => !soloAbiertos || (r.abiertoAhora ?? r.abierto)),
    [lista, soloAbiertos],
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
    if (p === 'favoritos') return setPronto(true);
    router.push('/account');
  };

  return (
    <SafeAreaView
      style={[e.fondo, { backgroundColor: '#F3F6FB' }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Cabecera
          nombre={usuario?.nombre.split(' ')[0] ?? ''}
          idioma={idioma}
          cambiarIdioma={cambiarIdioma}
          alCampana={() => router.push('/notifications')}
          alCupon={() => router.push('/notifications?tab=regalos')}
          pendientes={avisos?.pendientes ?? 0}
        />
        <Buscador
          idioma={idioma}
          alTocar={() => router.push('/search')}
          soloAbiertos={soloAbiertos}
          alternarAbiertos={() => setSoloAbiertos((v) => !v)}
        />
        <Servicios idioma={idioma} catalogo={servicios?.servicios ?? null} alTocar={servicio} />
        <AvisoPago
          idioma={idioma}
          centavos={carritoCentavos}
          alPagar={() => router.push('/cart')}
        />
        {regalos.length ? (
          <RegalosEnMarcha
            idioma={idioma}
            regalos={regalos}
            alVer={() => router.push('/notifications?tab=regalos')}
          />
        ) : (
          // Ofertas de muestra solo mientras la persona no tenga regalos reales en marcha.
          <Ofertas idioma={idioma} alTocarEjemplo={() => setPronto(true)} />
        )}
        {!punto && (
          <Text style={{ color: '#5E5E5E', marginHorizontal: 16, marginTop: 14 }}>
            {ti.sinUbicacion}
          </Text>
        )}
        <EstadoCatalogo idioma={idioma} catalogo={catalogo} />
        <Restaurantes
          idioma={idioma}
          lista={filtrados}
          cargando={lista === null}
          alTocar={(r) => router.push(`/restaurant/${r.id}`)}
          alTocarEjemplo={() => setPronto(true)}
        />
        <View style={{ marginHorizontal: 16, marginTop: 8 }}>
          {cantidadTotal > 0 && (
            <Boton
              texto={`${t.verCarrito} (${cantidadTotal})`}
              alTocar={() => router.push('/cart')}
            />
          )}
          <Boton texto={tm.salir} alTocar={() => void salir()} secundario />
          <MenuCuenta />
        </View>
      </ScrollView>
      <BarraInferior idioma={idioma} activa="inicio" alTocar={pestana} />
      <ModalMuyPronto visible={pronto} cerrar={() => setPronto(false)} idioma={idioma} />
    </SafeAreaView>
  );
}
