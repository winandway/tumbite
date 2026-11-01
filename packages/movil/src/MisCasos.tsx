import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ErrorApi, enIdioma, useBorrador } from '@tumbite/compartido';
import { alSalirTelefono, almacenTelefono } from './almacen';
import { useSesion } from './sesion';
import { AvisoBorrador } from './AvisoBorrador';
import { Boton, C, Campo, e } from './ui';

/**
 * C-AYUDA-EN-LA-APP (1 nov 2026, pedido de Richard): «Mis casos de ayuda» dentro de las tres apps.
 * Cada caso con su número y el chat con Soporte, sin salir a la web. Lo escrito no se pierde.
 */
const T = {
  es: {
    titulo: 'Mis casos de ayuda',
    sin: 'No tienes casos abiertos.',
    caso: 'Caso',
    estados: {
      abierto: 'Esperando respuesta',
      respondido: 'Respondido',
      cerrado: 'Cerrado',
    } as Record<string, string>,
    tu: 'Tú',
    soporte: 'Soporte',
    responder: 'Escribe tu respuesta',
    enviar: 'Enviar',
    cerrar: 'Cerrar',
  },
  en: {
    titulo: 'My help cases',
    sin: 'You have no open cases.',
    caso: 'Case',
    estados: { abierto: 'Waiting for a reply', respondido: 'Replied', cerrado: 'Closed' } as Record<
      string,
      string
    >,
    tu: 'You',
    soporte: 'Support',
    responder: 'Write your reply',
    enviar: 'Send',
    cerrar: 'Close',
  },
};

type Caso = { codigo: string; numero: string; asunto: string; estado: string };
type Mensaje = { autor: 'persona' | 'equipo'; texto: string; fecha: string };

export function MisCasos() {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [casos, setCasos] = useState<Caso[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const cargar = useCallback(() => {
    api
      .pedir<{ tickets: Caso[] }>('GET', '/datos/mis-tickets')
      .then((r) => setCasos(r.tickets))
      .catch(() => setCasos([]));
  }, [api]);
  useEffect(cargar, [cargar]);
  if (casos === null) return null;
  return (
    <View testID="mis-casos" style={[e.tarjeta, { gap: 8 }]}>
      <Text style={{ fontWeight: '700', fontSize: 16 }}>{t.titulo}</Text>
      {casos.length === 0 ? <Text style={{ color: '#5E5E5E' }}>{t.sin}</Text> : null}
      {casos.map((c) =>
        abierto === c.codigo ? (
          <ChatCaso key={c.codigo} caso={c} alCerrar={() => setAbierto(null)} alEnviar={cargar} />
        ) : (
          <Pressable
            key={c.codigo}
            accessibilityRole="button"
            onPress={() => setAbierto(c.codigo)}
            style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#EEE' }}
          >
            <Text style={{ fontWeight: '700', color: C.secundario }}>
              {t.caso} {c.numero} · {c.asunto}
            </Text>
            <Text style={{ color: c.estado === 'respondido' ? C.exito : '#5E5E5E' }}>
              {t.estados[c.estado] ?? c.estado}
            </Text>
          </Pressable>
        ),
      )}
    </View>
  );
}

function ChatCaso({
  caso,
  alCerrar,
  alEnviar,
}: {
  caso: Caso;
  alCerrar: () => void;
  alEnviar: () => void;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: `caso-${caso.codigo.slice(0, 12)}`,
    cuenta: usuario?.id,
    inicial: { texto: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const leer = useCallback(() => {
    api
      .pedir<{ ticket: { mensajes: Mensaje[] } }>('GET', `/datos/tickets/${caso.codigo}`)
      .then((r) => setMensajes(r.ticket.mensajes))
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api, caso.codigo]);
  useEffect(leer, [leer]);

  async function enviar() {
    const texto = b.valores.texto.trim();
    if (!texto || enviando) return;
    setError('');
    setEnviando(true);
    try {
      const r = await api.pedir<{ mensajes: Mensaje[] }>(
        'POST',
        `/datos/tickets/${caso.codigo}/mensajes`,
        { texto },
      );
      setMensajes(r.mensajes);
      await b.limpiar();
      alEnviar();
    } catch (x) {
      // Lo escrito se queda para reintentar.
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <View
      testID="chat-caso"
      style={{ gap: 6, borderTopWidth: 1, borderTopColor: '#EEE', paddingTop: 8 }}
    >
      <Text style={{ fontWeight: '700', color: C.secundario }}>
        {t.caso} {caso.numero} · {caso.asunto}
      </Text>
      {mensajes.map((m, i) => (
        <View
          key={`${m.fecha}-${i}`}
          style={{
            alignSelf: m.autor === 'persona' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            backgroundColor: m.autor === 'persona' ? '#F1F1F1' : '#E8F3EC',
            borderRadius: 10,
            padding: 8,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#5E5E5E' }}>
            {m.autor === 'persona' ? t.tu : t.soporte}
          </Text>
          <Text>{m.texto}</Text>
        </View>
      ))}
      {caso.estado !== 'cerrado' ? (
        <>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <Campo
            etiqueta={t.responder}
            value={b.valores.texto}
            onChangeText={(x) => b.cambiar('texto', x)}
            multiline
          />
          {error ? <Text style={e.error}>{error}</Text> : null}
          <Boton texto={t.enviar} cargando={enviando} alTocar={() => void enviar()} />
        </>
      ) : null}
      <Boton texto={t.cerrar} secundario alTocar={alCerrar} />
    </View>
  );
}
