import { useCallback, useEffect, useState } from 'react';
import {
  ErrorApi,
  type Idioma,
  almacenNavegador,
  enIdioma,
  montoATexto,
  textoAMonto,
  useBorrador,
} from '@tumbite/compartido';
import { api } from './api';
import { AvisoBorrador } from './AvisoBorrador';
import { InterruptoresViaje } from './InterruptoresViaje';
import { DinamicaCiudad, vecesDe } from './DinamicaCiudad';
import { Enlace } from '../Enlace';
import { Hora } from './horario';
import { PestanasViajes } from './SuperViajesFijos';
import { PreciosZona } from './PreciosZona';

const T = {
  es: {
    titulo: 'Viajes · Emergencias y tarifas',
    intro:
      'Moto existe solo en el sitio de pruebas hasta que Richard lo encienda con la aprobación legal. Las tarifas son de prueba.',
    emergencias: 'Emergencias abiertas',
    sinEmergencias: 'No hay emergencias abiertas.',
    pasajero: 'Pasajero',
    conductor: 'Conductor',
    atender: 'Marcar atendida',
    nota: 'Qué se hizo',
    viajes: 'Viajes',
    // C-MONITOREO-SERVICIOS (15 nov 2026): los viajes se vigilan en «Pedidos en curso».
    enMonitoreo:
      'Los viajes en auto, en moto y los envíos se vigilan en «Pedidos en curso», con su semáforo, su búsqueda y «Cargar más». Cada uno abre su ficha.',
    verAuto: 'Ver los viajes en auto',
    verMoto: 'Ver los viajes en moto',
    verEnvios: 'Ver los envíos',
    verFicha: 'Ver el viaje',
    tarifas: 'Tarifas activas',
    sinTarifas: 'Ninguna ciudad tiene tarifa de Moto todavía.',
    nueva: 'Nueva tarifa (cierra la anterior de esa ciudad)',
    ciudad: 'Código de la ciudad (por ejemplo US-FL-MIAMI)',
    moneda: 'Montos en la moneda de la ciudad',
    campos: {
      base: 'Banderazo',
      porKm: 'Por kilómetro',
      porMinuto: 'Por minuto',
      minimo: 'Precio mínimo',
      cargoFijo: 'Cargo fijo por viaje',
      porMinutoEspera: 'Por minuto de espera',
      cargoCancelacion: 'Cargo por cancelar tarde',
      cargoNoSePresento: 'Cargo si no se presenta',
    } as Record<string, string>,
    esperaGratis: 'Espera gratis (minutos)',
    cancelacionGratis: 'Cancelar gratis (minutos desde la asignación)',
    redondeo: 'Redondear a (unidad menor; 100 = de cien en cien)',
    servicio: 'Servicio',
    carro: 'Carro',
    envios: 'Envíos',
    valorMaximo: 'Envíos: valor máximo declarado de un paquete (vacío = 100)',
    // C-DESTINO-EN-EL-PAIS: el destino puede estar en cualquier punto del país.
    kmMaximo:
      'Distancia máxima de un viaje, en km (vacío = 1500; el destino puede estar en todo el país)',
    // C-PRECIO-ZONA: diferencia mínima para que el precio de la zona reemplace al calculado.
    umbralZona:
      'Precios de la zona: se usan si son al menos este % más baratos que el calculado (vacío = 10)',
    xl: 'Carro XL: veces el precio del carro (vacío = sin XL; 1,5 = la mitad más)',
    // C-CARRO-CATEGORIAS, C-CARRO-DINAMICA y C-VIAJE-PARADAS (14 nov 2026).
    comfort: 'Carro Comfort: veces el precio del carro (vacío = sin Comfort; 1,3 = un 30 % más)',
    premium: 'Carro Premium: veces el precio del carro (vacío = sin Premium; 1,8 = un 80 % más)',
    topeDinamico:
      'Tarifa dinámica: tope en veces el precio normal (vacío o 1 = sin tarifa dinámica; 1,5 = hasta la mitad más)',
    esperaParada: 'Espera gratis en cada parada (minutos)',
    conCategorias: 'Categorías',
    sinDinamica: 'sin tarifa dinámica',
    dinamicaHasta: 'tarifa dinámica hasta',
    motivo: 'Motivo del cambio',
    guardar: 'Guardar tarifa',
    guardada: 'Tarifa guardada. Las cotizaciones nuevas ya la usan.',
    dePrueba: 'de prueba',
  },
  en: {
    titulo: 'Rides · Emergencies and fares',
    intro:
      'Moto exists only on the test site until Richard turns it on with legal approval. Prices are test prices.',
    emergencias: 'Open emergencies',
    sinEmergencias: 'No open emergencies.',
    pasajero: 'Rider',
    conductor: 'Driver',
    atender: 'Mark as handled',
    nota: 'What was done',
    viajes: 'Rides',
    // C-MONITOREO-SERVICIOS (Nov 15, 2026): rides are monitored in “Live orders”.
    enMonitoreo:
      'Car rides, moto rides, and deliveries are monitored in “Live orders”, with their status light, search, and “Load more”. Each one opens its own page.',
    verAuto: 'See car rides',
    verMoto: 'See moto rides',
    verEnvios: 'See deliveries',
    verFicha: 'View the ride',
    tarifas: 'Active pricing',
    sinTarifas: 'No city has Moto pricing yet.',
    nueva: 'New pricing (closes the previous one for that city)',
    ciudad: 'City code (for example US-FL-MIAMI)',
    moneda: 'Amounts in the city’s currency',
    campos: {
      base: 'Base fare',
      porKm: 'Per kilometer',
      porMinuto: 'Per minute',
      minimo: 'Minimum fare',
      cargoFijo: 'Fixed fee per ride',
      porMinutoEspera: 'Per waiting minute',
      cargoCancelacion: 'Late cancellation fee',
      cargoNoSePresento: 'No-show fee',
    } as Record<string, string>,
    esperaGratis: 'Free waiting time (minutes)',
    cancelacionGratis: 'Free cancellation (minutes after assignment)',
    redondeo: 'Round to (minor unit; 100 = to the nearest hundred)',
    servicio: 'Service',
    carro: 'Car',
    envios: 'Delivery',
    valorMaximo: 'Delivery: maximum declared value of a package (empty = 100)',
    kmMaximo:
      'Maximum trip distance, in km (empty = 1500; the drop-off can be anywhere in the country)',
    umbralZona:
      'Local fixed prices: used when at least this % cheaper than the distance-based price (empty = 10)',
    xl: 'Car XL: times the car price (empty = no XL; 1.5 = half again)',
    // C-CARRO-CATEGORIAS, C-CARRO-DINAMICA and C-VIAJE-PARADAS (Nov 14, 2026).
    comfort: 'Car Comfort: times the car price (empty = no Comfort; 1.3 = 30% more)',
    premium: 'Car Premium: times the car price (empty = no Premium; 1.8 = 80% more)',
    topeDinamico:
      'Dynamic pricing: cap as a multiple of the normal price (empty or 1 = no dynamic pricing; 1.5 = up to half again)',
    esperaParada: 'Free wait at each stop (minutes)',
    conCategorias: 'Categories',
    sinDinamica: 'no dynamic pricing',
    dinamicaHasta: 'dynamic pricing up to',
    motivo: 'Reason for the change',
    guardar: 'Save pricing',
    guardada: 'Pricing saved. New quotes use it now.',
    dePrueba: 'test',
  },
};

const MONTOS = [
  'base',
  'porKm',
  'porMinuto',
  'minimo',
  'cargoFijo',
  'porMinutoEspera',
  'cargoCancelacion',
  'cargoNoSePresento',
] as const;

type Tarifa = Record<(typeof MONTOS)[number], number> & {
  id: string;
  zona: string;
  zonaNombre: string;
  moneda: string;
  esperaGratisS: number;
  cancelacionGratisS: number;
  redondeo: number;
  dePrueba: boolean;
  creadaEn: string;
  servicio?: string;
  xlPb?: number;
  comfortPb?: number;
  premiumPb?: number;
  topeDinamicoPb?: number;
};
type Datos = {
  emergencias: Record<string, unknown>[];
  viajes: Record<string, unknown>[];
  tarifas: Tarifa[];
};

/**
 * Divoox Moto · M9: lo que el superadmin vigila y configura. Emergencias abiertas (para atenderlas
 * ya), viajes recientes, y la tarifa de cada ciudad (cada cambio es una versión nueva con motivo).
 */
export function SuperViajes({ base, idioma }: { base: string; idioma: Idioma }) {
  const t = enIdioma(T, idioma);
  const campos = new Map(Object.entries(t.campos));
  const [datos, setDatos] = useState<Datos | null>(null);
  const [falla, setFalla] = useState('');
  const [aviso, setAviso] = useState('');
  const [notas, setNotas] = useState<Map<string, string>>(() => new Map());
  const b = useBorrador({
    formulario: 'tarifa-moto',
    inicial: {
      servicio: 'moto',
      zona: '',
      moneda: 'USD',
      base: '',
      porKm: '',
      porMinuto: '',
      minimo: '',
      cargoFijo: '0',
      porMinutoEspera: '0',
      cargoCancelacion: '0',
      cargoNoSePresento: '0',
      esperaGratis: '5',
      cancelacionGratis: '2',
      redondeo: '1',
      xl: '',
      comfort: '',
      premium: '',
      topeDinamico: '',
      esperaParada: '2',
      valorMaximo: '',
      kmMaximo: '',
      umbralZona: '',
      motivo: '',
    },
    almacen: almacenNavegador,
  });

  const cargar = useCallback(() => {
    // Solo emergencias y tarifas: la lista de viajes vive en «Pedidos en curso».
    api
      .pedir<Datos>('GET', '/datos/admin/viajes?lista=0')
      .then(setDatos)
      .catch((x: unknown) => setFalla(x instanceof ErrorApi ? x.message : String(x)));
  }, []);
  useEffect(() => {
    cargar();
    const r = setInterval(cargar, 15_000);
    return () => clearInterval(r);
  }, [cargar]);

  async function atender(id: string) {
    setFalla('');
    try {
      await api.pedir('POST', `/datos/admin/viajes/emergencias/${id}/atender`, {
        nota: notas.get(id) ?? '',
      });
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setFalla('');
    setAviso('');
    const v = b.valores;
    const m = v.moneda.trim().toUpperCase() || 'USD';
    const escritos = new Map(Object.entries(v));
    const tarifa: Record<string, number> = Object.fromEntries(
      MONTOS.map((k) => [k, textoAMonto(escritos.get(k) || '0', m)]),
    );
    tarifa.esperaGratisS = Math.round(Number(v.esperaGratis) * 60);
    tarifa.cancelacionGratisS = Math.round(Number(v.cancelacionGratis) * 60);
    tarifa.redondeo = Math.max(1, Math.round(Number(v.redondeo) || 1));
    // C-CARRO-XL: el factor del carro grande (solo Carro); vacío = la ciudad no ofrece XL.
    const xl = Number(v.xl.replace(',', '.'));
    if (xl >= 1) tarifa.xlPb = Math.round(xl * 10_000);
    // C-CARRO-CATEGORIAS: los factores de Comfort y Premium (solo Carro); vacío = no se ofrece.
    const veces = (texto: string) => Number(texto.replace(',', '.'));
    if (v.servicio === 'carro' && veces(v.comfort) >= 1)
      tarifa.comfortPb = Math.round(veces(v.comfort) * 10_000);
    if (v.servicio === 'carro' && veces(v.premium) >= 1)
      tarifa.premiumPb = Math.round(veces(v.premium) * 10_000);
    // C-CARRO-DINAMICA: el tope de la tarifa dinámica de la ciudad (1 = apagada).
    if (veces(v.topeDinamico) > 1)
      tarifa.topeDinamicoPb = Math.round(veces(v.topeDinamico) * 10_000);
    // C-VIAJE-PARADAS: espera gratis en cada parada.
    if (v.esperaParada.trim())
      tarifa.esperaParadaGratisS = Math.max(0, Math.round(veces(v.esperaParada) * 60));
    // C-ENVIOS: tope del valor declarado de un paquete en esta ciudad.
    if (v.valorMaximo.trim()) tarifa.valorMaximo = textoAMonto(v.valorMaximo, m);
    // C-DESTINO-EN-EL-PAIS: tope de seguridad de km de esta ciudad y servicio (vacío = el alto).
    if (Math.round(veces(v.kmMaximo)) >= 5) tarifa.kmMaximo = Math.round(veces(v.kmMaximo));
    // C-PRECIO-ZONA: el umbral de los precios de la zona, en por ciento (vacío = 10 %).
    if (v.umbralZona.trim() && veces(v.umbralZona) >= 0 && veces(v.umbralZona) <= 90)
      tarifa.umbralPrecioZonaPb = Math.round(veces(v.umbralZona) * 100);
    try {
      await api.pedir('POST', '/datos/admin/viajes/tarifas', {
        servicio: v.servicio === 'carro' || v.servicio === 'envios' ? v.servicio : 'moto',
        zona: v.zona.trim().toUpperCase(),
        tarifa,
        dePrueba: true,
        motivo: v.motivo,
      });
      await b.limpiar();
      setAviso(t.guardada);
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  return (
    <section className="super">
      <h1>{t.titulo}</h1>
      <PestanasViajes base={base} idioma={idioma} activa="viajes" />
      <p>{t.intro}</p>
      {falla && (
        <p className="error-general" role="alert">
          {falla}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}

      <h2>{t.emergencias}</h2>
      {!datos?.emergencias.length ? (
        <p>{t.sinEmergencias}</p>
      ) : (
        <ul className="tarjetas">
          {datos.emergencias.map((e) => {
            const id = String(e.id);
            return (
              <li key={id}>
                <strong>{e.rol === 'pasajero' ? t.pasajero : t.conductor}</strong>:{' '}
                {String(e.nombre)} · {String(e.correo)}{' '}
                {e.telefono ? `· ${String(e.telefono)}` : ''} ·{' '}
                <Hora fecha={String(e.creado_en)} idioma={idioma} /> ·{' '}
                <Enlace a={`${base}/rides/${String(e.operacion_id)}`}>{t.verFicha}</Enlace>
                {e.lat != null ? (
                  <>
                    {' '}
                    ·{' '}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${String(e.lat)},${String(e.lng)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Mapa
                    </a>
                  </>
                ) : null}
                <label className="campo">
                  <span>{t.nota}</span>
                  <input
                    value={notas.get(id) ?? ''}
                    onChange={(x) => setNotas((n) => new Map(n).set(id, x.target.value))}
                  />
                </label>
                <button type="button" className="boton" onClick={() => void atender(id)}>
                  {t.atender}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <h2>{t.viajes}</h2>
      <section className="tarjeta-form">
        <p>{t.enMonitoreo}</p>
        <p className="super-acciones">
          <Enlace a={`${base}/orders?servicio=auto`} className="boton secundario">
            {t.verAuto}
          </Enlace>{' '}
          <Enlace a={`${base}/orders?servicio=moto`} className="boton secundario">
            {t.verMoto}
          </Enlace>{' '}
          <Enlace a={`${base}/orders?servicio=envios`} className="boton secundario">
            {t.verEnvios}
          </Enlace>
        </p>
      </section>

      <h2>{t.tarifas}</h2>
      {!datos?.tarifas.length ? (
        <p>{t.sinTarifas}</p>
      ) : (
        <ul className="tarjetas">
          {datos.tarifas.map((x) => (
            <li key={x.id}>
              <strong>{x.zonaNombre}</strong> ({x.zona}){x.dePrueba ? ` · ${t.dePrueba}` : ''}:{' '}
              {MONTOS.map(
                (k) =>
                  `${campos.get(k) ?? k} ${montoATexto(Number(new Map(Object.entries(x)).get(k) ?? 0), x.moneda)}`,
              ).join(' · ')}
              {x.servicio === 'carro' ? (
                <>
                  {' · '}
                  {t.conCategorias}:{' '}
                  {[
                    t.carro,
                    x.comfortPb ? `Comfort × ${vecesDe(x.comfortPb, idioma)}` : '',
                    x.premiumPb ? `Premium × ${vecesDe(x.premiumPb, idioma)}` : '',
                    x.xlPb ? `XL × ${vecesDe(x.xlPb, idioma)}` : '',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  {' · '}
                  {(x.topeDinamicoPb ?? 10_000) > 10_000
                    ? `${t.dinamicaHasta} × ${vecesDe(x.topeDinamicoPb ?? 10_000, idioma)}`
                    : t.sinDinamica}
                </>
              ) : null}
              {x.servicio === 'carro' && (x.topeDinamicoPb ?? 10_000) > 10_000 ? (
                <DinamicaCiudad zona={x.zona} idioma={idioma} />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form className="flex-form" onSubmit={(e) => void guardar(e)} noValidate>
        <h3>{t.nueva}</h3>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.servicio}</span>
          <select
            value={b.valores.servicio}
            onChange={(e) => b.cambiar('servicio', e.target.value)}
          >
            <option value="moto">Moto</option>
            <option value="carro">{t.carro}</option>
            <option value="envios">{t.envios}</option>
          </select>
        </label>
        <label className="campo">
          <span>{t.ciudad}</span>
          <input value={b.valores.zona} onChange={(e) => b.cambiar('zona', e.target.value)} />
        </label>
        <label className="campo">
          <span>{t.moneda}</span>
          <input value={b.valores.moneda} onChange={(e) => b.cambiar('moneda', e.target.value)} />
        </label>
        {MONTOS.map((k) => (
          <label className="campo" key={k}>
            <span>{campos.get(k) ?? k}</span>
            <input
              inputMode="decimal"
              value={new Map(Object.entries(b.valores)).get(k) ?? ''}
              onChange={(e) => b.cambiar(k, e.target.value)}
            />
          </label>
        ))}
        <label className="campo">
          <span>{t.esperaGratis}</span>
          <input
            inputMode="decimal"
            value={b.valores.esperaGratis}
            onChange={(e) => b.cambiar('esperaGratis', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.cancelacionGratis}</span>
          <input
            inputMode="decimal"
            value={b.valores.cancelacionGratis}
            onChange={(e) => b.cambiar('cancelacionGratis', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.redondeo}</span>
          <input
            inputMode="numeric"
            value={b.valores.redondeo}
            onChange={(e) => b.cambiar('redondeo', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.xl}</span>
          <input
            inputMode="decimal"
            value={b.valores.xl}
            onChange={(e) => b.cambiar('xl', e.target.value)}
          />
        </label>
        {b.valores.servicio === 'carro' ? (
          <>
            <label className="campo">
              <span>{t.comfort}</span>
              <input
                inputMode="decimal"
                value={b.valores.comfort}
                onChange={(e) => b.cambiar('comfort', e.target.value)}
              />
            </label>
            <label className="campo">
              <span>{t.premium}</span>
              <input
                inputMode="decimal"
                value={b.valores.premium}
                onChange={(e) => b.cambiar('premium', e.target.value)}
              />
            </label>
            <label className="campo">
              <span>{t.topeDinamico}</span>
              <input
                inputMode="decimal"
                value={b.valores.topeDinamico}
                onChange={(e) => b.cambiar('topeDinamico', e.target.value)}
              />
            </label>
          </>
        ) : null}
        {b.valores.servicio !== 'envios' ? (
          <label className="campo">
            <span>{t.esperaParada}</span>
            <input
              inputMode="decimal"
              value={b.valores.esperaParada}
              onChange={(e) => b.cambiar('esperaParada', e.target.value)}
            />
          </label>
        ) : null}
        <label className="campo">
          <span>{t.valorMaximo}</span>
          <input
            inputMode="decimal"
            value={b.valores.valorMaximo}
            onChange={(e) => b.cambiar('valorMaximo', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.kmMaximo}</span>
          <input
            inputMode="numeric"
            data-testid="tarifa-km-maximo"
            value={b.valores.kmMaximo}
            onChange={(e) => b.cambiar('kmMaximo', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.umbralZona}</span>
          <input
            inputMode="decimal"
            data-testid="tarifa-umbral-zona"
            value={b.valores.umbralZona}
            onChange={(e) => b.cambiar('umbralZona', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.motivo}</span>
          <input value={b.valores.motivo} onChange={(e) => b.cambiar('motivo', e.target.value)} />
        </label>
        <button type="submit" className="boton">
          {t.guardar}
        </button>
      </form>
      <PreciosZona
        idioma={idioma}
        monedaDe={(zona) => datos?.tarifas.find((x) => x.zona === zona)?.moneda ?? 'USD'}
      />
      <InterruptoresViaje idioma={idioma} />
    </section>
  );
}
