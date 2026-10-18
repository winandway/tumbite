# Plan: la app del repartidor como los grandes

Ficha: docs/investigaciones-rea/2026-10-18-repartidor.md (sección 5). Rama repartidor-grandes.

- [ ] Paso 1: servidor — oferta completa (distancia al local, total, minutos, artículos) con prueba en rojo; app — pantalla de oferta con cuenta regresiva, vibración/sonido y desglose.
- [ ] Paso 2: servidor — GET /datos/repartidor/calificaciones con prueba en rojo; app — pantalla Calificaciones.
- [ ] Paso 3: servidor — GET /datos/repartidor/ganancias con desglose por pedido (propina posterior como propina) con prueba en rojo; app — Ganancias con desglose y detalle.
- [ ] Paso 4: servidor — GET /datos/repartidor/avisos, push al repartidor en cancelación y cambio de dirección, PUT /datos/cuentas/idioma, con pruebas en rojo; app — campana real.
- [ ] Paso 5: servidor — POST /datos/repartidor/pausar y motivo claro al conectar fuera de cobertura, con pruebas; app — botón Pausa y aviso.
- [ ] Paso 6: servidor — POST /datos/repartidor/pedidos/:id/llegue y /no-esta-listo con pruebas; app — botones.
- [ ] Paso 7: app — alta guiada «Empieza a repartir» con las rutas existentes.
- [ ] Paso 8: app — Ayuda en el pedido con motivos predefinidos (ticket con pedido); botón Emergencia.
- [ ] Paso 9: guías de Docs es/en (ofertas, calificaciones, ganancias, avisos y pausa, alta, ayuda); recorrido con capturas.
- [ ] Paso 10: npm run verify en verde; CANDADOS.md; commit.
- [ ] Paso 11: staging (fase-repartidor-grandes) → producción por el flujo permanente; recompilar app del repartidor para el simulador; informe.
