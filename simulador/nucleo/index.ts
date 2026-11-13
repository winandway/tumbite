// El núcleo universal del simulador: nada de este archivo ni de sus vecinos sabe de Divoox.
export { crearAzar, semillaDe, type Azar } from './azar.ts';
export {
  relojReal,
  relojFalso,
  esperarHasta,
  ErrorEspera,
  resumir,
  type Reloj,
  type RelojFalso,
} from './reloj.ts';
export { metrosEntre, desplazar, ruta, crearEmisor, type Punto, type Emisor } from './gps.ts';
export { crearActor, type Actor, type Manias, type Respuesta, type Peticion } from './actor.ts';
export {
  correrLibreto,
  correrSesion,
  type OpcionesSesion,
  filtrar,
  ErrorComprobacion,
  type Escenario,
  type Ejecucion,
  type Paso,
  type ResultadoCorrida,
  type ResultadoEscenario,
} from './libreto.ts';
export { escribirReporte, paginaHtml, resumenMarkdown, contar, veredicto } from './reporte.ts';
