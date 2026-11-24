import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { type PapelDePersona, textosActivarPapel } from '@tumbite/compartido';
import { Text } from './diseno';
import { Boton, C, e } from './ui';

/**
 * C-CUENTA-UNICA (24 nov 2026, Richard; todos los países). Quien entra con el correo de su cuenta de
 * Divoox en la app de otro papel (el conductor en la app de clientes, el cliente en Driver) no crea
 * otra cuenta: activa aquí el papel que falta, con un toque y la casilla de los términos de ESE papel.
 * El servidor contesta «papel_por_activar» solo a las apps que traen esta pantalla.
 */
export function ActivarPapel({
  papel,
  idioma,
  enviando,
  alActivar,
  alOtroCorreo,
  abrirTerminos,
}: {
  papel: PapelDePersona;
  idioma: 'es' | 'en';
  enviando: boolean;
  alActivar: () => void;
  alOtroCorreo: () => void;
  abrirTerminos: () => void;
}) {
  const t = textosActivarPapel(papel, idioma);
  const [acepto, setAcepto] = useState(false);
  // Sin la casilla, el botón dice qué falta (nunca un botón que no hace nada sin decir por qué).
  const [falta, setFalta] = useState(false);
  return (
    <View
      testID="activar-papel"
      style={{
        borderWidth: 1,
        borderColor: '#2a2a2a',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#101010', marginBottom: 8 }}>
        {t.titulo}
      </Text>
      <Text style={{ fontSize: 15, color: '#444', marginBottom: 12 }}>{t.cuerpo}</Text>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
        <Pressable
          testID="activar-papel-casilla"
          onPress={() => {
            setAcepto(!acepto);
            setFalta(false);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acepto }}
          accessibilityLabel={t.casilla}
          hitSlop={10}
          style={{
            width: 22,
            height: 22,
            borderRadius: 4,
            borderWidth: 2,
            borderColor: acepto ? C.primario : '#6B7078',
            backgroundColor: acepto ? C.primario : '#FFFFFF',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 1,
          }}
        >
          {acepto ? (
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>✓</Text>
          ) : null}
        </Pressable>
        <Text style={[e.enlaceLinea, { flex: 1, fontSize: 13 }]} onPress={abrirTerminos}>
          {t.casilla}
        </Text>
      </View>
      <Boton
        testID="activar-papel-boton"
        texto={t.boton}
        cargando={enviando}
        alTocar={() => {
          if (!acepto) setFalta(true);
          else if (!enviando) alActivar();
        }}
      />
      {falta ? (
        <Text style={[e.error, { marginTop: 6 }]} accessibilityRole="alert">
          {idioma === 'en'
            ? 'To continue, check the terms box.'
            : 'Para seguir, marca la casilla de los términos.'}
        </Text>
      ) : null}
      <Text style={e.enlace} onPress={alOtroCorreo} accessibilityRole="button">
        {t.otraCuenta}
      </Text>
    </View>
  );
}
