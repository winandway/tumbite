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
import { RegresoAjustes } from './RegresoAjustes';
import { DinamicaCiudad, vecesDe } from './DinamicaCiudad';
import { Enlace } from '../Enlace';
import { Hora } from './horario';
import { PestanasViajes } from './SuperViajesFijos';
import { PreciosZona } from './PreciosZona';
import { LugaresPropios } from './LugaresPropios';
import { MedicionesLugares } from './MedicionesLugares';

const T = {
  es: {
    titulo: 'Viajes · Emergencias y tarifas',
    intro:
      'Aquí llegan las emergencias de los viajes de Moto, Carro y Envíos, y se ven las tarifas de cada ciudad.',
    emergencias: 'Emergencias abiertas',
    sinEmergencias: 'No hay emergencias abiertas.',
    sinResponsable: 'Zonas activas sin responsable de pánico con teléfono',
    sinResponsableAyuda:
      'El pánico de estas zonas llega al equipo central (aviso y SMS). Asigna el responsable y su celular en Zonas.',
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
      'Precios de la zona: se usan si son al menos este % más baratos que el calculado (vacío = 10; 0 = siempre que no sean más caros)',
    // C-RECARGO-NOCHE (25 nov 2026): lo que sube el viaje de noche, en la hora de la ciudad.
    recargoNoche:
      'Tarifa nocturna: cuánto sube el viaje de noche, en % (vacío = no sube; 30 = un 30 % más). Se suma al precio que gane, el de la zona o el calculado',
    nocheDesde: 'La noche empieza a esta hora, de 0 a 23 (vacío = 21, las 9 de la noche)',
    nocheHasta: 'La noche termina a esta hora, de 0 a 23 (vacío = 6, las 6 de la mañana)',
    nocheLista: (pct: string, desde: number, hasta: number) =>
      `de noche +${pct} % (${desde}:00 a ${hasta}:00)`,
    umbralLista: (pct: string) => `precios de la zona si son ${pct} % más baratos`,
    // C-TARIFA-PRECARGADA (25 nov 2026): el formulario nace con lo guardado y dice el error en palabras.
    cambiarEsta: 'Cambiar esta tarifa',
    precargada: 'Cargamos la tarifa guardada de esa ciudad: cambia solo lo que haga falta.',
    malUmbral: 'El porcentaje de los precios de la zona va de 0 a 90.',
    malRecargo: 'La tarifa nocturna va de 0 a 100 %.',
    malHora: 'Las horas de la noche van de 0 a 23, sin decimales.',
    malKm: 'La distancia máxima va desde 5 km (o déjala vacía).',
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
      'Emergencies from Moto, Car and Delivery rides arrive here, along with the fares for each city.',
    emergencias: 'Open emergencies',
    sinResponsable: 'Active zones with no panic contact phone',
    sinResponsableAyuda:
      'Panic alerts from these zones go to the central team (notification and SMS). Set the contact and their phone in Zones.',
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
      'Local fixed prices: used when at least this % cheaper than the distance-based price (empty = 10; 0 = whenever they are not more expensive)',
    recargoNoche:
      'Night fare: how much a ride goes up at night, in % (empty = no change; 30 = 30% more). It is added to the winning price, local or distance-based',
    nocheDesde: 'Night starts at this hour, 0 to 23 (empty = 21, 9 pm)',
    nocheHasta: 'Night ends at this hour, 0 to 23 (empty = 6, 6 am)',
    nocheLista: (pct: string, desde: number, hasta: number) =>
      `at night +${pct}% (${desde}:00 to ${hasta}:00)`,
    umbralLista: (pct: string) => `local fixed prices when ${pct}% cheaper`,
    cambiarEsta: 'Change this pricing',
    precargada: 'We loaded the saved pricing for that city: change only what you need.',
    malUmbral: 'The local fixed price percentage goes from 0 to 90.',
    malRecargo: 'The night fare goes from 0 to 100%.',
    malHora: 'Night hours go from 0 to 23, whole numbers only.',
    malKm: 'The maximum distance starts at 5 km (or leave it empty).',
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
  umbralPrecioZonaPb?: number;
  recargoNochePb?: number;
  nocheDesdeH?: number;
  nocheHastaH?: number;
  esperaParadaGratisS?: number;
  valorMaximo?: number;
  kmMaximo?: number;
};

/** C-TARIFA-PRECARGADA: los valores guardados de una tarifa, como se escriben en el formulario. */
export function valoresDeTarifa(x: Tarifa): Record<string, string> {
  const montos = Object.fromEntries(
    MONTOS.map((k) => [k, montoATexto(Number(new Map(Object.entries(x)).get(k) ?? 0), x.moneda)]),
  );
  const factor = (pb?: number) => (pb ? String(pb / 10_000) : '');
  return {
    ...montos,
    servicio: x.servicio ?? 'moto',
    zona: x.zona,
    moneda: x.moneda,
    esperaGratis: String(x.esperaGratisS / 60),
    cancelacionGratis: String(x.cancelacionGratisS / 60),
    redondeo: String(x.redondeo),
    xl: factor(x.xlPb),
    comfort: factor(x.comfortPb),
    premium: factor(x.premiumPb),
    topeDinamico: (x.topeDinamicoPb ?? 10_000) > 10_000 ? factor(x.topeDinamicoPb) : '',
    esperaParada: String((x.esperaParadaGratisS ?? 120) / 60),
    valorMaximo: x.valorMaximo != null ? montoATexto(x.valorMaximo, x.moneda) : '',
    kmMaximo: x.kmMaximo != null ? String(x.kmMaximo) : '',
    umbralZona: x.umbralPrecioZonaPb != null ? String(x.umbralPrecioZonaPb / 100) : '',
    recargoNoche: x.recargoNochePb ? String(x.recargoNochePb / 100) : '',
    nocheDesde: x.nocheDesdeH != null ? String(x.nocheDesdeH) : '',
    nocheHasta: x.nocheHastaH != null ? String(x.nocheHastaH) : '',
    motivo: '',
  };
}

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
  // C-PANICO-ZONA-A-LA-VISTA: las zonas cuyo pánico cae al equipo central, por su nombre.
  const [sinResponsable, setSinResponsable] = useState<{ id: string; nombre: string }[]>([]);
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
      recargoNoche: '',
      nocheDesde: '',
      nocheHasta: '',
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
    api
      .pedir<{ zonasSinResponsable?: { id: string; nombre: string }[] }>(
        'GET',
        '/datos/admin/panico/sin-atender',
      )
      .then((r) => setSinResponsable(r.zonasSinResponsable ?? []))
      .catch((x: unknown) => console.error('viajes: zonas sin responsable de pánico', x));
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

  /** C-TARIFA-PRECARGADA: la tarifa activa guardada de esa ciudad y servicio. */
  const guardadaDe = (zona: string, servicio: string) =>
    datos?.tarifas.find(
      (x) => x.zona === zona.trim().toUpperCase() && (x.servicio ?? 'moto') === servicio,
    );
  /** Al elegir ciudad o servicio con el formulario sin montos, nace con lo guardado. */
  function cambiarCiudadOServicio(campo: 'zona' | 'servicio', valor: string) {
    const v = { ...b.valores, [campo]: valor };
    const x = guardadaDe(v.zona, v.servicio);
    if (x && !v.base.trim() && !v.porKm.trim() && !v.minimo.trim()) {
      b.cargar({ ...valoresDeTarifa(x), zona: v.zona, motivo: v.motivo } as typeof b.valores);
      setAviso(t.precargada);
      return;
    }
    b.cambiar(campo, valor);
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
    if (v.kmMaximo.trim() && veces(v.kmMaximo) >= 5)
      tarifa.kmMaximo = Math.round(veces(v.kmMaximo));
    // C-TARIFA-PRECARGADA: lo escrito fuera de rango se dice en palabras; nunca se omite en silencio
    // (omitirlo borraba el recargo o el umbral guardados).
    const escrito = (x: string) => x.trim() !== '';
    const enRango = (x: string, min: number, max: number) =>
      Number.isFinite(veces(x)) && veces(x) >= min && veces(x) <= max;
    if (escrito(v.umbralZona) && !enRango(v.umbralZona, 0, 90)) return setFalla(t.malUmbral);
    if (escrito(v.recargoNoche) && !enRango(v.recargoNoche, 0, 100)) return setFalla(t.malRecargo);
    for (const h of [v.nocheDesde, v.nocheHasta])
      if (escrito(h) && !(enRango(h, 0, 23) && Number.isInteger(veces(h))))
        return setFalla(t.malHora);
    if (
      escrito(v.kmMaximo) &&
      !(enRango(v.kmMaximo, 5, 5000) && Number.isInteger(veces(v.kmMaximo)))
    )
      return setFalla(t.malKm);
    // C-PRECIO-ZONA: el umbral de los precios de la zona, en por ciento (vacío = 10 %).
    if (escrito(v.umbralZona)) tarifa.umbralPrecioZonaPb = Math.round(veces(v.umbralZona) * 100);
    // C-RECARGO-NOCHE: la tarifa nocturna en por ciento (vacío o 0 = sin recargo) y sus horas.
    if (escrito(v.recargoNoche) && veces(v.recargoNoche) > 0)
      tarifa.recargoNochePb = Math.round(veces(v.recargoNoche) * 100);
    if (escrito(v.nocheDesde)) tarifa.nocheDesdeH = veces(v.nocheDesde);
    if (escrito(v.nocheHasta)) tarifa.nocheHastaH = veces(v.nocheHasta);
    try {
      await api.pedir('POST', '/datos/admin/viajes/tarifas', {
        servicio: v.servicio === 'carro' || v.servicio === 'envios' ? v.servicio : 'moto',
        zona: v.zona.trim().toUpperCase(),
        tarifa,
        // Se queda como estaba la tarifa guardada de esa ciudad (una nueva nace de prueba).
        dePrueba: guardadaDe(v.zona, v.servicio)?.dePrueba ?? true,
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

      {sinResponsable.length ? (
        <div className="tarjeta-alerta" role="alert" data-testid="zonas-sin-responsable-panico">
          <strong>{t.sinResponsable}</strong>
          <ul>
            {sinResponsable.map((z) => (
              <li key={z.id}>{z.nombre}</li>
            ))}
          </ul>
          <p>{t.sinResponsableAyuda}</p>
        </div>
      ) : null}

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
              {x.umbralPrecioZonaPb != null
                ? ` · ${t.umbralLista(String(x.umbralPrecioZonaPb / 100))}`
                : ''}
              {x.recargoNochePb
                ? ` · ${t.nocheLista(String(x.recargoNochePb / 100), x.nocheDesdeH ?? 21, x.nocheHastaH ?? 6)}`
                : ''}
              {x.servicio === 'carro' && (x.topeDinamicoPb ?? 10_000) > 10_000 ? (
                <DinamicaCiudad zona={x.zona} idioma={idioma} />
              ) : null}{' '}
              <button
                type="button"
                className="boton secundario"
                data-testid="tarifa-cambiar-esta"
                onClick={() => {
                  b.cargar(valoresDeTarifa(x) as typeof b.valores);
                  setAviso(t.precargada);
                }}
              >
                {t.cambiarEsta}
              </button>
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
            onChange={(e) => cambiarCiudadOServicio('servicio', e.target.value)}
          >
            <option value="moto">Moto</option>
            <option value="carro">{t.carro}</option>
            <option value="envios">{t.envios}</option>
          </select>
        </label>
        <label className="campo">
          <span>{t.ciudad}</span>
          <input
            value={b.valores.zona}
            onChange={(e) => cambiarCiudadOServicio('zona', e.target.value)}
          />
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
          <span>{t.recargoNoche}</span>
          <input
            inputMode="decimal"
            data-testid="tarifa-recargo-noche"
            value={b.valores.recargoNoche}
            onChange={(e) => b.cambiar('recargoNoche', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.nocheDesde}</span>
          <input
            inputMode="numeric"
            data-testid="tarifa-noche-desde"
            value={b.valores.nocheDesde}
            onChange={(e) => b.cambiar('nocheDesde', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>{t.nocheHasta}</span>
          <input
            inputMode="numeric"
            data-testid="tarifa-noche-hasta"
            value={b.valores.nocheHasta}
            onChange={(e) => b.cambiar('nocheHasta', e.target.value)}
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
      <LugaresPropios
        idioma={idioma}
        zonas={[
          ...new Map(
            (datos?.tarifas ?? []).map((x) => [x.zona, { id: x.zona, nombre: x.zonaNombre }]),
          ).values(),
        ]}
      />
      {/* C-ESTOY-AQUI: medir los lugares propios en la calle con Driver y aprobar cada medición. */}
      <MedicionesLugares
        idioma={idioma}
        zonas={[
          ...new Map(
            (datos?.tarifas ?? []).map((x) => [x.zona, { id: x.zona, nombre: x.zonaNombre }]),
          ).values(),
        ]}
      />
      <InterruptoresViaje idioma={idioma} />
      {/* C-REGRESO-PASAJERO: los números del regreso a la ciudad base, por país. */}
      <RegresoAjustes idioma={idioma} />
    </section>
  );
}
