import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ErrorApi, enIdioma } from '@tumbite/compartido';
import { Boton, C, e, useSesion } from '@tumbite/movil';
import { Tarjeta } from './comida/piezas';

/**
 * C-FLEX-RASTREAR (31 oct 2026, LG3, pedido de Richard; como UPS My Choice o Amazon): la persona
 * escribe o escanea uno o varios números de seguimiento. Si el envío es suyo (su teléfono o su
 * correo), aparece completo en «Mis paquetes» con su ubicación; si no, lo sigue con el estado.
 * En los dos casos le llegan los avisos de cada paso.
 */
const T = {
  es: {
    titulo: 'Rastrear un paquete',
    ayuda: 'Escribe o escanea el número de seguimiento (empieza con DVX). Puedes seguir varios.',
    codigo: 'Número de seguimiento',
    buscar: 'Rastrear',
    escanear: 'Escanear la etiqueta',
    cerrar: 'Cerrar',
    permiso: 'Activa la cámara para escanear la etiqueta.',
    suyo: 'Es tuyo: lo ves abajo con su ubicación.',
    seguido: 'Lo estás siguiendo: te avisamos en cada paso.',
    siguiendo: 'Paquetes que sigues',
    quitar: 'Dejar de seguir',
    de: 'De',
  },
  en: {
    titulo: 'Track a package',
    ayuda: 'Type or scan the tracking number (it starts with DVX). You can follow several.',
    codigo: 'Tracking number',
    buscar: 'Track',
    escanear: 'Scan the label',
    cerrar: 'Close',
    permiso: 'Turn on the camera to scan the label.',
    suyo: 'It’s yours: you’ll see it below with its location.',
    seguido: 'You’re following it: we’ll notify you at every step.',
    siguiendo: 'Packages you follow',
    quitar: 'Stop following',
    de: 'From',
  },
};

type Seguido = { codigo: string; estado: string; empresa: string; suyo: boolean; final: boolean };

export function RastrearPaquete({
  estados,
  alVincular,
}: {
  estados: Map<string, string>;
  /** Cuando el paquete resulta ser de la persona: se recarga «Mis paquetes». */
  alVincular: () => void;
}) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [seguidos, setSeguidos] = useState<Seguido[]>([]);
  const [permiso, pedirPermiso] = useCameraPermissions();

  const cargar = useCallback(() => {
    api
      .pedir<{ seguidos: Seguido[] }>('GET', '/datos/v1/flex/mis-paquetes/seguidos')
      .then((r) => setSeguidos(r.seguidos))
      .catch(() => undefined);
  }, [api]);
  useEffect(cargar, [cargar]);

  async function rastrear(texto: string) {
    const limpio = texto.trim();
    if (!limpio) return;
    setError('');
    setAviso('');
    setTrabajando(true);
    try {
      const r = await api.pedir<{ suyo: boolean }>('POST', '/datos/v1/flex/mis-paquetes/seguir', {
        codigo: limpio,
      });
      setCodigo('');
      setAviso(r.suyo ? t.suyo : t.seguido);
      cargar();
      if (r.suyo) alVincular();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setTrabajando(false);
    }
  }

  async function abrirEscaner() {
    if (!permiso?.granted && !(await pedirPermiso()).granted) return setError(t.permiso);
    setEscaneando(true);
  }

  const ajenos = seguidos.filter((s) => !s.suyo);
  return (
    <Tarjeta>
      <View testID="rastrear-paquete" style={{ gap: 8 }}>
        <Text style={{ fontWeight: '700', fontSize: 17, color: C.secundario }}>{t.titulo}</Text>
        <Text style={{ color: '#5E5E5E' }}>{t.ayuda}</Text>
        <TextInput
          value={codigo}
          onChangeText={setCodigo}
          placeholder="DVX…"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => void rastrear(codigo)}
          style={e.input}
          accessibilityLabel={t.codigo}
        />
        {error ? (
          <Text accessibilityRole="alert" style={{ color: C.primario, fontWeight: '700' }}>
            {error}
          </Text>
        ) : null}
        {aviso ? <Text style={{ color: C.exito, fontWeight: '700' }}>{aviso}</Text> : null}
        <Boton
          texto={t.buscar}
          logistica
          cargando={trabajando}
          alTocar={() => void rastrear(codigo)}
        />
        <Boton texto={t.escanear} secundario alTocar={() => void abrirEscaner()} />
        {ajenos.length ? (
          <View style={{ gap: 6, marginTop: 6 }}>
            <Text style={{ fontWeight: '700', color: C.secundario }}>{t.siguiendo}</Text>
            {ajenos.map((s) => (
              <View
                key={s.codigo}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 8,
                  borderTopWidth: 1,
                  borderTopColor: '#EEE',
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: C.secundario }}>{s.codigo}</Text>
                  <Text style={{ color: s.final ? C.exito : '#5E5E5E' }}>
                    {estados.get(s.estado) ?? s.estado} · {t.de} {s.empresa}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    void api
                      .pedir('DELETE', `/datos/v1/flex/mis-paquetes/seguidos/${s.codigo}`)
                      .then(cargar)
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${t.quitar} ${s.codigo}`}
                  hitSlop={8}
                >
                  <Text style={{ color: '#5E5E5E', fontWeight: '600' }}>{t.quitar}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Modal visible={escaneando} animationType="slide" onRequestClose={() => setEscaneando(false)}>
        <View style={{ flex: 1, backgroundColor: '#101010' }}>
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128'] }}
            onBarcodeScanned={({ data }) => {
              setEscaneando(false);
              // La etiqueta lleva el seguimiento en el QR (o el código de barras con «DVX…»).
              const dvx = /DVX[A-Z2-9]{10}/i.exec(data)?.[0] ?? data;
              void rastrear(dvx);
            }}
          />
          <View style={{ padding: 16 }}>
            <Boton texto={t.cerrar} secundario alTocar={() => setEscaneando(false)} />
          </View>
        </View>
      </Modal>
    </Tarjeta>
  );
}
