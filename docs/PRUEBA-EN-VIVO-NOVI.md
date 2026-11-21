# Prueba en vivo de Carro en Novi, Michigan

Guía de la prueba que hace Richard en persona, con carro, en Novi (21 nov 2026). Estados Unidos.
Carro en Novi está encendido SOLO para cuentas marcadas de prueba: el público de Novi sigue viéndolo
«muy pronto» y no lo puede pedir (candado C-CUENTA-PRUEBA en `CANDADOS.md`).

## Qué instalar

- **Android:** las dos apps de la prueba interna de Google Play (la misma versión que está en revisión):
  Divoox (clientes, versión 59) y Divoox Driver (versión 67). Mientras Google no apruebe la revisión, la
  de la tienda pública es la anterior: hay que instalar la de prueba interna.
- **iPhone:** TestFlight: Divoox (clientes, compilación 65) y Divoox Driver (compilación 53).
- **Computadora:** el pasajero también puede pedir desde la web, en divoox.com, página «Ride» (en
  español, divoox.com/es/ride), mientras el conductor usa el teléfono. La web pide entrar con el correo y
  la clave (y el escudo anti-robots, que una persona pasa sin notarlo).

## Parte 1: con las cuentas ya listas

Las dos cuentas están en producción, marcadas de prueba y con «Soporte» en el nombre:

| Cuenta                   | Correo                              | Para qué                 |
| ------------------------ | ----------------------------------- | ------------------------ |
| Soporte Prueba Pasajero  | soporte.prueba.pasajero@divoox.com  | Pedir el viaje           |
| Soporte Prueba Conductor | soporte.prueba.conductor@divoox.com | Recibir y hacer el viaje |

Las claves están solo en la Mac, en el archivo `cuentas-prueba-richard` de la carpeta de
configuración de Divoox (nunca en el repositorio).

- El conductor tiene su carro aprobado (Toyota Corolla blanco, placa de prueba), sus papeles y requisitos
  de Carro aprobados por un año y Carro encendido en sus servicios. Al conectarse, la app puede pedir la
  foto de control (una selfie rápida): es normal.
- El pasajero tiene guardada la dirección «Casa» (la biblioteca pública de Novi, 45255 W 10 Mile Rd) con
  dos fotos ilustradas de la entrada. Al pedir desde ahí, el conductor ve esas fotos en «Ve a recoger»
  y dejan de verse al recoger.
- Se paga en efectivo. No usar tarjeta: Stripe está en modo real y cobraría de verdad.

Pasos: el conductor entra en Driver y se conecta; el pasajero entra en Divoox, elige Carro, pide desde
«Casa» hasta cualquier punto de Novi y paga en efectivo; el conductor acepta, va a recoger (ve las fotos),
toca «Llegué», pide el código al pasajero, empieza, termina; los dos se califican.

## Parte 2: crear las cuentas desde cero

Lo nuevo de una cuenta de prueba lo hace el equipo desde el panel (superadmin). Nada de esto se hace con
cuentas reales.

**Pasajero nuevo**

1. Crear la cuenta en la app Divoox (o en la web).
2. En el panel: Clientes → buscarla y abrir la ficha → tres puntos → «Marcar como prueba». (Desde ese momento sale con «Cuentas: De prueba».)
3. Volver a abrir la app en Novi: Carro aparece disponible.

**Conductor nuevo con carro**

1. Crear la cuenta en Divoox Driver, agregar el carro y subir los papeles que pide la app (licencia,
   registro, seguro, seguro de pasajeros, revisión del vehículo) y la verificación de identidad.
2. En el panel: Repartidores → abrir la ficha → tres puntos → «Marcar como prueba». Si la ficha no dice
   Novi, en los mismos tres puntos → «Cambiar ciudad» → Novi.
3. Verificaciones → aprobar su identidad.
4. Moto y Carro → «Motos y carros por revisar»: aprobar el carro. En los papeles: aprobar licencia,
   seguro de pasajeros y revisión del vehículo.
5. Moto y Carro → la ficha del conductor («Ver lo que le falta»): «Aprobar la edad» y «Aprobar
   antecedentes (cuenta de prueba)». En Estados Unidos los antecedentes los aprueba la verificación
   automática, que no corre sobre cuentas de prueba; por eso ese botón solo sale en una cuenta de prueba.
6. En la misma ficha: «Habilitar para Carro». Cuando ya no le falta nada, el conductor abre Driver,
   enciende Carro en sus servicios y se conecta.

## Cómo se comprobó

El viaje de punta a punta lo corre `scripts/produccion/probar-viaje-prueba-novi.mjs` por la API, como las
apps: ve Carro (el público no), guarda la dirección con sus fotos, se conecta (con la foto de control),
cotiza, pide en efectivo, la oferta llega, acepta, ve las fotos en «Ve a recoger», llega, empieza con el
código, ya no ve las fotos, termina y se califican. Las cuentas se arman (o se ponen al día) con
`scripts/produccion/armar-cuentas-prueba-novi.mjs`.
