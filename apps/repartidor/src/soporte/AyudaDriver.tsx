import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { enIdiomaDireccion } from '@tumbite/compartido';
import { C, Text, URL_SERVIDOR, abrirPagina, e, useSesion } from '@tumbite/movil';
import { ChatSoporteApp } from './ChatSoporteApp';
import { textosSoporte } from './textos';

/**
 * Ayuda de Divoox Driver (C-CAMILA-CHAT, 17 nov 2026) — todos los países. Desde el
 * menú: «Habla con soporte» (el chat con Camila), «Mis casos y reportes» y las guías de Docs.
 */
type Parte = 'menu' | 'chat';

export function AyudaDriver({
  alCasos,
  inicial = 'menu',
}: {
  /** Abre «Soporte» del perfil (reportar un problema y los casos). */
  alCasos: () => void;
  inicial?: Parte;
}) {
  const { idioma } = useSesion();
  const t = textosSoporte(idioma);
  const [parte, setParte] = useState<Parte>(inicial);

  const volver = (
    <Pressable
      onPress={() => setParte('menu')}
      accessibilityRole="button"
      style={{ paddingHorizontal: 16, paddingTop: 12 }}
    >
      <Text style={{ color: C.secundario, fontWeight: '700' }}>‹ {t.volver}</Text>
    </Pressable>
  );
  if (parte === 'chat')
    return (
      <View>
        {volver}
        <ChatSoporteApp />
      </View>
    );

  const fila = (titulo: string, detalle: string, alTocar: () => void, testID: string) => (
    <Pressable
      key={testID}
      onPress={alTocar}
      accessibilityRole="button"
      testID={testID}
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E6E7EA',
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontWeight: '700', color: C.secundario }}>{titulo}</Text>
        <Text style={{ color: '#666B73', fontSize: 12 }}>{detalle}</Text>
      </View>
      <Text style={{ color: '#6B7078', fontSize: 18 }}>›</Text>
    </Pressable>
  );
  return (
    <View style={{ padding: 16, gap: 12 }} testID="ayuda-driver">
      <View>
        <Text
          accessibilityRole="header"
          style={{ fontWeight: '800', fontSize: 22, color: C.secundario }}
        >
          {t.ayuda}
        </Text>
        <Text style={{ color: '#666B73' }}>{t.ayudaTexto}</Text>
      </View>
      <View style={[e.tarjeta, { paddingVertical: 2 }]}>
        {fila(t.hablar, t.hablarDetalle, () => setParte('chat'), 'ayuda-hablar')}
        {fila(t.casos, t.casosDetalle, alCasos, 'ayuda-casos')}
        {fila(
          t.guias,
          t.guiasDetalle,
          () => abrirPagina(`${URL_SERVIDOR}${enIdiomaDireccion('/docs/drivers', idioma)}`),
          'ayuda-guias',
        )}
      </View>
    </View>
  );
}
