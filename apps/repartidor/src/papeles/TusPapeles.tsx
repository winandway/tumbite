import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import type { Api, Idioma } from '@tumbite/compartido';
import { COLOR, FUENTE, Icono, Text } from '@tumbite/movil';
import { useMiniaturas } from './AsistentePapeles';
import { AnilloPerfil } from './Horma';
import {
  type Verificacion,
  avanceDeFotos,
  estadoDePapel,
  nombreDePapel,
  tarjetaPapeles,
} from './logica';

/** Lo del asistente del conductor. Mirar solo LEE (la cuenta nueva estrena su plazo una vez). */
export function usePapeles(api: Api) {
  const [v, setV] = useState<Verificacion | null>(null);
  const recargar = useCallback(async () => {
    try {
      const r = await api.pedir<Verificacion>('GET', '/datos/conductor/verificacion');
      setV(r);
      return r;
    } catch {
      return null;
    }
  }, [api]);
  useEffect(() => {
    let vivo = true;
    api
      .pedir<Verificacion>('GET', '/datos/conductor/verificacion')
      .then((r) => {
        if (vivo) setV(r);
      })
      // Sin red o sin sesión: la tarjeta no sale y el inicio sigue igual; se reintenta al volver.
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [api]);
  return { v, recargar };
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
}: {
  api: Api;
  v: Verificacion | null;
  idioma: Idioma;
  alAbrir: () => void;
}) {
  const { uriDe } = useMiniaturas(api, v);
  const tarjeta = tarjetaPapeles(v, idioma);
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
        {v.papeles.map((p) => {
          const e = estadoDePapel(p.estado, idioma);
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
