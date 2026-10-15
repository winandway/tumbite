import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ErrorApi, type Restaurante, enIdioma } from '@tumbite/compartido';
import { Boton, MenuCuenta, TEXTOS_MOVIL, e, useSesion } from '@tumbite/movil';
import { useCarrito } from './carrito';
import { TEXTOS } from './textos';
import { type Punto, miUbicacion } from './ubicacion';
import { AvisoPago } from './inicio/AvisoPago';
import { BarraInferior, type Pestana } from './inicio/BarraInferior';
import { Buscador } from './inicio/Buscador';
import { Cabecera } from './inicio/Cabecera';
import { ModalMuyPronto } from './inicio/ModalMuyPronto';
import { Ofertas } from './inicio/Ofertas';
import { Restaurantes } from './inicio/Restaurantes';
import { type Servicio, Servicios } from './inicio/Servicios';
import { textosInicio } from './inicio/textos';

/**
 * Inicio del cliente con el diseño aprobado (14 oct 2026): cabecera con logotipo y hamburguesa,
 * saludo, buscador, ocho servicios (solo «Comida» funciona), aviso de pago solo si hay un carrito
 * sin pagar, ofertas (de muestra hasta que haya reales), restaurantes cercanos y barra inferior.
 * Los datos son reales: restaurantes, carrito y sesión. Nada falso se puede comprar.
 */
export function Inicio() {
  const { api, idioma, usuario, salir, cambiarIdioma } = useSesion();
  const t = enIdioma(TEXTOS, idioma);
  const ti = textosInicio(idioma);
  const tm = enIdioma(TEXTOS_MOVIL, idioma);
  const { carrito, cantidadTotal } = useCarrito();
  const [lista, setLista] = useState<Restaurante[] | null>(null);
  const [error, setError] = useState('');
  const [puntoGps, setPuntoGps] = useState<Punto | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [pronto, setPronto] = useState(false);
  // La portada de tumbite.com puede mandar la ubicación por la dirección (?lat=&lng=).
  const params = useLocalSearchParams<{ lat?: string; lng?: string }>();

  const cargar = useCallback(
    async (p: Punto | null) => {
      try {
        const q = p ? `?lat=${p.lat}&lng=${p.lng}` : '';
        const r = await api.pedir<{ restaurantes: Restaurante[] }>(
          'GET',
          `/datos/restaurantes${q}`,
        );
        setError('');
        setLista(r.restaurantes);
      } catch (x) {
        setError(x instanceof ErrorApi ? x.message : String(x));
      }
    },
    [api],
  );

  // Los restaurantes salen enseguida, sin esperar la ubicación; cuando llega, se ordenan por
  // cercanía. Antes se esperaba la ubicación primero y, si el teléfono no contestaba, la lista no
  // aparecía nunca (candado C-UBICACION-NO-FRENA, lo destapó el recorrido completo).
  const deUrl = useMemo(
    () =>
      params.lat && params.lng && Number.isFinite(Number(params.lat))
        ? { lat: Number(params.lat), lng: Number(params.lng) }
        : null,
    [params.lat, params.lng],
  );
  const punto = deUrl ?? puntoGps;
  useEffect(() => {
    void (async () => {
      if (deUrl) return cargar(deUrl);
      // Primero la lista, sin esperar; la ubicación llega cuando llegue (o no llega).
      const primera = cargar(null);
      const p = await miUbicacion();
      await primera;
      if (!p) return;
      setPuntoGps(p);
      await cargar(p);
    })();
  }, [cargar, deUrl]);

  // El buscador filtra los restaurantes reales por nombre o tipo de comida; el filtro, solo abiertos.
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (lista ?? []).filter(
      (r) =>
        (!q || `${r.nombre} ${r.categoria}`.toLowerCase().includes(q)) &&
        (!soloAbiertos || (r.abiertoAhora ?? r.abierto)),
    );
  }, [lista, busqueda, soloAbiertos]);

  // Lo único que es un monto real pendiente: el carrito armado y sin pagar.
  const carritoCentavos = carrito.lineas.reduce((s, l) => s + l.precioCentavos * l.cantidad, 0);

  const servicio = (s: Servicio) => {
    // «Comida» abre la lista de restaurantes; los demás servicios llegan después.
    if (s === 'comida') return router.push('/restaurants');
    setPronto(true);
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
          alCampana={() => router.push('/account')}
          alCupon={() => router.push('/account')}
        />
        <Buscador
          idioma={idioma}
          valor={busqueda}
          cambiar={setBusqueda}
          soloAbiertos={soloAbiertos}
          alternarAbiertos={() => setSoloAbiertos((v) => !v)}
        />
        <Servicios idioma={idioma} alTocar={servicio} />
        <AvisoPago
          idioma={idioma}
          centavos={carritoCentavos}
          alPagar={() => router.push('/cart')}
        />
        <Ofertas idioma={idioma} alTocarEjemplo={() => setPronto(true)} />
        {!punto && (
          <Text style={{ color: '#5E5E5E', marginHorizontal: 16, marginTop: 14 }}>
            {ti.sinUbicacion}
          </Text>
        )}
        {error ? (
          <View style={{ marginHorizontal: 16, marginTop: 10 }}>
            <Text style={e.error}>{error}</Text>
            <Boton texto={t.reintentar} alTocar={() => void cargar(punto)} secundario />
          </View>
        ) : null}
        <Restaurantes
          idioma={idioma}
          lista={filtrados}
          cargando={lista === null}
          alTocar={(r) => router.push(`/restaurant/${r.id}`)}
          alTocarEjemplo={() => setPronto(true)}
        />
        {lista && lista.length === 0 && (
          <Text style={{ color: '#5E5E5E', marginHorizontal: 16 }}>{ti.sinRestaurantes}</Text>
        )}
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
