# El recorrido completo en el navegador

Una prueba que hace dos trabajos a la vez:

1. **Comprueba Tumbite de punta a punta en cada publicación.** Corre sola en la revisión de GitHub; si se rompe, no se publica.
2. **Saca las capturas reales para Docs** cuando se le pide.

## Qué recorre (en inglés y en español)

1. El restaurante crea su cuenta en el panel, completa «Mi restaurante» con su ubicación y arma el menú con dos platos en los dos idiomas.
2. Nuestro equipo lo aprueba (por la API: esa pantalla es privada y no lleva capturas). El restaurante abre y la burbuja de ayuda lleva a «¿Cómo hago…?».
3. El repartidor crea su cuenta en su app y se conecta cerca del restaurante.
4. El cliente crea su cuenta, entra al restaurante, agrega los platos, pone la dirección y va al pago.
5. El banco aprueba: un aviso de Stripe firmado como el de verdad (Stripe va simulado; nunca se cobra).
6. El restaurante acepta con 20 minutos y marca «¡Listo!».
7. El repartidor recibe la oferta, la acepta, recoge y entrega; luego se desconecta.
8. El cliente lo ve entregado y califica la comida y al repartidor.
9. El restaurante aparta el 20 % de sus ventas para regalos y elige los nudos de ajo como regalo de cumpleaños; el cliente (que cumple años ese día) los pone en el carrito y el regalo aparece solo.
10. El cliente paga ese pedido y lo cancela antes de que el restaurante acepte: ve la devolución.
11. Otro pedido: el restaurante lo rechaza desde los tres puntos; el cliente ve que no se pudo atender y la devolución.
12. Otro pedido que nadie confirma: a los 7 minutos sale en rojo en el panel y a los 10 el Manager lo cancela solo (el reloj se adelanta en la base de prueba, no se espera).
13. En cada pago, el dinero cuadra al centavo: restaurante + repartidor + Tumbite = lo que pagó el cliente.

## Cómo se corre

- Solo la prueba (lo mismo que hace GitHub): `npm run recorrido`.
- Con capturas para Docs: `npm run recorrido:capturas`. Guarda las originales en `docs/capturas/recorrido/<pantalla>-<idioma>.png` y las versiones livianas en `apps/panel/public/docs/recorrido-<pantalla>-<idioma>.webp`, que son las que usan las guías. Después se revisan y se commitean.

## Cómo está armado

- `scripts/recorrido/preparar.mjs` compila el panel y las dos apps web apuntando a `http://localhost:8790` y las junta en `.recorrido/sitio` como en producción (panel en «/», cliente en «/app», repartidor en «/driver», servidor en «/datos»). La base sale nueva en cada corrida, con solo el esquema y la zona de Miami. Los secretos de prueba se inventan en el momento y viven en `.recorrido/` (fuera de git).
- `scripts/recorrido/stripe-simulado.mjs` responde a todo lo de Stripe. El servidor solo le habla porque `STRIPE_API_URL` apunta a localhost; en producción esa variable se ignora.
- `playwright.recorrido.config.ts` levanta el simulador y el servidor (`wrangler dev`) y corre `e2e/recorrido/recorrido.spec.ts`. Los textos de los botones en cada idioma están en `e2e/recorrido/textos.ts`: si se cambia un texto de la pantalla, se cambia también ahí.

## Lo que no puede probar (sigue en la prueba en la calle)

El formulario de tarjeta de Stripe de verdad, la cámara, los avisos al celular con sonido y la ubicación en segundo plano del repartidor.
