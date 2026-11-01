# Cómo probar la logística de Divoox (Divoox Flex) con tu impresora

Para Richard, 31 oct 2026. Todo es en producción (divoox.com), con las apps de TestFlight, en Novi y
Walled Lake (Michigan). No se mueve dinero: en Estados Unidos Flex no cobra al conductor.

## Lo que ya está armado para ti

- La empresa **Divoox Demo Logística**, con sus datos legales y su centro: **Centro Demo Novi**
  (43000 Grand River Ave, Novi).
- **Seis envíos** por Walled Lake y Novi: cinco a la puerta y uno en un **punto de encuentro**
  (la estación de servicio de 13 Mile y Novi Rd), para que veas cómo avisa al llegar.
- Una **ruta** con los seis, asignada a la cuenta de Driver del revisor (la que usaste para el video).
- Las **seis etiquetas en un PDF** listo para imprimir: se llama etiquetas-demo-logistica, en la
  carpeta privado del proyecto. Te lo mando al chat.
- El primer envío va a la cuenta del cliente del revisor: lo vas a ver en la app Divoox, en
  «Mis paquetes».

## La prueba, paso a paso

1. **Imprime** el PDF de las etiquetas y pega cada una en una caja o en un sobre.
2. **Driver** (con la cuenta del revisor): entra a «Mi ruta», acepta la ruta y toca «Llegué al
   centro» cuando estés en el centro.
3. **Carga:** escanea las seis etiquetas con la cámara. Cuando estén todas, aparece «Salir a la ruta».
4. **En la calle:** toca «Parada actual». En cada parada:
   - escanea la etiqueta de ese paquete («1 de 1 paquetes escaneados»);
   - si te pide foto, tómala; elige dónde lo dejaste;
   - desliza para finalizar.
     El sistema no deja entregar a más de 200 metros de la dirección: tienes que estar ahí.
5. **Del lado de quien recibe** (otro teléfono, o el mismo con la app Divoox):
   - entra con la cuenta del cliente del revisor → Mi cuenta → Mis paquetes: ahí está el primer
     envío, con el mapa;
   - o toca «Rastrear un paquete» y escribe o escanea cualquier número de seguimiento (empieza
     con DVX) de las etiquetas: lo sigues y te llegan los avisos.
   - Cuando el conductor esté a menos de 800 metros (1,5 km si es el punto de encuentro), llega el
     aviso **«Tu paquete ya llega»**, con el nombre del conductor, el vehículo y la placa.
6. **Al terminar:** «Terminar entregas y volver al centro» y después «Cerrar la ruta».

## Para hacer otra ruta igual

En la computadora del proyecto:

```bash
cd /Users/windocellc/Divoox && node scripts/produccion/armar-demo-logistica.mjs
```

Arma seis envíos nuevos, otra ruta y un PDF nuevo de etiquetas.

## Lo que todavía no funciona sin ti

- **Mensaje de texto y llamada** a quien recibe (la invitación y el «ya llega» por teléfono): están
  hechos y se encienden solos cuando pongas las claves de Twilio.
