# Seguimiento honesto (BRE-2, 2 nov 2026) — todos los países

## 1. Referencia y evidencia

- [DOC] Estudio de Richard «Estudio-plataforma-de-comida-DoorDash-Uber-Eats-Rappi» (reglas del seguimiento): mostrar un rango entendible y la última actualización, no una precisión falsa; si el mapa se congela, indicarlo; un tiempo viejo no se presenta como seguimiento en vivo. En la tabla de estados: «Llegada estimada: rango actualizado».
- [DOC] Estudio «Estudio_Delivery_Tumbite», paso 9 «recogido»: mapa en vivo + ETA con rango (Uber DeepETA, DoorDash).
- [REA] Nuestra página de seguimiento compartido en el sitio de pruebas, vista como visitante con un código inexistente (paquete `evidencia-rea-2026-11-02-seguimiento-honesto.json`, guardado fuera del repositorio en `~/Divoox-privado/estudios/rea/` porque el escáner de secretos confunde sus identificadores internos de recursos con claves; sha256 `e22c57c9594fec0bfbdcf46d601d007c7e9901e5e809d0c3c6e72484ed1c1c38`, tres registros: estructura, red y captura). Se ve que la página pide `/datos/publico/pedido/<código>` cada pocos segundos y que solo decía «Se actualiza solo cada pocos segundos», sin hora real ni aviso de señal.
- [NV] Cómo calculan Uber y DoorDash el ancho exacto del rango (modelos internos).
- Límite: no se analizaron apps de terceros; su centro de ayuda redirige a la portada sin la página buscada.

## 2. Comparación

| Pieza                | Los grandes | Divoox antes                                | Divoox ahora                                                               |
| -------------------- | ----------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| Última actualización | Se muestra  | Hora de la última ubicación, solo en la app | «Actualizado hace X s» en la app y el enlace, cuenta entre consultas       |
| Señal perdida        | Se indica   | Nada: el punto viejo parecía en vivo        | Aviso a los 60 s, punto en gris y sin línea de ruta                        |
| Llegada              | Rango       | Solo «a más tardar»                         | Rango de 10 min (nunca pasa del «a más tardar», mínimo 5) + «a más tardar» |

## 3. Decisión

Una sola pieza en `packages/compartido/src/seguimientoHonesto.ts` (segundos, señal, rango, textos y la estimación de llegada que antes vivía solo en el servidor). El servidor manda los segundos medidos con su propio reloj (sin depender del reloj del celular). La dirección del cliente se usa en el enlace compartido solo para la cuenta y nunca sale en la respuesta.

## 4. Pruebas de aceptación

- `seguimientoHonesto.test.ts` (compartido): horas, señal a los 60 s, textos en los dos idiomas, rango recortado, misma estimación; y la app del cliente usa la pieza.
- `operacion.test.ts`, «C-SEGUIMIENTO-HONESTO»: app y enlace con 10 s y con 2 min sin ubicación.
- `PedidoCompartido.test.tsx`: con señal y sin señal, español e inglés.
