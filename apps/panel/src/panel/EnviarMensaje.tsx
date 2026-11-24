/* eslint-disable security/detect-object-injection -- las claves son pasos, idiomas, canales y zonas de listas propias (PASOS_MENSAJE, es/en, CANALES) o que vienen del servidor validadas con zod */
import { useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { Insignia } from './diseno/Insignia';
import { pedir } from './api';
import { Dialogo } from './SuperRezagados';
import {
  PASOS_MENSAJE,
  type CanalMensaje,
  nombreCanal,
  nombrePasoMensaje,
  resultadoEnPalabras,
  tonoMensaje,
} from './rezagadosTextos';
import './rezagados.css';

/**
 * C-REZAGADOS (22 nov 2026) — todos los países. «Enviar mensaje» desde los tres puntos de la ficha de
 * una cuenta (conductor o cliente): una plantilla de registro o un texto libre, por correo, SMS y/o
 * aviso en la app. Primero se ve cómo queda (el servidor arma el mensaje sin enviarlo) y solo después
 * se puede enviar. El resultado se dice por canal, en palabras. Lo escrito no se pierde.
 */
const T = {
  es: {
    titulo: 'Enviar mensaje',
    ayuda:
      'Sale firmado por Camila y queda en la línea de tiempo de la cuenta con tu nombre. La persona puede responder el correo y le contesta Camila.',
    que: 'Qué le mandas',
    plantilla: 'Una plantilla de registro',
    libre: 'Un texto escrito por ti',
    cual: 'Plantilla',
    asunto: 'Asunto del correo',
    asuntoEjemplo: 'Un mensaje de Divoox',
    texto: 'Mensaje',
    textoEjemplo: 'Escribe el mensaje para esta persona',
    libreSms: 'Por SMS sale el mismo texto, recortado a 160 caracteres.',
    canales: 'Por dónde',
    ver: 'Ver cómo queda',
    viendo: 'Armando el mensaje…',
    enviar: 'Enviar',
    enviando: 'Enviando…',
    cerrar: 'Cerrar',
    cancelar: 'Cancelar',
    faltaVista: 'Primero toca «Ver cómo queda» para revisar el mensaje antes de enviarlo.',
    vistaVieja: 'Cambiaste el mensaje: vuelve a tocar «Ver cómo queda».',
    faltaCanal: 'Elige al menos un canal.',
    faltaTexto: 'Escribe el mensaje (al menos 10 caracteres).',
    asi: 'Así le llega',
    idioma: {
      es: 'Sale en español, el idioma de su cuenta.',
      en: 'Sale en inglés, el idioma de su cuenta.',
    },
    vistaAsunto: 'Asunto',
    vistaSms: 'SMS',
    vistaAviso: 'Aviso en la app',
    resultado: 'Resultado',
  },
  en: {
    titulo: 'Send message',
    ayuda:
      'It goes out signed by Camila and stays in the account’s timeline with your name. The person can reply to the email and Camila answers.',
    que: 'What you send',
    plantilla: 'A sign-up template',
    libre: 'A text you write',
    cual: 'Template',
    asunto: 'Email subject',
    asuntoEjemplo: 'A message from Divoox',
    texto: 'Message',
    textoEjemplo: 'Write the message for this person',
    libreSms: 'By SMS the same text goes out, cut to 160 characters.',
    canales: 'Channels',
    ver: 'Preview',
    viendo: 'Building the message…',
    enviar: 'Send',
    enviando: 'Sending…',
    cerrar: 'Close',
    cancelar: 'Cancel',
    faltaVista: 'First tap “Preview” to check the message before sending it.',
    vistaVieja: 'You changed the message: tap “Preview” again.',
    faltaCanal: 'Choose at least one channel.',
    faltaTexto: 'Write the message (at least 10 characters).',
    asi: 'This is what they get',
    idioma: {
      es: 'It goes out in Spanish, their account language.',
      en: 'It goes out in English, their account language.',
    },
    vistaAsunto: 'Subject',
    vistaSms: 'SMS',
    vistaAviso: 'App notification',
    resultado: 'Result',
  },
};

type Vista = {
  asunto: string;
  texto: string;
  sms: string;
  aviso: { titulo: string; cuerpo: string };
  idioma: 'es' | 'en';
};
type Resultado = { canal: string; estado: string; detalle: string };
const CANALES: CanalMensaje[] = ['correo', 'sms', 'aviso'];

export function EnviarMensaje({
  id,
  rol,
  idioma,
  alCerrar,
  alEnviar,
}: {
  id: string;
  /** El conductor ve todas las plantillas; el cliente, la del correo y la de «le cuesta entrar». */
  rol: 'repartidor' | 'cliente';
  idioma: Idioma;
  alCerrar: () => void;
  alEnviar: () => void;
}) {
  const t = enIdioma(T, idioma);
  const pasos = rol === 'repartidor' ? PASOS_MENSAJE : (['correo', 'clave'] as const);
  const b = useBorrador({
    formulario: `mensaje-cuenta-${id}`,
    cuenta: 'superadmin',
    inicial: {
      modo: 'plantilla',
      plantilla: pasos[0] as string,
      asunto: '',
      texto: '',
      correo: true,
      sms: false,
      aviso: true,
    },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [vista, setVista] = useState<{ firma: string; datos: Vista } | null>(null);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState<'' | 'viendo' | 'enviando'>('');

  const canales = CANALES.filter((c) => v[c]);
  const cuerpo = {
    canales,
    ...(v.modo === 'plantilla'
      ? { plantilla: v.plantilla }
      : { asunto: v.asunto.trim() || undefined, texto: v.texto.trim() }),
  };
  const firma = JSON.stringify(cuerpo);
  const vistaVigente = vista?.firma === firma ? vista.datos : null;
  const motivoNo = !canales.length
    ? t.faltaCanal
    : v.modo === 'libre' && v.texto.trim().length < 10
      ? t.faltaTexto
      : !vista
        ? t.faltaVista
        : !vistaVigente
          ? t.vistaVieja
          : '';

  async function ver() {
    setError('');
    if (!canales.length) return setError(t.faltaCanal);
    if (v.modo === 'libre' && v.texto.trim().length < 10) return setError(t.faltaTexto);
    setOcupado('viendo');
    try {
      const r = await pedir<{ vista: Vista }>(
        'POST',
        `/datos/admin/camila/recordatorios/${encodeURIComponent(id)}/mensaje`,
        { ...cuerpo, soloVista: true },
      );
      setVista({ firma, datos: r.vista });
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado('');
    }
  }
  async function enviar() {
    if (motivoNo) return;
    setError('');
    setOcupado('enviando');
    try {
      const r = await pedir<{ resultados: Resultado[] }>(
        'POST',
        `/datos/admin/camila/recordatorios/${encodeURIComponent(id)}/mensaje`,
        cuerpo,
      );
      setResultados(r.resultados ?? []);
      await b.limpiar();
      setVista(null);
      alEnviar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    } finally {
      setOcupado('');
    }
  }

  return (
    <Dialogo titulo={t.titulo} alCerrar={alCerrar} testId="enviar-mensaje" ancho>
      <p className="pista">
        {t.ayuda} <AyudaAqui guia="signup-reminders" idioma={idioma} />
      </p>
      {resultados ? (
        <div data-testid="enviar-mensaje-resultado">
          <h3>{t.resultado}</h3>
          <ul className="rez-resultados">
            {resultados.map((r) => (
              <li key={r.canal}>
                <Insignia tono={tonoMensaje(r.estado)}>{resultadoEnPalabras(r, idioma)}</Insignia>
              </li>
            ))}
          </ul>
          <div className="rez-dialogo-botones">
            <button type="button" className="boton" onClick={alCerrar}>
              {t.cerrar}
            </button>
          </div>
        </div>
      ) : (
        <>
          <AvisoBorrador
            visible={b.recuperado}
            idioma={idioma}
            empezar={() => void b.empezarDeNuevo()}
          />
          <fieldset className="rez-sin-marco">
            <legend className="campo-leyenda">{t.que}</legend>
            <div className="rez-canales">
              <label className="casilla-fila rez-opcion">
                <input
                  type="radio"
                  name={`modo-${id}`}
                  checked={v.modo === 'plantilla'}
                  onChange={() => b.cambiar('modo', 'plantilla')}
                />
                {t.plantilla}
              </label>
              <label className="casilla-fila rez-opcion">
                <input
                  type="radio"
                  name={`modo-${id}`}
                  checked={v.modo === 'libre'}
                  onChange={() => b.cambiar('modo', 'libre')}
                />
                {t.libre}
              </label>
            </div>
          </fieldset>
          {v.modo === 'plantilla' ? (
            <label className="campo">
              {t.cual}
              <select value={v.plantilla} onChange={(e) => b.cambiar('plantilla', e.target.value)}>
                {pasos.map((p) => (
                  <option key={p} value={p}>
                    {nombrePasoMensaje(p, idioma)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="campo">
                {t.asunto}
                <input
                  value={v.asunto}
                  maxLength={120}
                  placeholder={t.asuntoEjemplo}
                  onChange={(e) => b.cambiar('asunto', e.target.value)}
                />
              </label>
              <label className="campo">
                {t.texto}
                <textarea
                  rows={6}
                  value={v.texto}
                  maxLength={1500}
                  placeholder={t.textoEjemplo}
                  onChange={(e) => b.cambiar('texto', e.target.value)}
                />
                <small>{t.libreSms}</small>
              </label>
            </>
          )}
          <fieldset className="rez-sin-marco">
            <legend className="campo-leyenda">{t.canales}</legend>
            <div className="rez-canales">
              {CANALES.map((c) => (
                <label key={c} className="casilla-fila rez-opcion">
                  <input
                    type="checkbox"
                    checked={v[c]}
                    onChange={(e) => b.cambiar(c, e.target.checked)}
                  />
                  {nombreCanal(c, idioma)}
                </label>
              ))}
            </div>
          </fieldset>
          {vistaVigente ? (
            <div data-testid="enviar-mensaje-vista">
              <h3>{t.asi}</h3>
              <p className="pista">{t.idioma[vistaVigente.idioma]}</p>
              {v.correo ? (
                <div className="rez-vista">
                  <p>
                    <strong>{t.vistaAsunto}:</strong> {vistaVigente.asunto}
                  </p>
                  <p>{vistaVigente.texto}</p>
                </div>
              ) : null}
              {v.sms ? (
                <div className="rez-vista">
                  <p>
                    <strong>{t.vistaSms}:</strong> {vistaVigente.sms}
                  </p>
                </div>
              ) : null}
              {v.aviso ? (
                <div className="rez-vista">
                  <p>
                    <strong>{t.vistaAviso}:</strong> {vistaVigente.aviso.titulo}
                  </p>
                  <p>{vistaVigente.aviso.cuerpo}</p>
                </div>
              ) : null}
            </div>
          ) : null}
          {error ? (
            <p className="error-general" role="alert">
              {error}
            </p>
          ) : null}
          {motivoNo && !error ? (
            <p className="pista" data-testid="enviar-mensaje-motivo">
              {motivoNo}
            </p>
          ) : null}
          <div className="rez-dialogo-botones">
            <button type="button" className="boton secundario" onClick={alCerrar}>
              {t.cancelar}
            </button>
            <button
              type="button"
              className="boton secundario"
              disabled={ocupado !== ''}
              onClick={() => void ver()}
            >
              {ocupado === 'viendo' ? t.viendo : t.ver}
            </button>
            <button
              type="button"
              className="boton"
              disabled={ocupado !== '' || motivoNo !== ''}
              onClick={() => void enviar()}
            >
              {ocupado === 'enviando' ? t.enviando : t.enviar}
            </button>
          </div>
        </>
      )}
    </Dialogo>
  );
}
