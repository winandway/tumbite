import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { type Api, ErrorApi, type Idioma } from '@tumbite/compartido';
import { Boton, COLOR, FUENTE, Icono, Text } from '@tumbite/movil';
import { textoCara } from '../piezas/esperaCiudadTextos';
import { useMiniaturas } from './AsistentePapeles';
import { AnilloPerfil } from './Horma';
import {
  type Verificacion,
  avanceDeFotos,
  conFotosLocales,
  estadoDePapel,
  nombreDePapel,
  tarjetaPapeles,
} from './logica';

/**
 * Lo del asistente del conductor. Mirar solo LEE (la cuenta nueva estrena su plazo una vez).
 * C-FOTO-CARA-A-LA-VISTA: si la lectura falla se dice (`error`) y se puede reintentar; antes la tarjeta
 * no salía y nada lo explicaba. `marcar` y `fotoSubida` ponen al día lo que ya se sabe (el aviso
 * contestado, la foto que ya subió) aunque la relectura falle con mala señal.
 */
export function usePapeles(api: Api) {
  const [v, setV] = useState<Verificacion | null>(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const vivo = useRef(true);
  const recargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.pedir<Verificacion>('GET', '/datos/conductor/verificacion?opcionales=1');
      if (vivo.current) {
        setV(r);
        setError('');
      }
      return r;
    } catch (x) {
      if (vivo.current) setError(x instanceof ErrorApi && x.message ? x.message : String(x));
      return null;
    } finally {
      if (vivo.current) setCargando(false);
    }
  }, [api]);
  useEffect(() => {
    vivo.current = true;
    const primero = setTimeout(() => void recargar(), 0);
    return () => {
      clearTimeout(primero);
      vivo.current = false;
    };
  }, [recargar]);
  const marcar = useCallback(
    (cambio: Partial<Verificacion>) => setV((x) => (x ? { ...x, ...cambio } : x)),
    [],
  );
  const fotoSubida = useCallback(
    (paso: string) =>
      setV((x) => (x ? conFotosLocales(x, new Map([[paso, new Date().toISOString()]])) : x)),
    [],
  );
  return { v, recargar, error, cargando, marcar, fotoSubida };
}

/** Una vez por sesión de la app: el servidor igual guarda solo la primera (C-FOTO-CARA-A-LA-VISTA). */
let tarjetaCaraAnotada = false;

const TEXTOS_CARA = {
  es: {
    boton: 'Tomar mi foto',
    sinPapeles: 'No pudimos cargar tus papeles',
    sinPapelesTexto: 'Revisa tu señal y vuelve a intentarlo.',
    reintentar: 'Reintentar',
  },
  en: {
    boton: 'Take my photo',
    sinPapeles: 'We couldn’t load your documents',
    sinPapelesTexto: 'Check your signal and try again.',
    reintentar: 'Retry',
  },
};

/**
 * C-FOTO-CARA-A-LA-VISTA (23 nov 2026): mientras la cara sea lo que le falta para empezar, esta
 * tarjeta va ARRIBA DE TODO en el inicio (encima de «Desliza para conectarte»), corta y con su botón
 * a la vista en un celular chico (360×568). Antes quedaba cortada abajo y nunca se veía el botón.
 */
export function TarjetaCara({
  api,
  idioma,
  alTomar,
  enEspera = false,
}: {
  api: Api;
  idioma: Idioma;
  alTomar: () => void;
  /** C-REGISTRO-TODO-EL-PAIS: su ciudad todavía no abre (la foto deja la cuenta lista, no «empieza»). */
  enEspera?: boolean;
}) {
  const t = {
    ...(idioma === 'en' ? TEXTOS_CARA.en : TEXTOS_CARA.es),
    ...textoCara(idioma, enEspera),
  };
  useEffect(() => {
    if (tarjetaCaraAnotada) return;
    tarjetaCaraAnotada = true;
    void api.hito('tarjeta_cara_vista');
  }, [api]);
  return (
    <View
      testID="tarjeta-cara"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLOR.borde,
        padding: 14,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: COLOR.superficie,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre="person-circle-outline" tamano={26} color={COLOR.texto} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            accessibilityRole="header"
            style={{ fontFamily: FUENTE.tituloMedio, fontSize: 16, lineHeight: 21 }}
          >
            {t.titulo}
          </Text>
          <Text style={{ color: COLOR.textoSuave, fontSize: 13, lineHeight: 18 }}>{t.detalle}</Text>
        </View>
      </View>
      <Boton texto={t.boton} icono="camera-outline" alTocar={alTomar} testID="tarjeta-cara-tomar" />
    </View>
  );
}

/** Si «Tus papeles» no se pudo leer: se dice y se reintenta (antes la tarjeta simplemente no salía). */
export function PapelesSinCargar({
  idioma,
  cargando,
  alReintentar,
}: {
  idioma: Idioma;
  cargando: boolean;
  alReintentar: () => void;
}) {
  const t = idioma === 'en' ? TEXTOS_CARA.en : TEXTOS_CARA.es;
  return (
    <View
      testID="papeles-sin-cargar"
      accessibilityRole="alert"
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLOR.borde,
        padding: 14,
        gap: 10,
      }}
    >
      <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 15, color: COLOR.error }}>
        {t.sinPapeles}
      </Text>
      <Text style={{ color: COLOR.textoSuave, fontSize: 13, lineHeight: 18 }}>
        {t.sinPapelesTexto}
      </Text>
      <Boton
        texto={t.reintentar}
        alTocar={alReintentar}
        cargando={cargando}
        secundario
        testID="papeles-reintentar"
      />
    </View>
  );
}

const COLORES = {
  normal: { borde: COLOR.borde, texto: COLOR.texto },
  aviso: { borde: COLOR.aviso, texto: COLOR.aviso },
  problema: { borde: COLOR.error, texto: COLOR.error },
  exito: { borde: COLOR.exitoBorde, texto: COLOR.exito },
};

/**
 * C-ASISTENTE-DRIVER: «Tus papeles» en el inicio de Driver. La tarjeta de perfil que se va armando
 * (su cara en el anillo verde), los días que le quedan, cada papel con su estado (lo aprobado en
 * verde) y el botón que abre el asistente donde lo dejó. Con todo aprobado, o donde el país no usa
 * el asistente, no dibuja nada.
 */
export function TusPapeles({
  api,
  v,
  idioma,
  alAbrir,
  enEspera = false,
}: {
  api: Api;
  v: Verificacion | null;
  idioma: Idioma;
  alAbrir: () => void;
  /** C-REGISTRO-TODO-EL-PAIS: su ciudad todavía no abre. */
  enEspera?: boolean;
}) {
  const { uriDe } = useMiniaturas(api, v);
  const tarjeta = tarjetaPapeles(v, idioma, enEspera);
  if (!v || !tarjeta) return null;
  const { listas, total } = avanceDeFotos(v);
  const cara = v.pasos.find((p) => p.paso === 'cara');
  const c = COLORES[tarjeta.tono];
  return (
    <Pressable
      testID="tus-papeles"
      onPress={alAbrir}
      accessibilityRole="button"
      accessibilityLabel={`${tarjeta.titulo}. ${tarjeta.detalle} ${tarjeta.accion}`}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.borde,
        padding: 14,
        marginTop: 10,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <AnilloPerfil uri={cara ? uriDe(cara) : null} hechas={listas} total={total} lado={68} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 16, color: c.texto }}>
            {tarjeta.titulo}
          </Text>
          <Text style={{ color: COLOR.textoSuave, fontSize: 13, lineHeight: 18 }}>
            {tarjeta.detalle}
          </Text>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        {[...v.papeles]
          // La cara primero, como en el asistente: es la que deja empezar.
          .sort((a, b) => Number(b.papel === 'cara') - Number(a.papel === 'cara'))
          .map((p) => {
            // Tramo 1 (registro real, 23 nov): la cara tomada ya le deja trabajar; no se dice «Lista
            // para enviar» como si faltara algo de su lado.
            const e =
              p.papel === 'cara' && p.estado === 'por_enviar' && v.plazo.estado === 'en_plazo'
                ? {
                    texto: idioma === 'en' ? 'Ready: you can work' : 'Lista: ya puedes trabajar',
                    tono: 'exito' as const,
                  }
                : estadoDePapel(p.estado, idioma);
            return (
              <View
                key={p.papel}
                testID={`tus-papeles-${p.papel}`}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}
              >
                <Text style={{ fontSize: 14 }}>{nombreDePapel(p.papel, idioma)}</Text>
                <Text
                  style={{
                    fontFamily: FUENTE.textoFuerte,
                    fontSize: 13,
                    color:
                      e.tono === 'exito'
                        ? COLOR.exito
                        : e.tono === 'aviso'
                          ? COLOR.aviso
                          : COLOR.textoSuave,
                  }}
                >
                  {e.tono === 'exito' ? '✓ ' : ''}
                  {e.texto}
                </Text>
              </View>
            );
          })}
      </View>
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}
      >
        <Text style={{ fontFamily: FUENTE.tituloMedio, fontSize: 14 }}>{tarjeta.accion}</Text>
        <Icono nombre="chevron-forward" tamano={16} />
      </View>
    </Pressable>
  );
}
