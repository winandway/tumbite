import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  crearCatalogoLugares,
  estadoDelPais,
  estadoEscrito,
  lugarEscrito,
  nombrePais,
  paisesParaElegir,
  textosSelectorLugar,
  useSelectorLugar,
  type Idioma,
  type LugarCatalogo,
  type LugarCuenta,
  type ResultadoLugar,
} from '@tumbite/compartido';
import { Modal } from './Hoja';
import { Icono, Text } from './diseno';
import { COLOR, RADIO } from './tokens';
import { URL_SERVIDOR } from './sesion';
import { banderaDe } from './SelectorPaisTelefono';
import { e } from './ui';

/**
 * C-REGISTRO-TODO-EL-PAIS (25 nov 2026) — Venezuela y Estados Unidos. «Dónde vives», UNA sola
 * pieza para la app de clientes y Driver (y su versión web): País → Estado → Ciudad, con un buscador
 * directo arriba que sugiere desde la primera letra. El catálogo es el de todo el país (GeoNames,
 * archivos fijos del sitio): nunca la lista de zonas abiertas (C-SIN-LISTA-DE-CIUDADES). Quien no
 * encuentra su pueblo elige su municipio o condado: nadie se queda sin poder seguir.
 */

/** El catálogo se lee del mismo sitio que la API de la app (y queda en memoria). */
export const CATALOGO_LUGARES = crearCatalogoLugares({ base: URL_SERVIDOR });

/** La casilla del formulario: muestra lo elegido y abre la ventana del selector. */
export function SelectorLugar({
  valor,
  alElegir,
  idioma,
  paisSugerido,
  error,
  testID = 'selector-lugar',
  etiqueta,
  otroPais = false,
  alElegirOtroPais,
}: {
  valor: LugarCuenta | null;
  alElegir: (l: LugarCuenta) => void;
  idioma: Idioma;
  paisSugerido?: string | null;
  error?: string;
  testID?: string;
  /** Otra etiqueta arriba de la casilla (p. ej. «Tu ciudad» en Driver). */
  etiqueta?: string;
  /** C-REGISTRO-OTRO-PAIS: eligió «Otro país» (vive fuera del catálogo). */
  otroPais?: boolean;
  /** Si viene, la lista de países ofrece «Otro país» al final (solo en el registro). */
  alElegirOtroPais?: () => void;
}) {
  const t = textosSelectorLugar(idioma);
  const [abierto, setAbierto] = useState(false);
  const elegido = Boolean(valor) || otroPais;
  const texto = valor ? lugarEscrito(valor) : otroPais ? t.otroPais : t.elegir;
  return (
    <View style={e.campo}>
      <Text style={e.etiqueta}>{etiqueta ?? t.etiqueta}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta ?? t.etiqueta}: ${texto}`}
        testID={testID}
        onPress={() => setAbierto(true)}
        style={[
          e.input,
          error ? e.inputError : null,
          { flexDirection: 'row', alignItems: 'center', gap: 8 },
        ]}
      >
        <Icono nombre="location-outline" color={COLOR.textoSuave} />
        <Text
          style={{ flex: 1, fontSize: 16, color: elegido ? COLOR.texto : COLOR.textoTenue }}
          // El lugar se lee entero («Salinas, California (CA)»): en dos renglones si no cabe, nunca cortado.
          numberOfLines={2}
        >
          {valor ? `${banderaDe(valor.pais)} ${lugarEscrito(valor)}` : texto}
        </Text>
        <Text style={{ color: COLOR.textoSuave, fontWeight: '600' }}>
          {elegido ? t.cambiar : '▾'}
        </Text>
      </Pressable>
      {otroPais && !valor ? (
        <Text style={{ color: COLOR.textoSuave, fontSize: 13, marginTop: 6 }}>
          {t.otroPaisAyuda}
        </Text>
      ) : null}
      {error ? <Text style={e.error}>{error}</Text> : null}
      <Modal
        visible={abierto}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setAbierto(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.fondo }}>
          {abierto ? (
            <PanelSelectorLugar
              idioma={idioma}
              paisSugerido={paisSugerido}
              inicial={valor}
              alCerrar={() => setAbierto(false)}
              alElegir={(l) => {
                setAbierto(false);
                alElegir(l);
              }}
              alElegirOtroPais={
                alElegirOtroPais &&
                (() => {
                  setAbierto(false);
                  alElegirOtroPais();
                })
              }
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/**
 * El cuerpo del selector, sin ventana: lo usa la ventana de arriba y la pregunta «¿Dónde vives?»
 * (que ya es una ventana; una ventana nunca se abre encima de otra).
 */
export function PanelSelectorLugar({
  idioma,
  paisSugerido,
  inicial,
  alElegir,
  alCerrar,
  titulo,
  alElegirOtroPais,
}: {
  idioma: Idioma;
  paisSugerido?: string | null;
  inicial?: LugarCuenta | null;
  alElegir: (l: LugarCuenta) => void;
  alCerrar?: () => void;
  /** C-REGISTRO-OTRO-PAIS: «Otro país» al final de la lista de países. */
  alElegirOtroPais?: () => void;
  /** Título propio del primer paso (p. ej. «¿Dónde vives?»). */
  titulo?: string;
}) {
  const t = textosSelectorLugar(idioma);
  const s = useSelectorLugar({ catalogo: CATALOGO_LUGARES, paisSugerido, inicial, alElegir });
  const est = s.pais && s.estado ? estadoDelPais(s.pais, s.estado) : null;
  const esUS = s.pais === 'US';
  const tituloPaso =
    s.paso === 'pais'
      ? (titulo ?? t.tituloPais)
      : s.paso === 'estado'
        ? (titulo ?? t.tituloEstado)
        : s.paso === 'ciudad'
          ? t.tituloCiudad
          : esUS
            ? t.tituloMunicipioUS
            : t.tituloMunicipioVE;
  const atras = () => {
    if (!s.volver()) alCerrar?.();
  };
  const placeholder =
    s.paso === 'estado'
      ? t.buscarTodo
      : s.paso === 'ciudad' && est
        ? t.buscarEn(est.nombre)
        : esUS
          ? t.buscarCondado
          : t.buscarMunicipio;
  return (
    <View style={{ flex: 1 }} testID="panel-selector-lugar">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: COLOR.borde,
        }}
      >
        {s.paso !== 'pais' || alCerrar ? (
          <Pressable
            onPress={atras}
            accessibilityRole="button"
            accessibilityLabel={s.paso === 'pais' ? t.cerrar : t.volver}
            hitSlop={10}
            style={e.volver}
            testID="selector-lugar-volver"
          >
            <Icono nombre={s.paso === 'pais' ? 'close' : 'arrow-back'} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '700' }} accessibilityRole="header">
            {tituloPaso}
          </Text>
          {s.pais && s.paso !== 'pais' ? (
            <Text style={{ color: COLOR.textoSuave, fontSize: 13 }} numberOfLines={1}>
              {banderaDe(s.pais)} {nombrePais(s.pais, idioma)}
              {est ? ` · ${estadoEscrito(s.pais, est)}` : ''}
            </Text>
          ) : null}
        </View>
      </View>

      {s.paso !== 'pais' ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
          <View
            style={[
              e.input,
              { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 0 },
            ]}
          >
            <Icono nombre="search" color={COLOR.textoSuave} />
            <TextInput
              value={s.consulta}
              onChangeText={s.cambiarConsulta}
              placeholder={placeholder}
              placeholderTextColor={COLOR.textoTenue}
              autoCorrect={false}
              autoComplete="off"
              accessibilityLabel={placeholder}
              testID="selector-lugar-buscar"
              style={{ flex: 1, fontSize: 16, color: COLOR.texto, paddingVertical: 12 }}
            />
          </View>
        </View>
      ) : null}

      <ScrollView
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16 }}
      >
        {s.paso === 'pais'
          ? paisesParaElegir(paisSugerido).map((p) => (
              <Fila
                key={p}
                testID={`selector-lugar-pais-${p}`}
                texto={`${banderaDe(p)} ${nombrePais(p, idioma)}`}
                alTocar={() => s.elegirPais(p)}
                flecha
              />
            ))
          : null}
        {s.paso === 'pais' && alElegirOtroPais ? (
          <Fila
            testID="selector-lugar-pais-otro"
            texto={t.otroPais}
            alTocar={alElegirOtroPais}
            flecha
          />
        ) : null}

        {s.cargando && s.paso !== 'pais' && (s.paso !== 'estado' || s.consulta) ? (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 12 }}>
            <ActivityIndicator color={COLOR.textoSuave} />
            <Text style={{ color: COLOR.textoSuave }}>{t.cargando}</Text>
          </View>
        ) : null}
        {s.fallo ? (
          <View style={{ paddingVertical: 12, gap: 8 }} accessibilityRole="alert">
            <Text style={{ color: COLOR.error }}>{t.fallo}</Text>
            <Pressable onPress={s.reintentar} accessibilityRole="button">
              <Text style={e.enlaceLinea}>{t.reintentar}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Paso del estado: con texto, primero las ciudades que coinciden en todo el país. */}
        {s.paso === 'estado' || s.paso === 'ciudad'
          ? s.resultados.map((r) => (
              <FilaResultado
                key={r.lugar.lugarId}
                r={r}
                idioma={idioma}
                conEstado={s.paso === 'estado'}
                alTocar={() => s.elegir(r.lugar)}
              />
            ))
          : null}
        {s.paso === 'estado' &&
        s.consulta.trim() &&
        !s.cargando &&
        !s.resultados.length &&
        !s.estados.length ? (
          <Text style={{ color: COLOR.textoSuave, paddingVertical: 12 }}>
            {t.sinResultados(s.consulta.trim())}
          </Text>
        ) : null}
        {s.paso === 'estado' && s.pais ? (
          <>
            <Text
              style={{ color: COLOR.textoSuave, fontSize: 13, fontWeight: '600', marginTop: 12 }}
            >
              {s.consulta.trim() ? t.oEligeEstado : t.tituloEstado}
            </Text>
            {s.estados.map((x) => (
              <Fila
                key={x.codigo}
                testID={`selector-lugar-estado-${x.codigo}`}
                texto={estadoEscrito(s.pais!, x)}
                alTocar={() => s.elegirEstado(x.codigo)}
                flecha
              />
            ))}
          </>
        ) : null}

        {s.paso === 'ciudad' && s.consulta.trim() && !s.cargando && !s.resultados.length ? (
          <Text style={{ color: COLOR.textoSuave, paddingVertical: 12 }}>
            {t.sinResultadosEstado(s.consulta.trim())}
          </Text>
        ) : null}
        {s.paso === 'ciudad' && !s.cargando && !s.fallo ? (
          <Pressable
            onPress={s.verMunicipios}
            accessibilityRole="button"
            testID="selector-lugar-no-encuentro"
            style={{ paddingVertical: 16 }}
          >
            <Text style={e.enlaceLinea}>{esUS ? t.noEncuentroUS : t.noEncuentroVE}</Text>
          </Pressable>
        ) : null}

        {s.paso === 'municipio'
          ? s.municipios.map((m) => (
              <FilaMunicipio key={m.municipio} m={m} idioma={idioma} alTocar={() => s.elegir(m)} />
            ))
          : null}

        {s.paso !== 'pais' ? (
          <Text style={{ color: COLOR.textoTenue, fontSize: 11, marginTop: 16 }}>{t.credito}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Fila({
  texto,
  alTocar,
  flecha,
  testID,
}: {
  texto: string;
  alTocar: () => void;
  flecha?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 48,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: COLOR.borde,
      }}
    >
      <Text style={{ flex: 1, fontSize: 16 }}>{texto}</Text>
      {flecha ? <Icono nombre="chevron-forward" color={COLOR.textoSuave} /> : null}
    </Pressable>
  );
}

function FilaResultado({
  r,
  idioma,
  conEstado,
  alTocar,
}: {
  r: ResultadoLugar;
  idioma: Idioma;
  conEstado: boolean;
  alTocar: () => void;
}) {
  const t = textosSelectorLugar(idioma);
  const est = estadoDelPais(r.lugar.pais, r.lugar.estado);
  const [antes, coincide, despues] = r.resaltado;
  const detalle = [
    r.lugar.municipio
      ? `${r.lugar.pais === 'US' ? '' : `${t.municipio} `}${r.lugar.municipio}`
      : '',
    conEstado && est ? estadoEscrito(r.lugar.pais, est) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={`${r.lugar.ciudad}${detalle ? `, ${detalle}` : ''}`}
      testID={`selector-lugar-ciudad-${r.lugar.lugarId}`}
      style={{
        minHeight: 48,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLOR.borde,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Icono nombre="location-outline" color={COLOR.textoSuave} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16 }}>
          {antes}
          <Text style={{ fontSize: 16, fontWeight: '700' }}>{coincide}</Text>
          {despues}
        </Text>
        {detalle ? (
          <Text style={{ color: COLOR.textoSuave, fontSize: 13 }} numberOfLines={1}>
            {detalle}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function FilaMunicipio({
  m,
  idioma,
  alTocar,
}: {
  m: LugarCatalogo;
  idioma: Idioma;
  alTocar: () => void;
}) {
  const t = textosSelectorLugar(idioma);
  return (
    <Pressable
      onPress={alTocar}
      accessibilityRole="button"
      testID={`selector-lugar-municipio-${m.lugarId}`}
      style={{
        minHeight: 48,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLOR.borde,
        borderRadius: RADIO.s,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: '600' }}>{m.municipio}</Text>
      <Text style={{ color: COLOR.textoSuave, fontSize: 13 }}>{t.quedarasEn(m.ciudad)}</Text>
    </Pressable>
  );
}
