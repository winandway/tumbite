import { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { type Api, ErrorApi, type Idioma } from '@tumbite/compartido';
import { Boton, COLOR, FUENTE, Icono, Text, abrirPagina } from '@tumbite/movil';
import {
  avisoConAlternativa,
  plataformaAviso,
  politicaDePrivacidad,
  textosAvisoIa,
} from './textosAvisoIa';

/**
 * C-AVISO-IA-UNICO (21 nov 2026, dictamen duodécimo). La pantalla propia del aviso de IA: antes de la
 * primera foto y del permiso de cámara, y una vez al entrar para las cuentas que no lo contestaron.
 * Casilla sin marcar, botón apagado hasta marcarla. En iPhone, además, «Prefiero revisión solo por
 * una persona» (la única diferencia entre plataformas; ver CANDADOS.md).
 *
 * C-FOTO-CARA-A-LA-VISTA (23 nov 2026): arriba un resumen corto (quién recibe qué); el texto completo
 * del dictamen sigue en la misma pantalla con «Ver todo el texto». La casilla y el botón van en el pie
 * FIJO: a la vista sin deslizar en un celular chico (antes había que deslizar para encontrarlos). Si
 * la respuesta se guardó pero la pantalla no se pudo actualizar, se dice y se reintenta.
 */
export function AvisoIa({
  api,
  idioma,
  alListo,
  plataforma = plataformaAviso(Platform.OS),
}: {
  api: Api;
  idioma: Idioma;
  /** Devuelve false (o null) si no pudo poner al día la pantalla: se dice y se reintenta. */
  alListo: (acepto: boolean) => unknown;
  /** Solo para las pruebas: la plataforma real sale de `Platform.OS`. */
  plataforma?: 'ios' | 'android' | 'web';
}) {
  const t = textosAvisoIa(idioma);
  const [marcada, setMarcada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [todo, setTodo] = useState(false);
  // La respuesta ya quedó guardada en el servidor; falta poner al día la pantalla.
  const [guardada, setGuardada] = useState<boolean | null>(null);
  const conAlternativa = avisoConAlternativa(plataforma);

  async function terminar(acepto: boolean) {
    const r = await Promise.resolve(alListo(acepto));
    if (r === false || r === null) setError(t.relectura);
  }

  async function contestar(acepto: boolean) {
    if (ocupado) return;
    if (acepto && !marcada) {
      setError(t.falta);
      return;
    }
    setOcupado(true);
    setError('');
    try {
      if (guardada === null) {
        await api.pedir('POST', '/datos/conductor/aviso-ia', {
          acepto,
          plataforma,
          desde: 'aviso',
        });
        setGuardada(acepto);
      }
      await terminar(guardada ?? acepto);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} testID="aviso-ia">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: 16,
          gap: 14,
        }}
      >
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#F2F3F5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icono nombre="shield-checkmark-outline" tamano={24} color={COLOR.texto} />
        </View>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: FUENTE.titulo, fontSize: 24, lineHeight: 30 }}
        >
          {t.titulo}
        </Text>
        <Text style={{ fontSize: 16, lineHeight: 23 }} testID="aviso-ia-resumen">
          {t.resumen}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: todo }}
          onPress={() => setTodo((x) => !x)}
          testID="aviso-ia-ver-mas"
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text style={{ fontSize: 15, fontFamily: FUENTE.textoFuerte }}>
            {todo ? t.verMenos : t.verMas}
          </Text>
          <Icono nombre={todo ? 'chevron-up' : 'chevron-down'} tamano={16} />
        </Pressable>
        {todo ? (
          <Text
            style={{ fontSize: 15, lineHeight: 22, color: COLOR.textoSuave }}
            testID="aviso-ia-texto"
          >
            {t.texto}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="link"
          // C-PAGINA-EN-APP: la política se abre dentro de la app, no en el navegador.
          onPress={() => abrirPagina(politicaDePrivacidad(idioma))}
          testID="aviso-ia-politica"
        >
          <Text style={{ fontSize: 15, fontWeight: '700', textDecorationLine: 'underline' }}>
            {t.politica}
          </Text>
        </Pressable>
      </ScrollView>
      {/* El pie fijo: la casilla y el botón siempre a la vista. */}
      <View
        testID="aviso-ia-pie"
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 14,
          gap: 10,
          borderTopWidth: 1,
          borderTopColor: COLOR.borde,
          backgroundColor: '#FFFFFF',
        }}
      >
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: marcada }}
          onPress={() => {
            setMarcada((x) => !x);
            setError('');
          }}
          testID="aviso-ia-casilla"
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'flex-start',
            borderWidth: 1,
            borderColor: COLOR.bordeFuerte,
            borderRadius: 12,
            padding: 12,
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              borderWidth: 2,
              borderColor: marcada ? COLOR.exito : '#6B7078',
              backgroundColor: marcada ? COLOR.exito : '#FFFFFF',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 1,
            }}
          >
            {marcada ? <Icono nombre="checkmark" tamano={16} color="#FFFFFF" /> : null}
          </View>
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{t.casilla}</Text>
        </Pressable>
        {error ? (
          <Text
            accessibilityRole="alert"
            testID="aviso-ia-error"
            style={{ color: COLOR.error, textAlign: 'center', fontWeight: '700' }}
          >
            {error}
          </Text>
        ) : null}
        <View
          // Apagado hasta marcar la casilla (no se acepta por omisión).
          style={{ opacity: marcada ? 1 : 0.45 }}
          accessibilityState={{ disabled: !marcada }}
          testID={marcada ? 'aviso-ia-boton-listo' : 'aviso-ia-boton-apagado'}
        >
          <Boton
            texto={guardada !== null && error ? t.reintentar : t.boton}
            alTocar={() => void contestar(guardada ?? true)}
            cargando={ocupado}
            testID="aviso-ia-aceptar"
          />
        </View>
        {conAlternativa ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void contestar(false)}
            disabled={ocupado}
            testID="aviso-ia-solo-persona"
            style={{ paddingVertical: 8, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 15, fontWeight: '700', color: COLOR.texto }}>
              {t.alternativa}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
