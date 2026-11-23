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
 */
export function AvisoIa({
  api,
  idioma,
  alListo,
  plataforma = plataformaAviso(Platform.OS),
}: {
  api: Api;
  idioma: Idioma;
  alListo: (acepto: boolean) => void | Promise<unknown>;
  /** Solo para las pruebas: la plataforma real sale de `Platform.OS`. */
  plataforma?: 'ios' | 'android' | 'web';
}) {
  const t = textosAvisoIa(idioma);
  const [marcada, setMarcada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const conAlternativa = avisoConAlternativa(plataforma);

  async function contestar(acepto: boolean) {
    if (ocupado) return;
    if (acepto && !marcada) {
      setError(t.falta);
      return;
    }
    setOcupado(true);
    setError('');
    try {
      await api.pedir('POST', '/datos/conductor/aviso-ia', { acepto, plataforma, desde: 'aviso' });
      await alListo(acepto);
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} testID="aviso-ia">
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, flexGrow: 1 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: '#F2F3F5',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 12,
          }}
        >
          <Icono nombre="shield-checkmark-outline" tamano={28} color={COLOR.texto} />
        </View>
        <Text
          accessibilityRole="header"
          style={{ fontFamily: FUENTE.titulo, fontSize: 26, lineHeight: 32 }}
        >
          {t.titulo}
        </Text>
        <Text style={{ fontSize: 16, lineHeight: 24 }} testID="aviso-ia-texto">
          {t.texto}
        </Text>
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
            padding: 14,
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
          <Text style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>{t.casilla}</Text>
        </Pressable>
        <View style={{ flexGrow: 1 }} />
        <View
          // Apagado hasta marcar la casilla (no se acepta por omisión).
          style={{ opacity: marcada ? 1 : 0.45 }}
          accessibilityState={{ disabled: !marcada }}
          testID={marcada ? 'aviso-ia-boton-listo' : 'aviso-ia-boton-apagado'}
        >
          <Boton
            texto={t.boton}
            alTocar={() => void contestar(true)}
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
            style={{ paddingVertical: 12, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 16, fontWeight: '700', color: COLOR.texto }}>
              {t.alternativa}
            </Text>
          </Pressable>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={{ color: COLOR.error, textAlign: 'center' }}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
