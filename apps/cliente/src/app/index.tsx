import { PantallaCarga, SesionSinConfirmar, useSesion } from '@tumbite/movil';
import { Inicio } from '../Inicio';

export default function Entrada() {
  const { cargando, usuario, sinConfirmar } = useSesion();
  // C-ARRANQUE-CON-MARCA: la pantalla de carga con la marca de la app mientras se lee la sesión.
  if (cargando) return <PantallaCarga />;
  // C-SESION-CON-LIMITE: con una sesión guardada que no se pudo confirmar, se reintenta (no se
  // muestra como invitado a quien sí tiene cuenta). Sin sesión, se mira sin cuenta (C-MIRAR-SIN-CUENTA).
  if (!usuario && sinConfirmar) return <SesionSinConfirmar />;
  return <Inicio />;
}
