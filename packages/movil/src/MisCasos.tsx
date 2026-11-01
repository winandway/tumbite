import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
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
    adjuntar: 'Adjuntar captura',
    quitar: 'Quitar',
    maximo: 'Puedes adjuntar hasta 3 capturas por mensaje.',
    subiendo: 'Subiendo las capturas…',
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
    adjuntar: 'Attach screenshot',
    quitar: 'Remove',
    maximo: 'You can attach up to 3 screenshots per message.',
    subiendo: 'Uploading the screenshots…',
  },
};

/** C-CASOS-CAPTURAS: cada app pasa su selector de fotos (la galería del celular). */
export type Captura = { uri: string; nombre: string };
export type ElegirCapturas = (maximo: number) => Promise<Captura[]>;
const MAX_CAPTURAS = 3;

type Caso = { codigo: string; numero: string; asunto: string; estado: string };
type Adjunto = { id: string; nombre: string; tipo: string; url: string | null };
type Mensaje = { autor: 'persona' | 'equipo'; texto: string; fecha: string; adjuntos?: Adjunto[] };

export function MisCasos({ elegirCapturas }: { elegirCapturas?: ElegirCapturas } = {}) {
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
          <ChatCaso
            key={c.codigo}
            caso={c}
            alCerrar={() => setAbierto(null)}
            alEnviar={cargar}
            elegirCapturas={elegirCapturas}
          />
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
  elegirCapturas,
}: {
  caso: Caso;
  alCerrar: () => void;
  alEnviar: () => void;
  elegirCapturas?: ElegirCapturas;
}) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  // Las capturas elegidas, con su miniatura, antes de enviar (no se pierden si la subida falla).
  const [capturas, setCapturas] = useState<Captura[]>([]);
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

  async function adjuntar() {
    if (!elegirCapturas) return;
    const libres = MAX_CAPTURAS - capturas.length;
    if (libres <= 0) return setError(t.maximo);
    try {
      const nuevas = await elegirCapturas(libres);
      setCapturas((x) => [...x, ...nuevas].slice(0, MAX_CAPTURAS));
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function enviar() {
    const texto = b.valores.texto.trim();
    if ((!texto && !capturas.length) || enviando) return;
    setError('');
    setEnviando(true);
    try {
      // Primero se suben las capturas; si una falla, el texto y las capturas quedan en pantalla.
      const ids: string[] = [];
      for (const c of capturas) {
        const blob = await (await fetch(c.uri)).blob();
        const r = await api.subirArchivo<{ adjunto: { id: string } }>(
          blob,
          `/datos/tickets/${caso.codigo}/adjuntos?nombre=${encodeURIComponent(c.nombre)}`,
        );
        ids.push(r.adjunto.id);
      }
      const r = await api.pedir<{ mensajes: Mensaje[] }>(
        'POST',
        `/datos/tickets/${caso.codigo}/mensajes`,
        { texto, adjuntos: ids },
      );
      setMensajes(r.mensajes);
      setCapturas([]);
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
          {m.texto ? <Text>{m.texto}</Text> : null}
          {(m.adjuntos ?? []).map((a) =>
            a.url && a.tipo !== 'image/heic' ? (
              <Image
                key={a.id}
                source={{ uri: a.url }}
                style={{ width: 160, height: 160, borderRadius: 8, marginTop: 6 }}
                resizeMode="cover"
                accessibilityLabel={a.nombre}
              />
            ) : (
              <Text key={a.id} style={{ color: '#5E5E5E', marginTop: 4 }}>
                {a.nombre}
              </Text>
            ),
          )}
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
          {capturas.length ? (
            <View
              testID="capturas-elegidas"
              style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
            >
              {capturas.map((c, i) => (
                <View key={`${c.uri}-${i}`} style={{ alignItems: 'center', gap: 2 }}>
                  <Image
                    source={{ uri: c.uri }}
                    style={{ width: 72, height: 72, borderRadius: 8 }}
                    accessibilityLabel={c.nombre}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${t.quitar} ${c.nombre}`}
                    onPress={() => setCapturas((x) => x.filter((_, j) => j !== i))}
                    hitSlop={6}
                  >
                    <Text
                      style={{ color: '#5E5E5E', fontSize: 12, textDecorationLine: 'underline' }}
                    >
                      {t.quitar}
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}
          {error ? <Text style={e.error}>{error}</Text> : null}
          {elegirCapturas && capturas.length < MAX_CAPTURAS ? (
            <Boton texto={t.adjuntar} secundario alTocar={() => void adjuntar()} />
          ) : null}
          <Boton
            texto={enviando && capturas.length ? t.subiendo : t.enviar}
            cargando={enviando}
            alTocar={() => void enviar()}
          />
        </>
      ) : null}
      <Boton texto={t.cerrar} secundario alTocar={alCerrar} />
    </View>
  );
}
