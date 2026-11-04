# Capturas de la ficha de Apple: Divoox (app del cliente)

Sacadas el 4 nov 2026 de la app de iPhone **real** (la misma versión que va en la compilación 28), en el simulador del iPhone 18 Pro Max (1320 × 2868, el tamaño de 6,9" que pide Apple), contra **producción** (divoox.com), en inglés y en Novi, Michigan. Sin restaurantes que no existan: solo sale Divoox Review Kitchen.

| Archivo | Qué muestra |
|---|---|
| 01-inicio.png | La portada sin cuenta, con «Sign in to order» y Divoox Review Kitchen en «Fastest near you». |
| 02-menu.png | El menú de Divoox Review Kitchen con sus fotos. |
| 03-menu-carrito.png | Dos platos agregados y «View cart (2)». |
| 04-carrito-cuenta.png | Al ir a pagar sin cuenta: «Sign in», «New here? Create your account» y «Keep browsing without an account». |

**No se subieron a Apple.** Se suben solo con el APTO del auditor de tiendas y el sí de Richard (orden de Gerencia).

**Lo que falta y por qué:** las pantallas con cuenta (el carrito con el total, el seguimiento en vivo y el pedido entregado) no se pueden sacar en producción sin entrar con la cuenta de revisión, y la IA no escribe contraseñas en producción. Las saca Richard al grabar el video, con la cuenta de revisión, o se arman en el sitio de pruebas con un restaurante igual a Divoox Review Kitchen. Las frases de arriba y el fondo se ponen después con `node scripts/marca/fichas-tiendas.mjs`.
