import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Dona,
  EstadoVacio,
  GraficaBarras,
  ListaActividad,
  Pastilla,
  Tabla,
  TarjetaAvance,
  TarjetaMetrica,
} from './Piezas';

/** C-PANEL-ARMAZON: las piezas del tablero. Nunca inventan datos: sin datos, estado vacío. */
describe('piezas del tablero', () => {
  it('la tarjeta de métrica muestra número, etiqueta y variación con su sentido', () => {
    render(
      <ul>
        <TarjetaMetrica
          etiqueta="Pedidos hoy"
          valor={12}
          icono="orders"
          variacion={{ texto: '+3 frente a ayer', sentido: 'sube' }}
        />
      </ul>,
    );
    expect(screen.getByText('Pedidos hoy')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('+3 frente a ayer')).toHaveClass('pd-sube');
  });

  it('una variación que baja no se pinta como éxito', () => {
    render(
      <ul>
        <TarjetaMetrica
          etiqueta="Ventas"
          valor="$10"
          icono="money"
          variacion={{ texto: '-2', sentido: 'baja' }}
        />
      </ul>,
    );
    expect(screen.getByText('-2')).toHaveClass('pd-baja');
  });

  it('la barra de avance dice su porcentaje a los lectores de pantalla y nunca pasa de 100', () => {
    render(<TarjetaAvance titulo="Primeros pasos" detalle="3 de 4" porcentaje={140} />);
    const barra = screen.getByRole('progressbar', { name: 'Primeros pasos' });
    expect(barra).toHaveAttribute('aria-valuenow', '100');
  });

  it('la dona describe cada parte y, sin datos, muestra el estado vacío en lugar de un dibujo', () => {
    const { rerender } = render(
      <Dona
        titulo="Restaurantes"
        vacio="Todavía no hay restaurantes."
        partes={[
          { etiqueta: 'Abiertos', valor: 3, tono: 'exito' },
          { etiqueta: 'Cerrados', valor: 1, tono: 'neutro' },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: /Abiertos: 3.*Cerrados: 1/ })).toBeInTheDocument();
    expect(screen.getByText('75 %')).toBeInTheDocument();
    rerender(
      <Dona
        titulo="Restaurantes"
        vacio="Todavía no hay restaurantes."
        partes={[
          { etiqueta: 'Abiertos', valor: 0, tono: 'exito' },
          { etiqueta: 'Cerrados', valor: 0, tono: 'neutro' },
        ]}
      />,
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('Todavía no hay restaurantes.')).toBeInTheDocument();
  });

  it('la gráfica de barras lee sus valores y, sin datos, muestra el estado vacío', () => {
    const { rerender } = render(
      <GraficaBarras
        titulo="Pedidos por día"
        vacio="Sin pedidos."
        datos={[
          { etiqueta: 'Lun', valor: 2 },
          { etiqueta: 'Mar', valor: 5 },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: /Lun: 2, Mar: 5/ })).toBeInTheDocument();
    rerender(<GraficaBarras titulo="Pedidos por día" vacio="Sin pedidos." datos={[]} />);
    expect(screen.getByText('Sin pedidos.')).toBeInTheDocument();
    rerender(
      <GraficaBarras
        titulo="Pedidos por día"
        vacio="Sin pedidos."
        datos={[{ etiqueta: 'Lun', valor: 0 }]}
      />,
    );
    expect(screen.getByText('Sin pedidos.')).toBeInTheDocument();
  });

  it('la lista de actividad muestra cada renglón o su estado vacío', () => {
    const { rerender } = render(
      <ListaActividad
        vacio="Nada reciente."
        items={[{ id: 'a', titulo: 'Ticket nuevo', detalle: 'Soporte', hora: '10:10' }]}
      />,
    );
    expect(screen.getByText('Ticket nuevo')).toBeInTheDocument();
    expect(screen.getByText('10:10')).toBeInTheDocument();
    rerender(<ListaActividad vacio="Nada reciente." items={[]} />);
    expect(screen.getByText('Nada reciente.')).toBeInTheDocument();
  });

  it('la pastilla de éxito es verde y la de problema, roja', () => {
    render(
      <>
        <Pastilla tono="exito">Entregado</Pastilla>
        <Pastilla tono="problema">Cancelado</Pastilla>
      </>,
    );
    expect(screen.getByText('Entregado')).toHaveClass('pd-pastilla-exito');
    expect(screen.getByText('Cancelado')).toHaveClass('pd-pastilla-problema');
  });

  it('la tabla tiene cabecera y, sin filas, su estado vacío', () => {
    const columnas = [
      { clave: 'ciudad', titulo: 'Ciudad' },
      { clave: 'estado', titulo: 'Estado' },
    ];
    const { rerender } = render(
      <Tabla
        columnas={columnas}
        filas={[{ id: '1', ciudad: 'Novi', estado: <Pastilla tono="exito">Activa</Pastilla> }]}
        vacio="Sin ciudades."
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Ciudad' })).toBeInTheDocument();
    expect(screen.getByText('Novi')).toBeInTheDocument();
    rerender(<Tabla columnas={columnas} filas={[]} vacio="Sin ciudades." />);
    expect(screen.getByText('Sin ciudades.')).toBeInTheDocument();
  });

  it('el estado vacío lleva título y texto', () => {
    render(<EstadoVacio titulo="Sin datos todavía" texto="Aparecen con el primer pedido." />);
    expect(screen.getByText('Sin datos todavía')).toBeInTheDocument();
    expect(screen.getByText('Aparecen con el primer pedido.')).toBeInTheDocument();
  });
});
