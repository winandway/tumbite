import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Share, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ErrorApi, enIdioma, formatearMonto, useBorrador } from '@tumbite/compartido';
import {
  AvisoBorrador,
  Boton,
  Campo,
  alSalirTelefono,
  almacenTelefono,
  useSesion,
} from '@tumbite/movil';
import { ANCHO_MAX, Encabezado, Tarjeta } from '../comida/piezas';

/**
 * C-REFERIDOS (CLI-7, como «Invita a un amigo» de DoorDash y Uber Eats): tu código para compartir,
 * cuántos amigos lo usaron, y la casilla para escribir el código que te pasaron antes de tu primer
 * pedido. Solo aparece cuando el equipo enciende las invitaciones.
 */
const T = {
  es: {
    titulo: 'Invita a un amigo',
    explica: (amigo: string, tu: string) =>
      `Tu amigo recibe ${amigo} para su primer pedido y tú recibes ${tu} cuando se lo entreguemos.`,
    tuCodigo: 'Tu código',
    compartir: 'Compartir mi código',
    mensaje: (codigo: string, amigo: string) =>
      `Te regalo ${amigo} en Divoox para tu primer pedido. Usa mi código ${codigo} en la app: https://divoox.com`,
    invitados: (n: number, p: number) => `Amigos que lo usaron: ${n} · con su primer pedido: ${p}`,
    teInvitaron: '¿Te invitaron?',
    codigo: 'Código de invitación',
    usar: 'Usar el código',
    listo: (m: string) => `Listo: ${m} en tu saldo de regalo para tu primer pedido.`,
    yaUsaste: 'Ya usaste un código de invitación.',
    pronto: 'Las invitaciones llegan muy pronto.',
  },
  en: {
    titulo: 'Invite a friend',
    explica: (amigo: string, tu: string) =>
      `Your friend gets ${amigo} off their first order, and you get ${tu} once we deliver it.`,
    tuCodigo: 'Your code',
    compartir: 'Share my code',
    mensaje: (codigo: string, amigo: string) =>
      `Here’s ${amigo} off your first Divoox order. Use my code ${codigo} in the app: https://divoox.com`,
    invitados: (n: number, p: number) => `Friends who used it: ${n} · with a first order: ${p}`,
    teInvitaron: 'Got an invite?',
    codigo: 'Invite code',
    usar: 'Use code',
    listo: (m: string) => `Done: ${m} added to your gift balance for your first order.`,
    yaUsaste: 'You already used an invite code.',
    pronto: 'Invites are coming very soon.',
  },
};

type Estado = {
  activos: boolean;
  paraAmigo: number;
  paraQuienInvita: number;
  codigo: string | null;
  invitados: number;
  premiados: number;
  yaUsoUnCodigo: boolean;
};

export default function InvitarAmigo() {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const b = useBorrador({
    formulario: 'invitacion',
    cuenta: usuario?.id,
    inicial: { codigo: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const cargar = useCallback(() => {
    api
      .pedir<Estado>('GET', '/datos/referidos')
      .then(setEstado)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api]);
  useEffect(cargar, [cargar]);
  const dinero = (c: number) => formatearMonto(c, 'USD', idioma);

  async function usar() {
    setError('');
    setAviso('');
    setOcupado(true);
    try {
      const r = await api.pedir<{ credito: number }>('POST', '/datos/referidos/canjear', {
        codigo: b.valores.codigo.trim(),
      });
      await b.limpiar();
      setAviso(t.listo(dinero(r.credito)));
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f6f6f6' }}>
      <Encabezado titulo={t.titulo} alVolver={() => router.back()} etiquetaVolver="‹" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 16,
          width: '100%',
          maxWidth: ANCHO_MAX,
          alignSelf: 'center',
        }}
      >
        {estado && !estado.activos ? <Text testID="invitar-pronto">{t.pronto}</Text> : null}
        {estado?.activos && estado.codigo ? (
          <>
            <Tarjeta>
              <Text style={{ color: '#5E5E5E', marginBottom: 8 }}>
                {t.explica(dinero(estado.paraAmigo), dinero(estado.paraQuienInvita))}
              </Text>
              <Text style={{ color: '#5E5E5E' }}>{t.tuCodigo}</Text>
              <Text
                testID="mi-codigo-invitacion"
                selectable
                style={{ fontSize: 28, fontWeight: '700', letterSpacing: 2, marginBottom: 12 }}
              >
                {estado.codigo}
              </Text>
              <Boton
                texto={t.compartir}
                alTocar={() =>
                  void Share.share({
                    message: t.mensaje(estado.codigo ?? '', dinero(estado.paraAmigo)),
                  }).catch(() => undefined)
                }
              />
              <Text style={{ color: '#5E5E5E', marginTop: 10 }}>
                {t.invitados(estado.invitados, estado.premiados)}
              </Text>
            </Tarjeta>
            <Tarjeta>
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>{t.teInvitaron}</Text>
              {estado.yaUsoUnCodigo ? (
                <Text style={{ color: '#5E5E5E' }}>{t.yaUsaste}</Text>
              ) : (
                <>
                  <AvisoBorrador
                    visible={b.recuperado}
                    idioma={idioma}
                    empezar={() => void b.empezarDeNuevo()}
                  />
                  <Campo
                    etiqueta={t.codigo}
                    value={b.valores.codigo}
                    onChangeText={(v) => b.cambiar('codigo', v)}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <Boton texto={t.usar} alTocar={() => void usar()} cargando={ocupado} />
                </>
              )}
            </Tarjeta>
          </>
        ) : null}
        {aviso ? (
          <Text style={{ color: '#0D7A3A', fontWeight: '700', marginTop: 8 }}>{aviso}</Text>
        ) : null}
        {error ? (
          <Text style={{ color: '#C20A1A', marginTop: 8 }} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
