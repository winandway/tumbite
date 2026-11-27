import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ErrorApi,
  lugarEscrito,
  textosSelectorLugar,
  type Api,
  type LugarCuenta,
  type RespuestaLugarCuenta,
} from '@tumbite/compartido';
import { Modal } from './Hoja';
import { Text } from './diseno';
import { COLOR, RADIO } from './tokens';
import { almacenTelefono } from './almacen';
import { useSesion } from './sesion';
import { usePaisSugerido } from './SelectorPaisTelefono';
import { PanelSelectorLugar, SelectorLugar } from './SelectorLugar';
import { Boton, e } from './ui';

/**
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026) — Venezuela y Estados Unidos. Después de crear la cuenta:
 * - si su ciudad todavía no tiene servicio (`enEspera`), se dice con claridad y sin bloquear nada
 *   («Tu cuenta quedó creada. En tu ciudad todavía no hay viajes; te avisamos apenas abramos.»);
 * - una cuenta vieja sin lugar (`lugar: null`) recibe UNA vez la pregunta «¿Dónde vives?», con el
 *   mismo selector, sin perder nada de lo que ya subió;
 * - Driver muestra su ciudad real («Maracaibo, Zulia») y la cambia con el selector, nunca con la
 *   lista de zonas abiertas (C-SIN-LISTA-DE-CIUDADES).
 * Lo lee de GET /datos/cuentas/lugar y lo cambia con PUT /datos/cuentas/lugar (servidor, parte B).
 */

type Guardado = { cuenta: string; datos: RespuestaLugarCuenta | null; pidiendo: boolean };
let guardado: Guardado = { cuenta: '', datos: null, pidiendo: false };
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((o) => o());
const suscribir = (o: () => void) => {
  oyentes.add(o);
  return () => {
    oyentes.delete(o);
  };
};

function pedirLugar(api: Api, cuenta: string) {
  if (guardado.cuenta === cuenta && (guardado.datos || guardado.pidiendo)) return;
  guardado = { cuenta, datos: null, pidiendo: true };
  avisar();
  api
    .lugarCuenta()
    .then((datos) => {
      if (guardado.cuenta === cuenta) guardado = { cuenta, datos, pidiendo: false };
    })
    .catch((x: unknown) => {
      // Un servidor sin la ruta todavía (404) o sin red: no se muestra nada ni se pregunta; la
      // próxima vez que se abra se vuelve a pedir. No es silencio: la pantalla sigue como siempre.
      if (guardado.cuenta === cuenta) guardado = { cuenta, datos: null, pidiendo: false };
      if (!(x instanceof ErrorApi)) console.warn('lugar de la cuenta', x);
    })
    .finally(avisar);
}

/** Dónde vive la cuenta abierta (o null mientras se lee) y cómo cambiarlo. */
export function useLugarCuenta() {
  const { api, usuario } = useSesion();
  const cuenta = usuario?.id ?? '';
  const g = useSyncExternalStore(suscribir, () => guardado);
  useEffect(() => {
    if (cuenta) pedirLugar(api, cuenta);
  }, [api, cuenta]);
  const datos = g.cuenta === cuenta ? g.datos : null;
  return {
    datos,
    async cambiar(lugar: LugarCuenta): Promise<RespuestaLugarCuenta> {
      const nuevo = await api.cambiarLugarCuenta(lugar);
      guardado = { cuenta, datos: nuevo, pidiendo: false };
      avisar();
      return nuevo;
    },
  };
}

const llavePreguntado = (cuenta: string) => `divoox.lugar-preguntado.${cuenta}`;
const llaveVisto = (cuenta: string) => `divoox.lugar-espera-visto.${cuenta}`;
const llaveOtroPais = (cuenta: string) => `divoox.lugar-otro-pais.${cuenta}`;

/**
 * C-REGISTRO-OTRO-PAIS (26 nov 2026): la cuenta dijo «Otro país» (vive fuera del catálogo). Ni la
 * pregunta «¿Dónde vives?» ni la tarjeta de su ciudad se le vuelven a mostrar en este teléfono: su
 * ciudad sale de la ubicación. Se guarda en memoria al momento (la app la lee al abrir el inicio,
 * antes de que termine de guardarse) y en el teléfono para las próximas veces.
 */
const otroPaisEnMemoria = new Set<string>();
export function marcarOtroPais(cuenta: string) {
  if (!cuenta) return;
  otroPaisEnMemoria.add(cuenta);
  void Promise.resolve(almacenTelefono.guardar(llaveOtroPais(cuenta), '1')).catch(() => undefined);
}
function useOtroPais(cuenta: string): boolean | null {
  const marca = useMarca(cuenta ? llaveOtroPais(cuenta) : '');
  if (otroPaisEnMemoria.has(cuenta)) return true;
  return marca.valor;
}

/** Lee una marca guardada en el teléfono (null mientras se lee). */
function useMarca(llave: string) {
  const [marca, setMarca] = useState<{ llave: string; valor: boolean } | null>(null);
  useEffect(() => {
    if (!llave) return;
    let vivo = true;
    void Promise.resolve(almacenTelefono.leer(llave))
      .then((v) => {
        if (vivo) setMarca({ llave, valor: Boolean(v) });
      })
      .catch(() => {
        if (vivo) setMarca({ llave, valor: false });
      });
    return () => {
      vivo = false;
    };
  }, [llave]);
  const valor = marca?.llave === llave ? marca.valor : null;
  return {
    valor,
    poner() {
      setMarca({ llave, valor: true });
      void Promise.resolve(almacenTelefono.guardar(llave, '1')).catch(() => undefined);
    },
  };
}

/**
 * La pregunta «¿Dónde vives?» para las cuentas sin lugar (las de antes de esta versión). Se
 * muestra UNA vez por cuenta, encima de la app, y se puede dejar para después: la tarjeta de su
 * ciudad (AvisoLugarCuenta) la sigue ofreciendo sin estorbar. Va junto a la pantalla, no la envuelve.
 */
export function PreguntaLugar({ rol }: { rol: 'cliente' | 'repartidor' }) {
  const { idioma, usuario } = useSesion();
  const t = textosSelectorLugar(idioma);
  const { datos, cambiar } = useLugarCuenta();
  const preguntado = useMarca(usuario ? llavePreguntado(usuario.id) : '');
  const otroPais = useOtroPais(usuario?.id ?? '');
  const paisSugerido = usePaisSugerido();
  const [despues, setDespues] = useState<RespuestaLugarCuenta | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const abierta =
    Boolean(usuario) &&
    ((datos !== null && datos.lugar === null && preguntado.valor === false && otroPais === false) ||
      despues !== null);
  const cerrar = () => {
    preguntado.poner();
    setDespues(null);
  };
  return (
    <Modal
      visible={abierta}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={cerrar}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.fondo }} testID="pregunta-lugar">
        {despues ? (
          <View style={{ padding: 24, gap: 12, flex: 1, justifyContent: 'center' }}>
            <Text style={{ fontSize: 22, fontWeight: '700' }} accessibilityRole="header">
              {despues.lugar ? lugarEscrito(despues.lugar) : t.tuCiudad}
            </Text>
            {despues.enEspera ? (
              <Text style={{ fontSize: 16 }} testID="pregunta-lugar-en-espera">
                {rol === 'repartidor' ? t.enEsperaConductor : t.enEsperaCliente}
              </Text>
            ) : null}
            {despues.enEspera && rol === 'repartidor' ? (
              <Text style={{ color: COLOR.textoSuave }}>{t.sigueSubiendo}</Text>
            ) : null}
            <Boton texto={t.entendido} alTocar={cerrar} testID="pregunta-lugar-entendido" />
          </View>
        ) : abierta ? (
          <View style={{ flex: 1 }}>
            <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              <Text style={{ color: COLOR.textoSuave }}>{t.preguntaAyuda}</Text>
              {guardando ? <Text style={{ marginTop: 6 }}>{t.guardando}</Text> : null}
              {error ? <Text style={e.error}>{error}</Text> : null}
            </View>
            <PanelSelectorLugar
              idioma={idioma}
              paisSugerido={paisSugerido}
              titulo={t.preguntaTitulo}
              alCerrar={cerrar}
              // C-REGISTRO-OTRO-PAIS: quien vive en otro país lo dice y no se le vuelve a preguntar.
              alElegirOtroPais={() => {
                if (usuario) marcarOtroPais(usuario.id);
                cerrar();
              }}
              alElegir={(l) => {
                setGuardando(true);
                setError('');
                cambiar(l)
                  .then((r) => {
                    preguntado.poner();
                    // Si su ciudad tiene servicio, se cierra; si espera, se le dice antes.
                    if (r.enEspera) setDespues(r);
                  })
                  .catch((x: unknown) =>
                    setError(x instanceof ErrorApi && x.message ? x.message : t.noSeGuardo),
                  )
                  .finally(() => setGuardando(false));
              }}
            />
            <Pressable
              onPress={cerrar}
              accessibilityRole="button"
              testID="pregunta-lugar-ahora-no"
              style={{ padding: 16 }}
            >
              <Text style={e.enlace}>{t.ahoraNo}</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

/**
 * La tarjeta de su ciudad en el inicio: sin lugar, «Dónde vives» con el selector; en espera, el
 * aviso claro de que su cuenta está creada y le avisamos al abrir. Con servicio, no ocupa lugar.
 * En la app de clientes el aviso de espera se ve hasta que toca «Entendido».
 */
export function AvisoLugarCuenta({
  rol,
  estilo,
}: {
  rol: 'cliente' | 'repartidor';
  /** Margen propio: cuando no hay nada que decir, no deja hueco. */
  estilo?: StyleProp<ViewStyle>;
}) {
  const { idioma, usuario } = useSesion();
  const t = textosSelectorLugar(idioma);
  const { datos, cambiar } = useLugarCuenta();
  const visto = useMarca(usuario && rol === 'cliente' ? llaveVisto(usuario.id) : '');
  const otroPais = useOtroPais(usuario?.id ?? '');
  const [otroAhora, setOtroAhora] = useState(false);
  const paisSugerido = usePaisSugerido();
  const [error, setError] = useState('');
  if (!datos || !usuario) return null;
  if (datos.lugar && !datos.enEspera) return null;
  // C-REGISTRO-OTRO-PAIS: dijo que vive en otro país (o todavía no se sabe): la tarjeta no estorba.
  if (!datos.lugar && (otroAhora || otroPais !== false)) return null;
  // En la app de clientes, sin lugar pregunta una sola vez la ventana (PreguntaLugar), no el inicio.
  if (rol === 'cliente' && !datos.lugar) return null;
  if (rol === 'cliente' && datos.lugar && visto.valor !== false) return null;
  const elegir = (l: LugarCuenta) => {
    setError('');
    cambiar(l).catch((x: unknown) =>
      setError(x instanceof ErrorApi && x.message ? x.message : t.noSeGuardo),
    );
  };
  return (
    <View
      testID="aviso-lugar-cuenta"
      style={[
        {
          backgroundColor: COLOR.blanco,
          borderWidth: 1,
          borderColor: COLOR.borde,
          borderRadius: RADIO.m,
          padding: 14,
          gap: 8,
        },
        estilo,
      ]}
    >
      {datos.enEspera ? (
        <>
          <Text style={{ fontSize: 15, fontWeight: '600' }} testID="aviso-lugar-en-espera">
            {rol === 'repartidor' ? t.enEsperaConductor : t.enEsperaCliente}
          </Text>
          {rol === 'repartidor' ? (
            <Text style={{ color: COLOR.textoSuave }}>{t.sigueSubiendo}</Text>
          ) : null}
        </>
      ) : (
        <Text style={{ fontSize: 15, fontWeight: '600' }}>{t.preguntaTitulo}</Text>
      )}
      <SelectorLugar
        valor={datos.lugar}
        alElegir={elegir}
        idioma={idioma}
        paisSugerido={paisSugerido}
        etiqueta={t.tuCiudad}
        error={error || undefined}
        testID="aviso-lugar-selector"
        // Sin lugar todavía: quien vive en otro país lo dice y la tarjeta se va.
        alElegirOtroPais={
          datos.lugar
            ? undefined
            : () => {
                marcarOtroPais(usuario.id);
                setOtroAhora(true);
              }
        }
      />
      {rol === 'cliente' && datos.lugar ? (
        <Pressable onPress={visto.poner} accessibilityRole="button" testID="aviso-lugar-entendido">
          <Text style={e.enlaceLinea}>{t.entendido}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Driver, en «Moto» y «Carro»: su ciudad real con «Cambiar», que abre el selector. `respaldo` es el
 * nombre de su zona si el servidor todavía no conoce su lugar. `alCambiar` recarga sus papeles.
 */
export function TarjetaMiLugar({
  respaldo,
  puedeCambiar = true,
  alCambiar,
  nota,
}: {
  respaldo?: string;
  puedeCambiar?: boolean;
  alCambiar?: () => void;
  nota?: string;
}) {
  const { idioma } = useSesion();
  const t = textosSelectorLugar(idioma);
  const { datos, cambiar } = useLugarCuenta();
  const paisSugerido = usePaisSugerido();
  const [error, setError] = useState('');
  const lugar = datos?.lugar ?? null;
  return (
    <View style={e.tarjeta} testID="tarjeta-mi-lugar">
      {puedeCambiar ? (
        <SelectorLugar
          valor={lugar}
          etiqueta={t.tuCiudad}
          idioma={idioma}
          paisSugerido={paisSugerido}
          error={error || undefined}
          testID="mi-lugar-cambiar"
          alElegir={(l) => {
            setError('');
            cambiar(l)
              .then(() => alCambiar?.())
              .catch((x: unknown) =>
                setError(x instanceof ErrorApi && x.message ? x.message : t.noSeGuardo),
              );
          }}
        />
      ) : (
        <>
          <Text style={{ color: COLOR.textoSuave, fontSize: 12 }}>{t.tuCiudad}</Text>
          <Text style={{ fontWeight: '700' }}>
            {lugar ? lugarEscrito(lugar) : (respaldo ?? '')}
          </Text>
        </>
      )}
      {!lugar && respaldo && puedeCambiar ? (
        <Text style={{ color: COLOR.textoSuave, fontSize: 12 }}>{respaldo}</Text>
      ) : null}
      {datos?.enEspera ? (
        <Text style={{ color: COLOR.textoSuave, fontSize: 13 }} testID="mi-lugar-en-espera">
          {t.enEsperaConductor}
        </Text>
      ) : null}
      {nota ? <Text style={{ color: COLOR.textoSuave, fontSize: 12 }}>{nota}</Text> : null}
    </View>
  );
}
