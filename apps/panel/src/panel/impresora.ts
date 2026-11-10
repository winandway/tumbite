import { useCallback, useEffect, useState } from 'react';

/**
 * C-IMPRESORA-NAVEGADOR (8 nov 2026): conectar la impresora térmica de tickets desde el navegador
 * (Chrome y Edge en computadora), como la impresora de la tableta de DoorDash y Uber Eats: el
 * ticket ESC/POS va directo, sin el cuadro de impresión. Dos caminos:
 * - WebUSB: la impresora enchufada por USB.
 * - Web Serial: la del puerto serie o la de Bluetooth emparejada como puerto serie.
 * El navegador recuerda la impresora autorizada: al volver a abrir el panel se reconecta sola
 * (`getDevices` / `getPorts`). Si no hay soporte, no se conecta o falla, la comanda sale por la
 * impresión normal del navegador con el ancho elegido.
 */

export type TipoImpresora = 'usb' | 'serie';
export type ConexionImpresora = {
  tipo: TipoImpresora;
  nombre: string;
  enviar: (bytes: Uint8Array) => Promise<void>;
  cerrar: () => Promise<void>;
};

// Lo mínimo de WebUSB y Web Serial que usamos (TypeScript no los trae en la librería DOM).
type PuntoUsb = { direction: 'in' | 'out'; type: string; endpointNumber: number };
type DispositivoUsb = {
  productName?: string;
  opened: boolean;
  configuration: {
    interfaces: { interfaceNumber: number; alternates: { endpoints: PuntoUsb[] }[] }[];
  } | null;
  open(): Promise<void>;
  selectConfiguration(n: number): Promise<void>;
  claimInterface(n: number): Promise<void>;
  close(): Promise<void>;
  transferOut(punto: number, datos: Uint8Array): Promise<unknown>;
};
type Usb = {
  requestDevice(o: { filters: unknown[] }): Promise<DispositivoUsb>;
  getDevices(): Promise<DispositivoUsb[]>;
};
type PuertoSerie = {
  readable: unknown;
  writable: { getWriter(): { write(b: Uint8Array): Promise<void>; releaseLock(): void } } | null;
  open(o: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
};
type Serie = { requestPort(): Promise<PuertoSerie>; getPorts(): Promise<PuertoSerie[]> };

const nav = () =>
  (typeof navigator === 'undefined' ? {} : navigator) as { usb?: Usb; serial?: Serie };

export function soporteImpresora(): { usb: boolean; serie: boolean } {
  const n = nav();
  return { usb: Boolean(n.usb), serie: Boolean(n.serial) };
}

const LLAVE_TIPO = 'divoox.impresora.tipo';
const guardarTipo = (t: TipoImpresora | null) => {
  try {
    if (t) localStorage.setItem(LLAVE_TIPO, t);
    else localStorage.removeItem(LLAVE_TIPO);
  } catch {
    /* sin almacén: se reconecta a mano */
  }
};
const leerTipo = (): TipoImpresora | null => {
  try {
    const v = localStorage.getItem(LLAVE_TIPO);
    return v === 'usb' || v === 'serie' ? v : null;
  } catch {
    return null;
  }
};

async function abrirUsb(d: DispositivoUsb): Promise<ConexionImpresora> {
  if (!d.opened) await d.open();
  if (d.configuration === null) await d.selectConfiguration(1);
  let iface: number | null = null;
  let punto: number | null = null;
  for (const i of d.configuration?.interfaces ?? []) {
    for (const a of i.alternates) {
      const e = a.endpoints.find((x) => x.direction === 'out' && x.type === 'bulk');
      if (e && punto === null) {
        iface = i.interfaceNumber;
        punto = e.endpointNumber;
      }
    }
  }
  if (iface === null || punto === null) throw new Error('sin-salida-usb');
  await d.claimInterface(iface);
  const salida = punto;
  return {
    tipo: 'usb',
    nombre: d.productName || 'USB',
    enviar: async (b) => {
      // De a 4 KB: algunas impresoras baratas no aguantan un envío grande de una vez.
      // Cada envío se comprueba y lleva tiempo límite: si la impresora no responde o rechaza el
      // envío, falla aquí y la comanda cae a la impresión del navegador (nunca se pierde).
      for (let i = 0; i < b.length; i += 4096) {
        const r = await conLimite(d.transferOut(salida, b.slice(i, i + 4096)));
        if (r && typeof r === 'object' && 'status' in r && r.status !== 'ok')
          throw new Error('envio-usb-rechazado');
      }
    },
    cerrar: () => d.close(),
  };
}

/** Tiempo límite de un envío a la impresora: apagada o sin señal, no deja la comanda colgada. */
export const LIMITE_IMPRESORA_MS = 8_000;
export function conLimite<T>(envio: Promise<T>, ms = LIMITE_IMPRESORA_MS): Promise<T> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, falla) => {
    reloj = setTimeout(() => falla(new Error('impresora-sin-respuesta')), ms);
  });
  return Promise.race([envio, limite]).finally(() => clearTimeout(reloj));
}

async function abrirSerie(p: PuertoSerie): Promise<ConexionImpresora> {
  // 9600 baudios: el de fábrica de casi todas las impresoras de tickets por puerto serie.
  if (!p.writable) await p.open({ baudRate: 9600 });
  return {
    tipo: 'serie',
    nombre: 'Serie / Bluetooth',
    enviar: async (b) => {
      if (!p.writable) throw new Error('puerto-cerrado');
      const w = p.writable.getWriter();
      try {
        await conLimite(w.write(b));
      } finally {
        w.releaseLock();
      }
    },
    cerrar: () => p.close(),
  };
}

// Una sola conexión para toda la página (la pantalla Pedidos puede montarse varias veces).
let actual: ConexionImpresora | null = null;
const oyentes = new Set<(c: ConexionImpresora | null) => void>();
function fijar(c: ConexionImpresora | null) {
  actual = c;
  oyentes.forEach((f) => f(c));
}
export const impresoraActual = () => actual;

/** Pide al navegador elegir la impresora (abre su ventana de permisos). */
export async function conectarImpresora(tipo: TipoImpresora): Promise<ConexionImpresora> {
  const n = nav();
  let c: ConexionImpresora;
  if (tipo === 'usb') {
    if (!n.usb) throw new Error('sin-soporte');
    // Sin filtros: muchas impresoras de tickets se presentan con clase de fabricante, no «impresora».
    c = await abrirUsb(await n.usb.requestDevice({ filters: [] }));
  } else {
    if (!n.serial) throw new Error('sin-soporte');
    c = await abrirSerie(await n.serial.requestPort());
  }
  guardarTipo(tipo);
  fijar(c);
  return c;
}

/** Al volver al panel: la impresora ya autorizada se conecta sola, sin preguntar. */
export async function reconectarImpresora(): Promise<ConexionImpresora | null> {
  if (actual) return actual;
  const tipo = leerTipo();
  if (!tipo) return null;
  const n = nav();
  try {
    if (tipo === 'usb' && n.usb) {
      const [d] = await n.usb.getDevices();
      if (d) fijar(await abrirUsb(d));
    } else if (tipo === 'serie' && n.serial) {
      const [p] = await n.serial.getPorts();
      if (p) fijar(await abrirSerie(p));
    }
  } catch (e) {
    console.warn('impresora: no se pudo reconectar', e);
  }
  return actual;
}

export async function desconectarImpresora() {
  const c = actual;
  fijar(null);
  guardarTipo(null);
  await c?.cerrar().catch((e: unknown) => console.warn('impresora: no se pudo cerrar', e));
}

/** Para las pruebas: olvida la conexión de la página sin tocar el navegador. */
export function olvidarImpresora() {
  actual = null;
  oyentes.forEach((f) => f(null));
}

/** La impresora conectada (o null), con conectar y desconectar, para la pantalla Pedidos. */
export function useImpresora() {
  const [conexion, setConexion] = useState<ConexionImpresora | null>(actual);
  useEffect(() => {
    oyentes.add(setConexion);
    void reconectarImpresora();
    return () => {
      oyentes.delete(setConexion);
    };
  }, []);
  const conectar = useCallback((t: TipoImpresora) => conectarImpresora(t), []);
  return { conexion, conectar, desconectar: desconectarImpresora, soporte: soporteImpresora() };
}
