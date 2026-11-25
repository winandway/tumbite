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
import { MenuTresPuntos } from './MenuTresPuntos';
import { CampoDireccion } from '../sitio/CampoDireccion';

/**
 * C-PRECIO-ZONA (24 nov 2026, Richard): «Precios de la zona» (etiquetas de ruta). Una línea por ruta:
 * zona, desde (la zona entera o un punto), hasta (con el buscador de direcciones), servicio, precio y
 * el de ida y vuelta. Agregar, editar y apagar (apagar y editar, en el menú de tres puntos). El
 * pasajero paga el menor entre este precio y el calculado, si la diferencia pasa del umbral.
 */
const T = {
  es: {
    titulo: 'Precios de la zona',
    intro:
      'Rutas con el precio fijo que se acostumbra cobrar entre dos lugares. El pasajero paga el menor entre este precio y el calculado por distancia, si es al menos un 10 % más barato (el porcentaje se cambia en la tarifa de la ciudad). Una ruta va en un sentido: la vuelta es otra línea.',
    sinRutas: 'Todavía no hay precios de la zona.',
    listaIlegible: 'No se pudo leer la lista de precios de la zona.',
    zona: 'Código de la ciudad (por ejemplo US-FL-MIAMI)',
    servicio: 'Servicio',
    carro: 'Carro',
    envios: 'Envíos',
    zonaEntera: 'Desde cualquier punto de la ciudad',
    desde: 'Desde',
    hasta: 'Hasta',
    buscar: 'Escribe la dirección o el lugar',
    nombreLugar: 'Nombre del lugar (lo ve el pasajero)',
    radio: 'Radio alrededor del punto, en km',
    precio: 'Precio de ida',
    idaVuelta: 'Precio de ida y vuelta (vacío = sin ida y vuelta)',
    agregar: 'Agregar ruta',
    guardarCambios: 'Guardar cambios',
    cancelar: 'Cancelar',
    opciones: 'Opciones de la ruta',
    editar: 'Editar',
    apagar: 'Apagar',
    encender: 'Encender',
    seguroApagar: '¿Apagar esta ruta? Las cotizaciones nuevas vuelven al precio calculado.',
    apagada: 'apagada',
    idaYVuelta: 'ida y vuelta',
    toda: 'toda la ciudad',
    faltaPunto: 'Elige el lugar de «Hasta» en la lista de direcciones.',
    faltaDesde: 'Elige el lugar de «Desde» en la lista, o marca «Desde cualquier punto».',
    faltaPrecio: 'Escribe el precio de ida.',
    guardada: 'Ruta guardada. Las cotizaciones nuevas ya la usan.',
  },
  en: {
    titulo: 'Local fixed prices',
    intro:
      'Routes with the fixed price people usually charge between two places. The rider pays the lower of this price and the distance-based price, if it is at least 10% cheaper (the percentage is set in the city’s pricing). A route goes one way: the return trip is another line.',
    sinRutas: 'No local fixed prices yet.',
    listaIlegible: 'The local fixed price list couldn’t be read.',
    zona: 'City code (for example US-FL-MIAMI)',
    servicio: 'Service',
    carro: 'Car',
    envios: 'Delivery',
    zonaEntera: 'From anywhere in the city',
    desde: 'From',
    hasta: 'To',
    buscar: 'Type the address or place',
    nombreLugar: 'Place name (the rider sees it)',
    radio: 'Radius around the point, in km',
    precio: 'One-way price',
    idaVuelta: 'Round-trip price (empty = no round trip)',
    agregar: 'Add route',
    guardarCambios: 'Save changes',
    cancelar: 'Cancel',
    opciones: 'Route options',
    editar: 'Edit',
    apagar: 'Turn off',
    encender: 'Turn on',
    seguroApagar: 'Turn off this route? New quotes go back to the distance-based price.',
    apagada: 'off',
    idaYVuelta: 'round trip',
    toda: 'the whole city',
    faltaPunto: 'Pick the “To” place from the address list.',
    faltaDesde: 'Pick the “From” place from the list, or check “From anywhere in the city”.',
    faltaPrecio: 'Type the one-way price.',
    guardada: 'Route saved. New quotes use it now.',
  },
};

type Lugar = { lat: number; lng: number; radioKm: number; nombre: string };
export type RutaPrecio = {
  id: string;
  zona: string;
  servicio: 'moto' | 'carro' | 'envios';
  moneda: string;
  desde: Lugar | null;
  hasta: Lugar;
  precio: number;
  precioIdaVuelta: number | null;
  activa: boolean;
};

const VACIO = {
  editando: '',
  zona: '',
  servicio: 'moto',
  zonaEntera: 'si',
  desdeTexto: '',
  desdeLat: '',
  desdeLng: '',
  desdeRadio: '1',
  desdeNombre: '',
  hastaTexto: '',
  hastaLat: '',
  hastaLng: '',
  hastaRadio: '1',
  hastaNombre: '',
  precio: '',
  idaVuelta: '',
};

const numero = (x: string) => Number(x.replace(',', '.'));

export function PreciosZona({
  idioma,
  monedaDe,
}: {
  idioma: Idioma;
  /** La moneda de cada ciudad (sale de sus tarifas); sin tarifa, dólares. */
  monedaDe: (zona: string) => string;
}) {
  const t = enIdioma(T, idioma);
  const [rutas, setRutas] = useState<RutaPrecio[]>([]);
  const [falla, setFalla] = useState('');
  const [aviso, setAviso] = useState('');
  const b = useBorrador({ formulario: 'precio-zona', inicial: VACIO, almacen: almacenNavegador });
  const v = b.valores;

  const cargar = useCallback(() => {
    api
      .pedir<{ rutas: RutaPrecio[] }>('GET', '/datos/admin/viajes/precios-zona')
      .then((r) => {
        // Una respuesta sin la lista nunca tumba la pantalla de Viajes: se dice y queda vacía.
        if (Array.isArray(r?.rutas)) return setRutas(r.rutas);
        setRutas([]);
        setFalla(t.listaIlegible);
      })
      .catch((x: unknown) => setFalla(x instanceof ErrorApi ? x.message : String(x)));
  }, [t.listaIlegible]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const moneda = (zona: string) => monedaDe(zona.trim().toUpperCase()) || 'USD';

  function editar(r: RutaPrecio) {
    setAviso('');
    b.cargar({
      editando: r.id,
      zona: r.zona,
      servicio: r.servicio,
      zonaEntera: r.desde ? 'no' : 'si',
      desdeTexto: r.desde?.nombre ?? '',
      desdeLat: r.desde ? String(r.desde.lat) : '',
      desdeLng: r.desde ? String(r.desde.lng) : '',
      desdeRadio: r.desde ? String(r.desde.radioKm) : '1',
      desdeNombre: r.desde?.nombre ?? '',
      hastaTexto: r.hasta.nombre,
      hastaLat: String(r.hasta.lat),
      hastaLng: String(r.hasta.lng),
      hastaRadio: String(r.hasta.radioKm),
      hastaNombre: r.hasta.nombre,
      precio: montoATexto(r.precio, r.moneda),
      idaVuelta: r.precioIdaVuelta == null ? '' : montoATexto(r.precioIdaVuelta, r.moneda),
    });
  }

  async function apagarOEncender(r: RutaPrecio) {
    setFalla('');
    try {
      if (r.activa) {
        if (!window.confirm(t.seguroApagar)) return;
        await api.pedir('POST', `/datos/admin/viajes/precios-zona/${r.id}/apagar`, {});
      } else {
        await api.pedir('PUT', `/datos/admin/viajes/precios-zona/${r.id}`, {
          zona: r.zona,
          servicio: r.servicio,
          desde: r.desde,
          hasta: r.hasta,
          precio: r.precio,
          precioIdaVuelta: r.precioIdaVuelta,
          activa: true,
        });
      }
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setFalla('');
    setAviso('');
    if (!v.hastaLat || !v.hastaLng) return setFalla(t.faltaPunto);
    if (v.zonaEntera !== 'si' && (!v.desdeLat || !v.desdeLng)) return setFalla(t.faltaDesde);
    if (!v.precio.trim()) return setFalla(t.faltaPrecio);
    const m = moneda(v.zona);
    const cuerpo = {
      zona: v.zona.trim().toUpperCase(),
      servicio: v.servicio,
      desde:
        v.zonaEntera === 'si'
          ? null
          : {
              lat: Number(v.desdeLat),
              lng: Number(v.desdeLng),
              radioKm: numero(v.desdeRadio) || 1,
              nombre: (v.desdeNombre || v.desdeTexto).trim(),
            },
      hasta: {
        lat: Number(v.hastaLat),
        lng: Number(v.hastaLng),
        radioKm: numero(v.hastaRadio) || 1,
        nombre: (v.hastaNombre || v.hastaTexto).trim(),
      },
      precio: textoAMonto(v.precio, m),
      precioIdaVuelta:
        v.servicio !== 'envios' && v.idaVuelta.trim() ? textoAMonto(v.idaVuelta, m) : null,
    };
    try {
      if (v.editando)
        await api.pedir('PUT', `/datos/admin/viajes/precios-zona/${v.editando}`, cuerpo);
      else await api.pedir('POST', '/datos/admin/viajes/precios-zona', cuerpo);
      // Solo se borra lo escrito cuando el servidor confirmó que se guardó.
      await b.limpiar();
      setAviso(t.guardada);
      cargar();
    } catch (x) {
      setFalla(x instanceof ErrorApi ? x.message : String(x));
    }
  }

  const servicio = (s: string) => (s === 'carro' ? t.carro : s === 'envios' ? t.envios : 'Moto');
  const pais = v.zona.trim().slice(0, 2).toUpperCase() || null;

  return (
    <section className="tarjeta-form" data-testid="precios-zona">
      <h2>{t.titulo}</h2>
      <p>{t.intro}</p>
      {falla && (
        <p className="error-general" role="alert">
          {falla}
        </p>
      )}
      {aviso && <p role="status">{aviso}</p>}
      {!rutas.length ? (
        <p>{t.sinRutas}</p>
      ) : (
        <ul className="tarjetas">
          {rutas.map((r) => (
            <li
              key={r.id}
              data-testid="precio-zona-linea"
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                opacity: r.activa ? 1 : 0.6,
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>
                <strong>{r.zona}</strong> · {servicio(r.servicio)} ·{' '}
                {r.desde ? r.desde.nombre : t.toda} → {r.hasta.nombre} ·{' '}
                <strong>{montoATexto(r.precio, r.moneda)}</strong> {r.moneda}
                {r.precioIdaVuelta != null
                  ? ` · ${t.idaYVuelta} ${montoATexto(r.precioIdaVuelta, r.moneda)}`
                  : ''}
                {r.activa ? '' : ` · ${t.apagada}`}
              </span>
              <MenuTresPuntos
                etiqueta={t.opciones}
                opciones={[
                  { texto: t.editar, alTocar: () => editar(r) },
                  {
                    texto: r.activa ? t.apagar : t.encender,
                    peligro: r.activa,
                    alTocar: () => void apagarOEncender(r),
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      )}

      <form className="flex-form" onSubmit={(e) => void guardar(e)} noValidate>
        <AvisoBorrador
          visible={b.recuperado}
          idioma={idioma}
          empezar={() => void b.empezarDeNuevo()}
        />
        <label className="campo">
          <span>{t.zona}</span>
          <input value={v.zona} onChange={(e) => b.cambiar('zona', e.target.value)} />
        </label>
        <label className="campo">
          <span>{t.servicio}</span>
          <select value={v.servicio} onChange={(e) => b.cambiar('servicio', e.target.value)}>
            <option value="moto">Moto</option>
            <option value="carro">{t.carro}</option>
            <option value="envios">{t.envios}</option>
          </select>
        </label>
        <label className="campo" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={v.zonaEntera === 'si'}
            onChange={(e) => b.cambiar('zonaEntera', e.target.checked ? 'si' : 'no')}
          />
          <span>{t.zonaEntera}</span>
        </label>
        {v.zonaEntera === 'si' ? null : (
          <>
            <CampoDireccion
              etiqueta={t.desde}
              placeholder={t.buscar}
              valor={v.desdeTexto}
              pais={pais}
              cambiar={(x) => b.cambiar('desdeTexto', x)}
              alElegir={(d) =>
                b.setValores((o) => ({
                  ...o,
                  desdeTexto: d.direccion,
                  desdeLat: String(d.punto.lat),
                  desdeLng: String(d.punto.lng),
                  desdeNombre: o.desdeNombre || d.direccion.split(',')[0] || d.direccion,
                }))
              }
            />
            <label className="campo">
              <span>{t.nombreLugar}</span>
              <input
                value={v.desdeNombre}
                onChange={(e) => b.cambiar('desdeNombre', e.target.value)}
              />
            </label>
            <label className="campo">
              <span>{t.radio}</span>
              <input
                inputMode="decimal"
                value={v.desdeRadio}
                onChange={(e) => b.cambiar('desdeRadio', e.target.value)}
              />
            </label>
          </>
        )}
        <CampoDireccion
          etiqueta={t.hasta}
          placeholder={t.buscar}
          valor={v.hastaTexto}
          pais={pais}
          cambiar={(x) => b.cambiar('hastaTexto', x)}
          alElegir={(d) =>
            b.setValores((o) => ({
              ...o,
              hastaTexto: d.direccion,
              hastaLat: String(d.punto.lat),
              hastaLng: String(d.punto.lng),
              hastaNombre: o.hastaNombre || d.direccion.split(',')[0] || d.direccion,
            }))
          }
        />
        <label className="campo">
          <span>{t.nombreLugar}</span>
          <input value={v.hastaNombre} onChange={(e) => b.cambiar('hastaNombre', e.target.value)} />
        </label>
        <label className="campo">
          <span>{t.radio}</span>
          <input
            inputMode="decimal"
            value={v.hastaRadio}
            onChange={(e) => b.cambiar('hastaRadio', e.target.value)}
          />
        </label>
        <label className="campo">
          <span>
            {t.precio} ({moneda(v.zona)})
          </span>
          <input
            inputMode="decimal"
            data-testid="precio-zona-precio"
            value={v.precio}
            onChange={(e) => b.cambiar('precio', e.target.value)}
          />
        </label>
        {v.servicio === 'envios' ? null : (
          <label className="campo">
            <span>{t.idaVuelta}</span>
            <input
              inputMode="decimal"
              value={v.idaVuelta}
              onChange={(e) => b.cambiar('idaVuelta', e.target.value)}
            />
          </label>
        )}
        <button type="submit" className="boton">
          {v.editando ? t.guardarCambios : t.agregar}
        </button>
        {v.editando ? (
          <button
            type="button"
            className="boton secundario"
            onClick={() => {
              void b.limpiar();
            }}
          >
            {t.cancelar}
          </button>
        ) : null}
      </form>
    </section>
  );
}
