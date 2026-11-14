import { describe, expect, it } from 'vitest';
import { nombreReporte, reporteJugadoresCsv } from './reporteCiudad';

// C-CIUDAD-REPORTE (13 nov 2026, todos los países): el reporte del juego se arma en el navegador
// con lo que la pantalla ya tiene (no escribe nada en la base).
const jugadores = [
  {
    nombre: 'Mateo "el rápido", Jugador',
    gastado: 2500,
    moneda: 'USD',
    fallos: [
      {
        cuando: '2026-11-13T20:00:00Z',
        comportamiento: 'error del servidor · GET /x',
        mensaje: 'falló',
      },
    ],
    pedidos: [
      {
        id: 'p1',
        estado: 'entregado',
        total: 2500,
        moneda: 'USD',
        metodoPago: 'efectivo',
        restaurante: 'Pizza del Robot',
        platos: ['2 × Pizza'],
        creadoEn: '2026-11-13 19:50:00',
        minutos: 12,
      },
    ],
  },
];

describe('C-CIUDAD-REPORTE', () => {
  it('una fila por pedido y una por fallo, con comillas donde hace falta', () => {
    const csv = reporteJugadoresCsv(jugadores, 'es');
    const filas = csv.trim().split('\n');
    expect(filas[0]).toBe(
      'jugador,tipo,hora,restaurante,estado,platos,total,moneda,pago,minutos,detalle',
    );
    expect(filas[1]).toBe(
      '"Mateo ""el rápido"", Jugador",pedido,2026-11-13 19:50:00,Pizza del Robot,entregado,2 × Pizza,25.00,USD,Efectivo,12,',
    );
    expect(filas[2]).toContain(',fallo,2026-11-13T20:00:00Z,');
    expect(filas[2]).toContain('error del servidor · GET /x: falló');
    expect(filas).toHaveLength(3);
  });
  it('en inglés cambian los encabezados', () => {
    expect(reporteJugadoresCsv([], 'en').split('\n')[0]).toBe(
      'player,type,time,restaurant,status,items,total,currency,payment,minutes,detail',
    );
  });
  it('una celda que empieza con = no se vuelve fórmula en la hoja de cálculo', () => {
    const j = [{ ...jugadores[0]!, nombre: '=HYPERLINK("x")', fallos: [] }];
    expect(reporteJugadoresCsv(j, 'es').split('\n')[1]?.startsWith(`"'=HYPERLINK`)).toBe(true);
  });
  it('el archivo lleva la sesión en el nombre', () => {
    expect(nombreReporte('juego-abc')).toBe('ciudad-juego-abc.csv');
  });
});
