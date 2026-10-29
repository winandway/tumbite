import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, Share, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { type Api, ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { Boton, C, e } from '@tumbite/movil';

/**
 * C-SEGURIDAD-REPARTIDOR (29 oct 2026), como el centro de seguridad de Dasher y Uber Driver:
 * emergencia (avisa a nuestro equipo y marca al número de emergencias del país), compartir el
 * recorrido con un contacto y reportar un incidente.
 */
const T = {
  es: {
    titulo: 'Seguridad',
    emergencia: 'Emergencia',
    emergenciaAyuda: 'Avisa a nuestro equipo con tu ubicación y te deja llamar a emergencias.',
    seguro: '¿Avisar una emergencia? Nuestro equipo recibe tu ubicación ahora mismo.',
    si: 'Sí, avisar',
    no: 'No',
    llamar: (n: string) => `Llamar al ${n}`,
    avisado: 'Avisamos a nuestro equipo.',
    compartir: 'Compartir mi recorrido',
    compartirAyuda:
      'Manda un enlace a alguien de confianza para que vea dónde vas durante 12 horas.',
    mensaje: (url: string) => `Sigue mi recorrido de reparto en Divoox: ${url}`,
    copiado: 'Enlace copiado.',
    incidente: 'Reportar un incidente',
    motivos: {
      accidente: 'Accidente',
      acoso: 'Acoso',
      robo: 'Robo',
      animal: 'Animal suelto',
      otro: 'Otro',
    } as Record<string, string>,
    detalle: '¿Qué pasó?',
    enviar: 'Enviar el reporte',
    enviado: 'Recibimos tu reporte. Nuestro equipo te contacta.',
  },
  en: {
    titulo: 'Safety',
    emergencia: 'Emergency',
    emergenciaAyuda: 'Alerts our team with your location and lets you call emergency services.',
    seguro: 'Report an emergency? Our team gets your location right now.',
    si: 'Yes, alert',
    no: 'No',
    llamar: (n: string) => `Call ${n}`,
    avisado: 'We alerted our team.',
    compartir: 'Share my trip',
    compartirAyuda: 'Send a link to someone you trust so they can see where you are for 12 hours.',
    mensaje: (url: string) => `Follow my Divoox delivery trip: ${url}`,
    copiado: 'Link copied.',
    incidente: 'Report an incident',
    motivos: {
      accidente: 'Accident',
      acoso: 'Harassment',
      robo: 'Robbery',
      animal: 'Loose animal',
      otro: 'Other',
    } as Record<string, string>,
    detalle: 'What happened?',
    enviar: 'Send the report',
    enviado: 'We got your report. Our team will contact you.',
  },
};

function confirmar(mensaje: string, si: string, no: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(mensaje));
  return new Promise((r) =>
    Alert.alert('', mensaje, [
      { text: no, style: 'cancel', onPress: () => r(false) },
      { text: si, style: 'destructive', onPress: () => r(true) },
    ]),
  );
}

async function dondeEstoy() {
  try {
    const p = await Location.getLastKnownPositionAsync();
    return p ? { lat: p.coords.latitude, lng: p.coords.longitude } : {};
  } catch {
    return {};
  }
}

export function Seguridad({ api, idioma }: { api: Api; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [numero, setNumero] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const falla = (x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x));

  async function emergencia() {
    if (!(await confirmar(t.seguro, t.si, t.no))) return;
    setError('');
    try {
      const r = await api.pedir<{ numero: string }>(
        'POST',
        '/datos/repartidor/emergencia',
        await dondeEstoy(),
      );
      setNumero(r.numero);
      setAviso(t.avisado);
    } catch (x) {
      falla(x);
    }
  }
  async function compartir() {
    setError('');
    try {
      const r = await api.pedir<{ url: string }>(
        'POST',
        '/datos/repartidor/compartir-recorrido',
        {},
      );
      if (Platform.OS === 'web' && navigator.clipboard) {
        await navigator.clipboard.writeText(t.mensaje(r.url));
        setAviso(t.copiado);
      } else await Share.share({ message: t.mensaje(r.url) });
    } catch (x) {
      falla(x);
    }
  }
  async function reportar() {
    setError('');
    try {
      await api.pedir('POST', '/datos/repartidor/incidentes', {
        motivo,
        detalle,
        ...(await dondeEstoy()),
      });
      setMotivo('');
      setDetalle('');
      setAviso(t.enviado);
    } catch (x) {
      falla(x);
    }
  }

  return (
    <View style={{ padding: 16, gap: 12 }} testID="seguridad">
      <Text style={{ fontSize: 24, fontWeight: '900', color: C.secundario }}>{t.titulo}</Text>
      {error ? <Text style={e.error}>{error}</Text> : null}
      {aviso ? <Text style={{ color: C.exito, fontWeight: '700' }}>{aviso}</Text> : null}
      <View style={[e.tarjeta, { gap: 8 }]}>
        <Pressable
          onPress={() => void emergencia()}
          accessibilityRole="button"
          accessibilityLabel={t.emergencia}
          style={{
            backgroundColor: C.primario,
            borderRadius: 14,
            paddingVertical: 16,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{t.emergencia}</Text>
        </Pressable>
        <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.emergenciaAyuda}</Text>
        {numero ? (
          <Boton texto={t.llamar(numero)} alTocar={() => void Linking.openURL(`tel:${numero}`)} />
        ) : null}
      </View>
      <View style={[e.tarjeta, { gap: 6 }]}>
        <Boton texto={t.compartir} alTocar={() => void compartir()} secundario />
        <Text style={{ color: '#5E5E5E', fontSize: 13 }}>{t.compartirAyuda}</Text>
      </View>
      <View style={[e.tarjeta, { gap: 8 }]}>
        <Text style={{ fontWeight: '900', fontSize: 17, color: C.secundario }}>{t.incidente}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(t.motivos).map(([k, texto]) => (
            <Pressable
              key={k}
              onPress={() => setMotivo(k)}
              accessibilityRole="radio"
              accessibilityState={{ checked: motivo === k }}
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 12,
                borderWidth: motivo === k ? 2 : 1,
                borderColor: motivo === k ? C.primario : '#DADADA',
              }}
            >
              <Text style={{ fontWeight: '700', color: motivo === k ? C.primario : C.secundario }}>
                {texto}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={detalle}
          onChangeText={setDetalle}
          placeholder={t.detalle}
          accessibilityLabel={t.detalle}
          multiline
          style={[e.input, { minHeight: 70 }]}
        />
        {motivo && detalle.trim().length >= 3 ? (
          <Boton texto={t.enviar} alTocar={() => void reportar()} />
        ) : null}
      </View>
    </View>
  );
}
