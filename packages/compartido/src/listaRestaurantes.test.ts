import { describe, expect, it } from 'vitest';
import { crearListaRestaurantes, type RespuestaRestaurantes } from './listaRestaurantes';

/**
 * C-CATALOGO-ESTABLE (hito 1 del cliente, docs/PLAN-CATALOGO-Y-RELOJ.md): la lista de restaurantes
 * no se borra con una respuesta vieja, no repite consultas y siempre dice en qué estado está.
 */
type Pedido = {
  punto: { lat: number; lng: number } | null;
  resolver: (r: RespuestaRestaurantes) => void;
  fallar: (e: unknown) => void;
};
function servidorManual() {
  const pedidos: Pedido[] = [];
  const pedir = (punto: Pedido['punto']) =>
    new Promise<RespuestaRestaurantes>((resolver, fallar) =>
      pedidos.push({ punto, resolver, fallar }),
    );
  return { pedidos, pedir };
}
const NOVI = { lat: 42.48, lng: -83.47 };
const rest = (id: string) => ({ id, nombre: `R ${id}` }) as never;
const conLista = (n: number, zona = 'US-MI-NOVI'): RespuestaRestaurantes => ({
  restaurantes: Array.from({ length: n }, (_, i) => rest(`r${i}`)),
  zona: { id: zona },
  fueraDeZona: false,
});
const espera = () => new Promise((r) => setTimeout(r, 0));

describe('lista de restaurantes', () => {
  it('una respuesta SIN ubicación que llega tarde no borra la lista CON ubicación', async () => {
    const s = servidorManual();
    const l = crearListaRestaurantes({ pedir: s.pedir });
    void l.cargar(null);
    void l.cargar(NOVI);
    s.pedidos[1]!.resolver(conLista(5)); // con ubicación llega primero
    await espera();
    expect(l.estado().restaurantes).toHaveLength(5);
    s.pedidos[0]!.resolver({ restaurantes: [], zona: { id: 'US-FL-MIAMI' }, fueraDeZona: false }); // la vieja, vacía
    await espera();
    expect(l.estado().restaurantes).toHaveLength(5);
    expect(l.estado().estado).toBe('lista');
    expect(l.estado().zona).toBe('US-MI-NOVI');
  });

  it('entre dos respuestas con ubicación, solo vale la de la última consulta', async () => {
    const s = servidorManual();
    const l = crearListaRestaurantes({ pedir: s.pedir });
    void l.cargar({ lat: 1, lng: 1 });
    void l.cargar(NOVI);
    s.pedidos[1]!.resolver(conLista(5));
    await espera();
    s.pedidos[0]!.resolver(conLista(1, 'OTRA'));
    await espera();
    expect(l.estado().restaurantes).toHaveLength(5);
  });

  it('el mismo punto dentro de 60 s no se vuelve a pedir, y dos cargas iguales a la vez hacen una sola consulta', async () => {
    let ahora = 0;
    const s = servidorManual();
    const l = crearListaRestaurantes({ pedir: s.pedir, ahora: () => ahora });
    void l.cargar(NOVI);
    void l.cargar(NOVI);
    expect(s.pedidos).toHaveLength(1);
    s.pedidos[0]!.resolver(conLista(5));
    await espera();
    ahora = 30_000;
    await l.cargar({ lat: 42.4801, lng: -83.4701 }); // el mismo lugar
    expect(s.pedidos).toHaveLength(1);
    ahora = 61_000;
    void l.cargar(NOVI);
    expect(s.pedidos).toHaveLength(2);
    void l.cargar(NOVI, { forzar: true });
    expect(s.pedidos).toHaveLength(2); // ya hay una igual en camino
  });

  it('dice «fuera de zona» y «zona sin restaurantes» en vez de una pantalla vacía', async () => {
    const s = servidorManual();
    const l = crearListaRestaurantes({ pedir: s.pedir });
    void l.cargar({ lat: 10, lng: -66 });
    s.pedidos[0]!.resolver({ restaurantes: [], zona: null, fueraDeZona: true });
    await espera();
    expect(l.estado().estado).toBe('fuera_de_zona');
    void l.cargar({ lat: 25.76, lng: -80.19 });
    s.pedidos[1]!.resolver({ restaurantes: [], zona: { id: 'US-FL-MIAMI' }, fueraDeZona: false });
    await espera();
    expect(l.estado()).toMatchObject({ estado: 'zona_vacia', zona: 'US-FL-MIAMI' });
  });

  it('un error de red con lista en pantalla: la lista se queda y queda marcado el error', async () => {
    const s = servidorManual();
    const l = crearListaRestaurantes({ pedir: s.pedir, ahora: () => 0 });
    void l.cargar(NOVI);
    s.pedidos[0]!.resolver(conLista(5));
    await espera();
    void l.cargar(NOVI, { forzar: true });
    s.pedidos[1]!.fallar(new Error('sin conexión'));
    await espera();
    expect(l.estado().restaurantes).toHaveLength(5);
    expect(l.estado().estado).toBe('lista');
    expect(l.estado().error).toBe('sin conexión');
  });

  it('un error sin lista todavía: estado «error», listo para reintentar', async () => {
    const s = servidorManual();
    const l = crearListaRestaurantes({ pedir: s.pedir });
    void l.cargar(NOVI);
    s.pedidos[0]!.fallar(new Error('sin conexión'));
    await espera();
    expect(l.estado()).toMatchObject({ estado: 'error', error: 'sin conexión' });
    void l.cargar(NOVI);
    s.pedidos[1]!.resolver(conLista(2));
    await espera();
    expect(l.estado()).toMatchObject({ estado: 'lista', error: null });
  });

  it('avisa a quien escucha cada cambio, y deja de avisar al darse de baja', async () => {
    const s = servidorManual();
    const l = crearListaRestaurantes({ pedir: s.pedir });
    const vistos: string[] = [];
    const baja = l.suscribir((e) => vistos.push(e.estado));
    void l.cargar(NOVI);
    s.pedidos[0]!.resolver(conLista(1));
    await espera();
    baja();
    void l.cargar(NOVI, { forzar: true });
    s.pedidos[1]!.resolver(conLista(2));
    await espera();
    expect(vistos).toEqual(['lista']); // empieza en «cargando»: el primer aviso es la lista
  });
});
