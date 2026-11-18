import { Redirect, useLocalSearchParams } from 'expo-router';
import { rutaDeServicio } from '@tumbite/compartido';

/**
 * C-SIN-PANTALLAS-INTERMEDIAS (17 nov 2026, borrador aprobado por Richard): ya no hay pantalla de
 * servicio con un botón «Abrir». Esta dirección queda solo para los enlaces viejos (avisos, la web):
 * lleva directo a la pantalla del servicio, o al inicio («Más servicios» es una hoja del inicio).
 */
export default function PantallaServicio() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ruta = rutaDeServicio(id ?? '');
  return <Redirect href={(ruta ?? '/') as never} />;
}
