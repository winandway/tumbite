import { useCallback, useEffect, useState } from 'react';
import { ErrorApi, type Idioma, enIdioma } from '@tumbite/compartido';
import { MenuTresPuntos } from './MenuTresPuntos';
import { pedir } from './api';

/**
 * C-MODERACION (16 nov 2026, todos los países): la bandeja de reportes del equipo, como la de Uber,
 * DoorDash y Rappi. Llega lo que reporta una persona (mensaje del chat, reseña o respuesta del
 * restaurante) y lo que el filtro de palabras marcó solo. El equipo oculta, vuelve a publicar, avisa
 * a quien lo escribió (sin decir quién reportó), suspende la cuenta (dentro de los tres puntos, con
 * el permiso de suspender) o descarta. Respetamos el compromiso de responder en 24 horas.
 */
/** Lee un texto de una lista por su clave (sin índices sueltos). */
const de = (o: Record<string, string>, k: string) => new Map(Object.entries(o)).get(k) ?? k;

const T = {
  es: {
    titulo: 'Reportes',
    ayuda:
      'Mensajes del chat, reseñas y respuestas que alguien reportó o que el filtro de palabras marcó. Respóndelos en menos de 24 horas.',
    abiertos: 'Por revisar',
    resueltos: 'Resueltos',
    vacio: 'No hay reportes aquí.',
    tipos: {
      mensaje_pedido: 'Chat del pedido',
      mensaje_viaje: 'Chat del viaje',
      resena: 'Reseña',
      respuesta_resena: 'Respuesta del restaurante',
    } as Record<string, string>,
    motivos: {
      ofensivo: 'Ofensivo',
      acoso: 'Acoso o amenaza',
      spam: 'Spam',
      otro: 'Otro',
      filtro: 'Filtro de palabras',
    } as Record<string, string>,
    roles: {
      cliente: 'cliente',
      repartidor: 'repartidor',
      restaurante: 'restaurante',
      admin: 'equipo',
    } as Record<string, string>,
    escribio: 'Lo escribió',
    reporto: 'Lo reportó',
    filtroSolo: 'Lo marcó el filtro de palabras',
    veces: (n: number) => (n > 1 ? `${n} reportes` : '1 reporte'),
    oculto: 'Oculto',
    visible: 'Visible',
    suspendida: 'Cuenta suspendida',
    pedido: 'Pedido',
    viaje: 'Viaje',
    nota: 'Nota',
    ocultar: 'Ocultar',
    publicar: 'Volver a publicar',
    avisar: 'Avisar a quien lo escribió',
    descartar: 'Descartar',
    suspender: 'Suspender la cuenta de quien lo escribió',
    confirmarSuspender:
      '¿Suspender esta cuenta? Se cierra su sesión y no puede volver a entrar hasta que soporte la reactive.',
    accion: {
      ocultar: 'Se ocultó',
      publicar: 'Se publicó',
      avisar: 'Se avisó',
      suspender: 'Se suspendió la cuenta',
      descartar: 'Se descartó',
    } as Record<string, string>,
    hecho: 'Listo.',
    masOpciones: 'Más opciones',
  },
  en: {
    titulo: 'Flagged content',
    ayuda:
      'Chat messages, reviews and replies that someone reported or that the word filter flagged. Respond within 24 hours.',
    abiertos: 'To review',
    resueltos: 'Resolved',
    vacio: 'No reports here.',
    tipos: {
      mensaje_pedido: 'Order chat',
      mensaje_viaje: 'Ride chat',
      resena: 'Review',
      respuesta_resena: 'Restaurant reply',
    } as Record<string, string>,
    motivos: {
      ofensivo: 'Offensive',
      acoso: 'Harassment or threat',
      spam: 'Spam',
      otro: 'Other',
      filtro: 'Word filter',
    } as Record<string, string>,
    roles: {
      cliente: 'customer',
      repartidor: 'driver',
      restaurante: 'restaurant',
      admin: 'team',
    } as Record<string, string>,
    escribio: 'Written by',
    reporto: 'Reported by',
    filtroSolo: 'Flagged by the word filter',
    veces: (n: number) => (n > 1 ? `${n} reports` : '1 report'),
    oculto: 'Hidden',
    visible: 'Visible',
    suspendida: 'Account suspended',
    pedido: 'Order',
    viaje: 'Ride',
    nota: 'Note',
    ocultar: 'Hide',
    publicar: 'Publish again',
    avisar: 'Warn the author',
    descartar: 'Dismiss',
    suspender: 'Suspend the author’s account',
    confirmarSuspender:
      'Suspend this account? Their session ends and they can’t sign in until support reactivates it.',
    accion: {
      ocultar: 'Hidden',
      publicar: 'Published',
      avisar: 'Warned',
      suspender: 'Account suspended',
      descartar: 'Dismissed',
    } as Record<string, string>,
    hecho: 'Done.',
    masOpciones: 'More options',
  },
};

type Reporte = {
  id: string;
  tipo: string;
  objeto: string;
  objetoId: string;
  motivo: string;
  nota: string;
  texto: string;
  estado: string;
  accion: string | null;
  creadoEn: string;
  oculto: boolean;
  veces: number;
  autor: { id: string; nombre: string; rol: string; activo: boolean } | null;
  reporta: { nombre: string; rol: string } | null;
};

export function SuperReportes({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [estado, setEstado] = useState<'abierto' | 'resuelto'>('abierto');
  const [lista, setLista] = useState<Reporte[] | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const cargar = useCallback(() => {
    pedir<{ reportes: Reporte[] }>('GET', `/datos/admin/reportes?estado=${estado}`)
      .then((r) => {
        setError('');
        setLista(r.reportes);
      })
      .catch((x: unknown) => setError(x instanceof ErrorApi ? x.message : String(x)));
  }, [estado]);
  useEffect(() => cargar(), [cargar]);

  async function actuar(r: Reporte, accion: string) {
    if (accion === 'suspender' && !window.confirm(t.confirmarSuspender)) return;
    setError('');
    setAviso('');
    try {
      await pedir('POST', `/datos/admin/reportes/${r.id}/accion`, { accion });
      setAviso(`${t.hecho} ${de(t.accion, accion)}`);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <p className="suave">{t.ayuda}</p>
      <div className="super-filtros" role="tablist">
        {(
          [
            ['abierto', t.abiertos],
            ['resuelto', t.resueltos],
          ] as const
        ).map(([v, n]) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={estado === v}
            className={estado === v ? 'activa' : undefined}
            onClick={() => setEstado(v)}
          >
            {n}
          </button>
        ))}
      </div>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p className="exito-general" role="status">
          {aviso}
        </p>
      ) : null}
      {lista?.length === 0 ? <p>{t.vacio}</p> : null}
      <ul className="super-reportes">
        {lista?.map((r) => (
          <li key={r.id} className="super-reporte">
            <div className="super-reporte-cabeza">
              <span className="insignia">{de(t.tipos, r.tipo)}</span>
              <span className={r.motivo === 'acoso' ? 'insignia insignia-rechazado' : 'insignia'}>
                {de(t.motivos, r.motivo)}
              </span>
              <span className="insignia">{r.oculto ? t.oculto : t.visible}</span>
              <small>
                {t.veces(r.veces)} · {r.creadoEn.slice(0, 16)} ·{' '}
                {r.objeto === 'viaje' ? t.viaje : t.pedido} #{r.objetoId.slice(0, 6).toUpperCase()}
              </small>
              {r.estado === 'abierto' && r.autor && r.autor.rol !== 'admin' ? (
                <MenuTresPuntos
                  etiqueta={t.masOpciones}
                  opciones={[
                    {
                      texto: t.suspender,
                      peligro: true,
                      alTocar: () => void actuar(r, 'suspender'),
                    },
                  ]}
                />
              ) : null}
            </div>
            <blockquote className="super-reporte-texto">{r.texto}</blockquote>
            <p className="super-reporte-quien">
              {r.autor ? (
                <>
                  {t.escribio}: <strong>{r.autor.nombre}</strong> ({de(t.roles, r.autor.rol)})
                  {!r.autor.activo ? ` · ${t.suspendida}` : ''}
                </>
              ) : null}
              <br />
              {r.reporta ? (
                <>
                  {t.reporto}: {r.reporta.nombre} ({de(t.roles, r.reporta.rol)})
                </>
              ) : (
                t.filtroSolo
              )}
              {r.nota ? (
                <>
                  <br />
                  {t.nota}: {r.nota}
                </>
              ) : null}
            </p>
            {r.estado === 'abierto' ? (
              <div className="super-reporte-acciones">
                {r.oculto ? (
                  <button
                    type="button"
                    className="boton secundario"
                    onClick={() => void actuar(r, 'publicar')}
                  >
                    {t.publicar}
                  </button>
                ) : (
                  <button type="button" className="boton" onClick={() => void actuar(r, 'ocultar')}>
                    {t.ocultar}
                  </button>
                )}
                {r.autor && r.autor.rol !== 'admin' ? (
                  <button
                    type="button"
                    className="boton secundario"
                    onClick={() => void actuar(r, 'avisar')}
                  >
                    {t.avisar}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="boton secundario"
                  onClick={() => void actuar(r, 'descartar')}
                >
                  {t.descartar}
                </button>
              </div>
            ) : (
              <p className="suave">{r.accion ? de(t.accion, r.accion) : ''}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
