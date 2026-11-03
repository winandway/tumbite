# Portada del cliente: cómo la arman las súper apps (REA, 3 nov 2026)

Motivo: Richard rechazó la portada POR-1 (75955b9f7). Era confusa y escondió los servicios (Moto, Carro, Envíos…) dentro de «Más». Error de referencia: se copió a DoorDash y Uber Eats, que venden **un solo servicio**. Divoox es **multiservicio**, y su estándar son las súper apps.

## Evidencia

- [REA] Ejecución de `capture_browser_scenario` sobre las fichas públicas de App Store (como visitante) de Uber, Rappi, Grab y DiDi.
  - Paquete: `evidencia-rea-2026-11-03-portada-superapps.json`.
  - SHA-256: `42c0f1fc768d518f4d930c41ca633bd4f00f7b6d470b33be2c72b3a3c08b35e6`.
- Límite: solo las capturas oficiales que cada empresa publica en su ficha. No se descompiló nada ni se usaron cuentas.

## Lo que se ve

| App         | Arriba                                       | Debajo del buscador                                                                                                  | Después                                            |
| ----------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Grab [REA]  | Buscador + avatar                            | **Cuadrícula de servicios 4×2** (Food, Transport, Mart, Dine Out, Express, Chope, Shopping, **More** al final)       | Franja de billetera y premios → banner → contenido |
| Rappi [REA] | Dirección «▾» + buscador «¿Qué quieres hoy?» | **Dos cuadros grandes** (Restaurantes, Turbo) + **una fila de cuadros chicos** (Mercado, Farmacia, Licores, Tiendas) | Tarjeta propia (RappiCard) → ofertas               |
| Uber [REA]  | Ubicación actual                             | Pastillas de servicio (Todo, Mercado, Viajes, Conveniencia)                                                          | Vitrinas por marca                                 |
| DiDi [REA]  | —                                            | Tarjetas de servicio (Express, Taxi, Moto)                                                                           | Comida por categorías (Pizza, Burger, Alitas)      |

## Conclusión

- [OBS] En las súper apps, **elegir el servicio es lo primero** después del buscador. Va en cuadros grandes con dibujo y nunca escondido en un botón.
- [OBS] «Más» solo agrupa lo que no cabe en la cuadrícula.
- [INF] Lo de DoorDash (filtros Entrega/Recoger, categorías, restaurantes) es lo que va **dentro de Comida**, no en la portada general.

## Decisión (maqueta P-2)

1. Cabecera: dirección «Entregar en ▾», campana e idioma.
2. Saludo y buscador.
3. Servicios estilo Rappi, todos visibles:
   - dos cuadros grandes: Comida y Moto;
   - una fila de cuatro: Carro, Envíos, Mercado y Más;
   - lo que viene lleva una etiqueta discreta «Pronto».
4. Franja de saldo y premios estilo Grab, solo si el cliente tiene algo.
5. Ofertas reales del día.
6. Comida cerca de ti: categorías y restaurantes con foto grande, en una lista vertical que carga al bajar (lo bueno de POR-1 se queda, pero debajo de los servicios).
7. Los filtros Entrega/Recoger/Ofertas/Abiertos salen de la portada y se quedan en la pantalla de Comida.
