import { type ReactNode, useState } from 'react';
import { View } from 'react-native';
import type { Api, Idioma } from '@tumbite/compartido';
import { Boton, COLOR, FUENTE, Icono, Text } from '@tumbite/movil';
import { TarjetaCara } from '../papeles/TusPapeles';
import { resumenPasos } from './esperaCiudadTextos';
import { type AccionFalta, type FaltaServidor, primeraFalta } from './queTeFaltaLogica';

/**
 * C-QUE-TE-FALTA y C-FOTO-CARA-A-LA-VISTA (23 nov 2026) — todos los países. UN solo bloque arriba del
 * inicio de Driver (encima de «Desliza para conectarte»): lo PRIMERO que le falta para recibir
 * carreras, con su botón que lleva directo a hacerlo. La foto de la cara es una de esas cosas (va con
 * su propia tarjeta, dentro de este mismo bloque, no compitiendo con otro aviso). Lo que está en manos
 * del equipo («Estamos revisando tu moto») se dice así, sin botón. Una cosa a la vez.
 */
export function QueTeFalta({
  api,
  idioma,
  faltas,
  alAccion,
  cuerpos,
  enEspera = false,
}: {
  api: Api;
  idioma: Idioma;
  faltas: readonly FaltaServidor[] | null;
  /** Lleva a hacerlo. Si devuelve un texto, es el error (se muestra junto al botón). */
  alAccion: (accion: AccionFalta, falta: FaltaServidor) => unknown;
  /**
   * Lo que se hace AHÍ MISMO en vez de un botón: la tarjeta del código del celular (`telefono`) o la
   * cuenta de pago móvil (`sin_pago_movil`).
   */
  cuerpos?: Partial<Record<string, ReactNode>>;
  /**
   * C-REGISTRO-TODO-EL-PAIS: su ciudad todavía no abre. Los pasos son para dejar la cuenta lista
   * («Deja tu cuenta lista»), nunca «para empezar» hoy.
   */
  enEspera?: boolean;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const p = primeraFalta(faltas, idioma, enEspera);
  if (!p) return null;
  const { aviso, falta, despues } = p;
  // Tramo 1 (encargo de Gerencia, 23 nov): UN resumen grande de cuántos pasos le faltan, y debajo el
  // primero, con su botón. En espera, el resumen dice para qué son («Deja tu cuenta lista»).
  const total = despues + 1;
  const resumen = resumenPasos(total, idioma, enEspera);
  const titulo = (
    <View style={{ gap: 4 }}>
      <Text
        testID="falta-resumen"
        accessibilityRole="header"
        style={{ fontFamily: FUENTE.titulo, fontSize: 20, lineHeight: 26 }}
      >
        {resumen.titulo}
      </Text>
      {resumen.nota ? (
        <Text
          testID="falta-resumen-nota"
          style={{ color: COLOR.textoSuave, fontSize: 14, lineHeight: 20 }}
        >
          {resumen.nota}
        </Text>
      ) : null}
    </View>
  );
  const nota = null;

  if (aviso.accion === 'cara')
    return (
      <View testID="que-te-falta" style={{ gap: 8 }}>
        {titulo}
        <TarjetaCara
          api={api}
          idioma={idioma}
          enEspera={enEspera}
          alTomar={() => void alAccion('cara', falta)}
        />
        {nota}
      </View>
    );
  const cuerpo = cuerpos ? new Map(Object.entries(cuerpos)).get(aviso.clave) : undefined;
  if (aviso.clave === 'telefono' && cuerpo)
    return (
      <View testID="que-te-falta" style={{ gap: 8 }}>
        {titulo}
        {cuerpo}
        {nota}
      </View>
    );

  async function tocar() {
    if (!aviso.accion || ocupado) return;
    setOcupado(true);
    setError('');
    try {
      const r = await alAccion(aviso.accion, falta);
      if (typeof r === 'string' && r) setError(r);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <View testID="que-te-falta" style={{ gap: 8 }}>
      {titulo}
      <View
        testID="que-te-falta-tarjeta"
        accessibilityRole="summary"
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: COLOR.borde,
          padding: 14,
          gap: 10,
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
            <Icono
              nombre={aviso.nuestro ? 'time-outline' : 'alert-circle-outline'}
              tamano={24}
              color={COLOR.texto}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text
              accessibilityRole="header"
              testID={`falta-${aviso.clave}`}
              style={{ fontFamily: FUENTE.tituloMedio, fontSize: 16, lineHeight: 21 }}
            >
              {aviso.titulo}
            </Text>
            <Text style={{ color: COLOR.textoSuave, fontSize: 13, lineHeight: 18 }}>
              {aviso.detalle}
            </Text>
          </View>
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={{ color: COLOR.error, fontWeight: '700' }}>
            {error}
          </Text>
        ) : null}
        {cuerpo ? (
          cuerpo
        ) : aviso.boton && aviso.accion ? (
          <Boton
            texto={aviso.boton}
            alTocar={() => void tocar()}
            cargando={ocupado}
            testID="falta-boton"
          />
        ) : null}
        {nota}
      </View>
    </View>
  );
}
