/* eslint-disable security/detect-object-injection -- índices sobre los textos fijos de la pantalla */
import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  almacenNavegador,
  formatearMonto,
  montoATexto,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import { Enlace } from '../Enlace';
import { Campo, CampoClave } from './CampoClave';
import { pedir } from './api';

/**
 * Divoox · Fase 4: SUPERADMIN financiero de Flex (C-FIN-SUPERADMIN). Políticas de comisión
 * (crear, cerrar hacia adelante, revisión legal), límites de recarga por país, billeteras de las
 * empresas con sus movimientos, ajustes manuales y reembolsos (con la contraseña del administrador
 * y un motivo), conciliación y el simulador del servicio logístico. Nada de esto es retroactivo.
 */

const T = {
  es: {
    titulo: 'Flex · Dinero',
    politicas: 'Políticas de comisión',
    politicasAyuda:
      'Ninguna tarifa vive en el código. Una política no se edita: se cierra y se crea otra; lo ya cobrado no cambia.',
    nueva: 'Nueva política',
    nombre: 'Nombre',
    servicio: 'Servicio',
    tipoCuenta: 'Quién paga',
    tiposCuenta: { empresa: 'Empresa', conductor: 'Conductor' } as Record<string, string>,
    pais: 'País (dos letras o *)',
    ciudad: 'Ciudad (opcional)',
    empresaId: 'Empresa (opcional, id)',
    modalidad: 'Modalidad',
    modalidades: {
      prepago: 'Saldo prepago',
      connect: 'Stripe Connect',
      sin_cobro: 'Sin cobro',
    } as Record<string, string>,
    moneda: 'Moneda',
    regla: 'Regla',
    reglas: {
      por_paquete: 'Monto por paquete entregado',
      por_ruta: 'Monto por ruta',
      porcentaje: 'Porcentaje de la operación',
      exenta: 'Exenta (sin comisión)',
    } as Record<string, string>,
    monto: 'Monto',
    porcentajeCampo: 'Porcentaje',
    descuento: 'Descuento de promoción (%)',
    desde: 'Rige desde (vacío = ahora)',
    hasta: 'Rige hasta (opcional)',
    prioridad: 'Prioridad',
    motivo: 'Motivo',
    revisionLegal: 'Revisión legal y comercial aprobada',
    revisionNota: 'Referencia de la revisión',
    crear: 'Crear política',
    activa: 'Activa',
    cerrada: 'Cerrada',
    inactiva: 'Apagada',
    sinPoliticas:
      'Todavía no hay políticas: Divoox no cobra comisiones en ningún servicio por este camino.',
    masOpciones: 'Más opciones',
    cerrar: 'Cerrar desde ahora',
    motivoCerrar: 'Motivo del cierre',
    aprobarLegal: 'Marcar la revisión legal como aprobada',
    notaLegal: 'Referencia de la revisión legal y comercial',
    legalPendiente: 'Revisión legal pendiente: no rige para conductores',
    recargas: 'Límites de recarga por país',
    paisLimites: 'País',
    cargar: 'Cargar',
    activas: 'Recargas activas',
    minimo: 'Mínimo',
    maximo: 'Máximo',
    sugeridos: 'Importes sugeridos (separados por comas)',
    automatica: 'Permitir la recarga automática',
    guardar: 'Guardar',
    guardado: 'Guardado.',
    empresas: 'Billeteras de las empresas',
    disponible: 'Disponible',
    reservado: 'Reservado',
    deuda: 'Pendiente',
    ver: 'Ver',
    volver: '← Flex · Dinero',
    movimientos: 'Movimientos',
    recargasEmpresa: 'Recargas',
    auditoria: 'Auditoría',
    ajuste: 'Ajuste manual',
    ajusteAyuda:
      'Suma o resta del disponible (negativo para restar). Pide tu contraseña y un motivo; queda en la auditoría.',
    clave: 'Tu contraseña',
    aplicar: 'Aplicar ajuste',
    reembolsar: 'Reembolsar',
    reembolsoMonto: 'Monto a reembolsar',
    conciliacion: 'Conciliación',
    correrAhora: 'Conciliar ahora',
    sinConciliacion: 'Todavía no corrió.',
    cuadra: 'Todo cuadra',
    noCuadra: 'Encontró diferencias',
    simulador: 'Simulador del servicio logístico',
    simuladorAyuda:
      'Separa la comisión tecnológica, el transporte, el conductor, el procesador de pagos y los impuestos. No cobra nada.',
    paquetes: 'Paquetes',
    tecnologia: 'Tecnología por paquete',
    transporte: 'Transporte por paquete',
    conductorPct: 'Parte del conductor (%)',
    procesadorPct: 'Procesador (%)',
    procesadorFijo: 'Procesador fijo',
    impuestoPct: 'Impuesto (%)',
    simular: 'Simular',
    resultado: {
      tecnologiaDivoox: 'Comisión tecnológica',
      transporte: 'Transporte',
      remuneracionConductor: 'Al conductor',
      margenTransporteDivoox: 'Margen de transporte',
      procesadorPagos: 'Procesador de pagos (lo absorbe Divoox)',
      impuestos: 'Impuestos',
      totalEmpresa: 'Total que paga la empresa',
    } as Record<string, string>,
  },
  en: {
    titulo: 'Flex · Money',
    politicas: 'Commission policies',
    politicasAyuda:
      'No rate lives in code. A policy isn’t edited: it’s closed and a new one is created; what was already charged never changes.',
    nueva: 'New policy',
    nombre: 'Name',
    servicio: 'Service',
    tipoCuenta: 'Who pays',
    tiposCuenta: { empresa: 'Company', conductor: 'Driver' } as Record<string, string>,
    pais: 'Country (two letters or *)',
    ciudad: 'City (optional)',
    empresaId: 'Company (optional, id)',
    modalidad: 'Mode',
    modalidades: {
      prepago: 'Prepaid balance',
      connect: 'Stripe Connect',
      sin_cobro: 'No charge',
    } as Record<string, string>,
    moneda: 'Currency',
    regla: 'Rule',
    reglas: {
      por_paquete: 'Amount per delivered package',
      por_ruta: 'Amount per route',
      porcentaje: 'Percentage of the operation',
      exenta: 'Exempt (no commission)',
    } as Record<string, string>,
    monto: 'Amount',
    porcentajeCampo: 'Percentage',
    descuento: 'Promotional discount (%)',
    desde: 'Starts (empty = now)',
    hasta: 'Ends (optional)',
    prioridad: 'Priority',
    motivo: 'Reason',
    revisionLegal: 'Legal and business review approved',
    revisionNota: 'Review reference',
    crear: 'Create policy',
    activa: 'Active',
    cerrada: 'Closed',
    inactiva: 'Off',
    sinPoliticas: 'No policies yet: Divoox doesn’t charge commissions in any service this way.',
    masOpciones: 'More options',
    cerrar: 'Close from now',
    motivoCerrar: 'Reason for closing',
    aprobarLegal: 'Mark the legal review as approved',
    notaLegal: 'Legal and business review reference',
    legalPendiente: 'Legal review pending: doesn’t apply to drivers',
    recargas: 'Top-up limits by country',
    paisLimites: 'Country',
    cargar: 'Load',
    activas: 'Top-ups on',
    minimo: 'Minimum',
    maximo: 'Maximum',
    sugeridos: 'Suggested amounts (comma separated)',
    automatica: 'Allow automatic top-up',
    guardar: 'Save',
    guardado: 'Saved.',
    empresas: 'Company wallets',
    disponible: 'Available',
    reservado: 'Reserved',
    deuda: 'Outstanding',
    ver: 'View',
    volver: '← Flex · Money',
    movimientos: 'Activity',
    recargasEmpresa: 'Top-ups',
    auditoria: 'Audit log',
    ajuste: 'Manual adjustment',
    ajusteAyuda:
      'Adds to or subtracts from the available balance (negative to subtract). Requires your password and a reason; it goes to the audit log.',
    clave: 'Your password',
    aplicar: 'Apply adjustment',
    reembolsar: 'Refund',
    reembolsoMonto: 'Amount to refund',
    conciliacion: 'Reconciliation',
    correrAhora: 'Reconcile now',
    sinConciliacion: 'It hasn’t run yet.',
    cuadra: 'Everything matches',
    noCuadra: 'Found differences',
    simulador: 'Logistics service simulator',
    simuladorAyuda:
      'Separates the technology fee, transport, driver, payment processor and taxes. Charges nothing.',
    paquetes: 'Packages',
    tecnologia: 'Technology per package',
    transporte: 'Transport per package',
    conductorPct: 'Driver share (%)',
    procesadorPct: 'Processor (%)',
    procesadorFijo: 'Processor fixed',
    impuestoPct: 'Tax (%)',
    simular: 'Simulate',
    resultado: {
      tecnologiaDivoox: 'Technology fee',
      transporte: 'Transport',
      remuneracionConductor: 'To the driver',
      margenTransporteDivoox: 'Transport margin',
      procesadorPagos: 'Payment processor (absorbed by Divoox)',
      impuestos: 'Taxes',
      totalEmpresa: 'Total the company pays',
    } as Record<string, string>,
  },
};
type TT = (typeof T)['es'];
const SERVICIOS = ['flex', 'express', 'food', 'ride', 'car', 'grocery'];
const mensaje = (x: unknown) => (x instanceof ErrorApi ? x.message : String(x));

function Aviso({ error }: { error: string }) {
  return error ? (
    <p className="error-general" role="alert">
      {error}
    </p>
  ) : null;
}
function Recuperado({
  b,
  idioma,
}: {
  b: { recuperado: boolean; empezarDeNuevo: () => Promise<void> };
  idioma: 'es' | 'en';
}) {
  return b.recuperado ? (
    <p className="aviso-borrador">
      {idioma === 'en'
        ? 'We recovered what you were typing.'
        : 'Recuperamos lo que estabas escribiendo.'}{' '}
      <button type="button" className="enlace" onClick={() => void b.empezarDeNuevo()}>
        {idioma === 'en' ? 'Start over' : 'Empezar de nuevo'}
      </button>
    </p>
  ) : null;
}

type Politica = {
  id: string;
  nombre: string;
  servicio: string;
  tipoCuenta: string;
  pais: string;
  ciudad: string | null;
  empresaId: string | null;
  modalidad: string;
  moneda: string;
  regla: { tipo: string; monto?: number; pb?: number };
  descuentoPb: number;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activa: boolean;
  revisionLegalAprobada: boolean;
  motivo: string;
};

export function SuperFinanzas({
  base,
  idioma,
  empresaId,
}: {
  base: string;
  idioma: 'es' | 'en';
  empresaId: string | null;
}) {
  const t = T[idioma];
  if (empresaId) return <EmpresaFinanzas base={base} idioma={idioma} id={empresaId} />;
  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <Politicas t={t} idioma={idioma} />
      <LimitesRecarga t={t} idioma={idioma} />
      <Empresas t={t} idioma={idioma} base={base} />
      <Conciliacion t={t} />
      <Simulador t={t} idioma={idioma} />
    </section>
  );
}

function reglaTexto(t: TT, p: Politica, idioma: 'es' | 'en') {
  const r = p.regla;
  if ((r.tipo === 'por_paquete' || r.tipo === 'por_ruta') && r.monto !== undefined)
    return `${t.reglas[r.tipo]}: ${formatearMonto(r.monto, p.moneda, idioma)}`;
  if (r.tipo === 'porcentaje' && r.pb !== undefined)
    return `${t.reglas.porcentaje}: ${r.pb / 100} %`;
  return t.reglas[r.tipo] ?? r.tipo;
}

function Politicas({ t, idioma }: { t: TT; idioma: 'es' | 'en' }) {
  const [lista, setLista] = useState<Politica[] | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [menu, setMenu] = useState('');
  const b = useBorrador({
    formulario: 'super-fin-politica',
    inicial: {
      nombre: '',
      servicio: 'flex',
      tipoCuenta: 'empresa',
      pais: 'US',
      ciudad: '',
      empresaId: '',
      modalidad: 'prepago',
      moneda: 'USD',
      regla: 'por_paquete',
      valor: '',
      descuento: '',
      desde: '',
      hasta: '',
      prioridad: '0',
      motivo: '',
      legal: '',
      nota: '',
    },
    almacen: almacenNavegador,
  });
  const cargar = useCallback(() => {
    pedir<{ politicas: Politica[] }>('GET', '/datos/admin/finanzas/politicas')
      .then((r) => setLista(r.politicas))
      .catch((x: unknown) => setError(mensaje(x)));
  }, []);
  useEffect(cargar, [cargar]);
  const v = b.valores;
  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const regla =
      v.regla === 'exenta'
        ? { tipo: 'exenta' }
        : v.regla === 'porcentaje'
          ? { tipo: 'porcentaje', pb: Math.round(Number(v.valor.replace(',', '.')) * 100) }
          : { tipo: v.regla, monto: textoAMonto(v.valor, v.moneda) };
    try {
      await pedir('POST', '/datos/admin/finanzas/politicas', {
        nombre: v.nombre,
        servicio: v.servicio,
        tipoCuenta: v.tipoCuenta,
        pais: v.pais.trim().toUpperCase(),
        ciudad: v.ciudad.trim() || null,
        empresaId: v.empresaId.trim() || null,
        modalidad: v.modalidad,
        moneda: v.moneda.trim().toUpperCase(),
        regla,
        descuentoPb: v.descuento ? Math.round(Number(v.descuento.replace(',', '.')) * 100) : 0,
        ...(v.desde ? { vigenteDesde: v.desde } : {}),
        vigenteHasta: v.hasta || null,
        prioridad: Number(v.prioridad) || 0,
        motivo: v.motivo,
        revisionLegalAprobada: v.legal === '1',
        revisionLegalNota: v.nota,
      });
      await b.limpiar();
      setOk(t.guardado);
      cargar();
    } catch (x) {
      setError(mensaje(x));
    }
  }
  async function accion(
    id: string,
    ruta: string,
    cuerpoPregunta: string,
    extra: Record<string, unknown> = {},
  ) {
    setMenu('');
    const texto = window.prompt(cuerpoPregunta);
    if (!texto) return;
    try {
      await pedir('POST', `/datos/admin/finanzas/politicas/${id}/${ruta}`, {
        ...extra,
        motivo: texto,
        nota: texto,
      });
      cargar();
    } catch (x) {
      setError(mensaje(x));
    }
  }
  return (
    <>
      <h2>{t.politicas}</h2>
      <p className="pista">{t.politicasAyuda}</p>
      <Aviso error={error} />
      {lista === null ? null : lista.length === 0 ? (
        <p>{t.sinPoliticas}</p>
      ) : (
        <ul className="flex-lista-tarjetas">
          {lista.map((p) => {
            const cerrada = p.vigenteHasta !== null || !p.activa;
            return (
              <li key={p.id} className="flex-tarjeta">
                <p>
                  <strong>{p.nombre}</strong>{' '}
                  <span className={`insignia ${!cerrada ? 'insignia-aprobado' : ''}`}>
                    {!p.activa ? t.inactiva : p.vigenteHasta ? t.cerrada : t.activa}
                  </span>
                </p>
                <p className="pista">
                  {p.servicio} · {t.tiposCuenta[p.tipoCuenta]} · {p.pais}
                  {p.ciudad ? ` · ${p.ciudad}` : ''}
                  {p.empresaId ? ` · ${p.empresaId.slice(0, 8)}` : ''} ·{' '}
                  {t.modalidades[p.modalidad]} · {p.moneda}
                </p>
                <p>
                  {reglaTexto(t, p, idioma)}
                  {p.descuentoPb ? ` · −${p.descuentoPb / 100} %` : ''}
                </p>
                <p className="pista">
                  {p.vigenteDesde} → {p.vigenteHasta ?? '…'} · {p.motivo}
                </p>
                {p.tipoCuenta === 'conductor' &&
                p.modalidad === 'prepago' &&
                !p.revisionLegalAprobada ? (
                  <p className="flex-alerta">{t.legalPendiente}</p>
                ) : null}
                {!cerrada ? (
                  <div className="menu-tres-puntos">
                    <button
                      type="button"
                      className="boton secundario"
                      aria-label={t.masOpciones}
                      aria-expanded={menu === p.id}
                      onClick={() => setMenu(menu === p.id ? '' : p.id)}
                    >
                      ⋮
                    </button>
                    {menu === p.id ? (
                      <div role="menu" className="cuenta-menu">
                        {p.tipoCuenta === 'conductor' && !p.revisionLegalAprobada ? (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() =>
                              void accion(p.id, 'revision-legal', t.notaLegal, { aprobada: true })
                            }
                          >
                            {t.aprobarLegal}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          role="menuitem"
                          className="peligro"
                          onClick={() => void accion(p.id, 'cerrar', t.motivoCerrar)}
                        >
                          {t.cerrar}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      <h3>{t.nueva}</h3>
      <Recuperado b={b} idioma={idioma} />
      <form className="flex-form" noValidate onSubmit={(e) => void crear(e)}>
        <Campo etiqueta={t.nombre} valor={v.nombre} cambiar={(x) => b.cambiar('nombre', x)} />
        <div className="flex-inline">
          <div className="campo">
            <label htmlFor="fin-servicio">{t.servicio}</label>
            <select
              id="fin-servicio"
              value={v.servicio}
              onChange={(e) => b.cambiar('servicio', e.target.value)}
            >
              {SERVICIOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="fin-cuenta">{t.tipoCuenta}</label>
            <select
              id="fin-cuenta"
              value={v.tipoCuenta}
              onChange={(e) => b.cambiar('tipoCuenta', e.target.value)}
            >
              {Object.entries(t.tiposCuenta).map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="fin-modalidad">{t.modalidad}</label>
            <select
              id="fin-modalidad"
              value={v.modalidad}
              onChange={(e) => b.cambiar('modalidad', e.target.value)}
            >
              {Object.entries(t.modalidades).map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex-inline">
          <Campo etiqueta={t.pais} valor={v.pais} cambiar={(x) => b.cambiar('pais', x)} />
          <Campo etiqueta={t.ciudad} valor={v.ciudad} cambiar={(x) => b.cambiar('ciudad', x)} />
          <Campo etiqueta={t.moneda} valor={v.moneda} cambiar={(x) => b.cambiar('moneda', x)} />
        </div>
        <Campo
          etiqueta={t.empresaId}
          valor={v.empresaId}
          cambiar={(x) => b.cambiar('empresaId', x)}
        />
        <div className="flex-inline">
          <div className="campo">
            <label htmlFor="fin-regla">{t.regla}</label>
            <select
              id="fin-regla"
              value={v.regla}
              onChange={(e) => b.cambiar('regla', e.target.value)}
            >
              {Object.entries(t.reglas).map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          {v.regla !== 'exenta' ? (
            <Campo
              etiqueta={v.regla === 'porcentaje' ? t.porcentajeCampo : t.monto}
              valor={v.valor}
              cambiar={(x) => b.cambiar('valor', x)}
              placeholder={v.regla === 'porcentaje' ? '10' : '0.25'}
            />
          ) : null}
          <Campo
            etiqueta={t.descuento}
            valor={v.descuento}
            cambiar={(x) => b.cambiar('descuento', x)}
            placeholder="0"
          />
        </div>
        <div className="flex-inline">
          <Campo
            etiqueta={t.desde}
            tipo="datetime-local"
            valor={v.desde}
            cambiar={(x) => b.cambiar('desde', x)}
          />
          <Campo
            etiqueta={t.hasta}
            tipo="datetime-local"
            valor={v.hasta}
            cambiar={(x) => b.cambiar('hasta', x)}
          />
          <Campo
            etiqueta={t.prioridad}
            tipo="number"
            valor={v.prioridad}
            cambiar={(x) => b.cambiar('prioridad', x)}
          />
        </div>
        <Campo etiqueta={t.motivo} valor={v.motivo} cambiar={(x) => b.cambiar('motivo', x)} />
        {v.tipoCuenta === 'conductor' ? (
          <>
            <label>
              <input
                type="checkbox"
                checked={v.legal === '1'}
                onChange={(e) => b.cambiar('legal', e.target.checked ? '1' : '')}
              />{' '}
              {t.revisionLegal}
            </label>
            {v.legal === '1' ? (
              <Campo
                etiqueta={t.revisionNota}
                valor={v.nota}
                cambiar={(x) => b.cambiar('nota', x)}
              />
            ) : null}
          </>
        ) : null}
        {ok ? (
          <p className="texto-exito" role="status">
            {ok}
          </p>
        ) : null}
        <div className="fila-botones">
          <button type="submit" className="boton">
            {t.crear}
          </button>
        </div>
      </form>
    </>
  );
}

function LimitesRecarga({ t, idioma }: { t: TT; idioma: 'es' | 'en' }) {
  const b = useBorrador({
    formulario: 'super-fin-recargas',
    inicial: { pais: 'US', activas: '', minimo: '', maximo: '', sugeridos: '', automatica: '' },
    almacen: almacenNavegador,
  });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const v = b.valores;
  const moneda =
    v.pais.toUpperCase() === 'CO' ? 'COP' : v.pais.toUpperCase() === 'VE' ? 'VES' : 'USD';
  async function cargar() {
    setError('');
    try {
      const r = await pedir<{
        config: {
          activas: boolean;
          minimo: number;
          maximo: number;
          sugeridos: number[];
          automaticaPermitida: boolean;
        };
      }>('GET', `/datos/admin/finanzas/recargas-config/${v.pais.trim().toUpperCase()}`);
      b.cargarBase({
        pais: v.pais,
        activas: r.config.activas ? '1' : '',
        minimo: montoATexto(r.config.minimo, moneda),
        maximo: montoATexto(r.config.maximo, moneda),
        sugeridos: r.config.sugeridos.map((s) => montoATexto(s, moneda)).join(', '),
        automatica: r.config.automaticaPermitida ? '1' : '',
      });
    } catch (x) {
      setError(mensaje(x));
    }
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await pedir('PUT', `/datos/admin/finanzas/recargas-config/${v.pais.trim().toUpperCase()}`, {
        activas: v.activas === '1',
        minimo: textoAMonto(v.minimo, moneda),
        maximo: textoAMonto(v.maximo, moneda),
        sugeridos: v.sugeridos
          .split(/[;,\s]+/)
          .filter(Boolean)
          .map((s) => textoAMonto(s, moneda)),
        automaticaPermitida: v.automatica === '1',
      });
      await b.limpiar();
      setOk(t.guardado);
    } catch (x) {
      setError(mensaje(x));
    }
  }
  return (
    <>
      <h2>{t.recargas}</h2>
      <Recuperado b={b} idioma={idioma} />
      <form className="flex-form" noValidate onSubmit={(e) => void guardar(e)}>
        <div className="flex-inline">
          <Campo etiqueta={t.paisLimites} valor={v.pais} cambiar={(x) => b.cambiar('pais', x)} />
          <div className="fila-botones">
            <button type="button" className="boton secundario" onClick={() => void cargar()}>
              {t.cargar}
            </button>
          </div>
        </div>
        <label>
          <input
            type="checkbox"
            checked={v.activas === '1'}
            onChange={(e) => b.cambiar('activas', e.target.checked ? '1' : '')}
          />{' '}
          {t.activas}
        </label>
        <div className="flex-inline">
          <Campo
            etiqueta={t.minimo}
            valor={v.minimo}
            cambiar={(x) => b.cambiar('minimo', x)}
            placeholder="5.00"
          />
          <Campo
            etiqueta={t.maximo}
            valor={v.maximo}
            cambiar={(x) => b.cambiar('maximo', x)}
            placeholder="1000.00"
          />
        </div>
        <Campo
          etiqueta={t.sugeridos}
          valor={v.sugeridos}
          cambiar={(x) => b.cambiar('sugeridos', x)}
          placeholder="10, 20, 50, 100"
        />
        <label>
          <input
            type="checkbox"
            checked={v.automatica === '1'}
            onChange={(e) => b.cambiar('automatica', e.target.checked ? '1' : '')}
          />{' '}
          {t.automatica}
        </label>
        <Aviso error={error} />
        {ok ? (
          <p className="texto-exito" role="status">
            {ok}
          </p>
        ) : null}
        <div className="fila-botones">
          <button type="submit" className="boton">
            {t.guardar}
          </button>
        </div>
      </form>
    </>
  );
}

type FilaEmpresa = {
  id: string;
  nombre: string;
  pais: string;
  moneda: string;
  saldo: { disponible: number; reservado: number; deuda: number };
};

function Empresas({ t, idioma, base }: { t: TT; idioma: 'es' | 'en'; base: string }) {
  const [lista, setLista] = useState<FilaEmpresa[] | null>(null);
  useEffect(() => {
    void pedir<{ empresas: FilaEmpresa[] }>('GET', '/datos/admin/finanzas/empresas')
      .then((r) => setLista(r.empresas))
      .catch(() => setLista([]));
  }, []);
  if (!lista?.length) return null;
  return (
    <>
      <h2>{t.empresas}</h2>
      <ul className="flex-movimientos">
        {lista.map((e) => (
          <li key={e.id}>
            <span>
              <strong>{e.nombre}</strong>
              <small>
                {e.pais} · {t.disponible} {formatearMonto(e.saldo.disponible, e.moneda, idioma)} ·{' '}
                {t.reservado} {formatearMonto(e.saldo.reservado, e.moneda, idioma)}
                {e.saldo.deuda
                  ? ` · ${t.deuda} ${formatearMonto(e.saldo.deuda, e.moneda, idioma)}`
                  : ''}
              </small>
            </span>
            <Enlace a={`${base}/flexfinance/${e.id}`}>{t.ver}</Enlace>
          </li>
        ))}
      </ul>
    </>
  );
}

function Conciliacion({ t }: { t: TT }) {
  const [u, setU] = useState<
    | { cuando: string; ok: boolean; problemas: { tipo: string; detalle: string }[] }
    | null
    | undefined
  >(undefined);
  const [error, setError] = useState('');
  useEffect(() => {
    void pedir<{ ultima: typeof u }>('GET', '/datos/admin/finanzas/conciliacion')
      .then((r) => setU(r.ultima))
      .catch((x: unknown) => setError(mensaje(x)));
  }, []);
  return (
    <>
      <h2>{t.conciliacion}</h2>
      <Aviso error={error} />
      {u === undefined ? null : u === null ? (
        <p>{t.sinConciliacion}</p>
      ) : (
        <>
          <p className={u.ok ? 'texto-exito' : 'error-general'}>
            {u.ok ? t.cuadra : t.noCuadra} · {u.cuando}
          </p>
          {u.problemas.length ? (
            <ul>
              {u.problemas.map((p, i) => (
                <li key={i}>
                  {p.tipo}: {p.detalle}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      <div className="fila-botones">
        <button
          type="button"
          className="boton secundario"
          onClick={() =>
            void pedir<{ resultado: NonNullable<typeof u> }>(
              'POST',
              '/datos/admin/finanzas/conciliacion',
              {},
            )
              .then((r) => setU(r.resultado))
              .catch((x: unknown) => setError(mensaje(x)))
          }
        >
          {t.correrAhora}
        </button>
      </div>
    </>
  );
}

function Simulador({ t, idioma }: { t: TT; idioma: 'es' | 'en' }) {
  const b = useBorrador({
    formulario: 'super-fin-simulador',
    inicial: {
      paquetes: '40',
      tecnologia: '0.25',
      transporte: '3.00',
      conductor: '80',
      procesadorPct: '2.9',
      procesadorFijo: '0.30',
      impuesto: '0',
    },
    almacen: almacenNavegador,
  });
  const [r, setR] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');
  const v = b.valores;
  const pb = (s: string) => Math.round(Number(s.replace(',', '.')) * 100) || 0;
  async function simular(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const x = await pedir<{ desglose: Record<string, number> }>(
        'POST',
        '/datos/admin/finanzas/simular-logistico',
        {
          paquetes: Number(v.paquetes) || 1,
          tecnologiaPorPaquete: textoAMonto(v.tecnologia, 'USD'),
          transportePorPaquete: textoAMonto(v.transporte, 'USD'),
          conductorPb: pb(v.conductor),
          procesadorPb: pb(v.procesadorPct),
          procesadorFijo: textoAMonto(v.procesadorFijo, 'USD'),
          impuestoPb: pb(v.impuesto),
        },
      );
      setR(x.desglose);
    } catch (x) {
      setError(mensaje(x));
    }
  }
  return (
    <>
      <h2>{t.simulador}</h2>
      <p className="pista">{t.simuladorAyuda}</p>
      <Recuperado b={b} idioma={idioma} />
      <form className="flex-form" noValidate onSubmit={(e) => void simular(e)}>
        <div className="flex-inline">
          <Campo
            etiqueta={t.paquetes}
            valor={v.paquetes}
            cambiar={(x) => b.cambiar('paquetes', x)}
          />
          <Campo
            etiqueta={t.tecnologia}
            valor={v.tecnologia}
            cambiar={(x) => b.cambiar('tecnologia', x)}
          />
          <Campo
            etiqueta={t.transporte}
            valor={v.transporte}
            cambiar={(x) => b.cambiar('transporte', x)}
          />
        </div>
        <div className="flex-inline">
          <Campo
            etiqueta={t.conductorPct}
            valor={v.conductor}
            cambiar={(x) => b.cambiar('conductor', x)}
          />
          <Campo
            etiqueta={t.procesadorPct}
            valor={v.procesadorPct}
            cambiar={(x) => b.cambiar('procesadorPct', x)}
          />
          <Campo
            etiqueta={t.procesadorFijo}
            valor={v.procesadorFijo}
            cambiar={(x) => b.cambiar('procesadorFijo', x)}
          />
          <Campo
            etiqueta={t.impuestoPct}
            valor={v.impuesto}
            cambiar={(x) => b.cambiar('impuesto', x)}
          />
        </div>
        <Aviso error={error} />
        <div className="fila-botones">
          <button type="submit" className="boton">
            {t.simular}
          </button>
        </div>
      </form>
      {r ? (
        <ul className="flex-movimientos">
          {Object.entries(t.resultado).map(([k, n]) => (
            <li key={k}>
              <span>{n}</span>
              <strong>{formatearMonto(r[k] ?? 0, 'USD', idioma)}</strong>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

type DetalleEmpresa = {
  empresa: { id: string; nombre: string; pais: string; moneda: string };
  saldo: { disponible: number; reservado: number; deuda: number; total: number };
  movimientos: { id: string; bolsillo: string; monto: number; tipo: string; creadoEn: string }[];
  recargas: { id: string; monto: number; estado: string; reembolsado: number; creado_en: string }[];
  auditoria: {
    id: number;
    accion: string;
    actor_id: string | null;
    creado_en: string;
    detalle_json: string;
  }[];
};

function EmpresaFinanzas({ base, idioma, id }: { base: string; idioma: 'es' | 'en'; id: string }) {
  const t = T[idioma];
  const [d, setD] = useState<DetalleEmpresa | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: `super-fin-ajuste-${id}`,
    inicial: { monto: '', motivo: '', clave: '', recarga: '', reembolso: '' },
    almacen: almacenNavegador,
    sensibles: ['clave'],
  });
  const cargar = useCallback(() => {
    pedir<DetalleEmpresa>('GET', `/datos/admin/finanzas/empresas/${id}/movimientos`)
      .then(setD)
      .catch((x: unknown) => setError(mensaje(x)));
  }, [id]);
  useEffect(cargar, [cargar]);
  if (!d) return <p role={error ? 'alert' : 'status'}>{error || '…'}</p>;
  const m = (x: number) => formatearMonto(x, d.empresa.moneda, idioma);
  const v = b.valores;
  async function ajustar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    const negativo = v.monto.trim().startsWith('-');
    const monto = textoAMonto(v.monto.replace('-', ''), d!.empresa.moneda) * (negativo ? -1 : 1);
    try {
      if (v.recarga)
        await pedir('POST', `/datos/admin/finanzas/recargas/${v.recarga}/reembolsar`, {
          monto: textoAMonto(v.reembolso, d!.empresa.moneda),
          motivo: v.motivo,
          clave: v.clave,
        });
      else
        await pedir('POST', `/datos/admin/finanzas/empresas/${id}/ajuste`, {
          monto,
          motivo: v.motivo,
          clave: v.clave,
        });
      await b.limpiar();
      setOk(t.guardado);
      cargar();
    } catch (x) {
      setError(mensaje(x));
    }
  }
  return (
    <section className="super">
      <p>
        <Enlace a={`${base}/flexfinance`}>{t.volver}</Enlace>
      </p>
      <h1>{d.empresa.nombre}</h1>
      <div className="flex-kpis">
        <div className="flex-kpi flex-kpi-grande">
          <span>{t.disponible}</span>
          <strong>{m(d.saldo.disponible)}</strong>
        </div>
        <div className="flex-kpi">
          <span>{t.reservado}</span>
          <strong>{m(d.saldo.reservado)}</strong>
        </div>
        <div className="flex-kpi">
          <span>{t.deuda}</span>
          <strong>{m(d.saldo.deuda)}</strong>
        </div>
      </div>
      <h2>{t.ajuste}</h2>
      <p className="pista">{t.ajusteAyuda}</p>
      <Recuperado b={b} idioma={idioma} />
      <form className="flex-form" noValidate onSubmit={(e) => void ajustar(e)}>
        <div className="campo">
          <label htmlFor="fin-recarga">{t.reembolsar}</label>
          <select
            id="fin-recarga"
            value={v.recarga}
            onChange={(e) => b.cambiar('recarga', e.target.value)}
          >
            <option value="">{t.ajuste}</option>
            {d.recargas
              .filter((r) => r.estado === 'acreditada' && r.reembolsado < r.monto)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {t.reembolsar} · {m(r.monto)} · {r.creado_en}
                </option>
              ))}
          </select>
        </div>
        {v.recarga ? (
          <Campo
            etiqueta={t.reembolsoMonto}
            valor={v.reembolso}
            cambiar={(x) => b.cambiar('reembolso', x)}
          />
        ) : (
          <Campo
            etiqueta={t.monto}
            valor={v.monto}
            cambiar={(x) => b.cambiar('monto', x)}
            placeholder="-5.00"
          />
        )}
        <Campo etiqueta={t.motivo} valor={v.motivo} cambiar={(x) => b.cambiar('motivo', x)} />
        <CampoClave
          etiqueta={t.clave}
          valor={v.clave}
          cambiar={(x) => b.cambiar('clave', x)}
          textoVer={idioma === 'en' ? 'Show password' : 'Ver la contraseña'}
          textoOcultar={idioma === 'en' ? 'Hide password' : 'Ocultar la contraseña'}
          autoComplete="current-password"
        />
        <Aviso error={error} />
        {ok ? (
          <p className="texto-exito" role="status">
            {ok}
          </p>
        ) : null}
        <div className="fila-botones">
          <button type="submit" className="boton">
            {v.recarga ? t.reembolsar : t.aplicar}
          </button>
        </div>
      </form>
      <h2>{t.movimientos}</h2>
      <ul className="flex-movimientos">
        {d.movimientos.map((x) => (
          <li key={x.id}>
            <span>
              <strong>{x.tipo}</strong>
              <small>
                {x.creadoEn} · {x.bolsillo}
              </small>
            </span>
            <span>{m(x.monto)}</span>
          </li>
        ))}
      </ul>
      <h2>{t.auditoria}</h2>
      <ul className="flex-movimientos">
        {d.auditoria.map((a) => (
          <li key={a.id}>
            <span>
              <strong>{a.accion}</strong>
              <small>
                {a.creado_en} · {a.actor_id ?? 'sistema'}
              </small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
