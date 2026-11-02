import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { ErrorApi, deSqlUtc, enIdioma, textoEtiqueta, useBorrador } from '@tumbite/compartido';
import { C, Campo, alSalirTelefono, almacenTelefono, e, useSesion } from '@tumbite/movil';
import { BotonGrande, Tarjeta } from './piezas/ui';

/**
 * C-APP-RESTAURANTE-PAR (30 oct 2026): reseñas y respuesta desde el celular, como en DoorDash
 * Merchant y Uber Eats Manager. Lo escrito en la respuesta se guarda solo (borrador).
 */
const T = {
  es: {
    titulo: 'Reseñas',
    resumen: (p: string, n: number, r: number) => `★ ${p} · ${n} reseñas · ${r} respondidas`,
    sinResenas: 'Todavía no tienes reseñas.',
    responder: 'Tu respuesta pública',
    publicar: 'Publicar respuesta',
    tuRespuesta: 'Tu respuesta',
    ejemplo: '¡Gracias por pedir! Te esperamos pronto.',
    volver: 'Volver',
    soloManager: 'Solo el dueño y los managers pueden responder.',
    elogios: 'Lo que más elogian',
    motivos: 'Lo que salió mal',
  },
  en: {
    titulo: 'Reviews',
    resumen: (p: string, n: number, r: number) => `★ ${p} · ${n} reviews · ${r} replied`,
    sinResenas: 'You don’t have reviews yet.',
    responder: 'Your public reply',
    publicar: 'Publish reply',
    tuRespuesta: 'Your reply',
    ejemplo: 'Thanks for ordering! See you soon.',
    volver: 'Back',
    soloManager: 'Only the owner and managers can reply.',
    elogios: 'What customers praise most',
    motivos: 'What went wrong',
  },
};

type Resena = {
  pedidoId: string;
  cliente: string;
  estrellas: number;
  comentario: string;
  respuesta: string | null;
  creadoEn?: string;
  /** C-ELOGIOS-MOTIVOS */
  etiquetas?: string[];
};
type EtiquetaFila = { etiqueta: string; n: number; es: string; en: string };

function Responder({ pedidoId, alPublicar }: { pedidoId: string; alPublicar: () => void }) {
  const { api, idioma, usuario } = useSesion();
  const t = enIdioma(T, idioma);
  const b = useBorrador({
    formulario: `app-respuesta-${pedidoId}`,
    cuenta: usuario?.id,
    inicial: { texto: '' },
    almacen: almacenTelefono,
    alSalir: alSalirTelefono,
  });
  const [error, setError] = useState('');
  return (
    <View style={{ marginTop: 8 }}>
      <Campo
        etiqueta={t.responder}
        value={b.valores.texto}
        onChangeText={(x) => b.cambiar('texto', x)}
        placeholder={t.ejemplo}
        multiline
        maxLength={600}
      />
      {error ? <Text style={e.error}>{error}</Text> : null}
      <BotonGrande
        texto={t.publicar}
        tipo="claro"
        alTocar={() =>
          void api
            .pedir('POST', `/datos/mi-restaurante/resenas/${pedidoId}/responder`, {
              texto: b.valores.texto,
            })
            .then(async () => {
              await b.limpiar();
              alPublicar();
            })
            .catch((x: unknown) =>
              setError(
                x instanceof ErrorApi && x.estado === 403
                  ? t.soloManager
                  : x instanceof ErrorApi
                    ? x.message
                    : String(x),
              ),
            )
        }
      />
    </View>
  );
}

export function Resenas({ alVolver }: { alVolver: () => void }) {
  const { api, idioma } = useSesion();
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<{
    promedio: number | null;
    total: number;
    respondidas: number;
    resenas: Resena[];
    elogios?: EtiquetaFila[];
    motivos?: EtiquetaFila[];
  } | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    api
      .pedir<NonNullable<typeof datos>>('GET', '/datos/mi-restaurante/resenas')
      .then(setDatos)
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [api]);
  useEffect(cargar, [cargar]);
  return (
    <View testID="app-resenas">
      <Text
        accessibilityRole="header"
        style={{ fontSize: 22, fontWeight: '800', color: C.secundario, marginBottom: 6 }}
      >
        {t.titulo}
      </Text>
      {error ? <Text style={e.error}>{error}</Text> : null}
      {datos && datos.total > 0 ? (
        <Text style={{ color: '#5E5E5E', marginBottom: 10 }}>
          {t.resumen((datos.promedio ?? 0).toFixed(1), datos.total, datos.respondidas)}
        </Text>
      ) : null}
      {/* C-ELOGIOS-MOTIVOS: cuántas veces eligieron cada elogio y cada motivo. */}
      {[
        { k: 'elogios', titulo: t.elogios, lista: datos?.elogios ?? [] },
        { k: 'motivos', titulo: t.motivos, lista: datos?.motivos ?? [] },
      ].map((x) =>
        x.lista.length ? (
          <Text key={x.k} style={{ color: C.secundario, marginBottom: 8 }} testID={`app-${x.k}`}>
            <Text style={{ fontWeight: '800' }}>{x.titulo}: </Text>
            {x.lista.map((y) => `${idioma === 'en' ? y.en : y.es} (${y.n})`).join(' · ')}
          </Text>
        ) : null,
      )}
      {datos && !datos.resenas.length ? (
        <Text style={{ color: '#5E5E5E' }}>{t.sinResenas}</Text>
      ) : null}
      {(datos?.resenas ?? []).map((r) => (
        <Tarjeta key={r.pedidoId}>
          <Text style={{ fontWeight: '800', color: C.secundario }}>
            {r.cliente} <Text style={{ color: C.primario }}>{'★'.repeat(r.estrellas)}</Text>
            {r.creadoEn ? (
              <Text style={{ color: '#9a9a9a', fontWeight: '400' }}>
                {' '}
                ·{' '}
                {deSqlUtc(r.creadoEn).toLocaleDateString(idioma === 'en' ? 'en-US' : 'es-ES', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            ) : null}
          </Text>
          {r.comentario ? <Text style={{ marginTop: 4 }}>{r.comentario}</Text> : null}
          {r.etiquetas?.length ? (
            <Text style={{ marginTop: 4, color: '#5E5E5E' }}>
              {r.etiquetas
                .map((x) => textoEtiqueta('restaurante', x, idioma === 'en' ? 'en' : 'es'))
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
          {r.respuesta ? (
            <Text style={{ marginTop: 6, color: '#5E5E5E' }}>
              <Text style={{ fontWeight: '800' }}>{t.tuRespuesta}: </Text>
              {r.respuesta}
            </Text>
          ) : (
            <Responder pedidoId={r.pedidoId} alPublicar={cargar} />
          )}
        </Tarjeta>
      ))}
      <BotonGrande texto={t.volver} tipo="claro" alTocar={alVolver} />
    </View>
  );
}
