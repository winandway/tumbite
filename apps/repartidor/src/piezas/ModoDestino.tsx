import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ErrorApi, enIdioma, useBorrador } from '@tumbite/compartido';
import { C, CampoDireccion, alSalirTelefono, almacenTelefono, e, useSesion } from '@tumbite/movil';

/**
 * C-MODO-DESTINO (BRE-6, como «Driver Destinations» de Uber): el repartidor pone su destino (su
 * casa) y, hasta dos veces al día, solo recibe ofertas cuya entrega lo acerca. Se apaga solo al
 * llegar o con «Apagar». La dirección sale de la casilla con sugerencias (C-DIRECCION-SUGERENCIAS)
 * y lo escrito se guarda solo (borrador).
 */
const T = {
  es: {
    titulo: 'Modo destino',
    ayuda: 'Pon tu destino y solo te llegan pedidos que te acercan. Hasta dos veces al día.',
    campo: 'Tu destino',
    encender: 'Ir hacia allá',
    apagar: 'Apagar',
    activo: (d: string) => `Solo pedidos hacia: ${d}`,
    quedan: (n: number) =>
      n === 1
        ? 'Te queda 1 uso hoy.'
        : n === 0
          ? 'No te quedan usos hoy.'
          : `Te quedan ${n} usos hoy.`,
    llegaste: 'Llegaste a tu destino: el modo se apagó.',
    eligeSugerencia: 'Elige tu destino de la lista para tener el punto exacto.',
  },
  en: {
    titulo: 'Destination mode',
    ayuda: 'Set your destination and only get orders that take you closer. Up to twice a day.',
    campo: 'Your destination',
    encender: 'Head there',
    apagar: 'Turn off',
    activo: (d: string) => `Only orders toward: ${d}`,
    quedan: (n: number) =>
      n === 1 ? '1 use left today.' : n === 0 ? 'No uses left today.' : `${n} uses left today.`,
    llegaste: 'You reached your destination: the mode turned off.',
    eligeSugerencia: 'Pick your destination from the list to get the exact spot.',
  },
};

type Destino = {
  activo: boolean;
  direccion: string | null;
  motivo: string | null;
  usosRestantes: number;
};

export function ModoDestino({ cerca }: { cerca?: { lat: number; lng: number } | null }) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [estado, setEstado] = useState<Destino | null>(null);
  const [punto, setPunto] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState('');
  const b = useBorrador({
    formulario: 'driver-modo-destino',
    cuenta: usuario?.id,
    inicial: { direccion: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const cargar = useCallback(() => {
    api
      .pedir<Destino>('GET', '/datos/repartidor/destino')
      .then(setEstado)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api]);
  useEffect(cargar, [cargar]);
  // Mientras está encendido se vuelve a mirar cada minuto (se apaga solo al llegar).
  useEffect(() => {
    if (!estado?.activo) return;
    const id = setInterval(cargar, 60_000);
    return () => clearInterval(id);
  }, [estado?.activo, cargar]);

  async function encender() {
    setError('');
    if (!punto) return setError(t.eligeSugerencia);
    try {
      setEstado(
        await api.pedir<Destino>('PUT', '/datos/repartidor/destino', {
          direccion: b.valores.direccion,
          ...punto,
        }),
      );
      await b.limpiar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function apagar() {
    setError('');
    try {
      setEstado(await api.pedir<Destino>('DELETE', '/datos/repartidor/destino'));
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (!estado) return null;
  const boton = (texto: string, alTocar: () => void, claro = false) => (
    <Pressable
      accessibilityRole="button"
      onPress={alTocar}
      style={{
        backgroundColor: claro ? '#F2F3F5' : C.secundario,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
      }}
    >
      <Text style={{ color: claro ? C.secundario : '#fff', fontWeight: '700' }}>{texto}</Text>
    </Pressable>
  );
  return (
    <View testID="modo-destino" style={[e.tarjeta, { gap: 8 }]}>
      <Text style={{ fontWeight: '700', fontSize: 15 }}>{t.titulo}</Text>
      {estado.activo ? (
        <>
          <Text style={{ color: C.exito, fontWeight: '700' }}>
            {t.activo(estado.direccion ?? '')}
          </Text>
          {boton(t.apagar, () => void apagar(), true)}
        </>
      ) : (
        <>
          <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.ayuda}</Text>
          {estado.motivo === 'llegada' ? (
            <Text style={{ color: C.exito, fontWeight: '700' }}>{t.llegaste}</Text>
          ) : null}
          {estado.usosRestantes > 0 ? (
            <>
              <CampoDireccion
                etiqueta={t.campo}
                valor={b.valores.direccion}
                cambiar={(x) => {
                  b.cambiar('direccion', x);
                  setPunto(null);
                }}
                alElegir={(d) => setPunto(d.punto)}
                cerca={cerca ?? null}
              />
              {boton(t.encender, () => void encender())}
            </>
          ) : null}
        </>
      )}
      <Text style={{ color: '#5E5E5E', fontSize: 12 }}>{t.quedan(estado.usosRestantes)}</Text>
      {error ? <Text style={e.error}>{error}</Text> : null}
    </View>
  );
}
