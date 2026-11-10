import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  correoEjemplo,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { pedir } from './api';
import { MenuTresPuntos } from './MenuTresPuntos';

/**
 * C-FLOTA-PROPIA (10 nov 2026) — Chile y todos los países. El restaurante que reparte con los
 * suyos: elige quién lleva sus pedidos, invita a sus repartidores (usan Divoox Driver) y ve
 * quién está conectado. Sus repartidores reciben solo los pedidos de este restaurante.
 */
const T = {
  es: {
    titulo: 'Mis repartidores',
    intro:
      'Si tu restaurante tiene sus propios repartidores, invítalos aquí. Usan la app Divoox Driver y reciben solo los pedidos de tu restaurante. Tu cliente ve el mismo seguimiento de siempre.',
    quien: '¿Quién reparte tus pedidos?',
    divoox: 'Repartidores de Divoox',
    divooxPista: 'Divoox busca al repartidor más cercano para cada pedido.',
    propia: 'Mis propios repartidores',
    propiaPista: 'Cada pedido se ofrece solo a los repartidores de tu equipo.',
    respaldo: 'Si ninguno de mis repartidores está libre, pasar el pedido a los de Divoox',
    respaldoPista: 'Apagado, el pedido espera a tu equipo y te avisamos para que lo resuelvas tú.',
    guardar: 'Guardar',
    guardado: 'Guardado.',
    invitar: 'Invitar a un repartidor',
    nombre: 'Nombre del repartidor',
    correo: 'Correo electrónico',
    telefono: 'Número de celular',
    enviar: 'Enviar invitación',
    enviando: 'Enviando…',
    lista: 'Invitación lista. Compártele este enlace para que entre a tu equipo:',
    copiar: 'Copiar enlace',
    copiado: 'Copiado',
    whatsapp: 'Enviar por WhatsApp',
    mensaje:
      '{restaurante} te invitó a repartir sus pedidos con Divoox Driver. Entra aquí: {enlace}',
    pendientes: 'Invitaciones pendientes',
    espera: 'Espera su respuesta',
    cancelar: 'Cancelar invitación',
    equipo: 'Mi equipo de reparto',
    vacio: 'Todavía no tienes repartidores en tu equipo. Invita al primero arriba.',
    conectado: 'Conectado',
    desconectado: 'Desconectado',
    ocupado: 'Con un pedido',
    retirar: 'Quitar de mi equipo',
    confirmarRetiro: '¿Quitar a {nombre} de tu equipo? Dejará de recibir tus pedidos.',
    sinRepartidor: 'Pedidos esperando a tu equipo',
    sinRepartidorPista:
      'Ninguno de tus repartidores estaba libre para estos pedidos. Avísale a tu equipo o enciende el respaldo de Divoox.',
    pedido: 'Pedido',
    recuperado: 'Recuperamos lo que estabas escribiendo.',
    empezar: 'Empezar de nuevo',
    cargando: 'Cargando…',
  },
  en: {
    titulo: 'My drivers',
    intro:
      'If your restaurant has its own drivers, invite them here. They use the Divoox Driver app and only get your restaurant’s orders. Your customer sees the same tracking as always.',
    quien: 'Who delivers your orders?',
    divoox: 'Divoox drivers',
    divooxPista: 'Divoox finds the nearest driver for each order.',
    propia: 'My own drivers',
    propiaPista: 'Each order is offered only to the drivers on your team.',
    respaldo: 'If none of my drivers is free, hand the order to Divoox drivers',
    respaldoPista:
      'When off, the order waits for your team and we alert you so you can sort it out.',
    guardar: 'Save',
    guardado: 'Saved.',
    invitar: 'Invite a driver',
    nombre: 'Driver’s name',
    correo: 'Email',
    telefono: 'Mobile number',
    enviar: 'Send invitation',
    enviando: 'Sending…',
    lista: 'Invitation ready. Share this link so they can join your team:',
    copiar: 'Copy link',
    copiado: 'Copied',
    whatsapp: 'Send on WhatsApp',
    mensaje:
      '{restaurante} invited you to deliver its orders with Divoox Driver. Join here: {enlace}',
    pendientes: 'Pending invitations',
    espera: 'Waiting for a reply',
    cancelar: 'Cancel invitation',
    equipo: 'My delivery team',
    vacio: 'You don’t have drivers on your team yet. Invite the first one above.',
    conectado: 'Online',
    desconectado: 'Offline',
    ocupado: 'On an order',
    retirar: 'Remove from my team',
    confirmarRetiro: 'Remove {nombre} from your team? They will stop getting your orders.',
    sinRepartidor: 'Orders waiting for your team',
    sinRepartidorPista:
      'None of your drivers was free for these orders. Tell your team or turn on the Divoox backup.',
    pedido: 'Order',
    recuperado: 'We recovered what you were writing.',
    empezar: 'Start over',
    cargando: 'Loading…',
  },
};

type Datos = {
  disponible: boolean;
  restaurante?: string;
  modo: 'divoox' | 'propia';
  respaldo: boolean;
  repartidores: { id: string; nombre: string; conectado: boolean; ocupado: boolean }[];
  invitaciones: { id: string; nombre: string; correo: string | null; telefono: string | null }[];
  sinRepartidor: { id: string; codigo: string }[];
};

const mensajeDe = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

export function Flota({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [modo, setModo] = useState<'divoox' | 'propia'>('divoox');
  const [respaldo, setRespaldo] = useState(false);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enlace, setEnlace] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const b = useBorrador({
    formulario: 'flota-invitar',
    inicial: { nombre: '', correo: '', telefono: '' },
    almacen: almacenNavegador,
  });
  const v = b.valores;

  const cargar = useCallback(() => {
    pedir<Datos>('GET', '/datos/mi-restaurante/flota')
      .then((r) => {
        setDatos(r);
        setModo(r.modo);
        setRespaldo(r.respaldo);
      })
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, []);
  useEffect(cargar, [cargar]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAviso('');
    try {
      await pedir('PUT', '/datos/mi-restaurante/flota', { modo, respaldo });
      setAviso(t.guardado);
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }

  async function invitar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEnlace('');
    setCopiado(false);
    setEnviando(true);
    try {
      const r = await pedir<{ enlace: string }>(
        'POST',
        '/datos/mi-restaurante/flota/invitaciones',
        {
          nombre: v.nombre,
          correo: v.correo,
          telefono: v.telefono,
        },
      );
      setEnlace(r.enlace);
      await b.limpiar();
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(mensajeDe(x));
    } finally {
      setEnviando(false);
    }
  }

  const quitar = (ruta: string) =>
    pedir('DELETE', ruta)
      .then(cargar)
      .catch((x: unknown) => setError(mensajeDe(x)));

  if (!datos)
    return (
      <section>{error ? <p className="error-general">{error}</p> : <p>{t.cargando}</p>}</section>
    );
  const whatsapp = t.mensaje
    .replace('{restaurante}', datos.restaurante || 'Divoox')
    .replace('{enlace}', enlace);
  return (
    <section data-testid="flota">
      <h1>{t.titulo}</h1>
      <p className="suave">{t.intro}</p>
      {datos.sinRepartidor.length ? (
        <div className="tarjeta-form" role="alert" data-testid="flota-sin-repartidor">
          <h2>{t.sinRepartidor}</h2>
          <p className="suave">{t.sinRepartidorPista}</p>
          <ul className="super-lista">
            {datos.sinRepartidor.map((p) => (
              <li key={p.id}>
                <strong>
                  {t.pedido} {p.codigo.toUpperCase()}
                </strong>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <form onSubmit={guardar} className="formulario" noValidate>
        <fieldset>
          <legend>{t.quien}</legend>
          <label className="opcion">
            <input
              type="radio"
              name="flota-modo"
              checked={modo === 'divoox'}
              onChange={() => setModo('divoox')}
            />
            <span>
              <strong>{t.divoox}</strong>
              <small>{t.divooxPista}</small>
            </span>
          </label>
          <label className="opcion">
            <input
              type="radio"
              name="flota-modo"
              checked={modo === 'propia'}
              onChange={() => setModo('propia')}
            />
            <span>
              <strong>{t.propia}</strong>
              <small>{t.propiaPista}</small>
            </span>
          </label>
        </fieldset>
        {modo === 'propia' ? (
          <label className="opcion">
            <input
              type="checkbox"
              checked={respaldo}
              onChange={(e) => setRespaldo(e.target.checked)}
            />
            <span>
              <strong>{t.respaldo}</strong>
              <small>{t.respaldoPista}</small>
            </span>
          </label>
        ) : null}
        {aviso && (
          <p className="ok" role="status">
            {aviso}
          </p>
        )}
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>

      <h2>{t.invitar}</h2>
      {b.recuperado && (
        <p className="aviso-borrador">
          {t.recuperado}{' '}
          <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
            {t.empezar}
          </button>
        </p>
      )}
      <form onSubmit={invitar} className="formulario" noValidate>
        <label className="campo">
          <span>{t.nombre}</span>
          <input
            value={v.nombre}
            onChange={(e) => b.cambiar('nombre', e.target.value)}
            placeholder={t.nombre}
            autoComplete="off"
          />
        </label>
        <label className="campo">
          <span>{t.correo}</span>
          <input
            type="email"
            value={v.correo}
            onChange={(e) => b.cambiar('correo', e.target.value)}
            placeholder={correoEjemplo(idioma)}
            autoComplete="off"
          />
        </label>
        <label className="campo">
          <span>{t.telefono}</span>
          <input
            type="tel"
            value={v.telefono}
            onChange={(e) => b.cambiar('telefono', e.target.value)}
            placeholder={t.telefono}
            autoComplete="off"
          />
        </label>
        {error && (
          <p className="error-general" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? t.enviando : t.enviar}
        </button>
      </form>
      {enlace ? (
        <div className="flex-enlace-invitacion" role="status" data-testid="flota-enlace">
          <p className="texto-exito">{t.lista}</p>
          <code>{enlace}</code>
          <div className="flex-encabezado-botones">
            <button
              type="button"
              className="boton secundario"
              onClick={() => {
                void navigator.clipboard?.writeText(enlace).then(() => setCopiado(true));
              }}
            >
              {copiado ? t.copiado : t.copiar}
            </button>
            <a
              className="boton"
              href={`https://wa.me/?text=${encodeURIComponent(whatsapp)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.whatsapp}
            </a>
          </div>
        </div>
      ) : null}

      {datos.invitaciones.length ? (
        <>
          <h2>{t.pendientes}</h2>
          <ul className="super-lista">
            {datos.invitaciones.map((i) => (
              <li key={i.id}>
                <div className="lista-texto">
                  <strong>{i.nombre}</strong>
                  <span>
                    {i.correo ?? i.telefono ?? ''} · {t.espera}
                  </span>
                </div>
                <MenuTresPuntos
                  etiqueta={`${t.cancelar}: ${i.nombre}`}
                  opciones={[
                    {
                      texto: t.cancelar,
                      peligro: true,
                      alTocar: () =>
                        void quitar(`/datos/mi-restaurante/flota/invitaciones/${i.id}`),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h2>{t.equipo}</h2>
      {datos.repartidores.length === 0 ? (
        <p className="pista">{t.vacio}</p>
      ) : (
        <ul className="super-lista">
          {datos.repartidores.map((r) => (
            <li key={r.id}>
              <div className="lista-texto">
                <strong>{r.nombre}</strong>
                <span
                  className={`insignia ${r.conectado ? 'insignia-aprobado' : 'insignia-pausado'}`}
                >
                  {r.ocupado ? t.ocupado : r.conectado ? t.conectado : t.desconectado}
                </span>
              </div>
              <MenuTresPuntos
                etiqueta={`${t.retirar}: ${r.nombre}`}
                opciones={[
                  {
                    texto: t.retirar,
                    peligro: true,
                    alTocar: () => {
                      if (window.confirm(t.confirmarRetiro.replace('{nombre}', r.nombre)))
                        void quitar(`/datos/mi-restaurante/flota/repartidores/${r.id}`);
                    },
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
