import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { enIdioma } from '@tumbite/compartido';
import { useSesion } from '@tumbite/movil';
import { ANCHO_MAX, Encabezado } from '../comida/piezas';
import { textosComida } from '../comida/textos';
import { PedirMoto } from '../viajes/PedirMoto';
import { type ViajePasajero, ViajeEnCurso } from '../viajes/ViajeEnCurso';
import { ContactosConfianza, PreguntaTodoBien } from '../viajes/Seguridad';
import { TEXTOS_MOTO } from '../viajes/textos';

const FINALES = new Set(['terminado', 'cancelado', 'sin_conductor', 'no_show']);

/**
 * Divoox Moto para el pasajero (M5). Si hay un viaje en curso se muestra ese (y se consulta cada
 * pocos segundos, como el seguimiento de Comida); si no, el formulario para pedir.
 */
export default function PantallaMoto() {
  const { api, idioma } = useSesion();
  const t = enIdioma(TEXTOS_MOTO, idioma);
  const tc = textosComida(idioma);
  // C-CARRO-PRUEBAS: la misma pantalla pide Moto o Carro.
  const servicio =
    useLocalSearchParams<{ servicio?: string }>().servicio === 'carro' ? 'carro' : 'moto';
  const [viaje, setViaje] = useState<ViajePasajero | null>(null);
  const [viajeId, setViajeId] = useState<string | null>(null);
  const [deuda, setDeuda] = useState<{ monto: number; moneda: string | null } | null>(null);
  // C-VIAJE-SEGURIDAD-2: el «¿Todo bien?» si el viaje se sale de la ruta.
  const [alerta, setAlerta] = useState<{ id: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      if (viajeId) {
        const r = await api.pedir<{ viaje: ViajePasajero; alerta?: { id: string } | null }>(
          'GET',
          `/datos/viajes/${viajeId}`,
        );
        setViaje(r.viaje);
        setAlerta(r.alerta ?? null);
        return;
      }
      const r = await api.pedir<{
        viaje: ViajePasajero | null;
        deudaPendiente: { monto: number; moneda: string | null } | null;
        alerta?: { id: string } | null;
      }>('GET', '/datos/viajes/actual');
      setViaje(r.viaje);
      setAlerta(r.alerta ?? null);
      setDeuda(r.deudaPendiente);
      if (r.viaje) setViajeId(r.viaje.id);
    } catch (e) {
      console.warn('moto: no se pudo cargar el viaje', e);
    }
  }, [api, viajeId]);

  useEffect(() => {
    const primero = setTimeout(() => void cargar(), 0);
    // Mientras el viaje no termina, se consulta cada 4 segundos (también mueve el despacho).
    const r = setInterval(() => {
      if (viajeId && !(viaje && FINALES.has(viaje.estado))) void cargar();
    }, 4_000);
    return () => {
      clearTimeout(primero);
      clearInterval(r);
    };
  }, [cargar, viajeId, viaje]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F6FB' }} edges={['top', 'left', 'right']}>
      <Encabezado
        titulo={servicio === 'carro' ? t.tituloCarro : t.titulo}
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
        }}
      >
        {viaje && alerta ? (
          <PreguntaTodoBien viajeId={viaje.id} alResponder={() => void cargar()} />
        ) : null}
        {viaje ? (
          <ViajeEnCurso
            viaje={viaje}
            alCambiar={() => void cargar()}
            alTerminar={() => {
              setViaje(null);
              setViajeId(null);
              void cargar();
            }}
          />
        ) : (
          <>
            <PedirMoto
              servicio={servicio}
              deudaPendiente={deuda}
              alPedir={(id) => setViajeId(id)}
            />
            <ContactosConfianza />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
