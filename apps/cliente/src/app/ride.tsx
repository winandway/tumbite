import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { enIdioma, ESPERA_MAXIMA_CRITICA_MS, llaveBorrador } from '@tumbite/compartido';
import { almacenTelefono, useSesion, useSondeo } from '@tumbite/movil';
import { rellenoDeEsteViaje } from '../viajes/mismaRuta';
import { marcarRelleno } from '../viajes/relleno';
import { ANCHO_MAX, Encabezado } from '../comida/piezas';
import { textosComida } from '../comida/textos';
import { PedirMoto } from '../viajes/PedirMoto';
import { type PaqueteCliente, type ViajePasajero, ViajeEnCurso } from '../viajes/ViajeEnCurso';
import { ContactosConfianza, PreguntaTodoBien } from '../viajes/Seguridad';
import { MisViajes } from '../viajes/MisViajes';
import { TEXTOS_MOTO } from '../viajes/textos';
import { conCuenta } from '../ConCuenta';

const FINALES = new Set(['terminado', 'cancelado', 'sin_conductor', 'no_show']);

/**
 * Divoox Moto para el pasajero (M5). Si hay un viaje en curso se muestra ese (y se consulta cada
 * pocos segundos, como el seguimiento de Comida); si no, el formulario para pedir.
 */
function PantallaMoto() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(TEXTOS_MOTO, idioma);
  const tc = textosComida(idioma);
  // C-CARRO-PRUEBAS: la misma pantalla pide Moto o Carro.
  const pedido = useLocalSearchParams<{ servicio?: string }>().servicio;
  const servicio = pedido === 'carro' || pedido === 'envios' ? pedido : 'moto';
  // C-ENVIOS: lo que se envía (quién recibe y su PIN de entrega).
  const [paquete, setPaquete] = useState<PaqueteCliente | null>(null);
  const [viaje, setViaje] = useState<ViajePasajero | null>(null);
  const [viajeId, setViajeId] = useState<string | null>(null);
  const [deuda, setDeuda] = useState<{ monto: number; moneda: string | null } | null>(null);
  // C-VIAJE-SEGURIDAD-2: el «¿Todo bien?» si el viaje se sale de la ruta.
  const [alerta, setAlerta] = useState<{ id: string } | null>(null);
  // C-MISMA-RUTA: «Cambiar algo» deja Pedir viaje escrito; se vuelve a montar para leerlo.
  const [vueltaPedir, setVueltaPedir] = useState(0);
  const lista = useRef<ScrollView>(null);

  const cargar = useCallback(async () => {
    try {
      if (viajeId) {
        const r = await api.pedir<{
          viaje: ViajePasajero;
          alerta?: { id: string } | null;
          paquete?: PaqueteCliente | null;
        }>('GET', `/datos/viajes/${viajeId}`);
        setViaje(r.viaje);
        setPaquete(r.paquete ?? null);
        setAlerta(r.alerta ?? null);
        return;
      }
      const r = await api.pedir<{
        viaje: ViajePasajero | null;
        deudaPendiente: { monto: number; moneda: string | null } | null;
        alerta?: { id: string } | null;
        paquete?: PaqueteCliente | null;
      }>(
        'GET',
        servicio === 'envios' ? '/datos/viajes/actual?servicio=envios' : '/datos/viajes/actual',
      );
      setViaje(r.viaje);
      setPaquete(r.paquete ?? null);
      setAlerta(r.alerta ?? null);
      setDeuda(r.deudaPendiente);
      if (r.viaje) setViajeId(r.viaje.id);
    } catch (e) {
      console.warn('moto: no se pudo cargar el viaje', e);
      return false;
    }
  }, [api, viajeId, servicio]);

  // Al abrir, una vez. Mientras el viaje no termina, cada 4 segundos (también mueve el despacho);
  // si falla, cada vez más espaciado.
  // C-SESION-TERMINADA (18 nov 2026): antes el efecto dependía de `viaje`; cada respuesta creaba un
  // viaje nuevo, el efecto se rearmaba y volvía a preguntar AL INSTANTE: un bucle de peticiones sin
  // pausa mientras la pantalla estaba abierta.
  const primeraVez = useRef(true);
  // Si terminó se lee en el momento (no en las dependencias): cambiar de estado no rearma el
  // sondeo ni pide una vez de más.
  const terminado = useRef(false);
  const terminadoAhora = Boolean(viaje && FINALES.has(viaje.estado));
  useEffect(() => {
    terminado.current = terminadoAhora;
  }, [terminadoAhora]);
  const vuelta = useCallback(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return cargar();
    }
    return viajeId && !terminado.current ? cargar() : true;
  }, [cargar, viajeId]);
  // El viaje no puede llegar tarde (el conductor llegó): con fallos, como mucho cada 20 s.
  useSondeo(vuelta, 4_000, true, true, { topeMs: ESPERA_MAXIMA_CRITICA_MS });

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: viaje ? '#F6F6F6' : '#FFFFFF' }}
      edges={['top', 'left', 'right']}
    >
      <Encabezado
        titulo={
          servicio === 'carro' ? t.tituloCarro : servicio === 'envios' ? t.tituloEnvios : t.titulo
        }
        alVolver={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        etiquetaVolver={tc.volver}
      />
      {viaje ? (
        <ScrollView
          ref={lista}
          // C-TECLADO-NO-TAPA (31 oct 2026): el teclado no tapa el formulario y se esconde al deslizar.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            padding: 16,
            paddingBottom: 32,
            width: '100%',
            maxWidth: ANCHO_MAX,
            alignSelf: 'center',
          }}
        >
          {alerta ? (
            <PreguntaTodoBien viajeId={viaje.id} alResponder={() => void cargar()} />
          ) : null}
          <ViajeEnCurso
            viaje={viaje}
            paquete={paquete}
            alCambiar={() => void cargar()}
            alTerminar={async () => {
              // C-PEDIR-OTRA-VEZ: el formulario abre con ESTE viaje escrito (recogida, destino,
              // paradas, categoría y pago), como «Cambiar algo» de Mis viajes.
              const relleno = rellenoDeEsteViaje({
                ...viaje,
                servicio: viaje.servicio ?? servicio,
              });
              if (relleno) {
                await Promise.resolve(
                  almacenTelefono.guardar(
                    llaveBorrador(viaje.servicio ?? servicio, usuario?.id),
                    JSON.stringify(relleno),
                  ),
                ).catch((e: unknown) =>
                  console.warn('pedir otra vez: no se pudo dejar escrito', e),
                );
                marcarRelleno(viaje.servicio ?? servicio);
                setVueltaPedir((n) => n + 1);
              }
              setViaje(null);
              setViajeId(null);
              void cargar();
            }}
          />
        </ScrollView>
      ) : (
        // C-INICIO-NUEVO (borrador aprobado): el formulario tiene su propio scroll y el botón fijo
        // abajo. Viajes fijos y Conductores de confianza viven en «Más servicios» del inicio.
        <PedirMoto
          key={vueltaPedir}
          servicio={servicio}
          deudaPendiente={deuda}
          alPedir={(id) => setViajeId(id)}
          extras={
            servicio !== 'envios' ? (
              <>
                <ContactosConfianza />
                {/* C-VIAJES-HISTORIAL y C-MISMA-RUTA: los viajes anteriores con «Pedir la misma ruta». */}
                <MisViajes
                  alPedir={(id, otro) =>
                    otro === servicio
                      ? setViajeId(id)
                      : router.replace({ pathname: '/ride', params: { servicio: otro } })
                  }
                  alCambiar={(otro) => {
                    if (otro !== servicio)
                      return router.replace({ pathname: '/ride', params: { servicio: otro } });
                    setVueltaPedir((n) => n + 1);
                  }}
                />
              </>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

export default conCuenta(PantallaMoto);
