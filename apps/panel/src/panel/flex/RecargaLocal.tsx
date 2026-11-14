/* eslint-disable security/detect-object-injection -- índices sobre los textos fijos de la pantalla */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  almacenNavegador,
  fechaHoraLocal,
  formatearMonto,
  montoATexto,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import { BotonCamara } from '../camara';
import { Campo } from '../CampoClave';
import { MenuTresPuntos } from '../MenuTresPuntos';
import { reducirFoto } from '../SubirFoto';
import { pedir } from '../api';
import { BASE_FLEX, type Contexto, mensajeDe } from './PanelEmpresa';

/**
 * C-FLEX-RECARGA-LOCAL (Flex Fase 7). Venezuela y cualquier país sin Stripe. La empresa declara un
 * pago móvil, una transferencia, un Zelle o un pago en efectivo con su referencia y la foto del
 * comprobante; el equipo de Divoox lo revisa y lo acredita una sola vez. El navegador nunca
 * acredita nada.
 */
export const METODOS_LOCALES = ['pago_movil', 'transferencia', 'zelle', 'efectivo'] as const;

export const TEXTOS_RECARGA_LOCAL = {
  es: {
    titulo: 'Recargar con pago local',
    ayuda:
      'Paga por pago móvil, transferencia, Zelle o en efectivo y declara aquí el pago con su referencia y la foto del comprobante. Nuestro equipo lo revisa y suma el saldo a tu billetera.',
    noActivas: 'Las recargas con pago local todavía no están activas en tu país.',
    dondePagar: 'Dónde pagar',
    metodo: 'Método de pago',
    metodos: {
      pago_movil: 'Pago móvil',
      transferencia: 'Transferencia bancaria',
      zelle: 'Zelle',
      efectivo: 'Efectivo',
    } as Record<string, string>,
    monto: 'Monto pagado',
    referencia: 'Número de referencia',
    banco: 'Banco de origen (opcional)',
    fecha: 'Fecha del pago',
    comprobante: 'Foto del comprobante',
    subir: 'Subir desde archivos',
    fotoLista: 'Foto lista',
    declarar: 'Enviar para revisión',
    enviando: 'Enviando…',
    enviada: 'Recibimos tu recarga. Te avisamos cuando la revisemos.',
    limites: 'El monto va de {min} a {max}.',
    faltaFoto: 'Falta la foto del comprobante.',
    historial: 'Tus recargas con pago local',
    sin: 'Todavía no declaraste ninguna.',
    estados: {
      pendiente: 'En revisión',
      acreditada: 'Acreditada',
      rechazada: 'Rechazada',
    } as Record<string, string>,
    motivo: 'Motivo',
  },
  en: {
    titulo: 'Top up with a local payment',
    ayuda:
      'Pay by mobile payment, bank transfer, Zelle, or cash, then report the payment here with its reference number and a photo of the receipt. Our team reviews it and adds the balance to your wallet.',
    noActivas: 'Local-payment top-ups aren’t available in your country yet.',
    dondePagar: 'Where to pay',
    metodo: 'Payment method',
    metodos: {
      pago_movil: 'Mobile payment',
      transferencia: 'Bank transfer',
      zelle: 'Zelle',
      efectivo: 'Cash',
    } as Record<string, string>,
    monto: 'Amount paid',
    referencia: 'Reference number',
    banco: 'Sending bank (optional)',
    fecha: 'Payment date',
    comprobante: 'Receipt photo',
    subir: 'Upload from files',
    fotoLista: 'Photo ready',
    declarar: 'Send for review',
    enviando: 'Sending…',
    enviada: 'We got your top-up. We’ll let you know once it’s reviewed.',
    limites: 'The amount goes from {min} to {max}.',
    faltaFoto: 'The receipt photo is missing.',
    historial: 'Your local-payment top-ups',
    sin: 'You haven’t reported any yet.',
    estados: {
      pendiente: 'In review',
      acreditada: 'Credited',
      rechazada: 'Declined',
    } as Record<string, string>,
    motivo: 'Reason',
  },
};

type Config = {
  activas: boolean;
  minimo: number;
  maximo: number;
  metodos: string[];
  instrucciones: string;
  moneda: string;
};
type Fila = {
  id: string;
  monto: number;
  moneda: string;
  metodo: string;
  referencia: string;
  estado: string;
  motivo: string;
  creadoEn: string;
};

/** Sube la foto ya reducida (bytes crudos) y devuelve su id. */
export async function subirComprobante(empresaId: string, foto: Blob): Promise<string> {
  const res = await fetch(
    `${BASE_FLEX}/empresas/${empresaId}/billetera/recargas-locales/comprobante`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': foto.type || 'image/webp' },
      body: foto,
    },
  );
  const d = (await res.json().catch(() => ({}))) as { comprobanteId?: string; error?: string };
  if (!res.ok || !d.comprobanteId) throw new Error(d.error ?? `HTTP ${res.status}`);
  return d.comprobanteId;
}

export function RecargaLocal({ ctx }: { ctx: Contexto }) {
  const t = TEXTOS_RECARGA_LOCAL[ctx.idioma === 'en' ? 'en' : 'es'];
  const idioma = ctx.idioma === 'en' ? 'en' : 'es';
  const [cfg, setCfg] = useState<Config | null>(null);
  const [lista, setLista] = useState<Fila[]>([]);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [foto, setFoto] = useState<{ id: string; vista: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [clave, setClave] = useState(() => crypto.randomUUID());
  const entrada = useRef<HTMLInputElement>(null);
  // La foto no va en el borrador (es un archivo); lo escrito sí, para no perderlo.
  const fb = useBorrador({
    formulario: `flex-recarga-local-${ctx.empresa.id}`,
    inicial: { metodo: '', monto: '', referencia: '', banco: '', fecha: '' },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ config: Config; recargas: Fila[] }>(
      'GET',
      `${BASE_FLEX}/empresas/${ctx.empresa.id}/billetera/recargas-locales`,
    )
      .then((r) => {
        setCfg(r.config);
        setLista(r.recargas);
      })
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, [ctx.empresa.id]);
  useEffect(cargar, [cargar]);
  if (!cfg) return <p role={error ? 'alert' : 'status'}>{error || ctx.t.cargando}</p>;
  const m = (x: number) => formatearMonto(x, cfg.moneda, idioma);
  const puede = ctx.permisos.includes('finanzas.gestionar');

  async function recibir(archivo: File) {
    setError('');
    try {
      const reducida = await reducirFoto(archivo);
      const id = await subirComprobante(ctx.empresa.id, reducida);
      setFoto({ id, vista: URL.createObjectURL(reducida) });
    } catch (x) {
      setError(x instanceof Error ? x.message : String(x));
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const monto = textoAMonto(fb.valores.monto, cfg!.moneda);
    if (!Number.isSafeInteger(monto) || monto < cfg!.minimo || monto > cfg!.maximo)
      return setError(t.limites.replace('{min}', m(cfg!.minimo)).replace('{max}', m(cfg!.maximo)));
    if (!foto) return setError(t.faltaFoto);
    setTrabajando(true);
    try {
      await pedir(
        'POST',
        `${BASE_FLEX}/empresas/${ctx.empresa.id}/billetera/recargas-locales`,
        {
          monto,
          metodo: fb.valores.metodo || cfg!.metodos[0],
          referencia: fb.valores.referencia.trim(),
          banco: fb.valores.banco.trim(),
          ...(fb.valores.fecha ? { fechaPago: fb.valores.fecha } : {}),
          comprobanteId: foto.id,
        },
        { cabeceras: { 'idempotency-key': clave } },
      );
      // Solo con la confirmación del servidor se limpia lo escrito.
      await fb.limpiar();
      setFoto(null);
      setClave(crypto.randomUUID());
      setOk(t.enviada);
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <>
      <h2>{t.titulo}</h2>
      {!cfg.activas ? (
        <p className="pista">{t.noActivas}</p>
      ) : (
        <>
          <p className="pista">{t.ayuda}</p>
          {cfg.instrucciones ? (
            <div className="flex-tarjeta">
              <h3>{t.dondePagar}</h3>
              <p style={{ whiteSpace: 'pre-line' }}>{cfg.instrucciones}</p>
            </div>
          ) : null}
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          {ok ? (
            <p className="exito" role="status">
              {ok}
            </p>
          ) : null}
          {puede ? (
            <form className="flex-form" noValidate onSubmit={(e) => void enviar(e)}>
              {fb.recuperado && (
                <p className="aviso-borrador">
                  {ctx.t.recuperado}{' '}
                  <button type="button" className="enlace" onClick={() => void fb.empezarDeNuevo()}>
                    {ctx.t.empezarDeNuevo}
                  </button>
                </p>
              )}
              <div className="campo">
                <label htmlFor="flex-local-metodo">{t.metodo}</label>
                <select
                  id="flex-local-metodo"
                  value={fb.valores.metodo || cfg.metodos[0]}
                  onChange={(e) => fb.cambiar('metodo', e.target.value)}
                >
                  {cfg.metodos.map((x) => (
                    <option key={x} value={x}>
                      {t.metodos[x] ?? x}
                    </option>
                  ))}
                </select>
              </div>
              <Campo
                etiqueta={`${t.monto} (${cfg.moneda})`}
                valor={fb.valores.monto}
                cambiar={(v) => fb.cambiar('monto', v)}
                placeholder={montoATexto(cfg.minimo, cfg.moneda)}
              />
              <Campo
                etiqueta={t.referencia}
                valor={fb.valores.referencia}
                cambiar={(v) => fb.cambiar('referencia', v)}
                placeholder="00000000000"
              />
              <Campo
                etiqueta={t.banco}
                valor={fb.valores.banco}
                cambiar={(v) => fb.cambiar('banco', v)}
              />
              <div className="campo">
                <label htmlFor="flex-local-fecha">{t.fecha}</label>
                <input
                  id="flex-local-fecha"
                  type="date"
                  value={fb.valores.fecha}
                  onChange={(e) => fb.cambiar('fecha', e.target.value)}
                />
              </div>
              <div className="campo">
                <span>{t.comprobante}</span>
                {foto ? (
                  <p className="exito">
                    <img src={foto.vista} alt={t.comprobante} style={{ maxWidth: 160 }} />{' '}
                    {t.fotoLista}
                  </p>
                ) : null}
                <div className="fila-botones">
                  <input
                    ref={entrada}
                    type="file"
                    accept="image/*"
                    hidden
                    aria-label={t.subir}
                    onChange={(e) => {
                      const a = e.target.files?.[0];
                      e.target.value = '';
                      if (a) void recibir(a);
                    }}
                  />
                  <button
                    type="button"
                    className="boton secundario"
                    onClick={() => entrada.current?.click()}
                  >
                    {t.subir}
                  </button>
                  <BotonCamara
                    idioma={ctx.idioma}
                    alTomar={(a) => void recibir(a)}
                    alFallar={setError}
                  />
                </div>
              </div>
              <button type="submit" className="boton" disabled={trabajando}>
                {trabajando ? t.enviando : t.declarar}
              </button>
            </form>
          ) : null}
        </>
      )}
      <h3>{t.historial}</h3>
      {lista.length === 0 ? (
        <p className="pista">{t.sin}</p>
      ) : (
        <ul className="super-lista">
          {lista.map((r) => (
            <li key={r.id}>
              <strong>{m(r.monto)}</strong> · {t.metodos[r.metodo] ?? r.metodo} · {r.referencia} ·{' '}
              <span
                className={`insignia ${r.estado === 'acreditada' ? 'insignia-aprobado' : r.estado === 'rechazada' ? 'insignia-rechazado' : ''}`}
              >
                {t.estados[r.estado] ?? r.estado}
              </span>{' '}
              · {fechaHoraLocal(r.creadoEn, ctx.idioma)}
              {r.motivo ? ` · ${t.motivo}: ${r.motivo}` : ''}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

// ───────────────────────────── El equipo de Divoox (superadmin) ─────────────────────────────

const TA = {
  es: {
    titulo: 'Recargas de empresas con pago local',
    ayuda:
      'Revisa la referencia en el banco y la foto. Acreditar suma el saldo una sola vez; rechazar exige un motivo que ve la empresa.',
    config: 'Encender por país',
    pais: 'País (dos letras)',
    activas: 'Activas en este país',
    minimo: 'Mínimo',
    maximo: 'Máximo',
    instruccionesEs: 'Dónde pagar (español)',
    instruccionesEn: 'Dónde pagar (inglés)',
    cargar: 'Ver',
    guardar: 'Guardar',
    guardado: 'Guardado.',
    pendientes: 'Pendientes de revisar',
    sin: 'No hay recargas pendientes.',
    verFoto: 'Ver comprobante',
    acreditar: 'Acreditar',
    rechazar: 'Rechazar',
    motivoRechazo: 'Motivo del rechazo',
    opciones: 'Más opciones',
    acreditada: 'Acreditada.',
    rechazada: 'Rechazada.',
  },
  en: {
    titulo: 'Company top-ups with a local payment',
    ayuda:
      'Check the reference with the bank and the photo. Crediting adds the balance only once; declining needs a reason the company will see.',
    config: 'Turn on by country',
    pais: 'Country (two letters)',
    activas: 'Active in this country',
    minimo: 'Minimum',
    maximo: 'Maximum',
    instruccionesEs: 'Where to pay (Spanish)',
    instruccionesEn: 'Where to pay (English)',
    cargar: 'View',
    guardar: 'Save',
    guardado: 'Saved.',
    pendientes: 'Waiting for review',
    sin: 'No top-ups waiting.',
    verFoto: 'View receipt',
    acreditar: 'Credit',
    rechazar: 'Decline',
    motivoRechazo: 'Reason for declining',
    opciones: 'More options',
    acreditada: 'Credited.',
    rechazada: 'Declined.',
  },
};

type Pendiente = Fila & { empresa: string; pais: string };

export function RecargasLocalesAdmin({ idioma }: { idioma: 'es' | 'en' }) {
  const t = TA[idioma];
  const [lista, setLista] = useState<Pendiente[] | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const fb = useBorrador({
    formulario: 'super-recargas-locales-config',
    inicial: { pais: 'VE', activas: '', minimo: '', maximo: '', es: '', en: '' },
    almacen: almacenNavegador,
  });
  const moneda = 'USD';
  const cargar = useCallback(() => {
    pedir<{ recargas: Pendiente[] }>(
      'GET',
      `/datos/admin/finanzas/recargas-locales?estado=pendiente`,
    )
      .then((r) => setLista(r.recargas))
      .catch((x: unknown) => setError(mensajeDe(x)));
  }, []);
  useEffect(cargar, [cargar]);

  async function verConfig() {
    setError('');
    try {
      const r = await pedir<{
        config: {
          activas: boolean;
          minimo: number;
          maximo: number;
          instruccionesEs: string;
          instruccionesEn: string;
        };
      }>(
        'GET',
        `/datos/admin/finanzas/recargas-locales/config/${fb.valores.pais.trim().toUpperCase()}`,
      );
      fb.cargarBase({
        pais: fb.valores.pais,
        activas: r.config.activas ? '1' : '',
        minimo: montoATexto(r.config.minimo, moneda),
        maximo: montoATexto(r.config.maximo, moneda),
        es: r.config.instruccionesEs,
        en: r.config.instruccionesEn,
      });
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function guardarConfig(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await pedir(
        'PUT',
        `/datos/admin/finanzas/recargas-locales/config/${fb.valores.pais.trim().toUpperCase()}`,
        {
          activas: fb.valores.activas === '1',
          minimo: textoAMonto(fb.valores.minimo, moneda),
          maximo: textoAMonto(fb.valores.maximo, moneda),
          metodos: [...METODOS_LOCALES],
          instruccionesEs: fb.valores.es,
          instruccionesEn: fb.valores.en,
        },
      );
      await fb.limpiar();
      setOk(t.guardado);
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function acreditar(id: string) {
    setError('');
    setOk('');
    try {
      // C-CONTROL-DUAL: por encima del umbral queda esperando a otra persona (202 con el aviso).
      const r = await pedir<{ pendiente?: boolean; mensaje?: string }>(
        'POST',
        `/datos/admin/finanzas/recargas-locales/${id}/acreditar`,
        {},
      );
      setOk(r.pendiente ? (r.mensaje ?? t.acreditada) : t.acreditada);
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  async function rechazar(id: string) {
    setError('');
    setOk('');
    try {
      await pedir('POST', `/datos/admin/finanzas/recargas-locales/${id}/rechazar`, { motivo });
      setRechazando(null);
      setMotivo('');
      setOk(t.rechazada);
      cargar();
    } catch (x) {
      setError(mensajeDe(x));
    }
  }
  return (
    <section>
      <h2>{t.titulo}</h2>
      <p className="pista">{t.ayuda}</p>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="exito" role="status">
          {ok}
        </p>
      ) : null}
      <h3>{t.pendientes}</h3>
      {lista === null ? null : lista.length === 0 ? (
        <p className="pista">{t.sin}</p>
      ) : (
        <ul className="super-lista">
          {lista.map((r) => (
            <li key={r.id}>
              <strong>{r.empresa}</strong> · {r.pais} · {formatearMonto(r.monto, r.moneda, idioma)}{' '}
              · {TEXTOS_RECARGA_LOCAL[idioma].metodos[r.metodo] ?? r.metodo} · {r.referencia} ·{' '}
              {fechaHoraLocal(r.creadoEn, idioma)} ·{' '}
              <a
                href={`/datos/admin/finanzas/recargas-locales/${r.id}/comprobante`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t.verFoto}
              </a>{' '}
              <button type="button" className="boton" onClick={() => void acreditar(r.id)}>
                {t.acreditar}
              </button>
              <MenuTresPuntos
                etiqueta={t.opciones}
                opciones={[
                  { texto: t.rechazar, peligro: true, alTocar: () => setRechazando(r.id) },
                ]}
              />
              {rechazando === r.id ? (
                <form
                  className="flex-form flex-inline"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void rechazar(r.id);
                  }}
                >
                  <Campo etiqueta={t.motivoRechazo} valor={motivo} cambiar={setMotivo} />
                  <button type="submit" className="boton peligro">
                    {t.rechazar}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <h3>{t.config}</h3>
      <form className="flex-form" noValidate onSubmit={(e) => void guardarConfig(e)}>
        <Campo etiqueta={t.pais} valor={fb.valores.pais} cambiar={(v) => fb.cambiar('pais', v)} />
        <button type="button" className="boton secundario" onClick={() => void verConfig()}>
          {t.cargar}
        </button>
        <label>
          <input
            type="checkbox"
            checked={fb.valores.activas === '1'}
            onChange={(e) => fb.cambiar('activas', e.target.checked ? '1' : '')}
          />{' '}
          {t.activas}
        </label>
        <Campo
          etiqueta={`${t.minimo} (USD)`}
          valor={fb.valores.minimo}
          cambiar={(v) => fb.cambiar('minimo', v)}
        />
        <Campo
          etiqueta={`${t.maximo} (USD)`}
          valor={fb.valores.maximo}
          cambiar={(v) => fb.cambiar('maximo', v)}
        />
        <div className="campo">
          <label htmlFor="super-local-es">{t.instruccionesEs}</label>
          <textarea
            id="super-local-es"
            value={fb.valores.es}
            onChange={(e) => fb.cambiar('es', e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="super-local-en">{t.instruccionesEn}</label>
          <textarea
            id="super-local-en"
            value={fb.valores.en}
            onChange={(e) => fb.cambiar('en', e.target.value)}
          />
        </div>
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
    </section>
  );
}
