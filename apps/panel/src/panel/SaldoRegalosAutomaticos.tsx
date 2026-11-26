import { useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  formatearMonto,
  useBorrador,
} from '@tumbite/compartido';
import { AvisoBorrador } from './AvisoBorrador';
import { AyudaAqui } from './AyudaAqui';
import { Insignia } from './diseno/Insignia';
import { pedir } from './api';

/**
 * C-SALDO-BIENVENIDA y C-SALDO-FIDELIDAD (26 nov 2026, todos los países; Venezuela primero). El bloque
 * «Regalos automáticos de Saldo Divoox» de Configuración (regla del menú: lo que se toca cada mes va
 * dentro de Configuración, nunca en el menú del día). Por ciudad:
 * - Bienvenida: «<Ciudad>: X de Saldo Divoox a cada cliente nuevo» al confirmar su celular.
 * - Por viajes (fidelidad): «cada N viajes reales, M».
 * Las dos nacen APAGADAS, con presupuesto (gastado / disponible a la vista) y sus topes. Lo escrito no
 * se pierde (borrador). Se explica en la ayuda interna «?».
 */
const T = {
  es: {
    titulo: 'Regalos automáticos de Saldo Divoox',
    ayuda:
      'Saldo Divoox que llega solo, por ciudad, sin cargarlo a mano. Todo nace apagado y sale del presupuesto de cada regla.',
    sinReglas: 'Todavía no hay reglas. Crea la primera abajo.',
    tipos: { bienvenida: 'Bienvenida', fidelidad: 'Por viajes' } as Record<string, string>,
    fraseBienvenida: (c: string, m: string) => `${c}: ${m} de Saldo Divoox a cada cliente nuevo`,
    fraseFidelidad: (c: string, n: number, m: string) =>
      `${c}: ${m} de Saldo Divoox cada ${n} viajes`,
    encendida: 'Encendida',
    apagada: 'Apagada',
    gastado: (g: string, p: string) => `Gastado ${g} de ${p}`,
    gastadoMes: (g: string, p: string) => `Gastado este mes ${g} de ${p}`,
    disponible: (d: string) => `Disponible ${d}`,
    detalle: (n: number, u: string, v: string, d: number) =>
      `${n} ${n === 1 ? 'cliente' : 'clientes'} · ${u} usado en viajes · ${v} vencido · vence a los ${d} días`,
    cambiar: 'Cambiar',
    nueva: 'Crear o cambiar una regla',
    tipo: 'Tipo',
    ciudad: 'Ciudad',
    elegir: 'Elige la ciudad',
    monto: 'Regalo por cliente (dólares)',
    vigencia: 'Vence a los (días)',
    presupuesto: 'Presupuesto total (dólares)',
    presupuestoMes: 'Presupuesto del mes (dólares)',
    topeDiario: 'Tope de 24 horas (dólares)',
    cadaViajes: 'Cada cuántos viajes',
    topePersona: 'Regalos por persona al mes',
    encender: 'Encendida (se aplica desde ya)',
    guardar: 'Guardar la regla',
    guardado: 'Regla guardada.',
    vistaPrevia: (f: string) => `Así se verá: «${f}».`,
    faltaCiudad: 'Elige la ciudad.',
    cargando: 'Cargando…',
  },
  en: {
    titulo: 'Automatic Divoox Balance gifts',
    ayuda:
      'Divoox Balance that arrives on its own, by city, without adding it by hand. Everything starts off and comes out of each rule’s budget.',
    sinReglas: 'No rules yet. Create the first one below.',
    tipos: { bienvenida: 'Welcome', fidelidad: 'For rides' } as Record<string, string>,
    fraseBienvenida: (c: string, m: string) => `${c}: ${m} of Divoox Balance to every new customer`,
    fraseFidelidad: (c: string, n: number, m: string) =>
      `${c}: ${m} of Divoox Balance every ${n} rides`,
    encendida: 'On',
    apagada: 'Off',
    gastado: (g: string, p: string) => `Spent ${g} of ${p}`,
    gastadoMes: (g: string, p: string) => `Spent this month ${g} of ${p}`,
    disponible: (d: string) => `Available ${d}`,
    detalle: (n: number, u: string, v: string, d: number) =>
      `${n} ${n === 1 ? 'customer' : 'customers'} · ${u} used on rides · ${v} expired · expires after ${d} days`,
    cambiar: 'Change',
    nueva: 'Create or change a rule',
    tipo: 'Type',
    ciudad: 'City',
    elegir: 'Choose the city',
    monto: 'Gift per customer (dollars)',
    vigencia: 'Expires after (days)',
    presupuesto: 'Total budget (dollars)',
    presupuestoMes: 'Monthly budget (dollars)',
    topeDiario: '24-hour limit (dollars)',
    cadaViajes: 'Every how many rides',
    topePersona: 'Gifts per person each month',
    encender: 'On (applies right away)',
    guardar: 'Save the rule',
    guardado: 'Rule saved.',
    vistaPrevia: (f: string) => `It will read: “${f}.”`,
    faltaCiudad: 'Choose the city.',
    cargando: 'Loading…',
  },
};

type Regla = {
  id: string;
  tipo: 'bienvenida' | 'fidelidad';
  zonaId: string;
  ciudad: string;
  monto: number;
  vigenciaDias: number;
  encendida: boolean;
  presupuesto: number;
  topeDiario: number | null;
  cadaViajes: number | null;
  topePersonaMes: number | null;
  gastado: number;
  disponible: number;
  usadoEnViajes: number;
  vencido: number;
  personas: number;
};
type Zona = { id: string; nombre: string; pais: string };

const aCentavos = (s: string) => Math.round(Number(String(s).replace(',', '.') || 0) * 100);
const aDolares = (c: number | null | undefined) => (c == null ? '' : String(c / 100));

export function SaldoRegalosAutomaticos({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const dinero = (c: number) => formatearMonto(c, 'USD', idioma);
  const [datos, setDatos] = useState<{ reglas: Regla[]; zonas: Zona[] } | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [editar, setEditar] = useState<Regla | null>(null);
  useEffect(() => {
    let vivo = true;
    pedir<{ reglas: Regla[]; zonas: Zona[] }>('GET', '/datos/admin/saldo-regalos/reglas')
      .then((d) => vivo && setDatos(d))
      .catch((x: unknown) => vivo && setError(x instanceof ErrorApi ? x.message : String(x)));
    return () => {
      vivo = false;
    };
  }, [vuelta]);
  const frase = (r: Pick<Regla, 'tipo' | 'ciudad' | 'monto' | 'cadaViajes'>) =>
    r.tipo === 'bienvenida'
      ? t.fraseBienvenida(r.ciudad, dinero(r.monto))
      : t.fraseFidelidad(r.ciudad, r.cadaViajes ?? 0, dinero(r.monto));
  return (
    <section
      className="tarjeta-form"
      aria-labelledby="saldo-regalos-titulo"
      data-testid="saldo-regalos-auto"
    >
      <h2 id="saldo-regalos-titulo">
        {t.titulo}
        <AyudaAqui guia="customer-balance-auto-gifts" idioma={idioma} />
      </h2>
      <p className="ficha-nota">{t.ayuda}</p>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="texto-exito" role="status">
          {ok}
        </p>
      ) : null}
      {!datos ? (
        <p className="pista">{t.cargando}</p>
      ) : (
        <>
          {datos.reglas.length === 0 ? <p className="pista">{t.sinReglas}</p> : null}
          <ul className="lista-simple" data-testid="saldo-regalos-reglas">
            {datos.reglas.map((r) => {
              const pct = r.presupuesto
                ? Math.min(100, Math.round((r.gastado / r.presupuesto) * 100))
                : 0;
              return (
                <li key={r.id} className="flex-tarjeta" data-testid={`regla-${r.tipo}-${r.zonaId}`}>
                  <p>
                    <Insignia tono={r.encendida ? 'hecho' : 'apagado'}>
                      {r.encendida ? t.encendida : t.apagada}
                    </Insignia>{' '}
                    <small className="pista">{t.tipos[r.tipo]}</small>
                  </p>
                  <p>
                    <strong>{frase(r)}</strong>
                  </p>
                  <div
                    className="barra-activacion-progreso"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={r.presupuesto}
                    aria-valuenow={r.gastado}
                    aria-label={t.gastado(dinero(r.gastado), dinero(r.presupuesto))}
                  >
                    <span style={{ width: `${pct}%` }} />
                  </div>
                  <p className="pista">
                    {(r.tipo === 'fidelidad' ? t.gastadoMes : t.gastado)(
                      dinero(r.gastado),
                      dinero(r.presupuesto),
                    )}{' '}
                    · {t.disponible(dinero(r.disponible))}
                  </p>
                  <p className="pista">
                    {t.detalle(
                      r.personas,
                      dinero(r.usadoEnViajes),
                      dinero(r.vencido),
                      r.vigenciaDias,
                    )}
                  </p>
                  <button
                    type="button"
                    className="boton secundario"
                    onClick={() => {
                      setOk('');
                      setEditar(r);
                    }}
                  >
                    {t.cambiar}
                  </button>
                </li>
              );
            })}
          </ul>
          <FormRegla
            key={editar?.id ?? 'nueva'}
            base={editar}
            zonas={datos.zonas}
            t={t}
            idioma={idioma}
            frase={frase}
            alGuardar={() => {
              setOk(t.guardado);
              setEditar(null);
              setVuelta((n) => n + 1);
            }}
          />
        </>
      )}
    </section>
  );
}

function FormRegla({
  base,
  zonas,
  t,
  idioma,
  frase,
  alGuardar,
}: {
  base: Regla | null;
  zonas: Zona[];
  t: (typeof T)['es'];
  idioma: Idioma;
  frase: (r: Pick<Regla, 'tipo' | 'ciudad' | 'monto' | 'cadaViajes'>) => string;
  alGuardar: () => void;
}) {
  const b = useBorrador({
    formulario: `saldo-regla-${base?.id ?? 'nueva'}`,
    cuenta: 'superadmin',
    inicial: {
      tipo: (base?.tipo ?? 'bienvenida') as string,
      zonaId: base?.zonaId ?? '',
      monto: aDolares(base?.monto),
      vigencia: String(base?.vigenciaDias ?? 30),
      presupuesto: aDolares(base?.presupuesto),
      topeDiario: aDolares(base?.topeDiario),
      cadaViajes: base?.cadaViajes == null ? '' : String(base.cadaViajes),
      topePersona: base?.topePersonaMes == null ? '1' : String(base.topePersonaMes),
      encendida: base?.encendida ? '1' : '0',
    },
    almacen: almacenNavegador,
  });
  const v = b.valores;
  const [error, setError] = useState('');
  const tipo = v.tipo === 'fidelidad' ? 'fidelidad' : 'bienvenida';
  const ciudad = zonas.find((z) => z.id === v.zonaId)?.nombre ?? base?.ciudad ?? '—';
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!v.zonaId) return setError(t.faltaCiudad);
    try {
      await pedir('PUT', '/datos/admin/saldo-regalos/reglas', {
        tipo,
        zonaId: v.zonaId,
        monto: aCentavos(v.monto),
        vigenciaDias: Math.floor(Number(v.vigencia) || 30),
        encendida: v.encendida === '1',
        presupuesto: aCentavos(v.presupuesto),
        ...(tipo === 'bienvenida'
          ? { topeDiario: aCentavos(v.topeDiario) || null }
          : {
              cadaViajes: Math.floor(Number(v.cadaViajes) || 0) || null,
              topePersonaMes: Math.floor(Number(v.topePersona) || 0) || null,
            }),
      });
      await b.limpiar();
      alGuardar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }
  return (
    <div className="flex-tarjeta" data-testid="saldo-regla-form">
      <h3>{t.nueva}</h3>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form className="formulario" noValidate onSubmit={(e) => void guardar(e)}>
        <div className="fila-campos">
          <label className="campo">
            {t.tipo}
            <select value={tipo} onChange={(e) => b.cambiar('tipo', e.target.value)}>
              <option value="bienvenida">{t.tipos.bienvenida}</option>
              <option value="fidelidad">{t.tipos.fidelidad}</option>
            </select>
          </label>
          <label className="campo">
            {t.ciudad}
            <select
              value={v.zonaId}
              onChange={(e) => b.cambiar('zonaId', e.target.value)}
              data-testid="regla-ciudad"
            >
              <option value="">{t.elegir}</option>
              {zonas.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="fila-campos">
          <label className="campo">
            {t.monto}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={v.monto}
              onChange={(e) => b.cambiar('monto', e.target.value)}
              data-testid="regla-monto"
            />
          </label>
          <label className="campo">
            {t.vigencia}
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max="365"
              step="1"
              value={v.vigencia}
              onChange={(e) => b.cambiar('vigencia', e.target.value)}
            />
          </label>
        </div>
        <div className="fila-campos">
          <label className="campo">
            {tipo === 'fidelidad' ? t.presupuestoMes : t.presupuesto}
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={v.presupuesto}
              onChange={(e) => b.cambiar('presupuesto', e.target.value)}
              data-testid="regla-presupuesto"
            />
          </label>
          {tipo === 'bienvenida' ? (
            <label className="campo">
              {t.topeDiario}
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="1"
                value={v.topeDiario}
                onChange={(e) => b.cambiar('topeDiario', e.target.value)}
                data-testid="regla-tope-diario"
              />
            </label>
          ) : (
            <>
              <label className="campo">
                {t.cadaViajes}
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={v.cadaViajes}
                  onChange={(e) => b.cambiar('cadaViajes', e.target.value)}
                />
              </label>
              <label className="campo">
                {t.topePersona}
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  step="1"
                  value={v.topePersona}
                  onChange={(e) => b.cambiar('topePersona', e.target.value)}
                />
              </label>
            </>
          )}
        </div>
        <label className="campo-casilla">
          <input
            type="checkbox"
            checked={v.encendida === '1'}
            onChange={(e) => b.cambiar('encendida', e.target.checked ? '1' : '0')}
            data-testid="regla-encendida"
          />{' '}
          {t.encender}
        </label>
        {aCentavos(v.monto) > 0 ? (
          <p className="pista">
            {t.vistaPrevia(
              frase({
                tipo,
                ciudad,
                monto: aCentavos(v.monto),
                cadaViajes: Math.floor(Number(v.cadaViajes) || 0),
              }),
            )}
          </p>
        ) : null}
        <button type="submit" className="boton" data-testid="regla-guardar">
          {t.guardar}
        </button>
      </form>
      {error ? (
        <p className="error-general" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
