import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import {
  correoLimpio,
  textosRevisar,
  type CasillaRegistro,
  type FilaRevision,
  type Idioma,
} from '@tumbite/compartido';
import { Text } from './diseno';
import { SugerenciaCorreo } from './SugerenciaCorreo';
import { Boton, e } from './ui';
import { COLOR } from './tokens';

/**
 * C-REVISA-TUS-DATOS (19 nov 2026, orden de Richard) — todos los países. Antes de crear la cuenta,
 * las tres apps muestran lo escrito: el correo arriba y en grande (es donde llega el enlace para
 * activar la cuenta), los demás datos debajo y más pequeños, cada uno con «Editar». La cuenta se
 * crea SOLO con el toque en «Crear mi cuenta» (`alCrear`); nada más en esta pieza la llama.
 * La contraseña nunca se muestra.
 */
export function RevisaTusDatos({
  idioma,
  correo,
  filas,
  enviando,
  error,
  conTitulo,
  alEditar,
  alEditarDatos,
  alCrear,
  aceptarCorreo,
  children,
}: {
  idioma: Idioma;
  correo: string;
  filas: FilaRevision[];
  enviando: boolean;
  error?: string | null;
  /** Con portada propia no hay cabecera de pantalla: el título va aquí. */
  conTitulo?: boolean;
  alEditar: (campo: CasillaRegistro) => void;
  alEditarDatos: () => void;
  alCrear: () => void;
  aceptarCorreo: (correo: string) => void;
  /** El escudo anti-robots, a la vista donde se crea la cuenta. */
  children?: ReactNode;
}) {
  const r = textosRevisar(idioma);
  const tarjeta = {
    borderWidth: 1,
    borderColor: COLOR.bordeFuerte,
    borderRadius: 12,
    backgroundColor: COLOR.blanco,
    padding: 16,
    marginBottom: 12,
  } as const;
  const editar = (campo: CasillaRegistro, texto: string) => (
    <Pressable
      testID={`editar-${campo}`}
      onPress={() => alEditar(campo)}
      accessibilityRole="button"
      accessibilityLabel={`${r.editar}: ${texto}`}
      hitSlop={10}
      style={{ paddingVertical: 4, paddingLeft: 12 }}
    >
      <Text style={[e.enlaceLinea, { fontSize: 15 }]}>{r.editar}</Text>
    </Pressable>
  );
  return (
    <View testID="revisa-tus-datos">
      {conTitulo ? (
        <Text
          accessibilityRole="header"
          style={{ fontWeight: '700', fontSize: 26, color: COLOR.negro, marginBottom: 4 }}
        >
          {r.titulo}
        </Text>
      ) : null}
      <Text style={{ color: COLOR.textoSuave, fontSize: 15, marginBottom: 16 }}>{r.intro}</Text>
      <View style={tarjeta}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, color: COLOR.textoSuave, fontSize: 14 }}>{r.etiquetaCorreo}</Text>
          {editar('correo', r.etiquetaCorreo)}
        </View>
        <Text
          testID="revisar-correo"
          selectable
          style={{
            fontSize: 22,
            lineHeight: 28,
            fontWeight: '700',
            color: COLOR.negro,
            marginTop: 4,
            marginBottom: 8,
          }}
        >
          {correoLimpio(correo)}
        </Text>
        <Text style={{ color: COLOR.texto, fontSize: 15, lineHeight: 21 }}>{r.correoPregunta}</Text>
        <View style={{ marginTop: 12 }}>
          <SugerenciaCorreo correo={correo} idioma={idioma} aceptar={aceptarCorreo} />
        </View>
      </View>
      {filas.length ? (
        <View style={[tarjeta, { paddingVertical: 4 }]}>
          {filas.map((f, i) => (
            <View
              key={f.campo}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 10,
                borderTopWidth: i ? 1 : 0,
                borderTopColor: COLOR.borde,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: COLOR.textoSuave, fontSize: 13 }}>{f.etiqueta}</Text>
                <Text testID={`revisar-${f.campo}`} style={{ color: COLOR.texto, fontSize: 16 }}>
                  {f.valor}
                </Text>
              </View>
              {editar(f.campo, f.etiqueta)}
            </View>
          ))}
        </View>
      ) : null}
      {children}
      {error ? (
        <Text
          style={[e.error, { marginBottom: 8 }]}
          accessibilityRole="alert"
          testID="acceso-error"
        >
          {error}
        </Text>
      ) : null}
      <Boton
        testID="crear-mi-cuenta"
        texto={enviando ? r.creando : r.crearMiCuenta}
        alTocar={alCrear}
        cargando={enviando}
      />
      <Boton testID="editar-datos" secundario texto={r.editarDatos} alTocar={alEditarDatos} />
    </View>
  );
}
