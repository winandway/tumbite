# Divoox Carro, fase 2: paradas, categorías y tarifa dinámica

Fecha: 14 de noviembre de 2026. Rama: `fase-carro-2`. Países: todos, con valores propios de Venezuela y Estados Unidos.

Orden de Richard: «construir paradas múltiples, categorías y tarifa dinámica de Carro».

## Qué quedó hecho

1. **Categorías de carro.** Carro, Carro Comfort, Carro Premium y Carro XL. El pasajero ve el precio de cada una para su mismo viaje y elige. El carro del conductor recibe su categoría al aprobarlo. Un carro mejor también recibe los viajes de abajo, salvo que el conductor lo apague.
2. **Tarifa dinámica.** Un multiplicador por ciudad que sube con la demanda, por escalones, y nunca pasa del tope de la ciudad ni del tope del país. El pasajero lo ve antes de pedir y el conductor en la oferta. Nace apagada en cada ciudad.
3. **Paradas.** El pasajero agrega paradas al pedir o con el viaje en marcha, y siempre ve el precio nuevo antes de confirmar. El conductor marca cada parada y la espera de más se cobra.

## Valores por país (como el mercado; fuente en la ficha)

| Regla                      | Venezuela                          | Estados Unidos                               |
| -------------------------- | ---------------------------------- | -------------------------------------------- |
| Paradas por viaje          | 2                                  | 3                                            |
| Espera gratis por parada   | 2 minutos                          | la de la tarifa de la ciudad (2 por defecto) |
| Carro Comfort              | hasta 12 años, 4 plazas            | hasta 8 años, 4 plazas                       |
| Carro Premium              | hasta 8 años, lo aprueba el equipo | hasta 6 años, lo aprueba el equipo           |
| Precio de Comfort          | 1,3 veces el de Carro              | se escribe en la tarifa de la ciudad         |
| Precio de Premium          | 1,8 veces el de Carro              | se escribe en la tarifa de la ciudad         |
| Tope de la tarifa dinámica | 1,5 veces                          | 2 veces                                      |

Los años y los topes son decisión nuestra a partir del mercado (Uber no publica un año único ni sus multiplicadores). Están marcados como inferencia en la ficha.

## Dónde vive cada cosa

- Reglas por país: `packages/compartido/src/perfilPasajeros.ts` (`carro`).
- Fórmulas: `packages/compartido/src/viajes.ts`.
- Servidor: `apps/servidor/src/viajesDinamica.ts`, `rutas/paradasViaje.ts`, `rutas/dinamicaViaje.ts`, y cambios en `rutas/viajesPasajero.ts`, `rutas/viajes.ts`, `operaciones.ts`, `rutas/servicios.ts`, `rutaPorCalles.ts`, `finanzas/conductor.ts`.
- Base: tablas `paradas_viaje`, `cambios_viaje` y `dinamica_zona`; columnas nuevas en `tarifas_viaje`, `cotizaciones_viaje` y `vehiculos`.
- App del pasajero: `apps/cliente/src/viajes/PedirMoto.tsx`, `Paradas.tsx`, `ViajeEnCurso.tsx`, y el mapa.
- App Driver: `apps/repartidor/src/viajes/OfertaViaje.tsx`, `ViajeActivo.tsx`, `AltaPasajeros.tsx`.
- Panel: `SuperViajes.tsx`, `DinamicaCiudad.tsx`, `SuperMoto.tsx`.
- Docs públicas: `apps/panel/src/sitio/docs/carro.ts`. Capturas: `scripts/recorrido/capturas-carro.mjs`.
- Candados: `CANDADOS.md`, sección «Divoox Carro, fase 2».

## Cómo se enciende en una ciudad (en el sitio de pruebas)

1. Panel del equipo → Viajes → nueva tarifa de Carro para la ciudad. Para Comfort y Premium se escribe su factor. Para la tarifa dinámica se escribe el tope.
2. La tarifa dinámica queda en automática. En la tarjeta de la ciudad se puede fijar a mano por un rato o apagar.
3. La categoría de cada carro se pone al aprobarlo, en Moto → carros por revisar.

## Lo que no quedó y por qué

- **Con tarjeta, agregar una parada que suba el precio con el viaje ya pedido.** La autorización del cobro es por el precio exacto y esta fase no podía tocar el cobro.
- **Peajes.** No entraron.
- **Las apps de las tiendas** necesitan compilación nueva. No se compiló nada.
- **Nada se probó con dinero real.** Carro sigue apagado en producción.
- **Tarifa dinámica en Venezuela en producción:** no se encontró una norma local; antes de encenderla allá hace falta la confirmación del abogado.
