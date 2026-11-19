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
import { pedir } from './api';

/**
 * C-CUPON-DIVOOX (17 nov 2026): los regalos que paga Divoox. El equipo crea el cupón (nace apagado),
 * lo enciende, ve en vivo cuánto se gastó y cuánto queda, revisa las alertas antifraude y le paga al
 * conductor por pago móvil lo acreditado. Los topes viven en el código del servidor: aquí solo se ven.
 */
const T = {
  es: {
    titulo: 'Regalos Divoox',
    ayuda:
      'Cupones que paga Divoox, no el conductor: el cliente paga en mano solo la diferencia y lo que cubre el regalo se le acredita al conductor en sus ganancias. Cada cupón tiene un presupuesto total; al agotarse se apaga solo. Un uso por cuenta, por teléfono y por aparato.',
    topes: (v: string, p: string, g: string) =>
      `Topes fijos de Divoox: hasta ${v} por uso, ${p} por cupón y ${g} sumando todos los cupones vigentes.`,
    cupones: 'Cupones',
    sinCupones: 'Todavía no hay cupones.',
    encendido: 'Encendido',
    apagado: 'Apagado',
    agotado: 'Agotado',
    presupuesto: 'Presupuesto',
    gastado: 'Gastado',
    apartado: 'En viajes en curso',
    queda: 'Queda',
    usos: (n: number) => (n === 1 ? '1 uso cobrado' : `${n} usos cobrados`),
    porUso: (m: string) => `Cubre hasta ${m} por uso`,
    gratisHasta: (m: string) => `Viaje gratis hasta ${m}`,
    bienvenida: 'Bienvenida: se aplica solo en la primera operación, sin código',
    conCodigo: 'Con código: el cliente lo agrega en la app',
    vence: (f: string) => `Vence: ${f}`,
    sinVencer: 'Sin vencimiento',
    tope: (n: number) => `Hasta ${n} viajes con regalo por conductor al día`,
    encender: 'Encender',
    apagar: 'Apagar',
    subir: 'Cambiar el presupuesto',
    nuevoPresupuesto: 'Presupuesto nuevo (dólares)',
    guardarPresupuesto: 'Guardar presupuesto',
    verUsos: 'Ver los usos',
    ocultarUsos: 'Ocultar los usos',
    sinUsos: 'Todavía no hay usos.',
    estados: { apartado: 'Apartado', cobrado: 'Cobrado', liberado: 'Liberado' } as Record<
      string,
      string
    >,
    crear: 'Crear un cupón',
    crearAyuda: 'El cupón nace apagado. Revísalo y enciéndelo cuando todo esté listo.',
    codigo: 'Código (letras y números)',
    nombreEs: 'Nombre en español',
    nombreEn: 'Nombre en inglés',
    tipo: 'Qué regala',
    tipoMonto: 'Un monto por uso',
    tipoGratis: 'Viaje gratis hasta un tope',
    valor: 'Monto por uso o tope del viaje gratis (dólares)',
    servicios: 'Servicios',
    nombresServicio: {
      moto: 'Moto',
      carro: 'Carro',
      envios: 'Envíos',
      comida: 'Comida',
    } as Record<string, string>,
    ciudades: 'Ciudades',
    venceEn: 'Vence (opcional)',
    presupuestoTotal: 'Presupuesto total (dólares)',
    esBienvenida: 'Regalo de bienvenida (sin código, solo la primera vez)',
    topeDiario: 'Viajes con regalo por conductor al día',
    guardar: 'Crear apagado',
    creado: 'Cupón creado y apagado. Enciéndelo cuando esté listo.',
    guardado: 'Guardado.',
    conductores: 'Lo acreditado a cada conductor',
    conductoresAyuda:
      'Lo que pagó Divoox con los regalos entra a las ganancias del conductor. Se lo pagas por pago móvil y lo registras aquí con la referencia del banco, o él lo pasa a su saldo con un toque desde su app.',
    sinConductores: 'Todavía no hay regalos cobrados.',
    conductor: 'Conductor',
    viajes: 'Viajes',
    acreditado: 'Acreditado',
    pagado: 'Pagado por pago móvil',
    aSaldo: 'Pasado a su saldo',
    porPagar: 'Se le puede pagar',
    monto: 'Monto (dólares)',
    referencia: 'Referencia del pago móvil',
    registrarPago: 'Registrar pago',
    alertas: 'Alertas antifraude (30 días)',
    sinAlertas: 'Sin alertas.',
    tiposAlerta: {
      propio: 'Conductor con su propio regalo',
      tope_diario: 'Tope diario del conductor',
      misma_pareja: 'El mismo cliente y el mismo conductor',
      sin_moverse: 'Viaje con regalo terminado sin moverse',
      muy_corto: 'Viaje con regalo demasiado corto',
      lejos_destino: 'Viaje con regalo terminado lejos del destino',
      sin_ubicacion: 'Viaje con regalo terminado sin ubicación',
      pasajero_lejos: 'El pasajero no iba con el conductor',
      cuentas_mismo_dia: 'Regalos con cuentas creadas el mismo día',
    } as Record<string, string>,
    revisiones: 'Regalos en revisión',
    revisionesAyuda:
      'Viajes con regalo que no se pudieron comprobar como reales. El viaje se terminó, pero el regalo no entra a las ganancias del conductor hasta que lo apruebes. Si lo rechazas, el dinero vuelve al presupuesto del cupón.',
    sinRevisiones: 'No hay regalos por revisar.',
    pendientes: (n: number) => (n === 1 ? '1 por revisar' : `${n} por revisar`),
    nota: 'Nota de la revisión',
    notaPista: 'Qué comprobaste (obligatoria para rechazar)',
    aprobar: 'Aprobar y acreditar',
    rechazar: 'Rechazar',
    estadosRevision: {
      pendiente: 'Por revisar',
      aprobado: 'Aprobado',
      rechazado: 'Rechazado',
    } as Record<string, string>,
    resueltas: 'Revisados en los últimos 30 días',
    porQuien: (quien: string) => `Lo revisó ${quien}`,
    cargando: 'Cargando…',
  },
  en: {
    titulo: 'Divoox gifts',
    ayuda:
      'Promo codes paid by Divoox, not by the driver: the customer pays in person only the difference, and what the gift covers is credited to the driver’s earnings. Each code has a total budget; when it runs out, it turns off on its own. One use per account, per phone and per device.',
    topes: (v: string, p: string, g: string) =>
      `Fixed Divoox limits: up to ${v} per use, ${p} per code and ${g} across all active codes.`,
    cupones: 'Codes',
    sinCupones: 'There are no codes yet.',
    encendido: 'On',
    apagado: 'Off',
    agotado: 'Used up',
    presupuesto: 'Budget',
    gastado: 'Spent',
    apartado: 'In trips in progress',
    queda: 'Left',
    usos: (n: number) => (n === 1 ? '1 paid use' : `${n} paid uses`),
    porUso: (m: string) => `Covers up to ${m} per use`,
    gratisHasta: (m: string) => `Free trip up to ${m}`,
    bienvenida: 'Welcome: applies on the first trip or order only, no code needed',
    conCodigo: 'With a code: the customer adds it in the app',
    vence: (f: string) => `Expires: ${f}`,
    sinVencer: 'No expiration',
    tope: (n: number) => `Up to ${n} gift trips per driver per day`,
    encender: 'Turn on',
    apagar: 'Turn off',
    subir: 'Change the budget',
    nuevoPresupuesto: 'New budget (dollars)',
    guardarPresupuesto: 'Save budget',
    verUsos: 'See uses',
    ocultarUsos: 'Hide uses',
    sinUsos: 'No uses yet.',
    estados: { apartado: 'Set aside', cobrado: 'Paid', liberado: 'Released' } as Record<
      string,
      string
    >,
    crear: 'Create a code',
    crearAyuda: 'The code is created off. Review it and turn it on when everything is ready.',
    codigo: 'Code (letters and numbers)',
    nombreEs: 'Name in Spanish',
    nombreEn: 'Name in English',
    tipo: 'What it gives',
    tipoMonto: 'An amount per use',
    tipoGratis: 'A free trip up to a limit',
    valor: 'Amount per use or free-trip limit (dollars)',
    servicios: 'Services',
    nombresServicio: {
      moto: 'Moto',
      carro: 'Car',
      envios: 'Deliveries',
      comida: 'Food',
    } as Record<string, string>,
    ciudades: 'Cities',
    venceEn: 'Expires (optional)',
    presupuestoTotal: 'Total budget (dollars)',
    esBienvenida: 'Welcome gift (no code, first time only)',
    topeDiario: 'Gift trips per driver per day',
    guardar: 'Create (off)',
    creado: 'Code created and off. Turn it on when it’s ready.',
    guardado: 'Saved.',
    conductores: 'What each driver was credited',
    conductoresAyuda:
      'What Divoox paid with gifts goes into the driver’s earnings. Send it by mobile payment and record it here with the bank reference, or the driver moves it to their balance with one tap in their app.',
    sinConductores: 'No paid gifts yet.',
    conductor: 'Driver',
    viajes: 'Trips',
    acreditado: 'Credited',
    pagado: 'Paid by mobile payment',
    aSaldo: 'Moved to their balance',
    porPagar: 'Can be paid',
    monto: 'Amount (dollars)',
    referencia: 'Mobile payment reference',
    registrarPago: 'Record payment',
    alertas: 'Anti-fraud alerts (30 days)',
    sinAlertas: 'No alerts.',
    tiposAlerta: {
      propio: 'Driver with their own gift',
      tope_diario: 'Driver daily limit',
      misma_pareja: 'Same customer and same driver',
      sin_moverse: 'Gift trip ended without moving',
      muy_corto: 'Gift trip too short',
      lejos_destino: 'Gift trip ended far from the drop-off',
      sin_ubicacion: 'Gift trip ended with no location',
      pasajero_lejos: 'The rider wasn’t with the driver',
      cuentas_mismo_dia: 'Gifts with accounts created the same day',
    } as Record<string, string>,
    revisiones: 'Gifts under review',
    revisionesAyuda:
      'Gift trips we couldn’t confirm as real. The trip was completed, but the gift doesn’t reach the driver’s earnings until you approve it. If you reject it, the money goes back to the coupon budget.',
    sinRevisiones: 'No gifts to review.',
    pendientes: (n: number) => `${n} to review`,
    nota: 'Review note',
    notaPista: 'What you checked (required to reject)',
    aprobar: 'Approve and credit',
    rechazar: 'Reject',
    estadosRevision: {
      pendiente: 'To review',
      aprobado: 'Approved',
      rechazado: 'Rejected',
    } as Record<string, string>,
    resueltas: 'Reviewed in the last 30 days',
    porQuien: (quien: string) => `Reviewed by ${quien}`,
    cargando: 'Loading…',
  },
};

type Cupon = {
  codigo: string;
  nombreEs: string;
  nombreEn: string;
  tipo: 'monto' | 'gratis';
  valor: number;
  moneda: string;
  servicios: string[];
  zonas: string[];
  venceEn: string | null;
  presupuesto: number;
  bienvenida: boolean;
  topeDiarioConductor: number;
  activo: boolean;
  agotado: boolean;
  gastado: number;
  apartado: number;
  restante: number;
  usos: number;
};
type Conductor = {
  conductorId: string;
  nombre: string;
  moneda: string;
  viajes: number;
  acreditado: number;
  pagadoPagoMovil: number;
  pasadoASaldo: number;
  porPagar: number;
};
type Alerta = {
  id: string;
  tipo: string;
  codigo: string | null;
  cliente: string | null;
  conductor: string | null;
  detalle: string;
  creadoEn: string;
};
type Revision = {
  id: string;
  codigo: string;
  conductor: string;
  cliente: string;
  monto: number;
  moneda: string;
  motivos: string[];
  detalle: string;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  nota: string;
  creadoEn: string;
  resolvio: string | null;
};
type Datos = {
  cupones: Cupon[];
  conductores: Conductor[];
  alertas: Alerta[];
  /** C-REGALO-VIAJE-REAL: regalos de viajes que no se pudieron comprobar como reales. */
  revisiones?: Revision[];
  zonas: { id: string; nombre: string; pais: string; moneda: string }[];
  servicios: string[];
  topes: { valorMaximo: number; presupuestoMaximo: number; presupuestoGlobalMaximo: number };
};
type Uso = {
  id: string;
  servicio: string;
  monto: number;
  moneda: string;
  estado: string;
  cliente: string;
  conductor: string | null;
  creadoEn: string;
};

/** Lectura segura de un texto por clave (sin índices sueltos). */
const de = (textos: Record<string, string>, clave: string) =>
  new Map(Object.entries(textos)).get(clave) ?? clave;

const aCentavos = (s: string) => Math.round(Number(String(s).replace(',', '.') || 0) * 100);

const INICIAL = {
  codigo: '',
  nombreEs: '',
  nombreEn: '',
  tipo: 'monto',
  valor: '',
  servicios: 'moto,envios,comida',
  zonas: '',
  venceEn: '',
  presupuesto: '',
  bienvenida: false,
  topeDiario: '6',
};

export function SuperRegalosDivoox({ idioma }: { idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const b = useBorrador({
    formulario: 'regalos-divoox',
    cuenta: 'superadmin',
    inicial: INICIAL,
    almacen: almacenNavegador,
  });
  const [vuelta, setVuelta] = useState(0);
  const cargar = () => setVuelta((n) => n + 1);
  useEffect(() => {
    let vivo = true;
    pedir<Datos>('GET', '/datos/admin/regalos-divoox')
      .then((d) => {
        if (vivo) setDatos(d);
      })
      .catch((x: unknown) => {
        if (vivo) setError(x instanceof ErrorApi ? x.message : String(x));
      });
    return () => {
      vivo = false;
    };
  }, [vuelta]);
  const dinero = (c: number, moneda = 'USD') => formatearMonto(c, moneda, idioma);
  const lista = (s: string) => s.split(',').filter(Boolean);
  const alternar = (clave: 'servicios' | 'zonas', valor: string) => {
    const actual = new Set(lista(clave === 'servicios' ? b.valores.servicios : b.valores.zonas));
    if (actual.has(valor)) actual.delete(valor);
    else actual.add(valor);
    b.cambiar(clave, [...actual].join(','));
  };

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await pedir('POST', '/datos/admin/regalos-divoox', {
        codigo: b.valores.codigo,
        nombreEs: b.valores.nombreEs,
        nombreEn: b.valores.nombreEn,
        tipo: b.valores.tipo,
        valor: aCentavos(b.valores.valor),
        servicios: lista(b.valores.servicios),
        zonas: lista(b.valores.zonas),
        venceEn: b.valores.venceEn || null,
        presupuesto: aCentavos(b.valores.presupuesto),
        bienvenida: b.valores.bienvenida,
        topeDiarioConductor: Number(b.valores.topeDiario || 6),
      });
      await b.limpiar();
      setOk(t.creado);
      cargar();
    } catch (x) {
      // Lo escrito se queda en pantalla para corregirlo.
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function cambiar(codigo: string, cuerpo: Record<string, unknown>) {
    setError('');
    setOk('');
    try {
      await pedir('PATCH', `/datos/admin/regalos-divoox/${codigo}`, cuerpo);
      setOk(t.guardado);
      cargar();
    } catch (x) {
      setError(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  if (!datos)
    return (
      <div className="super" data-testid="super-regalos-divoox">
        <h2>{t.titulo}</h2>
        {error ? (
          <p className="error-general" role="alert">
            {error}
          </p>
        ) : (
          <p className="pista">{t.cargando}</p>
        )}
      </div>
    );
  const pendientes = (datos.revisiones ?? []).filter((r) => r.estado === 'pendiente');
  const resueltas = (datos.revisiones ?? []).filter((r) => r.estado !== 'pendiente');

  const nombreZona = new Map(datos.zonas.map((z) => [z.id, z.nombre]));
  return (
    <div className="super" data-testid="super-regalos-divoox">
      <h2>
        {t.titulo}
        <AyudaAqui guia="create-divoox-gift-code" idioma={idioma} />
      </h2>
      <p className="pista">{t.ayuda}</p>
      <p className="pista" data-testid="regalos-topes">
        {t.topes(
          dinero(datos.topes.valorMaximo),
          dinero(datos.topes.presupuestoMaximo),
          dinero(datos.topes.presupuestoGlobalMaximo),
        )}
      </p>
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

      <h3>{t.cupones}</h3>
      {datos.cupones.length === 0 ? <p className="pista">{t.sinCupones}</p> : null}
      <ul className="flex-lista-tarjetas">
        {datos.cupones.map((c) => (
          <TarjetaCupon
            key={c.codigo}
            c={c}
            t={t}
            idioma={idioma}
            dinero={dinero}
            nombreZona={(id) => nombreZona.get(id) ?? id}
            cambiar={(cuerpo) => void cambiar(c.codigo, cuerpo)}
          />
        ))}
      </ul>

      <h3>{t.crear}</h3>
      <p className="pista">{t.crearAyuda}</p>
      <AvisoBorrador
        visible={b.recuperado}
        idioma={idioma}
        empezar={() => void b.empezarDeNuevo()}
      />
      <form
        className="formulario tarjeta-form"
        onSubmit={(e) => void crear(e)}
        noValidate
        data-testid="regalos-crear"
      >
        <label className="campo">
          {t.codigo}
          <input
            value={b.valores.codigo}
            onChange={(e) => b.cambiar('codigo', e.target.value.toUpperCase())}
            placeholder="CODIGO"
            autoCapitalize="characters"
          />
        </label>
        <label className="campo">
          {t.nombreEs}
          <input
            value={b.valores.nombreEs}
            onChange={(e) => b.cambiar('nombreEs', e.target.value)}
          />
        </label>
        <label className="campo">
          {t.nombreEn}
          <input
            value={b.valores.nombreEn}
            onChange={(e) => b.cambiar('nombreEn', e.target.value)}
          />
        </label>
        <fieldset className="campo">
          <legend>{t.tipo}</legend>
          {(['monto', 'gratis'] as const).map((tipo) => (
            <label key={tipo} className="casilla-fila">
              <input
                type="radio"
                name="tipo-regalo"
                checked={b.valores.tipo === tipo}
                onChange={() => b.cambiar('tipo', tipo)}
              />
              {tipo === 'monto' ? t.tipoMonto : t.tipoGratis}
            </label>
          ))}
        </fieldset>
        <label className="campo">
          {t.valor}
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={b.valores.valor}
            onChange={(e) => b.cambiar('valor', e.target.value)}
          />
        </label>
        <fieldset className="campo">
          <legend>{t.servicios}</legend>
          {datos.servicios.map((s) => (
            <label key={s} className="casilla-fila">
              <input
                type="checkbox"
                checked={lista(b.valores.servicios).includes(s)}
                onChange={() => alternar('servicios', s)}
              />
              {de(t.nombresServicio, s)}
            </label>
          ))}
        </fieldset>
        <fieldset className="campo">
          <legend>{t.ciudades}</legend>
          {datos.zonas.map((z) => (
            <label key={z.id} className="casilla-fila">
              <input
                type="checkbox"
                checked={lista(b.valores.zonas).includes(z.id)}
                onChange={() => alternar('zonas', z.id)}
              />
              {z.nombre} · {z.pais} · {z.moneda}
            </label>
          ))}
        </fieldset>
        <label className="campo">
          {t.venceEn}
          <input
            type="date"
            value={b.valores.venceEn}
            onChange={(e) => b.cambiar('venceEn', e.target.value)}
          />
        </label>
        <label className="campo">
          {t.presupuestoTotal}
          <input
            type="number"
            inputMode="decimal"
            min="1"
            step="1"
            value={b.valores.presupuesto}
            onChange={(e) => b.cambiar('presupuesto', e.target.value)}
          />
        </label>
        <label className="campo">
          {t.topeDiario}
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="20"
            value={b.valores.topeDiario}
            onChange={(e) => b.cambiar('topeDiario', e.target.value)}
          />
        </label>
        <label className="casilla-fila">
          <input
            type="checkbox"
            checked={b.valores.bienvenida}
            onChange={(e) => b.cambiar('bienvenida', e.target.checked)}
          />
          {t.esBienvenida}
        </label>
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>

      <h3 id="regalos-en-revision">
        {t.revisiones}
        {pendientes.length > 0 ? (
          <span className="pista" data-testid="regalos-revision-cuenta">
            {' '}
            · {t.pendientes(pendientes.length)}
          </span>
        ) : null}
      </h3>
      <p className="pista">{t.revisionesAyuda}</p>
      {pendientes.length === 0 ? (
        <p className="pista">{t.sinRevisiones}</p>
      ) : (
        <ul className="flex-lista-tarjetas" data-testid="regalos-revisiones">
          {pendientes.map((r) => (
            <TarjetaRevision
              key={r.id}
              r={r}
              t={t}
              dinero={dinero}
              alResolver={cargar}
              setError={setError}
              setOk={setOk}
            />
          ))}
        </ul>
      )}
      {resueltas.length > 0 ? (
        <details>
          <summary>{t.resueltas}</summary>
          <ul className="flex-lista-tarjetas" data-testid="regalos-revisiones-resueltas">
            {resueltas.map((r) => (
              <li key={r.id} className="flex-tarjeta">
                <strong className={r.estado === 'aprobado' ? 'texto-exito' : undefined}>
                  {de(t.estadosRevision, r.estado)}
                </strong>
                {` · ${r.codigo} · ${dinero(r.monto, r.moneda)}`}
                <p>{r.detalle}</p>
                {r.nota ? <p>{r.nota}</p> : null}
                <p className="pista">
                  {[r.cliente, r.conductor].filter(Boolean).join(' → ')}
                  {r.resolvio ? ` · ${t.porQuien(r.resolvio)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <h3>{t.conductores}</h3>
      <p className="pista">{t.conductoresAyuda}</p>
      {datos.conductores.length === 0 ? (
        <p className="pista">{t.sinConductores}</p>
      ) : (
        <div className="tabla-ancha">
          <table className="tabla" aria-label={t.conductores}>
            <thead>
              <tr>
                <th>{t.conductor}</th>
                <th>{t.viajes}</th>
                <th>{t.acreditado}</th>
                <th>{t.pagado}</th>
                <th>{t.aSaldo}</th>
                <th>{t.porPagar}</th>
                <th>{t.registrarPago}</th>
              </tr>
            </thead>
            <tbody>
              {datos.conductores.map((x) => (
                <FilaConductor
                  key={`${x.conductorId}-${x.moneda}`}
                  x={x}
                  t={t}
                  dinero={dinero}
                  alPagar={cargar}
                  setError={setError}
                  setOk={setOk}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>{t.alertas}</h3>
      {datos.alertas.length === 0 ? (
        <p className="pista">{t.sinAlertas}</p>
      ) : (
        <ul className="flex-lista-tarjetas" data-testid="regalos-alertas">
          {datos.alertas.map((a) => (
            <li key={a.id} className="flex-tarjeta">
              <strong>{de(t.tiposAlerta, a.tipo)}</strong>
              {a.codigo ? ` · ${a.codigo}` : ''}
              <p>{a.detalle}</p>
              <p className="pista">
                {[a.cliente, a.conductor].filter(Boolean).join(' → ')} · {a.creadoEn}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** C-REGALO-VIAJE-REAL: un regalo por revisar, con lo medido y los dos botones. */
function TarjetaRevision({
  r,
  t,
  dinero,
  alResolver,
  setError,
  setOk,
}: {
  r: Revision;
  t: (typeof T)['es'];
  dinero: (c: number, moneda?: string) => string;
  alResolver: () => void;
  setError: (s: string) => void;
  setOk: (s: string) => void;
}) {
  // Lo escrito no se pierde si se cierra la ventana (regla de los formularios).
  const f = useBorrador({
    formulario: `regalo-revision-${r.id}`,
    cuenta: 'superadmin',
    inicial: { nota: '' },
    almacen: almacenNavegador,
  });
  const [enviando, setEnviando] = useState(false);
  // El error sale junto a los botones de ESTE regalo, no arriba de la página.
  const [fallo, setFallo] = useState('');
  async function resolver(aprobar: boolean) {
    setError('');
    setFallo('');
    setOk('');
    setEnviando(true);
    try {
      await pedir('POST', `/datos/admin/regalos-divoox/revisiones/${r.id}`, {
        aprobar,
        nota: f.valores.nota,
      });
      await f.limpiar();
      setOk(t.guardado);
      alResolver();
    } catch (er) {
      // Lo escrito se queda en pantalla para reintentar.
      setFallo(er instanceof ErrorApi ? er.message : String(er));
    } finally {
      setEnviando(false);
    }
  }
  return (
    <li className="flex-tarjeta" data-testid="regalo-revision">
      <strong>{r.motivos.map((m) => de(t.tiposAlerta, m)).join(' · ')}</strong>
      {` · ${r.codigo} · ${dinero(r.monto, r.moneda)}`}
      <p>{r.detalle}</p>
      <p className="pista">
        {[r.cliente, r.conductor].filter(Boolean).join(' → ')} · {r.creadoEn}
      </p>
      <label className="campo">
        {t.nota}
        <input
          value={f.valores.nota}
          maxLength={200}
          onChange={(e) => f.cambiar('nota', e.target.value)}
          placeholder={t.notaPista}
        />
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button
          type="button"
          className="boton exito"
          disabled={enviando}
          onClick={() => void resolver(true)}
        >
          {t.aprobar}
        </button>
        <button
          type="button"
          className="boton secundario"
          disabled={enviando}
          onClick={() => void resolver(false)}
        >
          {t.rechazar}
        </button>
      </div>
      {fallo ? (
        <p className="error-general" role="alert">
          {fallo}
        </p>
      ) : null}
    </li>
  );
}

function TarjetaCupon({
  c,
  t,
  idioma,
  dinero,
  nombreZona,
  cambiar,
}: {
  c: Cupon;
  t: (typeof T)['es'];
  idioma: Idioma;
  dinero: (c: number, moneda?: string) => string;
  nombreZona: (id: string) => string;
  cambiar: (cuerpo: Record<string, unknown>) => void;
}) {
  const p = useBorrador({
    formulario: `regalo-presupuesto-${c.codigo}`,
    cuenta: 'superadmin',
    inicial: { presupuesto: '' },
    almacen: almacenNavegador,
  });
  const presupuesto = p.valores.presupuesto;
  const [editando, setEditando] = useState(Boolean(presupuesto));
  const [usos, setUsos] = useState<Uso[] | null>(null);
  const pct = (n: number) => `${Math.min(100, (n / Math.max(1, c.presupuesto)) * 100)}%`;
  const estado = c.activo ? t.encendido : c.agotado ? t.agotado : t.apagado;
  return (
    <li className="flex-tarjeta" data-testid={`regalo-${c.codigo}`}>
      <div className="flex-inline">
        <strong style={{ fontSize: 18 }}>{c.codigo}</strong>
        <span className={c.activo ? 'regalo-estado regalo-encendido' : 'regalo-estado'}>
          {estado}
        </span>
      </div>
      <p>{idioma === 'en' ? c.nombreEn : c.nombreEs}</p>
      <div className="flex-kpis">
        <div className="flex-kpi">
          <span>{t.presupuesto}</span>
          <strong>{dinero(c.presupuesto, c.moneda)}</strong>
        </div>
        <div className="flex-kpi">
          <span>{t.gastado}</span>
          <strong>{dinero(c.gastado, c.moneda)}</strong>
        </div>
        <div className="flex-kpi">
          <span>{t.apartado}</span>
          <strong>{dinero(c.apartado, c.moneda)}</strong>
        </div>
        <div className="flex-kpi">
          <span>{t.queda}</span>
          <strong>{dinero(c.restante, c.moneda)}</strong>
        </div>
      </div>
      <div
        className="regalo-barra"
        role="img"
        aria-label={`${t.gastado} ${dinero(c.gastado, c.moneda)} · ${t.queda} ${dinero(c.restante, c.moneda)}`}
      >
        <i className="regalo-gastado" style={{ width: pct(c.gastado) }} />
        <i className="regalo-apartado" style={{ width: pct(c.apartado) }} />
      </div>
      <p>
        {c.tipo === 'gratis'
          ? t.gratisHasta(dinero(c.valor, c.moneda))
          : t.porUso(dinero(c.valor, c.moneda))}{' '}
        · {t.usos(c.usos)}
      </p>
      <p>{c.bienvenida ? t.bienvenida : t.conCodigo}</p>
      <p>
        {t.servicios}: {c.servicios.map((s) => de(t.nombresServicio, s)).join(', ')} · {t.ciudades}:{' '}
        {c.zonas.map(nombreZona).join(', ')}
      </p>
      <p>
        {c.venceEn ? t.vence(c.venceEn.slice(0, 10)) : t.sinVencer} ·{' '}
        {t.tope(c.topeDiarioConductor)}
      </p>
      <div className="fila-botones">
        <button
          type="button"
          className={c.activo ? 'boton secundario' : 'boton exito'}
          onClick={() => cambiar({ activo: !c.activo })}
        >
          {c.activo ? t.apagar : t.encender}
        </button>
        <button type="button" className="boton secundario" onClick={() => setEditando((x) => !x)}>
          {t.subir}
        </button>
        <button
          type="button"
          className="boton secundario"
          onClick={() => {
            if (usos) return setUsos(null);
            pedir<{ usos: Uso[] }>('GET', `/datos/admin/regalos-divoox/${c.codigo}/usos`)
              .then((r) => setUsos(r.usos))
              .catch(() => setUsos([]));
          }}
        >
          {usos ? t.ocultarUsos : t.verUsos}
        </button>
      </div>
      {editando ? (
        <form
          className="flex-form"
          onSubmit={(e) => {
            e.preventDefault();
            cambiar({ presupuesto: aCentavos(presupuesto) });
            void p.limpiar();
            setEditando(false);
          }}
        >
          <label className="campo">
            {t.nuevoPresupuesto}
            <input
              type="number"
              inputMode="decimal"
              min="1"
              value={presupuesto}
              onChange={(e) => p.cambiar('presupuesto', e.target.value)}
              placeholder={String(c.presupuesto / 100)}
            />
          </label>
          <button type="submit" className="boton">
            {t.guardarPresupuesto}
          </button>
        </form>
      ) : null}
      {usos ? (
        usos.length === 0 ? (
          <p className="pista">{t.sinUsos}</p>
        ) : (
          <div className="tabla-ancha">
            <table className="tabla">
              <tbody>
                {usos.map((u) => (
                  <tr key={u.id}>
                    <td>{u.creadoEn}</td>
                    <td>{de(t.nombresServicio, u.servicio)}</td>
                    <td>{u.cliente}</td>
                    <td>{u.conductor ?? '—'}</td>
                    <td>{dinero(u.monto, u.moneda)}</td>
                    <td>{de(t.estados, u.estado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </li>
  );
}

function FilaConductor({
  x,
  t,
  dinero,
  alPagar,
  setError,
  setOk,
}: {
  x: Conductor;
  t: (typeof T)['es'];
  dinero: (c: number, moneda?: string) => string;
  alPagar: () => void;
  setError: (s: string) => void;
  setOk: (s: string) => void;
}) {
  // Lo escrito no se pierde si se cierra la ventana (regla de los formularios).
  const f = useBorrador({
    formulario: `regalo-pago-${x.conductorId}`,
    cuenta: 'superadmin',
    inicial: { monto: '', referencia: '' },
    almacen: almacenNavegador,
  });
  const { monto, referencia } = f.valores;
  async function pagar(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk('');
    try {
      await pedir('POST', `/datos/admin/regalos-divoox/conductores/${x.conductorId}/pago-movil`, {
        moneda: x.moneda,
        monto: aCentavos(monto),
        referencia,
      });
      await f.limpiar();
      setOk(t.guardado);
      alPagar();
    } catch (er) {
      setError(er instanceof ErrorApi ? er.message : String(er));
    }
  }
  return (
    <tr>
      <td>{x.nombre}</td>
      <td>{x.viajes}</td>
      <td>{dinero(x.acreditado, x.moneda)}</td>
      <td>{dinero(x.pagadoPagoMovil, x.moneda)}</td>
      <td>{dinero(x.pasadoASaldo, x.moneda)}</td>
      <td>{dinero(x.porPagar, x.moneda)}</td>
      <td>
        {x.porPagar > 0 ? (
          <form className="flex-form" onSubmit={(e) => void pagar(e)}>
            <input
              aria-label={t.monto}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={monto}
              onChange={(e) => f.cambiar('monto', e.target.value)}
              placeholder={t.monto}
            />
            <input
              aria-label={t.referencia}
              value={referencia}
              onChange={(e) => f.cambiar('referencia', e.target.value)}
              placeholder={t.referencia}
            />
            <button type="submit" className="boton secundario">
              {t.registrarPago}
            </button>
          </form>
        ) : null}
      </td>
    </tr>
  );
}
