-- Fase 3 · VUELTA ATRÁS (docs/FASE-3-EXCLUSIVIDAD-ASIGNACION.md §4). Quita los disparadores de la
-- exclusividad y de los viajes. Comida vuelve a funcionar exactamente como antes de la Fase 3 (su
-- sentencia de aceptación no depende de nada de esto). Las tablas nuevas quedan sin uso; no se
-- borran (no tienen datos reales: Moto y Carro nunca se encendieron).
-- OJO: si se revierte, hay que vaciar también ESQUEMA_FASE3 (apps/servidor/src/esquemaFase3.ts)
-- antes de la siguiente publicación, o el servidor los vuelve a crear al arrancar.
DROP TRIGGER IF EXISTS pedidos_ocupa_conductor;
DROP TRIGGER IF EXISTS pedidos_libera_por_estado;
DROP TRIGGER IF EXISTS pedidos_libera_al_soltar;
DROP TRIGGER IF EXISTS pedidos_reactiva_ocupa;
DROP TRIGGER IF EXISTS pedidos_reasigna_ocupa;
DROP TRIGGER IF EXISTS repartidores_vehiculo_fijo_en_operacion;
DROP TRIGGER IF EXISTS operaciones_ocupa_conductor;
DROP TRIGGER IF EXISTS operaciones_al_asignar;
DROP TRIGGER IF EXISTS operaciones_libera_conductor;
DROP TRIGGER IF EXISTS operaciones_libera_al_terminar;
DROP TRIGGER IF EXISTS operaciones_estado_coherente;
DROP TRIGGER IF EXISTS operaciones_conductor_coherente;
DROP TRIGGER IF EXISTS viajes_transicion_valida;
DROP TRIGGER IF EXISTS viajes_actor_solo_con_transicion;
DROP TRIGGER IF EXISTS viajes_al_cambiar_estado;
DELETE FROM conductor_ocupacion;
